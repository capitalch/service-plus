# Plan: move all branch contact and tax details onto the division

## Goal
- A **branch** becomes just a location label: id, code, name, is_active, is_head_office. Its address, city, state, pincode, phone, email and GSTIN are removed.
- The **division** is the only place where address, state, phone, email and GSTIN live. Anything that used to show "branch" contact details reads them from a division instead:
  - the job's own division when there is one;
  - otherwise the branch's **default division** (`is_default`).
- **Adding a branch** asks for Code, Name and an optional **Main division GSTIN**. Nothing is copied from another branch.
  - The Main division gets a **placeholder address**, which the user then edits in Configurations → Divisions.
  - Its **state** comes from the first two digits of the GSTIN when one is given. Otherwise it uses the Head Office default division's state.
- Phone and email move as well (decision). Keeping them on the branch would bring back the same duplication.
- The public website, WhatsApp messages and public PDFs keep the **same output field names**, so `service-plus-web` and `whatsapp/sender.py` need no change. Only the SQL behind those fields changes.

## Present context and current design
- `branch` table (`sql_bu_admin_ddl.py:292`):
  - It has the columns `phone, email, address_line1 NOT NULL, address_line2, state_id NOT NULL, city, pincode NOT NULL, gstin`.
  - It also has `branch_gstin_check`, `branch_state_idx` and `branch_state_fk`.
- The `division` table has the same contact columns plus `is_default`. There is exactly one default per branch.
- **Creating a branch:**
  - `addBranch` (`resolvers/masters/branches.py`) inserts the full branch row. `INSERT_MAIN_DIVISION_FOR_BRANCH` then **copies** its address and GSTIN into Main.
  - A new BU's seed (`seed_bu_data.py:177-187`) creates HO with the dummy address '123 Main St', state 29 and pincode 700001, then copies it into Main.
  - Signup and enterprise approval run `SET_HEAD_OFFICE_CITY_GSTIN` (on the branch) and `SET_MAIN_DIVISION_CITY_GSTIN` (on the division).
- **Who reads the branch columns today:**
  - Public job-intake page (`GET_JOB_INTAKE_STATUS`): `branch_address`, plus `branch_phone`, `branch_email` and `branch_gstin`. Those last three are never used, because the PDF already prints `division_*`.
  - Public delivery note PDF (`GET_JOB_DELIVERY_STATUS`): `branch_address`.
  - Public website (`GET_ACTIVE_BRANCHES` → `website_router.py`):
    - the branch dropdown shows the city;
    - `/company-info` returns phone, email and address;
    - web-order notification email goes to the branch email.
  - Five WhatsApp queries in `sql_jobs.py` (completion, creation, delivery, money receipt, invoice) read `b.phone AS branch_phone`.
  - Branch master (`GET_ALL_BRANCHES`):
    - the grid shows state, city and phone;
    - the purchase-invoice PDF falls back to the branch when no division is set.
  - Client context (`GET_BU_BRANCHES`) puts `gstin` and `gst_state_code` into `BranchContextType`. `selectEffectiveGstStateCode` returns `currentBranch.gst_state_code ?? buGstStateCode`. `buGstStateCode` and `buGstin` are never set, so that fallback is dead.
  - `CHECK_STATE_IN_USE` (State master delete guard) checks `branch.state_id`.
  - The Add and Edit Branch dialogs edit all of these fields.

## New design brief
- Branch keeps only code, name and flags → Steps 1, 8
- Add Branch asks for an optional Main division GSTIN; Main starts with a placeholder address → Steps 2, 6
- New BU seed and signup approval put the address and GSTIN on Main only → Step 3
- Public pages, website and WhatsApp read the division and keep their output names → Step 4
- Branch master and client context stop carrying contact or GST data → Steps 5, 6, 7
- One idempotent migration drops the columns in every tenant schema → Step 8, Your Part B
- Help articles → Step 9

## Key constraints
1. **Order matters.** Code that still reads a branch column fails once the column is dropped. Resolution: Steps 1-7 make the code stop reading and writing those columns while they still exist. The migration (Your Part B) runs only after that, and Step 8 regenerates DDL and types last.
2. **Every branch must have a default division before the drop.** If one is missing, its contact data is lost. Resolution: the migration first creates Main for any branch that has none, copying the branch's values while the columns still exist. Only then does it drop them.
3. **Old jobs may have no `division_id`.** Resolution: public and WhatsApp queries use `COALESCE(the job's division, the branch's default division)`.
4. **The placeholder state must match the GSTIN.** The first two GSTIN digits are a state code. Resolution: Main's `state_id` is looked up from `state.gst_state_code = LEFT(gstin, 2)`. Without a GSTIN (or with no match) it falls back to the HO default division's state.
5. **`DEFAULT_DIVISION_DDL` and the BU seed read the branch columns, so a re-run or a new BU would fail.** Resolution: Steps 2 and 3 rewrite them.
6. **External consumers (`service-plus-web`, WhatsApp templates) must not break.** Resolution: keep the output column names `branch_phone`, `branch_address`, `phone`, `email`, `city` and the address parts, and only change where they come from.

## Steps

### Step 0 — Your Part
- **A (do now):** Back up every tenant database and the `service_plus_service` template database before any migration.
- **B (after Step 7):** From `service-plus-server/` in the venv:
  1. Run `python scripts/run_branch_contact_drop_ddl.py --dry-run` and check that every schema says ok.
  2. Run it again without `--dry-run`.
- **C (after Your Part B):** Re-dump the template schema into `app/db/schema_dumps/service_plus_service.sql` the same way you normally do, so the extractor sees the new `branch`.

### Step 1 — Server: branch master stops writing contact fields
Needs: —
- `app/graphql/resolvers/masters/branches.py`:
  - `BRANCH_FIELDS` becomes `("code", "name")`, and `REQUIRED_BRANCH_FIELDS` becomes `("code", "name")`.
  - `resolve_add_branch_helper` reads an optional `main_division_gstin` from the payload. It validates it against the existing GSTIN regex and raises `ValidationException` on a mismatch. It then passes the value to `INSERT_MAIN_DIVISION_FOR_BRANCH` (Step 2).
- `app/db/sql/sql_bu_admin.py`:
  - `GET_ALL_BRANCHES` stops selecting the contact columns from `b`. It does `LEFT JOIN division dd ON dd.branch_id = b.id AND dd.is_default LEFT JOIN state s ON s.id = dd.state_id` and returns `dd.address_line1, dd.address_line2, dd.city, dd.email, dd.gstin, dd.phone, dd.pincode, dd.state_id, s.name AS state_name`, all read-only and from the default division. The output keys stay the same, so the grid and the purchase-PDF fallback keep working.
  - `GET_BU_BRANCHES` drops `b.gstin`, `s.gst_state_code` and the state join.
  - `CHECK_STATE_IN_USE` removes its `branch` arm.

### Step 2 — Server: Main division creation without copying
Needs: Step 1
- `app/db/sql/sql_divisions.py`, `INSERT_MAIN_DIVISION_FOR_BRANCH`, takes `%(branch_id)s` and `%(gstin)s`. It inserts:
  - `code 'MAIN'`, `name 'Main'`;
  - `address_line1` = placeholder text, defined as a `PLACEHOLDER_ADDRESS` constant in `sql_divisions.py` with the value 'Address to be updated';
  - `pincode NULL`, `phone NULL`, `email NULL`;
  - `gstin = NULLIF(%(gstin)s, '')`;
  - `state_id = COALESCE((SELECT id FROM state WHERE gst_state_code = LEFT(%(gstin)s, 2)), (SELECT dv.state_id FROM division dv JOIN branch hb ON hb.id = dv.branch_id WHERE hb.is_head_office AND dv.is_default), (SELECT MIN(id) FROM state))`;
  - `is_default true`.
- In `DEFAULT_DIVISION_DDL`, delete the final "create Main by copying the branch" `INSERT`, because every branch already has Main. The migration in Step 8 covers any stragglers. Keep the rest of that script as is.

### Step 3 — Server: new BU seed and signup approval
Needs: Step 2
- `app/db/seeds/seed_bu_data.py`:
  - The HO insert becomes `INSERT INTO branch (code, name, is_head_office) SELECT 'HO', 'Head Office', true …`.
  - The Main division insert carries the existing dummy values itself: '123 Main St', state 29, '700001'.
- `app/db/sql/sql_signups.py`:
  - Delete `SET_HEAD_OFFICE_CITY_GSTIN`.
  - `SET_MAIN_DIVISION_CITY_GSTIN` also sets `state_id` from `LEFT(gstin, 2)` when a GSTIN is given and a matching state exists. Otherwise it keeps the current state.
- `app/graphql/resolvers/bu_admin/signups.py` (`set_head_office_city_gstin`, used by `enterprise_enquiries.py:273` too): drop the branch update and keep only the division update.

### Step 4 — Server: public pages, website and WhatsApp read the division
Needs: Step 1
- `app/db/sql/sql_public.py`:
  - **`GET_JOB_INTAKE_STATUS`:**
    - Remove `branch_phone`, `branch_email` and `branch_gstin`.
    - Build `branch_address` from `COALESCE` of the job's division (`d`) and a new `LEFT JOIN division dd ON dd.branch_id = j.branch_id AND dd.is_default`, with the state taken from that division.
    - Update the header comment.
  - **`GET_JOB_DELIVERY_STATUS`:** build `branch_address` the same way.
  - **`GET_ACTIVE_BRANCHES`:** keep the output names (`phone, email, address_line1, address_line2, city, pincode`), selected from `LEFT JOIN division dd ON dd.branch_id = b.id AND dd.is_default`.
- `app/routers/public/job_intake_router.py`:
  - Remove `branch_phone`, `branch_email` and `branch_gstin` from `_JobIntakeData` and from its constructor.
  - Fix the docstring.
- `app/db/sql/sql_jobs.py`, the five WhatsApp queries at :1988, :2018, :2270, :2299, :2329: `branch_phone` becomes `COALESCE(d.phone, dd.phone)`, joining the job's division and the branch's default division.
- `scripts/preview_job_intake.py`: remove the three dead fields.
- No change is needed in `website_router.py`, `job_delivery_router.py` or `whatsapp/sender.py`.

### Step 5 — Client: context no longer carries branch GST data
Needs: Step 1
- `src/store/context-slice.ts`:
  - Remove `gstin` and `gst_state_code` from `BranchContextType`.
  - Remove the dead `buGstin` and `buGstStateCode` (state, initial state and any setter).
- `selectEffectiveGstStateCode` becomes: the default division's state code from `availableDivisions.find((d) => d.is_default)?.gst_state_code ?? null`. Confirm that `DivisionContextType` has `is_default`, and add it to the query if it doesn't.
- Callers (`new-sales-invoice.tsx`, `new-purchase-invoice.tsx`) stay unchanged.

### Step 6 — Client: Add and Edit Branch dialogs
Needs: Steps 1, 2
- `src/features/client/components/masters/branch/add-branch-dialog.tsx`:
  - The zod schema keeps `code` and `name` and adds `main_division_gstin`, with the same 15-character regex, optional.
  - Remove the address, state, city, pincode, phone, email and GSTIN fields, plus the state fetch and the `selectHomeStateId` default.
  - Add one input labelled "Main division GSTIN".
  - Add a note under it, as message key `BRANCH_MAIN_DIVISION_PLACEHOLDER_NOTE` in `constants/messages.ts`: "A Main division is created with a placeholder address. Complete it in Configurations → Divisions. With a GSTIN, its state is taken from the GSTIN."
  - The payload sends `code`, `name` and `main_division_gstin`.
- `edit-branch-dialog.tsx`: the form shrinks to `name` (plus the existing name-uniqueness check). `xData` becomes `{ id, name }`. Remove the states fetch.
- `branch.ts`: keep the read fields, but add a comment saying they come from the default division and are read-only. Remove nothing the grid or purchase PDF uses.
- `branch-section.tsx`: keep the State, City and Phone columns. Their source is now the default division.

### Step 7 — Client: verify the remaining readers
Needs: Steps 5, 6
- The purchase-invoice PDF fallback (`purchase-invoice-pdf-gen.ts:157-163`) keeps working, because `GET_ALL_BRANCHES` returns the same keys. No code change; just confirm.
- Run `pnpm exec tsc -b --noEmit` and fix any reference to the removed `BranchContextType` fields.

### Step 8 — Server: migration, DDL and types
Needs: Steps 1-7 (code first); Your Part B and C for the last bullets
- New `DivisionServerSql.BRANCH_CONTACT_DROP_DDL` in `sql_divisions.py`. It must be idempotent and contain no `%`:
  1. If the `branch.address_line1` column still exists, insert a Main default division for any branch that has none, copying the branch's values.
  2. `ALTER TABLE branch DROP CONSTRAINT IF EXISTS branch_gstin_check`, then `DROP CONSTRAINT IF EXISTS branch_state_fk`, then `DROP INDEX IF EXISTS branch_state_idx`.
  3. `ALTER TABLE branch DROP COLUMN IF EXISTS` for each of `phone, email, address_line1, address_line2, state_id, city, pincode, gstin`.
  4. Step 1 is wrapped in a `DO $$` block that checks `information_schema.columns`, so a re-run is harmless.
- New `scripts/run_branch_contact_drop_ddl.py`: a copy of `scripts/run_default_division_ddl.py` with the DDL constant swapped and `--dry-run` support. It covers every tenant database plus the template.
- → **Your Part B**, then **Your Part C**.
- Run `python -m app.db.tools.extract_schema` to regenerate `sql_bu_admin_ddl.py`, then `pnpm gen-types-all` in the client to refresh `db-schema-service.ts`. Re-run `tsc -b`.

### Step 9 — Help articles (both, same change)
Needs: Steps 1-8
- `src/features/client/components/help/help-content.ts`:
  - Branches article: a branch now has only a code and name. Its address, phone, email, state and GSTIN live on its divisions. Adding a branch asks for an optional Main division GSTIN.
  - Divisions Setup article (:3083): Main is no longer copied from the branch. It starts with a placeholder address to complete, and its state comes from the GSTIN. Fix :3041 too.
  - Web-order email answers (:2925, :2968): "the branch's email" becomes "the branch's default division email".
- `src/features/super-admin/components/help/dev-help-content.ts`:
  - Add one new article, "Branch is a label, division holds identity". It covers:
    - the dropped columns and the migration script name;
    - `INSERT_MAIN_DIVISION_FOR_BRANCH` and how it picks the state;
    - `PLACEHOLDER_ADDRESS`;
    - the `COALESCE(job division, default division)` rule used in public and WhatsApp SQL, and the kept output names;
    - `GET_ALL_BRANCHES` returning default-division fields read-only;
    - `selectEffectiveGstStateCode`'s new source;
    - the removal of `SET_HEAD_OFFICE_CITY_GSTIN`.
  - Fix the stale lines at :3181 (Main copies the branch) and :4183 (branch phone fallback).

## Verification
- Server: `python -m py_compile` on every touched `.py` file, and `pytest tests/test_branches.py tests/test_auth_guards.py`. Also update the `GET_BU_BRANCHES` assertion in `test_auth_guards.py:373` if it checks columns.
- After Your Part B, read-only DB checks through the server venv:
  - every branch has exactly one default division;
  - the `branch` columns are gone in every schema.
- Client: `pnpm exec tsc -b --noEmit` and `pnpm format` on touched files.
- In the running app:
  1. Add a branch with GSTIN `19…`. Check that Main exists with the placeholder address and state West Bengal.
  2. Edit the branch name.
  3. Check that the branch grid shows the default division's city.
  4. Open a public job-intake link and a delivery link, and confirm the address line appears.
  5. Call `/api/public/company-info` and `/api/public/branches` and confirm phone, email, address and city are still there.
- Run `graphify update .`.
