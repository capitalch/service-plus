# Plan: Modify Part Code Input Behavior (tran.md)

## Context
The `PartCodeInput` component currently has ambiguous behavior when the user interacts with the part code field:
- Clicking the search button and pressing Enter/Tab/Blur all have overlapping paths that could unexpectedly open the PartDialog (add/edit form).
- The requirement clarifies two distinct, mutually exclusive UX flows:
  1. **Search button** → opens pick dialog only (browse & select). PartDialog must never open from this path.
  2. **Enter / Tab / Blur** → validates the typed code. If not found → opens PartDialog to add it.

## Root Cause
`handleTypedPartSearch` (called on Enter/Tab/Blur) checks `partPickOpen` **React state** to guard against opening PartDialog while the pick dialog is open. However, React state updates are asynchronous — when `setPartPickOpen(true)` is called in `openPartPick` (search button path), the closure captured in `onBlur` may still see `partPickOpen = false`, allowing `handleTypedPartSearch` to run and open PartDialog before the state re-render completes. The `skipBlurRef` flag only catches **one** blur event (the focus shift to the dialog input) and is reset immediately, leaving later blurs unprotected.

## Critical File
- `src/features/client/components/inventory/part-code-input.tsx`

## Step-by-Step Changes

### Step 1 — Add `partPickOpenRef` to mirror state synchronously
Add a `useRef<boolean>(false)` named `partPickOpenRef` alongside the existing refs (after `skipBlurRef`):
```ts
const partPickOpenRef = useRef(false);
```

### Step 2 — Set ref immediately in `openPartPick` (before React re-render)
In the `openPartPick` function, set `partPickOpenRef.current = true` **before** calling `setPartPickOpen(true)`:
```ts
const openPartPick = () => {
    if (!selectedBrandId) {
        toast.warning("Please select a brand before searching parts.");
        return;
    }
    partPickOpenRef.current = true;   // ← add this line
    setPartResults([]);
    setPartCodeQuery(partCode?.trim() ?? "");
    setPartKeywordQuery("");
    setPartSearchMode("code");
    setPartPickOpen(true);
};
```

### Step 3 — Reset ref when pick dialog closes
In the Dialog's `onOpenChange` handler (the `if (!open)` branch), reset `partPickOpenRef.current = false` **before** the existing cleanup:
```ts
onOpenChange={open => {
    if (!open) {
        partPickOpenRef.current = false;   // ← add this line
        setPartPickOpen(false);
        ...
        focusInput();
    }
}}
```

### Step 4 — Guard `onBlur` with the ref
Replace the current blur handler guard with a combined check:
```ts
onBlur={() => {
    if (skipBlurRef.current) { skipBlurRef.current = false; return; }
    if (partPickOpenRef.current) return;   // ← add this line
    if (partCode.trim()) void handleTypedPartSearch(partCode);
}}
```
This ensures: whenever the pick dialog is open **or opening**, blur on the part code input is a no-op. Enter/Tab/Blur still trigger `handleTypedPartSearch` normally when the pick dialog is not involved.

## Workflow Summary
```
User clicks Search button
  → onMouseDown: skipBlurRef=true, e.preventDefault()
  → onClick: openPartPick()
      → partPickOpenRef=true (sync, immediate)
      → setPartPickOpen(true) (async React update)
  → Any blur that fires: partPickOpenRef=true → skip validation → no PartDialog

Pick dialog closes (user didn't select)
  → partPickOpenRef=false
  → focusInput() → input regains focus
  → User presses Tab/Enter or clicks elsewhere
      → onBlur / onKeyDown fires
      → partPickOpenRef=false → handleTypedPartSearch runs normally
      → Part not found → PartDialog opens ✅

User presses Enter / Tab / blurs input (no search button involved)
  → handleTypedPartSearch runs
  → 1 result → auto-select ✅
  → Multiple results → pick dialog opens ✅
  → 0 results → PartDialog opens ✅
```

## Verification
1. Start dev server (`pnpm dev`).
2. Open Purchase Entry → New Invoice → focus a part code cell.
3. Click search (🔍) button — only pick dialog should open; no PartDialog.
4. Type a nonexistent code in the pick dialog search; close dialog without selecting. Type the code directly in the part code field, press Enter — PartDialog should open.
5. Type a valid part code, press Tab — part should be auto-selected and focus moves to next field.
6. Type a partial code, press Enter — pick dialog should open with matching results.
