# Plan: Implement Loan Entry Module

## Reference
- Pattern: Stock Adjustment module (`stock-adjustment-section.tsx`, `new-stock-adjustment.tsx`)
- Task source: `plans/tran.md`

---

## What Already Exists (no changes needed)

| Item | Location | Status |
|------|----------|--------|
| DB tables `stock_loan`, `stock_loan_line` | `service_plus_service.sql` | ✅ exists |
| Transaction types `LOAN_IN` (id=9), `LOAN_OUT` (id=10) | `sql_bu.py` line 885–886 | ✅ seeded |
| SQL queries `GET_STOCK_LOANS_COUNT`, `GET_STOCK_LOANS_PAGED`, `GET_STOCK_LOAN_DETAIL` | `sql_store.py` line 2101–2171 | ✅ exists |
| `SQL_MAP` constants for loan | `src/constants/sql-map.ts` line 157–159 | ✅ exists |
| Messages `SUCCESS_LOAN_*`, `ERROR_LOAN_*` | `src/constants/messages.ts` line 363–372 | ✅ exists |
| Base types file `stock-loan.ts` | `src/features/client/types/stock-loan.ts` | ✅ exists (needs updates) |
| Menu item "Loan Entry" in sidebar | Left menu bar | ✅ exists |

---

## Workflow

```
Update Types → Create NewLoanEntry form → Create LoanEntrySection → Wire into page
```

---

## Steps

### Step 1 — Update `src/features/client/types/stock-loan.ts`

Align with the stock-adjustment type pattern:
- Change `interface` → `type` (per CLAUDE.md)
- Add `_key: string` to `LoanLineFormItem` (local UI key for React keying)
- Add `brand_id`, `part_code`, `part_name` to `LoanLineFormItem` for display (mirrors `StockAdjustmentLineFormItem`)
- Remove the `part?: SparePartMaster` field (replace with explicit `part_code`/`part_name` fields)
- Add `StockLoanWithLines` composite type
- Add `emptyLoanLine(brandId?: number | null): LoanLineFormItem` factory function (mirrors `emptyAdjustmentLine`)

### Step 2 — Create `src/features/client/components/inventory/stock-loan/new-loan-entry.tsx`

`forwardRef` component exposing `NewLoanEntryHandle` — follows `NewStockAdjustment` exactly.

**Props:**
```ts
type Props = {
    branchId: number | null;
    brandName?: string;
    editLoan?: StockLoanWithLines | null;
    onStatusChange: (status: { isValid: boolean; isSubmitting: boolean }) => void;
    onSuccess: () => void;
    selectedBrandId: number | null;
    txnTypes: StockTransactionTypeRow[];
};
```

**Header fields (Card, lg:grid-cols-12):**
- `loan_date` (date, required) — `lg:col-span-2`
- `loan_to` (text, required, placeholder "Technician / Agency name") — `lg:col-span-4`
- `ref_no` (text, optional) — `lg:col-span-3`
- `remarks` (text, optional) — `lg:col-span-3`

**Lines table columns:** `#` | `Part *` | `IN / OUT *` | `Qty *` | `Line Remarks` | `Actions`
- IN/OUT toggle buttons same as adjustment (IN=D emerald, OUT=C red)
- `PartCodeInput` + `LineAddDeleteActions` (same as stock-adjustment)
- `stock_transaction_type_id`: `LOAN_IN` for D, `LOAN_OUT` for C

**Submit payload structure (genericUpdate):**
```
stock_loan (header)
  └─ stock_loan_line (xDetails, fkeyName: "stock_loan_id")
       └─ stock_transaction (xDetails, fkeyName: "stock_loan_line_id")
```

**Validation:**
- `isFormValid = !!branchId && !!loan_date && !!loan_to.trim() && lines.every(l => !!l.part_id && l.qty > 0 && (l.dr_cr === "D" || l.dr_cr === "C"))`
- Show red border on `loan_to` input when empty (same style as adjustment reason field)

**Edit flow:**
- Fetch detail using `SQL_MAP.GET_STOCK_LOAN_DETAIL` with `{ id: editLoan.id }`
- Populate header state and lines from `detail.lines`
- Pass `deletedIds = originalLineIds` on update

### Step 3 — Create `src/features/client/components/inventory/stock-loan/loan-entry-section.tsx`

Section component following `StockAdjustmentSection` exactly.

**State:**
- `mode: "new" | "view"` — same toggle as adjustment
- `brands`, `txnTypes` — loaded once on mount via `fetchMeta`
- `selectedBrand: string` — brand select (required for new entry)
- `loans: StockLoanType[]`, `total`, `page`, `loading`
- `fromDate`, `toDate` — initialised with `currentFinancialYearRange()`
- `search`, `searchQ` — debounced (600ms)
- `deleteId`, `deleting` — delete confirm dialog
- `editLoan: StockLoanType | null` — edit state
- `newFormValid`, `submitting` — form coordination with `newLoanRef`

**Header bar layout (3-col grid, same as adjustment):**
- Left: `HandCoins` icon + "Loan Entry" title + mode label (New / Edit / View)
- Centre: Brand select + New/View toggle buttons
- Right: Reset + Save buttons (visible only in `new` mode)

**View mode toolbar:** from/to date inputs + search input (placeholder "Loan To, Ref #…") + Refresh button

**View mode data grid columns:** `#` | `Date` | `Loan To / Tech` | `Ref #` | `Remarks` | `Actions`
- Actions: dropdown with Edit (amber) and Delete (red) items — same as adjustment

**Delete dialog:** "This will permanently delete the loan entry and all associated stock transactions. This action cannot be undone."

**Edit flow:**
- `setEditLoan(row)` + `setMode("new")` — same pattern as adjustment
- `NewLoanEntry` receives `editLoan` prop; fetches detail internally

**Fetch data (`loadData`):** parallel `GET_STOCK_LOANS_PAGED` + `GET_STOCK_LOANS_COUNT` using `graphQlUtils.buildGenericQueryValue`

**Delete mutation:** `genericUpdate` with `deletedIds: [deleteId]` on `stock_loan` table

### Step 4 — Update `src/features/client/pages/client-inventory-page.tsx`

- Import `LoanEntrySection` from `../components/inventory/stock-loan/loan-entry-section`
- Add `case "Loan Entry": return <LoanEntrySection />;` in the switch (replacing the ComingSoon fallback)

---

## File Change Summary

| File | Action |
|------|--------|
| `src/features/client/types/stock-loan.ts` | Update — align with adjustment pattern |
| `src/features/client/components/inventory/stock-loan/new-loan-entry.tsx` | Create |
| `src/features/client/components/inventory/stock-loan/loan-entry-section.tsx` | Create |
| `src/features/client/pages/client-inventory-page.tsx` | Update — wire loan case |

No backend changes required (SQL, sql_store.py, and transaction types all exist).
