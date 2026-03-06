# Plan: Show check sign in DB Name cell when db_name_valid is true

## Current State
The DB Name cell in `clients-page.tsx` shows a red `XCircleIcon` when
`client.db_name && !client.db_name_valid`. No icon is shown when the database is valid.

## Requirement
Show a green check sign next to `db_name` when `client.db_name_valid` is `true`.

---

## Steps

### Step 1 – Add CheckCircle2Icon usage in the DB Name cell
`CheckCircle2Icon` is already imported in `clients-page.tsx`.
In the DB Name `<TableCell>`, add a condition:
- `client.db_name && client.db_name_valid`  → render `CheckCircle2Icon` in green
- `client.db_name && !client.db_name_valid` → render `XCircleIcon` in red (already done)
- `!client.db_name`                         → render `"—"`, no icon

---

## Workflow

```
DB Name cell render
        |
        +-- db_name is null/empty  →  "—"  (no icon)
        |
        +-- db_name has value
                |
                +-- db_name_valid = true   →  db_name + ✔ (CheckCircle2Icon, green)
                |
                +-- db_name_valid = false  →  db_name + ✗ (XCircleIcon, red)
```

## Files Changed
- `../service-plus-client/src/features/super-admin/pages/clients-page.tsx`
  - DB Name `<TableCell>`: add green `CheckCircle2Icon` when `client.db_name && client.db_name_valid`
