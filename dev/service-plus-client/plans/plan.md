# Plan: Global Click-Outside Dropdown Fix

## Problem Analysis

Both **Supplier** and **State** fields in `new-purchase-invoice.tsx` use the locally defined `ModernCombobox` component (lines 108–220). It already attaches a `document.addEventListener("mousedown", handleClickOutside)` listener, but the dropdown fails to close on outside clicks.

**Root causes identified:**

1. **Unstable `useEffect` dependencies** — `getDisplayValue` and `getFilterKey` are inline arrow functions passed as props. On every parent render, new function references are created, causing the effect to teardown and re-register the listener on every render cycle. During teardown+re-add, a click may slip through.
2. **No `capture: true` flag** — If the component is rendered inside a Radix `Dialog` (which uses a Portal and may call `stopPropagation` on outside pointer events), the listener on the bubble phase never fires.
3. **Non-reusable** — The fix is duplicated; `ClientCombobox` (`client-combobox.tsx`) uses a different `onBlur`+`setTimeout` pattern that has its own edge cases.

---

## Workflow

1. Create a stable reusable `useClickOutside` hook.
2. Extract `ModernCombobox` into a shared UI component.
3. Replace the local `ModernCombobox` in `new-purchase-invoice.tsx` with the shared import.
4. Update `ClientCombobox` to use the same hook.
5. Verify no other custom dropdown components are affected.

---

## Steps

### Step 1 — Create `useClickOutside` hook
**File:** `src/hooks/use-click-outside.ts`

- Accept a `RefObject<HTMLElement>` and an `onClose: () => void` callback.
- Listen on `document` with `pointerdown` and `{ capture: true }` so it fires before Radix Dialog or any other component can stop propagation.
- Store `onClose` in a `useRef` so the `useEffect` has **no changing dependencies** — the listener is registered once on mount and removed on unmount. This eliminates the teardown/re-add race condition.
- Return nothing (side-effect only hook).

```ts
// Pseudocode
useEffect(() => {
  const handler = (e: PointerEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      callbackRef.current();
    }
  };
  document.addEventListener("pointerdown", handler, { capture: true });
  return () => document.removeEventListener("pointerdown", handler, { capture: true });
}, []); // stable — no deps
```

---

### Step 2 — Extract `ModernCombobox` to shared UI component
**File:** `src/components/ui/searchable-combobox.tsx`

- Move the entire `ModernCombobox` generic component from `new-purchase-invoice.tsx` (lines 108–220) into this new file.
- Rename export to `SearchableCombobox` for clarity.
- Replace the existing `useEffect`+`document.addEventListener` block with a call to `useClickOutside(containerRef, () => { setOpen(false); /* reset search logic */ })`.
- Keep all other logic (filtered list, Framer Motion animation, keyboard/clear button) unchanged.
- Export both `SearchableComboboxProps` type and `SearchableCombobox` component.

---

### Step 3 — Update `new-purchase-invoice.tsx`
**File:** `src/features/client/components/inventory/purchase-entry/new-purchase-invoice.tsx`

- Remove the local `ModernComboboxProps` interface and `ModernCombobox` function (lines 108–220).
- Add import: `import { SearchableCombobox } from "@/components/ui/searchable-combobox";`
- Replace both JSX usages of `<ModernCombobox ...>` (lines ~698 and ~747) with `<SearchableCombobox ...>` — props are identical, no other changes needed.

---

### Step 4 — Update `ClientCombobox`
**File:** `src/features/auth/components/client-combobox.tsx`

- Replace the existing `onBlur`+`blurTimerRef`+`setTimeout` close mechanism with `useClickOutside(containerRef, closeDropdown)`.
- Ensure a `containerRef` is attached to the outermost `div` of the combobox if not already present.
- Remove `blurTimerRef`, `handleBlur`, and the `onBlur` prop from the `<Input>`.
- Keep `handleFocus` (opens dropdown on focus) unchanged.

---

### Step 5 — Audit other dropdowns (no changes expected)
- `Radix Select` (used in add/edit vendor and customer dialogs) — handled natively by Radix; no changes needed.
- `Radix DropdownMenu` (state-section, vendor-section action menus) — handled natively by Radix; no changes needed.
- Confirm no other custom combobox components exist in `src/`.
