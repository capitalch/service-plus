# Plan: Total Strategy — Real Data for Super Admin Dashboard

---

## Data Sources & Mapping

| Dashboard Stat Group | Source Database | Schema | Table(s) |
|----------------------|----------------|--------|----------|
| Client counts (totalClients, activeClients, inactiveClients) | `service_plus_client` | `public` | `client` |
| BU counts (totalBu, activeBu, inactiveBu) | each client's service DB e.g. `service_plus_demo` | `security` | `bu` |
| Admin User counts (totalAdminUsers, activeAdminUsers, inactiveAdminUsers) | each client's service DB | `security` | `user` |
| ClientOverviewTable rows | each client's service DB | `security` | `bu` + `user_bu_role` |

> **Note:** For the current demo setup, all BU and user data lives in `service_plus_demo`.
> The client's `db_name` column in `service_plus_client.public.client` identifies which service DB to query.

---

## Workflow

```
SA Dashboard mounts
    │
    ├─► Query A: GET_CLIENT_STATS  (no db_name → service_plus_client, public schema)
    │       └─► Returns: totalClients, activeClients, inactiveClients
    │
    ├─► Query B: GET_DASHBOARD_STATS  (db_name = service_plus_demo, security schema)
    │       └─► Returns: totalBu, activeBu, inactiveBu,
    │                    totalAdminUsers, activeAdminUsers, inactiveAdminUsers
    │
    └─► Query C: GET_ALL_CLIENTS  (db_name = service_plus_demo, security schema)
            └─► Returns: list of BU rows with admin counts → ClientOverviewTable

    All 3 fire in parallel via Promise.all
          ↓
    Merge stats from A + B → dispatch setStats()
    dispatch setClients() from C
    dispatch setIsLoading(false)
          ↓
    StatsCards + ClientOverviewTable render with real data
```

---

## SQL Queries (with CTE pattern per server conventions)

### SQL-A: GET_CLIENT_STATS
**Runs on:** `service_plus_client` (client DB) | Schema: `public`

```sql
-- GET_CLIENT_STATS
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    COUNT(*)                               AS total_clients,
    COUNT(*) FILTER (WHERE is_active)      AS active_clients,
    COUNT(*) FILTER (WHERE NOT is_active)  AS inactive_clients
FROM client
```

Returns 1 row:
```json
{ "total_clients": 6, "active_clients": 4, "inactive_clients": 2 }
```

---

### SQL-B: GET_DASHBOARD_STATS
**Runs on:** service DB (e.g. `service_plus_demo`) | Schema: `security`

```sql
-- GET_DASHBOARD_STATS
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    (SELECT COUNT(*)                              FROM bu)                                     AS total_bu,
    (SELECT COUNT(*) FILTER (WHERE is_active)     FROM bu)                                     AS active_bu,
    (SELECT COUNT(*) FILTER (WHERE NOT is_active) FROM bu)                                     AS inactive_bu,
    (SELECT COUNT(*)                              FROM "user" WHERE is_admin = true)            AS total_admin_users,
    (SELECT COUNT(*) FILTER (WHERE is_active)     FROM "user" WHERE is_admin = true)            AS active_admin_users,
    (SELECT COUNT(*) FILTER (WHERE NOT is_active) FROM "user" WHERE is_admin = true)            AS inactive_admin_users
```

Returns 1 row:
```json
{
  "total_bu": 4, "active_bu": 3, "inactive_bu": 1,
  "total_admin_users": 8, "active_admin_users": 6, "inactive_admin_users": 2
}
```

---

### SQL-C: GET_ALL_CLIENTS
**Runs on:** service DB (e.g. `service_plus_demo`) | Schema: `security`

```sql
-- GET_ALL_CLIENTS
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    b.id,
    b.code,
    b.is_active,
    b.created_at,
    b.name,
    b.updated_at,
    COUNT(ubr.user_id) FILTER (WHERE ubr.is_active = true)  AS "activeAdminCount",
    COUNT(ubr.user_id) FILTER (WHERE ubr.is_active = false) AS "inactiveAdminCount"
FROM bu b
LEFT JOIN user_bu_role ubr ON ubr.bu_id = b.id
GROUP BY b.id, b.code, b.is_active, b.created_at, b.name, b.updated_at
ORDER BY b.name
```

Returns N rows as `ClientType[]`.

---

## Server-Side Implementation Steps

### Step 1 — `app/db/app_queries.py`
Add SQL registry dict and three static methods:

```python
SQL_REGISTRY = {
    "GET_ALL_CLIENTS":    { "sql": "<SQL-C above>", "db": "service", "schema": "security" },
    "GET_CLIENT_STATS":   { "sql": "<SQL-A above>", "db": "client",  "schema": "public"   },
    "GET_DASHBOARD_STATS":{ "sql": "<SQL-B above>", "db": "service", "schema": "security" },
}
```

Add `execute_by_sql_id(db_name, sql_id, sql_args)`:
1. Look up `SQL_REGISTRY[sql_id]`
2. If `db == "client"` → call `exec_sql(db_name=None, schema="public", sql=...)`
3. If `db == "service"` → call `exec_sql(db_name=db_name, schema="security", sql=...)`
4. Return rows

---

### Step 2 — `app/graphql/resolvers/query.py`
Update `resolve_generic_query` to actually execute SQL:

1. URL-decode and JSON-parse the `value` param → extract `sqlId`, `buCode`, `sqlArgs`
2. Call `AppQueries.execute_by_sql_id(db_name, sqlId, sqlArgs or {})`
3. Return result list (Ariadne serialises via `Generic` scalar)
4. Keep `GraphQLException` on all failure paths

---

### Step 3 — `app/exceptions.py`
Add to `AppMessages`:
```python
SQL_ID_NOT_FOUND = "SQL ID not found in registry"
```

---

## Client-Side Implementation Steps

### Step 4 — `src/constants/sql-map.ts`
```ts
export const SQL_MAP = {
    GET_ALL_CLIENTS:     "GET_ALL_CLIENTS",
    GET_CLIENT_STATS:    "GET_CLIENT_STATS",
    GET_DASHBOARD_STATS: "GET_DASHBOARD_STATS",
}
```

### Step 5 — `src/constants/app-constants.ts` (new file)
```ts
export const APP_CONSTANTS = {
    SUPER_ADMIN_BU_CODE: "SA",
    SUPER_ADMIN_DB:      "service_plus_demo",
}
```

### Step 6 — `src/constants/messages.ts`
Add:
```ts
ERROR_DASHBOARD_LOAD: "Failed to load dashboard data.",
```

### Step 7 — `src/features/super-admin/store/super-admin-slice.ts`
- Add `isLoading: boolean` to state (initial: `true`)
- Add `setIsLoading` reducer and `selectIsLoading` selector
- Change `initialState.stats` to all-zero `StatsType` (remove `dummyStats`)

### Step 8 — `src/features/super-admin/pages/super-admin-dashboard-page.tsx`
- Remove test button and `handleTestGraphQl`
- Add `useEffect` on mount calling `loadDashboardData()`:
  ```
  Promise.all([
    executeGenericQuery(GET_CLIENT_STATS, db_name=""),
    executeGenericQuery(GET_DASHBOARD_STATS, db_name=SUPER_ADMIN_DB),
    executeGenericQuery(GET_ALL_CLIENTS, db_name=SUPER_ADMIN_DB),
  ])
  → merge stats → dispatch setStats(), setClients(), setIsLoading(false)
  ```
- Show `<Skeleton>` cards while `isLoading === true`
- `toast.error(MESSAGES.ERROR_DASHBOARD_LOAD)` on any error

---

## Key Points

- **GET_CLIENT_STATS** passes `db_name=""` (empty string) → server interprets empty string as → use client DB (`service_plus_client`)
- **GET_DASHBOARD_STATS** and **GET_ALL_CLIENTS** pass `db_name="service_plus_demo"` → server uses service DB
- `buCode` is set to `APP_CONSTANTS.SUPER_ADMIN_BU_CODE` ("SA") for all SA queries (server can use this for future schema routing)
- All three queries use the existing `genericQuery` GQL endpoint — no new GraphQL types needed
- The `Generic` scalar returns `JSON` so the client casts `res.data.genericQuery` to the appropriate TypeScript type
