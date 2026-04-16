# Opening Stock Implementation Plan

## Current Table Structure Analysis

### `stock_opening_balance` (header)
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | Auto-generated identity |
| entry_date | date | Date of opening balance entry |
| ref_no | text | Optional reference number |
| branch_id | bigint | FK → demo1.branch — **UNIQUE (one per branch)** |
| remarks | text | Optional |
| created_by | bigint | Loosely coupled to user (no FK) |
| created_at / updated_at | timestamptz | Audit columns |

### `stock_opening_balance_line` (lines)
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | Auto-generated identity |
| stock_opening_balance_id | bigint | FK → stock_opening_balance (CASCADE DELETE) |
| part_id | bigint | FK → spare_part_master |
| qty | numeric(12,3) | CHECK qty > 0 |
| unit_cost | numeric(12,2) | Optional cost per unit |
| remarks | text | Optional |
| created_at / updated_at | timestamptz | Audit columns |

### `stock_transaction` (existing linkage)
The `stock_transaction` table already has `stock_opening_balance_line_id` column and FK. The DB is fully ready — no further schema changes needed.

---

## Design Decision: One Entry Per Branch ✅ DECIDED & IMPLEMENTED

**Strategy A** was chosen — `UNIQUE (branch_id)` constraint on `stock_opening_balance` enforces one record per branch at DB level.

UI behaviour:
- On load: check if an entry exists for the current branch.
- If YES → show in View/Edit mode (no New button).
- If NO → show blank New form.
- No list/grid — at most 1 row per branch.

---

## Workflow

```
App loads
  └─ Query: does stock_opening_balance row exist for current branch_id?
       ├─ YES → load it + lines, show in View/Edit mode (no New button)
       └─ NO  → show New form
                  └─ User fills entry_date, ref_no, remarks + line items (part, qty, unit_cost)
                        └─ Save → INSERT header + lines (genericUpdate nested insert)
                                   └─ Server trigger / post-insert hook writes stock_transaction
                                        rows (one per line, dr_cr='D', stock_opening_balance_line_id set)

User edits existing entry
  └─ UPDATE header fields + upsert/delete lines (genericUpdate with deletedIds)
       └─ Server re-syncs stock_transaction rows accordingly

User deletes (admin only, rare)
  └─ DELETE header → CASCADE deletes lines → CASCADE deletes stock_transaction rows
```

---

## Implementation Steps

### Step 1 — DB change (server) ✅ DONE
- Added `UNIQUE (branch_id)` constraint to `demo1.stock_opening_balance`.
- File updated: `service-plus-server/app/db/service_plus_service.sql`

```sql
ALTER TABLE ONLY demo1.stock_opening_balance
    ADD CONSTRAINT stock_opening_balance_branch_id_key UNIQUE (branch_id);
```

**Also done in this step:**
- `supplier_state_code` column dropped from `demo1.purchase_invoice`.

---

### Step 2 — TypeScript types (`db-schema-service.ts`) ✅ DONE
Regenerated with `pg-to-ts`. Changes:
- `StockOpeningBalance` / `StockOpeningBalanceInput` interface added.
- `StockOpeningBalanceLine` / `StockOpeningBalanceLineInput` interface added.
- `stock_opening_balance_line_id` field added to `StockTransaction` / `StockTransactionInput`.
- FK `stock_opening_balance_line_id` added to `stock_transaction.foreignKeys`.
- `stock_opening_balance_line_id` added to `stock_transaction.columns`.
- `supplier_state_code` removed from `PurchaseInvoice` / `PurchaseInvoiceInput`.
- Both new tables added to `TableTypes` and `tables` export.

---

### Step 3 — Server: SQL queries in `sql_store.py` ⬜ TODO
Add the following SQL IDs:
- `GET_OPENING_BALANCE_BY_BRANCH` — fetch header + lines JSON for a given `branch_id`.
- `GET_OPENING_BALANCE_LINES` — fetch lines with `part_code` / `part_name` joined from `spare_part_master` (for view mode).

No delete SQL needed — `genericUpdate` with `deletedIds` handles line deletion; header deletion uses `genericUpdate` with `deletedIds` on the header.

---

### Step 4 — Server: `mutation_helper.py` ⬜ TODO
Check if `genericUpdate` already handles the `stock_transaction` write for `stock_opening_balance_line`. If not (likely — only purchase/sales/adjustment are wired), add a post-insert/update hook similar to `stock_adjustment_line` that:
- Inserts a `stock_transaction` row with `dr_cr='D'`, `stock_opening_balance_line_id = line.id`.
- On line update: updates the corresponding `stock_transaction` row.
- On line delete (via `deletedIds`): cascades automatically because of the FK ON DELETE CASCADE.

---

### Step 5 — Client: SQL map constants ⬜ TODO
Add to `SQL_MAP`:
- `GET_OPENING_BALANCE_BY_BRANCH`
- `GET_OPENING_BALANCE_LINES`

---

### Step 6 — Client: Feature types ⬜ TODO
Create `src/features/client/types/stock-opening-balance.ts`:
```ts
export type StockOpeningBalanceType = {
    id:         number;
    branch_id:  number;
    created_at: string;
    created_by: number | null;
    entry_date: string;
    ref_no:     string | null;
    remarks:    string | null;
    updated_at: string;
};

export type StockOpeningBalanceLineType = {
    id:                       number;
    part_code:                string;
    part_id:                  number;
    part_name:                string;
    qty:                      number;
    remarks:                  string | null;
    stock_opening_balance_id: number;
    unit_cost:                number | null;
};

export type StockOpeningBalanceLineFormItemType = {
    _key:      string;
    brand_id:  number | null;
    part_code: string;
    part_id:   number | null;
    part_name: string;
    qty:       number;
    remarks:   string;
    unit_cost: number;
};
```

---

### Step 7 — Client: Components ⬜ TODO
Create folder `src/features/client/components/inventory/opening-stock/`:

**`new-opening-stock.tsx`** (form component)
- Fields: `entry_date`, `ref_no`, `remarks` (header).
- Line items table: part picker (`part_code`/`part_name` via brand), `qty`, `unit_cost`, `remarks`.
- Validation via react-hook-form + zod.
- Save via `genericUpdate` nested insert:
  ```json
  {
    "tableName": "stock_opening_balance",
    "xData": { "entry_date": "...", "branch_id": ..., "ref_no": "...", "remarks": "..." },
    "xDetails": [{
      "tableName": "stock_opening_balance_line",
      "foreignKey": "stock_opening_balance_id",
      "xData": [{ "part_id": ..., "qty": ..., "unit_cost": ..., "remarks": "..." }, ...]
    }]
  }
  ```

**`opening-stock-section.tsx`** (page-level section, follows purchase-entry header pattern)
- On mount: query `GET_OPENING_BALANCE_BY_BRANCH` for current branch.
- If result exists → default mode = `"view"` (show existing entry inline).
- If result does not exist → default mode = `"new"`.
- No pagination (at most 1 record per branch).
- Header: `flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-1` (purchase pattern).
- Shows existing entry details inline (date, ref_no, lines table) in view mode.
- Edit button loads the record into the form for update.
- Root div: `overflow-y-auto md:overflow-y-hidden`.

---

## What Does NOT Need Changing

- `stock_transaction` table — already has `stock_opening_balance_line_id` ✅
- `stock_opening_balance_line` table — structure is correct ✅
- `stock_opening_balance` table — UNIQUE constraint now added ✅
- Client genericUpdate / genericQuery infrastructure — reused as-is ✅
- BrandSelect, part picker components — reused from stock_adjustment ✅
