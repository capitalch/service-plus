# Plan — `service-plus-portal`: public marketing & pricing website

> Source: `plans/prompt1.md`. Implemented 2026-09-27; see the step markers for what is left.
> Builds on `plans/improvements/plan-market-site.md` (hosting and deploy analysis), and keeps its package name,
> **`service-plus-portal`**. One thing changes: the pricing page's
> enquiry form now needs a **server endpoint**. That plan assumed a site with no API at all.

## Goal

A new Next.js site, `dev/service-plus-portal/`, that sells Service+ to repair-shop owners:

- **Home**: features, benefits, product screenshots, testimonials.
- **Pricing**: four plans (Lite, Basic, Standard, Enterprise), setup fees, and an enquiry form that
  captures who wants which plan, so the team can provision it by hand.
- **Contact**: mobile number, email address and street address.

## Present context and current design

| Project | What it is | Relevance |
|---|---|---|
| `dev/service-plus-web` | Next.js 16 static export for **end customers** (track repair, buy parts), port 3002 | Same stack; copy its `globals.css` oklch tokens, `lib/api.ts` `publicPost` + `X-Website-Key` pattern, and the `deploy/` script |
| `../kush-infotech-web` | Next.js 16 static export, the parent-company marketing site, port 3004 | Closest model. It has `typedRoutes`, `site-config.ts`, a `TestimonialCard`, a `ScreenshotGallery`, and **20 Service+ screenshots already captured** in `public/images/products/*.jpg` |
| `service-plus-server` `app/routers/public/website_router.py` | `/api/public/*` REST, guarded by `require_website_key` + per-IP `rate_limit` | `POST /api/public/contact` (email only, no DB row) is the template for the new enquiry endpoint |
| `service-plus-client` | The app itself | Its "Login" URL is the call to action; screenshots come from its demo tenant |

Stack to match: Next.js 16, React 19, TypeScript 7 (`experimental.useTypeScriptCli`), Tailwind 4,
shadcn (radix-nova, `radix-ui`), lucide-react, framer-motion, sonner, react-hook-form + zod, pnpm.

## Key constraints of the present design

1. **Hosting is MilesWeb shared cPanel, which serves static files only.** `output: "export"` and
   `trailingSlash: true` are required (see `dev/service-plus-web/deploy/README.md`). That rules out
   Next API routes and server actions, so the form **must** post to `service-plus-server`.
2. **The website key ships in the browser bundle.** It is a coarse gate, not a secret, so the
   enquiry endpoint relies on rate limiting, zod/pydantic validation and a honeypot field, not on
   the key.
3. **CORS**: the production server's `CORS_ORIGINS` must list the new site's origin(s).
4. **Pricing must be defined in one place.** A price or limit is edited in a single typed module,
   and both the plan cards and the comparison table render from it.
5. **No real customer data in screenshots.** Capture only from the `demo` tenant.
6. House conventions: tabs/width 4/double quotes (add `.prettierrc` to match the client, since
   `service-plus-web` uses 2 spaces); `type` not `interface`, names end in `Type`; arrow-function
   components; alphabetical sorting; no `index.ts` barrels; text longer than two words goes in
   `constants/messages.ts`; red only for errors and the mandatory `*`; responsive layouts.

## New design brief

### Routes

| Route | Content |
|---|---|
| `/` | Hero ("Run your repair workshop end to end") with Login and See pricing CTAs. Pain/benefit strip. Feature grid (Jobs, Inventory, WhatsApp, Reports, Multi-branch/BU, Extended warranty, GST invoicing, Role-based access). Screenshot gallery (tabbed by module, lightbox). Testimonials. Final CTA |
| `/pricing` | 4 plan cards, a feature comparison table, a one-time setup fee note, FAQ, and the **Plan enquiry form** (`#enquire`; each card's button scrolls there with the plan preselected via `?plan=basic`) |
| `/contact` | Mobile (`tel:`), email (`mailto:`), address, map link, WhatsApp link. A short general-enquiry form is optional (see Flags) |
| `404` | Branded not-found page |

The header has the logo, nav (Home, Pricing, Contact), a theme toggle and a **Login** button linking
to the app URL (`NEXT_PUBLIC_APP_URL`). On mobile the nav moves into a Sheet. The footer holds the
contact block, links and copyright.

### Pricing data (`content/pricing.ts`, the only source)

| | Lite | Basic | Standard | Enterprise |
|---|---|---|---|---|
| Price / month | Free | ₹2,999 | ₹5,999 | ₹10,999 |
| One-time setup | — | ₹2,000 | ₹2,000 | ₹5,000 |
| Users | 1 (unlimited logins) | 1 (unlimited logins) | Multiple | Multiple |
| Jobs / month | 50 | 100 | 500 | Unlimited |
| WhatsApp messages / month | — | 100 | 500 | 2,000 |
| Spare-parts inventory | — | — | ✓ | ✓ |
| Business units | 1 | 1 | 1 | 5 |
| Provisioning | New BU (shared DB) | New BU | New BU | **Dedicated database** (super admin) |

```ts
type PlanCodeType = "basic" | "enterprise" | "lite" | "standard";
type PlanType = {
	businessUnits: number;
	code: PlanCodeType;
	highlighted?: boolean;          // Standard = "Most popular"
	inventory: boolean;
	jobsPerMonth: number | null;    // null = unlimited
	monthlyPrice: number;           // 0 = free
	name: string;
	setupFee: number;
	users: "multi" | "single";
	whatsappPerMonth: number;       // 0 = not included
};
```

Show a "✗" for features a plan lacks in a muted colour, **not red** (red is reserved for errors).

### Plan enquiry form (`components/pricing/sales-enquiry-form.tsx`)

react-hook-form + zod, errors shown on change, and submit disabled while the form is invalid.

| Field | Rule |
|---|---|
| Plan * | select, preselected from `?plan=` |
| Your name * | 2–100 chars |
| Business name * | 2–200 chars |
| Mobile * | 10-digit Indian mobile (reuse the client's `lib` mobile regex) |
| Email * | email |
| City / State * | text |
| GSTIN | optional; validated with the client's GSTIN helper if present |
| Branches needed | number (default 1). Show an "Enterprise suggested" hint when it exceeds 1 on Basic/Standard |
| Message | optional, ≤ 2000 chars |
| `website` (honeypot) | hidden, must be empty |

On success, show a confirmation card: "we'll contact you within one business day", then the
payment instructions (**manual bank transfer**: account details come from
`content/site-config.ts`), the setup fee for the chosen plan, and what happens next (BU created, or a
dedicated DB for Enterprise, then login credentials sent).

### Server endpoint (new, in `service-plus-server`)

`POST /api/public/sales-enquiry` in `website_router.py`, reusing `require_website_key` and
`rate_limit("sales-enquiry", limit=5, window_seconds=60)`.

- **Stores a row**, because it is the input to provisioning. The contact form only sends email, but
  a lost enquiry here is a lost sale. New table `public.sales_enquiry` in `service_plus_client`:
  `id, plan_code, name, business_name, mobile, email, city, gstin, branches, message, status
  ('new'|'contacted'|'converted'|'rejected'), created_at, ip`.
- **Then emails** `contact_notify_email` (HTML + text, like `_build_contact_email_html`), with
  reply-to set to the enquirer. The row is already saved, so an email failure is logged and
  swallowed, the same way `_notify_staff_of_order` handles it.
- Returns `{status: "ok"}` only. No ids or amounts go back to the browser.
- Later, not in this plan: a super-admin "Plan enquiries" grid, then Razorpay. The table's `status`
  column is designed for that grid.

## Steps

- **Step 1 — Your Part: business inputs.** Before content is final, provide:
  real mobile/email/street address; 3–5 **real** testimonials (quote, name, shop, city, and the
  customer's permission); bank account details for transfer; the domain (`myserviceplus.in` per
  earlier notes) and whether prices are **GST-inclusive or +18% GST**.
- ✅ **Done.** **Step 2 — Scaffold `dev/service-plus-portal/`.** `create-next-app`, then align deps with
  `service-plus-web`. Add `next.config.ts` (`output: "export"`, `trailingSlash`, `typedRoutes`,
  `images.unoptimized`, `experimental.useTypeScriptCli`), `.prettierrc` (tabs), `eslint.config.js`,
  `components.json`, `.env.example` (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WEBSITE_KEY`,
  `NEXT_PUBLIC_APP_URL`). Dev port **3005**.
- ✅ **Done.** **Step 3 — Shell and theme.** `app/globals.css` copied from `service-plus-web` tokens.
  `app/layout.tsx` with metadata/OG, the theme init script, `SiteHeader`, `SiteFooter` and `Toaster`.
  Add the shadcn primitives needed: button, card, badge, input, label, textarea, select, sheet,
  accordion, tabs, dialog.
- ✅ **Done** (placeholders marked `TODO(real)`). **Step 4 — Content modules.** `content/site-config.ts` (contact, app URL, bank details, nav),
  `content/pricing.ts`, `content/features.ts`, `content/testimonials.ts`, `content/faq.ts`,
  `content/screenshots.ts`, `constants/messages.ts`.
- ◐ **Partly done** (20 JPGs copied; new captures and WebP not done). **Step 5 — Screenshots.** Copy the 20 existing JPGs from
  `kush-infotech-web/public/images/products/` into `public/images/screens/`. Capture the missing ones
  (WhatsApp messaging/settings, multi-BU switcher, role/user management, job sheet PDF, a mobile
  view) from the **demo tenant** with Chrome automation at 1440×900 (plus a 390×844 mobile shot),
  in light theme. Export them as WebP at ≤200 KB each.
  **Your Part:** confirm the demo tenant shows no real customer names or mobiles.
- ✅ **Done.** **Step 6 — Home page.** Hero, benefit strip, `FeatureGrid`, `ScreenshotGallery` (tabs + dialog
  lightbox), `TestimonialCarousel`, CTA band. Use framer-motion fade/slide on scroll and respect
  `prefers-reduced-motion`.
- ✅ **Done.** **Step 7 — Pricing page.** `PlanCard` ×4, `PlanComparisonTable` (it scrolls sideways on phones and
  has a sticky first column), setup-fee note, `Faq` accordion, `SalesEnquiryForm` + success card.
  `lib/api.ts` gets a `publicPost` copied from `service-plus-web`.
- ✅ **Done.** **Step 8 — Contact page.** Contact cards, map link, WhatsApp deep link, business hours.
- ◐ **Code done** (`scripts/sales_enquiry.sql` + route); running the SQL, the dump and gen-types are Your Part. **Step 9 — Server endpoint.** Migration for `sales_enquiry` (`db/` scripts + update the
  `service_plus_client` schema dump), `SalesEnquiryIn`/`Out` models, route, email builders,
  rate limit. Then regenerate `src/types/db-schema-client.ts` here (`pnpm gen-types-client`).
- ✅ **Done.** **Step 10 — Help docs.** Add one developer article to
  `features/super-admin/components/help/dev-help-content.ts` covering the public site, the
  endpoint, the `sales_enquiry` table, its env vars and CORS. Skip the client `help-content.ts`,
  since staff-facing screens don't change. Add the full article once the super-admin enquiry grid
  exists.
- ✅ **Script done**; the rest is Your Part. **Step 11 — Deploy pipeline.** Port `deploy/build-and-deploy-milesweb.sh` + `README.md` from
  `service-plus-web` (it writes `.htaccess`, rsyncs, and smoke-checks each route).
  **Your Part:** buy the domain, add it in cPanel as an addon domain with AutoSSL, fill
  `deploy/.env.deploy`, add `https://myserviceplus.in` and `https://www.myserviceplus.in` to the
  production `CORS_ORIGINS`, set `WEBSITE_API_KEY`/`contact_notify_email`, and run the migration
  on production.
- ✅ **Done.** **Step 12 — SEO basics.** `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, `icon`, and
  `SoftwareApplication` + `Offer` JSON-LD on `/pricing` (prices in INR).

## Files touched

**New package** `dev/service-plus-portal/`:
`package.json`, `next.config.ts`, `tsconfig.json`, `.prettierrc`, `eslint.config.js`, `components.json`,
`postcss.config.mjs`, `.env.example`, `.gitignore`,
`app/{layout,page,not-found,sitemap,robots,opengraph-image}.tsx|ts`, `app/globals.css`,
`app/pricing/page.tsx`, `app/contact/page.tsx`,
`components/layout/{site-header,site-footer,logo,theme-toggle,theme-provider}.tsx`,
`components/home/{hero,benefit-strip,feature-grid,screenshot-gallery,testimonial-carousel,cta-band}.tsx`,
`components/pricing/{plan-card,plan-comparison-table,sales-enquiry-form,enquiry-success,faq}.tsx`,
`components/contact/contact-cards.tsx`, `components/ui/*` (shadcn),
`content/{site-config,pricing,features,testimonials,faq,screenshots}.ts`, `constants/messages.ts`,
`lib/{api,utils,validators}.ts`, `public/images/screens/*.webp`,
`deploy/{build-and-deploy-milesweb.sh,README.md,.env.deploy.example}`.

**Server** (`service-plus-server`): `app/routers/public/website_router.py` (endpoint + models +
email builders), a new migration SQL under `db/` or the server's migration folder, and
`app/db/schema_dumps/` (client DB).

**Client** (`service-plus-client`): `src/types/db-schema-client.ts` (regenerated) and
`src/features/super-admin/components/help/dev-help-content.ts`.

## Implementation

- **Step 1 — Scaffold + config**: Step 2 above; `pnpm dev` shows a blank page on :3005.
- **Step 2 — Theme, layout, nav**: Step 3.
- **Step 3 — Content + messages**: Step 4 (placeholder testimonials clearly marked `// TODO real`).
- **Step 4 — Screenshots**: Step 5.
- **Step 5 — Home**: Step 6.
- **Step 6 — Pricing + form (UI only, mocked submit)**: Step 7.
- **Step 7 — Contact**: Step 8.
- **Step 8 — Server endpoint + table**: Step 9, then wire the form to the real endpoint.
- **Step 9 — Help docs**: Step 10.
- **Step 10 — Deploy script + SEO**: Steps 11–12.

## Testing

1. `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build` all clean, and `out/pricing/index.html`
   exists (this confirms the trailing-slash setting took effect).
2. `npx serve out -l 3005`: click every route; hard-refresh `/pricing/` and `/contact/` directly.
3. Form: each field shows its error immediately and submit stays disabled while any field is
   invalid. `?plan=enterprise` preselects Enterprise. A filled honeypot is rejected. A 6th submit
   within a minute gets a 429 and a friendly toast.
4. Server: `curl` the endpoint with and without `X-Website-Key` (expect 401). A valid post creates a
   row in `sales_enquiry` and sends the email. With SMTP disabled, the row is still saved and the
   response is still `ok`.
5. Responsive checks at 360, 768 and 1280 widths: the comparison table scrolls sideways, cards
   stack, and the mobile nav sheet works. Check both light and dark themes.
6. Lighthouse run on `/` and `/pricing`: aim for ≥ 90 in performance, accessibility and SEO.
7. After deploy: https redirect, long cache headers on `/_next/`, the branded 404, and a live form
   submission from the production origin (proves CORS).

## Flags and constraints

- **Testimonials must be real.** Invented quotes attributed to named customers are misleading, and
  in India they can breach consumer-protection advertising rules. Until real quotes arrive, ship
  the section hidden behind `testimonials.length > 0`, or use clearly generic placeholders
  **without** names, never live on production.
- **GST**: the prompt doesn't say whether ₹2,999 etc. include GST. This decides the card copy
  ("+ GST") and the JSON-LD price.
- **Lite has no setup fee and is free.** It still goes through the enquiry form for now (manual BU
  creation). A self-serve Lite signup with email verification is covered in `plans/plan-claude.md`
  (`signup_request`) and is out of scope here. Keep `sales_enquiry` separate so it doesn't collide
  with that design.
- **Plan limits are marketing copy only.** Nothing in the app enforces 50/100/500 jobs, WhatsApp
  quotas, the single-user limit or BU counts yet (`subscription_tier` was reverted in `15588b7`).
  The site promises what the entitlement work in `plan-claude.md` must later deliver.
- **"Single user, unlimited login"** reads ambiguously; the copy should say "1 user account; log
  in from any number of devices".
- **Annual billing / discounts** are not specified. The layout leaves room for a monthly/annual
  toggle later.
- **Razorpay later**: the success card's "bank transfer" block lives in one component, so swapping
  it for a checkout button later is a contained change.
- **Contact page form**: the prompt asks only for details. Adding a general form that reuses
  `POST /api/public/contact` is cheap. Its email subject currently says "Service+" but the footer
  text says "kush-infotech-web"; parameterise the source if reused.
- `service-plus-web` (end customers) and `service-plus-portal` (shop owners) stay separate sites,
  on purpose.
