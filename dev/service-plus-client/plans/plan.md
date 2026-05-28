# Deliver Job — Multi-Job Modal Redesign Plan

> **Previous plan** (single-job subview) is now fully implemented.  
> This plan covers the next phase described in `tran.md`.

## Overview

Replace the current single-job "drill-down subview" with a **modal-based, multi-job delivery flow**:

| Old Flow | New Flow |
|---|---|
| Click "Deliver" → navigates away from list to a full subview page | Click "Deliver" (single) OR select checkboxes + "Deliver Selected" → opens non-dismissible modal |
| One job at a time | One or many jobs at once |
| Invoice shown read-only (created in Final-a-Job) | Invoice **created inside the modal** via button |
| Full A4 PDF of delivery note | Half-A4 PDF per job (invoice + receipt) |
| Payment entered inline with delivery | Receipts section inside modal; delivery manner mandatory dropdown |

---

---

## Current State (Post Phase-1)

The following files are already implemented:
- `deliver-job-helpers.ts` — PAGE_SIZE, thClass, tdClass, fmtCurrency, PAYMENT_MODES
- `deliver-job-schema.ts` — deliverJobSchema, JobInvoiceFullRow, addReceiptSchema
- `deliver-job-section.tsx` — orchestrator with subView ("list" | "delivery"), single-job delivery flow
- `deliver-job-pdf.ts` — buildDeliverJobPdf (full A4)
- `deliverable-jobs-grid.tsx` — paginated list with search, per-row "Deliver" button
- `delivered-jobs-grid.tsx` — delivered jobs tab
- `delivery-invoice-card.tsx` — read-only invoice card
- `delivery-receipts-card.tsx` — receipts + balance chips
- `add-receipt-modal.tsx` — add receipt modal
- `delivery-details-form.tsx` — delivery date/manner/payment form

---

## New Requirements (tran.md)

### A. Multi-select in the deliverable jobs list
- Add checkboxes to each row so users can select multiple jobs.
- Keep the per-row "Deliver" button for single-job quick selection.
- Add a "Deliver Selected (N)" button in the toolbar that activates when ≥ 1 job is checked.

### B. Delivery via a Modal (not a subview page)
- **Remove** the `subView = "delivery"` full-page transition.
- **Add** a `DeliveryModal` that opens for both single and multi-job delivery.
- The modal must **NOT close on click outside** (`onOpenChange` must ignore backdrop clicks).
- Closes only on Cancel/Back or after successful delivery.

### C. Modal Content — Header Summary Strip
Totals across all selected jobs:
- Division (name/code if same; "Multiple" if different)
- GST status (GST / Non-GST / Mixed)
- Total Job Amount = Σ `job.amount`
- Total Receipts = Σ existing `job_payment.amount`
- Total Due = Total Amount − Total Receipts

### D. Modal Content — Jobs Table
One row per selected job, columns:

| Column | Source |
|---|---|
| Job No | `job.job_no` |
| Alt Job No | `job.alternate_job_no` |
| Job Date | `job.job_date` |
| Customer Name | `customer_contact.full_name` |
| Receive Manner | `job_receive_manner.name` |
| Job Type | `job_type.name` |
| Receive Condition | `job_receive_condition.name` |
| Device Details | built from product/brand/model/serial_no |
| Qty | `job.qty` |
| Estimate Amount | `job.estimate_amount` |
| Amount | `job.amount` |
| Due Amount | `job.amount` − Σ existing payments |

### E. Modal Content — Money Receipts Section
- Shows existing receipts per job.
- Shows the pending balance per job (what still needs to be collected).
- Option to add a receipt per job via the existing AddReceiptModal.

### F. Modal Content — Invoices Section
- Shows invoices to be generated for each eligible job:
  - Spare parts lines (from `job_part_used`) + additional charges (from `job_additional_charge`) + taxes.
  - **Each job gets one invoice and one money receipt.**
- Jobs of type IN_WARRANTY, RETURN, or CANCELLED → **skip** invoice generation; show a badge.
- Jobs that already have an invoice → show it read-only (no generate button).

### G. Modal — "Create Invoice & Money Receipts" Button
- Enabled only when ≥ 1 eligible job (invoiceable AND no invoice yet).
- On click: creates invoice (calling same mutation as Final-a-Job) for each eligible job.
- After success: refreshes modal data; enables PDF button.

### H. Modal — "Show PDF" Button
- Enabled only when at least one invoice exists.
- Opens existing `PdfPreviewModal`.
- PDF must be **half A4 size** (A5 portrait ≈ 148×210 mm).
- Covers all selected jobs (one document, one section per job).

### I. Modal — Delivery Manner Dropdown (Mandatory)
- Populated from `GET_JOB_DELIVERY_MANNERS` (already loaded).
- Applies to **all** selected jobs.

### J. Modal — "Deliver" Button
- Sets `is_closed = true` for all selected jobs.
- Requires Delivery Manner to be selected.
- Calls the existing **`GRAPHQL_MAP.deliverJob`** mutation once per selected job (sequential loop, no new mutation needed).

### K. Code Cleanup
- Remove `subView` state and the entire `if (subView === "delivery" && detail)` JSX block.
- Remove `detail`/`invoice`/`loadingDetail`/`pdfUrl`/`showPdf`/`showReceiptModal`/`receiptDefaultAmt` states.
- Remove `handleRowClick`, `handleBack`, `refreshPayments`, `handleAddReceipt`, `handleOpenPdf`, `executeSave`.
- Remove `deliverJobSchema` form and its derived values (`alreadyPaid`, `balance`, `canDeliver`).
- Delete `delivery-details-form.tsx` (superseded by modal footer).

---

## Implementation Plan

### Step 1 — Server: Update SQL queries (`sql_store.py`)

#### 1.1 Modify `GET_DELIVERABLE_JOBS_PAGED`
Add the following columns and JOINs to expose extra fields on the list grid:

```sql
-- Extra JOINs to add:
JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
JOIN job_type              jt  ON jt.id  = j.job_type_id
LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id

-- Extra SELECT columns to add:
jrm.name       AS receive_manner_name,
jt.name        AS job_type_name,
jt.code        AS job_type_code,
COALESCE(jrc.name, '') AS receive_condition_name,
j.qty,
j.estimate_amount,
COALESCE(
    (SELECT SUM(jp.amount) FROM job_payment jp WHERE jp.job_id = j.id),
    0
)              AS total_paid
```

#### 1.2 Add `GET_DELIVERABLE_JOBS_DETAIL_MULTI`
New SQL to fetch full delivery details for a list of job IDs in one round-trip. This is called when the modal opens.

```sql
GET_DELIVERABLE_JOBS_DETAIL_MULTI = """
    with "p_job_ids" as (
        SELECT unnest(%(job_ids)s::bigint[]) AS job_id
    )
    SELECT
        j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount,
        j.estimate_amount, j.qty, j.last_transaction_id,
        j.division_id, j.serial_no,
        TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
        cc.full_name  AS customer_name, cc.mobile,
        js.name       AS job_status_name,
        jt.name       AS job_type_name,
        jt.code       AS job_type_code,
        jrm.name      AS receive_manner_name,
        COALESCE(jrc.name, '') AS receive_condition_name,
        t.name        AS technician_name,
        ji.id         AS invoice_id,
        ji.invoice_no, ji.invoice_date,
        ji.amount     AS invoice_total,
        -- Payments as JSON array
        COALESCE((
            SELECT json_agg(json_build_object(
                'id', jp.id, 'payment_date', jp.payment_date,
                'payment_mode', jp.payment_mode, 'amount', jp.amount,
                'reference_no', jp.reference_no, 'remarks', jp.remarks
            ) ORDER BY jp.created_at)
            FROM job_payment jp WHERE jp.job_id = j.id
        ), '[]'::json) AS payments,
        -- Parts as JSON array
        COALESCE((
            SELECT json_agg(json_build_object(
                'id', jpu.id, 'part_code', sp.part_code, 'part_name', sp.part_name,
                'qty', jpu.qty, 'cost_price', jpu.cost_price,
                'selling_price', jpu.selling_price, 'gst_rate', jpu.gst_rate,
                'hsn_code', sp.hsn_code, 'remarks', jpu.remarks
            ) ORDER BY jpu.id)
            FROM job_part_used jpu
            JOIN spare_part_master sp ON sp.id = jpu.part_id
            WHERE jpu.job_id = j.id
        ), '[]'::json) AS parts,
        -- Additional charges as JSON array
        COALESCE((
            SELECT json_agg(json_build_object(
                'id', jac.id, 'charge_name', jac.charge_name, 'qty', jac.qty,
                'selling_price', jac.selling_price, 'gst_rate', jac.gst_rate,
                'hsn_code', jac.hsn_code, 'description', jac.description
            ) ORDER BY jac.id)
            FROM job_additional_charge jac WHERE jac.job_id = j.id
        ), '[]'::json) AS charges
    FROM job j
    JOIN "p_job_ids" pj  ON pj.job_id = j.id
    JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
    JOIN job_status            js  ON js.id  = j.job_status_id
    JOIN job_type              jt  ON jt.id  = j.job_type_id
    JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
    LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
    LEFT JOIN technician       t   ON t.id  = j.technician_id
    LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand            b   ON b.id  = pbm.brand_id
    LEFT JOIN product          p   ON p.id  = pbm.product_id
    GROUP BY j.id, cc.full_name, cc.mobile, js.name, jt.name, jt.code,
             jrm.name, jrc.name, t.name, pbm.model_name, b.name, p.name,
             ji.id, ji.invoice_no, ji.invoice_date, ji.amount
"""
```

> **Parameter format**: pass `job_ids` as a Python list; psycopg will cast it. Test with `[1, 2, 3]`.

---

### Step 2 — Client: SQL Map (`src/constants/sql-map.ts`)

Add:
```ts
GET_DELIVERABLE_JOBS_DETAIL_MULTI: "GET_DELIVERABLE_JOBS_DETAIL_MULTI",
```

---

### Step 3 — Client: Schema (`deliver-job-schema.ts`)

**Add** new types and delivery-modal form schema:

```ts
// ── Full details for one job in the delivery modal ────────────────────────────

export type JobPartLine = {
    id:            number;
    part_code:     string;
    part_name:     string;
    qty:           number;
    cost_price:    number | null;
    selling_price: number;
    gst_rate:      number;
    hsn_code:      string | null;
    remarks:       string | null;
};

export type JobChargeLine = {
    id:            number;
    charge_name:   string;
    qty:           number;
    selling_price: number;
    gst_rate:      number;
    hsn_code:      string | null;
    description:   string | null;
};

export type JobDeliveryFullDetail = {
    id:                     number;
    job_no:                 string;
    alternate_job_no:       string | null;
    job_date:               string;
    division_id:            number | null;
    amount:                 number | null;
    estimate_amount:        number | null;
    qty:                    number | null;
    last_transaction_id:    number | null;
    device_details:         string | null;
    customer_name:          string;
    mobile:                 string;
    job_status_name:        string;
    job_type_name:          string;
    job_type_code:          string;   // used to check invoiceability
    receive_manner_name:    string;
    receive_condition_name: string;
    technician_name:        string | null;
    invoice_id:             number | null;
    invoice_no:             string | null;
    invoice_date:           string | null;
    invoice_total:          number | null;
    payments:               JobPayment[];
    parts:                  JobPartLine[];
    charges:                JobChargeLine[];
};

// ── Delivery modal form (simplified — no payment field, manner is mandatory) ──

export const deliveryModalSchema = z.object({
    delivery_date:   z.string().min(1, "Delivery date is required"),
    delivery_manner: z.string().min(1, "Delivery manner is required"),
    remarks:         z.string().optional(),
});

export type DeliveryModalFormValues = z.infer<typeof deliveryModalSchema>;

export function getDeliveryModalDefaults(): DeliveryModalFormValues {
    return {
        delivery_date:   new Date().toISOString().slice(0, 10),
        delivery_manner: "",
        remarks:         "",
    };
}
```

**Keep** `JobPayment` (already in `delivery-receipts-card.tsx`, but import/re-export from schema).
**Keep** `JobInvoiceFullRow`, `JobInvoiceLineRow`, `addReceiptSchema`, `AddReceiptFormValues`, `getAddReceiptDefaults`.
**Deprecate** `deliverJobSchema` / `getDeliverJobDefaultValues` (but keep during transition; remove when section cleanup is done).

---

### Step 4 — Client: Helpers (`deliver-job-helpers.ts`)

**Add**:
```ts
// Job type codes that skip invoice generation (verify against DB values)
export const NON_INVOICEABLE_JOB_TYPE_CODES = ["IN_WARRANTY", "RETURN", "CANCELLED"] as const;

export function isInvoiceable(jobTypeCode: string): boolean {
    return !NON_INVOICEABLE_JOB_TYPE_CODES.includes(
        jobTypeCode.toUpperCase() as typeof NON_INVOICEABLE_JOB_TYPE_CODES[number]
    );
}
```

> ⚠️ **Verify** actual `job_type.code` values in the DB for warranty, return, and cancelled types before hardcoding. Run `SELECT code, name FROM job_type ORDER BY name` to confirm.

---

### Step 5 — Client: `deliverable-jobs-grid.tsx` (modify)

**Update `DeliverableJobRow` type**:
```ts
export type DeliverableJobRow = {
    // ... existing fields ...
    receive_manner_name:    string;
    job_type_name:          string;
    job_type_code:          string;
    receive_condition_name: string;
    qty:                    number | null;
    estimate_amount:        number | null;
    total_paid:             number;   // sum of existing payments from SQL
};
```

**Add props**:
```ts
type Props = {
    // ... existing ...
    selectedIds:       Set<number>;
    onSelectionChange: (id: number, checked: boolean) => void;
    onSelectAll:       (checked: boolean) => void;
    onDeliverSelected: () => void;
};
```

**Add checkbox column** (first `<th>` and first `<td>` in each row):
```tsx
// Header:
<th className={thClass}>
    <input
        type="checkbox"
        checked={rows.length > 0 && rows.every(r => selectedIds.has(r.id))}
        onChange={e => onSelectAll(e.target.checked)}
    />
</th>

// Row:
<td className={tdClass}>
    <input
        type="checkbox"
        checked={selectedIds.has(row.id)}
        onChange={e => { e.stopPropagation(); onSelectionChange(row.id, e.target.checked); }}
    />
</td>
```

**Add "Deliver Selected" button** in toolbar:
```tsx
{selectedIds.size > 0 && (
    <Button
        className="h-8 gap-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
        size="sm"
        onClick={onDeliverSelected}
    >
        <Truck className="h-3.5 w-3.5" />
        Deliver Selected ({selectedIds.size})
    </Button>
)}
```

Keep existing per-row "Deliver" button — it calls `onDeliver(row)` which now opens the modal with just that one job.

---

### Step 6 — Client: `deliver-job-section.tsx` (major refactor)

#### 6.1 State to REMOVE:
- `subView` + `setSubView`
- `detail` + `setDetail`
- `invoice` + `setInvoice`
- `loadingDetail` + `setLoadingDetail`
- `showReceiptModal` + `setShowReceiptModal`
- `receiptDefaultAmt` + `setReceiptDefaultAmt`
- `pdfUrl` + `setPdfUrl`
- `showPdf` + `setShowPdf`
- `form` (the old `deliverJobSchema`-based form)

#### 6.2 State to ADD:
```ts
const [selectedIds,       setSelectedIds]       = useState<Set<number>>(new Set());
const [showDeliveryModal, setShowDeliveryModal] = useState(false);
const [modalJobDetails,   setModalJobDetails]   = useState<JobDeliveryFullDetail[]>([]);
const [loadingModal,      setLoadingModal]       = useState(false);
```

#### 6.3 Handlers to REMOVE:
- `handleRowClick` (replaced by `handleOpenDeliveryModal`)
- `handleBack`
- `refreshPayments`
- `handleAddReceipt`
- `handleOpenPdf`
- `executeSave`

#### 6.4 New handler — `handleOpenDeliveryModal`:
```ts
async function handleOpenDeliveryModal(rows: DeliverableJobRow[]) {
    if (!dbName || !schema || rows.length === 0) return;
    setLoadingModal(true);
    try {
        const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                    sqlArgs: { job_ids: rows.map(r => r.id) },
                }),
            },
        });
        setModalJobDetails(res.data?.genericQuery ?? []);
        setShowDeliveryModal(true);
    } catch {
        toast.error("Failed to load job details for delivery. Please try again.");
    } finally {
        setLoadingModal(false);
    }
}
```

#### 6.5 New handler — `handleDeliverySaved`:
```ts
function handleDeliverySaved() {
    setShowDeliveryModal(false);
    setModalJobDetails([]);
    setSelectedIds(new Set());
    if (branchId) void loadData(branchId, searchQ, page);
    void loadDeliveredData();
}
```

#### 6.6 Wire to DeliverableJobsGrid:
```tsx
<DeliverableJobsGrid
    rows={rows}
    loading={loading}
    total={total}
    page={page}
    search={search}
    branchId={branchId}
    availableDivisions={availableDivisions}
    loadingDetail={loadingModal}   // repurpose loading flag
    selectedIds={selectedIds}
    setPage={setPage}
    onSearch={handleSearchChange}
    onRefresh={() => { if (branchId) void loadData(branchId, searchQ, page); }}
    onViewJob={id => setViewJobId(id)}
    onDeliver={row => void handleOpenDeliveryModal([row])}
    onOpenAttach={(id, jobNo) => { setAttachJobId(id); setAttachJobNo(jobNo); }}
    onSelectionChange={(id, checked) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    }}
    onSelectAll={checked => setSelectedIds(checked ? new Set(rows.map(r => r.id)) : new Set())}
    onDeliverSelected={() => {
        const selectedRows = rows.filter(r => selectedIds.has(r.id));
        void handleOpenDeliveryModal(selectedRows);
    }}
/>
```

#### 6.7 Remove the entire delivery subview JSX:
Delete the block:
```tsx
// REMOVE THIS ENTIRE BLOCK:
if (subView === "delivery" && detail) {
    return ( ... ); // ~130 lines
}
```

#### 6.8 Add modal at the bottom of list-view JSX:
```tsx
{showDeliveryModal && (
    <DeliveryModal
        jobs={modalJobDetails}
        deliveryManners={deliveryManners}
        availableDivisions={availableDivisions}
        deliveredStatusId={deliveredStatusId}
        currentUser={currentUser}
        dbName={dbName}
        schema={schema}
        onClose={() => { setShowDeliveryModal(false); setModalJobDetails([]); }}
        onDelivered={handleDeliverySaved}
    />
)}
```

#### 6.9 Imports to REMOVE from section:
- `ArrowLeft`, `FileText` from lucide-react (if unused elsewhere)
- `DeliveryInvoiceCard`, `DeliveryReceiptsCard`, `DeliveryDetailsForm`
- `buildDeliverJobPdf`
- `deliverJobSchema`, `getDeliverJobDefaultValues`
- `PdfPreviewModal`
- `AddReceiptModal`

---

### Step 7 — Client: NEW `delivery-modal.tsx`

The core new component. Structure:

```
DeliveryModal
  Dialog (open=true, onOpenChange ignores false to prevent outside-click close)
  ├── DialogHeader
  │     Title: "Deliver Job(s)"  [N job(s) selected]
  ├── DialogContent (scrollable, max-h-[85vh] overflow-y-auto)
  │     ├── Summary strip (division, GST, total amount, receipts, due)
  │     ├── <DeliveryModalJobsTable jobs={jobDetails} />
  │     ├── <DeliveryModalInvoicesSection jobs={jobDetails} onCreateInvoices={...} />
  │     └── <DeliveryModalReceiptsSection jobs={jobDetails} onAddReceipt={...} />
  └── DialogFooter (sticky bottom)
        ├── [Create Invoice & Receipts] — disabled if no eligible jobs or creating
        ├── [Show PDF]                  — disabled if no invoice exists
        ├── Delivery Manner  (Select, mandatory)
        ├── Delivery Date    (Input type=date, pre-filled today)
        ├── Remarks          (Input, optional)
        ├── [Cancel]
        └── [Deliver & Close Job(s)]   — disabled until manner selected, not delivering
```

**Key implementation details:**

```tsx
// Prevent outside-click close:
<Dialog open={true} onOpenChange={open => { if (open) return; /* block close */ }}>

// OR use DialogContent with no onPointerDownOutside:
<DialogContent onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
```

**Summary strip computation:**
```ts
const allDivIds    = [...new Set(jobs.map(j => j.division_id))];
const divLabel     = allDivIds.length === 1
    ? (availableDivisions.find(d => d.id === allDivIds[0])?.name ?? "—")
    : "Multiple";
const allGst       = jobs.every(j => isGstDivision(availableDivisions.find(d => d.id === j.division_id)));
const noneGst      = jobs.every(j => !isGstDivision(availableDivisions.find(d => d.id === j.division_id)));
const gstLabel     = allGst ? "GST" : noneGst ? "Non-GST" : "Mixed";
const totalAmt     = jobs.reduce((s, j) => s + Number(j.amount ?? 0), 0);
const totalPaid    = jobs.reduce((s, j) => s + j.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
const totalDue     = Math.max(0, totalAmt - totalPaid);
```

**"Create Invoice & Money Receipts" handler:**

Invoice creation uses the **existing `GRAPHQL_MAP.createSalesInvoice`** mutation. Despite its name, the server handler (`resolve_create_sales_invoice_helper`) is fully generic: it calls `exec_sql_object` on whatever `tableName` is in the payload, then atomically increments the document sequence. Sending `tableName: "job_invoice"` with nested xDetails for `job_invoice_line` works without any server change.

The flow per eligible job:
1. Fetch the `document_sequence` row for `JOB_INVOICE` document type + division (use `GET_DOCUMENT_SEQUENCES_BY_DIVISION` SQL, already in SQL_MAP).
2. Compute `invoice_no` = `prefix + padded(next_number) + separator` (client-side string, same logic as in `final-a-job-section.tsx`).
3. Compute invoice line totals (taxable, CGST, SGST, IGST, total) from `job.parts` and `job.charges`.
4. Call `GRAPHQL_MAP.createSalesInvoice` with:

```ts
async function handleCreateInvoices() {
    setCreatingInvoices(true);
    let created = 0;
    let skipped = 0;
    try {
        for (const job of jobDetails) {
            if (!isInvoiceable(job.job_type_code)) { skipped++; continue; }
            if (job.invoice_id)                    { skipped++; continue; }

            // 1. Fetch current document sequence for JOB_INVOICE + this job's division
            const seqRes = await apolloClient.query<...>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES_BY_DIVISION,
                        sqlArgs: { branch_id: currentBranch.id, division_id: job.division_id },
                    }),
                },
            });
            const seq = (seqRes.data?.genericQuery ?? []).find(s => s.document_type_code === "JOB_INVOICE");
            if (!seq) { toast.error(`No invoice sequence found for job #${job.job_no}`); continue; }

            // 2. Generate invoice number
            const paddedNum = String(seq.next_number).padStart(seq.padding ?? 0, "0");
            const invoiceNo = `${seq.prefix ?? ""}${seq.separator ?? ""}${paddedNum}`;

            // 3. Compute line totals
            const isGst  = isGstDivision(availableDivisions.find(d => d.id === job.division_id));
            const lines  = buildInvoiceLines(job, isGst);   // helper to compute taxable/cgst/sgst/igst
            const header = buildInvoiceHeader(job, lines, invoiceNo, isGst);

            // 4. Create invoice + atomically increment sequence
            //    GRAPHQL_MAP.createSalesInvoice server handler is generic:
            //    it runs exec_sql_object on whatever tableName is in payload,
            //    then updates document_sequence — no new mutation needed.
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.createSalesInvoice,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        tableName: "job_invoice",
                        xData: header,
                        xDetails: [{
                            tableName: "job_invoice_line",
                            fkeyName:  "job_invoice_id",
                            xData:     lines,
                        }],
                        doc_sequence_id:   seq.id,
                        doc_sequence_next: seq.next_number + 1,
                    }),
                },
            });
            created++;
        }
        // Reload modal data
        const refreshed = await fetchJobDetails(jobDetails.map(j => j.id));
        setJobDetails(refreshed);
        toast.success(created > 0
            ? `${created} invoice(s) created.${skipped > 0 ? ` ${skipped} skipped.` : ""}`
            : "No invoices needed to be created."
        );
    } catch {
        toast.error("Failed to create invoices. Please try again.");
    } finally {
        setCreatingInvoices(false);
    }
}
```

**Helper functions** (local to modal or in a `delivery-modal-helpers.ts`):

```ts
// Build invoice_no string from a document_sequence row
function formatInvoiceNo(seq: { prefix: string | null; separator: string | null; next_number: number; padding: number | null }): string {
    const padded = String(seq.next_number).padStart(seq.padding ?? 0, "0");
    return `${seq.prefix ?? ""}${seq.separator ?? ""}${padded}`;
}

// Compute line-level tax amounts from parts + charges
function buildInvoiceLines(job: JobDeliveryFullDetail, isGst: boolean): InvoiceLinePayload[] {
    const partLines = job.parts.map(p => {
        const taxable   = p.selling_price * p.qty;
        const gstRate   = isGst ? p.gst_rate : 0;
        const cgst      = isGst && !isIgst ? (taxable * gstRate / 200) : 0;
        const sgst      = cgst;
        const igst      = isGst && isIgst  ? (taxable * gstRate / 100) : 0;
        const total     = taxable + cgst + sgst + igst;
        return {
            description: p.part_name,
            part_code:   p.part_code,
            hsn_code:    p.hsn_code ?? null,
            qty:         p.qty,
            price:       p.selling_price,
            aggregate:   taxable,
            gst_rate:    gstRate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      total,
        };
    });
    const chargeLines = job.charges.map(c => {
        const taxable   = c.selling_price * c.qty;
        const gstRate   = isGst ? c.gst_rate : 0;
        const cgst      = isGst && !isIgst ? (taxable * gstRate / 200) : 0;
        const sgst      = cgst;
        const igst      = isGst && isIgst  ? (taxable * gstRate / 100) : 0;
        const total     = taxable + cgst + sgst + igst;
        return {
            description: c.charge_name,
            part_code:   null,
            hsn_code:    c.hsn_code ?? null,
            qty:         c.qty,
            price:       c.selling_price,
            aggregate:   taxable,
            gst_rate:    gstRate,
            cgst_amount: cgst,
            sgst_amount: sgst,
            igst_amount: igst,
            amount:      total,
        };
    });
    return [...partLines, ...chargeLines];
}

// Build job_invoice header row from job + computed lines
function buildInvoiceHeader(job: JobDeliveryFullDetail, lines: InvoiceLinePayload[], invoiceNo: string, isGst: boolean) {
    const aggregate   = lines.reduce((s, l) => s + l.aggregate, 0);
    const cgst_amount = lines.reduce((s, l) => s + l.cgst_amount, 0);
    const sgst_amount = lines.reduce((s, l) => s + l.sgst_amount, 0);
    const igst_amount = lines.reduce((s, l) => s + l.igst_amount, 0);
    const amount      = lines.reduce((s, l) => s + l.amount, 0);
    return {
        job_id:            job.id,
        invoice_no:        invoiceNo,
        invoice_date:      new Date().toISOString().slice(0, 10),
        supply_state_code: /* from job's division's state_code — fetch from context or job detail */ "",
        aggregate,
        cgst_amount,
        sgst_amount,
        igst_amount,
        amount,
    };
}
```

> ⚠️ **Important before coding**:
> - Verify `GET_DOCUMENT_SEQUENCES_BY_DIVISION` returns `document_type_code` in its result, or adjust the lookup.
> - Confirm the `JOB_INVOICE` document type code exists in the `document_type` table.
> - `isIgst` (inter-state GST) logic must be derived from the job's division state vs. customer state — replicate the same logic used in `final-a-job-section.tsx` (`forceIgst` flag).
> - The `supply_state_code` comes from the division's configured state — fetch it from `selectAvailableDivisions` context or the job detail.
> - **No new mutations are required** — `GRAPHQL_MAP.createSalesInvoice` handles the atomic insert + doc sequence increment for any tableName, including `job_invoice`.

**"Deliver & Close" handler:**
```ts
async function handleDeliver(values: DeliveryModalFormValues) {
    if (!deliveredStatusId) return;
    setDelivering(true);
    try {
        for (const job of jobDetails) {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.deliverJob,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        job_id:               job.id,
                        last_transaction_id:  job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                        delivered_status_id:  deliveredStatusId,
                        delivery_date:        values.delivery_date,
                        delivery_manner_name: values.delivery_manner,
                        remarks:              values.remarks ?? "",
                        payment: {
                            payment_date: values.delivery_date,
                            payment_mode: "Cash",
                            amount:       0,   // no payment at delivery in this flow
                        },
                    }),
                },
            });
        }
        toast.success(`${jobDetails.length} job(s) delivered and closed.`);
        onDelivered();
    } catch {
        toast.error("Delivery failed. Please try again.");
    } finally {
        setDelivering(false);
    }
}
```

**PDF generation:**
```ts
function handleShowPdf() {
    const jobsWithInvoice = jobDetails.filter(j => j.invoice_id);
    if (jobsWithInvoice.length === 0) return;
    // Load full invoice data (invoice lines) for each job
    // Then call buildMultiJobDeliveryPdf(...)
    // Open PdfPreviewModal
}
```

---

### Step 8 — Client: NEW `delivery-modal-jobs-table.tsx`

Purely presentational. Renders a scrollable `<table>` with one row per job, columns as specified in Requirement D above.

```tsx
type Props = {
    jobs: JobDeliveryFullDetail[];
    availableDivisions: DivisionContextType[];
};

export function DeliveryModalJobsTable({ jobs, availableDivisions }: Props) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
                <thead>
                    <tr>
                        {["Job No", "Alt Job No", "Job Date", "Customer", "Receive Manner",
                          "Job Type", "Receive Condition", "Device Details",
                          "Qty", "Estimate Amt", "Amount", "Due Amt"].map(h => (
                            <th key={h} className={thClass}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {jobs.map(job => {
                        const paid = job.payments.reduce((s, p) => s + Number(p.amount), 0);
                        const due  = Math.max(0, Number(job.amount ?? 0) - paid);
                        return (
                            <tr key={job.id} className="hover:bg-(--cl-accent)/5">
                                <td className={`${tdClass} font-mono font-semibold text-(--cl-accent)`}>
                                    #{job.job_no}
                                </td>
                                <td className={tdClass}>{job.alternate_job_no ?? "—"}</td>
                                <td className={tdClass}>{job.job_date}</td>
                                <td className={tdClass}>{job.customer_name}</td>
                                <td className={tdClass}>{job.receive_manner_name}</td>
                                <td className={tdClass}>{job.job_type_name}</td>
                                <td className={tdClass}>{job.receive_condition_name || "—"}</td>
                                <td className={tdClass}>{job.device_details ?? "—"}</td>
                                <td className={`${tdClass} text-right tabular-nums`}>{job.qty ?? "—"}</td>
                                <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(job.estimate_amount)}</td>
                                <td className={`${tdClass} text-right tabular-nums`}>{fmtCurrency(job.amount)}</td>
                                <td className={`${tdClass} text-right tabular-nums font-semibold ${due > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    {fmtCurrency(due)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
```

---

### Step 9 — Client: NEW `delivery-modal-invoices-section.tsx`

Shows invoice status per job:
- If `job.invoice_id` is set → chip "Invoice #{invoice_no} — {fmtCurrency(invoice_total)}" (read-only).
- If not set AND `isInvoiceable(job.job_type_code)` → "Pending — will generate" with a preview of parts + charges.
- If not invoiceable → badge "Skipped — {job_type_name}" (amber).

The "Create Invoice & Receipts" button lives in `DeliveryModal`'s footer, not here.

---

### Step 10 — Client: NEW `delivery-modal-receipts-section.tsx`

Shows receipts per job:
- Collapsible rows or accordion per job.
- Each job shows: existing receipts table + balance chip.
- "Add Receipt" button per job (opens the existing `AddReceiptModal`).

---

### Step 11 — Client: `deliver-job-pdf.ts` (modify)

**Change PDF format to half A4 (A5 portrait):**
```ts
// Change from:
const doc = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });

// To:
const doc = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
// A5 = 148mm × 210mm (half of A4 by area, portrait)
```

**Add multi-job export function:**
```ts
export type PdfJobDetail = {
    // existing fields plus:
    job_type_name:         string;
    receive_manner_name:   string;
    receive_condition_name: string;
    estimate_amount:       number | null;
    qty:                   number | null;
};

export function buildMultiJobDeliveryPdf(
    jobs: PdfJobDetail[],
    invoices: Map<number, JobInvoiceFullRow>,  // keyed by job.id
): jsPDF {
    const doc = new jsPDF({ format: "a5", orientation: "p", unit: "mm" });
    jobs.forEach((job, idx) => {
        if (idx > 0) doc.addPage();
        appendJobToPdf(doc, job, invoices.get(job.id) ?? null);
    });
    return doc;
}

function appendJobToPdf(doc: jsPDF, job: PdfJobDetail, invoice: JobInvoiceFullRow | null) {
    // Same logic as buildDeliverJobPdf but operating on a passed-in doc instance
    // so multiple jobs share one document
}
```

**Keep** `buildDeliverJobPdf` for now (may be referenced from modal's PDF handler).

---

### Step 12 — Client: Delete `delivery-details-form.tsx`

This file is superseded by the footer fields inside `DeliveryModal`. Once the modal is complete and the old subview is removed, this file can be deleted.

---

## Files Changed Summary

> **No new GraphQL mutations or server resolvers.** All operations use:
> - `GRAPHQL_MAP.genericUpdate` — generic insert/update
> - `GRAPHQL_MAP.createSalesInvoice` — reused for `job_invoice` (server handler is tableName-agnostic)
> - `GRAPHQL_MAP.deliverJob` — called in a loop, one per job
> - `GRAPHQL_MAP.genericQuery` — all reads

| File | Action | Notes |
|---|---|---|
| `app/db/sql_store.py` | **MODIFY** | Update `GET_DELIVERABLE_JOBS_PAGED`; add `GET_DELIVERABLE_JOBS_DETAIL_MULTI` |
| `src/constants/sql-map.ts` | **MODIFY** | Add `GET_DELIVERABLE_JOBS_DETAIL_MULTI` key |
| `src/constants/graphql-map.ts` | **NO CHANGE** | All needed mutations already exist |
| `deliver-job-schema.ts` | **MODIFY** | Add `JobDeliveryFullDetail`, `JobPartLine`, `JobChargeLine`, `DeliveryModalFormValues`, `getDeliveryModalDefaults` |
| `deliver-job-helpers.ts` | **MODIFY** | Add `NON_INVOICEABLE_JOB_TYPE_CODES`, `isInvoiceable` |
| `deliverable-jobs-grid.tsx` | **MODIFY** | Add checkbox column, `selectedIds`/`onSelectionChange`/`onSelectAll`/`onDeliverSelected` props; update `DeliverableJobRow` type |
| `deliver-job-section.tsx` | **REFACTOR** | Remove entire subview block + all old state/handlers; add modal state and wiring |
| `delivery-modal.tsx` | **CREATE** | Main modal: summary strip, jobs table, invoices section, receipts section, footer form |
| `delivery-modal-jobs-table.tsx` | **CREATE** | Jobs table component |
| `delivery-modal-invoices-section.tsx` | **CREATE** | Invoice status per job |
| `delivery-modal-receipts-section.tsx` | **CREATE** | Receipts per job |
| `deliver-job-pdf.ts` | **MODIFY** | Half-A4 (A5) format; add `buildMultiJobDeliveryPdf` |
| `delivery-details-form.tsx` | **DELETE** | Superseded by modal footer |

---

## Execution Order (Implementation Sequence)

| Step | File(s) | Must complete before |
|------|---------|---------------------|
| 1 | `sql_store.py` | Step 2 |
| 2 | `sql-map.ts` | Step 6 |
| 3 | `deliver-job-schema.ts` | Steps 4, 7–10 |
| 4 | `deliver-job-helpers.ts` | Steps 5, 7–10 |
| 5 | `deliverable-jobs-grid.tsx` | Step 6 |
| 6 | `delivery-modal-jobs-table.tsx` | Step 7 |
| 7 | `delivery-modal-invoices-section.tsx` | Step 7 |
| 8 | `delivery-modal-receipts-section.tsx` | Step 7 |
| 9 | `delivery-modal.tsx` | Step 10 |
| 10 | `deliver-job-section.tsx` | — |
| 11 | `deliver-job-pdf.ts` | — |
| 12 | Delete `delivery-details-form.tsx` | After step 10 verified |

---

## Data Verification Checklist (Before Coding)

- [ ] Run `SELECT code, name FROM job_type ORDER BY name` to confirm codes for IN_WARRANTY / RETURN / CANCELLED jobs
- [ ] Confirm `job.qty` column exists and is populated (seen in GET_JOB_DETAIL at line 3124)
- [ ] Confirm `job.estimate_amount` exists and is populated (seen at line 3124)
- [ ] Confirm `job_additional_charge` table and its columns (`charge_name`, `qty`, `selling_price`, `gst_rate`, `hsn_code`, `description`)
- [ ] Confirm `job_part_used` has `cost_price`, `selling_price`, `gst_rate` columns
- [ ] Run `SELECT code FROM document_type WHERE code LIKE '%INVOICE%' OR code LIKE '%JOB%'` to confirm the document type code for job invoices
- [ ] Verify `GET_DOCUMENT_SEQUENCES_BY_DIVISION` SQL returns `document_type_code` (or adjust to use `GET_DOCUMENT_SEQUENCES` and filter client-side)
- [ ] Confirm `GRAPHQL_MAP.createSalesInvoice` → server handler `resolve_create_sales_invoice_helper` accepts any `tableName` in payload (it does — confirmed: calls `exec_sql_object(db_name, schema, payload)` generically)
- [ ] Confirm `isIgst` / `forceIgst` logic in `final-a-job-section.tsx` to replicate the same CGST/SGST vs IGST split logic in `buildInvoiceLines`
- [ ] Test `GET_DELIVERABLE_JOBS_DETAIL_MULTI` with a psycopg array parameter `job_ids = [1, 2]`

---

## UI/UX Specifications

### Modal Dimensions
- Width: `max-w-5xl` or `max-w-6xl`
- Height: `max-h-[90vh]` with `overflow-y-auto` on the body section

### Interaction Guards
| Element | Guard |
|---|---|
| "Create Invoice & Receipts" | Disabled while creating; disabled if all jobs already have invoices or none are eligible |
| "Show PDF" | Disabled if no invoice exists for any job |
| "Deliver & Close" | Disabled until `delivery_manner` is selected AND not currently delivering |
| Modal close (X / Cancel) | Allowed only when no operation is in progress |
| Outside click | Blocked via `onPointerDownOutside={e => e.preventDefault()}` |
| Escape key | Blocked via `onEscapeKeyDown={e => e.preventDefault()}` |

### Toast Messages
| Event | Message |
|---|---|
| Invoices created | `"N invoice(s) created."` or `"N created, M skipped."` |
| All invoices already exist | `"All jobs already have invoices."` |
| Delivery success | `"N job(s) delivered and closed."` |
| Load failure | `"Failed to load job details. Please try again."` |
| Invoice creation failure | `"Failed to create invoices. Please try again."` |
| Delivery failure | `"Delivery failed. Please try again."` |

### PDF Specification
- Format: A5 portrait (148mm × 210mm = half of A4)
- One PDF document covering all selected jobs
- Per job: title divider, job info grid, invoice lines table, receipts table, balance due
- Page break between jobs

---

## Risk & Edge Cases

| Risk | Mitigation |
|---|---|
| Mixed-division jobs selected | Division shown as "Multiple"; GST computed per job individually |
| Job already closed mid-session | Server checks `is_closed`; display error and remove from modal |
| Invoice already exists on "Create" click | Server should handle gracefully; client skips jobs with `invoice_id` set |
| Large multi-select (50+ jobs) | Each modal data fetch is one SQL call via `GET_DELIVERABLE_JOBS_DETAIL_MULTI`; DB handles it |
| Array SQL parameter format | psycopg expects Python `list`; verify unnest works with `%(job_ids)s::bigint[]` |
| Non-invoiceable job type codes | Verified against DB before hardcoding in helpers |
| PDF content overflow | jsPDF autoTable handles multi-page automatically; test with long invoice tables |
| Blob URL memory leak | Revoke previous URL before assigning new one in PDF handler |

---

## Verification Checklist (After Implementation)

1. Checkboxes appear in deliverable jobs grid; "Deliver Selected (N)" button appears when ≥1 selected.
2. Single-job "Deliver" button opens modal with one job.
3. Multi-select "Deliver Selected" opens modal with all selected jobs.
4. Modal does NOT close when clicking outside or pressing Escape.
5. Summary strip shows correct division, GST, totals.
6. Jobs table shows all required columns with correct data.
7. Invoiceable jobs show "Pending" status; non-invoiceable show badge.
8. "Create Invoice & Receipts" button creates invoices; modal refreshes.
9. Already-invoiced jobs are not re-created on second "Create" click.
10. "Show PDF" opens half-A4 PDF preview in PdfPreviewModal.
11. PDF covers all jobs; each job has invoice + receipts section.
12. Delivery Manner dropdown is mandatory; "Deliver" button is disabled until selected.
13. "Deliver & Close Job(s)" closes all selected jobs; modal closes; list refreshes.
14. Delivered jobs disappear from Deliverable list; appear in Delivered Jobs tab.
15. `tsc --noEmit` — zero new TypeScript errors.
16. No console errors; no memory leaks on blob URL handling.
