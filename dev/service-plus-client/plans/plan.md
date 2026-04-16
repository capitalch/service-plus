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
       ├─ YES → load it + lines, show in View mode
       └─ NO  → show New form
                  └─ User fills entry_date, ref_no, remarks + line items (part, qty, unit_cost)
                        └─ Save → INSERT header + lines (genericUpdate nested insert)
                                   └─ Nested xDetails writes stock_transaction rows
                                        (dr_cr='D', stock_opening_balance_line_id set)

User clicks Edit (from view mode)
  └─ Form pre-populated with existing data
       └─ Save → UPDATE header + replace all lines (genericUpdate with deletedIds)
```

---

## Implementation Steps — ALL COMPLETE ✅

### Step 1 — DB change (server) ✅ DONE
- `UNIQUE (branch_id)` constraint added to `demo1.stock_opening_balance`
- `supplier_state_code` dropped from `demo1.purchase_invoice`
- File: `service-plus-server/app/db/service_plus_service.sql`

### Step 2 — TypeScript types ✅ DONE
- `db-schema-service.ts` regenerated — `StockOpeningBalance`, `StockOpeningBalanceLine`, `stock_opening_balance_line_id` in `StockTransaction`

### Step 3 — Server SQL (`sql_store.py`) ✅ DONE
- `GET_OPENING_BALANCE_BY_BRANCH` — returns header + lines JSON for a given `branch_id`

### Step 4 — Server `mutation_helper.py` ✅ NOT NEEDED
- `stock_transaction` rows written via nested `xDetails` in `genericUpdate` (same pattern as stock adjustment)

### Step 5 — Client SQL map ✅ DONE
- `GET_OPENING_BALANCE_BY_BRANCH` added to `sql-map.ts`

### Step 6 — Client messages ✅ DONE
- Opening stock messages added to `messages.ts`

### Step 7 — Client feature types ✅ DONE
- `src/features/client/types/stock-opening-balance.ts` created
  - `OpeningStockType`, `OpeningStockLineType`, `OpeningStockLineFormItemType`, `emptyOpeningStockLine`

### Step 8 — Client components ✅ DONE
- `src/features/client/components/inventory/opening-stock/new-opening-stock.tsx`
  - Form: entry_date, ref_no, remarks + line items (part, qty, unit_cost, remarks)
  - Saves via `genericUpdate` nested insert with `stock_transaction` xDetails
  - Edit mode: pre-populates form, replaces all lines via `deletedIds`
- `src/features/client/components/inventory/opening-stock/opening-stock-section.tsx`
  - Loads entry on mount / branch change
  - mode: `loading` → `view` (if entry exists) or `new` (if not)
  - View mode: read-only table with totals + Edit button
  - Edit/New mode: form ref with Reset / Cancel / Save header buttons

### Step 9 — Inventory page wiring ✅ DONE
- `client-inventory-page.tsx` — `"Opening Stock"` case added → `<OpeningStockSection />`

---

## Files Changed

| File | Change |
|------|--------|
| `service-plus-server/app/db/service_plus_service.sql` | UNIQUE constraint, drop supplier_state_code |
| `service-plus-server/app/db/sql_store.py` | `GET_OPENING_BALANCE_BY_BRANCH` |
| `service-plus-client/src/types/db-schema-service.ts` | Regenerated with new tables |
| `service-plus-client/src/constants/sql-map.ts` | `GET_OPENING_BALANCE_BY_BRANCH` |
| `service-plus-client/src/constants/messages.ts` | Opening stock messages |
| `service-plus-client/src/features/client/types/stock-opening-balance.ts` | **NEW** — feature types |
| `service-plus-client/src/features/client/components/inventory/opening-stock/new-opening-stock.tsx` | **NEW** — form component |
| `service-plus-client/src/features/client/components/inventory/opening-stock/opening-stock-section.tsx` | **NEW** — section component |
| `service-plus-client/src/features/client/pages/client-inventory-page.tsx` | Added `"Opening Stock"` route case |
