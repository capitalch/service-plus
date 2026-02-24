# Plan: Complete Light Theme Overhaul

## Workflow
`root-element.tsx` (sidebar) → Super Admin index pages (v1/v2/v3)

---

## Design System (Light Theme)

**Color palette:**
- Primary: Indigo `#6366f1`
- Accent: Violet `#8b5cf6`
- Gradient BG: `from-slate-50 via-indigo-50/40 to-violet-50/30`
- Card: `bg-white border-slate-200`
- Text: `text-slate-800` (headings), `text-slate-500` (body)

---

## Step 1 — Redesign RootElement sidebar

**File:** `src/router/root-element.tsx` [MODIFY]
- Change overall background to `bg-slate-50`
- Change sidebar to `bg-white border-slate-200`
- Update text colors to `text-slate-800` and `text-slate-500`
- Update active state to light indigo `bg-indigo-50 text-indigo-700`

---

## Step 2 — Redesign Super Admin V1 index page

**File:** `src/features/super-admin/super-admin-page.tsx` [MODIFY]
- Text colors: `text-slate-800` (heading), `text-slate-500` (description)
- Heading gradient: `from-indigo-700 via-violet-600 to-indigo-500`
- Module cards: `bg-white border-slate-200 hover:shadow-lg`
- Card text: `text-slate-800` (title), `text-slate-500` (description)
- Arrow: `text-slate-300 group-hover:text-slate-500`

---

## Step 3 — Redesign Super Admin V2 & V3 index pages

**Files:** `super-admin-v2/super-admin-page.tsx`, `super-admin-v3/super-admin-page.tsx` [MODIFY]
- Apply same light theme structure as V1, maintaining their respective accent colors (emerald/teal for v2, violet/purple for v3).

Note: Sub-pages (like `AdminsPage`) already use standard light-themed shadcn components (`bg-white`, `text-slate-900`) so they fit naturally and require no change.
