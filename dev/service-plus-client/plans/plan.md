# Plan: Modifications in Inventory > Sales Entry

## Context

The existing `SalesEntrySection` + `NewSalesInvoice` form already handles new/edit invoices,
IGST auto-detection from customer state, auto-population of customer details on select, GSTIN
display, and division-aware GST mode (`selectIsGstMode = !!currentDivision?.gstin`).

What is **missing** and must be added:

1. **GST-inclusive price column** (`gstPrice`) — editable in GST mode; back-calculates `unit_price`.
2. **Table footer totals row** (`<tfoot>`) — per-column totals for Amount, GST, Grand Total.
3. **Target Amount + Back Calculate** — input box + button in the summary footer to proportionally scale line prices to hit a target grand total.

---

## Workflow

```
User fills in line items (unit_price + gst_rate)
        │
        ▼
[GST mode] ─── gstPrice column auto-updates (unit_price × (1 + gst_rate/100))
User can type into gstPrice → unit_price back-calculated → amounts recalc
        │
        ▼
<tfoot> row shows column totals (Subtotal | CGST+SGST / IGST | Grand Total)
        │
        ▼
Summary bar (bottom) shows Lines | Qty | Subtotal | Tax | Total
        │
        ▼
[Target Amount input] user types target → clicks "Back Calculate"
  → all unit_prices scaled by (target / currentGrandTotal)
  → amounts recalculate → tallied indicator shows when match
```

---

## Step 1 — `sales-invoice-schema.ts` — no changes needed

`gstPrice` is a derived/computed value (not persisted). The schema stays as-is.

---

## Step 2 — `new-sales-invoice.tsx` — GST Price column

### 2a. Add helper `calcGstPrice`

Add after `calcLine`:

```ts
function calcGstPrice(unitPrice: number, gstRate: number): number {
    return unitPrice * (1 + gstRate / 100);
}
```

### 2b. Add the column header (only when `isGstMode && isIgst === false || isGstMode`)

In `<thead>`, after the "Price" column and before "Subtotal", add:

```tsx
{isGstMode && (
    <th className={`${thClass} text-right`} style={{ width: "9%" }}>
        GST Price <span className="text-red-500 ml-0.5">*</span>
    </th>
)}
```

Column is only shown when `isGstMode` is true (division has GSTIN). In non-GST mode the
column is hidden entirely.

### 2c. Add the editable cell in each row

After the "Price" `<Input>` `<td>`, add:

```tsx
{isGstMode && (
    <td className={tdClass}>
        <Input
            className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-medium text-(--cl-accent)`}
            min={0}
            step="0.01"
            type="number"
            value={calcGstPrice(line.unit_price, line.gst_rate).toFixed(2)}
            onChange={e => {
                const gstPriceVal = Number(e.target.value);
                const divisor = 1 + (line.gst_rate / 100);
                const backCalcUnitPrice = divisor > 0 ? gstPriceVal / divisor : gstPriceVal;
                updateLine(idx, { unit_price: Math.round(backCalcUnitPrice * 100) / 100 });
            }}
            onFocus={e => e.target.select()}
        />
    </td>
)}
```

Typing a new GST-inclusive price back-calculates `unit_price` via
`unit_price = gstPrice / (1 + gstRate/100)` before calling `updateLine` which
triggers the full `calcLine` recalculation.

---

## Step 3 — `new-sales-invoice.tsx` — Table footer (`<tfoot>`) totals row

Add `<tfoot>` inside `<table>` after `<tbody>`:

```tsx
<tfoot>
    <tr className="bg-(--cl-surface-2)/60 font-semibold">
        <td className="p-0.5 border-t border-(--cl-border)" />
        <td className="p-0.5 border-t border-(--cl-border)" colSpan={isGstMode ? 2 : 1} />
        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 text-xs text-(--cl-text-muted)">
            Total
        </td>
        {isGstMode && <td className="p-0.5 border-t border-(--cl-border)" />}
        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-sm text-(--cl-text)">
            {formatNumber(totals.qty)}
        </td>
        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-sm text-(--cl-text)">
            {formatNumber(totals.aggregate)}
        </td>
        <td className="p-0.5 border-t border-(--cl-border)" />
        {!isIgst ? (
            <>
                <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-sm text-(--cl-text)">
                    {formatNumber(totals.cgst)}
                </td>
                <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-sm text-(--cl-text)">
                    {formatNumber(totals.sgst)}
                </td>
            </>
        ) : (
            <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-sm text-(--cl-text)">
                {formatNumber(totals.igst)}
            </td>
        )}
        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono font-bold tabular-nums text-sm text-(--cl-accent)">
            {formatNumber(totals.total)}
        </td>
        <td className="p-0.5 border-t border-(--cl-border)" />
        <td className="p-0.5 border-t border-(--cl-border)" />
    </tr>
</tfoot>
```

The `totals` object already exists in the component (`useMemo`). Expose the
`cgst`, `sgst`, `igst` fields on it (they already exist as `totals.cgst`,
`totals.sgst`, `totals.igst` from the existing `useMemo`).

---

## Step 4 — `new-sales-invoice.tsx` — Target Amount + Back Calculate in summary bar

### 4a. Add `backCalcTarget` state

```ts
const [backCalcTarget, setBackCalcTarget] = useState("");
```

### 4b. Add `computeBackCalcLines` helper

```ts
function computeBackCalcLines(
    currentLines: SalesLineFormItem[],
    targetTotal: number,
    isIgst: boolean,
): SalesLineFormItem[] {
    const currentTotal = currentLines.reduce((s, l) => {
        const c = calcLine(l, isIgst);
        return s + c.total;
    }, 0);
    if (currentTotal <= 0 || Math.abs(targetTotal - currentTotal) < 0.005) return currentLines;
    const scaleFactor = targetTotal / currentTotal;
    return currentLines.map(l => {
        const newUnitPrice = Math.round(l.unit_price * scaleFactor * 100) / 100;
        const c = calcLine({ ...l, unit_price: newUnitPrice }, isIgst);
        return {
            ...l,
            unit_price: newUnitPrice,
            aggregate_amount: c.aggregate,
            cgst_amount: c.cgstAmt,
            sgst_amount: c.sgstAmt,
            igst_amount: c.igstAmt,
            total_amount: c.total,
        };
    });
}
```

### 4c. Update the summary bar

In the existing summary `<div ref={summaryRef} ...>`, before the existing items, prepend the
Target Amount section. The summary bar already wraps with `flex flex-wrap items-center`:

```tsx
{/* Target Amount section — left side of summary bar */}
<div className="flex items-center gap-2 mr-auto">
    {(() => {
        const backCalcNum = parseFloat(backCalcTarget);
        const isTallied = backCalcTarget !== "" && !isNaN(backCalcNum)
            && Math.abs(totals.total - backCalcNum) < 0.005;
        return (
            <>
                {isTallied && (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Tallied
                    </span>
                )}
                <Input
                    className="h-7 w-36 text-right text-sm font-bold border-(--cl-border) bg-white"
                    min="0"
                    step="0.01"
                    type="number"
                    placeholder="Target amount…"
                    value={backCalcTarget}
                    onChange={e => setBackCalcTarget(e.target.value)}
                    onFocus={e => e.target.select()}
                />
                <Button
                    className="h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!backCalcTarget || isNaN(backCalcNum) || backCalcNum <= 0}
                    size="sm"
                    onClick={() => {
                        const scaledLines = computeBackCalcLines(
                            form.getValues("lines") ?? [],
                            backCalcNum,
                            isIgst,
                        );
                        form.setValue("lines", scaledLines);
                    }}
                >
                    Back Calculate
                </Button>
                {backCalcTarget && (
                    <Button
                        className="h-7 text-xs"
                        size="sm"
                        variant="outline"
                        onClick={() => setBackCalcTarget("")}
                    >
                        Clear
                    </Button>
                )}
            </>
        );
    })()}
</div>
```

Import `CheckCircle2` from `lucide-react` (already used in `sales-entry-section.tsx`; add it
to `new-sales-invoice.tsx` imports).

---

## Step 5 — `sales-entry-section.tsx` — no logic changes needed

The existing code already:
- Sets `isIgst` automatically when `customerStateCode` differs from `effectiveGstStateCode` ✅
- Auto-populates state, GSTIN, mobile, address from customer `onSelect` ✅
- Reads `isGstMode` from `selectIsGstMode` = `!!currentDivision?.gstin` (division-aware) ✅
- Supports edit mode — fetches detail and resets form via `useEffect` on `editInvoice` ✅

Minor enhancement: pass `isGstMode` down as a prop to `NewSalesInvoice` so the component
doesn't need to re-read the selector internally. Currently both the parent and child read it
independently — unify by passing it as a prop from `sales-entry-section.tsx`:

```tsx
// sales-entry-section.tsx
<NewSalesInvoice
    ...
    isGstMode={isGstMode}
    ...
/>
```

Remove the `useAppSelector(selectIsGstMode)` call from `new-sales-invoice.tsx` and instead
add `isGstMode: boolean` to the `Props` type.

---

## Verification Checklist

- [ ] **GST mode**: Select a GST-registered division → "GST Price" column appears; change price → unit_price back-calculates; subtotal and tax update immediately.
- [ ] **Non-GST mode**: Select a non-GST division → "GST Price" column is hidden.
- [ ] **IGST auto-detect**: Select a customer from a different state → IGST checkbox auto-checks; amounts switch to IGST.
- [ ] **CGST/SGST**: Select a customer from same state → CGST+SGST columns show; amounts correct.
- [ ] **Footer totals**: Add multiple line items; `<tfoot>` row shows correct column sums for Qty, Subtotal, CGST, SGST/IGST, Total.
- [ ] **Target Amount**: Enter a target → click "Back Calculate" → all unit_prices scale proportionally; grand total matches target; "Tallied" badge appears.
- [ ] **Clear Target**: Click "Clear" → `backCalcTarget` resets, tallied badge disappears.
- [ ] **Edit mode**: Open an existing invoice for edit → all fields populate correctly; target amount back-calc works the same way.
- [ ] **Non-GST invoice**: GST rate 0, amounts correct, no GST price column.
- [ ] `pnpm build` / `tsc` passes with no type errors.
