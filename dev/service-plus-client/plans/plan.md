# Plan: Pricing Logic & Calculate Method — Final a Job

## Context

When a technician finalises a job, part prices must be computed correctly based on:
- Whether the division is GST or non-GST
- Whether `force_gst_on_parts_for_non_gst_invoices` is enabled
- The `gst_rate` from the spare part master (falling back to `default_gst_rate` when 0)

All derived fields (sale_pr_gst, aggregate, amount, profit, summaries) must stay in sync
whenever any input changes. A single `calculatePartLine()` helper encapsulates all this
logic; every onChange wires through it.

---

## Existing Infrastructure (no new code needed)

| Item | Location |
|------|----------|
| `selectDefaultGstRate` | `src/store/context-slice.ts:154` |
| `selectForceGstOnPartsForNonGst` | `src/store/context-slice.ts:155` |
| `PartRow.gst_rate` | `src/features/client/components/inventory/part-code-input.tsx:35` |
| Reference pricing logic | `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx:449–468` |

Both selectors are populated from app_settings by `bu-branch-switcher.tsx`.

---

## File to Modify

`src/features/client/components/jobs/final-a-job/final-a-job-section.tsx`

---

## Changes

### 1. Import `selectForceGstOnPartsForNonGst`

Add to the existing `selectAvailableDivisions, …` import line (context-slice).

### 2. Select the setting in the component body

```ts
const forceGstOnPartsForNonGst = useAppSelector(selectForceGstOnPartsForNonGst);
```

### 3. Derive `isGst` at component scope

Currently `isGst` is derived inside the `final` subview render block. Move it to component scope so `handlePartSelect` and `handleChangeDivision` can reference it.

```ts
const selectedDivision = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
const isGst            = isGstDivision(selectedDivision);
```

### 4. `calculatePartLine()` pure helper (add near `emptyPartLine`)

```ts
type CalcInput = {
    cost_price_raw:  number;   // raw cost from DB / user input
    selling_price:   number;   // sale price ex-GST
    gst_rate_master: number;   // gst_rate on the line (from DB or user)
    isGst:           boolean;
    defaultGstRate:  number;
    forceGstOnParts: boolean;  // = !isGst && forceGstOnPartsForNonGst
};

type CalcResult = Pick<EditablePartLine, 'cost_price' | 'selling_price' | 'gst_rate' | 'sale_pr_gst'>;

function calculatePartLine(input: CalcInput): CalcResult {
    const { cost_price_raw, selling_price, gst_rate_master,
            isGst, defaultGstRate, forceGstOnParts } = input;

    if (isGst) {
        const effectiveGst = gst_rate_master === 0 ? defaultGstRate : gst_rate_master;
        return {
            cost_price:    String(cost_price_raw),
            selling_price: String(selling_price),
            gst_rate:      String(effectiveGst),
            sale_pr_gst:   (selling_price * (1 + effectiveGst / 100)).toFixed(2),
        };
    } else {
        // Non-GST: gst_rate stored as 0 always
        const effectiveGst = gst_rate_master === 0 ? defaultGstRate : gst_rate_master;
        const costAdj = forceGstOnParts
            ? cost_price_raw * (1 + effectiveGst / 100)
            : cost_price_raw;
        const markup  = selling_price - cost_price_raw;  // preserve profit margin
        const saleAdj = costAdj + markup;
        return {
            cost_price:    costAdj.toFixed(2),
            selling_price: saleAdj.toFixed(2),
            gst_rate:      "0",
            sale_pr_gst:   saleAdj.toFixed(2),   // no GST on top for non-GST division
        };
    }
}
```

### 5. `handlePartSelect` — apply pricing on part selection

Replace the current simple field copy with a call to `calculatePartLine`:

```ts
function handlePartSelect(key: string, part: PartRow) {
    const costRaw  = Number(part.cost_price    ?? 0);
    const saleRaw  = Number(part.selling_price ?? 0);
    const result   = calculatePartLine({
        cost_price_raw:  costRaw,
        selling_price:   saleRaw,
        gst_rate_master: Number(part.gst_rate ?? 0),
        isGst,
        defaultGstRate,
        forceGstOnParts: !isGst && forceGstOnPartsForNonGst,
    });
    updatePartLine(key, {
        part_id:   part.id,
        part_code: part.part_code,
        part_name: part.part_name,
        brand_id:  part.brand_id,
        ...result,
    });
}
```

### 6. Recalculate on every pricing input change

Each pricing field onChange calls `calculatePartLine` and applies the full result:

| Field changed | `cost_price_raw` | `selling_price` | `gst_rate_master` | Notes |
|---|---|---|---|---|
| `cost_price` | new value | current `selling_price` | current `gst_rate` | straightforward |
| `selling_price` | current `cost_price` | new value | current `gst_rate` | straightforward |
| `gst_rate` | current `cost_price` | current `selling_price` | new value | straightforward |
| `sale_pr_gst` | current `cost_price` | back-calc: `spg / (1 + gst/100)` | current `gst_rate` | back-calc first |
| `quantity` | — | — | — | no recalc needed (qty doesn't affect prices) |

### 7. Recalculate on division change (`handleChangeDivision`)

After updating `selectedDivisionId`, re-run `calculatePartLine` over all `partLines`:

```ts
const newDiv    = availableDivisions.find(d => d.id === newDivisionId) ?? null;
const newIsGst  = isGstDivision(newDiv);
setPartLines(prev => prev.map(l => ({
    ...l,
    ...calculatePartLine({
        cost_price_raw:  parseFloat(l.cost_price)    || 0,
        selling_price:   parseFloat(l.selling_price) || 0,
        gst_rate_master: parseFloat(l.gst_rate)      || 0,
        isGst:           newIsGst,
        defaultGstRate,
        forceGstOnParts: !newIsGst && forceGstOnPartsForNonGst,
    }),
})));
```

---

## Verification

1. GST division + part with `gst_rate=18` → sale_pr_gst = selling_price × 1.18; CGST/SGST = aggregate × 9%.
2. GST division + part with `gst_rate=0` → effective rate = `default_gst_rate`; all derived fields use it.
3. Non-GST + `force_gst=false` → `gst_rate=0`, `sale_pr_gst = selling_price`, cost unchanged.
4. Non-GST + `force_gst=true` → `cost_price` baked with GST; `sale_price = new_cost + markup`; `gst_rate=0`.
5. Change division GST→Non-GST mid-flow → all part lines recalculate immediately.
6. Edit `sale_pr_gst` manually → `selling_price` back-calculates, all derived fields update.
7. Edit `cost_price` manually → `sale_pr_gst` updates; profit updates.
