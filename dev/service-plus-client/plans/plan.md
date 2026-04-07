# Plan: Edit Purchase Invoice Feature

## Context
The purchase entry section has a "New" tab (form) and a "View" tab (list). Currently the view list only has Eye (view dialog) and Trash (delete) actions. This plan adds an Edit button per row that switches to the "New" tab with its label changed to "Edit" and the form pre-populated with the selected invoice's data.

**Update strategy**: Single `genericUpdate` call.
- UPDATE `purchase_invoice` header (pass `id`).
- `deletedIds`: all original line IDs → CASCADE deletes their `stock_transaction` rows automatically.
- `xData`: all current lines without `id` (INSERT fresh) + nested `stock_transaction` xDetails.

No raw SQL script needed. No `_stockTxnId` tracking needed. No pre-step.

---

## Affected Files

| File | Change |
|------|--------|
| `service-plus-server/app/db/sql_store.py` | Add `CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID` |
| `src/constants/messages.ts` | Add `SUCCESS_PURCHASE_UPDATED`, `ERROR_PURCHASE_UPDATE_FAILED` |
| `src/constants/sql-map.ts` | Add `CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID` |
| `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx` | Accept `editInvoice` prop; populate state; track `originalLineIds`; single-call update submit |
| `src/features/client/components/inventory/purchase-entry/purchase-entry-section.tsx` | Edit button; `editInvoice` state; label + tab button changes |

---

## Implementation Steps

### Step 1 — Add `CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID`
**File:** `service-plus-server/app/db/sql_store.py`

Add directly after `CHECK_SUPPLIER_INVOICE_EXISTS`:

```sql
CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID = """
    with
        "p_supplier_id" as (values(%(supplier_id)s::bigint)),
        "p_invoice_no"  as (values(%(invoice_no)s::text)),
        "p_id"          as (values(%(id)s::bigint))
    SELECT EXISTS (
        SELECT 1 FROM purchase_invoice
        WHERE supplier_id = (table "p_supplier_id")
          AND UPPER(invoice_no) = UPPER((table "p_invoice_no"))
          AND id <> (table "p_id")
    ) AS exists
"""
```

---

### Step 2 — Add messages
**File:** `src/constants/messages.ts`

```ts
SUCCESS_PURCHASE_UPDATED:     'Purchase invoice updated successfully.',
ERROR_PURCHASE_UPDATE_FAILED: 'Failed to update purchase invoice. Please try again.',
```

---

### Step 3 — Add SQL map key
**File:** `src/constants/sql-map.ts`

```ts
CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID: "CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID",
```

---

### Step 4 — `new-purchase-invoice.tsx`: edit mode support

**File:** `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`

**A) Props** — add `editInvoice?: PurchaseInvoiceType | null`.

**B) Original line IDs** — add state to track IDs of lines that existed when the invoice was loaded:
```typescript
const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);
```

**C) Populate form** — `useEffect` on `editInvoice`:
- Call `GET_PURCHASE_INVOICE_DETAIL(editInvoice.id)` to fetch full detail.
- Set header state: `setVendorId`, `setInvoiceNo`, `setInvoiceDate`, `setSupplierStateCode`, `setRemarks`.
- Store `setOriginalLineIds(detail.lines.map(l => l.id))`.
- Map `PurchaseLineType[]` → `PurchaseLineFormItem[]`: derive `gst_rate = cgst_rate * 2` (or `igst_rate` if IGST).
- Reset physical totals to zero.
- If `editInvoice` is null → call `handleReset`, clear `originalLineIds`.

**D) Duplicate check** — modify existing `useEffect`:
- Same supplier + same invoice_no as `editInvoice` → skip (`setInvoiceExists(false)`).
- Different invoice_no or supplier while editing → use `CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID` with `{ supplier_id, invoice_no, id: editInvoice.id }`.
- Not editing → existing `CHECK_SUPPLIER_INVOICE_EXISTS` unchanged.

**E) Submit in edit mode** — `if (editInvoice)` branch, single `genericUpdate` call:

```typescript
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdate,
    variables: {
        db_name: dbName, schema,
        value: graphQlUtils.buildGenericUpdateValue({
            tableName: "purchase_invoice",
            xData: {
                id: editInvoice.id,
                supplier_id: vendorId,
                invoice_no: invoiceNo.trim(),
                invoice_date: invoiceDate,
                supplier_state_code: supplierStateCode,
                aggregate_amount: totals.aggregate,
                cgst_amount: totals.cgst,
                sgst_amount: totals.sgst,
                igst_amount: totals.igst,
                total_tax: totals.total_tax,
                total_amount: totals.total,
                brand_id: selectedBrandId,
                remarks: remarks.trim() || null,
                xDetails: {
                    tableName: "purchase_invoice_line",
                    fkeyName: "purchase_invoice_id",
                    deletedIds: originalLineIds,   // cascade deletes stock_transactions
                    xData: lines.map(line => {
                        const c = calcLine(line);
                        return {
                            part_id:          line.part_id,
                            hsn_code:         line.hsn_code,
                            quantity:         line.quantity,
                            unit_price:       line.unit_price,
                            aggregate_amount: c.aggregate,
                            gst_rate:         line.gst_rate,
                            cgst_amount:      c.cgstAmt,
                            sgst_amount:      c.sgstAmt,
                            igst_amount:      c.igstAmt,
                            total_amount:     c.total,
                            xDetails: {
                                tableName: "stock_transaction",
                                fkeyName:  "purchase_line_id",
                                xData: [{
                                    branch_id:                branchId,
                                    part_id:                  line.part_id,
                                    qty:                      line.quantity,
                                    unit_cost:                line.unit_price,
                                    dr_cr:                    "D",
                                    transaction_date:         invoiceDate,
                                    stock_transaction_type_id: purchaseTypeId,
                                }],
                            },
                        };
                    }),
                },
            },
        }),
    },
});
toast.success(MESSAGES.SUCCESS_PURCHASE_UPDATED);
onSuccess();
```

---

### Step 5 — `purchase-entry-section.tsx`: wire Edit flow

**File:** `src/features/client/components/inventory/purchase-entry/purchase-entry-section.tsx`

**A) State**:
```typescript
const [editInvoice, setEditInvoice] = useState<PurchaseInvoiceType | null>(null);
```

**B) Handler**:
```typescript
const handleEditInvoice = (inv: PurchaseInvoiceType) => {
    setEditInvoice(inv);
    setMode('new');
};
```

**C) Edit button** — in Actions `<td>` between Eye and Trash2. Import `Pencil` from `lucide-react`:
```tsx
<Button
    className="h-7 px-2 text-amber-500 hover:text-amber-600"
    size="sm" variant="outline"
    onClick={() => handleEditInvoice(inv)}
>
    <Pencil className="h-3.5 w-3.5" />
</Button>
```

**D) Header subtitle**:
```tsx
{mode === 'new' && !editInvoice && <span ...>— New</span>}
{mode === 'new' &&  editInvoice && <span ...>— Edit</span>}
{mode === 'view'               && <span ...>— View</span>}
```

**E) Mode toggle button**:
- `mode === 'new' && editInvoice` → `<Pencil>` + "Edit", amber style (`bg-amber-600/10 text-amber-600 border-amber-600/20`).
- `mode === 'new' && !editInvoice` → existing `<PlusCircle>` + "New", emerald.
- Clicking the left toggle always does: `setEditInvoice(null); setMode('new');`

**F) Pass prop and update `onSuccess`**:
```tsx
<NewPurchaseInvoice
    ...
    editInvoice={editInvoice}
    onSuccess={() => {
        setEditInvoice(null);
        setMode('view');
        if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1);
    }}
/>
```

---

## Data Flow Summary

```
User clicks Pencil in View tab
    → setEditInvoice(inv) + setMode('new')
    → Tab: "New" → "Edit"; toggle: PlusCircle/emerald → Pencil/amber
    → NewPurchaseInvoice.useEffect: fetch GET_PURCHASE_INVOICE_DETAIL(inv.id)
    → populate header + lines; store originalLineIds
    → user edits freely (add/remove/modify lines)
    → Save → handleSubmit() edit branch:
        genericUpdate({
            purchase_invoice: { id, ...header,
                xDetails: {
                    purchase_invoice_line:
                        deletedIds: [all originalLineIds]  ← CASCADE deletes stock_transactions
                        xData: [all current lines (no id) + nested stock_transaction]
                }
            }
        })
    → toast SUCCESS_PURCHASE_UPDATED
    → onSuccess() → setEditInvoice(null), setMode('view'), reload list
```

---

## Verification

1. **New invoice** — `editInvoice` null; no regression.
2. **Edit — modify lines** — existing lines deleted (cascade kills txns), new versions inserted fresh.
3. **Edit — add line** — included in xData, inserted with stock_transaction.
4. **Edit — remove line** — not in xData; its old ID is in `deletedIds`; cascade removes stock_transaction.
5. **Duplicate check** — same invoice_no + supplier → not flagged; changed to existing → flagged.
6. **Switch to New** — click toggle → `editInvoice` cleared, blank form.
7. **Delete** — unaffected.
