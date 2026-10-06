# Plan — Internal notes on jobs

Source: `plans/prompt2.md`, plus the chat correction of 6 Oct 2026: "only manager / admin can modify / edit notes. Other users can only append". Decisions agreed 6 Oct 2026. Steps 1–8 built and Your Part B run 7 Oct 2026; Step 9 done, including a browser run as Admin on 7 Oct 2026; what remains of Your Part C is the non-Admin check and the print check. (The previous plan in this file, the consistent Device column, is in git history, last committed 6 Oct 2026 in `8c7317f`.)

## Goal

Staff can keep private notes on a job: customer behaviour, escalations to the parent company, anything unforeseen.

- A job holds any number of notes. Each one is its own entry, showing when it was written and by whom.
- **Every user** who can open the job can read its notes and **append** a new one.
- Only an **Admin** or a **Manager** can **edit** or **delete** an existing entry, whoever wrote it. An edited entry shows that it was edited, by whom and when.
- Notes are never printed and never reach the customer: no job sheet, invoice, receipt, delivery note, WhatsApp message or job-tracking page shows them.
- Notes show up in two places:
    - an **Internal Notes** section in the Job Details window;
    - a small **"N Notes"** chip and an **Internal Notes** menu item on the job's row in Job Control.

Decisions made in this plan (Your Part A confirms them):
1. Notes live in a **new table, `job_internal_note`**, with one row per entry. They do not go into a column on `job`. Reason: a column on `job` sits next to fields that feed the printouts, so it is one careless SELECT away from being printed. It also cannot hold a time and author for each entry.
2. Appending needs **no special right**. Any signed-in user of the BU can add a note, Technician included.
3. Editing and deleting need a **new access right, `JOBS_INTERNAL_NOTES_MANAGE`** (id 21), given to the Manager role only. Admin passes every access-right check already. The app does not test for the "MANAGER" role code directly, because every other permission here is an access right.
4. "Modify" covers both **edit** and **delete**. If Admin/Manager should only edit, the delete parts (Step 3 delete mutation, Step 5 delete button) are simply dropped.
5. An edit **replaces** the text. Only the latest version is kept, marked "edited by X, <time>". The earlier wording is not kept.
6. A note can be **up to 2000 characters**.

## Present context and current design

- **Job data.** The `job` table already has free-text fields: `problem_reported`, `diagnosis`, `work_done` and `remarks`. All four reach the customer in some form: `GET_JOB_DETAIL` feeds the job sheet PDF, the Job Info PDF and the WhatsApp messages. None of them suits private notes.
- **Job history.** `job_transaction.remarks` holds one remark per status change. It appears in Transaction History and in the transaction ledger report. It is about status changes, not free notes.
- **Closest existing pattern.** Extended Warranty follow-ups. `ew_lead_event` is a history table. Its rows are written by a dedicated mutation (`addEwFollowUp`) that:
    - takes the user id from the signed-in session, never from the request;
    - writes the author's name onto the row on the server (`staff_name()` in `app/whatsapp/ew_sender.py`);
    - checks its own access right.
- **How writes are guarded today.** `genericUpdate` lets any user of a business unit write to **any** table in their BU schema, unless the table is in `GENERIC_UPDATE_TABLE_RIGHTS`. A table listed there still accepts whatever columns the request sends, author included. `SECURITY_SERVER_ONLY_TABLES` in `auth_guards.py` is the list of tables nobody may write through `genericUpdate`, at any nesting depth, Super Admin included.
- **Access rights.** Rights are rows in each tenant's `security.access_right`, linked to roles through `role_access_right`. The newest is `CUSTOM_EXTENDED_WARRANTY` (id 20). A new right has to land in four places (CLAUDE.md): the server seed, the server rights check, `ACCESS_RIGHTS` on the client, and the Seed Roles preview list. Existing tenants get it only from a delta script or by re-running Seed Roles. A user's rights are read at sign-in.
- **Rolling out schema changes.** New BU tables reach existing schemas through an idempotent script run once per BU schema (`scripts/ew_schema.sql`, `scripts/run_default_division_ddl.py`). After that the template dump, `BU_SCHEMA_DDL` and the client types are regenerated, never edited by hand.
- **Job Details window** (`jobs/job-pipeline/job-details-modal.tsx`). It loads seven queries in one `Promise.all` and shows, in order: Customer, Device, Service Information, Problem Reported, Diagnosis, Work Done, Remarks, Attachments, parts and charges, Invoice / Payments, Transaction History. It opens from Job Control, Job Pipeline, Single Job, Receipts, Deliver Job, Final a Job and several other grids.
- **Job Control** (`jobs/job-control/job-control-section.tsx`, query `GET_JOB_SEARCH_PAGED`). The Job No cell already shows small chips (Alt no, Opening, Batch, and a blue "N Files" chip from `file_count` that opens the attachments). The row has a dropdown of actions.
- **Read-only BUs.** A BU with an unpaid subscription is view-only. The server's `require_bu_writable` refuses writes, and the client's `useIsReadOnly()` disables write buttons with `MESSAGES.READ_ONLY_TOOLTIP`.

## New design brief

- New table `job_internal_note`, added to every existing BU schema by one script that also adds the new right to every tenant (Step 1, Your Part B).
- Template dump, `BU_SCHEMA_DDL` and client types regenerated (Step 2).
- Server: a read query, three dedicated mutations (add for everyone; update and delete for Admin/Manager), the table blocked from `genericUpdate`, and a note count on the Job Control query (Step 3).
- Client plumbing: right, ids, mutations, types, messages, shared date-time formatter (Step 4).
- One reusable Internal Notes panel (add for all; edit and delete per entry for Admin/Manager), plus a dialog wrapper (Step 5).
- The panel inside Job Details (Step 6), and the chip plus menu item in Job Control (Step 7).
- Both help files (Step 8), then verification (Step 9).

## Key constraints of the new design

1. **Notes must never be printed or reach the customer.** Every PDF, WhatsApp message and the job-tracking page is built from `GET_JOB_DETAIL` and similar job queries.
   **Resolution:** notes sit in their own table, and only two queries ever read it: `GET_JOB_INTERNAL_NOTES` and the count in `GET_JOB_SEARCH_PAGED`. A comment above both says "internal, never print". The panel keeps its own state and is never passed to a PDF builder. The developer help article states this as an invariant.

2. **Only Admin and Manager may edit or delete, and that has to hold on the server.** With plain `genericUpdate`, any user could update or delete any note and set any author name.
   **Resolution:** `job_internal_note` goes into `SECURITY_SERVER_ONLY_TABLES`, so `genericUpdate` refuses it for everyone. The only way in is three mutations:
    - `addJobInternalNote` checks BU access and that the BU is writable. It needs no right, because everyone may append.
    - `updateJobInternalNote` and `deleteJobInternalNote` also call `require_access_right(info, "JOBS_INTERNAL_NOTES_MANAGE")`. Admin and Super Admin pass it through the usual bypass.

3. **Appending must not be a back door to editing.**
   **Resolution:** `addJobInternalNote` only ever INSERTs. It takes `job_id`, `branch_id` and `note`, never an `id`, so it cannot touch an existing row.

4. **Author, editor and times cannot be forged.**
   **Resolution:**
    - `created_by` and `updated_by` come from `info.context["user_id"]`.
    - `created_by_name` and `updated_by_name` are filled in on the server by `staff_name()`, the same helper Extended Warranty uses.
    - `created_at` defaults to `now()`; `updated_at` is set to `now()` in the UPDATE.
    - The update never writes the `created_*` columns.
   Because names are stored on the row, the read query never joins `security."user"`, so it does not need adding to `NON_ADMIN_SECURITY_SQL_IDS`.

5. **Notes may only be added to, edited or deleted on jobs in the caller's branch.**
   **Resolution:**
    - Add is `INSERT … SELECT … FROM job WHERE id = job_id AND branch_id = branch_id`.
    - Update and delete join `job` the same way (`… USING job j WHERE n.job_id = j.id AND j.branch_id = …`).
    - When no row comes back, the mutation returns `{ ok: false, reason: "NOTE_NOT_FOUND" }`. The reason is `JOB_NOT_FOUND` for add.
   This is the same ownership check cost correction uses.

6. **Existing tenants need both the table and the right.** The table must exist in every BU schema, the `demo1` template included. The right must exist in every tenant's `security` schema.
   **Resolution:** one runner script does both, safely re-runnable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), one transaction per schema, with `--dry-run`. New tenants get the right from the seed (Step 1). New BUs get the table from the regenerated `BU_SCHEMA_DDL` (Step 2).

7. **Managers already signed in won't have the edit right yet**, because rights are loaded at sign-in. Appending works for them immediately.
   **Resolution:** the help text and Your Part C say so. It is the existing `MESSAGES.INFO_USER_MUST_RELOGIN` case.

8. **View-only BUs.**
   **Resolution:** all three mutations call `require_bu_writable`. On the client, Add, Edit and Delete are disabled when `useIsReadOnly()` is true and show `READ_ONLY_TOOLTIP`. Reading still works.

9. **Job Control must stay fast.**
   **Resolution:** the note count is a correlated `COUNT(*)` like the existing `file_count`, backed by an index on `(job_id, created_at)`.

10. **The 2000-character limit must hold everywhere.**
    **Resolution:** the same limit is enforced in three places: a `CHECK` in the table, a check in the mutation helpers, and one zod schema shared by the add and edit forms. The zod schema also shows the error immediately and disables Save while the note is empty or too long.

## Steps

### Step 0 — Your Part

| Part | What | Where | When |
|---|---|---|---|
| A | Confirm the six decisions under Goal | here | ✅ done |
| B | Back up and run the migration script | after Step 1 | ✅ done |
| C | Check in the browser | after Step 9 | at the end |

**✅ 🧑 Your Part A — Confirm the decisions — agreed 6 Oct 2026.**
1. Separate `job_internal_note` table.
2. Every user can append; no right needed.
3. New right `JOBS_INTERNAL_NOTES_MANAGE` (id 21) for edit and delete, Manager only. Receptionist does not get it.
4. "Modify" means both edit and delete.
5. An edit replaces the text, marked "edited by X, <time>"; old wording is not kept.
6. 2000-character limit.
- **Done when:** you reply "agreed" or say what to change.

### ✅ Step 1 — Server: table, right, migration script — built 7 Oct 2026
**Needs:** Your Part A.

**As built:** `scripts/job_internal_note_schema.sql` holds the table and index. The runner reads that file and holds the right SQL, including the id-21 collision guard. The seed has row 21 and `(1, 21)`. The dry run lists 3 databases and 5 schemas: service_plus_capitalgroup (capitalelectronics, navtechnology), service_plus_customers (dummy) and service_plus_demo (demo1, demo2). `service_plus_service` is not on this server, so it was skipped. The table SQL and the right SQL were each run twice in demo1 inside a rolled-back transaction: no errors, a blank note and a 2001-character note were refused by the CHECK, and right 21 was mapped to role 1 only.

- **Explanation:** creates the table in every BU schema and the right in every tenant, and seeds the right for new tenants.
- **Paths:**
    - new `service-plus-server/scripts/job_internal_note_schema.sql`
    - new `service-plus-server/scripts/run_job_internal_note_ddl.py`
    - `service-plus-server/app/db/seeds/seed_security_data.py`
- **Code — the table** (`job_internal_note_schema.sql`, run with `search_path` set to the BU schema; no BEGIN/COMMIT, the runner supplies the transaction):
  ```sql
  CREATE TABLE IF NOT EXISTS job_internal_note (
      id              bigint GENERATED ALWAYS AS IDENTITY,
      job_id          bigint NOT NULL,
      note            text   NOT NULL,
      created_by      bigint NOT NULL,          -- security."user".id, from the session
      created_by_name text,                     -- stamped server-side
      created_at      timestamp with time zone DEFAULT now() NOT NULL,
      updated_by      bigint,                   -- NULL = never edited
      updated_by_name text,
      updated_at      timestamp with time zone,
      CONSTRAINT job_internal_note_pkey PRIMARY KEY (id),
      CONSTRAINT job_internal_note_job_fkey FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE,
      CONSTRAINT job_internal_note_note_chk CHECK (char_length(btrim(note)) BETWEEN 1 AND 2000)
  );
  CREATE INDEX IF NOT EXISTS job_internal_note_job_id_idx ON job_internal_note (job_id, created_at);
  ```
- **Code — the right, per tenant** (held as a string constant in the runner, run once per database against `security`):
  ```sql
  INSERT INTO security.access_right (id, code, name, module, description)
  OVERRIDING SYSTEM VALUE VALUES
      (21, 'JOBS_INTERNAL_NOTES_MANAGE', 'Edit Internal Notes', 'JOBS', 'Edit or delete internal notes on a job')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO security.role_access_right (role_id, access_right_id) VALUES (1, 21)
  ON CONFLICT (role_id, access_right_id) DO NOTHING;
  ```
  Before inserting, the runner checks that id 21 is free or is already `JOBS_INTERNAL_NOTES_MANAGE`, and fails loudly otherwise (the same guard as `ew_schema.sql`).
- **Runner** (`run_job_internal_note_ddl.py`, copied from `run_default_division_ddl.py`):
    - Covers every database in `public.client`, plus `service_plus_service` when it exists.
    - Runs the right SQL once per database.
    - Runs the table SQL in every schema that has a `job` table, each in its own transaction with `SET LOCAL search_path`.
    - `--dry-run` only lists the targets. Prints one line per schema and ends with "Done: N ran, M failed".
- **Seed:**
    - Add row 21 to `ACCESS_RIGHT_SEED_SQL`.
    - Add `(1, 21)` to the MANAGER mapping.
    - Add a line to the module docstring and to the role comment ("RECEPTIONIST: every right except … and JOBS_INTERNAL_NOTES_MANAGE").
- **Done when:** the dry run lists every tenant database and every BU schema, and the table SQL has run twice on a throw-away schema inside a rolled-back transaction without error.

### ✅ 🧑 Your Part B — Back up and run the migration — done 7 Oct 2026
**Needs:** Step 1.

**As done:** a read-only check after the run found `job_internal_note` in all five BU schemas (capitalelectronics, navtechnology, dummy, demo1, demo2). Right 21 `JOBS_INTERNAL_NOTES_MANAGE` is mapped to role 1 only in all three databases.
1. Back up `service_plus_capitalgroup`, `service_plus_demo`, `service_plus_customers`, and `service_plus_service` if you have it.
2. From `service-plus-server/`, inside the venv, run `python scripts/run_job_internal_note_ddl.py --dry-run` and check the targets.
3. Run `python scripts/run_job_internal_note_ddl.py`.
4. Tell Claude.
- **Done when:** the script ends with 0 failed.

### ✅ Step 2 — Regenerate the dump, `BU_SCHEMA_DDL` and client types — done 7 Oct 2026
**Needs:** Your Part B.

**As built:**
- The template dump was re-taken with `pg_dump --schema-only -n demo1 -n security` from `service_plus_demo`. Apart from pg_dump's `\restrict` token, it differs from the old dump only by the `job_internal_note` table, its pkey, index and FK.
- `sql_bu_admin_ddl.py` was regenerated (+30 lines), and `db-schema-service.ts` regenerated with `pnpm run gen-types-service` (`JobInternalNote`). Security and client types were not touched: right 21 is a data row, not a schema change.
- `JobInternalNoteType` is now `Pick<IsoDatesType<JobInternalNote>, …>`. `IsoDatesType` moved out of `types/extended-warranty.ts` into the new `types/iso-dates.ts` so both files share it.
- `tsc -b --force` passes.

- **Explanation:** a BU created from now on gets the table, and the client gets a generated `JobInternalNote` type.
- **Paths:**
    - `service-plus-server/app/db/schema_dumps/service_plus_service.sql`
    - `service-plus-server/app/db/sql/sql_bu_admin_ddl.py`
    - `service-plus-client/src/types/db-schema-service.ts`
- **Code:** none by hand.
    - Re-take the template dump from `service_plus_demo` (demo1 + security), the same way as plan2 Part B.
    - Run `python -m app.db.tools.extract_schema`.
    - Run `pnpm gen-types-all`.
- **Done when:**
    - `BU_SCHEMA_DDL` contains `CREATE TABLE job_internal_note`.
    - `db-schema-service.ts` has `job_internal_note`.
    - A read-only check finds the table in every BU schema and right 21 mapped to role 1 in every tenant.

### ✅ Step 3 — Server: read query, three mutations, guard, Job Control count — built 7 Oct 2026
**Needs:** Step 1.

**As built — one change from the plan below:** the three write statements are **not** in `sql_jobs.py`. They are in a new server-only class, `JobInternalNoteServerSql` (`app/db/sql/sql_job_internal_notes.py`), kept out of `SqlStore`. Reason: `genericQuery` runs any `SqlStore` constant by sqlId, so a write placed there could be called straight from the browser, skipping the edit right. This is the same split Extended Warranty uses. `GET_JOB_INTERNAL_NOTES` stays in `JobsSql`, and `sql_base.py`'s docstring lists the new class. The helpers use a shared `_clean_note()` and `_required_int()`, and `INTERNAL_NOTE_MAX = 2000`.

The three mutations were added to `GUARDED` in `tests/test_view_only_guard.py`; its "every mutation classified once" test requires that. The new `tests/jobs/test_job_internal_notes.py` has 18 tests. All 296 server tests pass, and the three mutations bind in `create_schema()`.

The SQL was exercised on demo1 with the table created inside a rolled-back transaction:
- add returned a row; add, update and delete with the wrong branch returned nothing;
- after an update, the note showed `updated_by_name`;
- delete removed the row;
- `GET_JOB_SEARCH_PAGED` returned 414 rows, with `internal_note_count` 1 on the noted job.

**Warning:** until Your Part B runs, `GET_JOB_SEARCH_PAGED` (Job Control) fails on a running server, because it now reads `job_internal_note`.

- **Paths:**
    - `service-plus-server/app/db/sql/sql_jobs.py`
    - `service-plus-server/app/graphql/schema.graphql`
    - `service-plus-server/app/graphql/resolvers/jobs/mutations.py`
    - `service-plus-server/app/graphql/resolvers/mutation.py`
    - `service-plus-server/app/graphql/resolvers/auth_guards.py`
    - new `service-plus-server/tests/jobs/test_job_internal_notes.py`
- **Code — read query** (`sql_jobs.py`):
  ```python
  # Internal notes — staff only. Never join this table into a print, WhatsApp or
  # public query (plans/plan.md, constraint 1).
  GET_JOB_INTERNAL_NOTES = """
      with "p_job_id" as (values(%(job_id)s::bigint))
      SELECT id, note, created_by_name, created_at, updated_by_name, updated_at
      FROM job_internal_note
      WHERE job_id = (table "p_job_id")
      ORDER BY created_at DESC, id DESC
  """
  ```
- **Code — writes** (`sql_jobs.py`):
  ```python
  ADD_JOB_INTERNAL_NOTE = """
      INSERT INTO job_internal_note (job_id, note, created_by, created_by_name)
      SELECT j.id, %(note)s, %(by)s, %(by_name)s
      FROM job j
      WHERE j.id = %(job_id)s AND j.branch_id = %(branch_id)s
      RETURNING id, created_at
  """

  UPDATE_JOB_INTERNAL_NOTE = """
      UPDATE job_internal_note n
      SET note = %(note)s, updated_by = %(by)s, updated_by_name = %(by_name)s, updated_at = now()
      FROM job j
      WHERE n.id = %(id)s AND n.job_id = j.id AND j.branch_id = %(branch_id)s
      RETURNING n.id, n.updated_at
  """

  DELETE_JOB_INTERNAL_NOTE = """
      DELETE FROM job_internal_note n
      USING job j
      WHERE n.id = %(id)s AND n.job_id = j.id AND j.branch_id = %(branch_id)s
      RETURNING n.id
  """
  ```
- **Code — Job Control count:** in `GET_JOB_SEARCH_PAGED`, right after the `file_count` line:
  ```sql
  (SELECT COUNT(*) FROM job_internal_note jin WHERE jin.job_id = j.id) AS internal_note_count,
  ```
- **Code — schema** (beside `addEwFollowUp`):
  ```graphql
  addJobInternalNote(db_name: String!, schema: String, value: String!): Generic
  deleteJobInternalNote(db_name: String!, schema: String, value: String!): Generic
  updateJobInternalNote(db_name: String!, schema: String, value: String!): Generic
  ```
- **Code — resolvers** (`mutation.py`, modelled on `resolve_add_ew_follow_up`):
  ```python
  # Internal notes: anyone in the BU may append; edit and delete need
  # JOBS_INTERNAL_NOTES_MANAGE (Manager; Admin by bypass). user_id comes from the session.
  @mutation.field("addJobInternalNote")
  @handle_graphql_errors("Error adding internal note")
  async def resolve_add_job_internal_note(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
      """Append an internal (never printed) note to a job. Any BU user."""
      require_own_tenant(info, db_name)
      require_bu_access(info, schema)
      await require_bu_writable(info, db_name, schema)
      return await add_job_internal_note(db_name, schema, value, (info.context or {}).get("user_id"))

  @mutation.field("updateJobInternalNote")
  @handle_graphql_errors("Error editing internal note")
  async def resolve_update_job_internal_note(_, info, db_name: str = "", schema: str = "public", value: str = "") -> Any:
      """Replace a note's text. Admin / Manager only."""
      require_own_tenant(info, db_name)
      require_bu_access(info, schema)
      await require_bu_writable(info, db_name, schema)
      require_access_right(info, "JOBS_INTERNAL_NOTES_MANAGE")
      return await update_job_internal_note(db_name, schema, value, (info.context or {}).get("user_id"))
  ```
  `resolve_delete_job_internal_note` has the same guards as update and calls `delete_job_internal_note(db_name, schema, value)`.
- **Code — helpers** (`jobs/mutations.py`):
    - A shared `_clean_note(payload)`: trims `note`, raises `REQUIRED_FIELD_MISSING` if it is empty, raises a validation error if it is over 2000 characters.
    - `add_job_internal_note`:
        - require `branch_id` and `job_id`; ignore any `id` in the payload;
        - run `ADD_JOB_INTERNAL_NOTE` with `by = user_id` and `by_name = await staff_name(db_name, user_id)` (import `staff_name` from `app.whatsapp.ew_sender`; it is a plain user-name lookup);
        - return `{ok: True, id, created_at}`, or `{ok: False, reason: "JOB_NOT_FOUND"}`.
    - `update_job_internal_note`:
        - require `branch_id` and `id`, and clean the note;
        - run `UPDATE_JOB_INTERNAL_NOTE`;
        - return `{ok: True, id, updated_at}`, or `{ok: False, reason: "NOTE_NOT_FOUND"}`.
    - `delete_job_internal_note`:
        - require `branch_id` and `id`;
        - run `DELETE_JOB_INTERNAL_NOTE`;
        - return `{ok: True, id}`, or `{ok: False, reason: "NOTE_NOT_FOUND"}`.
    - Each logs one info line naming the job or note and the user, as `addEwFollowUp` does.
- **Code — guard** (`auth_guards.py`):
    - Add `"job_internal_note"` to `SECURITY_SERVER_ONLY_TABLES`.
    - Extend its comment: "and `job_internal_note` (BU schemas), written only by the three internal-note mutations so authorship and the edit right cannot be bypassed."
- **Tests** (`test_job_internal_notes.py`, no database writes):
    - `_clean_note` rejects an empty note, a note of only spaces, and a 2001-character note;
    - `require_generic_update_access` refuses `tableName: "job_internal_note"`, both top-level and nested in `xDetails`;
    - the update and delete resolvers refuse a business user without `JOBS_INTERNAL_NOTES_MANAGE` and accept userType `A` (stubbed `info`, the same way as `test_auth_guards.py`);
    - the add resolver accepts a business user with no rights at all;
    - `GET_JOB_INTERNAL_NOTES` names `job_internal_note` and `GET_JOB_DETAIL` does not (protects constraint 1).
- **Done when:** all server tests pass, and the three mutations are in the built schema.

### ✅ Step 4 — Client plumbing — built 7 Oct 2026
**Needs:** Step 2, Step 3.

**As built:**
- Built ahead of Step 2. `JobInternalNoteType` is written out by hand in `types/job.ts` for now, and Step 2 switches it to the `Pick` from the generated type.
- `formatDate` moved together with `formatDateTime`, because both use the private `toDate()` and all three Extended Warranty files import the pair.
- `tsc -b --force` passes.

- **Paths and changes:**
    - `src/features/auth/utils/access-rights.ts`: add `JOBS_INTERNAL_NOTES_MANAGE: "JOBS_INTERNAL_NOTES_MANAGE"` to `ACCESS_RIGHTS`.
    - `src/features/super-admin/components/seed-roles-dialog.tsx`: add `{ code: "JOBS_INTERNAL_NOTES_MANAGE", module: "Jobs", name: "Edit Internal Notes (Manager only)" }` to `ACCESS_RIGHT_PREVIEW_ITEMS`.
    - `src/constants/sql-map.ts`: add `GET_JOB_INTERNAL_NOTES: "GET_JOB_INTERNAL_NOTES"`.
    - `src/constants/graphql-map.ts`: add `addJobInternalNote`, `deleteJobInternalNote` and `updateJobInternalNote`, each a copy of `addEwFollowUp` with the name changed.
    - `src/features/client/types/job.ts`:
        - `JobInternalNoteType = Pick<JobInternalNote, "created_at" | "created_by_name" | "id" | "note" | "updated_at" | "updated_by_name">`, taken from the generated type;
        - add `internal_note_count: number` to the Job Control row type (the one that already has `file_count`).
    - `src/constants/messages.ts`, new keys:
        - `INFO_INTERNAL_NOTES_HINT`: "Staff only. Never printed or shown to the customer."
        - `INFO_INTERNAL_NOTES_EDIT_RESTRICTED`: "Only Admin and Manager can edit or delete notes."
        - `INFO_INTERNAL_NOTES_EMPTY`: "No internal notes yet."
        - `CONFIRM_INTERNAL_NOTE_DELETE`: "Delete this internal note? This cannot be undone."
        - `SUCCESS_INTERNAL_NOTE_ADDED`: "Internal note added."
        - `SUCCESS_INTERNAL_NOTE_UPDATED`: "Internal note updated."
        - `SUCCESS_INTERNAL_NOTE_DELETED`: "Internal note deleted."
        - `ERROR_INTERNAL_NOTE_ADD_FAILED`: "Failed to add the internal note."
        - `ERROR_INTERNAL_NOTE_UPDATE_FAILED`: "Failed to update the internal note."
        - `ERROR_INTERNAL_NOTE_DELETE_FAILED`: "Failed to delete the internal note."
        - `ERROR_INTERNAL_NOTES_LOAD_FAILED`: "Failed to load internal notes."
        - `ERROR_INTERNAL_NOTE_REQUIRED`: "Note cannot be empty."
        - `ERROR_INTERNAL_NOTE_TOO_LONG`: "Note can be at most 2000 characters."
        - `ERROR_INTERNAL_NOTE_NOT_FOUND`: "This note or job is no longer available in the current branch."
    - Date-time formatting: move `formatDateTime` (and the private `toDate` it uses) from `custom/extended-warranty/ew-state-machine.ts` to a new `src/features/client/components/shared/format-date-time.ts`. Point the three Extended Warranty importers at it. The notes panel needs the same "13 Sep 2026, 6:30 pm" format.
- **Done when:** `pnpm exec tsc -b` passes.

### ✅ Step 5 — The Internal Notes panel and dialog — built 7 Oct 2026
**Needs:** Step 4.

**As built:**
- The mutation helpers throw `InternalNoteErrorType` (carrying `reason`) for `ok: false`. `internalNoteErrorMessage()` maps that to `ERROR_INTERNAL_NOTE_NOT_FOUND`, and any GraphQL error to the server's message (for example the view-only refusal).
- Pencil and trash are ghost icon buttons in slate. The delete confirm is an `AlertDialog`, which is right here because it is an irreversible action.
- Not yet rendered in the harness. That check moves to Step 9, once the table exists and real rows can be shown.

- **Paths (new folder `src/features/client/components/jobs/internal-notes/`):**
    - `internal-note-schema.ts`: zod `{ note: z.string().trim().min(1, MESSAGES.ERROR_INTERNAL_NOTE_REQUIRED).max(2000, MESSAGES.ERROR_INTERNAL_NOTE_TOO_LONG) }` and its inferred `InternalNoteFormType`. Shared by the add and edit forms.
    - `job-internal-note-mutations.ts`: `function addJobInternalNote(…)`, `function updateJobInternalNote(…)`, `function deleteJobInternalNote(…)`. Each calls `apolloClient.mutate` with its `GRAPHQL_MAP` entry and an `encodeObj` payload, and turns `ok: false` into a thrown error carrying the reason.
    - `internal-note-form.tsx`: `InternalNoteForm = ({ defaultValue, onCancel, onSubmit, submitLabel })`. Built with react-hook-form and `zodResolver`, `mode: "onChange"`:
        - a `Textarea` (3 rows, grows as you type) with a "n / 2000" counter;
        - errors shown right away, in red text only;
        - the submit button disabled while the form is invalid, while saving, or when `useIsReadOnly()` (then it shows the `READ_ONLY_TOOLTIP` tooltip);
        - used for **Add Note** (no Cancel) and inline **Save** (with Cancel).
    - `internal-notes-panel.tsx`: `InternalNotesPanel = ({ branchId, jobId, onChanged })`.
    - `internal-notes-dialog.tsx`: `InternalNotesDialog = ({ branchId, jobId, jobNo, onChanged, onClose })`. A shadcn `Dialog` titled "Internal Notes — Job #<no>" around the panel. Responsive: `sm:max-w-lg`, full width on phones.
- **Panel behaviour:**
    - **Loading.** Loads `GET_JOB_INTERNAL_NOTES` with `apolloClient.query`, the same way the Job Details window does. Shows a small spinner, and on failure a sonner error toast.
    - **Header.** A lock icon, the title "Internal Notes", a count pill, and below them the muted hint `INFO_INTERNAL_NOTES_HINT`. Colour: indigo, to fit the other section colours in Job Details; never red.
    - **Add form**, shown to **every user**. On success: clear the box, reload the list, toast success, call `onChanged()`.
    - **List**, newest first. Each entry is a white card with a thin indigo left border. Its top line shows `formatDateTime(created_at)` and "· by <created_by_name>". Below that is the note with `whitespace-pre-wrap` and `break-words`. If `updated_at` is set, a muted line "edited by <updated_by_name>, <formatDateTime(updated_at)>" follows. With no notes, show `INFO_INTERNAL_NOTES_EMPTY`.
    - **Edit and delete**, only when `hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_INTERNAL_NOTES_MANAGE)`:
        - each entry gets two small icon buttons, `Pencil` and `Trash2`, both in slate (not red; red is reserved for errors);
        - Pencil swaps the note text for `InternalNoteForm`, pre-filled. Save calls `updateJobInternalNote`, then reloads the list. Cancel restores the text. One entry is edited at a time.
        - Trash opens a shadcn `AlertDialog` with `CONFIRM_INTERNAL_NOTE_DELETE`. Confirm calls `deleteJobInternalNote`, then reloads the list and calls `onChanged()`.
        - On `NOTE_NOT_FOUND` / `JOB_NOT_FOUND`, show `ERROR_INTERNAL_NOTE_NOT_FOUND` and reload the list.
    - **Without the right:** no pencil or trash. Show the muted line `INFO_INTERNAL_NOTES_EDIT_RESTRICTED` under the list when it has entries.
    - New entries fade in with framer-motion, as elsewhere in the app.
    - Long lists scroll inside the panel (`max-h-80 overflow-y-auto`) so the Job Details window stays usable.
- **Done when:** the panel renders against real rows in the tsc render harness (memory "verify against live db"), both with and without the right. With the right it shows pencil and trash; without, only the add form and the list.

### ✅ Step 6 — Internal Notes in the Job Details window — built 7 Oct 2026
**Needs:** Step 5.

**As built:** the panel's `onChanged` is wired to the modal's existing `onJobChanged`. Job Control now passes `onJobChanged={refreshGrid}` to the modal, so a note added in Job Details updates the chip count. Undo Last in that modal now refreshes the grid too.

- **Path:** `src/features/client/components/jobs/job-pipeline/job-details-modal.tsx`.
- **Change:** render `<InternalNotesPanel branchId={currentBranch?.id ?? job.branch_id} jobId={jobId} />` directly **after the Remarks block**, ahead of Attachments. It sits with the other text sections and is easy to spot.
    - The panel loads its own data, so `loadData` and its `Promise.all` stay unchanged.
    - Nothing from the panel is passed to `getJobSheetBlobUrl`, `getJobInfoBlobUrl`, `buildInvoicePdf`, `buildReceiptPdf` or `buildDeliveryNotePdf`.
- **Done when:** the Job Details window shows the section from every grid that opens it.

### ✅ Step 7 — Job Control: notes chip and menu item — built 7 Oct 2026
**Needs:** Step 5 (and Step 3 for `internal_note_count`).

**As built:**
- The dialog takes Job Control's own `branchId`, and the Internal Notes menu item is shown to every user.
- Job Control has **two** row menus:
    - the ⋮ actions menu, for delivered jobs only — "Job Details PDF" lives here;
    - the ⇄ status menu, for every other job.
- The item was first added only after "Job Details PDF", so open jobs lacked it; the browser check on 7 Oct 2026 caught this. It is now also the last item of the ⇄ menu, after a separator. The client help says where to find it in each case.

- **Path:** `src/features/client/components/jobs/job-control/job-control-section.tsx`.
- **Changes:**
    - Add state `notesJob` (the row or `null`), beside `correctCostsJob`.
    - **Chip** in the Job No cell, right after the "N Files" chip, when `job.internal_note_count > 0`:
        - a button with a `StickyNote` icon and "N Note(s)", in indigo (`bg-indigo-50 text-indigo-600`, dark variants as for the Files chip);
        - `stopPropagation`, select the row, then `setNotesJob(job)`.
    - **Menu item** "Internal Notes", with the same icon, in the row dropdown after "Job Details PDF". Shown to every user, since everyone may append.
    - Render `<InternalNotesDialog … onChanged={reload} />` when `notesJob` is set. `onChanged` re-fetches the current page so the chip count updates after an add or delete. Use the same reload the Files dialog already uses after an attachment change.
    - Other grids are left alone. They reach notes through the Job Details window (Step 6).
- **Done when:** the chip appears only on jobs with notes, the count updates after adding or deleting, and the grid stays readable on a phone.

### ✅ Step 8 — Help, both files — built 7 Oct 2026
**Needs:** Step 6, Step 7.

**As built:**
- Client article `job-internal-notes` (placed before Receipts). The Roles table gains the row "Jobs → Internal Notes: edit / delete": Manager ✅, Technician ❌, Receptionist ❌.
- Developer article `dev-job-internal-notes` (placed after Job Cost Correction).
- Stale text fixed:
    - the seed article now says 21 rows, and names internal notes as the most recent right;
    - the `genericUpdate` table-rules row now lists `job_internal_note`.

- **`features/client/components/help/help-content.ts`**, a new article "Internal Notes on a Job":
    - what notes are for, and that they are never printed or sent;
    - where to find them (the Job Details section, and the Job Control chip and menu item);
    - anyone can add a note; only Admin and Manager can edit or delete one, and edited notes say who edited them and when;
    - the 2000-character limit;
    - a Manager who cannot see the edit and delete buttons should sign out and back in.
- **`features/super-admin/components/help/dev-help-content.ts`**, a new article `dev-job-internal-notes`:
    - the table and its columns;
    - `GET_JOB_INTERNAL_NOTES`, the three write SQL ids and the three mutations, with which guards each one runs;
    - right id 21, Manager only, edit and delete only;
    - the server-only table guard, and author/editor taken from the session;
    - a warning: never join this table into a print, WhatsApp or public query;
    - the migration runner.
- **Stale sibling articles to fix:**
    - the seed article's "18 access_right rows" (already stale, it is 20), which becomes 21;
    - the cost-correction article, which calls JOBS_CORRECT_COST "the most recent" right;
    - any list of `SECURITY_SERVER_ONLY_TABLES`.
  Grep `access_right rows`, `most recent one`, `SERVER_ONLY`.
- **Done when:** both articles render in their help screens.

### ✅ Step 9 — Verification — done 7 Oct 2026
**Needs:** Steps 1–8.

**As done:**
- `tsc -b --force` passes. Prettier was run on every touched file. All 296 server tests pass.
- Read-only on the live databases: `GET_JOB_SEARCH_PAGED` runs in capitalelectronics, navtechnology, dummy and demo1 and returns `internal_note_count` on every row (0 everywhere; demo2 has no jobs). `GET_JOB_INTERNAL_NOTES` runs in each.
- Vite serves the new and changed modules.
- **Not done:**
    - At first the panel was not rendered: there is no jsdom in the repo, and the Chrome extension was not connected. Once it connected, the real UI was checked as Admin. See Your Part C.
    - `graphify update .` could not run: the `graphify` command is installed but its Python module is missing (`ModuleNotFoundError: No module named 'graphify'`).

- `pnpm exec tsc -b --force` passes, and `pnpm format` has been run on the touched files. (eslint is broken repo-wide, see memory.)
- The server test suite passes.
- Read-only checks on the live databases:
    - the table exists in every BU schema;
    - right 21 is mapped to role 1 only;
    - `GET_JOB_SEARCH_PAGED` runs and returns `internal_note_count`.
- Render the panel in the harness with and without the right, and quote the output.
- Confirm through Vite (`curl` the module) that the browser is getting the new files.
- Then run `graphify update .`.

### 🧑 Your Part C — Check in the browser — partly done by Claude, 7 Oct 2026
**Needs:** Step 9.

**Done by Claude**, in your Chrome, signed in as Admin, on demo1 job HO/00083 (test notes deleted afterwards; demo1 has 0 notes):
- Job Details shows Internal Notes after Remarks, with Add Note disabled while the box is empty.
- Adding a two-line note worked: the toast showed, the count went to 1, the entry read "07 Oct 2026, 12:31 am · by Sushant", line breaks were kept, and the pencil and trash were shown.
- Editing worked and showed "edited by Sushant, 07 Oct 2026, 12:32 am".
- Closing Job Details refreshed Job Control, which showed the "1 Note" chip. The chip opened the Internal Notes dialog.
- Delete asked for confirmation, then removed the note; the count went to 0 and the chip disappeared.
- The ⇄ menu item for open jobs (the Step 7 fix) opened the dialog for HO/00117.
- No console errors.

**Still for you:** step 1 (Receptionist or Technician: can add, no edit or delete buttons) and step 4 (printouts). There was no non-Admin login in this browser, and the test notes were already deleted before the print check.
1. Sign in as a Receptionist or Technician. Open a job's Job Details and add a note. It shows with time and your name. There are no edit or delete buttons, and the "Only Admin and Manager…" line shows.
2. Sign in as a Manager (sign out first if already signed in). On the same job:
    - edit that note, and check that it shows "edited by <you>, <time>";
    - add a second note;
    - delete one note.
3. In Job Control, check that the chip count follows the changes and that the chip opens the same notes.
4. Print the job sheet, Job Info PDF and invoice for that job, and send a WhatsApp message if convenient. No note text should appear anywhere.
- **Done when:** all four look right.

## Noticed along the way (not part of this plan)

- `JOBS_CORRECT_COST` (id 18) is missing from the client `ACCESS_RIGHTS` map, and the "Correct Costs" menu item in Job Control is shown to everyone; only the server enforces the right.
- `ACCESS_RIGHT_PREVIEW_ITEMS` in the Seed Roles dialog lacks `JOBS_CUSTOMER_CONNECT` and `JOBS_CORRECT_COST`.

Both are existing drift from the "four places" rule. Say if you want them fixed alongside Step 4.
