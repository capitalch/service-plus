# Plan: Resolve Pylint Warnings in `psycopg_driver.py`

## Diagnostics Summary

| Severity    | Count | Categories                                                  |
|-------------|-------|-------------------------------------------------------------|
| Warning     | 8     | lazy-logging (W1203), raise-without-from (W0707)            |
| Hint        | 7     | too-few-public-methods, too-many-arguments, dict-literal, too-many-locals |
| Information | 8     | missing-docstring (C0116), wrong-import-order (C0411), invalid-name (C0103) |

---

## Status

| # | Change | Status |
|---|--------|--------|
| 1 | Fix import order | **done** |
| 2 | Module-level `_MAX_BULK_PLACEHOLDERS` constant | **done** |
| 3 | Suppress `too-few-public-methods` on loader classes | **done** |
| 4 | Suppress `too-many-arguments` on `_open_db_connection` | **done** |
| 5 | Fix lazy `%` logging (8 occurrences) | **done** |
| 6 | Fix `raise` without `from e` | **done** |
| 7 | Replace `dict()` with dict literals in `exec_sql_dml` | **done** (refactored away entirely) |
| 8 | Add docstrings to 6 undocumented functions | **done** |
| 9 | Reduce local variables in `bulk_insert_records` | **done** |
| T | `APP_ENV`-based host/port selection in connection helpers | **done** |

---

## Completed Changes

### 7. `exec_sql_dml` — use connection helpers (dict literal hint resolved)
`exec_sql_dml` previously built a `conn_settings` dict and called `_open_db_connection` directly.
Refactored to use `get_service_db_connection` / `get_client_db_connection` with `autocommit=True`,
matching the pattern used by `exec_sql` and `exec_sql_object`. The `dict()` blocks were eliminated entirely.

Both helpers gained an `autocommit: bool = False` parameter, passed through to `_open_db_connection`.

### T. `APP_ENV`-based host/port selection (`tran.md`)
- `import os` added (stdlib, line 5).
- `_APP_ENV: str = os.environ.get("APP_ENV", "development")` added at module level (line 17).
- `get_client_db_connection`: selects `client_db_ip_address` / `client_db_internal_port` when `_APP_ENV == "production"`, otherwise `client_db_host` / `client_db_port`.
- `get_service_db_connection`: same pattern for the service DB.

---

## Remaining Changes

### 2. Add module-level constant for bulk-insert placeholder limit
**Issue:** `MAX_PLACEHOLDERS = 2000` inside `bulk_insert_records` causes:
- `invalid-name` (not snake_case)
- contributes to `too-many-local-variables` (19/15)

**Fix:** Declare `_MAX_BULK_PLACEHOLDERS = 2000` at module level. Rename usage inside the function.


### 3. Suppress `too-few-public-methods` on loader classes
**Issue:** `_IsoDateLoader`, `_IsoTimestampLoader`, `_IsoTimestamptzLoader`, `_FloatNumericLoader` each have only one public method — intentional for psycopg type-loader overrides.  
**Fix:** Add inline `# pylint: disable=too-few-public-methods` on each class definition line.


### 4. Suppress `too-many-arguments` / `too-many-positional-arguments` on `_open_db_connection`
**Issue:** 7 parameters exceed the default limit of 5. Intentional — mirrors psycopg `connect()`.  
**Fix:** Add inline `# pylint: disable=too-many-arguments,too-many-positional-arguments` on the `async def` line.

### 9. Reduce local variables in `bulk_insert_records`
**Issue:** 19 local variables exceeds the limit of 15.  
**Fix (combining with change #2):**
- Remove `MAX_PLACEHOLDERS` local → use module-level `_MAX_BULK_PLACEHOLDERS` → −1
- Inline `num_fields` (only used in 2 expressions) → −1
- Inline `connection` variable → −1

Net reduction: 19 → 16 → under limit.

