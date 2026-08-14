# Migration Tool — Design & Architecture

## 1. Purpose

There is no migration runner anywhere in the service-plus stack. New tenants get the full schema via `BU_SCHEMA_DDL` at provisioning time (`service-plus-server/app/graphql/resolvers/bu_admin/provisioning.py`); any schema change made *after* a tenant already exists has to be hand-applied, one `psql` session at a time, against every already-provisioned BU schema, in every client database. That gap was hit concretely while building the spare-parts-on-web feature (`service-plus-client/plans/plan-parts-web.md` §3b/§12 Step 3) and worked around with a one-off `.sql` script the operator ran by hand, with no UI, no per-schema status, and no record of which schemas were done.

This tool replaces that manual process with a small local GUI: point it at the control database, pick which client databases and BU schemas to touch, supply a SQL script (typed, pasted, or loaded from a file), review it, and run it — with a live per-schema success/failure result.

**Non-goal**: this is not a versioned migration framework (no migration history table, no up/down scripts, no automatic ordering). It is a safer, faster replacement for "hand-run this SQL against every schema," matching exactly what `plans/plan-parts-web.md` needed and nothing more. If a real migration-history system is wanted later, that is a separate, larger project.

## 2. The tenancy model this tool operates on

Grounded directly in `service-plus-server`, not assumed:

- **Control database** (`service-plus-server/app/core/settings/database_settings.py`: `client_db_name`, default `"service_plus_client"`) holds `public.client(id, name, db_name, is_active)` — one row per tenant, `db_name` pointing at that tenant's own, separate PostgreSQL database. This is queried today by `PublicSql.GET_ACTIVE_CLIENT_DBS`:
  ```sql
  SELECT id, name, db_name FROM public.client WHERE is_active = true AND db_name IS NOT NULL ORDER BY name
  ```
- **Tenant ("service") databases** — one per client, reachable on the **same Postgres host/port/user/password** as the control database (only `dbname` differs — see `client_db_host/port/user/password` vs `service_db_host/port/user/password` in `database_settings.py`, which are identical values in every environment observed). Each tenant database has:
  - a fixed `security` schema (users, roles, the `bu` table), and
  - **one schema per BU** (e.g. `demo1`), each a full copy of the BU schema shape (`BU_SCHEMA_DDL`).
- **"Schema" in this tool's UI = one BU inside one client's tenant database.** Excluding `security` (per the prompt) is exactly excluding the one schema per tenant DB that is *not* a BU.

This is why the prompt's steps ("input client database name" → "get all db_name from that" → "show schemas in them, ignore security") map 1:1 onto real tables and a real, already-shared connection convention — the tool doesn't need to invent per-client connection parameters, because the real system doesn't have them either. One host/port/user/password reaches every tenant database; only the `dbname` changes.

## 3. Scope decisions (confirmed)

| Decision | Choice |
|---|---|
| Stack | Python + Streamlit — single local process, no separate frontend/backend to build or deploy |
| Execution order | Sequential, one schema at a time |
| Transaction safety | Each schema's SQL runs inside its own `BEGIN...COMMIT`/`ROLLBACK` — a failure in one schema never leaves it half-migrated and never blocks the remaining schemas |
| Design doc first | This document, reviewed before any code is written |

Everything below assumes these four.

## 4. Why Streamlit fits this specifically

- It's a **single Python process** — the tool needs `psycopg` (already the driver used by `service-plus-server`) and a UI; Streamlit gives the UI without a separate JS build, API layer, or web server to run and keep in sync.
- Streamlit's execution model (the whole script re-runs top-to-bottom on every interaction, with `st.session_state` holding anything that must survive a rerun) maps cleanly onto this tool's actual workflow: connect, select, provide SQL, check, run. There's no need to fight the framework's grain here — `st.container(height=...)` and `st.empty()` give bounded, in-place-updating panels for free, which is what keeps the dashboard a fixed size instead of growing.
- `st.status()` / a placeholder updated in a loop gives a live-updating per-schema progress list for free, which is exactly the "each schema migration will show status success/failure" requirement.
- It is trivially run locally (`streamlit run app.py`) by whoever is doing the rollout — no deployment step, matching "standalone GUI tool."

## 5. Configuration — `.env` (not version controlled)

Mirrors the naming already used in `database_settings.py` so anyone who knows the main server's config recognizes it immediately:

```
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
```

**Deliberately does *not* include the control database name.** Per the prompt, "the tool takes input of client database name" is a distinct step from the `.env` connection parameters — read as: `.env` holds the secret connection parameters (host/port/user/password), and the **control database name is a field in the UI itself** (defaulting to `service_plus_client` but editable), so the same tool/`.env` can be pointed at a different control database (e.g. a staging environment) without editing a file. This is stated as an interpretation, not a certainty — worth a one-line confirmation when the UI is actually built, but it's the reading that makes both prompt bullets ("keeps connection parameters in `.env`" and "takes input of client database name") non-redundant.

An `.env.example` (committed) documents the four variables with no real values. `.gitignore` in `migration-tool/` excludes `.env`.

## 6. Module layout

```
service-plus-tools/migration-tool/
├── DESIGN.md              # this document
├── README.md              # usage + help-system pointer + Streamlit background
├── requirements.txt        # streamlit, "psycopg[binary]", python-dotenv
├── .env.example
├── .gitignore              # excludes .env
├── app.py                  # Streamlit entrypoint — the dashboard flow (§7)
├── config.py                # loads .env into a small settings object
├── db.py                    # connection + schema-listing + per-schema execution
├── models.py                 # ClientDb, SchemaTarget, MigrationResult dataclasses
└── pages/
    └── 1_❓_Help.py          # Streamlit multipage "Help" screen (§9)
```

**`config.py`** — a small `AppSettings` dataclass/`pydantic-settings` model reading the four `DB_*` vars from `.env`. Fails fast with a clear message if any are missing, before the UI tries to connect.

**`models.py`**
```python
@dataclass
class ClientDb:
    id: int
    name: str
    db_name: str

@dataclass
class SchemaTarget:
    client: ClientDb
    schema_name: str

@dataclass
class MigrationResult:
    target: SchemaTarget
    success: bool
    error_message: str | None
    duration_seconds: float
```

**`db.py`** — thin, deliberately small wrapper around `psycopg` (the same driver `service-plus-server` uses, for familiarity and because it's a proven fit for this Postgres version):
- `connect(db_name: str) -> psycopg.Connection` — one function, since control and tenant databases differ only in `dbname` (§2).
- `list_client_dbs(conn) -> list[ClientDb]` — runs the same query as `PublicSql.GET_ACTIVE_CLIENT_DBS` against the control database.
- `list_schemas(conn, exclude={"security"}) -> list[str]` — `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('security', 'information_schema', 'public') AND schema_name NOT LIKE 'pg\_%' ESCAPE '\' ORDER BY schema_name` (the `pg\_%` pattern excludes the whole Postgres-internal family in one go — `pg_catalog`, `pg_toast`, `pg_toast_temp_N`, `pg_temp_N` — rather than an explicit list that misses whichever of those didn't happen to exist on the connection it was written against; `pg_toast` showing up unfiltered in an early build is exactly the gap this closes).
- `run_sql_in_schema(db_name: str, schema_name: str, sql: str) -> MigrationResult` — opens a connection, `SET search_path TO "<schema>"`, `BEGIN`, executes the (possibly multi-statement) SQL, `COMMIT` on success or `ROLLBACK` + captured exception message on failure, always closes the connection. This is the one function the whole "per-schema transaction" guarantee lives in — every other module just calls it and reads the `MigrationResult` back.

**`app.py`** — the Streamlit script implementing the flow in §7, holding dashboard state (selected client DBs, selected schemas, the SQL text, the check/run `MigrationResult`s so far) in `st.session_state` so it survives Streamlit's rerun-per-interaction model.

## 7. UI flow

A dashboard, not a wizard — everything is always visible; Check/Continue are *disabled* until their prerequisites are met, rather than hidden until an earlier step completes. This keeps the page a fixed size instead of growing (and requiring more scrolling) as you go, because there's nothing left to reveal.

**Sidebar** (Streamlit's sidebar scrolls independently of the main panel, so it never grows the main page):

- **Reset** — clears all `st.session_state`, back to a clean start.
- **Connect** — control database name (prefilled `service_plus_client`, editable per §5), a "Test Connection" button. On success, calls `list_client_dbs` and populates the active client list. Connection errors are shown inline, not swallowed.
- **Targets** — (once connected) one expandable section per client (`name` from `public.client`), each listing its schemas (via `list_schemas`, `security` and Postgres system schemas already excluded) as checkboxes. A "select all for this client" convenience checkbox per client, a top-level "select all schemas in all clients" checkbox above every client section, and a running count of "N schemas selected across M clients." All three checkbox levels are wired via `on_change` callbacks that write straight into `st.session_state` rather than the `value=` argument, since Streamlit ignores `value=` for a widget `key` that already has a session_state entry — the bug that shipped in the first version of this screen (a per-client "select all" that silently did nothing after its first render).

**Main panel** — one fixed-height SQL box, a Check/Continue button row, and one fixed-height Messages/Results box:

- **SQL** — a tab/toggle between "Paste SQL" (a `st.text_area`, 240px) and "Load .sql file" (`st.file_uploader`, contents read as text). Whichever is used, the result is one SQL string. No separate structured "seed data" form — a seed-data INSERT block is just SQL, same as any DDL, matching how `SeedBuData.BU_SEED_SQL` itself is nothing more than an `INSERT ... VALUES ... ON CONFLICT DO NOTHING` block. This is called out explicitly as the interpretation of "sql scripts and seed data values" from the prompt.
- **Check** — enabled once connected, at least one target is selected, and SQL is non-empty. Dry-runs the SQL against *every* selected target — same per-target transaction as a real run, but always `ROLLBACK`, never `COMMIT` — and reports "SQL ok — will run on N schema(s)" (or the per-schema failures, in the same table shape as the real results) in the Messages box. This replaces an earlier plain confirmation checkbox — a real per-schema validation is a stronger gate than a self-report, for a tool that can run arbitrary SQL against every tenant's production data in one click.
- **Continue** — enabled only once the *current* SQL + target selection has been checked successfully; changing either after a check invalidates it (a stale-check warning replaces the success message in the Messages box, and Continue disables again) and Check must be run again. On click, iterates the target list **sequentially** (§3); for each, calls `run_sql_in_schema`, appends the `MigrationResult` to `st.session_state`, and re-renders the Messages box after each one (a `st.empty()` placeholder inside a fixed-height `st.container(height=320)`, rewritten in the loop) so progress is visible live, not only at the end — this is what makes "each schema migration will show status" true during the run, not just in a final summary.
- **Messages / Results** — a single fixed-height, internally-scrolling box shared by Check and Continue: it shows whichever ran most recently (`st.session_state.last_action`). After a run: client, schema, ✅/❌, error message, duration, plus a CSV download button (not in the original prompt, but a two-line addition once the data already exists in memory, and the obvious thing an operator wants after a 40-tenant run — flagged here as a small addition, not hidden).

## 8. Execution semantics (recap, made explicit)

- **Sequential**: schema *N+1* does not start until schema *N*'s result (success or failure) is recorded. Simpler to reason about, and the live status list stays trivially correct (no interleaved updates from concurrent workers).
- **Per-schema transaction**: one `BEGIN`/`COMMIT`/`ROLLBACK` per schema, wrapping the *entire* pasted/loaded SQL for that schema as one unit. A script with multiple statements either fully applies to that schema or not at all — matching the pattern already used for the spare-parts apply script in the earlier rollout.
- **A failure in one schema does not stop the run.** The tool proceeds to the next selected schema regardless; the failed schema's row shows the captured error message. This is what "success/failure and error message if any" per schema implies — an abort-on-first-failure design would make that reporting pointless for every schema after the first failure.

## 9. Help system

Two layers, both required by the prompt ("help system for the tool"):

1. **Inline, in-flow help** — every non-obvious control in `app.py` gets Streamlit's `help="..."` tooltip parameter (e.g. the control-database-name field explains what it is and where it comes from; the SQL text area explains that the whole block runs as one transaction per schema; Check and Continue each explain what they do and don't commit), so help is available without leaving the page.
2. **A dedicated Help page** (`pages/1_❓_Help.py`, Streamlit's multipage convention — any `.py` file under `pages/` gets its own sidebar entry automatically) covering: what this tool is and isn't for, the tenancy model in §2 (in plain language, no code), how per-schema transactions work and what a partial failure means, and a troubleshooting section for the most likely failure modes (bad credentials, control DB unreachable, a schema-qualified name colliding, a syntax error partway through a pasted script).

The README (§10) points at this Help page explicitly rather than duplicating its content.

## 10. Security considerations

- `.env` is git-ignored; `.env.example` never contains real values.
- The DB password is read once into memory via `config.py` and never rendered in the UI, logged, or included in any exported results file.
- No new authentication layer is added — this tool is designed to be run locally by a trusted operator who already has the Postgres credentials, same trust level as running `psql` by hand today. If it is ever hosted rather than run locally, that assumption needs revisiting (out of scope for v1).
- The Check gate (§7) — a real dry-run against every target, not just a self-reported confirmation — is the one guard against an accidental run; there is no "undo" — a `ROLLBACK`ed schema is safe, but a `COMMIT`ted one is not reversible by this tool.

## 11. Out of scope for v1 (possible future enhancements, not being built now)

- Migration history / tracking which SQL has already been applied to which schema (this tool reports success/failure for *this run* only; it does not remember past runs between sessions).
- Parallel execution across schemas.
- Dry-run / `EXPLAIN`-only mode.
- Structured seed-data forms (table/column pickers) as an alternative to raw SQL.
- Any authentication or multi-user access control.

## 12. Open item carried into the build step

§5's reading of "client database name" as a UI field separate from `.env` is the one place this design makes an interpretive call rather than quoting the prompt or the code verbatim — worth a quick confirmation when `app.py` is actually built, in case a UI-editable control database name isn't wanted after all.
