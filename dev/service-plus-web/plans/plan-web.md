# Redesign: Left Nav Shell

Source request: `plans/prompt.md`
> Provide left Nav Bar and nicely put into it, Job status, Genuine Parts, AI Repair help. Display area will be in middle. Make it responsive on tabs and mobile.

## 1. Current state

- App shell (`app/layout.tsx`): `<Header>` (sticky **top** bar) → `<main>{children}</main>` → `<Footer>`.
- Nav lives in `components/layout/header.tsx`, driven by `components/layout/nav-items.ts` (3 items: Track repair `/`, Buy genuine parts `/spare-parts`, AI repair help `/ai-repair-help`, with a "Soon" badge on the last).
- Desktop: horizontal links in the header. Mobile: hamburger → right-side `Sheet` drawer (`components/ui/sheet.tsx`) reusing the same `navItems`.
- `Footer` also repeats `navItems` as a link row.
- Pages are full-bleed, centered at `max-w-6xl` (`app/page.tsx`, `app/spare-parts/page.tsx`, `app/ai-repair-help/page.tsx`).
- Design tokens (`app/globals.css`) already define `--radius`, brand gradient, `oklch` light/dark palettes — reuse these, don't add new ones.

## 2. Target shell

Replace the top-nav shell with a left-nav shell, with three responsive states:

| Breakpoint | Sidebar | Top bar |
|---|---|---|
| Desktop `lg:` (≥1024px) | Persistent, expanded (`w-64`), icon + label, always visible | none — sidebar carries logo + theme toggle |
| Tablet `md:` (768–1023px) | Persistent, collapsed to icon rail (`w-[4.5rem]`), icons + tooltip on hover | none |
| Mobile `<md` (≤767px) | Hidden | Slim sticky top bar: logo, hamburger, theme toggle. Hamburger opens a **left**-sliding `Sheet` with the full expanded nav (reuse existing `Sheet` primitive, just change `side="left"`) |

Layout structure in `app/layout.tsx`:

```
<body class="flex min-h-screen">
  <Sidebar />                          {/* hidden below md, rail md–lg, full lg+ */}
  <div class="flex min-w-0 flex-1 flex-col">
    <MobileTopBar />                   {/* md:hidden */}
    <main class="min-w-0 flex-1">{children}</main>
    <Footer />
  </div>
</body>
```

`Sidebar` and `MobileTopBar` both need `usePathname()` for active-state, so both stay client components, same as today's `Header`.

## 3. Nav content

Align labels to the prompt's wording (currently mismatched) and keep hrefs/icons/badge as-is:

- `components/layout/nav-items.ts`
  - `"Track repair"` → `"Job status"` (href `/`, icon `Wrench`)
  - `"Buy genuine parts"` → `"Genuine parts"` (href `/spare-parts`, icon `PackageSearch`)
  - `"AI repair help"` stays (href `/ai-repair-help`, icon `Bot`, badge `"Soon"`)

No routing changes — same 3 routes, same page components.

## 4. Files to add

- `components/layout/sidebar.tsx` — the persistent left nav (desktop expanded / tablet rail). Contains:
  - `Logo` at top (compact/icon-only variant when rail-collapsed — check if `Logo` needs a `compact` prop, or just hide the wordmark text below `lg:`)
  - `navItems.map(...)` vertical list, active state via `pathname === item.href` (same logic as current `Header`)
  - `ThemeToggle` pinned at the bottom of the sidebar
  - Icon-rail mode (`md:` only, not `lg:`): icons centered, label hidden, tooltip on hover/focus (Radix `Tooltip` — check if already imported anywhere; if not, add via `radix-ui` which is already a dependency)
- `components/layout/mobile-topbar.tsx` — slim bar: `Logo`, hamburger (`Sheet` trigger), `ThemeToggle`. The `Sheet` body reuses the same vertical nav list markup as `Sidebar`'s expanded state — consider extracting a shared `<NavList collapsed={bool} onNavigate={...} />` component used by both `Sidebar` and the mobile `Sheet`, so active-state styling and markup aren't duplicated three ways.

## 5. Files to modify

- `app/layout.tsx` — swap `<Header />` for `<Sidebar />` + `<MobileTopBar />` in the flex-row shell described in §2.
- `components/layout/nav-items.ts` — label updates (§3).
- `components/layout/footer.tsx` — nav is now always visible in the sidebar/drawer, so the footer's repeated nav row becomes redundant. Simplify `Footer` to just the logo blurb + copyright (drop the `navItems.map` link row), unless keeping it is preferred for SEO/footer-link convention — flag this as a call to confirm during implementation rather than deciding silently.
- Delete `components/layout/header.tsx` once `Sidebar`/`MobileTopBar` fully replace it (confirm nothing else imports it first — check `app/**` and `components/**` for `from "@/components/layout/header"`).

## 6. Content-area fallout to check

The three pages currently assume a full-width top nav and center themselves at `max-w-6xl` in the viewport. With a persistent `lg:` sidebar (`w-64`) eating horizontal space, verify each page still reads well in the narrower remaining column:

- `components/home/hero.tsx` — two-column grid (`lg:grid-cols-[1.1fr_0.9fr]`) inside `max-w-6xl`; re-check it doesn't feel cramped once the effective viewport is `100vw - 16rem`.
- `app/spare-parts/page.tsx` — grid/filter row (`sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]`) and `PartsGrid` — check column counts still make sense at typical laptop widths minus the sidebar.
- `app/ai-repair-help/page.tsx` — centered `max-w-2xl` block, low risk.

No code changes anticipated here beyond possibly trimming `max-w-6xl` → `max-w-5xl`/adjusting padding if things look tight — decide visually during implementation, not upfront.

## 7. Implementation order

1. Update `nav-items.ts` labels.
2. Build `Sidebar` (desktop expanded state only first), wire into `layout.tsx` behind `lg:flex hidden`, confirm existing pages still render correctly with `Header` temporarily still present for `<lg:`.
3. Add tablet rail collapse state (`md:` to `lg:`) to `Sidebar`.
4. Build `MobileTopBar` + left `Sheet` drawer, wire in behind `md:hidden`.
5. Remove old `Header`, delete the file, grep for stale imports.
6. Simplify or keep `Footer` per §5 decision.
7. Visual pass on all 3 pages at desktop/tablet/mobile widths, light + dark theme, per §6.
8. Manual smoke test: nav active-states on all 3 routes, theme toggle from both sidebar and mobile drawer, spare-parts flow (company/branch select → cart → checkout) and job-status flow still functional (pure layout change, but confirm no regressions).

## 8. Out of scope

- No changes to page business logic (`lib/api.ts`, `lib/use-cart.ts`, forms, etc.).
- No new routes or nav items beyond the 3 named in the prompt.
- No changes to the color/token system in `globals.css`.
