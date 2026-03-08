# Plan: Refresh Client Table After Initialize Client Step 1

## Context

After Step 1 of `InitializeClientDialog` succeeds (Create Database), the server saves `db_name`
back to the `client` table in `service_plus_client` DB. Currently the UI table is only refreshed
when the user clicks "Close" on the final success screen (via `onSuccess → refetch`).

Goal: also refresh the table immediately after Step 1 completes so the DB Name column shows the
new value without waiting for all 3 steps to finish.

---

## Workflow

```
User clicks "Initialize" → InitializeClientDialog opens at Step 1
  → User enters db_name, clicks "Create Database"
  → onStep1Submit() fires → createServiceDb mutation → server saves db_name on client row
  → [NEW] onStep1Success() callback fires → ClientsPage calls refetch()
  → Client table refreshes: DB Name column now shows the new db_name + validity icon
  → Dialog continues to Step 2 (Seed Data) and Step 3 (Admin User) as before
  → User clicks "Close" on success screen → onSuccess() → refetch() again (no-op, already fresh)
```

---

## Steps

### Step 1 — Add `onStep1Success` prop to `InitializeClientDialogPropsType`

File: `src/features/super-admin/components/initialize-client-dialog.tsx`

- Add `onStep1Success?: () => void` to `InitializeClientDialogPropsType`.
- Sort props alphabetically (keep consistent with existing convention).

### Step 2 — Call `onStep1Success` inside `onStep1Submit`

File: `src/features/super-admin/components/initialize-client-dialog.tsx`

- After `setStep(2)` and `toast.success(MESSAGES.SUCCESS_INITIALIZE_DB)` in `onStep1Submit`,
  add `onStep1Success?.()`.

### Step 3 — Pass `refetch` as `onStep1Success` in `ClientsPage`

File: `src/features/super-admin/pages/clients-page.tsx`

- In the `<InitializeClientDialog ... />` JSX, add `onStep1Success={refetch}`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/super-admin/components/initialize-client-dialog.tsx` | Add `onStep1Success?` prop; call it on step 1 success |
| `src/features/super-admin/pages/clients-page.tsx` | Pass `refetch` as `onStep1Success` |
