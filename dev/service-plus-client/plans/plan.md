# CustomerInput → Shared + Modal Enhancement

## Context
Enhancement to the existing `CustomerInput` component. The inline dropdown (1200ms debounce, up to 50 results) is kept intact. Clicking the search icon now additionally opens a full-screen modal for detailed search across all customer fields. The component is also relocated to a shared folder.

## Changes

### 1. New folder: `src/features/client/components/shared/customer-select/`
- `customer-select.tsx` — updated main widget (exported as `CustomerInput`)
- `customer-search-modal.tsx` — new modal search component
- `index.ts` — barrel export

### 2. `customer-select.tsx`
Same as existing `customer-input.tsx` with one change:
- Search icon `onClick` → opens `CustomerSearchModal` instead of toggling the inline dropdown
- Add `modalOpen` state
- Render `<CustomerSearchModal>` with `initialSearch={customerName}`
- All existing inline dropdown / debounce logic is untouched

### 3. `customer-search-modal.tsx` (new)
- `Dialog` (Radix/shadcn) full-width modal
- Search `Input` auto-focused on open, pre-filled from `initialSearch`
- Debounce: **1600 ms**, min **2 chars** (noted in placeholder)
- Empty / < 2 chars → clears results
- Results table showing all `CustomerSearchRow` columns:
  Name · Mobile · Type · GSTIN · State · City · Postal · Address line
- Row click → `onSelect(row)` + close modal
- Spinner shown in search icon while loading

### 4. Update imports in 4 consumer files
| File | Old import |
|---|---|
| `inventory/sales-entry/new-sales-invoice.tsx` | `../customer-input` |
| `jobs/single-job/new-single-job-form.tsx` | `…/inventory/customer-input` |
| `jobs/batch-job/new-batch-job-form.tsx` | `…/inventory/customer-input` |
| `jobs/opening-job/opening-job-form.tsx` | `…/inventory/customer-input` |
All updated to `@/features/client/components/shared/customer-select`

### 5. Remove original file
`src/features/client/components/inventory/customer-input.tsx` deleted after move.

## Verification
1. Type in customer field → inline dropdown appears as before
2. Click search icon → modal opens, pre-filled with typed text
3. Type 2+ chars in modal → table populates after 1600ms
4. Click a row → modal closes, parent fields populate
5. Add new customer via `+` → success toast (modal not auto-opened, user can re-click search)
6. `tsc --noEmit` passes
