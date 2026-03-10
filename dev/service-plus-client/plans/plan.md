# Plan: Block Delete When Client Has Attached DB

## Overview
When a client has a `db_name` set (database attached), the Delete dialog must show a
meaningful blocking message instead of the delete confirmation form. The user must
detach the DB first before the client can be deleted.

---

## Workflow

1. SA clicks **Delete** on an inactive client (from the `[⋯]` dropdown).
2. `DeleteClientDialog` opens with the selected `client`.
3. **If `client.db_name` is set** → render a blocking info panel:
   - No confirmation input.
   - No Delete button.
   - Only a **Close** button.
4. **If `client.db_name` is NOT set** → render the existing name-confirmation form unchanged.

---

## Steps

### Step 1 — Add message key in `messages.ts`
**File:** `src/constants/messages.ts`

Add a new key under the **Client CRUD** section (alphabetically):
```
ERROR_CLIENT_DELETE_HAS_DB: 'Cannot delete this client because a database is still attached. Please detach the database first using the Detach DB option, then delete the client.',
```

### Step 2 — Update `DeleteClientDialog` component
**File:** `src/features/super-admin/components/delete-client-dialog.tsx`

After the existing `if (!client) return null;` guard, add a conditional:

**When `client.db_name` is truthy** — render a "blocked" dialog body:
- Import `DatabaseIcon` from `lucide-react` (alongside existing `AlertTriangleIcon`).
- Replace the form content with:
  - An amber info box containing `DatabaseIcon` + the `MESSAGES.ERROR_CLIENT_DELETE_HAS_DB` text.
  - A secondary line showing the attached DB name in bold: `"Attached database: <db_name>"`.
  - A tip line: `"Use Detach DB from the client actions menu to remove the link first."`
- `DialogFooter`: only a **Close** button (`variant="outline"`, calls `onOpenChange(false)`).
- No form, no schema validation, no `handleConfirm` call.

**When `client.db_name` is falsy** — render the existing confirmation form completely unchanged.

No structural changes to `useForm`, `schema`, or `handleConfirm` — they remain in place
and are only reached when there is no attached DB.

### Step 3 — No other changes needed
- `clients-page.tsx`: already passes the full `ClientType` (including `db_name`) to
  `DeleteClientDialog` — no change.
- The **Delete** dropdown item is already restricted to inactive clients — no change.
- No backend changes required; the guard is purely client-side UX.

---

## Files Changed

| File | Change |
|---|---|
| `src/constants/messages.ts` | Add `ERROR_CLIENT_DELETE_HAS_DB` key |
| `src/features/super-admin/components/delete-client-dialog.tsx` | Conditional render: blocking info panel vs. confirmation form |
