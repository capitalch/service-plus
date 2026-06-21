# AccountsPosting — send ALL unposted money receipts & purchase invoices, then mark `is_posted = true`

## Context

When a division has Trace+ accounts integration enabled, service-plus pushes its money receipts
(`job_payment`) and purchase invoices (`purchase_invoice`) into the trace-plus accounting system as
vouchers (TranH/TranD). The push is triggered from the client **Accounts Posting** screen, which
calls the service-plus GraphQL mutation `accountsPosting(divisionCode)`. service-plus then
authenticates to trace-server (`/api/login`) and POSTs to trace-server's own `accountsPosting`
mutation at `/graphql/`.

The current service-plus implementation (`resolve_accounts_posting_helper`) has two gaps:

1. It posts only **one** unposted money receipt and **one** unposted purchase invoice per call (both
   SQL queries end with `LIMIT 1`), instead of all `is_posted = false` records.
2. After a successful post to trace-plus it **never sets `is_posted = true`**, so the same records
   would be re-posted on every run (trace-server has no userRefNo dedup → duplicate vouchers).

Desired outcome: a single `accountsPosting` call sends **every** currently-unposted money receipt and
purchase invoice for the division to trace-plus, marking each one `is_posted = true` as soon as its
own post succeeds. Confirmed approach: **per-record** posting (one voucher per trace-plus call),
**partial-success**, **continue-on-error** with a summary.

The work is split below into the two apps. **Only service-plus changes; trace-plus is verify-only.**

---

# PART A — Trace-plus (`/home/sushant/projects/trace-plus/dev/trace-server`)

**No code changes required.** Confirmed by reading trace-server's `accountsPosting`:

- `accounts_posting_helper` → `validate_debit_credit_and_update_helper` → `exec_sql_object` →
  `process_details` already treat `data["xData"]` as a list and iterate it
  (`graphql_helper.py`, `db/psycopg_async_helper.py`). Each `accountsPosting` call commits in a
  single transaction (`exec_sql_object`, one `aconn.commit()`), so each per-record call is atomic.
- Debit=credit validation (`validate_each_tran_entry`) and auto ref-no generation
  (`handle_auto_ref_no`) already loop over every TranH in the list.
- The one known list-incompatible path, `handle_auto_subledger`, early-returns unless
  `autoSubledgerAccId` is present at the payload top level — service-plus never sets it, so it is
  never reached.

### Step A1 — Verify-only (no edits)

- Confirm service-plus payloads do **not** include `autoSubledgerAccId` (they don't today; keep it
  that way).
- Note for the team: trace-server has **no idempotency** on `userRefNo`; re-posting the same voucher
  creates a duplicate. This is precisely why service-plus must mark `is_posted = true` immediately
  after each successful post (Part B). No trace-server change is made for dedup in this task.

---

# PART B — Service-plus (`/home/sushant/projects/service-plus/dev/service-plus-server`)

The resolver entry point `app/graphql/resolvers/mutation.py` (`resolve_accounts_posting`,
lines 466–479) needs **no change** — it already delegates to the helper and wraps errors.

### Step B1 — SQL (`app/db/sql_store.py`)

**Delete** the now-unused `GET_ONE_UNPOSTED_MONEY_RECEIPT` and `GET_ONE_UNPOSTED_PURCHASE_INVOICE`
(lines ~4343–4422) and replace with all-unposted versions. Reuse the existing SELECT bodies verbatim
with two changes: **remove `LIMIT 1`** and order **oldest-first** (`ORDER BY ... ASC`) so vouchers
post chronologically. Grep `GET_ONE_UNPOSTED` across the repo first to confirm no other references.

- `GET_UNPOSTED_MONEY_RECEIPTS` — old money-receipt body, no `LIMIT 1`,
  `ORDER BY jp.payment_date ASC, jp.id ASC`.
- `GET_UNPOSTED_PURCHASE_INVOICES` — old purchase-invoice body, no `LIMIT 1`,
  `ORDER BY pi.invoice_date ASC, pi.id ASC`.
- `MARK_MONEY_RECEIPT_POSTED = "UPDATE job_payment SET is_posted = true WHERE id = %(id)s"`
- `MARK_PURCHASE_INVOICE_POSTED = "UPDATE purchase_invoice SET is_posted = true WHERE id = %(id)s"`

### Step B2 — Extract builders/poster (`app/graphql/resolvers/mutation_helper.py`)

Keep the existing voucher-building logic byte-for-byte; only relocate it.

- `_build_money_receipt_tran_h(row, debit_account_id, credit_account_id, branch_id) -> dict`
  — existing block lines 2000–2036 (TranD debit/credit, `tranTypeId: 3`, `finYearId` from
  `payment_date[:4]`, `userRefNo`, customer remarks).
- `_build_purchase_invoice_tran_h(pi_row, pi_debit_acc_id, pi_credit_acc_id, pi_product_id,
  pi_default_hsn, pi_default_gst, branch_id) -> dict`
  — existing block lines 2041–2122 (`SalePurchaseDetails`, `ExtGstTranD`, `tranTypeId: 5`, vendor
  remarks); operates on an already-serialized `pi_row`.
- `async def _post_tran_h_to_trace_plus(http_client, token, client_code, bu_code, tran_h) -> dict`
  — factor out lines 2129–2167: wrap one TranH in the existing payload shape
  (`{"tableName": "TranH", "dbParams": {"conn": ""}, "xData": [tran_h], "buCode": bu_code}`), POST to
  `{trace_plus_url}/graphql/`, and raise `RuntimeError` on `result["errors"]` or
  `posting_result["error"]` (same checks as today). `xData` stays a **list** of length 1.

### Step B3 — Rewrite `resolve_accounts_posting_helper`

1. Decode `divisionCode`, load `account_setting`, validate receipt accounts — unchanged
   (lines 1942–1981).
2. Fetch **all** unposted receipts via `GET_UNPOSTED_MONEY_RECEIPTS` and **all** unposted PIs via
   `GET_UNPOSTED_PURCHASE_INVOICES`.
3. If both lists empty → return `{"message": "No unposted records found."}`.
4. Fetch the trace-plus token **once** (`_get_trace_plus_token()`); open **one**
   `httpx.AsyncClient` for the whole loop.
5. For each receipt: `_serialize_row` → `_build_money_receipt_tran_h` →
   `_post_tran_h_to_trace_plus`. On success, `await exec_sql(db_name, schema,
   SqlStore.MARK_MONEY_RECEIPT_POSTED, {"id": row["id"]})` and increment a counter. On exception,
   append `{"type": "moneyReceipt", "id": ..., "ref": receipt_no, "error": str(e)}` and **continue**.
6. For each PI: attempt only if `pi_debit_acc_id and pi_credit_acc_id and pi_product_id` are present
   (same guard as today, line 2040); otherwise record "skipped: purchaseInvoice settings missing".
   On success mark via `MARK_PURCHASE_INVOICE_POSTED`; on failure append to errors and continue.
7. Return a summary, e.g.
   `{"postedMoneyReceipts": n1, "postedPurchaseInvoices": n2, "failed": [...], "message": "..."}`.

Marking uses `exec_sql` (transactional, commits on context exit — the write path used elsewhere);
`exec_sql_dml` is autocommit/DDL-only and not needed here.

**Why mark per-record immediately after its post:** trace-server commits each call atomically and has
no dedup, so flagging the record right after its post means a crash mid-loop can't cause that voucher
to be re-posted. Residual risk: post succeeds but its single UPDATE fails → that one record re-posts
next run. Acceptable; trace-server has no idempotency key today (Part A note).

---

## Verification (end-to-end)

1. **Setup:** start `trace-server` and `service-plus-server` locally (`trace_plus_url` + super-admin
   creds in service-plus `.env`). Pick a division whose `account_setting` has `clientCode`, `buCode`,
   `branchId`, `receipt.{debit,credit}AccountId` (and `purchaseInvoice.*` to exercise PIs).
2. **Seed:** several `job_payment` and `purchase_invoice` rows for that division with
   `is_posted = false` (visible in the client **Accounts Posting** screen, "unposted" filter).
3. **Run:** trigger from the client Accounts Posting button, or call directly:
   ```graphql
   mutation { accountsPosting(db_name:"<db>", schema:"public",
     value:"<urlencoded {\"divisionCode\":\"<code>\"}>") }
   ```
4. **Assert:**
   - trace-server received one voucher per record (check trace `TranH`/`TranD` for the new
     `userRefNo`s = receipt_no / invoice_no, and a generated `autoRefNo` each).
   - `SELECT count(*) FROM job_payment WHERE is_posted = false` and same for `purchase_invoice`
     dropped to 0 for that division/branch — or only failed records remain.
   - Re-running now returns "No unposted records found." (no duplicate vouchers in trace).
   - The summary shows correct `postedMoneyReceipts` / `postedPurchaseInvoices` counts and an empty
     (or expected) `failed` list.
5. **Partial-failure check:** make one record invalid (e.g. an amount trace rejects); confirm the
   others still post and get marked, while the bad one stays `is_posted = false` and appears in
   `failed`.

## Optional client enhancement (not required)

`src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`
(`handleAccountsPosting`, lines ~104–128) shows a generic success toast; it could surface the new
summary instead. Grids already reload after posting, so unposted rows disappear automatically.
