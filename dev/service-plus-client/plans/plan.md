# Plan: Fix `result.errors` Dead Code in Apollo Client 4.x Mutations

## Problem

In Apollo Client 4.x, `apolloClient.mutate()` **throws** an `ApolloError` when GraphQL errors occur — it never silently returns them in `result.errors`. The pattern `const result = await apolloClient.mutate(...)` followed by `if (result.errors)` is therefore dead code and the `result` variable is unused.

**Fix for each file:**
1. Remove `const result =` — change to plain `await apolloClient.mutate(...)`
2. Remove the `if (result.errors) { ... return; }` block
3. The `catch` block already handles all error cases

---

## Workflow

Find all occurrences → fix each file → verify with `pnpm tsc --noEmit`.

---

## Files to Fix (8 files)

| # | File | Line |
|---|------|------|
| 1 | `src/features/admin/components/associate-bu-role-dialog.tsx` | 170 |
| 2 | `src/features/admin/components/create-business-unit-dialog.tsx` | 163 |
| 3 | `src/features/admin/components/deactivate-business-unit-dialog.tsx` | 59 |
| 4 | `src/features/admin/components/deactivate-business-user-dialog.tsx` | 59 |
| 5 | `src/features/admin/components/delete-business-unit-dialog.tsx` | 59 |
| 6 | `src/features/admin/components/delete-business-user-dialog.tsx` | 60 |
| 7 | `src/features/admin/components/edit-business-unit-dialog.tsx` | 108 |
| 8 | `src/features/admin/components/edit-business-user-dialog.tsx` | 185 |

*(Already fixed: `activate-business-unit-dialog.tsx`, `activate-business-user-dialog.tsx`)*

---

## Steps

### Step 1 — Fix `associate-bu-role-dialog.tsx` (line 170)
Remove `const result =` and `if (result.errors)` block.

### Step 2 — Fix `create-business-unit-dialog.tsx` (line 163)
Remove `const result =` and `if (result.errors)` block.

### Step 3 — Fix `deactivate-business-unit-dialog.tsx` (line 59)
Remove `const result =` and `if (result.errors)` block.

### Step 4 — Fix `deactivate-business-user-dialog.tsx` (line 59)
Remove `const result =` and `if (result.errors)` block.

### Step 5 — Fix `delete-business-unit-dialog.tsx` (line 59)
Remove `const result =` and `if (result.errors)` block.

### Step 6 — Fix `delete-business-user-dialog.tsx` (line 60)
Remove `const result =` and `if (result.errors)` block.

### Step 7 — Fix `edit-business-unit-dialog.tsx` (line 108)
Remove `const result =` and `if (result.errors)` block.

### Step 8 — Fix `edit-business-user-dialog.tsx` (line 185)
Remove `const result =` and `if (result.errors)` block.

### Step 9 — Verify
Run `pnpm tsc --noEmit` — expect exit code 0.
