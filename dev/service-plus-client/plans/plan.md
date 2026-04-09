# Sales Entry — Multi-Feature Plan

## Context
Applying 4 features to sales entry, mirroring purchase entry patterns:
1. **Sales Return** — FAB checkbox, red cards, `SALE_RETURN` transaction type
2. **Line Remarks** — optional text per line item
3. **GST badge** — CheckCircle/XCircle in title bar (like purchase entry)
4. **IGST checkbox** — manual override in header (like purchase entry)

---

## DB Changes Required (do before applying)

```sql
-- 1. Sales return flag on invoice header
ALTER TABLE <schema>.sales_invoice
    ADD COLUMN IF NOT EXISTS is_return boolean NOT NULL DEFAULT false;

-- 2. Remarks per line
ALTER TABLE <schema>.sales_invoice_line
    ADD COLUMN IF NOT EXISTS remarks text;

-- 3. SALE_RETURN transaction type (reverses a sale → stock comes back in → dr_cr='D')
INSERT INTO <schema>.stock_transaction_type (id, code, name, dr_cr, description, is_active, is_system)
VALUES (15, 'SALE_RETURN', 'Sale Return', 'D', 'Stock returned by customer', true, true);
-- Use next available id; confirm actual id in DB before applying
```

---

## Files to Modify

| File | Change |
|---|---|
| `src/features/client/types/sales.ts` | Add `is_return` to `SalesInvoiceType`; add `remarks` to `SalesLineType` and `SalesLineFormItem` |
| `app/db/sql_store.py` | Add `si.is_return` to paged query; add `si.is_return` + `'remarks', sil.remarks` to detail query |
| `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx` | isReturn state+FAB+red cards; remarks field; executeSave SALE_RETURN logic |
| `src/features/client/components/inventory/sales-entry/sales-entry-section.tsx` | Fix header to `grid grid-cols-3`; add IGST checkbox + GST badge; RTN badge in list |

---

## Step 1: Types — `src/features/client/types/sales.ts`

```typescript
// SalesInvoiceType — add:
is_return:  boolean;

// SalesLineType — add:
remarks:    string | null;

// SalesLineFormItem — add:
remarks:    string;
```

---

## Step 2: SQL — `app/db/sql_store.py`

### `GET_SALES_INVOICES_PAGED`
Add `si.is_return` to the SELECT column list (after `si.remarks`).

### `GET_SALES_INVOICE_DETAIL`
- Add `si.is_return,` to the header SELECT (after `si.remarks`)
- Add to `json_build_object` (after `'total_amount'`):
```python
'remarks',      sil.remarks
```

---

## Step 3: Form — `new-sales-invoice.tsx`

### 3a. New state
```typescript
const [isReturn, setIsReturn] = useState(false);
```

### 3b. Reset `isReturn` in reset handler
```typescript
setIsReturn(false);
```

### 3c. Restore in edit-mode effect
```typescript
setIsReturn(Boolean(detail.is_return));
```

### 3d. FAB checkbox — absolute top-left of first Card (exact same pattern as purchase)
```tsx
<Card className={`relative border-[var(--cl-border)] shadow-sm !overflow-visible ${isReturn ? "bg-red-50 dark:bg-red-950/20" : "bg-[var(--cl-surface)]"}`}>
    <label className="absolute -top-3 -left-1 z-10 flex items-center gap-1.5 cursor-pointer select-none rounded px-2 py-1 bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-800 shadow-sm">
        <input
            type="checkbox"
            checked={isReturn}
            onChange={e => setIsReturn(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-red-500"
            disabled={!!editInvoice}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
            Sales Return
        </span>
    </label>
    <CardContent className="pt-4 !overflow-visible">
        ...existing grid...
    </CardContent>
</Card>
```

### 3e. Red background on second Card (line items)
```tsx
<Card className={`... ${isReturn ? "bg-red-50 dark:bg-red-950/20" : "bg-[var(--cl-surface)]"}`}>
```

### 3f. `remarks` — emptyLine, table, edit mapping, save payload
- `emptyLine()`: add `remarks: ""`
- Table header: add `<th>Remarks</th>` after Total (before Actions), shrink Total from `10%` → `8%`, Actions from `6%` → `5%`
- Table row: add `<Input>` cell for remarks (same style as purchase)
- Edit mapping: `remarks: l.remarks ?? ""`
- Save payload: `remarks: line.remarks.trim() || null`

### 3g. `executeSave()` — return mode logic
```typescript
const salesTypeId  = txnTypes.find(t => t.code === "SALE")?.id;
const returnTypeId = txnTypes.find(t => t.code === "SALE_RETURN")?.id;

const txnTypeId = isReturn ? returnTypeId : salesTypeId;
const drCr      = isReturn ? "D" : "C";

// stock_transaction xData:
stock_transaction_type_id: txnTypeId,
dr_cr: drCr,
```

Add `is_return: isReturn` to the `sales_invoice` header payload (xData of the mutation).

Guard: if `isReturn && !returnTypeId` → toast error and abort.

---

## Step 4: Section — `sales-entry-section.tsx`

### 4a. Fix header to `grid grid-cols-3` (same as fixed purchase entry)
Replace the current `flex flex-col lg:grid lg:h-14 lg:grid-cols-3 ...` outer div with:
```tsx
<div className="grid grid-cols-3 items-center border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 min-h-[56px]">
```
And update the three inner sections:
- Left: `flex items-center gap-3 overflow-hidden`
- Center: `flex items-center justify-center` (drop border-y, lg: prefixes)
- Right: `flex items-center justify-end` with `invisible pointer-events-none` when `mode !== 'new'`

### 4b. GST badge in title (left section)
Exactly as purchase entry — show when `mode === 'new'`:
```tsx
{mode === 'new' && (
    <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm animate-in fade-in zoom-in duration-500 delay-150 ml-4 ${
        isGstRegistered ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
    }`}>
        {isGstRegistered
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            : <XCircle className="h-3.5 w-3.5 text-red-600" />
        }
        <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGstRegistered ? 'text-emerald-700' : 'text-red-700'}`}>
            {isGstRegistered ? 'GST' : 'No-GST'}
        </span>
    </div>
)}
```
Import `selectIsGstRegistered` from context-slice (already likely imported).

### 4c. IGST checkbox in center controls
Add IGST toggle label alongside brand and mode-toggle buttons (same as purchase entry center section):
```tsx
<label className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-lg border-2 font-black text-[12px] uppercase tracking-[0.1em] transition-all shadow-sm ${
    mode !== 'new'
        ? 'invisible pointer-events-none'
        : isIgst
        ? 'bg-blue-400 text-white border-blue-600 shadow-blue-500/20'
        : 'bg-[var(--cl-surface-2)] border-[var(--cl-border)] text-[var(--cl-text-muted)]'
}`}>
    <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-white cursor-pointer"
        checked={isIgst}
        onChange={e => setIsIgst(e.target.checked)}
    />
    IGST
</label>
```

### 4d. RTN badge in invoice list (same as purchase)
```tsx
{inv.invoice_no}
{inv.is_return && (
    <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/40 rounded px-1 py-0.5">
        RTN
    </span>
)}
```

---

## Verification

1. Sales Return toggle → both cards go red; `is_return = true` saved to DB; `dr_cr = 'D'`, type = SALE_RETURN in stock_transaction
2. Line remarks → input saves to `sales_invoice_line.remarks`; restored in edit mode
3. GST badge shows in title bar when in New/Edit mode
4. IGST checkbox in header → overrides state-based IGST; tax columns toggle correctly
5. RTN badge shows on return invoices in list view
6. Non-return sales → unaffected
