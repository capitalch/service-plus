# Plan 1: a job's branch must always match its division's branch

## Goal
- `job` stores both `branch_id` and `division_id`. A division belongs to exactly one branch, so `branch_id` is redundant information.
- **Decision: keep `job.branch_id`, but make the database guarantee that it equals the branch of the job's division.** Removing it was considered and rejected, for three reasons:
  - about 75 SQL filters use `j.branch_id`;
  - the job number is unique per branch (`UNIQUE (branch_id, job_no)`);
  - every job-creation screen writes it.
- **Outcome:** no query, report, screen or payload changes. The change is one constraint per tenant schema, so a job whose branch disagrees with its division can never be saved.
- `purchase_invoice` and `document_sequence` follow the same pattern. They are **not** part of this plan; see "Later".

## Present context and current design
- **`job` table** (`app/db/schema_dumps/service_plus_service.sql`, `CREATE TABLE demo1.job`):
  - `branch_id bigint NOT NULL` with `job_branch_fk → branch(id) ON DELETE RESTRICT`, index `job_branch_idx`, and `job_branch_job_no_uidx UNIQUE (branch_id, job_no)`;
  - `division_id bigint NOT NULL` with `job_division_id_fkey → division(id)` and index `idx_job_division`.
- **`division` table:** `branch_id NOT NULL`, with `division_branch_id_fkey → branch(id) ON DELETE CASCADE`. Exactly one `is_default` division per branch.
- **Nothing ties the two job columns together.** The client always sends `currentBranch.id` plus a division picked from that branch's list, so today they agree only by convention.
- **Live data checked on 2026-10-08 (read-only):** 0 mismatches in `service_plus_capitalgroup.capitalelectronics` (322 jobs), `service_plus_capitalgroup.navtechnology` (207) and `service_plus_demo.demo1` (414).
- **Moving a division:**
  - There is no UI to move a division to another branch (`branch_id` is set only at creation).
  - `refuse_default_division_change` (`resolvers/masters/branches.py`) blocks moving a default division through `genericUpdate`.
  - A non-default division could still be moved by a hand-built `genericUpdate`, which would silently orphan its jobs' `branch_id`.
- **The plan-downgrade check** (`_blocking_branches` in `resolvers/bu_admin/billing.py`) counts rows per branch by reading every FK that points at `branch` (`GET_BRANCH_FOREIGN_KEYS`). The new FK points at `division`, so it doesn't show up there, and `job_branch_fk` stays. Counts are unchanged.

## New design brief
- A unique key `(id, branch_id)` on `division` → Step 1
- A composite foreign key `job (division_id, branch_id) → division (id, branch_id)` → Step 1
- A runner script that applies it to every tenant schema and the template → Step 2
- Regenerated DDL constant → Step 3
- Developer help article → Step 4

## Key constraints
1. **Existing bad rows would make the FK fail halfway.** Resolution: the migration first counts mismatched jobs in that schema. If any exist, it raises an error naming the count and that schema is skipped untouched (it runs in its own transaction). Fixing such rows is a human decision; live data has none today.
2. **A composite FK needs a unique key on exactly the referenced columns.** Resolution: add `division_id_branch_uidx UNIQUE (id, branch_id)` on `division`. `id` is already unique, so the key is always satisfied; it exists only as an FK target.
3. **The script must be safe to run twice.** Resolution: each `ADD CONSTRAINT` sits in a `DO $$` block that checks `pg_constraint` first.
4. **Moving a division that has jobs must not silently break them.** Resolution: the FK uses the default `ON UPDATE NO ACTION`, so changing `division.branch_id` while jobs reference it is refused. A division without jobs can still move.
5. **Deleting a branch must behave as before.** Resolution: the branch → division cascade already stops at `job_division_id_fkey` when jobs exist. The new FK adds the same check, so nothing changes. `job_division_id_fkey` is kept; it is redundant but harmless, and dropping it is not needed.
6. **Users must never see a raw FK error in normal use.** Resolution: every job screen sends a matching pair, so the FK can only fire on a bug or a hand-built payload. The generic "save failed" error is acceptable there, and no message mapping is added.

## Steps

### Step 0 — Your Part ✅
- **A:** Back up all tenant databases and `service_plus_service`. ✅

### Step 1 — Server: the constraint SQL ✅
Needs: —
- **Path:** `../service-plus-server/app/db/sql/sql_divisions.py`, class `DivisionServerSql`.
- **What:** add `JOB_DIVISION_BRANCH_FK_DDL`, which runs inside one BU schema (the search_path is set by the runner) and contains no `%`:
  1. A `DO $$` block counts `job j JOIN division d ON d.id = j.division_id WHERE d.branch_id <> j.branch_id`. If the count is above 0, it does `RAISE EXCEPTION 'N jobs whose branch differs from their division'`.
  2. A `DO $$` block adds `division_id_branch_uidx UNIQUE (id, branch_id)` on `division` if `pg_constraint` doesn't have it.
  3. A `DO $$` block adds `job_division_branch_fk FOREIGN KEY (division_id, branch_id) REFERENCES division (id, branch_id)` on `job` if it is missing.
- Also add `GET_JOB_DIVISION_BRANCH_FK`: `SELECT conname FROM pg_constraint WHERE conname IN ('division_id_branch_uidx', 'job_division_branch_fk')`. The runner prints its result as proof.
- Code (new):
  ```sql
  DO $$
  DECLARE bad bigint;
  BEGIN
      SELECT COUNT(*) INTO bad FROM job j JOIN division d ON d.id = j.division_id WHERE d.branch_id <> j.branch_id;
      IF bad > 0 THEN
          RAISE EXCEPTION '% jobs whose branch differs from their division', bad;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'division_id_branch_uidx'
                     AND conrelid = 'division'::regclass) THEN
          ALTER TABLE division ADD CONSTRAINT division_id_branch_uidx UNIQUE (id, branch_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_division_branch_fk'
                     AND conrelid = 'job'::regclass) THEN
          ALTER TABLE job ADD CONSTRAINT job_division_branch_fk
              FOREIGN KEY (division_id, branch_id) REFERENCES division (id, branch_id);
      END IF;
  END $$;
  ```
  The `%` inside `RAISE` belongs to PL/pgSQL formatting. Because the runner executes the DDL without parameters, psycopg passes it through unchanged. Confirm this in the dry run against the template (Step 2); if psycopg objects, build the message with `||` instead.

### Step 2 — Server: runner script ✅
Needs: Step 1
- **Path:** new `../service-plus-server/scripts/run_job_division_branch_fk_ddl.py`.
- **What:** a copy of `scripts/run_default_division_ddl.py` with the same flow:
  - list the tenant databases from `public.client`, plus `service_plus_service` if it exists;
  - find every schema with a `division` table;
  - run each schema in its own transaction, with `--dry-run` listing targets only, and a non-zero exit code on any failure.
- Swap `DEFAULT_DIVISION_DDL` for `JOB_DIVISION_BRANCH_FK_DDL`, and print `GET_JOB_DIVISION_BRANCH_FK` rows instead of branch defaults.
- Rewrite the docstring for this change, naming `plans/plan1.md` Your Part B as where it gets run.

### 🧑 Your Part B — Run the migration ✅
Needs: Step 2
- In `service-plus-server/`, inside the venv, run `python scripts/run_job_division_branch_fk_ddl.py`.

### 🧑 Your Part C — Re-dump the template schema ✅
Needs: Your Part B
- Re-dump `service_plus_service` into `app/db/schema_dumps/service_plus_service.sql`.

### Step 3 — Server: regenerate the BU DDL ✅
Needs: Your Part C
- **Path:** `../service-plus-server/app/db/sql/sql_bu_admin_ddl.py`, which is auto-generated, so never hand-edit it.
- **What:** run `python -m app.db.tools.extract_schema`, then check that `BU_SCHEMA_DDL` now contains `division_id_branch_uidx` and `job_division_branch_fk`. New BUs created from that DDL get the guarantee from day one.
- The client `db-schema-*.ts` types do not change, because constraints aren't part of them. No `gen-types` run is needed.

### Step 4 — Help articles ✅
Needs: Steps 1-3
- `src/features/super-admin/components/help/dev-help-content.ts`: add one article, "Job branch always matches its division". It covers:
  - why `job.branch_id` is kept: job-number uniqueness, branch filters and reports;
  - the two constraint names;
  - the migration script name and that it refuses schemas with mismatched jobs;
  - that a division with jobs can no longer change `branch_id`;
  - that `purchase_invoice` and `document_sequence` are not yet guarded.
- `src/features/client/components/help/help-content.ts`: nothing staff can see, click or switch on changes, so there is no user-facing text to add. Grep the Divisions articles for any claim that divisions can move between branches and correct it if one is found.

## Later (not in this plan)
- `purchase_invoice` has the same `branch_id` + `division_id NOT NULL` pair. It can reuse `division_id_branch_uidx` with a second composite FK: one more `DO $$` block plus a mismatch pre-check.
- `document_sequence.division_id` is nullable. A composite FK there only checks rows where `division_id` is set (default `MATCH SIMPLE`), which is the wanted behaviour.

## Verification
- `python -m py_compile` on `sql_divisions.py` and the new script; the dry run lists every schema.
- After Your Part B, read-only checks through the server venv:
  - both constraint names exist in every BU schema;
  - an `INSERT` of a job with a mismatched pair is refused. Test it inside a transaction that is rolled back, on `demo1` only.
- In the app:
  - create a single job, a batch job and an opening job, then edit and finalize one; all should save as before;
  - open the job reports and the plan-downgrade preview; they should look the same as before the change.
- Run `pnpm exec tsc -b --noEmit` (no client change expected) and `graphify update .`.
