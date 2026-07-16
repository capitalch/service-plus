# Apply (target amount) logic when the user clicks "Apply"

Formerly called "Back Calculate" throughout the UI and codebase comments — the
button and section heading now read "Apply" everywhere (Jobs' Finalize form
and Sales Entry). Internal identifiers (`backCalcTarget`, `computeBackCalc`,
`applyBackCalcTarget`, `src/lib/back-calc.ts`, etc.) were left as-is; this is
a UI/doc naming change only.

Implemented in two places in Service+:
- **Final a Job** (Jobs → Final a Job → Finalize): adjusts "Parts Used" and "Additional Charges".
- **Sales Entry** (Inventory → Sales Entry → New): adjusts the invoice's line items. Sales Entry has only one line-item section (no separate "Additional Charges"), so Phase 2 below doesn't apply there — it goes straight from Phase 1 to Phase 3 if the cost-price floor isn't enough to reach the target.

Shared implementation: `src/lib/back-calc.ts` (`allocateFloored` / `pickResidualKey`), consumed by `final-job-form.tsx` (Jobs) and `sales-invoice-utils.ts` (`computeBackCalc`, Sales Entry).

## Objective:
- Dynamically adjust line-item prices ("Parts Used" + "Additional Charges" for Jobs; line items for Sales Entry) so the calculated Total Amount strictly matches a user-defined Target Amount.

## Trigger:
- The logic initiates when the user inputs a Target Amount and clicks the "Apply" button.

## Global Distribution Rule (Proportionality):
- Whenever a price adjustment (increase or decrease) is applied to a section containing multiple line items, the required price difference must be distributed proportionally based on each item's current Sale Price relative to that section's total Sale Price.
- If GST applicable then respect GST rule while doing adjustments.

Core Rules & Execution Flow:

1. Initial Delta Check

Calculate the current total amount (Sum of Parts Used Sale Prices + Sum of Additional Charges — Sales Entry has only the one section).

If Target Amount == Current Total, terminate the function and make no adjustments.

2. Situation A: Upward Adjustment (Target Amount > Current Total)

Priority 1 (Parts / line items): Apply the entire required increase proportionally across the sale prices of all items in the "Parts Used" section (Sales Entry: all line items).

Priority 2 (Fallback, Jobs only): If the "Parts Used" section is empty, apply the required increase proportionally across the items in "Additional Charges".

3. Situation B: Downward Adjustment (Target Amount < Current Total)
To decrease the total, apply adjustments in the following strict hierarchical order to maximize reductions in the "Parts Used" / line-items section first:

## Phase 1 (Parts - Safe Decrease): Decrease the sale prices of items in the "Parts Used" section proportionally to match the Target Amount.

- Constraint: The Sale Price of any individual part must not drop below its Cost Price.

- Redistribution: If a proportional reduction pushes an individual part below its Cost Price, cap that specific part's sale price at its Cost Price. Take the remaining unapplied reduction and redistribute it proportionally among the remaining parts that have not yet hit their Cost Price floors.

## Phase 2 (Additional Charges - Safe Decrease, Jobs only — Sales Entry has no Additional Charges section and skips straight to Phase 3): If Phase 1 hits the Cost Price floor for all parts (or if there are no parts) and the Target Amount is still not reached, decrease the "Additional Charges" proportionally.

- Constraint: Additional Charges cannot drop below 0.

- Redistribution: If a proportional reduction pushes a specific charge below 0, cap it at 0 and redistribute the remainder to other additional charges.

## Phase 3 (Parts - Hard Override): If Phase 2 exhausts all Additional Charges to 0 (Jobs) — or, for Sales Entry, if every line item is already pinned at its Cost Price after Phase 1 — and the Target Amount is still not reached, override the Phase 1 constraint. Return to the "Parts Used" / line-items section and further decrease their sale prices proportionally below their Cost Prices until the Target Amount is exactly met. The redistribution weight at this point is each item's Phase 1 result (i.e. its Cost Price), since that's its current Sale Price at the moment Phase 3 begins.

- Constraint: The final adjusted total must never be negative.
- Jobs: the user is warned (toast) when Phase 3 triggers, since it means one or more items are now priced below cost.
- Sales Entry: no toast — a below-cost line is already surfaced inline via that row's (and the footer's) profit figure turning red, which is a clearer, always-visible signal.
