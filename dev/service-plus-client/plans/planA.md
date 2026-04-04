# Analysis & Implementation Plan - Increase Search Result Limit

The Part Search dialog currently hardcodes a result limit of 20, which can feel restrictive when there are many matching parts. This plan proposes increasing the default limit for better visibility.

## Analysis
The limitation is caused by the `limit: 20` parameter being explicitly passed in the `sqlArgs` within the `NewPurchaseInvoice` component's search logic.

```typescript
// File: src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx
// Around line 231
sqlArgs: { search: activeQuery.trim(), limit: 20, offset: 0 },
```

## Workflow
1.  **Identify Search Calls**: Update all occurrences of `limit: 20` in the part search logic to a more reasonable default (e.g., 50 or 100).
2.  **Ensure Persistence**: Check if similar limits are applied in other search contexts within the same component.
3.  **Update UI Feedback**: Verify that the "records found" counter correctly reflects the new subset size.

## Execution Steps

### Step 1: Update Default Search Limit
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: `useEffect` for Part Search (around line 231).
- **Change**: Increase `limit: 20` to `limit: 50` (or higher if preferred).
  
### Step 2: Handle Typed Search Consistency (Optional)
- **File**: `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`
- **Location**: `handleTypedPartSearch` (around line 245).
- **Analysis**: Currently, `handleTypedPartSearch` uses `GET_PART_BY_CODE` which typically returns a single match. If multiple matches are found, it opens the Pick Dialog. We should ensure the Pick Dialog itself shows the expanded set of results when opened through this path.

## Verification
- Use the search dialog with a generic keyword (e.g., "Display").
- Ensure it now shows up to 50 results instead of cutting off at exactly 20.
- Verify the "X records found" text updates to match the results length.
