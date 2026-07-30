# Recommended File/Folder Reorganization — service-plus-server

**This is a recommendation report, not something that has been executed.** No application files have been moved or split — this documents a proposed target structure, plus a detailed step-by-step execution plan, for review before any implementation pass.

## Context
`service-plus-server` (the Python/FastAPI GraphQL backend for service-plus-client) grew organically into a flat, concern-mixing layout. The two most-touched files are already unmanageable:
- `app/db/sql_store.py` — **6,514 lines**, one `SqlStore` class holding 331 SQL string constants for every domain (jobs, inventory, sales, BU/security, reports...).
- `app/graphql/resolvers/mutation_helper.py` — **2,917 lines** (`# pylint: disable=too-many-lines` was added instead of splitting it), mixing job/invoice/BU-provisioning/security logic in one flat function soup, mirrored 1:1 by `mutation.py`'s thin dispatchers.

`app/db/sql_bu.py` (1,646 lines) is a third large file. Alongside this, real production secrets are hardcoded in `app/config.py`; both `config.py` and `logs/` are already ignored via the repo-root `.gitignore` (`/home/sushant/projects/service-plus/.gitignore`, applies repo-wide since this is a single git repo) — see Step 1 below for the `logs/audit/*.jsonl` files that were tracked before that rule took effect. There's no `tests/` directory and no architecture doc (`claude.md`/`GEMINI.md` are AI-agent instruction files, not structural docs). The goal below is a domain-based structure that matches how the code actually divides (confirmed via SQL-constant prefixes and resolver function names): **jobs, inventory/masters, sales/accounts, BU-admin/security/provisioning, reports/audit, and shared/core infra.**

## Evidence for the domain split
- `sql_store.py` constant prefixes cluster into: `JOB(S)`/`WARRANTY`/`TECHNICIAN`/`DELIVERED`/`DELIVERABLE` (**jobs**), `STOCK`/`PART(S)`/`PRODUCT`/`BRAND`/`MODEL`/`VENDOR`/`SUPPLIER`/`PURCHASE` (**inventory/masters**), `SALES`/`CUSTOMER(S)` (**sales**), `BU`/`BUSINESS`/`DIVISION`/`BRANCH`/`CLIENT`/`ADMIN`/`USER`/`FY`/`STATE` (**bu-admin/security**), `DASHBOARD`/`PROFIT`/`REVENUE` (**reports**).
- `mutation_helper.py`/`mutation.py` function names split the same way: `resolve_create_job_batch/invoice/payment/single_job`, `resolve_deliver_job`, `resolve_undeliver_job`, `resolve_undo_job_transaction`, `resolve_update_job(_batch)` → **jobs**; `resolve_create_sales_invoice`, `_build_sales/purchase_invoice_tran_h`, `_build_money_receipt_tran_h`, `resolve_accounts_posting`, `_post_tran_h_to_trace_plus` → **sales/accounts**; `resolve_import_spare_parts`, `resolve_delete_unused_parts_by_brand` → **inventory**; `resolve_create_bu_schema_and_feed_seed_data`, `resolve_create_admin_user`, `resolve_create_business_user`, `resolve_create_client`, `resolve_create_service_db`, `resolve_delete_bu_schema/client`, `resolve_drop_database`, `resolve_feed_bu_seed_data`, `resolve_seed_security_data`, `resolve_set_user_bu_role`, `resolve_mail_*_credentials` → **bu-admin/security/provisioning**; `resolve_generic_update(_script)`, `_decode_value`, `_serialize_row` → **shared** (the "generic envelope" escape hatch every domain uses).
- `query_helper.py`/`query.py` are mostly cross-cutting: `resolve_admin_dashboard_stats`, `resolve_super_admin_*`, `resolve_audit_log(_stats)`, `resolve_system_settings`, `resolve_usage_health` → **reports/audit**; `resolve_generic_query(_batch)` → **shared**.

## Recommended target structure

```
service-plus-server/
├── .env.example                    # NEW — documents required env vars, no real values
├── scripts/                        # NEW — was scattered at root
│   ├── run_server.bat
│   ├── activate.bat
│   ├── install_dependencies.bat
│   └── extract_schema.sh
├── tests/                          # NEW — mirrors app/ domain layout below
│   ├── jobs/  inventory/  sales_accounts/  bu_admin/  reports_audit/  core/
├── plans/
├── app/
│   ├── main.py
│   ├── logger.py
│   ├── scheduler.py
│   ├── core/                       # cross-cutting infra only (unchanged concerns, tidied)
│   │   ├── settings/                    # NEW split of config.py by concern
│   │   │   ├── database_settings.py
│   │   │   ├── auth_settings.py
│   │   │   ├── email_settings.py
│   │   │   └── api_settings.py
│   │   ├── audit_log.py
│   │   ├── dependencies.py
│   │   ├── email.py
│   │   ├── security.py
│   │   └── exceptions.py           # moved from app/exceptions.py — it's cross-cutting infra
│   ├── db/
│   │   ├── connection/                  # NEW — was loose in app/db/
│   │   │   ├── pool_manager.py
│   │   │   └── psycopg_driver.py
│   │   ├── sql/                         # NEW — sql_store.py split by domain
│   │   │   ├── sql_base.py              # SqlStore base class (see Step 3 below)
│   │   │   ├── sql_jobs.py
│   │   │   ├── sql_inventory.py
│   │   │   ├── sql_sales_accounts.py
│   │   │   ├── sql_bu_admin.py          # absorbs sql_bu.py + sql_security.py content
│   │   │   ├── sql_reports_audit.py
│   │   │   └── sql_shared.py            # generic-query/app-settings constants
│   │   ├── seeds/                       # NEW
│   │   │   ├── seed_bu_data.py
│   │   │   └── seed_security_data.py
│   │   ├── schema_dumps/                # NEW — raw DDL, not query logic
│   │   │   ├── service_plus_client.sql
│   │   │   └── service_plus_service.sql
│   │   └── tools/
│   │       └── extract_schema.py        # pairs with scripts/extract_schema.sh
│   ├── graphql/
│   │   ├── schema.py
│   │   ├── schema.graphql
│   │   ├── pubsub.py
│   │   └── resolvers/
│   │       ├── shared/                  # generic_query/update, _decode_value, _serialize_row
│   │       │   ├── generic_query.py
│   │       │   └── generic_update.py
│   │       ├── jobs/
│   │       │   ├── mutations.py         # resolve_create/update/deliver/undo job(_batch)...
│   │       │   └── invoicing.py         # _build_job_invoice_tran_h, regenerate_job_invoice
│   │       ├── inventory/
│   │       │   └── mutations.py         # import_spare_parts, delete_unused_parts_by_brand
│   │       ├── sales_accounts/
│   │       │   └── mutations.py         # create_sales_invoice, accounts_posting, tran_h builders
│   │       ├── bu_admin/
│   │       │   ├── provisioning.py      # create/delete client, bu schema, service db, drop db
│   │       │   ├── users_roles.py       # create admin/business user, set_user_bu_role
│   │       │   └── mailers.py           # mail_admin/business_user_credentials, _build_reset_link
│   │       ├── reports_audit/
│   │       │   └── queries.py           # dashboards, audit logs/stats, system settings, usage health
│   │       ├── query.py                 # thin dispatcher, imports from domain packages above
│   │       ├── mutation.py              # thin dispatcher, imports from domain packages above
│   │       ├── subscription.py
│   │       └── auth_guards.py
│   ├── routers/
│   │   ├── auth/
│   │   │   ├── router.py                # was auth_router.py
│   │   │   └── helper.py                # was auth_router_helper.py
│   │   ├── media/
│   │   │   └── image_router.py
│   │   └── base_router.py
│   └── services/
│       └── file_client.py               # unchanged — single file, no split needed yet
├── requirements.txt
└── claude.md / GEMINI.md               # stay at root (AI-agent conventions, not code)
```

Dropped/merged from current layout: `app/schemas/auth_schema.py` folds into `app/graphql/resolvers/bu_admin/` or `app/routers/auth/` (wherever it's actually consumed — worth confirming at implementation time); `app/utils/` (currently empty) is dropped entirely; pick **one** of `.pyre_configuration` / `pyrightconfig.json` and remove the other (both currently configure type-checking with no evident reason to keep both).

## Design notes (why each move is shaped this way)

1. **`sql_store.py` → domain files, same access pattern.** To split the single `SqlStore.CONST_NAME` class (referenced at ~300+ call sites) without a one-shot rewrite of every call site, each domain file defines its own class with only its constants (`class JobsSql: GET_JOB = "..."`), and `sql_base.py` composes them via multiple inheritance: `class SqlStore(JobsSql, InventorySql, SalesAccountsSql, BuAdminSql, ReportsAuditSql, SharedSql): pass`. Existing `SqlStore.X` references keep working untouched; only the constant *definitions* move. This is the low-risk migration path — moving to fully separate `JobsSql.GET_JOB`-style call sites everywhere is the cleaner end state but requires touching every call site and should be a separate, later pass if wanted.
2. **`mutation_helper.py`/`query_helper.py` → per-domain modules, `mutation.py`/`query.py` stay as thin dispatchers.** Since `mutation.py` already just delegates to `mutation_helper.py` function-for-function, splitting the helper file along the domain boundaries above (jobs/inventory/sales_accounts/bu_admin/reports_audit/shared) and having `mutation.py`/`query.py` import from the right submodule is mechanical — no logic changes, just moving functions and fixing imports.
3. **`app/exceptions.py` → `app/core/exceptions.py`.** It's cross-cutting infra (used everywhere), not a top-level concern of its own.
4. **`config.py` → `app/core/settings/*.py`.** Split the single 175-line `Settings` class into `DatabaseSettings`/`AuthSettings`/`EmailSettings`/`ApiSettings` (composed into one `Settings` object via Pydantic's nested-settings support), grouped by what they configure rather than one flat list.
5. **Secrets (priority, independent of the folder move):** `client_db_password`, `service_db_password`, `secret_key`, `smtp_password`, `super_admin_password_hash`, and `file_server_api_key` are hardcoded literal defaults in `config.py` today. A repo-root `.gitignore` already exists and already ignores `config.py`/`logs/`; `config.py` itself has never been committed, so these specific hardcoded defaults are not exposed in git history. Recommended: move real values to a gitignored `.env` (`.env.example` documenting names only) as good hygiene regardless — the file is still plaintext on disk today — but credential rotation is no longer urgent *due to git exposure* specifically. (Audit logs are a separate, real exposure — see next item.)
6. **`logs/audit/*.jsonl` should not be git-tracked.** The repo-root `.gitignore` already has a `logs/` rule; these files were tracked before that rule took effect, so `git rm --cached` the 44 tracked files (keeping them on disk). Runtime audit data doesn't belong in version control regardless of the folder it lives in.
7. **`tests/` doesn't exist yet.** If tests get added later, mirror the same domain folders under `app/` so test-to-source mapping stays obvious (`tests/jobs/`, `tests/bu_admin/`, etc.).

## Additional improvements (new suggestions)

8. **Centralize `APP_ENV` resolution — it's duplicated in 4 places.** `os.environ.get("APP_ENV", "development")` is independently read in `app/config.py:169`, `app/db/pool_manager.py:16`, `app/db/psycopg_driver.py:21`, and `app/routers/image_router.py:21`. Each constructs its own env-based branching. The config split (Step 2) should add a single `app_env: str` field to `Settings` (reading from the `APP_ENV` env var), then all four consumers reference `settings.app_env` instead of repeating the `os.environ.get` call. This eliminates drift risk if the default ever changes.

9. **Deduplicate the mutation resolver try/except boilerplate.** Every resolver in `mutation.py` (and most in `query.py`) follows the identical pattern:
   ```python
   try:
       return await helper(...)
   except ValidationException:
       raise
   except Exception as e:
       logger.error("Error ...: %s", e)
       raise GraphQLException(message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}) from e
   ```
   This is ~10 lines repeated ~30 times. Extract a decorator (e.g. `@handle_graphql_errors("Error creating admin user")`) that wraps the helper call, catches `ValidationException` re-raise, and converts unexpected exceptions to `GraphQLException` with logging. This reduces `mutation.py` from ~630 lines to ~200 and makes new resolvers one-liners.

10. **Move `scheduler.py` inline SQL into the SQL store.** `app/scheduler.py` defines two raw SQL strings (`_GET_ACTIVE_CLIENTS`, `_GET_ACTIVE_SCHEMAS`) outside of `SqlStore`. These are queries against the client DB and security schema respectively. They should move into `sql_reports_audit.py` (or `sql_shared.py`) as `SqlStore` constants, and `scheduler.py` should reference them via `SqlStore.GET_ACTIVE_CLIENTS` etc. This keeps all SQL in one layer and avoids the scheduler being the only module with "rogue" queries.

11. **Pin `requirements.txt` versions or add a lockfile.** All 18 dependencies are completely unpinned (`aiofiles`, `fastapi`, `httpx>=0.27.0`, etc.). A fresh `pip install` can pull breaking major versions at any time. Two options: (a) pin to compatible-release ranges (`fastapi>=0.115,<0.116`) for stability with security patches, or (b) add a `pip-compile`-generated `requirements.lock` that pins exact transitive dependencies. The latter is preferred for reproducibility.

12. **Flag `mcp[cli]` in `requirements.txt` for review.** This is an MCP SDK with CLI extras — likely used for development/tooling, not for the production server runtime. It pulls in non-trivial transitive dependencies (rich, prompt-tooling, etc.). Move it to a separate `requirements-dev.txt` or `[project.optional-dependencies] dev` group so production deploys stay lean.

13. **`GENERIC_UPDATE_TABLE_RIGHTS` must be split by domain.** When `mutation.py` is split into domain modules, the `GENERIC_UPDATE_TABLE_RIGHTS` dict (table→access-right mapping, currently ~30 entries at `mutation.py:67-98`) and `GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS` (line 103-105) need to move with their respective domain resolvers. The tables map to: Masters→`inventory/`, Configurations→`bu_admin/`, Deliver Job→`jobs/`, Inventory→`inventory/`. The shared `generic_update.py` resolver should accept the rights dict as a parameter rather than importing a monolithic dict.

14. **Tighten CORS for production.** `app/main.py:68` uses `allow_origins=["*"]`, which allows any origin to make authenticated requests. This should read from `settings` (e.g. `settings.cors_origins`, defaulting to `["http://localhost:3000"]` in dev and the real domain in production). The wildcard is fine for local dev but is a security hole in production.

15. **Uncomment `host`/`port` in `uvicorn.run()`.** `app/main.py:93-94` has `host=settings.host` and `port=settings.port` commented out. This means uvicorn always binds to `0.0.0.0:8000` regardless of config. Either uncomment them or remove the dead code and the `host`/`port` fields from `Settings` if the intent is to always use defaults.

16. **`subscription.py` needs a placement note.** The plan shows it at `resolvers/subscription.py` but doesn't say whether it stays as-is or gets domain-split. Since subscriptions are currently a single file with no domain clustering, it should stay flat at `resolvers/subscription.py` — but the plan should state this explicitly so implementors don't wonder.

17. **Update the `extract_schema.py` extractor for the new SQL layout.** `sql_bu.py` and `sql_security.py` are both auto-generated (line 1: `# AUTO-GENERATED by app/db/tools/extract_schema.py`). When these are absorbed into `sql_bu_admin.py`, the extractor script must be updated to write to the new file and class name. Otherwise the next extraction run will overwrite the wrong file.

18. **Create `__init__.py` files for all new directories.** The new `sql/`, `connection/`, `seeds/`, `schema_dumps/`, `resolvers/shared/`, `resolvers/jobs/`, `resolvers/inventory/`, `resolvers/sales_accounts/`, `resolvers/bu_admin/`, `resolvers/reports_audit/`, `routers/auth/`, `routers/media/`, `core/settings/`, and `tests/` subdirectories all need empty `__init__.py` files (or implicit namespace packages if using Python 3.3+). Document this in the implementation checklist so none are missed.

19. **`app/services/file_client.py` env-based URL selection follows the same pattern as item 8.** `image_router.py:22-26` constructs `_file_server_url` by branching on `APP_ENV`, duplicating logic that could live as a computed field on `Settings` (e.g. `settings.file_server_url` returning dev or prod based on `settings.app_env`). This should be centralized alongside item 8.

## What this report intentionally does NOT do
- Doesn't touch `schema.graphql`'s field ordering (a separate, much smaller cleanup — `claude.md` says alphabetical, but the `Mutation` type isn't).
- Doesn't propose scrubbing git history for the exposed secrets — that's a decision (and risk) to make separately, since rewriting history affects every clone/branch.
- Doesn't pick which of `.pyre_configuration`/`pyrightconfig.json` to keep — worth a quick check of which one is actually wired into CI/editor before deleting either.

---

# Detailed Step-by-Step Implementation Plan

This report intentionally stopped short of moving files. The steps below are the follow-up implementation pass, ordered from highest-priority/lowest-risk to most invasive. Each step is scoped to be its own PR — small enough to review, and independently revertable if something breaks.

## Step 1 — Security hygiene (independent of the folder reorg)
Highest priority, lowest risk, touches no application logic.

1. **Step 1.1 — Add `.env.example`.** Document every env var `Settings` currently reads (names only, no real values) so a new developer/environment knows what to set.
2. **Step 1.2 — Move hardcoded secret defaults out of `config.py`.** Move the literal values of `client_db_password`, `service_db_password`, `secret_key`, `smtp_password`, `super_admin_password_hash`, `file_server_api_key` into a local, gitignored `.env` file; `config.py` reads them via Pydantic settings instead of hardcoding defaults. (Design note 5 — this is hygiene, not git-history cleanup, since `config.py` was never committed.)
3. **Step 1.3 — Untrack the audit logs.** Run `git rm --cached` on the 44 tracked files under `logs/audit/*.jsonl` (keep them on disk; the repo-root `.gitignore` already has the `logs/` rule so they won't be re-added).
4. **Step 1.4 — Pin `requirements.txt`.** Either add compatible-release pins (`fastapi>=0.115,<0.116`, etc.) or generate a `pip-compile` lockfile for all 18 dependencies.
5. **Step 1.5 — Split out dev-only dependencies.** Move `mcp[cli]` into a `requirements-dev.txt` (or `[project.optional-dependencies] dev` group) so production installs stay lean.

**Verification:** `git status` shows the audit `.jsonl` files as untracked-but-present-on-disk; `git log -- app/config.py` still shows no history; app boots locally reading secrets from `.env`; `pip install -r requirements.txt` succeeds with pinned versions.

## Step 2 — Config centralization
Depends on Step 1 (the `.env` file must exist first).

1. **Step 2.1 — Create `app/core/settings/` package** with `database_settings.py`, `auth_settings.py`, `email_settings.py`, `api_settings.py`.
2. **Step 2.2 — Split the `Settings` class** by concern into those four files, composed back into one `Settings` object via Pydantic nested-settings support (design note 4).
3. **Step 2.3 — Add a single `app_env` field** to `Settings`, then replace the 4 duplicated `os.environ.get("APP_ENV", "development")` reads (`app/config.py:169`, `app/db/pool_manager.py:16`, `app/db/psycopg_driver.py:21`, `app/routers/image_router.py:21`) with `settings.app_env` (item 8).
4. **Step 2.4 — Centralize `file_server_url` selection** on `Settings` alongside `app_env`, replacing the branch in `image_router.py:22-26` (item 19).
5. **Step 2.5 — Tighten CORS.** Replace `allow_origins=["*"]` (`app/main.py:68`) with `settings.cors_origins`, defaulting to `["http://localhost:3000"]` in dev (item 14).
6. **Step 2.6 — Fix the commented-out uvicorn bind.** Uncomment `host=settings.host, port=settings.port` in `app/main.py:93-94`, or remove the dead code/fields if defaults are intentional (item 15).

**Verification:** run the type-checker across `app/` (whichever of `.pyre_configuration`/`pyrightconfig.json` is actually wired in); start the server locally and confirm it binds to the configured host/port and reads all settings correctly; confirm CORS behavior against a local client origin.

## Step 3 — SQL layer split
Independent of Step 2; can run in parallel once Step 1 lands.

1. **Step 3.1 — Create `app/db/sql/` package** with `sql_base.py`, `sql_jobs.py`, `sql_inventory.py`, `sql_sales_accounts.py`, `sql_bu_admin.py`, `sql_reports_audit.py`, `sql_shared.py`.
2. **Step 3.2 — Move constants into per-domain classes**, grouped by the prefixes in "Evidence for the domain split" above (`JOB(S)`/`WARRANTY`/... → `JobsSql`, etc.), moving `sql_bu.py`'s content into `SqlBuAdmin`.
3. **Step 3.3 — Compose `SqlStore` via multiple inheritance** in `sql_base.py`: `class SqlStore(JobsSql, InventorySql, SalesAccountsSql, BuAdminSql, ReportsAuditSql, SharedSql): pass` (design note 1) — every existing `SqlStore.CONST_NAME` call site keeps working unmodified.
4. **Step 3.4 — Move `scheduler.py`'s inline SQL** (`_GET_ACTIVE_CLIENTS`, `_GET_ACTIVE_SCHEMAS`) into `sql_reports_audit.py`/`sql_shared.py` as `SqlStore` constants, then reference them from `scheduler.py` (item 10).
5. **Step 3.5 — Update `extract_schema.py`** so the auto-generation for the (now-merged) `sql_bu.py`/`sql_security.py` content writes into `sql_bu_admin.py` under the right class name (item 17).
6. **Step 3.6 — Reorganize `app/db/`**: move `pool_manager.py`/`psycopg_driver.py` into `connection/`, add `seeds/` (`seed_bu_data.py`, `seed_security_data.py`) and `schema_dumps/` (raw `.sql` DDL files), keep `extract_schema.py` under `tools/`.
7. **Step 3.7 — Add `__init__.py`** to every new subdirectory created in this step (item 18).

**Verification:** grep for every `SqlStore.` usage across `app/` and confirm the referenced constant still resolves (no `AttributeError` at import time — import `app.db.sql.sql_base` and instantiate/inspect `SqlStore` in a REPL or a smoke test); run the type-checker; run `extract_schema.py` once against a scratch/dev schema to confirm it writes to the new location.

## Step 4 — Resolver split
Depends on Step 3 landing first (resolvers import `SqlStore`, so a stable SQL layer avoids double churn).

1. **Step 4.1 — Create `app/graphql/resolvers/{shared,jobs,inventory,sales_accounts,bu_admin,reports_audit}/` packages.**
2. **Step 4.2 — Move `mutation_helper.py` functions** into the matching domain package's `mutations.py`/`provisioning.py`/`users_roles.py`/`mailers.py`/`invoicing.py` per the function-name mapping in "Evidence for the domain split" (design note 2) — pure move, no logic changes.
3. **Step 4.3 — Move `query_helper.py` functions** the same way into `reports_audit/queries.py` and `shared/generic_query.py`.
4. **Step 4.4 — Move `_decode_value`/`_serialize_row`/generic envelope helpers** into `shared/generic_query.py` / `shared/generic_update.py`.
5. **Step 4.5 — Add the `@handle_graphql_errors(...)` decorator** (item 9) and apply it across `mutation.py`/`query.py` resolvers, replacing the repeated try/except block.
6. **Step 4.6 — Split `GENERIC_UPDATE_TABLE_RIGHTS`/`GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS`** by domain (item 13) and pass the relevant dict into `generic_update.py` as a parameter instead of importing one monolithic dict.
7. **Step 4.7 — Reduce `mutation.py`/`query.py` to thin dispatchers** that import from the domain packages and apply the decorator.
8. **Step 4.8 — Leave `subscription.py` flat** at `resolvers/subscription.py` (item 16) — explicitly not domain-split in this pass.
9. **Step 4.9 — Add `__init__.py`** to every new resolver subdirectory (item 18).

**Verification:** run the type-checker across `app/graphql/`; exercise the GraphQL schema against a local/dev DB — at minimum, one mutation and one query per domain (job create, inventory import, sales invoice, BU user creation, dashboard stats) — to confirm no import/dispatch regressions; confirm `mutation.py`/`query.py` line counts dropped roughly as expected (~630→~200 lines for `mutation.py`).

## Step 5 — Structural move & cleanup
Cosmetic/organizational; safe to do last since it doesn't touch resolver or SQL logic.

1. **Step 5.1 — Move `app/exceptions.py` → `app/core/exceptions.py`** (design note 3) and fix imports.
2. **Step 5.2 — Reorganize `app/routers/`**: `auth_router.py`/`auth_router_helper.py` → `routers/auth/router.py`/`helper.py`; `image_router.py` → `routers/media/image_router.py`.
3. **Step 5.3 — Fold `app/schemas/auth_schema.py`** into `resolvers/bu_admin/` or `routers/auth/`, whichever actually consumes it — confirm the real consumer before moving.
4. **Step 5.4 — Move loose root scripts into `scripts/`**: `run_server.bat`, `activate.bat`, `install_dependencies.bat`, `extract_schema.sh`.
5. **Step 5.5 — Drop `app/utils/`** (confirmed empty).
6. **Step 5.6 — Remove one of `.pyre_configuration`/`pyrightconfig.json`** — first confirm which one CI/editor actually uses, then delete the other.
7. **Step 5.7 — Add any remaining `__init__.py` files** missed in earlier steps (final sweep of item 18).

**Verification:** run the type-checker one more time across the whole repo; start the server and confirm auth/media routes still resolve; confirm no dangling imports reference the old `app/exceptions.py` or `app/schemas/auth_schema.py` paths.

## Step 6 — Tests scaffolding
Can start any time after Step 3/4 land (tests need stable module paths to import against).

1. **Step 6.1 — Create `tests/{jobs,inventory,sales_accounts,bu_admin,reports_audit,core}/`** mirroring the `app/` domain layout (design note 7).
2. **Step 6.2 — Add one smoke test per domain** exercising the highest-risk resolver/SQL path moved in Steps 3–4 (e.g. `resolve_create_job_batch`, `resolve_import_spare_parts`, `resolve_create_sales_invoice`, `resolve_create_admin_user`, `resolve_admin_dashboard_stats`).
3. **Step 6.3 — Wire tests into whatever CI exists** (or document the manual `pytest` invocation if there's no CI yet).

**Verification:** `pytest tests/` passes locally against a dev DB.

---

# Detailed Workflow

How to actually execute Steps 1–6 without breaking `service-plus-client` (the GraphQL consumer) or losing work mid-reorg.

1. **One branch per step, off `main`.** Each step above becomes its own branch (`reorg/step-1-security`, `reorg/step-2-config`, …) and its own PR — never bundle two steps into one PR. This keeps blast radius small and makes `git bisect`/revert trivial if a step regresses something.

2. **Order strictly as numbered, with two exceptions.** Steps 1 and 3 can run in parallel (both are independent of each other), but Step 2 must come after Step 1 (needs `.env`), Step 4 must come after Step 3 (resolvers import `SqlStore`), and Step 6 should trail Step 4 (tests need the final module paths). Step 5 is safe any time after Step 4 since it's purely cosmetic. Recommended sequence: **1 → 3 → 2 → 4 → 5 → 6** (security first, then the two independent-of-each-other structural splits, config next since it's small, then the big resolver split, then cleanup, then tests).

3. **Before starting each step:** pull latest `main`, branch off it (not off the previous reorg branch) — each step should merge to `main` before the next begins, so `service-plus-client` integration issues surface one step at a time instead of compounding.

4. **While making each step's changes:** move code mechanically first (no logic edits mixed in) — a pure "cut here, paste there, fix imports" pass is easy to review and easy to trust. Any actual behavior change called out in the plan (e.g. the `@handle_graphql_errors` decorator in Step 4.5, CORS tightening in Step 2.5) should be its own commit within the step's branch, separate from the mechanical move, so a reviewer can tell "moved code" from "changed code" at a glance.

5. **After each step, before opening the PR — run this checklist:**
   - Type-checker across the whole `app/` tree (not just the touched files — catches import fallout elsewhere).
   - Start the server locally (`scripts/run_server.bat` or equivalent) and confirm it boots without errors.
   - Run the step's own "Verification" bullet from above.
   - Grep for any remaining references to the old file/module path being removed (e.g. `grep -rn "from app.exceptions"` after Step 5.1) to catch missed import fixups.
   - If Step 6 tests exist yet (i.e., this is Step 6 itself or later), run `pytest tests/`.

6. **Manual smoke test against `service-plus-client` after Steps 2, 3, and 4 specifically** (the three steps capable of silently changing resolver behavior or breaking `SqlStore` constant resolution) — open the client against the locally reorganized server and exercise: login, one job create/update/deliver flow, one inventory import, one sales invoice, one BU-admin action, and the admin dashboard. These are exactly the domains touched by the resolver/SQL split, so this is the fastest way to catch a dropped constant or a broken dispatch before merging.

7. **Merge and tag each step.** After a step's PR merges to `main`, tag it (e.g. `reorg-step-1-done`) so there's a clean rollback point if a later step's integration testing reveals the earlier step actually broke something subtle.

8. **Rollback plan.** Because each step is its own small PR, reverting one step is a single `git revert` of its merge commit, not an unwind of a giant combined reorg. If Step 4 (resolver split) is the one most likely to need a rollback (it's the largest, most mechanical, most import-fixup-heavy step), consider splitting it further into one PR per domain package (`jobs/`, `inventory/`, `sales_accounts/`, `bu_admin/`, `reports_audit/`, `shared/`) if the full-step PR turns out too large to review confidently in one pass.

9. **Track the checklist items (item 18, `__init__.py` files) as part of each step's own checklist**, not as a separate cleanup pass — every step that creates a new package directory adds its own `__init__.py` in the same commit, so nothing is left for a final "did we forget any" sweep except the safety-net check in Step 5.7.

10. **Secrets rotation is out of scope for this reorg** (per "What this report intentionally does NOT do") but should be tracked as its own, separate follow-up ticket once Step 1 lands — moving secrets to `.env` is hygiene, not a substitute for a rotation policy going forward.
