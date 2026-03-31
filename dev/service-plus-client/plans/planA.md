# Plan: Fix Runtime and Build Errors — Client App

## Workflow
1. Identify and resolve missing dependencies (`xlsx`).
2. Fix type mismatches in form dialogs (`EditTechnicianDialog`, `EditVendorDialog`).
3. Resolve `recharts` type compatibility issues in `AuditLogsPage`.
4. Clean up unused variables and imports in Super Admin pages.
5. Verify the fix with a successful production build.

---

## Step 1 — Dependencies: Install `xlsx` and other missing modules
- Run `pnpm install` to ensure all dependencies in `package.json` (like `xlsx`) are present in `node_modules`.
- The build failed with `Cannot find module 'xlsx'`, which indicates a sync issue between `package.json` and `node_modules`.

---

## Step 2 — Frontend: `src/features/client/components/edit-technician-dialog.tsx`
- **Problem**: `Type 'unknown' is not assignable to type 'number'` in `zodResolver` and `onSubmit`.
- **Fix**: 
    - Ensure `EditTechnicianFormType` is explicitly passed to `useForm`.
    - Use `z.infer<typeof editTechnicianSchema>` but ensure the schema output matches the technician type exactly.
    - Check if `z.coerce.number()` is causing the `unknown` inference in some versions of `@hookform/resolvers/zod`.
    - Explicitly type the `onSubmit` data if needed.

---

## Step 3 — Frontend: `src/features/client/components/edit-vendor-dialog.tsx`
- **Problem**: Similar type mismatch with `state_id`.
- **Fix**: Apply the same type alignment used for the Technician dialog.

---

## Step 4 — Frontend: `src/features/super-admin/pages/audit-logs-page.tsx`
- **Problem 1**: `statsError` is declared but never read.
- **Problem 2**: Recharts `Tooltip` `formatter` type mismatch (expects `ValueType | undefined`).
- **Fix**:
    - Remove the unused `statsError` state or use it to show an error UI for stats specifically.
    - Update the `formatter` function signature to handle `undefined` or cast the value explicitly to satisfy the Recharts `Formatter` type: `(v: any) => [v, "Events"]`.

---

## Step 5 — Frontend: `src/features/super-admin/pages/super-admin-dashboard-page.tsx`
- **Problem**: Unused imports `ArrowRightIcon`, `RefreshCwIcon`, and `Link`.
- **Fix**: Remove the unused imports.

---

## Step 6 — Verification
- Run `pnpm run build`.
- Confirm "Found 0 errors".
- Verify that the app starts correctly with `pnpm run dev`.
