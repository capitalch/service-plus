# Implementation Plan — Finalization Pricing Logic & Reset Button

Analysis of `tran.md` against the current codebase (`final-a-job-section.tsx`, `final-job-form.tsx`, `final-a-job-helpers.ts`, `sql_store.py`).

---

## tran.md Variables (reference)

| Symbol | Meaning |
|---|---|
| `dbcp` | `spare_part_master.cost_price` — master cost price |
| `customcp` | `job_part_used.cost_price` — cost currently on the job line |
| `dbsp` | `spare_part_master.selling_price` — master selling price |
| `customsp` | `job_part_used.selling_price` — selling price currently on the job line |
| `patch` | `force_gst_on_parts_for_non_gst_invoices` app setting |
| `isGst` | GST applicable for the selected division |
| `rate` | Part's GST rate (%) |
| `markup` | `markup_percent_over_cost` app setting |

---

## tran.md Spec

```
ccp = dbcp or customcp          (first non-zero)

cp:
  if !isGst and patch:
    if dbcp > 0:  cp = (1 + rate/100) * dbcp
    else:         cp = customcp          ← no adjustment when no master cost
  else:
    cp = ccp

sp = customsp or cp*(1 + markup/100)   (first non-zero)

+gst = sp * (1 + rate/100)

Target amount = job.amount or computed total  (first non-zero)

Division change → full recalculation when GST status changes.

Reset button → recalculate all values from master data; do NOT delete any rows.
```

---

## Current State Assessment

### What is correct ✅

- Division selector in finalization form
- `isGst` derived from division; GST columns shown/hidden accordingly
- `calculateLinePricing` (per-line recalc on user input) is correct
- `handleDivisionChange` triggers recalculation on GST↔non-GST switch
- Back-calc target seeded from `job.amount` on open
- `computedTotal` used as fallback when no target set
- `forceIgst` / CGST / SGST / IGST totals
- All GST-mode part/charge save paths
- Warranty job zeroes selling prices

### Bugs vs. tran.md spec ⚠️

#### Bug 1 — `ccp` doesn't fall back to `customcp` when `dbcp = 0`

**File**: `final-a-job-section.tsx` → `computePartPricesOnSelect` (line ~86)

```typescript
// Current
const rawCost = part.cost_price ?? 0;          // zero when master has no price

// Spec: ccp = first non-zero of (dbcp, customcp)
```

When the part has no price in `spare_part_master`, `rawCost = 0` and all subsequent computations produce zero. The line's existing `cost_price` (`customcp`) is never consulted.

---

#### Bug 2 — `sp` uses `masterSelling` (dbsp) instead of `customsp`

**File**: `final-a-job-section.tsx` → `computePartPricesOnSelect`

```typescript
// Current — uses master's selling_price
const masterSelling = (part.selling_price != null && part.selling_price > 0) ? part.selling_price : null;
...
const sale = masterSelling ?? applyMarkup(rawCost, markupPct);

// Spec: sp = customsp or cp*(1+markup/100)
// customsp = what is currently on the job line (job_part_used.selling_price)
```

The spec says: if the job line already has a selling price, keep it; otherwise compute from markup. The current code instead uses the master's selling price as the preferred value — a different source entirely.

---

#### Bug 3 — `forceGst` selling price uses rupee margin instead of markup%

**File**: `final-a-job-section.tsx` → `computePartPricesOnSelect`, `!isGst && forceGstOnPartsForNonGst` branch

```typescript
// Current — adds old rupee margin to adjusted cost
const markupAmt = masterSelling != null ? masterSelling - rawCost : rawCost * markupPct / 100;
const sale = adjustedCost + markupAmt;

// Spec: sp = customsp or adjustedCost * (1 + markup/100)
```

When `forceGst=true` and `dbcp>0`, the adjusted cost is `(1+rate/100)*dbcp`. The selling price should then be `customsp || adjustedCost*(1+markup/100)`. The current code instead computes `sale = adjustedCost + (masterSelling - dbcp)`, which is a preservation of the rupee margin from the master, not a markup% application.

---

#### Bug 4 — Division change `forceGst` selling price uses same wrong logic

**File**: `final-a-job-section.tsx` → `handleDivisionChange`, `forceGstOnPartsForNonGst` branch (line ~437)

```typescript
// Current
const margin = Math.max(0, (parseFloat(line.selling_price) || 0) - rawCost);
const newSelling = adjustedCost + margin;

// Spec: sp = adjustedCost * (1 + markup/100)
// (On division change, customsp should be treated as 0 — force full recompute)
```

Same rupee-margin-preservation error as Bug 3, but in the division-change path. During a division change, the spec calls for a full recalculation; the existing selling price from the previous mode should not be carried over as a "custom" value. Additionally, `markupPct` is in section state and is accessible but not used here.

---

#### Bug 5 — `GET_JOB_PART_USED_BY_JOB` doesn't return master data

The current SQL returns `jpu.cost_price` / `jpu.selling_price` / `jpu.gst_rate` (from `job_part_used`), but NOT the corresponding master values from `spare_part_master`. To implement the correct `ccp` fallback (Bug 1) and to support the Reset button, we need both:
- `dbcp` = `sp.cost_price` (master cost)
- `dbsp` = `sp.selling_price` (master selling)
- `master_gst_rate` = `sp.gst_rate` (master GST rate, distinct from overridden job-level rate)

These must be joined from `spare_part_master` and surfaced to the frontend.

---

### Missing feature ❌

#### Missing — Reset button

tran.md: *"Provide a reset button which resets all values but does not delete any rows from Parts Used or Additional Charges block."*

No Reset button exists. The Refresh button (🔄) re-fetches the job from DB but does not recompute prices.

---

## Full Task Plan

---

### Task 1 — Extend `GET_JOB_PART_USED_BY_JOB` to include master data

**Files**:
- `app/db/sql_store.py` (line 3918)
- `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx` — `LoadedPartRow` type
- `src/features/client/components/jobs/final-a-job/final-a-job-schema.ts` — `EditablePartLine` type

**Step 1.1** — In `sql_store.py`, extend `GET_JOB_PART_USED_BY_JOB` to include master cost/selling/gst_rate:

```sql
SELECT jpu.id, jpu.part_id, jpu.qty, jpu.cost_price, jpu.selling_price, jpu.gst_rate, jpu.remarks,
       sp.part_code, sp.part_name, sp.uom, sp.brand_id,
       COALESCE(jpu.hsn_code, sp.hsn_code) AS hsn_code,
       sp.cost_price    AS master_cost_price,
       sp.selling_price AS master_selling_price,
       sp.gst_rate      AS master_gst_rate
FROM job_part_used jpu
JOIN spare_part_master sp ON sp.id = jpu.part_id
WHERE jpu.job_id = (table "p_job_id")
ORDER BY jpu.id
```

**Step 1.2** — In `LoadedPartRow` (inside `final-a-job-section.tsx`), add three new fields:
```typescript
master_cost_price:    number | null;
master_selling_price: number | null;
master_gst_rate:      number | null;
```

**Step 1.3** — In `EditablePartLine` (in `final-a-job-schema.ts`), add two new optional fields carried for recomputation:
```typescript
master_cost_price:    number;   // dbcp — used by Reset and ccp fallback
master_selling_price: number;   // dbsp — not used in tran.md sp logic, carried for reference
```

**Step 1.4** — In `handleOpenFinal` in `final-a-job-section.tsx`, populate these fields when mapping loaded rows to `EditablePartLine`:
```typescript
master_cost_price:    p.master_cost_price ?? 0,
master_selling_price: p.master_selling_price ?? 0,
```

**Step 1.5** — In `handlePartSelect`, after selecting a part, also set `master_cost_price` on the line:
```typescript
master_cost_price:    part.cost_price ?? 0,
master_selling_price: part.selling_price ?? 0,
```

---

### Task 2 — Fix `computePartPricesOnSelect` pricing logic (Bugs 1, 2, 3)

**File**: `final-a-job-section.tsx` → `computePartPricesOnSelect`

**Step 2.1** — Add `currentCostPrice: number` and `currentSellingPrice: number` parameters.

**Step 2.2** — Implement correct `ccp`, `cp`, `sp` logic:

```typescript
function computePartPricesOnSelect(
    part: PartRow,
    isGst: boolean,
    forceGstOnPartsForNonGst: boolean,
    defaultGstRate: number,
    markupPct: number,
    currentCostPrice: number,    // customcp — current line's cost_price
    currentSellingPrice: number, // customsp — current line's selling_price
): Pick<EditablePartLine, "cost_price" | "selling_price" | "sale_pr_gst" | "gst_rate"> {
    const dbcp = part.cost_price ?? 0;
    const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;

    // ccp = first non-zero of (dbcp, customcp)
    const ccp = dbcp > 0 ? dbcp : currentCostPrice;

    let cp: number;
    if (!isGst && forceGstOnPartsForNonGst) {
        if (dbcp > 0) {
            cp = dbcp * (1 + effectiveGstRate / 100);   // inflate master cost by GST
        } else {
            cp = currentCostPrice;                       // no master price → keep custom, no inflation
        }
    } else {
        cp = ccp;
    }

    // sp = customsp or cp*(1+markup/100) [first non-zero]
    const computedSp = cp * (1 + markupPct / 100);
    const sp = currentSellingPrice > 0 ? currentSellingPrice : computedSp;

    // +gst = sp * (1 + rate/100) in GST mode; rate=0 in non-GST mode
    const displayGstRate = isGst ? effectiveGstRate : 0;
    const spGst = sp * (1 + displayGstRate / 100);

    return {
        cost_price:    cp.toFixed(2),
        selling_price: sp.toFixed(2),
        gst_rate:      String(displayGstRate),
        sale_pr_gst:   spGst.toFixed(2),
    };
}
```

**Step 2.3** — Update `handlePartSelect` to pass `currentCostPrice` and `currentSellingPrice` from the current line:
```typescript
function handlePartSelect(key: string, part: PartRow) {
    const line = partLines.find(l => l._key === key);
    const currentCostPrice    = parseFloat(line?.cost_price    ?? "0") || 0;
    const currentSellingPrice = parseFloat(line?.selling_price ?? "0") || 0;
    const pricePatch = computePartPricesOnSelect(
        part, isGst, forceGstOnPartsForNonGst, defaultGstRate, markupPct,
        currentCostPrice, currentSellingPrice,
    );
    updatePartLine(key, {
        part_id:  part.id,
        part_code: part.part_code,
        part_name: part.part_name,
        brand_id:  part.brand_id,
        hsn_code:  part.hsn_code?.trim() || defaultHsnForSparePart,
        master_cost_price:    part.cost_price ?? 0,
        master_selling_price: part.selling_price ?? 0,
        ...pricePatch,
    });
}
```

---

### Task 3 — Fix `handleDivisionChange` forceGst selling price (Bug 4)

**File**: `final-a-job-section.tsx` → `handleDivisionChange`

**Current problematic block** (switching to non-GST with `forceGstOnPartsForNonGst`):
```typescript
const margin = Math.max(0, (parseFloat(line.selling_price) || 0) - rawCost);
const newSelling = adjustedCost + margin;
```

**Fix** — Division change forces full recomputation; no custom price is preserved:
```typescript
if (!newIsGst && forceGstOnPartsForNonGst && line.part_id !== null) {
    const currentGstRate = parseFloat(line.gst_rate) || defaultGstRate;
    const rawCost = parseFloat(line.cost_price) || 0;
    // Spec: cp = (1+rate/100)*dbcp if dbcp>0, else cp = customcp
    // On division change, line.cost_price IS the un-inflated dbcp (was in GST mode)
    const adjustedCost = rawCost > 0 ? rawCost * (1 + currentGstRate / 100) : 0;
    // Spec: sp = customsp or cp*(1+markup/100); customsp=0 on division change (full recompute)
    const newSelling = applyMarkup(adjustedCost, markupPct);
    return { ...line, cost_price: adjustedCost.toFixed(2), selling_price: newSelling.toFixed(2), gst_rate: "0", sale_pr_gst: newSelling.toFixed(2) };
}
```

Also fix the non-GST without force_gst path (currently preserves the old selling price):
```typescript
// switching to !isGst, no force_gst: cp=ccp, sp = ccp*(1+markup/100)  (full recompute)
const rawCost = parseFloat(line.cost_price) || 0;
const newSelling = applyMarkup(rawCost, markupPct);
return { ...line, selling_price: newSelling.toFixed(2), ...calculateLinePricing(line, { selling_price: newSelling.toFixed(2) }, false) };
```

Note: `markupPct` is already in the section's state and is accessible in `handleDivisionChange`.

---

### Task 4 — Add Reset button (new feature)

**Files**:
- `final-a-job-section.tsx` — implement `handleReset`
- `final-job-form.tsx` — add `onReset` prop and Reset button in the form header
- `final-a-job-schema.ts` — no change (uses extended `EditablePartLine` from Task 1)

#### Step 4.1 — `handleReset` in `final-a-job-section.tsx`

The reset must:
1. Recompute all part line prices from master data (using `master_cost_price` added in Task 1)
2. Reset charge `gst_rate` to `defaultGstRate` and `hsn_code` to `defaultHsnForServiceCharge`
3. NOT change `partLines` length, `chargeLines` length, `deletedPartIds`, or `deletedChargeIds`
4. NOT fetch anything from the network — uses master data already on the lines from Task 1

```typescript
function handleReset() {
    setPartLines(prev => prev.map(line => {
        if (line.part_id === null) return line;    // blank lines: leave untouched
        const dbcp = line.master_cost_price ?? 0;
        const effectiveGstRate = parseFloat(line.gst_rate) > 0 ? parseFloat(line.gst_rate) : defaultGstRate;
        const pricePatch = computePartPricesOnSelect(
            // Construct a minimal PartRow with master data
            { cost_price: dbcp, selling_price: line.master_selling_price ?? 0,
              gst_rate: effectiveGstRate, hsn_code: line.hsn_code } as PartRow,
            isGst, forceGstOnPartsForNonGst, defaultGstRate, markupPct,
            0,   // currentCostPrice=0 → forces fresh cp from master
            0,   // currentSellingPrice=0 → forces fresh sp from markup
        );
        return { ...line, ...pricePatch };
    }));

    setChargeLines(prev => prev.map(c => {
        if (!c.charge_name.trim()) return c;
        const sp = parseFloat(c.selling_price) || 0;
        const gstRate = isGst ? defaultGstRate : 0;
        return {
            ...c,
            gst_rate: String(gstRate),
            hsn_code: c.hsn_code.trim() || defaultHsnForServiceCharge,
            sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2),
        };
    }));
}
```

Note: Since `master_cost_price` is stored on lines (Task 1), no network call is needed.

#### Step 4.2 — Extend `FinalJobFormProps` with `onReset`

Add to `FinalJobFormProps` in `final-job-form.tsx`:
```typescript
onReset: () => void;
```

Pass from `final-a-job-section.tsx`:
```tsx
<FinalJobForm
    ...
    onReset={handleReset}
/>
```

#### Step 4.3 — Add Reset button to `FinalJobForm` header

In `final-job-form.tsx`, in the header button row (next to Refresh), add:
```tsx
import { RotateCcw } from "lucide-react";
...
<Button
    className="h-7 gap-1 px-2.5 text-xs text-amber-700 border border-amber-300 hover:bg-amber-50"
    disabled={submitting}
    size="sm"
    title="Reset all prices from master data (keeps all rows)"
    variant="outline"
    onClick={onReset}
>
    <RotateCcw className="h-3.5 w-3.5" />
    Reset
</Button>
```

---

## Summary of Changes by File

| File | Changes |
|---|---|
| `sql_store.py` | Add `sp.cost_price AS master_cost_price`, `sp.selling_price AS master_selling_price`, `sp.gst_rate AS master_gst_rate` to `GET_JOB_PART_USED_BY_JOB` |
| `final-a-job-schema.ts` | Add `master_cost_price: number` and `master_selling_price: number` to `EditablePartLine` |
| `final-a-job-section.tsx` | (1) Extend `LoadedPartRow`, (2) Fix `computePartPricesOnSelect` per spec, (3) Update `handlePartSelect` to pass current prices + set master fields, (4) Fix `handleDivisionChange` forceGst selling price, (5) Add `handleReset` |
| `final-job-form.tsx` | Add `onReset: () => void` to `FinalJobFormProps`; add Reset button in form header |

---

## Non-changes (explicitly out of scope)

- `calculateLinePricing` in `final-a-job-helpers.ts` — correct as-is (handles live user edits)
- Back-calc logic (`computeBackCalc`, `scaleParts`, `scaleCharges`) — correct as-is
- Save path (`handleSaveFinal`) — no price recomputation at save time; saves whatever is on screen
- Charge line pricing — charges have no `dbcp/dbsp` concept from master; tran.md only specifies part pricing
- No DB schema migrations needed — all required columns already exist
