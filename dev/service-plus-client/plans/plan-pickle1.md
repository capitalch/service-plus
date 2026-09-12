# UI/UX Modernization — "Soft & Layered" System Refresh

## Goal

Modernize the Service+ UI/UX in a single focused pass: unify control radius, elevate
surfaces with layered shadows and ambient depth, add global polish (scrollbars, selection,
caret), refresh the dashboard KPI/report cards, refine the client shell chrome, and bring
the auth screens up to the same quality bar — all without breaking the `--cl-*` token
system, the dual theme (dark/light), or any existing behavior.

---

## Present context and current design

The app has two parallel design languages:
1. **Client Mode** — dark-first, `--cl-*` CSS custom properties (`#0e0e0e`…`#1c1c1c`
   surfaces, `#007acc` accent), VS Code-style layout (activity bar + explorer + top nav
   + status bar), Inter Variable font, hairline `--cl-border` borders, minimal shadows.
2. **Auth/Admin/Super Admin** — light Tailwind slate/white palette, `shadow-sm` cards,
   indigo-branded login with framer-motion entrance animations.

Shared shadcn/ui primitives bridge both worlds but have internal inconsistencies:
- `Input` uses `rounded-sm`; `Button` and `Select` use `rounded-lg`.
- `DialogContent` and `AlertDialogContent` use `rounded-xl` with `ring-1` only (no
  elevated shadow).
- `KpiCard` and `ChartCard` use `rounded-lg shadow-sm`, which reads flat at scale.

The layout shell (explorer, top-nav, activity bar, status bar) is already functional but
the status bar is a flat hardcoded `#007acc` with hardcoded `text-slate-600` icon colors
(poor contrast), and there is no scrollbar styling, no `::selection` tint, and no ambient
background depth on the client shell.

---

## Key constraints of present design

- Red is reserved for errors only; never for decorative styling.
- All client data surfaces and controls must use `--cl-*` theme tokens (never raw hex).
- Radix portal content mounts inside `.client-theme` via `usePortalContainer()`.
- Both `help-content.ts` (staff) and `dev-help-content.ts` (developers) must be
  updated in the same change as any UI-relevant modification.
- `pnpm lint` + `pnpm exec tsc -b --noEmit` must pass clean; `pnpm format` on touched
  files.
- No tests exist; verification is lint + typecheck + build.
- shadcn/ui primitives are generated code — edit them in place, never hand-tune
  individual instances.

---

## New Design brief

### Design principles
1. **Consistent control language** — one radius family for controls (`rounded-lg` for
   inputs/selects/dialogs/buttons), softer overlays, cohesive elevation language.
2. **Layered surfaces** — replace flat `border + shadow-sm` with stacked elevation
   (ring/soft shadow + subtle glow) so cards read as elevated but calm.
3. **Ambient depth** — a subtle radial accent glow on the client background adds
   dimensionality; the status bar becomes a refined gradient; the login screen gets a
   modern mesh-gradient backdrop.
4. **Micro-details** — styled thin scrollbars, accent-tinted `::selection` and
   caret-color, hover-lift and press on interactive cards, polished overlay blur.
5. **Fresh first impression** — elevated glassy card + gradient background for login and
   reset-password screens.

### Palette additions (no token changes, purely additive styling)
- Overlay scrim: `bg-black/25 backdrop-blur-sm` (replaces `bg-black/10 backdrop-blur-xs`)
- Card shadow elevation: `shadow-[0_2px_24px_-12px_rgba(0,0,0,0.35)]` for dialogs and
  elevated cards; `shadow-[0_1px_3px_rgba(0,0,0,0.08)]` for KPI/chart cards.
- Ambient shell glow (dark mode): a radial gradient from `color-mix(in oklab,
  var(--cl-accent) 8%, transparent)` on `.client-theme`.
- Auth gradient: `bg-gradient-to-br from-indigo-100 via-white to-violet-50` (light).

---

## Files touched

| # | File | Change |
|---|------|--------|
| 1 | `src/index.css` | Scrollbar styling, `::selection`, `caret-color`, ambient gradient on `.client-theme` / `.sp-help-theme`, refined `--cl-border` in light mode (slightly softer). |
| 2 | `src/components/ui/input.tsx` | `rounded-sm` → `rounded-lg` (matches button/select). |
| 3 | `src/components/ui/dialog.tsx` | Overlay: `bg-black/25 backdrop-blur-sm`. Content: `rounded-2xl shadow-[0_2px_24px_-12px_rgba(0,0,0,0.35)]`. |
| 4 | `src/components/ui/alert-dialog.tsx` | Same overlay + content treatment as dialog. |
| 5 | `src/components/ui/select.tsx` | Content `shadow-md` → `shadow-lg`. |
| 6 | `src/components/ui/popover.tsx` | `rounded-md` → `rounded-lg`, `shadow-md` → `shadow-lg`, add `border-border`. |
| 7 | `src/features/client/components/reports/common/kpi-card.tsx` | `rounded-lg` → `rounded-xl`, add hover-lift (`-translate-y-px shadow-lg`), refined icon chip (`rounded-lg ring-1 ring-(--cl-border)`), stronger value type. |
| 8 | `src/features/client/components/reports/common/chart-card.tsx` | `rounded-lg` → `rounded-xl`, refine shadow to `shadow-[0_1px_3px_rgba(0,0,0,0.08)]`. |
| 9 | `src/features/client/components/reports/common/report-toolbar.tsx` | Same surface treatment as chart-card. |
| 10 | `src/features/client/components/layout/client-status-bar.tsx` | Gradient background, fix hardcoded `text-slate-600` icon → `text-white/80`. |
| 11 | `src/features/client/components/layout/client-top-nav.tsx` | Active nav pill: add `shadow-sm`, keep `rounded-md`. |
| 12 | `src/features/client/components/layout/client-explorer-panel.tsx` | Active tree item: `rounded` → `rounded-md`. |
| 13 | `src/features/auth/pages/login-page.tsx` | Gradient background, elevated glassy card (`shadow-lg ring-1 ring-white/20`). |
| 14 | `src/features/auth/components/login-form.tsx` | Button full-width: keep indigo; subtle `shadow-md` on submit button. |
| 15 | `src/features/auth/components/forgot-password-form.tsx` | Same button treatment. |
| 16 | `src/features/auth/pages/reset-password-page.tsx` | Gradient background, elevated card matching login. |
| 17 | `src/features/client/components/help/help-content.ts` | Add a FAQ to "What is Service+?" about the refreshed visual style. |
| 18 | `src/features/super-admin/components/help/dev-help-content.ts` | Update "UI Conventions & Theming" article: note the new scrollbar, selection, caret, radius, shadow conventions. |

---

## Implementation

### Step 1 — `src/index.css` (global foundation)

Add inside `.client-theme` (after existing declarations):
```css
/* Accent caret and selection */
.client-theme input, .client-theme textarea, .client-theme select {
  caret-color: var(--cl-accent);
}
.client-theme ::selection {
  background: color-mix(in oklab, var(--cl-accent) 35%, transparent);
}

/* Thin styled scrollbars */
.client-theme ::-webkit-scrollbar { width: 8px; height: 8px; }
.client-theme ::-webkit-scrollbar-track { background: transparent; }
.client-theme ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 9999px;
}
.client-theme ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

/* Ambient accent glow on background */
.client-theme::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(1100px 600px at 100% 0%, color-mix(in oklab, var(--cl-accent) 6%, transparent), transparent 55%);
}
```

Repeat the scrollbar and selection rules inside `.sp-help-theme` with the same
declarations.

### Step 2 — `src/components/ui/input.tsx`

Replace `rounded-sm` with `rounded-lg` in the base className string.

### Step 3 — `src/components/ui/dialog.tsx`

- `DialogOverlay`: replace `bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs` with `bg-black/25 duration-150 supports-backdrop-filter:backdrop-blur-sm`.
- `DialogContent` base class: add `shadow-[0_2px_24px_-12px_rgba(0,0,0,0.35)]` and change `rounded-xl` to `rounded-2xl`.

### Step 4 — `src/components/ui/alert-dialog.tsx`

Mirror Step 3:
- `AlertDialogOverlay`: `bg-black/25 backdrop-blur-sm duration-150`.
- `AlertDialogContent`: add `shadow-[0_2px_24px_-12px_rgba(0,0,0,0.35)]`, `rounded-xl` → `rounded-2xl`.
- `AlertDialogFooter`: `rounded-b-xl` → `rounded-b-2xl`.

### Step 5 — `src/components/ui/select.tsx`

`SelectContent`: `shadow-md` → `shadow-lg`.

### Step 6 — `src/components/ui/popover.tsx`

`PopoverContent`: `rounded-md border shadow-md` → `rounded-lg border border-border shadow-lg`.

### Step 7 — Dashboard surface (KPI + Chart + Toolbar)

**`kpi-card.tsx`:**
- Outer div: `rounded-lg` → `rounded-xl`, add `transition-all duration-200`.
- Hover (when clickable): add `hover:-translate-y-0.5 hover:shadow-lg hover:border-(--cl-accent)/20`.
- Active press: add `active:scale-[0.98]`.
- Icon chip: `rounded-md bg-(--cl-hover) p-1.5` → `rounded-lg bg-(--cl-hover) p-1.5 ring-1 ring-(--cl-border)`.
- Value: `text-2xl font-light` → `text-2xl font-semibold tracking-tight`.
- Remove `shadow-sm` from base (hover state provides elevation).

**`chart-card.tsx`:**
- Outer: `rounded-lg` → `rounded-xl`, replace `shadow-sm` with `shadow-[0_1px_3px_rgba(0,0,0,0.08)]`.

**`report-toolbar.tsx`:**
- Outer: `rounded-lg` → `rounded-xl`, replace `shadow-sm` with `shadow-[0_1px_3px_rgba(0,0,0,0.08)]`.

### Step 8 — Shell layout

**`client-status-bar.tsx`:**
- Replace `bg-[#007acc]` with `bg-gradient-to-r from-[#007acc] to-[#1589da]`.
- Replace `text-slate-600` (Network icon) with `text-white/80`.

**`client-top-nav.tsx`:**
- Active nav link: add `shadow-sm` after the existing classes.

**`client-explorer-panel.tsx`:**
- `TreeItem` active class: change `rounded` to `rounded-md`.

### Step 9 — Auth screens

**`login-page.tsx`:**
- Outer div: replace `bg-slate-50` with `bg-gradient-to-br from-indigo-100 via-white to-violet-50`.
- Card div: replace `border border-slate-200 rounded-xl shadow-sm` with `border border-white/60 rounded-2xl shadow-lg ring-1 ring-black/5`.

**`login-form.tsx`:**
- Submit button: add `shadow-md shadow-indigo-600/20` to the className.

**`forgot-password-form.tsx`:**
- Submit button: add `shadow-md shadow-indigo-600/20`.

**`reset-password-page.tsx`:**
- Outer div: replace `bg-slate-50` with `bg-gradient-to-br from-indigo-100 via-white to-violet-50`.
- Card: replace `rounded-2xl border border-slate-200 bg-white p-8 shadow-sm` with `rounded-2xl border border-white/60 bg-white p-8 shadow-lg ring-1 ring-black/5`.

### Step 10 — Help files

**`help-content.ts`** — add one FAQ to the "What is Service+?" article:
```
q: "Why does the interface look different after the latest update?"
a: "The UI was refreshed with softer rounded controls, layered card shadows, thin
    styled scrollbars, and an ambient accent glow on the client background. The
    login screen now shows a gradient backdrop. All functionality is unchanged."
```

**`dev-help-content.ts`** — append to the "UI Conventions & Theming" article content:
- A note about the scrollbar styling rule on `.client-theme` and `.sp-help-theme`.
- A note about `caret-color` and `::selection` being accent-tinted.
- A note about the radius language: inputs = `rounded-lg`, dialogs = `rounded-2xl`,
  KPI/chart cards = `rounded-xl`, badges = `rounded-4xl`.
- A note about the overlay scrim: `bg-black/25 backdrop-blur-sm` (not `bg-black/10`).
- A note about the ambient glow `::after` pseudo-element on `.client-theme`.

---

## Testing

1. `pnpm exec tsc -b --noEmit` — must be clean.
2. `pnpm lint` — must pass.
3. `pnpm build` — must succeed.
4. Visual spot-check: login page (gradient + elevated card), client shell (scrollbars,
   ambient glow, status bar gradient, explorer active item), dashboard (KPI card hover
   lift + rounded-xl), open a dialog (rounded-2xl + elevated shadow + stronger blur).
5. Both themes (dark and light) must render correctly — no transparent/missing elements.

---

## Flags and constraints

- The ambient glow `::after` is `pointer-events: none` and `z-index: 0` — it cannot
  intercept clicks or sit above content (which is `z-10+` in practice).
- The overlay scrim change from `10%` to `25%` makes dialogs/modals noticeably more
  focused; this is intentional and matches modern SaaS conventions.
- The `rounded-2xl` on dialogs shifts the visual slightly from `rounded-xl`; dialog
  footer rounded corners (`rounded-b-2xl`) must match the content radius.
- No new npm dependencies required — all changes are Tailwind class updates and CSS.
- Auth screens remain light-only (no dark theme variant for login/reset) — the gradient
  is light-mode appropriate.
