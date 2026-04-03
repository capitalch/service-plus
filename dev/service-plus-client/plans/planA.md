# Plan: Dynamic GST Status Indicator

This plan outlines the steps to make the "GST" indicator dynamic based on the `isGstRegistered` global state from the `context` slice.

## Workflow
1.  **Import** the `selectIsGstRegistered` selector and `XCircle` / `CheckCircle2` icons in `PurchaseEntrySection.tsx`.
2.  **Retrieve** the current GST status using `useAppSelector(selectIsGstRegistered)`.
3.  **Update** the rendering logic for the GST indicator to toggle between "Enabled" (Green) and "Disabled" (Red) states based on this value.
4.  **Confirm** that the icons and colors change correctly to reflect the global setting.

## Steps

### Step 1: Update Imports in PurchaseEntrySection.tsx
- **File**: `src/features/client/components/inventory/purchase-entry/purchase-entry-section.tsx`
- **Add**: `XCircle` to `lucide-react` imports.
- **Add**: `selectIsGstRegistered` to `context-slice` imports.

### Step 2: Retrieve GST State
- Add `const isGstRegistered = useAppSelector(selectIsGstRegistered);` within the `PurchaseEntrySection` component.

### Step 3: Update Rendering Logic
- Replace the static GST badge with a conditional one:
  ```tsx
  {mode === 'new' && (
      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm border shadow-sm animate-in fade-in zoom-in duration-500 delay-150 ${
          isGstRegistered 
              ? 'bg-emerald-500/10 border-emerald-500/20' 
              : 'bg-red-500/10 border-red-500/20'
      }`}>
          {isGstRegistered ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          ) : (
              <XCircle className="h-3 w-3 text-red-600" />
          )}
          <span className={`text-[9px] font-bold uppercase tracking-tighter ${
              isGstRegistered ? 'text-emerald-700' : 'text-red-700'
          }`}>
              GST {isGstRegistered ? 'Enabled' : 'Disabled'}
          </span>
      </div>
  )}
  ```

### Step 4: Verification
- Verify that when `isGstRegistered` is false, the indicator turns red and says "GST Disabled" with a cross icon.
- Verify that when true, it remains green with "GST Enabled" and a checkmark.
