# Plan — Lite self-signup with admin approval (shared default customer database)

Source: `plans/prompt.md`. Design only; nothing is implemented yet.

## Goal

A service centre picks **Lite** on the portal, fills the enquiry form, clicks **Confirm**, and sees "pending approval".
- The **admin (userType `A`) of the default customer database** gets a notification.
- **One click** creates a business unit (BU) for that service centre and a business user assigned to it as **Manager**. The user is emailed their login.
- A user sees only the BUs they are assigned to. Server-side loopholes that would let one customer in the shared database reach another's data are closed.
- The server gets settings for the default customer database and its credentials, in `.env`.

Basic, Standard and Enterprise keep today's enquiry flow. No card details are collected. **All plans get unlimited branches**; users add and edit their own branches.

## Present context and current design

- **Portal:** every plan uses `SalesEnquiryForm`, which calls `POST /api/public/sales-enquiry`.
- **Server** (`website_router.py`, `submit_sales_enquiry`): writes `service_plus_client.public.sales_enquiry` (`status`: `new | contacted | converted | rejected`) and emails the team. Nothing reads these rows back.
- **Admin mode** (`/admin/*`) already creates BUs and business users:
    - `create-business-unit-dialog.tsx` → `resolve_create_bu_schema_and_feed_seed_data_helper`;
    - `create-business-user-dialog.tsx` → `resolve_create_business_user_helper` with `bu_ids` + `role_id`.
- **Creating a BU seeds a head-office branch** (`SeedBuData.BU_SEED_SQL`): `code 'HO'`, `'Head Office'`, placeholder address `'123 Main St'`, `state_id 29`, `'700001'`, `is_head_office = true`, plus document sequences for it. No branch input is needed.
- **Connections:** every tenant database is reached with one shared credential pair (`settings.service_db_user` / `service_db_password`), in `psycopg_driver.get_service_db_connection` and `pool_manager.get_service_pool`. The control-plane database uses `client_db_*`.
- **Guards** (`app/graphql/resolvers/auth_guards.py`):
    - `require_own_tenant` — the `db_name` sent must equal the token's; only super-admin (`S`) is exempt;
    - `require_bu_access` — the `schema` sent must be in the token's `bu_codes` (built at login and refresh from `user_bu_role`); `A`/`S` bypass. It **lets `security`, `public` and empty schemas through** for everyone.
- **Admin layout** has no notification bell. The shared `NotificationBell` exists.

## Key constraints of the present design

### 1. Sign-up requests can't live only in `sales_enquiry`
`sales_enquiry` is in the **control-plane database** (`service_plus_client`), not in any tenant database.
- A tenant admin's calls are pinned to their own tenant database: `require_own_tenant` rejects any `db_name` other than the token's, and only a super-admin may pass `db_name = null`, which is what reaches the control-plane database.
- So nothing the tenant admin's screens call through `genericQuery` can read `sales_enquiry`, and giving them access would open the whole tenant registry to every tenant admin.
- **Resolution:** the Lite request is also written to a new table, **`security.signup_request`, inside the default customer database**, where that admin already has full access through the normal `db_name`. `sales_enquiry` stays the lead log for every plan. Approval and rejection update its `status` on the server side (`converted` / `rejected`), so the lead log stays accurate without the admin ever touching the control-plane database.

### 2. BU name rule rejects real business names
- The server (`provisioning.py`) requires `^[a-zA-Z0-9 ]{3,}$`, and so do the client's `create-business-unit-dialog.tsx` and `edit-business-unit-dialog.tsx`. So "Nav Technology Pvt Ltd." fails.
- The BU **name** is display text only. The **code** is what becomes the schema name.
- **Resolution:** widen the name rule in all three places to `^[A-Za-z0-9][A-Za-z0-9 .&'()/,-]{2,99}$`: starts with a letter or digit, 3–100 characters, and allows `. & ' ( ) / , -`.
- The code rule stays `^[a-z0-9_]{3,30}$`, and the code is derived from the name (D below).
- The portal's `business_name` field uses the same widened rule, so an accepted sign-up can always become a BU.

### 3. No branch details needed
BU creation already seeds the `HO` head-office branch, and all plans allow unlimited branches that users manage themselves. The sign-up form collects **no address fields**. After seeding, approval only sets `HO`'s `city` (and `gstin` if given) from the form. The user replaces the placeholder address in the branch master.
- **The Manager role must include the right to maintain branches** (see Flags).

### 4. Approval can't be one database transaction
- Creating a BU runs DDL: `CREATE SCHEMA`, then the whole BU table DDL, then seed data. Each runs as its own `exec_sql` call on its own connection.
- Creating the user is a separate call again, which also sends an email.
- If the user step fails (a duplicate username, a mail error, a lost connection), the schema and BU row already exist and can't be rolled back with the user insert. Clicking again would then fail on "BU code exists", leaving a half-provisioned customer.
- **Resolution:** approval is **resumable**. After each step the server records its result on the `signup_request` row (`bu_id`, then `user_id`). A retry skips any step whose id is already recorded. For the BU step it reuses the helper's existing "schema repair" path (it accepts `id` and skips the insert).
- The row is locked `FOR UPDATE` for the whole approval, so two clicks can't provision twice.

### 5. Shared-database isolation has server-side holes
Business-unit data is already isolated: `require_bu_access` blocks a BU schema the user isn't assigned to, and `bu_codes` is rebuilt on every token refresh. But in a database shared by many customers these paths leak:
- **a. `genericUpdate` / `genericUpdateScript` on `schema: "security"`.** `require_bu_access` passes `security`, and `_require_generic_update_table_right` checks only tables listed in `GENERIC_UPDATE_TABLE_RIGHTS`. `user`, `user_bu_role`, `bu` and `role` aren't listed. So any business user can update `security.user` (e.g. set `is_admin = true` on themselves) or insert `user_bu_role` rows that give them another customer's BU. **This is a privilege escalation today, even outside Lite.**
- **b. `genericQuery` / `genericBatchQuery` on `schema: "security"`.** Any `sqlId` in `SqlStore` can run there, including user lists, BU lists and admin queries. They expose every customer's users, emails and mobile numbers in the shared database, plus the new `signup_request` rows.
- **c. `genericSubscription(db_name)` and the other subscriptions.** They go over the separate `graphql-ws` link, which the client's error/auth links don't cover. They filter only by `db_name`, so events for one BU (WhatsApp delivery status, posting progress) reach every connected user of the shared database.
- **d. Media/file paths** are organised by `client_code`, and all Lite customers share one client. Upload and read paths must include and check the BU.
- **e. Public endpoints** (`/api/public/companies` etc.) list BUs across active clients, so every Lite BU would appear in service-plus-web's company dropdown. Decide whether that's wanted (see Flags).

## New design

### A. Server settings — default customer database and credentials
- New fields in `app/config.py`, filled from the server `.env`:
    - `DEFAULT_CUSTOMER_DB_NAME` — the tenant database that holds Lite (and later Basic/Standard) customers as one BU each;
    - `DEFAULT_CUSTOMER_DB_USER`, `DEFAULT_CUSTOMER_DB_PASSWORD` — optional; they fall back to `service_db_user` / `service_db_password` when empty.
- `get_service_db_connection` and `pool_manager.get_service_pool` choose credentials by `db_name`: the default-customer pair for that database, the shared pair for all others.
- A `client` row with `db_name = DEFAULT_CUSTOMER_DB_NAME` must exist with an admin user. Lite users pick that client at login.
- A new helper, `get_default_customer_client()`, returns `{client_id, db_name}` or raises `AppMessages.DEFAULT_DB_NOT_CONFIGURED`.
- Login and refresh return `isDefaultCustomerDb`, true when the user's database is the default one. The client uses it to show the sign-up UI only there.

### B. New table `security.signup_request` (default customer database only)
- **Columns:**
    - `id`, `enquiry_id` (the `sales_enquiry` id)
    - contact details: `name`, `business_name`, `mobile`, `email`, `city`, `gstin`
    - proposed BU: `bu_name`, `bu_code`
    - `status` (`pending | approved | rejected`), `rejection_reason`
    - approval progress: `bu_id`, `user_id`
    - `reviewed_by`, `reviewed_at`, `created_at`
- Add unique partial indexes on `lower(email)` and on `mobile` where `status in ('pending','approved')`.
- Created with `CREATE TABLE IF NOT EXISTS` as `SqlStore.SIGNUP_REQUEST_DDL` (Your Part: run it once on the default database).

### C. Portal
- The Lite form has the same fields as today (no address), and the business name follows the widened BU name rule.
- The Lite submit reads **"Confirm Lite signup"** and opens a confirm dialog. Confirming calls `POST /api/public/lite-signup`.
- The success screen says **"Your request is pending approval"**, gives a reference number, and says an email will follow.
- A new `/signup-status` page takes mobile + email and shows **pending / approved (with a login link and the client to pick) / not approved (with the reason)**.

### D. Server — sign-up endpoints
- **`POST /api/public/lite-signup`** (`require_website_key` + `rate_limit`):
    - Validates the enquiry fields.
    - Refuses if a pending or approved request exists for the mobile or email, or if the email is already a `security.user` in the default database.
    - Derives `bu_name` (the trimmed business name) and `bu_code`: lower-case it, turn each run of non-alphanumerics into `_`, trim `_`, cut to 26 characters, and add `_2`, `_3`, … while it clashes with `security.bu.code` or `pg_namespace`.
    - Inserts `sales_enquiry` (lead log) and `signup_request` (`pending`), then publishes the pending count to the admins' channel (E).
    - Emails the applicant ("pending approval") and the team.
- **`POST /api/public/lite-signup/status`** returns only the status, the reason and a login hint.

### E. Admin — notification and one-click approval
- **Bell:** add `NotificationBell` to the `admin-layout.tsx` top bar, shown only when `isDefaultCustomerDb`. Its one item is "Lite sign-ups awaiting approval" (count), loaded on mount and refreshed live from a subscription event that only admins receive (see F.3).
- **Sign-ups page:** Admin → **Sign-ups** (`ROUTES.admin.signups`), with a sidebar item only when `isDefaultCustomerDb`. It is a grid of requests (default filter: pending).
- **One click:** each pending row has an **"Create BU & Manager"** button.
    - A confirm dialog shows what will be created: BU name, BU code, username (the email's local part, with a suffix if taken), email and role Manager.
    - One click calls `approveSignupRequest`. It is admin-only (`require_user_type {"A"}` + `require_own_tenant` + the database must be the default one).
    - The server runs these steps with progress saved on the row:
        1. Create the BU, its schema and seed data by reusing `resolve_create_bu_schema_and_feed_seed_data_helper`, passing `id` on a retry. Store `bu_id`.
        2. Set the seeded `HO` branch's `city` / `gstin` from the request.
        3. Create a business user with `is_admin = false`, `bu_ids = [bu_id]`, role `MANAGER`, by reusing `resolve_create_business_user_helper`. Store `user_id`. The credentials email also names the client to pick at login.
        4. Mark the request `approved`, set `sales_enquiry.status = 'converted'`, and write an audit-log entry.
- **Reject:** a dialog with the reason required. `rejectSignupRequest` sets the status and reason, updates `sales_enquiry`, and emails the applicant.
- The admin can still use the existing BU and user dialogs to change assignments later. A user sees exactly the BUs in their `user_bu_role`.

### F. Server security fixes (apply to every tenant database, not just the default one)
1. **Deny-by-default for tenant-wide schemas.** In `require_bu_access`, a non-admin caller (not `A`/`S`) sending `security` or `public` is **rejected**, unless the operation is on an explicit allowlist:
    - for queries, `NON_ADMIN_SECURITY_SQL_IDS` — the handful the client app needs, such as the caller's own profile and their own BU list;
    - for updates, `NON_ADMIN_SECURITY_TABLES` — expected to be empty.

   Allowlisted queries must filter by the token's `user_id` / `bu_codes`, never by a caller-supplied id.
2. **Protect security tables in `genericUpdate`.** Add `user`, `user_bu_role`, `bu`, `role`, `role_access_right`, `access_right` and `signup_request` as **admin-only** tables, via a `require_user_type {"A","S"}` check before `_require_generic_update_table_right`. Reject `genericUpdateScript` sql_ids that touch security tables unless the caller is an admin.
3. **Authenticate and scope subscriptions.**
    - Verify the JWT in the `graphql-ws` `connection_init` payload (the client already has the token) and put `user_type`, `db_name` and `bu_codes` into the subscription context.
    - Each subscription checks `db_name` against the token, and events carry a `bu_code` that is delivered only to users with that code (admins get everything in their database).
    - The sign-up count event is admin-only.
4. **Media paths.** The file-server upload and read routes include the BU code in the path and check it against the caller's `bu_codes`.
5. **Regression sweep.** Grep every resolver using `schema` for places that skip `require_bu_access` (custom resolvers outside the generic four), and add the guard.

## Steps

- Step 1 — Settings + credential routing + `isDefaultCustomerDb` (A).
- Step 2 — Widen the BU name rule on the server and in both client dialogs (constraint 2).
- Step 3 — `signup_request` DDL + SQL ids (B).
- Step 4 — Sign-up endpoints and BU code derivation (D).
- Step 5 — Approve/reject resolvers + `SQL_MAP` ids (E).
- Step 6 — Admin UI: bell, Sign-ups page, confirm and reject dialogs, route + sidebar (E).
- Step 7 — Portal: confirm flow, pending screen, `/signup-status` (C).
- Step 8 — Security fixes F.1–F.5, with a before/after test for each hole.
- Step 9 — Both help files + the portal article.
- Step 10 — **Your Part:**
    - Add `DEFAULT_CUSTOMER_DB_NAME` (and optionally `_USER` / `_PASSWORD`) to the server `.env`.
    - Create that database, its `client` row and an admin from Super-admin → Clients, and seed its roles.
    - Run the Step 3 DDL on it.
    - Restart the server and redeploy the portal and the client.
    - Decide the flags below.

## Files touched

**service-plus-server**
- `app/config.py` — the three settings
- `app/db/connection/psycopg_driver.py`, `pool_manager.py` — per-database credentials
- `app/routers/auth/auth_schema.py`, `helper.py` — `isDefaultCustomerDb`
- `app/routers/public/website_router.py`, `app/db/sql/sql_public.py` — sign-up endpoints
- New `app/db/sql/sql_signups.py` (added to `SqlStore`) — DDL, list, count, progress SQL
- New `app/graphql/resolvers/bu_admin/signups.py`; `schema.graphql`, `mutation.py`, `query.py`
- `app/graphql/resolvers/bu_admin/provisioning.py` — widened name rule
- `app/graphql/resolvers/auth_guards.py`, `mutation.py` — F.1 / F.2
- `app/graphql/schema.py`, `resolvers/subscription.py`, `pubsub.py`, publishers in `whatsapp/`, `sales_accounts/` — F.3
- `app/routers/media/image_router.py` (+ file server) — F.4
- `app/core/exceptions.py` — messages and email templates

**service-plus-client**
- `src/lib/apollo-client.ts` — send the token in `graphql-ws` `connectionParams`
- `src/features/auth/...` — store `isDefaultCustomerDb`
- `src/features/admin/components/create-business-unit-dialog.tsx`, `edit-business-unit-dialog.tsx` — name rule
- `src/features/admin/components/admin-layout.tsx` — bell + sidebar item
- New `src/features/admin/pages/signups-page.tsx`, `components/approve-signup-dialog.tsx`, `components/reject-signup-dialog.tsx`
- `src/router/routes.ts`, `src/router/index.tsx`, `src/constants/graphql-map.ts`, `sql-map.ts`, `messages.ts`
- `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`

**service-plus-portal**
- `components/pricing/sales-enquiry-form.tsx` (name rule, Lite confirm), `enquiry-success.tsx`, new `lite-confirm-dialog.tsx`
- New `app/signup-status/page.tsx`, `components/signup/signup-status-form.tsx`
- `lib/api.ts`, `constants/messages.ts`, `app/sitemap.ts`

## Testing

1. **Name rule:** "Nav Technology Pvt Ltd." is accepted as a BU name in the portal, the admin create/edit dialogs and the server; its code is `nav_technology_pvt_ltd`. "..." and names under 3 characters are rejected.
2. **Sign-up:** the pending screen and email appear; duplicate mobile/email is refused; the admin's bell increments live; an admin of another tenant database sees no bell item or menu.
3. **One click:** it creates the BU schema with seed data and `HO` (city set), and a non-admin Manager user on that BU only. The email names the client. After login only that BU is visible. `sales_enquiry` shows `converted`.
4. **Resume:** make the user step fail, fix the cause, click again. There is no second BU. Two quick clicks provision once.
5. **Reject:** the status, reason and email are right, and `/signup-status` shows them.
6. **Security holes** — each test should fail before F and pass after it:
    - as a business user, `genericUpdate` on `security.user` (`is_admin`) and on `user_bu_role` → forbidden;
    - `genericQuery` with `schema: "security"` and an admin-only `sqlId` → forbidden;
    - `genericQuery` with another customer's BU code as the schema → forbidden;
    - a WebSocket without a token → rejected; with user A's token → no events from BU B;
    - a media URL for BU B requested by a user of BU A → forbidden.
7. **Credentials:** with `DEFAULT_CUSTOMER_DB_USER` set, the default database connects with it and the others still use the shared pair. With the name unset, approval fails with the configured message.
8. **Regression:** the normal client, admin and super-admin flows still work (login, job intake, masters, reports, admin BU/user screens, WhatsApp status updates).
9. `pnpm lint` + `pnpm build` in the client and portal.

## Flags and constraints

- **Manager rights.** The Lite user is `MANAGER`. Check that its seeded rights include branch maintenance (Configurations/Masters) and everything a one-person shop needs. If not, extend the seed, which follows the four-place access-right rule; existing tenants need the seed-roles dialog re-run.
- **Security fixes F.1–F.2 change behaviour for every tenant.** Any client screen where a non-admin currently reads the `security` schema must be put on the allowlist, or it breaks. The sweep in Step 8 has to find them all before release.
- **Public company list (5e).** Lite BUs will appear in service-plus-web's company dropdown. Decide whether to show them, or add an `is_public` flag on the BU.
- **Login client picker.** Lite users choose the default database's client at login. Name it like a product (e.g. "Service+ Cloud").
- **Separate credentials don't isolate customers** inside the default database. Isolation there comes entirely from F. They only separate the default database from other tenants at the Postgres level.
- **Plan limits** (users, jobs/month) are not enforced; see `plans/plan-claude.md`.
- **Portal form rule deviation** (validate on blur, submit not locked) from the last portal round still applies. Decide it before extending the form.
