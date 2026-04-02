# Plan: Vertical Space Optimization for Line Items

## Step 1: Research and Tighter Style Definition
- Adjust `thClass` and `tdClass` for even more compact padding.
- `thClass`: `p-2` -> `py-1.5 px-2` 
- `tdClass`: `p-1` -> `p-0.5`

## Step 2: Refactor Card Header
- Remove `CardHeader` from the Line Items Card.
- Create a slim header bar within the card or as a first row with the Title.
- This saves the `p-6` or `p-4` padding of the header container.

## Step 3: Relocate "Add Row" Action
- Move the "Add Row" button from the header to the table footer.
- Implement it as a full-width, semi-transparent row button at the bottom of the table.
- This keeps the action contextually closer to where lines are added.

## Step 4: Summary Card Tighter Design
- Reduce padding in the final calculations card (`py-3` -> `py-2`).

## Workflow
1. Modify `NewPurchaseInvoice.tsx` style constants.
2. Update the JSX for the Line Items Card.
3. Reposition the "Add Row" logic.
4. Verify functionality and layout.
