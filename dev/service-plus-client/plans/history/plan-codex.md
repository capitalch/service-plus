# Service+ subscription and entitlement architecture

## 1. Outcome and recommendations

Implement subscriptions as a small PostgreSQL **control plane** plus an
enforcement projection in each tenant database. The control plane is the
authoritative source for customers, plans, subscriptions, payments and database
allocation. Each tenant database holds the customer/BU/user ownership data and
the counters that must be changed atomically with a business action.

This is deliberately not a collection of `if plan == ...` branches. Application
code asks one entitlement service questions such as:

```text
require_feature(customer_id, "inventory.enabled")
consume_monthly(customer_id, "jobs.monthly_limit", idempotency_key)
require_capacity(customer_id, "users.max_users")
```

The plan determines the values; code determines *where* a feature is enforced.
Adding a plan or changing a plan's values is data-only. Adding a genuinely new
product feature still requires a code gate at its API entry point; no data model
can safely make an unknown operation enforce itself.

### Decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Plan configuration | Normalized PostgreSQL rows, compiled into a JSONB effective-entitlement projection | Rows are easy to validate, query and edit; the JSONB projection makes a request-time lookup simple and versioned. |
| Plan source of truth | `service_plus_client` control-plane database | Subscription, payment, and database allocation are platform concerns, not BU data. |
| Enforcement projection | `security.customer_entitlement` in every tenant database | The status/limits are available beside the job/user/BU transaction that must enforce them. It is a cache/projection, never the administrative source of truth. |
| Lite/Basic/Standard tenancy | One pooled service database; one customer-owned BU schema per customer | Low-cost and quick to provision, while retaining the application's existing per-BU business-data layout. |
| Enterprise tenancy | One dedicated service database per customer | Gives separate physical database, backup/restore and noisy-neighbour boundaries. It does not replace API authorization. |
| Subscription owner | Customer, not BU and not database | A customer can own one BU in the pooled database or up to five BUs in its dedicated database without duplicating billing state. |
| Frontend behavior | Hide unavailable UI and show usage, but enforce only on the server/database | Browser checks can be bypassed. |
| Caching | In-process, short-lived entitlement cache only after correctness tests; invalidate on every lifecycle change | Current deployment does not need Redis. JWT claims and frontend state are never enforcement sources. |

## 2. Current-state findings that shape the design

The inspected repositories already establish these constraints:

- `service_plus_client` is the tenant registry. Its `public.client` row currently
  contains one `db_name`, and `db_name` is uniquely constrained. The present
  model therefore cannot represent several customers in the same database
  without a migration.
- Each service database has a `security` schema (`user`, `bu`,
  `user_bu_role`, roles and rights) and one business schema per BU code. The
  BU-schema DDL and seed process already exist in
  `app/graphql/resolvers/bu_admin/provisioning.py`.
- Login currently resolves `client_id -> client.db_name`, then looks up a user
  in that database. JWTs contain `db_name` and `bu_codes`; normal GraphQL calls
  receive a caller-supplied `db_name` and `schema`.
- Existing `require_own_tenant` protects the generic resolvers, but several
  direct root mutations currently do not call it. `require_bu_access` also lets
  a Business Admin bypass the BU check, and it lets any authenticated user pass
  the `security` schema. Those are unacceptable once unrelated pooled customers
  share one database.
- `genericQuery`, `genericUpdate`, and `genericUpdateScript` can dispatch a
  client-supplied SQL id or table name. They need an allowlist and ownership
  checks; plan enforcement must not be bolted onto the client alone.
- The current public website key is sent from `NEXT_PUBLIC_WEBSITE_KEY`. It is
  visible to every website visitor, so it is not an authentication secret and
  must not be trusted to protect account creation.

The security hardening in Phase 1 is a prerequisite, not optional subscription
work.

## 3. Tenant vocabulary and target relationship

Use **customer** in product and design documentation. For a low-risk migration,
the existing `public.client` row remains the customer record in code and API
contracts initially; do not create a second table that represents the same
company. A later naming migration can rename it if desired.

```text
platform super admin
        |
public.client  (customer / billable tenant)
        | 1
public.subscription ----> public.plan ----> public.plan_entitlement
        |
public.tenant_database (POOLED or DEDICATED) ----> PostgreSQL database
        |                                              |
        |                                    security.bu (customer_id)
        |                                              |
        |                                    BU business schema(s)
        |
security.user (customer_id) -- security.user_bu_role -- security.bu
        |
security.customer_entitlement / usage_counter / usage_event
```

`customer_id` in a tenant database is the numeric ID of its control-plane
`public.client` row. It cannot have a PostgreSQL foreign key across databases,
so all provisioning is server-owned and tenant guards validate the relationship
on every request.

### Database allocation

Add `public.tenant_database`; do not overload a customer row as a database row.

- A `POOLED` record represents the prebuilt Lite/Basic/Standard database and
  can be referenced by many `client` rows.
- A `DEDICATED` record is referenced by exactly one Enterprise customer.
- `public.client.tenant_database_id` becomes the durable relationship.
- Keep `client.db_name` only as a transitional denormalized compatibility
  column. Backfill it from `tenant_database.db_name`, migrate readers to the
  join, then remove it in a later release. Drop the current unique constraint
  on `client.db_name` before assigning pooled customers.
- `client.default_bu_code` identifies the first/customer's primary BU. Pooled
  customers must own exactly one active BU; Enterprise customers may own up to
  their entitlement limit.

This adds an explicit `Customer -> Database -> BU` chain while preserving the
existing client dropdown and login contract during migration.

## 4. Control-plane schema

All money is integer paise, all state timestamps are `timestamptz`, and all
human-facing dates/period boundaries use `Asia/Kolkata`. A month key is the
first local day of that calendar month (`YYYY-MM-01`), not a rolling 30-day
window.

### New/changed `service_plus_client.public` tables

| Table | Key columns and purpose |
| --- | --- |
| `tenant_database` | `id`, `code`, `db_name UNIQUE`, `kind` (`POOLED`/`DEDICATED`), `is_accepting_signups`, `capacity_customers`, `provisioning_status`, timestamps. One row is the prebuilt pool; each Enterprise database has one row. |
| `client` (existing customer row) | Add `tenant_database_id NOT NULL`, `default_bu_code`, `signup_state`, and optional public-safe `login_code`. Retain `db_name` only while old code reads it; remove `client_db_name_key` after the backfill. |
| `plan` | `id`, immutable `code`, `name`, `price_paise`, `billing_interval`, `is_public`, `is_active`, `display_order`, `version`. Never edit a code's historical meaning in place. |
| `entitlement_definition` | `key` (for example `jobs.monthly_limit`), `value_type` (`BOOLEAN`/`INTEGER`), `scope` (`CUSTOMER`), `description`, `is_active`. This is a controlled catalogue, not arbitrary user input. |
| `plan_entitlement` | `plan_id`, `entitlement_key`, typed value (`boolean_value` or `integer_value`), and an XOR/type check. A NULL integer means unlimited; zero means none. |
| `subscription` | `id UUID`, `client_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `started_at`, `cancel_at_period_end`, `ended_at`, `entitlement_version`, and provider-neutral references. Exactly one current subscription per customer. |
| `subscription_entitlement_override` | `subscription_id`, `entitlement_key`, typed value, `reason`, `expires_at`, `created_by`. Supports negotiated Enterprise terms without another plan code. |
| `subscription_event` | Append-only lifecycle audit: subscription, event type, old/new plan/status, actor, correlation id, payload, timestamp. |
| `payment` | `id`, `subscription_id`, `provider` (`MANUAL`, later `RAZORPAY`), `provider_reference`, amount paise, currency, state, period, verified_by, received_at. |
| `payment_event` | Raw provider webhook/event id, payload hash, received/processed timestamps and result; unique on `(provider, provider_event_id)` for idempotency. |
| `signup_request` | Normalized email/mobile hashes, encrypted/minimized contact data, request state, CAPTCHA/risk result, idempotency key, email-verification token hash and expiry, customer/subscription IDs after provisioning, attempt metadata. |
| `outbox_event` | Durable `ENTITLEMENT_PROJECTION_CHANGED` and provisioning events for retry/reconciliation when a cross-database projection update is temporarily unavailable. |

Use check constraints, foreign keys, unique normalized email/mobile indexes where
the business policy requires one account, and partial unique indexes for one
current subscription. Do not store a payment-provider secret or raw verification
token in these tables.

### Seeded plans

Seed the requested feature values as data:

| Entitlement | Lite | Basic | Standard | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| `inventory.enabled` | false | false | true | true |
| `jobs.monthly_limit` | 50 | 100 | 500 | unlimited |
| `whatsapp.enabled` | false | true | true | true |
| `whatsapp.monthly_limit` | 0 | 100 | 500 | 2,000 |
| `users.max_users` | 1 | 1 | unlimited* | unlimited* |
| `business_units.max_units` | 1 | 1 | 1 | 5 |
| price (`price_paise`) | 0 | 299,900 | 599,900 | 1,099,900 |

`*` The brief says "Multiple" but gives no number. This plan treats it as
unlimited (`NULL`) so it is not silently more restrictive than the published
plan. Replace it with an explicit finite value before launch if that is the
commercial intent. Pricing also needs a product decision on GST inclusivity and
annual pricing; neither belongs in entitlement enforcement.

Seed an internal, non-public `LEGACY` plan with all current features enabled and
unlimited limits. Existing customers stay on it until deliberately moved, which
prevents an accidental production lockout during migration.

## 5. Entitlement evaluation and projection

### Effective entitlement

The authoritative value is calculated in this order:

```text
entitlement_definition default
    <- plan_entitlement
    <- active, non-expired subscription override
    = effective entitlement for subscription version N
```

The server validates every value against `entitlement_definition`; administrators
may choose values for known keys but cannot invent a key that no code understands.
An effective payload is represented as JSONB only after this validation, e.g.:

```json
{
  "business_units.max_units": 1,
  "inventory.enabled": false,
  "jobs.monthly_limit": 50,
  "users.max_users": 1,
  "whatsapp.enabled": false,
  "whatsapp.monthly_limit": 0
}
```

### Tenant-database projection

Create `security.customer_entitlement` in the pooled database and every
Enterprise database:

| Column | Purpose |
| --- | --- |
| `customer_id PK` | Control-plane customer/client ID. |
| `subscription_id`, `entitlement_version` | Detect stale and out-of-order projection messages. |
| `status`, `period_start`, `period_end` | Fast lifecycle and period checks. |
| `effective_entitlements JSONB` | Validated effective values for local guards and quota functions. |
| `synced_at` | Operational visibility and reconciliation. |

On create/change/suspend, commit the control-plane event, update the local
projection synchronously, and only then report the administrative action as
complete. Persist an outbox record before the cross-database update so failed
delivery is visible and retryable. A reconciler repairs projections by version.
For a restrictive change (suspension, cancellation, lowered quota), a stale or
unavailable projection must fail closed for writes; it must never retain broader
rights indefinitely. A short in-process cache may be added later for reads,
keyed by `(customer_id, entitlement_version)` and invalidated by lifecycle
changes. It must have a bounded TTL (60 seconds or less) and no use in quota
increments.

Do not put authoritative entitlements in JWTs. The JWT may include a version for
the UI, but every protected operation reads the current local projection.

## 6. Tenant ownership, login, and authorization

### Required tenant-database ownership fields

Add the following to each tenant database's `security` schema:

- `security.bu.customer_id BIGINT NOT NULL`
- `security.user.customer_id BIGINT NOT NULL`
- `security.customer_entitlement` described above
- `security.usage_counter` and `security.usage_event` described below

Backfill them before making them non-null. Add constraints/triggers so a
`user_bu_role` relation can only connect a user and BU with the same
`customer_id`. In a pooled database, a customer must never be allowed to create
or assign a user to another customer's BU.

Business data stays per-BU schema, so the schema-to-BU lookup must prove:

```text
requested schema -> active security.bu -> bu.customer_id == token.customer_id
```

That check is required for every query, mutation, batch item, WebSocket
subscription, file operation and direct resolver. It is not enough to compare a
requested database name.

### Token and request resolution

At login, the server resolves the supplied customer/client record using the
control plane, derives `tenant_database.db_name` server-side, authenticates the
user in `security.user` with the matching `customer_id`, and calculates only
their permitted BUs. Issue claims containing:

```text
sub, customer_id, tenant_database_id, db_name, user_type,
access_rights, bu_codes, entitlement_version
```

`db_name`, `customer_id`, and BU codes supplied by the browser are assertions to
verify, not routing instructions to trust. Refresh tokens must re-read the user,
customer membership, active subscription status/version and BU access before
issuing a new pair.

The current client-picker login can continue during the transition. For Lite
signup scale and customer privacy, plan a follow-up identity-first login
(email/mobile + password, resolving the one eligible customer server-side or
returning a safe post-auth choice). Do not expose a global searchable list of
all Lite customers indefinitely.

### GraphQL hardening before subscriptions

1. Make GraphQL authenticated by default. Explicit public flows remain REST
   routes; do not make generic GraphQL public.
2. Add `require_authenticated`, `require_customer_access`,
   `require_own_tenant`, and `require_bu_access` checks to every direct root
   resolver, including job, inventory, admin, mail and provisioning mutations.
3. Remove the Business Admin blanket BU bypass. An Admin gets all BUs for
   **their customer**, not every BU in a pooled database. Super Admin remains a
   separately guarded platform identity.
4. Treat `security` as protected tenant data. A normal user cannot select it
   through a generic operation; even an Admin only receives a narrow allowlist
   of customer-scoped security operations.
5. Replace open-ended `getattr(SqlStore, sql_id)` and arbitrary `tableName`
   dispatch with an operation registry. Each allowed SQL id/table declares
   permitted schema kind, required access right, customer filter/ownership
   behavior, and (where applicable) entitlement key. Subscription and payment
   changes use dedicated Super Admin resolvers, never generic updates.
6. Guard Super Admin operations by `user_type == "S"` at the resolver and
   service layer. Do not rely on routes or the frontend menu. Current
   provisioning operations that accept arbitrary database names require this
   treatment.

Use a non-owner runtime database role and `SET LOCAL app.customer_id` for each
pooled request. Add `FORCE ROW LEVEL SECURITY` policies to the new
customer-scoped `security` tables as defence in depth. This does not replace
application schema/operation guards, but turns a missed `WHERE customer_id` into
a denial rather than a cross-customer disclosure. Keep shared role/access-right
catalogue data read-only and separately scoped.

## 7. Usage metering and limits

### Tables and semantics

| Table | Keys and purpose |
| --- | --- |
| `security.usage_counter` | `(customer_id, metric_key, period_start)` primary key; `used`, `updated_at`. Used for calendar-month jobs and WhatsApp. |
| `security.usage_event` | Immutable event/idempotency record: customer, metric, period, source type/id, idempotency key, quantity, state (`RESERVED`, `COMMITTED`, `RELEASED`, `UNKNOWN`), timestamps. Unique customer/metric/idempotency key. |
| `security.customer_entitlement` | Supplies the current limit and enabled/status check to the transactional function. |

The metric registry maps `jobs.monthly_limit` to `jobs` and
`whatsapp.monthly_limit` to `whatsapp`; no plan code appears in a metering path.
Users and BUs are capacity metrics, so they check the active owned count in the
same transaction as user/BU provisioning rather than creating a monthly row.

### Atomic enforcement

Implement a PostgreSQL function/service equivalent to
`security.consume_quota(customer_id, metric_key, requested_quantity,
idempotency_key, period_start)`. It must:

1. Lock or atomically upsert the one counter row.
2. Load the active local entitlement projection.
3. Reject inactive subscription, disabled feature, or a finite limit that would
   be exceeded.
4. Return the existing result for the same idempotency key.
5. Increment/reserve only in the caller's transaction.

Never implement limits as `SELECT count ...; if below limit INSERT ...`; two
concurrent requests will pass that check. The job creation path must call the
quota function and insert every created job in the *same PostgreSQL
transaction*, so a later insert failure rolls the counter back. A batch consumes
one unit per successfully created job, not one per request. Deleting or voiding
a job does not refund the monthly "jobs created" allowance unless the product
specification later says otherwise.

For user and BU creation, take a customer-scoped transaction/advisory lock,
check the active owned count against `users.max_users` or
`business_units.max_units`, then insert and assign ownership atomically. The
Lite/Basic one-BU rule is enforced here and not merely by hiding the Add BU
button.

WhatsApp involves an external provider, so use a reservation pattern: create a
unique `RESERVED` usage event and increment in a local transaction; send after
commit; mark `COMMITTED` on provider acceptance or `RELEASED` and decrement on
definite pre-send failure. A process failure after the provider call is marked
`UNKNOWN` and reconciled rather than automatically refunding a possibly sent
message. This prevents both duplicate sends and quota bypasses.

The service returns consistent GraphQL error codes such as
`SUBSCRIPTION_INACTIVE`, `FEATURE_NOT_INCLUDED`, and `QUOTA_EXCEEDED`, with
safe `feature_key`, `limit`, `used`, and `period_end` extensions for the UI.

## 8. Lifecycle and payments

Model lifecycle separately from payment provider state.

| Status | Proposed behavior |
| --- | --- |
| `ACTIVE` | Normal reads and writes within entitlements. |
| `SUSPENDED` | Login may show billing/support information and existing data may be read if product policy permits; all business writes and quota reservations are denied. |
| `EXPIRED` | Deny business writes and new sessions; retain data for the retention/grace policy. |
| `CANCELLED` | No new sessions or business actions. Retain only according to a documented data-retention policy. |

Put all transitions behind a single lifecycle service with an explicit state
transition table. `ACTIVE -> SUSPENDED`, upgrades/downgrades, renewal,
expiration and cancellation create append-only `subscription_event` records
and advance `entitlement_version`. Super Admin's manual bank-transfer workflow
uses this same service; it must not directly update subscription rows.

For Razorpay later:

- Persist provider-neutral `payment` records now with `provider = MANUAL`.
- Define a small provider interface: initiate checkout (later), validate
  webhook signature, normalize event, and return a provider reference.
- The future Razorpay webhook route validates its raw-body signature using a
  server-only secret, inserts `payment_event` idempotently, then asks the same
  lifecycle service to activate/renew/change the subscription.
- Never let the browser mark a payment successful. Webhook delivery order and
  retries are expected, so provider event idempotency is mandatory.

## 9. Public Lite signup flow

The two requested inputs, email and mobile, are adequate to *start* a signup
but not to create the existing required `security.user` fields safely:
`username`, `full_name`, and `password_hash` are required. The recommended UX
is a short staged flow, not a server-generated password.

```text
Website form (email, mobile, CAPTCHA, idempotency key)
  -> POST /api/public/lite-signups
  -> pending request + email verification link/OTP
  -> verified completion (full name, workshop/BU name, password)
  -> one server transaction/workflow provisions customer, Lite subscription,
     pooled BU schema, owner user and entitlement projection
  -> set-password/login confirmation
```

### Endpoint behavior

1. Define strict Pydantic length/format normalization for email and Indian
   mobile number; normalize before lookup.
2. Verify a server-side CAPTCHA/Turnstile token, enforce trusted-real-IP rate
   limits and separate limits by IP, email hash, mobile hash and device/risk
   signal. Configure CloudJiffy/nginx trusted proxy headers before relying on
   `request.client.host`.
3. Require an `Idempotency-Key`. A retry with the same normalized payload and
   key returns the original request status; reuse with different content is
   rejected.
4. Always return an enumeration-safe accepted response for an existing email or
   mobile. Internally distinguish already active, pending verification, and
   blocked requests; offer the relevant verified recovery path by email.
5. Store only a hash of a high-entropy, single-use verification token, with a
   short expiry. Provision nothing active until verification succeeds.
6. In the final provisioning worker/service, select an active pooled database
   with capacity; create the `client`, Lite subscription and outbox record;
   create the customer-owned BU schema using the existing hardened provisioning
   service; create the owner user/role/membership; and write the entitlement
   projection. Use an explicit `PROVISIONING` state so failed operations can be
   safely retried or manually repaired.
7. Log security-relevant events without passwords, tokens, email addresses or
   mobile numbers in plaintext. Alert Super Admin only for actionable failures.

This route must not trust `X-Website-Key`, CORS, or a `NEXT_PUBLIC_*` value as
security. CORS is configured to permit the real website origin for browser UX,
but CAPTCHA, rate limits, idempotency, input validation and email verification
are the actual abuse controls.

## 10. Enterprise provisioning

Replace the current client-side sequence of create-client/create-database/seed
operations with one explicit Super Admin workflow:

```text
create customer + Enterprise subscription (PROVISIONING)
  -> reserve unique dedicated database name/record
  -> CREATE DATABASE using a privileged provisioning role
  -> create security schema from current versioned DDL and seed roles/rights
  -> add entitlement projection
  -> create up to five customer-owned BU schemas through shared provisioning code
  -> create/assign owner user and set-password invitation
  -> health check, mark tenant database READY and subscription ACTIVE
```

Every step writes a provisioning event/correlation ID. A failure marks the
workflow `FAILED` or `REPAIR_REQUIRED`; it does not leave a partly created
database invisible. Retrying is idempotent, and destructive cleanup requires a
separate confirmed Super Admin action. The server's runtime role should have
only ordinary application access; database creation/migration should use a
separate, tightly controlled provisioning credential.

Enterprise data is physically isolated, but the same JWT, resolver and
operation checks remain mandatory: a backend process with credentials to many
databases can otherwise still cross tenants.

## 11. FastAPI, GraphQL, and React design

### Server interfaces

- Keep anonymous signup/verification and payment webhooks as narrow REST
  routers under `/api/public` and `/api/webhooks`.
- Keep Super Admin subscription management as authenticated GraphQL operations
  with dedicated typed inputs/outputs. It is easier to audit and authorize than
  the generic SQL envelope.
- Expose a small `mySubscription`/`myPlanUsage` query to authenticated customer
  users. It returns plan display data, status, feature visibility and current
  usage; it never exposes other customers, payment secrets or global plan
  administration.
- Add server guards at each inventory entry point, each job creation path,
  every WhatsApp send path, user creation/activation, and BU creation/activation.
  A disabled menu is not a guard.

### Client behavior

- Extend the login/refresh response and auth state with a safe subscription
  summary (`planCode`, `status`, `entitlementVersion`, and effective UI values).
  It is advisory and refreshed after login/refresh or a `mySubscription` query.
- Add `hasFeature(entitlements, key)` and `hasCapacityHint(...)` utilities;
  neither replicates enforcement. Use them for Inventory navigation/routes,
  WhatsApp settings/send affordances, user/BU creation affordances and usage
  banners.
- Render a compact plan-usage banner for customers and an actionable quota
  error toast/modal when the server rejects an operation. Do not hide existing
  data after a suspension; render the lifecycle policy transparently.
- Add Super Admin pages for plan matrix management, subscriptions/customers,
  usage, entitlement overrides, manual payment recording, signup requests and
  the Enterprise provisioning wizard. The existing Clients page can be the
  starting customer list, but plan/subscription data should be dedicated views
  rather than columns bolted into unrelated dialogs.

## 12. Super Admin authorization and operations

Only the platform Super Admin (`user_type == "S"`) may:

- create/edit inactive or future plans and their known entitlement values;
- create a customer, assign/change a plan, add a time-bounded override, and
  activate/suspend/cancel/renew a subscription;
- inspect aggregate and customer-local usage;
- record and verify a manual payment;
- review/retry/reject Lite signups;
- allocate/retire pooled capacity;
- launch, repair or destroy an Enterprise provisioning workflow; and
- create Enterprise BUs, subject to entitlement enforcement.

Customer Admins can manage users/BUs only within their `customer_id` and only
while the subscription permits it. Access rights answer "may this staff member
perform the role action?"; entitlements answer "has this customer bought the
capability?" They are separate checks and neither grants the other.

Every Super Admin lifecycle, override, payment and provisioning action requires
an audit event containing actor, target customer, old/new state and correlation
ID. Sensitive payment data, passwords and tokens are excluded.

## 13. Migration and rollout plan

### Phase 0 — decisions and safety baseline

1. Confirm the finite/unlimited meaning of Standard and Enterprise "Multiple",
   tax/pricing display, suspension read policy, data retention, signup company
   name/full-name fields, and whether email verification is enough before SMS
   is available.
2. Take verified backups and rehearse all DDL on a disposable copy of the
   control-plane database and representative tenant database.
3. Inventory every GraphQL direct resolver, generic SQL id and generic update
   table. Record owner, required role, schema kind, customer filter and feature
   gate in the new operation registry.

### Phase 1 — authorization hardening

1. Add authenticated-by-default GraphQL policy and tests before changing plan
   behavior.
2. Enforce customer/tenant/BU ownership, including WebSocket subscriptions and
   `security` schema access.
3. Lock down direct provisioning mutations and generic dispatch. Deploy this
   phase independently and monitor rejected requests; it intentionally changes
   unsafe legacy behavior.

### Phase 2 — schemas and Legacy migration

1. Create `tenant_database`, backfill one database row for every existing
   `client`, add `client.tenant_database_id`, then migrate reads to the new
   relation. Do not drop `db_name` until all reader paths are migrated.
2. Add the plans/control-plane tables and seed Lite/Basic/Standard/Enterprise
   plus `LEGACY`.
3. Add the security ownership, entitlement, metering and RLS schema changes to
   every existing service database. Regenerate the checked-in schema dumps and
   client TypeScript database types afterwards.
4. Backfill each current customer with a `LEGACY` subscription, customer IDs on
   users/BUs, and the corresponding local entitlement projection. Reconcile and
   report any orphaned schema, user or BU before turning constraints to
   `NOT NULL`.

### Phase 3 — server enforcement in observe mode

1. Introduce the entitlement service and add non-blocking audit logging for
   planned gates/counters.
2. Reconcile counts with existing jobs, messages, active users and BUs; fix
   mismatches rather than guessing history.
3. Enable strict enforcement for newly provisioned Lite customers first, then
   Basic/Standard/Enterprise as their subscriptions are explicitly assigned.

### Phase 4 — administration, client UX, signup

1. Ship Super Admin plan/customer/usage views and manual payment workflow.
2. Ship client entitlement UX and server-error handling.
3. Prepare an active, capacity-limited pooled database, test end-to-end signup
   against staging, then enable the public Lite form.
4. Move legacy customers off `LEGACY` one at a time with a recorded decision.

### Phase 5 — payment and operations

1. Add Razorpay only after manual lifecycle paths and idempotent payment/event
   records are proven.
2. Add reconciliation/alerting for failed entitlement projections, stuck signup
   workflows, quota reservations and Enterprise provisioning jobs.

Every migration must be idempotent or record a migration version/checksum. No
production database schema is changed by the React deployment process.

## 14. Testing and acceptance strategy

### Server/unit and database integration tests

- Entitlement merge/order/type validation, unknown-key rejection, overrides,
  lifecycle transition table, cache invalidation and projection version ordering.
- Atomic quota tests with a real disposable PostgreSQL database: many concurrent
  requests against a limit of 10 yield exactly 10 successes; a failed job insert
  rolls back usage; a new IST month starts cleanly; unlimited still records
  usage; idempotent retry does not double-charge.
- WhatsApp reservation tests: pre-send failure releases once, retry uses one
  source event, and an unknown post-send outcome does not silently refund.
- Pooled isolation tests with two customers in one database: no cross-BU
  business access, no `security.user` or membership disclosure, no Admin
  cross-customer bypass, and no forged `db_name`, schema or batch item.
- Dedicated isolation tests: a token cannot name another database; a Super
  Admin-only provisioning action rejects normal and customer-Admin tokens.
- Generic operation registry tests: unregistered SQL ids/tables, invalid schema
  types and missing feature checks are denied.
- Public signup tests: malformed input, repeated key, email/mobile duplicate,
  expired/used verification token, CAPTCHA/rate-limit failures, capacity full,
  partially failed provisioning and retry.
- Razorpay-adapter contract tests later: invalid signature, duplicate event,
  out-of-order event and manual/provider parity.

### Client and manual verification

- Unit-test pure entitlement helpers once a client test runner is introduced;
  until then retain `pnpm lint` and `pnpm build` as mandatory checks.
- Browser smoke tests for each plan: routes and controls are appropriately
  hidden, usage is comprehensible, and a direct attempted API action still
  receives the server denial.
- Test current Super Admin, customer Admin and ordinary staff flows after Phase
  1; authorization hardening has broad regression risk.
- Update both in-app help audiences in the same implementation change: user
  guidance for plan/usage behavior and developer guidance for schema, guards,
  SQL registry and lifecycle invariants.

## 15. Planned files and modules

These are the eventual implementation targets, not changes made by this plan.

### Server (`../service-plus-server`)

**New**

- `app/db/migrations/runner.py` and `app/db/migrations/subscriptions_v1.py` —
  versioned control/data-plane migration orchestration.
- `app/db/sql/sql_subscriptions.py` — all subscription, entitlement, usage,
  ownership and operation-registry SQL, including atomic quota functions.
- `app/db/sql/sql_subscriptions_ddl.py` — control-plane/data-plane/RLS DDL
  constants used by migration/provisioning code.
- `app/subscriptions/entitlements.py` — effective entitlement resolution and
  projection version validation.
- `app/subscriptions/guards.py` — lifecycle, feature and quota guards.
- `app/subscriptions/lifecycle.py` — explicit subscription transition service.
- `app/subscriptions/metering.py` — job/WhatsApp reservation orchestration.
- `app/subscriptions/provisioning.py` — pooled and Enterprise workflow services.
- `app/subscriptions/projection.py` — outbox delivery and reconciliation.
- `app/subscriptions/payments/provider.py` and `app/subscriptions/payments/manual.py`
  — provider-neutral payment abstraction and manual adapter.
- `app/graphql/resolvers/subscriptions_admin/queries.py` and
  `app/graphql/resolvers/subscriptions_admin/mutations.py` — typed Super Admin
  subscription operations.
- `app/routers/public/lite_signup_router.py` and
  `app/routers/public/lite_signup_schema.py` — staged public signup endpoints.
- `app/routers/webhooks/razorpay_webhook_router.py` — add only when Razorpay is
  enabled.
- `tests/subscriptions/` — lifecycle, projection and metering tests.
- `tests/tenancy/test_pooled_customer_isolation.py` and
  `tests/public/test_lite_signup.py` — isolation and abuse-resistance tests.

**Modify**

- `app/main.py` — register the Lite signup router and, later, Razorpay router;
  configure trusted proxy handling deliberately.
- `app/config.py`, `app/core/settings/api_settings.py`, `.env.example` —
  CAPTCHA, signup, trusted-proxy, payment and provisioning settings; no values
  or defaults for secrets.
- `app/core/dependencies.py` and `app/core/rate_limit.py` — correct public
  request identity/rate limiting; do not treat the public website key as a
  secret.
- `app/core/exceptions.py` — centralized subscription/quota/lifecycle messages
  and GraphQL error codes.
- `app/core/audit_log.py` — subscription/payment/provisioning audit actions.
- `app/db/connection/psycopg_driver.py` and `pool_manager.py` — request-scoped
  customer context/RLS setup and safe database-registry resolution.
- `app/db/sql/sql_base.py` — compose the subscription SQL class.
- `app/db/schema_dumps/service_plus_client.sql` and
  `app/db/schema_dumps/service_plus_service.sql` — regenerated post-migration
  schema references.
- `app/graphql/schema.py`, `schema.graphql`,
  `app/graphql/resolvers/auth_guards.py`, `query.py`, `mutation.py`,
  `shared/generic_query.py`, and `shared/generic_update.py` — default auth,
  operation registry and customer/BU/entitlement enforcement.
- `app/graphql/resolvers/bu_admin/provisioning.py` and `users_roles.py` —
  shared customer-aware BU/user capacity checks; route Enterprise workflows
  through the new service.
- `app/graphql/resolvers/jobs/mutations.py`,
  `app/graphql/resolvers/inventory/mutations.py`, `app/whatsapp/sender.py`,
  `app/whatsapp/ew_sender.py`, and all other outgoing WhatsApp paths —
  transactionally invoke the right entitlement/metering guard.
- `app/routers/auth/auth_schema.py`, `helper.py`, and `router.py` — customer
  resolution, safe subscription summary and refresh-time revalidation.
- Existing authorization tests under `tests/test_auth_guards.py` and
  `tests/bu_admin/` — expand rather than replace current coverage.

### Client (`service-plus-client`)

**New**

- `src/features/auth/utils/entitlements.ts` — advisory feature/limit helpers.
- `src/features/client/components/shared/plan-usage-banner.tsx` and
  `src/features/client/hooks/use-plan-usage.ts` — customer plan/usage display.
- `src/features/super-admin/pages/plans-page.tsx` and
  `src/features/super-admin/pages/subscriptions-page.tsx` — plan matrix and
  customer subscription administration.
- `src/features/super-admin/components/plans/plan-matrix-editor.tsx` — known
  entitlement value editor.
- `src/features/super-admin/components/subscriptions/` — change-plan,
  status, override, manual-payment, signup-review and Enterprise-provisioning
  dialogs/components.

**Modify**

- `src/lib/auth-service.ts`, `src/features/auth/store/auth-slice.ts`,
  `src/features/auth/components/login-form.tsx`, and token-refresh handling —
  consume/store the safe subscription summary and handle lifecycle errors.
- `src/lib/apollo-client.ts` — map structured subscription/quota errors to
  non-sensitive customer messages without masking an authorization failure.
- `src/constants/graphql-map.ts`, `src/constants/sql-map.ts`, and
  `src/constants/messages.ts` — typed dedicated operations, registered SQL ids
  and centralized messages.
- `src/router/routes.ts`, `src/router/index.tsx`, Super Admin sidebar/layout
  and existing `clients-page.tsx` — routes/navigation/customer linkages.
- Inventory, WhatsApp, user and BU entry components — feature/capacity UX
  gating only; server remains authoritative.
- `src/types/db-schema-client.ts` and `src/types/db-schema-security.ts` —
  regenerate, never hand-edit, after the database migrations.
- `src/features/client/components/help/help-content.ts` and
  `src/features/super-admin/components/help/dev-help-content.ts` — required
  user and developer documentation updates.

The separate public website repository will add the staged Lite-signup form.
It should call only the new public REST endpoints and must not embed any server
credential or call internal GraphQL.

## 16. Decisions needed before implementation

1. Does "Multiple users" mean unlimited for Standard/Enterprise, or which exact
   finite limits should be sold?
2. What fields may be collected after email/mobile verification to satisfy the
   current required account and BU fields: full name, workshop name, password,
   and optional city?
3. Is email verification sufficient for Lite launch, or must mobile OTP be
   implemented before provisioning? There is no SMS provider in the inspected
   stack today.
4. During suspension/expiry, should customers have read-only login or a full
   login block? What are the data-retention/export obligations?
5. What provider will supply CAPTCHA/Turnstile and transactional email, and who
   will operate the trusted proxy/IP configuration in CloudJiffy?
6. What capacity and backup/restore policy makes a pooled database "full", and
   when should a second pooled database be allocated?

These decisions affect product behavior and operating cost; the architecture
does not need to change once they are made, but the seed values and workflow
policy must be explicit before production rollout.
