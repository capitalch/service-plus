# Exhaustive Plan: Pricing & Calculate Refactor for "Final a Job"

Based on `plans/tran.md` requirements and the current codebase analysis.

---

## 1. Problem Summary

The current `final-a-job-section.tsx` has several gaps relative to the requirements:

| Gap | Current Behavior | Required Behavior |
|-----|-----------------|-------------------|
| Part selection | `gst_rate` from `spare_part_master` is **not** set on the part line when a part is selected via `PartCodeInput` (`handlePartSelect` only sets `cost_price`, `selling_price`, `part_code`, `part_name`, `brand_id`, `part_id`) | `gst_rate` from `spare_part_master` must also be populated |
| Effective GST rate | Uses whatever `gst_rate` is on the line; falls back to `defaultGstRate` only for new empty lines | `effective gst rate = spare_part_master.gst_rate` (if non-zero) OR `default_gst_rate` (if non-zero) |
| `force_gst_on_parts_for_non_gst_invoices` | **Never read** in final-a-job-section (selector not imported) | Must influence cost price calculation in non-GST mode |
| Non-GST `gst_rate` | Not locked to 0 in non-GST mode | GST rate must always be 0 in non-GST mode |
| Markup from cost | No markup logic exists in final-a-job-section | Sale price = cost price + markup (markup % from `markup_percent_over_cost` app setting) |
| Centralised calculate | Calculations are inline in render (lines 694-700) and scattered across onChange handlers (lines 809-870) | Single `calculateRow()` method handling all derived fields, called on any relevant input change |
| `sale_pr_gst` back-calculation | Back-calc is inline in one specific handler | When user edits `sale_pr_gst`: back-calc `selling_price` first, **then** fire the shared calculate method |

---

## 2. Files to Modify

| File | Change |
|------|--------|
| `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx` | **Primary — all logic changes and refactor** |
| `src/features/client/components/jobs/final-a-job/final-a-job-schema.ts` | Optional — add `effectiveGstRate` helper type if desired |

---

## 3. Step-by-Step Implementation

### Step 1: Add Missing Imports and Selectors

**File:** `final-a-job-section.tsx` (lines 20-21)

Add to the existing import from `@/store/context-slice`:
```typescript
import {
    selectAvailableDivisions, selectCurrentBranch, selectCurrentDivision,
    selectDefaultGstRate, selectForceGstOnPartsForNonGst, selectSchema
} from "@/store/context-slice";
```

Add new state variable for markup percentage (loaded from app settings alongside brands / stock transaction types in the meta-loading `useEffect`):
```typescript
const [markupPct, setMarkupPct] = useState(0);
```

Add Redux selector in component body:
```typescript
const forceGstOnNonGst = useAppSelector(selectForceGstOnPartsForNonGst);
```

### Step 2: Load `markup_percent_over_cost` App Setting

**File:** `final-a-job-section.tsx` — In the meta-loading `useEffect` (~line 223), add a third query alongside the existing brands + stock-transaction-types queries:

```typescript
const [brandsRes, txnRes, markupRes] = await Promise.all([
    // ... existing queries ...
    apolloClient.query<GenericQueryData<{ setting_value: unknown }>>({
        fetchPolicy: "network-only",
        query:       GRAPHQL_MAP.genericQuery,
        variables:   {
            db_name: dbName, schema,
            value: graphQlUtils.buildGenericQueryValue({
                sqlId: SQL_MAP.GET_APP_SETTING_BY_KEY,
                sqlArgs: { setting_key: "markup_percent_over_cost" },
            }),
        },
    }),
]);
// ... existing setBrands / setJobConsumeTypeId ...
setMarkupPct(Number(markupRes.data?.genericQuery?.[0]?.setting_value ?? 0));
```

**Note:** `SQL_MAP.GET_APP_SETTING_BY_KEY` already exists (confirmed in `job-charges-modal.tsx` line 125).

### Step 3: Implement `calculatePartLine()` — Centralised Per-Row Calculator

Create a new pure function **outside** the component (or as a `useCallback` if it needs Redux values):

```typescript
type CalculateInput = {
    cost_price:    string;
    selling_price: string;
    gst_rate:      string;
    quantity:      number;
    isGst:         boolean;
    forceGstOnNonGst: boolean;
    effectiveGstRate: number;  // pre-determined effective GST %
    markupPct:     number;
};

type CalculateOutput = {
    cost_price:    string;   // may be updated (in non-GST+force mode)
    selling_price: string;   // may be updated (markup applied)
    sale_pr_gst:   string;
    gst_rate:      string;
    aggregate:     number;
    amount:        number;
    cgst:          number;
    sgst:          number;
    igst:          number;
    profit:        number;
};

function calculatePartLine(input: CalculateInput): CalculateOutput {
    const { isGst, forceGstOnNonGst, effectiveGstRate, markupPct } = input;
    let cost    = parseFloat(input.cost_price) || 0;
    let sale    = parseFloat(input.selling_price) || 0;
    let gstRate = effectiveGstRate; // start with effective rate

    // --- Non-GST mode ---
    if (!isGst) {
        gstRate = 0;  // gst rate is always 0 in non-GST mode
        if (forceGstOnNonGst && effectiveGstRate > 0) {
            // cost price = cost * (1 + effectiveGstRate/100)
            cost = cost * (1 + effectiveGstRate / 100);
        }
        // sale price = cost price + markup
        sale = cost + (cost * markupPct / 100);
    }
    // --- GST mode ---
    else {
        // effectiveGstRate already accounts for:
        //   - spare_part_master.gst_rate if non-zero
        //   - otherwise default_gst_rate if non-zero
        //   - otherwise 0
        gstRate = effectiveGstRate;
        // For GST mode, sale price = cost price + markup (existing logic preserved)
        if (sale === 0 && cost > 0) {
            sale = cost + (cost * markupPct / 100);
        }
    }

    const qty      = input.quantity;
    const aggregate = sale * qty;
    const amount    = aggregate * (1 + gstRate / 100);
    const cgst      = aggregate * gstRate / 200;
    const sgst      = cgst;
    const igst      = aggregate * gstRate / 100;
    const profit    = (sale - cost) * qty;

    return {
        cost_price:    cost.toFixed(2),
        selling_price: sale.toFixed(2),
        sale_pr_gst:   (sale * (1 + gstRate / 100)).toFixed(2),
        gst_rate:      String(gstRate),
        aggregate,
        amount,
        cgst,
        sgst,
        igst,
        profit,
    };
}
```

### Step 4: Determine `effectiveGstRate` from Part Master

Create a helper that resolves the effective GST rate for a part:

```typescript
function resolveEffectiveGstRate(partMasterGstRate: number | null | undefined, defaultGstRate: number): number {
    // effective gst rate = gst_rate from spare_part_master OR default_gst_rate (whichever is non-zero)
    const masterRate = partMasterGstRate ?? 0;
    if (masterRate !== 0) return masterRate;
    if (defaultGstRate !== 0) return defaultGstRate;
    return 0;
}
```

This will be called:
- When a part is selected from `PartCodeInput` (pass `part.gst_rate` + `defaultGstRate`)
- When loading existing part lines from DB (pass the stored `gst_rate` + `defaultGstRate`)

### Step 5: Refactor `handlePartSelect` — Populate GST Rate + Run Calculate

**Current** (`handlePartSelect`):
```typescript
function handlePartSelect(key: string, part: PartRow) {
    updatePartLine(key, {
        part_id:       part.id,
        part_code:     part.part_code,
        part_name:     part.part_name,
        brand_id:      part.brand_id,
        cost_price:    String(part.cost_price ?? 0),
        selling_price: String(part.selling_price ?? 0),
    });
}
```

**New** — set `gst_rate` from part master and apply calculate:

```typescript
function handlePartSelect(key: string, part: PartRow) {
    const effectiveRate = resolveEffectiveGstRate(part.gst_rate, defaultGstRate);
    setPartLines(prev => prev.map(line => {
        if (line._key !== key) return line;
        const raw = {
            cost_price:    String(part.cost_price ?? 0),
            selling_price: String(part.selling_price ?? 0),
            gst_rate:      String(effectiveRate),
            quantity:      line.quantity,
        };
        const result = calculatePartLine({
            cost_price:    raw.cost_price,
            selling_price: raw.selling_price,
            gst_rate:      raw.gst_rate,
            quantity:      raw.quantity,
            isGst,
            forceGstOnNonGst,
            effectiveGstRate: effectiveRate,
            markupPct,
        });
        return {
            ...line,
            part_id:       part.id,
            part_code:     part.part_code,
            part_name:     part.part_name,
            brand_id:      part.brand_id,
            cost_price:    result.cost_price,
            selling_price: result.selling_price,
            sale_pr_gst:   result.sale_pr_gst,
            gst_rate:      result.gst_rate,
        };
    }));
}
```

### Step 6: Refactor Loading Existing Part Lines (Sub-View Open)

**Current** (inside `handleOpenFinal`, lines 328-342): maps `LoadedPartRow` to `EditablePartLine` with inline `sale_pr_gst` calculation.

**New** — apply `calculatePartLine` for each existing line:

```typescript
setPartLines(
    parts.length > 0
        ? parts.map(p => {
            const effectiveRate = resolveEffectiveGstRate(p.gst_rate, defaultGstRate);
            const result = calculatePartLine({
                cost_price:    String(p.cost_price ?? 0),
                selling_price: String(p.selling_price ?? 0),
                gst_rate:      String(effectiveRate),
                quantity:      Number(p.quantity),
                isGst,                       // note: isGst depends on division which is known at this point
                forceGstOnNonGst,
                effectiveGstRate: effectiveRate,
                markupPct,
            });
            return {
                _key:          crypto.randomUUID(),
                id:            p.id,
                brand_id:      p.brand_id,
                part_id:       p.part_id,
                part_code:     p.part_code,
                part_name:     p.part_name,
                cost_price:    result.cost_price,
                selling_price: result.selling_price,
                sale_pr_gst:   result.sale_pr_gst,
                gst_rate:      result.gst_rate,
                quantity:      Number(p.quantity),
                remarks:       p.remarks ?? "",
            };
        })
        : [],
);
```

### Step 7: Create the Centralised `runCalculate` Dispatcher

A function that runs `calculatePartLine` for **all** part lines and updates `partLines` state in one batch. This will be the single entry point for all user input changes:

```typescript
const runCalculate = useCallback((lines: EditablePartLine[], isGstMode: boolean, forceGst: boolean, defGstRate: number, markup: number) => {
    return lines.map(line => {
        const effectiveRate = resolveEffectiveGstRate(parseFloat(line.gst_rate) || 0, defGstRate);
        const result = calculatePartLine({
            cost_price:    line.cost_price,
            selling_price: line.selling_price,
            gst_rate:      line.gst_rate,
            quantity:      line.quantity,
            isGst:         isGstMode,
            forceGstOnNonGst: forceGst,
            effectiveGstRate: effectiveRate,
            markupPct:     markup,
        });
        return {
            ...line,
            cost_price:    result.cost_price,
            selling_price: result.selling_price,
            sale_pr_gst:   result.sale_pr_gst,
            gst_rate:      result.gst_rate,
        };
    });
}, []);
```

### Step 8: Refactor All onChange Handlers in the Pricing Row

**Current onChange handlers** (lines 809-870):

| Field | Current behavior | New behavior |
|-------|-----------------|--------------|
| `gst_rate` | Updates `gst_rate` + recalculates `sale_pr_gst` locally | Update `gst_rate` in the line, then call `runCalculate` on all lines |
| `selling_price` (Sale) | Updates `selling_price` + recalculates `sale_pr_gst` locally | Update `selling_price` in the line, then call `runCalculate` on all lines |
| `sale_pr_gst` (+GST) | Updates `sale_pr_gst` + back-calculates `selling_price` locally | Back-calc `selling_price` from `sale_pr_gst`, then call `runCalculate` on all lines |
| `cost_price` | Updates `cost_price` only (no calc side-effect) | Update `cost_price`, then call `runCalculate` on all lines |
| `quantity` | Updates `quantity` only (no calc side-effect) | Update `quantity`, then call `runCalculate` on all lines |

### Step 9: Refactor Division Change Handler

**Current** (`handleChangeDivision`, line 374): Only updates the DB + refreshes job detail + sets `selectedDivisionId`.

**New** — after setting `selectedDivisionId`, also re-run `runCalculate` on all part lines since GST/Non-GST mode may have changed:

```typescript
async function handleChangeDivision(newDivisionId: number) {
    // ... existing DB update + job refresh ...
    setSelectedDivisionId(newDivisionId);
    // Recalculate all part lines with the new division's GST mode
    const newDivision = availableDivisions.find(d => d.id === newDivisionId) ?? null;
    const isGstMode   = isGstDivision(newDivision);
    setPartLines(prev => runCalculate(prev, isGstMode, forceGstOnNonGst, defaultGstRate, markupPct));
    toast.success("Division updated.");
}
```

### Step 10: Remove Inline Calculations from Render

**Current** (lines 693-700): Each row's render computes `aggregate`, `gstRate`, `amount`, `cgst`, `sgst`, `igst`, `profit` inline.

**New** — These fields are now **pre-computed** in `calculatePartLine` and stored in the `EditablePartLine` state (or derived in a memoized map). The cleanest approach: compute a derived map per render using `useMemo`:

```typescript
const partCalculations = useMemo(() => {
    return partLines.map(line => {
        const effectiveRate = resolveEffectiveGstRate(parseFloat(line.gst_rate) || 0, defaultGstRate);
        return calculatePartLine({
            cost_price:    line.cost_price,
            selling_price: line.selling_price,
            gst_rate:      line.gst_rate,
            quantity:      line.quantity,
            isGst,
            forceGstOnNonGst,
            effectiveGstRate: effectiveRate,
            markupPct,
        });
    });
}, [partLines, isGst, forceGstOnNonGst, defaultGstRate, markupPct]);
```

Then in the render loop, instead of recomputing:
```typescript
{partLines.map((line, idx) => {
    const calc = partCalculations[idx];
    // use calc.aggregate, calc.amount, calc.cgst, calc.sgst, calc.igst, calc.profit
    // use line.cost_price, line.selling_price, line.sale_pr_gst, line.gst_rate
})}
```

**This eliminates duplicate calculation logic between state updates and render output.**

### Step 11: Handle Empty Part Line Creation

**Current** (`emptyPartLine(gstRate)` at line 397):
```typescript
function emptyPartLine(gstRate = 0): EditablePartLine {
    return { _key: crypto.randomUUID(), brand_id: null, part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0", gst_rate: String(gstRate), quantity: 1, remarks: "" };
}
```

**New** — apply `calculatePartLine` when creating:
```typescript
function emptyPartLine(): EditablePartLine {
    const effectiveRate = resolveEffectiveGstRate(null, defaultGstRate);
    const result = calculatePartLine({
        cost_price: "0", selling_price: "0", gst_rate: String(effectiveRate),
        quantity: 1, isGst, forceGstOnNonGst, effectiveGstRate: effectiveRate, markupPct,
    });
    return {
        _key: crypto.randomUUID(), brand_id: null, part_id: null,
        part_code: "", part_name: "", remarks: "",
        cost_price:    result.cost_price,
        selling_price: result.selling_price,
        sale_pr_gst:   result.sale_pr_gst,
        gst_rate:      result.gst_rate,
        quantity:      1,
    };
}
```

Then at the call site (`addPartLine`):
```typescript
function addPartLine() {
    setPartLines(prev => [...prev, emptyPartLine()]);
}
```

### Step 12: Refactor Totals Calculations

The existing totals (lines 547-551) currently recompute inline:
```typescript
const partsTotal = partLines.reduce((sum, l) => {
    const agg = (parseFloat(l.selling_price) || 0) * l.quantity;
    return sum + agg * (1 + (parseFloat(l.gst_rate) || 0) / 100);
}, 0);
const profitTotal = partLines.reduce((sum, l) =>
    sum + ((parseFloat(l.selling_price) || 0) - (parseFloat(l.cost_price) || 0)) * l.quantity, 0);
const chargesCostTotal = chargeLines.reduce((sum, c) => sum + (parseFloat(c.cost_price) || 0), 0);
const chargesSaleTotal = chargeLines.reduce((sum, c) => sum + (parseFloat(c.selling_price) || 0), 0);
const grandTotal = partsTotal + chargesSaleTotal;
```

**New** — use `partCalculations` (the memoised array from Step 10):
```typescript
const partsTotal       = partCalculations.reduce((sum, c) => sum + c.amount, 0);
const profitTotal      = partCalculations.reduce((sum, c) => sum + c.profit, 0);
```

The charge totals remain unchanged (charges aren't part of the GST/calculate scope per `tran.md`).

---

## 4. Reactivity Flow Diagram

```
User changes input field
        │
        ▼
 ┌──────────────────┐
 │ sale_pr_gst?     │──YES──► Back-calc selling_price
 └──────────────────┘         from sale_pr_gst
        │NO                         │
        ▼                           │
 ┌──────────────────┐               │
 │ Update the       │◄──────────────┘
 │ specific field   │   (or just the sale_pr_gst field)
 │ in the line      │
 └────────┬─────────┘
          │
          ▼
 ┌─────────────────────────────────────────────┐
 │ runCalculate(allLines, isGst, forceGst,     │
 │              defaultGstRate, markupPct)      │
 │                                             │
 │  For each line:                             │
 │  1. Resolve effectiveGstRate                │
 │  2. If !isGst → gstRate=0                   │
 │  3. If !isGst && force → cost*=1+rate/100   │
 │  4. sale = cost + cost*markupPct/100        │
 │     (in GST mode, preserve manual sale if   │
 │      user already entered one)              │
 │  5. Compute aggregate/amount/cgst/sgst/igst │
 │     /profit                                  │
 └────────┬────────────────────────────────────┘
          │
          ▼
 ┌─────────────────────────────────────────────┐
 │ setPartLines(updatedLines)                  │
 │                                             │
 │ → Triggers re-render                        │
 │ → useMemo recalculates partCalculations     │
 │ → Totals recomputed from partCalculations   │
 └─────────────────────────────────────────────┘
```

---

## 5. Division Change Flow

```
User clicks "Change Division"
        │
        ▼
 ┌──────────────────────────┐
 │ Open ChangeDivisionModal │
 └────────┬─────────────────┘
          │ User selects new division + Apply
          ▼
 ┌──────────────────────────────┐
 │ 1. Save new division_id to   │
 │    job table via genericUpdate│
 │ 2. Refresh job detail        │
 │ 3. Set selectedDivisionId    │
 │ 4. Run calculate on all      │
 │    part lines (isGst may     │
 │    have changed)             │
 └──────────────────────────────┘
```

---

## 6. Edge Cases & Validation

| Edge Case | Handling |
|-----------|----------|
| Part master `gst_rate` is 0 AND `default_gst_rate` is 0 | `effectiveGstRate = 0` (no GST) |
| Part master `gst_rate` is null | Treat as 0, fallback to `default_gst_rate` |
| `default_gst_rate` is 0 (not configured) | Fallback to 0 gst rate |
| Not in GST mode + `force_gst_on_parts_for_non_gst_invoices` is false | Cost = original cost from part master; sale = cost + markup; GST% = 0 |
| Not in GST mode + `force_gst_on_parts_for_non_gst_invoices` is true | Cost = cost × (1 + effectiveGstRate/100); sale = cost + markup; GST% = 0 |
| GST mode + gst_rate from part master is 0 | Use `default_gst_rate` for effective GST rate |
| `markupPct` is 0 (not configured) | Sale = cost (no markup) — preserves existing behavior |
| User manually edits selling price then switches division | `runCalculate` on division change may overwrite manual sale price in non-GST mode (since formula is `sale = cost + markup`); this is correct per requirements |
| Warranty jobs | All inputs are disabled; calculations remain display-only (no state changes) |

---

## 7. `EditablePartLine` Type Change (Optional)

If we want to avoid `useMemo` and instead store computed values directly in state, the `EditablePartLine` type can be extended with computed fields:

```typescript
type EditablePartLine = {
    _key:          string;
    id?:           number;
    brand_id:      number | null;
    part_id:       number | null;
    part_code:     string;
    part_name:     string;
    cost_price:    string;
    selling_price: string;
    sale_pr_gst:   string;
    gst_rate:      string;
    quantity:      number;
    remarks:       string;
    // Computed (cached) — optional, avoids useMemo
    // _aggregate?: number;
    // _amount?: number;
    // _cgst?: number;
    // _sgst?: number;
    // _igst?: number;
    // _profit?: number;
};
```

**Recommendation**: Use `useMemo` approach instead (Step 10) to keep state lean and avoid data duplication. Computed values are derived, not stored.

---

## 8. Test Scenarios

1. **GST division + part with 18% gst_rate**: effectiveGstRate = 18; cost stays as-is; sale = cost + markup; aggregate, GST splits computed at 18%.
2. **GST division + part with 0% gst_rate + defaultGstRate = 18**: effectiveGstRate = 18 (same as above).
3. **GST division + part with 0% gst_rate + defaultGstRate = 0**: effectiveGstRate = 0 (no GST).
4. **Non-GST division + part with 18% gst_rate**: gst_rate displayed = 0; with `force=true`, cost = cost × 1.18; sale = cost + markup; with `force=false`, cost = original cost; sale = cost + markup.
5. **Non-GST division + force=false**: GST% = 0, cost unchanged, sale = cost + markup.
6. **Adding a new part line**: Calls `calculatePartLine` immediately with effectiveGstRate.
7. **Changing division from GST to Non-GST**: Re-runs calculate for all lines; GST rates reset to 0; costs/sales adjusted per force flag.
8. **Editing `sale_pr_gst`**: Back-calculates `selling_price`, then runs full calculate (prices round-trip correctly).
9. **Part with `cost_price = 0`**: Markup of 0 → sale = 0; no divide-by-zero.
10. **Warranty job**: All inputs disabled; calculate only used on initial load.
