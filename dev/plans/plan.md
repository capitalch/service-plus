# Plan: Business Unit Code & Name Validation

## Objective
Update the `create-business-unit-dialog.tsx` validation schema so that:
- **Code**: length 5–8 (> 4 and < 9), alphanumeric + `_` only, no space, no `-`, no other special chars
- **Name**: alphanumeric + space only, no special chars

---

## Workflow

```
[User opens Add Business Unit dialog]
        │
        ▼
  Enters Code (5–8 chars, a-z A-Z 0-9 _ only)
        │
        ▼
  Real-time uniqueness check (debounced 1200ms) — unchanged
        │
        ▼
  Enters Name (alphanumeric + space only)
        │
        ▼
  Submits → validation passes → BU created
```

---

## Step 1 — Update Zod schema in `create-business-unit-dialog.tsx`

File: `service-plus-client/src/features/admin/components/create-business-unit-dialog.tsx`

Change the `createBusinessUnitSchema`:

| Field | Old rule | New rule |
|-------|----------|----------|
| `code` | min 1, max 20, `/^[a-zA-Z0-9_]+$/` | min 5 (`"Code must be at least 5 characters"`), max 8 (`"Code must be 8 characters or fewer"`), `/^[a-zA-Z0-9_]+$/` (`"Code can only contain letters, numbers and underscores. No spaces or hyphens."`) |
| `name` | `min(2)` only | `min(2)`, `/^[a-zA-Z0-9 ]+$/` (`"Name can only contain letters, numbers and spaces."`) |

New schema:
```typescript
const createBusinessUnitSchema = z.object({
    code: z
        .string()
        .min(5, "Code must be at least 5 characters")
        .max(8, "Code must be 8 characters or fewer")
        .regex(/^[a-zA-Z0-9_]+$/, "Code can only contain letters, numbers and underscores. No spaces or hyphens."),
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .regex(/^[a-zA-Z0-9 ]+$/, "Name can only contain letters, numbers and spaces."),
});
```

---

## Step 2 — Verify no other files need changes

- `edit-business-unit-dialog.tsx` — code is read-only; only `name` is editable. Apply the same name regex there too.
- No backend changes needed (DB constraint is on uniqueness, not length/format — these are UI-only rules).

### Name validation update for `edit-business-unit-dialog.tsx`

File: `service-plus-client/src/features/admin/components/edit-business-unit-dialog.tsx`

Add regex to name field:
```typescript
name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .regex(/^[a-zA-Z0-9 ]+$/, "Name can only contain letters, numbers and spaces."),
```
