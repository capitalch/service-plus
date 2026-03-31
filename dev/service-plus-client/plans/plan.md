# Plan: Fix Select Brand Deselection Bug

## Root Cause

Radix UI `SelectContent` defaults to `position="item-aligned"`, which positions the
dropdown so the currently-selected item aligns with the trigger. To achieve this, Radix
**scrolls the viewport** immediately after the dropdown renders. This scroll event fires
on the document, which Radix's portal/dismiss logic treats as an "outside interaction,"
causing the dropdown to close before the user can interact.

**Symptom sequence**:
1. User opens Select (which has a pre-selected value, e.g. `list[0]` auto-selected on load)
2. Radix scrolls the page to align the selected item → triggers dismiss signal
3. Dropdown closes; no `onValueChange` fires → trigger shows old/placeholder value
4. On the **second** open: the scroll already happened so Radix skips it → dropdown stays
   open normally → works fine

This explains exactly why two clicks work but one doesn't.

---

## Fix

Change the default `position` in `src/components/ui/select.tsx` from `"item-aligned"`
to `"popper"`.

`"popper"` positions the dropdown anchored below/above the trigger (standard dropdown
behaviour). No scroll-to-align is performed, so the dismiss-on-scroll race condition
cannot occur.

The `SelectViewport` already has `popper`-mode styles applied via
`data-[position=popper]` selectors — no additional styling changes needed.

---

## Step 1 — `src/components/ui/select.tsx`

Change the `SelectContent` default:

```diff
- position = "item-aligned",
+ position = "popper",
```

One-line change. All `Select` instances across the app inherit the fix automatically.
Any callsite that explicitly passes `position="item-aligned"` is unaffected.

---

## Step 2 — Verification

- Open the Parts section → "Select Brand" control.
- First click: dropdown opens and stays open; select a brand → brand shown in trigger.
- Click elsewhere → value is retained.
- Repeat for other `Select` controls across the app (Add/Edit dialogs, filter bars) to
  confirm no visual regressions.

---

## Scope

| File | Change |
|---|---|
| `src/components/ui/select.tsx` | Default `position` → `"popper"` |

No component-level changes needed. One file, one line.
