# Plan: branch_id Unique Constraint on stock_opening_balance + Schema Updates

## Summary of Changes Implemented
The following database and schema changes have been completed.

---

## Workflow

```
Database change: stock_opening_balance.branch_id UNIQUE constraint added
    │
    ├─► SQL file updated: service-plus-server/app/db/service_plus_service.sql
    │       └── UNIQUE constraint on demo1.stock_opening_balance(branch_id)
    │           (one opening balance per branch — enforced at DB level)
    │
    ├─► purchase_invoice.supplier_state_code column DROPPED
    │       └── Removed from DB schema and TypeScript types
    │
    └─► TypeScript types regenerated: service-plus-client/src/types/db-schema-service.ts
            ├── stock_opening_balance table added
            ├── stock_opening_balance_line table added
            └── supplier_state_code removed from PurchaseInvoice / PurchaseInvoiceInput
```

---

## Step 1 — Add UNIQUE constraint on `stock_opening_balance.branch_id` ✅ DONE

**File:** `service-plus-server/app/db/service_plus_service.sql`

```sql
ALTER TABLE ONLY demo1.stock_opening_balance
    ADD CONSTRAINT stock_opening_balance_branch_id_key UNIQUE (branch_id);
```

**Effect:** Each branch is restricted to a single stock opening balance record.
This ensures no duplicate opening balance entries per branch.

---

## Step 2 — Drop `supplier_state_code` from `purchase_invoice` ✅ DONE

**File:** `service-plus-server/app/db/service_plus_service.sql`

- Column `supplier_state_code` removed from `demo1.purchase_invoice` table.

**File:** `service-plus-client/src/types/db-schema-service.ts`

- `supplier_state_code` removed from `PurchaseInvoice` interface
- `supplier_state_code` removed from `PurchaseInvoiceInput` interface
- `supplier_state_code` removed from `columns` and `requiredForInsert` arrays of `purchase_invoice` const

---

## Step 3 — Add `stock_opening_balance` and `stock_opening_balance_line` to TypeScript types ✅ DONE

**File:** `service-plus-client/src/types/db-schema-service.ts`

Tables added:
- `StockOpeningBalance` / `StockOpeningBalanceInput` interface
- `stock_opening_balance` const with columns, foreignKeys, requiredForInsert
- `StockOpeningBalanceLine` / `StockOpeningBalanceLineInput` interface
- `stock_opening_balance_line` const with columns, foreignKeys, requiredForInsert
- Both tables added to `TableTypes` and `tables` export

Also added to pg-to-ts generation command in file header:
`-t stock_opening_balance -t stock_opening_balance_line`

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `service-plus-server/app/db/service_plus_service.sql` | UNIQUE constraint on `stock_opening_balance(branch_id)`; dropped `supplier_state_code` | ✅ Done |
| `service-plus-client/src/types/db-schema-service.ts` | Added `stock_opening_balance` + `stock_opening_balance_line` types; removed `supplier_state_code` from `purchase_invoice` | ✅ Done |

---

## Impact Analysis

| Area | Impact |
|------|--------|
| Purchase Invoice form/queries | Must no longer send/expect `supplier_state_code` |
| Stock Opening Balance feature | Can now use TypeScript types; branch_id uniqueness enforced at DB level |
| Existing data | If multiple opening balance rows exist per branch, UNIQUE constraint will fail — data cleanup may be needed before migration |
