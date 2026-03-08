# Plan: Delete Disabled Client — Protected Dropdown Action

## Objective
Add a "Delete" action in the per-row actions dropdown on the Clients page.

**Rules:**
- Only visible when `client.is_active = false` (disabled clients only)
- Opens a confirmation dialog ("protected") before proceeding
- Deletion removes the client row from `service_plus_client.public.client`
- If the client has an associated `db_name`, that PostgreSQL database is also dropped
- Server guards against deleting an active client (double-safety)

---

## Workflow

```
ClientsPage (table row, is_active = false)
  → Dropdown → "Delete" menu item (red, only when !is_active)
    → DeleteClientDialog opens
        Shows: client name, code, db_name (if any)
        Warning: "This action is permanent and cannot be undone."
        Warning: "The associated database <db_name> will also be deleted." (if db_name present)
        User types client name to confirm (protected input guard)
        → Submit enabled only when typed name matches client.name exactly
          → deleteClient mutation (client_id)
            Server:
              1. Fetch client row — verify is_active = false (guard)
              2. If db_name present → DROP DATABASE <db_name>
              3. DELETE FROM public.client WHERE id = client_id
              → Returns { id: client_id }
            Client:
              → toast success → onSuccess() → refetch clients list → close dialog
```

---

## Steps

### Step 1 — Server: Add `DELETE_CLIENT` and `GET_CLIENT_BY_ID` SQL to `SqlAuth`
**File:** `service-plus-server/app/db/sql_auth.py`

Add two SQL constants (alphabetical order):

**`DELETE_CLIENT`** — deletes client row by id, returns id:
```sql
with "p_id" as (values(%(id)s::int))
-- with "p_id" as (values(1::int)) -- Test line
DELETE FROM public.client
WHERE id = (table "p_id")
RETURNING id
```

**`GET_CLIENT_BY_ID`** — fetch client row for server-side guard:
```sql
with "p_id" as (values(%(id)s::int))
-- with "p_id" as (values(1::int)) -- Test line
SELECT id, name, is_active, db_name
FROM public.client
WHERE id = (table "p_id")
```

---

### Step 2 — Server: Add `deleteClient` mutation to GraphQL schema
**File:** `service-plus-server/app/graphql/schema.graphql`

Add to the `Mutation` type (alphabetical order):
```graphql
deleteClient(client_id: Int!): Generic
```

---

### Step 3 — Server: Add `resolve_delete_client_helper` to `mutation_helper.py`
**File:** `service-plus-server/app/graphql/resolvers/mutation_helper.py`

New async function `resolve_delete_client_helper(client_id: int) -> dict`:

Logic:
1. Fetch the client row using `GET_CLIENT_BY_ID` (db_name=None, schema="public").
2. If not found → raise `ValidationException(AppMessages.NOT_FOUND)`.
3. If `client.is_active = True` → raise `ValidationException(AppMessages.CLIENT_MUST_BE_DISABLED)` (server-side guard — cannot delete active client).
4. If `client.db_name` is not None → execute `DROP DATABASE <db_name>` using `exec_sql_dml` with `pgsql.SQL("DROP DATABASE IF EXISTS {}").format(pgsql.Identifier(db_name))` (requires autocommit — same pattern as `CREATE DATABASE`).
5. Execute `DELETE_CLIENT` SQL with `sql_args={"id": client_id}` via `exec_sql`.
6. Return `{"id": client_id}`.

---

### Step 4 — Server: Add `resolve_delete_client` resolver to `mutation.py`
**File:** `service-plus-server/app/graphql/resolvers/mutation.py`

Add resolver (alphabetical order):
```python
@mutation.field("deleteClient")
async def resolve_delete_client(_, info, client_id: int) -> Any:
    try:
        return await resolve_delete_client_helper(client_id)
    except ValidationException:
        raise
    except Exception as e:
        logger.error(f"Error deleting client: {str(e)}")
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )
```

Import `resolve_delete_client_helper` in the imports block.

---

### Step 5 — Server: Add `AppMessages` constants (if missing)
**File:** `service-plus-server/app/exceptions.py`

Check `AppMessages` class — add if not present (alphabetical):
- `CLIENT_MUST_BE_DISABLED = "Client must be disabled before deletion."`
- `NOT_FOUND = "Record not found."`

---

### Step 6 — Client: Add `deleteClient` mutation to `GRAPHQL_MAP`
**File:** `service-plus-client/src/constants/graphql-map.ts`

Add (alphabetical order):
```ts
deleteClient: gql`
    mutation DeleteClient($client_id: Int!) {
        deleteClient(client_id: $client_id)
    }
`,
```

---

### Step 7 — Client: Add message keys to `MESSAGES`
**File:** `service-plus-client/src/constants/messages.ts`

Add under `// Client CRUD` section (sorted):
- `ERROR_CLIENT_DELETE_FAILED` — `"Failed to delete client. Please try again."`
- `ERROR_CLIENT_DELETE_NOT_ALLOWED` — `"Only disabled clients can be deleted."`
- `SUCCESS_CLIENT_DELETED` — `"Client deleted successfully."`

---

### Step 8 — Client: Create `delete-client-dialog.tsx`
**File:** `service-plus-client/src/features/super-admin/components/delete-client-dialog.tsx`

**Props:**
```ts
type DeleteClientDialogPropsType = {
  client: ClientType | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  open: boolean;
};
```

**Protection mechanism — name confirmation input:**
- A text input where the user must type the client's name exactly to unlock the Delete button.
- `confirmName` local state (string), reset on dialog open/close.
- Submit enabled only when `confirmName === client.name` and not submitting.

**UI layout:**
- Dialog header: "Delete Client" (use destructive intent styling — slate/dark, not red on controls per convention)
- Body:
  - Client info summary: name (bold), code, status badge (Inactive)
  - Warning box (amber background): "This action is permanent and cannot be undone."
  - If `client.db_name`: additional warning line: "The associated database **{client.db_name}** will also be permanently deleted."
  - Confirmation label: `Type "{client.name}" to confirm`
  - Input bound to `confirmName` state (not react-hook-form — it's a simple guard, not a form)
- Footer: Cancel (ghost) + "Delete" button
  - "Delete" button: `bg-red-600 hover:bg-red-700 text-white` — red is appropriate here as it is NOT a form control; it is an action confirmation button
  - Disabled when `confirmName !== client.name` or `submitting`
  - Shows Loader2 spinner while submitting

**Submit handler:**
```ts
async function handleDelete() {
  setSubmitting(true);
  try {
    const result = await apolloClient.mutate({
      mutation: GRAPHQL_MAP.deleteClient,
      variables: { client_id: client.id },
    });
    if (result.errors?.length) { toast.error(MESSAGES.ERROR_CLIENT_DELETE_FAILED); return; }
    toast.success(MESSAGES.SUCCESS_CLIENT_DELETED);
    onSuccess();
    onOpenChange(false);
  } catch {
    toast.error(MESSAGES.ERROR_CLIENT_DELETE_FAILED);
  } finally {
    setSubmitting(false);
  }
}
```

**Reset on close:** `useEffect` on `open` — when `!open` reset `confirmName` and `submitting`.

---

### Step 9 — Client: Update `clients-page.tsx`
**File:** `service-plus-client/src/features/super-admin/pages/clients-page.tsx`

**Add state:**
```ts
const [deleteClient, setDeleteClient] = useState<ClientType | null>(null);
```

**Add handler** (sorted):
```ts
const handleDelete = (client: ClientType) => setDeleteClient(client);
```

**Add `DropdownMenuItem`** inside the dropdown, after the Disable/Enable item (only shown when `!client.is_active`):
```tsx
{!client.is_active && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-red-600 focus:text-red-600"
      onClick={() => handleDelete(client)}
    >
      Delete
    </DropdownMenuItem>
  </>
)}
```

**Add dialog mount** (alongside other dialogs at bottom of JSX):
```tsx
<DeleteClientDialog
  client={deleteClient}
  open={!!deleteClient}
  onOpenChange={(open) => { if (!open) setDeleteClient(null); }}
  onSuccess={handleRefetch}
/>
```

**Add import:**
```ts
import { DeleteClientDialog } from "../components/delete-client-dialog";
```

---

## File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `service-plus-server/app/db/sql_auth.py` | Add `DELETE_CLIENT`, `GET_CLIENT_BY_ID` SQL |
| 2 | `service-plus-server/app/graphql/schema.graphql` | Add `deleteClient` mutation |
| 3 | `service-plus-server/app/graphql/resolvers/mutation_helper.py` | Add `resolve_delete_client_helper` |
| 4 | `service-plus-server/app/graphql/resolvers/mutation.py` | Add `resolve_delete_client` resolver |
| 5 | `service-plus-server/app/exceptions.py` | Add `CLIENT_MUST_BE_DISABLED`, `NOT_FOUND` to `AppMessages` (if missing) |
| 6 | `service-plus-client/src/constants/graphql-map.ts` | Add `deleteClient` mutation |
| 7 | `service-plus-client/src/constants/messages.ts` | Add 3 message keys |
| 8 | `service-plus-client/src/features/super-admin/components/delete-client-dialog.tsx` | **New file** |
| 9 | `service-plus-client/src/features/super-admin/pages/clients-page.tsx` | Add state, handler, menu item, dialog |
