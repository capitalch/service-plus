# Master Plan: Migrate All Forms to FormProvider / useFormContext

## Goal

Every data-entry and data-update surface in the codebase should follow one unified pattern:

```
Section (parent)
  ├── useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" })
  ├── const executeSave = async (values: FormValues) => { /* Apollo mutation */ }
  ├── <Button onClick={form.handleSubmit(executeSave)} disabled={!form.formState.isValid || form.formState.isSubmitting} />
  └── <FormProvider {...form}>
        <ChildForm />          ← uses useFormContext(), no useForm, no props for form state
      </FormProvider>

Dialog (self-contained – no child form component needed)
  ├── useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" })
  ├── const onSubmit = form.handleSubmit(async (values) => { /* mutation */ })
  └── <form onSubmit={onSubmit}> … <Button type="submit" disabled={!isValid || isSubmitting} /> </form>
```

### What changes in every step
| Remove from child/form | Add to child/form | Remove from parent/section | Add to parent/section |
|---|---|---|---|
| `useForm(...)` | `useFormContext<FormValues>()` | `submitTrigger` state | `useForm(...)` |
| `zodResolver(...)` | — | `IsValidReporter` wiring | `executeSave` function |
| `executeSave` | — | `onStatusChange` callback | `FormProvider` wrapper |
| `submitTrigger` prop | — | `newFormValid` state | Save button: `onClick={form.handleSubmit(executeSave)}` |
| `IsValidReporter` | — | `submitting` state (use `form.formState.isSubmitting`) | — |
| `onStatusChange` prop | — | — | — |

### What stays unchanged in every step
- All GraphQL / Apollo mutation logic.
- JSX layout, Tailwind classes, table structures.
- `useFieldArray` / line-item `useState` arrays (keep as-is until explicitly stated otherwise).
- `PartCodeInput` DOM refs (`partInputRefs`, `qtyInputRefs`).
- Edit-mode data loading (`useEffect` on `editXxx` → `form.reset({...})`).
- Props that carry business data (`branchId`, `txnTypes`, `editXxx`, `vendors`, etc.).

---

## Current State Snapshot (before this plan)

| Form | Current pattern | Target |
|---|---|---|
| `new-single-job-form.tsx` | ✅ `useFormContext` (DONE) | — |
| `single-job-section.tsx` | ✅ `FormProvider` + `executeSave` (DONE) | — |
| `opening-job-form.tsx` | ✅ `useFormContext` (DONE) | — |
| `new-batch-job-form.tsx` | ✅ `useFormContext` (DONE) | — |
| `new-receipt-form.tsx` | ✅ `useFormContext` (DONE) | — |
| `new-part-used-form.tsx` | raw `useState` + `submitTrigger` | → `useFormContext` |
| `new-loan-entry.tsx` | `useForm` in child + `submitTrigger` | → `useFormContext` |
| `new-branch-transfer.tsx` | `useForm` in child + `submitTrigger` | → `useFormContext` |
| `new-stock-adjustment.tsx` | `useForm` in child + `submitTrigger` | → `useFormContext` |
| `new-opening-stock.tsx` | `useForm` in child + `submitTrigger` | → `useFormContext` |
| `new-sales-invoice.tsx` | `useForm` (hybrid) in child + `submitTrigger` | → `useFormContext` |
| `new-purchase-invoice.tsx` | raw `useState` + `submitTrigger` | → `useFormContext` |
| `update-job-section.tsx` | raw `useState` (inline form, no child) | → local `useForm` |
| `deliver-job-section.tsx` | raw `useState` (inline form, no child) | → local `useForm` |
| `ready-for-delivery-section.tsx` | raw `useState` + line items | → local `useForm` |
| All master add/edit dialogs | mostly already `useForm` ✅ | clean up `submitting` state |
| `set-part-location-dialog.tsx` | raw `useState` | → local `useForm` |
| `set-location-for-selected-dialog.tsx` | raw `useState` | → local `useForm` |
| `import-part-dialog.tsx` | raw `useState` (file-wizard) | no-op (not a field form) |
| `associate-bu-role-dialog.tsx` | raw `useState` | → local `useForm` |

---

## Execution Steps

Each step is a single form unit. Complete, verify (`npx tsc --noEmit`), then proceed to the next.

---

### Step 1 — Opening Job Form ✅ DONE

**Files:** `opening-job-form.tsx` + `opening-job-section.tsx`

**Current state:** `opening-job-form.tsx` owns `useForm`, `zodResolver`, `executeSave`, and `IsValidReporter`. The section passes `submitTrigger` and wires `onStatusChange`.

**Schema location:** Schema and `FormValues` type are currently defined inline inside `opening-job-form.tsx`.

**Actions — `opening-job-form.tsx` (child):**
1. Extract the `z.object({...})` schema and `FormValues` type into a new sibling file `opening-job-schema.ts` (same directory). Export `openingJobFormSchema`, `OpeningJobFormValues`, `getOpeningJobDefaultValues()`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `handleReset`, and the `submitTrigger` `useEffect`.
3. Replace `const form = useForm<FormValues>(...)` with `const form = useFormContext<OpeningJobFormValues>()`.
4. Remove props: `submitTrigger`, `onStatusChange`, `onSuccess`. Keep all business-data props (`branchId`, `jobTypes`, `editJob`, etc.).
5. Remove `IsValidReporter` import and JSX usage.
6. Keep all `setValue(...)` calls for `SearchableCombobox`/`CustomerInput` driven fields — they now call `form.setValue` from context.
7. Keep edit-mode `useEffect` → `form.reset({...})` unchanged.

**Actions — `opening-job-section.tsx` (parent):**
1. Import `openingJobFormSchema`, `OpeningJobFormValues`, `getOpeningJobDefaultValues` from `opening-job-schema.ts`.
2. Add `const form = useForm<OpeningJobFormValues>({ defaultValues: getOpeningJobDefaultValues(), mode: "onChange", resolver: zodResolver(openingJobFormSchema) as any })`.
3. Move `executeSave` from the child into the section. It takes `(values: OpeningJobFormValues)` as first argument.
4. Change Save button: `onClick={form.handleSubmit(executeSave)}`, `disabled={!form.formState.isValid || form.formState.isSubmitting}`.
5. Change Reset button: `onClick={() => { setEditJob(null); form.reset(getOpeningJobDefaultValues()); }}`.
6. Remove `submitTrigger` state, `newFormValid` state, `submitting` state, `onStatusChange` callback.
7. Wrap `<OpeningJobForm>` with `<FormProvider {...form}>...</FormProvider>`.
8. Remove `ref={formRef}` / `submitTrigger={...}` / `onStatusChange={...}` / `onSuccess={...}` props from `<OpeningJobForm>`.

**Verify:** `npx tsc --noEmit`

---

### Step 2 — Batch Job Form ✅ DONE

**Files:** `new-batch-job-form.tsx` + `batch-job-section.tsx`

**Current state:** Same `submitTrigger` pattern as opening-job. `executeSave` lives in the child. The form has line-item rows (`rows` useState array for batch assignments).

**Schema location:** Inline in `new-batch-job-form.tsx`.

**Actions — `new-batch-job-form.tsx` (child):**
1. Extract schema + `FormValues` type + `getBatchJobDefaultValues()` into `batch-job-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `const form = useFormContext<BatchJobFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props.
5. Remove `IsValidReporter` JSX.
6. Keep `rows` (line-item) `useState` array and all its mutations — these are not part of the Zod schema.
7. Keep `rowsValid` computed boolean. Expose it via a `useEffect` that calls `form.trigger()` or, simpler: add a hidden `<input>` that is set invalid when `!rowsValid` — OR expose `rowsValid` via a context/prop. **Recommended approach:** pass `rowsValid` up with an `onRowsValidChange: (v: boolean) => void` prop so the section can combine it into the Save button's `disabled` state: `disabled={!form.formState.isValid || !rowsValid || form.formState.isSubmitting}`.
8. Keep edit-mode `useEffect` → `form.reset(...)`.

**Actions — `batch-job-section.tsx` (parent):**
1. Import schema artefacts from `batch-job-schema.ts`.
2. Add `useForm` instance.
3. Move `executeSave` into the section (reads `values` from RHF, reads `rows` via a ref or passed down callback — **recommended:** pass `rows` up via `onRowsChange` or keep rows in the section and pass them down as a prop).
4. Add `const [rowsValid, setRowsValid] = useState(false)` in section.
5. Wire Save button: `disabled={!form.formState.isValid || !rowsValid || form.formState.isSubmitting}`.
6. Remove `submitTrigger`, `newFormValid`, `submitting` states.
7. Wrap child with `<FormProvider {...form}>`.

**Verify:** `npx tsc --noEmit`

---

### Step 3 — Job Receipts Form ✅ DONE

**Files:** `new-receipt-form.tsx` + `receipts-section.tsx`

**Current state:** `new-receipt-form.tsx` already uses `useForm` + `zodResolver`. No line items.

**Schema location:** Inline in `new-receipt-form.tsx` (simple schema: `job_id`, `receipt_date`, `amount`, `payment_mode`, `reference_no`, `remarks`).

**Actions — `new-receipt-form.tsx` (child):**
1. Extract schema + `FormValues` type + `getReceiptDefaultValues()` into `receipt-form-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `const form = useFormContext<ReceiptFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props. Keep `initial` (edit data) prop.
5. Remove `IsValidReporter` JSX.
6. Keep edit-mode `useEffect` → `form.reset(...)`.

**Actions — `receipts-section.tsx` (parent):**
1. Import schema artefacts from `receipt-form-schema.ts`.
2. Add `useForm` instance.
3. Move `executeSave` into section; it receives `(values: ReceiptFormValues)`.
4. Wire Save button directly.
5. Remove `submitTrigger`, `formValid`, `formSubmitting` states.
6. Wrap `<NewReceiptForm>` with `<FormProvider {...form}>`.

**Verify:** `npx tsc --noEmit`

---

### Step 4 — Loan Entry Form ✅ DONE

**Files:** `new-loan-entry.tsx` + `loan-entry-section.tsx`

**Current state:** `useForm` in child + `submitTrigger`. Has line items (`lines` useState array).

**Schema:** Header only — `{ entry_date, ref_no, remarks }`. Lines stay in `useState`.

**Actions — `new-loan-entry.tsx` (child):**
1. Extract schema + `FormValues` + `getLoanEntryDefaultValues()` into `loan-entry-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `useFormContext<LoanEntryFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props.
5. Remove `IsValidReporter` JSX.
6. Keep `lines` useState and `linesValid` computation. Pass `linesValid` up via `onLinesValidChange` prop (same pattern as batch-job Step 2).

**Actions — `loan-entry-section.tsx` (parent):**
1. Import schema artefacts.
2. Add `useForm` instance.
3. Move `executeSave` into section — it receives `(values: LoanEntryFormValues)` and reads `lines` via a lines ref or state lifted to section.
4. Add `const [linesValid, setLinesValid] = useState(false)` in section.
5. Save button: `disabled={!form.formState.isValid || !linesValid || form.formState.isSubmitting}`.
6. Remove `submitTrigger`, `newFormValid`, `submitting`.
7. Wrap with `<FormProvider {...form}>`.

**Verify:** `npx tsc --noEmit`

---

### Step 5 — Branch Transfer Form ✅ DONE

**Files:** `new-branch-transfer.tsx` + `branch-transfer-section.tsx`

**Current state:** `useForm` in child + `submitTrigger`. Schema: `{ transfer_date, to_branch_id, ref_no, remarks }`. Has line items.

**Special note:** `to_branch_id` is driven by shadcn `<Select>` — wired via `setValue("to_branch_id", v, { shouldValidate: true })` and read via `watch("to_branch_id")`. This continues to work identically with `useFormContext`.

**Actions — `new-branch-transfer.tsx` (child):**
1. Extract schema + `FormValues` + `getBranchTransferDefaultValues()` into `branch-transfer-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `useFormContext<BranchTransferFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props. Keep `branches`, `branchId`, `editTransfer`, `brandName`, etc.
5. Remove `IsValidReporter` JSX.
6. Lift `lines` to section or pass `linesValid` up via `onLinesValidChange`.

**Actions — `branch-transfer-section.tsx` (parent):**
1. Standard recipe: import schema, `useForm`, move `executeSave`, remove trigger wiring, wrap with `FormProvider`.

**Verify:** `npx tsc --noEmit`

---

### Step 6 — Stock Adjustment Form ✅ DONE

**Files:** `new-stock-adjustment.tsx` + `stock-adjustment-section.tsx`

**Current state:** `useForm` in child + `submitTrigger`. Schema: `{ adjustment_date, adjustment_reason, ref_no, remarks }`. Has line items.

**Actions — `new-stock-adjustment.tsx` (child):**
1. Extract schema + `FormValues` + `getStockAdjDefaultValues()` into `stock-adjustment-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `useFormContext<StockAdjFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props.
5. Remove `IsValidReporter` JSX.
6. Lift `lines` to section or pass `linesValid` up via `onLinesValidChange`.

**Actions — `stock-adjustment-section.tsx` (parent):**
1. Standard recipe.

**Verify:** `npx tsc --noEmit`

---

### Step 7 — Opening Stock Form ✅ DONE

**Files:** `new-opening-stock.tsx` + `opening-stock-section.tsx`

**Current state:** `useForm` in child + `submitTrigger`. Schema: `{ entry_date, ref_no, remarks }`. Has line items.

**Actions — `new-opening-stock.tsx` (child):**
1. Extract schema + `FormValues` + `getOpeningStockDefaultValues()` into `opening-stock-schema.ts`.
2. Remove `useForm`, `zodResolver`, `executeSave`, `submitTrigger` effect.
3. Replace with `useFormContext<OpeningStockFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props.
5. Remove `IsValidReporter` JSX.
6. Lift `lines` to section or pass `linesValid` up via `onLinesValidChange`.

**Actions — `opening-stock-section.tsx` (parent):**
1. Standard recipe.

**Verify:** `npx tsc --noEmit`

---

### Step 8 — Sales Invoice Form ✅ DONE

**Files:** `new-sales-invoice.tsx` + `sales-entry-section.tsx`

**Current state:** Hybrid `useForm` in child (only `invoice_date` + `remarks` in schema). Customer fields (`customerId`, `customerName`, `customerGstin`, `customerStateCode`) remain as `useState` because they are driven by `CustomerInput` / `SearchableCombobox`. Line items in `useState`.

**Actions — `new-sales-invoice.tsx` (child):**
1. Extract schema (`{ invoice_date, remarks }`) + `FormValues` + `getSalesInvoiceDefaultValues()` into `sales-invoice-schema.ts`.
2. Remove `useForm`, `zodResolver`, `submitTrigger` effect.
3. Replace with `useFormContext<SalesInvoiceFormValues>()`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props. Keep `isIgst`, `setIsIgst`, `isReturn`, `onIsReturnChange`, `selectedBrandId`, `brandName`, `editInvoice`, `customerTypes`, `masterStates`, `txnTypes`.
5. Remove `IsValidReporter` JSX.
6. Keep `customerId`, `customerName`, `customerGstin`, `customerStateCode` as `useState` — these are non-schema state.
7. Move `executeSave` to section. It needs form values + customer state + lines. **Approach:** lift customer state and `lines` to the section, OR keep them in the child and expose via a forwarded ref callback. **Recommended:** lift `customerId`, `customerName`, `customerGstin`, `customerStateCode`, `lines`, `linesValid` to the section as state, pass them down as props. The child just renders the fields.
8. Expose combined validity for Save button: the section computes `const canSave = form.formState.isValid && !!customerId && !!customerName.trim() && !!customerStateCode && !!selectedBrandId && linesValid`.

**Actions — `sales-entry-section.tsx` (parent):**
1. Import schema artefacts.
2. Add `useForm` instance.
3. Lift customer fields and `lines` state to section.
4. Move `executeSave` into section.
5. Save button: `disabled={!canSave || form.formState.isSubmitting}`.
6. Remove `submitTrigger`, `newFormValid`, `submitting`.
7. Wrap with `<FormProvider {...form}>`.

**Verify:** `npx tsc --noEmit`

---

### Step 9 — Purchase Invoice Form ✅ DONE

**Files:** `new-purchase-invoice.tsx` + `purchase-entry-section.tsx`

**Current state:** All fields in `useState` (no RHF at all). 2-step submit flow: physical check modal → master-data diff modal → `executeSave`. Schema to create: `{ vendor_id: number, invoice_no: string, invoice_date: string, remarks: string }`. Lines stay in `useState`.

**Actions — `new-purchase-invoice.tsx` (child):**
1. Create `purchase-invoice-schema.ts` with `purchaseInvoiceSchema`, `PurchaseInvoiceFormValues`, `getPurchaseInvoiceDefaultValues()`.
2. Remove `IsValidReporter`, `submitTrigger` effect. Remove `isFormValid` `useMemo`.
3. Replace `vendorId`, `invoiceNo`, `invoiceDate`, `remarks` `useState` fields with `useFormContext<PurchaseInvoiceFormValues>()`.
   - `vendorId` → `form.watch("vendor_id")` + `form.setValue("vendor_id", v, { shouldValidate: true })` in `SearchableCombobox.onSelect`.
   - `invoiceNo` → `register("invoice_no")`.
   - `invoiceDate` → `register("invoice_date")`.
   - `remarks` → `register("remarks")`.
4. Remove `submitTrigger`, `onStatusChange`, `onSuccess` props.
5. Keep `physicalTotal`, `physicalQty`, `physicalCgst`, `physicalSgst`, `physicalIgst`, `showPhysicalCheckModal`, `masterDiffLines`, `lines`, `originalLineIds`, `invoiceExists`, `checkingDuplicate` as `useState` — unchanged.
6. Keep `isFormValid` but now derive it from `form.formState.isValid && !invoiceExists && !checkingDuplicate && linesValid`.
7. The save button trigger is driven from the section via `form.handleSubmit`. But the 2-step modal flow means `handleSubmit` (the guard that opens the physical check modal) is called instead of `executeSave` directly. **Approach:** the section's Save button calls `form.handleSubmit(openPhysicalCheckModal)` — the RHF `handleSubmit` validates header fields, then calls `openPhysicalCheckModal(values)` which stores values and opens the modal. `executeSave` calls `form.getValues()` (or reads from stored values).

**Actions — `purchase-entry-section.tsx` (parent):**
1. Import schema artefacts.
2. Add `useForm` instance.
3. Save button: `form.handleSubmit(openPhysicalCheckModal)` (passed as prop or used inline).
4. `disabled={!form.formState.isValid || !linesValid || ...}`.
5. Remove `submitTrigger`, `newFormValid`, `submitting`.
6. Wrap with `<FormProvider {...form}>`.

**Verify:** `npx tsc --noEmit`

---

### Step 10 — Part Used Form ✅ DONE

**Files:** `new-part-used-form.tsx` + `part-used-section.tsx`

**Current state:** All `useState`. No header "schema" fields per se — the only required "header" is selecting a job. Lines in `useState`.

**Schema to create:** `{ job_id: number }` (or keep job selection entirely in `useState` and skip RHF for this form — see note below).

**Note:** This form has no traditional header fields (date, remarks are optional if added). The "validity" is purely: a job is selected AND at least one valid new line OR a deletion. **Recommended approach:** create a minimal schema `{ job_id: z.number().positive() }`. The `selectedJob` selected via `SearchableCombobox` drives `form.setValue("job_id", job.id)`. `linesValid` passed via `onLinesValidChange`.

**Actions — `new-part-used-form.tsx` (child):**
1. Create `part-used-schema.ts` with schema `{ job_id: z.number().int().positive() }`.
2. Remove `IsValidReporter`, `submitTrigger` effect.
3. Replace `selectedJob` tracking: keep as `useState<JobSearchRow | null>` for display, but also call `form.setValue("job_id", job.id, { shouldValidate: true })` on select. On clear: `form.setValue("job_id", 0, { shouldValidate: true })`.
4. Remove `submitTrigger`, `onStatusChange` props.
5. Move `executeSave` to section. It reads form values (`values.job_id`) and `newLines` / `deletedIds` (lifted to section or passed up via callback).
6. Pass `linesValid` up via `onLinesValidChange`.

**Actions — `part-used-section.tsx` (parent):**
1. Standard recipe. Save button: `disabled={!form.formState.isValid || !linesValid || form.formState.isSubmitting}`.

**Verify:** `npx tsc --noEmit`

---

### Step 11 — Update Job Section (inline form, no child) ✅ DONE

**File:** `update-job-section.tsx`

**Current state:** Inline `useState` for `jobStatusId`, `technicianId`, `diagnosis`, `workDone`. No child form component. Single `apolloClient.mutate` call.

**Schema to create:** `{ job_status_id: string, technician_id: string, diagnosis: string, work_done: string }` (all optional strings since they are nullable in DB).

**Actions — `update-job-section.tsx`:**
1. Add `useForm` locally (no `FormProvider` needed — no child component).
2. Define inline schema or create `update-job-schema.ts`.
3. Replace `jobStatusId`, `technicianId`, `diagnosis`, `workDone` `useState` with `register(...)` / `watch(...)` / `setValue(...)`.
4. Remove `submitting` state — use `form.formState.isSubmitting` (or keep `submitting` if the mutation is not inside `handleSubmit`).
5. Wire the Save button with `form.handleSubmit(executeSave)`.

**Verify:** `npx tsc --noEmit`

---

### Step 12 — Deliver Job Section (inline form, no child) ✅ DONE

**File:** `deliver-job-section.tsx`

**Current state:** Inline `useState` for `deliveryDate`, `deliveryMannerName`, `transactionNotes`, `paymentDate`, `paymentMode`, `paymentAmount`, `paymentReferenceNo`, `paymentRemarks`. No child component.

**Schema to create:**
```ts
z.object({
  delivery_date:      z.string().min(1),
  delivery_manner:    z.string().min(1),
  transaction_notes:  z.string().optional(),
  payment_date:       z.string().min(1),
  payment_mode:       z.string().min(1),
  payment_amount:     z.coerce.number().min(0),
  payment_reference:  z.string().optional(),
  payment_remarks:    z.string().optional(),
})
```

**Actions — `deliver-job-section.tsx`:**
1. Add local `useForm` with schema above.
2. Replace all field `useState` with `register(...)` / `watch(...)`.
3. Wire Save button with `form.handleSubmit(executeSave)`.
4. Remove `submitting` state if not needed outside `handleSubmit`.

**Verify:** `npx tsc --noEmit`

---

### Step 13 — Ready for Delivery Section (inline form, no child)

**File:** `ready-for-delivery-section.tsx`

**Current state:** Inline `useState` for `invoiceDate`, `supplyStateCode`, `isIgst`, `lines` (line items). This is effectively an inline invoice creation form with no separate child component.

**Schema to create:** `{ invoice_date: z.string().min(1), supply_state_code: z.string().min(1) }`. `isIgst` derived from state code comparison (keep as derived `useMemo`). Lines stay in `useState`.

**Actions — `ready-for-delivery-section.tsx`:**
1. Add local `useForm` with schema.
2. Replace `invoiceDate`, `supplyStateCode` `useState` with RHF fields.
3. `linesValid` remains a `useMemo` over the `lines` array.
4. Save button: `disabled={!form.formState.isValid || !linesValid || form.formState.isSubmitting}`.
5. Wire: `form.handleSubmit(executeSave)`.

**Verify:** `npx tsc --noEmit`

---

### Step 14 — Set Part Location Dialog

**File:** `set-part-location-dialog.tsx`

**Current state:** Pure `useState` for `txnDate`, `refNo`, `remarks`, `applyToAll`, `lines`.

**Schema to create:** `{ txn_date: z.string().min(1), ref_no: z.string().optional(), remarks: z.string().optional() }`. Lines stay in `useState`.

**Actions — `set-part-location-dialog.tsx`:**
1. Add local `useForm` with schema.
2. Replace `txnDate`, `refNo`, `remarks` `useState` with RHF fields.
3. `linesValid` from `useMemo` over `lines`.
4. Submit button: `disabled={!form.formState.isValid || !linesValid || form.formState.isSubmitting}`.
5. Wire submit handler.

**Verify:** `npx tsc --noEmit`

---

### Step 15 — Set Location for Selected Dialog

**File:** `set-location-for-selected-dialog.tsx`

**Current state:** Pure `useState` for `locationId`, `rowLocationIds`, `txnDate`, `refNo`, `remarks`.

**Schema to create:** `{ txn_date: z.string().min(1), ref_no: z.string().optional(), remarks: z.string().optional() }`. `locationId` and `rowLocationIds` stay in `useState`.

**Actions — `set-location-for-selected-dialog.tsx`:**
1. Add local `useForm` with schema.
2. Replace `txnDate`, `refNo`, `remarks` with RHF.
3. Wire submit button.

**Verify:** `npx tsc --noEmit`

---

### Step 16 — Associate BU Role Dialog

**File:** `associate-bu-role-dialog.tsx`

**Current state:** Pure `useState` for `selectedBuIds`, `selectedRoleId`, `submitting`.

**Schema to create:** `{ role_id: z.string().min(1) }`. `selectedBuIds` stays in `useState`.

**Actions — `associate-bu-role-dialog.tsx`:**
1. Add local `useForm` with schema `{ role_id: z.string().min(1) }`.
2. Wire `roleId` field: `setValue("role_id", v, { shouldValidate: true })`.
3. Submit button: `disabled={!form.formState.isValid || selectedBuIds.length === 0 || form.formState.isSubmitting}`.
4. Remove `submitting` state — use `form.formState.isSubmitting`.
5. Wrap mutation in `form.handleSubmit(executeSave)`.

**Verify:** `npx tsc --noEmit`

---

### Step 17 — Clean up `submitting` state in already-migrated dialogs

**Files (all already use `useForm`):**
- `add-branch-dialog.tsx` / `edit-branch-dialog.tsx`
- `add-customer-dialog.tsx` / `edit-customer-dialog.tsx`
- `add-model-dialog.tsx` / `edit-model-dialog.tsx`
- `add-technician-dialog.tsx` / `edit-technician-dialog.tsx`
- `add-vendor-dialog.tsx` / `edit-vendor-dialog.tsx`
- `add-financial-year-dialog.tsx` / `edit-financial-year-dialog.tsx`
- `add-part-location-dialog.tsx` / `edit-part-location-dialog.tsx`
- `add-product-dialog.tsx` / `edit-product-dialog.tsx`
- `add-state-dialog.tsx` / `edit-state-dialog.tsx`
- `edit-app-setting-dialog.tsx`
- `add-lookup-dialog.tsx` / `edit-lookup-dialog.tsx`
- `create-business-user-dialog.tsx` / `edit-business-user-dialog.tsx`
- `create-business-unit-dialog.tsx` / `edit-business-unit-dialog.tsx`
- `company-profile-section.tsx`
- `document-sequence-section.tsx`

**Current state:** All use `useForm` + `zodResolver` correctly. But most still have a separate `const [submitting, setSubmitting] = useState(false)` that they manually set around the mutation, instead of using `form.formState.isSubmitting`.

**Actions for each dialog:**
1. Remove `const [submitting, setSubmitting] = useState(false)`.
2. Replace `setSubmitting(true)` / `setSubmitting(false)` with nothing — `form.formState.isSubmitting` is automatically `true` while `handleSubmit` is running an async submit handler.
3. Replace `disabled={submitting}` on submit buttons with `disabled={form.formState.isSubmitting}`.
4. Ensure the mutation lives **inside** the `handleSubmit` callback (i.e. passed to `form.handleSubmit(async (values) => { ... mutate ... })`), not called separately.

**Note:** `checkingDuplicate`, `checkingCode`, `checkingName`, etc. stay as `useState` — they are async side-effects, not submit state.

**Verify:** `npx tsc --noEmit`

---

### Step 18 — Remove `IsValidReporter` and `submitTrigger` from the entire codebase

After Steps 1–10 are complete, no component should reference `IsValidReporter` or `submitTrigger` anymore.

**Actions:**
1. Delete `src/features/client/components/is-valid-reporter.tsx`.
2. Search for any remaining `submitTrigger`, `IsValidReporter`, `onStatusChange` (the form-status variant) references — remove them.
3. Confirm `npx tsc --noEmit` and `npx vite build` both pass clean.

---

## Final Verification

After all steps are complete:

```bash
npx tsc --noEmit
npx vite build
```

Browser smoke test for each form:
1. Open the form — fields render, Save is disabled.
2. Fill required fields — Save enables.
3. Click Save — data persists, form resets.
4. Open edit mode — form pre-fills correctly.
5. Edit and save — update persists.

---

## Notes on Line-Item Arrays

For forms with `lines: LineType[]` in `useState`, the plan **does not require migrating lines to `useFieldArray`**. The simpler approach (lines in `useState`, validity exposed via a `onLinesValidChange` prop or lifted to the section) is intentional — it avoids rewriting all `PartCodeInput` DOM-ref management and keeps the diff small. A future plan can migrate individual line arrays to `useFieldArray` if desired.
