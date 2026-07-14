# Doing final a Job: Back Calculate logic when user clicks the back calculate button
## Objective:
- Implement a "Back Calculate" billing function for the Service Plus service management system that dynamically adjusts the line-item prices of "Parts Used" and "Additional Charges" so that the calculated Total Amount strictly matches a user-defined Target Amount.

## Trigger:
- The logic initiates when the user inputs a Target Amount and executes the "Back Calculate" action.

## Global Distribution Rule (Proportionality):
- Whenever a price adjustment (increase or decrease) is applied to a section containing multiple line items, the required price difference must be distributed proportionally based on each item's current Sale Price relative to that section's total Sale Price.
- If GST applicable then respect GST rule while doing adjustments.

Core Rules & Execution Flow:

1. Initial Delta Check

Calculate the current total amount (Sum of Parts Used Sale Prices + Sum of Additional Charges).

If Target Amount == Current Total, terminate the function and make no adjustments.

2. Situation A: Upward Adjustment (Target Amount > Current Total)

Priority 1 (Parts): Apply the entire required increase proportionally across the sale prices of all items in the "Parts Used" section.

Priority 2 (Fallback): If the "Parts Used" section is empty, apply the required increase proportionally across the items in "Additional Charges".

3. Situation B: Downward Adjustment (Target Amount < Current Total)
To decrease the total, apply adjustments in the following strict hierarchical order to maximize reductions in the "Parts Used" section first:

## Phase 1 (Parts - Safe Decrease): Decrease the sale prices of items in the "Parts Used" section proportionally to match the Target Amount.

- Constraint: The Sale Price of any individual part must not drop below its Cost Price.

- Redistribution: If a proportional reduction pushes an individual part below its Cost Price, cap that specific part's sale price at its Cost Price. Take the remaining unapplied reduction and redistribute it proportionally among the remaining parts that have not yet hit their Cost Price floors.

## Phase 2 (Additional Charges - Safe Decrease): If Phase 1 hits the Cost Price floor for all parts (or if there are no parts) and the Target Amount is still not reached, decrease the "Additional Charges" proportionally.

- Constraint: Additional Charges cannot drop below 0.

- Redistribution: If a proportional reduction pushes a specific charge below 0, cap it at 0 and redistribute the remainder to other additional charges.

## Phase 3 (Parts - Hard Override): If Phase 2 exhausts all Additional Charges to 0 and the Target Amount is still not reached, override the Phase 1 constraint. Return to the "Parts Used" section and further decrease their sale prices proportionally below their Cost Prices until the Target Amount is exactly met.

- Constraint: The final adjusted total must never be negative.
