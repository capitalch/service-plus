# Plan — Subscription & Entitlement Architecture for Service+

> Source prompt: `plans/prompt-ai.md` (companion notes: `plans/prompt.md`).
> Status: **design only — nothing implemented.** Written 2026-09-27 after inspecting
> `service-plus-server` (auth, guards, generic resolvers, provisioning, WhatsApp, schema dumps)
> and `service-plus-client` (auth, super-admin, admin, routing).

---

## Goal

Add plans (Lite / Basic / Standard / Enterprise), entitlements (feature flags + limits),
usage metering, a subscription lifecycle, public Lite signup and Enterprise provisioning —
all **data-driven** (no `if plan == "lite"`), **enforced on the server**, payment-provider
neutral, and built on plain PostgreSQL with no new infrastructure.

---

## Present context and current design (what the inspection found)

**Tenancy today**
- `service_plus_client.public.client` = one row per tenant; `client.db_name` names that tenant's DB.
  No customer, plan or subscription concept exists (`subscription_tier` was added and then
  reverted in `15588b7`).
- Each tenant DB has `security` (`user`, `bu`, `role`, `access_right`, `role_access_right`,
  `user_bu_role`) + one schema per BU cloned from the `demo1` template (≈55 tables; DDL lives in
  the generated `app/db/sql/sql_bu_admin_ddl.py`).
- `security.user.is_admin` → userType `A`; everyone else is `B`. Super Admin (`S`) is an `.env`
  identity with no DB row.

**Auth**
- `POST /api/auth/login` takes `client_id` (picked from the **public** `/api/auth/clients` list)
  + identity + password → JWT claims `sub, user_type, client_id, db_name, role_code,
  access_rights, bu_codes`. Access token 30 min, refresh 7 days. Refresh re-reads rights and BUs
  but **copies `user_type` from the old token**.
- `get_graphql_context` never rejects; an absent token just yields an empty context.
- Guards (`app/graphql/resolvers/auth_guards.py`): `require_user_type`, `require_access_right`,
  `require_own_tenant` (db_name match), `require_bu_access` (schema ∈ `bu_codes`). **`S` and `A`
  bypass access-right and BU checks**; `security`/`public` schemas always pass `require_bu_access`.

**Data access**
- `genericQuery` / `genericBatchQuery` / `genericUpdate` / `genericUpdateScript` run **any**
  `SqlStore` sqlId / **any** `tableName` in any schema of the caller's DB. Only a handful of
  tables/sqlIds are right-gated (`GENERIC_UPDATE_TABLE_RIGHTS`, `…_SCRIPT_SQL_ID_RIGHTS`).

**Metering chokepoints**
- Jobs are inserted from ≥6 places: `createSingleJob`, `createJobBatch`, `updateJobBatch`,
  opening jobs, `genericUpdate` with `tableName: "job"` (ungated), raw `INSERT INTO job` in
  `jobs/mutations.py`. → only a **DB trigger** catches every path.
- WhatsApp goes through one platform-level Meta account; all sends funnel into
  `app/whatsapp/client.py::send_template()` from 7 call sites (`sender.py` ×6, `ew_sender.py` ×1,
  incl. the scheduler's EW reminders). Per-BU opt-in already exists (`app_setting`
  `whatsapp_notifications`, fail-closed).
- Inventory = access-right module `INVENTORY` (rights 8–13) + inventory tables/resolvers.

**Public surface**
- `/api/public/*` guarded by `X-Website-Key` (which ships in the static website's JS — **not a
  secret**) + an in-memory per-IP rate limiter (`app/core/rate_limit.py`).
- Marketing site is a static Next.js export (per `plans/plan-market-site.md`), so signup calls go
  browser → `https://serviceplus.cloudjiffy.net` directly (CORS needed).

### Security findings that block this feature (must be fixed first)

| # | Finding | Why it matters for subscriptions |
|---|---|---|
| F1 | **Many mutations/queries have no guard at all**: `createClient`, `createServiceDb`, `dropDatabase`, `deleteClient`, `deleteBuSchema`, `feedBuSeedData`, `seedSecurityData`, `createSingleJob`, `updateJob`, `createJobBatch`, …, all `sendWhatsapp*`, `importSpareParts`, `deleteUnusedPartsByBrand`, `mail*Credentials`, `superAdminClientsData`, `superAdminDashboardStats`, `usageHealth`, `systemSettings`, `auditLogs`, `adminDashboardStats`. The GraphQL context does not require a token. | An anonymous caller can create jobs, spend WhatsApp credit or drop databases. Metering is meaningless until every tenant call is authenticated. |
| F2 | `genericUpdate` with `schema: "security"` and `tableName: "user"` / `"user_bu_role"` is ungated. | Any logged-in user can set `is_admin = true` on themselves or join any BU → **privilege escalation**. In a shared DB this becomes cross-customer takeover. |
| F3 | `genericQuery` can run any sqlId against `security`. | In a shared DB, any user can list every other customer's users/emails/mobiles. |
| F4 | `A` bypasses `require_bu_access`. | In a shared DB, a Lite owner who is `A` would reach every other customer's BU schema. |
| F5 | Refresh copies `user_type` from the old token. | Demoting an admin, or suspending a subscription, would not bite until re-login (7 days). |
| F6 | `/api/auth/clients` is public and lists all tenant names; `/api/public/companies` lists BUs across active clients. | Enterprise customer names leak; pooled Lite customers would appear in the public job-status dropdown. |

---

## Key constraints of present design

1. `db_name` + `schema` addressing is everywhere; the design must keep it and **add** a
   `customer_id` dimension rather than replace it.
2. BU schemas are cloned from `demo1`; anything added to the template must be regenerated into
   `sql_bu_admin_ddl.py` **and** back-filled into every existing BU schema.
3. A trigger in a tenant DB cannot read the control-plane DB (`service_plus_client`) — no
   cross-database queries in Postgres without `dblink`/FDW (which we avoid).
4. There is exactly one WhatsApp sender account; metering must be per customer.
5. Single app process on Cloudjiffy, in-memory rate limiter, no Redis. Keep it that way.
6. Existing tenants (`service_plus_demo`, `service_plus_capitalgroup`, …) must keep working
   unchanged on day one.
7. Repo rules: help-content + dev-help-content updated in every change; generated files
   regenerated, never hand-edited; `SQL_MAP` mirrors `SqlStore`.
8. Naming collision: `app/graphql/resolvers/subscription.py` already means *GraphQL
   subscriptions*. New code uses **`plans` / `billing`** naming, never `subscription.py`.

---

## New design brief

### 1. Recommended architecture — control plane + data plane

```
                 ┌──────────────── CONTROL PLANE: service_plus_client (public) ───────────────┐
                 │ feature ─┐                                                                 │
                 │ plan ────┼─ plan_entitlement                                               │
                 │ client (tenant DB, kind POOLED|DEDICATED)                                  │
                 │ customer ── subscription ── subscription_entitlement_override              │
                 │                  └── subscription_event, payment, signup_request           │
                 └────────────────────────────────┬───────────────────────────────────────────┘
                              sync (push on change + nightly reconcile)
                 ┌────────────────────────────────▼───────────────────────────────────────────┐
                 │ DATA PLANE: each tenant DB, `security` schema                              │
                 │ customer_entitlement (snapshot) · usage_counter · consume_quota()          │
                 │ bu.customer_id · user.customer_id                                          │
                 │ every BU schema: job BEFORE INSERT trigger → consume_quota('jobs.monthly') │
                 └────────────────────────────────────────────────────────────────────────────┘
```

- **Control plane is the source of truth** for plans, features, customers, subscriptions,
  payments. Super Admin edits only this.
- **Data plane holds a denormalised snapshot** of each customer's *effective* entitlements +
  subscription status, so enforcement (including DB triggers) never leaves the tenant DB and an
  Enterprise DB stays fully self-contained.
- **Pooled DB** (Lite/Basic/Standard) is just a `client` row with `kind = 'POOLED'`; each customer
  in it owns exactly one BU. **Dedicated DB** (Enterprise) is a `client` row with
  `kind = 'DEDICATED'` and exactly one customer. The same code serves both; the only difference is
  data.

### 2. Relationships (the core modelling decision)

```
customer 1 ── 1 subscription (current) ── N plan_entitlement (via plan) + N overrides
customer N ── 1 client (tenant DB)          pooled: many customers / DB; dedicated: one
customer 1 ── N security.bu                  pooled: exactly 1; enterprise: ≤ 5
customer 1 ── N security.user                every user belongs to exactly one customer
```

- **Subscription attaches to the customer, not to the BU or the DB.** Limits like "5 BUs",
  "2,000 WhatsApp/month", "max users" are customer-wide; attaching to BU would make Enterprise's
  5 BUs look like 5 subscriptions, attaching to DB would break the pooled DB.
- **Customer ≠ client.** `client` stays "a database"; `customer` is "who pays". This is what lets
  one pooled DB hold hundreds of customers and lets us add `service_plus_pool_2` later by data alone.

### 3. Plan and entitlement model — **hybrid** (tables for values, code registry for keys)

| Layer | Where | Why |
|---|---|---|
| Feature **keys** (name, type, default, what it gates) | Code registry `app/plans/feature_registry.py` + mirrored `feature` table | Code must know a key to enforce it; the registry is the single place that maps a key to its gates. Default is **fail-closed** (`false` / `0`). |
| Plan **values** | `plan_entitlement(plan_id, feature_key, value jsonb)` | New plan or changed limit = rows only, editable by Super Admin, no deploy. |
| Per-customer **exceptions** | `subscription_entitlement_override` | "Give this Standard customer 800 jobs this month" without inventing a plan. |
| Runtime **snapshot** | `security.customer_entitlement.entitlements jsonb` | One indexed row per customer; trigger- and cache-friendly. |

Rejected: **pure JSONB on `plan`** (no FK/validation per key, awkward to diff/edit per key);
**config files** (need a deploy to change a price or limit, can't express per-customer overrides,
Super Admin can't edit); **pure tables with no code registry** (a key nobody enforces silently does
nothing — the exact failure mode `CLAUDE.md` warns about for access rights).

**Resolution**: `effective = registry defaults ⊕ plan_entitlement ⊕ overrides` (later wins).
Limits: integer; `null` = unlimited; missing = registry default (0/false).

**Initial feature keys and plan seed**

| Key | Type | Lite | Basic | Standard | Enterprise | Gates |
|---|---|---:|---:|---:|---:|---|
| `users.max_users` | int | 1 | 1 | **?** (see Flags) | null | `createBusinessUser`, activate user |
| `business_units.max_units` | int | 1 | 1 | 1 | 5 | `createBuSchemaAndFeedSeedData`, activate BU |
| `jobs.monthly_limit` | int | 50 | 100 | 500 | null | `job` insert trigger |
| `whatsapp.enabled` | bool | false | true | true | true | all `sendWhatsapp*`, EW sends, WhatsApp settings UI |
| `whatsapp.monthly_limit` | int | 0 | 100 | 500 | 2000 | metered `send_template` |
| `inventory.enabled` | bool | false | false | true | true | `INVENTORY` rights module, inventory resolvers + tables |

Each registry entry declares its gates declaratively, e.g.

```python
FeatureSpec(
    key="inventory.enabled", type=bool, default=False,
    access_right_modules=("INVENTORY",),          # rights stripped at login when off
    resolvers=("createSalesInvoice", "importSpareParts", "deleteUnusedPartsByBrand"),
    generic_update_tables=("purchase_invoice", "sales_invoice", "stock_adjustment", ...),
)
FeatureSpec(key="jobs.monthly_limit", type=int, default=0, meter="jobs.monthly")
```

A single guard layer (below) reads these specs — adding a feature is: one registry entry + seed
rows + (only if it's a new *kind* of gate) one enforcement hook. Business logic never names a plan.

### 4. Usage tracking

Two kinds of limits, two mechanisms — both generic over meter key:

**a) Flow meters (per period): `jobs.monthly`, `whatsapp.monthly`** — counter table in the tenant DB.

```sql
security.usage_counter(customer_id, meter_key, period_start date, used int, PK(customer_id, meter_key, period_start))

-- atomic check-and-increment; returns NULL when it would exceed the limit
security.consume_quota(p_customer_id, p_meter_key, p_n) RETURNS int
  INSERT … VALUES (…, p_n) ON CONFLICT (…) DO UPDATE SET used = usage_counter.used + p_n
  WHERE p_limit IS NULL OR usage_counter.used + p_n <= p_limit
  RETURNING used;
```

- Concurrency: the `ON CONFLICT … DO UPDATE … WHERE` takes a row lock, so two concurrent
  requests serialise on the counter row — no over-issue, no advisory locks, no Redis.
- **Jobs**: `BEFORE INSERT ON job FOR EACH ROW` trigger in the BU template resolves
  `customer_id` from `security.bu` by `TG_TABLE_SCHEMA`, reads the limit from
  `customer_entitlement`, calls `consume_quota`, and `RAISE EXCEPTION USING ERRCODE = 'P0001',
  MESSAGE = 'QUOTA_EXCEEDED:jobs.monthly'`. It runs in the job's own transaction, so a rolled-back
  job never consumes quota, and every current and future insert path is covered. Batch jobs of N
  consume N (the whole batch fails if it doesn't fit — flagged).
- **WhatsApp**: a `metered_send()` wrapper around `send_template()` reserves 1 (own short
  transaction) *before* calling Meta, refunds on a permanent failure. Replaces the 7 direct
  calls. The scheduler's EW reminders skip + log when over quota.
- Period = calendar month in `Asia/Kolkata`: `date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')`.
  No reset job needed — a new month is just a new row. Old rows are the usage history.
- Counting is always on (even when unlimited) so Super Admin sees usage for every plan.

**b) Stock limits (current count): `users.max_users`, `business_units.max_units`** — counted, not
metered. At create/activate time: `pg_advisory_xact_lock(hashtext('users:'||customer_id))` then
`COUNT(*) … WHERE customer_id = … AND is_active` and compare, in the same transaction as the insert.

### 5. Tenant / database resolution

```
login(client_id, identity, password)
  → client.db_name                                (control plane, existing)
  → security.user (… customer_id, is_admin)       (tenant DB)
  → security.customer_entitlement[customer_id]    (tenant DB snapshot: plan, status, entitlements)
  → BUs = user_bu_role ∩ bu.customer_id = user.customer_id
  → JWT { sub, user_type, client_id, db_name, customer_id, plan_code, sub_status,
          features: {bool flags only}, access_rights (minus disabled modules), bu_codes }
```

Per request:
- GraphQL context gains `customer_id`, `plan_code`, `sub_status`.
- **Token claims are for UX and cheap routing only.** Authoritative checks read the snapshot
  through a 60-second in-process TTL cache keyed `(db_name, customer_id)`, invalidated
  immediately in-process when Super Admin changes that customer. Worst-case staleness 60 s, not
  30 min.
- Refresh re-reads `is_admin`, BUs, rights **and** subscription status (fixes F5).
- Pooled login UX: the pooled DB appears once in the client picker (e.g. "Service+ Cloud"); the
  set-password email pre-selects it. Identity-first login (email → client lookup) is a later
  improvement (Flags).

### 6. Lite signup API

`POST /api/public/signup` (new `app/routers/public/signup_router.py`, CORS for the marketing origin)

```
{ full_name, business_name, email, mobile, captcha_token, website (honeypot, must be empty) }
```

1. **Validate**: pydantic; email lower-cased; mobile normalised with `app/whatsapp/mobile.py`;
   honeypot empty; **CAPTCHA verified server-side** (Cloudflare Turnstile — free, no infra). The
   `X-Website-Key` is public, so CAPTCHA + rate limits + email verification are the real controls.
2. **Rate limit**: per IP (5/h) and per normalised email and mobile (3/day). Extend
   `rate_limit()` to take a key function; make sure `request.client.host` is the real client IP
   behind Cloudjiffy's proxy (uvicorn `--proxy-headers --forwarded-allow-ips`) — verify.
3. **Dedup / idempotency**: upsert `signup_request` on email. Response is **always** the same
   `202 "Check your email"` whether new, pending, or already a customer (no account enumeration).
   A pending request re-sends the link at most once per 10 min. An existing customer gets a
   "you already have an account — reset password" email instead.
4. **Verify**: email link → `POST /api/public/signup/verify {token}`; only the token's SHA-256 is
   stored; 24 h expiry. **No schema is created before verification** — bots cannot make us run
   55-table DDL.
5. **Provision** (`app/plans/provisioning.py::provision_pooled_customer`), idempotent and
   resumable, state in `customer.provisioning_status`:
   1. `pg_advisory_lock` on the email hash.
   2. Control plane: insert `customer`, `subscription(plan=LITE, status=ACTIVE)`, `subscription_event`.
   3. Pick a pooled `client` with `accepts_signups = true` and spare capacity.
   4. Tenant DB: create BU schema `c<customer_id>` via the existing
      `create_bu_schema_and_feed_seed_data` helper (server-generated code — never user input);
      insert `security.bu(customer_id)`, `security.user(customer_id, is_admin = true)`,
      `user_bu_role`, `customer_entitlement` snapshot.
   5. Mark `PROVISIONED`; mail a set-password link (reuse the existing reset-token flow and the
      client's `/reset-password` page).
   Any failure → `FAILED` + audit log; retry re-runs the steps, each of which checks "already done".
6. Branch/address: the BU is created without a branch (address/GSTIN are optional at signup); the
   existing `bu-branch-division-gate` onboarding asks for it at first login.

### 7. Enterprise provisioning (Super Admin)

A "New Enterprise Customer" wizard that composes existing, now-guarded resolvers:
`createClient(kind=DEDICATED)` → `createServiceDb` → `seedSecurityData` → `createAdminUser`
(customer-scoped) → `saveCustomer` + `assignPlan(ENTERPRISE)` → snapshot sync → up to 5×
`createBuSchemaAndFeedSeedData` (now also checks `business_units.max_units`). Each step is already
idempotent-ish and shows its own status, as the current Initialize Client dialog does.

Standard → Enterprise upgrade means moving a BU schema from the pooled DB into a new dedicated
DB (`pg_dump -n c<id>` + the customer's `security` rows). Initially a documented manual runbook;
tooling later.

### 8. FastAPI / GraphQL changes

**Guard layer** (`auth_guards.py` + new `app/plans/guards.py`)
- **Authenticated by default**: an Ariadne middleware rejects every operation without a valid
  token except an explicit allowlist (currently none on GraphQL — public flows are REST). Then
  `require_own_tenant` + `require_bu_access` applied generically by middleware for every field
  that has `db_name`/`schema` args (they all share the signature). Fixes F1.
- `require_super_admin` on every provisioning / super-admin field. Fixes F1.
- `security`-schema lockdown for the four generic ops: non-`S` callers may not target
  `schema = "security"` except via an allowlist of customer-scoped sqlIds, which get
  `customer_id` **injected server-side from the token**, never from `sqlArgs`. Security-table
  writes happen only in dedicated resolvers. Fixes F2, F3.
- `A` stops bypassing `require_bu_access`; an `A`'s `bu_codes` = all BUs of *their customer*.
  Behaviour inside an Enterprise DB is unchanged (all BUs belong to the one customer). Fixes F4.
- `require_active_subscription(info)` on every mutation: `SUSPENDED`/`EXPIRED` → read-only
  (`SUBSCRIPTION_INACTIVE`), `CANCELLED` → login refused.
- `require_feature(info, key)`: driven by the registry's `resolvers` / `generic_update_tables`
  lists — the dispatcher looks up the spec, no per-plan code.
- Login strips access rights whose module is disabled (so `B` users lose Inventory menus for
  free); `A` users are handled by `features` on the client and `require_feature` on the server.

**New GraphQL fields** (Super Admin unless noted)
- Queries: `plansCatalog`, `customersWithUsage(filter)`, `customerDetail(customer_id)`,
  `myPlanUsage(db_name)` (any authenticated user; own customer only).
- Mutations: `savePlan`, `savePlanEntitlements`, `saveCustomer`, `assignPlan`,
  `setSubscriptionStatus`, `recordPayment`, `setEntitlementOverride`, `resyncEntitlements`.
- Errors: `QUOTA_EXCEEDED`, `FEATURE_NOT_IN_PLAN`, `SUBSCRIPTION_INACTIVE`, `LIMIT_REACHED`
  in `app/core/exceptions.py`, with `extensions.{feature_key, limit, used}` for the UI.

### 9. React / frontend changes

- `lib/auth-service.ts` / `login-form.tsx` / auth-slice: store `subscription {planCode, status,
  features, limits}` from `LoginResponse`.
- `features/auth/utils/entitlements.ts`: `hasFeature(user, "inventory.enabled")` — **no bypass
  for `A`** (unlike `hasAccessRight`). Used by top-nav, explorer panel, `ProtectedRoute`
  (`requiredFeature`), WhatsApp settings and send buttons.
- Apollo `errorLink`: map the four new codes to sonner toasts with an upgrade hint.
- `features/client/components/shared/plan-usage-banner.tsx` + `use-plan-usage.ts`
  (`myPlanUsage`): shows "42 / 50 jobs this month", warns at 80 %, and read-only banner when
  suspended/expired.
- Admin panel: Add User / Add BU disabled at cap with the reason (reads `myPlanUsage`).
- Super Admin: new **Customers** and **Plans** pages (below).
- Signup form + verify page live in `service-plus-web` (Next.js), not in this client.

### 10. Super Admin functionality

| Screen | Does |
|---|---|
| **Plans** (`/super-admin/plans`) | Plan list + a plan × feature matrix editor (values typed by the registry), price, public/active flags. |
| **Customers** (`/super-admin/customers`) | Grid: customer, DB (pooled/dedicated), plan, status, period end, usage bars (jobs, WhatsApp, users, BUs). Actions: change plan, activate/suspend/cancel, record bank-transfer payment (extends period), overrides, resync, retry failed provisioning. |
| **New Enterprise Customer** wizard | §7. Reuses `add-client-dialog`, `initialize-client-dialog`, `seed-roles-dialog`, `create-admin-dialog`. |
| **Signups** tab | Pending / failed `signup_request`s, resend, retry. |

Super Admin stays a separate `.env` identity, token `db_name = null`, `user_type = S`, and never
has a `customer_id` — so customer/BU authorisation code paths can never grant it, nor can any
customer path reach control-plane mutations.

### 11. Security (summary)

- Fix F1–F6 **before** any subscription code (Step 1).
- Tenant isolation = `db_name` guard; **customer isolation inside the pooled DB** = `customer_id`
  from token on every `security` read/write + BU schema guard; `A` scoped to own customer.
- Audit every SQL reference to `security.` outside the generated DDL — 9 in BU-context files
  (`sql_jobs` 1, `sql_shared` 1, `sql_sales_accounts` 2, `sql_extended_warranty` 3,
  `sql_public` 2) plus 54 in `sql_bu_admin.py` — so none can return another customer's users.
- Public endpoints: CAPTCHA, per-IP + per-identity limits, hashed single-use tokens, no
  enumeration, `/api/public/companies` only lists BUs that opted in (`app_setting`), and
  `/api/auth/clients` returns only `kind = POOLED` + an explicit allowlist (or goes away with
  identity-first login).
- Secrets: CAPTCHA secret and signup-token HMAC secret in `.env` (fail at startup if empty, like
  `whatsapp_settings.py` does). Enterprise DBs: consider a per-DB login role later
  (defence-in-depth); not needed for v1.
- Every subscription change and payment → `subscription_event` (append-only) + `audit_logger`.
- Postgres RLS on the pooled DB is **deferred**: the app uses one DB role and generic SQL, so RLS
  would need `SET app.customer_id` on every pooled connection. Worth doing once the guard layer is
  stable — note it, don't block on it.

### 12. Razorpay readiness

- Subscription changes happen only through `app/plans/lifecycle.py::apply(event)` with an explicit
  transition table (`ACTIVE→SUSPENDED`, `SUSPENDED→ACTIVE`, `ACTIVE→EXPIRED`, `EXPIRED→ACTIVE`,
  `*→CANCELLED`, plan change). Manual Super Admin actions and a future webhook call the same
  function.
- `payment(provider, provider_ref, amount_paise, status, period_start, period_end, …)` and
  `subscription(provider, provider_subscription_id)` are provider-neutral; `MANUAL` today.
- `PaymentProvider` protocol (`create_checkout`, `verify_webhook`, `parse_event`) with a
  `ManualProvider` now; `RazorpayProvider` + `routers/webhooks/razorpay_webhook_router.py` later,
  idempotent on a unique `payment_event.provider_event_id`.
- Money in integer paise. GST invoice for the subscription itself is a separate later concern.

### 13. Important trade-offs

- **Shared vs dedicated DB.** Shared is cheap and instant to provision but isolation is
  application-enforced and the catalog grows by ~55 tables per customer (1,000 Lite signups ≈
  55k relations → slower `pg_dump`, catalog bloat). Mitigation built in: `client.kind = POOLED`
  + `accepts_signups` + a capacity cap (e.g. 300 BUs) so a second pooled DB is a data change.
  Dedicated gives hard isolation, per-customer backup/restore and noisy-neighbour protection at the
  cost of a manual provisioning step — right for Enterprise only.
- **Entitlement storage.** Hybrid (above). Snapshot duplication buys trigger enforcement and
  Enterprise self-containment; the cost is a sync step, covered by push-on-change + versioned
  nightly reconcile.
- **Usage tracking.** Counter rows beat `COUNT(*) FROM job WHERE month` (which is racy under
  concurrency without locks, and slow across a schema). Trigger beats app-level checks because job
  inserts have ≥6 entry points. WhatsApp uses app-level reserve/refund because the side effect is
  external.
- **Caching.** Token claims (≤30 min stale) only for UI; 60 s in-process TTL for enforcement; no
  Redis. If the server ever runs multiple workers, staleness stays bounded by the TTL.
- **Subscription on customer**, not on BU or DB (§2).

---

## Steps

- [ ] **Step 1 — Security hardening (prerequisite, independently shippable).** Fix F1–F6: auth
  middleware, super-admin guards, security-schema lockdown for generic ops, `A` scoping hooks,
  refresh re-reads `is_admin`, public listing restrictions. **Your Part:** smoke-test Admin, a
  Manager/Technician and Super Admin flows in the browser; confirm nothing legitimate broke.
- [ ] **Step 2 — Control-plane schema + seed.** `feature`, `plan`, `plan_entitlement`, `customer`,
  `subscription`, overrides, events, `payment`, `signup_request`; `client.kind`,
  `client.accepts_signups`, `client.capacity`. Seed the 4 plans + a non-public **`LEGACY`** plan
  (everything unlimited/on). **Your Part:** run `scripts/plans_control_plane.sql` on
  `service_plus_client`; `pnpm gen-types-client`.
- [ ] **Step 3 — Data-plane schema.** `security.customer_entitlement`, `security.usage_counter`,
  `security.consume_quota()`, `bu.customer_id`, `user.customer_id`; back-fill every existing tenant:
  one `customer` per existing `client`, plan `LEGACY`, all its users/BUs → that customer.
  **Your Part:** run `scripts/plans_data_plane.sql` against every tenant DB; regenerate dumps and
  `pnpm gen-types-security`.
- [ ] **Step 4 — Plans core (server).** `app/plans/` registry, resolver, TTL cache, sync +
  reconcile, lifecycle, guards; JWT/context/login/refresh changes; error codes.
- [ ] **Step 5 — Metering.** Job trigger in `demo1` template → regenerate
  `sql_bu_admin_ddl.py`; back-fill script adds it to every existing BU schema; `metered_send()`
  replaces the 7 `send_template()` calls; users/BU count checks. Ship with
  `plans_enforcement = shadow` (log would-be denials, don't block). **Your Part:** run the
  trigger back-fill; watch logs for a week; then flip to `enforce`.
- [ ] **Step 6 — Super Admin GraphQL + screens** (Plans, Customers, Enterprise wizard, Signups).
- [ ] **Step 7 — Client entitlement UX** (`hasFeature`, route/menu gating, usage banner, error
  toasts, Admin caps).
- [ ] **Step 8 — Pooled DB + Lite signup.** Create the pooled DB via existing Super Admin flow,
  mark it `POOLED`; signup router, verification, provisioning, emails; CORS. **Your Part:** create
  a Turnstile site key/secret and add the secrets to `.env`; add the signup form to
  `service-plus-web`; confirm the real-IP proxy setting on Cloudjiffy.
- [ ] **Step 9 — Move existing tenants** off `LEGACY` onto real plans, deliberately, one by one.
  **Your Part:** decide each tenant's plan.
- [ ] **Step 10 — Help articles** (both files) — written in the same change as each step above,
  listed here only as a checklist: one new developer article "Plans, entitlements & metering",
  one new user article "Your plan and usage", plus sibling articles made stale (access rights,
  Super Admin clients, WhatsApp settings, BU creation).

---

## Files touched (eventual)

**Server — new**
- `app/plans/feature_registry.py` — `FeatureSpec` list (keys, types, defaults, gates).
- `app/plans/entitlements.py` — resolve effective entitlements; TTL cache; invalidate.
- `app/plans/metering.py` — `consume`, `refund`, `check_stock_limit`, `metered_send`.
- `app/plans/lifecycle.py` — state machine, `apply(event)`.
- `app/plans/sync.py` — control plane → tenant snapshot; reconcile.
- `app/plans/guards.py` — `require_active_subscription`, `require_feature`, `require_within_limit`.
- `app/plans/provisioning.py` — pooled signup provisioning; enterprise helpers.
- `app/plans/payments/provider.py`, `app/plans/payments/manual.py`.
- `app/db/sql/sql_plans.py` (added to `SqlStore` bases in `sql_base.py`).
- `app/graphql/resolvers/plans_admin/{queries,mutations}.py`.
- `app/graphql/middleware.py` — authenticated-by-default + generic tenant/BU guard.
- `app/routers/public/signup_router.py`.
- `app/core/captcha.py`.
- `app/core/settings/plans_settings.py` — enforcement mode, captcha, token secret, signup toggle.
- `scripts/plans_control_plane.sql`, `scripts/plans_data_plane.sql`, `scripts/plans_bu_trigger_backfill.sql`.
- `tests/plans/…` (see Testing).

**Server — modified**
- `app/graphql/schema.graphql`, `app/graphql/schema.py` (context + middleware).
- `app/graphql/resolvers/auth_guards.py` (A scoping, super-admin guard).
- `app/graphql/resolvers/mutation.py`, `query.py` (guards, new fields).
- `app/graphql/resolvers/shared/generic_query.py`, `generic_update.py` (security lockdown, feature tables).
- `app/routers/auth/helper.py`, `auth_schema.py` (claims, refresh, subscription in response).
- `app/graphql/resolvers/bu_admin/provisioning.py`, `users_roles.py` (customer_id, stock limits).
- `app/graphql/resolvers/inventory/mutations.py`, `jobs/mutations.py` (error mapping).
- `app/whatsapp/sender.py`, `ew_sender.py` (metered send).
- `app/core/exceptions.py`, `app/core/rate_limit.py`, `app/core/dependencies.py`.
- `app/scheduler.py` (expiry sweep, reconcile).
- `app/routers/public/website_router.py` (companies opt-in).
- `app/main.py` (signup router, CORS origin).
- Generated: `app/db/schema_dumps/*.sql`, `app/db/sql/sql_bu_admin_ddl.py`, repo-root `db/*.sql`.

**Client — new**
- `src/features/auth/utils/entitlements.ts`
- `src/features/client/components/shared/plan-usage-banner.tsx`, `use-plan-usage.ts`
- `src/features/super-admin/pages/{plans-page,customers-page}.tsx`
- `src/features/super-admin/components/customers/{customers-grid,change-plan-dialog,subscription-status-dialog,record-payment-dialog,entitlement-override-dialog,new-enterprise-customer-wizard,signup-requests-grid}.tsx`
- `src/features/super-admin/components/plans/plan-matrix-editor.tsx`

**Client — modified**
- `src/lib/auth-service.ts`, `src/lib/apollo-client.ts` (error codes)
- `src/features/auth/components/login-form.tsx`, auth-slice
- `src/router/index.tsx`, `src/router/protected-route.tsx`, `src/router/routes.ts`
- `src/features/client/components/layout/{client-top-nav,client-explorer-panel}.tsx`
- `src/features/admin/components/{create-business-user-dialog,create-bu-schema-dialog}.tsx`
- `src/features/super-admin/components/sidebar.tsx`, `src/features/super-admin/types/index.ts`
- `src/constants/{graphql-map,sql-map,messages}.ts`
- `src/types/db-schema-*.ts` (regenerated)
- `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`

**Elsewhere:** `dev/service-plus-web` — signup form + verify page.

---

## Implementation

**Step 1 — Hardening.** Add `app/graphql/middleware.py`: reject unauthenticated operations;
for any field with `db_name`, call `require_own_tenant`; with `schema`, `require_bu_access`.
Add `require_user_type(info, {"S"})` to the provisioning and super-admin fields. In the generic
resolvers, reject `schema == "security"` for non-`S` unless the sqlId is in
`SECURITY_SCHEMA_READ_ALLOWLIST`. Refresh re-reads `is_admin`. Restrict `/api/auth/clients`
and `/api/public/companies`. Tests first (`tests/test_auth_guards.py` extended).

**Step 2 — Control plane.** DDL with `CHECK` on `subscription.status`, partial unique index
"one current subscription per customer", `citext`/lower-unique on `customer.email` and unique
`customer.mobile`, FK everything, `set_updated_at` triggers (existing function).

**Step 3 — Data plane.** `customer_entitlement(customer_id PK, plan_code, status, entitlements
jsonb, period_end, version, synced_at)`. `consume_quota` as in §4. Back-fill then
`ALTER … SET NOT NULL` on `bu.customer_id` / `user.customer_id`.

**Step 4 — Plans core.** Registry + resolver unit-tested in isolation; login/refresh add claims;
context carries `customer_id`; TTL cache with explicit `invalidate(db_name, customer_id)`.

**Step 5 — Metering.** Trigger function lives in `security` (one copy per DB), the per-BU trigger
only calls it — so changing the logic later is one `CREATE OR REPLACE`, not a loop over schemas.
Map Postgres `P0001 QUOTA_EXCEEDED:*` to `QUOTA_EXCEEDED` in `handle_graphql_errors`.

**Step 6–8.** As per the design sections above; each resolver uses the envelope signature
`(db_name, schema, value)` to stay consistent with the codebase.

---

## Testing

The server has pytest (`pytest.ini`); the client has none (verify with `pnpm lint` + `pnpm build`).

- **Unit**: registry defaults fail closed; effective-entitlement merge order; lifecycle
  transition table (every illegal transition rejected).
- **DB integration** (real Postgres test DB): `consume_quota` under 50 concurrent `asyncio`
  inserts against a limit of 10 → exactly 10 succeed; rolled-back job does not consume; new
  month starts at 0; unlimited still counts.
- **Tenant isolation** (the most important suite): two pooled customers A and B in one DB —
  B cannot `genericQuery` A's schema, cannot read `security` users of A, cannot
  `genericUpdate` `security.user`, `A`-type owner of B cannot reach A's BU; enterprise token cannot
  address the pooled DB and vice-versa; unauthenticated calls to every mutation are rejected
  (parametrised over `schema.graphql`'s field list so new fields are covered automatically).
- **Signup**: duplicate email/mobile → identical response; rate limits; bad CAPTCHA; expired /
  reused token; provisioning resumes after an injected failure at each step.
- **Feature gates**: Lite user hits `createSalesInvoice` → `FEATURE_NOT_IN_PLAN`; WhatsApp send on
  Lite → rejected before Meta is called (mock `send_template`).
- **Shadow mode**: denials logged, requests succeed.
- **Manual (Your Part)**: browser run-through of signup → verify → set password → first-login
  onboarding → create 50 jobs → 51st blocked with a clear toast; Super Admin upgrade to Basic →
  51st succeeds within 60 s.

---

## Flags and open questions

1. **"Multiple users"** for Standard — a number (e.g. 10) or unlimited? Enterprise too?
2. **Downgrade over limit** (e.g. Standard with 6 users → Basic): block new additions only, or
   force Super Admin to deactivate extras? Recommended: block additions; existing users keep working.
3. **Does a batch count as N jobs** and does the whole batch fail when it doesn't fit? Recommended: yes/yes.
   Do **opening jobs** count? Recommended: no (migration data) — needs the trigger to skip them.
4. **WhatsApp delivery sends two templates (summary + OTP)** — count as 2? Recommended: yes, it
   is what Meta bills.
5. **Suspended/expired = read-only login** (recommended) vs no login at all.
6. **Lite expiry**: Lite is free forever (as specified) or a trial? `plans/prompt.md` history once
   renamed Lite → Trial.
7. **Pooled DB capacity cap** (suggested 300 BUs) and whether Basic/Standard share the Lite
   pooled DB (recommended: yes, one pool; plan change never moves data).
8. **Branch limits** are not in the spec (a Basic one-branch cap was reverted in `15588b7`) — add
   `branches.max_branches` as a key now (cheap) or leave out?
9. **Identity-first login** (no client picker) would remove the public client list entirely —
   worth doing alongside Step 8?
10. **Existing tenants**: stay on `LEGACY` (unlimited) until you move them — confirm.
11. **Step 1 is a behaviour change for every tenant** (unguarded mutations start requiring a
    token); it should ship and bed in on its own before anything else here.
