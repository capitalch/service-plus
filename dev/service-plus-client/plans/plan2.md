# Plan 2 — A fixed "Main" division for every branch; Trace+ off by default

Source: `plans/prompt2.md`. Design only; nothing implemented. Written 2 Oct 2026. Revised 2 Oct 2026: the default division is marked by a new column `division.is_default`, one per branch. Must be built **before** continuing with `plans/plan.md` (Steps 7 onward); it changes plan.md Steps 9, 10 and 12, and Step 9 below updates their wording.

## Goal

- Every branch always has at least one division.
- Creating a branch also creates a division named **Main** (code `MAIN`) in the same save. Main copies the branch's address, city, state, pincode, phone, email and GSTIN.
- Main is the branch's **default division** (`is_default = true`). It cannot be deleted or deactivated. Its name, address and other details stay editable.
- A new BU's Head Office also gets its Main division, with **id 1**.
- `post_data_to_accounts` is **false** for new BUs. While it is false the division Trace+ (accounts) settings are hidden, and a division can be added or edited and saved without them.
- Existing customers keep working: their divisions and their Trace+ setting stay as they are.
- Decided: new column `division.is_default` marks the default division of each branch (2 Oct 2026).

## Present context and current design

**Divisions today**
- `division` table in each BU schema. `id` is a plain `bigint` primary key with no auto-number. The Add Division form asks for the id and suggests `MAX(id) + 1` (`GET_NEXT_DIVISION_ID`).
- Code and name are unique within a branch.
- `division_branch_id_fkey` has no `ON DELETE` action, so a branch that still has divisions cannot be deleted.
- Nothing creates a division automatically, and nothing marks one division of a branch as its default.

**Branches today**
- New BU: `SeedBuData.BU_SEED_SQL` (`seed_bu_data.py`) inserts the `HO` branch with a placeholder address and **no division**.
- Add Branch (`masters/branch/add-branch-dialog.tsx`) inserts a `branch` row through `genericUpdate`; no division is created.
- Delete Branch checks `CHECK_BRANCH_IN_USE` and then deletes the row. The check ignores divisions, so deleting a branch that has divisions fails with a general error.

**Default division today**
- App setting `default_division_id` (id 4, value `1`), one value for the whole BU. The client reads it into Redux `defaultDivisionId` (`use-bu-branch-division-actions.ts`).
- It is used to pick the current division when a branch has more than one, and to pre-fill `division_id` on new jobs, batch jobs, opening jobs, and purchase and sales invoices.
- On any branch other than the one owning division 1, it points at another branch's division.
- App Settings warns when the value matches no active division.

**Trace+ setting today**
- The seed sets `post_data_to_accounts` = `true` (id 9). A missing row is treated as false by the client.
- Add Division and Edit Division already hide the **Accounts** tab when the setting is false.
- Edit Division has two bugs while it is false:
    - It still loads the stored `account_setting` and validates it. An incomplete stored value makes the save fail, and `onInvalid` switches to the hidden tab, so the user is stuck with no visible reason.
    - A successful save writes `account_setting = null`, silently erasing the division's Trace+ setup.

**Live data (read-only check, 2 Oct 2026)**

| Database / BU | Branches | Divisions |
|---|---|---|
| capitalgroup / capitalelectronics | HO | 1 CAPITAL, 2 SANJEEVANI |
| capitalgroup / navtechnology | HO | 1 NAV |
| demo / demo1 | 10 | 1 and 2 on HO (branch 2); **9 branches have none** |
| demo / demo2 | HO | **none** |
| customers / dummy | HO | **none** |

Every BU has `default_division_id = 1`, `post_data_to_accounts = true`, and `app_setting` ids 1–16 with no gaps.

## New design brief

- New column `division.is_default`, at most one per branch; deleting a branch also deletes its divisions. (Step 1)
- BU seed creates Head Office's Main with id 1 and `is_default`; `post_data_to_accounts` defaults to false. (Step 1)
- A one-off script marks a default in every existing branch, adds Main where a branch has none, and retires `default_division_id`. (Step 1, Your Part B)
- A new `addBranch` mutation inserts the branch and its Main in one transaction. `genericUpdate` refuses branch inserts and any change that would delete, deactivate or move the default. (Step 2)
- Division queries return `is_default`. (Step 3)
- Add Branch screen uses `addBranch`. (Step 4)
- Divisions screen shows a **Default** badge and offers no Delete or Deactivate for it. (Step 5)
- The default division comes from the current branch, not from an app setting. (Step 6)
- Edit Division saves without Trace+ settings and keeps any stored ones. (Step 7)
- Help files and plan.md updated. (Steps 8, 9)

## Key constraints

1. **Only one division in a BU can have id 1.** `division.id` is the primary key of the whole BU schema, and jobs, invoices and document sequences refer to it.
   **Resolution:** Head Office's Main in a new BU gets id 1; every other Main gets the next free id. The default is marked by `is_default`, not by the id. A unique partial index allows at most one default per branch (Steps 1, 2).
2. **`default_division_id` duplicates `is_default`,** and as one BU-wide value it is already wrong on every branch except one. Keeping both would give two sources of truth.
   **Resolution:** retire the setting. The default division is the current branch's `is_default` division. The row is deleted and the rows after it move down by one (ids 5–16 become 4–15), so App Settings shows no gap. Nothing reads `app_setting.id`; every reader uses `setting_key` (Steps 1, 6).
3. **"Whenever a branch is created" needs one entry point,** or a `genericUpdate` insert could still make a branch without a division. No database triggers (decided in plan.md).
   **Resolution:** server mutation `addBranch` creates the branch and Main in one transaction. `genericUpdate` refuses any `branch` insert, including inserts nested inside `xDetails`. plan.md Step 12 later only adds its lock and branch limit to this mutation (Steps 2, 9).
4. **Division ids are not auto-numbered,** so two branches added at the same moment could both pick `MAX(id) + 1`.
   **Resolution:** inside the `addBranch` transaction, lock the `division` table (`LOCK TABLE division IN SHARE ROW EXCLUSIVE MODE`) before reading `MAX(id)`. The lock lasts only for that short transaction (Step 2).
5. **"Cannot be deleted" must hold on the server, not only on screen.**
   **Resolution:** `genericUpdate` refuses, for a default division: `deletedIds`, `is_active = false`, and a change of `branch_id`. It refuses any payload that sets `is_default` at all, so the flag is written only by `addBranch`, the seed and the script. Deactivation is blocked too, so the branch always has an active division to pick (Step 2).
6. **Every branch now has a division, so Delete Branch would always fail** on the foreign key.
   **Resolution:** change `division_branch_id_fkey` to `ON DELETE CASCADE`. `CHECK_BRANCH_IN_USE` already refuses a branch with jobs or invoices, and the foreign keys from job, sales invoice and purchase invoice to division still block the delete if any division has history. Head Office still cannot be deleted (Step 1).
7. **Existing branches: some have no division, others have divisions with other names.**
   **Resolution:** existing divisions are not renamed. The script marks one existing division per branch as default, in this order:
    - the division named by `default_division_id`, if it belongs to that branch;
    - otherwise the lowest-id active division;
    - otherwise the lowest-id division.

   A branch with no division gets a new Main, copied from the branch, with `is_default`. In the live data CAPITAL and NAV become defaults, and Main is added to 9 demo1 branches and to HO in demo2 and dummy (Step 1).
8. **The copy from the branch is made once.** Later branch edits do not change Main.
   **Resolution:** accepted. Sign-up approval (plan.md Steps 9, 10) sets HO's city and GSTIN after seeding, so it must update Main the same way (Step 9).
9. **Turning Trace+ off must not erase Trace+ data.**
   **Resolution:** while the setting is off, Edit Division neither validates nor sends `account_setting`, so the stored value stays. Add Division saves `null` as today. Existing BUs keep `true`; only the seed default changes (Step 7).

## Steps

How to read: Step 0 holds what you can do now; the database run sits right after Step 1 and the final check after Step 9. Inside a step, build the server first, then the client. House rules: tabs, `pnpm format`; text longer than two words in `messages.ts` / `AppMessages`; red only for errors; both help files updated (Step 8).

### Step 0 — Your Part: what you can do now

| Part | What | Where | When |
|---|---|---|---|
| A | Confirm the remaining decisions | here | ✅ done |
| B | Back up and run the division script | after Step 1 | ✅ done |
| C | Check in the app | after Step 9 | ✅ done |

**✅ A — Confirm the remaining decisions — agreed 2 Oct 2026.**
1. ✅ `is_default` column marks the default; id 1 only for HO's Main in a new BU (decided 2 Oct 2026).
2. `default_division_id` is retired and app_setting ids 5–16 become 4–15 (constraint 2).
3. A default division can be edited but not deleted or deactivated (constraint 5).
4. Deleting a branch also deletes its unused divisions (constraint 6).
5. Existing divisions keep their names; Main is added only to branches with no division (constraint 7).
- **Done when:** you reply "agreed" or say what to change.

### ✅ Step 1 — Database: column, seed and the script for existing BUs — built 2 Oct 2026
**Needs:** Your Part A.

**Where:**
- `service-plus-server/app/db/sql/sql_bu_admin_ddl.py` (`BU_SCHEMA_DDL`)
- `service-plus-server/app/db/seeds/seed_bu_data.py`
- new `service-plus-server/app/db/sql/sql_divisions.py`
- new `service-plus-server/scripts/run_default_division_ddl.py`

**Build:**
- **`BU_SCHEMA_DDL`:**
    - In `CREATE TABLE division`, add `is_default boolean DEFAULT false NOT NULL`.
    - Add `CREATE UNIQUE INDEX division_one_default_per_branch ON division USING btree (branch_id) WHERE is_default;`.
    - Foreign key, old: `FOREIGN KEY (branch_id) REFERENCES branch(id);` new: `FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE CASCADE;`
- **Seed (`BU_SEED_SQL`):**
    - Right after the `HO` insert, add Main:
      ```sql
      INSERT INTO division (id, branch_id, code, name, address_line1, address_line2, city, state_id,
                            pincode, phone, email, gstin, is_default)
      SELECT 1, b.id, 'MAIN', 'Main', b.address_line1, b.address_line2, b.city, b.state_id,
             b.pincode, b.phone, b.email, b.gstin, true
      FROM branch b
      WHERE b.code = 'HO' AND NOT EXISTS (SELECT 1 FROM division d WHERE d.branch_id = b.id);
      ```
    - In `app_setting`: remove `(4, 'default_division_id', …)` and renumber the rows after it as 4–15.
    - `post_data_to_accounts`: old `'true'`, new `'false'`.
- **Script SQL** (`DivisionSql.DEFAULT_DIVISION_DDL`), run once per BU schema, safe to run twice, in order:
    1. `ALTER TABLE division ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false NOT NULL;`
    2. Create the unique partial index `IF NOT EXISTS`.
    3. Drop `division_branch_id_fkey` `IF EXISTS` and add it again with `ON DELETE CASCADE`.
    4. Mark one default in each branch that has none, by the order in constraint 7, in one `UPDATE … FROM (SELECT DISTINCT ON (branch_id) …)`. `default_division_id` is read here, before step 6 deletes it.
    5. For each branch with no division, insert Main copied from the branch with `is_default` true and `id = MAX(id) + row_number()` (ids start at 1 when the BU has no divisions).
    6. Delete the `default_division_id` row; then, in id order, move each row with `id > 4` down by one, guarded by `NOT EXISTS` on the target id (memory "no id gaps"). A `DO` block loop, not a trigger.
- **Runner** (`run_default_division_ddl.py`, modelled on `run_signup_billing_ddl.py`):
    - Covers every database in `public.client`, plus `service_plus_service` when it exists.
    - In each database, covers every schema that has a `division` table.
    - Each schema runs in its own transaction with `SET LOCAL search_path TO <schema>`.
    - `--dry-run` only lists targets.
    - Prints one line per schema, the default chosen per branch and each Main added, and ends with "Done: N ran, M failed".

**As built:** the dry run lists exactly those five schemas (`service_plus_service` is not on this server, so it is skipped). The script SQL was exercised twice on throw-away temp tables in a rolled-back transaction. The results: the setting's division was picked, an active division was preferred over a lower-id inactive one, Main copied city and GSTIN, a second run changed nothing, app_setting ended at 1–15, deleting a branch cascaded to its Main, and a second default in a branch was refused. Help: a new developer article `dev-default-division`; `extended_warranty` is now id 15; the client help covers the Main division and the Trace+ default. `tsc -b` passes.

**Done when:** the dry run lists capitalelectronics, navtechnology, demo1, demo2 and dummy. A new BU created on a dev database has `HO` with Main as id 1 and `is_default` true, `post_data_to_accounts` false, and app_setting ids 1–15.

### ✅ 🧑 Your Part B — Back up and run the division script — done 3 Oct 2026
**As done:** the script ran successfully. A read-only check of all five BUs found exactly one default per branch, no branch without a division, app_setting ids 1–15 with no `default_division_id`, and the cascading foreign key. capitalelectronics → 1 CAPITAL, navtechnology → 1 NAV, demo2 and dummy → 1 MAIN; demo1's 10 branches each have one default. The client types were regenerated (`division.is_default`). The template dump was re-taken from `service_plus_demo` (demo1 + security), and `sql_bu_admin_ddl.py` was regenerated from it. That also brought in the plan.md Step 5 billing columns, which had never been regenerated into it. `tsc -b` passes.

**Needs:** Step 1.
1. Back up `service_plus_capitalgroup`, `service_plus_demo`, `service_plus_customers`, and `service_plus_service` if you have it.
2. From `service-plus-server/`, inside the venv, run `python scripts/run_default_division_ddl.py --dry-run` and check the targets.
3. Run `python scripts/run_default_division_ddl.py`.
4. Tell Claude. Claude regenerates the client types (`pnpm gen-types-all`), refreshes the schema dump, and checks every BU read-only: exactly one default per branch, no branch without a division, app_setting ids 1–15.

**Done when:** the script ends with 0 failed and existing users can still create a job.

### ✅ Step 2 — Server: `addBranch` and the `genericUpdate` guards — built 3 Oct 2026
**As built:**
- `addBranch` also requires `MASTERS_MENU`, the same right `genericUpdate` already demands for the `branch` table.
- The payload walk skips an empty `xData` (`{}` beside `deletedIds`), because `process_details` writes nothing for it. Without this, Delete Branch would have been mistaken for an insert.
- The guards and SQL live in `resolvers/masters/branches.py` and `sql_divisions.py` (`LOCK_DIVISION_TABLE`, `INSERT_MAIN_DIVISION_FOR_BRANCH`, `GET_DEFAULT_DIVISION_IDS`).
- Tests: the new `tests/test_branches.py` has 15 tests. The payload guards are tested directly, and the default-division lookup with a stubbed database. All 196 server tests pass, and `addBranch` is in the built schema.
- The addBranch SQL was exercised on temp tables in a rolled-back transaction: Main copied city, phone and GSTIN with `is_default`, the lookup found only the default ids, and deleting the branch removed its Main.
- Not tested: two simultaneous adds. That needs two sessions on a shared table, so it relies on the standard table lock.
- **Until Step 4 is built, the Add Branch dialog is refused** (its `genericUpdate` insert hits `BRANCH_INSERT_VIA_ADD_BRANCH`).
- Help: the developer article gained the three server pieces; the client Divisions article says the default cannot be deleted or deactivated.

**Needs:** Step 1, Your Part B.

**Where:**
- new `service-plus-server/app/graphql/resolvers/masters/branches.py` (with `__init__.py`)
- `service-plus-server/app/graphql/schema.graphql`
- `service-plus-server/app/graphql/resolvers/mutation.py`
- `service-plus-server/app/db/sql/sql_divisions.py`
- `service-plus-server/app/exceptions.py` (`AppMessages`)
- `service-plus-server/tests/test_auth_guards.py`

**Build:**
- **`addBranch(db_name, schema, value): Generic`.**
    - `value` carries the fields the Add Branch dialog sends today: `code`, `name`, `address_line1`, `address_line2`, `city`, `state_id`, `pincode`, `phone`, `email`, `gstin`.
    - Guards: `require_own_tenant`, then `require_bu_access`.
    - One transaction on one connection:
        1. Insert the branch (`get_insert_sql` from `psycopg_driver.py`) and return its id.
        2. Lock the division table (constraint 4).
        3. `INSERT_MAIN_DIVISION_FOR_BRANCH`: the same select-from-branch insert as the seed, with `id = COALESCE(MAX(id), 0) + 1`, code `MAIN`, name `Main`, `is_default` true.
        4. Commit and return `{branchId, divisionId}`.
    - A duplicate branch code or name returns the existing friendly message.
- **Guards in `resolve_generic_update`**, run before the helper:
    - `_refuse_branch_insert(value)`: walks the payload, nested `xDetails` dicts and lists included. Any `branch` row without `id` → `BRANCH_INSERT_VIA_ADD_BRANCH`.
    - `_refuse_default_division_change(db_name, schema, value)`:
        - Any `division` row carrying `is_default` → refused at once.
        - Ids in `deletedIds`, or in rows setting `is_active` false or changing `branch_id`, are checked with `GET_DEFAULT_DIVISION_IDS` (`SELECT id FROM division WHERE id = ANY(%(ids)s) AND is_default`); any match → `DEFAULT_DIVISION_LOCKED`.
    - Both apply to every user type, so there is one door.
- **`AppMessages`:**
    - `BRANCH_INSERT_VIA_ADD_BRANCH`: "Branches are added through Add Branch only."
    - `DEFAULT_DIVISION_LOCKED`: "The default division of a branch cannot be deleted or deactivated."
- **Tests:**
    - `addBranch` creates one branch and one default Main.
    - A `genericUpdate` inserting a branch, top-level or nested, is refused; a branch edit passes.
    - Deleting or deactivating a default division is refused; a non-default division passes; a payload setting `is_default` is refused.
    - Deleting a branch just made by `addBranch` (`genericUpdate` with `deletedIds` on `branch`) passes and removes its Main through the cascade; the division guard does not fire, because the payload names only the branch.
    - The Step 1 guard walk (plan.md) covers `addBranch`.

**Done when:** all of the above pass, and two simultaneous `addBranch` calls get different division ids.

### ✅ Step 3 — Server: division queries return `is_default` — built 3 Oct 2026
**As built:** checked read-only on capitalelectronics: both branch lists return CAPITAL (default) first, then SANJEEVANI; `GET_DIVISION_BY_ID` returns `is_default`.

**Needs:** Your Part B.

**Where:** `service-plus-server/app/db/sql/sql_bu_admin.py`.

**Build:**
- Add `d.is_default` to `GET_DIVISIONS_BY_BRANCH`, `GET_ACTIVE_DIVISIONS_BY_BRANCH` and `GET_DIVISION_BY_ID`.
- Order both branch lists by `d.is_default DESC, d.name`, so the default is listed first.
- `accountsPosting` reads `GET_DIVISIONS_BY_BRANCH`; it only gains a column it ignores.

**Done when:** every division query returns `is_default`.

### ✅ Step 4 — Client: Add Branch uses `addBranch` — built 3 Oct 2026
**As built:** `value` is built with `encodeObj` from `lib/graphql-utils.ts`. The now-unused `SUCCESS_BRANCH_CREATED` message was removed.

**Needs:** Step 2.

**Where:**
- `src/constants/graphql-map.ts`
- `src/features/client/components/masters/branch/add-branch-dialog.tsx`
- `src/constants/messages.ts`

**Build:**
- New `GRAPHQL_MAP.addBranch` with the usual `($db_name, $schema, $value)` signature.
- `onSubmit` calls it with the same fields, `value` built as other custom mutations build it (`encodeURIComponent(JSON.stringify(...))`).
- Success toast `SUCCESS_BRANCH_CREATED_WITH_MAIN` ("Branch created with its Main division").
- Edit and delete dialogs do not change; deleting now also removes the branch's unused divisions (constraint 6).

**Done when:** an added branch appears in the list, and switching to it selects Main without asking.

### ✅ Step 5 — Client: Divisions screen protects the default — built 3 Oct 2026
**As built:** the actions menu hides Deactivate and Delete (and their separators) for the default division. The delete dialog skips the in-use check and shows `ERROR_DIVISION_DELETE_DEFAULT`. The server-message toast was not added, because the screen never offers the refused actions. A direct call still gets `DEFAULT_DIVISION_LOCKED` from the server.

**Needs:** Step 3.

**Where:**
- `src/features/client/types/division.ts`
- `src/features/client/components/configurations/division/division-section.tsx`
- `src/features/client/components/configurations/division/delete-division-dialog.tsx`
- `src/constants/messages.ts`

**Build:**
- Add `is_default: boolean` to `DivisionType` and to the `DivisionContextType` pick.
- Grid: a **Default** badge (teal outline) beside the name. For the default division the actions menu shows only **Edit**, with no Deactivate and no Delete.
- `DeleteDivisionDialog`: `blockedMessage={division.is_default ? MESSAGES.ERROR_DIVISION_DELETE_DEFAULT : null}`, as a second guard.
- A server refusal (`DEFAULT_DIVISION_LOCKED`) shows the server message in the toast.

**Done when:** the default division has no Delete or Deactivate; other divisions keep both.

### ✅ Step 6 — Client: the default division comes from the branch — built 3 Oct 2026
**As built:**
- `pickDefaultDivision(divisions)`: the `is_default` division, else the first. It sets both the current division and `defaultDivisionId`, on BU load and on branch change. A branch with several divisions now opens on its default instead of asking.
- `defaultDivisionId` stays a `number` and starts at **0** (not `null`), meaning "no division". This matches the purchase and sales form convention (`divisionId = 0`) and leaves the 14 form call sites unchanged. Job forms reject 0 (`min(1)`), so a branch without a division can no longer silently save on division 1.
- The unused `overrideDefaultDivisionId` parameter of `applyContext` was removed.

**Needs:** Steps 3, 5.

**Where:**
- `src/features/admin/hooks/use-bu-branch-division-actions.ts`
- `src/store/context-slice.ts`
- `src/features/client/components/configurations/app-settings/app-settings-section.tsx`

**Build:**
- `parseAppSettings` stops reading `default_division_id`.
- Wherever a branch's division list is loaded (`applyContext` and the branch-change handler):
    - `defaultDivisionId` = id of the active division with `is_default`, else the first division.
    - Current division: the only one if there is one, otherwise the default one.
    - Old: `divisions.find((d) => d.id === effectiveDefaultId) ?? null`
    - New: `divisions.find((d) => d.id === effectiveDefaultId) ?? divisions.find((d) => d.is_default) ?? null`, with `effectiveDefaultId` = the override if given, else the branch's default.
- `context-slice`: `defaultDivisionId` stays, its starting value changes from `1` to `null`. The job and invoice forms need no change; they already read `selectDefaultDivisionId`, which now holds the current branch's default.
- App Settings: remove the "default_division_id … does not match any active division" warning and the `isWarnRow` highlight.

**Done when:** on a branch other than HO, new jobs and invoices start on that branch's default; capitalelectronics still starts on CAPITAL; App Settings lists 15 rows with no warning.

### ✅ Step 7 — Client: Edit Division saves without Trace+ settings — built 3 Oct 2026
**As built:** as planned; Add Division's `onInvalid` got the same "only when the tab is shown" fix.

**Needs:** none (can be built any time).

**Where:**
- `src/features/client/components/configurations/division/edit-division-dialog.tsx`
- `src/features/client/components/configurations/division/add-division-dialog.tsx` (check only)

**Build:**
- In `defaultValues` and in the `form.reset` on open:
    - Old: `account_setting: buildAccountSetting(division),`
    - New: `account_setting: postDataToAccounts ? buildAccountSetting(division) : null,`
- In `onSubmit`, put `account_setting` in `xData` only when `postDataToAccounts` is true, so the stored value is left untouched while it is off.
- `onInvalid` switches to the **Accounts** tab only when that tab is shown.
- Add Division already saves `null` and hides the tab; confirm a save works with the setting off.

**Done when:** with `post_data_to_accounts` false there is no Accounts tab, Add and Edit both save, and a division that had Trace+ settings still has them after an edit (checked read-only in the database).

### ✅ Step 8 — Help files — built 3 Oct 2026
**As built:**
- Client help: the `divisions` article covers the default badge, Main for every new branch, auto-selection, no Delete or Deactivate, and Trace+ settings being kept. `vendors-branches` covers Main on add and divisions removed on delete.
- Developer help: `dev-default-division` has a client-side section and no "still to come" note. `dev-division-account-setting` covers keeping the stored value.
- A search finds no remaining reference to `default_division_id` as a live setting.

**Needs:** Steps 1–7.

**Where:**
- `src/features/client/components/help/help-content.ts`
- `src/features/super-admin/components/help/dev-help-content.ts`

**Build — client help (staff):**
- `divisions`:
    - Every branch has a **Main** default division, created with the branch from its address.
    - The default division can be edited but not deleted or deactivated.
    - The Accounts tab appears only when Post to Accounts is on.
- `vendors-branches`: adding a branch also creates its Main; deleting an unused branch also removes its divisions.
- App Settings table: `post_data_to_accounts` is off for new BUs; `default_division_id` no longer listed.

**Build — developer help:** one new article `dev-default-division`:
- The `is_default` column, its unique partial index, and the cascade foreign key.
- `addBranch`, its lock, and `INSERT_MAIN_DIVISION_FOR_BRANCH`.
- The two `genericUpdate` refusals and their message keys.
- The seed's Main with id 1; the script and its order of choice.
- How `defaultDivisionId` is now derived per branch; the retired `default_division_id` and the renumbered ids.

**Re-check stale facts:**
- `dev-division-account-setting`: Edit keeps the stored value while the setting is off.
- App-settings developer article: `extended_warranty (id 16)` becomes **id 15**; seed default of `post_data_to_accounts` is false.
- Search both files for `default_division_id`, "Head Office", "Add Branch" and "id 16".

**Done when:** no stale reference remains.

### ✅ Step 9 — Amend `plans/plan.md` — done 3 Oct 2026
**As done:** dated notes were added under Present context (business user), Step 9 part 6, Step 10 part 5, and Step 12 "Build — limit".

**Needs:** Steps 2, 4.

**Where:** `plans/plan.md`.

**Build:** append a short dated note to each step below, keeping the existing text:
- **Step 9 part 6** and **Step 10 part 5:** set city and GSTIN on `HO` **and on its Main division**.
- **Step 12:** `addBranch` and the `genericUpdate` branch-insert refusal already exist (plan2 Step 2). Step 12 adds the `security.bu` lock and the branch-limit count before the branch insert; the Add Branch client change is already done.
- **Present context:** branches are added through `addBranch`, which also creates Main.

**Done when:** plan.md matches what is built.

### ✅ 🧑 Your Part C — Check in the app — done 3 Oct 2026
**As done:** all four checks behaved as expected.

**Needs:** Your Part B and Steps 2–9.
1. In demo1, add a branch. It has Main with the branch's address and a Default badge, is selected by default, and has no Delete or Deactivate.
2. Delete that new branch; it goes, together with its Main.
3. Set `post_data_to_accounts` to false in a demo BU and reload. Add a division, edit one with Trace+ settings, and save both.
4. In capitalelectronics, create a job: CAPITAL is pre-selected and Trace+ posting still works.

**Done when:** all four behave as described.

## Files touched

- **Server:** `sql_bu_admin_ddl.py`, `seed_bu_data.py`, new `sql_divisions.py`, `sql_bu_admin.py`, new `resolvers/masters/branches.py`, `mutation.py`, `schema.graphql`, `exceptions.py`, `tests/test_auth_guards.py`, new `scripts/run_default_division_ddl.py`, schema dump.
- **Client:** `graphql-map.ts`, `messages.ts`, `types/division.ts`, `add-branch-dialog.tsx`, `division-section.tsx`, `delete-division-dialog.tsx`, `edit-division-dialog.tsx`, `use-bu-branch-division-actions.ts`, `context-slice.ts`, `app-settings-section.tsx`, both help files, generated `db-schema-service.ts`.
- **Plans:** `plans/plan.md`.

## Flags

- The script changes live customer databases (new column, default flags, Main rows, app_setting renumbering). Back up first (Your Part B).
- `ON DELETE CASCADE` relies on the foreign keys from job, sales invoice and purchase invoice to stop used divisions being lost. `purchase_invoice_division_id_fkey` is `NOT VALID` but is still enforced for new deletes.
- Division ids stay user-entered in Add Division; only Main is numbered automatically.
- If you would rather keep `default_division_id` alongside `is_default`, say so in Part A: Step 1's step 6, Step 6's settings changes and the renumbering in Step 8 then drop out, and the setting only seeds the script's choice.
