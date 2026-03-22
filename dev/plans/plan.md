# Plan: BU Schema Maintenance (tran.md)

## Overview

Three requirements from tran.md:
1. **Delete BU** — when an inactive BU is deleted, also drop its schema from the database (if it exists), with a confirmation step requiring the user to type the schema name.
2. **Orphaned Schemas** — show a panel listing schemas present in the database but with no corresponding row in `security.bu`; allow selective deletion.
3. **Lowercase schema names** — enforce lowercase for BU codes / schema names everywhere.

---

## Workflow

```
┌─ Delete Business Unit (updated) ──────────────────────────────────────────┐
│  1. User clicks Delete on an inactive BU row                               │
│  2. Dialog shows warning: "This will also DROP the <code> schema from DB"  │
│     (shown only when schema_exists = true)                                 │
│  3. User must type the BU code to confirm                                  │
│  4. On confirm → call deleteBuSchema(db_name, schema="security",           │
│       value={code, deleteBuRow:true})                                      │
│     Server:                                                                │
│       a. DROP SCHEMA IF EXISTS <code> CASCADE                              │
│       b. DELETE FROM security.bu WHERE code = <code>                       │
│  5. Reload BU list                                                         │
└────────────────────────────────────────────────────────────────────────────┘

┌─ Orphaned Schemas panel (new) ─────────────────────────────────────────────┐
│  1. User clicks "Orphaned Schemas" button on Business Units page           │
│  2. Dialog fetches GET_ORPHAN_BU_SCHEMAS → list of schema names in         │
│     pg_namespace that have no matching row in security.bu                  │
│  3. User selects one or more orphaned schemas                              │
│  4. User types the schema name to confirm (for each, or one at a time)     │
│  5. On confirm → call deleteBuSchema(value={code, deleteBuRow:false})      │
│     Server: DROP SCHEMA IF EXISTS <code> CASCADE                           │
│  6. Refresh orphan list                                                    │
└────────────────────────────────────────────────────────────────────────────┘

┌─ Lowercase enforcement ─────────────────────────────────────────────────────┐
│  - Server helper already lowercases code on create                          │
│  - Zod schema already transforms code to lowercase on create                │
│  - Display table already shows bu.code.toLowerCase()                        │
│  - Confirm dialogs must compare/display in lowercase                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `service-plus-server/app/db/sql_auth.py` | Add `GET_ORPHAN_BU_SCHEMAS` |
| 2 | `service-plus-server/app/exceptions.py` | Add `BU_SCHEMA_DROP_FAILED`, `BU_SCHEMA_NAME_MISMATCH` |
| 3 | `service-plus-server/app/graphql/schema.graphql` | Add `deleteBuSchema` mutation |
| 4 | `service-plus-server/app/graphql/resolvers/mutation.py` | Register handler |
| 5 | `service-plus-server/app/graphql/resolvers/mutation_helper.py` | Add helper |
| 6 | `service-plus-client/src/constants/graphql-map.ts` | Add `deleteBuSchema` GQL |
| 7 | `service-plus-client/src/constants/sql-map.ts` | Add `GET_ORPHAN_BU_SCHEMAS` |
| 8 | `service-plus-client/src/constants/messages.ts` | Add messages |
| 9 | `service-plus-client/src/features/admin/components/delete-business-unit-dialog.tsx` | Rewrite with schema-drop confirmation |
| 10 | `service-plus-client/src/features/admin/components/orphan-bu-schemas-dialog.tsx` | New component |
| 11 | `service-plus-client/src/features/admin/pages/business-units-page.tsx` | Add Orphaned Schemas button + dialog wiring |

---

## Step 1 — `sql_auth.py`: Add `GET_ORPHAN_BU_SCHEMAS`

Add (alphabetically sorted):

```python
GET_ORPHAN_BU_SCHEMAS = """
    with "dummy" as (values(1::int))
    -- with "dummy" as (values(1::int)) -- Test line
    SELECT n.nspname AS schema_name
    FROM pg_catalog.pg_namespace n
    WHERE n.nspname NOT IN ('public', 'security', 'information_schema')
      AND n.nspname NOT LIKE 'pg_%'
      AND NOT EXISTS (
          SELECT 1 FROM security.bu
          WHERE LOWER(code) = n.nspname
      )
    ORDER BY n.nspname
"""
```

---

## Step 2 — `exceptions.py`: Add AppMessages

Add (alphabetically sorted):
```python
BU_SCHEMA_DROP_FAILED   = "Failed to drop the business unit schema"
BU_SCHEMA_NAME_MISMATCH = "Schema name does not match. Please type the exact name."
```

---

## Step 3 — `schema.graphql`: Add Mutation

Add to Mutation type (alphabetically):
```graphql
deleteBuSchema(db_name: String!, schema: String, value: String!): Generic
```

---

## Step 4 — `mutation.py`: Register Handler

Add import:
```python
resolve_delete_bu_schema_helper,
```

Add handler (alphabetically after `resolve_create_client`):
```python
@mutation.field("deleteBuSchema")
async def resolve_delete_bu_schema(
    _, info, db_name: str = "", schema: str = "security", value: str = ""
) -> Any:
    try:
        return await resolve_delete_bu_schema_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error(f"Error dropping BU schema: {str(e)}", exc_info=True)
        raise GraphQLException(
            message=AppMessages.BU_SCHEMA_DROP_FAILED, extensions={"details": str(e)}
        )
```

---

## Step 5 — `mutation_helper.py`: Add Helper

Add `resolve_delete_bu_schema_helper` (alphabetically sorted):

```python
async def resolve_delete_bu_schema_helper(
    db_name: str, schema: str, value: str
) -> dict:
    """
    Drop a BU schema from the database and optionally delete the security.bu row.

    Value payload (URL-encoded JSON): { code, delete_bu_row: bool }
    - code: schema name (lowercase, 3–9 chars, alphanumeric + underscore)
    - delete_bu_row: if true, also DELETE FROM security.bu WHERE LOWER(code) = code
    """
    payload = _decode_value(value, "deleteBuSchema")

    code: str          = (payload.get("code") or "").lower().strip()
    delete_bu_row: bool = bool(payload.get("delete_bu_row", False))

    if not code:
        raise ValidationException(
            message=AppMessages.REQUIRED_FIELD_MISSING,
            extensions={"field": "code"},
        )

    # Validate code format
    if not re.match(r"^[a-z0-9_]{3,9}$", code):
        raise ValidationException(
            message=AppMessages.INVALID_INPUT,
            extensions={"detail": "Code must be 3–9 alphanumeric/underscore characters", "field": "code"},
        )

    # Drop schema CASCADE (autocommit DDL)
    logger.info(f"Dropping schema '{code}' in db '{db_name}'")
    await exec_sql_dml(
        db_name=db_name, schema="security",
        sql=pgsql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(pgsql.Identifier(code)),
    )

    # Optionally delete the bu row
    if delete_bu_row:
        logger.info(f"Deleting security.bu row for code='{code}'")
        await exec_sql(
            db_name=db_name, schema="security",
            sql="""
                with "p_code" as (values(%(code)s::text))
                DELETE FROM security.bu
                WHERE LOWER(code) = LOWER((table "p_code"))
                RETURNING id
            """,
            sql_args={"code": code},
        )

    await audit_logger.log(
        action=AuditAction.DROP_DATABASE,
        resource_name=code,
        resource_type="bu_schema",
    )
    logger.info(f"Schema '{code}' dropped successfully")
    return {"code": code, "delete_bu_row": delete_bu_row}
```

---

## Step 6 — `graphql-map.ts`: Add Mutation

Add (alphabetically sorted between `deleteClient` and `dropDatabase`):
```ts
deleteBuSchema: gql`
    mutation DeleteBuSchema($db_name: String!, $schema: String, $value: String!) {
        deleteBuSchema(db_name: $db_name, schema: $schema, value: $value)
    }
`,
```

---

## Step 7 — `sql-map.ts`: Add Key

Add (alphabetically sorted in GET_* section):
```ts
GET_ORPHAN_BU_SCHEMAS: "GET_ORPHAN_BU_SCHEMAS",
```

---

## Step 8 — `messages.ts`: Add Messages

Add under Business Units section (alphabetically):
```ts
ERROR_BU_SCHEMA_DELETE_FAILED:   'Failed to drop business unit schema. Please try again.',
ERROR_BU_SCHEMA_NAME_MISMATCH:   'Schema name does not match. Please type the exact name.',
ERROR_ORPHAN_BU_LOAD_FAILED:     'Failed to load orphaned schemas. Please try again.',
ERROR_ORPHAN_BU_DELETE_FAILED:   'Failed to delete orphaned schema. Please try again.',
INFO_BU_SCHEMA_DROP_WARNING:     'This will permanently drop the schema and all its data from the database.',
SUCCESS_BU_SCHEMA_DELETED:       'Business unit and its schema have been permanently deleted.',
SUCCESS_ORPHAN_BU_DELETED:       'Orphaned schema has been permanently deleted.',
```

---

## Step 9 — `delete-business-unit-dialog.tsx`: Rewrite

### Props (unchanged)
```ts
type DeleteBusinessUnitDialogPropsType = {
    bu: BusinessUnitType | null;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
};
```

### Behaviour changes:
- Add `confirmCode` state (`string`), `submitting` state.
- If `bu.schema_exists` is true, show a warning box (amber) explaining the schema will be dropped.
- Show a text input asking the user to type the BU code to confirm (compare against `bu.code.toLowerCase()`).
- Delete button disabled until `confirmCode.toLowerCase() === bu.code.toLowerCase()`.
- On confirm:
  - If `bu.schema_exists`: call `deleteBuSchema` with `{ code: bu.code.toLowerCase(), delete_bu_row: true }`.
  - If `!bu.schema_exists`: call existing `genericUpdate` with `deletedIds: [bu.id]` (no schema to drop).
- Show `SUCCESS_BU_SCHEMA_DELETED` or `SUCCESS_BU_DELETED` toast accordingly.
- Reset `confirmCode` on close.

### Key snippet:
```tsx
const [confirmCode, setConfirmCode] = useState("");

const deleteEnabled = confirmCode.toLowerCase() === (bu?.code ?? "").toLowerCase();

async function handleDelete() {
    if (!bu || !dbName) return;
    setSubmitting(true);
    try {
        if (bu.schema_exists) {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.deleteBuSchema,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: encodeURIComponent(
                        JSON.stringify({ code: bu.code.toLowerCase(), delete_bu_row: true })
                    ),
                },
            });
            toast.success(MESSAGES.SUCCESS_BU_SCHEMA_DELETED);
        } else {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: "security",
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [bu.id],
                        tableName: "bu",
                        xData: {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_BU_DELETED);
        }
        onSuccess();
        onOpenChange(false);
    } catch {
        toast.error(MESSAGES.ERROR_BU_SCHEMA_DELETE_FAILED);
    } finally {
        setSubmitting(false);
    }
}
```

---

## Step 10 — `orphan-bu-schemas-dialog.tsx`: New Component

New file: `service-plus-client/src/features/admin/components/orphan-bu-schemas-dialog.tsx`

### Behaviour:
- On open, fetch `GET_ORPHAN_BU_SCHEMAS` via `genericQuery`.
- Display list of orphan schema names. Each row has a checkbox and a "Delete" action.
- Single-item delete: inline confirmation input (type schema name) + Delete button.
- Bulk delete via selected checkboxes: a "Delete Selected" button at the bottom — triggers the same per-item confirmation flow one at a time (or a single confirm input for the first selected item with count shown).
- Each deletion calls `deleteBuSchema` with `{ code: schemaName, delete_bu_row: false }`.
- After each deletion, remove the item from the local list without re-fetching.
- "Refresh" button re-fetches the list.

### Types:
```ts
type OrphanSchemaType = { schema_name: string };

type OrphanBuSchemasDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    open: boolean;
};
```

### Layout:
```
┌─ Orphaned Schemas ─────────────────────────────────────────────────────────┐
│  These schemas exist in the database but have no matching Business Unit.   │
│                                                                            │
│  [ ] schema_a        [Delete]  ← expands inline confirmation              │
│  [ ] schema_b        [Delete]                                              │
│                                                                            │
│  [Refresh]                              [Delete Selected] [Close]          │
└────────────────────────────────────────────────────────────────────────────┘
```

Inline confirmation (when Delete clicked on a row):
```
  Type "schema_a" to confirm: [ _________________ ]  [Confirm]  [Cancel]
```

---

## Step 11 — `business-units-page.tsx`: Add Orphaned Schemas Button

### Changes:
1. Import `OrphanBuSchemasDialog`.
2. Add `orphanOpen` state (`boolean`, default `false`).
3. Add "Orphaned Schemas" button in the header button group (between Refresh and Add Business Unit):
```tsx
<Button
    className="gap-1.5 border border-amber-200 bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100"
    size="sm"
    variant="outline"
    onClick={() => setOrphanOpen(true)}
>
    <DatabaseIcon className="h-3.5 w-3.5" />
    Orphaned Schemas
</Button>
```
4. Wire dialog:
```tsx
<OrphanBuSchemasDialog
    open={orphanOpen}
    onOpenChange={setOrphanOpen}
/>
```

---

## Key Design Notes

1. **`DELETE SCHEMA` uses `exec_sql_dml`** (autocommit) because DDL `DROP SCHEMA` cannot run inside a psycopg transaction. If the BU row delete runs in the same call, it runs separately via `exec_sql` after the schema drop.

2. **Orphan definition**: any schema in `pg_namespace` that is not a system schema (`pg_*`, `information_schema`, `public`, `security`) AND has no matching lowercase code in `security.bu`.

3. **Lowercase enforcement**: already handled server-side (`.lower().strip()`) and client-side (Zod `.transform((v) => v.toLowerCase())`). Confirmation inputs compare with `.toLowerCase()` on both sides.

4. **`schema_exists` field on `BusinessUnitType`**: already returned by `GET_ALL_BUS_WITH_SCHEMA_STATUS` and used by the page. The `DeleteBusinessUnitDialog` will use `bu.schema_exists` to decide the deletion path.
