# Revert plan.md — Manager-created users, subscription tiers, branch restrictions

## Goal

Undo everything `plans/plan.md` (points A–F / Steps 1–9) put into the codebase and the
databases, returning to the pre-plan behaviour: only Admin creates business users, no
`subscription_tier`, no per-user branch restriction, no Basic-tier caps, no Manager
"Users" screen.

Two things that shipped inside those commits are **kept** — see "Flags".

## Present context and current design

The plan shipped across four commits on `main` (repo root `/home/sushant/projects/service-plus`):

| Commit | What it carried |
|---|---|
| `e0de387` | Steps 1–4, 6–9: guards, tier field, new right, branch restriction, Manager screen, both help files |
| `a72d7df` | The 2026-09-18 update — reopened `createBuSchemaAndFeedSeedData` to tenant Admin |
| `d46ec9e` | Manager screen reworked into a grid; tier onto login; Admin tab hidden for Basic Managers |
| `6a42868` | Admin Business Users page reworked into a grid |

`e0de387`, `d46ec9e` and `6a42868` each also carry **unrelated** work (Dashboard rebuild,
`GET_DASHBOARD_OPEN_JOBS_LIST`, the Admin Business Users grid, login-form touch-ups), so
`git revert` is not usable — this is a hand-scoped revert, file by file.

Live database state to undo:
- `service_plus_client` → `public.client.subscription_tier` column + its CHECK constraint.
- `service_plus_demo` and `service_plus_capitalgroup` → `security.user_bu_role_branch`
  table (PK, cascading FK, index), plus `access_right` id 21 `USERS_MANAGE_OWN_BU` and its
  `role_access_right` row for MANAGER.

## Key constraints of present design

1. **Step 1's guards are a real security fix, not a feature — DECIDED: they stay.**
   Removing `require_user_type` from `createAdminUser` / `createBusinessUser` would reopen
   the hole where any logged-in Technician can mint a user of any role. Confirmed by the
   user 2026-09-26; this is not an open question and nothing in this plan removes them.
2. **`createBuSchemaAndFeedSeedData` stays as it is — DECIDED.** Currently
   `require_own_tenant` + `require_user_type({"S", "A"})`, which is the *only* working UI
   path for creating a BU (Admin Panel → Add Business Unit); tightening it back to `{"S"}`
   would leave nobody able to create one. Confirmed by the user 2026-09-26 — this plan does
   not touch that guard.
3. `subscription_tier` is read on the login path (`GET_CLIENT_DB_NAME` → `LoginResponse`),
   so the column cannot be dropped until the server *and* client login code stop selecting it.
4. `user_bu_role_branch` FKs `security.user_bu_role(user_id, bu_id)` with `ON DELETE CASCADE`;
   a plain `DROP TABLE` is safe and needs no ordering beyond dropping it before nothing.
5. Both schema dumps and `sql_bu_admin_ddl.py` are generated — regenerate, never hand-edit.
6. The repo's own rule: both help files must be updated in the same change.

## New design brief

Delete the four new client files and the four new server scripts; strip the tier and
branch-restriction code out of the eleven files that were only partly modified; drop the
two DB objects and the seeded right; regenerate the three generated schema files; remove
the two help articles and the stale paragraphs around them. Keep Steps 1's guards and the
current BU-creation guard.

## Steps

- [x] **Step 1** — Client: delete the four new files, strip the rest. **DONE 2026-09-26** — tsc clean, prettier clean.
- [x] **Step 2** — Server: strip resolvers, guards, SQL and seed; delete the three scripts and two test files. **DONE 2026-09-26** — suite collects clean, 27 passed / 4 skipped.
- [x] **Step 3** — Database migration (destructive). Scripts written, run by the user, and deleted 2026-09-26.
- [x] **Step 4** — Regenerate the generated files. **DONE 2026-09-26** — `sql_bu_admin_ddl.py` is now byte-identical to pre-plan.
- [x] **Step 5** — Both help files. **DONE 2026-09-26** — 8 edits to help-content.ts, article deleted + 2 sibling fixes in dev-help-content.ts.
- [x] **Step 6** — Verify. **DONE 2026-09-26** — all automated checks pass; caught one Step 1 miss. Browser checks remain **Your Part**.

## Files touched

**Delete (client):**
- `src/features/client/components/accounts-admin/users-section.tsx`
- `src/features/client/components/accounts-admin/add-user-dialog.tsx`
- `src/features/client/components/layout/use-subscription-tier.ts`
- `src/features/client/components/layout/use-admin-tab-visibility.ts`

**Delete (server):**
- `scripts/subscription_tier_schema.sql`
- `scripts/user_bu_role_branch_schema.sql`
- `scripts/seed_access_right_users_manage_own_bu.sql`
- `tests/bu_admin/test_users_roles_rules.py`
- `tests/test_generic_update_branch_cap.py`

**Edit (client):**
- `src/features/auth/utils/access-rights.ts` — drop `USERS_MANAGE_OWN_BU`.
- `src/features/super-admin/components/seed-roles-dialog.tsx` — drop its preview row (line 49).
- `src/features/super-admin/types/index.ts` — drop `SubscriptionTierType`, `ClientType.subscription_tier`.
- `src/features/super-admin/components/edit-client-dialog.tsx` — drop the zod field, default, `useWatch`, the `xData` line and the Select (lines ~69, 121, 147, 204, 372–374).
- `src/features/admin/components/create-business-user-dialog.tsx` — drop `branchesByBu`/`branchIdsByBu`, the loader, `handleBranchToggle`, the `branch_ids` payload key and the picker block.
- `src/features/admin/components/associate-bu-role-dialog.tsx` — same, plus `BranchRestrictionRowType` and the `GET_USER_BRANCH_RESTRICTIONS` read.
- `src/features/admin/types/index.ts` — drop `BranchType` if nothing else uses it after the two above.
- `src/features/client/components/masters/branch/branch-section.tsx` — drop `useSubscriptionTier`, `atBasicBranchCap` and the disabled Add-Branch state.
- `src/features/client/components/layout/client-explorer-panel.tsx` — drop the "Users" TreeItem and the Basic-Manager `MOBILE_NAV_ITEMS` filter.
- `src/features/client/components/layout/client-top-nav.tsx` — drop the Admin-tab filter and the "Unposted documents" bell suppression.
- `src/features/client/pages/client-admin-page.tsx` — drop the "Users" case and the Basic fallback.
- `src/lib/auth-service.ts` — drop `subscriptionTier` from both types.
- `src/features/auth/components/login-form.tsx` — drop `subscriptionTier` from the Redux user.
- `src/constants/messages.ts` — drop `INFO_MY_TEAM_DESCRIPTION`, `ERROR_MY_TEAM_ROLE_MANAGER_BLOCKED`, `INFO_BASIC_TIER_BRANCH_LIMIT`.
- `src/constants/sql-map.ts` — drop `GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME`, `UPDATE_CLIENT_SUBSCRIPTION_TIER`, `GET_USER_BRANCH_RESTRICTIONS`. **Keep** `GET_DASHBOARD_OPEN_JOBS_LIST` (unrelated).

**Edit (server):**
- `app/graphql/resolvers/bu_admin/users_roles.py` — drop `USERS_MANAGE_OWN_BU_RIGHT`, `_get_subscription_tier`, `_check_basic_tier_user_cap`, `_require_can_create_business_user`, `_validate_and_save_branch_restrictions` and all their call sites plus the `branch_ids` payload reads in `resolve_create_business_user_helper` / `resolve_set_user_bu_role_helper`.
- `app/graphql/resolvers/mutation.py` — drop `_require_basic_tier_branch_cap` (line ~150) and its call (~303); change `createBusinessUser`/`setUserBuRole` from `{"A","B"}` to `{"A"}`.
- `app/db/sql/sql_bu_admin.py` — drop `COUNT_BRANCHES`, `GET_MANAGER_BU_IDS_FOR_USER`, `COUNT_BUSINESS_USERS`, `GET_USER_BRANCH_RESTRICTIONS`, `GET_CLIENT_SUBSCRIPTION_TIER_BY_DB_NAME`, `UPDATE_CLIENT_SUBSCRIPTION_TIER`; remove `subscription_tier` from the SELECT lists at ~533, ~560, ~567.
- `app/db/seeds/seed_security_data.py` — drop right 21 and its two comment lines and the MANAGER grant.
- `app/core/exceptions.py` — drop `BASIC_TIER_USER_LIMIT`, `BASIC_TIER_ROLE_RESTRICTED`, `BASIC_TIER_BRANCH_LIMIT`.
- `app/routers/auth/helper.py`, `app/routers/auth/auth_schema.py` — drop `subscription_tier` from the client-row read and `LoginResponse`.
- `app/graphql/resolvers/reports_audit/queries.py` — drop `subscription_tier` from the clients dict (line ~410).
- `app/graphql/resolvers/auth_guards.py` — **keep** `require_user_type` (still used); only fix its docstring's stale `{"S"}` example for `createBuSchemaAndFeedSeedData`.
- `tests/test_auth_guards.py` — drop only the `createAdminUser`/tier-related cases added by `e0de387`; keep the rest.

**Generated — regenerate, don't edit:** `app/db/schema_dumps/service_plus_client.sql`,
`app/db/schema_dumps/service_plus_service.sql`, `app/db/sql/sql_bu_admin_ddl.py`,
`db/service_plus_client.sql`, `db/service_plus_demo.sql` (repo root).

**Help:** `src/features/client/components/help/help-content.ts`,
`src/features/super-admin/components/help/dev-help-content.ts`.

## Implementation

**Step 1 — Client. ✅ DONE 2026-09-26.** All four files deleted; every listed file
stripped. `pnpm exec tsc -b --noEmit` exits 0 and prettier reports all touched files
already formatted. A grep for every plan identifier (`USERS_MANAGE_OWN_BU`,
`subscriptionTier`, `subscription_tier`, `branch_ids`, `BASIC_TIER`, `UsersSection`,
`useSubscriptionTier`, `useIsAdminHiddenForBasicManager`) now returns nothing in `src/`
outside the two help files, which are Step 5.

Eight files were restored to their exact pre-plan state with `git checkout acdae74 --`,
each diffed against that commit first to confirm nothing unrelated had landed in them
since: `client-explorer-panel.tsx`, `client-top-nav.tsx`, `client-admin-page.tsx`,
`branch-section.tsx`, `edit-client-dialog.tsx`, `create-business-user-dialog.tsx`,
`associate-bu-role-dialog.tsx`, `admin/types/index.ts`. The remaining seven carry
unrelated post-plan work, so they were hand-stripped instead: `access-rights.ts`,
`seed-roles-dialog.tsx`, `super-admin/types/index.ts`, `auth-service.ts`,
`login-form.tsx`, `messages.ts`, `sql-map.ts` (`GET_DASHBOARD_OPEN_JOBS_LIST` left intact).

Two findings worth carrying forward:
- `INFO_MY_TEAM_DESCRIPTION` and `ERROR_MY_TEAM_ROLE_MANAGER_BLOCKED` were already gone —
  `d46ec9e` removed them when it reworked the Manager screen into a grid. Only
  `INFO_BASIC_TIER_BRANCH_LIMIT` remained to drop. The "Files touched" list above is
  therefore one item optimistic; no action needed.
- The client now sends no `branch_ids` and reads no `subscriptionTier`, but the server
  still returns `subscription_tier` on login and still enforces the Basic caps. Harmless
  mid-revert (the extra response field is ignored), and resolved by Step 2 — which must
  land before Step 3 drops the column.

**Step 2 — Server. DONE 2026-09-26.** Seven files restored to their exact pre-plan
state with `git checkout acdae74 --`, each diffed first to confirm it carried plan work
only: `bu_admin/users_roles.py`, `db/sql/sql_bu_admin.py`, `core/exceptions.py`,
`db/seeds/seed_security_data.py`, `routers/auth/helper.py`, `routers/auth/auth_schema.py`,
`reports_audit/queries.py`. The three scripts and two test files were deleted. A grep for
every plan identifier across `app/`, `tests/` and `scripts/` now returns nothing outside
the generated schema dumps and `sql_bu_admin_ddl.py`, which are Step 4.

`mutation.py` was hand-edited rather than checked out, because it holds both plan work and
the Step 1 guards we keep. Removed: `_require_basic_tier_branch_cap` and its call in
`resolve_generic_update`, plus the `ValidationException` / `exec_sql` / `SqlStore` imports
that only it used. Kept and narrowed, per constraints 1 and 2:

| Resolver | Guard now |
|---|---|
| `createAdminUser` | `require_user_type(info, {"S"})` |
| `createBuSchemaAndFeedSeedData` | `require_own_tenant` + `{"S", "A"}` — untouched |
| `createBusinessUser` | `require_own_tenant` + `{"A"}` (was `{"A", "B"}`) |
| `setUserBuRole` | `require_own_tenant` + `{"A"}` (was `{"A", "B"}`) |

Both helpers lost their leading `info` parameter along with the pre-plan signatures they
were restored to, and the two call sites were updated to match. Docstrings that cited
`plans/plan.md` for these rules now cite `plans/revert.md`; `auth_guards.py`'s
`require_user_type` docstring had a stale `createBuSchemaAndFeedSeedData is {"S"}` example
and now describes the actual pairing. The other `plans/plan.md` mentions left in
`mutation.py` and `auth_guards.py` refer to *earlier* plans (access control, paperless
delivery), not this one — deliberately left alone.

Three deviations from the plan text above, all deliberate:
- **`tests/test_auth_guards.py` was left untouched.** The plan expected
  `createAdminUser`/tier cases to prune here; in fact the four tests `e0de387` added all
  exercise `require_user_type` itself — the guard constraint 1 keeps. Deleting them would
  strip the only coverage protecting the retained security fix.
- **`exceptions.py` lost six messages, not the three listed.** `MANAGER_ROLE_RESTRICTED`,
  `MANAGER_BU_NOT_OWNED` and `BRANCH_NOT_IN_BU` are also plan-only and were unreferenced
  after the strip; verified by grep before removing.
- **`sql_bu_admin.py` lost eight constants, not the six listed.** `CHECK_BRANCH_IDS_EXIST`
  and `GET_BU_CODE_BY_ID` were added by the plan for branch validation and had no other
  caller.

Verification: `pytest` collects cleanly and reports **27 passed, 4 skipped**. That is the
pre-plan count exactly — plan.md's own line 79 claimed 53 tests including its 21, and
53 - 21 = 32 = 27 + 4 + 1. The +1 is
`reports_audit/test_dashboard_stats.py::test_admin_dashboard_stats_returns_expected_shape`,
which opens a real Postgres connection and fails in this sandbox; unrelated to the revert.
Two environment notes: `pytest`/`pytest-asyncio` were not installed in
`/home/sushant/projects/service-plus/env` and were installed from `requirements-dev.txt`;
and because this sandbox hard-blocks the server's settings file, the suite was run with
throwaway placeholder settings supplied as shell environment variables (nothing was read
from that file).

**Step 3 — Database migration. DONE 2026-09-26** — scripts written by me, run by the user
(confirmed done from their side; I have no DB access to verify independently).

Two files, not the one the plan sketched: tenant databases and the client registry are
separate databases, so a single psql connection cannot span both.

| Script | Run against | Does |
|---|---|---|
| `scripts/revert_user_bu_role_branch.sql` | each tenant DB (`service_plus_demo`, `service_plus_capitalgroup`) | drops `security.user_bu_role_branch`; deletes the `USERS_MANAGE_OWN_BU` right and its MANAGER mapping |
| `scripts/revert_subscription_tier.sql` | `service_plus_client`, once | drops the `client_subscription_tier_chk` constraint and the `subscription_tier` column |

```
psql "<tenant conn>"          -1 -v ON_ERROR_STOP=1 -f scripts/revert_user_bu_role_branch.sql   # x2
psql "<service_plus_client>"  -1 -v ON_ERROR_STOP=1 -f scripts/revert_subscription_tier.sql
```

Both were idempotent and safe to re-run, each with a commented-out read-only PREFLIGHT
block and a closing VERIFY block, and neither was wired into any runner.

**Both files were deleted on 2026-09-26** at the user's request, after the migration had
been run. They were never committed, so git cannot restore them — but nothing is lost that
matters: the table/column/constraint names are recorded in this document, the original
forward migrations they undo are still in git at commit `e0de387`
(`scripts/subscription_tier_schema.sql`, `scripts/user_bu_role_branch_schema.sql`,
`scripts/seed_access_right_users_manage_own_bu.sql`), and the four statements are short
enough to rewrite from the table above. If a deployed environment turns out never to have
received the migration, recreate them from that.

Details settled while writing them, so they need no decision at run time:
- The CHECK constraint really is named `client_subscription_tier_chk` — read off the
  original `subscription_tier_schema.sql` recovered from commit `e0de387`, not guessed.
- The access right is deleted **by `code`, not by the bare id 21**, so a tenant that
  seeded it under a different id is still cleaned and an unrelated id 21 is never hit.
  The mapping row goes first, since `role_access_right` references `access_right`.
- No identity-sequence reset is needed: rights 1-21 were all inserted with explicit ids
  (`OVERRIDING SYSTEM VALUE`), so the sequence never advanced past them.
- `DROP TABLE` takes the PK, the cascading `(user_id, bu_id)` FK and the index with it;
  `user_bu_role` itself is untouched, being the parent side of that FK.

Ordering constraint, restated because it is the one way this can go wrong:
`revert_subscription_tier.sql` must not run until Step 2's server changes are deployed
to whatever environment you are pointing at. Until they are, login still SELECTs
`subscription_tier` and dropping the column breaks every login instantly. Step 2 is done
in this working tree, so local is safe now; a deployed environment is only safe once it
has the new server code.

I could not run or dry-run either script myself: the connection settings live in the
server's settings file, which this sandbox hard-blocks, so I have no credentials for any
of the three databases. The constraint and column names above come from the committed
migration scripts rather than from a live `\d public.client`.

**Step 4 — Regenerate.** Partly done already: the user re-ran `pg_dump` at 19:21-19:22 on
2026-09-26, right after the Step 3 migration, so all four dumps are current —
`app/db/schema_dumps/service_plus_service.sql`, `app/db/schema_dumps/service_plus_client.sql`
and the repo-root `db/service_plus_demo.sql`, `db/service_plus_client.sql`. Verified by
grep: no `user_bu_role_branch` in the service/demo dumps, no `subscription_tier` in the
client dumps. That independently confirms Step 3 actually landed in all three databases.
(Those dumps still differ from the pre-plan ones by ~43 lines of pg_dump verbosity — schema
creation, `set_updated_at()`, grants — which is a dump-flag/version difference, not plan
content. Leave it.)

`app/db/sql/sql_bu_admin_ddl.py` regenerated 2026-09-26 with
`python -m app.db.tools.extract_schema` (pure text transformation over
`app/db/schema_dumps/service_plus_service.sql` — no database connection, so it ran here
despite the blocked settings file). Output: "Wrote app/db/sql/sql_bu_admin_ddl.py
(2117 lines)".

Result is exact: 15 deletions, matching the 15 lines `e0de387` added, and
`git diff acdae74 -- app/db/sql/sql_bu_admin_ddl.py` is now **empty** — the generated file
is byte-identical to its pre-plan state. `user_bu_role_branch` and `subscription_tier`
both grep to 0 across it. Suite still green afterwards: 26 passed, 4 skipped (the
`reports_audit` dashboard test excluded, since it needs a live Postgres).

Nothing further outstanding in this step. A brand-new tenant provisioned from
`BuAdminDdl` now gets the pre-plan `security` schema, with no `user_bu_role_branch`.

**Step 5 — Both help files. DONE 2026-09-26.**

`help-content.ts` — 8 edits. Removed: the "Manager Self-Service: Users" heading and the
three blocks under it; the "Who can create a Manager?" FAQ; the
`Admin tab / Users (add Technician/Receptionist)` row from the role-comparison table; the
Basic/Pro/Enterprise note on the Business Units article; and the Branches step in
"Granting access". Three pieces of *pre-existing* text that the plan had edited in place
were restored to their exact pre-plan wording rather than rewritten from scratch (recovered
from commit `acdae74`): the "restrict a user to specific companies" FAQ, the Type A / Type B
FAQ, and the multi-BU/single-role note. Line 2924's "Users are assigned to specific
branches" was checked against `acdae74` and confirmed pre-plan — about BU scope, not this
feature — so it stays, as the plan said.

`dev-help-content.ts` — the whole `dev-manager-created-users` article deleted (119 lines,
including its blank-line separator; the Category 6 comment that followed it is intact).

The stale-sibling sweep the plan warned about found exactly one real case, and it needed
*correcting*, not deleting: the "Gap 3 (closed, 2026-09-17)" passage in the access-control
article documents the four guards constraint 1 keeps, but its text still said
`require_user_type(info, {"A", "B"})`, still promised "the real role/BU/tier rule ... see
'Manager-Created Users & Subscription Tiers' below", and still pointed at plan.md for the
BU-creation decision. Rewritten to say `{"A"}`, to record that these guards are the one
part of the feature deliberately kept (with the `{"A", "B"}` phase noted as history), to
explain why `tests/test_auth_guards.py` survives, and to cite `plans/revert.md` constraints
1 and 2 instead of plan.md. Losing this would have thrown away the security history that
justifies the guards still being there.

Two count inaccuracies were found and deliberately left: "ACCESS_RIGHT_SEED_SQL (18
access_right rows ...)" and "the six access-right codes". Both were verified present in
`acdae74`, so they predate the plan — a revert should not quietly rewrite unrelated docs.
Nothing anywhere still refers to access right id 21. The Free/Pro/Enterprise "tier"
mentions in the architecture and provisioning articles are also pre-plan (a separate,
older product concept, unrelated to the `subscription_tier` column) and were left alone.

Verified: `pnpm exec tsc -b --noEmit` exits 0, prettier reports both files unchanged.

**Step 6 — Verify. DONE 2026-09-26 (automated part).**

| Check | Result |
|---|---|
| Full-repo grep, all 20+ plan identifiers, `dev/` + `db/` | nothing outside the two revert scripts |
| Semantic sweep ("team member", "own business unit", "one business user", "Technician or Receptionist", "Basic/Pro", …) | nothing |
| `pnpm exec tsc -b --noEmit` | exit 0 |
| `pnpm build` | built in 5.67s |
| `pnpm exec prettier --check` | all matched files clean |
| `pytest` (server) | 26 passed, 4 skipped |
| `pnpm lint` | fails to load its own config — pre-existing breakage, noted in plan.md's Testing section and CLAUDE.md; not caused by this revert |

**The audit caught a Step 1 miss, now fixed.** Diffing every remaining file against `acdae74`
showed `messages.ts` still two lines ahead of pre-plan: `INFO_USERS_DESCRIPTION` and
`ERROR_USERS_ROLE_MANAGER_BLOCKED`. Commit `d46ec9e` had *renamed* the `MY_TEAM` pair rather
than deleting it, so Step 1's grep — which searched the old names, and which is also what
produced the "already gone" note in Step 1's record above — came back clean while the
renamed pair survived, orphaned after `add-user-dialog.tsx` was deleted. Both removed;
`messages.ts` is now byte-identical to pre-plan. Lesson for any future revert here: grep the
identifiers, then *also* diff every touched file against the pre-plan commit — a rename
defeats the grep.

Every file still differing from `acdae74` was then classified, and each is either kept on
purpose or unrelated work that must stay:
- **Kept plan work (constraints 1 and 2):** `auth_guards.py`, `mutation.py`,
  `tests/test_auth_guards.py`, and the "Gap 3" passage in `dev-help-content.ts`.
- **Kept, adjacent, never part of plan.md:** `business-users-page.tsx` (Admin grid rework),
  `seed_bu_data.py` + the numbering/auto-series help text (`a72d7df`).
- **Unrelated:** the Dashboard rebuild (`dashboard-section.tsx`,
  `open-jobs-by-product-dialog.tsx`, `sql_reports_audit.py`, `sql-map.ts`'s
  `GET_DASHBOARD_OPEN_JOBS_LIST`, and their help articles), the Extended Warranty recolour,
  `client-activity-bar.tsx`, and ~46 lines of pg_dump verbosity in the four dumps.
- `help-content.ts` now differs from pre-plan **only** by unrelated content; every plan
  paragraph is gone.

**Browser checks — ALL 4 PASS, 2026-09-26.** Run against the live demo environment through
the user's own Chrome, across three logins they provided in turn (Admin `capitalch` type `A`,
`superadmin` type `S`, and `demo1` type `B` / MANAGER), all on `service_plus_demo`.

| # | Check | Result |
|---|---|---|
| 1a | Admin Mode → Business Users → Add Business User | PASS — fields are Full Name / Username / Email / Mobile / Business Unit / Role. Ticked BU `demo1` to trigger the old lazy branch fetch: no Branches list, and `/branch/i` matches nothing in the dialog. |
| 1b | Same page → row menu → Associate BU / Role | PASS — opens with `demo1` already checked (the state that used to fire the fetch); labels are Business Units / demo1 / Demo2 / Role only. |
| 2 | Super Admin → Clients → Edit Client | PASS — Code, Name, Email, Phone, GSTIN, PAN, Address 1/2, City, State, Pincode, Country Code, Active. No tier field, no combobox at all, no tier/plan wording. Client rows carry no tier chip either. |
| 3 | Manager: no Users item | PASS — Client Mode → Admin shows `Post / Unpost` alone, no `Users`, and no "Not available on your plan." fallback. The Admin tab is present in the top nav, and the bell's "Unposted documents" entry is back (both were suppressed for Basic Managers under the plan). |
| 4 | Basic one-branch cap gone | PASS — `demo1` has **10** branches and Add Branch is `disabled: false`, `title: null`. Under the cap it was disabled with the one-branch tooltip, so a 10-branch BU is a strong negative test. |

The Manager login is the single most decisive artifact of the whole revert. Its stored user
object reads: `userType: "B"`, `roleCode: "MANAGER"`, `rightsCount: 20`,
`accessRights.includes("USERS_MANAGE_OWN_BU") === false`, and
`hasOwnProperty("subscriptionTier") === false`. The right count of exactly 20 (it was 21)
confirms Step 3's migration landed and that nothing has re-granted the right; the absent
`subscriptionTier` exercises the whole Step 2 login path — `GET_CLIENT_DB_NAME`,
`LoginResponse`, `auth-service.ts`, `login-form.tsx` — which no static check could prove.
All three logins came back without the tier field.

**Unintended write, disclosed.** While on the Super Admin login I opened
"Seed Roles + Access Rights" on the `demo` client expecting a read-only preview of the rights
list. It is not read-only: it auto-advances and executes immediately, and it completed
("Access Rights Upgraded!") before it could be stopped. It should have been confirmed with
the user first. Impact, verified rather than assumed: the seeder runs from the restored
`seed_security_data.py`, which contains rights 1-20 only (grep for `USERS_MANAGE_OWN_BU` and
`(21,` both return 0; the MANAGER mapping ends at `(1, 20)`), and it is `ON CONFLICT DO
NOTHING` over rights that already existed — so it could not reinsert right 21 and changed
nothing. The Manager login above independently confirms this: 20 rights, no
`USERS_MANAGE_OWN_BU`. Silver lining worth keeping: this accidentally proved that re-running
the Seed Roles tool — the very mechanism by which existing tenants received the right —
cannot resurrect it.

## Testing

- Type-check + build (`pnpm exec tsc -b --noEmit`); the linter is broken in this repo, so
  that is the real check.
- Full server `pytest` after removing the two plan test files.
- Log in as Manager (`user3`, tenant `demo`) — Admin tab present, no "Users" item, no error.
- Admin → Business Users → Add Business User and Associate BU / Role both save with no
  `branch_ids` in the payload.
- Add a second branch to any BU — succeeds regardless of the (now absent) tier.

## Flags and constraints

- **Kept deliberately (1): Step 1's guards.** `require_user_type` on `createAdminUser`
  (`{"S"}`) and on `createBusinessUser`/`setUserBuRole` (narrowed back to `{"A"}`) stays.
  These close a genuine privilege-escalation hole that existed before the plan; plan.md
  itself calls Step 1 "worth doing even on its own". Confirmed 2026-09-26 — settled, not
  revisited by this revert.
- **Kept deliberately (2): BU creation stays open to tenant Admin.**
  `createBuSchemaAndFeedSeedData` keeps `require_own_tenant` + `{"S","A"}` — this was the
  2026-09-18 reversal made at your direction, and it is the only working path to create a
  BU. Re-confirmed 2026-09-26 — settled.
- **Kept deliberately (3): the two grid reworks.** Admin → Business Users
  (`features/admin/pages/business-users-page.tsx`, `6a42868`) is a UI improvement plan.md
  never asked for and has no tier/branch code in it. The Manager-side grid
  (`users-section.tsx`) *is* a plan feature and is deleted.
- **Unrelated work riding the same commits — do not touch:** the Dashboard rebuild
  (`dashboard-section.tsx`, `open-jobs-by-product-dialog.tsx`, `GET_DASHBOARD_OPEN_JOBS_LIST`,
  `sql_reports_audit.py`), and the pre-existing tenant/BU ownership fix (`8a8fcf2`).
- **Step 3 is destructive and irreversible.** Any branch restriction a user has actually
  set, and every client's tier value, is lost. Nothing reads them after Step 2, but if you
  want them recoverable, dump both before dropping.
- `subscription_tier` is only carried on the login response, never refreshed mid-session —
  so after Step 2 ships, sessions logged in beforehand keep a stale field on the Redux user
  until they log in again. Harmless (nothing reads it), worth knowing.
- `plans/plan.md` itself is left in place as the historical record; this file is the revert.
