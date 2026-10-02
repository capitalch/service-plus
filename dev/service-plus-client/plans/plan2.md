# Plan 2 — One fixed "Main" division for sign-up customers (lt and ent)

Source: `plans/prompt2.md`. Design only; nothing implemented. Written 2 Oct 2026. Builds on `plans/plan.md` (sign-up and billing). Steps 1–6 there are built; this plan amends its Steps 9, 10 and 12, which are not built yet.

Terms (as in `plan.md`): **lt** = Lite, Basic, Standard (one BU each in the shared default customer database). **ent** = Enterprise (own client and database). **Existing** = every BU that exists today, and every BU not created through sign-up approval or Enterprise provisioning.

## Goal

- A BU created for an lt or ent customer gets one division named **"Main"** automatically, with the same mandatory values as its branch (address line 1, state, pincode, plus city/GSTIN/phone/email when the branch has them).
- The customer can **edit** that division but can **not add** another, **delete** it or **deactivate** it.
- These customers do **not post to Trace+**: the division's Trace+ (Accounts) tab, the Accounts Posting screen, Post / Unpost and the `post_data_to_accounts` setting are hidden, and the server refuses them.
- The server enforces all of it; the client only hides and explains.
- **Existing setups are not touched:** existing BUs keep any number of divisions, Trace+ configuration and posting.

## Present context and current design

**Divisions (every BU today):**
- `division` lives in each BU schema and belongs to a **branch** (`branch_id NOT NULL`, unique `(branch_id, code)` and `(branch_id, name)`, code `^[A-Z0-9_]+$`). `account_setting jsonb` holds the Trace+ mapping (client code, BU code, branch id, account ids per document type).
- `division.id` has **no default**: the add dialog reads `GET_NEXT_DIVISION_ID` (`MAX(id)+1`) and inserts with `isIdInsert`.
- `job.division_id`, `sales_invoice.division_id` and `purchase_invoice.division_id` are `NOT NULL`, so nothing can be billed without a division. That is the "at least one division is mandatory" rule.
- Per-division document sequences: `SERVICE_INVOICE`, `MONEY_RECEIPT`, `SALES_INVOICE`, `SALES_RETURN_INVOICE`, `SERVICE_RETURN_INVOICE` (`GET_DOCUMENT_SEQUENCES_BY_DIVISION`). A sales invoice fails with "SALES_INVOICE sequence not configured for this division" without one. Today the user sets them up in Configurations → Document Sequences.
- BU creation (`resolve_create_bu_schema_and_feed_seed_data_helper` → `SeedBuData.BU_SEED_SQL`) seeds the `HO` branch with placeholders (`'123 Main St'`, state 29, pincode `700001`), **no division**, app setting `default_division_id = '1'`, and `post_data_to_accounts = true`.

**Client:**
- Configurations → Divisions (`division-section.tsx`): Add, Edit, Activate/Deactivate, Delete (with an in-use check). Add and edit dialogs have a Details tab and an **Accounts** (Trace+) tab; the edit dialog shows the Accounts tab only when `postDataToAccounts` is true.
- `postDataToAccounts` comes from app setting `post_data_to_accounts` (`client-layout.tsx` → `setPostDataToAccounts`); it shows Jobs → Accounts Posting and the posted-status columns on Purchase/Sales Entry. Admin → Post / Unpost is always shown.
- App Settings lists every setting, including `post_data_to_accounts` and `default_division_id`.
- `BuContextType` (`store/context-slice.ts`) holds `code, id, is_active, name, schema_exists`, from `GET_USER_BUS` (login, business users) or `GET_ALL_BUS_WITH_SCHEMA_STATUS` (admins). The login model's `available_bus` is `list[dict]`, so new columns pass through untouched.

**Server:**
- Divisions are written only through `genericUpdate` (table `division`); no script or custom resolver inserts one.
- `accountsPosting` posts every division of a branch that has a valid `account_setting`.
- `security.bu.plan_code` (plan.md Step 5) is null for existing BUs. **But** `startClientBilling` (plan.md Step 13) will set `plan_code = 'enterprise'` on existing paying customers.

## New design brief

- A `security.bu.single_division` flag marks the BUs this applies to; it is false for every existing BU. (Steps 1, 4)
- One idempotent server helper creates the "Main" division and its document sequences for a branch, and switches posting off. (Step 2)
- Server guards on `genericUpdate` (division) and `accountsPosting`. (Step 3)
- Sign-up approval, Enterprise provisioning and `addBranch` call the helper. (Step 5)
- The client reads the flag and hides add/delete/deactivate, the Trace+ tab and the posting screens. (Steps 6, 7)
- Help files. (Step 8)
- Manual work: confirm the decisions, then run the DDL. (Step 0)

## Key constraints

1. **`plan_code` cannot be the switch.** `startClientBilling` gives existing Enterprise customers `plan_code = 'enterprise'`; keying on it would strip their extra divisions and Trace+ posting. **Resolution:** a separate `security.bu.single_division boolean NOT NULL DEFAULT false`. Only sign-up approval (plan.md Step 9) and Enterprise provisioning (Step 10) set it; later BUs of a single-division Enterprise client copy it; `startClientBilling` never touches it. Existing BUs stay false (Steps 1, 5).
2. **Divisions belong to branches, not BUs.** Standard and Enterprise allow many branches, and a job needs a division in its own branch. **Resolution:** "one Main division" means one per **branch**. The helper runs for `HO` at approval and for every branch `addBranch` creates (Steps 2, 5). Lite and Basic have only `HO`, so they get exactly one.
3. **The flag must not be writable by customers.** **Resolution:** add `single_division` to `BU_BILLING_COLUMNS` (plan.md Step 6), which `genericUpdate` refuses to everyone (Step 1).
4. **Division ids have no default.** **Resolution:** the helper locks `division` (`LOCK TABLE division IN SHARE ROW EXCLUSIVE MODE`) and inserts `COALESCE(MAX(id), 0) + 1` in one transaction. In a fresh schema, `HO`'s Main division gets id 1, matching the seeded `default_division_id = '1'` (Step 2).
5. **Without document sequences, the first invoice fails.** **Resolution:** the helper also seeds the five per-division sequences, using `document_type.prefix`, next number 1, padding 5, separator `/`, the same as the branch seed (Step 2). Decision A3.
6. **Hiding is not enforcement.** **Resolution:** `genericUpdate` refuses, for a single-division BU, a division insert (nested too), `deletedIds`, `is_active = false`, a changed `code`, and a non-null `account_setting`. `accountsPosting` is refused outright (Step 3). App setting `post_data_to_accounts` is set false at creation and hidden; even if someone sets it true, nothing can post.
7. **Existing setups must not change.** **Resolution:** every rule checks `single_division`; existing BUs are false; `BU_SEED_SQL` is not changed (it still seeds no division and posting on); nothing is backfilled.
8. **Login breaks if the BU lists name a column that does not exist yet.** **Resolution:** the `GET_USER_BUS` / `GET_ALL_BUS_WITH_SCHEMA_STATUS` change (Step 4) waits for Your Part B, which creates the column everywhere.

## Steps

How to read: Step 0 holds your part. Build steps run in order. Each has **Needs**, **Path**, **Build** (with the old and new code where it is small) and **Done when**. House rules as in `plan.md`: tabs, double quotes, `pnpm format`; text longer than two words goes in `constants/messages.ts` (client) or `AppMessages` (server); red only for errors; both help files in the same change.

### Step 0 — Your Part

**A — Confirm the decisions (before Step 1).** Each one is assumed below; say if you disagree:
1. **One Main division per branch** (constraint 2). Standard and Enterprise customers get one for every branch they add.
2. **What "edit" covers:** name, address, city, state, pincode, phone, email, website and **GSTIN** are editable; code stays `MAIN`; it can't be deactivated. GSTIN must stay editable, or a customer can't switch on GST billing on their division.
3. **Document sequences are seeded** for the Main division (constraint 5), so the first service invoice, receipt and sales invoice work without visiting Document Sequences. The customer can still change prefixes there.
4. **Admin → Post / Unpost is hidden too.** It only marks rows as posted to Trace+, which these customers never use.
5. **The flag is `single_division` on `security.bu`, not `plan_code`** (constraint 1).

**B — Run the database script again (after Step 1).** From `service-plus-server/`, in the venv:
1. `python scripts/run_signup_billing_ddl.py --dry-run`, then `python scripts/run_signup_billing_ddl.py`. It adds `single_division` everywhere and is safe to run again. Expect "Done: 5 ran, 0 failed".
2. Run `BillingServerSql.BU_BILLING_DDL` on the template `service_plus_service` by hand (as in Part D), then `pnpm gen-types-all` in the client.
3. Tell Claude. Step 4 waits for this.

**C — Check (after Step 7, on the dev server).** Set `single_division = true` by hand (SQL) on a scratch BU, for example `dummy` in `service_plus_customers`, and run `ensure_main_division` for its `HO`, or wait for plan.md Step 9 to create one. Then check the screens listed under Step 7's "Done when". Also open an existing BU and confirm nothing changed.

### Step 1 — `single_division` column (server)
**Needs:** Your Part A.

- **Explanation:** the flag that marks a BU as single-division; false for everyone today; not writable through `genericUpdate`.
- **Path:** `service-plus-server/app/db/sql/sql_billing.py` (`BillingServerSql.BU_BILLING_DDL`), `app/graphql/resolvers/auth_guards.py`, `tests/test_auth_guards.py`.
- **Code:**
    - `BU_BILLING_DDL`, in the existing `ALTER TABLE security.bu` block, add:
      ```sql
      ADD COLUMN IF NOT EXISTS single_division boolean NOT NULL DEFAULT false
      ```
    - `auth_guards.py`, old:
      ```python
      BU_BILLING_COLUMNS = frozenset({
          "billing_hold",
          ...
          "plan_code",
      })
      ```
      new: the same set plus `"single_division"` (alphabetical).
- `scripts/run_signup_billing_ddl.py` needs no change: it already runs `BU_BILLING_DDL` everywhere.
- Test: the existing `test_admin_cannot_write_bu_billing_columns` picks the new column up automatically.

**Done when:** `pytest` passes; the DDL runs twice on a scratch database.

### Step 2 — `ensure_main_division` helper (server)
**Needs:** Step 1.

- **Explanation:** the one place that creates a Main division for a branch, seeds its document sequences, and (for the BU) switches Trace+ posting off. Idempotent: it does nothing for a branch that already has a division.
- **Path:** new `service-plus-server/app/db/sql/sql_divisions.py` (`DivisionServerSql`, **not** in `SqlStore`); new `app/services/single_division.py`; `tests/services/test_single_division.py`.
- **Code (`DivisionServerSql`):**
    - `GET_BU_SINGLE_DIVISION`: `SELECT single_division FROM security.bu WHERE LOWER(code) = %(schema)s`.
    - `INSERT_MAIN_DIVISION` (runs with `search_path` = the BU schema, after `LOCK TABLE division IN SHARE ROW EXCLUSIVE MODE`):
      ```sql
      INSERT INTO division (id, code, name, branch_id, address_line1, address_line2, city, state_id,
                            country, pincode, phone, email, gstin, is_active)
      SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM division), 'MAIN', 'Main', b.id, b.address_line1,
             b.address_line2, b.city, b.state_id, 'IN', b.pincode, b.phone, b.email, b.gstin, true
      FROM branch b
      WHERE b.id = %(branch_id)s
        AND NOT EXISTS (SELECT 1 FROM division d WHERE d.branch_id = b.id)
      RETURNING id
      ```
      (`branch` has no `country` column, hence the literal `'IN'`, which is also the division column's default.)
    - `SEED_DIVISION_DOCUMENT_SEQUENCES`: for the five per-division types, `INSERT INTO document_sequence (document_type_id, branch_id, division_id, prefix, next_number, padding, separator) SELECT dt.id, %(branch_id)s, %(division_id)s, dt.prefix, 1, 5, '/' FROM document_type dt WHERE dt.code IN (...) AND NOT EXISTS (...)`.
    - `SET_POST_DATA_TO_ACCOUNTS_OFF`: `UPDATE app_setting SET setting_value = 'false' WHERE setting_key = 'post_data_to_accounts'`.
    - `SET_BU_SINGLE_DIVISION`: `UPDATE security.bu SET single_division = true WHERE id = %(bu_id)s`.
- **Code (`single_division.py`):**
    - `async def is_single_division_bu(db_name, schema) -> bool`: false for `security`, `public`, empty, or a missing row.
    - `async def ensure_main_division(cur, branch_id) -> int | None`: takes an open cursor (search_path already set to the BU), so `addBranch` can call it inside its own transaction; locks, inserts and seeds; returns the new id, or None when the branch already had a division.
    - `async def enable_single_division(db_name, bu_id, schema) -> None`: one transaction on the tenant database: set the flag, switch posting off, and `ensure_main_division` for every branch of the BU (only `HO` at creation).
- **Tests:** the SQL texts name only the BU-schema tables plus `security.bu`; `is_single_division_bu` returns false for tenant-wide schemas without a database call.

**Done when:** on a scratch BU, `enable_single_division` twice leaves one `MAIN` division per branch (id 1 for `HO` in a fresh schema), five sequences for it, `post_data_to_accounts = false`, and the flag true.

### Step 3 — Server guards
**Needs:** Step 2.

- **Explanation:** refuse what the client hides, for single-division BUs only. The rule applies to every user type, because it is a product rule, not a permission.
- **Path:** `service-plus-server/app/graphql/resolvers/mutation.py` (`resolve_generic_update`), `app/graphql/resolvers/sales_accounts/mutations.py` (`resolve_accounts_posting_helper`) or its resolver, `app/core/exceptions.py`, `tests/test_auth_guards.py`.
- **Code:**
    - New `AppMessages.SINGLE_DIVISION_LOCKED` ("Your plan has one division per branch. It can be edited, but not added, deleted or deactivated") and `AppMessages.ACCOUNTS_POSTING_NOT_IN_PLAN`.
    - New `async def require_division_write_allowed(db_name, schema, value)` in `single_division.py`. It reuses `_sql_object_nodes` from `auth_guards.py` (make it public as `sql_object_nodes`) and returns at once when no node has `tableName == "division"`. Otherwise, if `is_single_division_bu`, it refuses with `SINGLE_DIVISION_LOCKED` and a `reason` of:
        - `add`: a division row without `id`, or `isIdInsert`;
        - `delete`: `deletedIds` on a division node;
        - `deactivate`: `is_active` false;
        - `code`: `code` other than `MAIN`;
        - `accounts`: `account_setting` not null.
    - `resolve_generic_update`, old:
      ```python
      require_own_tenant(info, db_name)
      require_generic_update_access(info, schema, value)
      _require_generic_update_table_right(info, value)
      result = await resolve_generic_update_helper(db_name, schema, value)
      ```
      new: add `await require_division_write_allowed(db_name, schema, value)` after the table-right check.
    - `accountsPosting` resolver: after its guards, `if await is_single_division_bu(db_name, schema): raise ValidationException(ACCOUNTS_POSTING_NOT_IN_PLAN)`.
- **Tests** (patch `is_single_division_bu`): each refusal reason; editing name and GSTIN passes; a non-division payload never queries the flag; with the flag false every division write passes as today; `accountsPosting` is refused only with the flag.

**Done when:** the tests pass; an existing BU's Add, Delete, Deactivate and Trace+ settings still work.

### Step 4 — BU lists carry the flag (server)
**Needs:** Step 1, Your Part B.

- **Explanation:** the client needs the flag for the current BU without an extra query.
- **Path:** `service-plus-server/app/db/sql/sql_bu_admin.py`.
- **Code:** in `GET_USER_BUS`, old `SELECT b.id, b.code, b.is_active, b.name,`, new `SELECT b.id, b.code, b.is_active, b.name, b.single_division,`. In `GET_ALL_BUS_WITH_SCHEMA_STATUS`, old `b.id, b.code, b.name, b.is_active, b.created_at, b.updated_at,`, new: the same plus `b.single_division,`.
- plan.md Step 11 later adds the billing columns to the same two queries; it keeps this column.

**Done when:** login returns `single_division` on each BU (false for every existing BU); the admin BU list returns it.

### Step 5 — Call the helper from approval, provisioning and `addBranch` (amend `plan.md`)
**Needs:** Step 2.

- **Explanation:** the helper exists before the flows that need it. This step edits the text of `plans/plan.md` so those steps call it when they are built. Code only lands with them.
- **Path:** `plans/plan.md`, Steps 9, 10, 12 and 13.
- **Amendments:**
    - **Step 9** (`approveSalesEnquiry`), after part 6 (Head office): "7a. **Main division:** `enable_single_division(db_name, bu_id, bu_code)`, after the `HO` city and GSTIN are set, so the division copies them. Resumable: it is idempotent." Its "Done when" adds: "the BU has one `MAIN` division with sequences, posting off".
    - **Step 10** (`provisionEnterpriseEnquiry`), part 5: the same call for the first BU. "Later BUs": when the client's existing BUs are `single_division`, the new BU copies the flag and gets `enable_single_division` at the end of `resolve_create_bu_schema_and_feed_seed_data_helper`.
    - **Step 12** (`addBranch`): after the insert, inside the same transaction, `if single_division: await ensure_main_division(cur, new_branch_id)`. `LOCK_BU_FOR_BRANCH` also selects `single_division`.
    - **Step 13** (`startClientBilling`): add "Never sets `single_division`; existing customers keep their divisions and Trace+ posting."
    - **Step 15:** the dev help article names `single_division`.

**Done when:** `plan.md` Steps 9, 10, 12, 13 and 15 contain these bullets.

### Step 6 — Client state (flag and posting)
**Needs:** Step 4.

- **Explanation:** one selector for the flag; posting reads it in one place, so every posting screen follows without being edited.
- **Path:** `src/store/context-slice.ts`.
- **Code:**
    - `BuContextType`: add `single_division?: boolean;` (optional: a BU list cached from before the change has no field, which reads as false).
    - New selector:
      ```ts
      export const selectIsSingleDivisionBu = (state: ContextRootState): boolean =>
      	state.context.currentBu?.single_division === true;
      ```
    - `selectPostDataToAccounts`, old:
      ```ts
      export const selectPostDataToAccounts = (state: ContextRootState) => state.context.postDataToAccounts;
      ```
      new:
      ```ts
      export const selectPostDataToAccounts = (state: ContextRootState) =>
      	state.context.postDataToAccounts && state.context.currentBu?.single_division !== true;
      ```
- This alone hides Jobs → Accounts Posting, the posted-status columns on Purchase/Sales Entry, and the edit dialog's Accounts tab for single-division BUs.

**Done when:** `pnpm exec tsc -b --noEmit` passes; an existing BU behaves as before.

### Step 7 — Client screens
**Needs:** Step 6.

- **Path:** `src/features/client/components/configurations/division/division-section.tsx`, `edit-division-dialog.tsx`, `src/features/client/components/layout/client-explorer-panel.tsx`, `src/features/client/components/configurations/app-settings/app-settings-section.tsx`, `src/constants/messages.ts`.
- **Build:**
    - `division-section.tsx`: with `selectIsSingleDivisionBu`, hide **Add**, **Delete** and **Activate/Deactivate**; show a short info line under the toolbar from `MESSAGES.INFO_SINGLE_DIVISION` ("Your plan includes one division per branch. You can edit its details.").
    - `edit-division-dialog.tsx`: when single-division, make **code** read-only. The Accounts tab already hides through `selectPostDataToAccounts`, and `account_setting` is then sent as null.
    - `client-explorer-panel.tsx` (`AdminExplorer`): hide **Post / Unpost** when single-division.
    - `app-settings-section.tsx`: when single-division, leave the `post_data_to_accounts` row out of the list.
    - `messages.ts`: `INFO_SINGLE_DIVISION`; `ERROR_SINGLE_DIVISION_LOCKED` for the server answer (shown through the existing error toast).
- `add-division-dialog.tsx` and `delete-division-dialog.tsx` are unchanged, because their buttons are hidden.

**Done when:** on a single-division BU, Divisions shows one row with Edit only, the edit dialog has no Accounts tab and a fixed code, and Accounts Posting, Post / Unpost and the posting setting are gone. On an existing BU every one of these is unchanged. `pnpm exec tsc -b --noEmit` and `pnpm build` pass.

### Step 8 — Help files
**Needs:** Steps 1–7.

- `help-content.ts`: in the Divisions article (`divisions`), a section for sign-up plans: one Main division per branch, created for you, which fields can be edited, why there is no Add or Delete, and that Trace+ posting is not part of these plans. Update the Accounts Posting and Post / Unpost articles to say they don't appear on these plans.
- `dev-help-content.ts`: **one new article**, "Single-Division BUs": the `single_division` flag and why it is not `plan_code`; `ensure_main_division` / `enable_single_division` (id rule, copied branch fields, seeded sequences, posting off); the `genericUpdate` refusals and their `reason`s; the `accountsPosting` refusal; where it is called (Steps 9, 10, 12); and that existing BUs are untouched. Re-check `dev-signup-billing` and `dev-shared-db-isolation` (the `BU_BILLING_COLUMNS` list now includes `single_division`) and the accounts-posting article.

**Done when:** a grep for `BU_BILLING_COLUMNS` and "division" in both help files finds no stale statement; `tsc` passes.

## Testing (end to end, once plan.md Steps 9–12 are built)

1. Lite approval → BU with `HO` and one `MAIN` division (id 1), sequences seeded, posting off; first job, service invoice and money receipt save without visiting Document Sequences.
2. A Standard customer adds a second branch → it gets its own `MAIN` division.
3. As the customer: Divisions shows Edit only. Changing name and GSTIN works. A direct `genericUpdate` insert, delete, deactivate or `account_setting` is refused, and so is `accountsPosting`.
4. Enterprise: first BU and a later BU both single-division; `startClientBilling` on an existing customer leaves the flag false and their divisions and Trace+ posting working.
5. Regression on an existing BU (e.g. `service_plus_capitalgroup`): add, edit, deactivate and delete divisions, Trace+ tab, Accounts Posting and Post / Unpost all as before.

## Flags

- A branch inserted by hand in SQL on a single-division BU gets no Main division; run `ensure_main_division` for it.
- If a single-division customer later needs Trace+ or more divisions, that is a support action: set `single_division = false` in SQL (there is deliberately no screen for it).
