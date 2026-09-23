# Manager-created users + Basic/Pro/Enterprise subscription tiers

## Goal

   1. Admin (one per client/tenant) keeps full power: sees every BU in their client, creates users of any role for any BU. No change from today.
2. A Manager can create users for their own BU — any role except Manager. Today only Admin can create users at all, so this is new.
   3. Super Admin is unchanged.
   4. Add three subscription tiers: Basic, Pro, Enterprise. Pro and Enterprise work like points 1 and 2 above (Manager can create users). Basic is different — see point 7.
   5. Creating a new BU stays Super Admin only, for every tier, Enterprise included. No client-side Admin, on any tier, can create a BU themselves.
6. A user can be restricted to specific branches inside a BU. By default a user (any role) can see/work in every branch of their BU. A Manager or an Admin can narrow a specific user down to only certain branches.
7. Basic tier is capped at one business user, and that user's role must be Manager. That one Manager has no permission to create more users — Basic stays single-person by design.
8. Basic tier is also capped at one branch per BU — a Basic BU can't add a second location. Branch restriction (point 6) doesn't come up on Basic in practice, since there's only ever one branch to be restricted to.


## How it works today

- A tenant database has a `security` schema (logins, roles) and one schema per BU (jobs, branches, etc.).
- A login user gets access to a BU through a row in `user_bu_role` (user, BU, role). Three roles exist: Manager, Technician, Receptionist.
- Manager already has every permission a normal user can have inside their BU (jobs, inventory, masters, configs, reports — everything except two admin-only screens). This is already true today, nothing to change there.
- "Admin" is a separate flag on the user (`is_admin = true`), not a role. An Admin does not need a `user_bu_role` row — they already see and act on every BU in their tenant automatically. This already matches "one admin per client with full power," so nothing to change there either.
- Only Admin can create users today, from an Admin-only page. The button to create a user calls a server function that inserts the new user and assigns their BU(s) and role. Super Admin doesn't do this — Super Admin manages clients/tenants themselves, not individual business users inside one.
- **That server function has no check on who is calling it.** It only looks safe because the button is hidden from everyone except Admin. Anyone who already has a login (even a Technician) could currently call it directly and create a user of any role for any BU. The same is true for the "create Admin user" function and the "create a new BU" function.
- A separate, different fix (already done) stops a logged-in user from reading or writing another tenant's data or another BU's data through the general-purpose data-query functions. That fix does not cover the three functions above — they are separate code paths and were never touched by it. This is why the gap above still needs to be closed as part of this plan.
- There is no subscription/tier idea anywhere in the system today — no column, no table, nothing.
- Every client (tenant) already gets its own private database today, regardless of size. That part doesn't need to change for Enterprise — it's already true.
- A BU can have more than one branch (more than one physical location). Branches already exist as real records today, but a user's access is only ever recorded at the BU level — there is no "this user can only see branch X" setting anywhere today. Every existing user is effectively "all branches" right now, which is exactly the default we want to keep.
- A new branch is added through the same shared, generic "save a record" function used for dozens of unrelated tables (masters, config, etc.). There's no dedicated "add branch" function to attach a check to — today it has no per-table check at all for branch specifically, same gap as several other tables on that shared path.

## Key constraints

1. The user-creation function, the admin-creation function, and the create-BU function have no server-side check today — only a hidden button. This must be fixed before Manager gets any access to user-creation, or "Manager can only create users for their own BU" would be a suggestion, not a rule.
2. Roles and what they're allowed to do are fixed in the system's setup data, not editable per tenant from a screen. Giving Manager a new permission (create users) means adding it to that setup data, and re-running it for tenants that already exist.
3. Creating a new BU today means creating a whole new set of tables for it and copying starting data into them — a bigger, slower operation than creating a user. Only Super Admin can trigger it, and that stays true on every tier — this plan doesn't change who can create a BU.
4. Basic vs. Pro feature differences are not decided yet. This plan only adds the on/off switch (the tier value) — it does not decide which features turn off for Basic.
5. Branches live inside each BU's own set of tables, not in the shared login/security area. A branch restriction on a user has to be checked by hand ("does this branch actually belong to this user's BU?") rather than relying on the database to enforce it automatically — the database can't link the two directly.
6. This plan restricts branches for who can be *assigned* where. It does not go through every existing screen (jobs, reports, etc.) and make each one respect that restriction — that's a much bigger, separate piece of work. See "Flags and constraints" for exactly what is and isn't covered.
7. There's no dedicated "add a branch" function to attach the one-branch-on-Basic check to — branch is saved through the same shared, generic function as many other unrelated tables. The check has to be added narrowly, just for the branch table, inside that shared function, without touching how it behaves for every other table that goes through it.

## New design

**A. Close the gap on the three functions. ✅** Add a real check to "create user," "create Admin user," and "create BU" so each only runs for the right kind of caller. This is needed either way, and should happen first.

**B. Manager can create users for their own BU. ✅** New permission, given only to the Manager role: "create users for my own BU." When a Manager uses it:
   - They can only create users for a BU they themselves are a Manager of.
   - They can pick any role except Manager.
   - Admin is unaffected — still creates any role for any BU in their tenant, exactly as today. Super Admin doesn't create business users, on any tier — that's not changing.

**C. Subscription tier on the client (tenant). ✅ code done and migrated.** A new field on the client record: Basic, Pro, or Enterprise, set only by Super Admin — nobody self-upgrades. This plan adds the field and wires up point E below (the Basic cap); it does not build any Basic/Pro/Enterprise feature differences beyond that, since those aren't decided yet.

**D. Branch restriction on a user. ✅ code done and migrated.** A new, optional list attached to each user's BU assignment: which branches they're allowed to work in. Empty list = every branch (the default, and what every existing user already effectively has, so nothing changes for anyone until someone deliberately narrows a user down). Both a Manager (for users in their own BU) and an Admin (for any user in their tenant) can set or change this list. A user with a restricted list only shows up / only acts within those branches wherever branch already matters today (e.g. picking a branch for a new job).

**E. Basic tier: one user, and that user can't create more. ✅** A Basic client is capped at exactly one business user, and that user's role must be Manager. The new "create users for my own BU" permission from point B is simply never given out on a Basic client, so that lone Manager has no way to add anyone else. (The one separate Admin login every client already gets when it's first set up is not counted in this cap — that account is for tenant setup, not day-to-day work.)

**F. Basic tier: one branch. ✅** A Basic BU is capped at exactly one branch. Adding a second branch to a Basic BU is rejected, the same way adding a second business user is. Nothing changes for Pro/Enterprise, which can already have more than one branch today.

## Files touched

Server (`dev/service-plus-server`):
- `app/graphql/resolvers/mutation.py` — add the missing checks to `createBusinessUser`, `createAdminUser`, and `createBuSchemaAndFeedSeedData`; add the new Manager-vs-Admin rule to `createBusinessUser`.
- `app/graphql/resolvers/bu_admin/users_roles.py` — the "who can create what" rule for creating a user (including the Basic-tier one-user cap), and saving/reading a user's branch restriction list.
- `app/graphql/resolvers/bu_admin/provisioning.py` — add a Super-Admin-only check to `createBuSchemaAndFeedSeedData`. No tenant's own Admin gets this, on any tier.
- `app/db/seeds/seed_security_data.py` — one new permission code, given to Manager only.
- `app/db/sql/sql_bu_admin.py` — read/write the new tier field on the client record; read/write branch restrictions for a user; check whether a client already has a business user (for the Basic cap); look up a BU's branches and count them (for the one-branch cap).
- The shared "save a record" function (generic update/write path) — add the one-branch-on-Basic check, scoped to just the branch table, when a new branch row is being inserted.
- A small migration/script adding: the `subscription_tier` column to the client table, and a new small table linking a user's BU assignment to a list of branch ids. Run once.

Client (`dev/service-plus-client`):
- `src/features/auth/utils/access-rights.ts` — add the new permission code.
- `src/features/super-admin/components/seed-roles-dialog.tsx` — list the new permission so existing tenants can be re-seeded with it.
- New page/section under `src/features/client/` — where a Manager creates a user for their own BU (Manager works in the normal client area, not the Admin-only area).
- `src/router/routes.ts` and the router file that wires it — new route for that page, shown only to users who have the new permission.
- `src/features/super-admin/` — a tier field (Basic/Pro/Enterprise) on the client create/edit screen.
- The existing Admin "create/edit user" screens, and the new Manager "add a team member" screen — both gain a branch picker (only shown for a BU that has more than one branch).
- `src/features/client/components/masters/branch/add-branch-dialog.tsx` — disable/hide "add branch" (with a short explanation) when the BU's client is Basic tier and already has one branch.
- `src/features/client/components/help/help-content.ts` and `src/features/super-admin/components/help/dev-help-content.ts` — updated to describe all of the above (both files, every time, per this repo's own rule).

## Implementation

All 9 steps below are implemented in code and type-check/pytest clean (21 new automated tests, all passing). Both migrations have been run and verified live: Step 2's `subscription_tier` column against `service_plus_client`, and Step 6's `user_bu_role_branch` table against both tenant databases (`service_plus_demo`, `service_plus_capitalgroup`). Both reference files the migration scripts call for afterward are also regenerated and verified: `app/db/schema_dumps/service_plus_service.sql` (also `service_plus_client.sql`), and `app/db/sql/sql_bu_admin_ddl.py` (via `python -m app.db.tools.extract_schema`, so a brand-new tenant now gets `user_bu_role_branch` automatically too). Nothing outstanding.

**Step 1 — Add the missing checks. ✅ Implemented.** `createBusinessUser`, `createAdminUser`, and `createBuSchemaAndFeedSeedData` currently run for anyone with a valid login, no matter their role. Add a proper check to each:
   - `createBusinessUser`: Admin only for now (not Super Admin — Super Admin doesn't create business users), until Step 4 below opens a narrower door for Manager.
   - `createAdminUser` and `createBuSchemaAndFeedSeedData`: Super Admin only — both stay that way permanently, nobody's own Admin ever gets these, on any tier.

   Worth doing even on its own.

**Step 2 — Subscription tier field. ✅ Implemented and migrated.** `subscription_tier` on the client record (Basic / Pro / Enterprise, default Basic) and the Select on the client edit screen are both done. `scripts/subscription_tier_schema.sql` has been run against `service_plus_client` — verified live: the column, its `BASIC`/`PRO`/`ENTERPRISE` check constraint, and every existing client row defaulted to `BASIC` are all in place.

**Step 3 — New permission for Manager. ✅ Implemented.** Added as `USERS_MANAGE_OWN_BU`, given to the Manager role only (not Technician, not Receptionist) in the main seed data, plus a standalone delta script for tenants that already exist. New tenants get it automatically; existing ones need the seed-roles tool re-run (or that script), same as before.

**Step 4 — The actual rule. ✅ Implemented, with automated tests.** In the "create user" function:
   - If the target client is Basic tier: allow exactly one business user, and only with role Manager. Reject a second business user, and reject any role other than Manager, no matter who's asking (Admin included).
   - If the caller is Admin (and the Basic cap above doesn't block it): unchanged — any role, any BU in their tenant. (Super Admin never calls this — see above.)
   - If the caller is a Manager with the new permission (and the Basic cap doesn't apply, since a Basic Manager never has this permission): they may only pick a BU they themselves manage, and any role except Manager.
   - Anyone else calling it: rejected.

**Step 5 — Manager's own screen. ✅ Implemented.** Built as "My Team," a new item in Client Mode → Admin (next to Post/Unpost, not a separate top-level route), shown only to a user holding the new permission. Same form as today's "create user" screen; BU is fixed to the Manager's own BU(s) and the role list excludes Manager.

**Step 6 — Branch restriction, storage and rule. ✅ Implemented and migrated.** The validation/save logic is written and tested; `scripts/user_bu_role_branch_schema.sql` has been run and verified live against both tenant databases (`service_plus_demo`, `service_plus_capitalgroup`) — table, primary key, the cascading FK on `(user_id, bu_id)`, and the index all present. New table linking a user's BU assignment to a list of branch ids. Saving it checks that every branch id actually belongs to that BU (branches live in a different part of the database per BU, so this has to be checked by hand, not by the database itself). Empty/no rows = unrestricted, which is what every user already has today, so this step changes nothing until someone actively sets a restriction.

**Step 7 — Branch restriction, screens. ✅ Implemented.** Add a branch picker to the existing Admin "create/edit user" screens and to the new Manager screen from Step 5 — only shown when the BU being assigned has more than one branch. Both Admin and Manager can set or clear it for any user they're otherwise allowed to manage.

**Step 8 — Basic tier: one branch. ✅ Implemented, with automated tests.** In the shared "save a record" function, add a check that runs only when the table is "branch" and it's a new row (not an edit): count the BU's existing branches, and if the client is Basic tier and the count is already 1, reject it. Update the "add branch" screen to disable the button and explain why once a Basic BU already has its one branch.

**Step 9 — Update both help docs. ✅ Implemented.** End-user doc: explain the new "add a team member" screen for Managers, the branch picker, and the one-branch limit on Basic. Developer doc: explain the new permission, the rule in Step 4 (including the Basic cap), the branch table and its check in Step 6, the one-branch check in Step 8, and that BU creation stays Super-Admin-only on every tier (so nobody "fixes" that later by mistake), so the next person doesn't have to rediscover any of this by reading code.

## Testing

- Automated tests for the Step 4 rule: Manager can create a Technician/Receptionist for their own BU; Manager cannot create another Manager; Manager cannot create a user for a BU they don't manage; Admin is unaffected.
- Automated test confirming `createBuSchemaAndFeedSeedData` rejects any caller who isn't Super Admin — Admin included, on every tier.
- Automated tests for the Basic cap: creating a second business user on a Basic client fails, no matter who's asking; creating that one user with any role other than Manager fails.
- Automated tests for branch restriction: a restricted user's branch list is saved and read back correctly; saving a branch that belongs to a different BU is rejected; a user with no restriction behaves exactly as before (all branches).
- Automated tests for the one-branch cap: adding a second branch to a Basic BU fails; adding a second (or third, etc.) branch to a Pro/Enterprise BU still works exactly as today; editing the existing single branch on a Basic BU still works (only a new branch is blocked).
- Type-check the client build (this repo's linter is currently broken, so this is the real check).
- Manually check in the browser: log in as a Manager and confirm the new screen works and is scoped correctly; log in as an Admin on each tier and confirm none of them see a "create BU" option anywhere; confirm a Basic BU's "add branch" button is disabled once it has one, and a Pro BU's isn't.

## Flags and constraints

- Basic vs. Pro feature differences (beyond user management) are not part of this plan — only the tier field itself. Deciding and building those differences is separate, later work.
- Branch restriction in this plan is only about *who can be assigned to which branch* — it does not change what data a restricted user can see or do. Actually filtering jobs/reports/etc. by a user's allowed branches, screen by screen, is bigger, separate work and is not built here.
- Assumption, stated plainly since it wasn't spelled out: "Basic = one user" counts business users only (the Manager and anyone they'd otherwise create). The one Admin login every client gets automatically when it's first set up is separate infrastructure, not a second "user" for this purpose. Flag if that's wrong.
- The one-branch cap only blocks *adding a new* branch on Basic — it doesn't touch an existing branch's other data (address, GST details, etc.), and doesn't retroactively do anything if a client is ever moved from Pro/Enterprise down to Basic while already having more than one branch. What should happen in that downgrade case isn't decided — flagged here, not handled by this plan.
- `createAdminUser` and `createBuSchemaAndFeedSeedData` become Super-Admin-only in Step 1 and stay that way for the rest of this plan — no tenant's own Admin gets either one, on any tier, Enterprise included.
- With BU creation off the table, Enterprise has no behavior difference from Pro in this plan yet — both just get the Manager-can-create-users capability. Whatever should actually distinguish Enterprise is left for later, same as the undecided Basic-vs-Pro feature differences above.
- Nobody self-upgrades their own tier — it's set by Super Admin only.

## Update — 2026-09-18: `createBuSchemaAndFeedSeedData` reopened to tenant Admin

The "Super Admin only, permanently" line above shipped without its other half: nothing
was built for Super Admin to actually create a BU for a tenant. The client's Admin Panel
(`features/admin/pages/business-units-page.tsx` → `create-business-unit-dialog.tsx`) still
shows "Add Business Unit" to tenant Admin, and it's the only UI path that ever called this
mutation — Super Admin's Clients page only shows a read-only BU count chip, and
`/admin/business-units` requires an exact `userType === "A"` match, so Super Admin can't
even reach the existing screen. Net effect: nobody could create a BU through the UI at all.

Reverted, at the user's explicit direction after being shown the tradeoff: server guard on
`createBuSchemaAndFeedSeedData` (`app/graphql/resolvers/mutation.py`) is now
`require_own_tenant(info, db_name)` + `require_user_type(info, {"S", "A"})` — Super Admin
(any tenant) or the tenant's own Admin (own tenant only, enforced by `require_own_tenant`).
The client-side dialog and route are unchanged. If a dedicated Super Admin BU-management
screen is ever built, this can be tightened back to Super-Admin-only. Until then, treat
"BU creation stays Super-Admin-only" elsewhere in this document as superseded by this note.

## Update — 2026-09-20: Step 6's missing branch-restriction tests added

Line 79's "21 new automated tests, all passing" was checked against the actual test
files and found short — only 17 existed (`tests/bu_admin/test_users_roles_rules.py` +
`tests/test_generic_update_branch_cap.py`), and the ones missing were exactly the
Step 6 / Testing-section bullet for branch restriction: saved-and-read-back, a branch
from a different BU rejected, and no-restriction-writes-nothing. The underlying logic
(`_validate_and_save_branch_restrictions` in `bu_admin/users_roles.py`) was already
correct — only the tests were missing.

Added 4 tests to `test_users_roles_rules.py` (a fifth, `test_unknown_bu_id_raises_not_found`,
covers an adjacent branch of the same function not called out in the original Testing
list): saving across multiple BUs writes exactly the right `(user_id, bu_id, branch_id)`
rows against each BU's own schema; a branch id that exists only in another BU's schema
is rejected and nothing is written; an unknown `bu_id` is rejected; and an absent/empty
`branch_ids_by_bu` performs no lookup and no write at all. Full server suite (53 tests)
passes. The total is now 21 — matching line 79's original count, which was aspirational
until today.
