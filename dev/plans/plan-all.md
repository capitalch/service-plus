# Inventory Features Implementation Plan

## 1. System Overview

**Stack:** FastAPI + Ariadne GraphQL (Python) · PostgreSQL (psycopg3) · React 19 + TypeScript + Apollo Client

**Data transport pattern:**
- Reads → `genericQuery(db_name, schema, value)` — executes a named SQL from `SqlStore` with args
- Simple writes → `genericUpdate(db_name, schema, value)` — routes through `exec_sql_object` / `process_details`, supports nested header+lines via `xDetails`
- Complex writes (multi-table with stock_transaction auto-creation) → **dedicated GraphQL mutations** with custom Python helpers

**`genericUpdate` nested structure** (used where no stock_transaction is needed):
```json
{
  "tableName": "parent_table",
  "xData": {
    "col1": "val1",
    "xDetails": {
      "tableName": "child_table",
      "fkeyName": "parent_id",
      "xData": [ { "col_a": 1 }, { "col_a": 2 } ]
    }
  }
}
```

---

## 2. Critical Constraint: stock_transaction

The `stock_transaction` table has a CHECK that **exactly one** source FK must be set per row:

```sql
CONSTRAINT check_one_source_line_only CHECK (
    ((purchase_line_id IS NOT NULL)::int
   + (sales_line_id IS NOT NULL)::int
   + (adjustment_line_id IS NOT NULL)::int
   + (job_part_used_id IS NOT NULL)::int) = 1
)
```

Three new features (Branch Transfer, Loan/Issue, Opening Stock) need new FK columns on `stock_transaction`.
This requires a schema migration run against **every tenant schema**.

---

## 3. Schema Migrations Required

### 3.1 New tables

#### Branch Transfer
```sql
CREATE TABLE IF NOT EXISTS branch_transfer (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_transfer_date  DATE NOT NULL,
    from_branch_id BIGINT NOT NULL REFERENCES branch(id),
    to_branch_id   BIGINT NOT NULL REFERENCES branch(id),
    ref_no         TEXT,
    remarks        TEXT,
    created_by     BIGINT,
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT branch_transfer_branches_check CHECK (from_branch_id <> to_branch_id)
);

CREATE TABLE IF NOT EXISTS branch_transfer_line (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_transfer_id BIGINT NOT NULL REFERENCES branch_transfer(id) ON DELETE CASCADE,
    part_id           BIGINT NOT NULL REFERENCES spare_part_master(id),
    qty               NUMERIC(12,3) NOT NULL CHECK (qty > 0),
    unit_cost         NUMERIC(12,2),
    remarks           TEXT,
    created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### Loan / Issue & Return
```sql
CREATE TABLE IF NOT EXISTS loan_issue (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_date        DATE NOT NULL,
    issued_to_type    VARCHAR(20) NOT NULL CHECK (issued_to_type IN ('TECHNICIAN','CUSTOMER','OTHER')),
    issued_to_id      BIGINT,
    issued_to_name    TEXT NOT NULL,
    branch_id         BIGINT NOT NULL REFERENCES branch(id),
    ref_no            TEXT,
    remarks           TEXT,
    is_fully_returned BOOLEAN DEFAULT false NOT NULL,
    return_date       DATE,
    created_by        BIGINT,
    created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_issue_line (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loan_issue_id BIGINT NOT NULL REFERENCES loan_issue(id) ON DELETE CASCADE,
    part_id       BIGINT NOT NULL REFERENCES spare_part_master(id),
    qty_issued    NUMERIC(12,3) NOT NULL CHECK (qty_issued > 0),
    qty_returned  NUMERIC(12,3) DEFAULT 0 NOT NULL CHECK (qty_returned >= 0),
    unit_cost     NUMERIC(12,2),
    remarks       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### Opening Stock
```sql
CREATE TABLE IF NOT EXISTS opening_stock (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    as_of_date        DATE NOT NULL,
    branch_id         BIGINT NOT NULL REFERENCES branch(id),
    financial_year_id INT REFERENCES financial_year(id),
    ref_no            TEXT,
    remarks           TEXT,
    created_by        BIGINT,
    created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS opening_stock_line (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    opening_stock_id BIGINT NOT NULL REFERENCES opening_stock(id) ON DELETE CASCADE,
    part_id          BIGINT NOT NULL REFERENCES spare_part_master(id),
    qty              NUMERIC(12,3) NOT NULL CHECK (qty > 0),
    unit_cost        NUMERIC(12,2),
    remarks          TEXT,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### Set Part Location — assignment table
```sql
CREATE TABLE IF NOT EXISTS spare_part_location (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_id     BIGINT NOT NULL REFERENCES spare_part_master(id),
    branch_id   BIGINT NOT NULL REFERENCES branch(id),
    location_id BIGINT NOT NULL REFERENCES spare_part_location_master(id),
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT spare_part_location_part_branch_unique UNIQUE (part_id, branch_id)
);
```

### 3.2 Alter stock_transaction

```sql
-- Drop old constraint
ALTER TABLE stock_transaction
    DROP CONSTRAINT check_one_source_line_only;

-- Add new FK columns
ALTER TABLE stock_transaction
    ADD COLUMN IF NOT EXISTS branch_transfer_line_id        BIGINT REFERENCES branch_transfer_line(id),
    ADD COLUMN IF NOT EXISTS loan_line_id             BIGINT REFERENCES loan_issue_line(id),
    ADD COLUMN IF NOT EXISTS opening_stock_line_id    BIGINT REFERENCES opening_stock_line(id);

-- Re-add updated constraint (7 possible sources, exactly 1 per row)
ALTER TABLE stock_transaction
    ADD CONSTRAINT check_one_source_line_only CHECK (
        ((purchase_line_id IS NOT NULL)::int
       + (sales_line_id IS NOT NULL)::int
       + (adjustment_line_id IS NOT NULL)::int
       + (job_part_used_id IS NOT NULL)::int
       + (branch_transfer_line_id IS NOT NULL)::int
       + (loan_line_id IS NOT NULL)::int
       + (opening_stock_line_id IS NOT NULL)::int) = 1
    );
```

### 3.3 New stock_transaction_type seed rows

Add to `service_plus_bu_seed.sql` (or equivalent):

| code | name | dr_cr |
|------|------|-------|
| BRANCH_TRANSFER_OUT | Branch Transfer Out | C |
| BRANCH_TRANSFER_IN  | Branch Transfer In  | D |
| LOAN_ISSUE   | Loan / Issue       | C |
| LOAN_RETURN  | Loan Return        | D |
| OPENING      | Opening Stock      | D |

### 3.4 Migration delivery

Add `MIGRATION_INVENTORY_V1` to `SqlStore` containing all DDL above. Expose a one-time call via `genericUpdateScript` or a startup hook against each tenant schema. Must be idempotent (all `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

---

## 4. Server-Side Changes

### 4.0 Analysis: Can `genericUpdateScript` replace any new mutations?

**Short answer: No.** `genericUpdateScript` calls `exec_sql`, which runs a **single SQL statement** per invocation — it cannot atomically chain multiple INSERTs with FK dependencies.

All 7 inventory mutations (F2–F7) are disqualified for the following reasons:

| Feature | Why `genericUpdateScript` can't replace |
|---------|----------------------------------------|
| F2 Purchase Entry | 3 INSERT steps (header → line → stock_transaction), tax calculations |
| F3 Sales Entry | Same + application-level stock check + doc number generation |
| F4 Stock Adjustment | 3 INSERT steps with FK chain (header → line → stock_transaction) |
| F5 Branch Transfer | 4 INSERT steps per line (2 stock_transaction rows per line) |
| F6 Loan Issue | 3 INSERT steps + stock check |
| F6 Loan Return | UPDATE + INSERT per line + conditional UPDATE on header |
| F7 Opening Stock | 3 INSERT steps with FK chain |

**What `genericUpdateScript` IS appropriate for:**
- `MIGRATION_INVENTORY_V1` (already planned in §3.4) — idempotent DDL is a single script
- Any future maintenance/seed SQL run against tenant schemas

Note: Wrapping all logic in a PostgreSQL stored procedure and calling it via `genericUpdateScript` would technically work, but would move business logic (stock checks, doc numbering, error messages) into the DB layer, conflicting with the established pattern of Python helpers handling validation and the DB handling persistence only.

---

### 4.1 New GraphQL mutations (schema.graphql)

```graphql
createPurchaseInvoice(db_name: String!, schema: String, value: String!): Generic
createSalesInvoice(db_name: String!, schema: String, value: String!): Generic
createStockAdjustment(db_name: String!, schema: String, value: String!): Generic
createBranchTransfer(db_name: String!, schema: String, value: String!): Generic
createLoanIssue(db_name: String!, schema: String, value: String!): Generic
createLoanReturn(db_name: String!, schema: String, value: String!): Generic
createOpeningStock(db_name: String!, schema: String, value: String!): Generic
```

Read-only features (Consumption, Part Finder) and Set Part Location use existing `genericQuery` / `genericUpdate` — no new mutations needed.

### 4.2 Python helpers in mutation_helper.py

Each helper follows this pattern inside a single DB connection (atomic):

```
1. _decode_value(value, context) → payload dict
2. Validate required fields, raise ValidationException on failure
3. INSERT header row → header_id
4. For each line:
     INSERT line row (FK = header_id) → line_id
     INSERT stock_transaction (FK = line_id, type looked up by code)
5. Return {"id": header_id}
```

#### Stock balance check utility (shared)
```python
async def _get_current_stock(cur, branch_id: int, part_id: int) -> float:
    """
    SELECT COALESCE(SUM(CASE WHEN dr_cr='D' THEN qty ELSE -qty END), 0) AS bal
    FROM stock_transaction
    WHERE branch_id = %s AND part_id = %s
    """
```
Used by: Sales, Branch Transfer, Loan Issue.

#### Document number generator (for Sales invoice_no)
```python
async def _next_doc_number(cur, branch_id: int, doc_type_code: str) -> str:
    """
    SELECT prefix, next_number, padding, separator FROM document_sequence
    JOIN document_type ON document_type.id = document_sequence.document_type_id
    WHERE document_type.code = %s AND document_sequence.branch_id = %s
    FOR UPDATE
    → format: prefix + separator + zero-padded(next_number)
    → UPDATE document_sequence SET next_number = next_number + 1
    """
```

### 4.3 New SQL queries in sql_store.py

```
# Consumption
GET_PARTS_CONSUMPTION            (branch_id, from_date, to_date, search, limit, offset)
GET_PARTS_CONSUMPTION_COUNT      (branch_id, from_date, to_date, search)

# Purchase Entry
GET_PURCHASE_INVOICES_PAGED      (branch_id, from_date, to_date, search, limit, offset)
GET_PURCHASE_INVOICES_COUNT      (branch_id, from_date, to_date, search)
GET_PURCHASE_INVOICE_DETAIL      (id) → header + lines joined
CHECK_SUPPLIER_INVOICE_EXISTS    (supplier_id, invoice_no) → exists

# Sales Entry
GET_SALES_INVOICES_PAGED         (branch_id, from_date, to_date, search, limit, offset)
GET_SALES_INVOICES_COUNT         (branch_id, from_date, to_date, search)
GET_SALES_INVOICE_DETAIL         (id)
GET_STOCK_AT_BRANCH              (branch_id, part_id) → current_stock (for UI hint)

# Stock Adjustment
GET_STOCK_ADJUSTMENTS_PAGED      (branch_id, from_date, to_date, search, limit, offset)
GET_STOCK_ADJUSTMENTS_COUNT      (branch_id, from_date, to_date, search)
GET_STOCK_ADJUSTMENT_DETAIL      (id)

# Branch Transfer
GET_BRANCH_TRANSFERS_PAGED        (branch_id, from_date, to_date, limit, offset)
GET_BRANCH_TRANSFERS_COUNT        (branch_id, from_date, to_date)
GET_BRANCH_TRANSFER_DETAIL        (id)

# Loan / Issue & Return
GET_LOAN_ISSUES_PAGED            (branch_id, from_date, to_date, filter_status, limit, offset)
GET_LOAN_ISSUES_COUNT            (branch_id, from_date, to_date, filter_status)
GET_LOAN_ISSUE_DETAIL            (id)
GET_OUTSTANDING_LOAN_LINES       (branch_id) → lines where qty_returned < qty_issued

# Opening Stock
GET_OPENING_STOCKS_PAGED         (branch_id, limit, offset)
GET_OPENING_STOCKS_COUNT         (branch_id)
GET_OPENING_STOCK_DETAIL         (id)

# Part Finder
GET_PART_STOCK_ALL_BRANCHES      (part_id) → branch + current_stock + location_name
GET_PARTS_SEARCH_FOR_FINDER      (search, limit) → id, part_code, part_name, uom

# Set Part Location
GET_PART_LOCATION_ASSIGNMENTS    (branch_id, search, limit, offset)
GET_PART_LOCATION_ASSIGN_COUNT   (branch_id, search)
CHECK_PART_LOCATION_ASSIGNED     (part_id, branch_id) → exists
CHECK_PART_LOCATION_ASSIGNED_EXCL_ID (part_id, branch_id, id) → exists
```

---

## 5. Feature-by-Feature Plan

---

### F1 — Consumption (Parts Usage)

**Purpose:** Read-only report — parts consumed in jobs.
**Existing tables only.** No mutations.

**SQL key fields returned:** `job_no`, `job_date`, `part_code`, `part_name`, `uom`, `quantity`, `branch_name`

**UI: `consumption-section.tsx`**
- Toolbar: branch selector, from/to date pickers (default: current month), search input, Refresh
- Paginated table (50/page): #, Job No, Date, Part Code, Part Name, UOM, Qty Used
- No add/edit/delete

**Types:** `types/consumption.ts` → `ConsumptionRowType`

---

### F2 — Purchase Entry

**Purpose:** Create purchase invoices; receive parts into stock.
**Existing tables.** New mutation: `createPurchaseInvoice`.

**Payload (URL-encoded JSON):**
```json
{
  "branch_id": 1, "supplier_id": 2, "invoice_no": "INV-001",
  "invoice_date": "2024-01-15", "supplier_state_code": "27", "remarks": "",
  "lines": [
    { "part_id": 10, "hsn_code": "8517", "quantity": 5,
      "unit_price": 1200, "cgst_rate": 9, "sgst_rate": 9, "igst_rate": 0 }
  ]
}
```

**Server logic:**
1. Validate supplier active, lines non-empty, qty > 0, unit_price >= 0
2. Calculate per-line: `taxable = qty × unit_price`, then `cgst/sgst/igst amounts`, `total_amount`
3. Sum to header totals
4. INSERT `purchase_invoice` → `header_id`
5. Per line: INSERT `purchase_invoice_line` → `line_id` → INSERT `stock_transaction` (dr_cr='D', type=PURCHASE, `purchase_line_id=line_id`)

**UI:**
- `purchase-entry-section.tsx` — paginated list with branch/date/search filters
- `add-purchase-invoice-dialog.tsx` — full-width dialog: supplier select, invoice header fields, `LineItemsEditor` (mode=purchase), totals footer
- `view-purchase-invoice-dialog.tsx` — read-only view

**Types:** `types/purchase.ts` → `PurchaseInvoiceType`, `PurchaseLineType`

---

### F3 — Sales Entry

**Purpose:** Sell/issue parts to customers; deduct from stock.
**Existing tables.** New mutation: `createSalesInvoice`.

**Payload:**
```json
{
  "branch_id": 1, "invoice_date": "2024-01-15", "company_id": 1,
  "customer_contact_id": null, "customer_name": "Walk-in", "customer_gstin": null,
  "customer_state_code": "27", "remarks": "",
  "lines": [
    { "part_id": 10, "item_description": "Screen Replacement",
      "hsn_code": "8517", "quantity": 1, "unit_price": 2500, "gst_rate": 18 }
  ]
}
```

**Server logic:**
1. Per-line stock check: `_get_current_stock(branch, part) >= qty` — raise `ValidationException` with `{part_name, available, requested}` if insufficient
2. Generate `invoice_no` via `_next_doc_number(branch_id, 'SALES_INV')`
3. Split GST: intra-state → CGST+SGST; inter-state → IGST (compare branch state vs customer state)
4. INSERT `sales_invoice` + lines + `stock_transaction` (dr_cr='C', type=SALES)

**UI:**
- `sales-entry-section.tsx` — same layout as purchase
- `add-sales-invoice-dialog.tsx` — customer selector (search or freeform toggle), `LineItemsEditor` (mode=sales) with available-stock hint per line, GST auto-split
- `view-sales-invoice-dialog.tsx`

**Types:** `types/sales.ts`

---

### F4 — Stock Adjustment

**Purpose:** Manual stock corrections (damage, loss, found stock).
**Existing tables.** New mutation: `createStockAdjustment`.

**Payload:**
```json
{
  "branch_id": 1, "adjustment_date": "2024-01-15",
  "adjustment_reason": "Damage", "ref_no": "ADJ-001", "remarks": "",
  "lines": [
    { "part_id": 10, "dr_cr": "C", "qty": 2, "unit_cost": 800, "remarks": "cracked" }
  ]
}
```

**Server logic:**
1. Validate dr_cr ∈ {'D','C'}, qty > 0
2. INSERT `stock_adjustment` + lines + `stock_transaction` (dr_cr from line, type=ADJUSTMENT)

**UI:**
- `stock-adjustment-section.tsx`
- `add-stock-adjustment-dialog.tsx` — adjustment_reason dropdown (Damage/Loss/Found/Reconciliation/Other), `LineItemsEditor` (mode=adjustment, D/C toggle per line)
- `view-stock-adjustment-dialog.tsx`

**Types:** `types/stock-adjustment.ts`

---

### F5 — Branch Transfer

**Purpose:** Move parts between branches.
**New tables required.** New mutation: `createBranchTransfer`.

**Payload:**
```json
{
  "from_branch_id": 1, "to_branch_id": 2,
  "branch_transfer_date": "2024-01-15", "ref_no": "TRF-001", "remarks": "",
  "lines": [{ "part_id": 10, "qty": 5, "unit_cost": 800 }]
}
```

**Server logic:**
1. Validate from ≠ to, per-line stock check at from_branch
2. INSERT `branch_transfer` + lines
3. Per line: INSERT two `stock_transaction` rows:
   - (dr_cr='C', branch_id=from_branch, `branch_transfer_line_id=line_id`, type=BRANCH_TRANSFER_OUT)
   - (dr_cr='D', branch_id=to_branch,   `branch_transfer_line_id=line_id`, type=BRANCH_TRANSFER_IN)
   Both rows satisfy the CHECK (each has exactly one FK set).

**UI:**
- `branch-transfer-section.tsx` — from/to branch filters in toolbar
- `add-branch-transfer-dialog.tsx` — from_branch + to_branch selects, `LineItemsEditor` (mode=branch-transfer) with from-branch stock hints
- `view-branch-transfer-dialog.tsx`

**Types:** `types/branch-transfer.ts`

---

### F6 — Loan / Issue & Return

**Purpose:** Temporarily issue parts; track and record returns.
**New tables required.** Two mutations: `createLoanIssue`, `createLoanReturn`.

**createLoanIssue payload:**
```json
{
  "branch_id": 1, "issue_date": "2024-01-15",
  "issued_to_type": "TECHNICIAN", "issued_to_id": 5, "issued_to_name": "John Tech",
  "ref_no": "", "remarks": "",
  "lines": [{ "part_id": 10, "qty_issued": 2, "unit_cost": 800 }]
}
```

**createLoanReturn payload:**
```json
{
  "loan_issue_id": 42, "return_date": "2024-02-01", "remarks": "",
  "lines": [{ "loan_issue_line_id": 101, "qty_returned": 2 }]
}
```

**Server logic (issue):**
- Stock check + INSERT `loan_issue` + lines + `stock_transaction` (dr_cr='C', `loan_line_id`, type=LOAN_ISSUE)

**Server logic (return):**
- Validate `qty_returned <= qty_issued - qty_already_returned` per line
- UPDATE `loan_issue_line.qty_returned += qty_returned_now`
- INSERT `stock_transaction` (dr_cr='D', `loan_line_id`, type=LOAN_RETURN)
- If all lines fully returned: UPDATE `loan_issue SET is_fully_returned=true, return_date=...`

**UI:**
- `loan-issue-section.tsx` — two tabs: "Issues" | "Returns"
  - Issues tab: paginated list with status badge (Outstanding / Partially Returned / Fully Returned)
  - Returns tab: list of outstanding loans, click to record return
- `add-loan-issue-dialog.tsx` — issued_to_type radio, conditional technician/customer select or freetext, `LineItemsEditor` (mode=loan)
- `add-loan-return-dialog.tsx` — select outstanding loan, per-line return qty inputs

**Types:** `types/loan-issue.ts`

---

### F7 — Opening Stock

**Purpose:** Initialize stock balances (new branch go-live, FY start).
**New tables required.** New mutation: `createOpeningStock`.

**Payload:**
```json
{
  "branch_id": 1, "as_of_date": "2024-04-01",
  "financial_year_id": 1, "ref_no": "", "remarks": "",
  "lines": [{ "part_id": 10, "qty": 50, "unit_cost": 800 }]
}
```

**Server logic:**
- No stock check needed (initialization)
- INSERT `opening_stock` + lines + `stock_transaction` (dr_cr='D', `opening_stock_line_id`, type=OPENING)

**UI:**
- `opening-stock-section.tsx` — list table with warning banner ("Adds to existing balances. Use only for initial setup.")
- `add-opening-stock-dialog.tsx` — branch, date, financial year select (optional), `LineItemsEditor` (mode=opening)
- `view-opening-stock-dialog.tsx`

**Types:** `types/opening-stock.ts`

---

### F8 — Part Finder

**Purpose:** Look up which branches carry a specific part and their stock levels.
**No new tables (uses `spare_part_location` from §3.1).** No mutations — read only.

**SQL: `GET_PART_STOCK_ALL_BRANCHES`**
```sql
SELECT b.id AS branch_id, b.name AS branch_name,
       COALESCE(SUM(CASE WHEN st.dr_cr='D' THEN st.qty ELSE -st.qty END), 0) AS current_stock,
       splm.location AS location_name
FROM branch b
LEFT JOIN stock_transaction st ON st.branch_id = b.id AND st.part_id = %(part_id)s
LEFT JOIN spare_part_location spl ON spl.part_id = %(part_id)s AND spl.branch_id = b.id
LEFT JOIN spare_part_location_master splm ON splm.id = spl.location_id
WHERE b.is_active = true
GROUP BY b.id, b.name, splm.location
ORDER BY current_stock DESC, b.name
```

**UI: `part-finder-section.tsx`**
- Search box with debounced part picker (combobox using `GET_PARTS_SEARCH_FOR_FINDER`)
- On part select: load and show table — Branch, Location, Current Stock, UOM
- Aggregate row at bottom showing total stock across all branches
- "Clear" and "Refresh" buttons

**Types:** `types/part-finder.ts`

---

### F9 — Set Part Location

**Purpose:** Assign a storage location (from `spare_part_location_master`) to a part in a branch.
One assignment per part-branch pair (enforced by UNIQUE constraint).
**New table: `spare_part_location`.** Uses `genericQuery` + `genericUpdate`.

**SQL:**
- `GET_PART_LOCATION_ASSIGNMENTS` (branch_id, search, limit, offset) — join with part + location master
- `GET_PART_LOCATION_ASSIGN_COUNT` (branch_id, search)
- `CHECK_PART_LOCATION_ASSIGNED` (part_id, branch_id) → exists
- `CHECK_PART_LOCATION_ASSIGNED_EXCL_ID` (part_id, branch_id, id) → exists (for edit)

**UI: `set-part-location-section.tsx`**
- Branch selector at top
- Toolbar: search, Refresh, "Assign Location" button
- Paginated table: Part Code, Part Name, UOM, Current Stock (from stock_overview), Location, Actions (Edit, Remove)
- `assign-part-location-dialog.tsx` — part combobox (parts with stock at branch), location select (from `spare_part_location_master` filtered to branch), submit via `genericUpdate` on `spare_part_location`
- Remove via `genericUpdate` with `deletedIds`

**Types:** `types/part-location-assignment.ts` → `PartLocationAssignmentType`

---

## 6. Shared Client Infrastructure

### 6.1 LineItemsEditor component

**File:** `src/features/client/components/line-items-editor.tsx`

Reusable table-based line item editor. Used by Purchase, Sales, Adjustment, Branch Transfer, Loan, Opening Stock.

```typescript
type LineItem = {
  _key: string;           // local UUID for React key (not sent to server)
  part_id: number | null;
  part_code: string;
  part_name: string;
  uom: string;
  quantity: number;
  unit_price?: number;    // purchase / sales
  unit_cost?: number;     // adjustment / branch transfer / loan / opening
  dr_cr?: 'D' | 'C';     // adjustment only
  hsn_code?: string;
  gst_rate?: number;      // sales
  cgst_rate?: number;     // purchase
  sgst_rate?: number;     // purchase
  igst_rate?: number;     // purchase
  item_description?: string; // sales
  remarks?: string;
  available_stock?: number;  // UI hint only
};

type LineItemsEditorProps = {
  mode: 'purchase' | 'sales' | 'adjustment' | 'branch-transfer' | 'loan' | 'opening';
  branchId: number | null;
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  disabled?: boolean;
};
```

Columns shown per mode:
- **purchase:** Part, HSN, Qty, Unit Price, CGST%, SGST%, IGST%, Total
- **sales:** Part, Description, HSN, Qty, Unit Price, GST%, Total, Avail
- **adjustment:** Part, D/C, Qty, Unit Cost, Remarks
- **branch-transfer:** Part, Qty, Unit Cost, Avail (at from_branch)
- **loan:** Part, Qty, Unit Cost, Avail
- **opening:** Part, Qty, Unit Cost

### 6.2 Part search combobox

**File:** `src/features/client/components/part-search-combobox.tsx`

Debounced search → `GET_PARTS_PAGED` (existing) → dropdown with part_code + part_name + uom.
On select: calls `onSelect(part)` with full part object so caller can auto-fill HSN, GST, cost_price.

### 6.3 Invoice utilities

**File:** `src/lib/invoice-utils.ts`

```typescript
calcPurchaseLine(qty, unitPrice, cgstRate, sgstRate, igstRate): PurchaseLineTotals
calcSalesLine(qty, unitPrice, gstRate, branchStateCode, customerStateCode): SalesLineTotals
// intra-state → split gst_rate / 2 into CGST + SGST; inter-state → full into IGST
sumLinesTotals(lines): InvoiceTotals  // { taxable, cgst, sgst, igst, totalTax, total }
```

---

## 7. client-inventory-page.tsx — Final State

```typescript
switch (selected) {
    case "Stock Overview":            return <StockOverviewSection />;
    case "Consumption (Parts Usage)": return <ConsumptionSection />;
    case "Purchase Entry":            return <PurchaseEntrySection />;
    case "Sales Entry":               return <SalesEntrySection />;
    case "Stock Adjustment":          return <StockAdjustmentSection />;
    case "Branch Transfer":           return <BranchTransferSection />;
    case "Loan / Issue & Return":     return <LoanIssueSection />;
    case "Opening Stock":             return <OpeningStockSection />;
    case "Part Finder":               return <PartFinderSection />;
    case "Set Part Location":         return <SetPartLocationSection />;
    default:                          return <ComingSoon label={selected || "Inventory"} />;
}
```

---

## 8. Implementation Sequence

### Phase 1 — Infrastructure (unblocks everything)
1. Write + apply `MIGRATION_INVENTORY_V1` to dev tenant schema
2. Insert new `stock_transaction_type` seed rows
3. Add 7 new mutations to `schema.graphql` + stub resolvers in `mutation.py`
4. Add `_get_current_stock` and `_next_doc_number` utilities to `mutation_helper.py`

### Phase 2 — Read-only features (no server mutations, fast)
5. **Consumption** — `GET_PARTS_CONSUMPTION*` SQL + `consumption-section.tsx`
6. **Part Finder** — `GET_PART_STOCK_ALL_BRANCHES`, `GET_PARTS_SEARCH_FOR_FINDER` SQL + `part-finder-section.tsx`
7. **Set Part Location** — SQL + `set-part-location-section.tsx` + `assign-part-location-dialog.tsx`

### Phase 3 — Shared UI infrastructure
8. `part-search-combobox.tsx`
9. `invoice-utils.ts`
10. `line-items-editor.tsx`

### Phase 4 — Simple transactional (existing tables, no stock check)
11. **Stock Adjustment** — helper + SQL + `stock-adjustment-section.tsx` + dialogs
12. **Opening Stock** — helper + SQL + `opening-stock-section.tsx` + dialogs

### Phase 5 — Complex transactional (existing tables, with stock check / doc numbering)
13. **Purchase Entry** — helper + SQL + `purchase-entry-section.tsx` + dialogs
14. **Sales Entry** — helper + SQL + `sales-entry-section.tsx` + dialogs

### Phase 6 — New-table features (schema already migrated in Phase 1)
15. **Branch Transfer** — helper + SQL + `branch-transfer-section.tsx` + dialogs
16. **Loan / Issue & Return** — both helpers + SQL + `loan-issue-section.tsx` + dialogs

---

## 9. Complete File Manifest

### Server
| File | Change |
|------|--------|
| `app/graphql/schema.graphql` | +7 mutations |
| `app/graphql/resolvers/mutation.py` | +7 resolver functions |
| `app/graphql/resolvers/mutation_helper.py` | +7 helpers + 2 utilities |
| `app/db/sql_store.py` | +~28 SQL queries + `MIGRATION_INVENTORY_V1` |

### Client — Constants
| File | Change |
|------|--------|
| `src/constants/sql-map.ts` | +~28 keys |
| `src/constants/graphql-map.ts` | +7 mutation entries |
| `src/constants/messages.ts` | +~35 messages |

### Client — New type files
```
src/features/client/types/consumption.ts
src/features/client/types/purchase.ts
src/features/client/types/sales.ts
src/features/client/types/stock-adjustment.ts
src/features/client/types/branch-transfer.ts
src/features/client/types/loan-issue.ts
src/features/client/types/opening-stock.ts
src/features/client/types/part-finder.ts
src/features/client/types/part-location-assignment.ts
```

### Client — New shared components / utilities
```
src/features/client/components/line-items-editor.tsx
src/features/client/components/part-search-combobox.tsx
src/lib/invoice-utils.ts
```

### Client — New section components
```
src/features/client/components/consumption-section.tsx
src/features/client/components/purchase-entry-section.tsx
src/features/client/components/sales-entry-section.tsx
src/features/client/components/stock-adjustment-section.tsx
src/features/client/components/branch-transfer-section.tsx
src/features/client/components/loan-issue-section.tsx
src/features/client/components/opening-stock-section.tsx
src/features/client/components/part-finder-section.tsx
src/features/client/components/set-part-location-section.tsx
```

### Client — New dialog components
```
src/features/client/components/add-purchase-invoice-dialog.tsx
src/features/client/components/view-purchase-invoice-dialog.tsx
src/features/client/components/add-sales-invoice-dialog.tsx
src/features/client/components/view-sales-invoice-dialog.tsx
src/features/client/components/add-stock-adjustment-dialog.tsx
src/features/client/components/view-stock-adjustment-dialog.tsx
src/features/client/components/add-branch-transfer-dialog.tsx
src/features/client/components/view-branch-transfer-dialog.tsx
src/features/client/components/add-loan-issue-dialog.tsx
src/features/client/components/add-loan-return-dialog.tsx
src/features/client/components/add-opening-stock-dialog.tsx
src/features/client/components/view-opening-stock-dialog.tsx
src/features/client/components/assign-part-location-dialog.tsx
```

### Client — Modified page
| File | Change |
|------|--------|
| `src/features/client/pages/client-inventory-page.tsx` | +9 case branches + 9 imports |
