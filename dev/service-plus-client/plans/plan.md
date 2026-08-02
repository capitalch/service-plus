# Fix: Job-invoice amount differs between Trace grid and Trace edit form

**Source:** plans/tran.md

## Context

When a job invoice is posted to trace-plus, the Trace *Sales View grid* shows the
correct total, but opening the same voucher in the Trace *edit form* shows a small
(paisa-level) difference.

Reason: in trace-plus a sale line's total is re-derived on edit as
`qty × priceGst`. Service+ posts each job-invoice line's per-unit gross into
`priceGst`, and the invoice header total into the voucher amount (grid value).
The gap appears because **the sum of the Service+ line amounts does not equal the
Service+ invoice header amount**:

At invoice creation (`delivery-modal.tsx:463-475`) the header `amount` is taken
from the finalized `job.amount`, while the line items sum to `lineTotal`
(`aggregate + gst`). These two can differ by a rounding/approximation residual.
So: Trace grid = `job_invoice.amount`, Trace edit = `Σ line amounts` → mismatch.

## Fix (the simple approach)

Make **`Σ job_invoice_line.amount == job_invoice.amount`** at the point the
invoice (and its lines) are written. Once the lines sum exactly to the header,
each line's `amount` maps cleanly to Trace's `priceGst` and the edit-form total
re-derives to the same figure the grid shows — no difference.

### Change 1 (primary, client) — reconcile line amounts to the header

File: `service-plus-client/.../jobs/deliver-job/delivery-modal.tsx`
Applies to **both** invoice-writing paths: create (`~457-502`) and regenerate
(`~561-585`).

Add a small helper and call it right after the header `amount` is decided,
absorbing the residual into the last line (rounding-level, so treat it as taxable
and leave GST unchanged), then recompute the header `aggregate` from the adjusted
lines:

```ts
// Nudge line amounts so they sum EXACTLY to the invoice header amount, so the
// value that lands in trace-plus priceGst reconciles with the voucher total and
// the Trace edit form re-derives the same total the grid shows.
function reconcileLineAmounts(lines: InvoiceLine[], targetAmount: number): InvoiceLine[] {
    if (lines.length === 0) return lines;
    const sum      = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const residual = Math.round((targetAmount - sum) * 100) / 100;
    if (residual === 0) return lines;
    const last = lines[lines.length - 1];
    last.amount    = Math.round((last.amount    + residual) * 100) / 100;
    last.aggregate = Math.round((last.aggregate + residual) * 100) / 100; // keeps amount = aggregate + gst
    return lines;
}
```

Wire-up (both paths), e.g. in the create path replace the current
`aggregate`/`amount` block so `amount` is decided first, then reconcile, then
derive `aggregate` from the reconciled lines:

```ts
const lines0      = buildInvoiceLines(job, isGst, job.is_igst ?? false, showPartsInInvoiceSetting);
const cgst_amount = Math.round(lines0.reduce((s, l) => s + l.cgst_amount, 0) * 100) / 100;
const sgst_amount = Math.round(lines0.reduce((s, l) => s + l.sgst_amount, 0) * 100) / 100;
const igst_amount = Math.round(lines0.reduce((s, l) => s + l.igst_amount, 0) * 100) / 100;
const lineTotal   = Math.round(lines0.reduce((s, l) => s + l.amount, 0) * 100) / 100;
const jobAmt      = Number(job.amount ?? 0);
const amount      = jobAmt > 0 ? Math.round(jobAmt * 100) / 100 : lineTotal;

const lines       = reconcileLineAmounts(lines0, amount);            // Σ lines == amount
const aggregate   = Math.round(lines.reduce((s, l) => s + l.aggregate, 0) * 100) / 100;
```

The regenerate path (`~566-570`) gets the same reconcile call after its
`amount = Math.round(Number(job.amount ?? 0) * 100) / 100` line.

Result: `Σ line.amount === job_invoice.amount`, with `line.amount =
line.aggregate + gst` still holding on every line.

### Change 2 (server) — map line.amount straight into priceGst

File: `service-plus-server/.../sales_accounts/mutations.py`, `_build_job_invoice_tran_h`.

For the transfer to put `job_invoice_line.amount` into `SalePurchaseDetails.priceGst`
verbatim (so Trace's `qty × priceGst` recompute returns exactly that amount), post
each line with **`qty = 1`** and `priceGst = line["amount"]`:

```python
"qty":      1,
"price":    float(line["aggregate"]),   # line taxable
"priceGst": float(line["amount"]),      # line gross  → maps 1:1 to job_invoice_line.amount
"amount":   float(line["amount"]),
```

This is only material for lines with `qty > 1` (for `qty == 1` the current
`amount/qty` already equals `amount`). It also supersedes the earlier one-line
`price = aggregate/qty` edit, which was inert (Trace ignores the posted `price`
and re-derives it from `priceGst`). The voucher's debit/credit `TranD.amount`
stays `= ji_row["amount"]`, which now equals `Σ line.amount`, so grid == edit.

## Non-GST invoices

Both changes are correct for non-GST divisions. A non-GST line has
`cgst = sgst = igst = 0` and `amount == aggregate`, so Change 1's residual
(added to `amount` and `aggregate`) preserves `amount = aggregate + gst`, and
Change 2's `qty=1 / priceGst=line.amount` re-derives in Trace (with `gstRate=0`)
to exactly `line.amount`. Note this confirms Change 2 is what fixes `qty > 1`
lines whether or not GST applies — a reconciled `qty=3, amount=100` line posted
the old way (`priceGst = 100/3`) re-derives to 99.99 in Trace's edit form.

## Out of scope

- `_build_sales_invoice_tran_h` / `_build_purchase_invoice_tran_h` share the same
  `priceGst = total/qty` shape and would drift identically for `qty > 1`; they
  post real stock products, so leave them for a separate pass.
- If `job.amount` is ever deliberately far from the parts/charges sum (a real
  discount rather than a rounding residual), absorbing it into one line as
  taxable slightly misstates that line's GST. This plan assumes the difference is
  approximation-level, matching the reported symptom.

## Verification

1. Create/regenerate a job invoice where `job.amount` differs from the line sum
   by a paisa; confirm in the DB that `Σ job_invoice_line.amount == job_invoice.amount`.
2. Post it (trace-plus runs locally at `/home/sushant/projects/trace-plus/dev`)
   and confirm the Trace Sales grid amount and the edit-form total now match, and
   the voucher saves (debit == credit).
3. Regression: a plain qty=1 invoice with no rounding residual posts unchanged.
