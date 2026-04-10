# Plan for Grid Layout Synchronization in Branch Transfer

The objective is to synchronize the UI/UX of the `new-branch-transfer.tsx` component with the newly optimized grid layout from `new-loan-entry.tsx`. This ensures consistency across the inventory modules.

## Workflow

1.  **Analyze current table-based layout**: Identify existing column widths and content.
2.  **Define Grid Constants**: Introduce `COLS`, `hdrCellCls`, and `inputCls` matching the Loan Entry style.
3.  **Refactor Template**: Replace the `<table>`, `<thead>`, `<tbody>` structure with a modern CSS Grid-based structure.
4.  **Standardize Alignment**: Apply centered alignment for administrative columns (Index, Actions) and content-specific alignment for data columns (Left for text, Right for numbers).
5.  **Enable Scrolling**: Ensure the grid is responsive and scrollable on small screens using a `min-w` wrapper.

## Execution Steps

### Step 1: Update Constants
Replace `thClass`, `tdClass`, and update `inputCls`.
Define `COLS` for the Branch Transfer columns:
- Index (`2.5rem`)
- Part (`minmax(0, 1fr)`)
- Qty (`6rem`)
- Line Remarks (`minmax(0, 1fr)`)
- Actions (`5.5rem`)

### Step 2: Update Header Styles
Implement `hdrCellCls` with consistent padding, font-weight, and background.
Center headers for Index and Actions.
Left-align Part and Remarks.
Right-align Qty.

### Step 3: Refactor Row items
Loop through `lines` and render `div` blocks with `${COLS}`.
Apply `border-r` to internal cells for clear column separation.
Ensure vertical centering of content within rows.

### Step 4: Consistency Pass
Sync the "Summary Bar" styles if necessary to match the Loan Entry aesthetic.
Add `overflow-hidden` to the parent Card and `overflow-x-auto` to the scroll container.

### Step 5: Verification
Verify that the Branch Transfer form now feels identical in usability and visual rhythm to the Loan Entry form.
