# Plan: Audit Logs Page – Full Server Log Visibility

## Objective
Connect the existing Audit Logs page to real server data. Persist and display two categories of logs:
1. **Audit Events** – structured business events (Client Created, Login, Admin Added, etc.)
2. **Server Logs** – raw Python logger output at all levels (INFO, DEBUG, WARNING, ERROR)

Both are stored in the `service_plus_client` database so the Super Admin can see platform-wide logs across all clients.

---

## Workflow

```
Server Action / Logger call
        │
        ▼
┌───────────────────┐     ┌──────────────────────┐
│  audit_log table  │     │  server_log table     │
│  (business events)│     │  (app log records)    │
└───────────────────┘     └──────────────────────┘
        │                          │
        └──────────┬───────────────┘
                   ▼
          GraphQL Queries
    (auditLogs / serverLogs)
                   │
                   ▼
        Redux superAdminSlice
    (activityLog / serverLogs)
                   │
                   ▼
        AuditLogsPage (two tabs)
    ┌─────────────┬────────────────┐
    │ Audit Events│  Server Logs   │
    │ (action     │  (INFO/DEBUG/  │
    │  filter)    │  WARNING/ERROR)│
    └─────────────┴────────────────┘
```

---

## Step 1 – Database: Add Tables to `service_plus_client`

File: `service-plus-server/app/db/service_plus_client.sql`

Add two new tables to the `public` schema:

**`audit_log`** – structured business events
```sql
CREATE TABLE public.audit_log (
    id           BIGSERIAL PRIMARY KEY,
    action       TEXT NOT NULL,          -- e.g. 'Client Created', 'Login'
    actor_email  TEXT,
    actor_id     INTEGER,
    actor_name   TEXT,
    details      JSONB,                  -- optional extra payload
    ip_address   TEXT,
    target_name  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_action     ON public.audit_log (action);
```

**`server_log`** – raw Python logger records
```sql
CREATE TABLE public.server_log (
    id            BIGSERIAL PRIMARY KEY,
    level         TEXT NOT NULL,         -- INFO | DEBUG | WARNING | ERROR
    message       TEXT NOT NULL,
    module        TEXT,
    func_name     TEXT,
    line_no       INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_server_log_created_at ON public.server_log (created_at DESC);
CREATE INDEX idx_server_log_level      ON public.server_log (level);
```

Also update `service-plus-client/src/types/db-schema-client.ts` with TypeScript types for both tables.

---

## Step 2 – Server: DB Logging Handler

File: `service-plus-server/app/logger.py`

- Add a `DatabaseLogHandler(logging.Handler)` class.
- On `emit()`, insert a row into `public.server_log` via a direct psycopg2 connection to `service_plus_client`.
- Handle DB errors silently (fall back to console only) so a DB failure never breaks the app.
- Register this handler on the root logger at startup (alongside the existing console handler).
- Only persist records at WARNING level and above by default; make the threshold configurable via an environment variable `LOG_DB_LEVEL` (default `WARNING`). This keeps noise low but allows DEBUG visibility when needed.

---

## Step 3 – Server: Audit Event Service

New file: `service-plus-server/app/services/audit_service.py`

- Function `log_audit_event(action, actor_name, actor_email, actor_id, target_name, ip_address, details)`.
- Inserts a row into `public.audit_log` in `service_plus_client`.
- Called from mutations/endpoints after successful operations (not inside try blocks where rollback could suppress them).

Instrument the following existing server locations:

| Location | Event |
|---|---|
| `auth_router.py` – login success | `Login` |
| `mutation.py` – `createAdminUser` | `Admin Added` |
| `mutation.py` – `setAdminUserActive` (deactivate) | `Admin Deactivated` |
| `mutation.py` – `createServiceDb` | `Client Created` |
| `mutation.py` – `deleteClient` / `dropDatabase` | `Client Disabled` |
| `mutation.py` – any settings mutation | `Settings Changed` |

---

## Step 4 – Server: GraphQL Schema & Resolvers

File: `service-plus-server/app/graphql/schema.graphql`

Add types and queries:
```graphql
type AuditLogEntry {
    action:     String!
    actorEmail: String
    actorId:    Int
    actorName:  String
    createdAt:  String!
    details:    String       # serialised JSON
    id:         ID!
    ipAddress:  String
    targetName: String
}

type ServerLogEntry {
    createdAt: String!
    funcName:  String
    id:        ID!
    level:     String!
    lineNo:    Int
    message:   String!
    module:    String
}

type AuditLogsResult {
    entries:    [AuditLogEntry!]!
    totalCount: Int!
}

type ServerLogsResult {
    entries:    [ServerLogEntry!]!
    totalCount: Int!
}

extend type Query {
    auditLogs(action: String, limit: Int, offset: Int): AuditLogsResult!
    serverLogs(level: String, limit: Int, offset: Int): ServerLogsResult!
}
```

File: `service-plus-server/app/graphql/resolvers/query.py`

Add resolvers `resolve_audit_logs` and `resolve_server_logs`:
- Both accept optional `action`/`level`, `limit` (default 50), `offset` (default 0) for pagination.
- Query `service_plus_client` DB.
- Protected: require authenticated user with `userType == 'S'` (Super Admin only).

---

## Step 5 – Client: Types

File: `service-plus-client/src/features/super-admin/types/index.ts`

Extend / add types:
```typescript
// Expand ActivityLogItemType to include optional details
export type ActivityLogItemType = {
    action:     ActivityActionType;
    actorEmail: string;
    actorId:    number | null;
    actorName:  string;
    details:    string | null;
    id:         string;
    ipAddress:  string | null;
    targetName: string;
    timestamp:  string;
};

// New: server log types
export type ServerLogLevelType = "DEBUG" | "ERROR" | "INFO" | "WARNING";

export type ServerLogItemType = {
    createdAt: string;
    funcName:  string | null;
    id:        string;
    level:     ServerLogLevelType;
    lineNo:    number | null;
    message:   string;
    module:    string | null;
};

export type ServerLogFilterType = ServerLogLevelType | "All";
```

File: `service-plus-client/src/types/db-schema-client.ts`

Add TypeScript types for `AuditLogType` and `ServerLogType` matching the DB columns.

---

## Step 6 – Client: GraphQL Queries

New file: `service-plus-client/src/features/super-admin/graphql/audit-queries.ts`

```typescript
export const AUDIT_LOGS_QUERY = gql`...`   // auditLogs(action, limit, offset)
export const SERVER_LOGS_QUERY = gql`...`  // serverLogs(level, limit, offset)
```

---

## Step 7 – Client: API Service

New file: `service-plus-client/src/features/super-admin/services/audit-log-service.ts`

- `fetchAuditLogs(action?, limit?, offset?)` – calls `AUDIT_LOGS_QUERY` via `apolloClient.query()`
- `fetchServerLogs(level?, limit?, offset?)` – calls `SERVER_LOGS_QUERY` via `apolloClient.query()`
- Both return typed results; errors handled and thrown for callers.

---

## Step 8 – Client: Redux Slice

File: `service-plus-client/src/features/super-admin/store/super-admin-slice.ts`

Add to state and reducers:
```typescript
serverLogs: ServerLogItemType[]        // new
serverLogsTotalCount: number           // new
auditLogsTotalCount: number            // new (for pagination)
```

Add actions: `setServerLogs`, `setServerLogsTotalCount`, `setAuditLogsTotalCount`

Add selectors: `selectServerLogs`, `selectServerLogsTotalCount`, `selectAuditLogsTotalCount`

---

## Step 9 – Client: Update AuditLogsPage

File: `service-plus-client/src/features/super-admin/pages/audit-logs-page.tsx`

Changes:
1. **Two tabs** using shadcn `Tabs` component: "Audit Events" | "Server Logs"
2. **Audit Events tab** – existing UI, now fetches from `fetchAuditLogs()` on mount; replaces mock data; adds pagination (Load More button).
3. **Server Logs tab** – new section:
   - Level filter buttons: All | INFO | DEBUG | WARNING | ERROR (colour-coded badges: green/slate/amber/red)
   - Each log row shows: level badge, timestamp, module:line_no, message, function name
   - Pagination (Load More)
4. **Loading state** – show a subtle spinner while fetching.
5. **Error state** – use Sonner toast on fetch failure with message key from `messages.ts`.
6. On tab switch, fetch if the slice data is empty.

---

## Step 10 – Client: Messages

File: `service-plus-client/src/lib/messages.ts` (or wherever centralised messages live)

Add keys:
```typescript
AUDIT_LOGS_FETCH_ERROR: "Failed to load audit logs. Please try again.",
SERVER_LOGS_FETCH_ERROR: "Failed to load server logs. Please try again.",
```

---

## Step 11 – Server: Migration Script

New file: `service-plus-server/app/db/migrations/add_audit_and_server_log_tables.sql`

Contains the `CREATE TABLE` statements from Step 1, ready to run against `service_plus_client`.

---

## Summary of Files Changed / Created

### Server
| Action | File |
|---|---|
| Modify | `app/db/service_plus_client.sql` |
| New | `app/db/migrations/add_audit_and_server_log_tables.sql` |
| Modify | `app/logger.py` |
| New | `app/services/audit_service.py` |
| Modify | `app/graphql/schema.graphql` |
| Modify | `app/graphql/resolvers/query.py` |
| Modify | `app/routers/auth_router.py` |
| Modify | `app/graphql/resolvers/mutation.py` |

### Client
| Action | File |
|---|---|
| Modify | `src/types/db-schema-client.ts` |
| Modify | `src/features/super-admin/types/index.ts` |
| New | `src/features/super-admin/graphql/audit-queries.ts` |
| New | `src/features/super-admin/services/audit-log-service.ts` |
| Modify | `src/features/super-admin/store/super-admin-slice.ts` |
| Modify | `src/features/super-admin/pages/audit-logs-page.tsx` |
| Modify | `src/lib/messages.ts` |
