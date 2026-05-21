# Plan: Final-a-Job — Price Calculation & Calculate Method

## Overview

Modify `final-a-job-section.tsx` to:
1. Apply correct GST/Non-GST pricing logic when a part is selected (sourcing `cost_price` and `gst_rate` from `spare_part_master`)
2. Introduce a central `calculateLinePricing` helper that is called on every pricing input change, keeping all derived fields (`sale_pr_gst`, `gst_rate`) consistent
3. Re-run `calculateLinePricing` on every part line when the division changes

---

## Sale Price Determination (Markup Logic)

Sale price is always derived from cost price via one of two routes:

1. **If `spare_part_master.selling_price` is set and > 0** → use it directly as `sale_price`
2. **Otherwise** → `sale_price = Math.round(cost_price × (1 + markupPct / 100) × 100) / 100`

where `markupPct` is the value of setting key `markup_percent_over_cost` (from `all_setting`, fetched via `GET_APP_SETTING_BY_KEY`).

This is the same pattern already used in `job-charges-modal.tsx`:
```ts
function applyMarkup(cost: number, pct: number): number {
    return Math.round(cost * (1 + pct / 100) * 100) / 100;
}
const masterSelling = (part.selling_price != null && part.selling_price > 0) ? part.selling_price : null;
const sale_price    = masterSelling ?? applyMarkup(cost, markupPct);
```

---

## New Pure Helper Functions (outside component)

### `applyMarkup(cost, markupPct)`
```ts
Math.round(cost * (1 + markupPct / 100) * 100) / 100
```

### `computePartPricesOnSelect(part, isGst, forceGstOnPartsForNonGst, defaultGstRate, markupPct)`

Called when a part is picked from the part-code lookup.

```
rawCost          = part.cost_price ?? 0
masterSelling    = part.selling_price > 0 ? part.selling_price : null
effectiveGstRate = (part.gst_rate > 0) ? part.gst_rate : defaultGstRate

Non-GST division:
  gst_rate  = 0  (always)
  if forceGstOnPartsForNonGst:
    cost_price    = rawCost × (1 + effectiveGstRate / 100)
    markupAmt     = masterSelling != null
                      ? masterSelling - rawCost          ← preserve original markup amount
                      : rawCost × markupPct / 100        ← markup on raw cost
    selling_price = cost_price + markupAmt
  else:
    cost_price    = rawCost
    selling_price = masterSelling ?? applyMarkup(rawCost, markupPct)
  sale_pr_gst = selling_price   (gst_rate=0, so no GST uplift)

GST division:
  gst_rate      = effectiveGstRate
  cost_price    = rawCost
  selling_price = masterSelling ?? applyMarkup(rawCost, markupPct)
  sale_pr_gst   = selling_price × (1 + effectiveGstRate / 100)
```

### `calculateLinePricing(line, patch, isGst)`

Central "calculate" method. Given a line + a partial user-input patch, computes the consistent set of pricing fields to store.

- Derives `selling_price` and `gst_rate` from `{ ...line, ...patch }`
- Forces `gst_rate = 0` for non-GST divisions
- Returns `{ ...patch, gst_rate, sale_pr_gst }` where `sale_pr_gst = selling_price × (1 + gst_rate/100)`

The **one exception**: when the user edits `sale_pr_gst` directly, `selling_price` is **back-calculated** first (`selling_price = sale_pr_gst / (1 + gst_rate/100)`), then both fields are stored. This ensures bidirectional consistency.

---

## Component Changes

### 1. Selectors
Add alongside existing selectors:
```ts
const forceGstOnPartsForNonGst = useAppSelector(selectForceGstOnPartsForNonGst);
```

### 2. New state: `markupPct`
```ts
const [markupPct, setMarkupPct] = useState(0);
```

Loaded inside the existing `fetchMeta` effect (alongside brands + JOB_CONSUME type), using `GET_APP_SETTING_BY_KEY` with `setting_key: "markup_percent_over_cost"` — same as `job-charges-modal.tsx`.

### 3. Derived `division` + `isGst` in component body
Move out of the conditional render block so handlers can access them:

```ts
const division = availableDivisions.find(d => d.id === selectedDivisionId) ?? null;
const isGst    = isGstDivision(division);
```

Remove the duplicate lines from the render section.

### 4. `handlePartSelect`
Replace direct field copy with `computePartPricesOnSelect`:

```ts
const pricePatch = computePartPricesOnSelect(part, isGst, forceGstOnPartsForNonGst, defaultGstRate, markupPct);
updatePartLine(key, { part_id, part_code, part_name, brand_id, ...pricePatch });
```

### 5. `addPartLine`
Pass `isGst ? defaultGstRate : 0` so new empty lines start with the correct GST rate.

### 6. `handleChangeDivision`
After saving the new division to DB and refreshing the job, recalculate all part lines:

```ts
const newDivision = availableDivisions.find(d => d.id === newDivisionId) ?? null;
const newIsGst    = isGstDivision(newDivision);
setPartLines(prev => prev.map(line => ({ ...line, ...calculateLinePricing(line, {}, newIsGst) })));
```

### 7. Pricing input `onChange` handlers
Replace inline calculations with calls to `calculateLinePricing`:

| Input            | After                                                                                     |
|-----------------|-------------------------------------------------------------------------------------------|
| `gst_rate`      | `updatePartLine(key, calculateLinePricing(line, { gst_rate }, isGst))`                   |
| `selling_price` | `updatePartLine(key, calculateLinePricing(line, { selling_price }, isGst))`              |
| `sale_pr_gst`   | back-calc `selling_price = spgst/(1+gst/100)`, then `updatePartLine(key, { sale_pr_gst, selling_price })` |
| `cost_price`    | direct `updatePartLine` — no pricing recalc (cost doesn't affect sale_pr_gst)            |

---

## Files Modified

- `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx`
