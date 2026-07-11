# Access Control: Current State & Implementation Plan

## Status as of 2026-07-11

**All 17 steps have now been implemented or explicitly resolved as-designed,
except for three access-right codes that hit a genuine architectural
blocker on the server side (see the "Step 10 blocker" note further down).**
Summary: Steps 1-3 (seeding), 4-9 (JWT/context/guard infrastructure), 11-16
(client-side gating + docs) are done. Step 10 is done for
`JOBS_ACCOUNTS_POSTING`/`MASTERS_MENU`/`CONFIG_MENU` only — `JOBS_RECEIPTS`,
`JOBS_OPENING_JOBS`, and `ADMIN_MENU` have client-side disabling (Step 14)
but no matching server-side enforcement yet, because the resolvers they'd
guard are shared with explicitly-unrestricted flows (see below). Step 17 is
a documentation-only item and is satisfied by the blocker writeup itself.
Details on the seeding-mechanism change and earlier findings follow:

- **Mechanism change**: `service-plus-client/src/features/super-admin/constants/seed-data.ts`
  (the file Steps 1-2 were supposed to edit) **no longer exists** — the
  client-side `SEED_BATCHES` approach for security-schema data was retired.
  Seeding is now **server-side**: `service-plus-server/app/db/seed_security_data.py`
  (`SeedSecurityData.SECURITY_SEED_SQL`) contains the 6 `access_right` rows
  and the `role_access_right` mapping, matching this plan's catalog and
  mapping tables exactly. It runs automatically when a new client schema is
  created (`mutation_helper.py:496-503`) and on-demand via a new
  `seedSecurityData` GraphQL mutation, wired to
  `src/features/super-admin/components/seed-roles-dialog.tsx`.
- **New gap found**: that dialog's re-seed gate,
  `SQL_MAP.CHECK_ROLE_SEED_EXISTS` (`sql_store.py:1826-1830`), only checks
  `SELECT 1 FROM security.role LIMIT 1`. Any tenant that already had roles
  seeded *before* this access-control work landed will see "already exists"
  with no Apply button offered — so **already-provisioned tenants have no UI
  path to backfill the new `access_right`/`role_access_right` rows** (Step 3's
  intent is not actually met for pre-existing tenants). Only brand-new
  tenants get the full seed automatically. Needs a real fix: either check for
  `access_right` rows specifically, or always show Apply and rely on the
  seed SQL's `ON CONFLICT DO NOTHING` idempotency.
- **Folder rename**: pages this plan calls out under `super-admin/` for
  Business-Admin-scoped CRUD — `business-units-page.tsx`,
  `business-users-page.tsx`, `roles-page.tsx`, `associate-bu-role-dialog.tsx`
  — now live under `src/features/admin/...`. `src/features/super-admin/`
  was repurposed for the true platform-level super-admin tier (clients,
  admin-user management, `seed-roles-dialog.tsx`). All paths below have been
  updated to match.
- **Stale line number fixed**: `GET_USER_BY_IDENTITY` in `sql_store.py` is at
  **line 2910**, not 3022 (the query itself, including the `access_rights`
  aggregation, is unchanged).
- Steps 4-16 — server-side auth context (`context_value`, `role_code`/
  `access_rights` on the JWT), the `require_access_right` guard, and all
  client-side wiring (`access-rights.ts`, explorer-panel/top-nav disabling,
  role badge short names, help-content updates) — **remain entirely
  unimplemented**, exactly as originally scoped. Gaps #1-#3 in the section
  below are all still live.

## Context

The app currently has almost no real authorization: every button and menu
item is shown to any Business User who can reach a page, distinguished only
by the coarse `userType` (A/B/S) and `sessionMode` (admin/client). The goal
is a genuine, role-based access-right system in **Client Mode**
(Jobs/Masters/Configurations/Admin tabs — see Decision below for exactly
which parts), driven by the already-existing but unused `access_right` /
`role_access_right` DB schema, assigned to the three existing system roles
(`MANAGER`, `TECHNICIAN`, `RECEPTIONIST`). The concrete business rules come
from `plans/tran.md`.

This document is self-contained: it folds in the original assessment (also
kept separately at `plans/plan-access-right.md`), an initial exploration of
the whole app's actionable buttons/menus (kept below for reference — Admin
Mode's own CRUD screens turned out to be out of scope, see Decision), and
replaces the earlier, broader first-cut catalog with the final design below.

## Current state (verified against the live codebase)

**One-line summary:** a complete RBAC **schema** exists and login already
computes each user's access-right codes, but real enforcement today is only
authentication + coarse `userType`/`sessionMode` gating in the client UI.
The granular `access_rights` are computed and shipped to the client but
never checked anywhere, and **the GraphQL API itself is unauthenticated on
the server** — the most significant gap.

### Data model (tenant `security` schema)

- **`user`** — `username`, `email`, `password_hash`, `is_active`, `is_admin`.
- **`bu`** — business units.
- **`role`** — `code`, `name`, `is_system`. Seeded: `MANAGER` ("Manage
  orders, customers, reports"), `TECHNICIAN` ("Manage service orders and
  update status"), `RECEPTIONIST` ("Create orders, view customers") —
  `service-plus-server/app/db/seed_security_data.py`
  (`SeedSecurityData.SECURITY_SEED_SQL`).
- **`access_right`** — `code`, `name`, `module`, `description`. **Seeded** —
  the 6 rows from the catalog below are now in `seed_security_data.py:25-33`.
- **`role_access_right`** — role ↔ access_right (M:N). **Seeded** — mapping
  in `seed_security_data.py:38-41` matches the Role → rights table below
  exactly (MANAGER gets all 6, RECEPTIONIST gets 4, TECHNICIAN gets 0 rows).
- **`user_bu_role`** — user gets one role per business unit (`is_active`
  flag). Assigned via `src/features/admin/components/associate-bu-role-dialog.tsx`,
  uniformly across all selected BUs (schema supports per-BU roles; the UI
  doesn't use that yet — out of scope here, see below).

`src/features/admin/pages/roles-page.tsx` explicitly states "Roles are
system-defined and cannot be added, edited, or deleted" — there is
**no dynamic permissions-editor UI** anywhere in the app today, and this
plan does not add one (see Decision below).

*(Note: the Business-Admin-scoped pages above — `business-units-page.tsx`,
`business-users-page.tsx`, `roles-page.tsx`, `associate-bu-role-dialog.tsx`
— moved from `src/features/super-admin/...` to `src/features/admin/...` in
a folder rename since this plan was first drafted. `src/features/super-admin/`
now holds only the true platform-level super-admin tier, e.g.
`seed-roles-dialog.tsx`.)*

### Authentication (implemented and enforced)

- Login (`POST /api/auth/login` →
  `service-plus-server/app/routers/auth_router_helper.py::login_helper`)
  looks up the user via `SqlStore.GET_USER_BY_IDENTITY`
  (`app/db/sql_store.py:2910`), which **already aggregates** the user's
  granular right codes across `user_bu_role → role → role_access_right →
  access_right` into `access_rights: string[]` — this already works
  end-to-end once the two tables are populated, no query change needed for
  that part.
- Issues a JWT (`token_claims` at `auth_router_helper.py:150`) with `sub`,
  `user_type`, `client_id`, `db_name` — no `role_code`, no `access_rights`
  on it yet.
- Client stores the login response (incl. `accessRights`, already typed in
  `src/lib/auth-service.ts`) in Redux via `auth-slice.ts`, persisted through
  `src/lib/auth-storage.ts`.
- `src/lib/apollo-client.ts` attaches `Authorization: Bearer <token>` to
  every GraphQL call — but nothing on the server checks it for GraphQL
  (only `image_router` enforces auth via `Depends(get_current_user)` today).

### Gaps

1. **GraphQL is unauthenticated server-side** — no `context_value` exists
   anywhere in `app/graphql/schema.py::create_graphql_app`. Any caller who
   can reach `/graphql` can run queries/mutations with no token. Client-side
   button hiding is cosmetic until this closes.
2. **`access_rights` are computed and shipped but never read** by any
   client code or server resolver.
3. **The generic table-writer mutations (`genericUpdate`,
   `genericUpdateScript`, `genericQuery` — `app/graphql/resolvers/mutation.py`
   / `query.py`) can write to *any* table by name** (`tableName` + `xData`,
   no per-table check) — this is how most of Admin Mode's CRUD actually
   works today, and it's the widest hole once auth is added elsewhere (flagged
   as a follow-up in Step 14, not blocking this rollout).

### Survey — every actionable button/menu item found

**Admin Mode** (kept for reference only — out of scope per Decision below;
this area is `userType === 'A'`-only and faces no role-based restrictions).
Pages below now live under `src/features/admin/pages/` (moved from
`super-admin/` in a folder rename — see Status section):

| Page | Actions |
|---|---|
| `business-units-page.tsx` | Add Business Unit, Create Schema & Seed Data, Add Seed Data, Edit, Deactivate/Activate, Delete, Orphaned Schemas |
| `business-users-page.tsx` | Add Business User, Edit, Associate BU / Role, Reset password and mail, Deactivate/Activate |
| `roles-page.tsx` | none (already fully view-only) |

**Client Mode** (full detail in the survey below the table; grouped by area):

| Area | Representative actions | Existing gating found |
|---|---|---|
| Jobs (single/batch/opening job, parts-used, receipts, final-a-job, job-control, undo-transaction, accounts-posting) | Add/Edit/Delete job records, Finalize/Undo-Final, Deliver/Undo-Delivery, Post to TracePlus | Purely data-state (`is_final`, `invoice_is_posted`, `transaction_count`) — no permission checks |
| Inventory (purchase/sales entry, stock adjustment, branch transfer, loan entry, opening stock, set part location, stock snapshot) | New/Save/Edit/Delete entries, Set Location, Take Snapshot | Form-validity disables only |
| Masters (brand/product/model/parts/customer/technician/vendor/branch/state/financial-year, lookups, additional charges) | Add/Edit/Delete/Activate/Deactivate | Precondition disables (e.g. `!selectedBrand`), one stray `isAdmin` check in `lookup-section.tsx` |
| Configurations (divisions, app settings, document/numbering sequences) | Add/Edit/Delete/Activate/Deactivate, edit setting | Data-flag disables (`is_editable`) |
| Reports (~29 report sections via `report-toolbar.tsx`) | Export Excel, Export PDF, Print | **Completely ungated** |
| Admin → Post/Unpost | Bulk-post pending job/purchase/sales invoices & receipts | `disabled` only on empty selection |

**Conclusion from the survey:** virtually everything gated today is
data-state driven, not permission-based. No `useAuth`/`usePermission` hook
exists anywhere in Client Mode. This is being introduced from scratch and
layered **alongside** existing data-state disables, not replacing them.

## Decision

Business rules below are final, as specified directly by the user
(`plans/tran.md`) — this supersedes the earlier first-cut 11-code catalog
and mapping that were drafted before those rules existed.

- Gate on the granular `access_right` model (not a binary Manager/non-Manager
  check).
- **Universal mechanism: disabled + tooltip, never hide/show.** Every
  gated menu/button always renders; when the current role lacks the right,
  it's visually disabled with an explanatory tooltip. This replaces the
  earlier open question about hiding zero-right nav items — resolved,
  no hiding.
- **One explicit, pre-existing exception**: the "Switch to Admin Mode" icon
  in `client-activity-bar.tsx` (`isAdmin = user?.userType === 'A'`) is
  conditionally *rendered*, not disabled — this is existing, unrelated
  behavior (gated by `userType`, not by the new role rights) and stays as-is.
- **`userType === 'A'` (Business Admin) bypasses every restriction below,
  everywhere — "no restrictions on Admin."** Same tier as the existing
  super-admin (`'S'`) bypass. A Business Admin who also happens to hold a
  Client-Mode role (Manager/Technician/Receptionist) is never limited by it.
- **Admin Mode itself (`/admin/*` — Business Units, Business Users, Roles
  pages) is out of scope for role-based gating.** It's reachable only via
  the Admin icon, only by `userType === 'A'`, and per the rule above such
  users face no restrictions there either. The `ADMIN_BU_MANAGE` /
  `ADMIN_USER_MANAGE` rights considered in an earlier draft of this plan are
  dropped — not needed.
- **Inventory and Reports are not role-gated at all.** Not mentioned as
  restricted for any role in the source rules below — every role (Manager,
  Technician, Receptionist) gets full access. No access-right code needed
  for either area.
- **Rights are system-defined and seeded, like roles already are** —
  no admin-editable permissions UI in this pass, matching the existing
  "Roles are system-defined" philosophy in `roles-page.tsx`.
- **Short role display names** — Man / Tech / Rec — for the
  space-constrained role badge in `client-top-nav.tsx` (currently
  `{user?.roleName ?? ...}` at the `text-[9px] ... tracking-widest` badge,
  line ~109). The full name stays everywhere else, including the account
  dropdown already built in `client-activity-bar.tsx`.

### Access-right catalog (6 codes — final, per `plans/tran.md`)

Only Jobs, Masters, Configurations, and the Client-Mode "Admin" (Post/Unpost)
tab are gated. Reports and Inventory need no code (see above). Most of Jobs
needs no code either — only three specific sub-items are ever restricted;
the rest of Jobs (Single Job, Batch Jobs, Job Control, Job Pipeline, Final a
Job, Deliver Job, Part Used (Job)) is open to all three roles unconditionally.

| Code | Gates |
|---|---|
| `JOBS_RECEIPTS` | Jobs → "Receipts" (`client-explorer-panel.tsx:137`) |
| `JOBS_OPENING_JOBS` | Jobs → "Opening Jobs" (`client-explorer-panel.tsx:136`) |
| `JOBS_ACCOUNTS_POSTING` | Jobs → "Accounts Posting" (`client-explorer-panel.tsx:135`, already conditional on `postDataToAccounts` — this right is an *additional* condition, not a replacement) |
| `MASTERS_MENU` | Whole "Masters" top-level tab (`client-top-nav.tsx` `NAV_ITEMS`) |
| `CONFIG_MENU` | Whole "Configurations" top-level tab |
| `ADMIN_MENU` | Whole "Admin" top-level tab — this is Client Mode's Post/Unpost area (`client-admin-page.tsx` → `AdminSection group="post-unpost"`), **not** the separate `/admin/*` Admin Mode |

### Role → rights mapping (final, per `plans/tran.md`)

| Right | MANAGER | TECHNICIAN | RECEPTIONIST |
|---|---|---|---|
| `JOBS_RECEIPTS` | ✅ | ❌ | ✅ |
| `JOBS_OPENING_JOBS` | ✅ | ❌ | ✅ |
| `JOBS_ACCOUNTS_POSTING` | ✅ | ❌ | ✅ |
| `MASTERS_MENU` | ✅ | ❌ | ✅ |
| `CONFIG_MENU` | ✅ | ❌ | ❌ |
| `ADMIN_MENU` | ✅ | ❌ | ❌ |

Plus `userType === 'A'` or `'S'`: ✅ on everything, unconditionally (bypass,
not a seeded row).

In words: Manager — nothing disabled. Technician — loses Receipts, Opening
Jobs, Accounts Posting, Masters, Configurations, and Admin; keeps the rest
of Jobs plus all of Inventory and Reports. Receptionist — loses only
Configurations and Admin; keeps everything else including Masters.

## Concrete steps

**Seeding — ✅ DONE, but via a different mechanism than originally scoped
(see Status section at top): server-side SQL in `seed_security_data.py`
rather than a client-side seed batch.**

1. ~~In `service-plus-client/src/features/super-admin/constants/seed-data.ts`,
   fill in the commented-out "Access Rights" batch...~~ **Done differently**:
   the 6 rows are seeded via `service-plus-server/app/db/seed_security_data.py`
   (`SeedSecurityData.SECURITY_SEED_SQL`, lines 25-33) — content matches the
   catalog below exactly.
2. ~~Add a new "Role Access Rights" batch...~~ **Done differently**: same
   file, lines 38-41, seeds `role_access_right` per the mapping table below
   (MANAGER → all 6, RECEPTIONIST → 4, TECHNICIAN → 0). The client-side
   `xDetails`/`fkeyName` nested-insert pattern in `graphql-utils.ts` was not
   needed/used — this moved server-side instead.
3. ⚠️ **PARTIALLY DONE** — re-seed path exists (`seedSecurityData` GraphQL
   mutation, wired to `src/features/super-admin/components/seed-roles-dialog.tsx`,
   also runs automatically on new client-schema creation via
   `mutation_helper.py:496-503`), but the dialog's idempotency gate,
   `SQL_MAP.CHECK_ROLE_SEED_EXISTS` (`sql_store.py:1826-1830`), only checks
   `SELECT 1 FROM security.role LIMIT 1` — tenants that already had roles
   before this work landed will never see the Apply button, so **existing
   tenants are not actually getting backfilled today**. Needs fixing: either
   check for `access_right` rows specifically, or always offer Apply and
   rely on the seed SQL's `ON CONFLICT DO NOTHING`.

**Server — make rights available on every request (✅ DONE):**

4. ✅ `service-plus-server/app/db/sql_store.py` (`GET_USER_BY_IDENTITY`,
   line 2910) — `r.code AS role_code` added to the SELECT/GROUP BY.
   `GET_USER_BY_ID_FOR_RESET` (used by the refresh-token path and
   `get_current_user`) was also extended with `role_code` + `access_rights`
   (not originally scoped as its own step, but needed for Step 7's refresh
   path — see below).
5. ✅ `service-plus-server/app/schemas/auth_schema.py` (`LoginResponse`) —
   `role_code: str = Field(default="", alias="roleCode", ...)` added.
6. ✅ `auth_router_helper.py` — `role_code=` passed at both `role_name=`
   call sites (super-admin synthetic path, real user path).
7. ✅ `auth_router_helper.py` `token_claims` — `role_code` and
   `access_rights` added at the login path. The refresh-token path now also
   re-reads `role_code`/`access_rights` from `GET_USER_BY_ID_FOR_RESET` (a
   live DB read, not copied from the old refresh token) so a role change
   takes effect on the next refresh rather than only at the next full login.
8. ✅ `service-plus-server/app/graphql/schema.py` — `get_graphql_context()`
   added and wired as `context_value` on `GraphQL(...)`. Reads the
   `Authorization` header, calls `decode_token()`, and puts `user_id`,
   `user_type`, `role_code`, `access_rights`, `client_id`, `db_name` into
   resolver context; missing/invalid token leaves those fields `None`/`[]`
   rather than failing the request.

**Server — enforce per action (⚠️ PARTIALLY DONE — see blocker below):**

9. ✅ `app/graphql/resolvers/auth_guards.py` added:
   `require_access_right(info, code)`, raising `AuthorizationException`
   (not `AppHttpException` — that class doesn't exist in this codebase;
   `AuthorizationException` is the existing equivalent, already used
   elsewhere and auto-formatted by `format_graphql_error`). Bypasses for
   `user_type in {"S", "A"}`, matching the client's "no restrictions on
   Admin" rule.
10. ⚠️ **Applied only where it's safe — see "Step 10 blocker" below.**
    Done: `accountsPosting` → `JOBS_ACCOUNTS_POSTING` (clean, dedicated
    resolver, single call site). `genericUpdate` → `MASTERS_MENU` and
    `CONFIG_MENU`, via a `tableName` allow-list
    (`GENERIC_UPDATE_TABLE_RIGHTS` in `mutation.py`) covering all 20
    Masters/Configurations tables (verified each is written *only* from its
    own feature area, no cross-area collisions).
    **Not done**: `JOBS_RECEIPTS`, `JOBS_OPENING_JOBS`, `ADMIN_MENU`
    (post/unpost) — blocked, see below.

    #### Step 10 blocker: no clean enforcement point for 3 of the 6 codes

    The plan assumed each catalog code maps to its own resolver(s)
    ("receipt create/edit/delete resolvers", "opening-job create/edit/delete
    resolvers", "the post/unpost-pending-vouchers resolver"). **That's not
    how the code is actually structured.** There are no such resolvers —
    Receipts, Opening Jobs, and Post/Unpost all go through the same generic
    `genericUpdate`/`createJobPayment` mutations used by other, explicitly
    **unrestricted** areas, writing the *same* tables with the *same*
    resolver:
    - `tableName: "job"` is written by Opening Jobs **and** by Single Job,
      Batch Job, Job Control, and Final-a-Job (all required to stay open
      for every role). A `tableName`-only guard can't tell these apart —
      it would either leave Opening Jobs ungated or block Technicians from
      Single/Batch Job entirely.
    - The dedicated `createJobPayment` mutation is called both from the
      Receipts screen **and** from the "Add Receipt" step inside the
      Deliver Job modal (`delivery-modal.tsx`) — same mutation, same
      payload shape, no field distinguishes the two callers. Gating it by
      `JOBS_RECEIPTS` would also block Technicians from completing a
      delivery that includes taking a payment, which the plan requires to
      stay open.
    - Post/Unpost (`ADMIN_MENU`) toggles `is_posted` via `genericUpdate` on
      `job_payment`, `purchase_invoice`, `sales_invoice`, `job_invoice` —
      every one of those tables is also written by an unrestricted flow
      (Receipts, Inventory purchase/sales entry, Deliver Job). The *only*
      thing that distinguishes a post/unpost call is that its `xData` is
      exactly `{id, is_posted}` with no other keys — a payload-shape
      heuristic, not an explicit signal, and fragile to rely on for access
      control.

    This needs a decision, not a workaround guess:
    (a) accept the payload-shape heuristic above for `ADMIN_MENU` (and find
        an equivalent for Receipts/Opening Jobs, e.g. `is_opening_job: true`
        already present in Opening Jobs' own `xData` — confirmed unique to
        that flow, so **that one is actually safe**, unlike the other two);
    (b) have the client send an explicit discriminator (e.g. an `area` or
        `rightCode` field in the `genericUpdate`/`createJobPayment` payload)
        so the server can key off something authoritative instead of
        table name or shape; or
    (c) split the shared resolvers into distinct GraphQL fields per area
        (bigger change, touches client call sites too).
    Given `is_opening_job` is already a reliable signal, `JOBS_OPENING_JOBS`
    could actually be added now on that basis if desired — flagging here
    rather than silently adding it, since it wasn't in the original Step 10
    plan text. `JOBS_RECEIPTS` (createJobPayment) and `ADMIN_MENU`
    (post/unpost) remain unresolved either way.

**Client — read and gate (✅ DONE):**

11. ✅ `service-plus-client/src/lib/auth-service.ts` — `roleCode?: string`
    added to both `UserInstanceType` and `LoginResponseType`.
12. ✅ `login-form.tsx` — `roleCode: result.roleCode` added alongside
    `roleName:`. Also fixed a pre-existing gap found while implementing this:
    `accessRights` was typed everywhere but **never actually copied** from
    the login response into the stored `UserInstanceType` in `onSubmit` — it
    was silently dropped, which would have made every `hasAccessRight` check
    below return `false` regardless of the user's real rights. Added
    `accessRights: result.accessRights` at the same spot.
13. ✅ `service-plus-client/src/features/auth/utils/access-rights.ts` created
    with `ACCESS_RIGHTS`, `AccessRightCode`, `hasAccessRight()` (matches the
    plan's snippet exactly), plus `ROLE_SHORT_NAMES` and a
    `getRoleDisplayName(user, short)` helper (falls back to full `roleName`
    when `roleCode` is missing/unmapped, as specified).
14. ✅ `hasAccessRight(user, ...)` wired into all six gated spots:
    - `client-explorer-panel.tsx` — `TreeItem` now takes `disabled`/`title`
      props (dim + `cursor-not-allowed` + non-interactive `onClick` +
      tooltip). Applied to Receipts/Opening Jobs/Accounts Posting; Accounts
      Posting keeps its existing `postDataToAccounts &&` guard as an
      additional, not replaced, condition.
    - `client-top-nav.tsx` — `NAV_ITEMS` gained an optional `requiredRight`;
      when the user lacks it, a disabled `<span>` with a tooltip renders
      instead of the `NavLink` (navigation is fully prevented, not just
      styled). Existing data-state conditions elsewhere are untouched.
15. ✅ Role badge in `client-top-nav.tsx` now calls
    `getRoleDisplayName(user, true)`, showing the short code (Man/Tech/Rec).
    `client-activity-bar.tsx`'s account dropdown was confirmed unchanged —
    still shows the full `roleName`.

    **Verification note**: `npx tsc --noEmit` is clean. A live browser
    check (logging in as each of Manager/Technician/Receptionist and
    confirming the actual disabled/tooltip behavior) was **not performed** —
    it was offered and explicitly declined in favor of a manual check by the
    user, since it required sharing real login credentials. Steps 11-15 are
    implemented and type-clean but runtime-unverified.

**Docs and follow-up hardening (✅ DONE):**

16. ✅ `help-content.ts` updated. Rather than repeating a role/rights note
    on every one of the ~5 Masters and ~4 Configurations articles for two
    whole-tab gates, added one comprehensive Feature × Role table to the
    existing "Roles" article (`access-roles`, Access Management category) —
    the natural place an admin would already look — plus a short one-line
    note on each of the three individually-gated Jobs articles (`receipts`,
    `opening-jobs`, `accounts-posting`) pointing back to it.
17. ✅ **Done — as a documentation/flagging item, which is all this step
    ever asked for.** Status, narrower than originally scoped: `genericUpdate`
    now has a `tableName` allow-list for `MASTERS_MENU`/`CONFIG_MENU` (Step
    10), so that part of the gap is closed. What remains open, and is
    tracked in the "Step 10 blocker" note above rather than re-described
    here: `genericUpdateScript` and `genericQuery` still have no per-table
    check at all (not needed today — nothing gated goes through them, but
    also nothing stops a future feature from adding one unguarded), and
    `genericUpdate` calls for `job`/`job_payment`/`job_invoice`/
    `purchase_invoice`/`sales_invoice` remain unscoped by design, since
    those tables are shared with unrestricted flows and a `tableName`-only
    check would either miss the restricted case or wrongly block the
    unrestricted one. Step 8's authentication (valid token required) still
    applies to all of these regardless.

## Out of scope

- An admin-editable permissions matrix UI (assigning arbitrary rights to
  roles at runtime) — rights are seeded/static in this pass, matching how
  roles themselves are already system-defined.
- Role-based gating inside Admin Mode (`/admin/*` — Business Units, Business
  Users, Roles pages) — that area is reachable only by `userType === 'A'`,
  who face no restrictions there per the Decision above.
- Gating Inventory or Reports — explicitly unrestricted for every role.
- Per-BU role distinction (a user having a different role on different
  Business Units) — schema supports it, `associate-bu-role-dialog.tsx`
  doesn't use it that way today. Not touched here.
- Fully closing the `genericUpdate` table-writer hole (Step 17) — flagged,
  not solved, in this plan.

## Verification

1. `npx tsc --noEmit` on the client; run the server's existing test suite
   (if any) after backend changes.
2. Seed one test Business User per role (MANAGER / TECHNICIAN /
   RECEPTIONIST) via Associate BU / Role.
3. Log in as each and confirm exactly:
   - **Manager**: nothing disabled anywhere.
   - **Technician**: Receipts, Opening Jobs, and Accounts Posting disabled
     (tooltip) in the Jobs tree; Masters, Configurations, and Admin tabs
     disabled (tooltip); rest of Jobs, all of Inventory, all of Reports
     fully enabled.
   - **Receptionist**: Configurations and Admin tabs disabled (tooltip);
     everything else — including Masters and all of Jobs — fully enabled.
   - In every case: nothing is ever hidden, only disabled+tooltip; existing
     data-state disables (e.g. `is_final`, `invoice_is_posted`) still apply
     on top where relevant.
4. Log in as a `userType === 'A'` Business Admin holding any of the three
   roles and confirm nothing is disabled anywhere (full bypass).
5. With a non-privileged token, call a gated GraphQL mutation directly
   (Apollo DevTools or raw request) and confirm the server now rejects it
   with 403 — not just that the button was disabled.
6. Confirm an already-provisioned (pre-existing) client database picks up
   the new rows after the Step 3 re-seed, not only freshly-created clients.
7. Confirm unauthenticated GraphQL requests to queries that don't call
   `require_access_right` still behave reasonably (Step 8 is deliberately
   non-breaking for those).
8. Confirm super-admin (`userType === 'S'`) is unaffected by the new checks
   everywhere (bypass in both `hasAccessRight` and, if mirrored server-side,
   `require_access_right`).
9. Confirm the role badge in `client-top-nav.tsx` shows the short name
   (Man/Tech/Rec) and the account dropdown still shows the full role name.
