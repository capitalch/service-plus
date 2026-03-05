# Plan: Unique Code/Name Validation + Complete genericQuery

## Objective
1. Complete `resolve_generic_query_helper` so it actually executes SQL via `sqlId` lookup.
2. Add `CHECK_CLIENT_CODE_EXISTS` and `CHECK_CLIENT_NAME_EXISTS` SQL to `SqlAuth`.
3. Add matching keys to client `SQL_MAP`.
4. Add async blur-based uniqueness validation for `code` and `name` in `AddClientDialog`.

---

## Workflow

```
User types code/name → onBlur
         │
         ▼
useLazyQuery(GRAPHQL_MAP.genericQuery)
  variables: { db_name:"", schema:"public",
               value: encodeObj({ sqlId, sqlArgs:{ code/name } }) }
         │
         ▼
Server resolve_generic_query_helper(db_name="", schema, value)
  → unquote(value) → json.loads → { sqlId, sqlArgs }
  → SQL_REGISTRY[sqlId] → SQL string
  → exec_sql(None, "public", sql, sqlArgs)
  → returns { exists: true/false }
         │
         ▼
Client: if exists → setError("code"/"name", { message: "..." })
        else     → clearErrors("code"/"name")
```

---

## Files Affected

| File | Change |
|------|--------|
| `service-plus-server/app/db/sql_auth.py` | Add `CHECK_CLIENT_CODE_EXISTS`, `CHECK_CLIENT_NAME_EXISTS` |
| `service-plus-server/app/graphql/resolvers/query_helper.py` | Complete `resolve_generic_query_helper`: decode value, lookup SQL, execute, return result |
| `service-plus-client/src/constants/sql-map.ts` | Add `CHECK_CLIENT_CODE_EXISTS`, `CHECK_CLIENT_NAME_EXISTS` |
| `service-plus-client/src/features/super-admin/components/add-client-dialog.tsx` | Add `useLazyQuery` for uniqueness checks; onBlur handlers for code and name |
| `service-plus-client/src/constants/messages.ts` | Add `ERROR_CLIENT_CODE_EXISTS`, `ERROR_CLIENT_NAME_EXISTS` |

---

## Steps

### Step 1 — `sql_auth.py`: add two uniqueness-check queries

```python
CHECK_CLIENT_CODE_EXISTS = """
    with "p_code" as (values(%(code)s::text))
    -- with "p_code" as (values('ACME01'::text)) -- Test line
    SELECT EXISTS(
        SELECT 1 FROM public.client
        WHERE LOWER(code) = LOWER((table "p_code"))
    ) AS exists
"""

CHECK_CLIENT_NAME_EXISTS = """
    with "p_name" as (values(%(name)s::text))
    -- with "p_name" as (values('Acme Corp'::text)) -- Test line
    SELECT EXISTS(
        SELECT 1 FROM public.client
        WHERE LOWER(name) = LOWER((table "p_name"))
    ) AS exists
"""
```

### Step 2 — `query_helper.py`: complete `resolve_generic_query_helper`

- Import `json`, `unquote`, `ValidationException`, `AppMessages`.
- Define a `SQL_REGISTRY` dict mapping each `SQL_MAP` key string → `SqlAuth` SQL constant.
- Decode `value` (URL-encoded JSON), parse `sqlId` and `sqlArgs`.
- Validate `sqlId` exists in registry; raise `ValidationException` if not.
- Call `exec_sql(db_name_arg, schema, sql, sql_args)` where `db_name_arg = db_name or None`.
- Return `rows[0]` if rows, else `{}`.

```python
SQL_REGISTRY: dict[str, str] = {
    "CHECK_CLIENT_CODE_EXISTS": SqlAuth.CHECK_CLIENT_CODE_EXISTS,
    "CHECK_CLIENT_NAME_EXISTS": SqlAuth.CHECK_CLIENT_NAME_EXISTS,
    "GET_ALL_CLIENTS":          SqlAuth.GET_ALL_CLIENTS_ON_CRITERIA,
}

async def resolve_generic_query_helper(db_name, schema="public", value=""):
    value_string = unquote(value)
    params = json.loads(value_string)
    sql_id   = params.get("sqlId", "")
    sql_args = params.get("sqlArgs", {})
    sql = SQL_REGISTRY.get(sql_id)
    if not sql:
        raise ValidationException(AppMessages.INVALID_INPUT, {"detail": f"Unknown sqlId: {sql_id}"})
    db_name_arg = db_name if db_name else None
    rows = await exec_sql(db_name_arg, schema, sql, sql_args)
    return rows[0] if rows else {}
```

### Step 3 — `sql-map.ts`: add new keys

```ts
export const SQL_MAP = {
    CHECK_CLIENT_CODE_EXISTS: "CHECK_CLIENT_CODE_EXISTS",
    CHECK_CLIENT_NAME_EXISTS: "CHECK_CLIENT_NAME_EXISTS",
    GET_ALL_CLIENTS:          "GET_ALL_CLIENTS",
}
```

### Step 4 — `messages.ts`: add error messages

```ts
ERROR_CLIENT_CODE_EXISTS: 'This code is already in use.',
ERROR_CLIENT_NAME_EXISTS: 'This name is already in use.',
```

### Step 5 — `add-client-dialog.tsx`: add async blur validation

- Add `useLazyQuery(GRAPHQL_MAP.genericQuery)` → `checkUnique`.
- Add `onBlur` handler for `code` input: call `checkUnique` with `sqlId: SQL_MAP.CHECK_CLIENT_CODE_EXISTS`, `sqlArgs: { code }`. If `data.genericQuery.exists` → `setError("code", ...)` else `clearErrors("code")`.
- Add `onBlur` handler for `name` input: same pattern with `CHECK_CLIENT_NAME_EXISTS` and `sqlArgs: { name }`.
- Both handlers skip the API call if the field has a prior sync validation error.
- Add `checkingUnique` loading state to disable submit while checks are in flight.
