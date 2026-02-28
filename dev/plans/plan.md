# Plan: Super Admin Dashboard – Real Data Population

## Objective
Replace dummy data in the Super Admin dashboard with live data fetched from:
- `service_plus_client` database (client table) → client stats
- Each client's service database (security schema) → BU and admin-user stats

---

## Workflow

```
SA Dashboard Page loads
  │
  ├─► [Client] Apollo useLazyQuery → superAdminDashboardStats (GraphQL)
  │                                   (Authorization header with token)
  │
  ├─► [Server] Ariadne resolver: resolve_super_admin_dashboard_stats()
  │     ├─ exec_sql(db_name=None) → service_plus_client.public.client → client counts
  │     ├─ fetch all db_names from client table (where db_name IS NOT NULL)
  │     └─ for each db_name:
  │           exec_sql(db_name) against security schema
  │             ├─ bu table → BU counts
  │             └─ user table → admin-user counts
  │           aggregate totals
  │
  └─► [Client] Response → dispatch setStats() → Redux → StatsCards re-renders with real data
```

---

## Steps

### Step 1 — Server: Add SQL queries to `app/db/app_queries.py`

Add three static methods to `AppQueries`:

**1a. `get_client_db_names(conn)`**
Query `service_plus_client` for all active/inactive clients and their `db_name`.
```sql
-- SQL pattern (CTE-style per server CLAUDE.md)
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    id,
    code,
    name,
    is_active,
    db_name,
    created_at,
    updated_at
FROM public.client
ORDER BY name
```

**1b. `get_client_stats(conn)`**
Aggregate client counts in `service_plus_client`.
```sql
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    COUNT(*)                          AS total_clients,
    COUNT(*) FILTER (WHERE is_active) AS active_clients,
    COUNT(*) FILTER (WHERE NOT is_active) AS inactive_clients
FROM public.client
```

**1c. `get_bu_user_stats(conn)`**
Run against each service DB (security schema). Returns BU counts and admin-user counts.
```sql
with "dummy" as (values(1::int))
-- with "dummy" as (values(1::int))  -- Test line
SELECT
    (SELECT COUNT(*)                          FROM security.bu)                    AS total_bu,
    (SELECT COUNT(*) FILTER (WHERE is_active) FROM security.bu)                   AS active_bu,
    (SELECT COUNT(*) FILTER (WHERE NOT is_active) FROM security.bu)               AS inactive_bu,
    (SELECT COUNT(*)                          FROM security."user" WHERE is_admin) AS total_admin_users,
    (SELECT COUNT(*) FILTER (WHERE is_active AND is_admin) FROM security."user")  AS active_admin_users,
    (SELECT COUNT(*) FILTER (WHERE NOT is_active AND is_admin) FROM security."user") AS inactive_admin_users
```

---

### Step 2 — Server: Update `app/graphql/schema.graphql`

Add a dedicated `superAdminDashboardStats` query returning a typed scalar.
```graphql
type Query {
    genericQuery(db_name: String!, value: String!): Generic
    superAdminDashboardStats: Generic
}
```
*(Continue using the `Generic` scalar for flexibility; the resolver returns a plain dict.)*

---

### Step 3 — Server: Add resolver in `app/graphql/resolvers/query.py`

Add `resolve_super_admin_dashboard_stats()`:
1. Open connection to `service_plus_client` (via `get_client_db_connection()`).
2. Call `AppQueries.get_client_stats()` → get `total_clients`, `active_clients`, `inactive_clients`.
3. Call `AppQueries.get_client_db_names()` → list of `db_name` values (filter out NULL).
4. For each `db_name`, open a service DB connection and call `AppQueries.get_bu_user_stats()`.
5. Accumulate BU and user counts across all service DBs.
6. Return a single dict with all nine stats fields:
   ```python
   {
       "totalClients": ..., "activeClients": ..., "inactiveClients": ...,
       "totalBu": ..., "activeBu": ..., "inactiveBu": ...,
       "totalAdminUsers": ..., "activeAdminUsers": ..., "inactiveAdminUsers": ...
   }
   ```
7. Wrap in try/except with `GraphQLException` on failure.

---

### Step 4 — Client: Add GraphQL definition to `src/constants/graphql-map.ts`

Add `superAdminDashboardStats` query:
```ts
superAdminDashboardStats: gql`
    query SuperAdminDashboardStats {
        superAdminDashboardStats
    }
`
```

---

### Step 5 — Client: Add message key to `src/constants/messages.ts`

Add a new key for the dashboard load error (if not already present):
```ts
ERROR_DASHBOARD_LOAD: "Failed to load dashboard data."
```

---

### Step 6 — Client: Update `src/features/super-admin/pages/super-admin-dashboard-page.tsx`

- Replace the test-button `useLazyQuery` with a `useQuery` for `superAdminDashboardStats`.
- On successful data load, dispatch `setStats(data.superAdminDashboardStats)` to Redux.
- Show a `toast.error(MESSAGES.ERROR_DASHBOARD_LOAD)` on error.
- Remove the test "Test graphql" button and its handler.
- Add a loading skeleton or spinner while data is fetching (use shadcn Skeleton or a simple spinner).

---

### Step 7 — Client: Update Redux slice `src/features/super-admin/store/super-admin-slice.ts`

- Change `initialState.stats` from `dummyStats` to an empty/zero `StatsType`:
  ```ts
  { totalClients:0, activeClients:0, inactiveClients:0, totalBu:0, activeBu:0, inactiveBu:0,
    totalAdminUsers:0, activeAdminUsers:0, inactiveAdminUsers:0 }
  ```
- Remove the import of `dummyStats` from the slice (keep other dummy imports for now if still needed).

---

### Step 8 — Verification

- Run the server and confirm `superAdminDashboardStats` returns correct JSON in the GraphQL playground.
- Run the client and confirm stats cards display real counts.
- Confirm error toast appears if server is unreachable.
