# Plan: Server-Side Handler for CHECK_ROLE_SEED_EXISTS

## How genericQuery Works

`resolve_generic_query_helper` in `query_helper.py` resolves any `genericQuery` call by:
1. Decoding the `value` payload to extract `sqlId` and `sqlArgs`.
2. Doing `getattr(SqlAuth, sql_id, None)` to look up the raw SQL string.
3. Calling `exec_sql(db_name, schema, sql, sql_args)` and returning the rows.

This means **no resolver, schema, or query.py changes are needed**. Adding a new `sqlId` only requires adding a new class attribute to `SqlAuth`.

---

## Workflow

1. Client sends `genericQuery` with `sqlId = "CHECK_ROLE_SEED_EXISTS"`, `db_name = <client_db>`, `schema = "security"`.
2. `resolve_generic_query_helper` calls `getattr(SqlAuth, "CHECK_ROLE_SEED_EXISTS")` — finds the new SQL.
3. `exec_sql` connects to the client database, runs the SQL against the `security` schema.
4. Returns `[{ "exists": true }]` or `[{ "exists": false }]`.
5. Client uses the result to decide whether to skip step 2 or show it.

---

## Steps

### Step 1 – Add `CHECK_ROLE_SEED_EXISTS` to `SqlAuth`
**File:** `service-plus-server/app/db/sql_auth.py`

Add a new class attribute (sorted alphabetically between `CHECK_DB_NAME_EXISTS` and `GET_ALL_CLIENTS_ON_CRITERIA`):

```python
CHECK_ROLE_SEED_EXISTS = """
    with "dummy" as (values(1::int))
    -- with "dummy" as (values(1::int)) -- Test line
    SELECT EXISTS(
        SELECT 1 FROM security.role LIMIT 1
    ) AS exists
"""
```

**Notes:**
- Uses the `with "dummy"` CTE pattern consistent with other `SqlAuth` queries that take no runtime arguments (e.g. `GET_BU_USER_STATS`).
- No `sql_args` are needed — the target database is selected via the `db_name` connection parameter, not via SQL arguments.
- `LIMIT 1` keeps it efficient; `EXISTS` short-circuits anyway.

---

## Files Changed

| File | Change |
|------|--------|
| `service-plus-server/app/db/sql_auth.py` | Add `CHECK_ROLE_SEED_EXISTS` class attribute to `SqlAuth` |
