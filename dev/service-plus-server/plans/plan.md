# Recommended File/Folder Reorganization — service-plus-server

**This is a recommendation report, not something that has been executed.** No application files have been moved or split — this documents a proposed target structure for review before any implementation pass.

## Context
`service-plus-server` (the Python/FastAPI GraphQL backend for service-plus-client) grew organically into a flat, concern-mixing layout. The two most-touched files are already unmanageable:
- `app/db/sql_store.py` — **6,514 lines**, one `SqlStore` class holding 331 SQL string constants for every domain (jobs, inventory, sales, BU/security, reports...).
- `app/graphql/resolvers/mutation_helper.py` — **2,917 lines** (`# pylint: disable=too-many-lines` was added instead of splitting it), mixing job/invoice/BU-provisioning/security logic in one flat function soup, mirrored 1:1 by `mutation.py`'s thin dispatchers.

`app/db/sql_bu.py` (1,646 lines) is a third large file. Alongside this, real production secrets are hardcoded in `app/config.py` with **no `.gitignore` anywhere in the repo**, and `logs/audit/*.jsonl` (44 files) are git-tracked runtime data. There's no `tests/` directory and no architecture doc (`claude.md`/`GEMINI.md` are AI-agent instruction files, not structural docs). The goal below is a domain-based structure that matches how the code actually divides (confirmed via SQL-constant prefixes and resolver function names): **jobs, inventory/masters, sales/accounts, BU-admin/security/provisioning, reports/audit, and shared/core infra.**

## Evidence for the domain split
- `sql_store.py` constant prefixes cluster into: `JOB(S)`/`WARRANTY`/`TECHNICIAN`/`DELIVERED`/`DELIVERABLE` (**jobs**), `STOCK`/`PART(S)`/`PRODUCT`/`BRAND`/`MODEL`/`VENDOR`/`SUPPLIER`/`PURCHASE` (**inventory/masters**), `SALES`/`CUSTOMER(S)` (**sales**), `BU`/`BUSINESS`/`DIVISION`/`BRANCH`/`CLIENT`/`ADMIN`/`USER`/`FY`/`STATE` (**bu-admin/security**), `DASHBOARD`/`PROFIT`/`REVENUE` (**reports**).
- `mutation_helper.py`/`mutation.py` function names split the same way: `resolve_create_job_batch/invoice/payment/single_job`, `resolve_deliver_job`, `resolve_undeliver_job`, `resolve_undo_job_transaction`, `resolve_update_job(_batch)` → **jobs**; `resolve_create_sales_invoice`, `_build_sales/purchase_invoice_tran_h`, `_build_money_receipt_tran_h`, `resolve_accounts_posting`, `_post_tran_h_to_trace_plus` → **sales/accounts**; `resolve_import_spare_parts`, `resolve_delete_unused_parts_by_brand` → **inventory**; `resolve_create_bu_schema_and_feed_seed_data`, `resolve_create_admin_user`, `resolve_create_business_user`, `resolve_create_client`, `resolve_create_service_db`, `resolve_delete_bu_schema/client`, `resolve_drop_database`, `resolve_feed_bu_seed_data`, `resolve_seed_security_data`, `resolve_set_user_bu_role`, `resolve_mail_*_credentials` → **bu-admin/security/provisioning**; `resolve_generic_update(_script)`, `_decode_value`, `_serialize_row` → **shared** (the "generic envelope" escape hatch every domain uses).
- `query_helper.py`/`query.py` are mostly cross-cutting: `resolve_admin_dashboard_stats`, `resolve_super_admin_*`, `resolve_audit_log(_stats)`, `resolve_system_settings`, `resolve_usage_health` → **reports/audit**; `resolve_generic_query(_batch)` → **shared**.

## Recommended target structure

```
service-plus-server/
├── .gitignore                      # NEW — .env*, logs/, __pycache__, .venv, etc.
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
5. **Secrets (priority, independent of the folder move):** `client_db_password`, `service_db_password`, `secret_key`, `smtp_password`, `super_admin_password_hash`, and `file_server_api_key` are hardcoded literal defaults in `config.py` today, and there's no `.gitignore` in the repo at all — so they're already committed to git history. Recommended: add a `.gitignore`, move real values to a gitignored `.env` (with `.env.example` documenting the variable names only), and **rotate every one of those credentials** since history already has them — a restructuring alone can't undo that exposure.
6. **`logs/audit/*.jsonl` should not be git-tracked.** Add `logs/` to `.gitignore` and `git rm --cached` the 44 tracked files (keeping them on disk). Runtime audit data doesn't belong in version control regardless of the folder it lives in.
7. **`tests/` doesn't exist yet.** If tests get added later, mirror the same domain folders under `app/` so test-to-source mapping stays obvious (`tests/jobs/`, `tests/bu_admin/`, etc.).

## What this report intentionally does NOT do
- Doesn't touch `schema.graphql`'s field ordering (a separate, much smaller cleanup — `claude.md` says alphabetical, but the `Mutation` type isn't).
- Doesn't propose scrubbing git history for the exposed secrets — that's a decision (and risk) to make separately, since rewriting history affects every clone/branch.
- Doesn't pick which of `.pyre_configuration`/`pyrightconfig.json` to keep — worth a quick check of which one is actually wired into CI/editor before deleting either.

## If/when this gets implemented
This report intentionally stops short of moving files. A follow-up implementation pass would need to: (a) do the mechanical splits with import-path fixups verified by running the type-checker across the whole repo after each domain's move, (b) handle the `SqlStore` composition carefully so no constant is dropped, and (c) treat the secrets/`.gitignore`/audit-log fixes as a separate, first PR since they're higher priority and lower risk than the code reorg.
