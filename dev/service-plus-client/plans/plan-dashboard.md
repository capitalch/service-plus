# Plan: Implement Real Data Population for Super Admin Dashboard

## Context

- Dashboard has two components needing real data: `StatsCards` and `ClientOverviewTable`
- **Two separate data sources:**
  - `service_plus_client` DB, `public` schema → `client` table (top-level tenants) → client stats
  - `service_plus_demo` DB, `security` schema → `bu` + `user` + `user_bu_role` tables → BU/admin stats + BU list
- Transport: `genericQuery(db_name, value)` GraphQL query
  - `value` = `encodeURIComponent(JSON.stringify({ buCode, sqlId, sqlArgs }))`
  - Server routes by `sqlId` to correct SQL + schema + DB
- Server resolver currently echoes health data — must be made real
- Redux slice initialized with dummy data — must be replaced with API-driven state

### Stats Cards (9 total after this change)

| Group | Cards | Source DB / Schema |
|-------|-------|-------------------|
| Clients | Total Clients, Active Clients, Inactive Clients | `service_plus_client` / `public` |
| BUs | Total BUs, Active BUs, Inactive BUs | `service_plus_demo` / `security` |
| Admin Users | Total Admin Users, Active Admin Users, Inactive Admin Users | `service_plus_demo` / `security` |

---

## Workflow

```
Step 1 — Server: Add service_db_name to config.py
         ↓
Step 2 — Server: New app/db/sql_super_admin.py (3 SQL queries)
         ↓
Step 3 — Server: New app/db/sql_registry.py (SQL routing map)
         ↓
Step 4 — Server: Update query.py resolver (decode value, lookup registry, exec_sql)
         ↓
Step 5 — Client: Add GET_CLIENT_STATS + GET_DASHBOARD_STATS to sql-map.ts
         ↓
Step 6 — Client: Update StatsType + super-admin-slice.ts
         ↓
Step 7 — Client: Update stats-cards.tsx (3 new client stat cards)
         ↓
Step 8 — Client: Update super-admin-dashboard-page.tsx
                 (load 3 queries in parallel on mount, dispatch, remove test button)
```

---

## Steps

### Step 1 — Server: Add `service_db_name` to `app/config.py`

Add to `Settings` class:
```python
service_db_name: str = Field(default='service_plus_demo', description="Default service database name")
```

---

### Step 2 — Server: Create `app/db/sql_super_admin.py`

New class `SqlSuperAdmin` with three SQL queries.

**`GET_ALL_CLIENTS`** — BU list with per-BU active/inactive admin counts (security schema):
```sql
SELECT
    b.id,
    b.code,
    b.created_at,
    b.is_active,
    b.name,
    b.updated_at,
    COUNT(CASE WHEN u.is_active = true  AND ubr.is_active = true  THEN 1 END) AS "activeAdminCount",
    COUNT(CASE WHEN (u.is_active = false OR ubr.is_active = false) AND u.id IS NOT NULL THEN 1 END) AS "inactiveAdminCount"
FROM bu b
LEFT JOIN user_bu_role ubr ON ubr.bu_id = b.id
LEFT JOIN "user" u ON u.id = ubr.user_id
GROUP BY b.id, b.code, b.created_at, b.is_active, b.name, b.updated_at
ORDER BY b.name
```

**`GET_DASHBOARD_STATS`** — BU + admin user KPI row (security schema):
```sql
SELECT
    COUNT(DISTINCT b.id)                                                                        AS "totalBu",
    COUNT(DISTINCT CASE WHEN b.is_active = true  THEN b.id END)                                AS "activeBu",
    COUNT(DISTINCT CASE WHEN b.is_active = false THEN b.id END)                                AS "inactiveBu",
    COUNT(DISTINCT u.id)                                                                        AS "totalAdminUsers",
    COUNT(DISTINCT CASE WHEN u.is_active = true  AND ubr.is_active = true  THEN u.id END)      AS "activeAdminUsers",
    COUNT(DISTINCT CASE WHEN u.is_active = false OR  ubr.is_active = false THEN u.id END)      AS "inactiveAdminUsers"
FROM bu b
LEFT JOIN user_bu_role ubr ON ubr.bu_id = b.id
LEFT JOIN "user" u ON u.id = ubr.user_id
```

**`GET_CLIENT_STATS`** — top-level client/tenant counts (client DB, public schema):
```sql
SELECT
    COUNT(*)                                                 AS "totalClients",
    COUNT(CASE WHEN is_active = true  THEN 1 END)           AS "activeClients",
    COUNT(CASE WHEN is_active = false THEN 1 END)           AS "inactiveClients"
FROM client
```

---

### Step 3 — Server: Create `app/db/sql_registry.py`

```python
SQL_REGISTRY: dict[str, dict] = {
    "GET_ALL_CLIENTS": {
        "db_name_source": "service_default",   # uses settings.service_db_name
        "schema": "security",
        "sql": SqlSuperAdmin.GET_ALL_CLIENTS,
    },
    "GET_CLIENT_STATS": {
        "db_name_source": "client_db",          # uses get_client_db_connection() (db_name=None)
        "schema": "public",
        "sql": SqlSuperAdmin.GET_CLIENT_STATS,
    },
    "GET_DASHBOARD_STATS": {
        "db_name_source": "service_default",   # uses settings.service_db_name
        "schema": "security",
        "sql": SqlSuperAdmin.GET_DASHBOARD_STATS,
    },
}
```

`db_name_source` values:
- `"service_default"` → `settings.service_db_name`
- `"client_db"` → `None` (routes to `get_client_db_connection()`)
- `"client"` → use the caller-supplied `db_name` param (for future BU-scoped queries)

---

### Step 4 — Server: Update `app/graphql/resolvers/query.py`

Replace health-echo stub in `resolve_generic_query`:

```python
import json
from urllib.parse import unquote
from app.db.database import exec_sql
from app.db.sql_registry import SQL_REGISTRY
from app.config import settings

@query.field("genericQuery")
async def resolve_generic_query(_, info, db_name="", value="") -> Any:
    try:
        # 1. Decode value param
        parsed = json.loads(unquote(value))
        sql_id = parsed.get("sqlId", "")
        sql_args = parsed.get("sqlArgs") or {}

        # 2. Lookup SQL registry
        entry = SQL_REGISTRY.get(sql_id)
        if not entry:
            raise GraphQLException(message=AppMessages.INVALID_INPUT)

        # 3. Resolve DB name
        source = entry["db_name_source"]
        resolved_db = (
            settings.service_db_name if source == "service_default"
            else None if source == "client_db"
            else db_name  # "client" — use caller-supplied
        )

        # 4. Execute SQL
        result = await exec_sql(
            db_name=resolved_db,
            schema=entry["schema"],
            sql=entry["sql"],
            sql_args=sql_args,
        )
        return result

    except GraphQLException:
        raise
    except Exception as e:
        logger.error(f"Generic query failed: {str(e)}")
        raise GraphQLException(message=AppMessages.INTERNAL_SERVER_ERROR, extensions={"details": str(e)})
```

---

### Step 5 — Client: Update `src/constants/sql-map.ts`

```ts
export const SQL_MAP = {
    GET_ALL_CLIENTS: "GET_ALL_CLIENTS",
    GET_CLIENT_STATS: "GET_CLIENT_STATS",
    GET_DASHBOARD_STATS: "GET_DASHBOARD_STATS",
}
```

---

### Step 6 — Client: Update `StatsType` and `super-admin-slice.ts`

**`src/features/super-admin/types/index.ts`** — add 3 fields to `StatsType`:
```ts
type StatsType = {
    activeAdminUsers: number;
    activeBu: number;
    activeClients: number;       // new
    inactiveAdminUsers: number;
    inactiveBu: number;
    inactiveClients: number;     // new
    totalAdminUsers: number;
    totalBu: number;
    totalClients: number;        // new
}
```

**`src/features/super-admin/store/super-admin-slice.ts`**:
- Remove all dummy data imports and usages
- Initial state:
  - `clients: []`
  - `stats: { activeAdminUsers: 0, activeBu: 0, activeClients: 0, inactiveAdminUsers: 0, inactiveBu: 0, inactiveClients: 0, totalAdminUsers: 0, totalBu: 0, totalClients: 0 }`
  - `isLoading: true`
- Add `setIsLoading` reducer
- Add `selectIsLoading` selector

---

### Step 7 — Client: Update `src/features/super-admin/components/stats-cards.tsx`

Add 3 new stat card items for clients (prepended before BU cards — logical order: Clients → BUs → Admins):

```ts
{
    accent: "text-blue-600",
    icon: Building2Icon,      // or NetworkIcon
    iconBg: "bg-blue-100",
    label: "Total Clients",
    value: stats.totalClients,
},
{
    accent: "text-emerald-600",
    icon: CheckCircle2Icon,
    iconBg: "bg-emerald-100",
    label: "Active Clients",
    value: stats.activeClients,
},
{
    accent: "text-slate-500",
    icon: MinusCircleIcon,
    iconBg: "bg-slate-100",
    label: "Inactive Clients",
    value: stats.inactiveClients,
},
```

Update grid: `grid-cols-3 sm:grid-cols-3 lg:grid-cols-9` — or keep 6-col and let it wrap to 2 rows (9 cards, 3 per row on mobile, 9 on xl):
- Use `grid-cols-3 gap-4 lg:grid-cols-9`

---

### Step 8 — Client: Update `src/features/super-admin/pages/super-admin-dashboard-page.tsx`

- Add `src/constants/app-constants.ts` with:
  ```ts
  export const APP_CONSTANTS = {
      SUPER_ADMIN_BU_CODE: "SA",
      SUPER_ADMIN_DB: "service_plus_demo",
  }
  ```
- Remove test button and `handleTestGraphQl`
- Add `useEffect` to fire **3 parallel queries** on mount via `loadDashboardData`:
  1. `GET_ALL_CLIENTS` (`db_name = APP_CONSTANTS.SUPER_ADMIN_DB`) → parse as `ClientType[]` → `dispatch(setClients(...))`
  2. `GET_DASHBOARD_STATS` (`db_name = APP_CONSTANTS.SUPER_ADMIN_DB`) → parse `result[0]` → partial `StatsType` (BU + admin fields)
  3. `GET_CLIENT_STATS` (`db_name = ""`) → parse `result[0]` → partial `StatsType` (client fields)
  4. Merge both partial stats → `dispatch(setStats(merged))`
  5. `dispatch(setIsLoading(false))`
- Show loading skeleton while `isLoading === true`
- On any error: `toast.error(MESSAGES.ERROR_SERVER)` + `dispatch(setIsLoading(false))`
- All functions sorted alphabetically above `return`

---

## Data Flow

```
SuperAdminDashboard mounts
    → useEffect → loadDashboardData()
        ┌─ executeGenericQuery(GET_ALL_CLIENTS)   ─┐
        ├─ executeGenericQuery(GET_DASHBOARD_STATS) ┤ all 3 parallel (Promise.all)
        └─ executeGenericQuery(GET_CLIENT_STATS)  ─┘
              ↓
        dispatch setClients(clientRows)
        dispatch setStats({ ...buStats, ...clientStats })
        dispatch setIsLoading(false)
              ↓
        StatsCards      → re-renders (9 cards: 3 client + 3 BU + 3 admin)
        ClientOverview  → re-renders (real BU rows)
```
