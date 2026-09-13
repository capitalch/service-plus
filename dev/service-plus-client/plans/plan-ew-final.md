# Plan — Extended Warranty (lead state machine)

Brief: `plans/prompt3.md`. This is a **fresh build**. The existing Extended Warranty
implementation is removed completely first (Part A) — its tables, data, settings, server
code, client code, help articles and planning documents. Nothing is migrated. The only
things carried over are the **two Meta-approved WhatsApp templates** (Part B), because
re-approval would stop sending for days and their registered URLs fix two routes.

Status: **plan only — nothing implemented.**

Layout of this document:

- **Part A — Cleanup**: remove everything; the app builds and runs with no Extended Warranty.
- **Part B — Carried over**: the two templates and what they fix in place.
- **Part C — Design**: states, data model, SQL, server, client, help.
- **Part D — Build steps, rollout, testing, risks.**

The **Steps** section right after §0 is the order of work. It says, for each step, what
**you** do and what **I** (Claude) do. Parts A–D are the reference detail behind each step.

---

## 0. Decisions — confirmed

**Confirmed by the user on 2026-09-13: every default below is agreed, no overrides.**

| # | Question | Default taken here |
|---|---|---|
| D1 | Table layout | Three tables — `ew_lead`, `ew_message`, `ew_lead_event` — plus one view `ew_lead_view` (§C3). |
| D2 | Message_Sent leads whose message is still in transit (PENDING / ACCEPTED / SENT) | The brief lists Delivered / Read / Fail. **Add a fourth grey card "Awaiting"** so the four cards sum to the Message_Sent total. |
| D3 | What moves In_progress Stage_1 → 2 → 3 | **Staff, manually** — "Advance to Stage N" in the row menu, or the Stage field in the follow-up dialog. Forward only. Entering In_progress always starts at Stage_1. |
| D4 | Message_Sent → Interested | **Automatic** when the customer taps the WhatsApp button, **and** a manual "Mark interested" item (customer phoned instead). |
| D5 | Sending to Overdue leads | The Overdue card lists every New_Lead past expiry. **Sending** is allowed up to 7 days past expiry only — the approved template says the warranty "ends on {date}". |
| D6 | Leads more than 60 days from expiry | Counted in New_Lead → **All** only (no band card). Sendable, once. |
| D7 | How often a lead can be messaged | **At most one successful reminder per lead per expiry band** (61+ / 31–60 / 8–30 / 0–7 / Overdue). A failed send may be retried in the same band. Enforced by a partial unique index. |
| D8 | When a send moves New_Lead → Message_Sent | **When the send is attempted**, not only when Meta accepts it — so an immediate failure shows under Message_Sent → Fail, where it can be retried. |
| D9 | Delete | Hard delete only for **New_Lead with no messages** (data-entry mistakes). Everything else uses **Cancelled**. |
| D10 | Message log screen | **None.** Each lead's messages are in its detail dialog; the dashboard carries the counts. |
| D11 | Period semantics (Today / Week / Month / Over a month old) | **Cumulative**: Week includes Today, Month includes Week; "Over a month old" = before the 1st of this month. Each metric buckets by its own timestamp. |
| D12 | Message status counts | **Mutually exclusive by current status**: Delivered (not read), Read, Fail, Awaiting — they sum to messages sent. |
| D13 | Configurable bands / auto-send | **Neither.** Bands are fixed by the brief (in SQL, one place). Sending is always a staff click. |
| D14 | Colours | Exactly as the brief: Lost and Cancelled **red**. |
| D15 | Bell | Counts leads in **Interested**. Due follow-ups get a badge in the grid and a chip on the dashboard, not a bell entry. |
| D16 | Platform pieces kept through cleanup (§A1) | The generic **Custom** top-nav container and access rights `CUSTOM_MENU` (19) / `CUSTOM_EXTENDED_WARRANTY` (20). They are not Extended-Warranty data, live in every tenant's `security` schema, and removing them would force a re-seed of every tenant for no gain. Everything Extended-Warranty-specific inside the shell is deleted and rebuilt. |

---

# Steps — who does what

Do the steps in order. Do not start a step until the previous step's **Done when** is true.
When a step's **Done when** is met, its heading gets **✅ DONE <date>** and a **Status** line
records what was done (commit hash, results).

| Step | State |
|---|---|
| 1 | ✅ DONE 2026-09-13 |
| 2 | ⏭ SKIPPED 2026-09-13 — user decision, no backup |
| 3 | ✅ DONE 2026-09-13 |
| 4 | ✅ DONE 2026-09-13 |
| 5 | ✅ DONE 2026-09-13 |
| 6 | ✅ DONE 2026-09-13 |
| 7 | ✅ DONE 2026-09-13 |
| 8 | ✅ DONE 2026-09-13 (check 5 waived by the user) |
| 9 | ✅ DONE 2026-09-13 — Part A committed and pushed (`/git-deploy`) |
| 10 | ✅ DONE 2026-09-13 |
| 11 | ✅ DONE 2026-09-13 — 100 / 100 checks pass |
| 12 | ✅ DONE 2026-09-13 — server boots; 95 / 95 checks pass |
| 13 | ✅ DONE 2026-09-13 — tsc clean |
| 14 | ✅ DONE 2026-09-13 — tsc clean, `pnpm build` passes; not yet seen in a browser |
| 15 | ✅ DONE 2026-09-13 — both help files, own "Extended Warranty" topic; wording accepted by the user |
| 16 | ✅ DONE 2026-09-14 — tested on `demo1`; every issue reported was fixed |
| 17 | pending |
| 18 | partly done — `ew_cleanup.sql` already run on every BU schema of the live database (user, 2026-09-13) |
| 19 | pending |

- **Your part** — what you do yourself: database commands (they need your credentials,
  which I never read), anything in the browser or on a phone, decisions, commits, deploys.
- **My part** — what I do when you say "do step N": code, SQL files, edits, greps,
  `tsc` / `pnpm build`.

Phase 1 (Steps 1–9) removes the old Extended Warranty (Part A). Phase 2 (Steps 10–17) builds
the new one (Parts C, D1). Phase 3 (Steps 18–19) rolls it out (D2).

## Phase 1 — Cleanup

### Step 1 — Decide and park unrelated work ✅ DONE 2026-09-13
- **Your part:**
  - ~~Read §0 (D1–D16) and §A1 (the kept list). Reply "agreed", or list what to change.~~
    **Done 2026-09-13 — agreed, no overrides.**
  - Commit (or tell me to commit) the unrelated changes now in the working tree —
    `job-control-section.tsx`, `types/job.ts`, server `sql_jobs.py`, `notes/todo.md`, the
    deleted `plan-pickle*.md` — so the cleanup commit contains only the removal.
- **My part:** apply any overrides to this plan.
- **Done when:** decisions confirmed; `git status` shows only Extended Warranty files changed (or clean).
- **Status: DONE 2026-09-13** — open work committed as `01d2a99` (Job Control receipts chip + plan files); tree clean.

### Step 2 — Back up `demo1` (CL-2) ⏭ SKIPPED 2026-09-13
- **Status:** skipped by the user — no backup is taken. Consequence: Part A's rollback is
  code-only (`git revert`); the old `ew_customer` rows cannot be restored. Acceptable — demo
  tenant only, internal numbers (§A6).
- **Your part:** run, outside the repo:
  `pg_dump -d service_plus_service -n demo1 -f ~/backups/demo1-2026-09-13.sql`
  (add your host / user flags). Check the file is non-empty.
- **My part:** none.
- **Done when:** you tell me the dump file exists and has size.

### Step 3 — Drop the old tables and settings (CL-3, §A2) ✅ DONE 2026-09-13
- **Status:** script written (me); run twice on `demo1` and checks passed (user).
- **My part:** write `../service-plus-server/scripts/ew_cleanup.sql`. **Done 2026-09-13** —
  also deletes a leftover `extended_warranty_notifications_enabled` row where an old schema
  never ran `ew_enabled_merge.sql`.
- **Your part:** run it on `demo1` **twice** (`psql … -c "SET search_path TO demo1" -f scripts/ew_cleanup.sql`).
  Then run `\d demo1.ew_customer` and `\d demo1.ew_stage_v` (both must say "not found") and
  `SELECT setting_key, setting_value FROM demo1.app_setting WHERE id IN (15, 16);`.
  Paste the output to me.
- **Done when:** both objects gone, no `extended_warranty` row, row 15 has no `EXTENDED_WARRANTY` key, the second run changed nothing.

### Step 4 — Regenerate the schema DDL and seeds (CL-4) ✅ DONE 2026-09-13
- **Status:** dump regenerated by the user (13 `demo1` objects removed — table, sequence,
  view, pkey, 6 indexes, 3 FKs); `extract_schema` rewrote `sql_bu_admin_ddl.py` (93 lines
  removed, none added); `seed_bu_data.py` row 16 dropped and row 15 key/description
  trimmed; `ew_delta.sql`, `ew_enabled_merge.sql` deleted; grep gate empty. Uncommitted —
  goes into the Part A commit (Step 9).
- **Your part:** from `../service-plus-server`, overwrite the dump (it holds exactly two
  schemas, `demo1` and `security`; add your host / user flags):
  `pg_dump --schema-only -d service_plus_service -n demo1 -n security -f app/db/schema_dumps/service_plus_service.sql`
- **My part:** run `python -m app.db.tools.extract_schema`; edit `seed_bu_data.py` (drop
  row 16, remove the key from row 15); delete `scripts/ew_delta.sql` and
  `scripts/ew_enabled_merge.sql`; run the §A2 grep gate.
- **Done when:** grep gate is empty.

### Step 5 — Remove server code (CL-5, §A3) ✅ DONE 2026-09-13
- **Status:** server boots (user). Webhook POST with event code `EW` → `HTTP 200` and the
  log warning `cannot resolve tenant — biz_opaque_callback_data='service_plus_demo|demo1|EW|1,60'`
  — logged and ignored, no 500. The signed test script was temporary and deleted.
- **My part:** every edit and deletion in §A3; run the §A3 grep gate; give you a `curl`
  that POSTs a webhook status with event code `EW`. **Done 2026-09-13** — 3 files deleted
  (`sql_extended_warranty.py`, `resolvers/jobs/extended_warranty.py`,
  `extended_warranty_router.py`); EW code removed from `sql_base.py`, `sender.py` (346
  lines), `token.py`, `mutation.py`, `schema.graphql`, `main.py`, the webhook router;
  `templates.py` comments reworded (the two specs untouched; the misplaced JOB_INVOICE
  comment moved back above its spec). Grep gate leaves only the two specs and the right-20
  seeds; `py_compile` and `pyflakes` clean. An unknown `EW` code now fails
  `_decode_callback_data` → warning "cannot resolve tenant" → 200.
- **Your part:** start the server (it needs your `.env`) — confirm it boots with no import
  error. Run the `curl`; confirm the server logs and ignores it (no 500).
- **Done when:** server boots, grep gate clean, webhook test returns 200.

### Step 6 — Remove client code (CL-6, §A4) ✅ DONE 2026-09-13
- **Status:** types regenerated (user). Deleted the `custom/extended-warranty/` folder (13
  files), `types/extended-warranty.ts`, `client-custom-ew-ref-page.tsx`,
  `edit-extended-warranty-dialog.tsx`. Removed EW from routes, router, custom page
  (ComingSoon only), menu registry (`CUSTOM_MENU_ITEMS = []`, context `Record<string, never>`),
  context slice, client layout (setting parse; `SECTION_DEFAULTS.custom` → `""`), top nav
  (bell item), explorer panel, notifications summary, App Settings section, WhatsApp
  notifications dialog, sql-map (8 ids), graphql-map (3 mutations), messages (all `*_EW_*`).
  Grep gate leaves only the kept right in `seed-roles-dialog.tsx` / `access-rights.ts` and a
  pointer comment in the registry. `tsc` clean; `pnpm build` passes. Prettier ran on the
  touched files only; the generated `db-schema-client.ts` / `db-schema-security.ts` keep
  their pg-to-ts style (only their regenerated header line differs).
- **Your part:** run `pnpm gen-types-service` (reads the DB via your `.env`).
- **My part:** every edit and deletion in §A4; §A4 grep gate; `pnpm exec tsc -b --noEmit`; `pnpm build`.
- **Done when:** grep gate clean, tsc clean, build passes.

### Step 7 — Help and old plan documents (CL-7, §A5) ✅ DONE 2026-09-13
- **Status:** six old plan files deleted (user-approved); `plans/` holds only `plan-ew-final.md`
  and `prompt3.md`. Client help: `extended-warranty` article, the App Settings
  `extended_warranty` row and settings paragraph removed; WhatsApp switch lists now name five
  events. Dev help: `extended_warranty` settings row and the `EXTENDED_WARRANTY` key removed;
  WhatsApp rail article corrected (five builds / five events, templates still registered with
  no sender, TWO token pairs, no EW gate). The old `dev-whatsapp-extended-warranty` article is
  **replaced** (not just deleted) by a short `dev-extended-warranty` removal record — it was
  the only doc of the kept Custom container, rights 19/20, nginx block and templates. Part C
  rewrites that same article id. `templates.py` comments were reworded in Step 5. Client help
  grep: 0 hits; `tsc` clean; `pnpm build` passes.
- **Your part:** confirm I may **delete** `plans/plan-ew.md`, `plan.md`, `plan1.md`,
  `prompt.md`, `prompt1.md`, `prompt2.md` (keep a copy elsewhere first if you want them).
  **Done 2026-09-13 — user approved deleting all six.**
- **My part:** the §A5 edits in both help files; reword the `templates.py` comments; delete
  the plan files; run the help grep gates.
- **Done when:** grep gates clean; `plans/` holds only `prompt3.md` and this file.

### Step 8 — Smoke test the app (CL-8) ✅ DONE 2026-09-13
- **Status:** checks 1–4 passed (user). Check 5 (throwaway BU) not run — the user chose to
  accept it as passed. Indirect evidence: the regenerated `BU_SCHEMA_DDL` that new BUs are
  built from contains no `ew_*` object (Step 4 grep gate). If a BU is created before Part C,
  a quick `\dt <bu_code>.ew_*` confirms it.
- **Your part:** start server + `pnpm start` and check:
  1. Login works.
  2. Custom tab is gone.
  3. App Settings has no `extended_warranty` row; the WhatsApp notifications dialog has no Extended Warranty switch.
  4. Bell, Jobs, Inventory, Reports still work.
  5. Admin → create a throwaway BU → in psql `\dt <bu_code>.ew_*` shows nothing → delete the BU.
- **My part:** fix anything you report.
- **Done when:** all five pass.

### Step 9 — Commit Part A (CL-9) ✅ DONE 2026-09-13
- **Status:** committed and pushed in one `/git-deploy` commit — `a295d74` "Extended Warranty:
  remove the old module ahead of the rebuild" (62 files, +229 / −7882), pushed to `origin/main`
  together with `01d2a99` from Step 1. Included, per the user,
  `db/service_plus_demo.sql` and the migration-tool README.
- **Your part:** say "commit Part A" (or run `/git-deploy`). Optionally deploy it now (§A6 — safe, demo only).
- **My part:** write the commit message (what was removed, what was kept) and commit client + server.
  Per the user (2026-09-13), the commit also includes `db/service_plus_demo.sql` and
  `dev/service-plus-tools/migration-tool/README.md`.
- **Done when:** clean `git status`.

## Phase 2 — Build

### Step 10 — New database objects (B-2, §C3) ✅ DONE 2026-09-13
- **My part:** write `scripts/ew_schema.sql` (three tables, view, settings row with the
  id-16 guard, row-15 key); add row 16 and the row-15 key to `seed_bu_data.py`.
  **Done 2026-09-13** — one transaction; guard raises if id 16 belongs to another key or
  `extended_warranty` sits at another id; FK targets confirmed `bigint`; parses as 20
  statements (pglast); seed file syntax-checked.
  **Changed 2026-09-13:** the script no longer has `BEGIN` / `COMMIT` — the runner supplies
  the transaction (the migration tool wraps each schema; psql uses `-1`). Inside the tool's
  transaction an embedded `COMMIT` would commit even during the Check dry run.
- **Your part** (user decision 2026-09-13: run it on **every** BU now, not only `demo1` —
  this also covers Step 18.2):
  - Migration tool: select every BU schema **including `demo1`** → load `ew_schema.sql` →
    Check → Continue. Then Continue a **second** time (idempotency — all ✅). Paste the
    results table. If `demo1` (template, in `service_plus_service`) is not listed in the
    tool, run it there with psql `-1`.
  - Re-run the `pg_dump --schema-only` from Step 4.
  - Create a throwaway BU and check `\dt <bu_code>.ew_*` shows `ew_lead`, `ew_message`,
    `ew_lead_event` and `\dv` shows `ew_lead_view`; delete the BU.
  - Trade-off accepted: if Steps 11–16 change the DDL, the fix goes to every BU, not just
    `demo1`. The new tables stay empty outside `demo1` until Part C ships, so a
    drop-and-recreate through the tool is enough.
- **My part (after yours):** run `extract_schema`; grep that `BU_SCHEMA_DDL` has the new objects.
  **Done 2026-09-13** — user ran the script on every BU via the migration tool and
  regenerated the dump (3 tables, view, 11 indexes present). `extract_schema` added 226 lines
  to `sql_bu_admin_ddl.py`, none removed; `py_compile` clean. Fixed on the way:
  `extract_schema.py`'s owner-line regex stripped `ALTER TABLE|FUNCTION|SEQUENCE … OWNER TO`
  but not `ALTER VIEW`, so `ALTER VIEW ew_lead_view OWNER TO webadmin;` leaked into
  `BU_SCHEMA_DDL` (the old `ew_stage_v` had the same leak) — a silent dependency on BUs
  being created as `webadmin`. Regex now includes `VIEW`; the DDL has no `OWNER TO` line.
  Uncommitted — goes into the Part C commit (Step 17).
- **Throwaway BU — passed 2026-09-13 (user):** BU `test` created; every new object present
  with no manual step. `test` is deleted afterwards (not needed by later steps).
- **Done when:** objects present on `demo1` and in the throwaway BU with no manual step.

### Step 11 — SQL store (B-3, §C4) ✅ DONE 2026-09-13
- **My part:** `app/db/sql/sql_extended_warranty.py`, add it to `sql_base.py`; write a test
  script (every test wrapped in `BEGIN … ROLLBACK`) for §D3.1 tests 1–13.
- **Your part:** run the test script on `demo1` and paste the output. Nothing is kept — every test rolls back.
- **Done when:** all 13 tests pass.
- **Status (my part done 2026-09-13):** `app/db/sql/sql_extended_warranty.py` (18 statements,
  two classes — see §C4 note), `sql_base.py` composes the browser class only;
  `scripts/ew_sql_test.py` covers tests 1–13 plus a smoke run of every read (R). Static
  checks: `py_compile` + `pyflakes` clean; all 18 statements parse (pglast, placeholders →
  NULL); `SqlStore` exposes exactly the six browser reads, none of the server-only ones,
  no name collisions. Not yet run against a database.
  - Test 5 (two sessions) must commit one fixture lead (`full_name = 'EW SQL TEST'`) and
    deletes it in a `finally`; every other test is `BEGIN … ROLLBACK`.
  - Deferred to Step 12 (need the resolver / `sign_ew`): test 1 through the real
    `transitionEwLead`, test 10's "exactly one alert per first tap", test 11's token half.
  - Run: from `../service-plus-server`, in the venv: `python scripts/ew_sql_test.py service_plus_demo demo1`
    (both args are the defaults). Exit code 0 = all passed.
  - **First run (user, 2026-09-13): 97 passed, 1 failed** — test 3 "CHECK refuses In Progress
    without a stage". Real schema bug: a CHECK passes on NULL, and
    `(state = 'IN_PROGRESS' AND progress_stage BETWEEN 1 AND 3) OR …` is NULL when the stage
    is NULL. `ew_message_band_chk` had the same hole (REMINDER with NULL band — which would
    also dodge the once-per-band index). Fixed in `ew_schema.sql`: both rewritten NULL-safe
    (`CASE … COALESCE(…, false)`), moved out of `CREATE TABLE` into a drop-and-re-add block
    so re-running the script corrects every existing BU. Test 3 gained the two band cases.
  - **To finish (user):** migration tool → `ew_schema.sql` on every BU incl. `demo1` (Check,
    Continue, Continue again); re-run the Step 4 `pg_dump --schema-only`; tell me → I run
    `extract_schema`; then re-run `python scripts/ew_sql_test.py` → expect 100 passed.
    **2026-09-13:** script re-run on every BU and dump regenerated (user); both NULL-safe
    CHECKs confirmed in the dump; `extract_schema` re-run — `BU_SCHEMA_DDL` carries them,
    no `OWNER TO` line, compiles.
  - **Second run (user, 2026-09-13): 100 passed, 0 failed.** Step 11 done.
  - **Open question — time zone (not blocking):** test 13 shows the DB session day starting
    at `00:00+00:00`, i.e. sessions run in **UTC**; nothing in the server sets `TimeZone`.
    So "Today" / "This week" / "This month" on the dashboard, and `CURRENT_DATE` in
    `days_left` (bands, the 7-day grace window), roll over at **05:30 IST**, not midnight.
    Existing job reports behave the same, so Extended Warranty is consistent with the app.
    Cleanest fix, app-wide: `ALTER DATABASE <tenant_db> SET timezone = 'Asia/Kolkata'` per
    tenant DB — a user decision, since it shifts every existing report's day boundary too.

### Step 12 — Server Python (B-4, §C5, §C6) ✅ DONE 2026-09-13
- **My part:** `ew_sender.py`, `resolvers/custom/extended_warranty.py`, public router,
  `sign_ew` / `verify_ew`, webhook codes, four GraphQL mutations, `main.py`, table-rights map.
- **Your part:**
  - Restart the server; confirm it boots.
  - Test 14: log in as a user **without** `CUSTOM_EXTENDED_WARRANTY` (create one in Admin if
    needed) — I give you the calls; each must be refused. Log in as admin — must pass.
  - Tests 15–16: set `daily_send_cap` / `enabled` in `demo1.app_setting` as I tell you and
    run the calls I give you.
- **Done when:** boots; tests 14–16 pass.
- **Status (my part done 2026-09-13):** new `app/whatsapp/ew_sender.py`,
  `app/graphql/resolvers/custom/{__init__,extended_warranty}.py`,
  `app/routers/public/extended_warranty_router.py`; edits to `token.py` (`sign_ew` /
  `verify_ew`, tag `EWL`), `sender.py` (codes `EW` / `EL`), the webhook router
  (`_apply_ew_status_callback`), `mutation.py` (4 resolvers, each
  `require_access_right(CUSTOM_EXTENDED_WARRANTY)`; `ew_lead` in the genericUpdate table
  rights), `schema.graphql` (4 fields), `main.py` (router). Static checks: `py_compile` +
  `pyflakes` clean on every touched file; `schema.graphql` parses; all 42 mutation fields
  have a resolver and vice versa.
  - **Your part is simpler than written above** — no logins and no settings edits:
    `scripts/ew_server_test.py` calls the resolvers with fake auth contexts (test 14),
    replaces `send_template` with a fake (no WhatsApp message is sent) and overrides the
    settings in-process (tests 15–16). It also covers what Step 11 deferred: test 1 through
    the real resolver, test 10's one-alert-per-tap, test 11's signed links, plus the webhook
    dispatch (W). It commits fixture leads named `EW SQL TEST` and deletes them at the end.
  - Run: restart the server and confirm it boots; then, from `../service-plus-server` in the
    venv: `python scripts/ew_server_test.py` (defaults `service_plus_demo demo1`).
  - Optional browser check once it boots: `http://<server>/extended-warranty/abc` must show
    the "invalid or expired" card (404), not an error.
  - **Result (user, 2026-09-13):** server restarted and boots. `ew_server_test.py`: **95
    passed, 0 failed**; all 75 fixture leads deleted. The one ERROR traceback in the output
    is expected — test 15's simulated network exception, logged by `_send_and_settle` and
    settled as FAILED. Browser check: `http://localhost:8000/extended-warranty/abc` shows the
    "This link is invalid or has expired" card (user). (A first try on port 3000 hit the
    React app's own 404 — Vite has no proxy for `/extended-warranty`; production nginx does.)

### Step 13 — Client foundations (B-5, §C7.1–C7.3) ✅ DONE 2026-09-13
- **Your part:** run `pnpm gen-types-service`.
- **My part:** types, `ew-state-machine.ts`, sql-map / graphql-map ids, messages, context slice; `tsc`.
- **Done when:** tsc clean.
- **Status (2026-09-13):** types regenerated (user). New
  `features/client/types/extended-warranty.ts` — table columns derived from the generated
  `EwLead` through an `IsoDatesType` mapper (genericQuery returns dates as ISO strings);
  only view-computed columns hand-declared. New
  `components/custom/extended-warranty/ew-state-machine.ts` — `EW_TRANSITIONS` (server
  mirror + NEW_LEAD → MESSAGE_SENT for the diagram), state / band / message-group / stage /
  delivery / period / follow-up-action metadata, `EW_COLOR_CLASSES`, `EW_PIPELINE_GROUPS`
  (the brief's card table as data, with drill-down filters), `availableActions`,
  `sendBlockReason`, `stateBadgeLabel`, `transitionLabel`, `daysLeftLabel`, `isFollowUpDue`,
  `formatDate` / `formatDateTime` (date-only strings read as local dates). `sql-map.ts`: the
  six browser reads. `graphql-map.ts`: the four mutations. `messages.ts`: the §C7.12 keys
  plus six the screens need (`ERROR_EW_LEAD_DELETE_FAILED`, `ERROR_EW_SEND_SOME_FAILED`,
  `INFO_EW_DELETE_MESSAGED`, `SUCCESS_EW_REMINDERS_SENT`, `WARN_EW_SEND_CAPPED`,
  `WARN_EW_SEND_SKIPPED`). `context-slice.ts`: `extendedWarrantyEnabled` +
  `setExtendedWarrantyEnabled` + `selectExtendedWarrantyEnabled` (nothing sets it yet — the
  `client-layout.tsx` parse is Step 14). `EW_CHECKBOX_CLASS` dropped as unneeded. Prettier on
  touched files; `pnpm exec tsc -b --noEmit` exit 0.
  - Colours follow D14 (Lost / Cancelled / Overdue / Fail red) — a deliberate, user-confirmed
    exception to the global "red is for errors only" rule, limited to these status cards.

### Step 14 — Client screens and settings dialog (B-6, §C7.4–C7.11, §C8) ✅ DONE 2026-09-13
- **My part:** every component, route, bell, deep-link page, settings dialog; `tsc`; `pnpm build`.
- **Your part:** none (testing is Step 16). Optional quick look at the dashboard to catch layout taste early.
- **Done when:** tsc clean, build passes.
- **Status (2026-09-13):** `pnpm exec tsc -b --noEmit` exit 0 on the first run; `pnpm build`
  passes (only the pre-existing chunk-size warning). Prettier on every touched file. Nothing
  has been run in a browser yet — that is Step 16.
  - **New, `components/custom/extended-warranty/`:** `extended-warranty-section.tsx`,
    `ew-dashboard.tsx`, `ew-state-flow-diagram.tsx` (edges generated from `EW_TRANSITIONS`
    and classified main / skip / close-bus / fan / reopen / return), `ew-pipeline-section.tsx`,
    `ew-period-matrix.tsx`, `ew-drilldown-view.tsx`, `ew-lead-grid.tsx`,
    `ew-lead-actions-menu.tsx`, `ew-transition-dialog.tsx`, `ew-follow-up-dialog.tsx`,
    `ew-lead-dialog.tsx`, `ew-lead-detail-dialog.tsx`, `ew-state-badge.tsx`,
    `ew-delivery-chip.tsx`, `extended-warranty-schema.ts`.
  - **Named differently from §C7.1:** `ew-mutations.ts` (the four mutation wrappers + the
    delete + send-result toasts) instead of `send-ew-reminders.ts`; and a new
    `use-ew-lead-actions.tsx` — one hook, owned by the section, that holds every lead
    action and dialog, so the grids, the detail dialog and the staff deep link behave
    identically.
  - **Elsewhere:** `pages/client-custom-ew-ref-page.tsx`; `routes.ts` `customEwRef` +
    router child `custom/ew/:ref`; `client-custom-page.tsx` (shows the selected add-on, or
    the first visible one); `custom-menu-registry.ts` (context `{ extendedWarrantyEnabled }`,
    the Extended Warranty item); `client-layout.tsx` (parses `extended_warranty.enabled`,
    strict `true`); `client-top-nav.tsx` / `client-explorer-panel.tsx` (pass the flag; bell
    item "Extended warranty — interested leads" → Interested drill-down);
    `use-notifications-summary.ts` (`ewOpenInterest`, queried only when the add-on is on and
    the user has the right); `edit-extended-warranty-dialog.tsx` (rhf + zod; saving
    dispatches the flag); `app-settings-section.tsx` routing; the WhatsApp notifications
    dialog's Extended Warranty switch; `kpi-card.tsx` optional `borderClassName` /
    `valueClassName`; `messages.ts` (form and screen keys).
  - **Found on the way:** `lib/mobile`'s `isValidMobile` accepts `""` (it serves optional
    mobile fields), so it would have let an empty mobile through the lead form and the send
    check. Added `isCompleteMobile` to `ew-state-machine.ts` and used it for the lead form,
    `sendBlockReason`, the grid's "invalid number" flag and the lookup trigger.
  - A disabled row-menu item stays visible and answers with a toast giving the reason —
    Radix hides tooltips on truly disabled items.

### Step 15 — Help (B-7, §C9) ✅ DONE 2026-09-13
- **My part:** new client article + new developer article; update the App Settings,
  `whatsapp_notifications` and WhatsApp-rail sections.
- **Your part:** open both help screens and read the new articles.
- **Done when:** both render; you are happy with the wording.
- **Status (my part done 2026-09-13):**
  - **Own help topic (user request, 2026-09-13):** "Extended Warranty" is a category of its
    own in both help centers — `HELP_CATEGORIES` / `CLIENT_CAT_STYLE` and
    `DEV_HELP_CATEGORIES` / `DEV_CAT_STYLE`, listed right after WhatsApp, sky colour, 🛡️ with
    the `ShieldCheck` icon the Custom menu uses. Both articles moved into it; a script
    confirmed every article's category is a listed topic and no topic is empty.
  - **Client help (`help-content.ts`):** new article `extended-warranty` (topic Extended
    Warranty) — switching it on, adding a lead, the states table, the
    dashboard, sending reminders, what the customer sees, interest, follow-ups, closing and
    reopening, the summaries, the Details tab, plus 7 FAQs. 'App Settings' gains the
    `extended_warranty` row and an 'Extended Warranty settings' section, and its
    whatsapp_notifications text now names six events. 'WhatsApp Integration' gains a pointer
    note and the Extended Warranty switch.
  - **Dev help (`dev-help-content.ts`):** `dev-extended-warranty` rewritten from the
    removal record into 'Extended Warranty — Lead State Machine' (tables and view, NULL-safe
    CHECKs, state machine, the two SQL classes and why, sending, webhook / public page /
    token, access, client, the Part B fixed pieces, tests, rollout and time zone, 5 FAQs).
    Stale text corrected in: the settings-keys table (`extended_warranty` row, the
    EXTENDED_WARRANTY switch key) and the WhatsApp rail article (intro, TEMPLATES "no
    sender", THREE signing pairs, EW / EL callback codes, the webhook branch, four public
    routers and the /extended-warranty/ nginx block, the subscription's `kind`, the switch
    keys, and the mutations that check their own right).
  - Checks: Prettier on both files; `tsc` clean; a grep for the stale phrases ("Rebuild
    Pending", "no sender", "TWO independent", "Three routers", the empty-registry text)
    finds nothing; the menu's `helpArticleId: "extended-warranty"` now resolves.

### Step 16 — End-to-end test on `demo1` (B-8, §D3.2) ✅ DONE 2026-09-14
- **Your part:**
  1. App Settings → `extended_warranty`: Enabled on; Contact phone, WhatsApp number, Staff
     WhatsApp number (your own), Notify e-mail, cap. WhatsApp notifications → Extended Warranty on.
  2. Custom → Extended Warranty appears. Add 3–4 leads **with your own / internal mobile
     numbers** and warranty dates in different bands.
  3. Walk through §D3.2 items 3–11: dashboard cards and drill-downs, send single + bulk,
     live Delivered → Read, follow-up dialog, every transition, two-tab STALE.
  4. On the phone: tap the reminder button → landing page → "I am interested" → staff alert
     arrives → "Open in Service+" opens the right dialog (try once logged out). Opt out on a
     second lead.
  5. Bell count equals the Interested card.
- **My part:** fix every failure you report; re-run tsc / build.
- **Done when:** all §D3.2 items pass. (`pnpm lint` is broken repo-wide — R9 — and is not part of this check.)
- **Status:** you tested on `demo1` and reported every issue as you found it; I fixed each
  in turn and re-ran `tsc -b --noEmit` / `pnpm build` (client) and `ew_sql_test.py` /
  `ew_server_test.py` (server, 100/100 and 95/95) after every round. Two were real defects
  rather than polish:
  - The dashboard, grid and bell only refreshed on your own actions or a WhatsApp delivery
    callback — a colleague's transition, follow-up, send, or a customer's interest/opt-out
    sat unseen until Refresh. Fixed by publishing a new `EW_LEAD` event (server:
    `publish_ew_lead_changed` in `pubsub.py`, called from every EW mutation, the sender and
    the public interest/opt-out routes) alongside the existing delivery-status one, and a
    shared client hook (`use-ew-live-refresh.ts`) both the section and the bell's Interested
    count now use.
  - The customer's typed comment on the interest page reached the grid, the detail dialog
    and the staff WhatsApp alert, but not the notify e-mail — `_notify_by_email` was reading
    `row`, loaded *before* the write, so it could never carry it. Fixed by passing the
    remark in as its own argument.
  Everything else was refinement you asked for while looking at it live: Flow moved to its
  own tab with a shared New Lead button; the breadcrumb, checkboxes, row-action icons and
  amber/red palette; the Lead Pipeline's two-row layout, per-section tints and the "61+ D"
  card plus an open-leads chip; the Overall summary's redesign and the dropped Message
  summary card; standard Refresh buttons; the call/WhatsApp chooser removed from the
  customer page (the shop only calls) with `preferred_contact` now shown only for a
  leftover WHATSAPP; and the Follow-up column surfacing who did the last follow-up and what
  they said (`_LEAD_JOINS` LATERAL join onto `ew_lead_event`, no schema migration). None of
  this is committed yet — that is Step 17.

### Step 17 — Commit Part C (B-9)
- **Your part:** say "commit Part C" (or `/git-deploy`).
- **My part:** commit message and commit, client + server.
- **Done when:** clean `git status`.

## Phase 3 — Rollout

### Step 18 — Roll out to every tenant (D2)
- **My part:** on request, a small script that lists every BU schema of a tenant (from
  `security.bu`) and runs a given SQL file against each.
- **Your part**, per tenant, in this order:
  1. Run `ew_cleanup.sql` on **every** BU schema (not just `demo1`). **Done 2026-09-13 for
     every BU schema of the live database (user).**
  2. Run `ew_schema.sql` on every BU schema. **Being done in Step 10 via the migration tool
     (user, 2026-09-13).** Re-run only for BUs created before Step 10's regenerated DDL, or if
     the DDL changed later.
  3. Only then deploy the Part C server and client (R1 — the server must not go live before its tables exist).
  4. Super-admin → Seed Roles only if the tenant lacks rights 19 / 20.
  5. Enter the Extended Warranty settings and turn on the WhatsApp switch (owner).
  6. Send to **one** test lead; open the customer link and the staff deep link before any bulk send.
- **Done when:** every tenant has run both scripts and passed its one-lead test.

### Step 19 — Remove the cleanup script (D2.7)
- **Your part:** tell me every tenant is done.
- **My part:** delete `scripts/ew_cleanup.sql`, commit.
- **Done when:** the script is gone.

---

# Part A — Cleanup (separate phase, done before any build work)

Goal: after Part A the repository contains **no** Extended Warranty code, schema objects,
settings, help text or plan documents — except the two `TemplateSpec` entries and the
kept platform pieces in §A1. The app must build, boot, and run normally, with the Custom
tab hidden (it has no items).

Part A is finished, verified and committed on its own before Part C starts. It is
reviewable and revertable as one commit. It **may be deployed on its own**: Extended
Warranty only ever ran on the demo tenant and every message it sent went to internal
numbers, so removing it leaves no customer-facing gap.

### A0. Cleanup steps (in order)

Each step is complete only when its check passes. §A1–§A6 below give the detail for each step.

| Step | Work | Detail | Check (must pass before the next step) |
|---|---|---|---|
| **CL-1** | Confirm the kept list with the user: two templates, rights 19/20, Custom shell, nginx block | §A1, D16 | User agrees |
| **CL-2** | Back up `demo1`: `pg_dump -n demo1` to a dated file outside the repo | — | Dump file exists and is non-empty |
| **CL-3** | Write `scripts/ew_cleanup.sql`; run it on `demo1` twice (idempotency) | §A2 | `\d ew_customer` and `\d ew_stage_v` → not found; no `extended_warranty` row; row 15 has no `EXTENDED_WARRANTY` key; second run is a no-op |
| **CL-4** | Regenerate the schema dump and `BU_SCHEMA_DDL`; edit `seed_bu_data.py` rows 15/16; delete `ew_delta.sql`, `ew_enabled_merge.sql` | §A2 | DB grep gate §A2 is empty |
| **CL-5** | Server code removal | §A3 | Server grep gate §A3; `python -c "import app.main"` boots; a sample webhook POST with event code `EW` is logged and ignored, not a 500 |
| **CL-6** | Client code removal; `pnpm gen-types-service` | §A4 | Client grep gate §A4; `pnpm exec tsc -b --noEmit` clean; `pnpm build` passes |
| **CL-7** | Help articles, dev help, plan documents, `templates.py` comments | §A5 | Help grep gates §A5; both help screens render; `plans/` holds only `prompt3.md` and this file |
| **CL-8** | Smoke-test the running app (server + `pnpm start`) | — | Login works; Custom tab absent; App Settings has no `extended_warranty` row and no Extended Warranty switch; bell and other modules work; creating a throwaway BU succeeds and creates no `ew_*` objects (delete the BU after) |
| **CL-9** | Commit "Remove Extended Warranty" (client and server repos) | — | Clean `git status`; commit message lists what was removed and what was kept |

Rollback for Part A: `git revert` the CL-9 commit(s). CL-2 was skipped (user decision,
2026-09-13), so the old `ew_customer` data is not restorable — demo only, accepted.

### A1. Kept

| Kept | Why |
|---|---|
| `app/whatsapp/templates.py` → `TEMPLATES["EXTENDED_WARRANTY"]`, `TEMPLATES["EXTENDED_WARRANTY_LEAD"]` | Meta-approved (Part B). Comments referencing deleted plans are reworded to point at this plan. |
| Access rights 19 `CUSTOM_MENU`, 20 `CUSTOM_EXTENDED_WARRANTY` — in `seed_security_data.py`, `scripts/seed_access_right_ew.sql`, client `access-rights.ts`, `seed-roles-dialog.tsx` | D16. |
| `features/client/pages/client-custom-page.tsx`, `layout/custom-menu-registry.ts`, route `/client/custom`, the Custom tab in `client-top-nav.tsx` / `client-explorer-panel.tsx` | Generic add-on container; hides itself when it has no items. Edited in A4 to contain no Extended Warranty entry. |
| nginx `location /extended-warranty/` block (live server + `notes/Deployment.md`) | The approved reminder button points at that prefix; Part C serves it again. |
| `whatsappDeliveryStatus` pubsub `kind` field (`"JOB"` default) | Used by Customer Connect; generic. |

### A2. Database — `scripts/ew_cleanup.sql` (new, per BU schema)

Run once per BU schema **including the `demo1` template** (`SET search_path TO <bu>;`).
Idempotent.

```sql
BEGIN;
DROP VIEW  IF EXISTS ew_stage_v;
DROP TABLE IF EXISTS ew_customer;            -- takes its identity sequence, indexes and FKs with it

DELETE FROM app_setting WHERE setting_key = 'extended_warranty';

UPDATE app_setting
SET setting_value = setting_value - 'EXTENDED_WARRANTY', updated_at = now()
WHERE setting_key = 'whatsapp_notifications'
  AND jsonb_typeof(setting_value) = 'object'
  AND setting_value ? 'EXTENDED_WARRANTY';
COMMIT;
```

The schema dump shows those are the only objects (table, its identity sequence, six
indexes, three FKs, one view) — no functions or triggers.

Then regenerate, never by hand:

1. `pg_dump --schema-only` → `app/db/schema_dumps/service_plus_service.sql`.
2. `python -m app.db.tools.extract_schema` → rewrites `BuAdminDdl.BU_SCHEMA_DDL` in
   `app/db/sql/sql_bu_admin_ddl.py`.

Check: `grep -n "ew_customer\|ew_stage_v" app/db/schema_dumps/service_plus_service.sql app/db/sql/sql_bu_admin_ddl.py` → empty.

Seeds — `app/db/seeds/seed_bu_data.py`:
- Delete app_setting row **16** (`extended_warranty`).
- Row 15 (`whatsapp_notifications`): remove `"EXTENDED_WARRANTY": false` from the value and
  ", plus EXTENDED_WARRANTY" from its description.

Scripts — **delete** `scripts/ew_delta.sql` and `scripts/ew_enabled_merge.sql`.
`scripts/ew_cleanup.sql` itself is deleted in Step D2.6 once every tenant has run it.

### A3. Server code (`../service-plus-server`)

| File | Action |
|---|---|
| `app/db/sql/sql_extended_warranty.py` | **Delete** |
| `app/db/sql/sql_base.py` | Remove the `ExtendedWarrantySql` import and base |
| `app/whatsapp/sender.py` | Delete the whole Extended Warranty section (`_EW_GRACE_DAYS` through `send_ew_lead_alert`, ~lines 1125–1469) and the `sign_ew` import; remove `"EXTENDED_WARRANTY"` / `"EXTENDED_WARRANTY_LEAD"` from `_EVENT_CODE_BY_KEY` |
| `app/whatsapp/token.py` | Delete `sign_ew`, `verify_ew` |
| `app/whatsapp/templates.py` | Keep both specs; reword their comments (no references to deleted plans, stage keys or `<customer_id>-<stage>`) |
| `app/graphql/resolvers/jobs/extended_warranty.py` | **Delete** |
| `app/graphql/resolvers/mutation.py` | Remove the three imports and the `sendEwReminders`, `addEwFollowUp`, `resendEwLeadAlert` resolvers |
| `app/graphql/schema.graphql` | Remove those three mutation fields |
| `app/routers/public/extended_warranty_router.py` | **Delete** |
| `app/main.py` | Remove the router import and `include_router` |
| `app/routers/webhooks/whatsapp_webhook_router.py` | Remove `"EW"` / `"EL"` from `_EVENT_KEY_BY_CODE`, `_EW_EVENT_KEYS`, `_apply_ew_status_callback` and its branch in the dispatcher. **Confirm an unknown event code is logged and ignored, not raised** — ordinary robustness; Meta can deliver a late status callback for any message. |

Checks:
- `grep -rni "ew_customer\|ew_stage\|sign_ew\|verify_ew\|send_ew\|_EW_\|extended_warranty" app scripts --include=*.py --include=*.sql --include=*.graphql`
  → only `templates.py` (the two specs) and `seed_security_data.py` / `seed_access_right_ew.sql` (rights).
- `python -c "import app.main"` in the server venv boots (needs `TRACE_PLUS_SERVICE_KEY` in `.env`).

### A4. Client code (this package)

| File | Action |
|---|---|
| `src/features/client/components/custom/extended-warranty/` (13 files) | **Delete the folder** |
| `src/features/client/types/extended-warranty.ts` | **Delete** |
| `src/features/client/pages/client-custom-ew-ref-page.tsx` | **Delete** |
| `src/router/index.tsx`, `src/router/routes.ts` | Remove `customEwRef` and its route |
| `src/features/client/pages/client-custom-page.tsx` | Remove the Extended Warranty import and `case` (only `ComingSoon` remains) |
| `src/features/client/components/layout/custom-menu-registry.ts` | `CUSTOM_MENU_ITEMS = []`; `CustomMenuContextType` becomes `Record<string, never>` (or an empty object type); remove the `ShieldCheck` import |
| `src/store/context-slice.ts` | Remove `extendedWarrantyNotificationsEnabled`, its reducer and `selectExtendedWarrantyNotificationsEnabled` |
| `src/features/client/components/layout/client-layout.tsx` | Remove the `extended_warranty` setting parse and dispatch |
| `src/features/client/components/layout/client-top-nav.tsx` | Remove the selector, the context argument and the "Extended warranty interest" bell item |
| `src/features/client/components/layout/client-explorer-panel.tsx` | Remove the selector and context argument in `CustomExplorer` |
| `src/features/client/components/layout/use-notifications-summary.ts` | Remove the Extended Warranty query and the `ewNewInterest` field |
| `src/features/client/components/configurations/app-settings/edit-extended-warranty-dialog.tsx` | **Delete** |
| `src/features/client/components/configurations/app-settings/app-settings-section.tsx` | Remove the `extended_warranty` branch and import |
| `src/features/client/components/configurations/app-settings/edit-whatsapp-notifications-dialog.tsx` | Remove the `EXTENDED_WARRANTY` key from the value type, `toValue()` and the switch list |
| `src/constants/sql-map.ts` | Remove every `*_EW_*` id |
| `src/constants/graphql-map.ts` | Remove `sendEwReminders`, `addEwFollowUp`, `resendEwLeadAlert` |
| `src/constants/messages.ts` | Remove every `*_EW_*` key (grep each for other users first) |
| `src/types/db-schema-service.ts` | Regenerate: `pnpm gen-types-service` (after A2 ran on demo1) |

Checks:
- `grep -rni "extended.warranty\|extendedWarranty\|ew_customer\|_EW_\|EwCustomer\|Ew[A-Z][a-z]*Type" src`
  → only `access-rights.ts`, `seed-roles-dialog.tsx` (rights) and nothing else.
- `pnpm exec tsc -b --noEmit` clean; `pnpm build` passes.
- Running app: Custom tab absent; App Settings shows no `extended_warranty` row and no
  Extended Warranty switch in the WhatsApp dialog; bell unaffected otherwise.

### A5. Help and documentation

- `src/features/client/components/help/help-content.ts`: delete the `extended-warranty`
  article; in the App Settings article remove the `extended_warranty` row and the
  "Extended Warranty settings" heading + paragraph; remove the Extended Warranty event from
  the `whatsapp_notifications` descriptions (~1383, ~2867).
- `src/features/super-admin/components/help/dev-help-content.ts`: delete the
  `dev-whatsapp-extended-warranty` article; remove the `extended_warranty` settings row
  (~2136–2137) and the Extended Warranty key from the `whatsapp_notifications` row (~2133);
  in the WhatsApp rail article (~2286–2365) correct the TEMPLATES sentence (the two specs
  remain registered but have no sender until Part C), remove the `sign_ew` signing pair and
  the Extended Warranty send-path / callback text.
- Grep both files for `extended`, `ew_`, `EXTENDED_WARRANTY`, `Custom → ` → only the
  kept-rights mentions remain.
- `plans/`: **delete** `plan-ew.md`, `plan.md`, `plan1.md`, `prompt.md`, `prompt1.md`,
  `prompt2.md`. Everything still needed from them (template registration) is in Part B.
  Keep `prompt3.md` and this file.
- Server `templates.py` comments that cite `plans/plan.md` → cite `plans/plan-ew-final.md`.

### A6. Effect of cleanup

Extended Warranty ran only on the demo tenant, and all its messages went to internal
numbers. Cleanup deletes all of it — records, messages, settings — and nothing outside the
demo tenant is affected. The demo settings (Enabled, phone numbers, cap) are re-entered in
the new settings dialog after Part C ships.

---

# Part B — Carried over: the two approved templates

These are registered with Meta and approved. **Do not change anything in this table** —
a mismatch fails every send permanently, and a change means resubmission. The Part C design
is built around them.

### B1. `EXTENDED_WARRANTY` → `extended_warranty_reminder_v1`

| Field | Value |
|---|---|
| Category / language | Marketing / `en` |
| Header | `Warranty offer from {{business_unit}}` |
| Body params (order) | `customer_name`, `brand`, `product`, `expiry_date`, `contact_phone`, `whatsapp_number` |
| Body | "Hello {{customer_name}}, Greetings from {{brand}}. The warranty on your {{product}} ends on {{expiry_date}}. You can extend it for a further 1 or 2 years and stay covered for parts and labour. For details call {{contact_phone}} or WhatsApp {{whatsapp_number}}." |
| Footer | `Tap below if you'd like us to call you.` |
| Button | URL, Dynamic: text `I'm interested — contact me`, prefix `https://serviceplus.cloudjiffy.net/extended-warranty/` (no placeholder; the send appends the suffix) |

### B2. `EXTENDED_WARRANTY_LEAD` → `extended_warranty_lead_alert_v1`

| Field | Value |
|---|---|
| Category / language | Utility / `en` |
| Header | `New warranty lead — {{business_unit}}` |
| Body params (order) | `customer_line`, `device_line`, `warranty_line`, `contact_line`, `remarks_line` |
| Body | "A customer has asked about extending their warranty. Customer: … Device: … Warranty: … Contact: … Remarks: … This lead is already saved in Service+ — tap below to record the result." |
| Button | URL, Dynamic: text `Open in Service+`, prefix `https://serviceplus.cloudjiffy.net/client/custom/ew/` |

### B3. What the templates fix in place

1. **Public route prefix** must be `/extended-warranty/{token}` (FastAPI, no `/api`), and the
   existing nginx block keeps proxying it.
2. **Client route** must be `/client/custom/ew/:ref` — the alert's button appends to that
   prefix.
3. **Header** budget: 60 chars, the fixed text is 20, so `business_unit` is truncated at 40
   on a word boundary (`_truncate_business_unit`).
4. **Every parameter is one line** — `_sanitize` strips newlines/tabs; multi-field lines are
   joined with ` · ` in Python.
5. The reminder prints `contact_phone` and `whatsapp_number`, so the settings row must carry
   both and the dialog must validate them (blank would print `-`).
6. The reminder text says the warranty "ends on {date}" — why sending stops 7 days after
   expiry (D5).
7. The lead alert has no status/stage wording baked in — `warranty_line` is composed freely
   in Python, so the band label goes there.

---

# Part C — Design

## C1. Goal

A warranty lead is always in exactly one **state**. Staff change state only along the
allowed **transitions**, from each row's actions menu. The **Dashboard** shows a picture of
the state machine, clickable **Lead Pipeline** cards that open a **drill-down page** (grid +
actions, prominent Back), and two period **summaries**. The **Details** tab lists every
lead, newest first. WhatsApp reminders go only from New_Lead and Message_Sent, singly or in
bulk. In_progress leads carry **follow-ups** (notes, next follow-up date/time, stage).

## C2. Domain model

### C2.1 States

Stored in `ew_lead.state`. Substates are derived (never stored) except In_progress's stage.

| State | Label | Substates | Substate source | `is_closed` |
|---|---|---|---|---|
| `NEW_LEAD` | New Lead | 31–60 days · 8–30 days · 0–7 days · Overdue (+ All) | derived from `warranty_end_date − today` | false |
| `MESSAGE_SENT` | Message Sent | Delivered · Read · Fail · Awaiting (D2) | derived from the latest reminder's `delivery_status` | false |
| `INTERESTED` | Interested | — | — | false |
| `IN_PROGRESS` | In Progress | Stage 1 · Stage 2 · Stage 3 | stored: `ew_lead.progress_stage` | false |
| `WON` | Won | — | — | **true** |
| `LOST` | Lost | — | — | **true** |
| `CANCELLED` | Cancelled | — | — | **true** |

`is_closed` is a **generated column** — `GENERATED ALWAYS AS (state IN ('WON','LOST','CANCELLED')) STORED` —
so it can never disagree with `state` and nothing writes it.

### C2.2 Expiry bands

`days_left = warranty_end_date − CURRENT_DATE`.

| Band | Label | Rule | Card |
|---|---|---|---|
| `D61_PLUS` | 61+ days | `days_left > 60` | none (in All) |
| `D31_60` | 31–60 days | `31..60` | green |
| `D8_30` | 8–30 days | `8..30` | blue |
| `D0_7` | 0–7 days | `0..7` (0 = expires today) | orange |
| `OVERDUE` | Overdue | `< 0` | red |

The rule is written **once**, in `ew_lead_view` (§C3.3). The client holds labels only.

### C2.3 Transitions

```
NEW_LEAD      → MESSAGE_SENT*, IN_PROGRESS, WON, LOST, CANCELLED
MESSAGE_SENT  → INTERESTED†,   IN_PROGRESS, WON, LOST, CANCELLED
INTERESTED    →                IN_PROGRESS, WON, LOST, CANCELLED
IN_PROGRESS   →                             WON, LOST, CANCELLED    (+ Stage n → n+1)
LOST          →                IN_PROGRESS, WON
CANCELLED     →                IN_PROGRESS
WON           →  (terminal)
```

- `*` New_Lead → Message_Sent happens **only by sending** a reminder; the menu offers
  **Send WhatsApp reminder**, never a bare state change.
- `†` Message_Sent → Interested: automatic on the customer's tap, or **Mark interested** (D4).
- Sending again from Message_Sent (new band, or retry after failure) keeps the state.
- Entering In_progress (including reopen) sets `progress_stage = 1`; leaving clears
  `progress_stage` and `next_follow_up_at`.
- Reopen (Lost / Cancelled → In_progress) clears `closed_at`.

### C2.4 Stages

`progress_stage ∈ {1,2,3}` while In_progress, NULL otherwise (CHECK). Forward only (D3):
**Advance to Stage N** (a `transitionEwLead` In_progress → In_progress with a higher stage)
or the follow-up dialog's Stage field. Both are logged.

### C2.5 Sendable

A lead is sendable when **all** hold:

1. `state IN ('NEW_LEAD','MESSAGE_SENT')`
2. `NOT is_opted_out`
3. `days_left ≥ -7` (D5)
4. no reminder in the lead's **current band** with a status other than FAILED (D7)
5. the mobile is valid (`is_valid_mobile` server / `isValidMobile` client)

1–4 are one column, `can_send`, on `ew_lead_view`; 5 stays in code. The server re-checks at
send time; `can_send` only decides what the UI offers.

### C2.6 Invariants

- `is_closed` is generated — never in a write payload.
- `state` / `progress_stage` change **only** via `transitionEwLead`, `addEwFollowUp`, the
  send claim and the public interest route. genericUpdate on `ew_lead` edits contact /
  device / remarks only (convention — §D4 R4).
- One successful reminder per (lead, band) — a partial unique index.
- Delivery status never moves backwards (`status_rank`), keyed on `wamid`.
- A customer's interest is committed **before** any notification is attempted.
- Public links are type-tagged and bound to a (lead, message) pair (§C6.3).

## C3. Database (BU schema — `demo1` template, then every BU)

### C3.1 Why three tables

- Message counts by period and status need a row per message.
- Won / Lost / Cancelled / Interested by period need per-lead timestamps plus a history.
- The timeline needs who / when / what for every change.
- Exactly-once per band is a partial unique index — it enforces itself, unlike a WHERE
  clause that must be kept correct by hand.
- Plain columns avoid jsonb path/type pitfalls entirely.

### C3.2 DDL — `scripts/ew_schema.sql` (idempotent; per BU)

```sql
CREATE TABLE IF NOT EXISTS ew_lead (
    id                 bigint GENERATED ALWAYS AS IDENTITY,
    branch_id          bigint NOT NULL,
    full_name          text   NOT NULL,
    mobile             text   NOT NULL,
    email              text,
    address            text,
    city               text,
    brand_id           bigint NOT NULL,
    product_id         bigint,
    model_name         text,
    serial_no          text,
    purchase_date      date,
    warranty_end_date  date   NOT NULL,
    remarks            text,
    state              text     DEFAULT 'NEW_LEAD' NOT NULL,
    progress_stage     smallint,
    is_closed          boolean GENERATED ALWAYS AS (state IN ('WON', 'LOST', 'CANCELLED')) STORED,
    state_changed_at   timestamp with time zone DEFAULT now() NOT NULL,
    closed_at          timestamp with time zone,
    interest_at        timestamp with time zone,
    preferred_contact  text,
    customer_remarks   text,
    next_follow_up_at  timestamp with time zone,
    last_follow_up_at  timestamp with time zone,
    follow_up_count    integer DEFAULT 0 NOT NULL,
    is_opted_out       boolean DEFAULT false NOT NULL,
    opted_out_at       timestamp with time zone,
    created_by         bigint,
    created_at         timestamp with time zone DEFAULT now() NOT NULL,
    updated_at         timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_lead_pkey PRIMARY KEY (id),
    CONSTRAINT ew_lead_branch_fkey  FOREIGN KEY (branch_id)  REFERENCES branch(id),
    CONSTRAINT ew_lead_brand_fkey   FOREIGN KEY (brand_id)   REFERENCES brand(id),
    CONSTRAINT ew_lead_product_fkey FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT ew_lead_state_chk CHECK (state IN
        ('NEW_LEAD', 'MESSAGE_SENT', 'INTERESTED', 'IN_PROGRESS', 'WON', 'LOST', 'CANCELLED')),
    -- NULL-safe (a CHECK passes on NULL; Step 11 test 3 caught the first AND/OR form):
    CONSTRAINT ew_lead_progress_chk CHECK (
        CASE WHEN state = 'IN_PROGRESS' THEN COALESCE(progress_stage BETWEEN 1 AND 3, false)
             ELSE progress_stage IS NULL END),
    CONSTRAINT ew_lead_closed_at_chk CHECK ((state IN ('WON', 'LOST', 'CANCELLED')) = (closed_at IS NOT NULL)),
    CONSTRAINT ew_lead_preferred_contact_chk CHECK (preferred_contact IS NULL OR preferred_contact IN ('CALL', 'WHATSAPP'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ew_lead_dedup_idx        ON ew_lead (mobile, COALESCE(serial_no, ''), warranty_end_date);
CREATE INDEX        IF NOT EXISTS ew_lead_branch_state_idx ON ew_lead (branch_id, state);
CREATE INDEX        IF NOT EXISTS ew_lead_created_idx      ON ew_lead (branch_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS ew_lead_expiry_open_idx  ON ew_lead (warranty_end_date) WHERE NOT is_closed;
CREATE INDEX        IF NOT EXISTS ew_lead_mobile_idx       ON ew_lead (mobile);
CREATE INDEX        IF NOT EXISTS ew_lead_follow_up_idx    ON ew_lead (next_follow_up_at) WHERE state = 'IN_PROGRESS';

CREATE TABLE IF NOT EXISTS ew_message (
    id               bigint GENERATED ALWAYS AS IDENTITY,
    ew_lead_id       bigint   NOT NULL,
    kind             text     DEFAULT 'REMINDER' NOT NULL,   -- REMINDER | LEAD_ALERT
    band             text,                                   -- REMINDER: band at send time; NULL for LEAD_ALERT
    delivery_status  text     DEFAULT 'PENDING' NOT NULL,
    status_rank      smallint DEFAULT 0 NOT NULL,            -- PENDING 0 ACCEPTED 1 SENT 2 DELIVERED 3 READ 4 FAILED 9
    wamid            text,
    error            text,
    sent_at          timestamp with time zone DEFAULT now() NOT NULL,
    sent_by          bigint,
    settled_at       timestamp with time zone,
    CONSTRAINT ew_message_pkey PRIMARY KEY (id),
    CONSTRAINT ew_message_lead_fkey FOREIGN KEY (ew_lead_id) REFERENCES ew_lead(id) ON DELETE CASCADE,
    CONSTRAINT ew_message_kind_chk CHECK (kind IN ('REMINDER', 'LEAD_ALERT')),
    CONSTRAINT ew_message_status_chk CHECK (delivery_status IN
        ('PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    -- NULL-safe: a REMINDER with a NULL band would also dodge the once-per-band index.
    CONSTRAINT ew_message_band_chk CHECK (
        CASE WHEN kind = 'REMINDER' THEN COALESCE(band IN ('D61_PLUS', 'D31_60', 'D8_30', 'D0_7', 'OVERDUE'), false)
             ELSE band IS NULL END)
);
-- D7: exactly one live reminder per (lead, band). FAILED drops out, so a failed band can be retried.
CREATE UNIQUE INDEX IF NOT EXISTS ew_message_once_per_band_idx
    ON ew_message (ew_lead_id, band) WHERE kind = 'REMINDER' AND delivery_status <> 'FAILED';
CREATE UNIQUE INDEX IF NOT EXISTS ew_message_wamid_idx ON ew_message (wamid) WHERE wamid IS NOT NULL;
CREATE INDEX        IF NOT EXISTS ew_message_lead_idx  ON ew_message (ew_lead_id, sent_at DESC);
CREATE INDEX        IF NOT EXISTS ew_message_sent_idx  ON ew_message (sent_at) WHERE kind = 'REMINDER';

CREATE TABLE IF NOT EXISTS ew_lead_event (
    id                 bigint GENERATED ALWAYS AS IDENTITY,
    ew_lead_id         bigint NOT NULL,
    event_type         text   NOT NULL,     -- STATE_CHANGE | STAGE_CHANGE | INTEREST | FOLLOW_UP | OPT_OUT
    from_state         text,
    to_state           text,
    progress_stage     smallint,
    action             text,                -- FOLLOW_UP: CALL | WHATSAPP | SMS | VISIT | OTHER
    notes              text,
    next_follow_up_at  timestamp with time zone,
    ew_message_id      bigint,              -- INTEREST: the reminder whose link was tapped
    created_by         bigint,              -- NULL = customer / system
    created_by_name    text,                -- stamped server-side from created_by
    created_at         timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_lead_event_pkey PRIMARY KEY (id),
    CONSTRAINT ew_lead_event_lead_fkey    FOREIGN KEY (ew_lead_id)    REFERENCES ew_lead(id)    ON DELETE CASCADE,
    CONSTRAINT ew_lead_event_message_fkey FOREIGN KEY (ew_message_id) REFERENCES ew_message(id) ON DELETE SET NULL,
    CONSTRAINT ew_lead_event_type_chk CHECK (event_type IN
        ('STATE_CHANGE', 'STAGE_CHANGE', 'INTEREST', 'FOLLOW_UP', 'OPT_OUT')),
    CONSTRAINT ew_lead_event_action_chk CHECK (action IS NULL OR action IN
        ('CALL', 'WHATSAPP', 'SMS', 'VISIT', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS ew_lead_event_lead_idx ON ew_lead_event (ew_lead_id, created_at DESC);
```

PostgreSQL is 14.6 — generated columns and partial-index `ON CONFLICT` inference are available.

### C3.3 View — `ew_lead_view`

The single home of the band rule, the grace window and `can_send`.

```sql
CREATE OR REPLACE VIEW ew_lead_view AS
SELECT l.id, l.branch_id, l.full_name, l.mobile, l.email, l.address, l.city,
       l.brand_id, l.product_id, l.model_name, l.serial_no, l.purchase_date, l.warranty_end_date,
       l.remarks, l.state, l.progress_stage, l.is_closed, l.state_changed_at, l.closed_at,
       l.interest_at, l.preferred_contact, l.customer_remarks,
       l.next_follow_up_at, l.last_follow_up_at, l.follow_up_count,
       l.is_opted_out, l.opted_out_at, l.created_by, l.created_at, l.updated_at,
       dl.days_left,
       bd.band,
       lm.id              AS last_message_id,
       lm.delivery_status AS last_delivery_status,
       lm.sent_at         AS last_sent_at,
       lm.error           AS last_error,
       COALESCE(mc.message_count, 0) AS message_count,
       la.delivery_status AS alert_status,
       la.error           AS alert_error,
       CASE WHEN l.state <> 'MESSAGE_SENT'       THEN NULL
            WHEN lm.delivery_status = 'READ'      THEN 'READ'
            WHEN lm.delivery_status = 'DELIVERED' THEN 'DELIVERED'
            WHEN lm.delivery_status = 'FAILED'    THEN 'FAILED'
            ELSE 'AWAITING' END  AS message_group,
       (l.state IN ('NEW_LEAD', 'MESSAGE_SENT')
        AND NOT l.is_opted_out
        AND dl.days_left >= -7
        AND NOT EXISTS (SELECT 1 FROM ew_message x
                        WHERE x.ew_lead_id = l.id AND x.kind = 'REMINDER'
                          AND x.band = bd.band AND x.delivery_status <> 'FAILED')
       ) AS can_send
FROM ew_lead l
CROSS JOIN LATERAL (SELECT (l.warranty_end_date - CURRENT_DATE) AS days_left) dl
CROSS JOIN LATERAL (
    SELECT CASE WHEN dl.days_left < 0   THEN 'OVERDUE'
                WHEN dl.days_left <= 7  THEN 'D0_7'
                WHEN dl.days_left <= 30 THEN 'D8_30'
                WHEN dl.days_left <= 60 THEN 'D31_60'
                ELSE 'D61_PLUS' END AS band) bd
LEFT JOIN LATERAL (
    SELECT m.id, m.delivery_status, m.sent_at, m.error FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'REMINDER'
    ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) lm ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS message_count FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'REMINDER') mc ON true
LEFT JOIN LATERAL (
    SELECT m.delivery_status, m.error FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'LEAD_ALERT'
    ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) la ON true;
```

Columns are listed explicitly (no `l.*`), so adding a column to `ew_lead` is a deliberate
view edit rather than a silent mismatch.

### C3.4 Settings (same script)

```sql
INSERT INTO app_setting (id, setting_key, setting_value, description, is_editable) VALUES
  (16, 'extended_warranty',
   '{"contact_phone": "", "daily_send_cap": 250, "enabled": false, "notify_email": "", "staff_whatsapp_number": "", "whatsapp_number": ""}',
   'Extended Warranty. `enabled` shows Custom → Extended Warranty; sending also needs whatsapp_notifications.EXTENDED_WARRANTY.', true)
ON CONFLICT (id) DO NOTHING;

UPDATE app_setting
SET setting_value = setting_value || '{"EXTENDED_WARRANTY": false}'::jsonb, updated_at = now()
WHERE setting_key = 'whatsapp_notifications'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT (setting_value ? 'EXTENDED_WARRANTY');
```

| Key | Meaning |
|---|---|
| `enabled` | Module visible (Custom → Extended Warranty) and permitted to send. Strict `is True`; anything else is off. |
| `contact_phone`, `whatsapp_number` | Body params 5 and 6 of the reminder. Validated in the dialog. |
| `staff_whatsapp_number` | Receives the lead alert. Blank = no alert. |
| `notify_email` | Optional e-mail copy of each new interest. Blank = off. |
| `daily_send_cap` | Max reminders per BU schema per day (non-FAILED). `0` = unlimited. |

Two switches must both be on to send: `extended_warranty.enabled` and
`whatsapp_notifications.EXTENDED_WARRANTY`.

If `id 16` is taken by another setting in a tenant (it should not be after A2), the insert
must fail loudly, not silently skip: add a guard `DO $$ … IF EXISTS (SELECT 1 FROM app_setting WHERE id = 16 AND setting_key <> 'extended_warranty') THEN RAISE EXCEPTION … $$`.

### C3.5 New BUs and regeneration

After `ew_schema.sql` runs on `demo1`: regenerate the schema dump and `BU_SCHEMA_DDL`
(§A2 steps 1–2); add row 16 and the `EXTENDED_WARRANTY` key on row 15 to
`seed_bu_data.py`; client `pnpm gen-types-service`. Create a throwaway BU to confirm
everything arrives with no manual step.

### C3.6 Access rights

Unchanged (D16): `CUSTOM_MENU` gates the tab, `CUSTOM_EXTENDED_WARRANTY` gates the screen,
every EW mutation and genericUpdate on `ew_lead`.

## C4. SQL store — `app/db/sql/sql_extended_warranty.py` (new)

`class ExtendedWarrantySql`, added to `SqlStore`'s bases in `sql_base.py`. Module rule,
stated in its docstring: **cast every repeated named placeholder explicitly**
(`%(x)s::text` / `::smallint` / `::bigint` / `::timestamptz`) — psycopg folds repeats into
one parameter and Postgres unifies its type across every use.

### C4.1 Inventory

| Constant | Kind | Used by |
|---|---|---|
| `GET_EW_LEADS_PAGED` | read | Details tab, drill-down page |
| `GET_EW_LEAD_DETAIL` | read | detail dialog, deep link, staff alert composition |
| `GET_EW_LEAD_TIMELINE` | read | detail dialog, follow-up dialog history |
| `GET_EW_LEAD_BY_MOBILE` | read | New/Edit Lead dialog lookup |
| `GET_EW_DASHBOARD` | read | dashboard (one row) |
| `COUNT_EW_OPEN_INTEREST` | read | bell |
| `GET_EW_LEADS_FOR_SEND` | read | server-side re-filter before sending |
| `GET_EW_LEAD_FOR_PUBLIC` | read | public landing page |
| `GET_EW_SENT_TODAY_COUNT` | read | daily cap |
| `GET_EW_STAFF_NAME` | read | stamping `created_by_name` |
| `CLAIM_EW_REMINDER` | write | send: claim + New_Lead→Message_Sent, one statement |
| `SET_EW_MESSAGE_SENT` | write | send: settle after Meta replies |
| `CLAIM_EW_LEAD_ALERT` | write | staff alert row |
| `SET_EW_MESSAGE_OUTCOME` | write | webhook (by wamid) |
| `TRANSITION_EW_LEAD` | write | `transitionEwLead` |
| `ADD_EW_FOLLOW_UP` | write | `addEwFollowUp` |
| `RECORD_EW_INTEREST` | write | public interest POST |
| `SET_EW_OPT_OUT` | write | public opt-out POST |

Client `sql-map.ts` gets only the ids the browser calls: `GET_EW_LEADS_PAGED`,
`GET_EW_LEAD_DETAIL`, `GET_EW_LEAD_TIMELINE`, `GET_EW_LEAD_BY_MOBILE`, `GET_EW_DASHBOARD`,
`COUNT_EW_OPEN_INTEREST`.

**As built (Step 11, 2026-09-13) — where the code differs from the SQL sketched below:**

- **Two classes.** `ExtendedWarrantySql` (the six browser reads) is composed into
  `SqlStore`. `ExtendedWarrantyServerSql` (every write + the four server-only reads) is
  deliberately **not**: genericQuery runs any `SqlStore` constant by `sqlId` on an
  autocommit connection, so a write placed there is callable from the browser —
  `TRANSITION_EW_LEAD` with a hand-made `allowed_from` would bypass the transition table
  and the `CUSTOM_EXTENDED_WARRANTY` check. Same reasoning as `PublicSql`.
- **Placeholder style** follows `sql_reports_audit.py`: a placeholder used more than once is
  bound once in a `"p_<name>"` CTE and read with `(table "p_<name>")`; every placeholder is
  cast. Every genericQuery read needs every key (null = filter off).
- `TRANSITION_EW_LEAD` enforces D3 itself: entering In Progress from another state sets
  Stage 1 whatever stage is passed.
- `ADD_EW_FOLLOW_UP` logs a `STAGE_CHANGE` event alongside `FOLLOW_UP` when the stage rises
  (C2.4 "both are logged").
- `RECORD_EW_INTEREST` records nothing for an opted-out lead; remarks are trimmed.
- `GET_EW_LEAD_DETAIL` takes `branch_id` null = any branch (the staff-alert path knows only the lead id).
- Timeline columns are `occurred_at` / `item_type` (not `at` / `type`); the bell count
  column is `open_interest`; the dashboard is written with `COUNT(*) FILTER` over two CTEs
  instead of one sub-select per column — same column names as §C4.4.

### C4.2 Writes

**`CLAIM_EW_REMINDER`** — exactly-once claim and state move, atomic:

```sql
WITH claimed AS (
    INSERT INTO ew_message (ew_lead_id, kind, band, delivery_status, status_rank, sent_by)
    SELECT v.id, 'REMINDER', v.band, 'PENDING', 0, %(sent_by)s::bigint
    FROM ew_lead_view v
    WHERE v.id = %(ew_lead_id)s::bigint
      AND v.branch_id = %(branch_id)s::bigint
      AND v.can_send
    ON CONFLICT (ew_lead_id, band) WHERE kind = 'REMINDER' AND delivery_status <> 'FAILED'
    DO NOTHING
    RETURNING id, ew_lead_id, band
),
moved AS (
    UPDATE ew_lead l
    SET state = 'MESSAGE_SENT', state_changed_at = now(), updated_at = now()
    FROM claimed c
    WHERE l.id = c.ew_lead_id AND l.state = 'NEW_LEAD'
    RETURNING l.id
),
ev AS (
    INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, created_by, created_by_name)
    SELECT id, 'STATE_CHANGE', 'NEW_LEAD', 'MESSAGE_SENT', %(sent_by)s::bigint, %(sent_by_name)s::text
    FROM moved
)
SELECT id AS ew_message_id, band FROM claimed
```

No row → skip without calling Meta. Concurrent claims for one lead produce one row (the
unique index serialises them).

**`SET_EW_MESSAGE_SENT`** — `UPDATE ew_message SET wamid = %(wamid)s::text, delivery_status = %(status)s::text, status_rank = %(rank)s::smallint, error = %(error)s::text, settled_at = now() WHERE id = %(id)s::bigint AND delivery_status = 'PENDING' RETURNING id`
(`ACCEPTED`/1 or `FAILED`/9). If a webhook already advanced the row, the later state stands.

**`CLAIM_EW_LEAD_ALERT`** — `INSERT INTO ew_message (ew_lead_id, kind, delivery_status, status_rank, error) VALUES (%(ew_lead_id)s::bigint, 'LEAD_ALERT', %(status)s::text, %(rank)s::smallint, %(error)s::text) RETURNING id`
— PENDING before a real send, or directly FAILED when the staff number is invalid, so the
failure is visible and re-sendable.

**`SET_EW_MESSAGE_OUTCOME`** — webhook, both kinds:

```sql
UPDATE ew_message
SET delivery_status = %(status)s::text,
    status_rank     = %(new_rank)s::smallint,
    error           = %(error)s::text,
    settled_at      = now()
WHERE wamid = %(wamid)s::text
  AND status_rank < %(new_rank)s::smallint
RETURNING id, ew_lead_id, kind
```

**`TRANSITION_EW_LEAD`** — guarded by an allowed-from list computed in Python:

```sql
WITH cur AS (
    SELECT id, state, progress_stage FROM ew_lead
    WHERE id = %(ew_lead_id)s::bigint AND branch_id = %(branch_id)s::bigint
    FOR UPDATE
),
moved AS (
    UPDATE ew_lead l
    SET state             = %(to_state)s::text,
        progress_stage    = CASE WHEN %(to_state)s::text = 'IN_PROGRESS'
                                 THEN COALESCE(%(progress_stage)s::smallint, 1) ELSE NULL END,
        next_follow_up_at = CASE WHEN %(to_state)s::text = 'IN_PROGRESS' THEN l.next_follow_up_at ELSE NULL END,
        closed_at         = CASE WHEN %(to_state)s::text IN ('WON', 'LOST', 'CANCELLED') THEN now() ELSE NULL END,
        interest_at       = CASE WHEN %(to_state)s::text = 'INTERESTED' THEN COALESCE(l.interest_at, now()) ELSE l.interest_at END,
        state_changed_at  = CASE WHEN cur.state <> %(to_state)s::text THEN now() ELSE l.state_changed_at END,
        updated_at        = now()
    FROM cur
    WHERE l.id = cur.id
      AND cur.state = ANY(%(allowed_from)s::text[])
      AND (cur.state <> 'IN_PROGRESS' OR %(to_state)s::text <> 'IN_PROGRESS'
           OR %(progress_stage)s::smallint > cur.progress_stage)
    RETURNING l.id, cur.state AS from_state, l.state AS to_state, l.progress_stage
)
INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, progress_stage, notes, created_by, created_by_name)
SELECT id,
       CASE WHEN from_state = to_state THEN 'STAGE_CHANGE' ELSE 'STATE_CHANGE' END,
       from_state, to_state, progress_stage, %(notes)s::text, %(by)s::bigint, %(by_name)s::text
FROM moved
RETURNING ew_lead_id, from_state, to_state, progress_stage
```

No row → the lead changed under the user or the move is not allowed → resolver returns
`{ok: false, reason: "STALE"}`.

**`ADD_EW_FOLLOW_UP`** — In_progress only; stage never decreases:

```sql
WITH moved AS (
    UPDATE ew_lead
    SET next_follow_up_at = %(next_follow_up_at)s::timestamptz,
        progress_stage    = GREATEST(progress_stage, COALESCE(%(progress_stage)s::smallint, progress_stage)),
        follow_up_count   = follow_up_count + 1,
        last_follow_up_at = now(),
        updated_at        = now()
    WHERE id = %(ew_lead_id)s::bigint AND branch_id = %(branch_id)s::bigint AND state = 'IN_PROGRESS'
    RETURNING id, progress_stage
)
INSERT INTO ew_lead_event (ew_lead_id, event_type, to_state, progress_stage, action, notes, next_follow_up_at, created_by, created_by_name)
SELECT id, 'FOLLOW_UP', 'IN_PROGRESS', progress_stage, %(action)s::text, %(notes)s::text,
       %(next_follow_up_at)s::timestamptz, %(by)s::bigint, %(by_name)s::text
FROM moved
RETURNING id
```

`next_follow_up_at` is replaced each time; NULL clears it.

**`RECORD_EW_INTEREST`** — first tap only:

```sql
WITH cur AS (
    SELECT id, state FROM ew_lead
    WHERE id = %(ew_lead_id)s::bigint AND interest_at IS NULL
    FOR UPDATE
),
moved AS (
    UPDATE ew_lead l
    SET interest_at       = now(),
        preferred_contact = %(preferred_contact)s::text,
        customer_remarks  = %(customer_remarks)s::text,
        state             = CASE WHEN cur.state = 'MESSAGE_SENT' THEN 'INTERESTED' ELSE l.state END,
        state_changed_at  = CASE WHEN cur.state = 'MESSAGE_SENT' THEN now() ELSE l.state_changed_at END,
        updated_at        = now()
    FROM cur WHERE l.id = cur.id
    RETURNING l.id, cur.state AS from_state, l.state AS to_state
),
ev AS (
    INSERT INTO ew_lead_event (ew_lead_id, event_type, from_state, to_state, notes, ew_message_id)
    SELECT id, 'INTEREST', from_state, to_state, %(customer_remarks)s::text, %(ew_message_id)s::bigint
    FROM moved
)
SELECT id, from_state, to_state FROM moved
```

State moves only from Message_Sent (the transition table). From other states the interest
is still recorded and the staff alert still fires. A second tap returns nothing → no second
alert.

**`SET_EW_OPT_OUT`** — sets `is_opted_out`, `opted_out_at` where not already opted out, plus
an `OPT_OUT` event (same CTE pattern). State unchanged (§D4 R5).

### C4.3 Reads

**`GET_EW_LEADS_PAGED`** — one read for Details and every drill-down:

```sql
SELECT v.id AS ew_lead_id, v.full_name, v.mobile, v.email, v.address, v.city,
       v.brand_id, b.name AS brand_name, v.product_id,
       COALESCE(NULLIF(v.model_name, ''), p.name, '') AS product_label, v.model_name,
       v.serial_no, v.purchase_date, v.warranty_end_date, v.days_left, v.band,
       v.remarks, v.state, v.progress_stage, v.is_closed, v.state_changed_at, v.closed_at,
       v.interest_at, v.preferred_contact, v.customer_remarks,
       v.next_follow_up_at, v.last_follow_up_at, v.follow_up_count,
       v.is_opted_out, v.last_message_id, v.last_delivery_status, v.last_sent_at, v.last_error,
       v.message_count, v.message_group, v.alert_status, v.alert_error, v.can_send,
       v.created_at, u.full_name AS created_by_name,
       COUNT(*) OVER () AS total_count
FROM ew_lead_view v
LEFT JOIN brand   b ON b.id = v.brand_id
LEFT JOIN product p ON p.id = v.product_id
LEFT JOIN security."user" u ON u.id = v.created_by
WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s::bigint)
  AND (%(state)s::text          IS NULL OR v.state = %(state)s::text)
  AND (%(band)s::text           IS NULL OR v.band = %(band)s::text)
  AND (%(message_group)s::text  IS NULL OR v.message_group = %(message_group)s::text)
  AND (%(progress_stage)s::int  IS NULL OR v.progress_stage = %(progress_stage)s::int)
  AND (%(is_closed)s::boolean   IS NULL OR v.is_closed = %(is_closed)s::boolean)
  AND (%(follow_up_due)s::boolean IS NOT TRUE OR (v.state = 'IN_PROGRESS' AND v.next_follow_up_at <= now()))
  AND (%(search)s::text IS NULL OR %(search)s::text = ''
       OR v.full_name  ILIKE '%%' || %(search)s::text || '%%'
       OR v.mobile     ILIKE '%%' || %(search)s::text || '%%'
       OR v.serial_no  ILIKE '%%' || %(search)s::text || '%%'
       OR v.model_name ILIKE '%%' || %(search)s::text || '%%'
       OR b.name       ILIKE '%%' || %(search)s::text || '%%'
       OR p.name       ILIKE '%%' || %(search)s::text || '%%')
ORDER BY CASE WHEN %(follow_up_due)s::boolean IS TRUE THEN v.next_follow_up_at END ASC NULLS LAST,
         v.created_at DESC, v.id DESC
LIMIT %(limit)s OFFSET %(offset)s
```

**`GET_EW_LEAD_DETAIL`** — the same projection for one `ew_lead_id` (with `branch_id`
check), no paging.

**`GET_EW_LEAD_TIMELINE`** — merged, newest first:

```sql
SELECT 'EVENT' AS source, e.id, e.created_at AS at, e.event_type AS type, e.from_state, e.to_state,
       e.progress_stage, e.action, e.notes, e.next_follow_up_at, e.created_by_name AS by_name,
       NULL::text AS kind, NULL::text AS band, NULL::text AS delivery_status, NULL::text AS error
FROM ew_lead_event e WHERE e.ew_lead_id = %(ew_lead_id)s::bigint
UNION ALL
SELECT 'MESSAGE', m.id, m.sent_at, 'MESSAGE', NULL, NULL, NULL, NULL, NULL, NULL, u.full_name,
       m.kind, m.band, m.delivery_status, m.error
FROM ew_message m LEFT JOIN security."user" u ON u.id = m.sent_by
WHERE m.ew_lead_id = %(ew_lead_id)s::bigint
ORDER BY at DESC, id DESC
LIMIT 200
```

**`GET_EW_LEAD_BY_MOBILE`** — `UNION ALL` of `ew_lead` (source `'EW'`, newest first) and
`customer_contact` (source `'CUSTOMER'`, address from `address_line1/2`), matching on
`mobile`, `LIMIT 5`. EW rows carry the device fields; customer rows carry person fields only.

**`GET_EW_LEADS_FOR_SEND`** — `id, full_name, mobile, brand_name, product_label, warranty_end_date, band`
from `ew_lead_view` where `id = ANY(%(ew_lead_ids)s::bigint[]) AND branch_id = %(branch_id)s::bigint AND can_send`.

**`GET_EW_LEAD_FOR_PUBLIC`** — binds the token's lead **and** message:

```sql
SELECT l.id AS ew_lead_id, l.full_name, b.name AS brand_name,
       COALESCE(NULLIF(l.model_name, ''), p.name, '') AS product_label,
       l.warranty_end_date, l.is_opted_out, l.state, (l.interest_at IS NOT NULL) AS has_interest
FROM ew_lead l
JOIN ew_message m ON m.id = %(ew_message_id)s::bigint AND m.ew_lead_id = l.id AND m.kind = 'REMINDER'
LEFT JOIN brand   b ON b.id = l.brand_id
LEFT JOIN product p ON p.id = l.product_id
WHERE l.id = %(ew_lead_id)s::bigint
```

**`GET_EW_SENT_TODAY_COUNT`** — reminders with `sent_at >= date_trunc('day', now())` and
status ≠ FAILED (per BU schema).

**`COUNT_EW_OPEN_INTEREST`** — `COUNT(*)` of `state = 'INTERESTED'`, optional branch.

**`GET_EW_STAFF_NAME`** — `SELECT full_name FROM security."user" WHERE id = %(user_id)s`.

### C4.4 `GET_EW_DASHBOARD`

One row. Periods per D11, message groups per D12. Column naming convention
`<metric>_<period>` with periods `today | week | month | older` so the client renders the
summaries by looping two arrays.

```sql
WITH p AS (SELECT date_trunc('day', now()) AS d, date_trunc('week', now()) AS w, date_trunc('month', now()) AS m),
l AS (SELECT v.* FROM ew_lead_view v
      WHERE (%(branch_id)s::bigint IS NULL OR v.branch_id = %(branch_id)s::bigint)),
msg AS (SELECT x.* FROM ew_message x JOIN ew_lead y ON y.id = x.ew_lead_id
        WHERE x.kind = 'REMINDER'
          AND (%(branch_id)s::bigint IS NULL OR y.branch_id = %(branch_id)s::bigint))
SELECT
  -- Lead Pipeline (current state)
  (SELECT COUNT(*) FROM l)                                                     AS leads_total,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD')                            AS new_all,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD' AND band = 'D31_60')        AS new_31_60,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD' AND band = 'D8_30')         AS new_8_30,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD' AND band = 'D0_7')          AS new_0_7,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD' AND band = 'OVERDUE')       AS new_overdue,
  (SELECT COUNT(*) FROM l WHERE state = 'NEW_LEAD' AND band = 'D61_PLUS')      AS new_61_plus,
  (SELECT COUNT(*) FROM l WHERE state = 'MESSAGE_SENT')                        AS sent_all,
  (SELECT COUNT(*) FROM l WHERE message_group = 'AWAITING')                    AS sent_awaiting,
  (SELECT COUNT(*) FROM l WHERE message_group = 'DELIVERED')                   AS sent_delivered,
  (SELECT COUNT(*) FROM l WHERE message_group = 'READ')                        AS sent_read,
  (SELECT COUNT(*) FROM l WHERE message_group = 'FAILED')                      AS sent_failed,
  (SELECT COUNT(*) FROM l WHERE state = 'INTERESTED')                          AS interested,
  (SELECT COUNT(*) FROM l WHERE state = 'IN_PROGRESS')                         AS in_progress_all,
  (SELECT COUNT(*) FROM l WHERE state = 'IN_PROGRESS' AND progress_stage = 1)  AS in_progress_1,
  (SELECT COUNT(*) FROM l WHERE state = 'IN_PROGRESS' AND progress_stage = 2)  AS in_progress_2,
  (SELECT COUNT(*) FROM l WHERE state = 'IN_PROGRESS' AND progress_stage = 3)  AS in_progress_3,
  (SELECT COUNT(*) FROM l WHERE state = 'WON')                                 AS won,
  (SELECT COUNT(*) FROM l WHERE state = 'LOST')                                AS lost,
  (SELECT COUNT(*) FROM l WHERE state = 'CANCELLED')                           AS cancelled,
  (SELECT COUNT(*) FROM l WHERE state = 'IN_PROGRESS' AND next_follow_up_at <= now()) AS follow_ups_due,

  -- Messages by sent_at — TODAY shown; repeat for _week (>= p.w), _month (>= p.m), _older (< p.m)
  (SELECT COUNT(*) FROM msg, p WHERE sent_at >= p.d)                                     AS msg_total_today,
  (SELECT COUNT(*) FROM msg, p WHERE sent_at >= p.d AND delivery_status = 'READ')        AS msg_read_today,
  (SELECT COUNT(*) FROM msg, p WHERE sent_at >= p.d AND delivery_status = 'DELIVERED')   AS msg_delivered_today,
  (SELECT COUNT(*) FROM msg, p WHERE sent_at >= p.d AND delivery_status = 'FAILED')      AS msg_failed_today,
  (SELECT COUNT(*) FROM msg, p WHERE sent_at >= p.d
       AND delivery_status IN ('PENDING', 'ACCEPTED', 'SENT'))                          AS msg_awaiting_today,

  -- Overall — each metric by its own timestamp; TODAY shown; repeat per period
  (SELECT COUNT(*) FROM l, p WHERE created_at  >= p.d)                                   AS leads_today,
  (SELECT COUNT(*) FROM l, p WHERE interest_at >= p.d)                                   AS interested_today,
  (SELECT COUNT(*) FROM l, p WHERE state = 'WON'       AND closed_at >= p.d)             AS won_today,
  (SELECT COUNT(*) FROM l, p WHERE state = 'LOST'      AND closed_at >= p.d)             AS lost_today,
  (SELECT COUNT(*) FROM l, p WHERE state = 'CANCELLED' AND closed_at >= p.d)             AS cancelled_today
```

Write every period out in full in the store. Won/Lost/Cancelled by period count leads
**currently** in that state whose `closed_at` falls in the period.

## C5. Server Python — new files and edits

| File | Content |
|---|---|
| `app/whatsapp/ew_sender.py` (new) | settings, params, send path, lead alert (§C5.1) |
| `app/graphql/resolvers/custom/__init__.py`, `extended_warranty.py` (new) | transition table, resolvers' helpers, table-rights map (§C5.3) |
| `app/routers/public/extended_warranty_router.py` (new) | landing / interest / opt-out (§C5.5) |
| `app/whatsapp/token.py` | new `sign_ew` / `verify_ew` (§C6.3) |
| `app/whatsapp/sender.py` | re-add `"EXTENDED_WARRANTY": "EW"`, `"EXTENDED_WARRANTY_LEAD": "EL"` to `_EVENT_CODE_BY_KEY` only |
| `app/routers/webhooks/whatsapp_webhook_router.py` | re-add `EW`/`EL` codes + `_apply_ew_status_callback` (§C5.4) |
| `app/graphql/schema.graphql`, `resolvers/mutation.py` | four mutations (§C5.6) |
| `app/main.py` | include the public router |
| `app/db/sql/sql_base.py` | add `ExtendedWarrantySql` |
| `app/db/seeds/seed_bu_data.py` | row 16 + row 15 key (§C3.4) |
| `app/whatsapp/templates.py` | untouched (Part B) |

**As built (Step 12, 2026-09-13) — where the code differs from the text below:**

- One helper, `_send_and_settle`, calls Meta and settles the claimed row for both kinds. An
  **exception** from the call is settled as FAILED too — a reminder left PENDING would block
  its band for good (PENDING counts as live under the once-per-band index).
- `send_ew_lead_alert` returns what happened (`SENT` / `FAILED` / `NO_STAFF_NUMBER` /
  `INVALID_STAFF_NUMBER` / `NOT_FOUND` / `ERROR`) and still never raises;
  `resendEwLeadAlert` returns `{ok, status}` or `{ok: false, reason: NOT_FOUND | NO_INTEREST}`.
- `sendEwReminders` drops invalid mobiles **before** the daily cap, so they do not use up
  cap slots; an unreadable `daily_send_cap` falls back to 250, never to unlimited.
- Notes over 1000 characters are **refused** (not trimmed); `next_follow_up_at` without a
  time zone is refused.
- An interest POST on an opted-out lead shows the "unsubscribed" page (not "invalid").
- `EW_ACCESS_RIGHT` is one constant in `resolvers/custom/extended_warranty.py`, used by the
  four resolvers and the `ew_lead` table right.

### C5.1 `ew_sender.py`

```python
_EW_DEFAULT_SETTINGS = {"contact_phone": "", "daily_send_cap": 250, "enabled": False,
                        "notify_email": "", "staff_whatsapp_number": "", "whatsapp_number": ""}
_SEND_CONCURRENCY = 5
BAND_LABEL = {"D61_PLUS": "More than 60 days left", "D31_60": "31–60 days left",
              "D8_30": "8–30 days left", "D0_7": "0–7 days left", "OVERDUE": "Warranty expired"}

def is_ew_enabled(settings_row) -> bool                      # settings_row.get("enabled") is True
async def get_ew_settings(db_name, schema) -> dict           # stored object merged over defaults
def _format_date(value) -> str                               # "%d %b %Y"
def _build_reminder_params(bu_name, row, settings_row)       # header [bu], body 6 params (B1)
def _join_parts(*parts) -> str                               # " · "-joined, blanks dropped, "-" if empty
def _build_lead_alert_params(bu_name, row)                   # header [bu], body 5 params (B2)
async def _staff_name(db_name, user_id) -> str | None
async def _send_one_reminder(db, schema, row, branch_id, bu_name, settings_row, sent_by, sent_by_name) -> dict
async def send_ew_reminders(db_name, schema, value, sent_by) -> dict
async def send_ew_lead_alert(db_name, schema, ew_lead_id) -> None
```

Reminder body params, in order: `customer_name` (full name or "Customer"), `brand`,
`product` (`model_name` or product name), `expiry_date` (`_format_date`), `contact_phone`,
`whatsapp_number` (each `or "-"`), all through `_sanitize`; header `_truncate_business_unit(bu_name)`.

Lead alert lines:

| Param | Built from |
|---|---|
| `customer_line` | full name · mobile |
| `device_line` | brand · product/model · serial no |
| `warranty_line` | `Warranty ends <date>` · `Bought <date>` (if any) · `BAND_LABEL[band]` |
| `contact_line` | address · city · `Prefers a call` / `Prefers WhatsApp` / `No contact preference` |
| `remarks_line` | customer remarks or `No remarks` |

**`send_ew_reminders(value)`** — payload `{branch_id, ew_lead_ids}`:

1. Missing `branch_id` or empty ids → `ValidationException(REQUIRED_FIELD_MISSING)`.
2. `get_ew_settings`; not `is_ew_enabled` or not `_is_event_enabled(…, "EXTENDED_WARRANTY")`
   → `{"results": [], "disabled": True}`.
3. `GET_EW_LEADS_FOR_SEND`; every requested id not returned → result `SKIPPED` "No longer sendable".
4. Daily cap: `cap = int(daily_send_cap or 0)`; if `cap > 0`, `remaining = max(0, cap − GET_EW_SENT_TODAY_COUNT)`;
   rows beyond `remaining` → `CAPPED`. Checked once, before any send.
5. BU name via `GET_BU_NAME_BY_CODE`; `sent_by_name` via `_staff_name`.
6. `asyncio.gather` under a semaphore of 5.
7. Return `{"results": [{ew_lead_id, customer_name, band, status: SENT|FAILED|SKIPPED|CAPPED, error}]}`.

**`_send_one_reminder`**:

1. Invalid mobile → `SKIPPED` "Invalid or missing mobile number" (no claim, no state change).
2. `CLAIM_EW_REMINDER` → no row → `SKIPPED` "Already sent in this expiry window".
3. `callback = _build_biz_opaque_callback_data(db, schema, "EXTENDED_WARRANTY", [ew_message_id])`.
4. `token = sign_ew(db, schema, ew_lead_id, ew_message_id)`.
5. `send_template(normalize_mobile(mobile), TEMPLATES["EXTENDED_WARRANTY"], header, body, callback, [token])`.
6. `SET_EW_MESSAGE_SENT` (`ACCEPTED` + wamid, or `FAILED` + error) → `SENT` / `FAILED`.

**`send_ew_lead_alert(ew_lead_id)`** — best-effort; catches and logs everything; never
raises into the customer's request:

- blank `staff_whatsapp_number` → return;
- invalid number → `CLAIM_EW_LEAD_ALERT(FAILED, "staff_whatsapp_number is not a valid mobile number")`;
- else `CLAIM_EW_LEAD_ALERT(PENDING)` → `GET_EW_LEAD_DETAIL` → params →
  `send_template(…, callback [ew_message_id], [str(ew_lead_id)])` → `SET_EW_MESSAGE_SENT`.

### C5.2 Logging

Info on every send summary (`schema, selected, sent, capped`), every transition
(`lead, from, to, stage, by`), every follow-up, every interest; warning on unknown wamid in
the webhook; exception on alert / e-mail failure (with "lead is already saved").

### C5.3 `resolvers/custom/extended_warranty.py`

```python
EW_TRANSITIONS: dict[str, set[str]] = {     # MUST match src/.../extended-warranty/ew-state-machine.ts
    "NEW_LEAD":     {"IN_PROGRESS", "WON", "LOST", "CANCELLED"},   # MESSAGE_SENT only by sending
    "MESSAGE_SENT": {"INTERESTED", "IN_PROGRESS", "WON", "LOST", "CANCELLED"},
    "INTERESTED":   {"IN_PROGRESS", "WON", "LOST", "CANCELLED"},
    "IN_PROGRESS":  {"WON", "LOST", "CANCELLED"},                  # + stage advance
    "LOST":         {"IN_PROGRESS", "WON"},
    "CANCELLED":    {"IN_PROGRESS"},
    "WON":          set(),
}
CUSTOM_GENERIC_UPDATE_TABLE_RIGHTS = {"ew_lead": "CUSTOM_EXTENDED_WARRANTY"}
_VALID_ACTIONS = {"CALL", "WHATSAPP", "SMS", "VISIT", "OTHER"}
_NOTES_MAX = 1000

def allowed_from(to_state: str, is_stage_advance: bool) -> list[str]
async def transition_ew_lead(db_name, schema, value, user_id) -> dict
async def add_ew_follow_up(db_name, schema, value, user_id) -> dict
async def resend_ew_lead_alert(db_name, schema, value) -> dict
```

- **`transition_ew_lead`** — payload `{branch_id, ew_lead_id, to_state, progress_stage?, notes?}`.
  Reject unknown `to_state` and `MESSAGE_SENT`. Stage advance (`to_state == "IN_PROGRESS"`
  with `progress_stage` 2..3) → `allowed_from = ["IN_PROGRESS"]`; otherwise the inverse of
  `EW_TRANSITIONS`. Trim notes to 1000. Stamp `by` / `by_name` from `user_id`. Returns
  `{ok, from_state, to_state, progress_stage}` or `{ok: False, reason: "STALE"}`.
- **`add_ew_follow_up`** — payload `{branch_id, ew_lead_id, action, notes, next_follow_up_at?, progress_stage?}`.
  `action ∈ _VALID_ACTIONS`; `notes` required, ≤1000; `next_follow_up_at` ISO-8601 in the
  future (60 s tolerance); `progress_stage ∈ 1..3`. No row → `{ok: False, reason: "NOT_IN_PROGRESS"}`.
- **`resend_ew_lead_alert`** — payload `{branch_id, ew_lead_id}`; the lead must exist in the
  branch and have `interest_at`; then `send_ew_lead_alert`.

### C5.4 Webhook

- `_EVENT_KEY_BY_CODE += {"EW": "EXTENDED_WARRANTY", "EL": "EXTENDED_WARRANTY_LEAD"}`,
  `_EW_EVENT_KEYS = {…both…}`.
- `_apply_ew_status_callback(db, schema, ids, wamid, raw_status, new_rank, msg_status)`:
  `SET_EW_MESSAGE_OUTCOME` keyed on `wamid` (unique, authoritative; `ids` = `[ew_message_id]`
  is logged only). On a row: publish
  `{"db_name", "kind": "EW", "ew_lead_id", "ew_message_id", "status", "error", "target": "CUSTOMER" | "STAFF"}`.
  No row → info log "ignored (ladder or unknown wamid)".
- `_STATUS_RANK` as it is (`SENT` 2, `DELIVERED` 3, `READ` 4, `FAILED` 9).

### C5.5 Public router — `app/routers/public/extended_warranty_router.py`

Prefix `/extended-warranty` (fixed by B1), no `/api`. Signed token is the only credential;
HTML returned directly; a bad token never raises — it renders an "invalid or expired" card
with 404. Styled to match `job_intake_router.py`.

| Route | Method | Rate limit | Behaviour |
|---|---|---|---|
| `/{token}` | GET | 60 / 60 s | `verify_ew` → `GET_EW_LEAD_FOR_PUBLIC` (lead **and** message must match). Opted out → "You have unsubscribed". `has_interest` → "Thank you — we have your request". `state = WON` → "Thank you — your extension is being handled". Otherwise: greeting, facts (brand, product, warranty ends), form with preferred contact (Call / WhatsApp radio), optional remarks (≤500), submit button **"I am interested in extended warranty. Please contact me"**, and a small "Don't send me warranty reminders" opt-out form. No JavaScript. |
| `/{token}/interest` | POST | 20 / 60 s | Re-verify; opted out → invalid page. `RECORD_EW_INTEREST` **commits first**. On a created row: `send_ew_lead_alert`, then `_notify_by_email` (both swallow their own failures). Always → thank-you page. |
| `/{token}/opt-out` | POST | 20 / 60 s | `SET_EW_OPT_OUT` → "You have unsubscribed". |

`_notify_by_email`: when `notify_email` is set, plain-text summary (name, brand, product,
warranty ends, days left, preference) and "Open Service+ → Custom → Extended Warranty".
No CSRF token: the link is the credential and both writes are idempotent.

### C5.6 GraphQL and access

```graphql
sendEwReminders(db_name: String!, schema: String, value: String!): Generic
transitionEwLead(db_name: String!, schema: String, value: String!): Generic
addEwFollowUp(db_name: String!, schema: String, value: String!): Generic
resendEwLeadAlert(db_name: String!, schema: String, value: String!): Generic
```

- Each resolver: `@handle_graphql_errors(...)`, then
  `require_access_right(info, "CUSTOM_EXTENDED_WARRANTY")` (confirm userType S/A bypass in
  `auth_guards.py`), then delegate. `user_id` from `info.context["user_id"]` — never from the payload.
- Merge `CUSTOM_GENERIC_UPDATE_TABLE_RIGHTS` into `GENERIC_UPDATE_TABLE_RIGHTS`
  (`mutation.py:104`) so genericUpdate on `ew_lead` requires the right. `ew_message` and
  `ew_lead_event` are never written through genericUpdate.
- Reads go through `genericQuery` (no new query fields).

## C6. Cross-cutting

### C6.1 Transport

Authenticated calls: Apollo GraphQL (generic envelope + the four mutations). Public pages:
plain HTML over FastAPI. Live status: the existing `whatsappDeliveryStatus` subscription.

### C6.2 Refresh model

Any mutation success → the section bumps `refreshKey` → dashboard and open grid refetch.
Subscription events with `kind === "EW"` do the same.

### C6.3 Tokens — `token.py`

```python
_EW_TAG = "EWL"

def sign_ew(db_name: str, schema: str, ew_lead_id: int, ew_message_id: int, ttl_days: int = 180) -> str
    # payload "EWL|db|schema|lead_id|message_id|exp" → b64url(payload).b64url(hmac)
def verify_ew(token: str) -> tuple[str, str, int, int] | None
    # requires the EWL tag and exactly six fields; never raises
```

- The **type tag** means no other token signed with the same secret can be replayed as a
  lead link. This matters concretely: `sign_receipt` produces `db|schema|<int>|<int>|exp`,
  the same five-field shape an untagged lead token would have, so without the tag a money
  receipt link would verify as a lead link.
- The public route additionally requires the message to belong to the lead
  (`GET_EW_LEAD_FOR_PUBLIC`), so a valid token cannot be pointed at another lead.
- `ttl_days = 180`: covers the whole reminder window plus follow-up time.

### C6.4 Staff deep link

Suffix `<ew_lead_id>` appended to the B2 prefix → `/client/custom/ew/<id>`. Authenticated
route (`ProtectedRoute`), so no signed token.

## C7. Client

### C7.1 Files

Base: `src/features/client/components/custom/extended-warranty/` (all new).

| File | Role |
|---|---|
| `extended-warranty-section.tsx` | Tabs Dashboard / Details; `refreshKey`; drill-down state; subscription; deep-link focus |
| `ew-state-machine.ts` | States, transitions (mirror of the server), labels, colours, bands, message groups, stages, `availableActions(row)`, date helpers |
| `ew-state-flow-diagram.tsx` | Static, colourful, non-clickable SVG |
| `ew-dashboard.tsx` | Diagram + Lead Pipeline + Message summary + Overall summary |
| `ew-pipeline-section.tsx` | Grouped clickable counter cards |
| `ew-period-matrix.tsx` | Metric × period counter grid |
| `ew-drilldown-view.tsx` | Full-pane page: prominent Back + title + `EwLeadGrid` |
| `ew-lead-grid.tsx` | Shared grid: search, paging, selection, send bar, columns, row menu |
| `ew-lead-actions-menu.tsx` | 3-dot `DropdownMenu` from `availableActions` |
| `ew-transition-dialog.tsx` | Confirm a state change with optional notes |
| `ew-follow-up-dialog.tsx` | Non-dismissable follow-up modal + history |
| `ew-lead-dialog.tsx` | New Lead / Edit Lead with mobile lookup |
| `ew-lead-detail-dialog.tsx` | Facts + timeline + actions + resend alert |
| `ew-state-badge.tsx` | State pill with substate text |
| `ew-delivery-chip.tsx` | Message delivery status chip |
| `send-ew-reminders.ts` | Mutation + result toasts |
| `extended-warranty-schema.ts` | zod: lead form, follow-up form, transition notes |

Elsewhere:

| File | Change |
|---|---|
| `src/features/client/types/extended-warranty.ts` | New (§C7.2) |
| `src/features/client/pages/client-custom-ew-ref-page.tsx` | New (§C7.11) |
| `src/router/routes.ts`, `src/router/index.tsx` | `customEwRef: "/client/custom/ew/:ref"` (fixed by B2) |
| `src/features/client/pages/client-custom-page.tsx` | `case "Extended Warranty": return <ExtendedWarrantySection />` |
| `layout/custom-menu-registry.ts` | Context `{ extendedWarrantyEnabled: boolean }`; item `{ label: "Extended Warranty", icon: ShieldCheck, iconColor: "text-violet-600", helpArticleId: "extended-warranty", isEnabled: ctx => ctx.extendedWarrantyEnabled, requiredRight: CUSTOM_EXTENDED_WARRANTY }` |
| `store/context-slice.ts` | `extendedWarrantyEnabled`, `setExtendedWarrantyEnabled`, `selectExtendedWarrantyEnabled` |
| `layout/client-layout.tsx` | Parse `extended_warranty` setting; `enabled === true` (strict) → dispatch |
| `layout/client-top-nav.tsx`, `layout/client-explorer-panel.tsx` | Pass the context; bell item (§C7.10) |
| `layout/use-notifications-summary.ts` | `COUNT_EW_OPEN_INTEREST` → `ewOpenInterest` |
| `configurations/app-settings/edit-extended-warranty-dialog.tsx` | New settings dialog (§C8) |
| `configurations/app-settings/app-settings-section.tsx` | Route `extended_warranty` to that dialog |
| `configurations/app-settings/edit-whatsapp-notifications-dialog.tsx` | `EXTENDED_WARRANTY` switch with hint "Also needs App Settings → extended_warranty → Enabled" |
| `reports/common/kpi-card.tsx` | Optional `borderClassName`, `valueClassName` (non-breaking) |
| `src/constants/sql-map.ts` | Six ids (§C4.1) |
| `src/constants/graphql-map.ts` | Four mutations, standard `($db_name: String!, $schema: String, $value: String!)` |
| `src/constants/messages.ts` | §C7.12 |
| `src/types/db-schema-service.ts` | Regenerate |

### C7.2 Types

Derive column types from the regenerated `db-schema-service.ts`; hand-declare only
view-derived extras. House style: `type`, `…Type` suffix, sorted properties.

```ts
export type EwStateType = "CANCELLED" | "IN_PROGRESS" | "INTERESTED" | "LOST" | "MESSAGE_SENT" | "NEW_LEAD" | "WON";
export type EwBandType = "D0_7" | "D31_60" | "D61_PLUS" | "D8_30" | "OVERDUE";
export type EwMessageGroupType = "AWAITING" | "DELIVERED" | "FAILED" | "READ";
export type EwDeliveryStatusType = "ACCEPTED" | "DELIVERED" | "FAILED" | "PENDING" | "READ" | "SENT";
export type EwFollowUpActionType = "CALL" | "OTHER" | "SMS" | "VISIT" | "WHATSAPP";
export type EwProgressStageType = 1 | 2 | 3;
export type EwPeriodType = "month" | "older" | "today" | "week";

export type EwLeadRowType = { /* GET_EW_LEADS_PAGED columns, sorted */ };
export type EwTimelineItemType = { /* GET_EW_LEAD_TIMELINE columns */ };
export type EwDashboardType = { /* GET_EW_DASHBOARD columns */ };
export type EwLeadsFilterType = {
	band?: EwBandType; followUpDue?: boolean; isClosed?: boolean;
	messageGroup?: EwMessageGroupType; progressStage?: EwProgressStageType; state?: EwStateType;
};
export type EwSendResultType = {
	band: EwBandType | null; customer_name: string | null; error: string | null;
	ew_lead_id: number; status: "CAPPED" | "FAILED" | "SENT" | "SKIPPED";
};
export type EwSettingsType = {
	contact_phone: string; daily_send_cap: number; enabled: boolean; notify_email: string;
	staff_whatsapp_number: string; whatsapp_number: string;
};
```

### C7.3 `ew-state-machine.ts`

- `EW_STATE_META: Record<EwStateType, { color; label; closed }>`.
- `EW_TRANSITIONS` — the full §C2.3 table **including** NEW_LEAD → MESSAGE_SENT (the diagram
  draws it; the menu replaces it with Send). Header: *must match `EW_TRANSITIONS` in
  `app/graphql/resolvers/custom/extended_warranty.py`*.
- `EW_BANDS`, `EW_MESSAGE_GROUPS`, `EW_STAGES` — value, label, colour.
- `EW_COLOR_CLASSES` — literal Tailwind strings (so the JIT sees them) with dark variants:

| Token | Border | Value text | Tint |
|---|---|---|---|
| green | `border-green-500` | `text-green-700 dark:text-green-400` | `bg-green-50 dark:bg-green-950/30` |
| blue | `border-blue-500` | `text-blue-700 dark:text-blue-400` | `bg-blue-50 dark:bg-blue-950/30` |
| orange | `border-orange-500` | `text-orange-700 dark:text-orange-400` | `bg-orange-50 dark:bg-orange-950/30` |
| red | `border-red-500` | `text-red-700 dark:text-red-400` | `bg-red-50 dark:bg-red-950/30` |
| grey | `border-slate-400` | `text-slate-700 dark:text-slate-300` | `bg-slate-50 dark:bg-slate-900/40` |
| teal / indigo / violet / rose | same pattern | | |

- `availableActions(row): EwActionType[]` (§C7.7).
- `formatDate`, `formatDateTime`, `daysLeftLabel`, `EW_CHECKBOX_CLASS`.

**Card colours (brief):**

| Group | Card | Colour |
|---|---|---|
| New Lead | 31–60 days / 8–30 days / 0–7 days / Overdue / All | green / blue / orange / red / green |
| Message Sent | Delivered / Read / Fail / Awaiting | green / blue / red / grey |
| Interested | Interested | orange |
| In Progress | Stage 1 / Stage 2 / Stage 3 | green / blue / orange |
| Closed | Won / Lost / Cancelled | green / red / red |

### C7.4 Dashboard

```
┌ Extended Warranty ──────────────────────────────────────── [ + New Lead ] ┐
│ ① STATE FLOW  (static SVG, full width; scrolls inside itself below 720px) │
├───────────────────────────────────────────────────────────────────────────┤
│ ② LEAD PIPELINE — every card opens a drill-down                           │
│   New Lead (n)            Message Sent (n)       Interested   In Progress (n)   Closed        │
│   [31–60][8–30][0–7]      [Delivered][Read]      [   n   ]    [St 1][St 2]      [Won][Lost]   │
│   [Overdue][All]          [Fail][Awaiting]                    [St 3]            [Cancelled]   │
│                                                              ⏰ n follow-ups due               │
├───────────────────────────────────────────────────────────────────────────┤
│ ③ MESSAGE SUMMARY        Today | This week | This month | Over a month old │
│    Read / Delivered / Fail                                                  │
├───────────────────────────────────────────────────────────────────────────┤
│ ④ OVERALL SUMMARY        Today | This week | This month | Over a month old │
│    Leads · Messages sent (↳ Read · Delivered · Fail) · Interested · Won ·   │
│    Lost · Cancelled                                                         │
└───────────────────────────────────────────────────────────────────────────┘
```

- One `useGenericQuery<EwDashboardType>({ sqlId: GET_EW_DASHBOARD, sqlArgs: { branch_id }, enabled: !!branch?.id })`;
  `ReportLoading` / `ReportError` (retry) / content.
- Sections are `ChartCard`s inside `ReportSection`.
- Pipeline cards: `KpiCard` with `borderClassName="border-2 <border>"`,
  `valueClassName="text-3xl font-bold <text>"`, `onClick`, keyboard-accessible (already in
  `KpiCard`). Groups wrap; cards `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` within a group.
  No horizontal page scroll.
- "n follow-ups due" chip → drill-down `{ state: IN_PROGRESS, followUpDue: true }`.
- A warning banner when both `staff_whatsapp_number` and `notify_email` are blank is **not**
  shown (the settings are not read on this screen); the settings dialog warns instead (§C8).

### C7.5 Summaries — `ew-period-matrix.tsx`

Props: `rows: { key; label; color; indent? }[]`, `data: EwDashboardType`. Cell value =
`data[`${key}_${period}`]`, rendered as a compact counter (bold `text-2xl`, 2px coloured
border). Not clickable. `overflow-x-auto`, `min-w-[560px]`.

- Message summary rows: `msg_read` (blue), `msg_delivered` (green), `msg_failed` (red);
  footnote "In transit: n" per column from `msg_awaiting_*`.
- Overall rows: `leads` (teal), `msg_total` (indigo), `msg_read` ↳ (blue), `msg_delivered` ↳
  (green), `msg_failed` ↳ (red), `interested` (orange), `won` (green), `lost` (red),
  `cancelled` (red).
- Caption: "Periods overlap — This week includes Today."

### C7.6 State flow diagram

- Inline SVG, no new dependency. `viewBox="0 0 1000 380"`, `width="100%"`, inside
  `overflow-x-auto` with `min-w-[720px]`; `role="img"`, `aria-label="Lead state flow"`;
  `pointer-events-none`.
- **Nodes** (rounded rects rx 14, tinted fill, 2px stroke, bold label, small caption):
  New Lead (blue, 20,150, "31–60 · 8–30 · 0–7 · Overdue"), Message Sent (indigo, 220,150,
  "Delivered · Read · Fail"), Interested (orange, 420,150, "Customer tapped the button"),
  In Progress (violet, 620,150, "Stage 1 → 2 → 3" with three dots), Won (green, 850,30),
  Lost (red, 850,150), Cancelled (rose, 850,270).
- **Bands**: faint rounded band behind the four active nodes labelled "Active
  (is_closed = false)"; one behind the three closed nodes labelled "Closed (is_closed = true)".
- **Edges**, generated from `EW_TRANSITIONS` so the picture cannot drift:
  - solid main line New → Sent ("send WhatsApp") → Interested ("customer taps") → In Progress;
  - dashed arc above: New → In Progress, Sent → In Progress ("skip ahead");
  - solid fan: In Progress → Won / Lost / Cancelled;
  - the early-close edges (New / Sent / Interested → Won / Lost / Cancelled) collapse into
    one dashed bus under the active band — "any active lead can close as Won / Lost /
    Cancelled" — with three short arrows into the closed column;
  - amber dashed curves: Lost → In Progress, Cancelled → In Progress ("reopen");
    short arrow Lost → Won ("came back").
  - arrowheads via one `<marker>` per colour.
- **Theme**: Tailwind classes on SVG elements (`fill-blue-50 dark:fill-blue-950/40 stroke-blue-500`,
  labels `fill-slate-800 dark:fill-slate-100`) — no hex.
- **Motion**: framer-motion stagger fade/rise for nodes (40 ms), `pathLength` draw for edges;
  `useReducedMotion` disables both.
- Legend below: solid = normal flow, dashed = skip / close early, amber = reopen.

### C7.7 Lead grid and row actions

Props: `filter`, `title?`, `showStateFilter?`, `onChanged`, `focusLeadId?`.

**Toolbar**: search (`SEARCH_DEBOUNCE_MS`); Details only — state `Select` (All + seven
states) and "Show closed" `Switch` (default on); **New Lead** button (teal) on the right.

**Selection / send bar**: checkbox only when `row.can_send && isValidMobile(row.mobile)`;
header checkbox selects all sendable rows on the page; bar "n selected · Send WhatsApp
reminder" → `AlertDialog` "Send n WhatsApp reminders? Each lead gets at most one per expiry
window." → `sendEwReminders` → toasts (sent / capped / skipped / failed) → refetch →
`onChanged()`. `disabled` → `INFO_EW_DISABLED`.

**Columns** — `overflow-x-auto`, `min-w-[1400px]`, sticky header, sticky actions column:

| # | Column | Content |
|---|---|---|
| 1 | ☐ | sendable only |
| 2 | Entered | `created_at`, `created_by_name` |
| 3 | Customer | name; mobile (red "invalid number" when invalid); "opted out" tag |
| 4 | Contact | email, address, city |
| 5 | Device | brand · product/model; SN |
| 6 | Purchased | `purchase_date` |
| 7 | Warranty ends | date, `daysLeftLabel`, band chip |
| 8 | Messages | `EwDeliveryChip` for the last reminder + `last_sent_at`; "×n" when `message_count > 1`; error tooltip |
| 9 | Interest | `interest_at`, preferred contact, customer remarks (truncated + tooltip) |
| 10 | Follow-up | count, last, **next** (amber "Due" when ≤ now) |
| 11 | Remarks | truncated |
| 12 | State | `EwStateBadge` ("New Lead · 0–7 days", "Message Sent · Read", "In Progress · Stage 2") |
| 13 | ⋮ | `EwLeadActionsMenu` |

Row click → `EwLeadDetailDialog` (checkbox and menu cells stop propagation). 50 per page,
Previous / Next, "a–b of total". Order: newest entered first (drill-down "follow-ups due"
orders by next follow-up). `ReportEmpty` with a state-specific message.

**Actions** — disabled items stay visible with a `title` explaining why:

| State | Items |
|---|---|
| NEW_LEAD | **Send WhatsApp reminder** (iff sendable) · Move to In Progress · Mark Won · Mark Lost · Cancel lead · — · Edit · Delete (iff `message_count = 0`) · View details |
| MESSAGE_SENT | **Send WhatsApp reminder** (iff sendable) · Mark interested · Move to In Progress · Mark Won · Mark Lost · Cancel lead · — · Edit · View details |
| INTERESTED | Move to In Progress · Mark Won · Mark Lost · Cancel lead · — · Resend staff alert (iff alert failed or missing) · Edit · View details |
| IN_PROGRESS | **Record follow-up…** · Advance to Stage n+1 (iff < 3) · Mark Won · Mark Lost · Cancel lead · — · Edit · View details |
| LOST | Reopen → In Progress · Mark Won · — · Edit · View details |
| CANCELLED | Reopen → In Progress · — · Edit · View details |
| WON | Edit · View details |

Transition items come from `EW_TRANSITIONS[row.state]` (labels from a `to_state → verb`
map), never hand-listed. Send on one row uses the same confirm and path with one id. Delete
→ `AlertDialog` → genericUpdate `deletedIds` on `ew_lead`.

### C7.8 Dialogs

**`EwTransitionDialog`** — title from the verb; lead name and from → to pills (state
colours); optional notes (≤1000; for Lost / Cancelled the placeholder asks for a reason).
Confirm → `transitionEwLead`; STALE → `INFO_EW_LEAD_CHANGED` + refetch; success → toast,
refetch, `onChanged()`. Moving to In Progress offers "Record the first follow-up now", which
chains into the follow-up dialog.

**`EwFollowUpDialog`** — outside clicks never close it (brief):
`onInteractOutside` and `onEscapeKeyDown` call `preventDefault()`; it closes only via
Cancel / Save / X, and Cancel / X ask "Discard this follow-up?" when dirty. react-hook-form
+ zod, `mode: "onChange"`, red `*` on required, Save disabled while invalid or saving.

| Field | Rule |
|---|---|
| Action * | segmented Call / WhatsApp / SMS / Visit / Other |
| Notes * | ≤1000, live counter |
| Next follow-up | date + time (`LocalDateInput` + time `Input`), future only, "Clear" |
| Stage | Stage 1 / 2 / 3; options below the current stage disabled; default current |

Below: **History** from `GET_EW_LEAD_TIMELINE` (FOLLOW_UP, STATE_CHANGE, STAGE_CHANGE),
newest first, with `by_name` and time. Save → `addEwFollowUp`; `NOT_IN_PROGRESS` → stale toast.

**`EwLeadDialog`** — New Lead / Edit Lead. Mobile first; debounced lookup
(`FIELD_VALIDATION_DEBOUNCE_MS`) via `GET_EW_LEAD_BY_MOBILE` that only fills **blank**
fields, with a hint saying where the data came from. Fields: Mobile*, Full name*, Brand*
(select over `GET_ALL_BRANDS`), Product (select over `GET_ALL_PRODUCTS`), Model, Serial no,
Purchase date, Warranty ends* (not in the past on create), Address, City, Email, Remarks.
genericUpdate on `ew_lead` sending only these fields plus `branch_id` and `created_by`
(create). Never `state`, `progress_stage`, `is_closed` or timestamps. Unique-index violation
→ "A lead with this mobile, serial no and warranty date already exists."

**`EwLeadDetailDialog`** — header (name, mobile, `EwStateBadge`, days left); facts grid
(device, dates, interest, follow-up schedule, opted out); **Actions** button (the same menu);
timeline (messages as chips — reminder with band + status, staff alert with status —
interleaved with events); "Resend staff alert" when the alert failed.

### C7.9 Section shell

- Tabs **Dashboard** / **Details**; initial tab may come from `location.state`.
- Drill state `{ title, filter } | null`. When set, the Dashboard tab renders
  `EwDrilldownView` in place of the dashboard (`AnimatePresence` slide/fade). **Back** is
  prominent (`size="lg"`, `ArrowLeft`, "Back to dashboard"), top-left, sticky. Switching
  tabs clears it.
- Card → filter: band → `{ state: NEW_LEAD, band }`; All → `{ state: NEW_LEAD }`; message
  group → `{ state: MESSAGE_SENT, messageGroup }`; Interested → `{ state: INTERESTED }`;
  Stage n → `{ state: IN_PROGRESS, progressStage: n }`; Won / Lost / Cancelled → `{ state }`;
  due chip → `{ state: IN_PROGRESS, followUpDue: true }`.
- Subscription `whatsappDeliveryStatus` (`db_name`): `(ev.kind ?? "JOB") === "EW"` → bump
  `refreshKey`. Event type `{ error, ew_lead_id, ew_message_id, kind, status, target }`.

### C7.10 Bell

`use-notifications-summary.ts`: `COUNT_EW_OPEN_INTEREST`, gated on
`extendedWarrantyEnabled && branchId`. Top-nav item "Extended warranty — interested leads"
→ `navigate(ROUTES.client.custom, { state: { subItem: "Extended Warranty", ewDrill: "INTERESTED" } })`;
the section opens that drill-down on arrival.

### C7.11 Deep link page

`/client/custom/ew/:ref` — `ref` must match `^\d+$`; anything else → navigate to Custom
with a `INFO_EW_LEAD_NOT_FOUND` toast. Valid → `navigate(ROUTES.client.custom, { replace: true, state: { subItem: "Extended Warranty", ewLeadId } })`.
The section loads `GET_EW_LEAD_DETAIL`: In_progress → follow-up dialog; otherwise → detail
dialog; not found (deleted or another branch selected) → toast.

### C7.12 Messages (`constants/messages.ts`)

`ERROR_EW_DASHBOARD_LOAD_FAILED`, `ERROR_EW_LEADS_LOAD_FAILED`, `ERROR_EW_TIMELINE_LOAD_FAILED`,
`ERROR_EW_SEND_FAILED`, `ERROR_EW_TRANSITION_FAILED`, `ERROR_EW_FOLLOW_UP_FAILED`,
`ERROR_EW_RESEND_ALERT_FAILED`, `ERROR_EW_LEAD_SAVE_FAILED`, `ERROR_EW_LEAD_DUPLICATE`,
`ERROR_EW_SETTINGS_SAVE_FAILED`, `INFO_EW_DISABLED`, `INFO_EW_LEAD_CHANGED`,
`INFO_EW_LEAD_NOT_FOUND`, `INFO_EW_NOT_SENDABLE_CLOSED`, `INFO_EW_NOT_SENDABLE_STATE`,
`INFO_EW_NOT_SENDABLE_OPTED_OUT`, `INFO_EW_NOT_SENDABLE_MOBILE`,
`INFO_EW_NOT_SENDABLE_ALREADY_SENT`, `INFO_EW_NOT_SENDABLE_EXPIRED`, `INFO_EW_ALERT_NOT_SENT`,
`INFO_EW_SEND_SWITCH_HINT`, `INFO_EW_SETTINGS_INTRO`, `INFO_EW_NO_NOTIFY_CHANNEL`,
`SUCCESS_EW_LEAD_SAVED`, `SUCCESS_EW_LEAD_DELETED`, `SUCCESS_EW_STATE_CHANGED`,
`SUCCESS_EW_FOLLOW_UP_RECORDED`, `SUCCESS_EW_ALERT_RESENT`, `SUCCESS_EW_SETTINGS_SAVED`,
`CONFIRM_EW_SEND_TITLE` / `_BODY`, `CONFIRM_EW_DELETE_LEAD_TITLE` / `_BODY`,
`CONFIRM_EW_DISCARD_FOLLOW_UP`.

### C7.13 Conventions

`useAppSelector` / `useAppDispatch`; `apolloClient.query/mutate` directly;
`useGenericQuery` for grid / dashboard reads; `graphQlUtils.build…` for every `value`;
debounce constants only; shadcn primitives (`dropdown-menu`, `dialog`, `alert-dialog`,
`select`, `switch`, `checkbox`, `tabs` exist); `components/ui/*` untouched; sonner toasts;
framer-motion transitions; no page-level horizontal scroll.

## C8. Settings dialog — `edit-extended-warranty-dialog.tsx`

Fields: **Enabled** (switch), **Contact phone*** and **WhatsApp number*** (required when
Enabled; `isValidMobile`-style validation — they are printed in the customer's message),
**Staff WhatsApp number** (optional, valid mobile if set), **Notify e-mail** (optional,
valid e-mail), **Daily send cap** (integer ≥ 0; helper "0 = unlimited"). Intro text: the
bands are fixed at 31–60 / 8–30 / 0–7 / overdue; sending also needs the WhatsApp switch.
When Staff WhatsApp number and Notify e-mail are both blank, show `INFO_EW_NO_NOTIFY_CHANNEL`
("New interest will only appear in the app's bell"). Save → genericUpdate on `app_setting`
(same path as the other settings dialogs) → refresh the context flag.

## C9. Help (both files, same change)

**`help-content.ts`** — new article `id: "extended-warranty"`, category `"WhatsApp"`:
what it is · switching it on (two switches + settings) · adding a lead · the states (table:
state → meaning → next steps) · the flow picture · Lead Pipeline and drill-down · sending
reminders (only New Lead / Message Sent; once per expiry window; retry after fail; 7 days
past expiry; daily cap) · what the customer sees · when a customer taps interested (alert,
bell, e-mail; state moves only from Message Sent) · In Progress, stages and follow-ups ·
closing and reopening (Won is final) · reading the summaries (cumulative periods; exclusive
message statuses) · the Details tab. FAQs: why can't I send to this lead (five reasons) ·
why is the Custom menu missing · can I undo Won · why can't I delete this lead · why don't
the week and month numbers add up. Also: App Settings article gains the `extended_warranty`
row and a short dialog paragraph; `whatsapp_notifications` descriptions gain the Extended
Warranty switch.

**`dev-help-content.ts`** — new article `id: "dev-extended-warranty"`: tables + view and
why; band rule and `can_send` single home; partial unique index; transition table and its
two copies; SQL id inventory; send path (claim + state move in one statement); webhook by
wamid; token tag + lead/message binding; deep-link digit rule; access guard on four
mutations + `ew_lead` table right; invariants (§C2.6); the templates and the two routes
they fix (Part B). Also: settings row entry (six keys) and the `whatsapp_notifications` row;
WhatsApp rail article — EW sender lives in `ew_sender.py`, callback ids `[ew_message_id]`,
the `sign_ew` pair.

---

# Part D — Build, rollout, testing, risks

## D1. Build steps

**Prerequisite: Part A is complete — steps CL-1 to CL-9 have passed and are committed.**
Each build step ends with its check.

| Step | Work | Check |
|---|---|---|
| B-1 | Confirm §0 decisions | — |
| B-2 | **C3** `scripts/ew_schema.sql` on `demo1` (run twice — idempotent); regenerate dump + `BU_SCHEMA_DDL`; seeds; throwaway BU | objects present; throwaway BU complete |
| B-3 | **C4** SQL store | §D3.1 tests 1–13 in rolled-back transactions |
| B-4 | **C5 / C6** server Python | `python -c "import app.main"`; §D3.1 tests 14–16 |
| B-5 | **C7.1–C7.3** client foundations; regenerate types | `tsc` |
| B-6 | **C7.4–C7.11** client screens and wiring; **C8** | `tsc`; `pnpm build` |
| B-7 | **C9** help | articles render |
| B-8 | §D3.2 end-to-end | all pass |
| B-9 | Commit "Extended Warranty — lead state machine" | — |

## D2. Rollout (per tenant)

1. Part A may already be deployed on its own (demo only; §A6). If not, deploy it now.
2. Run `scripts/ew_cleanup.sql` on **every** BU schema, not only `demo1` — any BU created
   from the template while the old tables existed carries them. It is idempotent, so it is a
   no-op where there is nothing to remove.
3. Run `scripts/ew_schema.sql` on every BU schema, then deploy the Part C server + client
   (R1 — the server must not go live before its tables exist).
4. Re-run the super-admin Seed Roles dialog only if a tenant lacks rights 19 / 20 (they
   should already have them).
5. Owner re-enters settings (Enabled, numbers, cap) and turns on the WhatsApp switch.
6. Send to **one** test lead; open the customer link and the staff deep link before any
   bulk send.
7. When every tenant has run both scripts, delete `scripts/ew_cleanup.sql` (its job is done).

## D3. Testing

### D3.1 Server / SQL (rolled-back transactions on `demo1`)

1. Transition matrix: every (from, to) of 7 × 7 via `transitionEwLead` — exactly the §C2.3
   pairs succeed (MESSAGE_SENT target always refused); others leave the row unchanged.
2. `is_closed` follows `state`; writing it errors.
3. CHECKs: In_progress without stage, stage outside In_progress, `closed_at` mismatch — all fail.
4. Stage: 1→2→3 ok; 3→2 and 2→2 refused; follow-up with a lower stage keeps the higher; follow-up outside In_progress → no row.
5. Concurrent claim from two sessions on one lead → one message, one event.
6. Band guard: same band refused; after FAILED allowed; new band allowed.
7. `can_send` false for Interested / In_progress / closed / opted out / `days_left = -8`; true at `-7`.
8. Claim moves New_Lead → Message_Sent once; Message_Sent stays, no duplicate event.
9. Webhook: READ then late DELIVERED leaves READ; unknown wamid ignored; both kinds update.
10. Interest: first tap Message_Sent → Interested + event (with `ew_message_id`) + one alert row; second tap no row; tap on In_progress / Lost records interest, state unchanged, alert sent.
11. Tokens: valid tag + matching message → page; mismatched message id → invalid; untagged / other-shape / tampered / expired → invalid.
12. Dashboard sums: pipeline states = `leads_total`; message groups = `sent_all`; bands + 61+ = `new_all`; per period read + delivered + failed + awaiting = total.
13. Period edges around midnight, week start and month start.
14. Access: user without `CUSTOM_EXTENDED_WARRANTY` refused on all four mutations and genericUpdate `ew_lead`; A and S pass.
15. Daily cap: cap 2, 3 selected → 2 SENT, 1 CAPPED; cap 0 → unlimited.
16. Settings: `enabled` as string `"true"` or missing → sends disabled.

### D3.2 Client / end-to-end

1. `pnpm exec tsc -b --noEmit`, `pnpm build`.
2. `pnpm lint` — **currently broken project-wide** (`typescript-eslint` 8.69 rejects
   TypeScript 7.0.2). Fix separately (pin TS 6.x for linting, or upgrade when supported);
   until then state explicitly that lint did not run.
3. Dashboard: diagram in light and dark, not clickable, reduced motion respected; every
   card count matches §D3.1-12; each card opens the right drill-down; Back returns.
4. Grid: newest first; wide content scrolls inside its container; menus exactly §C7.7;
   disabled items explain themselves.
5. Send: bulk and single, confirm, toasts, state moves, live Awaiting → Delivered → Read.
6. Follow-up dialog: outside click and Esc ignored; dirty-cancel prompt; past date refused;
   stage cannot go back; history updates; Due badge and chip appear when due.
7. Every transition dialog, including reopen and Lost → Won; two-tab race shows STALE.
8. Customer path on one test number: reminder received → button → landing → interested →
   lead Interested → staff alert → "Open in Service+" (logged out → login → back) → correct
   dialog. Opt-out on a second lead → not sendable, tagged.
9. Settings dialog validation and both switches; Custom tab appears / disappears with Enabled.
10. Bell count equals the Interested card; click opens the Interested drill-down.
11. Help articles render; grep gates clean.

## D4. Risks

- **R1 — Schema and code must match.** Part C's server reads `ew_lead`; deploy it only after
  `ew_schema.sql` has run on the BU schemas it will serve (or run the script in the same
  window). Part A has no such coupling.
- **R2 — Templates are fixed.** Any wording or URL change means Meta resubmission and a
  sending gap. Suffixes and composed lines are parameters, so they are free.
- **R3 — MARKETING to a non-opt-in list.** Mitigations: two default-off switches, daily cap,
  once-per-band index, opt-out link, invalid mobiles skipped. Do not relax D7.
- **R4 — genericUpdate can technically write `state`.** Only convention stops it. Hardening
  option: a `BEFORE UPDATE` trigger rejecting state changes unless the transition SQL set a
  session flag (`SET LOCAL ew.transition = 'on'`). Left out for simplicity; documented in
  dev help.
- **R5 — Opt-out does not change state.** An opted-out lead can still be worked by phone. If
  the owner wants opt-out to cancel, it is one extra statement in `SET_EW_OPT_OUT`'s CTE.
- **R6 — Blank staff number + blank e-mail** leaves only the bell. The settings dialog warns.
- **R7 — Two copies of the transition table.** Server authoritative; test D3.1-1 guards it;
  review guards the client mirror.
- **R8 — Daily cap is per BU schema**, not per tenant.
- **R9 — Lint is broken repo-wide** (D3.2-2).

## D5. Out of scope

xlsx import · scheduled / automatic sending · inbound WhatsApp replies and STOP handling ·
converting a lead into a customer or job · payments and warranty contracts · per-brand
message variants · a message-log screen · follow-up reminders pushed to staff WhatsApp ·
configurable bands.
