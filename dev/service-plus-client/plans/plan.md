# Access Control: Current State & Implementation Plan

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
  `service-plus-client/src/features/super-admin/constants/seed-data.ts`.
- **`access_right`** — `code`, `name`, `module`, `description`. **Table
  exists, currently empty** — the seed batch for it is commented out
  (`seed-data.ts:21`).
- **`role_access_right`** — role ↔ access_right (M:N). **Also empty today.**
- **`user_bu_role`** — user gets one role per business unit (`is_active`
  flag). Assigned via `associate-bu-role-dialog.tsx`, uniformly across all
  selected BUs (schema supports per-BU roles; the UI doesn't use that yet —
  out of scope here, see below).

`roles-page.tsx` explicitly states "Roles are system-defined and cannot be
added, edited, or deleted" — there is **no dynamic permissions-editor UI**
anywhere in the app today, and this plan does not add one (see Decision
below).

### Authentication (implemented and enforced)

- Login (`POST /api/auth/login` →
  `service-plus-server/app/routers/auth_router_helper.py::login_helper`)
  looks up the user via `SqlStore.GET_USER_BY_IDENTITY`
  (`app/db/sql_store.py:3022`), which **already aggregates** the user's
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
this area is `userType === 'A'`-only and faces no role-based restrictions):

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

**Seeding (client-driven, reuses the existing seed-batch mechanism already
used for Roles — no new backend code required for this part):**

1. In `service-plus-client/src/features/super-admin/constants/seed-data.ts`,
   fill in the commented-out "Access Rights" batch
   (`{ tableName: "access_right", xData: [...] }`) with the 6 rows from
   the catalog above.
2. Add a new "Role Access Rights" batch seeding `role_access_right` rows
   (role id ↔ access_right id pairs) per the mapping table above. Check
   whether `SqlObjectType`'s `xDetails`/`fkeyName` nested-insert pattern
   (already defined in `src/lib/graphql-utils.ts`) is used elsewhere for a
   parent→children seed of this shape, and mirror it — don't invent a new
   insert shape if an existing one already does parent-id-linked child rows.
3. For **already-provisioned** client databases (not just newly-created
   ones), re-run the seed batches via the existing super-admin re-seed flow
   (`seed-roles-dialog.tsx` / `initialize-client-dialog.tsx`, gated by
   `CHECK_ROLE_SEED_EXISTS`-style idempotency) so existing tenants get
   backfilled too.

**Server — make rights available on every request:**

4. `service-plus-server/app/db/sql_store.py` (`GET_USER_BY_IDENTITY`,
   line 3022) — add `r.code AS role_code` to the SELECT/GROUP BY (useful for
   display/audit; `access_rights` is already aggregated here, no change
   needed for that column).
5. `service-plus-server/app/schemas/auth_schema.py` (`LoginResponse`) — add
   `role_code: str`.
6. `auth_router_helper.py` — pass `role_code=user.get("role_code") or ""` at
   both `role_name=` call sites (super-admin synthetic path at line 77, real
   user path at line 196).
7. `auth_router_helper.py` `token_claims` (built at line 150, and again in
   the refresh-token path around line 340) — add `"role_code"` **and**
   `"access_rights": user.get("access_rights") or []` so both are available
   on every GraphQL request without a DB round-trip, and stay current across
   token refresh.
8. `service-plus-server/app/graphql/schema.py::create_graphql_app` — add a
   `context_value` callable to `GraphQL(...)` that reads the `Authorization`
   header, calls the existing `decode_token()` (already used by
   `app/core/dependencies.py::get_current_user`), and puts `user_id`,
   `user_type`, `role_code`, `access_rights`, `client_id`, `db_name` into
   resolver context. Missing/invalid token → context user stays `None`,
   don't hard-fail every query (only resolvers that call the new guard
   reject).

**Server — enforce per action:**

9. Add a shared guard (e.g. new `app/graphql/resolvers/auth_guards.py`):
   ```python
   def require_access_right(info, code: str) -> None:
       if code not in (info.context.get("access_rights") or []):
           raise AppHttpException(status_code=403, detail=f"Missing required access right: {code}")
   ```
10. Apply `require_access_right(info, "<CODE>")` at the top of every
    resolver in `app/graphql/resolvers/mutation.py` per the catalog mapping:
    `JOBS_RECEIPTS` → receipt create/edit/delete resolvers; `JOBS_OPENING_JOBS`
    → opening-job create/edit/delete resolvers; `JOBS_ACCOUNTS_POSTING` →
    `accountsPosting`; `MASTERS_MENU` → all master CRUD resolvers (Brand,
    Product, Model, Parts, Customer, Technician, Vendor, Branch, State,
    Financial Year, lookups, additional charges); `CONFIG_MENU` →
    division/app-settings/document-sequence resolvers; `ADMIN_MENU` → the
    post/unpost-pending-vouchers resolver. The rest of Jobs (single/batch/
    opening-job-final/job-control/pipeline/deliver/part-used) and all of
    Inventory and Reports need **no** guard — unrestricted for every role
    per the Decision above; Step 8's authentication (valid token required)
    still applies to them.

**Client — read and gate:**

11. `service-plus-client/src/lib/auth-service.ts` — add `roleCode?: string`
    to `UserInstanceType` (mirrors existing `roleName`; `accessRights` is
    already there).
12. `login-form.tsx` — add `roleCode: result.roleCode` alongside
    `roleName: result.roleName` in the `UserInstanceType` built in `onSubmit`.
13. New file `service-plus-client/src/features/auth/utils/access-rights.ts`
    (cross-cutting, not admin-only — Client Mode needs it too):
    ```ts
    export const ACCESS_RIGHTS = {
        JOBS_RECEIPTS: 'JOBS_RECEIPTS',
        JOBS_OPENING_JOBS: 'JOBS_OPENING_JOBS',
        JOBS_ACCOUNTS_POSTING: 'JOBS_ACCOUNTS_POSTING',
        MASTERS_MENU: 'MASTERS_MENU',
        CONFIG_MENU: 'CONFIG_MENU',
        ADMIN_MENU: 'ADMIN_MENU',
    } as const;
    export type AccessRightCode = typeof ACCESS_RIGHTS[keyof typeof ACCESS_RIGHTS];

    export function hasAccessRight(
        user: Pick<UserInstanceType, 'accessRights' | 'userType'> | null,
        code: AccessRightCode,
    ): boolean {
        if (user?.userType === 'S' || user?.userType === 'A') return true; // super-admin / business-admin bypass — "no restrictions on Admin"
        return !!user?.accessRights?.includes(code);
    }
    ```
    Also add a `ROLE_SHORT_NAMES` map here (or alongside): `{ MANAGER: 'Man',
    TECHNICIAN: 'Tech', RECEPTIONIST: 'Rec' }`, keyed by `role_code` once
    Step 5/6 land (falls back to full `roleName` if `role_code` is missing).
14. Wire `hasAccessRight(user, ...)` into the six gated spots — **always
    render, disable + tooltip when the right is missing, never hide**:
    - `client-explorer-panel.tsx` — the `TreeItem` component (line ~29) has
      no `disabled` prop today; add one (dim styling + non-interactive +
      `title` tooltip). Apply it to the "Receipts", "Opening Jobs", and
      "Accounts Posting" `TreeItem`s using `JOBS_RECEIPTS`,
      `JOBS_OPENING_JOBS`, `JOBS_ACCOUNTS_POSTING` respectively. "Accounts
      Posting" keeps its existing `postDataToAccounts &&` guard as well —
      this right is additive, not a replacement.
    - `client-top-nav.tsx` — `NAV_ITEMS` renders `Masters`/`Configurations`/
      `Admin` as plain `NavLink`s with no disabled state today. Add a
      disabled visual treatment (muted text, no hover state) *and* prevent
      the actual navigation (e.g. render a disabled `<span>`/`<button>`
      instead of `NavLink` when disabled, or guard the click), each with a
      `title` tooltip explaining why (e.g. "Requires Manager or Receptionist
      role" for Masters).
    - Apply `hasAccessRight(user, ...)` **alongside** any existing
      data-state conditions elsewhere found in the earlier survey, never
      replacing them.
15. Update the role badge in `client-top-nav.tsx` (~line 109,
    `{user?.roleName ?? (user?.userType === 'A' ? 'Admin' : 'User')}`) to
    show the short name (`ROLE_SHORT_NAMES` from Step 13) instead of the
    full `roleName` — this is the tight, `tracking-widest` badge where space
    is constrained. The account dropdown built earlier in
    `client-activity-bar.tsx` keeps showing the full role name; no change
    needed there.

**Docs and follow-up hardening:**

16. Update `help-content.ts` for every gated area, noting which right/role
    is required for each action.
17. Flag as a separate follow-up (not blocking this rollout): the generic
    `genericUpdate`/`genericUpdateScript`/`genericQuery` resolvers can write
    to *any* table by name with no per-table check — Step 8's auth context
    means they're now at least authenticated, but not yet right-scoped.
    Closing this fully needs either a table allow-list or a right check
    keyed by `tableName`, which is a bigger effort than this plan covers.

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
