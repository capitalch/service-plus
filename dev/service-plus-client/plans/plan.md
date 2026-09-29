# Plan — `service-plus-portal`: marketing site redesign, round 2

> This document records a large batch of UI/content changes already made, in the working tree,
> to `dev/service-plus-portal` (uncommitted at the time of writing — `git status` shows roughly
> 100 changed paths under that folder). It replaces this repo's previous `plans/plan.md`, which
> covered the unrelated "self-serve Lite signup + pooled database" feature (that content is not
> lost — it lives in `plans/prompt2.md` if that work resumes later). Per the planning protocol,
> nothing here is implemented as part of writing this file: it exists so the working tree's
> intent is written down before anything is committed. No other file (prompt file, history file,
> or the diff itself) needs to be open to understand it.

## Goal

Turn `service-plus-portal` — the Next.js 16 static-export marketing site that sells Service+ to
repair-shop owners (`dev/service-plus-portal`, dev port 3005, routes: home, features, pricing,
contact) — from its first-shipped state into a more complete, more polished site: a features
deep-dive page that didn't exist before, two legal pages the enquiry form's data collection
requires, a redesigned home page with more reasons to trust the product, a plan recommender, an
inline enquiry form on the contact page, an accessibility pass on the sales-enquiry form, and a
visual-design pass (motion, spacing tokens, a restored dark-mode background) across the whole
site. No server-side change and no new npm dependency are involved — everything reuses the
existing `POST /api/public/sales-enquiry` endpoint and packages already in `package.json`.

## Present context and current design

**What shipped before this round** (for readers with no other file open): `service-plus-portal`
already had three routes — `/` (hero, a static benefits strip, a feature card grid, a tabbed
screenshot gallery with a lightbox dialog, an empty testimonials section, a CTA band), `/pricing`
(four plan cards, a comparison table, an FAQ accordion, and `SalesEnquiryForm` — react-hook-form +
zod, `mode: "all"` so every field validated on every keystroke and the submit button stayed
disabled until the whole form was valid), and `/contact` (contact cards only, no form). The
enquiry form posts to `service-plus-server`'s `POST /api/public/sales-enquiry`
(`require_website_key` + a per-IP rate limit), which writes a `sales_enquiry` row and emails the
team; this round does not touch that endpoint or its contract. `content/testimonials.ts` was, and
still is, deliberately empty — inventing quotes attributed to named customers would be misleading
and risks India's consumer-protection advertising rules, so the component has always rendered
nothing until real, permissioned quotes exist. A `/features` page was planned once before (as
"Step 13" of the original build) but was never built; the home page's feature grid was the only
place features were described, in two sentences each.

**Repo conventions that constrain this redesign** (from this repo's `CLAUDE.md` files): tabs,
width 4, double quotes, semicolons, printWidth 120 (`pnpm format`); text longer than two words
lives in `constants/messages.ts`, control text (buttons/labels/placeholders) stays inline; no
`index.ts` barrel re-exports; arrow functions for components/hooks; `type` not `interface`, names
ending `Type`; alphabetical sorting of object properties, imports, array literals; red reserved
for errors and the required-field `*`; every layout responsive; forms use react-hook-form +
`useFieldArray`/zod with validation errors appearing immediately and submit disabled while
invalid. The last of these is the one place this round's actual change conflicts with the stated
rule — called out explicitly under **Flags and constraints** below, not glossed over.

## Key constraints of the present design

1. **Static export only.** `next.config.ts` keeps `output: "export"` and `trailingSlash: true`
   because hosting is MilesWeb shared cPanel serving static files — no Next API routes, no server
   actions. Every new page and component here is client-renderable or server-rendered at build
   time; nothing calls a server component data source.
2. **One enquiry endpoint, two entry points.** `POST /api/public/sales-enquiry` is the only
   backend call the site makes for lead capture. This round adds a second place that calls it
   (`/contact`'s new inline form) but does not add a second endpoint or change the payload shape.
3. **No real customer data in screenshots.** Every screenshot under `public/images/screens/`
   must come from the `demo` tenant, never a paying customer's data — a rule that applies equally
   to the 20 recaptured images and the 25 newly captured ones in this round.
4. **Testimonials stay empty until they're real.** Nothing in this round fabricates a quote,
   a customer count, a ranking, or a claimed result. Where the site needed something to fill the
   gap left by the empty testimonials section, the replacement (`content/proof.ts`) is restricted
   to facts about the product and the onboarding process, not claims about who uses it.
5. **No new dependency.** Every new visual/interaction pattern (3D pointer tilt, animated tab
   pill, count-up numbers, scroll progress bar) is built on `framer-motion`, `lucide-react` and
   `class-variance-authority`, which were already dependencies before this round — confirmed by
   `package.json` and `pnpm-lock.yaml` having no diff.

## New design brief

### 1. Navigation and page shell

- `SiteHeader` gains a "Features" nav link (between Home and Pricing), a scroll-position hook
  that switches the header from a transparent/no-border state to a bordered, blurred,
  slightly-shadowed one once the page has scrolled past 8px, and a 2px gradient `ScrollProgress`
  bar overlaid on the header's bottom border that fills as the visitor scrolls the page. The
  primary header CTA is now split in two: a plain "Login" button (ghost variant) and a new
  "Get started" button that deep-links to `/pricing#enquire`. The mobile nav `Sheet` gets the
  same two actions plus quick Call/WhatsApp buttons and the theme toggle, all pinned to the
  bottom of the sheet.
- `RootLayout` adds a "Skip to content" link (visually hidden until focused, first tab stop) and
  a fixed `MobileActionBar` — a three-button bar (Call / WhatsApp / Get started) pinned to the
  bottom of the viewport on small screens, hidden on `lg` and above where the header's own CTAs
  are already reachable, and hidden while the mobile nav sheet is open (it watches for a
  `[role=dialog]` appearing under `document.body`, which is how Radix's `Sheet` portals in).
- `SiteFooter` gains a fourth column ("Legal", linking to the two new legal pages), a WhatsApp
  link and a business-hours line in the Contact column, and bottom padding on mobile so its links
  don't sit under the new `MobileActionBar`.
- A shared `PageHero` component (title/eyebrow/intro over the site's grid background, with a
  gradient wash fading to transparent) replaces five pages' worth of hand-rolled hero markup —
  `/pricing`, `/contact`, `/features`, `/privacy` and `/terms` all render through it now, so their
  padding and heading treatment can no longer drift apart from each other. Its `align` prop lets
  the legal pages left-align their (much longer) intro paragraphs instead of centering them.
- A shared `SectionHeading` gains a `level` prop (`h1` for a `PageHero`, `h2` for a section inside
  the page) so heading semantics stay correct now that `PageHero` renders the page's one `<h1>`.

### 2. Home page

- **Hero**: the static dashboard screenshot is replaced by `HeroVisual` — a browser-chrome frame
  around the same dashboard screenshot, tilted in 3D toward the pointer (via two `framer-motion`
  springs driving `rotateX`/`rotateY`) with two floating UI chips ("Ready for pickup", "Parts
  consumed") that shift further than the frame rotates, which is what sells the depth. Falls back
  to the static, untilted composition under `prefers-reduced-motion`. The hero's secondary CTA
  changes from "Login" (redundant with the header's own Login button) to "Talk to us on
  WhatsApp", and a row of four trust points ("Free Lite plan, no card", "GST & non-GST
  invoicing", "Nothing to install", "Set up by our team") sits under the CTAs.
- **Stat strip**: `content/stats.ts` replaces the old hand-typed `benefits` array
  (`"100%"`/`"Live"`/`"GST"`) with four numbers *derived* from the site's own content — the total
  screenshot count across all groups, the number of feature areas, the number of plans, and the
  Enterprise plan's business-unit count — so the strip cannot drift out of sync with the product
  as those lists change. Each number animates up from zero on mount via a new `CountUp`
  component (writes straight to the DOM node from a motion-value subscription, so the animation
  causes zero React re-renders; skipped entirely under reduced motion, which keeps the final
  number static instead of animating).
- **New `OwnerBenefits` section**: four tiles ("Minimise spare-parts pilferage", "See technician
  output clearly", "Know your revenue and profit", "Control your inventory") pulled from a new
  `ownerBenefits` array in `content/features.ts`, using the same new `TileCard` component the
  feature grid now uses (see below).
- **Feature grid**: now renders `TileCard` instead of its own hand-rolled `<article>` markup, and
  each card links to `/features#<anchor>` — the matching deep-dive section on the new page.
  `TileCard` is a single component (icon chip, title, description, optional "See how it works"
  link) shared by the feature grid and the owner-benefits grid, replacing what had become twelve
  near-identical, copy-pasted article blocks.
- **New `ServiceCentreHighlight` banner**: a single full-width callout between the feature grid
  and the screenshot gallery, aimed at OEM-authorised service centres running several branches,
  with a "Talk to us" link to `/contact`.
- **Screenshot gallery**: the plain Radix `TabsList` is replaced by a new `AnimatedTabsList` that
  slides a highlight pill to the active tab, measured from the actual trigger element (so it
  stays correct regardless of label width, including the per-group shot counts shown next to each
  tab label) rather than computed from fixed widths; it re-measures on value change and on any
  resize via a `ResizeObserver`. The gallery's own lightbox dialog is replaced by the same
  `ScreenshotLightbox` component the new `/features` page uses (previous/next arrow buttons,
  left/right arrow-key paging, an "N of M" counter) — one lightbox implementation instead of two.
- **New `ProofSection`**: fills the gap left by the still-empty testimonials section with two
  honest substitutes — four "how onboarding actually works" steps (enquiry → account setup →
  team training → taking jobs) and four trust points (cloud + daily backups, role-based access,
  GST-ready, scales with you). Nothing here claims a customer count or a result.
- **Testimonial carousel**: still renders nothing while `content/testimonials.ts` is empty; when
  it does have entries, it now also renders previous/next buttons and dot pagination, tracked by
  observing which card sits closest to the scroll rail's left edge (a bare `overflow-x-auto` rail
  with no arrows gave a desktop visitor no hint that it could scroll at all).

### 3. New `/features` page

Ships what the original build's "Step 13" described but never built. One page, eight alternating
image/text sections, one per entry in `content/features.ts` — each entry now carries an `anchor`
(so the home page's cards can deep-link to one feature), a `detail` paragraph, a `highlights`
bullet list, and `screenshotFiles` (filenames resolved against `content/screenshots.ts` through a
new `findScreenshot(file)` lookup, so the home gallery and this page share one screenshot list
rather than forking a second one). A feature with no screenshots yet (role-based access) renders
a "Screenshot coming soon" placeholder instead of an empty gap. Clicking a screenshot opens the
same `ScreenshotLightbox` the home gallery uses, walking just that feature's own shots.

### 4. Pricing page

- Its hero moves to the shared `PageHero`.
- `PlanCard` gains a `selected` state — a ring and a "Selected" badge — so the plan grid visibly
  reflects what the enquiry form below it is currently set to (previously, clicking a card only
  scrolled the page; the form's own select was the only place showing which plan was chosen).
- New `PlanRecommender`: a four-question quiz ("How many people will use it?", "Do you keep spare
  parts in stock?", "Do you send job updates on WhatsApp?", "How many branches or business
  units?") that walks the plan list — cheapest to dearest — and recommends the first plan whose
  actual capabilities (from `content/pricing.ts`) satisfy every answer, so the recommendation is
  derived from the plan data rather than a separately hand-maintained mapping that could drift
  from it. Choosing the recommended plan feeds into the same `onSelect` the plan cards use.
- The comparison table gains two rows: "Branches" (unlimited on every plan) and a GST/non-GST
  billing row split out from the old combined "Reports & GST invoicing" row (now two rows:
  billing, and reports & analytics).

### 5. Contact page

Below the existing contact cards, a new "Send an enquiry" section renders `ContactEnquiryForm` —
a small wrapper that lets a visitor pick a plan as a row of chips (defaulting to Standard, since
`/contact` has no pricing table above it to preselect from) and then renders the same
`SalesEnquiryForm` used on `/pricing`, posting to the same endpoint. One component (the form
itself) is shared; only the plan-selection UI differs between the two pages.

### 6. Sales enquiry form — accessibility and validation rework

- A new `Field` wrapper owns each control's label, error text and ARIA wiring
  (`aria-describedby`/`aria-invalid`/`aria-required`) via a render-prop, so a field can no longer
  forget to wire them the way hand-repeating that markup eleven times risked.
- A new `ErrorSummary` renders above the form after a failed submit, listing every invalid field
  as a jump link, and receives focus (plus a smooth scroll into view) so a keyboard or
  screen-reader user lands on the list of problems first rather than having to discover them
  field by field.
- **Validation mode changed**: the form moved from `mode: "all"` (validate on every keystroke,
  keep the submit button disabled until the whole form is valid) to `mode: "onTouched"` +
  `reValidateMode: "onChange"` (a field's error appears once the visitor leaves it, then
  re-validates as they keep typing) and the submit button is no longer disabled while the form is
  invalid — it is only disabled while the request is in flight (`isSubmitting`). Invalid
  submissions now show the new `ErrorSummary` instead of being unreachable via a disabled button.
  See **Flags and constraints** — this is a real behavioural change from what this repo's
  `CLAUDE.md` states as the house rule for forms.
- A live character counter appears under the message field once it passes 90% of its 2000-
  character limit, and the GSTIN input auto-uppercases as the visitor types.
- The old "more than one branch → Enterprise suggested" inline hint is removed along with the
  `MESSAGES.branchesHint` string it used; nothing replaces it.

### 7. Enquiry success screen

`EnquirySuccess` now echoes back exactly what was submitted (name, business, mobile — with a
copy-to-clipboard button — email, city, branches, plan, and GSTIN if one was given) in a "What
you sent" recap block, turns the "what happens next" copy into a numbered three-step list ending
in "you sign in and start taking jobs", and adds a "call us on `<number>`" fallback line for a
visitor in a hurry. The payment-details block for paid plans is unchanged.

### 8. Two new legal pages

New `content/legal.ts` holds plain-language `privacy` and `terms` copy — what the site collects
through the enquiry form and why, how long it's kept, a visitor's rights, and the terms covering
plans/pricing/cancellation/liability/governing law (India, Kolkata jurisdiction) — each section
explicitly marked `TODO(real)` pending a lawyer's review before this goes live, and the company
name is filled in as "Kush Infotech" throughout (confirm this is the entity that should appear
before publishing). Both `/privacy` and `/terms` render through one new `LegalDocument`
component so the two pages can't visually drift apart, and the footer's new "Legal" column links
to both. The site needed these once the enquiry form started collecting personal data on two
pages instead of one.

### 9. Visual language

- **Dark mode background restored.** `--bg-decor` was `none` in dark mode before this round,
  leaving dark mode visually flat next to light mode's ambient wash; it now gets the same two
  radial gradients as light mode, at a deeper hue and lower alpha so they read as depth rather
  than a tinted overlay.
- **The ambient wash moved from `body`'s `background-image` (with `background-attachment: fixed`)
  to a fixed `body::before` pseudo-element**, because `background-attachment: fixed` is known to
  jank scrolling on iOS Safari; the opaque page background itself moved to `html` so it still
  paints behind the new pseudo-element's `z-index: -1` layer instead of covering it.
- **New spacing tokens** (`--spacing-section`, `--spacing-section-lg`, `--spacing-page`,
  `--spacing-page-lg`) replace the repeated literal `py-16 sm:py-20 px-4 lg:px-6` pairs that had
  been retyped on every section across the site, as Tailwind utilities `py-section`,
  `py-section-lg`, `px-page`, `px-page-lg` (and their `lg:` variants). One tunable place for the
  site's vertical rhythm and page gutter instead of N copies.
- **Three new utility classes**: `tab-underline` (a scale-in underline under an active tab
  trigger, cheaper than a measured sliding indicator — used where a full animated pill isn't
  warranted), `sheen` (one slow light-sweep across a gradient surface, applied to the CTA band so
  the whole band breathes, not just its button; paused rather than removed under reduced motion),
  and `card-lift` (the hover lift — translateY, border tint, shadow — shared by `TileCard` and
  the contact cards, so every card's hover state reads identically).

### 10. Screenshots

All 20 screenshots that existed before this round were recaptured and recompressed (each file is
now smaller — e.g. `dashboard.jpg` 121,729 → 97,064 bytes). 25 new screenshots were added
(`accounts-posting`, `batch-warranty-jobs`, `branch-switcher`, `branch-transfer`, `brands`,
`customer-connect`, `customers`, `delivered-jobs-detailed`, `extended-warranty`,
`extended-warranty-leads`, `job-pipeline`, `jobs-summary`, `numbering-auto-series`,
`part-used-job`, `post-unpost`, `products`, `stock-adjustment`,
`technician-profit-revenue`, `technicians`, `vendor-supplier`, `warranty-jobs`,
`warranty-parts`, `whatsapp-notifications`, and two more warranty/extended-warranty variants),
and `branches.jpg` was deleted, superseded by the new `branch-switcher.jpg`. The gallery's four
tab groups (Jobs, Inventory, Reports, "Team & accounts") become five (Jobs — 9 shots, Inventory —
8, Reports — 14, Warranty — 5, Setup — 6; 42 shots total): "Team & accounts" is retired in favour
of a dedicated Warranty group and a Setup group that absorbed the old team/branches shots plus
the new ones. Both the home gallery and the new `/features` page read from this one list via
`findScreenshot`.

### 11. Developer documentation

`src/features/super-admin/components/help/dev-help-content.ts`'s existing portal article (in
this client repo) is already updated as part of this round to say the portal's routes are now
home/features/pricing/contact, to describe the 5 screenshot groups and 42 total shots plus
`findScreenshot`, to add an entry for `content/features.ts`'s new shape, and to note that
role-based-access has no `screenshotFiles` yet (rendering the placeholder) and that
Branches & business units is captured via the header's branch switcher and Inventory's Branch
Transfer screen rather than a Masters/Configurations list page, which was deliberately excluded.
No `help-content.ts` (staff-facing) change is needed — this is all public-site content.

## Files touched

**New pages**
- `dev/service-plus-portal/app/features/page.tsx`
- `dev/service-plus-portal/app/privacy/page.tsx`
- `dev/service-plus-portal/app/terms/page.tsx`

**New components**
- `components/home/hero-visual.tsx`, `owner-benefits.tsx`, `proof-section.tsx`,
  `service-centre-highlight.tsx`
- `components/layout/animated-tabs.tsx`, `count-up.tsx`, `legal-document.tsx`,
  `mobile-action-bar.tsx`, `page-hero.tsx`, `scroll-progress.tsx`, `tile-card.tsx`
- `components/pricing/plan-recommender.tsx`
- `components/contact/contact-enquiry-form.tsx`
- `components/features/feature-detail-section.tsx`, `feature-screenshots.tsx`
- `components/screenshots/screenshot-lightbox.tsx`

**New content**
- `content/legal.ts`, `content/proof.ts`, `content/stats.ts`

**New screenshots** (25 files, listed in §10 above) under `public/images/screens/`

**Modified — app shell**
- `app/layout.tsx` (skip link, `MobileActionBar`)
- `app/globals.css` (dark-mode `--bg-decor`, spacing tokens, `tab-underline`/`sheen`/`card-lift`)
- `app/sitemap.ts` (adds `/features/`, `/privacy/`, `/terms/`)
- `app/not-found.tsx` (spacing-token class rename only)

**Modified — pages**
- `app/page.tsx` (adds `OwnerBenefits`, `ServiceCentreHighlight`, `ProofSection`)
- `app/pricing/page.tsx` (moves to `PageHero`)
- `app/contact/page.tsx` (moves to `PageHero`, adds the inline enquiry section)

**Modified — layout components**
- `components/layout/reveal.tsx` (`y`/`id` props, explicit reduced-motion offset)
- `components/layout/section-heading.tsx` (`level`, `align` props)
- `components/layout/site-header.tsx` (Features nav item, scroll state, `ScrollProgress`, split
  Login/Get-started CTAs, richer mobile sheet)
- `components/layout/site-footer.tsx` (Legal column, WhatsApp link, business hours, mobile
  bottom padding)
- `components/layout/theme-toggle.tsx` (`variant` prop)

**Modified — home components**
- `components/home/hero.tsx` (renders `HeroVisual`, WhatsApp CTA, trust points)
- `components/home/benefit-strip.tsx` (renders `content/stats.ts` via `CountUp`)
- `components/home/feature-grid.tsx` (renders `TileCard`, links to `/features#anchor`)
- `components/home/screenshot-gallery.tsx` (`AnimatedTabsList`, shared `ScreenshotLightbox`)
- `components/home/testimonial-carousel.tsx` (prev/next buttons, dot pagination)
- `components/home/cta-band.tsx` (`sheen` utility, kicker line)

**Modified — pricing components**
- `components/pricing/plan-card.tsx` (`selected` state)
- `components/pricing/pricing-section.tsx` (renders `PlanRecommender`)
- `components/pricing/plan-comparison-table.tsx` (Branches row, split billing/reports rows)
- `components/pricing/sales-enquiry-form.tsx` (`Field`/`ErrorSummary`, validation-mode change —
  see §6 and **Flags and constraints**)
- `components/pricing/enquiry-success.tsx` (submission recap, copy-mobile button, numbered steps)
- `components/pricing/faq.tsx` (spacing-token class rename only)

**Modified — contact components**
- `components/contact/contact-cards.tsx` (`card-lift`, button-style actions, extra business-hours
  line)

**Modified — content and constants**
- `content/features.ts` (`FeatureType` gains `anchor`/`detail`/`highlights`/`screenshotFiles`;
  `benefits` removed in favour of `content/stats.ts`; new `ownerBenefits` array)
- `content/screenshots.ts` (`findScreenshot`, 5 groups instead of 4, 42 shots)
- `content/site-config.ts` (adds the Features nav item)
- `constants/messages.ts` (new copy keys for the sections above; `branchesHint` removed)

**Already applied in this repo (`service-plus-client`)**
- `src/features/super-admin/components/help/dev-help-content.ts` — portal developer article
  updated per §11.

## Implementation

All of the following is already done in the working tree (uncommitted); the numbering below
mirrors the design sections above so a reviewer can trace each change back to its rationale.

- **Step 1 — Page shell.** Skip link, `MobileActionBar`, header scroll state + `ScrollProgress`,
  split header CTAs, footer Legal column, shared `PageHero`/`SectionHeading` `level` prop.
- **Step 2 — Home page redesign.** `HeroVisual`, `CountUp`-driven stat strip from
  `content/stats.ts`, `OwnerBenefits`, `TileCard`-based feature grid, `ServiceCentreHighlight`,
  `AnimatedTabsList` + shared `ScreenshotLightbox` in the gallery, `ProofSection`, carousel
  paging controls.
- **Step 3 — `/features` page.** `content/features.ts` extended, `FeatureDetailSection` +
  `FeatureScreenshots` + `findScreenshot`, wired into `app/features/page.tsx` and the sitemap.
- **Step 4 — Pricing page.** `PageHero`, `PlanCard` selected state, `PlanRecommender`, comparison
  table rows.
- **Step 5 — Contact page.** `PageHero`, `ContactEnquiryForm` wrapping the shared
  `SalesEnquiryForm`.
- **Step 6 — Enquiry form accessibility/validation rework.** `Field`, `ErrorSummary`,
  validation-mode change, character counter, GSTIN auto-uppercase.
- **Step 7 — Enquiry success recap.** Submission echo, copy-mobile button, numbered steps.
- **Step 8 — Legal pages.** `content/legal.ts`, `LegalDocument`, `/privacy`, `/terms`, footer
  links, sitemap entries.
- **Step 9 — Visual language pass.** Dark-mode `--bg-decor`, fixed-layer ambient wash, spacing
  tokens, `tab-underline`/`sheen`/`card-lift` utilities.
- **Step 10 — Screenshots.** Recapture/recompress the existing 20, add 25 new ones, delete
  `branches.jpg`, regroup into 5 tab groups.
- **Step 11 — Developer docs.** `dev-help-content.ts` portal article updated.

Nothing here has been committed yet — this plan document itself makes no commit and changes no
code; it exists to describe the working tree as it stands.

## Testing

1. `pnpm lint`, `pnpm exec tsc --noEmit` (or `--noEmit` equivalent for the portal package) and
   `pnpm build` all clean; `out/features/index.html`, `out/privacy/index.html` and
   `out/terms/index.html` exist alongside the pre-existing routes.
2. Click through every route in both themes, including the two new legal pages, and confirm the
   footer's Legal links and the sitemap both resolve.
3. Home page: confirm the stat strip's numbers actually match `features.length`,
   `screenshotGroups` total, `plans.length`, and the Enterprise plan's `businessUnits`, so
   `content/stats.ts`'s "derived, not typed in" claim holds after any future content edit.
4. `/features`: every feature except "Role-based access" shows its screenshots; that one shows
   the "Screenshot coming soon" placeholder; the lightbox arrow keys and counter work per feature.
5. `/pricing`: the recommender's four question paths each land on the plan its stated reasons
   actually justify (spot-check a "just me, no inventory, no WhatsApp, one branch" path lands on
   Lite, and a "4+ people" path never lands on Lite or Basic).
6. Sales enquiry form (both `/pricing` and the new `/contact` instance): submitting with fields
   empty shows the `ErrorSummary`, moves focus to it, and each listed link jumps to and focuses
   the right field; a field's error now appears on blur, not on the first keystroke; the honeypot
   still silently "succeeds"; the message counter turns destructive-colored past 1800 characters;
   the success screen's recap matches exactly what was typed, and the copy-mobile button copies
   the right number.
7. Mobile (390px width): the `MobileActionBar` is visible and its three actions work; it hides
   while the nav sheet is open and does not sit under the footer's links; the header's `ScrollProgress`
   bar visibly fills while scrolling a long page (e.g. `/features`).
8. Reduced motion (`prefers-reduced-motion: reduce`): `HeroVisual` renders untilted with no
   pointer tracking; `CountUp` shows the final number immediately with no animation; the `sheen`
   sweep and `card-lift` translate are both suppressed; `Reveal`-wrapped sections still appear
   (opacity fade only, no slide).
9. Dark mode: confirm the restored `--bg-decor` wash is visible and reads as depth, not as a flat
   tint over content, on a long-scrolling page.
10. Re-confirm the screenshot rule: none of the 25 new captures under `public/images/screens/`
    contain real customer names, mobile numbers, or other non-demo-tenant data.

## Flags and constraints

- **Validation-mode change conflicts with a stated house rule.** This repo's `CLAUDE.md` says
  forms must show validation errors immediately and disable submit while invalid;
  `sales-enquiry-form.tsx` was rewritten in this round to validate on blur/change instead of on
  every keystroke, and to disable submit only while the request is in flight, relying on the new
  `ErrorSummary` to catch anything left invalid at submit time. This is a considered accessibility
  trade-off (a perpetually-disabled submit button gives a screen-reader user no way to discover
  *why* they can't submit), but it is a real deviation from the written rule and needs an explicit
  decision — keep the new behaviour and update the rule, or revert the form to validate-and-lock
  submit and drop the `ErrorSummary`/`Field` accessibility work that depends on submission being
  reachable while invalid.
- **Legal pages are placeholder copy.** Every section in `content/legal.ts` is marked
  `TODO(real)` and needs a lawyer's review before `/privacy` or `/terms` goes live; the company
  name "Kush Infotech" is hardcoded there and should be confirmed as the correct legal entity
  before publishing.
- **Testimonials are still empty on purpose.** `ProofSection` is an honest stand-in, not a
  permanent replacement — when real, permissioned testimonials exist, `content/testimonials.ts`
  should be filled in and the carousel will start rendering again alongside `ProofSection`, not
  instead of it (the plan doesn't say which order they should appear in once both are populated —
  a decision for whoever adds the first real testimonial).
- **No server or dependency change.** This entire round is front-end content, layout and motion
  work on top of the existing `sales-enquiry` endpoint and existing npm dependencies; nothing here
  requires a `service-plus-server` deploy or a `pnpm install`.
- **Nothing is committed.** `git status` at the time of writing shows every file in this plan as
  modified/added/deleted but not staged or committed — normal review (lint, build, manual
  click-through per **Testing** above) should happen before that.
