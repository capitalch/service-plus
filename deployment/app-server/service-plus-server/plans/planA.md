# Plan: Fix Logger Warnings Across service-plus-server

## Problem Summary

The current logging setup in `app/logger.py` creates a **named logger** (`service_plus`) using `logging.getLogger("service_plus")`, attaches a `StreamHandler` to it, and exports it as the global `logger`. This approach causes several known warning/issues in a FastAPI + Uvicorn environment:

1. **Duplicate log output**: The named logger has its own handler AND propagates to the root logger. When Uvicorn/FastAPI also configures the root logger (which it does), every log line is printed twice — once from the named logger's handler, and once from the root logger's handler.
2. **Logger propagation not disabled**: `logger.propagate = False` is not set, so all log records bubble up to the root logger after being handled at the named-logger level.
3. **Module-level named logger used as singleton**: The single `logger = setup_logger()` instance is shared across all 16 modules. This is not bad by itself, but when Uvicorn reconfigures logging at startup (via `logging.config.dictConfig`), the handlers added at module import time can get into conflict with Uvicorn's log config.
4. **Inconsistent use of f-strings vs `%`-style formatting**: Some call sites use `logger.warning(f"…")` while others use `logger.debug("%s", …)`. Both work, but f-string formatting is evaluated eagerly even when the log level is suppressed — a minor performance concern and style inconsistency.
5. **Stale / broken import in `dependencies.py`**: `from app.db.psycopg_driver import get_db_connection` is an import of a function (`get_db_connection`) that does not exist in `psycopg_driver.py`. Only `get_client_db_connection` and `get_service_db_connection` are defined. This causes an `ImportError` at startup, which surfaces as confusing error output near logger startup messages.
6. **Missing `auth_queries.py`**: `dependencies.py` imports `from app.db.auth_queries import AuthQueries` which also does not exist, compounding the import error above.

---

## Workflow

```
Audit codebase
      ↓
Fix logger.py (propagate=False, integrate with Uvicorn's log config)
      ↓
Fix duplicate-handler issue in setup_logger()
      ↓
Fix broken imports in dependencies.py (get_db_connection, auth_queries)
      ↓
Standardise log-call style (lazy % vs eager f-string) across all modules
      ↓
Verify with a test run (no duplicate lines, no import warnings)
```

---

## Steps

### Step 1 — Fix `app/logger.py`: disable propagation and integrate with Uvicorn

**File**: `app/logger.py`

**Changes**:
- After `logger.addHandler(console_handler)` add `logger.propagate = False`. This stops records from bubbling up to the root logger and being printed a second time by Uvicorn's handler.
- Add a `configure_uvicorn_logging()` helper that, when called from `main.py`'s lifespan, suppresses the duplicate output from uvicorn's own `uvicorn.access` and `uvicorn.error` loggers OR redirects them to use the same formatter. This is optional but best practice.
- Export `setup_logger` so individual modules can create child loggers (`logging.getLogger("service_plus.module_name")`) rather than all sharing the root named logger, if needed in future. For now keep the single global `logger`.

### Step 2 — Fix broken imports in `app/core/dependencies.py`

**File**: `app/core/dependencies.py`

**Changes**:
- Remove `from app.db.psycopg_driver import get_db_connection` (function does not exist).
- Remove `from app.db.auth_queries import AuthQueries` (module does not exist).
- Replace the `get_current_user` body that uses these with the correct pattern: use `exec_sql` with `SqlStore` to look up the user by ID from the JWT `sub` claim. This mirrors the pattern used everywhere else in the codebase.

### Step 3 — Standardise log-call formatting across all 16 files

**Files affected** (all files that import `from app.logger import logger`):
- `app/main.py`
- `app/graphql/schema.py`
- `app/graphql/pubsub.py`
- `app/graphql/resolvers/query.py`
- `app/graphql/resolvers/query_helper.py`
- `app/graphql/resolvers/mutation.py`
- `app/graphql/resolvers/mutation_helper.py`
- `app/graphql/resolvers/subscription.py`
- `app/routers/auth_router.py`
- `app/routers/auth_router_helper.py`
- `app/routers/base_router.py`
- `app/core/security.py`
- `app/core/dependencies.py`
- `app/core/email.py`
- `app/core/audit_log.py`
- `app/db/psycopg_driver.py`

**Changes**:
- Convert all `logger.xxx(f"…{var}…")` calls that are at `DEBUG` or `INFO` level to lazy `%`-style: `logger.xxx("…%s…", var)`. This avoids string interpolation when the log level is not active.
- Leave `logger.warning`, `logger.error`, and `logger.exception` calls with f-strings as-is if they contain complex formatting; convert simple ones to `%`-style.
- Remove any `logger.info` calls inside tight loops (e.g., `pubsub.py` publish loop) and replace them with `logger.debug`.

### Step 4 — Suppress noisy `INFO` lines in `pubsub.py`

**File**: `app/graphql/pubsub.py`

**Changes**:
- Downgrade `logger.info(f"Publishing to event '{event}' with {len(queues)} subscriber(s)")` to `logger.debug(…)` — this fires on every mutation that triggers an event and floods the console.
- Downgrade `logger.info(f"New subscriber added to event: {event}")` and `logger.info(f"Subscriber removed from event: {event}")` to `logger.debug(…)`.
- Keep `logger.info("PubSub system initialized")` as-is (fires only once at startup).

### Step 5 — Suppress noisy per-request `INFO` lines in routers

**File**: `app/routers/auth_router.py`

**Changes**:
- Downgrade `logger.info(f"Clients endpoint called …")` and `logger.info(f"Login endpoint called …")` to `logger.debug(…)` (these fire on every HTTP request).

**File**: `app/routers/base_router.py`
- Already uses `logger.debug` for root and health — no change needed.

### Step 6 — Add `propagate = False` note and ensure `logger.py` works correctly before Uvicorn reconfigures logging

**File**: `app/main.py`

**Changes**:
- In the `lifespan` startup block, call `setup_logger()` explicitly **after** the FastAPI app is initialised (so Uvicorn's log config is already in place) if needed. Add a comment explaining the propagation strategy.
- Optionally suppress Uvicorn's own access logger if too noisy:
  ```python
  import logging
  logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
  ```

### Step 7 — Verify

- Start the server and confirm:
  - No duplicate log lines.
  - No `ImportError` or `ModuleNotFoundError` at startup.
  - No Python `logging` warnings (e.g., `No handlers could be found for logger "…"`).
  - Log output is clean and formatted consistently.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `app/logger.py` | Modify — add `propagate = False`, add Uvicorn integration helper |
| `app/core/dependencies.py` | Modify — fix broken imports, rewrite `get_current_user` |
| `app/graphql/pubsub.py` | Modify — downgrade noisy INFO → DEBUG |
| `app/routers/auth_router.py` | Modify — downgrade per-request INFO → DEBUG |
| `app/graphql/resolvers/mutation_helper.py` | Modify — standardise log format |
| `app/db/psycopg_driver.py` | Modify — standardise log format (already mostly % style) |
| (All other logger-using files) | Modify — convert f-string logger calls to lazy `%` format where appropriate |

---

## Notes

- The root cause of **duplicate output** is `propagate=True` (the default) combined with Uvicorn attaching a handler to the root logger.
- The root cause of **import warnings/errors** is stale references to `get_db_connection` and `AuthQueries` in `dependencies.py`.
- No new dependencies are needed — all changes are within the existing stdlib `logging` module and existing app utilities.
