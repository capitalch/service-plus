# Implementation Plan - Integrate "Add Model" Shortcut in New Job Form

This plan details how to provide a provision for users to add a new model directly from the New Job entry screen if it's missing from the selection.

## Workflow
1. Enhance the metadata loading to include Brands and Products.
2. Add an "Add New" button/trigger to the Product/Model field.
3. Reuse the existing `AddModelDialog` from the masters feature.
4. Implement a callback to refresh the model list upon successful creation.

## Execution Steps

### Step 1: Data Preparation in JobSection
- **Update Fetching**: Modify the `fetchMeta` function in `job-section.tsx` to also fetch:
  - `GET_ALL_BRANDS`
  - `GET_ALL_PRODUCTS`
- **PropTypes**: Update `NewJobForm` props to receive `brands` and `products`.

### Step 2: Implement "Add Model" Provision in NewJobForm
- **State**: Add `showAddModel` (boolean) state.
- **Trigger**: Add a small "Add" button (Emerald color with `Plus` icon) next to the `SearchableCombobox`.
- **Dialog**: Embed `<AddModelDialog />` at the bottom of the component.
- **Props**: Pass `brands`, `products`, `open`, `onOpenChange`, and `onSuccess`.

### Step 3: Handle Success & Refresh
- **Refresh Logic**: On `onSuccess` from the dialog:
  - Trigger a refetch of the `models` list (via a parent callback `onRefreshModels`).
  - Optionally auto-select the newly created model if its ID can be retrieved.

### Step 4: UI/UX Polish
- Ensure the "Add" button is visually consistent with the "Add Customer" button.
- Verify placement and responsive behavior of the button next to the combobox.