# Plan — Plan-based sign-up, approval and monthly billing

Source: `plans/prompt.md`, `plans/prompt1.md`. Design only; nothing implemented yet. The full wording before shortening (2 Oct 2026) is in `plans/history/plan-signup-billing-full-2026-10-02.md`. Reformatted to the current planning guidelines on 2 Oct 2026: build steps renumbered 1–15, all manual work gathered into Step 0 (Your Part). Reorganised 2 Oct 2026: Step 0 keeps only what can be done now; later manual parts sit after the step they wait for. Amended 2 Oct 2026: no database triggers; the branch limit moved from a trigger to a locked `addBranch` mutation (constraint 7, Step 12). Amended 2 Oct 2026: advance payment for any number of months or years (up to 5 years) at the plain monthly rate, no discount; prepaid time is kept fair when the fee changes mid-period (constraint 8).

Terms: **lt** = Lite, Basic, Standard (each customer is one BU in the shared *default customer database*). **ent** = Enterprise (own client and database, set up by the Super Admin).

## Goal

- A service centre picks a plan on the portal and fills the enquiry form. **Only Lite** has a confirm dialog and then "pending approval". Basic, Standard and Enterprise just submit and are told **our sales team will be in contact**. **Every plan** gets a thank-you email.
- **lt** enquiries are stored in the default customer database; its admin (userType `A`, the platform owner) is emailed and approves them.
    - Lite: one click creates the BU and a **Manager** user on it, and emails the login.
    - Basic, Standard: the admin must first record the one-time **setup cost** as received. No setup payment, no BU, user or login email.
- **ent** enquiries stay in `service_plus_client.public.sales_enquiry`; the Super Admin is emailed and has the same setup-cost gate before creating the client, database, first BU and admin user.
- **Monthly fee** (Basic, Standard, Enterprise) is a separate workflow: each calendar month is paid in advance and recorded by the admin (lt) or Super Admin (ent). The first month is recorded right after approval; until then, and from the day after any unpaid month (no grace period), the app is **view-only**: login, data, reports and prints work, every add/edit/delete is refused, and a payment message is shown. Recording a payment restores access at once. Lite is never restricted.
- **Advance payment:** a Basic, Standard or Enterprise customer may pay any number of months ahead, or whole years, up to 5 years (60 months) in one payment. There is **no discount**: the amount is always the monthly fee × months. The admin (lt) or Super Admin (ent) records it in one go by choosing **Months** or **Years** and a count; `paid_through` moves forward by that many calendar months and the customer gets no reminders until near the new date.
- **Branches:** Lite and Basic have only the head office (`HO`); Standard and Enterprise unlimited. Enforced on the server.
- A user sees only their assigned BUs, and the server-side holes that would let one customer reach another's data are closed.
- The default customer database is named in the server `.env` and uses the shared tenant credentials. No card details are collected.
- Already decided: every item under **Decided**, just before Step 0.

## Present context and current design

**Portal (every plan, today the same path):**
- Every plan posts `SalesEnquiryForm` to `POST /api/public/sales-enquiry` (`website_router.py`, `submit_sales_enquiry`), which writes every plan to `public.sales_enquiry` (`status`: `new | contacted | converted | rejected`) and emails the team.
- No payment or progress columns, no thank-you email, and no screen reads these rows.

**Super Admin:**
- Sets up a customer as: add client → create its database (with security schema) → create its admin user; that admin creates the BUs.
- The shared `NotificationBell` is used in the Super Admin header.

**Tenant admin (userType `A`):**
- Admin mode creates BUs (`create-business-unit-dialog.tsx` → `resolve_create_bu_schema_and_feed_seed_data_helper`) and business users (`create-business-user-dialog.tsx` → `resolve_create_business_user_helper`, with `bu_ids` + `role_id`).
- BU creation seeds an `HO` branch with a placeholder address (`SeedBuData.BU_SEED_SQL`).
- Admins load their BU list with `GET_ALL_BUS_WITH_SCHEMA_STATUS` via `genericQuery`. The admin layout has no notification bell.

**Business user:**
- Login returns the user, rights and BU list; business users keep `availableBus` from login. Refresh returns only tokens.
- Branches are added through `genericUpdate` on the `branch` table; nothing limits them. The `MANAGER` role (id 1) is seeded with every right.

**Platform-wide:**
- Every tenant database uses one shared credential pair (`service_db_user` / `service_db_password`); the control plane uses `client_db_*`.
- Guards (`auth_guards.py`): `require_own_tenant` (the `db_name` must equal the token's; `S` exempt); `require_bu_access` (the `schema` must be in the token's `bu_codes`; `A`/`S` bypass; lets `security`, `public` and empty schemas through for everyone).
- APScheduler in `app/scheduler.py` runs the monthly stock snapshot.

## Key constraints

1. **lt enquiries cannot live in the control-plane table.** A tenant admin's calls are pinned to their own database, and opening `public.sales_enquiry` to them would expose the tenant registry. **Resolution:** lt enquiries go to a new `security.sales_enquiry` in the default customer database; ent stays in `public.sales_enquiry`. One home per plan group, nothing to sync (Step 4).
2. **The BU name rule rejects real business names** (`^[a-zA-Z0-9 ]{3,}$` rejects "Nav Technology Pvt Ltd."). **Resolution:** widen the name rule everywhere; the code rule `^[a-z0-9_]{3,30}$` stays (Step 3).
3. **Approval cannot be one transaction.** Creating a BU runs DDL on several connections, and creating the user is another call that also emails. The BU helper returns the new BU id only at the very end, and `BU_SCHEMA_DDL` cannot run twice (`CREATE FUNCTION`, `CREATE TABLE` without `IF NOT EXISTS`). **Resolution:** approval is resumable, with each finished part recorded on the enquiry row, the row claimed with a timestamp so two clicks provision once (Step 9).
4. **Payment must gate provisioning** in the resolver and in a database constraint, not only by a disabled button. **Resolution:** Steps 4, 9, 10.
5. **Security holes, open today in every tenant and worse in a shared database:**
    - a. Many resolvers have no guard, so they run with no token, including `dropDatabase`, `deleteClient` and `createClient`; others check a right but never the tenant or BU.
    - b. `genericQuery` and `genericUpdateScript` run **any** `SqlStore` id, and about 60 of them name `security.` tables directly, which `search_path` does not limit. So a business user sending their own BU code can read every user (`GET_BUSINESS_USERS`) or reset the admin's password (`RESET_ADMIN_PASSWORD`).
    - c. `genericUpdate` on `schema: "security"` lets any business user edit `security.user` (e.g. `is_admin`) or add `user_bu_role` rows; `genericQuery` there reads everyone's users.
    - d. Subscriptions never read the socket token and filter only by `db_name` (or only by branch id).
    - e. Media upload/delete do not check the caller against the BU in the path.
    - **Resolution:** a and b in Step 1 (releasable alone); c, d, e in Step 6. Both come before any step that exposes new data.
6. **Writes enter through many doors** (`genericUpdate`, `genericUpdateScript`, many custom mutations, media upload), and the paying unit differs (an lt BU vs a whole ent database). **Resolution:** billing status on `security.bu` in each tenant database (Step 5), one server guard on every write path (Step 11), the UI only explains (Step 14). Existing BUs default to "not billed".
7. **The branch limit needs real enforcement, without database triggers.** A count-then-insert check cannot stop two inserts at the same moment, and no trigger may be added (decided 2 Oct 2026). **Resolution:** `security.bu.branch_limit` (Step 5), and one server door for new branches: a dedicated `addBranch` mutation that, in one transaction, locks the BU's `security.bu` row (`SELECT … FOR UPDATE`), counts branches and inserts. Two simultaneous adds queue on that lock, so the second sees the first. `genericUpdate` refuses every `branch` insert, nested ones included; edits and deletes stay on `genericUpdate`. `changeBuPlan` takes the same lock (Step 12). Rows inserted by hand with SQL are not checked; that is accepted.
8. **A fee can change while a customer is paid years ahead.** An upgrade (Basic → Standard), an extra Enterprise BU, or a fee set by the Super Admin would otherwise give the new, higher fee free for the rest of the prepaid period; a downgrade would leave the customer's prepaid money unused. A price change in `.env` must not touch prepaid customers at all. **Resolution:** the fee is stamped on the BU (`monthly_fee_paise`), so `.env` price changes affect only new payments. When a BU's (or Enterprise client's) fee changes and `paid_through` is after today, the unused prepaid value is converted at the new fee: `rebase_paid_through(paid_through, today, old_fee, new_fee)` = today + remaining days × old fee ÷ new fee (rounded down to whole days). Upgrade → the date moves earlier; downgrade → later. No refund, no extra charge, no discount; the change and both dates are written to the ledger as a zero-amount row with a note (Steps 5, 10, 12, 13).

## New design brief

- Resolver guards and `sqlId` allowlists first, released alone. (Step 1)
- `isDefaultCustomerDb` returned at login shows or hides screens; the server re-checks. (Step 2)
- Wider BU name rule. (Step 3)
- lt enquiries in `security.sales_enquiry`, ent in `public.sales_enquiry`; prices only in the server `.env`. (Steps 4, 7)
- Billing columns and payment ledger on every tenant; no database triggers. (Step 5)
- Further isolation: security-schema lock-down, subscriptions, media. (Step 6)
- Sign-up endpoints, emails and the portal. (Steps 7, 8)
- Resumable, claimed, payment-gated approval for lt and ent. (Steps 9, 10)
- View-only guard, branch limit (one locked `addBranch` mutation) and plan change, monthly payments and reminders. (Steps 11–13)
- Advance payment in months or years (up to 60 months), no discount; prepaid time rebased when the fee changes. (Steps 5, 13, 14)
- Client billing screens, help files. (Steps 14, 15)
- Manual work: database set-up now (Step 0); release gates, scripts, release and daily routine as Your Part blocks after Steps 1, 5, 6 and 15.

## Steps

How to read: Step 0 holds the manual work you can do now, plus a table of every Your Part. Each later piece of manual work is a **🧑 Your Part** block placed straight after the build step it waits for (C after Step 1, D after Step 5, E after Step 6, F–H after Step 15). Build steps 1–15 run in order. Each step has **Needs**, **Where**, **Build**, **Rules** where useful, and **Done when**. A step that waits on manual work names the **Your Part** item under Needs; the build stops there until that item is done. Inside a step build the server first, then the portal, then the client. House rules: tabs, double quotes, `pnpm format`; text longer than two words goes in `constants/messages.ts` (client, portal) or `AppMessages` (server); red only for errors; forms use react-hook-form + zod, errors at once, submit disabled while invalid. Every code change updates both help files (Step 15 is the final check).

### Decided

- Resolver guards first (Step 1), released alone (Your Part C).
- Media files stay readable without login; upload and delete are checked.
- lt enquiries live only in the default database; no copy in the control plane.
- No email when the setup payment is recorded; the next email is the login email.
- lt BUs appear in service-plus-web's company dropdown; nothing to build.
- Enterprise includes 5 BUs; each extra BU is ₹3,000 **per month**, added to the client's fee (confirmed 2 Oct 2026).
- The portal form validates like the client forms.
- Prices live only in the server `.env`; the portal fetches them live with built-in fallbacks (1 Oct 2026). Amounts stored in paise.
- The default database's client is "customers" (code `customers`, database `service_plus_customers`; created 2 Oct 2026, replacing the earlier name "Service+ Service Centers").
- Payments are recorded manually (no gateway); the platform owner records lt payments.
- A month is a calendar month from the day paid; no grace period; no courtesy period, so the first month is recorded right after approval.
- Customers may prepay 1–60 months in one payment (entered as months or as 1–5 years); no discount for paying ahead; a year is 12 months (2 Oct 2026).
- A fee change during a prepaid period converts the unused prepaid value at the new fee (date moves); no refunds, no top-up invoices (2 Oct 2026).
- Downgrade to Lite/Basic is refused while any branch other than `HO` exists; the customer deletes the data and branches.
- Manager role has every right, including branches.
- No new database triggers: the branch limit is enforced only in the server, through `addBranch`; hand-written SQL is not checked (2 Oct 2026). The existing stock-balance triggers are untouched.
- In view-only, the customer's own admin can still manage users and roles; screen-triggered sends are blocked; the snapshot job and WhatsApp callbacks keep running.

### Step 0 — Your Part: what you can do now
Only work you can do **today, before any build step**, is here. Everything you do later sits as a **🧑 Your Part** block straight after the step it waits for:

| Part | What | Where in this plan | When you can do it |
|---|---|---|---|
| A | Decisions | here | ✅ done |
| B | Set up the default customer database | here | ✅ done |
| C | Check and release Step 1 | after Step 1 | ✅ done, deployed |
| D | Back up and run the database scripts | after Step 5 | ✅ done |
| E | Security check | after Step 6 | **now** (Step 6 is built; restart the dev server) |
| F | Release | after Step 15 | when Steps 1–15 and parts C, D, E are done |
| G | Put existing paying customers on billing | after Step 15 | after F |
| H | Daily routine | after Step 15 | after F, ongoing |

**✅ A — Decisions — done (30 Sep 2026).** All answers are recorded under **Decided** above.

**✅ B — Set up the default customer database — done (2 Oct 2026).** Checked read-only: `.env` has `DEFAULT_CUSTOMER_DB_NAME = service_plus_customers`; client id 24, code `customers`, active, on that database; it holds the `security` schema with roles `MANAGER`, `TECHNICIAN`, `RECEPTIONIST` (20 access rights, 35 role-rights); admin `capitalch` is active with a password set; one hand-made BU `dummy` (schema present), which stays unbilled and unlimited.
1. In the server `.env`, add the "Customer settings" keys (from `service-plus-server/.env.example`):
    - `DEFAULT_CUSTOMER_DB_NAME`: **required**; the database name you give the client in item 2.
    - Optional (leave out to use the defaults): `LITE_BASIC_STANDARD_ENQUIRY_NOTIFY_EMAIL`, `ENTERPRISE_ENQUIRY_NOTIFY_EMAIL`, `BILLING_REMINDER_HOUR`; the `PRICE_…` keys and `ENTERPRISE_INCLUDED_BUS` (defaults are today's prices); `PORTAL_URL_PRODUCTION` (default `https://myserviceplus.in`, ignored while `DEBUG` is on).
    - These keys do nothing until Steps 2, 4, 7 and 13 read them; adding them early is harmless.
2. Super Admin → Clients: add the client **"customers"**, create its database, create its admin user (you), seed its roles. It needs no BU of its own: sign-up approvals (Step 9) create one per customer. A BU you create by hand there stays unbilled and unlimited, like existing BUs.
3. Set the admin's password from the emailed link, restart the server, and log in as that admin. With no BU yet you get "No business unit has been created yet" and a **Go to Admin Mode** button; that is expected.
- **Done when:** you can log in as that admin and reach Admin mode.

### ✅ Step 1 — Guard every resolver and every `sqlId` (released alone) — built, checked and deployed 2 Oct 2026
**Needs:** Your Part A.

**As built:** all 42 mutations and 10 queries call a guard. `NON_ADMIN_SECURITY_SQL_IDS` = `GET_EW_LEADS_PAGED`, `GET_EW_LEAD_DETAIL`, `GET_EW_LEAD_TIMELINE`, `GET_JOB_TRANSACTIONS_BY_JOB`, `GET_JOB_TRANSACTION_DETAIL`. `NON_ADMIN_SCRIPT_SQL_IDS` = `DELETE_PURCHASE_INVOICE`, `SQL_GENERATE_STOCK_SNAPSHOT`; the other two client scripts are already in the rights map. The client sweep found 5 `genericUpdateScript` files, not six (the sixth hit was the help file). The scan also catches `"security".`, `information_schema.` and `pg_*` catalog tables (56 ids). `pytest`: 58 passed, 4 skipped; the live dev server refuses an anonymous `superAdminClientsData` and `dropDatabase`. Found, not fixed: `auditLogs`/`auditLogStats` read one audit store shared by all tenants, so a tenant admin's audit page can show other tenants' entries. This is now listed under Flags.

**Where:** server `auth_guards.py`, `mutation.py`, `query.py`, `shared/generic_query.py`, `app/db/sql/sql_base.py`, `tests/test_auth_guards.py`.

**Build:**
- `require_authenticated(info)` (new): rejects a missing or rejected token, keeping the `TOKEN_EXPIRED` answer for an expired one.
- **Super Admin only** (`require_user_type {"S"}`): `createClient`, `createServiceDb`, `seedSecurityData`, `deleteClient`, `dropDatabase`, `mailAdminCredentials`; queries `superAdminClientsData`, `usageHealth`, `systemSettings`, `superAdminDashboardStats`.
- **Own admin or Super Admin** (`require_own_tenant` + `{"S","A"}`): `feedBuSeedData`, `deleteBuSchema`, `mailBusinessUserCredentials`, `adminDashboardStats`, `auditLogs`, `auditLogStats`. Check each one's client callers first; `auditLogs`/`auditLogStats` take no database name and serve both audit pages.
- **Anything taking a BU `schema`** (`require_own_tenant` + `require_bu_access`, before any right check): `importSpareParts`, `deleteUnusedPartsByBrand`, `createSingleJob`, `updateJob`, `updateOpeningJob`, `createJobBatch`, `updateJobBatch`, `deleteJobBatch`, `undoJobTransaction`, `deliverJob`, `undeliverJob`, `createSalesInvoice`, `createJobInvoice`, `regenerateJobInvoice`, `createJobPayment`, `accountsPosting`, `verifyJobDeliveryOtp`, `setJobDeliveryManualConfirmation`, the five `sendWhatsapp…` mutations, the four Extended Warranty mutations, and the query `getJobDeliveryOtpPending`.
- **`sqlId` allowlists** (non-admin callers only; `A`/`S` unchanged):
    - `genericUpdateScript` is deny-by-default: the id must be in `GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS` (right still checked) or in `NON_ADMIN_SCRIPT_SQL_IDS` (new, `mutation.py`), built by sweeping the client's `genericUpdateScript` calls (six files).
    - `genericQuery` / `genericBatchQuery`: at start-up, scan `SqlStore` texts for `security.`, `public.` or `pg_catalog.`; those ids are admin-only unless on `NON_ADMIN_SECURITY_SQL_IDS` (new, `auth_guards.py`). Start the list with the ids that only look up a name for rows in the caller's own BU (the Extended Warranty and accounts queries joining `security."user"` for a name, the job query reading the BU's own name), checking each.
- **Tests:** one walks every registered mutation and query and fails if one has no guard and is not on a "public on purpose" list (starts empty); one fails if a non-admin client screen uses an id naming `security.` that is not allowlisted; one checks `RESET_ADMIN_PASSWORD`, `GET_BUSINESS_USERS` and `GET_ADMIN_USERS` are refused for a business user sending their own BU code.

**Rules:** `require_bu_access` itself is unchanged here (Step 6). Login, refresh and password reset are REST, so normal use should not notice. Release alone through Your Part C.

**Done when:** with no token, `dropDatabase`, `deleteClient`, `createClient`, `superAdminClientsData`, `auditLogs`, `createSingleJob` are rejected; an admin cannot call Super Admin-only ones; a user of BU A cannot run a job or invoice mutation on BU B or another tenant; the three allowlist tests pass; `pytest` passes.

### ✅ 🧑 Your Part C — Check and release Step 1 (release gate) — done 2 Oct 2026: screens checked with no "Access forbidden"; Step 1 deployed to production on its own
**Needs:** Step 1 on your development server. Steps 2 onwards can be built meanwhile, but none is released before this.
1. Super Admin: clients list, add/initialise dialogs, usage, audit logs, settings.
2. Tenant admin: dashboard, BUs, business users, roles, audit logs.
3. Business user: BU/branch switch, create and deliver a job, receipt, sales invoice, spare-part import, WhatsApp send, Extended Warranty, and the screens that save through scripts (stock adjustments, opening jobs, accounts posting).
4. Tell Claude about anything that now says "Access forbidden". If clean, deploy Step 1 on its own; recommended, since the hole is open today.

**Done when:** every screen above works and Step 1 is deployed.

### ✅ Step 2 — Settings and `isDefaultCustomerDb` — built 2 Oct 2026
**As built:** `app/config.py` is not touched (off-limits to Claude); the composed `Settings` already inherits the per-concern classes, so `default_customer_db_name` and `billing_reminder_hour` went into `api_settings.py`, the two notify emails into `email_settings.py`. The Enterprise fallback is `get_enterprise_enquiry_notify_email()` in `default_customer.py`. `DEFAULT_DB_NOT_CONFIGURED` is raised as a `ServicePlusException` with that code. `GET_DEFAULT_CUSTOMER_CLIENT` lives in `SignupServerSql`.

**Needs:** Your Part B.

**Where:** server `app/config.py`, `app/core/settings/`, `app/routers/auth/auth_schema.py`, `helper.py`, `app/core/exceptions.py`, new `app/services/default_customer.py`; client `src/lib/auth-service.ts`, `auth-slice.ts`.

**Build:**
- Settings, like `contact_notify_email`: `default_customer_db_name` (empty default); `lite_basic_standard_enquiry_notify_email`; `enterprise_enquiry_notify_email` (falls back to `contact_notify_email`, then `super_admin_email`); `billing_reminder_hour` (IST, default 9). No new credentials.
- `get_default_customer_client()` (new): finds the active `public.client` row with that `db_name`; returns id, code, name, db name; raises `AppMessages.DEFAULT_DB_NOT_CONFIGURED` (new) if unset or not found.
- `require_default_customer_db(info, db_name)` (new guard): passes only when `db_name` equals the setting.
- `LoginResponse.is_default_customer_db` (alias `isDefaultCustomerDb`): true when the login's `db_name` equals the setting; false otherwise and always for the Super Admin. Set once at login (refresh carries only tokens).
- Client: `isDefaultCustomerDb` on `UserInstanceType` (saved with `user`, survives reload); selector `selectIsDefaultCustomerDb`.

**Rules:** the flag only shows or hides screens; every server action re-checks.

**Done when:** the default database's admin gets `true`, others `false`; with the setting empty everyone gets `false` and the helper raises; the flag survives a browser refresh.

### ✅ Step 3 — Widen the BU name rule — built 2 Oct 2026
**As built:** server `BU_NAME_PATTERN` (`provisioning.py`) and message `AppMessages.BU_NAME_FORMAT`; client `BU_NAME_REGEX` in new `src/lib/bu-name.ts` and `MESSAGES.ERROR_BU_NAME_FORMAT`, used by both dialogs (the edit dialog's old 2-character minimum is now 3, like create).

**Needs:** nothing.

**Where:** server `provisioning.py`; client `src/features/admin/components/create-business-unit-dialog.tsx`, `edit-business-unit-dialog.tsx`.

**Build:**
- One named constant per project, `^[A-Za-z0-9][A-Za-z0-9 .&'()/,-]{2,99}$` (starts with a letter or digit, 3–100 characters, allows `. & ' ( ) / , -`).
- Update both client messages and the server `detail`.
- Name uniqueness (`CHECK_BU_NAME_EXISTS`) stays. The portal uses the same rule (Step 8).

**Done when:** "Nav Technology Pvt Ltd." passes in the server and both dialogs; "...", "-abc" and names under 3 characters fail; "Demo Unit" still passes.

### ✅ Step 4 — Enquiry tables and price list — built 2 Oct 2026
**As built:** `*_by` columns (`reviewed_by`, `payment_recorded_by`) are **text usernames**, not user ids: Enterprise actions are taken by the Super Admin, who has no `security."user"` row. Each constraint is dropped and re-added so the scripts stay safe to run twice. `plan_prices.py` reads `.env` through its own `PlanPriceSettings`. Both scripts were run twice and every constraint checked inside one rolled-back transaction on `service_plus_customers` (Enterprise against a throwaway copy of the tables); nothing persisted. `pnpm gen-types-all` and the schema dump wait for Your Part D. Note for Step 9: the generated security types come from `service_plus_service`, which will not hold `security.sales_enquiry`; decide there how the client types it.

**Needs:** Step 2.

**Where:** server new `app/db/sql/sql_signups.py`, `sql_base.py`, new `app/core/plan_prices.py`, `app/db/schema_dumps/`; client generated types.

**Build:**
- `sql_signups.py` holds `SignupSql` (reads; added to `SqlStore`) and `SignupServerSql` (DDL and writes; **not** in `SqlStore`, so `genericQuery`/`genericUpdateScript` can never run them).
- **`security.sales_enquiry`** (default database; lt), `SALES_ENQUIRY_DDL`, safe to run twice (`CREATE TABLE IF NOT EXISTS`, then `ADD COLUMN IF NOT EXISTS`):
    - `id`; `reference` (random public code like `SP-7K3QX9WD`, unique); `plan_code` (`lite | basic | standard`);
    - `name`, `business_name`, `mobile`, `email`, `city`, `gstin`, `branches`, `message`, `ip`; `bu_name`, `bu_code`;
    - `status` (`pending | approved | rejected`), `rejection_reason`;
    - `bu_id`, `bu_schema_ready_at`, `user_id`, `login_email_sent`, `processing_started_at` (claim);
    - `reviewed_by`, `reviewed_at`, `created_at`; the payment columns below.
    - Unique indexes on `reference`, and on `email`, `mobile` and `bu_code` where status is pending or approved. Store `email` trimmed and lower-case and `mobile` as its last 10 digits.
- **`public.sales_enquiry`** (ent), `SALES_ENQUIRY_ENT_ALTER`, safe to run twice: add `reference`, the payment columns, `client_id`, `bu_id`, `bu_schema_ready_at`, `user_id`, `login_email_sent`, `processing_started_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`. Statuses stay `new | contacted | converted | rejected`; only Enterprise rows are written from now on.
- **Payment columns (both tables):** `setup_fee_paise` (0 for Lite; stamped from the price list; editable by the Super Admin for ent), `payment_status` (`not_required | pending | received | failed`; Lite starts `not_required`, the rest `pending`), `payment_amount_paise`, `payment_mode` (`bank_transfer | upi | cash | other`), `payment_reference`, `payment_received_on`, `payment_recorded_by`, `payment_recorded_at`, `payment_note` (required for `failed` or a correction).
- **Check constraints:** lt `approved` needs `received` or `not_required`; ent `converted` needs `received` (added `NOT VALID`, so old rows are left alone); `received` needs mode, reference, date and amount ≥ `setup_fee_paise`; `not_required` only with `setup_fee_paise = 0`.
- **Price list** `plan_prices.py`, the only place prices live, read from `.env` in whole rupees, converted to paise: `PRICE_BASIC_SETUP/MONTHLY`, `PRICE_STANDARD_SETUP/MONTHLY`, `PRICE_ENTERPRISE_SETUP/MONTHLY`, `PRICE_EXTRA_BU_MONTHLY`, `ENTERPRISE_INCLUDED_BUS`. Defaults: Basic ₹2,000 + ₹2,999/month; Standard ₹2,000 + ₹5,999; Enterprise ₹5,000 + ₹10,999; extra BU ₹3,000/month; 5 BUs included; Lite always 0. The server never takes a price from the browser.
- `pnpm gen-types-all`; refresh the schema dump (both after Your Part D has created the tables).

**Rules:** the setup cost is the only money on an enquiry; monthly payments live in Step 5's ledger. The public never sees the row `id`. Who recorded a payment stays on the row (the audit log is purged).

**Done when:** both scripts run twice on a scratch database; `approved` with `pending` fails; `received` without a reference fails; a Lite row with `not_required` and fee 0 can be approved.

### ✅ Step 5 — Billing columns, payment ledger — built 2 Oct 2026
**As built:** `BU_BILLING_DDL` is **not** pasted into `SECURITY_SCHEMA_DDL`, because `sql_bu_admin_ddl.py` is generated by `extract_schema.py` and would lose it. New client databases run it explicitly right after `SECURITY_SCHEMA_DDL` in `resolve_create_service_db_helper`. Ledger `recorded_by` is a text username. Also `exceeds_prepaid_limit()` and `add_months()` in `billing.py`. The billing columns are **not** added to `GET_USER_BUS` / `GET_ALL_BUS_WITH_SCHEMA_STATUS` yet: login runs `GET_USER_BUS`, so adding columns before Your Part D creates them would break every login. That moves to Step 11, the first step that reads them. `pytest`: 103 passed, 4 skipped.

**Needs:** nothing (written with Step 4).

**Where:** server new `app/db/sql/sql_billing.py`, `sql_bu_admin_ddl.py` (`SECURITY_SCHEMA_DDL`), `sql_bu_admin.py` (`GET_USER_BUS`, `GET_ALL_BUS_WITH_SCHEMA_STATUS`), new `app/core/billing.py`; client generated types.

**Build:**
- `BillingSql` (reads, in `SqlStore`) and `BillingServerSql` (DDL and writes, not in it).
- `BU_BILLING_DDL`, safe to run twice, run on every tenant database and by `createServiceDb` right after `SECURITY_SCHEMA_DDL` (not pasted into the generated `SECURITY_SCHEMA_DDL`). New `security.bu` columns: `plan_code` (`lite | basic | standard | enterprise`, null for existing BUs); `billing_required` (default false; true for Basic, Standard, Enterprise); `monthly_fee_paise`; `paid_through` (null until the first payment); `billing_hold`; `branch_limit` (1 for Lite and Basic, null = unlimited); `last_reminder_on`, `last_reminder_kind`.
- **`security.bu_payment`**, append-only ledger: `id`, `bu_id` (null for an Enterprise payment covering the whole database), `entry_kind` (`payment | fee_rebase | extension | correction`), `amount_paise`, `months` (`CHECK months BETWEEN 0 AND 60`; 0 only for non-payment kinds), `monthly_fee_paise` (the fee the payment was priced at, so a later fee change never re-prices old payments), `payment_mode`, `payment_reference`, `received_on`, `period_from`, `period_to` (not before `period_from`), `note`, `recorded_by`, `recorded_at`. A `payment` row needs `amount_paise ≥ monthly_fee_paise × months`. Corrections are new rows with a note.
- No trigger and no change to `BU_SCHEMA_DDL`: the branch limit is enforced by `addBranch` in Step 12. Here only the SQL it uses, in `BillingServerSql`: `LOCK_BU_FOR_BRANCH` (`SELECT id, branch_limit FROM security.bu WHERE LOWER(code) = %(schema)s FOR UPDATE`) and `COUNT_BRANCHES` (all branches, inactive included).
- In `billing.py`: `today_ist()` used everywhere; `compute_billing_status(bu, today)` → `not_billed` (billing off) / `read_only` (hold, null `paid_through`, or today after it) / `due_soon` (within the last 5 days; warning only) / `active`; `extend_paid_through(paid_through, today, months)` starts from the later of `paid_through` and yesterday and adds calendar months (1–60; a year is passed as 12 × years); `rebase_paid_through(paid_through, today, old_fee, new_fee)` per constraint 8 — returns `paid_through` unchanged when it is not after today or the fees are equal; `MAX_PREPAID_MONTHS = 60` as a named constant.
- ~~Add the billing columns to `GET_USER_BUS` and `GET_ALL_BUS_WITH_SCHEMA_STATUS`.~~ Moved to Step 11 (see As built).

**Rules:** no grace period; a billed BU with no `paid_through` is `read_only`; every existing BU stays not billed and unlimited.

**Done when:** the DDL runs twice; it creates no trigger; unit tests pass for billing off, hold, null `paid_through`, the day before/of/after `paid_through`, the 5-day window, and the dates: paid 15 Jan → 14 Feb; paid again 10 Feb → 14 Mar; paid late 20 Mar after lapsing 14 Mar → 19 Apr; 31 Jan + 1 month → end of February; multi-year: paid 15 Jan 2027 for 24 months → 14 Jan 2029; paid through 14 Jan 2029, another 12 months → 14 Jan 2030; 29 Feb 2028 + 12 months → 28 Feb 2029; 61 months refused. Rebase: 100 days left at ₹2,999 moving to ₹5,999 → 49 days; at ₹5,999 moving to ₹2,999 → 200 days; paid through yesterday → unchanged.

### ✅ 🧑 Your Part D — Back up and run the database scripts — done 2 Oct 2026
**As done:** the script ended "Done: 5 ran, 0 failed" (it now skips `service_plus_service` when that database is not on the server). `BU_BILLING_DDL` was run on the template `service_plus_service` by hand; `pnpm gen-types-all` and both schema dumps were refreshed; `tsc -b --noEmit` passes.

**Needs:** Steps 4 and 5 built (✅). Step 7 waits for this. 
1. Back up `service_plus_client` and every tenant database (today: `service_plus_capitalgroup`, `service_plus_customers`, `service_plus_demo`, plus the template `service_plus_service`).
2. From `service-plus-server/`, inside the venv, run `python scripts/run_signup_billing_ddl.py --dry-run` and check the list of targets.
3. Run `python scripts/run_signup_billing_ddl.py`. It runs `SALES_ENQUIRY_DDL` on the default database, `SALES_ENQUIRY_ENT_ALTER` on `service_plus_client`, and `BU_BILLING_DDL` on every client database plus `service_plus_service`, each in its own transaction, and ends with "Done: N ran, 0 failed." It is safe to run again.
4. Tell Claude. Claude then regenerates the client types (`pnpm gen-types-all`) and the schema dump.

**Done when:** the script reports 0 failed; existing customers log in and work as before.

### ✅ Step 6 — Shared-database security fixes — built 2 Oct 2026 (awaiting Your Part E)
**As built:** no read exception was needed: `require_bu_access` refuses `security`, `public` and empty schemas to every non-admin (`TENANT_WIDE_SCHEMAS`). `genericUpdate` now calls `require_generic_update_access` (in `auth_guards.py`) instead of a bare `require_bu_access`. It walks the whole payload and refuses `SECURITY_SERVER_ONLY_TABLES` and the `bu` billing columns (`BU_BILLING_COLUMNS`) to everyone, `S` included, in any schema. On `security`, a non-admin gets only their own `last_used_bu_id`/`last_used_branch_id` row. The client sweep found that row is the only `security`/`public` call outside Admin and Super Admin screens. All four BU dialogs write only `name`, `is_active` or `deletedIds`. Subscriptions: Ariadne 1.0.1's `on_connect` (`on_ws_connect` in `schema.py`) verifies the `connectionParams` token once and keeps the claims in the socket's scope; each source runs its guards, then returns the stream; `subscriber_may_receive` filters each event; every publisher now sends `db_name` and `schema`; `genericSubscription` is removed; `salesEnquiryCount(db_name)` plus `publish_sales_enquiry_count` are ready for Steps 9 and 10. Media: `get_token_claims` (`dependencies.py`) and `_require_media_scope` on all seven write routes; `client_code` is checked against `GET_CLIENT_DB_NAME`. No client code change. `pytest` (with dummy settings, since the sandbox cannot read the server's settings file): 181 passed, 4 skipped, 1 failed; the failure is `test_admin_dashboard_stats`, which needs a live database and fails the same way without these changes.

**Needs:** Steps 1, 4, 5. Applies to every tenant.

**Where:** server `auth_guards.py`, `mutation.py`, `query.py`, `shared/generic_query.py`, `app/graphql/schema.py`, `resolvers/subscription.py`, `pubsub.py`, `app/whatsapp/sender.py`, `app/routers/webhooks/whatsapp_webhook_router.py`, `resolvers/sales_accounts/mutations.py`, `app/routers/media/image_router.py`, `tests/test_auth_guards.py`.

**Build:**
- **`require_bu_access` denies tenant-wide schemas** (`security`, `public`, empty) to non-admins, except:
    - read ids on `NON_ADMIN_SECURITY_SQL_IDS` (Step 1). None needed so far: business users get their BU list at login;
    - one write: a user updating their **own** `security.user` row with only `last_used_bu_id` and `last_used_branch_id` (the BU/branch switcher, `use-bu-branch-division-actions.ts`). The guard checks the row id is the token's user and no other column is sent.
    - Any allowlisted query filters by the token's user or BU codes, never by an id the caller sends.
- **`genericUpdate` table lists:** `SECURITY_ADMIN_ONLY_TABLES` (`user`, `user_bu_role`, `bu`, `role`, `role_access_right`, `access_right`, `sales_enquiry`, `bu_payment`) need `A` or `S`. `SECURITY_SERVER_ONLY_TABLES` (`sales_enquiry`, `bu_payment`) and the billing columns of `bu` (`plan_code`, `billing_required`, `monthly_fee_paise`, `paid_through`, `billing_hold`, `branch_limit`, `last_reminder_on`, `last_reminder_kind`) cannot be written through `genericUpdate` by anyone; only Steps 9, 12 and 13 change them. Check the nested `xDetails` tables too. Confirm the edit, activate, deactivate and delete BU dialogs write no billing column.
- **`genericUpdateScript` on `security`** is refused for non-admins.
- **Subscriptions:** read the token in Ariadne's connect hook (confirm against the installed version) and put user type, database and BU codes in the context; reject a socket without a valid token; check the `db_name` argument (`S` exempt); add the BU code to every event and deliver only to callers with that code (admins get all of their own database); `accountsPostingProgress` matches database and BU, not only branch id; remove or guard `genericSubscription`; add an admin-only enquiry-count event (Step 9). No client change needed.
- **Media:** upload and delete check `client_code`, `bu_code`, `db_name` and `schema` against the token. Reading stays open (decided).
- **Tests:** extend `test_auth_guards.py`; add the new resolvers and ids to Step 1's tests.

**Rules:** the in-memory event system is per server process; screens using events also reload on open. Passes the release gate in Your Part E before release.

**Done when:** as a business user, `genericUpdate` on `security.user` (`is_admin`), `user_bu_role` or `sales_enquiry` is forbidden and saving their own last-used BU still works; as an admin, writing `security.bu.paid_through` is forbidden; `genericQuery` on `security` as a business user, or with another customer's BU code, is forbidden; a socket with no token is rejected and user A gets no BU B events; uploading or deleting a BU B file as a BU A user is forbidden.

### 🧑 Your Part E — Security check (release gate)
**Needs:** Step 6 on your development server. Nothing from Step 6 onwards is released before this.
1. As a non-admin business user and as an admin, open every screen: login, BU/branch switch, jobs, masters, inventory, reports, the admin BU and user screens, the Super Admin client screens, WhatsApp status updates.

**Done when:** everything works for both; tell Claude about any "Access forbidden".

### Step 7 — Public endpoints and emails (server)
**Needs:** Steps 2, 3, 4, 6; Your Part D (tables exist).

**Where:** server `website_router.py`, `sql_signups.py`, `app/core/exceptions.py`, `plan_prices.py`, `app/core/settings/api_settings.py`.

**Build:**
- **Portal address for email links**, built like `frontend_url` so local testing needs no configuration: in `api_settings.py`, a setting `portal_url_production` (default `https://myserviceplus.in`) and a computed `portal_url` that returns `http://localhost:3005` (the portal's `pnpm dev` port) when `debug` is on, and `portal_url_production` otherwise. Every portal link in an email is built from it, with no trailing slash on the base. The status link is `<portal_url>/signup-status/` (the portal is built with `trailingSlash: true`). It's optional in `.env`; add `PORTAL_URL_PRODUCTION` to the "Customer settings" section of `.env.example` only as a commented override.
- **`GET /api/public/plan-prices`** (`require_website_key`, `rate_limit("plan-prices", 60/min)`): per plan, setup and monthly fee in rupees, plus the included-BU count and extra-BU fee. Nothing else. Cache header about 5 minutes.
- **`POST /api/public/sales-enquiry`** accepts **only** `enterprise` (other plans get `SIGNUP_WRONG_ENDPOINT`); inserts with `reference`, list setup fee, `payment_status = 'pending'`; emails the team and `enterprise_enquiry_notify_email`; sends the thank-you; returns status and reference.
- **`POST /api/public/signup`** for lt (`require_website_key`, `rate_limit("signup", 5/min)`), in order:
    1. `get_default_customer_client()`; if not configured, a clear error and nothing written. Never fall back to the control-plane table.
    2. validate as `SalesEnquiryIn` does, plus the Step 3 name rule and `branches = 1` for Lite and Basic.
    3. refuse if a pending or approved enquiry has the mobile or email, or the email is already a user in the default database, with **one** `SIGNUP_DUPLICATE` message pointing to the status page (so it cannot reveal which emails have accounts).
    4. `bu_name` = trimmed business name, plus " (city)" if it clashes with a BU or pending enquiry name.
    5. `bu_code` via `derive_bu_code` (new, shared with Steps 9 and 10): lower-case; runs of other characters → `_`; trim `_`; cut to 26; pad short codes with `bu`; prefix `bu_` if it starts with `pg_` or a digit; add `_2`, `_3`, … while it clashes with a BU code, an existing schema, a reserved name (`public`, `security`, `information_schema`, `demo1`) or a pending enquiry.
    6. insert with the plan's setup fee and starting payment status; on a unique-index clash, regenerate and retry a few times.
    7. publish the pending count; email the applicant and approvers; return status and reference.
- **`POST /api/public/signup/status`** (Lite; `rate_limit("signup-status", 10/min)`): mobile **and** email must match the same request; returns only the status, the rejection reason, or for an approved request the login address and client name. Otherwise "no request found".
- **Emails** (plain text and HTML templates in `AppMessages`):
    - thank-you for Lite: pending approval, reference, status link (`<portal_url>/signup-status/`);
    - rejection email (Step 9): the reason, plus the same status link;
    - thank-you for Basic/Standard: sales team will contact, reference, setup cost, account created once it is received, monthly fee paid separately;
    - thank-you for Enterprise: sales team will contact, reference;
    - approver email to every active admin of the default database plus `lite_basic_standard_enquiry_notify_email`: plan, applicant, setup status, link to the Enquiries page;
    - the existing Super Admin email, also to the extra address.
- New `AppMessages`: `DEFAULT_DB_NOT_CONFIGURED`, `SIGNUP_DUPLICATE`, `SIGNUP_WRONG_ENDPOINT`, `PAYMENT_NOT_RECEIVED` (`PREPAID_LIMIT_EXCEEDED` is added in Step 13).

**Rules:** save first, email after; a failed email is logged, never fails the request. Only the random reference is shown, never the id.

**Done when:** each plan lands only in its table; all four get a thank-you; duplicates are refused; two sign-ups with one business name get different codes; with the setting unset an lt sign-up writes nothing; `lite` sent to `/sales-enquiry` is refused; with `debug` on and no portal setting in `.env`, the Lite thank-you email links to `http://localhost:3005/signup-status/`, and with `debug` off to `https://myserviceplus.in/signup-status/`.

### Step 8 — Portal
**Needs:** Step 7.

**Where:** portal `components/pricing/sales-enquiry-form.tsx`, `enquiry-success.tsx`, new `lite-confirm-dialog.tsx`, new `app/signup-status/page.tsx`, new `components/signup/signup-status-form.tsx`, new `lib/plan-prices.ts`, `lib/api.ts`, `lib/validators.ts`, `constants/messages.ts`, `content/faq.ts`, `content/pricing.ts`, `app/sitemap.ts`, and the price-showing components.

✅ **Already done:** the branch limit across plan cards, comparison table, recommender, form, features text and FAQ.

**Build:**
- `lib/api.ts`: `submitSignup` (lt), `fetchSignupStatus`; `submitSalesEnquiry` (Enterprise) returns the reference.
- Business name uses the Step 3 pattern in `lib/validators.ts`, with a message listing the allowed characters.
- **Lite:** the button reads "Confirm Lite signup" and opens `lite-confirm-dialog.tsx` (business name, email, "account created after approval"); cancel keeps the form. Other plans submit directly.
- `enquiry-success.tsx` shows the reference. Lite: "Your request is pending approval. We have emailed you." plus a status-page link. Others: "Thank you. Our sales team will be in contact with you shortly. We have emailed you."
- `/signup-status` page (fetches from the browser; static export), in the sitemap: pending, approved (login link and client name) or not approved (reason).
- **Live prices:** `lib/plan-prices.ts` fetches `/api/public/plan-prices` once per page load and shares it (context or hook). `content/pricing.ts` amounts are the fallback shown first and kept on failure. Every price display (search `monthlyPrice`, `setupFee`) reads the loader. JSON-LD and pre-built HTML keep the fallback; update it at a later release after a price change. Check cross-site access works like the enquiry post.
- Form validates as the visitor types, errors at once, submit disabled while invalid.
- Enterprise card, comparison table and "What is a business unit?": 5 BUs included, more at ₹3,000 per month each.
- Reword `successPayment` and the "How do I pay?" FAQ: setup fee first, account created when received, then the monthly fee each month; add that a paid plan becomes view-only if a month is unpaid. New FAQ "Can I pay in advance?": yes, any number of months or up to 5 years at once, at the same monthly rate (no discount); if you change plan later, your prepaid time is adjusted to the new fee.

**Rules:** server duplicate and "not configured" errors show in the form's error summary; the honeypot stays.

**Done when:** only Lite shows the dialog and "pending approval"; every success screen shows a reference; the status page shows all three states; `pnpm build` passes.

### Step 9 — Admin: setup payment, approval, rejection (lt)
**Needs:** Steps 2, 4, 5, 6, 7.

**Where:** server new `resolvers/bu_admin/signups.py`, `schema.graphql`, `mutation.py`, `sql_signups.py`, `audit_log.py`, `exceptions.py`, `users_roles.py`; client `src/features/admin/`, `src/components/shared/`, `src/router/`, `src/constants/`.

Every action checks `require_own_tenant`, `require_user_type {"A"}`, `require_default_customer_db`.

**Build — server:**
- Reads in `SignupSql` (admin-only after Step 6): `GET_SALES_ENQUIRIES` (filters: status, plan, payment status; newest first), `GET_SALES_ENQUIRY_PENDING_COUNT`.
- `recordSalesEnquiryPayment` (id, amount, mode, reference, date): only while `pending` and Basic/Standard; amount ≥ setup fee; date not in the future; sets `received` and recorded-by/at. Creates nothing.
- `markSalesEnquiryPaymentFailed` (id, note): sets `failed`; can later be paid or rejected.
- `approveSalesEnquiry` (id; optional edited BU name, BU code, username), in order:
    1. **Claim:** one statement sets `processing_started_at` only if still `pending` and not claimed in the last 10 minutes; otherwise answer "already being processed".
    2. **Payment gate:** refuse with `PAYMENT_NOT_RECEIVED` unless `received` or `not_required`, before any work; release the claim.
    3. **BU row** (if `bu_id` empty): run the code and name uniqueness checks, then insert the `security.bu` row and store `bu_id` on the enquiry **in one transaction** (same database).
    4. **Schema** (if `bu_schema_ready_at` empty): if a schema with this code exists, it is a half-built leftover (no user yet), so drop it with `CASCADE`, only after confirming the name equals the enquiry's `bu_code` and row `bu_id` has that code. Call `resolve_create_bu_schema_and_feed_seed_data_helper` with the stored `id` (its repair path), then set `bu_schema_ready_at`. If already set, never touch the schema.
    5. **Plan:** `plan_code`, `branch_limit` (1 Lite/Basic, null Standard), `billing_required` (false Lite, true otherwise), `monthly_fee_paise` from the price list; `paid_through` empty.
    6. **Head office:** set `HO`'s `city`, and `gstin` if given.
    7. **User** (if `user_id` empty): `resolve_create_business_user_helper` with email, name, mobile, username, the BU id and `MANAGER` (looked up by code); store `user_id` and `login_email_sent`.
    8. **Finish:** `approved`, reviewer and time; clear the claim; audit; publish the count. On any failure clear the claim, keep stored ids, return the error; the next click resumes.
- `rejectSalesEnquiry` (id, reason): only while `pending` and before any BU exists; emails the applicant; publishes the count.
- Login email: the helper sends a "set your password" link; add an optional sign-up wording (new template) naming the client to pick. If it failed, the grid shows "Login email not sent" with the existing `mailBusinessUserCredentials` resend.
- Audit actions `RECORD_ENQUIRY_PAYMENT`, `FAIL_ENQUIRY_PAYMENT`, `APPROVE_SALES_ENQUIRY`, `REJECT_SALES_ENQUIRY`. Mutations use the usual `db_name`, `schema`, `value` and `@handle_graphql_errors`.

**Build — client:**
- Shared `enquiries-grid.tsx`, `record-payment-dialog.tsx` (amount prefilled, mode, reference, date), `payment-status-chip.tsx`, taking data and save action as props (reused in Steps 10, 14).
- `NotificationBell` in `admin-layout.tsx` and a sidebar entry for `ROUTES.admin.enquiries` (`/admin/enquiries`), only when `isDefaultCustomerDb`. Count loads on open and on each event.
- Page columns: date, reference, business, contact, plan, setup fee, payment chip, status, actions; filters status (default pending), plan, payment; loaded with `useGenericQuery`.
- Actions: Lite **Create BU & Manager**; Basic/Standard **Record payment**, **Mark payment failed**, and Create disabled with "Setup payment not received" until paid; all **Reject**.
- `approve-enquiry-dialog.tsx`: editable BU name, code, username (default: email before `@`, numbered if taken), with the existing live uniqueness checks and `constants/timing.ts` debounce.
- `reject-enquiry-dialog.tsx`: reason required; warns "Payment was received — refund outside the system" when paid.
- After approving Basic/Standard: note linking to Subscriptions, "Record the first monthly payment. Until then this customer can only view."
- Entries in `graphql-map.ts`, `sql-map.ts`, `messages.ts`.

**Rules:** payment fields are frozen after approval; the monthly fee never gates approval.

**Done when:** Lite approval creates the BU, schema, seed, `HO` city and a Manager seeing only that BU; Basic/Standard approval is refused by a direct call until paid, creating nothing; after payment the BU starts view-only; a failed user step resumes with one BU and the schema untouched; a failed seed step resumes by rebuilding the schema, still one BU row; two simultaneous clicks provision once; reject works and shows on the status page; another tenant's admin cannot call any of it.

### Step 10 — Super Admin: Enterprise enquiries
**Needs:** Steps 4, 5, 6, 7, and Step 9's shared pieces.

**Where:** server new `resolvers/bu_admin/enterprise_enquiries.py`, `schema.graphql`, `mutation.py`, `query.py`, `sql_signups.py`, `provisioning.py`; client `src/features/super-admin/`.

Every action requires `require_user_type {"S"}`.

**Build — server:**
- Dedicated read queries (control plane): list with status and payment filters; count of `new`.
- `markEnterpriseEnquiryContacted` (`new` → `contacted`); `setEnterpriseEnquiryFee` (while payment pending); `recordEnterpriseEnquiryPayment`, `markEnterpriseEnquiryPaymentFailed` (as Step 9); `rejectEnterpriseEnquiry` (reason; emails the applicant).
- `provisionEnterpriseEnquiry` (id, client code and name, database name, first BU code and name, admin username), claimed and resumable like Step 9, in order:
    1. claim; refuse unless `received`;
    2. client: insert and store `client_id` in one transaction (both in the control plane);
    3. database: skip if the client has a `db_name` and that database has a `security` schema; if it exists without one, drop and recreate;
    4. first BU: as Step 9 parts 3–4; with no stored `bu_id`, look it up by code in the new database (it holds only this BU). Set `plan_code = 'enterprise'`, `billing_required`, `monthly_fee_paise`, `branch_limit` null, `paid_through` empty;
    5. `HO` city and GSTIN; admin user via `resolve_create_admin_user_helper`, store `user_id`;
    6. `converted`; audit; release the claim.
- **Later BUs** (in `resolve_create_bu_schema_and_feed_seed_data_helper`, database not the default one, an existing BU billed): copy `plan_code`, `billing_required`, `paid_through`, `billing_hold`, `branch_limit`, so the client's BUs share dates.
- **5 BUs included, extras ₹3,000/month:** BU 1 carries the Enterprise fee, BUs 2–5 carry 0, each later BU the extra fee; the client's fee is the sum. Creating a 6th or later BU first returns `EXTRA_BU_CONFIRM_REQUIRED` unless a confirm flag is sent (dialog: "This business unit is outside the 5 included in your plan and adds ₹3,000 to your monthly fee. Continue?"); then email `enterprise_enquiry_notify_email` and audit. Deleting an extra BU lowers later fees only. Inactive BUs count. If the client is prepaid beyond today when a 6th or later BU is added, the client's shared `paid_through` is rebased from the old total fee to the new total (constraint 8) for every BU, and the confirm dialog shows the new date ("Your prepaid period will now end on <date>").

**Build — client:**
- `ROUTES.superAdmin.enquiries`, `sidebar.tsx` entry, count in `top-header.tsx` bell.
- Shared grid with Mark contacted, Record payment, Mark failed, **Create customer** (disabled until paid; dialog prefilled with the existing live checks), Reject.

**Done when:** Create customer is refused until paid; success leaves `client_id`, `bu_id`, `user_id`, `converted`; a failure after the database step resumes with no second client or database; a later BU shares plan and `paid_through`; a 6th BU needs confirmation and adds the fee.

### Step 11 — View-only guard (server)
**Needs:** Steps 5, 6.

**Where:** server `auth_guards.py`, `billing.py`, `mutation.py`, `query.py`, `schema.graphql`, `image_router.py`, `website_router.py`, `app/routers/auth/helper.py`, `exceptions.py`.

**Build:**
- `get_bu_billing(db_name, schema)` with a 60-second in-memory cache; `clear_bu_billing(...)`.
- `require_bu_writable(info, db_name, schema)` (new): skips `security`, `public`, empty; on `read_only` raises `SUBSCRIPTION_READ_ONLY` with `paidThrough` in extensions. Applies to `A` too; only `S` is exempt.
- Applied after `require_own_tenant` and `require_bu_access` to: `genericUpdate`, `genericUpdateScript`; every BU-schema mutation from Step 1 (jobs, invoices, payments, inventory import/delete, `accountsPosting`, WhatsApp sends); and `addEwFollowUp`, `resendEwLeadAlert`, `sendEwReminders`, `transitionEwLead`; and `addBranch` once Step 12 adds it.
- Not blocked: login, refresh, password set/reset; all reads, reports, PDFs, prints, exports, subscriptions; the customer admin's `security` work (users, roles, BU edits); provisioning, Super Admin, payment and plan mutations.
- Other writers: media upload/delete blocked; public part orders refused politely; public job-intake/delivery/receipt pages stay readable, writes refused; WhatsApp status callbacks and the monthly stock snapshot keep running.
- Add the billing columns to `GET_USER_BUS` and `GET_ALL_BUS_WITH_SCHEMA_STATUS` (moved here from Step 5; safe now that Your Part D has created them). The login BU list carries the computed status. New query `buBillingStatus(db_name, schema)` → `{status, paidThrough, planCode, branchLimit}`, guarded by tenant and BU access.
- Classification test: two lists (guarded / allowed); fails on any mutation in neither.

**Rules:** access checks run first, so a foreign BU gets "forbidden", not a billing message. View-only never hides or deletes data. Another server process sees a payment within 60 seconds.

**Done when:** with a BU `read_only`, every listed mutation, a media upload and a part order are refused; reads, prints and user management work; other BUs, Lite and existing BUs are unaffected; the classification test passes.

### Step 12 — Branch limit and plan change
**Needs:** Steps 5, 9, 11.

**Where:** server `auth_guards.py`, `mutation.py`, new `resolvers/masters/branches.py`, new `resolvers/bu_admin/billing.py`, `sql_billing.py`, `exceptions.py`, `schema.graphql`, `tests/test_auth_guards.py`; client `src/features/client/components/masters/branch/add-branch-dialog.tsx`, `branch-section.tsx`, `src/constants/graphql-map.ts`.

**Build — limit (server only, no trigger):**
- **`addBranch(db_name, schema, value)`** (new mutation): `value` carries the same fields the add-branch dialog sends today (`code`, `name`, `address_line1`, `address_line2`, `city`, `state_id`, `pincode`, `phone`, `email`, `gstin`). Guards, in order: `require_own_tenant`, `require_bu_access`, `require_bu_writable` (Step 11), `require_access_right` for the branch master right if the branch screen has one (check `ACCESS_RIGHTS`; none today, so none added). Then **one transaction on one connection**:
    1. `LOCK_BU_FOR_BRANCH`: lock this BU's `security.bu` row `FOR UPDATE` (found by the request's `schema`). A second `addBranch` or a `changeBuPlan` on the same BU waits here.
    2. If `branch_limit` is not null, `COUNT_BRANCHES` (inactive included); at or over the limit → `BRANCH_LIMIT_REACHED`, nothing written.
    3. Insert the branch with the existing insert helper (`get_insert_sql` in `psycopg_driver.py`), returning its id; commit (releases the lock).
- **`genericUpdate` refuses branch inserts:** `_refuse_branch_insert(value)` in `resolve_generic_update` walks the payload, including nested `xDetails` dicts and lists. Any `branch` row without an `id` (an insert) → `BRANCH_INSERT_VIA_ADD_BRANCH`, for every user type, `S` included, so there is only one door. Updates (with `id`) and `deletedIds` on `branch` pass as today.
- No other code inserts branches except BU seeding (`seed_bu_data.py`, the `HO` row at BU creation), which runs before the BU has a plan and needs no check.
- Editing any branch, including `HO`, is never blocked.
- **Tests:** `addBranch` refuses a second branch when `branch_limit` is 1 and allows several when null; a `genericUpdate` payload inserting `branch`, top-level or nested, is refused; one updating a branch passes. The Step 1 walk test covers the new resolver's guard.

**Build — plan change:**
- `changeBuPlan` (BU id, new plan; default-database admin only) is the only place plan fields change after approval.
- Upgrade to Standard: `branch_limit` null, new fee.
- Downgrade to Lite or Basic: in one transaction lock the `security.bu` row (`FOR UPDATE`, the same lock `addBranch` takes, so neither can slip between the other's check and write); if branches other than `HO` exist, refuse with `DOWNGRADE_BLOCKED_BRANCHES`, listing each branch and its row counts per table, found from the schema's foreign keys to `branch` (not `CHECK_BRANCH_IN_USE`, which covers only seven tables); otherwise set `branch_limit = 1` and the plan fields. The system never deletes branch data.
- The new fee applies to later payments. If `paid_through` is after today, in the same transaction rebase it (constraint 8: upgrade → earlier, downgrade → later) and add a `fee_rebase` ledger row with both dates and both fees; old payment rows are never changed. The dialog shows the new date before confirming. No moves to or from Enterprise. Clear the cache; audit `CHANGE_BU_PLAN`.

**Build — client:**
- `add-branch-dialog.tsx` calls `GRAPHQL_MAP.addBranch` (new entry) instead of `genericUpdate`, with the same fields; edit and delete dialogs are unchanged.
- Add branch disabled at the limit with "Your plan includes one branch. Upgrade to Standard for more branches"; the same message on a `BRANCH_LIMIT_REACHED` error.
- Change plan on the Subscriptions page shows blocking branches in a dialog.

**Done when:** Lite/Basic cannot get a second branch through the screen, a direct `addBranch` call, two simultaneous `addBranch` calls, or a `genericUpdate` insert (refused for every BU); no trigger exists on any `branch` table; Standard/Enterprise add several; `HO` edits work; existing BUs unaffected; a multi-branch downgrade is refused with the list, then succeeds after cleanup; a downgrade racing an insert never leaves two branches.

### Step 13 — Monthly payments, Super Admin controls, reminders (server)
**Needs:** Steps 5, 6, 11.

**Where:** server `resolvers/bu_admin/billing.py`, `schema.graphql`, `mutation.py`, `query.py`, `sql_billing.py`, `app/scheduler.py`, `exceptions.py`, `audit_log.py`.

**Build — lt (default-database admin):**
- Reads: `GET_BU_SUBSCRIPTIONS` (plan, fee, paid through, hold; status added by the server; "Awaiting first payment" sorted first), `GET_BU_PAYMENTS`.
- `recordBuSubscriptionPayment` (BU id, months 1–60, amount, mode, reference, date, note): BU must be billed; amount ≥ fee × months, with the fee read from the locked BU row, never from the browser (no discount, whatever the count). The browser sends months only; years are converted to months in the dialog. One transaction: lock the BU row, `extend_paid_through`, insert the ledger row (`entry_kind = 'payment'`, stamping the fee), update the BU. Then clear the cache, audit, email the Manager a receipt ("Payment received for <n> months. Paid through <date>"; "<n> years" when a whole number of years).
- A payment is refused with `PREPAID_LIMIT_EXCEEDED` (new) if the new `paid_through` would be more than 60 months after today, so stacked advance payments cannot exceed 5 years ahead.

**Build — ent (Super Admin):**
- Reads: a client's BUs (plan, fee, paid through, status) and ledger from its own database.
- `recordClientSubscriptionPayment` (months 1–60, same rules as above): locks all the client's BU rows; amount ≥ sum of BU fees × months; one ledger row with `bu_id` null; every BU moves to the same date, from the earliest `paid_through`; same 60-month cap.
- `setClientMonthlyFee` (rebases the shared `paid_through` per constraint 8 when prepaid beyond today, with a `fee_rebase` ledger row); `extendClientPaidThrough` (note required); `setClientBillingHold` (note required; immediate).
- `startClientBilling` (client id, monthly fee, paid-through date): puts an existing customer under billing in one transaction (`plan_code = 'enterprise'`, `billing_required`, per-BU fees as Step 10, `branch_limit` null, `paid_through`), so they are never view-only in between.
- All clear the cache and audit: `RECORD_BU_PAYMENT`, `SET_MONTHLY_FEE`, `EXTEND_PAID_THROUGH`, `SET_BILLING_HOLD`, `START_CLIENT_BILLING`, `REBASE_PAID_THROUGH`.

**Build — reminders:**
- A daily job in `app/scheduler.py` at `billing_reminder_hour` IST, walking every active client database like the snapshot job.
- Per billed BU, at most one email a day to its Managers and admins: 5 days before ("payment due on <date>"), on the day ("last paid day is today"), the day after ("now view-only"), and once the day after approval if no first payment.
- Record `last_reminder_on`/`kind`; skip repeats. A Postgres advisory lock lets only one process send (worth adding to the snapshot job too).

**Rules:** only a payment, an extension or releasing a hold lifts view-only. The ledger is never edited.

**Done when:** the next write after a payment succeeds without re-login; two simultaneous payments cover two months; a 3-year payment moves `paid_through` 36 months and sends no reminder until 5 days before; an amount below fee × months is refused; a payment that would put `paid_through` beyond 60 months ahead is refused; an upgrade or fee rise while prepaid moves the date earlier, a downgrade later, each with a `fee_rebase` row; an Enterprise payment moves all BUs; `startClientBilling` leaves the customer `active`; hold, release and extension are audited; each reminder goes once, also with two processes.

### Step 14 — Billing screens (client)
**Needs:** Steps 11, 12, 13.

**Where:** client `src/store/context-slice.ts`, `src/lib/apollo-client.ts`, `src/features/client/components/layout/`, new `src/components/shared/billing/`, `src/features/admin/pages/`, `src/features/super-admin/`, `src/constants/`.

**Build:**
- Billing fields on `BuContextType`; selectors `selectBilling`, `selectIsReadOnly`. Status comes only from the server: `buBillingStatus` on BU change, window focus and after a blocked write (stored BU lists can be stale and the admin list has raw columns only). Never compute it in the browser.
- `billing-banner.tsx` under the top nav: `due_soon` amber "Your payment is due. The app becomes view-only after <date>."; `read_only` error style, "Your subscription payment for this month has not been received. You can view your data but cannot add or change it. Please contact <support>." or, with no payment yet, "Your first monthly payment has not been recorded yet. …"; nothing otherwise.
- In `apollo-client.ts`'s error link, next to `TOKEN_EXPIRED`, handle `SUBSCRIPTION_READ_ONLY` and `BRANCH_LIMIT_REACHED` with `read-only-dialog.tsx` (not a toast) and refresh billing.
- `useIsReadOnly` disables shared add/save/delete controls first, then the "New" buttons on job, inventory, masters and accounts screens (found by searching mutation calls). Tooltip "Read-only: payment pending".
- Admin → **Subscriptions** (`ROUTES.admin.subscriptions`, default database only): BUs with plan, fee, paid through, status chip; **Record payment** (shared dialog), **Payment history**, **Change plan**.
- **Payment period** in the shared `record-subscription-payment-dialog.tsx`: a **Months / Years** toggle and a count (months 1–60, years 1–5), zod-validated; below it a read-only line "₹5,999 × 24 months = ₹1,43,976 · paid through <new date>" recomputed as the count changes. Amount is prefilled with fee × months and cannot be saved lower (no discount); it may be higher, with a note required. The new date shown is a preview only; the server's answer is what is stored. Shows the 5-year cap message when the stacked date would pass it.
- Payment history shows the period as months or years, and `fee_rebase` rows as "Plan/fee changed — paid through moved from <date> to <date>".
- Change plan and the Enterprise extra-BU confirm show the rebased date before saving when the customer is prepaid.
- Super Admin client subscription panel: BUs and status; **Start billing**; record payment (same dialog, client total fee); set fee (shows rebased date); extend; hold/release; history.

**Done when:** Lite and existing BUs show nothing and never block; a new paid BU shows the first-payment banner; amber in the last 5 days, error from the day after; a blocked write shows the dialog; a payment clears the banner without re-login; choosing Years = 2 prefills 24 months' amount and a lower amount keeps Save disabled; `pnpm build` passes.

### Step 15 — Help files (final check)
**Needs:** Steps 1–14.

**Build:**
- `help-content.ts`: branches per plan and the limit message; the view-only banner, what still works, how access returns; for the platform admin, the Enquiries page, the Subscriptions page (recording months or years ahead, no discount, the 5-year cap) and plan changes (why a downgrade can be refused, how prepaid time moves when the fee changes).
- `dev-help-content.ts`, **one new article**: the two enquiry tables; payment columns and constraints; claim and resume (`bu_schema_ready_at`); billing columns, status and date rules (60-month cap, `rebase_paid_through`, ledger `entry_kind`); `require_bu_writable` and its two lists; `addBranch` (the BU-row lock, why `genericUpdate` refuses branch inserts, and that there is deliberately no trigger) and `changeBuPlan`; Step 1 and Step 6 guards and allowlists; new settings (including `portal_url` and how `debug` picks it); who gets which email; the reminder job.
- Re-check stale articles: admin and Super Admin menus, settings list, access-guard and subscription descriptions.
- Portal FAQ and success texts (Step 8).

**Done when:** both help files describe every screen, setting, guard and `sqlId` added above; a grep for the old menu, settings and guard names finds no stale article; `pnpm exec tsc -b --noEmit` passes.

### 🧑 Your Part F — Release
**Needs:** Steps 1–15; Your Parts C, D, E.
1. Restart the server; redeploy the portal, then the client.
2. Submit one enquiry per plan and check where each lands and that both emails (thank-you and approver) arrive.

**Done when:** each enquiry lands in its table and both emails arrive.

### 🧑 Your Part G — Existing paying customers
**Needs:** Your Part F.
1. For each customer to bill: Super Admin client subscription panel → **Start billing** with their monthly fee and current paid-through date. Until you do, they are not restricted.

**Done when:** each billed customer shows `active` on the subscription panel.

### 🧑 Your Part H — Daily routine
**Needs:** Your Part F. Ongoing.
1. Approve or reject Lite requests (Enquiries page).
2. Basic/Standard: record the setup payment, create the BU and Manager, then **record the first monthly payment straight away** (Subscriptions page).
3. Enterprise: the same from the Super Admin side.
4. Record each monthly payment as it arrives; an unpaid month turns view-only the next day. A customer paying ahead for several months or years is recorded once, choosing **Months** or **Years** in the payment dialog; the amount must be at least fee × months.

**Done when:** ongoing; no enquiry is left pending and no paying customer is view-only by mistake.

## Files touched

- **Server:** `app/config.py`, `app/core/settings/`; `app/routers/auth/auth_schema.py`, `helper.py`; new `app/services/default_customer.py`, `app/core/plan_prices.py`, `app/core/billing.py`; `auth_guards.py`, `mutation.py`, `query.py`, `shared/generic_query.py`; new `app/db/sql/sql_signups.py`, `sql_billing.py`; `sql_base.py`, `sql_bu_admin.py`, `sql_bu_admin_ddl.py`; `provisioning.py`, `users_roles.py`; new `resolvers/bu_admin/signups.py`, `enterprise_enquiries.py`, `billing.py`; `app/graphql/schema.py`, `schema.graphql`, `resolvers/subscription.py`, `pubsub.py`, `app/whatsapp/sender.py`, `whatsapp_webhook_router.py`, `resolvers/sales_accounts/mutations.py`; `image_router.py`; `website_router.py`, `sql_public.py`; `app/scheduler.py`; `exceptions.py`, `audit_log.py`; `schema_dumps/`; tests.
- **Client:** `auth-service.ts`, `auth-slice.ts`; BU create/edit dialogs; admin layout, enquiries and subscriptions pages, approve/reject dialogs; shared enquiries grid, payment dialog and chip; Super Admin enquiries page, `sidebar.tsx`, `top-header.tsx`, subscription panel; `context-slice.ts`, `apollo-client.ts`, billing banner, read-only dialog, `use-is-read-only.ts`; branch master (`add-branch-dialog.tsx` → `addBranch`); `routes.ts`, `router/index.tsx`, `graphql-map.ts`, `sql-map.ts`, `messages.ts`; generated types; both help files.
- **Portal:** as listed in Step 8 (branch-limit files already done).

## Testing (end to end)

Each step has its own checks; once everything is built, run these flows:
1. **One enquiry per plan:** lands only in its table; thank-you and approver emails arrive; Lite alone shows the dialog; a mail failure does not fail the submit; the admin bell updates live; another tenant's admin sees no bell or menu.
2. **Lite:** approve → BU, schema, `HO` city, Manager on that BU only; login shows only that BU.
3. **Basic/Standard:** approval refused until the setup payment; then approve, see the first-payment banner, record the first month, banner gone, writes work.
4. **Enterprise:** setup payment → create customer → admin logs in view-only → first payment → full access; a later BU shares the dates; a 6th BU asks for confirmation.
5. **Failures:** a failed user step and a failed seed step both resume with one BU; two clicks provision once.
6. **Security:** re-run the Step 1 and Step 6 checks as a business user of another BU, including the `RESET_ADMIN_PASSWORD` and `GET_BUSINESS_USERS` attempts.
7. **Billing dates:** `due_soon` in the last 5 days, `read_only` the day after; a payment lifts it without re-login; an advance payment stacks, a late one starts from that day; a 2-year payment for Basic, Standard and an Enterprise client each move the date 24 months at the full fee; an upgrade while prepaid shortens the period, a downgrade lengthens it.
8. **Branches:** Lite/Basic cannot add a second branch through the app (screen, `addBranch`, `genericUpdate`, two at once); downgrade blocked then allowed after cleanup.
9. **Regression:** normal client, admin and Super Admin flows; WhatsApp status updates; the stock snapshot still runs for read-only BUs.
10. `pnpm exec tsc -b --noEmit` in the client (lint is broken) and `pnpm build` in the portal.

## Flags

**Watch out for:**
- Steps 1 and 6 change behaviour for every tenant; Your Parts C and E are release gates.
- Events and the billing cache are per server process; with several processes, events reach only that process and payments show elsewhere within 60 seconds.
- Status uses the IST date; a user working across midnight can be cut off mid-session (the dialog explains).
- Refunds, rejections after payment, and GST invoices for the setup fee are handled outside the system.
- With no trigger, the branch limit binds only what goes through the server. A branch inserted by hand in SQL (e.g. a support fix) is not counted against the limit until the next `addBranch`, so do such fixes knowingly.
- Pre-existing, found while building Step 2: the REST routes have no exception handler for `ServicePlusException`, so a wrong login password answers HTTP 500 with a stack trace instead of 401. Worth a small separate fix (one FastAPI exception handler in `main.py`).
- The audit log is one store for every tenant and `auditLogs` has no tenant filter: a tenant admin can see other tenants' audit entries. It matters more once lt customers share a database's admin. Fix separately by recording `db_name` on each entry and filtering by the caller's tenant for `A` (found while building Step 1).
- Later, separately: a rule for long-unpaid customers (e.g. suspend login after N months); user and job-count plan limits (`plans/plan-claude.md`).

**Open questions:** none.
