# Plan: Add Client — Three-Step Feature

## Objective
Implement the full "Add Client" workflow as three independent steps:
1. **Create Client** — insert row in `service_plus_client.client`
2. **Create Database** — create PostgreSQL DB + security schema for the client
3. **Create / Modify Admin User** — manage admin users in the client's security schema

Steps are decoupled: a client row can exist without a DB, and a DB without an admin user.

---

## Workflow

```
SA clicks "Add Client"
    ↓
AddClientDialog  →  genericUpdate(value={action:"CREATE_CLIENT", data:{...}})
    ↓ server: mutation_helper → INSERT_CLIENT → returns new row
    ↓ client: onClientAdded() → refetch dashboard → table updated with new row

Table shows new client, db_name filled from code (service_plus_{code})
Actions dropdown now shows:
  ├─ View / Edit / Disable  (existing)
  ├─ Create Database         (enabled when is_db_created=false)
  ├─ Create Admin User       (enabled when is_db_created=true)
  └─ Manage Admin Users      (enabled when is_db_created=true)

SA clicks "Create Database"
    ↓
CreateDatabaseDialog (confirm)
    ↓  createClientDatabase(value={db_name, code})  ← NEW mutation
    ↓  server: db_operations.py → CREATE DATABASE → CREATE SCHEMA security → tables
    ↓  client: refetch dashboard → is_db_created flips to true → button disabled

SA clicks "Create Admin User"
    ↓
AddAdminUserDialog  →  email input only
    ↓  genericUpdate(db_name, value={action:"CREATE_ADMIN_USER", data:{email}})
    ↓  server: mutation_helper → generates username + password → INSERT security.user
    ↓  client: refetch → activeAdminCount incremented

SA clicks "Manage Admin Users"
    ↓
ManageAdminUsersDialog  →  fetches list via getClientAdminUsers(db_name)
    ↓  shows list: enable / disable / delete per user
    ↓  each action: genericUpdate(db_name, value={action:"MODIFY_ADMIN_USER", data:{id, action}})
    ↓  client: refetch
```

---

## Steps

### Step 1 — Server: Add SQL to `sql_auth.py`

Add alphabetically (after GET_CLIENT_STATS, before existing INSERT_CLIENT if any):

**INSERT_CLIENT** — insert into `service_plus_client.client`:
```sql
with
    "p_code"    as (values(%(code)s::text)),
    "p_db_name" as (values(%(db_name)s::text)),
    "p_email"   as (values(%(email)s::text)),
    "p_name"    as (values(%(name)s::text)),
    "p_phone"   as (values(%(phone)s::text))
INSERT INTO public.client (code, db_name, email, is_active, name, phone)
VALUES (
    (table "p_code"),
    NULLIF((table "p_db_name"), ''),
    NULLIF((table "p_email"), ''),
    true,
    (table "p_name"),
    NULLIF((table "p_phone"), '')
)
RETURNING id, code, name, is_active, db_name, created_at, updated_at
```

**GET_ADMIN_USERS_BY_DB** — fetch all admin users from a client's security schema:
```sql
SELECT id, username, email, mobile, full_name, is_active, is_admin, created_at, updated_at
FROM security."user"
WHERE is_admin = true
ORDER BY full_name
```

**INSERT_ADMIN_USER** — insert admin user into a client's security schema:
```sql
with
    "p_email"     as (values(%(email)s::text)),
    "p_full_name" as (values(%(full_name)s::text)),
    "p_password"  as (values(%(password_hash)s::text)),
    "p_username"  as (values(%(username)s::text))
INSERT INTO security."user" (email, full_name, is_active, is_admin, password_hash, username)
VALUES (
    (table "p_email"),
    (table "p_full_name"),
    true,
    true,
    (table "p_password"),
    (table "p_username")
)
RETURNING id, email, full_name, is_active, is_admin, username, created_at, updated_at
```

**UPDATE_ADMIN_USER_STATUS** — enable/disable an admin user:
```sql
with
    "p_id"        as (values(%(id)s::bigint)),
    "p_is_active" as (values(%(is_active)s::boolean))
UPDATE security."user"
SET is_active = (table "p_is_active")
WHERE id = (table "p_id")
  AND is_admin = true
RETURNING id, email, full_name, is_active, username
```

---

### Step 2 — Server: Add `AppMessages` in `exceptions.py`

Add alphabetically within groups:
```python
# Success messages
ADMIN_USER_CREATED    = "Admin user created successfully"
CLIENT_CREATED        = "Client created successfully"
DATABASE_CREATED      = "Client database created successfully"

# Error messages - Validation
CLIENT_CODE_EXISTS    = "A client with this code already exists"
CLIENT_DB_NAME_EXISTS = "A client with this database name already exists"
CLIENT_NAME_EXISTS    = "A client with this name already exists"
DATABASE_ALREADY_EXISTS = "Database already exists for this client"
DATABASE_CREATE_FAILED  = "Failed to create client database"
```

---

### Step 3 — Server: Create `mutation_helper.py`

New file `app/graphql/resolvers/mutation_helper.py` with three helpers, sorted alphabetically:

**`resolve_create_admin_user_helper(db_name, data)`**
- Extract and validate `email` (required)
- Generate `username` = email prefix + 4-digit random suffix (e.g. `john1234`)
- Generate random 10-char password (`secrets.token_urlsafe(8)`)
- Hash password with `hashlib.sha256` (or bcrypt if available)
- Call `exec_sql` with `INSERT_ADMIN_USER`, `db_name=db_name`, `schema="security"`
- Return `{username, password, email, ...}` — raw password included once for display

**`resolve_create_client_helper(data)`**
- Extract `code`, `name` (required), `db_name` (default `service_plus_{code}`), `email`, `phone`
- Validate required fields; raise `ValidationException` if missing
- Call `exec_sql` with `INSERT_CLIENT`, `db_name=None`
- Serialize timestamps; return full client dict with `activeAdminCount: 0`

**`resolve_modify_admin_user_helper(db_name, data)`**
- Extract `id` (required), `action` (`ENABLE` / `DISABLE`)
- Set `is_active = action == "ENABLE"`
- Call `exec_sql` with `UPDATE_ADMIN_USER_STATUS`, `db_name=db_name`, `schema="security"`
- Return updated user row

---

### Step 4 — Server: Create `db_operations.py`

New file `app/db/db_operations.py`:

```python
async def create_client_database(db_name: str) -> None:
    """
    Create a new PostgreSQL database and populate it with the security schema.
    Uses autocommit because CREATE DATABASE cannot run inside a transaction.
    """
```

- Connect using `psycopg.AsyncConnection.connect(..., autocommit=True)` to the client DB server
- Execute `CREATE DATABASE {db_name}` using `psycopg.sql.SQL` identifiers (safe)
- Close autocommit connection
- Open regular connection to new `db_name`
- Execute `CREATE SCHEMA security` + all security table DDL (from embedded template string derived from `service_plus_service.sql` security section)
- Commit

The security schema DDL template covers tables: `access_right`, `bu`, `role`, `role_access_right`, `user`, `user_bu_role` plus sequences, constraints, indexes, and triggers.

---

### Step 5 — Server: Update `schema.graphql`

```graphql
type Query {
    genericQuery(db_name: String!, value: String!): Generic
    getClientAdminUsers(db_name: String!): Generic
    superAdminDashboardStats: Generic
}

type Mutation {
    createClientDatabase(value: Generic!): Generic
    genericUpdate(db_name: String!, value: Generic!): Generic
}
```

---

### Step 6 — Server: Update `mutation.py`

**Route `genericUpdate` by action** — replace the mock body with:
```python
action = (value or {}).get("action", "")
data   = (value or {}).get("data", {})
db_name_val = db_name or ""

if action == "CREATE_CLIENT":
    return await resolve_create_client_helper(data)
elif action == "CREATE_ADMIN_USER":
    return await resolve_create_admin_user_helper(db_name_val, data)
elif action == "MODIFY_ADMIN_USER":
    return await resolve_modify_admin_user_helper(db_name_val, data)
else:
    raise ValidationException(message=AppMessages.INVALID_INPUT)
```

**Add `createClientDatabase` resolver** (alphabetically before `genericUpdate`):
```python
@mutation.field("createClientDatabase")
async def resolve_create_client_database(_, info, value=None) -> Any:
    db_name_val = (value or {}).get("db_name", "")
    await create_client_database(db_name_val)
    return {"status": "OK", "message": AppMessages.DATABASE_CREATED}
```

Import `create_client_database` from `app.db.db_operations`.

---

### Step 7 — Server: Update `query.py`

Add `getClientAdminUsers` resolver:
```python
@query.field("getClientAdminUsers")
async def resolve_get_client_admin_users(_, info, db_name="") -> Any:
    rows = await exec_sql(db_name=db_name, schema="security", sql=SqlAuth.GET_ADMIN_USERS_BY_DB)
    return [
        {**row, "created_at": row["created_at"].isoformat(), "updated_at": row["updated_at"].isoformat()}
        for row in rows
    ]
```

---

### Step 8 — Server: Update `query_helper.py`

In `resolve_super_admin_dashboard_stats_helper`, wrap the per-client DB query in try/except:
- If `exec_sql` raises `DatabaseException` → `is_db_created = False`, skip BU/user stats for that client
- If successful → `is_db_created = True`
- Add `"is_db_created": is_db_created` to each entry in `clients_data`

---

### Step 9 — Client: Update `messages.ts`

Add a `// Client & Admin CRUD` section:
```ts
ERROR_ADMIN_USER_CREATE_FAILED:  'Failed to create admin user. Please try again.',
ERROR_CLIENT_CODE_EXISTS:        'A client with this code already exists',
ERROR_CLIENT_CODE_FORMAT:        'Code can only contain letters, numbers and underscores',
ERROR_CLIENT_CODE_MAX:           'Code must be at most 20 characters',
ERROR_CLIENT_CODE_MIN:           'Code must be at least 2 characters',
ERROR_CLIENT_CODE_REQUIRED:      'Client code is required',
ERROR_CLIENT_CREATE_FAILED:      'Failed to create client. Please try again.',
ERROR_CLIENT_DB_CREATE_FAILED:   'Failed to create database. Please try again.',
ERROR_CLIENT_DB_NAME_EXISTS:     'A client with this database name already exists',
ERROR_CLIENT_NAME_EXISTS:        'A client with this name already exists',
ERROR_CLIENT_NAME_MIN:           'Name must be at least 2 characters',
ERROR_CLIENT_NAME_REQUIRED:      'Client name is required',
ERROR_EMAIL_REQUIRED_FOR_ADMIN:  'Email is required to create an admin user',
SUCCESS_ADMIN_USER_CREATED:      'Admin user created successfully',
SUCCESS_CLIENT_CREATED:          'Client created successfully',
SUCCESS_DATABASE_CREATED:        'Client database created successfully',
```

---

### Step 10 — Client: Update `types/index.ts`

Add (alphabetically before `ClientType`):
```ts
export type AddAdminUserFormType = {
    email: string;
};

export type AddClientFormType = {
    code: string;
    db_name: string;
    email: string;
    name: string;
    phone: string;
};

export type AdminUserRowType = {
    created_at: string;
    email: string;
    full_name: string;
    id: number;
    is_active: boolean;
    is_admin: boolean;
    mobile: string | null;
    updated_at: string;
    username: string;
};
```

Update `ClientType` — add `is_db_created: boolean`:
```ts
export type ClientType = {
    activeAdminCount:   number;
    code:               string;
    created_at:         string;
    db_name:            string | null;
    id:                 number;
    inactiveAdminCount: number;
    is_active:          boolean;
    is_db_created:      boolean;
    name:               string;
    updated_at:         string;
};
```

---

### Step 11 — Client: Update `graphql-map.ts`

Add (sorted alphabetically by key):
```ts
createClientDatabase: gql`
    mutation CreateClientDatabase($value: Generic!) {
        createClientDatabase(value: $value)
    }
`,
getClientAdminUsers: gql`
    query GetClientAdminUsers($db_name: String!) {
        getClientAdminUsers(db_name: $db_name)
    }
`,
```

The existing `genericUpdate` mutation is used for CREATE_CLIENT, CREATE_ADMIN_USER, MODIFY_ADMIN_USER.

---

### Step 12 — Client: Create `add-client-dialog.tsx`

`src/features/super-admin/components/add-client-dialog.tsx`

- Props: `open`, `onOpenChange`, `onClientAdded`
- react-hook-form + zod: `name`* (min 2), `code`* (min 2, max 20, `[a-zA-Z0-9_]+`), `db_name` (auto-filled as `service_plus_{code}` via `watch('code')`), `email` (optional valid email or empty), `phone` (optional)
- `useMutation(GRAPHQL_MAP.genericUpdate)`
- On submit: `genericUpdate({ variables: { db_name: "", value: { action: "CREATE_CLIENT", data: formData } } })`
- On success: `toast.success(MESSAGES.SUCCESS_CLIENT_CREATED)` → `onClientAdded()` → close

---

### Step 13 — Client: Create `create-database-dialog.tsx`

`src/features/super-admin/components/create-database-dialog.tsx`

- Props: `client: ClientType`, `open`, `onOpenChange`, `onDatabaseCreated`
- No form input — shows the target DB name (`client.db_name`) and asks to confirm
- `useMutation(GRAPHQL_MAP.createClientDatabase)`
- On confirm: `createClientDatabase({ variables: { value: { db_name: client.db_name, code: client.code } } })`
- On success: `toast.success(MESSAGES.SUCCESS_DATABASE_CREATED)` → `onDatabaseCreated()` → close

---

### Step 14 — Client: Create `add-admin-user-dialog.tsx`

`src/features/super-admin/components/add-admin-user-dialog.tsx`

- Props: `client: ClientType`, `open`, `onOpenChange`, `onAdminUserAdded`
- zod: `email`* (required valid email)
- `useMutation(GRAPHQL_MAP.genericUpdate)`
- On submit: `genericUpdate({ variables: { db_name: client.db_name, value: { action: "CREATE_ADMIN_USER", data: { email } } } })`
- On success: show toast with generated credentials (`username`, `password` from response) → `onAdminUserAdded()`

---

### Step 15 — Client: Create `manage-admin-users-dialog.tsx`

`src/features/super-admin/components/manage-admin-users-dialog.tsx`

- Props: `client: ClientType`, `open`, `onOpenChange`, `onChanged`
- `useLazyQuery(GRAPHQL_MAP.getClientAdminUsers)` — fetched when dialog opens
- Displays admin users in a small table: name, email, status badge, actions (Enable / Disable)
- Each action: `genericUpdate({ variables: { db_name: client.db_name, value: { action: "MODIFY_ADMIN_USER", data: { id, action: "ENABLE"|"DISABLE" } } } })`
- On any action success: refetch admin users list

---

### Step 16 — Client: Update `client-overview-table.tsx`

- Accept props: `onClientAdded: () => void`
- Add `useState` for: `dialogOpen` (add client), `dbDialogClient`, `adminDialogClient`, `manageAdminsClient` (each `ClientType | null`)
- Replace placeholder `handleAddClient` → `setDialogOpen(true)`
- Extend Actions dropdown per row:
  ```
  View | Edit | ── | Create Database | Create Admin User | Manage Admin Users | ── | Disable
  ```
- "Create Database": `disabled={!client.db_name || client.is_db_created}`
- "Create Admin User": `disabled={!client.is_db_created}`
- "Manage Admin Users": `disabled={!client.is_db_created}`
- Render all four dialogs at bottom of component

---

### Step 17 — Client: Update `super-admin-dashboard-page.tsx`

- Pass `onClientAdded` to `ClientOverviewTable`:
  ```tsx
  <ClientOverviewTable onClientAdded={() => refetch()} />
  ```
- Update `ServerClientRowType` to include `is_db_created: boolean`

---

## Files Changed

| File | Change |
|------|--------|
| `server/app/db/sql_auth.py` | Add INSERT_CLIENT, GET_ADMIN_USERS_BY_DB, INSERT_ADMIN_USER, UPDATE_ADMIN_USER_STATUS |
| `server/app/exceptions.py` | Add AppMessages for client/DB/admin |
| `server/app/graphql/resolvers/mutation_helper.py` | **New** — create client, create admin user, modify admin user helpers |
| `server/app/db/db_operations.py` | **New** — create_client_database (CREATE DATABASE + security DDL) |
| `server/app/graphql/schema.graphql` | Add createClientDatabase mutation; add getClientAdminUsers query |
| `server/app/graphql/resolvers/mutation.py` | Route genericUpdate by action; add createClientDatabase resolver |
| `server/app/graphql/resolvers/query.py` | Add getClientAdminUsers resolver |
| `server/app/graphql/resolvers/query_helper.py` | Add is_db_created per client row; try/except around DB connection |
| `client/src/constants/messages.ts` | Add client/admin/DB messages |
| `client/src/features/super-admin/types/index.ts` | Add AddClientFormType, AddAdminUserFormType, AdminUserRowType; update ClientType |
| `client/src/constants/graphql-map.ts` | Add createClientDatabase, getClientAdminUsers |
| `client/src/features/super-admin/components/add-client-dialog.tsx` | **New** |
| `client/src/features/super-admin/components/create-database-dialog.tsx` | **New** |
| `client/src/features/super-admin/components/add-admin-user-dialog.tsx` | **New** |
| `client/src/features/super-admin/components/manage-admin-users-dialog.tsx` | **New** |
| `client/src/features/super-admin/components/client-overview-table.tsx` | Add prop, dialogs, new action items |
| `client/src/features/super-admin/pages/super-admin-dashboard-page.tsx` | Pass refetch as onClientAdded; update ServerClientRowType |
