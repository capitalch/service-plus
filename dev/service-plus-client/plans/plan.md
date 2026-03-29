# Plan: Add Seed Data — BU Action Menu

## Overview
Add "Add Seed Data" to the Business Units action menu. The item appears **only** when
`schema_exists = true` AND `seed_exists = false`. Clicking it seeds the BU's lookup tables
without recreating the schema or running DDL. The operation is fully idempotent
(`INSERT ... ON CONFLICT DO NOTHING`).

## Data flow
```
Click "Add Seed Data"
  → FeedBuSeedDataDialog opens
  → feedBuSeedData mutation  { code: bu.code }
  → Backend: confirm schema exists → exec BU_SEED_SQL (idempotent)
  → dispatch markBuSeedExists(bu.id)   ← immediate local flip
  → onSuccess() → reload BU list (seed_exists now true from DB)
  → menu item disappears for that row
```

---

## Step 1 — Backend: `app/db/sql_auth.py`

Extend `GET_ALL_BUS_WITH_SCHEMA_STATUS` to include `seed_exists` using
`pg_class.reltuples > 0` as a batch-safe proxy (no N+1, no dynamic SQL):

```sql
SELECT
    b.id, b.code, b.name, b.is_active, b.created_at, b.updated_at,
    EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace
        WHERE nspname = LOWER(b.code)
    ) AS schema_exists,
    EXISTS (
        SELECT 1
        FROM   pg_catalog.pg_class     c
        JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE  n.nspname  = LOWER(b.code)
          AND  c.relname  = 'job_status'
          AND  c.reltuples > 0
    ) AS seed_exists
FROM security.bu b
ORDER BY b.name
```

> `reltuples` is updated by autovacuum (runs within seconds after INSERT for a hot
> table). The Redux `markBuSeedExists` action flips the flag immediately in local
> state so the UI doesn't wait for the next reload.

---

## Step 2 — Backend: `app/graphql/schema.graphql`

```graphql
feedBuSeedData(db_name: String!, schema: String, value: String!): Generic
```

---

## Step 3 — Backend: `app/graphql/resolvers/mutation_helper.py`

Add `resolve_feed_bu_seed_data_helper(db_name, schema, value)`:

1. Decode value: `{ code }` (lowercase BU code)
2. Validate: `^[a-z0-9_]{3,9}$` regex
3. Guard: confirm schema exists via `pg_catalog.pg_namespace`
4. Execute `SqlBu.BU_SEED_SQL` against `db_name` / `schema = code` (all INSERTs have `ON CONFLICT DO NOTHING`)
5. Emit audit log `AuditAction.FEED_BU_SEED_DATA`
6. Return `{ "code": code }`

---

## Step 4 — Backend: `app/graphql/resolvers/mutation.py`

Add `@mutation.field("feedBuSeedData")` resolver that calls the helper,
following the existing try/except/GraphQLException pattern.

---

## Step 5 — Backend: `app/exceptions.py`

```python
BU_SEED_FEED_FAILED = "Failed to seed business unit data"
```

---

## Step 6 — Backend: `app/core/audit_log.py`

```python
FEED_BU_SEED_DATA = "FEED_BU_SEED_DATA"
```

---

## Step 7 — Frontend: `src/features/admin/types/index.ts`

Add field to `BusinessUnitType`:

```ts
seed_exists: boolean;
```

---

## Step 8 — Frontend: `src/constants/graphql-map.ts`

```ts
feedBuSeedData: gql`
    mutation FeedBuSeedData($db_name: String!, $schema: String, $value: String!) {
        feedBuSeedData(db_name: $db_name, schema: $schema, value: $value)
    }
`,
```

---

## Step 9 — Frontend: `src/constants/messages.ts`

```ts
ERROR_BU_FEED_SEED_FAILED: 'Failed to seed business unit data. Please try again.',
SUCCESS_BU_SEED_DATA:      'Seed data added successfully.',
```

---

## Step 10 — Frontend: `src/features/admin/store/admin-slice.ts`

Add action (mirror of `markBuSchemaExists`):

```ts
markBuSeedExists: (state, action: PayloadAction<number>) => {
    const bu = state.businessUnits.find(b => b.id === action.payload);
    if (bu) bu.seed_exists = true;
},
```

Export it alongside existing actions.

---

## Step 11 — Frontend: Create `src/features/admin/components/feed-bu-seed-data-dialog.tsx`

Model on `create-bu-schema-dialog.tsx`. Key differences:

| | `CreateBuSchemaDialog` | `FeedBuSeedDataDialog` |
|---|---|---|
| Title | "Create Schema & Seed Data" | "Add Seed Data" |
| Mutation | `createBuSchemaAndFeedSeedData` | `feedBuSeedData` |
| Value payload | `{ code, id, name }` | `{ code }` |
| Success dispatch | `markBuSchemaExists(id)` | `markBuSeedExists(id)` |
| Success message | schema created | seed data added for **{name}** |

Three-state UI (loading / error+retry / done) identical to the existing dialog.

---

## Step 12 — Frontend: `src/features/admin/pages/business-units-page.tsx`

### 12a — Imports
```ts
import { FeedBuSeedDataDialog } from '../components/feed-bu-seed-data-dialog';
```

### 12b — State
```ts
const [seedBu, setSeedBu] = useState<BusinessUnitType | null>(null);
```

### 12c — Handler
```ts
const handleSeedData = (bu: BusinessUnitType) => setSeedBu(bu);
```

### 12d — Action menu item
Insert **after** the "Create Schema & Seed Data" block, **before** Edit:

```tsx
{bu.schema_exists && !bu.seed_exists && (
    <>
        <DropdownMenuItem
            className="cursor-pointer text-indigo-600 focus:text-indigo-600"
            onClick={() => handleSeedData(bu)}
        >
            <DatabaseIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Seed Data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
    </>
)}
```

### 12e — Dialog mount
```tsx
{seedBu && (
    <FeedBuSeedDataDialog
        bu={seedBu}
        open={!!seedBu}
        onOpenChange={(open) => { if (!open) setSeedBu(null); }}
        onSuccess={loadBusinessUnits}
    />
)}
```

---

## Edge cases

| Scenario | Handled by |
|---|---|
| Partial seed already exists | `ON CONFLICT DO NOTHING` on every INSERT |
| Schema exists but tables missing (DDL failed) | Backend errors → dialog retry; user should use "Create Schema & Seed Data" (repair path) instead |
| `reltuples = 0` after fresh seed before ANALYZE | `markBuSeedExists` flips local state immediately; next reload reflects DB truth |
| Admin BU selector picks a schema-less BU | `schema_exists` guard in `bu-branch-switcher.tsx` (already handled) |

