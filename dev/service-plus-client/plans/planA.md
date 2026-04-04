# Plan: Make New and View Tab Buttons More Prominent

## Objective
Improve the visibility and prominence of the "New" and "View" mode toggle buttons in the Purchase Entry module to enhance user navigation.

## Workflow
1. Identify the mode toggle component in `PurchaseEntrySection`.
2. Update the styling of the `Button` components and their container.
3. Increase size, font weight, and refine active states for better visual hierarchy.

## Steps

### Step 1 — Modify `PurchaseEntrySection` (Mode Toggle Styling)
- Target file: `src/features/client/components/inventory/purchase-entry/purchase-entry-section.tsx`
- Increase container padding and border style.
- Update `New` button:
    - Change height from `h-7` to `h-9`.
    - Change text from `text-xs` to `text-sm`.
    - Enhance active state: use a more distinctive emerald background or border.
- Update `View` button:
    - Change height from `h-7` to `h-9`.
    - Change text from `text-xs` to `text-sm`.
    - Enhance active state: use a more distinctive sky background or border.
- Adjust icons size if necessary.

---

## Technical Details
- Change Container: `p-0.5` → `p-1`
- Change Buttons: `h-7` → `h-9`, `text-xs` → `text-sm`
- Active State "New": `bg-[var(--cl-surface)] font-semibold text-emerald-600 shadow-sm` → `bg-emerald-600/10 text-emerald-600 font-bold border-emerald-200/50 shadow-sm`
- Active State "View": `bg-[var(--cl-surface)] font-semibold text-sky-600 shadow-sm` → `bg-sky-600/10 text-sky-600 font-bold border-sky-200/50 shadow-sm`
