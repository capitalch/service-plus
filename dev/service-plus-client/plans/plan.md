# Implementation Plan — tran.md Items

---

## Item 1 — Delivery Modal: Create Invoice & Receipts refresh

**Status:** Already implemented.  
`handleCreateInvoices` (delivery-modal.tsx ~line 295) calls `reloadJobDetails()` which calls `setJobDetails(fresh)`. Both `DeliveryModalInvoicesSection` and `DeliveryModalReceiptsSection` receive `jobs={jobDetails}` so they re-render automatically.

No code change needed.

---

## Item 2 — Delivery Modal: Disable "Create Invoice & Receipts" when no charges

**File:** `delivery-modal.tsx` line 220

**Current:**
```typescript
const hasEligiblePending = jobDetails.some(j => isJobInvoiceable(j.job_type_code, j.job_status_code) && !j.invoice_id);
```

**Change to:**
```typescript
const hasEligiblePending = jobDetails.some(j =>
    isJobInvoiceable(j.job_type_code, j.job_status_code) && !j.invoice_id && Number(j.amount ?? 0) > 0
);
```

This makes `canCreateInvoices = false` when all invoiceable pending jobs have zero amount.

---

## Item 3 — Delivery Modal: Deliver & Close allowed when no charges

**Status:** Already works. `canDeliver = form.formState.isValid && !delivering && !!deliveredStatusId` — does not depend on invoices at all.

No code change needed.

---

## Item 4 — Money Receipt PDF: Professional format with division details

**File:** `deliver-job-pdf.ts` — `buildReceiptPdf` function (line ~697)

**Changes:**
1. Add optional `division: DivisionContextType | null` parameter to `buildReceiptPdf`
2. Add a division header block at the top of the receipt PDF:
   - Division name (bold, large font)
   - Address lines if available
   - GSTIN if GST division
   - Thin separator line beneath
3. Change title from "PAYMENT RECEIPT" to "RECEIPT" or keep same
4. After payment table, add "Received with Thanks" text (centered, italic or bold)

**Callers to update:**
- `delivery-modal.tsx` `handlePrintReceiptPdf` — pass `division` from `availableDivisions.find(d => d.id === job.division_id)`
- Jobs > Receipts PDF (item 5) will also pass division

**Note:** `DivisionContextType` is already imported in `deliver-job-pdf.ts`.

---

## Item 5 — Jobs > Receipts: Show PDF button

**Files:**
- `receipts-section.tsx`
- Import `buildReceiptPdf` from deliver-job-pdf and `PdfPreviewModal`

**Changes in `receipts-section.tsx`:**
1. Add state: `const [pdfRow, setPdfRow] = useState<JobReceiptListRowType | null>(null)`  
   `const [pdfUrl, setPdfUrl] = useState<string | null>(null)`  
   `const [pdfLoading, setPdfLoading] = useState(false)`
2. Add `handleShowPdf(row: JobReceiptListRowType)`:
   - Set `setPdfLoading(true)` and `setPdfRow(row)`
   - Fetch job detail: `GET_JOB_DETAIL` with `{ id: row.job_id }`
   - Fetch all payments for job: `GET_JOB_PAYMENTS_BY_JOB` with `{ job_id: row.job_id }`
   - Build `buildReceiptPdf({ ...jobDetail, payments }, division)`
   - Set `pdfUrl` and show `PdfPreviewModal`
3. Add `Printer` icon button in the Actions column (before Edit button)
4. Add `PdfPreviewModal` at bottom of component JSX

---

## Item 6 — Jobs > Receipts: Delete guard for is_posted

**Server — `sql_store.py`:**
- Add `jp.is_posted` to the SELECT in `GET_JOB_PAYMENTS_PAGED` (after `jp.remarks`)

**Client:**

`src/features/client/types/receipt.ts` — add field to `JobReceiptListRowType`:
```typescript
is_posted: boolean;
```

`src/constants/messages.ts` — add message:
```typescript
ERROR_RECEIPT_DELETE_IS_POSTED: 'This receipt cannot be deleted as it is already posted.',
```

`receipts-section.tsx`:
- In delete flow: use `AlertDialog` (already present) with two modes:
  - **Blocked mode** (if `deleteRow.is_posted`): show amber/warning style with message, only an OK/Close button, no Delete button
  - **Normal mode** (current): confirm delete as before
- Replace the simple `<Dialog>` delete confirmation with `AlertDialog` component (or keep Dialog but add the is_posted check inside it)

---

## Item 7 — Final a Job: Edit gate

### Bug fix — warranty jobs (prerequisite)
`FinalizedJobRow` (final-a-job-schema.ts) is missing `job_type_code` even though `GET_DELIVERABLE_JOBS_PAGED` SQL already returns `jt.code AS job_type_code`. Add to type:
```typescript
job_type_code: string;
```
This fixes the existing bug where `isWarranty` is always false when editing finalized jobs.

### Edit gate logic
**Server — `sql_store.py` `GET_DELIVERABLE_JOBS_PAGED`:**
- Add to SELECT: `ji.is_posted AS invoice_is_posted`

**Client — `final-a-job-schema.ts` `FinalizedJobRow`:**
- Add field: `invoice_is_posted: boolean | null`
- Add field: `job_type_code: string` (bug fix above)

**Client — `final-a-job-section.tsx` `handleOpenFinalForEdit`:**
```typescript
async function handleOpenFinalForEdit(row: FinalizedJobRow) {
    // A job is editable if: job itself is not posted,
    // AND either no invoice or invoice is not posted
    const editable = !row.is_posted && (!row.invoice_no || !row.invoice_is_posted);
    if (!editable) {
        const reason = row.is_posted
            ? MESSAGES.INFO_FINALIZED_JOB_NOT_EDITABLE_POSTED
            : MESSAGES.INFO_FINALIZED_JOB_NOT_EDITABLE_INVOICE_POSTED;
        toast.info(reason);
        // Open in read mode (isEditMode = false)
        setIsEditMode(false);
        await handleOpenFinal(row as unknown as FinalJobRow);
        return;
    }
    setIsEditMode(true);
    await handleOpenFinal(row as unknown as FinalJobRow);
}
```

**Messages to add in `messages.ts`:**
```typescript
INFO_FINALIZED_JOB_NOT_EDITABLE_POSTED:
    'This job cannot be edited because it is already posted to accounts.',
INFO_FINALIZED_JOB_NOT_EDITABLE_INVOICE_POSTED:
    'This job cannot be edited because its invoice is already posted.',
```

---

## Item 8 — Final a Job: Regenerate invoice on save after edit

After a successful `handleSaveEdit()`, if the job had an invoice, regenerate it with the new parts/charges.

**Approach:** After saving, if `selectedRow.invoice_no` is not null, call `regenerateJobInvoice` mutation (already built) with the recomputed lines.

We need `invoice_id` for the regenerate call. Add it to `FinalizedJobRow`:

**Server — `GET_DELIVERABLE_JOBS_PAGED` SQL:**
- Add `ji.id AS invoice_id` to SELECT (alongside `ji.amount AS invoice_total`)

**Client — `FinalizedJobRow` type:**
- Add `invoice_id: number | null`

**Client — `final-a-job-section.tsx` `handleSaveEdit`:**
After the `await apolloClient.mutate(...)` succeeds, add:
```typescript
// Regenerate invoice if one exists
if (isEditMode && selectedRow.invoice_id) {
    const division = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
    const isGstDiv = isGstDivision(division);
    // Build invoice lines from current parts + charges
    const lines = buildInvoiceLinesForRegenerate(partLines, chargeLines, isGstDiv, forceIgst);
    const aggregate   = Math.round(lines.reduce((s, l) => s + l.aggregate, 0) * 100) / 100;
    const cgst_amount = Math.round(lines.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
    const sgst_amount = Math.round(lines.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
    const igst_amount = Math.round(lines.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
    await apolloClient.mutate({
        mutation: GRAPHQL_MAP.regenerateJobInvoice,
        variables: {
            db_name: dbName, schema,
            value: encodeObj({ xData: {
                invoice_id: selectedRow.invoice_id,
                aggregate, cgst_amount, sgst_amount, igst_amount,
                amount,
                lines,
            }}),
        },
    });
}
```

**Helper `buildInvoiceLinesForRegenerate`** (add in final-a-job-section.tsx or a helpers file):
Converts `EditablePartLine[]` + `EditableChargeLine[]` + GST flags into the same `InvoiceLine[]` format that `buildInvoiceLines` in delivery-modal.tsx produces. Can be extracted into a shared utility.

---

## Item 9 — Warranty Jobs: Save & Mark Final button hidden

**Status:** The form already has `{!isWarranty && <Save button>}` at line 286 of `final-job-form.tsx`.

The bug is that `isWarranty = selectedRow.job_type_code === "UNDER_WARRANTY"` but `FinalizedJobRow` lacks `job_type_code` (fix in Item 7). Once Item 7 adds `job_type_code` to `FinalizedJobRow` type and the SQL, this is automatically fixed.

No additional code change needed beyond Item 7's type/SQL fix.

---

## Implementation Order

1. **Items 9 + 7 (type/SQL fixes first):** Add `job_type_code`, `invoice_is_posted`, `invoice_id` to `GET_DELIVERABLE_JOBS_PAGED` SQL and `FinalizedJobRow` type — fixes the warranty button bug.
2. **Item 7 (edit gate):** `handleOpenFinalForEdit` logic + messages.
3. **Item 2:** One-liner change in delivery-modal.tsx.
4. **Item 4:** Enhance `buildReceiptPdf` with division header and "Received with Thanks".
5. **Item 5:** Add PDF button to receipts-section.tsx.
6. **Item 6:** Add `is_posted` to SQL and type, add delete guard.
7. **Item 8:** Regenerate invoice in `handleSaveEdit`.
