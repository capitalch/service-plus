# Plan: Add `exec_sql_dml` to `psycopg_driver.py`

## Why `autocommit=True` is needed
DDL statements (`CREATE SCHEMA`, `CREATE TABLE`, `DROP TABLE`, etc.) cannot run inside
a transaction block in PostgreSQL. `autocommit=True` commits each statement immediately,
bypassing the transaction wrapper. The existing `exec_sql` / `exec_sql_object` use
explicit `commit()` and are correct for normal DML (INSERT/UPDATE/DELETE); `exec_sql_dml`
targets administrative / DDL operations.

---

## Issues in the original code to fix

| # | Issue | Fix |
|---|-------|-----|
| 1 | `dbName`, `sqlArgs` — camelCase | → `db_name`, `sql_args` (snake_case) |
| 2 | `Config.DB_NAME`, `dbParams`, `get_conn_info` — old helpers not in codebase | → use `settings` + `_open_db_connection` |
| 3 | `f"set search_path to {schema}"` — SQL injection | → `pgsql.SQL + pgsql.Identifier` |
| 4 | `await aconn.close()` inside `async with` — redundant | → remove; context manager handles it |
| 5 | `except … as e: raise e` — bare re-raise with no logging | → log + raise `DatabaseException` |
| 6 | `_open_db_connection` always does `await conn.commit()` — wrong for autocommit | → add `autocommit: bool = False` param |
| 7 | No return value | → return `int` (rowcount) |
| 8 | No `db_name` / `sql` validation | → raise `ValueError` if missing |
| 9 | No type hints on return | → `-> int` |

---

## Steps

### Step 1 — Extend `_open_db_connection` with `autocommit` param
Add `autocommit: bool = False` to its signature and pass it to
`psycopg.AsyncConnection.connect(autocommit=autocommit)`.
When `autocommit=True`, skip the `await conn.commit()` call (each statement
is already committed immediately; an explicit commit would be a no-op but
is misleading). Rollback is also skipped — it is a no-op in autocommit mode.

```python
@asynccontextmanager
async def _open_db_connection(
    host: str, port: int, user: str, password: str,
    dbname: str, label: str,
    autocommit: bool = False,
) -> AsyncGenerator[psycopg.AsyncConnection, None]:
    conn = await psycopg.AsyncConnection.connect(
        ..., autocommit=autocommit
    )
    yield conn
    if not autocommit:
        await conn.commit()   # skipped for autocommit connections
```

### Step 2 — Add `exec_sql_dml` (alphabetically: after `exec_sql`, before `exec_sql_object`)

Signature (all snake_case, fully typed):
```python
async def exec_sql_dml(
    db_name: str | None,
    schema: str = "public",
    sql: str | None = None,
    sql_args: dict | None = None,
) -> int:
```

Behaviour:
- Validate `sql` is provided; raise `ValueError(AppMessages.DATABASE_QUERY_FAILED)` if not
- Open connection via `_open_db_connection(..., autocommit=True)` directly
  (uses service settings when `db_name` is given, client settings otherwise)
- Set search path with `pgsql.SQL("SET search_path TO {}").format(pgsql.Identifier(schema))`
- Execute `sql` with `sql_args`
- Return `cur.rowcount`
- On `psycopg.OperationalError` → log + raise `DatabaseException(DATABASE_CONNECTION_FAILED)`
- On any other exception → log + raise `DatabaseException(DATABASE_QUERY_FAILED)`

---

## Workflow

```
exec_sql_dml(db_name, schema, sql, sql_args)
        │
        ├── validate sql present
        │       └── missing → ValueError(DATABASE_QUERY_FAILED)
        │
        ├── _open_db_connection(..., autocommit=True)
        │       ├── service settings  when db_name is provided
        │       └── client settings   when db_name is None
        │
        ├── cursor.execute  SET search_path TO <schema>   [pgsql.Identifier — safe]
        │
        ├── cursor.execute  sql, sql_args                 [parameterised — safe]
        │       ├── OperationalError → log + DatabaseException(CONNECTION_FAILED)
        │       └── Exception        → log + DatabaseException(QUERY_FAILED)
        │
        └── return cur.rowcount  (int)
```

---

## Files changed

| File | Change |
|------|--------|
| `app/db/psycopg_driver.py` | Step 1: add `autocommit` param to `_open_db_connection` |
| `app/db/psycopg_driver.py` | Step 2: insert `exec_sql_dml` after `exec_sql` |
