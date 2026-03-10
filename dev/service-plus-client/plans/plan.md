# Plan: Move "Add Admin" into the Actions Dropdown

## Overview

The "Add Admin" button currently appears as a standalone button alongside "Initialize" in the
client card header. Move it into the `[⋯]` dropdown menu, keeping the same enable/disable logic.

---

## Workflow

```
Before:  [Initialize]  [+ Add Admin]  [⋯]
After:   [Initialize]                 [⋯]  ← dropdown now contains "Add Admin"
```

The dropdown "Add Admin" item is disabled when `canAddAdmin` is false
(same rule: `client.db_name && client.db_name_valid && client.is_active`).

---

## Steps

### Step 1 — Remove the standalone "Add Admin" button

**File:** `src/features/super-admin/pages/clients-page.tsx`

Remove the `<Button>` block (lines ~523–531):
```tsx
<Button
    className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
    disabled={!canAddAdmin}
    size="sm"
    onClick={() => handleCreateAdmin(client)}
>
    <PlusIcon className="mr-1 h-3 w-3" />
    Add Admin
</Button>
```

### Step 2 — Add "Add Admin" as a DropdownMenuItem

**File:** `src/features/super-admin/pages/clients-page.tsx`

Insert a new `DropdownMenuItem` at the top of the dropdown content (before "View"),
followed by a `DropdownMenuSeparator`:

```tsx
<DropdownMenuItem
    className="cursor-pointer text-emerald-600 focus:text-emerald-600"
    disabled={!canAddAdmin}
    onClick={() => handleCreateAdmin(client)}
>
    Add Admin
</DropdownMenuItem>
<DropdownMenuSeparator />
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/super-admin/pages/clients-page.tsx` | Remove standalone Add Admin button; add as first item in dropdown |
