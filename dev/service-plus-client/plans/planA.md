# Plan: Better UI for StockSnapshotTrigger

## Current State
The current UI is a simple Card with:
- A number `<Input>` for Year (can type any number, error-prone)
- A `<Select>` dropdown for Month (12 items in a list)
- A submit button

---

## UI Improvement Suggestions

### Suggestion 1 — Visual Month Grid (replaces the dropdown)
Instead of a 12-item dropdown, render the months as a **3×4 grid of toggle-buttons**.
- User clicks a month name directly — no dropdown to open/scroll
- Selected month is highlighted with the accent colour
- Much faster to scan and select (tap-friendly on mobile too)

### Suggestion 2 — Year Spinner with Arrows (replaces the number input)
Replace the raw `<input type="number">` with a **← YYYY →** stepper:
- Left / Right arrow buttons decrement / increment the year
- Year displayed as a large bold label in the centre
- Clamps at `min=2020` and `max=currentYear` — no invalid input possible
- Eliminates typo risk entirely

### Suggestion 3 — Current Period Indicator
Add a small tag above the form showing **"Current period: Month YYYY"**
(derived from `defaultMonth` / `defaultYear`), so the user can immediately
see what the pre-selected period means before hitting Generate.

### Suggestion 4 — Confirmation Step
Generating a snapshot is a meaningful server operation.
Add an **`AlertDialog`** confirmation before the form submits:
> "Regenerate stock snapshot for April 2025? This will overwrite any existing snapshot for this period."
- Prevents accidental triggers
- Uses shadcn `AlertDialog` (already available in the project)

### Suggestion 5 — Info Banner in Card Header
Add a subtle info `Alert` below `CardDescription` that explains the use case:
> "ℹ️ Use this after entering back-dated transactions to keep your stock snapshot accurate."

---

## Recommended Implementation Order
1. Step 1 — Month grid (highest impact, replaces dropdown)
2. Step 2 — Year stepper (eliminates invalid input risk)
3. Step 3 — Current period indicator
4. Step 4 — Info banner
5. Step 5 — Confirmation dialog

---

## Files Affected
| File | Change |
|------|--------|
| `stock-snapshot-trigger.tsx` | Replace Select+Input with month grid + year stepper; add banner + confirm dialog |
