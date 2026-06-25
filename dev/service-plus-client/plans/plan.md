# Plan: Job Finalization Cost/Selling-Price Computation (tran.md)

## What tran.md Specifies

Covers how `cost_price`, `selling_price`, `gst_rate`, and `hsn_code` are computed and stored in
`job_part_used` during finalization. Applies to:

1. **"Parts & Charges" screens** (Job Pipeline — `job-charges-modal.tsx`, `new-part-used-form.tsx`)
2. **"Final a Job > Final" form** (`final-a-job-section.tsx` + `final-job-form.tsx`)

### Rules summary

| Context | Condition | cost_price | selling_price | gst_rate stored | sale_pr_gst |
|---|---|---|---|---|---|
| Parts & Charges — new part selected | any division | `dbcp` | `dbsp` or `dbcp*(1+markup/100)` | master rate always | `selling * (1+rate/100)` if GST, else `selling` |
| Parts & Charges — existing row in job_part_used | any division | stored value | stored value | stored value | recompute from stored values |
| Final a Job — existing row in job_part_used | isGst | stored values as-is | stored values as-is | stored | `selling*(1+rate/100)` |
| Final a Job — existing row in job_part_used | !isGst | stored values as-is | stored values as-is | stored | `selling` (no GST added) |
| Final a Job — new part added | isGst | `dbcp` | `dbsp`/markup | master rate | `selling*(1+rate/100)` |
| Final a Job — new part added | !isGst | `dbcp*(1+rate/100)` | `dbsp`/markup | master rate | `selling` |
| Reset (Final a Job only) | any | recalculate from master | recalculate from master | master rate | as above per isGst |
| Division change (Final a Job only) | any | recalculate from master | recalculate from master | master rate | as above per isGst |

- `gst_rate` in DB: **always store master rate**, regardless of GST/non-GST division
- `hsn_code`: store from master (fallback: `default_hsn_for_spare_part`), regardless of division
- **Remove `force_gst_on_parts_for_non_gst_invoices`** and all associated logic
- Target amount: `job.amount` if > 0, else computed grand total (first non-zero)

---

## Files Affected

### Client

| File | Nature of Change |
|---|---|
| `src/store/context-slice.ts` | Remove `forceGstOnPartsForNonGst` state, action, selector |
| `src/features/admin/components/bu-branch-switcher.tsx` | Remove setting load + dispatch for `force_gst_on_parts_for_non_gst_invoices` |
| `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx` | Rework `computePartPricesOnSelect`, loading, reset, division-change, target seeding |
| `src/features/client/components/jobs/final-a-job/final-job-form.tsx` | Fix amount formula for non-GST (use `selling_price * qty` not `sale_pr_gst * qty`) |
| `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx` | Remove `forceGstOnPartsForNonGst` usage (see note below) |
| `src/features/client/components/help/help-content.ts` | Remove mention of `force_gst_on_parts_for_non_gst_invoices` |
| `src/features/client/components/jobs/job-pipeline/job-charges-modal.tsx` | Verify Parts & Charges cost logic (no inflation, store master rate) |
| `src/features/client/components/jobs/part-used/new-part-used-form.tsx` | Verify existing-row loading (use stored values, not recomputed) |

### Server

| File | Change |
|---|---|
| `app/db/sql_bu.py` | Remove seed row for `force_gst_on_parts_for_non_gst_invoices` from `app_setting` INSERT if present |
| DB migration | `DELETE FROM app_setting WHERE setting_key = 'force_gst_on_parts_for_non_gst_invoices'` on all client schemas |

> **Note on `new-sales-invoice.tsx`**: tran.md only covers job finalization, but the plan includes this file because the setting is removed globally. The inflation logic for sales (`unit_price = costPrice * 1.18` when non-GST) uses a hardcoded 18% and is semantically different (it inflates the *selling price to customer*, not the cost). Removing the flag reverts non-GST sales to use raw `costPrice` as the unit price. Decision on whether non-GST sales should also apply GST-inclusive pricing is outside scope of tran.md and should be confirmed separately.

---

## Deviations from Current Code

### D1 — `gst_rate` stored as 0 for non-GST (wrong)

**Current** (`computePartPricesOnSelect`, line 109):
```typescript
const displayGstRate = isGst ? effectiveGstRate : 0;
return { gst_rate: String(displayGstRate), ... };  // stores 0 for non-GST
```

**Required**: Always store the master rate.
```typescript
return { gst_rate: String(effectiveGstRate), ... };  // always master rate
```

Side effect: the save-to-DB code also zeros out gst_rate for non-GST:
```typescript
// handleSaveFinal, line ~715 / ~731
gst_rate: (isGst && !isWarrantyJob) ? parseFloat(l.gst_rate) : 0,
```
This also must change to `parseFloat(l.gst_rate) || 0` (always save master rate).

---

### D2 — `sale_pr_gst` computed without respecting `isGst` in loading code (wrong)

**Current** (`handleOpenFinal`, lines 353–364):
```typescript
const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
sale_pr_gst: ((p.selling_price ?? 0) * (1 + gr / 100)).toFixed(2),
```
If `gr = 18` and non-GST: `sale_pr_gst = selling * 1.18` → totals inflated. Wrong.

**Required**: Multiply by `(1 + (isGst ? gr : 0) / 100)`. Need `isGst` computed inline from `row.division_id` during the load (before state is set).

---

### D3 — Non-GST new part cost inflation controlled by removed setting (wrong)

**Current** (`computePartPricesOnSelect`):
```typescript
if (!isGst && forceGstOnPartsForNonGst) {
    cp = dbcp > 0 ? dbcp * (1 + effectiveGstRate / 100) : currentCostPrice;
} else {
    cp = ccp;
}
```
Inflation is optional, controlled by `force_gst_on_parts_for_non_gst_invoices`.

**Required**: For non-GST new parts in Final a Job, always inflate:
```typescript
if (!isGst) {
    cp = dbcp > 0 ? dbcp * (1 + effectiveGstRate / 100) : currentCostPrice;
} else {
    cp = ccp;
}
```
The function must know whether to inflate. Since Parts & Charges should NOT inflate, the caller must pass `inflateCostForNonGst: boolean`:
- `final-a-job-section.tsx` calls with `inflateCostForNonGst = !isGst`
- `job-charges-modal.tsx` and `new-part-used-form.tsx` callers use `inflateCostForNonGst = false`

---

### D4 — `sale_pr_gst` in form amount uses `gst_rate` without `isGst` guard (wrong)

**Current** (`final-job-form.tsx`, lines 402–404):
```typescript
const gstRate = parseFloat(line.gst_rate) || 0;
const saleAmt = isWarranty ? 0 : (parseFloat(line.selling_price) || 0) * line.qty * (1 + gstRate / 100);
```
If `gst_rate` now stores the master rate (e.g., 18) for non-GST, `saleAmt = selling * 1.18 * qty`. Wrong.

**Required**:
```typescript
const gstRate = (isGst && !isWarranty) ? (parseFloat(line.gst_rate) || 0) : 0;
const saleAmt = (parseFloat(line.sale_pr_gst) || 0) * line.qty;
// sale_pr_gst is already correctly computed as selling*(1+rate/100) or selling*1 depending on isGst
```
Or simpler: rely on `line.sale_pr_gst` (which is set correctly) for the amount display.

Also affects the grand summary totals (`partsTotal`, `partsGstTotal`, etc.) in `final-job-form.tsx` — the formulae must use `isGst` guard where they currently use `line.gst_rate` directly.

---

### D5 — `force_gst_on_parts_for_non_gst_invoices` present in Redux and loaded on branch switch

**Current** (`context-slice.ts`):
- `forceGstOnPartsForNonGst: boolean` in state (line 41)
- `setForceGstOnPartsForNonGst` action (line 141)
- `selectForceGstOnPartsForNonGst` selector (line 194)

**Current** (`bu-branch-switcher.tsx`):
- Reads `force_gst_on_parts_for_non_gst_invoices` from app_settings API response (line 76)
- Dispatches `setForceGstOnPartsForNonGst` (line 186)

**Required**: Remove all of the above entirely.

---

### D6 — Target amount not seeded with computed total as fallback

**Current** (`handleOpenFinal`, line 349):
```typescript
if (job.amount) setBackCalcTarget(String(job.amount));
```
If `job.amount` is 0 or null, `backCalcTarget` stays `""`. The form's "Total" panel then computes the effective total from `job.amount` (0) or `grandTotal`. But the target input itself is blank.

**Required**: Target = `job.amount` if > 0, else `grandTotal` (computed from loaded parts + charges).

Since `partLines`/`chargeLines` are set via `setPartLines`/`setChargeLines` in the same call, the grand total must be computed inline during `handleOpenFinal` before dispatching state:
```typescript
const computedTotal = parts.reduce((s, p) => s + salePrGst(p, isGst) * p.qty, 0)
                    + charges.reduce((s, c) => s + salePrGst(c, isGst) * c.qty, 0);
const seedTarget = (job.amount && job.amount > 0) ? job.amount : computedTotal;
setBackCalcTarget(seedTarget > 0 ? String(seedTarget) : "");
```

---

### D7 — Division change zeros out `gst_rate` and applies setting-controlled inflation

**Current** (`handleDivisionChange`):
- Calls `computePartPricesOnSelect(syntheticPart, newIsGst, forceGstOnPartsForNonGst, ...)`
- For new non-GST division: stores gst_rate=0, inflates cost only if flag is on

**Required**:
- Store master gst_rate always
- Inflate cost = dbcp*(1+rate/100) always for non-GST (no flag)
- `sale_pr_gst` = `selling` (no GST) for non-GST

---

### D8 — Reset logic also affected by same inflation flag

**Current** (`handleReset`):
- Calls `computePartPricesOnSelect(syntheticPart, isGst, forceGstOnPartsForNonGst, ...)`

**Required**: Same as D3 — call with `inflateCostForNonGst = !isGst`, no flag.

---

## Implementation Steps

### Step 1 — Remove `force_gst_on_parts_for_non_gst_invoices` from Redux state

File: `src/store/context-slice.ts`
- Remove `forceGstOnPartsForNonGst` from `ContextState` interface
- Remove initial value in `initialState`
- Remove `setForceGstOnPartsForNonGst` reducer
- Remove from `export const { ... }`
- Remove `selectForceGstOnPartsForNonGst` export

---

### Step 2 — Remove setting load from `bu-branch-switcher.tsx`

File: `src/features/admin/components/bu-branch-switcher.tsx`
- Remove `setForceGstOnPartsForNonGst` import
- Remove `rawForce` / `forceGst` variable reads (lines 76, 84)
- Remove `forceGst` from the parsed settings object
- Remove `dispatch(setForceGstOnPartsForNonGst(...))` dispatch

---

### Step 3 — Rework `computePartPricesOnSelect` in `final-a-job-section.tsx`

Replace signature:
```typescript
// BEFORE
function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    forceGstOnPartsForNonGst: boolean,  // ← remove
    defaultGstRate: number,
    markupPct: number,
    currentCostPrice = 0,
    currentSellingPrice = 0,
)

// AFTER
function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    inflateCostForNonGst: boolean,       // ← new: true in Final a Job for !isGst
    defaultGstRate: number,
    markupPct: number,
    currentCostPrice = 0,
    currentSellingPrice = 0,
)
```

Internal logic changes:
```typescript
const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;

// Cost price: inflate for non-GST only when caller says so
let cp: number;
if (!isGst && inflateCostForNonGst) {
    cp = dbcp > 0 ? dbcp * (1 + effectiveGstRate / 100) : currentCostPrice;
} else {
    cp = dbcp > 0 ? dbcp : currentCostPrice;
}

const sp = currentSellingPrice > 0 ? currentSellingPrice : applyMarkup(cp, markupPct);

// CHANGE: always store master rate, not displayGstRate
// CHANGE: sale_pr_gst = selling*(1+rate/100) if isGst, else selling
const storedGstRate = effectiveGstRate;                        // always master rate
const salePrGst = isGst ? sp * (1 + effectiveGstRate / 100) : sp;

return {
    cost_price:    cp.toFixed(2),
    selling_price: sp.toFixed(2),
    gst_rate:      String(storedGstRate),   // was: displayGstRate (0 for non-GST)
    sale_pr_gst:   salePrGst.toFixed(2),
};
```

Update all three call sites:
- `handlePartSelect`: `inflateCostForNonGst = !isGst`
- `handleReset`: `inflateCostForNonGst = !isGst`
- `handleDivisionChange`: `inflateCostForNonGst = !newIsGst`

Remove import of `selectForceGstOnPartsForNonGst` and the variable `forceGstOnPartsForNonGst`.

---

### Step 4 — Fix loading of existing parts in `handleOpenFinal`

Compute `isGst` inline from `row.division_id` (before state is set):
```typescript
const loadedDivision = availableDivisions.find(d => d.id === row.division_id) ?? null;
const loadedIsGst = isGstDivision(loadedDivision);
```

In the `parts.map(...)` block:
```typescript
const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
const spg = loadedIsGst
    ? (p.selling_price ?? 0) * (1 + gr / 100)
    : (p.selling_price ?? 0);
return {
    ...
    gst_rate:    String(gr),          // always master rate
    sale_pr_gst: spg.toFixed(2),      // respects isGst
    ...
};
```

---

### Step 5 — Fix save-to-DB: always save master `gst_rate`

In `handleSaveFinal` (~lines 715, 731, 742):
```typescript
// BEFORE
gst_rate: (isGst && !isWarrantyJob) ? (parseFloat(l.gst_rate) || 0) : 0,

// AFTER
gst_rate: !isWarrantyJob ? (parseFloat(l.gst_rate) || 0) : 0,
// (warranty jobs: 0 is correct — no taxable sale)
```

---

### Step 6 — Fix amount computation in `final-job-form.tsx`

The per-row `saleAmt` and the section totals in `final-job-form.tsx` must not apply `gst_rate` when `!isGst`.

**Per-row amount** (line ~404):
```typescript
// BEFORE
const saleAmt = isWarranty ? 0 : (parseFloat(line.selling_price) || 0) * line.qty * (1 + gstRate / 100);

// AFTER — rely on sale_pr_gst which is already correctly computed
const saleAmt = isWarranty ? 0 : (parseFloat(line.sale_pr_gst) || 0) * line.qty;
```

**Parts totals** (`partsGstTotal`, `partsTotal`):
```typescript
// partsGstTotal is already guarded by isGst — check unchanged ✓
// partsTotal uses sale_pr_gst — already correct if sale_pr_gst is right ✓
```

No formula changes needed in the totals block IF `sale_pr_gst` is correctly computed in Step 3/4.

---

### Step 7 — Fix target amount seeding in `handleOpenFinal`

After computing `partLines` and `chargeLines` data inline, compute `computedTotal`:
```typescript
const computedTotal = parts.reduce((s, p) => {
    const gr = (p.gst_rate ?? 0) > 0 ? (p.gst_rate ?? 0) : defaultGstRate;
    const sp = p.selling_price ?? 0;
    const spg = loadedIsGst ? sp * (1 + gr / 100) : sp;
    return s + spg * Number(p.qty);
}, 0) + charges.reduce((s, c) => {
    const spg = loadedIsGst
        ? (c.selling_price ?? 0) * (1 + (c.gst_rate ?? 0) / 100)
        : (c.selling_price ?? 0);
    return s + spg * Number(c.qty);
}, 0);

const seedTarget = (job.amount && Number(job.amount) > 0)
    ? Number(job.amount)
    : computedTotal;
setBackCalcTarget(seedTarget > 0 ? String(seedTarget) : "");
```

---

### Step 8 — Verify `job-charges-modal.tsx` (Parts & Charges in Job Pipeline)

Check that `onSelect` for `PartCodeInput` in `job-charges-modal.tsx`:
- Sets `cost_price = part.cost_price ?? 0` (no inflation) ✓
- Sets `gst_rate = master rate` (using defaultGstRate fallback) ✓
- Does NOT reference `forceGstOnPartsForNonGst`

If the modal references the removed selector, remove those references and confirm cost = dbcp.

---

### Step 9 — Verify/Fix `new-part-used-form.tsx` (Parts & Charges in Job Pipeline)

From current code (lines 183–194), when a NEW part is selected:
- `cost_price = part.cost_price` (no inflation) ✓
- `gst_rate = master rate` (with defaultGstRate fallback) ✓

For EXISTING parts loaded from `job_part_used`:
- Verify that when editing a row, the form displays the stored values (not recomputed from master)
- Line 210 (`setValue cost_price = cost`) recalculates from master on selection; this is acceptable for the Parts & Charges edit-then-re-select flow
- No change needed if the form only recomputes on explicit part re-selection

---

### Step 10 — Remove `force_gst_on_parts_for_non_gst_invoices` from Sales Entry

File: `src/features/client/components/inventory/sales-entry/new-sales-invoice.tsx`

Remove:
- Import of `selectForceGstOnPartsForNonGst`
- `const forceGstOnPartsForNonGst = useAppSelector(...)` (line 101)
- `const forceGstOnParts = !isGstMode && forceGstOnPartsForNonGst` (line 485)

Default behavior after removal (non-GST sales):
```typescript
// BEFORE
const unitPrice = isGstMode
    ? Number(part.mrp ?? costPrice)
    : forceGstOnParts
        ? Math.round(costPrice * 1.18 * 100) / 100
        : costPrice;

// AFTER (forceGstOnParts gone → always use raw costPrice for non-GST)
const unitPrice = isGstMode
    ? Number(part.mrp ?? costPrice)
    : costPrice;
```

> ⚠ This changes sales entry non-GST pricing: unit_price was previously inflated by 18% (hardcoded) for non-GST sales. After change, raw cost_price is used. **Confirm with user whether non-GST sales should also apply GST-inclusive pricing going forward.**

---

### Step 11 — Update help content

File: `src/features/client/components/help/help-content.ts`
- Remove the entry for `force_gst_on_parts_for_non_gst_invoices` from the App Settings table (line 740)
- Remove the corresponding FAQ entry (line 746)

---

### Step 12 — DB migration: remove the app_setting row

The row is not in the server seed (`sql_bu.py`) but may exist in client databases. Add a migration step:

```sql
DELETE FROM app_setting WHERE setting_key = 'force_gst_on_parts_for_non_gst_invoices';
```

Run on all client schemas (or include in the schema migration routine).

---

## Open Questions

1. **Sales Entry non-GST pricing** (Step 10): Should `unit_price` in non-GST direct sales also be GST-inclusive (`dbcp * 1.18`)? tran.md is silent on sales entry. The old behaviour used a hardcoded 18% (not the part's own rate) which was already incorrect. Confirm intended behaviour before implementing Step 10.

2. **Existing `job_part_used` rows with `gst_rate = 0`**: After this change, loading old non-GST finalized jobs will read `gst_rate = 0` from DB. `sale_pr_gst` will compute as `selling_price` (correct for display). But cost inflation on Reset will use `defaultGstRate` as fallback. This is acceptable (Reset always recalculates from master anyway).

3. **Warranty jobs**: `gst_rate` is set to 0 on save for warranty jobs (Step 5 preserves this). Verify this is still intended — warranty parts have no taxable sale so gst_rate = 0 is correct to store.
