# Final A Job — Back Calculate Feature

## Overview

In the Grand Summary section (Job Summary), add a **target amount input** and a **Back Calculate button** on the extreme right. When the user types a desired final total and clicks Back Calculate, the system adjusts row values to make `grandTotal` match the target. A visual indicator confirms when the tally is achieved.

---

## UI Changes

**Location:** Grand Summary bar — extreme right, after the existing Parts + Charges = Total group.

```
[ Grand Total  Profit  Qty  CGST  SGST  IGST ]   [ Parts + Charges = Total ]   [ <input>       ]
                                                                                  [ Back Calculate ]
                                                                                  [ ✓ Tallied      ]
```

- A numeric `<Input>` (large, right-aligned) for the user to type the target amount.
- A **Back Calculate** `<Button>` below the input.
- A green **✓ Tallied** indicator (using `CheckCircle2` icon) shown when `|grandTotal − target| < 0.005`.

---

## State

| Addition | Type | Purpose |
|---|---|---|
| `backCalcTarget` | `string` | Controlled input value for the target amount |

`isTallied` is **derived** (not state):
```typescript
const backCalcTargetNum = parseFloat(backCalcTarget);
const isTallied = backCalcTarget !== "" && !isNaN(backCalcTargetNum)
    && Math.abs(grandTotal - backCalcTargetNum) < 0.005;
```

---

## Algorithm — `computeBackCalc` (pure helper, outside component)

Single entry-point function. Returns `{ newPartLines?, newChargeLines? }` — caller applies them to state.

```
computeBackCalc(target, partLines, chargeLines, isGst):

  1. Recompute partsTotal and chargesTotal from current state.
  2. diff = target − (partsTotal + chargesTotal)
  3. If |diff| < 0.005 → return {} (already tallied)

  4. activeCharges = chargeLines where charge_name.trim() ≠ ""

  ── Phase 1: Adjust additional charges ──────────────────────────────
  5. If activeCharges.length > 0:
       curChargesAmt = sum of (selling_price × qty × (1 + gst_rate/100)) for activeCharges
       newChargesAmt = curChargesAmt + diff

       If newChargesAmt ≥ 0:
         → return { newChargeLines: scaleCharges(chargeLines, activeCharges,
                                                  curChargesAmt, newChargesAmt, isGst) }

  ── Phase 2: Zero charges + adjust parts ────────────────────────────
  6. activeParts = partLines where part_id ≠ null
     If activeParts.length = 0 → return {} (nothing to adjust)

  7. newChargeLines = set selling_price = "0", sale_pr_gst = "0" on all activeCharges

  8. curPartsAmt = sum of (sale_pr_gst × quantity) for activeParts
     If curPartsAmt ≤ 0 → return { newChargeLines } (can't scale from zero)

  9. return {
       newPartLines:  scaleParts(partLines, activeParts, curPartsAmt, target),
       newChargeLines,
     }
```

---

## Helper — `scaleCharges`

Proportionally rescales `selling_price` and `sale_pr_gst` of active charge rows so their total equals `newTotal`.

```
scaleCharges(allCharges, active, curTotal, newTotal, isGst):

  For each active charge:
    curRowAmt = selling_price × qty × (1 + gst_rate/100)
    if curTotal > 0:
      newRowAmt = max(0, curRowAmt × newTotal / curTotal)
    else:
      newRowAmt = newTotal / active.length     ← even split when starting from zero

  Last row absorbs rounding remainder:
    newRowAmts[last] = max(0, newTotal − sum(newRowAmts[0..n-2]))

  Back-calculate per row:
    sale_pr_gst_per_unit = newRowAmt / qty
    selling_price        = sale_pr_gst_per_unit / (1 + gst_rate/100)

  Return allCharges with active rows patched.
```

No negative-value guard needed here since `newTotal ≥ 0` is enforced before calling.

---

## Helper — `scaleParts`

Proportionally rescales `selling_price` and `sale_pr_gst` of active part rows so their total equals `newTotal`, while ensuring **profit does not go negative** (i.e. `selling_price ≥ cost_price`).

```
scaleParts(allParts, active, curTotal, newTotal):

  For each active part:
    curRowAmt = sale_pr_gst × quantity
    newRowAmt = max(0, curRowAmt × newTotal / curTotal)

  Last row absorbs rounding remainder.

  Back-calculate per row:
    sale_pr_gst_per_unit = newRowAmt / quantity
    selling_price        = sale_pr_gst_per_unit / (1 + gst_rate/100)

    // No negative profit:
    finalSp  = max(selling_price, cost_price)
    finalSpg = finalSp × (1 + gst_rate/100)

  Return allParts with active rows patched.
```

> Note: Enforcing the profit floor means the final `grandTotal` may not exactly equal `target` when parts are constrained. The `isTallied` indicator uses a tolerance of `0.005` to account for rounding.

---

## Handler (inside component)

```typescript
function handleBackCalculate() {
    const target = parseFloat(backCalcTarget);
    if (isNaN(target) || target < 0) return;
    const result = computeBackCalc(target, partLines, chargeLines, isGst);
    if (result.newPartLines)  setPartLines(result.newPartLines);
    if (result.newChargeLines) setChargeLines(result.newChargeLines);
}
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `target === grandTotal` | No-op; `isTallied` shows immediately |
| No active charges, target < partsTotal | Scale parts down (floored at cost_price per row) |
| All charges already at 0 and diff > 0 | Even-split the new total across charge rows |
| No active charges AND no active parts | Nothing changes |
| Negative target entered | Button disabled / guard in handler |
| `curPartsAmt === 0` (all parts at 0 sale) | Phase 2 returns `newChargeLines` only, parts unchanged |

---

## Files Changed

| File | Change |
|---|---|
| `final-a-job-section.tsx` | Add `scaleCharges`, `scaleParts`, `computeBackCalc` helpers; add `backCalcTarget` state; add UI to Grand Summary |
