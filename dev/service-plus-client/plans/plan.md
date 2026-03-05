# Plan: Initiate Client – 2-Step Dialog (UI + Server)

## Workflow

The "Initiate" button on the Clients table opens a dialog guiding a Super Admin through up to two sequential steps to fully set up a client:

1. **Step 1 – Create Database** (shown only when `client.db_name` is null)
   - Editable `db_name` field pre-filled as `service_plus_<client_code_lowercase>`
   - Debounced (1200 ms) uniqueness check against `pg_database` via `genericQuery` + `SQL_MAP.CHECK_DB_NAME_EXISTS`
   - On submit: calls new `createServiceDb` mutation → server creates PostgreSQL DB + security schema + updates `client.db_name`
   - On success: stepper advances to Step 2

2. **Step 2 – Create Admin User** (shown when `db_name` set but `activeAdminCount === 0`)
   - Fields: `full_name` (required), `email` (required valid email), `username` (required, auto-derived from email but editable), `mobile` (optional)
   - On submit: uses existing `genericUpdate` mutation → inserts into `security.user` of the client DB with `is_admin = true`
   - On success: success screen → dialog closes → clients table refreshes

Dialog opens directly at Step 2 when `client.db_name` is already set.

---

## Step 1 – Client-Side Constants

### Step 1a – `src/constants/messages.ts`
Add to `MESSAGES`:
```
ERROR_DB_NAME_EXISTS        – 'This database name is already taken.'
ERROR_DB_NAME_REQUIRED      – 'Database name is required.'
ERROR_FULL_NAME_REQUIRED    – 'Full name is required.'
ERROR_INITIATE_ADMIN_FAILED – 'Failed to create admin user. Please try again.'
ERROR_INITIATE_DB_FAILED    – 'Failed to create database. Please try again.'
SUCCESS_CLIENT_INITIATED    – 'Client initiated successfully.'
SUCCESS_INITIATE_ADMIN      – 'Admin user created successfully.'
SUCCESS_INITIATE_DB         – 'Database created successfully.'
```

### Step 1b – `src/constants/sql-map.ts`
Add:
```ts
CHECK_DB_NAME_EXISTS: "CHECK_DB_NAME_EXISTS"
```

### Step 1c – `src/constants/graphql-map.ts`
Add one new mutation (`genericUpdate` already exists and will be reused for Step 2):
```graphql
createServiceDb: gql`
  mutation CreateServiceDb($client_id: Int!, $db_name: String!) {
    createServiceDb(client_id: $client_id, db_name: $db_name)
  }
`
```

---

## Step 2 – Server-Side Changes

### Step 2a – `app/db/sql_auth.py`
Add `CHECK_DB_NAME_EXISTS`:
```sql
with "db_name" as (values(%(db_name)s::text))
-- with "db_name" as (values('service_plus_demo'::text)) -- Test line
SELECT EXISTS(
    SELECT 1 FROM pg_database WHERE datname = (table "db_name")
) AS exists
```
`pg_database` is a global catalog accessible from any DB connection, so the existing client-DB connection works.

Add `UPDATE_CLIENT_DB_NAME`:
```sql
with
    "p_db_name" as (values(%(db_name)s::text)),
    -- "p_db_name" as (values('service_plus_demo'::text)) -- Test line
    "p_id"      as (values(%(id)s::int))
    -- "p_id"      as (values(1::int)) -- Test line
UPDATE public.client
SET db_name = (table "p_db_name")
WHERE id = (table "p_id")
RETURNING id, db_name
```

### Step 2b – `app/graphql/schema.graphql`
Add one mutation to the `Mutation` type:
```graphql
createServiceDb(client_id: Int!, db_name: String!): Generic
```

### Step 2c – `app/graphql/resolvers/mutation_helper.py`
Add one async helper function:

**`resolve_create_service_db_helper(client_id, db_name)`**
1. Validate `db_name` format: must match `^service_plus_[a-z0-9_]+$`
2. Check uniqueness via `pg_database` using `exec_sql(db_name=None, schema="public", sql=SQL_MAP["CHECK_DB_NAME_EXISTS"], sql_args={"db_name": db_name})`; raise `ValidationException` if taken
3. `CREATE DATABASE <db_name>` via `exec_sql_dml(db_name=None, schema="public", sql=pgsql.SQL("CREATE DATABASE {}").format(pgsql.Identifier(db_name)))`
   - `db_name=None` connects to the client DB with **autocommit=True** (DDL cannot run inside a transaction block)
   - Identifier quoting via `psycopg.sql.SQL` prevents SQL injection
4. Execute the full security-schema DDL in the newly created database in a **single** call:
   - `exec_sql(db_name=db_name, sql=<full_security_ddl_script>)` — the script includes `DROP SCHEMA IF EXISTS public CASCADE`, `CREATE SCHEMA IF NOT EXISTS security` followed by all table DDL (`bu`, `user`, `role`, `access_right`, `role_access_right`, `user_bu_role`) mirroring the structure from `service_plus_demo`'s security schema
   - `DROP SCHEMA IF EXISTS public CASCADE` removes the default `public` schema that PostgreSQL creates automatically for every new database
   - `exec_sql` is used (not `exec_sql_dml`) because `DROP SCHEMA`/`CREATE SCHEMA`/`CREATE TABLE` run fine inside a transaction; if any statement fails the whole schema creation rolls back automatically
   - psycopg3 uses the **simple query protocol** (multi-statement string) when `sql_args` is empty, so the entire script executes in one `cur.execute()` call
5. Update `db_name` on the client record via `exec_sql(db_name=None, schema="public", sql=SqlAuth.UPDATE_CLIENT_DB_NAME, sql_args={"db_name": db_name, "id": client_id})`
6. Return `{"id": client_id, "db_name": db_name}`

### Step 2d – `app/graphql/resolvers/mutation.py`
Add one resolver following the existing pattern:
```python
@mutation.field("createServiceDb")
async def resolve_create_service_db(_, info, client_id, db_name) -> Any:
    # re-raise ValidationException; wrap others in GraphQLException
```

---

## Step 3 – `InitiateClientDialog` Component

**File:** `src/features/super-admin/components/initiate-client-dialog.tsx`

### Props type
```ts
type InitiateClientDialogPropsType = {
  client: ClientType;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};
```

### State
- `step: 1 | 2 | 'success'` – initialised on open: `client.db_name ? 2 : 1`
- `createdDbName: string` – stores db_name after Step 1 success (used by Step 2 info box)
- `dbNameAvailable: boolean | null` – result of uniqueness check; `null` while unchecked
- `checkingDb: boolean` – spinner while debounce query in flight

### Step 1 – Zod schema + form
```ts
z.object({
  db_name: z.string()
    .min(1, MESSAGES.ERROR_DB_NAME_REQUIRED)
    .regex(/^service_plus_[a-z0-9_]+$/, 'Invalid format'),
})
```
- `db_name` field: shadcn `Input`, editable, default value = `service_plus_${client.code.toLowerCase()}`
- `useDebounce(dbNameValue, 1200)` → fires `apolloClient.query` with `SQL_MAP.CHECK_DB_NAME_EXISTS`
- Below input: spinner OR green check icon (from lucide-react) OR error from `MESSAGES.ERROR_DB_NAME_EXISTS`
- Submit disabled while `checkingDb`, `!dbNameAvailable`, or mutating

### Step 2 – Zod schema + form
```ts
z.object({
  email:     z.email({ message: MESSAGES.ERROR_EMAIL_INVALID }),
  full_name: z.string().min(1, MESSAGES.ERROR_FULL_NAME_REQUIRED),
  mobile:    z.string().optional(),
  username:  z.string().min(3, 'Username must be at least 3 characters')
               .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
})
```
- `username` default value auto-derived from email local part (before `@`) and updated via `useWatch` on `email`; user can override
- Errors appear immediately on input change (mode: `"onChange"`)

### Stepper header (dark gradient)
- `bg-gradient-to-br from-slate-800 to-slate-900` matches prototype
- Title: `Initiate Client:` + client.name in `text-emerald-400`
- Two-dot stepper: dot 1 `done` (green check) when `step >= 2 || step === 'success'`; dot 2 `active` when `step === 2`
- Connector line: `bg-emerald-500` when dot 1 done, else `bg-slate-600`
- Header hidden (`hidden`) on success screen

### Step 1 panel
- `AnimatePresence` + `motion.div` with `initial={{ opacity: 0, y: 8 }}` / `animate={{ opacity: 1, y: 0 }}`
- Section title, description
- `db_name` Input with availability status
- Footer: "Cancel" (ghost) + "Create Database" (emerald, disabled as above)

### Step 2 panel
- Same motion transitions
- Info box (green background): "Database **{dbName}** created successfully. Now create the admin user."
- Fields: Full Name * (required), Email * (required), Username * (required, auto-derived from email), Mobile (optional – no red *)
- `FieldError` component (same as in `add-client-dialog.tsx`) for inline validation
- Footer: "Cancel" (ghost) + "Create Admin" (emerald, disabled on errors / submitting)

### Success screen
- `motion.div` fade-in
- Centered: 72px green gradient circle with `PartyPopper` or `CheckCircle2` icon (lucide-react)
- `h3`: "Client Initiated!"
- `p`: "Database and admin user have been set up successfully."
- "Close" button (emerald) → `onSuccess()` + `onOpenChange(false)`

### Mutations
- Step 1: `useMutation(GRAPHQL_MAP.createServiceDb)`
  - `variables: { client_id: client.id, db_name }`
  - Error → `toast.error(MESSAGES.ERROR_INITIATE_DB_FAILED)`
  - Success → `setCreatedDbName(db_name); setStep(2); toast.success(MESSAGES.SUCCESS_INITIATE_DB)`
- Step 2: `useMutation(GRAPHQL_MAP.genericUpdate)`
  - `variables: { db_name: createdDbName || client.db_name, schema: "security", value: buildGenericUpdateValue({ tableName: "user", xData: { email, full_name, is_active: true, is_admin: true, mobile: mobile || null, username } }) }`
  - Error → `toast.error(MESSAGES.ERROR_INITIATE_ADMIN_FAILED)`
  - Success → `setStep('success'); toast.success(MESSAGES.SUCCESS_INITIATE_ADMIN)`

### Reset on close
```ts
useEffect(() => {
  if (!open) {
    step1Form.reset();
    step2Form.reset();
    setStep(client?.db_name ? 2 : 1);
    setDbNameAvailable(null);
    setCreatedDbName('');
  }
}, [open]);
```

---

## Step 4 – Wire Up `clients-page.tsx`

1. Add state: `const [initiateClient, setInitiateClient] = useState<ClientType | null>(null)`
2. Replace stub `handleInitiate`:
   ```ts
   const handleInitiate = (client: ClientType) => setInitiateClient(client);
   ```
3. Add dialog below `<AddClientDialog>`:
   ```tsx
   {initiateClient && (
     <InitiateClientDialog
       client={initiateClient}
       open={!!initiateClient}
       onOpenChange={(open) => { if (!open) setInitiateClient(null); }}
       onSuccess={refetch}
     />
   )}
   ```
4. Import `InitiateClientDialog` from `../components/initiate-client-dialog`

---

## Step 5 – Responsive Design

- Dialog: `max-w-[480px]` on sm+, `w-full` on xs
- Stepper header padding: `px-5 sm:px-7`
- All inputs: `w-full`
- Footer buttons: `flex justify-end gap-2`

---

## Summary of All Files Changed / Created

| File | Action |
|---|---|
| `src/constants/messages.ts` | Edit – add 8 new message keys |
| `src/constants/sql-map.ts` | Edit – add `CHECK_DB_NAME_EXISTS` |
| `src/constants/graphql-map.ts` | Edit – add `createServiceDb` mutation (`genericUpdate` already exists) |
| `src/features/super-admin/components/initiate-client-dialog.tsx` | **Create** |
| `src/features/super-admin/pages/clients-page.tsx` | Edit – wire up Initiate dialog |
| `app/db/sql_auth.py` | Edit – add `CHECK_DB_NAME_EXISTS` SQL |
| `app/graphql/schema.graphql` | Edit – add `createServiceDb` mutation |
| `app/graphql/resolvers/mutation.py` | Edit – add `resolve_create_service_db` handler |
| `app/graphql/resolvers/mutation_helper.py` | Edit – add `resolve_create_service_db_helper` |
