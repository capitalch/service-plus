# Implementation Plan - Restrict Focus on Invalid Part Code

The objective is to ensure that if a user tabs away from a Part Code field that fails validation (no part found), the focus is immediately returned to that same Part Code field. This ensures data integrity by preventing the user from proceeding with an invalid part.

## Workflow
1. Use `useRef` to maintain a collection of Part Code input elements.
2. Update the `Input` component in the Part column to register its ref.
3. Modify `handleTypedPartSearch` to store the focus back to the specific input field if no unique part is found or if the search fails.
4. Ensure this works seamlessly with the `AddPartDialog` (if the dialog opens, focus will naturally go there, but if no auto-selection occurs, the field should remain focused).

## Execution Steps

### Step 1: Initialize Refs
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: Near other refs (around line 276).
- **Change**: `const partInputRefs = useRef<React.RefObject<HTMLInputElement>[]>([]);`
    Wait, better to use an object map or just an array.
    `const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);`

### Step 2: Register Input Ref
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: Part Code `Input` component (around line 877).
- **Change**: Add `ref={el => partInputRefs.current[idx] = el}`.

### Step 3: Refocus on Failure
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: `handleTypedPartSearch` function (around line 359).
- **Logic**:
    - In the `else` block (no part found) and the `results.length > 1` block (ambiguous), and in the `catch` block:
    - Call `partInputRefs.current[idx]?.focus()`.
    - Also `partInputRefs.current[idx]?.select()` to make it easy to re-type.
