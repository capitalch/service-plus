# Final A Job — Comprehensive Enhancement Plan

## Overview

Two independent enhancements to the "Final a Job" feature:

1. **Tab Structure** — Add a second tab "Finalized Jobs" showing already-finalized (is_final=true, is_closed=false) jobs with View and Edit actions.
2. **Invoice Creation** — When saving & marking final (or editing), atomically write `job_invoice` + `job_invoice_line` rows alongside the existing parts/charges/job updates.

---

## 1. Tab Structure

### 1.1 Where

`src/features/client/pages/client-jobs-page.tsx` — no change needed.  
`src/features/client/components/jobs/final-a-job/final-a-job-section.tsx` — all changes here.

### 1.2 New State

```typescript
// Tab
const [activeTab, setActiveTab] = useState<"pending" | "finalized">("pending");

// Finalized Jobs list
const [finalizedRows, setFinalizedRows]         = useState<FinalizedJobRow[]>([]);
const [finalizedTotal, setFinalizedTotal]       = useState(0);
const [finalizedPage, setFinalizedPage]         = useState(1);
const [finalizedSearch, setFinalizedSearch]     = useState("");
const [finalizedSearchQ, setFinalizedSearchQ]   = useState("");
const [finalizedFromDate, setFinalizedFromDate] = useState(financialYearStart()); // same helper as deliver-job
const [finalizedToDate, setFinalizedToDate]     = useState(todayStr());
const [finalizedLoading, setFinalizedLoading]   = useState(false);

// Edit mode
const [isEditMode, setIsEditMode]               = useState(false);
const [existingInvoiceId, setExistingInvoiceId] = useState<number | null>(null);
```

### 1.3 New Type

Add near `FinalJobRow` in `final-a-job-schema.ts`:

```typescript
export type FinalizedJobRow = {
    id:               number;
    job_no:           string;
    alternate_job_no: string | null;
    job_date:         string;
    customer_name:    string;
    mobile:           string;
    job_status_name:  string;
    technician_name:  string | null;
    invoice_no:       string | null;
    invoice_total:    number | null;
    last_transaction_id: number | null;
    amount:           number | null;
};
```

### 1.4 SQL — reuse existing IDs (no new SQL needed)

The "Finalized Jobs" list uses the same `GET_DELIVERABLE_JOBS_PAGED` / `GET_DELIVERABLE_JOBS_COUNT` that the Deliver Job section uses. These already filter `is_final = true AND is_closed = false`.  
`SQL_MAP` keys used: `SQL_MAP.GET_DELIVERABLE_JOBS_COUNT`, `SQL_MAP.GET_DELIVERABLE_JOBS_PAGED`.  
Args: `{ branch_id, from_date, to_date, search, limit, offset }`.

### 1.5 Data Load Function

```typescript
async function loadFinalizedData() {
    if (!branchId || !dbName || !schema) return;
    setFinalizedLoading(true);
    try {
        const args = {
            branch_id:  branchId,
            from_date:  finalizedFromDate,
            to_date:    finalizedToDate,
            search:     finalizedSearchQ,
            limit:      PAGE_SIZE,
            offset:     (finalizedPage - 1) * PAGE_SIZE,
        };
        const [countRes, rowsRes] = await Promise.all([
            apolloClient.query({ fetchPolicy: 'network-only', query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_COUNT, sqlArgs: args }) } }),
            apolloClient.query({ fetchPolicy: 'network-only', query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_PAGED, sqlArgs: args }) } }),
        ]);
        setFinalizedTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        setFinalizedRows(rowsRes.data?.genericQuery ?? []);
    } finally {
        setFinalizedLoading(false);
    }
}
```

Call `loadFinalizedData()` via `useEffect` whenever `activeTab === "finalized"` and dependencies change (branch, dates, searchQ, page).

### 1.6 Tab Bar UI

Render at the top of the motion.div content **when `subView === "list"`**:

```tsx
{subView === "list" && (
    <div className="flex border-b border-[var(--cl-border)] mb-4 shrink-0">
        {[
            { key: "pending",   label: "Final a Job"     },
            { key: "finalized", label: "Finalized Jobs"  },
        ].map(t => (
            <button
                key={t.key}
                className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key
                        ? "border-[var(--cl-accent)] text-[var(--cl-accent)]"
                        : "border-transparent text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                }`}
                onClick={() => setActiveTab(t.key as "pending" | "finalized")}
            >
                {t.label}
            </button>
        ))}
    </div>
)}
```

### 1.7 "Finalized Jobs" List View

When `subView === "list" && activeTab === "finalized"`, render a list with:

- **Filters row**: date-range pickers (from/to) + search input
- **Table columns**: Job No | Date | Customer | Mobile | Technician | Status | Invoice No | Invoice Total | Actions
- **Actions per row**:
  - Eye icon → `setViewJobId(row.id)` (existing `JobDetailsModal`)
  - Pencil icon → `handleOpenFinalForEdit(row)`
- **Pagination**: same pattern as existing "pending" list

### 1.8 `handleOpenFinalForEdit`

```typescript
async function handleOpenFinalForEdit(row: FinalizedJobRow) {
    setIsEditMode(true);
    await handleOpenFinal(row as unknown as FinalJobRow); // reuses existing loader

    // Fetch existing invoice to get its ID (for delete+reinsert on save)
    if (!dbName || !schema) return;
    try {
        const res = await apolloClient.query({
            fetchPolicy: 'network-only',
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_JOB_INVOICE_BY_JOB,
                    sqlArgs: { job_id: row.id },
                }),
            },
        });
        const inv = res.data?.genericQuery?.[0];
        setExistingInvoiceId(inv?.id ?? null);
        // Restore forceIgst from existing invoice (igst_amount > 0 means IGST was used)
        if (inv) setForceIgst(Number(inv.igst_amount) > 0);
    } catch { /* leave defaults */ }
}
```

### 1.9 Edit Mode Visual Indicator

In the "final" subview header (after the existing header div), add:

```tsx
{isEditMode && (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shrink-0">
        <Edit2 className="h-4 w-4 shrink-0" />
        Edit mode — changes will update parts, charges, and the invoice.
    </div>
)}
```

### 1.10 "Save" Button in Edit Mode

Replace `"Save & Mark Final"` label with `"Save Changes"` when `isEditMode`:

```tsx
{isEditMode ? "Save Changes" : "Save & Mark Final"}
```

The button calls `isEditMode ? handleSaveEdit() : handleSaveFinal()`.

### 1.11 Back Navigation from Edit Mode

When back button clicked while `isEditMode`:
```typescript
function handleBack() {
    setSubView("list");
    if (isEditMode) {
        setIsEditMode(false);
        setExistingInvoiceId(null);
        setActiveTab("finalized");
    }
    // reset part/charge state as before
}
```

---

## 2. Invoice Creation

### 2.1 Pure Helper — `computeInvoicePayload`

Add outside the component (alongside `scaleCharges`, `scaleParts`):

```typescript
function computeInvoicePayload(
    partLines:    EditablePartLine[],
    chargeLines:  EditableChargeLine[],
    jobNo:        string,
    isGst:        boolean,
    forceIgst:    boolean,
    stateCode:    string | null,
): {
    invoiceHeader: Record<string, unknown>;
    invoiceLines:  Record<string, unknown>[];
} {
    const today      = new Date().toISOString().split("T")[0];
    const supplyCode = (stateCode ?? "00").substring(0, 2);
    const lines: Record<string, unknown>[] = [];
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;

    // Part lines
    for (const l of partLines.filter(l => l.part_id !== null)) {
        const sp       = parseFloat(l.selling_price) || 0;
        const qty      = l.quantity;
        const gstRate  = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
        const rowTax   = sp * qty;
        const cgstRate = isGst && !forceIgst ? gstRate / 2 : 0;
        const sgstRate = isGst && !forceIgst ? gstRate / 2 : 0;
        const igstRate = isGst && forceIgst  ? gstRate     : 0;
        const rc = rowTax * cgstRate / 100;
        const rs = rowTax * sgstRate / 100;
        const ri = rowTax * igstRate / 100;
        lines.push({
            description:    l.part_name || l.part_code || "",
            part_code:      l.part_code || null,
            hsn_code:       l.hsn_code  || null,
            quantity:       qty,
            unit_price:     sp,
            taxable_amount: rowTax,
            cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
            cgst_amount: rc, sgst_amount: rs, igst_amount: ri,
            total_amount: rowTax + rc + rs + ri,
        });
        taxable += rowTax; cgst += rc; sgst += rs; igst += ri;
    }

    // Charge lines (part_code = null)
    for (const c of chargeLines.filter(c => c.charge_name.trim() !== "")) {
        const sp       = parseFloat(c.selling_price) || 0;
        const qty      = parseFloat(c.quantity) || 1;
        const gstRate  = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
        const rowTax   = sp * qty;
        const cgstRate = isGst && !forceIgst ? gstRate / 2 : 0;
        const sgstRate = isGst && !forceIgst ? gstRate / 2 : 0;
        const igstRate = isGst && forceIgst  ? gstRate     : 0;
        const rc = rowTax * cgstRate / 100;
        const rs = rowTax * sgstRate / 100;
        const ri = rowTax * igstRate / 100;
        lines.push({
            description:    c.charge_name,
            part_code:      null,
            hsn_code:       c.hsn_code || null,
            quantity:       qty,
            unit_price:     sp,
            taxable_amount: rowTax,
            cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
            cgst_amount: rc, sgst_amount: rs, igst_amount: ri,
            total_amount: rowTax + rc + rs + ri,
        });
        taxable += rowTax; cgst += rc; sgst += rs; igst += ri;
    }

    const totalTax = cgst + sgst + igst;
    return {
        invoiceHeader: {
            invoice_no:      jobNo,          // job_no used as invoice_no (unique)
            invoice_date:    today,
            supply_state_code: supplyCode,
            taxable_amount:  taxable,
            cgst_amount:     cgst,
            sgst_amount:     sgst,
            igst_amount:     igst,
            total_tax:       totalTax,
            total_amount:    taxable + totalTax,
        },
        invoiceLines: lines,
    };
}
```

### 2.2 Modify `handleSaveFinal`

After building `xDetails` for parts and charges (around line 834), append invoice:

```typescript
// Build invoice payload
const { invoiceHeader, invoiceLines } = computeInvoicePayload(
    partLines, chargeLines, selectedJob.job_no, isGst, forceIgst, effectiveGstStateCode
);
xDetails.push({
    tableName: "job_invoice",
    fkeyName:  "job_id",
    xData: [{
        ...invoiceHeader,
        xDetails: {
            tableName: "job_invoice_line",
            fkeyName:  "job_invoice_id",
            xData:     invoiceLines,
        },
    }],
});
```

Mutation root stays:
```typescript
{ tableName: "job", xData: { id: selectedJob.id, is_final: true, division_id: selectedDivisionId }, xDetails }
```

Success toast updated: `"Job marked as final and invoice created."`

### 2.3 New `handleSaveEdit`

Same validation as `handleSaveFinal`, same `xDetails` for parts/charges, PLUS for invoice:

```typescript
const { invoiceHeader, invoiceLines } = computeInvoicePayload(
    partLines, chargeLines, selectedJob.job_no, isGst, forceIgst, effectiveGstStateCode
);
xDetails.push({
    tableName: "job_invoice",
    fkeyName:  "job_id",
    ...(existingInvoiceId !== null ? { deletedIds: [existingInvoiceId] } : {}),
    xData: [{
        ...invoiceHeader,
        xDetails: {
            tableName: "job_invoice_line",
            fkeyName:  "job_invoice_id",
            xData:     invoiceLines,
        },
    }],
});

await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdate,
    variables: {
        db_name: dbName, schema,
        value: encodeObj({
            tableName: "job",
            xData: { id: selectedJob.id, is_final: true, division_id: selectedDivisionId },
            xDetails,
        }),
    },
});

toast.success("Finalized job updated.");
setIsEditMode(false);
setExistingInvoiceId(null);
setSubView("list");
setActiveTab("finalized");
void loadFinalizedData();
```

---

## 3. Selector needed

Add `selectEffectiveGstStateCode` to the imports from `@/store/context-slice` — already exists in the slice.

```typescript
const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);
```

---

## 4. Files Changed

| File | What changes |
|---|---|
| `final-a-job-section.tsx` | New state, tab UI, finalized list view, `handleOpenFinalForEdit`, `handleSaveEdit`, `computeInvoicePayload`, invoice xDetails in `handleSaveFinal`, edit mode banner |
| `final-a-job-schema.ts` | Add `FinalizedJobRow` type |
| `sql-map.ts` | No change — reuse `GET_DELIVERABLE_JOBS_COUNT/PAGED` |
| Server | No change — `genericUpdate` already handles nested inserts/deletes |

---

## 5. Edge Cases

| Case | Handling |
|---|---|
| Warranty job opened for edit | Keep all fields disabled (same `isWarranty` check) |
| Job has no parts and no charges | Invoice created with zero lines and zero totals |
| Non-GST division | All GST amounts = 0, supply_state_code = "00" |
| No existing invoice when editing | `existingInvoiceId = null`; omit `deletedIds`; just insert new invoice |
| invoice_no uniqueness | Job_no is unique per job; delete-then-insert prevents conflict |
| `forceIgst` not restorable | Infer from `existing_invoice.igst_amount > 0`; user can toggle if wrong |

---

## 6. Verification

1. Tab "Final a Job" works exactly as before (no regression).
2. Tab "Finalized Jobs" loads with date filters, search, pagination.
3. View icon → JobDetailsModal opens correctly.
4. Edit icon → opens final view with amber banner; button shows "Save Changes".
5. Save Changes: parts/charges updated, old invoice deleted, new invoice inserted — verify in DB.
6. Save & Mark Final (new job): job_invoice + job_invoice_line rows created — verify in DB.
7. GST job: cgst/sgst/igst amounts correct; forceIgst=true → all goes to igst.
8. Non-GST job: all gst amounts = 0 in invoice.
9. `tsc --noEmit` passes.
