# Plan — Plan-based sign-up and approval (lt in the shared customer database, ent by Super Admin)

Source: `plans/prompt.md` and `plans/prompt1.md`. Design only; nothing is implemented yet.

Terms: **lt** = Lite + Basic + Standard (each customer is one BU in the default customer database). **ent** = Enterprise (own client and database, created by the Super Admin).

## Goal

A service centre picks a plan on the portal and fills the enquiry form.
- **Only Lite has a Confirm step.** Lite shows a confirm dialog, then "pending approval". **Basic, Standard and Enterprise** just submit the enquiry, and the web page tells the service centre that **our sales team will be in contact**.
- **In every case a thank-you email is sent to the service centre** on submit.
- **lt plans:** the enquiry is stored in the **default customer database**, where its admin (userType `A`) sees it and is emailed.
    - **Lite:** one click creates a business unit (BU) and a business user assigned to it as **Manager**. The user is emailed their login.
    - **Basic and Standard:** the sales team contacts the service centre offline. The admin must then record that the **initial setup cost** was received. Only then can the BU and user be created and the login email sent. No setup payment means no BU, no user, no login email. The setup cost has nothing to do with the monthly fee.
- **ent plan:** the enquiry is stored in `service_plus_client.public.sales_enquiry` as today, and the Super Admin is emailed. The Super Admin has the same **setup-cost** gate before creating the client, BU and user.
- **Monthly payment is a separate workflow (Basic, Standard, Enterprise).** These plans pay for each calendar month in advance, recorded month by month by the admin (lt) or the Super Admin (ent). The **first month is recorded right after approval** (no courtesy period), so a newly approved customer is view-only until then. If a month is not paid (**no grace period**), the user gets a warning message about the payment and the app becomes **view-only**: they can log in, look at data, reports and prints, but every add/edit/delete is refused. Recording the monthly payment restores full access immediately. Lite is never restricted.
- A user sees only the BUs they are assigned to. Server-side loopholes that would let one customer in the shared database reach another's data are closed.
- The server gets a setting for the default customer database in `.env`. It connects with the same shared credentials as every other tenant database.

No card details are collected. **Branches by plan:** Lite and Basic have **one branch only, the head office (`HO`)**; Standard and Enterprise have **unlimited branches**, which users add and edit themselves. The limit is enforced on the server, not just shown on the portal.

## Present context and current design

- **Portal:** every plan uses `SalesEnquiryForm`, which calls `POST /api/public/sales-enquiry`.
- **Server** (`website_router.py`, `submit_sales_enquiry`) today treats all plans the same way:
    - **lt (Lite, Basic, Standard):** the enquiry is written to `service_plus_client.public.sales_enquiry` (`status`: `new | contacted | converted | rejected`) and the team is emailed. The customer database's admin, who must approve these, cannot see that table (constraint 1), so nothing reads these rows back and there is no approval path.
    - **ent (Enterprise):** the same table and email. The Super Admin can reach the control-plane database but has no screen that lists the rows, so they are only visible in the database or the team's email.
    - The table has no payment or approval-progress columns, and the applicant gets no thank-you email.
- **Admin mode** (`/admin/*`) already creates BUs and business users:
    - `create-business-unit-dialog.tsx` → `resolve_create_bu_schema_and_feed_seed_data_helper`;
    - `create-business-user-dialog.tsx` → `resolve_create_business_user_helper` with `bu_ids` + `role_id`.
- **Creating a BU seeds a head-office branch** (`SeedBuData.BU_SEED_SQL`): `code 'HO'`, `'Head Office'`, placeholder address `'123 Main St'`, `state_id 29`, `'700001'`, `is_head_office = true`, plus document sequences for it. No branch input is needed.
- **Connections:** every tenant database is reached with one shared credential pair (`settings.service_db_user` / `service_db_password`), in `psycopg_driver.get_service_db_connection` and `pool_manager.get_service_pool`. The control-plane database uses `client_db_*`.
- **Guards** (`app/graphql/resolvers/auth_guards.py`):
    - `require_own_tenant` — the `db_name` sent must equal the token's; only super-admin (`S`) is exempt;
    - `require_bu_access` — the `schema` sent must be in the token's `bu_codes` (built at login and refresh from `user_bu_role`); `A`/`S` bypass. It **lets `security`, `public` and empty schemas through** for everyone.
- **Most resolvers are not guarded.** The GraphQL layer lets a request with no token reach the resolver; only resolvers that call a guard reject it. Many do not call one (the full list is in Step 10), including `dropDatabase`, `deleteClient` and `createClient`.
- **Login and refresh.** Login returns the user, their rights and their BU list. Refresh returns only a new pair of tokens.
- **Subscriptions.** The client already sends its token when the socket opens; the server does not read it.
- **Media.** Upload paths already include the client code, BU code and branch. Nothing checks the caller against them, and reading a file needs no login.
- **Branches** are created from the branch master through `genericUpdate` on the `branch` table. There is no plan or limit anywhere on a BU.
- **Scheduler.** The server already runs APScheduler (`app/scheduler.py`, started from `app/main.py`) for the monthly stock snapshot.
- **The `MANAGER` role** is seeded with every access right, so a sign-up's Manager can maintain branches and everything else.
- **Admin layout** has no notification bell. The shared `NotificationBell` exists and the Super Admin header already uses it.
- **Super Admin** already has a Clients screen. Setting up a customer there is: add the client, create its database (which also builds the security schema), then create its admin user. That admin creates the BUs afterwards.

## Key constraints of the present design

### 1. lt enquiries can't live only in the control-plane `sales_enquiry`
`public.sales_enquiry` is in the **control-plane database** (`service_plus_client`), not in any tenant database.
- A tenant admin's calls are pinned to their own tenant database: `require_own_tenant` rejects any `db_name` other than the token's, and only a super-admin may pass `db_name = null`, which is what reaches the control-plane database.
- So nothing the tenant admin's screens call through `genericQuery` can read it, and giving them access would open the whole tenant registry to every tenant admin.
- **Resolution:** lt enquiries are written to a new table, **`security.sales_enquiry`, inside the default customer database**, where that admin already has full access. Enterprise enquiries stay in `public.sales_enquiry`, which the Super Admin can already reach. Each plan group has exactly one home, so there are no two rows to keep in sync (see Flags for the lost central lead list).

### 2. BU name rule rejects real business names
- The server (`provisioning.py`) requires `^[a-zA-Z0-9 ]{3,}$`, and so do the client's `create-business-unit-dialog.tsx` and `edit-business-unit-dialog.tsx`. So "Nav Technology Pvt Ltd." fails.
- The BU **name** is display text only. The **code** is what becomes the schema name.
- **Resolution:** widen the name rule in all three places to `^[A-Za-z0-9][A-Za-z0-9 .&'()/,-]{2,99}$`: starts with a letter or digit, 3–100 characters, and allows `. & ' ( ) / , -`.
- The code rule stays `^[a-z0-9_]{3,30}$`, and the code is derived from the name (Step 12).
- The portal's `business_name` field uses the same widened rule, so an accepted enquiry can always become a BU.

### 3. No branch details needed
BU creation already seeds the `HO` head-office branch, and Standard and Enterprise users add and edit further branches themselves (Lite and Basic stay on `HO` only, see constraint 8). The form collects **no address fields**. After seeding, approval only sets `HO`'s `city` (and `gstin` if given) from the form. The user replaces the placeholder address in the branch master.
- **The Manager role must include the right to maintain branches** (see Flags). For Lite and Basic the `HO` branch can be edited (address, GSTIN) but not added to.

### 4. Approval can't be one database transaction
- Creating a BU runs DDL: `CREATE SCHEMA`, then the whole BU table DDL, then seed data. Each runs as its own `exec_sql` call on its own connection.
- Creating the user is a separate call again, which also sends an email.
- If the user step fails (a duplicate username, a mail error, a lost connection), the schema and BU row already exist and can't be rolled back with the user insert. Clicking again would then fail on "BU code exists", leaving a half-provisioned customer.
- **Resolution:** approval is **resumable**. After each step the server records its result on the enquiry row (`bu_id`, then `user_id`; for ent also `client_id` first). A retry skips any step whose id is already recorded. For the BU step it reuses the helper's existing "schema repair" path (it accepts `id` and skips the insert).
- Because the work runs on several connections, a row lock cannot be held across it. Instead the row is **claimed** with a timestamp in one statement before any work starts, so two clicks can't provision twice (Step 14).

### 5. Payment must gate provisioning
Basic, Standard and Enterprise carry a one-time **setup cost**. It gates only the creation of the BU and user (the monthly fee is a separate workflow, constraint 7). Disabling a button is not enough: the check has to live where the BU and user are created, and in the database itself, so a direct call or a stray SQL update can't skip it.

### 6. Shared-database isolation has server-side holes
Business-unit data is already isolated: `require_bu_access` blocks a BU schema the user isn't assigned to, and `bu_codes` is rebuilt on every token refresh. But in a database shared by many customers these paths leak:
- **a. `genericUpdate` / `genericUpdateScript` on `schema: "security"`.** `require_bu_access` passes `security`, and `_require_generic_update_table_right` checks only tables listed in `GENERIC_UPDATE_TABLE_RIGHTS`. `user`, `user_bu_role`, `bu` and `role` aren't listed. So any business user can update `security.user` (e.g. set `is_admin = true` on themselves) or insert `user_bu_role` rows that give them another customer's BU. **This is a privilege escalation today, even outside this feature.**
- **b. `genericQuery` / `genericBatchQuery` on `schema: "security"`.** Any `sqlId` in `SqlStore` can run there, including user lists, BU lists and admin queries. They expose every customer's users, emails and mobile numbers in the shared database, plus the new `security.sales_enquiry` rows.
- **c. `genericSubscription(db_name)` and the other subscriptions.** They go over the separate `graphql-ws` link, which the client's error/auth links don't cover. They filter only by `db_name`, so events for one BU (WhatsApp delivery status, posting progress) reach every connected user of the shared database.
- **d. Media/file paths** already include the BU code, but all lt customers share one client code and nothing checks the caller against the BU in the path. Upload and delete must check it; reading needs no login today.
- **f. Unguarded resolvers.** Many mutations and queries can be called with no token at all (Step 3 lists them). In a shared database this matters even more, but it is a hole for every tenant today.
- **e. Public endpoints** (`/api/public/companies` etc.) list BUs across active clients, so every lt BU would appear in service-plus-web's company dropdown. Decide whether that's wanted (see Flags).

### 7. Monthly payment status has nowhere to live, and writes have many entry points
- Nothing records whether a BU has paid for the current month, and no plan is attached to a BU or database.
- Writes reach the server through many doors: `genericUpdate`, `genericUpdateScript`, the custom mutations (`createSingleJob`, `updateJob`, `deliverJob`, `createSalesInvoice`, `createJobPayment`, `importSpareParts`, …) and the REST media upload. Hiding buttons in the UI would not stop a direct call, so **the server must be the enforcer** and the UI only explains.
- The unit that pays differs: an **lt** customer is one BU in the shared database; an **ent** customer is a whole tenant database (all its BUs).
- The status must be readable inside the tenant database at request time. It can't depend on a control-plane lookup on every write.
- **Resolution:** keep the status on `security.bu` in each tenant database (Step 8), enforce it in one guard applied to every write path (Step 16), and let the UI read the same status (Step 19). Existing BUs default to "no billing", so current tenants are not affected until someone switches billing on.

### 8. Branch count is limited by plan, and only the portal says so today
- Lite and Basic: **1 branch (head office only)**. Standard and Enterprise: **unlimited**.
- The portal (pricing cards, comparison table, recommender, enquiry form, FAQ) already reflects this. But nothing in the app stops a Lite or Basic user from adding a second branch through the branch master, which writes through `genericUpdate`.
- **Resolution:** store `security.bu.branch_limit` (Step 8), set it at approval (Step 14), and refuse a branch insert beyond it on the server (Step 17). The client only explains and disables the button.

## New design brief

Each part below is only a summary. **The full detail lives in the Steps**, so each step can be read and built on its own.

- **Where enquiries live:** lt goes to `security.sales_enquiry` in the default customer database; ent goes to `public.sales_enquiry`. (Steps 7, 12)
- **How the client knows it is the default database:** `isDefaultCustomerDb` is returned at login and kept for the session. It only shows or hides screens; the server re-checks. (Step 5)
- **Confirm step:** Lite only. The other plans show "our sales team will be in contact". A thank-you email is sent for all plans. (Steps 12, 13)
- **Setup-cost gate:** applies to Basic, Standard and Enterprise; setup cost only, not the monthly fee; checked in the resolver and by a database constraint. (Steps 7, 14, 15)
- **Provisioning:** resumable. BU, then Manager user for lt; client, database, first BU, then admin user for ent. Progress ids are stored on the enquiry row, and the row is claimed so two clicks provision once. (Steps 14, 15)
- **Shared-database isolation:** a guard on every resolver, deny-by-default on `security`/`public`, admin-only and server-only security tables, authenticated subscriptions, media path check. (Step 10)
- **Monthly payment / view-only:** status kept on `security.bu` and computed from `paid_through`; one server guard on every write path; no grace period. (Steps 8, 16–19)
- **Branch limit:** Lite and Basic one branch (`HO`), Standard and Enterprise unlimited; `security.bu.branch_limit` set at approval, enforced by a server guard on branch inserts. (Steps 8, 14, 17)
- **Reminders:** a second daily job in the existing scheduler (`app/scheduler.py`), with an advisory lock. (Step 18)

## Steps

How to read this section:
- **✅ marks a finished step.** A step with no mark is still to do. A ✅ inside a step marks one finished part of it.
- **Steps are done one by one, in order.** Steps marked **Your Part** are manual and only you can do them; the build stops there until you have done them.
- Order matters. Each step says what it **Needs** from earlier steps.
- Each step has the same parts: **Where** (files), **Build** (what to do, in order), **Rules** (edge cases that are easy to get wrong), **Done when** (the check to run before moving on).
- Inside an area, build the server first, then the portal, then the client.
- Names in `code style` are real names checked in the code, or new names to create. New names are marked "new".
- House rules: tabs, double quotes and `pnpm format` on touched client files; text longer than two words goes in `constants/messages.ts` (client and portal) or `AppMessages` (server); red only for errors; forms use react-hook-form + zod, show errors at once and keep submit disabled while invalid.

### ✅ Step 1 — Your Part: decisions before any coding — done (30 Sep 2026)
Your answers, which the rest of the plan now follows:

1. **Guard every resolver first.** It is the first build step (Step 3), ahead of everything else, and can go live on its own (Step 4).
2. **Media read links:** leave uploaded files readable without a login. No change.
3. **Central lead list:** no copy of Lite/Basic/Standard enquiries is kept in the control-plane table. They live only in the default customer database.
4. **Payment-received email:** not sent. The applicant hears nothing when the setup payment is recorded; the next email is the login email at approval.
5. **Public company list:** yes, Lite/Basic/Standard BUs appear in service-plus-web's company dropdown. Nothing to build.
6. **Business-unit count:** Enterprise includes 5 BUs. The customer's admin can add more, each costing an extra ₹3,000 (Step 15). *Assumed to be per month, added to the monthly fee — confirm.*
7. **Portal form:** behaves like the client forms — errors show at once and Submit stays disabled while the form is invalid (Step 13).
8. **Prices:** confirmed. Prices and setup costs are settings, not code, so they can be changed without a code change (Step 7).
9. **Client name in the login picker:** "Service+ Service Centers".

### Step 2 — Your Part: set up the default customer database
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** Step 1 (the names chosen there). Uses only screens that exist today.

1. Add to the server `.env` (the keys are listed with comments in `service-plus-server/.env.example`, under "Customer settings"; copy that section across and fill it in):
    - `DEFAULT_CUSTOMER_DB_NAME` (required);
    - `LITE_BASIC_STANDARD_ENQUIRY_NOTIFY_EMAIL`, `ENTERPRISE_ENQUIRY_NOTIFY_EMAIL`, `BILLING_REMINDER_HOUR` (optional);
    - the `PRICE_…` keys and `ENTERPRISE_INCLUDED_BUS` (optional; leave them out to use today's confirmed prices).
2. From Super Admin → Clients: add the default customer's client named **"Service+ Service Centers"**, create its database, create its admin user, and seed its roles. You are this admin; it is the account that approves lt enquiries and records their payments.
3. Restart the server so the new settings are read.

**Done when:** you can log in as the admin of the new default customer client.

### Step 3 — Guard every resolver (done first, on its own)
**Needs:** nothing. It does not depend on any subscription work and can be released alone.

**Where:** server `app/graphql/resolvers/auth_guards.py`, `mutation.py`, `query.py`, `tests/test_auth_guards.py`.

**What is wrong today (checked in the code):** the GraphQL layer lets a request with no token reach the resolver, and only resolvers that call a guard reject it. These call none, so they can be run without logging in:
- mutations: `createClient`, `createServiceDb`, `feedBuSeedData`, `seedSecurityData`, `deleteBuSchema`, `deleteClient`, `dropDatabase`, `mailAdminCredentials`, `mailBusinessUserCredentials`, `deleteUnusedPartsByBrand`, `importSpareParts`, `createSingleJob`, `updateJob`, `updateOpeningJob`, `createJobBatch`, `updateJobBatch`, `deleteJobBatch`, `undoJobTransaction`, and the five `sendWhatsapp…` mutations;
- queries: `adminDashboardStats`, `auditLogs`, `auditLogStats`, `getJobDeliveryOtpPending`, `superAdminClientsData`, `usageHealth`, `systemSettings`, `superAdminDashboardStats`.

Several others check an access right but never check the tenant or the BU: `deliverJob`, `undeliverJob`, `createSalesInvoice`, `createJobInvoice`, `regenerateJobInvoice`, `createJobPayment`, `accountsPosting`, `verifyJobDeliveryOtp`, `setJobDeliveryManualConfirmation`, and the four Extended Warranty mutations. A user with the right in one BU can name another customer's database or schema.

**Build:**
1. New helper `require_authenticated(info)` in `auth_guards.py`: rejects a missing or rejected token (it keeps the existing `TOKEN_EXPIRED` answer for an expired one, so the client still refreshes and retries).
2. **Super Admin only** — `require_user_type(info, {"S"})`: `createClient`, `createServiceDb`, `seedSecurityData`, `deleteClient`, `dropDatabase`, `mailAdminCredentials`, and the queries `superAdminClientsData`, `usageHealth`, `systemSettings`, `superAdminDashboardStats`.
3. **A tenant's own admin, or the Super Admin** — `require_own_tenant` + `require_user_type(info, {"S", "A"})`: `feedBuSeedData`, `deleteBuSchema`, `mailBusinessUserCredentials`, `adminDashboardStats`, `auditLogs`, `auditLogStats`.
    - Before fixing each, check who calls it in the client (Super Admin screens, admin screens, or both) and pick the tier that matches. `auditLogs` and `auditLogStats` take no database name and are used by both the admin and the Super Admin audit pages, so check what an admin is meant to see there.
4. **Everything that takes a BU `schema`** — `require_own_tenant` + `require_bu_access`, placed before any existing access-right check: all the job, invoice, payment, inventory import/delete, WhatsApp send, delivery-OTP and Extended Warranty mutations listed above, and the query `getJobDeliveryOtpPending`.
5. **Test that nothing is missed.** Add a test that walks every registered mutation and query and fails if one has no guard and is not on an explicit "public on purpose" list. That list starts empty.
6. Both help files: a short developer note on the three tiers and the rule "every new resolver starts with a guard".

**Rules:**
- This step does **not** change `require_bu_access` itself. The `security`-schema lock-down, subscriptions and media checks stay in Step 10, because they need the new tables to exist.
- The client sends its token on every GraphQL call after login, and login, refresh and password reset are REST, so normal use should not notice this change. Step 4 is where that is confirmed.
- The Super Admin's token carries no database name; `require_own_tenant` already lets `S` through.

**Done when:** with no token, `dropDatabase`, `deleteClient`, `createClient`, `superAdminClientsData`, `auditLogs` and `createSingleJob` are all rejected; an admin cannot call the Super Admin-only ones; a business user of BU A cannot run a job or invoice mutation against BU B's schema or another tenant's database; the walk-every-resolver test passes; `pytest` passes.

### Step 4 — Your Part: check and release the guard fix
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** Step 3 coded and running on your development server.

1. Log in as the Super Admin: clients list, add/initialise a client dialog opens, usage, audit logs, settings.
2. Log in as a tenant admin: dashboard, business units, business users, roles, audit logs.
3. Log in as a business user: BU/branch switch, create a job, deliver a job, a receipt, a sales invoice, spare-part import, a WhatsApp send, Extended Warranty.
4. Report anything that now says "Access forbidden" that should work.
5. If all is well, this can be deployed on its own, without waiting for the rest of the plan. Recommended, since the hole is open today.

### Step 5 — Settings and `isDefaultCustomerDb`
**Needs:** Step 2 (the `.env` value and the default customer client must exist to test this).

**Where:** server `app/config.py` and `app/core/settings/`, `app/routers/auth/auth_schema.py`, `app/routers/auth/helper.py`, `app/core/exceptions.py`; client `src/lib/auth-service.ts`, `src/features/auth/store/auth-slice.ts`.

**Build:**
1. Add four settings, read from the server `.env`, exposed on `settings` the same way `contact_notify_email` is today. The keys are already documented in `.env.example` under "Customer settings":
    - `default_customer_db_name` (`DEFAULT_CUSTOMER_DB_NAME`) — the tenant database that holds lt customers, one BU each. Empty by default.
    - `lite_basic_standard_enquiry_notify_email` (`LITE_BASIC_STANDARD_ENQUIRY_NOTIFY_EMAIL`) — optional extra recipient for lt approval emails.
    - `enterprise_enquiry_notify_email` (`ENTERPRISE_ENQUIRY_NOTIFY_EMAIL`) — recipient for ent enquiries. Falls back to `contact_notify_email`, then to `super_admin_email`.
    - `billing_reminder_hour` (`BILLING_REMINDER_HOUR`) — hour of day (IST) for the reminder job in Step 18. Default 9.
2. No separate database credentials. The default database is reached with the shared pair (`service_db_user` / `service_db_password`), so `psycopg_driver.py` and `pool_manager.py` do not change.
3. New helper `get_default_customer_client()` (new, in a new `app/services/default_customer.py`):
    - reads `settings.default_customer_db_name`;
    - looks up the active `public.client` row with that `db_name` in the control-plane database;
    - returns the client id, code, name and db name;
    - raises with `AppMessages.DEFAULT_DB_NOT_CONFIGURED` (new) when the setting is empty or no active client row matches.
4. New guard `require_default_customer_db(info, db_name)` (new, in `auth_guards.py`): passes only when `db_name` equals the setting. Used by every enquiry and subscription resolver in Steps 14 and 18.
5. Login response: add `is_default_customer_db` (alias `isDefaultCustomerDb`) to `LoginResponse`. In `login_helper` set it to true when the resolved `db_name` equals the setting; false when the setting is empty and always false for the Super Admin.
6. Client: add `isDefaultCustomerDb` to `UserInstanceType` in `lib/auth-service.ts`. It is saved with the rest of the `user` object, so it survives a page reload. Add a selector `selectIsDefaultCustomerDb` in `auth-slice.ts`.

**Rules:**
- **Refresh does not return it.** `RefreshTokenResponse` carries only the two tokens today, and the flag depends on the database name, which cannot change during a session. So it is set once at login and kept. (This corrects the earlier "login and refresh" wording.)
- The flag only shows or hides screens. Every server action still checks with `require_default_customer_db`.
- A `client` row ("Service+ Service Centers") with `db_name` = the setting must exist, with an admin user (Step 2). lt users pick that client at login.

**Done when:** an admin of the default database gets `true` at login, any other tenant gets `false`; with the setting empty everyone gets `false` and `get_default_customer_client()` raises the message; the flag is still there after a browser refresh.

### Step 6 — Widen the BU name rule
**Needs:** nothing.

**Where:** server `app/graphql/resolvers/bu_admin/provisioning.py` (the name check in `resolve_create_bu_schema_and_feed_seed_data_helper`); client `create-business-unit-dialog.tsx` and `edit-business-unit-dialog.tsx` in `src/features/admin/components/`.

**Build:**
1. Today the server accepts only letters, digits and spaces (`^[a-zA-Z0-9 ]{3,}$`), and both client dialogs use the same idea (`/^[a-zA-Z0-9 ]+$/`). So "Nav Technology Pvt Ltd." fails.
2. New name rule, same in all three places: `^[A-Za-z0-9][A-Za-z0-9 .&'()/,-]{2,99}$` — starts with a letter or digit, 3 to 100 characters, and allows `. & ' ( ) / , -`.
3. Put the pattern in one named constant per project (server: next to the helper; client: a small shared constant used by both dialogs) so the two dialogs cannot drift.
4. Update the two client error messages and the server's `detail` text to describe the new rule.

**Rules:**
- The BU **name** is display text only. The **code** becomes the Postgres schema name, so the code rule stays `^[a-z0-9_]{3,30}$`.
- The name is still checked for uniqueness (`CHECK_BU_NAME_EXISTS`). Two customers can have the same business name, so Step 12 and Step 14 handle a name clash.
- The portal uses the same rule for `business_name` (Step 13), so an accepted enquiry can always become a BU.

**Done when:** "Nav Technology Pvt Ltd." is accepted in the server and both dialogs; "...", "-abc" and names under 3 characters are rejected; an existing plain name such as "Demo Unit" still passes.

### Step 7 — Enquiry tables and price list
**Needs:** Step 5.

**Where:** server new `app/db/sql/sql_signups.py`, `app/db/sql/sql_base.py`, new `app/core/plan_prices.py`, `app/db/schema_dumps/service_plus_client.sql`; client generated `src/types/db-schema-*.ts`.

**Build:**
1. **Two classes in `sql_signups.py`**, following the pattern already used for Extended Warranty:
    - `SignupSql` — read-only list and count queries. Added as a base of `SqlStore`, so the client grids can run them by `sqlId`.
    - `SignupServerSql` — the DDL and every write. **Not** added to `SqlStore`, because `genericQuery` and `genericUpdateScript` can run any `SqlStore` constant by name.
2. **`security.sales_enquiry`** (default customer database only; lt). `SignupServerSql.SALES_ENQUIRY_DDL`, written so it can be run twice (`CREATE TABLE IF NOT EXISTS`, then `ADD COLUMN IF NOT EXISTS` for each column). Columns:
    - identity: `id`; `reference` (a short public code such as `SP-7K3QX9WD`, unique); `plan_code` (`lite | basic | standard`);
    - contact: `name`, `business_name`, `mobile`, `email`, `city`, `gstin`, `branches`, `message`, `ip`;
    - proposed BU: `bu_name`, `bu_code`;
    - state: `status` (`pending | approved | rejected`), `rejection_reason`;
    - progress: `bu_id`, `user_id`, `login_email_sent`, `processing_started_at` (used as a claim, see Step 14);
    - review: `reviewed_by`, `reviewed_at`, `created_at`;
    - the payment columns below.
    - Indexes: unique on `reference`; unique on `lower(email)` and on `mobile` where status is pending or approved; unique on `bu_code` where status is pending or approved.
3. **`public.sales_enquiry`** (control plane; ent). `SignupServerSql.SALES_ENQUIRY_ENT_ALTER`, also safe to run twice. Add: `reference`, the payment columns, `client_id`, `bu_id`, `user_id`, `login_email_sent`, `processing_started_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`. Existing statuses stay: `new`, `contacted`, `converted` (client, database, first BU and admin user created), `rejected`. Only Enterprise rows are written here from now on; older rows of other plans stay as history.
4. **Payment columns on both tables:**

| Column | Meaning |
|---|---|
| `setup_fee_paise` | Setup cost quoted. `0` for Lite. For lt, copied from the price list when the enquiry is saved, so a later price change doesn't alter it. For ent, prefilled from the price list and editable by the Super Admin. |
| `payment_status` | `not_required` (Lite), `pending`, `received`, `failed` |
| `payment_amount_paise` | Amount actually received |
| `payment_mode` | `bank_transfer`, `upi`, `cash`, `other` |
| `payment_reference` | UTR / cheque / receipt number |
| `payment_received_on` | Date the money arrived |
| `payment_recorded_by`, `payment_recorded_at` | Who marked it and when |
| `payment_note` | Free text; required when marking `failed` or correcting a payment |

5. **Constraints on both tables:**
    - lt: `status = 'approved'` requires `payment_status` to be `received` or `not_required`;
    - ent: `status = 'converted'` requires `payment_status = 'received'`. Add it as `NOT VALID` so old rows are left alone and only new changes are checked;
    - `payment_status = 'received'` requires mode, reference, received-on date and an amount of at least `setup_fee_paise`;
    - `payment_status = 'not_required'` is allowed only when `setup_fee_paise = 0`.
6. **Starting payment status:** Lite `not_required`; Basic, Standard and Enterprise `pending`.
7. **Price list** in `app/core/plan_prices.py`, read from settings, not written in code (decided):
    - server `.env` keys (documented in `.env.example`, "Customer settings"): `PRICE_BASIC_SETUP`, `PRICE_BASIC_MONTHLY`, `PRICE_STANDARD_SETUP`, `PRICE_STANDARD_MONTHLY`, `PRICE_ENTERPRISE_SETUP`, `PRICE_ENTERPRISE_MONTHLY`, `PRICE_EXTRA_BU_MONTHLY`, `ENTERPRISE_INCLUDED_BUS`. Values are whole rupees; the module converts to paise. Lite is always 0;
    - defaults are today's confirmed prices: Basic ₹2,000 setup + ₹2,999/month; Standard ₹2,000 + ₹5,999; Enterprise ₹5,000 + ₹10,999; extra BU ₹3,000; 5 BUs included;
    - the portal reads the same amounts from its `.env.local` (Step 13). Its values are fixed when the portal is built, so a price change means editing both files, rebuilding the portal and restarting the server;
    - **mismatch check:** the portal sends the setup fee it displayed along with the enquiry, and the server refuses the enquiry with a clear message if that differs from its own price. A forgotten file is then caught on the first test enquiry, not by a customer.
8. Run `pnpm gen-types-all` in the client and refresh the schema dump for `public.sales_enquiry`.

**Rules:**
- The setup cost is the **only** money on the enquiry. Monthly payments live in Step 8's ledger and never touch these columns.
- The public never sees the row `id`. The `reference` is what the applicant is shown and quotes on the phone.
- The audit log is a daily file that is purged after the retention period, so it cannot be the payment record. Who recorded a payment and when is kept on the row itself.

**Done when:** both scripts run twice on a scratch database without error; setting `status = 'approved'` with `payment_status = 'pending'` fails; setting `received` without a reference fails; a Lite row with `not_required` and a zero fee can be approved.

### Step 8 — Billing and plan columns
**Needs:** nothing (run its DDL together with Step 7's).

**Where:** server new `app/db/sql/sql_billing.py`, `app/db/sql/sql_bu_admin_ddl.py` (`SECURITY_SCHEMA_DDL`), `app/db/sql/sql_bu_admin.py` (`GET_USER_BUS`, `GET_ALL_BUS_WITH_SCHEMA_STATUS`), new `app/core/billing.py`; client generated types.

**Build:**
1. **Two classes in `sql_billing.py`**, same split as Step 7: `BillingSql` (reads, added to `SqlStore`) and `BillingServerSql` (DDL and writes, not added).
2. **`BillingServerSql.BU_BILLING_DDL`** — safe to run twice, run on **every** tenant database (Step 9). Also add the same columns and table to `SECURITY_SCHEMA_DDL`, so a database created later already has them.
3. **New columns on `security.bu`:**

| Column | Meaning |
|---|---|
| `plan_code` | `lite | basic | standard | enterprise`; null for existing BUs |
| `billing_required` | `false` by default; `true` for Basic, Standard and Enterprise BUs. Lite and every existing BU stay `false`, so they are never restricted. |
| `monthly_fee_paise` | Monthly fee for this BU, copied from the price list at approval; editable by the Super Admin for Enterprise |
| `paid_through` | Last date covered by a monthly payment. Null until the first monthly payment. |
| `billing_hold` | Super Admin switch that forces view-only whatever the dates say |
| `branch_limit` | Maximum branches: `1` for Lite and Basic; null (unlimited) for Standard, Enterprise and every existing BU |
| `last_reminder_on`, `last_reminder_kind` | Date and kind of the last reminder email (Step 18) |

4. **New table `security.bu_payment`** — the monthly-payment ledger. Append-only: `id`, `bu_id`, `amount_paise`, `months`, `payment_mode`, `payment_reference`, `received_on`, `period_from`, `period_to`, `note`, `recorded_by`, `recorded_at`. `period_to` must not be before `period_from`. A correction is a new row with a note, never an update or delete.
5. **Status helper** `compute_billing_status(bu_row, today)` (new, in `app/core/billing.py`). Status is worked out, never stored:
    - `not_billed` — `billing_required` is false;
    - `read_only` — `billing_hold` is true, or `paid_through` is null, or today is after `paid_through`;
    - `due_soon` — paid, and `paid_through` is within the next 5 days (a warning only; writes still work);
    - `active` — everything else.
6. **Date helper** `extend_paid_through(paid_through, today, months)` in the same module: start from the later of `paid_through` and yesterday, then add that many **calendar** months. Examples to use as tests: first payment on 15 Jan covers through 14 Feb; paying again on 10 Feb covers through 14 Mar (stacks); paying late on 20 Mar after lapsing on 14 Mar covers through 19 Apr (starts from the day paid); a month-end date such as 31 Jan plus one month lands on the last day of February.
7. **"Today"** is the date in IST (`Asia/Kolkata`), not the server's local time. Put that in one function in `billing.py` and use it everywhere.
8. Add the billing columns to the two BU list queries the app already uses (`GET_USER_BUS` for business users, `GET_ALL_BUS_WITH_SCHEMA_STATUS` for admins), so the client receives them with the BU list it already loads.

**Rules:**
- A billed BU with no `paid_through` is `read_only`. That is how a newly approved Basic, Standard or Enterprise customer starts, until the first monthly payment is recorded (decided: no courtesy period).
- There is no grace period. View-only starts the day after `paid_through`.
- Every existing BU has `billing_required = false` and a null `branch_limit` after the DDL, so nothing changes for current customers.

**Done when:** the DDL runs twice on every tenant database; unit tests for the two helpers pass for: billing off, hold on, null `paid_through`, the day before, the day of and the day after `paid_through`, the 5-day warning window, and the four date examples above.

### Step 9 — Your Part: back up and run the database scripts
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** Steps 7 and 8 coded (the scripts are written there).

1. Take a backup of `service_plus_client` and of every tenant database.
2. Run `SALES_ENQUIRY_DDL` on the default customer database.
3. Run `SALES_ENQUIRY_ENT_ALTER` on `service_plus_client`.
4. Run `BU_BILLING_DDL` on **every** tenant database, including the default one. Existing customers are not affected by this: billing stays off for them.

**Done when:** `security.sales_enquiry` exists in the default customer database, `public.sales_enquiry` has the new columns, and every tenant database has the new `security.bu` columns and the `security.bu_payment` table.

### Step 10 — Shared-database security fixes
**Needs:** Steps 7 and 8 (the new tables must be protected from the first day). Applies to **every** tenant database, not only the default one.

**Where:** server `app/graphql/resolvers/auth_guards.py`, `mutation.py`, `query.py`, `shared/generic_query.py`, `app/graphql/schema.py`, `resolvers/subscription.py`, `pubsub.py`, `app/routers/media/image_router.py`, publishers in `app/whatsapp/sender.py`, `app/routers/webhooks/whatsapp_webhook_router.py`, `resolvers/sales_accounts/mutations.py`; tests in `tests/test_auth_guards.py`.

**What is wrong today (checked in the code):**
- Resolvers with no guard at all, and those that skip the tenant and BU check, were fixed in Step 3.
- `genericUpdate` and `genericUpdateScript` on `schema: "security"`: `require_bu_access` lets `security` through for everyone, and `GENERIC_UPDATE_TABLE_RIGHTS` lists only BU tables. So any business user can update `security.user` (set `is_admin = true` on themselves) or add a `user_bu_role` row for another customer's BU.
- `genericQuery` and `genericBatchQuery` on `security`: any `SqlStore` id runs there, so every customer's users, emails and mobiles are readable, and so would be the enquiry rows.
- Subscriptions: the client already sends its token when the socket opens, but the server never reads it. `whatsappDeliveryStatus` filters by database name only (it also carries Extended Warranty "lead changed" events). `accountsPostingProgress` filters only by branch id, and branch ids repeat across BUs. `genericSubscription` is a leftover with no filter.
- Media: upload paths already include the BU code, but nothing checks that the caller belongs to that BU, and the delete routes take `db_name` and `schema` from the URL without a check. Reading a file (`/uploads/…`) needs no login at all.

**Build:**
1. **Every resolver gets a guard** — already done in Step 3. Re-run its walk-every-resolver test here, because this plan adds new resolvers.
2. **Deny by default on tenant-wide schemas.** Change `require_bu_access` so that a non-admin caller (not `A` or `S`) sending `security`, `public` or an empty schema is rejected, unless the call is on a short allowlist:
    - `NON_ADMIN_SECURITY_SQL_IDS` (new) — the read ids a business user's screens really need on `security`. The sweep so far found none: the only non-admin security call is the write below. Keep the list in `auth_guards.py` and add to it only after finding a real screen that needs it.
    - One allowed write: a user updating **their own** `security.user` row, and only the columns `last_used_bu_id` and `last_used_branch_id` (the BU/branch switcher saves these). The guard checks the row id equals the token's user id and that no other column is present.
    - Any allowlisted query must filter by the token's user id or BU codes, never by an id the caller sends.
3. **Protect security tables in `genericUpdate`.** Add `SECURITY_ADMIN_ONLY_TABLES` (new): `user`, `user_bu_role`, `bu`, `role`, `role_access_right`, `access_right`, `sales_enquiry`, `bu_payment`. For these, require user type `A` or `S` before the table-right check. Then a second list, `SECURITY_SERVER_ONLY_TABLES` (new): `sales_enquiry`, `bu_payment`, and the billing columns of `bu` — no one may write these through `genericUpdate`, not even an admin; they change only through the dedicated mutations in Steps 14, 17 and 18.
4. **`genericUpdateScript` on `security`** is rejected for non-admins. Look inside nested `xDetails` too when reading the table name, so a protected table cannot be reached as a child row.
5. **Subscriptions.**
    - Server: read the token from the socket's opening message (Ariadne's connect hook on `GraphQLTransportWSHandler`; confirm the exact hook against the installed version) and put user type, database name and BU codes into the subscription context. Reject a socket with no valid token.
    - Each subscription checks the `db_name` argument against the token (`S` exempt).
    - Add the BU code to every published event and deliver it only to callers who have that code; admins receive everything in their own database. `accountsPostingProgress` must also match database and BU, not only the branch id.
    - Remove or guard the leftover `genericSubscription`.
    - New admin-only event for the enquiry count (used in Step 14).
    - The client needs no change here: `src/lib/apollo-client.ts` already sends the token.
6. **Media.** Upload and delete routes check `client_code`, `bu_code`, `db_name` and `schema` against the caller's token (own tenant, own BU). Reading a file stays open without a login (decided), because customer-facing WhatsApp messages and web pages use those links.
7. **Tests.** Extend `tests/test_auth_guards.py` for the changed `require_bu_access` and the new helpers. Add a test that walks every registered mutation and query and fails if one has no guard and is not on an explicit "public on purpose" list.

**Rules:**
- This step changes behaviour for every tenant. Before release, open every screen once as a non-admin business user and once as an admin.
- The Super Admin's token carries no database name. Resolvers that a Super Admin calls across tenants must keep working; `require_own_tenant` already exempts `S`.
- The in-memory event system lives inside one server process. With more than one process, an event reaches only the users connected to that process. Screens that rely on events (the bell in Step 14) must also reload on open.

**Done when** (each fails before and passes after):
- as a business user: `genericUpdate` on `security.user` setting `is_admin`, on `user_bu_role`, on `sales_enquiry` → forbidden; updating their own `last_used_bu_id` → still works;
- as an admin: `genericUpdate` on `security.bu` changing `paid_through` → forbidden;
- `genericQuery` on `security` with any id as a business user → forbidden; with another customer's BU code as the schema → forbidden;
- a socket with no token → rejected; with user A's token → no events from BU B;
- uploading to or deleting from BU B as a user of BU A → forbidden;
- login, BU/branch switching, job intake, masters, reports, the admin BU and user screens, the Super Admin client screens and WhatsApp status updates still work.

### Step 11 — Your Part: security check
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** Step 10 coded and running on your development server.

1. Log in once as a non-admin business user and once as an admin, and open every screen: login, BU/branch switch, job intake, masters, inventory, reports, the admin BU and user screens, the Super Admin client screens, WhatsApp status updates. Step 10 changes behaviour for every tenant, so this is a release gate.

**Done when:** every screen works for both kinds of user. Report anything that now says "Access forbidden" so it can be fixed before going further.

### Step 12 — Public enquiry endpoints and emails (server)
**Needs:** Steps 5, 6, 7.

**Where:** server `app/routers/public/website_router.py`, `app/db/sql/sql_signups.py`, `app/core/exceptions.py`, `app/core/plan_prices.py`.

**Build:**
1. **Existing `POST /api/public/sales-enquiry`** (`submit_sales_enquiry`) now accepts **only** `enterprise`:
    - tighten `SalesEnquiryIn.plan_code` to `enterprise`; any other plan gets a clear error telling the caller to use `/signup`;
    - insert into `public.sales_enquiry` as today, plus `reference`, the list setup fee and `payment_status = 'pending'`;
    - email the team (`contact_notify_email`) and `enterprise_enquiry_notify_email`;
    - send the service centre the thank-you email ("our sales team will be in contact");
    - return the status **and the reference** (today it returns only the status).
2. **New `POST /api/public/signup`** for `lite | basic | standard`. Same guards as the other public routes (`require_website_key`, plus `rate_limit("signup", 5 per minute)`). In order:
    1. resolve the default database with `get_default_customer_client()`. If it is not configured, return a clear error and write nothing. **Never fall back to the control-plane table.**
    2. validate the fields. Same rules as `SalesEnquiryIn` today, plus: business name follows the Step 6 rule; `branches` must be 1 for Lite and Basic.
    3. refuse if a pending or approved enquiry already exists for the mobile or the email, or if the email is already a user in the default database. The message points the applicant to the status page.
    4. work out `bu_name`: the trimmed business name; if that name is already a BU name or a pending enquiry's name, add the city in brackets.
    5. work out `bu_code`: lower-case the name; turn each run of other characters into `_`; trim `_` from both ends; cut to 26 characters; if shorter than 3, pad with `bu`; then add `_2`, `_3`, … while it clashes with an existing BU code, an existing Postgres schema, or another pending enquiry.
    6. insert into `security.sales_enquiry` with the plan's setup fee and starting payment status. If the unique index rejects the code or reference (two sign-ups at the same moment), generate again and retry a few times.
    7. publish the new pending count to the admins' event (Step 10, part 5).
    8. email the applicant and the approvers (below).
    9. return the status and the reference.
3. **New `POST /api/public/signup/status`** (Lite only; `rate_limit("signup-status", 10 per minute)`): takes mobile and email; returns only the status, the rejection reason when rejected, and for an approved request the login address and the client name to pick. When nothing matches, return a plain "no request found".
4. **Emails** (new subject and body templates in `AppMessages`, plain text plus HTML like the existing enquiry email):
    - thank-you to the applicant, Lite: request received, pending approval, reference, link to the status page;
    - thank-you to the applicant, Basic and Standard: request received, our sales team will be in contact, reference, the setup cost, that the account is created once the setup cost is received, and that the monthly fee is paid separately each month;
    - thank-you to the applicant, Enterprise: request received, our sales team will be in contact, reference;
    - to the approvers (lt): every active admin user of the default database, plus `lite_basic_standard_enquiry_notify_email`. Says the plan, the applicant, whether the setup cost is pending, and links to the admin Enquiries page;
    - to the Super Admin (ent): the existing enquiry email, sent to the extra address too.
5. New messages in `AppMessages`: `DEFAULT_DB_NOT_CONFIGURED`, `SIGNUP_DUPLICATE`, `SIGNUP_WRONG_ENDPOINT`, `PAYMENT_NOT_RECEIVED`.

**Rules:**
- Save first, email after. A failed email is logged and never fails the request (this is how the enquiry works today).
- The reference is random and unguessable, so it is safe to show; the row id is never returned.
- The status endpoint answers only when both mobile and email match the same request.

**Done when:** each of the four plans lands in the right table and only there; a thank-you email arrives in all four cases; a duplicate mobile or email is refused; two sign-ups with the same business name get different BU codes; with the default database unset an lt sign-up fails cleanly and writes nothing; sending `lite` to `/sales-enquiry` is refused.

### Step 13 — Portal
**Needs:** Step 12.

**Where:** portal `components/pricing/sales-enquiry-form.tsx`, `enquiry-success.tsx`, new `components/pricing/lite-confirm-dialog.tsx`, new `app/signup-status/page.tsx`, new `components/signup/signup-status-form.tsx`, `lib/api.ts`, `lib/validators.ts`, `constants/messages.ts`, `content/faq.ts`, `app/sitemap.ts`.

✅ **Already done (branch limit):** plans carry a `branches` field in `content/pricing.ts` (Lite 1, Basic 1, Standard and Enterprise unlimited) with a `branchesLabel` helper; the plan cards, comparison table, "Scales with you" text, features text and a new FAQ show it; the recommender sends 2–5 branches to Standard and more than 5 to Enterprise; the form refuses more than one branch for Lite and Basic; the upgrade/downgrade FAQ explains the branch rule.

**Build:**
1. `lib/api.ts`: add `submitSignup` (calls `/api/public/signup`) and `fetchSignupStatus`; change `submitSalesEnquiry` to return the reference. The form picks the endpoint from the plan: Lite, Basic and Standard use `submitSignup`; Enterprise uses `submitSalesEnquiry`.
2. Business name: add the Step 6 pattern to `lib/validators.ts` and use it in the form schema, with a message that lists the allowed characters.
3. **Lite only:** the submit button reads "Confirm Lite signup". After the form is valid it opens `lite-confirm-dialog.tsx`, which shows the business name and email and explains that an account will be created after approval. Confirming sends the request. Cancelling returns to the form with nothing lost.
4. **Basic, Standard, Enterprise:** no dialog; the normal submit.
5. `enquiry-success.tsx` takes the reference and shows it. Text by plan:
    - Lite: "Your request is pending approval. We have emailed you." plus a link to the status page;
    - the other three: "Thank you. Our sales team will be in contact with you shortly. We have emailed you."
6. New `/signup-status` page (Lite): a small form with mobile and email; shows pending approval, approved (with the login link and the client name to pick), or not approved (with the reason). The portal is a static export, so this page fetches from the browser. Add it to the sitemap.
7. **Prices from settings.** `content/pricing.ts` reads each price from `.env.local` (`NEXT_PUBLIC_PRICE_BASIC_SETUP`, `NEXT_PUBLIC_PRICE_BASIC_MONTHLY`, and the same for Standard and Enterprise, plus `NEXT_PUBLIC_PRICE_EXTRA_BU_MONTHLY`), falling back to today's amounts when a key is missing. Every card, table and JSON-LD already renders from that file, so nothing else changes. The form sends the displayed setup fee with the enquiry.
8. **Form behaves like the client forms (decided).** Validation runs as the visitor types, errors show at once, and Submit is disabled while the form is invalid. This replaces the current validate-on-blur behaviour.
9. **Enterprise business units.** The Enterprise card, comparison table and the "What is a business unit?" answer say: 5 business units included, more at ₹3,000 each.
10. Texts that are now wrong and must be reworded in `constants/messages.ts` and `content/faq.ts`:
    - `successPayment` says to pay "the setup fee and first month after we confirm your account". New meaning: pay the setup fee first; the account is created when it is received; the monthly fee is paid each month after that;
    - the "How do I pay?" answer says details are shared once the account is confirmed; align it with the same order;
    - add one line that a paid plan becomes view-only if a month is not paid.

**Rules:**
- The server's duplicate and "not configured" errors come back as readable text; show them in the form's error summary, not as a generic failure.
- The honeypot field and the error summary stay as they are.

**Done when:** only Lite shows the confirm dialog and "pending approval"; the other three show the sales-team message; every success screen shows a reference; the status page shows all three states; Lite and Basic refuse more than one branch; `pnpm build` passes.

### Step 14 — Admin: setup payment, approval and rejection (default customer database)
**Needs:** Steps 5, 7, 8, 10, 12.

**Where:** server new `app/graphql/resolvers/bu_admin/signups.py`, `app/graphql/schema.graphql`, `resolvers/mutation.py`, `app/db/sql/sql_signups.py`, `app/core/audit_log.py`, `app/core/exceptions.py`, `resolvers/bu_admin/users_roles.py`; client (later) `src/features/admin/`, `src/components/shared/`, `src/router/`, `src/constants/`.

**Every server action here checks, in this order:** `require_own_tenant`, `require_user_type {"A"}`, `require_default_customer_db`.

**Build — server:**
1. **Reads** (in `SignupSql`, run through `genericQuery` on `security`; admin-only after Step 10): `GET_SALES_ENQUIRIES` with filters for status, plan and payment status, newest first; `GET_SALES_ENQUIRY_PENDING_COUNT`.
2. **`recordSalesEnquiryPayment`** — inputs: enquiry id, amount, mode, reference, date received.
    - Allowed only while the enquiry is `pending` and the plan is Basic or Standard.
    - Amount must be at least `setup_fee_paise`. The date cannot be in the future.
    - Sets `payment_status = 'received'` and the recorded-by and recorded-at fields.
    - Creates nothing and sends no login email.
3. **`markSalesEnquiryPaymentFailed`** — inputs: enquiry id, note (required). Sets `failed`. A failed row can later get a payment recorded, or be rejected.
4. **`approveSalesEnquiry`** — inputs: enquiry id, and optionally an edited BU name, BU code and username from the confirm dialog.
    1. **Claim the row** in one statement: set `processing_started_at` to now, only if the row is still `pending` and is not already claimed in the last 10 minutes. If nothing is returned, another click is already working on it; answer "already being processed". This is what stops two clicks creating two BUs. (A single long transaction cannot be used, because creating a BU runs on several separate connections.)
    2. **Payment gate:** refuse with `PAYMENT_NOT_RECEIVED` unless `payment_status` is `received` or `not_required`. This comes **before** any BU or user work, so no schema is created and no email is sent. Release the claim.
    3. **Create the BU** if `bu_id` is empty: call `resolve_create_bu_schema_and_feed_seed_data_helper` with the code and name. Store `bu_id` on the row at once. On a retry where `bu_id` is already stored, pass that id so the helper takes its repair path and only re-runs the schema and seed steps.
    4. **Set the plan on the BU:** `plan_code`, `branch_limit` (1 for Lite and Basic, null for Standard), `billing_required` (false for Lite, true for Basic and Standard), `monthly_fee_paise` from the price list. Leave `paid_through` empty.
    5. **Fill the head office:** in the new BU schema, set the `HO` branch's `city`, and `gstin` when the applicant gave one.
    6. **Create the user** if `user_id` is empty: call `resolve_create_business_user_helper` with the email, the contact's name, mobile, the username, the new BU id and the `MANAGER` role (looked up by its code; it is a seeded system role). Store `user_id` at once and whether the email went out (`login_email_sent`).
    7. **Finish:** set `status = 'approved'`, reviewer and time; clear the claim; write the audit entry; publish the new pending count.
    8. On any failure: clear the claim, leave the stored ids in place, return the error. Clicking again resumes from the first step whose id is missing.
5. **`rejectSalesEnquiry`** — inputs: enquiry id, reason (required). Allowed only while `pending` and only before any BU was created for it. Sets status, reason, reviewer and time; emails the applicant; publishes the count.
6. **Login email.** The user helper sends a "set your password" link, not a password. Add an optional parameter so the approval can use a sign-up wording (new `AppMessages` template) that also names the client to pick at login. If the email failed, the grid shows "Login email not sent" and offers the existing `mailBusinessUserCredentials` action to resend.
7. New audit actions in `AuditAction`: `RECORD_ENQUIRY_PAYMENT`, `FAIL_ENQUIRY_PAYMENT`, `APPROVE_SALES_ENQUIRY`, `REJECT_SALES_ENQUIRY`.
8. Add the four mutations to `schema.graphql` with the usual three arguments (`db_name`, `schema`, `value`) and register them in `mutation.py` with `@handle_graphql_errors`, like the existing ones.

**Build — client (later; do not build yet):**
1. **Shared pieces**, used again in Steps 15 and 19: `enquiries-grid.tsx`, `record-payment-dialog.tsx`, `payment-status-chip.tsx`. They take the data source and the save action as props. The payment dialog has amount (prefilled with the setup fee), mode, reference and date.
2. **Bell:** add `NotificationBell` to the `admin-layout.tsx` top bar, only when `isDefaultCustomerDb`. One item, "Enquiries awaiting approval". The count loads when the layout opens and again on each count event.
3. **Page:** Admin → **Enquiries**. New route `ROUTES.admin.enquiries` (`/admin/enquiries`) in `router/routes.ts` and `router/index.tsx`; new sidebar entry in `admin-layout.tsx`; both only when `isDefaultCustomerDb`. Columns: date, reference, business, contact, plan, setup fee, payment chip, status, actions. Filters: status (default pending), plan, payment status. Load with the `useGenericQuery` hook.
4. **Row actions:**
    - Lite: **Create BU & Manager**, enabled at once;
    - Basic and Standard: **Record payment** and **Mark payment failed**; **Create BU & Manager** is disabled with the tooltip "Setup payment not received" until the payment is received;
    - all: **Reject**.
5. **Approve dialog** (`approve-enquiry-dialog.tsx`): shows and lets the admin edit the BU name, BU code and username, with the same live uniqueness checks the existing create dialogs use (and the debounce constants from `constants/timing.ts`). The username defaults to the part of the email before `@`, with a number added if taken.
6. **Reject dialog** (`reject-enquiry-dialog.tsx`): reason required. If the setup payment was already received it warns "Payment was received — refund outside the system".
7. After a successful approval of a Basic or Standard row, show a note with a link: "Record the first monthly payment on the Subscriptions page. Until then this customer can only view."
8. New entries in `graphql-map.ts`, `sql-map.ts` (names must match the server exactly) and `messages.ts`.

**Rules:**
- The setup payment gates approval. The monthly fee does not; it is a separate workflow (Steps 16–19).
- Payment fields cannot be changed once the row is approved.
- The existing BU and user screens still work for later changes; a user sees exactly the BUs assigned to them.

**Done when:**
- Lite: one click creates the BU with its schema, seed data and `HO` (city set), and a non-admin Manager on that BU only. After login only that BU is visible, and the app is fully usable.
- Basic or Standard with payment `pending` or `failed`: calling `approveSalesEnquiry` directly is refused with the payment message, and no schema, user or email is created. After the payment is recorded, approval works; the new BU has `billing_required` and no `paid_through`, so its user sees the view-only message until the first monthly payment.
- Resume: make the user step fail (use a username that already exists), fix it, click again. There is one BU, not two.
- Two clicks at the same moment provision once.
- Reject: status, reason and email are right, and the status page shows them.
- An admin of another tenant database cannot call any of these actions.

### Step 15 — Super Admin: enterprise enquiries
**Needs:** Steps 7, 8, 10, 12, and Step 14's shared pieces.

**Where:** server new `app/graphql/resolvers/bu_admin/enterprise_enquiries.py`, `schema.graphql`, `mutation.py`, `query.py`, `sql_signups.py`; client (later) `src/features/super-admin/`.

**How an Enterprise customer is set up today:** the Super Admin adds a client, then "initialises" it: the server creates the client's own database with its security schema, then an admin user for it. That admin later creates the BUs. This step wraps that same sequence around an enquiry and adds the payment gate.

**Every server action here requires the Super Admin** (`require_user_type {"S"}`).

**Build — server:**
1. **Reads** (dedicated queries, not `genericQuery`, because they read the control-plane database): list of enterprise enquiries with status and payment filters; count of `new`.
2. **`markEnterpriseEnquiryContacted`** — `new` → `contacted`.
3. **`setEnterpriseEnquiryFee`** — the Super Admin can change `setup_fee_paise` while payment is pending (Enterprise prices can be negotiated).
4. **`recordEnterpriseEnquiryPayment`** and **`markEnterpriseEnquiryPaymentFailed`** — same rules as Step 14, against `public.sales_enquiry`.
5. **`provisionEnterpriseEnquiry`** — inputs: enquiry id, client code and name, new database name, first BU code and name, admin username. Claimed and resumable exactly like Step 14's approval:
    1. claim the row; refuse with `PAYMENT_NOT_RECEIVED` unless `payment_status = 'received'`;
    2. create the client (`resolve_create_client_helper`, prefilled from the enquiry); store `client_id`;
    3. create the database and its security schema (`resolve_create_service_db_helper`);
    4. create the first BU in that database (`resolve_create_bu_schema_and_feed_seed_data_helper`); store `bu_id`; set `plan_code = 'enterprise'`, `billing_required = true`, `monthly_fee_paise`, `branch_limit` null, `paid_through` empty;
    5. fill the `HO` branch's city and GSTIN;
    6. create the admin user (`resolve_create_admin_user_helper`); store `user_id`;
    7. set `status = 'converted'`; audit; release the claim.
6. **`rejectEnterpriseEnquiry`** — reason required; emails the applicant.
7. **Later BUs in an Enterprise database.** The customer's admin can create more BUs. In `resolve_create_bu_schema_and_feed_seed_data_helper`, when the database is **not** the default one and an existing BU there has `billing_required`, copy `plan_code`, `billing_required`, `paid_through`, `billing_hold` and `branch_limit` from it to the new BU. The whole client is billed as one, so its BUs always share the same dates.
8. **Five BUs included, extra ones cost more (decided).**
    - The first BU carries the Enterprise monthly fee in `monthly_fee_paise`. BUs 2 to 5 carry 0. Each BU after the fifth carries the extra-BU fee (₹3,000). The client's monthly fee is simply the sum over its BUs, which is what Step 18 charges.
    - Creating a sixth or later BU is allowed, but the server first refuses with `AppMessages.EXTRA_BU_CONFIRM_REQUIRED`, naming the extra cost, unless the request carries a confirmation flag. The create-BU dialog shows that message as a confirm step ("This business unit is outside the 5 included in your plan and adds ₹3,000 to your monthly fee. Continue?").
    - When an extra BU is created, email `enterprise_enquiry_notify_email` so the Super Admin knows the fee went up, and write an audit entry.
    - Deleting an extra BU lowers the fee from the next payment. Payments already recorded are not changed.
    - Counting uses active and inactive BUs alike, so deactivating a BU does not free a slot.

**Build — client (later):**
- Super Admin → **Enterprise enquiries**: new route `ROUTES.superAdmin.enquiries`, sidebar entry in `sidebar.tsx`, a count item in the existing bell in `top-header.tsx`.
- The shared grid with row actions: Mark contacted, Record payment, Mark payment failed, **Create customer** (disabled until the setup payment is received), Reject.
- **Create customer** opens a dialog prefilled from the enquiry, with the same live checks the existing add-client and initialise dialogs use for client code, database name and username.

**Rules:**
- The row stores each id as soon as its step succeeds. A retry skips finished steps; it never creates a second client or database.
- A newly created Enterprise customer is view-only until the Super Admin records the first monthly payment (Step 18).

**Done when:** Create customer is refused by the server until payment is recorded; on success the row holds `client_id`, `bu_id`, `user_id` and `converted`; a failure after the database step resumes without a second client or database; a second BU created later by the customer's admin has the same plan and `paid_through` as the first.

### Step 16 — View-only guard for unpaid months (server)
**Needs:** Steps 8 and 10.

**Where:** server `app/graphql/resolvers/auth_guards.py`, `app/core/billing.py`, `resolvers/mutation.py`, `app/routers/media/image_router.py`, `app/routers/public/website_router.py`, `app/routers/auth/helper.py`, `resolvers/query.py`, `schema.graphql`, `app/scheduler.py`, `app/core/exceptions.py`.

**Build:**
1. **Lookup with a short cache** in `billing.py`: `get_bu_billing(db_name, schema)` returns the BU's billing row and status. Results are cached in memory for 60 seconds per database and BU code. `clear_bu_billing(db_name, schema)` removes an entry.
2. **Guard** `require_bu_writable(info, db_name, schema)` (new, in `auth_guards.py`):
    - does nothing for `security`, `public` and empty schemas;
    - when the status is `read_only`, raises with `AppMessages.SUBSCRIPTION_READ_ONLY` and the error code `SUBSCRIPTION_READ_ONLY`, plus `paidThrough` in the extensions so the client can show the date;
    - `not_billed`, `active` and `due_soon` pass.
3. **Apply it**, always after `require_own_tenant` and `require_bu_access`, to every mutation that changes a BU's data:
    - the generic pair: `genericUpdate`, `genericUpdateScript`;
    - jobs: `createSingleJob`, `updateJob`, `updateOpeningJob`, `createJobBatch`, `updateJobBatch`, `deleteJobBatch`, `deliverJob`, `undeliverJob`, `undoJobTransaction`, `createJobInvoice`, `regenerateJobInvoice`, `createJobPayment`, `verifyJobDeliveryOtp`, `setJobDeliveryManualConfirmation`;
    - inventory and sales: `importSpareParts`, `deleteUnusedPartsByBrand`, `createSalesInvoice`, `accountsPosting`;
    - messages sent from a screen: `sendWhatsappCompletion`, `sendWhatsappJobIntake`, `sendWhatsappJobDelivery`, `sendWhatsappMoneyReceipt`, `sendWhatsappJobInvoice`;
    - Extended Warranty: `addEwFollowUp`, `resendEwLeadAlert`, `sendEwReminders`, `transitionEwLead`.
4. **Not blocked** (must keep working in view-only):
    - login, token refresh, set and reset password;
    - every read: `genericQuery`, `genericBatchQuery`, reports, PDFs, prints, exports, subscriptions;
    - the customer's own admin work on the `security` schema: users, roles, BU edits (decided);
    - the provisioning and Super Admin mutations, and the payment and plan mutations of Steps 14, 15, 17 and 18.
5. **Other ways data gets written:**
    - media upload and delete routes: blocked for a read-only BU;
    - public website part orders (`POST /api/public/part-orders`): refused with a polite "not accepting orders right now" message;
    - public job-intake, delivery and receipt pages: reading stays open; any confirm action that writes is refused;
    - WhatsApp delivery-status callbacks: allowed, because they only record what happened to a message already sent;
    - the monthly stock-snapshot job in `app/scheduler.py`: keeps running for all BUs, since it only records month-end stock and a missed month cannot be rebuilt later.
6. **Tell the client the status.**
    - Login already returns the user's BU list; with Step 8 each BU now carries its billing fields and the computed status.
    - New query `buBillingStatus(db_name, schema)`: returns `{status, paidThrough, planCode, branchLimit}` for one BU. Guarded by own tenant and BU access. The client calls it when the BU changes, when the app regains focus, and after a blocked write. (Token refresh returns only tokens, so billing does not travel there.)
7. **Classification test.** Keep two explicit lists in one place: mutations that write BU data (guarded) and mutations that are allowed. A test walks every registered mutation and fails if one is on neither list. A mutation added later without a decision is the main way this breaks.

**Rules:**
- The guard runs after the access checks, so a caller naming someone else's BU still gets "forbidden", not a billing message.
- The cache is per server process. A payment clears it on the process that saved it; another process catches up within 60 seconds.
- View-only never hides or deletes data.

**Done when:** with a BU in `read_only`, each mutation in the list above, a media upload and a public part order are refused with `SUBSCRIPTION_READ_ONLY`; login, lists, reports, prints and exports work; user and role management by the customer's admin works; another BU in the same database is unaffected; Lite and existing BUs are never blocked; the classification test passes.

### Step 17 — Branch limit and plan change (Lite and Basic: head office only)
**Needs:** Steps 8, 14 and 16.

**Where:** server `app/graphql/resolvers/auth_guards.py`, `resolvers/mutation.py`, new `resolvers/bu_admin/billing.py`, `app/db/sql/sql_billing.py`, `app/core/exceptions.py`, `schema.graphql`; client (later) `src/features/client/components/masters/branch/`.

**How branches are created today:** the branch master (`add-branch-dialog.tsx`) calls `genericUpdate` with table `branch`. There is no dedicated mutation, and `branch` is not in any rights list. So the limit must be checked inside `genericUpdate`.

**Build — branch limit:**
1. New guard `require_branch_capacity(info, db_name, schema, value)` (new, in `auth_guards.py`):
    - acts only when the payload's table is `branch` and it is an **insert** (a row with no `id`); also look at nested child rows and at lists of rows;
    - reads the BU's `branch_limit` from the Step 16 lookup; null means no limit;
    - counts all rows in that BU's `branch` table, including inactive ones, plus the rows being inserted;
    - if the total would go over the limit, raises with `AppMessages.BRANCH_LIMIT_REACHED` and the code `BRANCH_LIMIT_REACHED`.
2. Call it in `resolve_generic_update` after `require_bu_writable`. Reject any `genericUpdateScript` id that inserts into `branch` unless it runs the same check.
3. Editing a branch, including `HO`, is never blocked by this guard. Deleting a branch and adding another stays within the limit.

**Build — plan change:**
1. New mutation `changeBuPlan` — inputs: BU id, new plan. Admin of the default database only. It is the single place where `plan_code`, `billing_required`, `monthly_fee_paise` and `branch_limit` are changed after approval.
2. **Upgrade to Standard:** set `branch_limit` to null and the new monthly fee. Nothing else to check.
3. **Downgrade to Lite or Basic:** allowed only when the BU has exactly one branch and it is the head office.
    - In one transaction, lock the BU's `branch` rows so no branch can be added while checking.
    - If there is more than one branch, refuse with `AppMessages.DOWNGRADE_BLOCKED_BRANCHES` and list what blocks it: each extra branch and, for each, which tables still have rows for it and how many (for example "Pune: 12 jobs, 4 purchase invoices, stock rows").
    - Find those tables from the database's own foreign keys to `branch` in that BU's schema, not from a hand-written list. Today well over a dozen tables point at `branch` (jobs, divisions, document sequences, technicians, purchase invoices, stock tables, transfers in both directions, leads, web parts and orders, and more), while the existing `CHECK_BRANCH_IN_USE` query covers only seven, so a fixed list would go stale.
    - When only `HO` remains, set `branch_limit = 1` and the new plan fields.
4. The system never deletes a branch or its data. The customer removes the data and then the branches with the normal screens, and the admin tries the downgrade again.
5. A plan change sets the monthly fee for later months only. It does not touch `paid_through` or the ledger.
6. Moving to or from Enterprise is not offered here: Enterprise has its own database and the others share one.
7. Clear the Step 16 cache for that BU after any change. New audit action `CHANGE_BU_PLAN`.

**Build — client (later):**
- Branch master: hide or disable **Add branch** when the limit is reached, with the tooltip "Your plan includes one branch. Upgrade to Standard for more branches". A shared handler shows the same message if the server returns `BRANCH_LIMIT_REACHED`.
- Subscriptions page (Step 19): a **Change plan** action per BU; on a blocked downgrade it shows the list of branches and data in a dialog.

**Done when:** a Lite or Basic BU cannot get a second branch through the screen or a direct `genericUpdate`; a Standard or Enterprise BU can add several; editing `HO` works; existing BUs (null limit) are unaffected; a Standard BU with an extra branch cannot be downgraded and the message lists the branch and its data; after the customer deletes that data and the branch, the downgrade succeeds and the limit becomes 1; adding a branch at the same moment as a downgrade never leaves a Lite or Basic BU with two.

### Step 18 — Monthly payments, Super Admin controls and reminders (server)
**Needs:** Steps 8, 10, 16.

**Where:** server `app/graphql/resolvers/bu_admin/billing.py`, `schema.graphql`, `mutation.py`, `query.py`, `app/db/sql/sql_billing.py`, `app/scheduler.py`, `app/core/exceptions.py`, `app/core/audit_log.py`.

**Build — lt (admin of the default database):**
1. **Reads** in `BillingSql`: `GET_BU_SUBSCRIPTIONS` (every BU with plan, monthly fee, paid through, hold; the status is added by the server) and `GET_BU_PAYMENTS` (ledger for one BU, newest first).
2. **`recordBuSubscriptionPayment`** — inputs: BU id, months (1 to 12), amount, mode, reference, date received, optional note. Guards: own tenant, user type `A`, default database.
    - The BU must have `billing_required`.
    - Amount must be at least the BU's monthly fee × months.
    - In one transaction: work out the new `paid_through` with `extend_paid_through`; insert the ledger row with `period_from` and `period_to`; update the BU.
    - Then clear the Step 16 cache for that BU, write the audit entry, and email the customer's Manager a receipt ("Payment received. Paid through <date>").
3. A newly approved BU has no `paid_through`. The list shows it as "Awaiting first payment" and sorts it to the top, so the first month is recorded right after approval.

**Build — ent (Super Admin):**
1. **Reads:** for one client, its BUs with plan, fee, paid through and status, read from that client's own database; and its ledger.
2. **`recordClientSubscriptionPayment`** — same inputs plus the client id. Writes one ledger row and moves `paid_through` on **every** BU of that client's database to the same date. The whole client is billed as one.
3. **`setClientMonthlyFee`** — changes the monthly fee for later months.
4. **`extendClientPaidThrough`** — courtesy extension to a given date; a note is required.
5. **`setClientBillingHold`** — hold or release; a note is required. A hold forces view-only at once.
6. All four clear the cache and write an audit entry. New audit actions: `RECORD_BU_PAYMENT`, `SET_MONTHLY_FEE`, `EXTEND_PAID_THROUGH`, `SET_BILLING_HOLD`.

**Build — reminders:**
1. **The server already has a scheduler.** `app/scheduler.py` uses APScheduler and is started from `app/main.py`; today it runs the monthly stock snapshot. Add a second daily job there, at `billing_reminder_hour` IST. (This replaces the earlier idea of a separate background loop.)
2. The job walks every active client database and every BU with `billing_required`, the same way the snapshot job walks them.
3. For each BU it sends at most one email per day, to the BU's Managers and admins:
    - 5 days before `paid_through`: "payment due on <date>";
    - on `paid_through`: "last paid day is today";
    - the day after: "the app is now view-only";
    - a BU still waiting for its first payment gets one "first payment pending" email on the day after approval.
4. It records `last_reminder_on` and `last_reminder_kind` on the BU and skips a BU already reminded today with the same kind.
5. If more than one server process runs, each has its own scheduler. Take a Postgres advisory lock at the start of the job so only one process sends. (The existing snapshot job has the same exposure; worth the same lock.)

**Rules:**
- Recording a monthly payment is the only thing that lifts view-only, apart from a Super Admin extension or releasing a hold.
- The ledger is never edited. A mistake is corrected with a new row and a note.

**Done when:** a payment makes the very next write succeed without logging in again; the four date examples from Step 8 hold; the ledger row and receipt email exist; an Enterprise payment moves all the client's BUs; hold, release and extension work and are audited; each reminder is sent once, also with two server processes running.

### Step 19 — Billing screens in the client (later)
**Needs:** Steps 16, 17, 18.

**Where:** client `src/store/context-slice.ts`, `src/lib/apollo-client.ts`, `src/features/client/components/layout/`, new `src/components/shared/billing/`, `src/features/admin/pages/`, `src/features/super-admin/`, `src/constants/messages.ts`, `src/constants/graphql-map.ts`, `src/constants/sql-map.ts`.

**Build:**
1. **State.** Add the billing fields to `BuContextType` in `context-slice.ts` (they arrive with the BU list). Add selectors `selectBilling` and `selectIsReadOnly`. Refresh with the `buBillingStatus` query when the BU changes, when the window regains focus, and after a blocked write.
2. **Banner** (`billing-banner.tsx`) under the top navigation of the client layout:
    - `due_soon`: amber — "Your payment is due. The app becomes view-only after <date>."
    - `read_only` with a past date: error style — "Your subscription payment for this month has not been received. You can view your data but cannot add or change it. Please contact <support>."
    - `read_only` with no payment yet: error style — "Your first monthly payment has not been recorded yet. You can view the app but cannot add or change data. Please contact <support>."
    - nothing for `not_billed` and `active`.
3. **Blocked write.** In the error link of `apollo-client.ts`, next to the existing `TOKEN_EXPIRED` handling, recognise `SUBSCRIPTION_READ_ONLY` and `BRANCH_LIMIT_REACHED`. Show the matching message in a dialog (`read-only-dialog.tsx`), not a toast, and refresh the billing state. This covers every screen, including any not converted below.
4. **Disabling buttons ahead of time.** A `useIsReadOnly` hook. Apply it first to the shared add, save and delete controls, then to the "New" buttons on job, inventory, masters and accounts screens. Tooltip: "Read-only: payment pending". Build the list of screens by searching for every `genericUpdate`, `genericUpdateScript` and mutation call. Anything missed is still protected by the server and the dialog.
5. **Admin → Subscriptions** (default database only): new route `ROUTES.admin.subscriptions`, sidebar entry. A grid of BUs with plan, monthly fee, paid through and a status chip (awaiting first payment, active, due soon, read-only). Actions: **Record monthly payment** (reuses `RecordPaymentDialog`, with a months field and the amount prefilled as fee × months), **Payment history**, **Change plan**.
6. **Super Admin → client subscription panel** on the clients page: the client's BUs and status; record payment for the client; set monthly fee; extend; hold or release; history.

**Rules:**
- View-only never hides data, reports, printing or downloads.
- Red is used only for the read-only state, because that is an error state.

**Done when:** Lite and existing BUs show no banner and are never blocked; a new paid BU shows the "first payment" banner; a paid BU shows amber in its last 5 days and the error banner from the day after; a blocked write shows the dialog; recording a payment removes the banner and re-enables the buttons without logging in again; `pnpm build` passes.

### Step 20 — Help files
**Needs:** all earlier steps. Each step's code change updates both files in the same change; this step is the final check.

**Build:**
1. `help-content.ts` (staff): branches per plan and what the branch-limit message means; the view-only banner, what still works, and how access comes back; for the platform owner's admin, the Enquiries page (setup payment, why Create is disabled, approve, reject), the Subscriptions page (first payment, monthly payment, history) and changing a plan, including why a downgrade can be refused.
2. `dev-help-content.ts` (developer), **one new article**: the two enquiry tables and why they are split; the setup-payment columns and constraints; the claim column and how approval resumes; the billing columns, the status rule and the date rule; `require_bu_writable` with the two mutation lists; `require_branch_capacity` and `changeBuPlan`; the Step 10 guard rules and allowlists; the new settings; who receives which email; the reminder job.
3. Re-check older articles that this change makes stale: anything listing the admin or Super Admin menu items, the list of settings, the access-guard description, and the subscriptions description.
4. Portal: the FAQ and success texts from Step 13.

### Step 21 — Your Part: release
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** every build step finished.

1. Restart the server. Redeploy the portal, then the client.
2. Submit one test enquiry for each of the four plans from the portal and check it lands where it should, and that both emails arrive.

### Step 22 — Your Part: bring existing paying customers under the monthly rule
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

**Needs:** Step 21.

1. For each existing customer you want under the monthly rule: switch billing on for their BU (plan, monthly fee, `billing_required`), then record their current paid period — both on the same day, in that order, so they are not locked out in between. Until you do this they are not restricted.

### Step 23 — Your Part: daily routine once live
**Your Part — manual.** Claude stops here; you do this yourself, then say so to continue.

1. Approve or reject Lite requests on the Enquiries page.
2. For Basic and Standard: record the setup payment when it arrives, create the BU and Manager, then **record the first monthly payment straight away** on the Subscriptions page (the customer can only view until you do).
3. For Enterprise, the same from the Super Admin side: record the setup payment, create the customer, record the first monthly payment.
4. Record each later monthly payment when it arrives. An unpaid month makes that customer view-only the day after their paid period ends, with no grace period.

## Files touched

**service-plus-server**
- Settings: `app/config.py`, `app/core/settings/` — the four new settings (Step 5)
- Auth: `app/routers/auth/auth_schema.py`, `helper.py` — `isDefaultCustomerDb` on login; billing fields on the BU list (Steps 5, 8)
- New `app/services/default_customer.py` — `get_default_customer_client()` (Step 5)
- `app/graphql/resolvers/bu_admin/provisioning.py` — wider name rule; billing fields copied to later Enterprise BUs (Steps 6, 15)
- New `app/db/sql/sql_signups.py` (`SignupSql` in `SqlStore`, `SignupServerSql` outside it), new `app/core/plan_prices.py`, `app/db/sql/sql_base.py` (Step 7)
- New `app/db/sql/sql_billing.py` (`BillingSql`, `BillingServerSql`), new `app/core/billing.py`, `app/db/sql/sql_bu_admin_ddl.py` (`SECURITY_SCHEMA_DDL`), `app/db/sql/sql_bu_admin.py` (the two BU list queries) (Step 8)
- `app/graphql/resolvers/auth_guards.py` — `require_authenticated`, changed `require_bu_access`, `require_default_customer_db`, `require_bu_writable`, `require_branch_capacity` (Steps 5, 10, 16, 17)
- `app/graphql/resolvers/mutation.py`, `query.py`, `shared/generic_query.py` — guards on every resolver, security table lists, new mutations and queries registered (Steps 10, 14–18)
- `app/graphql/schema.py`, `resolvers/subscription.py`, `pubsub.py`, publishers in `app/whatsapp/sender.py`, `app/routers/webhooks/whatsapp_webhook_router.py`, `resolvers/sales_accounts/mutations.py` — authenticated, BU-scoped subscriptions (Step 10)
- `app/routers/media/image_router.py` — caller checks; blocked when read-only (Steps 10, 16)
- `app/routers/public/website_router.py`, `app/db/sql/sql_public.py` — Enterprise-only enquiry, new sign-up and status endpoints, part orders refused when read-only (Steps 12, 16)
- New `app/graphql/resolvers/bu_admin/signups.py`, `enterprise_enquiries.py`, `billing.py`; `resolvers/bu_admin/users_roles.py` (sign-up email wording) (Steps 14–18)
- `app/graphql/schema.graphql` — new mutations, queries and the enquiry-count subscription
- `app/scheduler.py` — daily reminder job (Step 18)
- `app/core/exceptions.py` (`AppMessages`, email templates), `app/core/audit_log.py` (`AuditAction`)
- `app/db/schema_dumps/` — refreshed dumps
- `tests/test_auth_guards.py` and new tests for the billing helpers and the resolver classification

**service-plus-client** (no code changed yet)
- `src/lib/auth-service.ts`, `src/features/auth/store/auth-slice.ts` — `isDefaultCustomerDb` (Step 5)
- `src/features/admin/components/create-business-unit-dialog.tsx`, `edit-business-unit-dialog.tsx` — name rule (Step 6)
- New shared `enquiries-grid.tsx`, `record-payment-dialog.tsx`, `payment-status-chip.tsx` (Step 14)
- `src/features/admin/components/admin-layout.tsx` — bell and sidebar entries; new `pages/enquiries-page.tsx`, `pages/subscriptions-page.tsx`, `components/approve-enquiry-dialog.tsx`, `components/reject-enquiry-dialog.tsx` (Steps 14, 19)
- `src/features/super-admin/` — new enterprise enquiries page, `sidebar.tsx`, `top-header.tsx`, client subscription panel (Steps 15, 19)
- `src/store/context-slice.ts` (billing on the BU), `src/lib/apollo-client.ts` (two new error codes), new `billing-banner.tsx`, `read-only-dialog.tsx`, `use-is-read-only.ts`, the shared add/save/delete controls (Step 19)
- `src/features/client/components/masters/branch/` — Add branch limit (Step 17)
- `src/router/routes.ts`, `src/router/index.tsx`, `src/constants/graphql-map.ts`, `sql-map.ts`, `messages.ts`
- Generated `src/types/db-schema-*.ts` (via `pnpm gen-types-all`)
- `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`

**service-plus-portal**
- Branch limit (already done): `content/pricing.ts`, `components/pricing/plan-card.tsx`, `plan-comparison-table.tsx`, `plan-recommender.tsx`, `sales-enquiry-form.tsx`, `content/proof.ts`, `features.ts`, `faq.ts`, `constants/messages.ts`
- Still to do (Step 13): `components/pricing/sales-enquiry-form.tsx`, `enquiry-success.tsx`, new `lite-confirm-dialog.tsx`, new `app/signup-status/page.tsx`, new `components/signup/signup-status-form.tsx`, `lib/api.ts`, `lib/validators.ts`, `constants/messages.ts`, `content/faq.ts`, `app/sitemap.ts`

## Testing

Each step already lists its own "Done when" checks. This is the end-to-end pass to run once everything is built.

1. **Name rule:** "Nav Technology Pvt Ltd." is accepted as a BU name in the portal, the admin create/edit dialogs and the server; its code is `nav_technology_pvt_ltd`. "..." and names under 3 characters are rejected.
2. **Routing:** a Lite/Basic/Standard enquiry appears only in the customer database's `security.sales_enquiry`; Enterprise appears only in `public.sales_enquiry`. The right people get the approver email; the applicant gets the "received" email. With the default database unset, an lt submit returns the configured error and writes nothing.
3. **Sign-up screens:** only Lite shows the confirm dialog and "pending approval"; Basic, Standard and Enterprise show "our sales team will be in contact". A thank-you email arrives in all four cases, and a mail failure doesn't fail the submit; duplicate mobile/email is refused; the admin's bell increments live; an admin of another tenant database sees no bell item or menu.
4. **Lite approval:** one click creates the BU schema with seed data and `HO` (city set), and a non-admin Manager user on that BU only. The email names the client. After login only that BU is visible. No payment step appears.
5. **Payment gate (Basic/Standard):** with payment `pending` or `failed` the Create button is disabled, and calling `approveSalesEnquiry` directly is refused with the payment message, with no BU schema, no user and no email. After **Record payment**, approval works and the row shows the payment reference.
6. **Database constraint:** a direct SQL update to `status = 'approved'` with `payment_status = 'pending'` fails.
7. **Payment validation:** amount below the quoted setup fee, or missing mode/reference/date, is rejected immediately in the form (submit disabled while invalid) and on the server. Payment fields can't be edited after approval; the audit log holds each change.
8. **Resume:** make the user step fail, fix the cause, click again. There is no second BU. Two quick clicks provision once.
9. **Reject:** the status, reason and email are right, and `/signup-status` shows them. Rejecting a paid row shows the refund warning.
10. **Enterprise:** Create customer is disabled until the setup payment is recorded; the server refuses early; on success the client, its database, a first BU and an admin user exist and the row holds `client_id`, `bu_id`, `user_id` and `converted`; a failure part-way resumes without duplicates; a BU the customer adds later has the same plan and paid-through date.
11. **Security holes** — each test should fail before Step 10 and pass after it:
    - with no token, `dropDatabase`, `deleteClient`, `createClient` and `superAdminClientsData` → rejected;
    - as a business user, saving their own last-used BU and branch → still works;
    - as a business user, `genericUpdate` on `security.user` (`is_admin`), `user_bu_role` and `security.sales_enquiry` (payment columns) → forbidden;
    - `genericQuery` with `schema: "security"` and an admin-only `sqlId` → forbidden;
    - `genericQuery` with another customer's BU code as the schema → forbidden;
    - a WebSocket without a token → rejected; with user A's token → no events from BU B;
    - a media URL for BU B requested by a user of BU A → forbidden.
12. **Regression:** the normal client, admin and super-admin flows still work (login, job intake, masters, reports, admin BU/user screens, WhatsApp status updates).
13. **Branch limit:** a Lite or Basic BU has exactly one branch (`HO`) and every attempt to add another is refused with `BRANCH_LIMIT_REACHED`; a Standard or Enterprise BU can add many; existing BUs (null limit) are unaffected. Downgrading a multi-branch Standard BU is refused until the other branches' data and the branches themselves are deleted. In the portal, Lite/Basic show one branch and cannot submit the form with more than one; Standard/Enterprise show unlimited.
14. **Billing status:** Lite and existing BUs show no banner and never block. A newly approved Basic/Standard/Enterprise BU has no `paid_through`, so it is `read_only` with the payment message until its first monthly payment is recorded. After that a billed BU is `active` until `paid_through`, `due_soon` for its last 5 days (amber banner, writes still work), then `read_only` from the day after `paid_through` with no grace.
15. **View-only:** in `read_only`, every write door is refused with `SUBSCRIPTION_READ_ONLY` — `genericUpdate`, `genericUpdateScript`, each custom mutation, media upload — and the app shows the dialog. Login, all reports, prints, exports and lists still work. A test walks the full mutation list and fails on any that is neither guarded nor on the allowed list.
16. **Payment restores access:** record a payment; the very next write succeeds without re-login (cache cleared) and the banner disappears. An advance payment stacks on the remaining paid period; a late payment starts from today. The ledger row and receipt email exist.
17. **Isolation:** a read-only BU doesn't affect other BUs in the same database; a paid BU of another customer keeps working. For ent, a payment moves all the client's BUs; hold/release and extension work and are audit-logged.
18. **Background jobs** skip read-only BUs; each reminder goes out once, including with two server processes running.
19. `pnpm build` (or `pnpm exec tsc -b --noEmit`; lint is broken) in the client and portal.

## Flags and constraints

- **Central lead list (decided).** No copy of Lite/Basic/Standard enquiries is kept in the control-plane table. Enterprise leads are in `public.sales_enquiry`; the others are in the default customer database.
- **Prices (decided).** Confirmed, and held in settings: the server's `.env` and the portal's `.env.local`. They are two files, so a price change means editing both; the server refuses an enquiry whose displayed setup fee differs from its own, which catches a missed file. Amounts are stored in paise.
- **Business-unit count (decided).** Enterprise includes 5 BUs; the customer's admin can add more at ₹3,000 each. **To confirm:** the plan treats ₹3,000 as a monthly amount added to the client's fee. If it is a one-time charge, Step 15 part 8 changes.
- **Payment is recorded manually.** No gateway is integrated; the admin marks money received after checking the bank. There is no automatic verification, so the audit trail and the "who recorded it" column matter.
- **Who records lt payments (decided).** The default-customer-database admin is the platform owner, so setup-fee and monthly payments for lt are recorded there.
- **Refunds and rejections after payment** are handled outside the system; the UI only warns. GST/invoice for the setup fee is out of scope.
- **Payment-received email (decided).** Not sent.
- **Branch limit and downgrade (decided).** Lite and Basic: one branch, the head office. Standard and Enterprise: unlimited. A downgrade from Standard to Lite or Basic is **refused while any branch other than `HO` exists**. The customer must first delete all data belonging to the other branches and then delete those branches. The system never deletes branch data for them.
- **Manager rights (checked).** Lite, Basic and Standard users get the `MANAGER` role, which is seeded with every access right, so nothing needs adding. For Lite and Basic the branch master still opens, but adding a branch is refused by the limit.
- **Unguarded resolvers (decided: fixed first).** Many mutations and queries can be called today with no login, including `dropDatabase`, `deleteClient` and `createClient`. Step 3 fixes this before anything else and Step 4 lets it go live on its own.
- **Step 10 changes behaviour for every tenant.** A screen that reads or writes the `security` schema as a non-admin will break unless it is on the allowlist. The sweep found only one such call (saving the last-used BU and branch). Run every screen once as a business user before release.
- **Media read links (decided).** Files under `/uploads/…` stay readable without a login; the paths are hard to guess and customer-facing links depend on them.
- **Public company list (decided).** Lite/Basic/Standard BUs appear in service-plus-web's company dropdown, like any other BU. Nothing to build.
- **Login client picker (decided).** The default customer database's client is named "Service+ Service Centers"; Lite/Basic/Standard users pick it at login.
- **Isolation inside the default database** comes entirely from Step 10, since all customers share one database and one credential pair.
- **Month length (decided).** A month is a calendar month counted from the date paid: paying on 15 Jan covers through 14 Feb; paying for N months adds N calendar months. No grace period.
- **View-only exceptions (decided).** The customer's own admin can still manage users and roles when read-only. User-triggered sends (WhatsApp/email from a screen) are writes and are blocked; background writers skip read-only BUs.
- **First month (decided).** The setup cost and the monthly fee are unrelated. Approval does not record any monthly payment and there is no courtesy period, so the admin (lt) or Super Admin (ent) must record the first month right after approval. Until then the new customer, who already has a login, sees the view-only message.
- **Data safety.** View-only never deletes or hides data. Decide separately a longer-term rule (e.g. suspend login after N months unpaid); not in this plan.
- **Clock and timezone.** Status uses the server date in IST; a user working across midnight can be cut off mid-session, which the dialog explains.
- **Reminder scheduler (corrected).** The server does have a scheduler: APScheduler in `app/scheduler.py`, used for the monthly stock snapshot. The reminder job is added there, so no separate background loop is needed. It runs in server local time today; the reminder job sets IST explicitly.
- **Events and the billing cache live inside one server process.** With more than one process, an event reaches only users on the same process and a payment is seen by the others within 60 seconds. Acceptable for now; a shared store would be needed to tighten it.
- **Plan limits** (users, jobs/month) are not enforced; see `plans/plan-claude.md`.
- **Portal form rule (decided).** The portal form follows the client rule: errors at once, Submit disabled while invalid.
