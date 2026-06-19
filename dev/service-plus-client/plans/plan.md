# Plan: Post Purchase Invoice to Trace-Plus (Minimum / Testing)

Extends the existing `accountsPosting` flow so that one unposted purchase invoice
is also included in the same request that already posts one money receipt.

---

## Overview of current flow

```
service-plus client
  → accountsPosting mutation (service-plus-server)
      → builds single TranH payload  { tableName, dbParams, xData: {…receipt…}, buCode }
      → calls trace-server accountsPosting mutation
          → accounts_posting_helper: fetches db_params from ClientM, injects into data
          → validate_debit_credit_and_update_helper:
              → validate_each_tran_entry(valueDict)   ← expects data["xData"]["xDetails"]
              → exec_sql_object(…, sqlObject=sqlObj)
                  → handle_auto_ref_no(sqlObject, acur)  ← expects xData to be a dict
                  → process_details(sqlObject, acur)     ← already handles xData as list ✓
```

**Change summary**: `xData` becomes a list `[receiptTranH, purchaseInvoiceTranH]`.
Two functions in trace-server assume `xData` is a dict and must be updated.

---

## Step 1 — `division.ts`: fix types to numbers

**File:** `src/features/client/types/division.ts`

The dialog code already uses `DEFAULT_INVOICE` with numeric zeros. Align the types.

```ts
export type InvoiceAccountSettingType = {
    debitAccountId:    number;
    creditAccountId:   number;
    productId:         number;
    defaultProductHsn: number;
    defaultGstRate:    number;
};

export type AccountSettingType = {
    clientCode: string;
    buCode:     string;
    branchId:   number;
    receipt: {
        debitAccountId:  number;
        creditAccountId: number;
    };
    purchaseInvoice?: InvoiceAccountSettingType;
};
```

---

## Step 2 — `division-schema.ts`: align Zod schema to numbers

**File:** `src/features/client/components/configurations/division/division-schema.ts`

```ts
const invoiceSubSchema = z.object({
    debitAccountId:    z.coerce.number().int(),
    creditAccountId:   z.coerce.number().int(),
    productId:         z.coerce.number().int(),
    defaultProductHsn: z.coerce.number(),
    defaultGstRate:    z.coerce.number(),
});

// inside accountSettingSchema — receipt sub-object:
receipt: z.object({
    debitAccountId:  z.coerce.number().int(),
    creditAccountId: z.coerce.number().int(),
}),
```

---

## Step 3 — `sql_store.py`: add new SQL constant

**File:** `service-plus-server/app/db/sql_store.py`

Add after `GET_ONE_UNPOSTED_MONEY_RECEIPT` (~line 4120):

```python
GET_ONE_UNPOSTED_PURCHASE_INVOICE = """
    WITH
        "p_division_code" AS (VALUES(%(division_code)s::text)),
        "p_branch_id" AS (
            SELECT branch_id FROM division
            WHERE LOWER(code) = LOWER((TABLE "p_division_code"))
            LIMIT 1
        )
    SELECT
        pi.id,
        pi.invoice_no,
        pi.invoice_date,
        pi.aggregate_amount,
        pi.cgst_amount,
        pi.sgst_amount,
        pi.igst_amount,
        pi.total_amount,
        pi.remarks,
        s.gstin  AS supplier_gstin,
        json_agg(
            json_build_object(
                'hsn_code',         pil.hsn_code,
                'qty',              pil.qty,
                'unit_price',       pil.unit_price,
                'aggregate_amount', pil.aggregate_amount,
                'gst_rate',         pil.gst_rate,
                'cgst_amount',      pil.cgst_amount,
                'sgst_amount',      pil.sgst_amount,
                'igst_amount',      pil.igst_amount,
                'total_amount',     pil.total_amount
            ) ORDER BY pil.id
        ) AS lines
    FROM purchase_invoice pi
    JOIN supplier              s   ON s.id  = pi.supplier_id
    JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
    WHERE pi.branch_id = (TABLE "p_branch_id")
      AND pi.is_posted = false
    GROUP BY pi.id, s.gstin
    ORDER BY pi.invoice_date ASC, pi.id ASC
    LIMIT 1
"""
```

**Notes:**
- Resolves division code → service-plus `branch_id` via a CTE.
- `json_agg` collects only the line columns needed for trace-plus payload.
- `ORDER BY … ASC` posts oldest first (FIFO).

---

## Step 4 — `mutation_helper.py`: extend `resolve_accounts_posting_helper`

**File:** `service-plus-server/app/graphql/resolvers/mutation_helper.py`

### 4a — Extract purchaseInvoice settings (after existing receipt extraction, ~line 1967)

```python
pi_settings      = account_setting.get("purchaseInvoice", {})
pi_debit_acc_id  = pi_settings.get("debitAccountId")
pi_credit_acc_id = pi_settings.get("creditAccountId")
pi_product_id    = pi_settings.get("productId")
pi_default_hsn   = pi_settings.get("defaultProductHsn")
pi_default_gst   = pi_settings.get("defaultGstRate")
```

### 4b — Fetch one unposted purchase invoice (~line 1983, after money receipt fetch)

```python
pi_rows = await exec_sql(
    db_name=db_name, schema=schema,
    sql=SqlStore.GET_ONE_UNPOSTED_PURCHASE_INVOICE,
    sql_args={"division_code": division_code},
)
```

### 4c — Build purchase invoice TranH (insert between Step 4b and existing token fetch)

```python
pi_x_data = None
if pi_rows and pi_debit_acc_id and pi_credit_acc_id and pi_product_id:
    pi_row   = _serialize_row(pi_rows[0])
    pi_lines = pi_row.get("lines") or []

    # SalePurchaseDetails — one entry per purchase_invoice_line
    sale_purchase_lines = []
    for line in pi_lines:
        spd: dict = {
            "productId": int(pi_product_id),
            "qty":       float(line["qty"]),
            "price":     float(line["unit_price"]),
            "priceGst":  (float(line["total_amount"]) / float(line["qty"])
                          if line.get("qty") else 0),
            "amount":    float(line["total_amount"]),
            "hsn":       (line.get("hsn_code")
                          or (str(pi_default_hsn) if pi_default_hsn else "")),
            "gstRate":   (float(line["gst_rate"]) if line.get("gst_rate")
                          else (float(pi_default_gst) if pi_default_gst else 0)),
        }
        for out_key, db_key in [("cgst", "cgst_amount"), ("sgst", "sgst_amount"), ("igst", "igst_amount")]:
            if line.get(db_key) is not None:
                spd[out_key] = float(line[db_key])
        sale_purchase_lines.append(spd)

    # ExtGstTranD — header-level GST totals
    ext_gst: dict = {"isInput": True}
    if pi_row.get("supplier_gstin"):
        ext_gst["gstin"] = pi_row["supplier_gstin"]
    for out_key, db_key in [("cgst", "cgst_amount"), ("sgst", "sgst_amount"), ("igst", "igst_amount")]:
        if pi_row.get(db_key) is not None:
            ext_gst[out_key] = float(pi_row[db_key])

    # Debit TranD entry (holds GST + line details)
    debit_entry: dict = {
        "accId": int(pi_debit_acc_id),
        "dc":    "D",
        "amount": float(pi_row["total_amount"]),
        "xDetails": [
            {"tableName": "ExtGstTranD",        "fkeyName": "tranDetailsId", "xData": ext_gst},
            {"tableName": "SalePurchaseDetails", "fkeyName": "tranDetailsId", "xData": sale_purchase_lines},
        ],
    }

    # Credit TranD entry (no sub-details)
    credit_entry: dict = {
        "accId": int(pi_credit_acc_id),
        "dc":    "C",
        "amount": float(pi_row["total_amount"]),
    }

    pi_fin_year = int(str(pi_row.get("invoice_date", str(date.today())))[:4])

    pi_x_data = {
        "tranDate":   pi_row["invoice_date"],
        "tranTypeId": 5,
        "finYearId":  pi_fin_year,
        "branchId":   branch_id,
        "posId":      1,
        "xDetails": [{"tableName": "TranD", "fkeyName": "tranHeaderId",
                      "xData": [debit_entry, credit_entry]}],
    }
    if pi_row.get("invoice_no"):
        pi_x_data["userRefNo"] = pi_row["invoice_no"]
    if pi_row.get("remarks"):
        pi_x_data["remarks"] = pi_row["remarks"]
```

### 4d — Change xData to list in TranH payload (~line 1999)

```python
# Build list: money receipt always first, purchase invoice appended if available
x_data_list = [x_data]
if pi_x_data:
    x_data_list.append(pi_x_data)

tran_h_payload = {
    "tableName": "TranH",
    "dbParams":  {"conn": ""},
    "xData":     x_data_list,   # ← was: x_data (single dict)
    "buCode":    bu_code,
}
```

---

## Step 5 — `graphql_helper.py` (trace-server): fix `validate_each_tran_entry`

**File:** `trace-plus-server/app/graphql/graphql_helper.py`  
**Location:** `validate_each_tran_entry` function (~line 534)

**Before:**
```python
def validate_each_tran_entry(data: dict) -> bool:
    try:
        x_details = data["xData"]["xDetails"]
        for detail_group in x_details:
            ...
```

**After:**
```python
def validate_each_tran_entry(data: dict) -> bool:
    try:
        x_data = data["xData"]
        tran_entries = x_data if isinstance(x_data, list) else [x_data]
        for tran_entry in tran_entries:
            x_details = tran_entry["xDetails"]
            for detail_group in x_details:
                entries = detail_group.get("xData", [])
                debit_total = sum(Decimal(str(x.get("amount", 0)))
                                  for x in entries if x.get("dc") == "D")
                credit_total = sum(Decimal(str(x.get("amount", 0)))
                                   for x in entries if x.get("dc") == "C")
                if debit_total != credit_total:
                    print(f"Mismatch found: Debit={debit_total}, Credit={credit_total}")
                    return False
        return True
    except (KeyError, IndexError, TypeError) as e:
        print(f"Validation error: {e}")
        return False
```

---

## Step 6 — `psycopg_async_helper.py` (trace-server): fix `handle_auto_ref_no`

**File:** `trace-plus-server/app/graphql/db/psycopg_async_helper.py`  
**Location:** `handle_auto_ref_no` function (~line 165)

Each TranH entry in the list needs its own `autoRefNo` (different `tranTypeId` → different counter).

**Before:**
```python
async def handle_auto_ref_no(sqlObject, acur):
    xData = sqlObject.get("xData", {})
    if not xData:
        return
    if (
        ("id" not in xData or not xData["id"]) and
        ("finYearId" in xData) and ...
    ):
        ...
        xData["autoRefNo"] = autoRefNo
        ...
```

**After** — wrap body in a loop:
```python
async def handle_auto_ref_no(sqlObject, acur):
    x_data_raw = sqlObject.get("xData", {})
    if not x_data_raw:
        return
    items = x_data_raw if isinstance(x_data_raw, list) else [x_data_raw]
    for xData in items:
        if (
            ("id" not in xData or not xData["id"]) and
            ("finYearId"  in xData) and
            ("branchId"   in xData) and
            ("tranTypeId" in xData)
        ):
            finYearId  = xData["finYearId"]
            branchId   = xData["branchId"]
            tranTypeId = xData["tranTypeId"]
            await acur.execute(SqlAccounts.get_branch_code_tran_code,
                               {"branchId": branchId, "tranTypeId": tranTypeId})
            codes      = await acur.fetchone()
            branchCode = codes.get("branchCode", "")
            tranCode   = codes.get("tranCode", "")
            await acur.execute(SqlAccounts.get_last_no,
                               {"finYearId": finYearId, "branchId": branchId, "tranTypeId": tranTypeId})
            no     = await acur.fetchone()
            lastNo = no.get("lastNo", 0) or 1
            xData["autoRefNo"] = f'{branchCode}/{tranCode}/{lastNo}/{finYearId}'
            await acur.execute(SqlAccounts.increment_last_no,
                               {"finYearId": finYearId, "branchId": branchId, "tranTypeId": tranTypeId})
```

---

## Out of scope (deferred)

- Marking `purchase_invoice.is_posted = true` after successful posting (same gap exists today for money receipts).
- Handling `is_return = true` purchase invoices (D/C flip).
- Sales invoice / job invoice posting.
- Posting more than one invoice per button click.

---

## File change summary

| # | File | Change |
|---|------|--------|
| 1 | `src/features/client/types/division.ts` | `InvoiceAccountSettingType` + `receipt` fields → `number` |
| 2 | `src/features/client/components/configurations/division/division-schema.ts` | `invoiceSubSchema` + `receipt` → `z.coerce.number()` |
| 3 | `service-plus-server/app/db/sql_store.py` | Add `GET_ONE_UNPOSTED_PURCHASE_INVOICE` |
| 4 | `service-plus-server/app/graphql/resolvers/mutation_helper.py` | Extend `resolve_accounts_posting_helper` |
| 5 | `trace-plus-server/app/graphql/graphql_helper.py` | Fix `validate_each_tran_entry` for list xData |
| 6 | `trace-plus-server/app/graphql/db/psycopg_async_helper.py` | Fix `handle_auto_ref_no` for list xData |
