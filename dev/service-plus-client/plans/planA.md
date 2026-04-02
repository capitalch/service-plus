# Plan for Global Click-Outside Dropdown Resolution

## Workflow
1. Create a reusable `useClickOutside` hook in `src/hooks`.
2. Update the `ModernCombobox` component in `NewPurchaseInvoice.tsx` to handle clicks outside the container properly using this hook.
3. Update the `ClientCombobox` in `features/auth` to replace its current timer-based blur logic with the new hook for a more robust "click-away" experience.
4. Verify all dropdowns close correctly when clicking elsewhere on the screen.

## Execution Steps

**Step 1: Create the Hook**
- Create `src/hooks/use-click-outside.ts`.
- Implement logic to detect clicks outside a given `ref` and execute a callback.

**Step 2: Update ModernCombobox**
- In `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`:
  - Import `useClickOutside`.
  - Replace the manual `useEffect` with the hook in `ModernCombobox`.
  - Test it for "Supplier" and "State" fields.

**Step 3: Update ClientCombobox**
- In `src/features/auth/components/client-combobox.tsx`:
  - Import `useClickOutside`.
  - Add a ref to the container.
  - Apply the hook to close the dropdown.
  - Remove original `handleBlur` dependencies if possible.

**Step 4: Manual Verification**
- Conduct tests in the browser for all three dropdowns to ensure they close on outside click as expected.
