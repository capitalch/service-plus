# Plan for Fixing Upload Step UI Issues in Parts Import

## Workflow

The core problem is caused by the upload drop area being configured as an HTML `<label>` element containing an `<input type="file">` combined with `tabIndex={0}`.

1.  **Focus and Double Click Issue:** By default, HTML `<label>` elements have complex native focus and click-through behaviours when wrapping an input. Giving a label `tabIndex={0}` causes the browser to intercept the first click simply to set focus on the label. A second click is then required to trigger the nested file input.
2.  **Brand Selection Unselecting:** When a user clicks a `<label>` element, some browsers attempt to recursively find and focus associated form controls. If the `brandId` Select component is placed near it, the native FocusEvent inside a customized UI component (like Radix UI Select used here) can trigger `onBlur` or unexpected focus transfer events, which may inadvertently clear or reset the Select state.

We will resolve this by completely detaching the drop area from the generic `<label>` HTML structure and converting it into a purely custom `<div role="button">` with explicitly controlled click forwarding via React `useRef`.

## Execution Steps

### Step 1: Initialize File Input Reference
- Inside `ImportPartDialog` (`service-plus-client/src/features/client/components/import-part-dialog.tsx`), introduce a new `useRef` to store the reference to the hidden file input element.
- `const fileInputRef = useRef<HTMLInputElement>(null);`

### Step 2: Refactor the Drop Area Container
- Change the `tabIndex={0}` drop area container in "Step 1" view from `<label>` to `<div role="button">`.
- This eliminates native label focus/click bugs where the browser swallows the first activation.

### Step 3: Implement Programmatic Click Forwarding
- Add an `onClick` event handler to the new `<div>` returning: `onClick={() => fileInputRef.current?.click()}`.
- To maintain accessibility since we converted it to a button, add an `onKeyDown` handler:
  ```typescript
  onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInputRef.current?.click();
      }
  }}
  ```

### Step 4: Attach Reference to Input
- On the `<input type="file">` inside the drop area, attach the newly created `ref={fileInputRef}`.
- Retain the existing `onChange={handleFileSelect}` so the file processing functionality works normally once triggered programmatically.

### Step 5: Verify Implementation
- Ensure there are no lingering pseudo-label errors. The component will now cleanly accept dragged files and instantly prompt the file dialogue on a single click without side-effecting onto other states like the Brand selection.
