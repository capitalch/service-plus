# Recommended File/Folder Reorganization — service-plus-server

**This is a recommendation report, not something that has been executed.** No application files have been moved or split — this documents a proposed target structure for review before any implementation pass.

## Context
`service-plus-server` (the Python/FastAPI GraphQL backend for service-plus-client) grew organically into a flat, concern-mixing layout. The two most-touched files are already unmanageable:
- `app/db/sql_store.py` — **6,514 lines**, one `SqlStore` class holding 331 SQL string constants for every domain (jobs, inventory, sales, BU/security, reports...).
- `app/graphql/resolvers/mutation_helper.py` — **2,917 lines** (`# pylint: disable=too-many-lines` was added instead of splitting it), mixing job/invoice/BU-provisioning/security logic in one flat function soup, mirrored 1:1 by `mutation.py`'s thin dispatchers.

`app/db/sql_bu.py` (1,646 lines) is a third large file. Alongside this, real production secrets are hardcoded in `app/config.py`; both `config.py` and `logs/` are already ignored via the repo-root `.gitignore` (`/home/sushant/projects/service-plus/.gitignore`, applies repo-wide since this is a single git repo) — see item 6 below for the `logs/audit/*.jsonl` files that were tracked before that rule took effect. There's no `tests/` directory and no architecture doc (`claude.md`/`GEMINI.md` are AI-agent instruction files, not structural docs). The goal below is a domain-based structure that matches how the code actually divides (confirmed via SQL-constant prefixes and resolver function names): **jobs, inventory/masters, sales/accounts, BU-admin/security/provisioning, reports/audit, and shared/core infra.**

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
│   │   │   ├── sql_base.py              # SqlStore base class (see migration note below)
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

## Key redistribution notes

1. **`sql_store.py` → domain files, same access pattern.** To split the single `SqlStore.CONST_NAME` class (referenced at ~300+ call sites) without a one-shot rewrite of every call site, each domain file defines its own class with only its constants (`class JobsSql: GET_JOB = "..."`), and `sql_base.py` composes them via multiple inheritance: `class SqlStore(JobsSql, InventorySql, SalesAccountsSql, BuAdminSql, ReportsAuditSql, SharedSql): pass`. Existing `SqlStore.X` references keep working untouched; only the constant *definitions* move. This is the low-risk migration path — moving to fully separate `JobsSql.GET_JOB`-style call sites everywhere is the cleaner end state but requires touching every call site and should be a separate, later pass if wanted.
2. **`mutation_helper.py`/`query_helper.py` → per-domain modules, `mutation.py`/`query.py` stay as thin dispatchers.** Since `mutation.py` already just delegates to `mutation_helper.py` function-for-function, splitting the helper file along the domain boundaries above (jobs/inventory/sales_accounts/bu_admin/reports_audit/shared) and having `mutation.py`/`query.py` import from the right submodule is mechanical — no logic changes, just moving functions and fixing imports.
3. **`app/exceptions.py` → `app/core/exceptions.py`.** It's cross-cutting infra (used everywhere), not a top-level concern of its own.
4. **`config.py` → `app/core/settings/*.py`.** Split the single 175-line `Settings` class into `DatabaseSettings`/`AuthSettings`/`EmailSettings`/`ApiSettings` (composed into one `Settings` object via Pydantic's nested-settings support), grouped by what they configure rather than one flat list.
5. **Secrets (priority, independent of the folder move):** `client_db_password`, `service_db_password`, `secret_key`, `smtp_password`, `super_admin_password_hash`, and `file_server_api_key` are hardcoded literal defaults in `config.py` today. A repo-root `.gitignore` already exists and already ignores `config.py`/`logs/`; `config.py` itself has never been committed, so these specific hardcoded defaults are not exposed in git history. Recommended: move real values to a gitignored `.env` (`.env.example` documenting names only) as good hygiene regardless — the file is still plaintext on disk today — but credential rotation is no longer urgent *due to git exposure* specifically. (Audit logs are a separate, real exposure — see next item.)
6. **`logs/audit/*.jsonl` should not be git-tracked.** The repo-root `.gitignore` already has a `logs/` rule; these files were tracked before that rule took effect, so `git rm --cached` the 44 tracked files (keeping them on disk). Runtime audit data doesn't belong in version control regardless of the folder it lives in.
7. **`tests/` doesn't exist yet.** If tests get added later, mirror the same domain folders under `app/` so test-to-source mapping stays obvious (`tests/jobs/`, `tests/bu_admin/`, etc.).

## Additional improvements (new suggestions)

8. **Centralize `APP_ENV` resolution — it's duplicated in 4 places.** `os.environ.get("APP_ENV", "development")` is independently read in `app/config.py:169`, `app/db/pool_manager.py:16`, `app/db/psycopg_driver.py:21`, and `app/routers/image_router.py:21`. Each constructs its own env-based branching. The config split (item 4) should add a single `app_env: str` field to `Settings` (reading from the `APP_ENV` env var), then all four consumers reference `settings.app_env` instead of repeating the `os.environ.get` call. This eliminates drift risk if the default ever changes.

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

## If/when this gets implemented
This report intentionally stops short of moving files. A follow-up implementation pass would need to: (a) do the mechanical splits with import-path fixups verified by running the type-checker across the whole repo after each domain's move, (b) handle the `SqlStore` composition carefully so no constant is dropped, and (c) treat the secrets/`.gitignore`/audit-log fixes as a separate, first PR since they're higher priority and lower risk than the code reorg.

### Suggested implementation order
1. **PR 1 (security, independent of reorg):** `.env.example` + move `config.py` defaults to a gitignored `.env` (hygiene, not history cleanup), `git rm --cached` the tracked `logs/audit/*.jsonl` files, pin or lock `requirements.txt`, move `mcp[cli]` to dev deps. (No new `.gitignore` needed — the repo-root one already covers this subfolder.)
2. **PR 2 (config centralization):** Split `config.py` → `core/settings/`, add `app_env` computed field, centralize `APP_ENV` reads (items 4, 8, 19). Tighten CORS (item 14). Uncomment uvicorn host/port (item 15).
3. **PR 3 (SQL split):** Split `sql_store.py` → `sql/*.py` with `SqlStore` multiple-inheritance composition (item 1). Move scheduler inline SQL (item 10). Update extractor script (item 17).
4. **PR 4 (resolver split):** Split `mutation_helper.py` → domain modules, add error-handling decorator (items 2, 9, 13). Split `GENERIC_UPDATE_TABLE_RIGHTS`.
5. **PR 5 (move & clean):** Move `exceptions.py` → `core/`, reorganize `routers/`, drop `utils/`, delete one of `.pyre_configuration`/`pyrightconfig.json`, add `__init__.py` files.
6. **PR 6 (tests scaffolding):** Add `tests/` with domain folders and initial smoke tests.
