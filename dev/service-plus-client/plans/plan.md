# Plan: Job Invoice Posting to Trace-plus

## Goal

Extend the existing `accountsPosting` flow (which already posts money receipts and purchase
invoices) to also post **job invoices** per-division, conditioned on each division's
`account_setting.jobInvoice` being fully configured.

---

## Context

### Existing flow

`resolve_accounts_posting_helper` (mutation_helper.py ~2214):

1. Fetches all active divisions for the branch, each carrying their `account_setting` JSON.
2. Builds a **work list**: divisions whose `account_setting` has `clientCode`, `buCode`,
   `branchId`, `receipt.debitAccountId`, `receipt.creditAccountId`.
3. For each work-item, fetches unposted `job_payment` rows (money receipts) and
   `purchase_invoice` rows.
4. Posts each record to Trace-plus via `_post_tran_h_to_trace_plus`, marks it
   `is_posted = true`, emits live progress via pubsub.

### account_setting.jobInvoice

Already defined in `division-schema.ts` and in the division edit dialog:
```
jobInvoice: {
    debitAccountId,   // accounts-receivable (or similar)
    creditAccountId,  // income / sales account
    productId,        // Trace-plus product ID for the sale line
    defaultProductHsn,
    defaultGstRate,
}
```

### job_invoice table
Fields: `id, job_id, invoice_no, invoice_date, supply_state_code, aggregate,
cgst_amount, sgst_amount, igst_amount, amount, is_posted`

Lines via `job_invoice_line`: `description, part_code, hsn_code, qty, price,
aggregate, gst_rate, cgst_amount, sgst_amount, igst_amount, amount`

Job (parent): `job_no, customer_contact_id, is_igst`

### Trace-plus TranH shape for a sales-type entry
- `tranTypeId: 4` (sales invoice; purchase = 5, receipt = 3)
- `isInput: false` in `ExtGstTranD` (output GST, unlike purchase invoices which use `isInput: true`)
- `SalePurchaseDetails` lines just like purchase invoices

---

## Implementation status

### ✅ DONE — core posting

**`sql_store.py`** — `GET_UNPOSTED_JOB_INVOICES` and `MARK_JOB_INVOICE_POSTED` added.

**`mutation_helper.py`** — `_build_job_invoice_tran_h` added; `resolve_accounts_posting_helper`
extended to fetch `ji_rows`, check `account_setting.jobInvoice`, post each invoice (step 6),
track `posted_job_invoices`.

**`accounts-posting-section.tsx`** — `job_invoices.posted: true`, `postableTotal` updated,
footer note updated.

---

## Pending — customer GSTIN + address in the Trace-plus sales voucher

### What's already done
`ExtGstTranD.gstin` is already populated with `customer_gstin` in `_build_job_invoice_tran_h`:
```python
ext_gst: dict = {"isInput": False}
if ji_row.get("customer_gstin"):
    ext_gst["gstin"] = ji_row["customer_gstin"]
```
`GET_UNPOSTED_JOB_INVOICES` already fetches `customer_gstin`, `customer_address`
(CONCAT of address_line1 / address_line2 / city), and `customer_pin`.

### What's missing
Customer address and PIN are fetched but **never placed in the TranH payload**.
The current `TranH.remarks` only carries:
```
JOB:{job_no}, {customer_name}, Mobile:{mobile}
```
The pattern for purchase invoices puts vendor address in `TranH.remarks`.
Customer address + PIN should be appended to job invoice remarks the same way.

### Change required — `_build_job_invoice_tran_h` only

Extend the remarks list to include `customer_address` and `customer_pin`:

```python
remarks_parts = [p for p in [
    f"JOB:{ji_row['job_no']}" if ji_row.get("job_no") else None,
    ji_row.get("customer_name"),
    f"Mobile:{ji_row['mobile']}" if ji_row.get("mobile") else None,
    ji_row.get("customer_address") or None,
    f"PIN:{ji_row['customer_pin']}" if ji_row.get("customer_pin") else None,
] if p]
```

**No SQL change needed** — both fields are already fetched.
**No change to `ExtGstTranD`** — GSTIN is already there.
**One function, four lines changed.**
