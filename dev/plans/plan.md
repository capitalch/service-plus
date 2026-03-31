# Purchase Entry — CRUD Implementation Plan

## Approach

All operations use **existing generic mutations** — no new server mutations needed:

| Op | Mechanism | Notes |
|----|-----------|-------|
| **C** Create | `genericUpdate` (3-level nested `xDetails`) | Client calculates all amounts; client-side validations |
| **R** Read list | `genericQuery` | Paginated with filters |
| **R** Read detail | `genericQuery` | Header + lines via `json_agg` |
| **U** Update | ❌ Excluded | Financial records tied to stock movements |
| **D** Delete | `genericUpdateScript` (CTE DELETE) | Removes stock_transactions + invoice atomically |

---

## Why `genericUpdate` works for Create

`process_details` in `psycopg_driver.py` is **fully recursive**:
1. Pops `xDetails` from `xData` before building INSERT SQL
2. Executes INSERT, gets `RETURNING id` → `record_id`
3. Calls `process_details(x_details, cur, fkey_value=record_id)` recursively

This supports the required 3-level chain:

```
purchase_invoice (level 1)
  └─ purchase_invoice_line  [fkeyName: "purchase_invoice_id"]  (level 2)
       └─ stock_transaction  [fkeyName: "purchase_line_id"]     (level 3)
```

Client builds the full nested payload — all amounts pre-calculated, all validations done client-side.

---

## Existing DB (no migrations needed)

### `purchase_invoice`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| branch_id | bigint FK → branch | |
| supplier_id | bigint FK → supplier | |
| invoice_no | text | |
| invoice_date | date | |
| supplier_state_code | char(2) | |
| taxable_amount | numeric(14,2) | |
| cgst_amount / sgst_amount / igst_amount | numeric(14,2) | |
| total_tax | numeric(14,2) | |
| total_amount | numeric(14,2) | |
| remarks | text | |
| UNIQUE | (supplier_id, invoice_no) | |

### `purchase_invoice_line`
| Column | Type |
|--------|------|
| id | bigint identity PK |
| purchase_invoice_id | bigint FK → purchase_invoice CASCADE |
| part_id | bigint FK → spare_part_master |
| hsn_code | text |
| quantity | numeric(12,2) CHECK > 0 |
| unit_price | numeric(12,2) CHECK >= 0 |
| taxable_amount, cgst_rate/amt, sgst_rate/amt, igst_rate/amt, total_amount | numeric |

`stock_transaction.purchase_line_id` → `purchase_invoice_line(id)` **RESTRICT** — the CTE delete handles this ordering.

---

## 1. Server

### 1.1 New SQL in `app/db/sql_store.py`

```
# ── Purchase Entry ────────────────────────────────────────────────────────────

GET_STOCK_TRANSACTION_TYPES      (no args) → id, code, name, dr_cr
GET_PURCHASE_INVOICES_COUNT      (branch_id, from_date, to_date, search)
GET_PURCHASE_INVOICES_PAGED      (branch_id, from_date, to_date, search, limit, offset)
GET_PURCHASE_INVOICE_DETAIL      (id)
CHECK_SUPPLIER_INVOICE_EXISTS    (supplier_id, invoice_no) → { exists }
DELETE_PURCHASE_INVOICE          (id)  — CTE atomically removes stock_transactions + invoice
```

**`GET_STOCK_TRANSACTION_TYPES`**
```sql
with "dummy" as (values(1::int))
SELECT id, code, name, dr_cr FROM stock_transaction_type ORDER BY id
```

**`GET_PURCHASE_INVOICES_PAGED`** — joins `supplier`, search on `invoice_no` / `supplier.name`:
Returns: `id, invoice_date, invoice_no, supplier_id, supplier_name, taxable_amount, total_tax, total_amount, branch_id, remarks`
ORDER BY `invoice_date DESC, id DESC`

**`GET_PURCHASE_INVOICE_DETAIL`** — header + lines aggregated:
```sql
SELECT pi.*, s.name AS supplier_name,
    json_agg(
        json_build_object(
            'id', pil.id, 'part_id', pil.part_id,
            'part_code', sp.part_code, 'part_name', sp.part_name,
            'hsn_code', pil.hsn_code, 'quantity', pil.quantity,
            'unit_price', pil.unit_price, 'taxable_amount', pil.taxable_amount,
            'cgst_rate', pil.cgst_rate, 'cgst_amount', pil.cgst_amount,
            'sgst_rate', pil.sgst_rate, 'sgst_amount', pil.sgst_amount,
            'igst_rate', pil.igst_rate, 'igst_amount', pil.igst_amount,
            'total_amount', pil.total_amount
        ) ORDER BY pil.id
    ) AS lines
FROM purchase_invoice pi
JOIN supplier s ON s.id = pi.supplier_id
JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
JOIN spare_part_master sp ON sp.id = pil.part_id
WHERE pi.id = (table "p_id")
GROUP BY pi.id, s.name
```

**`DELETE_PURCHASE_INVOICE`** — CTE atomically deletes stock rows first, then invoice:
```sql
with
    "p_id" as (values(%(id)s::bigint)),
    deleted_txns AS (
        DELETE FROM stock_transaction
        WHERE purchase_line_id IN (
            SELECT id FROM purchase_invoice_line
            WHERE purchase_invoice_id = (table "p_id")
        )
    )
DELETE FROM purchase_invoice WHERE id = (table "p_id")
```
Executed via `genericUpdateScript` with `{ sql_id: "DELETE_PURCHASE_INVOICE", sql_args: { id: invoiceId } }`.

---

## 2. Client

### 2.1 Types — `src/features/client/types/purchase.ts`

```typescript
export type StockTransactionTypeRow = { id: number; code: string; name: string; dr_cr: string };

export type PurchaseLineType = {
    id: number;
    purchase_invoice_id: number;
    part_id: number;  part_code: string;  part_name: string;
    hsn_code: string;
    quantity: number;  unit_price: number;  taxable_amount: number;
    cgst_rate: number;  cgst_amount: number;
    sgst_rate: number;  sgst_amount: number;
    igst_rate: number;  igst_amount: number;
    total_amount: number;
};

export type PurchaseInvoiceType = {
    id: number;  branch_id: number;
    supplier_id: number;  supplier_name: string;
    invoice_no: string;  invoice_date: string;
    supplier_state_code: string;
    taxable_amount: number;  cgst_amount: number;  sgst_amount: number;
    igst_amount: number;  total_tax: number;  total_amount: number;
    remarks: string | null;
    lines?: PurchaseLineType[];
};

// Local form state for line items in Add dialog
export type PurchaseLineFormItem = {
    _key: string;         // local uuid for React key
    part_id: number | null;
    part_code: string;  part_name: string;  uom: string;
    hsn_code: string;
    quantity: number;   unit_price: number;
    cgst_rate: number;  sgst_rate: number;  igst_rate: number;
};
```

---

### 2.2 Constants

**`src/constants/sql-map.ts`** — add under `// Inventory`:
```typescript
GET_STOCK_TRANSACTION_TYPES:     "GET_STOCK_TRANSACTION_TYPES",
GET_PURCHASE_INVOICES_COUNT:     "GET_PURCHASE_INVOICES_COUNT",
GET_PURCHASE_INVOICES_PAGED:     "GET_PURCHASE_INVOICES_PAGED",
GET_PURCHASE_INVOICE_DETAIL:     "GET_PURCHASE_INVOICE_DETAIL",
CHECK_SUPPLIER_INVOICE_EXISTS:   "CHECK_SUPPLIER_INVOICE_EXISTS",
DELETE_PURCHASE_INVOICE:         "DELETE_PURCHASE_INVOICE",
```

**`src/constants/messages.ts`** — add under `// Inventory`:
```typescript
ERROR_PURCHASE_LOAD_FAILED:         'Failed to load purchase invoices. Please try again.',
ERROR_PURCHASE_CREATE_FAILED:       'Failed to create purchase invoice. Please try again.',
ERROR_PURCHASE_DELETE_FAILED:       'Failed to delete purchase invoice. Please try again.',
ERROR_PURCHASE_SUPPLIER_REQUIRED:   'Please select a supplier.',
ERROR_PURCHASE_INVOICE_NO_REQUIRED: 'Invoice number is required.',
ERROR_PURCHASE_DATE_REQUIRED:       'Invoice date is required.',
ERROR_PURCHASE_LINES_REQUIRED:      'At least one line item is required.',
ERROR_PURCHASE_INVOICE_EXISTS:      'This invoice number already exists for the selected supplier.',
SUCCESS_PURCHASE_CREATED:           'Purchase invoice created successfully.',
SUCCESS_PURCHASE_DELETED:           'Purchase invoice deleted successfully.',
```

---

### 2.3 New Components

#### `purchase-entry-section.tsx`

State:
- `branches`, `selectedBranch`
- `vendors: VendorType[]` (loaded once for select in dialog)
- `txnTypes: StockTransactionTypeRow[]` (loaded once; needed by add dialog)
- `invoices`, `total`, `page`, `loading`
- `fromDate`, `toDate` (default: current month), `search`, `searchQ` (debounced 600ms)
- `addOpen`, `viewOpen`, `deleteId`

On mount: `Promise.all([GET_ALL_BRANCHES, GET_ALL_VENDORS, GET_STOCK_TRANSACTION_TYPES])`

Toolbar: branch select, from/to date, debounced search, Refresh, **New Invoice** button

Table columns: `#`, `Date`, `Invoice No`, `Supplier`, `Taxable`, `Tax`, `Total`, `Actions (View, Delete)`

Delete flow: confirm dialog → call `genericUpdateScript` with `DELETE_PURCHASE_INVOICE` → reload

#### `add-purchase-invoice-dialog.tsx`

**Header fields** (2-col grid):
- Branch select, Vendor select
- Invoice No (text) + duplicate check via `CHECK_SUPPLIER_INVOICE_EXISTS` (debounced 600ms)
- Invoice Date, Supplier State Code (auto-fill from vendor's state GST code), Remarks

**Line items table** (inline):

Columns: `#` | `Part` (search combobox → `GET_PARTS_PAGED`, auto-fills HSN, rates) | `HSN` | `Qty` | `Unit Price` | `CGST%` | `SGST%` | `IGST%` | `Taxable` | `Total` | `✕`

"Add Row" button appends empty line; totals footer row shows sums.

**On submit — client builds genericUpdate payload:**
```typescript
// Per line
const taxable   = qty * unitPrice;
const cgstAmt   = taxable * cgstRate / 100;
const sgstAmt   = taxable * sgstRate / 100;
const igstAmt   = taxable * igstRate / 100;
const lineTotal = taxable + cgstAmt + sgstAmt + igstAmt;

const purchaseTypeId = txnTypes.find(t => t.code === 'PURCHASE')!.id;

// Stock transaction row per line
const stockTxn = {
    branch_id: branchId,
    part_id:   line.part_id,
    qty:       line.quantity,
    unit_cost: line.unit_price,
    dr_cr:     'D',
    transaction_date:           invoiceDate,
    stock_transaction_type_id:  purchaseTypeId,
};

// Full nested payload
const payload = graphQlUtils.buildGenericUpdateValue({
    tableName: "purchase_invoice",
    xData: {
        branch_id, supplier_id, invoice_no, invoice_date,
        supplier_state_code, taxable_amount, cgst_amount,
        sgst_amount, igst_amount, total_tax, total_amount, remarks,
        xDetails: {
            tableName: "purchase_invoice_line",
            fkeyName:  "purchase_invoice_id",
            xData: lines.map(line => ({
                part_id: line.part_id, hsn_code, quantity, unit_price,
                taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                igst_rate, igst_amount, total_amount,
                xDetails: {
                    tableName: "stock_transaction",
                    fkeyName:  "purchase_line_id",
                    xData: [stockTxn],
                },
            })),
        },
    },
});

await apolloClient.mutate({
    mutation:  GRAPHQL_MAP.genericUpdate,
    variables: { db_name: dbName, schema, value: payload },
});
```

**Client-side validations** (before submit):
- Supplier selected
- Invoice No not empty
- Invoice Date not empty
- At least one line
- Each line: part selected, qty > 0, unit_price >= 0
- Duplicate check: `CHECK_SUPPLIER_INVOICE_EXISTS` → block submit if exists

#### `view-purchase-invoice-dialog.tsx`

Read-only dialog: loads `GET_PURCHASE_INVOICE_DETAIL` on open → shows header card + lines table + totals footer.

---

### 2.4 Page wiring — `client-inventory-page.tsx`

```typescript
import { PurchaseEntrySection } from "../components/purchase-entry-section";

case "Purchase Entry":
    return <PurchaseEntrySection />;
```

---

## 3. File Manifest

### Server — modified only
| File | Change |
|------|--------|
| `app/db/sql_store.py` | +6 SQL entries under `# ── Purchase Entry ──` |

### Client — new files
```
src/features/client/types/purchase.ts
src/features/client/components/purchase-entry-section.tsx
src/features/client/components/add-purchase-invoice-dialog.tsx
src/features/client/components/view-purchase-invoice-dialog.tsx
```

### Client — modified
| File | Change |
|------|--------|
| `src/constants/sql-map.ts` | +6 keys |
| `src/constants/messages.ts` | +10 messages |
| `src/features/client/pages/client-inventory-page.tsx` | +1 case + import |

---

## 4. Verification

1. **Create**: New Invoice → fill fields → submit → row appears in list; `stock_transaction` rows exist with `dr_cr='D'`, `purchase_line_id` set, and exactly one FK set (satisfies CHECK constraint)
2. **Read list**: Filters (branch, date, search) and pagination work
3. **Read detail**: View dialog shows all header fields + line breakdown
4. **Delete**: Confirm → invoice gone from list; corresponding `stock_transaction` rows also deleted
5. **Duplicate check**: Same invoice_no + supplier → inline error before submit is enabled
