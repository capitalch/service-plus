# Visual Improvement Plan — Purchase Entry Form (`new-purchase-invoice.tsx`)

## Current Pain Points

| Area | Issue |
|------|-------|
| Purchase Return toggle | Absolute-positioned badge (`-top-3 -left-1`) clips outside the card — fragile, awkward on all screen sizes |
| Header grid | 12-col span with no visual grouping; fields feel unrelated; no `md` breakpoint |
| Lines table | 13 columns on `min-w-[1000px]`; input and computed columns look identical; warranty is a plain raw checkbox |
| Computed columns | Same visual weight as editable columns — user can't tell what is editable vs read-only |
| Table footer | `tfoot` label "computed Amount" is inconsistent casing; colspan math is fragile; "Saved Invoice Values" row in edit mode is disconnected |
| Responsive | Jumps from `sm` (2-col) straight to `lg` (12-col); no `md` treatment; horizontal scroll on ≥1000px tables |
| Visual hierarchy | Form is flat — no section labels, no grouping cues, header card and lines card look like continuation of the same block |

---

## Improvement Plan

### Fix 1 — Replace the "Purchase Return" FAB with an inline section banner

**Current:** Tiny absolute-positioned label overlapping the card top-left edge.

**Change:** Remove `absolute -top-3 -left-1` positioning entirely. Place the Return toggle as a **prominent banner row** immediately inside `CardContent`, spanning full width, only visible when `isReturn` is true (collapsed otherwise). In new mode, show it as a styled toggle button in the header bar (similar to the IGST toggle, same row as Brand/New/View).

```
[ Purchase Return ] toggle button — in section header bar, right side, beside IGST switch
When active → card gets amber/red tinted top border (4px solid red-500) instead of background colour change on the whole card
```

---

### Fix 2 — Header fields: grouping, spacing, and `md` breakpoint

**Current:** One flat grid with 5 fields on `lg:grid-cols-12`.

**Change:**
- Switch from `lg:grid-cols-12` to two distinct rows using `grid` with clearer labels:
  - **Row 1 (Invoice Identity):** Supplier `lg:col-span-4` | Invoice No `lg:col-span-2` | Inv Date `lg:col-span-2` | State `lg:col-span-2` | Remarks `lg:col-span-2`
  - Add `md:grid-cols-6` as an intermediate breakpoint: Supplier(2) | Invoice No(2) | Date(1) | State(1) on row 1; Remarks full on row 2
- Add a thin horizontal divider `border-t border-[var(--cl-border)]` between the header card and lines card with a section label:
  ```
  ─── Line Items ──────────────────────────
  ```
- Give `CardContent` slightly more vertical padding (`pt-5 pb-4`) so fields don't feel squeezed.
- Show the duplicate-invoice error inline under the Invoice No field (already done) — keep as-is.

---

### Fix 3 — Lines table: separate editable vs computed columns visually

**Current:** All 13 columns use identical cell padding and background — impossible to tell input from output at a glance.

**Changes:**

**a) Computed column shading**
Apply `bg-[var(--cl-surface-2)]/40` to the `<td>` cells for Aggregate, CGST, SGST/IGST, and Total columns. Add a subtle left-border separator before the Aggregate column:
```
border-l border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40
```

**b) Warranty column — replace raw checkbox with icon-toggle button**
Replace the `<input type="checkbox">` with a styled icon button (shield icon from lucide):
```
Unchecked: ShieldOff icon — muted colour, border
Checked:   ShieldCheck icon — accent/emerald colour, filled bg
```
Same pattern as the IN/OUT toggle in loan entry. This makes it immediately recognisable and touch-friendly.

**c) Reduce table min-width**
Change `min-w-[1000px]` → `min-w-[860px]`. Achieved by:
- Merging Remarks column from `12%` → `8%` (truncated, with title tooltip)
- Combining CGST + SGST into a single "Tax" column header when `!isIgst` (show both amounts stacked: `CGST / SGST` two-line cell) — saves one full column width
- Shrinking `#` column from `3%` → `2%`

**d) Column header rename**
- `Warr` → shield icon only (no text) with `title="Under Warranty"`
- `Aggregate` → `Subtotal`
- `GST(%)` → `GST %`
- `Actions` header → empty (already empty in some implementations — confirm and unify)

---

### Fix 4 — Replace `tfoot` totals with a sticky summary bar

**Current:** `tfoot` rows with raw `colSpan` arithmetic — breaks when columns change (e.g., IGST vs CGST/SGST toggle).

**Change:** Remove `tfoot` entirely. Add a **summary bar** as a separate `div` below the table card, styled like a footer panel:

```
┌─────────────────────────────────────────────────────────────────┐
│  Lines: 4   Qty: 12   Subtotal: ₹4,200.00   Tax: ₹756.00   Total: ₹4,956.00  │
└─────────────────────────────────────────────────────────────────┘
```

- Use `flex flex-wrap justify-end gap-x-6 gap-y-1` pill layout
- Each stat: label (muted, tiny caps) + value (bold, tabular-nums)
- Total amount: larger font, accent colour, `text-base font-black`
- In edit mode: add a second row in the same bar showing "Saved Total: ₹X" in amber
- This approach is fully responsive (wraps naturally on small screens), no colspan math

---

### Fix 5 — Responsive improvements

**Current:** Two breakpoints only (`sm:grid-cols-2` and `lg:grid-cols-12`) with no `md`.

**Changes:**
- Header: add `md:grid-cols-8` as described in Fix 2
- Lines table: on `sm` and below, show a simplified card-per-line view instead of the horizontal-scroll table (collapsible row expansion) — OR — add a notice `"Scroll right to see all columns"` with a faint right-shadow indicator on the table container
- Summary bar (Fix 4): `flex-wrap` already handles this

---

### Fix 6 — Visual hierarchy and polish

**a) Section labels**
Add small uppercase section labels above each card:
```
INVOICE DETAILS          ← above header card
LINE ITEMS               ← above lines card
```
Style: `text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1`

**b) Purchase Return state — card accent border instead of background flood**
When `isReturn`:
- Replace `bg-red-50 dark:bg-red-950/20` on both cards with a left accent border: `border-l-4 border-l-red-500`
- Add a small pill badge in the header section label: `[ RETURN ]` in red
- This is less visually noisy than flooding the whole card background

**c) Read-only cell typography**
Computed cells (Subtotal, Tax, Total per line): use `font-mono tabular-nums text-[var(--cl-text-muted)]` for computed middle values, and `font-mono tabular-nums font-semibold text-[var(--cl-text)]` for the line total. This creates a clear distinction: muted mono = calculated, regular = editable.

**d) Row hover**
Current: `hover:bg-[var(--cl-surface-2)]/30` — keep as-is, it works well.

**e) Header card shadow**
Change `shadow-sm` → `shadow-md` on the header card only, to give it visual precedence over the lines table below.

---

## Files to Change

| File | Changes |
|------|---------|
| `new-purchase-invoice.tsx` | Fixes 1, 2, 3a–3d, 4, 6a–6e |
| `purchase-entry-section.tsx` | Fix 1 (move Return toggle to section header bar) |

No new files needed.

---

## Workflow

```
Fix 1 (Return toggle) → Fix 2 (header grid) → Fix 3 (lines table) → Fix 4 (summary bar) → Fix 5 (responsive) → Fix 6 (polish)
```
