# Deliver Job — Exhaustive Implementation Plan

## Overview

Enhance the existing `deliver-job-section.tsx` to fully implement the Deliver Job feature using
multiple focused UI components (mirroring the Final a Job architecture):

1. **Invoice line items** — read-only invoice card with full line table
2. **Multiple receipts** — add receipts independently at any time, refresh list inline
3. **PDF generation** — invoice + receipts combined PDF via jsPDF / autoTable
4. **PDF preview modal** — reuse shared `PdfPreviewModal`
5. **Decoupled delivery** — balance warning instead of blocking "Deliver & Close"
6. **Multi-component split** — section stays thin; logic is in typed child components

---

## Current State

`deliver-job-section.tsx` already provides:
- Paginated list of deliverable jobs (`is_final=true, is_closed=false`) with date filters, search, pagination
- Delivery view: job summary, invoice header-only summary, existing payments table, delivery details form, one-shot payment form, "Deliver & Close Job" button
- `deliverJob` mutation: inserts `job_payment` (if amount > 0) + sets `is_closed=true` + inserts `job_transaction`

**Gaps:** no invoice line items, no add-receipt without delivering, no PDF, balance blocks delivery.

---

## New File Tree

```
deliver-job/
├── deliver-job-helpers.ts          (constants + shared helpers — NEW)
├── deliver-job-schema.ts           (types + Zod schemas — ENHANCED)
├── deliver-job-section.tsx         (orchestrator — REFACTORED, much slimmer)
├── deliver-job-pdf.ts              (PDF generator — NEW)
├── deliverable-jobs-grid.tsx       (list view table — NEW, extracted from section)
├── delivery-invoice-card.tsx       (read-only invoice lines card — NEW)
├── delivery-receipts-card.tsx      (receipts list + balance summary — NEW)
├── add-receipt-modal.tsx           (modal form to add one receipt — NEW)
└── delivery-details-form.tsx       (delivery date/manner/payment sub-form — NEW)
```

---

## 1. `deliver-job-helpers.ts` — NEW

Shared constants and helpers (pattern from `final-a-job-helpers.ts`).

```typescript
export const PAGE_SIZE    = 50;
export const DEBOUNCE_MS  = 1600;

export const PAYMENT_MODES = [
    "Cash", "Card", "UPI", "Cheque", "Online Transfer", "Other",
] as const;

export const thClass =
    "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide " +
    "text-[var(--cl-text-muted)] px-2 py-2 text-left border-b " +
    "border-[var(--cl-border)] bg-[var(--cl-surface-2)]";

export const tdClass =
    "px-2 py-1.5 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

export function fmtCurrency(n: number | null | undefined): string {
    if (n == null) return "—";
    return `₹${Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
}
```

---

## 2. `deliver-job-schema.ts` — ENHANCED

Keep existing `deliverJobSchema` and `getDeliverJobDefaultValues`.
Add:

```typescript
// ── Invoice line (matches GET_JOB_INVOICE_BY_JOB JSON output keys) ──────────

export type JobInvoiceLineRow = {
    id:          number;
    description: string;
    part_code:   string | null;
    hsn_code:    string | null;
    qty:         number;
    price:       number;        // unit price
    aggregate:   number;        // taxable amount for this line
    gst_rate:    number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    amount:      number;        // line total (taxable + tax)
};

// ── Invoice header + lines ────────────────────────────────────────────────────

export type JobInvoiceFullRow = {
    id:                number;
    job_id:            number;
    invoice_no:        string;
    invoice_date:      string;
    supply_state_code: string;
    aggregate:         number;  // total taxable
    cgst_amount:       number;
    sgst_amount:       number;
    igst_amount:       number;
    amount:            number;  // grand total
    lines:             JobInvoiceLineRow[];
};

// ── Add-receipt form ──────────────────────────────────────────────────────────

export const addReceiptSchema = z.object({
    payment_date: z.string().min(1, "Date is required"),
    payment_mode: z.string().min(1, "Mode is required"),
    amount:       z.coerce.number().min(0.01, "Amount must be > 0"),
    reference_no: z.string().optional(),
    remarks:      z.string().optional(),
});

export type AddReceiptFormValues = z.infer<typeof addReceiptSchema>;

export function getAddReceiptDefaults(suggestedAmount = 0): AddReceiptFormValues {
    return {
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: "Cash",
        amount:       suggestedAmount,
        reference_no: "",
        remarks:      "",
    };
}
```

The local types `DeliverableJobRow`, `JobPayment`, `JobDeliveryDetail`, `DeliveryMannerRow`,
`JobStatusRow` stay in `deliver-job-section.tsx` (used only there).

---

## 3. `deliver-job-pdf.ts` — NEW

Uses jsPDF + autoTable (same libs as `sales-invoice-pdf-gen.ts`).

```typescript
import { jsPDF }    from "jspdf";
import autoTable    from "jspdf-autotable";
import type { JobDeliveryDetail }  from "./deliver-job-section"; // re-export the local type, or duplicate it here
import type { JobInvoiceFullRow }  from "./deliver-job-schema";

function fmt(n: number | null | undefined): string {
    if (n == null) return "—";
    return Number(n).toFixed(2);
}

export function buildDeliverJobPdf(
    job:     JobDeliveryDetail,
    invoice: JobInvoiceFullRow | null,
): jsPDF {
    const doc       = new jsPDF({ format: "a4", orientation: "p", unit: "mm" });
    const margin    = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const midX      = pageWidth / 2;
    let   y         = margin;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("JOB DELIVERY NOTE", midX, y, { align: "center" });
    y += 5;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    // Job info grid (2 columns)
    const infoRows: [string, string][] = [
        ["Job No",     job.job_no + (job.alternate_job_no ? ` / Alt: ${job.alternate_job_no}` : "")],
        ["Job Date",   job.job_date],
        ["Customer",   job.customer_name],
        ["Mobile",     job.mobile],
        ["Technician", job.technician_name ?? "—"],
        ["Status",     job.job_status_name],
    ];
    doc.setFontSize(9);
    infoRows.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x   = col === 0 ? margin : midX + 4;
        const cy  = y + row * 6.5;
        doc.setFont("helvetica", "bold");   doc.text(`${label}:`, x,       cy);
        doc.setFont("helvetica", "normal"); doc.text(value,        x + 25,  cy);
    });
    y += Math.ceil(infoRows.length / 2) * 6.5 + 5;

    // Invoice section
    if (invoice) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(
            `Invoice: ${invoice.invoice_no}   Date: ${invoice.invoice_date.slice(0, 10)}`,
            margin, y,
        );
        y += 5;

        autoTable(doc, {
            startY:  y,
            margin:  { left: margin, right: margin },
            head: [["Description","HSN","Qty","Price","Taxable","GST%","CGST","SGST","IGST","Total"]],
            body: (invoice.lines ?? []).map(l => [
                l.description,
                l.hsn_code  ?? "—",
                l.qty,
                fmt(l.price),
                fmt(l.aggregate),
                `${l.gst_rate}%`,
                fmt(l.cgst_amount),
                fmt(l.sgst_amount),
                fmt(l.igst_amount),
                fmt(l.amount),
            ]),
            foot: [[
                { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
                fmt(invoice.aggregate), "",
                fmt(invoice.cgst_amount),
                fmt(invoice.sgst_amount),
                fmt(invoice.igst_amount),
                fmt(invoice.amount),
            ]],
            styles:       { fontSize: 8, cellPadding: 1.8 },
            headStyles:   { fillColor: [60, 80, 140], textColor: 255, fontStyle: "bold" },
            footStyles:   { fillColor: [230, 230, 230], fontStyle: "bold" },
            columnStyles: {
                0: { cellWidth: 38 },
                2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
                6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
                9: { halign: "right" },
            },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
    } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(180, 80, 0);
        doc.text("No invoice found.", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 7;
    }

    // Receipts section
    const payments = job.payments ?? [];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Receipts", margin, y);
    y += 5;

    if (payments.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No receipts recorded.", margin, y);
        y += 6;
    } else {
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        autoTable(doc, {
            startY:  y,
            margin:  { left: margin, right: margin },
            head:    [["#","Date","Mode","Amount","Ref No","Remarks"]],
            body:    payments.map((p, i) => [
                i + 1, p.payment_date.slice(0, 10), p.payment_mode,
                fmt(p.amount), p.reference_no ?? "—", p.remarks ?? "—",
            ]),
            foot:    [[
                { content: "TOTAL RECEIVED", colSpan: 3, styles: { fontStyle: "bold", halign: "right" } },
                fmt(totalPaid), "", "",
            ]],
            styles:       { fontSize: 8, cellPadding: 1.8 },
            headStyles:   { fillColor: [40, 120, 60], textColor: 255, fontStyle: "bold" },
            footStyles:   { fillColor: [230, 230, 230], fontStyle: "bold" },
            columnStyles: { 3: { halign: "right" } },
        });
        y = (doc as any).lastAutoTable.finalY + 4;

        const balance = Math.max(0, Number(invoice?.amount ?? 0) - totalPaid);
        if (balance > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(180, 0, 0);
            doc.text(`Balance Due: ₹${balance.toFixed(2)}`, pageWidth - margin, y, { align: "right" });
            doc.setTextColor(0, 0, 0);
        }
    }

    return doc;
}
```

---

## 4. `deliverable-jobs-grid.tsx` — NEW (extracted from section list view)

Self-contained list grid with toolbar (date range, search, refresh) and pagination.

```typescript
type Props = {
    rows:           DeliverableJobRow[];
    loading:        boolean;
    total:          number;
    page:           number;
    fromDate:       string;
    toDate:         string;
    search:         string;
    branchId:       number | null;
    loadingDetail:  boolean;
    setPage:        (v: number | ((p: number) => number)) => void;
    onFromDate:     (v: string) => void;
    onToDate:       (v: string) => void;
    onSearch:       (v: string) => void;
    onRefresh:      () => void;
    onDeliver:      (row: DeliverableJobRow) => void;
};
```

Columns: `#  |  Date  |  Job No  |  Customer  |  Mobile  |  Status  |  Technician  |  Invoice  |  Invoice Total  |  Action`

Action cell: single "Deliver" ghost button (`onClick={() => onDeliver(row)}`).

Pagination: same chevron buttons as existing section.

Toolbar: date range pickers + debounced search + Refresh button.

Import constants from `./deliver-job-helpers`.

---

## 5. `delivery-invoice-card.tsx` — NEW

Read-only card. No form controls.

```typescript
type Props = {
    invoice: JobInvoiceFullRow | null;
};

export function DeliveryInvoiceCard({ invoice }: Props) { ... }
```

**Render:**
- Section label: "Invoice"
- If `invoice` is null → amber warning: "No invoice found — create one in Final a Job first."
- If invoice exists:
  - Header row: Invoice No | Date | State Code | Grand Total (4 chips)
  - Line items table using `thClass` / `tdClass` from helpers
    - Columns: Description | Part Code | HSN | Qty | Price | Taxable | GST% | CGST | SGST | IGST | Total
  - `<tfoot>` with TOTAL row (aggregate, cgst, sgst, igst, amount in bold)

---

## 6. `delivery-receipts-card.tsx` — NEW

Shows balance summary + payment list + "Add Receipt" trigger.

```typescript
type Props = {
    payments:     JobPayment[];
    invoiceTotal: number | null;
    onAddReceipt: () => void;
};

export function DeliveryReceiptsCard({ payments, invoiceTotal, onAddReceipt }: Props) { ... }
```

**Render:**
- Header row: label "Receipts" (left) + `<Button onClick={onAddReceipt}>+ Add Receipt</Button>` (right)
- Balance chips: Invoice Total | Total Received (green) | Balance Due (red if > 0)
- If no payments → "No receipts yet." in muted text
- Payment table: `#  |  Date  |  Mode  |  Amount  |  Ref No  |  Remarks`
  - Mode shown as colour-coded badge (Cash=green, Card=blue, UPI=purple, Cheque=slate, other=grey)

Calculates `alreadyPaid` and `balance` internally from props.

---

## 7. `add-receipt-modal.tsx` — NEW

Controlled modal with its own `useForm`. Calls `onSave` and closes on success.

```typescript
type Props = {
    open:            boolean;
    defaultAmount?:  number;
    onClose:         () => void;
    onSave:          (values: AddReceiptFormValues) => Promise<void>;
};

export function AddReceiptModal({ open, defaultAmount = 0, onClose, onSave }: Props) { ... }
```

**Form fields:** Payment Date | Payment Mode (Select) | Amount | Reference No | Remarks

**Buttons:** Cancel (variant=outline) | Save Receipt (emerald, disabled while submitting)

Uses `Dialog / DialogContent / DialogHeader / DialogTitle / DialogFooter` from `@/components/ui/dialog`.

Calls `receiptForm.reset(getAddReceiptDefaults(defaultAmount))` when `open` transitions true→false is avoided, but reset on open via `useEffect([open])`.

---

## 8. `delivery-details-form.tsx` — NEW

Pure controlled form fragment (no own state). Renders the "Delivery Details" and "Payment at Delivery" cards.

```typescript
type Props = {
    form:            UseFormReturn<DeliverJobFormValues>;
    deliveryManners: { id: number; name: string }[];
    balance:         number;
};

export function DeliveryDetailsForm({ form, deliveryManners, balance }: Props) { ... }
```

**Renders two cards:**

**Card 1 — Delivery Details:**
- Delivery Date (required, `<Input type="date" />`)
- Delivery Manner (required, `<Select>`)
- Transaction Remarks (optional, `<Textarea>` 1 row)

**Card 2 — Payment at Delivery:**
- Subtitle: "Leave amount = 0 to skip inserting a payment record."
- Payment Date | Payment Mode | Amount | Reference No | Remarks (5-column grid)
- If `balance > 0` AND `form.watch("payment_amount") == 0`: amber note "Balance of ₹X is outstanding."

---

## 9. `deliver-job-section.tsx` — REFACTORED (orchestrator)

Retains all state and data-fetch logic. The delivery view body becomes:

```tsx
<div className="flex-1 overflow-y-auto p-4 space-y-5">
    {/* 1. Job Summary (inline — small, stays in section) */}
    <JobSummaryCard detail={detail} />

    {/* 2. Invoice card */}
    <DeliveryInvoiceCard invoice={invoice} />

    {/* 3. Receipts card */}
    <DeliveryReceiptsCard
        payments={detail.payments}
        invoiceTotal={detail.invoice_total}
        onAddReceipt={() => {
            setReceiptDefaultAmt(Math.max(0, balance));
            setShowReceiptModal(true);
        }}
    />

    {/* 4. Delivery details + optional payment form */}
    <DeliveryDetailsForm
        form={form}
        deliveryManners={deliveryManners}
        balance={balance}
    />
</div>
```

`JobSummaryCard` stays inline (small, ~30 lines, not worth a file). Or extract as `delivery-job-summary-card.tsx` for consistency — **extract it** to keep section thin.

### 9.1 State additions

```typescript
const [invoice,            setInvoice]           = useState<JobInvoiceFullRow | null>(null);
const [showReceiptModal,   setShowReceiptModal]   = useState(false);
const [receiptDefaultAmt,  setReceiptDefaultAmt]  = useState(0);
const [pdfUrl,             setPdfUrl]             = useState<string | null>(null);
const [showPdf,            setShowPdf]            = useState(false);
```

### 9.2 `handleRowClick` — parallel fetch

```typescript
async function handleRowClick(row: DeliverableJobRow) {
    if (!dbName || !schema) return;
    setLoadingDetail(true);
    setInvoice(null);
    try {
        const [detailRes, invRes] = await Promise.all([
            apolloClient.query({ ... sqlId: SQL_MAP.GET_JOB_DELIVERY_DETAIL,  sqlArgs: { job_id: row.id } }),
            apolloClient.query({ ... sqlId: SQL_MAP.GET_JOB_INVOICE_BY_JOB,   sqlArgs: { job_id: row.id } }),
        ]);
        const d   = detailRes.data?.genericQuery?.[0] ?? null;
        const inv = invRes.data?.genericQuery?.[0]    ?? null;
        if (!d) { toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED); return; }
        setDetail(d);
        setInvoice(inv);
        const alreadyPaid = (d.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const balance     = Math.max(0, Number(d.invoice_total ?? 0) - alreadyPaid);
        form.reset(getDeliverJobDefaultValues(balance > 0 ? balance : 0));
        setSubView("delivery");
    } catch {
        toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED);
    } finally {
        setLoadingDetail(false);
    }
}
```

### 9.3 `refreshPayments` — lightweight reload

```typescript
async function refreshPayments() {
    if (!detail || !dbName || !schema) return;
    try {
        const res = await apolloClient.query({
            fetchPolicy: "network-only", query: GRAPHQL_MAP.genericQuery,
            variables: { db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_JOB_PAYMENTS_BY_JOB,
                    sqlArgs: { job_id: detail.id },
                }),
            },
        });
        const payments = res.data?.genericQuery ?? [];
        setDetail(prev => prev ? { ...prev, payments } : prev);
    } catch { /* silent */ }
}
```

### 9.4 `handleAddReceipt` — passed to AddReceiptModal as `onSave`

```typescript
async function handleAddReceipt(values: AddReceiptFormValues) {
    if (!detail || !dbName || !schema) return;
    await apolloClient.mutate({
        mutation:  GRAPHQL_MAP.genericUpdate,
        variables: {
            db_name: dbName, schema,
            value: graphQlUtils.buildGenericUpdateValue({
                tableName: "job_payment",
                xData: {
                    job_id:       detail.id,
                    payment_date: values.payment_date,
                    payment_mode: values.payment_mode,
                    amount:       Number(values.amount),
                    reference_no: values.reference_no || null,
                    remarks:      values.remarks      || null,
                },
            }),
        },
    });
    toast.success(MESSAGES.SUCCESS_RECEIPT_CREATED);
    await refreshPayments();
}
```

### 9.5 `handleOpenPdf`

```typescript
function handleOpenPdf() {
    if (!detail) return;
    const doc = buildDeliverJobPdf(detail, invoice);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(doc.output("bloburl") as string);
    setShowPdf(true);
}
```

### 9.6 Header bar changes

Add two buttons after the job info:

```tsx
<Button variant="outline" className="h-8 gap-1.5 px-3 text-xs" onClick={handleOpenPdf}>
    <FileText className="h-3.5 w-3.5" />
    PDF
</Button>

{/* existing Deliver & Close button — canDeliver no longer checks needsPayment */}
```

**`canDeliver` change:**

```typescript
// Remove needsPayment gate entirely
const canDeliver = form.formState.isValid && !form.formState.isSubmitting && !!deliveredStatusId;
```

### 9.7 Modals at bottom of JSX

```tsx
<AddReceiptModal
    open={showReceiptModal}
    defaultAmount={receiptDefaultAmt}
    onClose={() => setShowReceiptModal(false)}
    onSave={handleAddReceipt}
/>

<PdfPreviewModal
    isOpen={showPdf}
    onClose={() => setShowPdf(false)}
    pdfUrl={pdfUrl}
    title={`Delivery Note — ${detail?.job_no ?? ""}`}
    filename={`delivery-${detail?.job_no ?? "note"}.pdf`}
/>
```

---

## 10. List View Delegation

In the section's list-view return, replace the inline table with:

```tsx
<DeliverableJobsGrid
    rows={rows}
    loading={loading}
    total={total}
    page={page}
    fromDate={fromDate}
    toDate={toDate}
    search={search}
    branchId={branchId}
    loadingDetail={loadingDetail}
    setPage={setPage}
    onFromDate={v => { setFromDate(v); setPage(1); }}
    onToDate={v  => { setToDate(v);   setPage(1); }}
    onSearch={handleSearchChange}
    onRefresh={() => { if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page); }}
    onDeliver={handleRowClick}
/>
```

---

## 11. Messages — `constants/messages.ts`

`SUCCESS_RECEIPT_CREATED` already exists. No new keys required.

---

## 12. SQL Map — `constants/sql-map.ts`

`GET_JOB_PAYMENTS_BY_JOB` already registered (line 217). No change needed.

---

## 13. Files Changed Summary

| File | Action | Notes |
|---|---|---|
| `deliver-job-helpers.ts`       | **CREATE** | PAGE_SIZE, DEBOUNCE_MS, PAYMENT_MODES, thClass, tdClass, fmtCurrency |
| `deliver-job-schema.ts`        | **ENHANCE** | Add JobInvoiceLineRow, JobInvoiceFullRow, addReceiptSchema, AddReceiptFormValues, getAddReceiptDefaults |
| `deliver-job-pdf.ts`           | **CREATE** | buildDeliverJobPdf(job, invoice) → jsPDF |
| `deliverable-jobs-grid.tsx`    | **CREATE** | Extracted list table + toolbar + pagination |
| `delivery-invoice-card.tsx`    | **CREATE** | Read-only invoice lines card |
| `delivery-receipts-card.tsx`   | **CREATE** | Receipts list + balance chips + Add Receipt trigger |
| `add-receipt-modal.tsx`        | **CREATE** | Controlled modal with own useForm |
| `delivery-details-form.tsx`    | **CREATE** | Delivery date/manner/remarks + optional payment fields |
| `deliver-job-section.tsx`      | **REFACTOR** | Slim orchestrator: state + fetches + handlers; delegates UI to above |
| Server files                   | No change | All SQL and mutations already exist |

---

## 14. Edge Cases

| Case | Handling |
|---|---|
| No invoice when delivering | Amber warning in invoice card; receipts still allowed; delivery not blocked |
| Invoice lines array empty | Table renders with only the tfoot totals row |
| Balance already zero | Add Receipt defaults to 0; user can enter any amount |
| Refresh after add-receipt fails silently | Payments list may be stale; user can re-open delivery row |
| PDF opened before payments load | Reflects whatever `detail.payments` holds at that moment |
| Blob URL memory leak | Revoke previous `pdfUrl` before assigning new one |
| `payment_date` returned as ISO with time | `.slice(0, 10)` in PDF and display |
| `deliverJob` with payment_amount 0 | Server skips inserting job_payment (already correct) |

---

## 15. Verification Checklist

1. List loads; date range, search, pagination, refresh all work — no regression.
2. Clicking "Deliver" fetches detail + invoice in parallel; spinner shown.
3. Invoice card shows full line table when invoice exists; amber warning when not.
4. Invoice tfoot totals match header totals.
5. "Add Receipt" opens modal; saving inserts `job_payment`, payments table refreshes without full reload.
6. Add 2+ receipts, verify all appear; balance chips update.
7. "Deliver & Close Job" works with outstanding balance (warning visible but button enabled).
8. After delivery, job disappears from list (is_closed=true).
9. PDF button opens modal with invoice lines + receipts table.
10. PDF download saves file via "Download Document" button.
11. `tsc --noEmit` — zero new errors.
12. No console errors on blob URL handling.
