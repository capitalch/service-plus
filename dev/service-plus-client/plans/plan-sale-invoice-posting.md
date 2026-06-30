# Plan: Post Sales Invoices to Trace Plus (Jobs > Accounts Posting)

## Context

In **Jobs > Accounts Posting**, the user clicks "Post data to Trace Plus" to push unposted
records to the external Trace Plus accounting system. Today the flow posts **money receipts,
purchase invoices, and job invoices** but **not sales invoices** — sales is shown in the
per-division breakdown only as an informational column (`posted: false`) and is never pushed.

The scaffolding for sales already exists: the `account_setting.salesInvoice` config slot is
fully wired in the division add/edit dialogs (`debitAccountId`, `creditAccountId`, `productId`,
`defaultProductHsn`, `defaultGstRate`, `contactsId`), the type `salesInvoice` is in
`AccountSettingType`, and sales counts already appear in `GET_UNPOSTED_COUNTS_BY_DIVISION`.
What is missing is the actual posting path: the server has no sales-invoice voucher builder,
no unposted-sales fetch, and no mark-posted update.

This change makes sales invoices post to Trace Plus exactly like purchase/job invoices.

**Decision (confirmed with user):** Sales **returns** (`is_return = true`) **are included**
and posted, using a dedicated Trace Plus voucher type: **`tranTypeId = 9`** for returns vs
**`tranTypeId = 4`** for normal sales. Both normal sales and returns are counted and posted;
the only difference in the built voucher is the `tranTypeId`. The leg structure and GST
direction (output GST, `isInput = False`) are kept identical to a normal sale — Trace Plus
interprets `tranTypeId = 9` as a return/credit-note. (Verify direction in Trace Plus; if the
legs must also swap, that is a one-line change in the builder.)

**Voucher semantics:** A sales invoice is an output-GST sale, identical in shape to a job
invoice → `ExtGstTranD.isInput = False`, `tranTypeId = 4` (or `9` for a return). Its line
columns match the purchase-invoice shape (`unit_price` / `total_amount` per line; header
`total_amount`).

> Schema note: the column names come from the authoritative client insert code
> (`sales-entry-section.tsx`) and `GET_SALES_INVOICE_DETAIL` — header `total_amount`,
> `aggregate_amount`, `total_tax`; line `unit_price`, `aggregate_amount`, `total_amount`.
> The stale `service_plus_service.sql` dump and the `*_FOR_POSTING_*` queries that use
> `si.aggregate`/`si.amount`/`sil.price` are NOT authoritative — do not copy those names.

## Server changes

### 1. `app/db/sql_store.py`

**Add `GET_UNPOSTED_SALES_INVOICES`** — mirror `GET_UNPOSTED_PURCHASE_INVOICES`
(sql_store.py:4465), resolving `division_id` from `%(division_code)s`, aggregating lines into
a `lines` json array. Differences:
- Source tables: `sales_invoice si` + `sales_invoice_line sil` (`sil.sales_invoice_id = si.id`),
  `spare_part_master sp ON sp.id = sil.part_id` for `part_code`, and
  `customer_contact cc ON cc.id = si.customer_contact_id` for remarks (mobile, address, postal_code).
- Header SELECT: `si.id, si.invoice_no, si.invoice_date, si.total_amount, si.is_return,
  si.cgst_amount, si.sgst_amount, si.igst_amount, si.customer_name, si.customer_gstin,
  cc.mobile, cc.postal_code AS customer_pin`, plus a `customer_address` built with
  `CONCAT_WS` like the job-invoice query (cc.address_line1/2/city). `is_return` is selected so
  the builder can pick the right `tranTypeId`.
- Line json keys (match `_build_sales_invoice_tran_h` reads): `hsn_code` (sil.hsn_code),
  `qty`, `unit_price` (sil.unit_price), `total_amount` (sil.total_amount), `gst_rate`,
  `cgst_amount`, `sgst_amount`, `igst_amount`, `part_code` (sp.part_code).
- WHERE: `si.division_id = (TABLE "p_division_id") AND si.is_posted = false` (include
  returns — do NOT filter on `is_return`).
- GROUP BY si.id + the cc.* columns; `ORDER BY si.invoice_date ASC, si.id ASC`.

**Add `MARK_SALES_INVOICE_POSTED`** — `UPDATE sales_invoice SET is_posted = true WHERE id = %(id)s`
(mirror `MARK_PURCHASE_INVOICE_POSTED`, sql_store.py:4514).

**`GET_UNPOSTED_COUNTS_BY_DIVISION`** (sql_store.py:4583) — no change. Its `sales_invoices`
subquery already counts all unposted sales (returns included), which now matches what posts.

### 2. `app/graphql/resolvers/mutation_helper.py`

**Add `_build_sales_invoice_tran_h(...)`** — clone of `_build_job_invoice_tran_h`
(mutation_helper.py:2170). Signature mirrors it:
`(si_row, si_debit_acc_id, si_credit_acc_id, si_product_id, si_default_hsn, si_default_gst,
branch_id, contacts_id=None)`. Body identical to the job-invoice builder except:
- Read line amounts with the **purchase-style keys**: `line["unit_price"]` (not `price`) and
  `line["total_amount"]` (not `amount`); `priceGst = total_amount / qty`.
- Header amount: `si_row["total_amount"]` (not `amount`).
- `tranTypeId = 9 if si_row.get("is_return") else 4`; `ExtGstTranD.isInput = False`
  (output GST), customer gstin from `si_row["customer_gstin"]`. (Leg structure stays the
  same as a normal sale for both types — only the `tranTypeId` differs.)
- `userRefNo = si_row["invoice_no"]`; remarks from customer_name / mobile / customer_address /
  customer_pin / GSTIN (no JOB: prefix — sales invoices have no job).

**Edit `resolve_accounts_posting_helper`** (mutation_helper.py:2311), following the
purchase-invoice block pattern in four spots:
1. Work-list build (around 2362-2400): read `si_settings = account_setting.get("salesInvoice", {})`,
   fetch `si_rows` via `SqlStore.GET_UNPOSTED_SALES_INVOICES` (by `division_code`); include
   `si_rows` in the `if not receipts and not pi_rows and not ji_rows ...: continue` guard; add
   `si_debit_acc_id / si_credit_acc_id / si_product_id / si_default_hsn / si_default_gst /
   si_contacts_id / si_rows` to the `work.append({...})` dict; `total += len(si_rows)`.
2. Counters: add `posted_sales_invoices = 0`; include it in the `publish_progress` posted sum.
3. New per-record loop after the job-invoice block (after 2547): mirror the PI block —
   `si_settings_ok` check (`si_debit_acc_id and si_credit_acc_id and si_product_id`), build via
   `_build_sales_invoice_tran_h(..., contacts_id=w["si_contacts_id"])`, post via
   `_post_tran_h_to_trace_plus`, mark via `SqlStore.MARK_SALES_INVOICE_POSTED`, increment
   counter, `failed.append({"type": "salesInvoice", ...})` on error, `publish_progress`.
4. Result: add `posted_sales_invoices` to the summary `message` and a `postedSalesInvoices`
   key in the returned dict. (The GraphQL return is `Generic`/JSON, so no schema change.)

## Client changes

### 3. `src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`

- `TYPE_COLUMNS` (line 33): change `sales_invoices` from `posted: false` → `posted: true`.
- `postableTotal` (line 80): add `+ num(d.sales_invoices)`.
- Note text (line 229) and the comments at lines 29 & 79: include "Sales Invoices" in the list
  of posted types.

No GraphQL-map, sql-map, or division-config changes are needed — the client only sends
`branchId`; the server discovers settings and records. The admin **Post/Unpost** grids are a
separate manual `is_posted` toggle and are out of scope.

## Verification

1. **Settings present:** In a division's account settings (Configurations > Division > Edit),
   ensure the Sales Invoice block has debit/credit account, product, HSN, GST set. Divisions
   missing these will have their sales records reported as
   `"Skipped: salesInvoice account settings missing"` (mirrors PI behavior).
2. **Counts include returns:** Open Jobs > Accounts Posting. The Sales Invoices column should
   now be highlighted/postable and its count should equal all unposted sales (normal + returns).
3. **Post:** Click "Post data to Trace Plus". Watch the progress bar advance through sales
   records; on success the toast appears and the Sales Invoices count drops to 0.
4. **Trace Plus side:** Confirm a normal sale created a voucher with `tranTypeId 4` and a
   return created one with `tranTypeId 9`, both output GST, with correct line items, GST split,
   `userRefNo = invoice_no`, and customer remarks. Confirm the return nets sales in the right
   direction (if not, swap the debit/credit legs for `is_return` rows in the builder).
5. **Idempotency / partial failure:** Re-running posts nothing new (rows now `is_posted`); a
   single bad record is collected in `failed[]` and the rest still post.
6. Lint/type-check the client (`tsc`/eslint) and run the server's checks (pyright) to confirm
   no type errors.
