# Plan: Fix Disappearing Actions Header Label

## Problem Statement
The "Actions" column header label (the text) becomes invisible or flickers when scrolled. This is caused by "sticky-on-sticky" rendering conflicts between the `thead` and the nested `th`, causing the browser to miscalculate the layering order.

## Root Cause Analysis
- Current structure: `<thead className="sticky top-0">` wrapping `<th className="sticky top-0 right-0">`.
- Nested sticky elements can cause children to be clipped or covered by the parent's background in some rendering engines.
- Best practice for complex table headers is to apply stickiness directly to the `th` cells.

## Goal
Stabilize the header rendering so all labels remain visible during scroll.

---

## Workflow

1. **Cell-Level Stickiness**: Move the vertical sticky anchor from the `thead` container to the individual `th` cells.
2. **Layering Correction**: Ensure the "Actions" cell has a higher `z-index` than other headers to prevent labels from bleeding through during horizontal scroll.

---

## Steps

### Step 1 — Update thClass
**File:** `purchase-entry-section.tsx`
- Add `sticky top-0 z-20` to the `thClass` definition.
- This ensures all headers stay at the top.

### Step 2 — Simplify thead
**File:** `purchase-entry-section.tsx`
- Change `<thead className="sticky top-0 z-10">` to just `<thead>`.

### Step 3 — Verify Actions th
**File:** `purchase-entry-section.tsx`
- Ensure the Actions header remains `sticky top-0 right-0 z-30`.
- The higher `z-index` (`z-30` vs `z-20`) ensures it remains the top-most layer in the corner.

---

## Files to Modify
| File | Change |
|------|--------|
| `purchase-entry-section.tsx` | Shift sticky classes from thead to thClass |
