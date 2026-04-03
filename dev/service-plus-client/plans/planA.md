# Implementation Plan - Enhance Line Action Icons

The objective is to make the action icons (Add and Remove row) in the Purchase Entry line items more prominent and visually compact.

## Workflow
1. Identify the action button container and icons in `new-purchase-invoice.tsx`.
2. Increase the icon size slightly and adjust their stroke weight for better prominence.
3. Reduce the gap between the buttons.
4. Verify the updated visual style.

## Execution Steps

### Step 1: Update Icons and Layout
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: Actions column cells (around line 1022).
- **Change Details**:
    - Reduce the container gap from `gap-1.5` to `gap-0.5`.
    - Increase icon size for `PlusCircle` and `XCircle` from `h-6 w-6` to `h-[26px] w-[26px]`.
    - Adjust the button padding if needed to maintain an overall balanced layout.
    - Ensure the hover/active transitions remain smooth.
    - Potential tweak to colors or stroke weight for extra prominence.