# plan3 — `myserviceplus.in`: a standalone static marketing portal

> Source: `plans/prompt2.md` — *advice required, no implementation.*
> Decisions taken during planning: build fresh (ignore the existing `service-plus-web`);
> host on **MilesWeb cPanel only**; **the portal needs no API from the production server.**

## Goal

Stand up `https://myserviceplus.in` — a customer-facing Service+ product site (features,
pricing, testimonials, contact) — without touching the production server at
`serviceplus.cloudjiffy.net` in any way.

## Answering the question in the prompt directly

**Nothing is hosted in the Cloudjiffy env.** To restate the topology plainly, because my
first pass was ambiguous about it:

```
  myserviceplus.in ──► MilesWeb shared cPanel (LiteSpeed)
                       static files from `next build` → out/
                       ── no Node, no proxy, no API calls ──

  serviceplus.cloudjiffy.net ──► Cloudjiffy env, COMPLETELY UNCHANGED
                                 nginx → React SPA + FastAPI
```

The domain is registered and its nameservers point at **MilesWeb**, where it is added as
an addon domain with its own document root. Cloudjiffy is not in the path, does not serve
the portal, and does not know it exists.

The two sites are connected by exactly one thing: a **hyperlink**. The portal's "Login"
button points at the app. That is the entire integration.

### So: proxy, or standalone?

Neither of the prompt's two options survives contact with the constraints, and that is
the useful finding:

- **"Next.js as a proxy, hosted in Cloudjiffy"** — ruled out three times over. The env is
  a `python:3.14.3-slim-bookworm` image with no Node runtime (`notes/Deployment.md`); its
  nginx already serves the SPA at `/` (`root /usr/share/nginx/html/dist`), so a marketing
  site at the root collides with the app your tenants use; and a proxy would break the
  rate limiter, which keys its window on `request.client.host` (`app/core/rate_limit.py`)
  — behind one proxy IP, the first few visitors consume the window and the rest get 429s.
  Its only benefit, "same origin so no CORS", solves a problem you no longer have.

- **"Standalone Next.js talking to `/api/v1/...`"** — right shape, but the API call is
  itself unnecessary. Everything on a features/pricing/testimonials site is static copy.

**The answer is simpler than both: a standalone, fully static site that calls nothing.**

## Present context and current design

- **Production** (`notes/Deployment.md`): Cloudjiffy env, Python 3.14 Docker image, nginx
  serving the React SPA from `/usr/share/nginx/html/dist` and reverse-proxying `/api/`,
  `/graphql/`, `/health`, `/job-intake/`, `/extended-warranty/` to uvicorn on
  `127.0.0.1:8000`. Hand-built per runbook; no Dockerfile.
- **A public REST API exists but is not needed here.**
  `app/routers/public/website_router.py` exposes `/api/public/*` (companies, job-status,
  open-jobs, branches, company-info, parts, part-orders, contact) behind an
  `X-Website-Key` header and per-IP rate limiting. Relevant only to the contact-form
  decision in Step 5, and to the optional extension in "Flags".
- **Prior art for this exact deployment shape:** `dev/service-plus-web/deploy/` and
  `kush-infotech-web/deploy/` are both Next.js static exports shipped to MilesWeb cPanel
  by a `build-and-deploy-milesweb.sh` script. `kush-infotech-web` is the closer model —
  it is a marketing site, and its `next.config.ts` adds `typedRoutes: true`, which turns a
  renamed route folder into a build error at each stale link instead of a runtime 404.
- **Pricing tiers** are already written down in `plans/prompt1.md` (four subscription
  levels). Use that as the single source; do not retype tiers per page.
- **Domain research** is in `notes/todo.md`: `serviceplus`, `servicejob`, `serviceflow`,
  `serviceking`, `serviceforce` are taken; `.in` is quoted at ₹549/yr.

## Key constraints

1. **MilesWeb shared cPanel serves files, not processes.** No `next start`, no API routes,
   no server actions, no ISR. `output: "export"` is mandatory, not a preference.
2. **LiteSpeed there runs Apache `MultiViews` off.** It serves exact filenames and a
   directory's `index.html`, nothing else — so `trailingSlash: true` is load-bearing.
3. **`.htaccess` is a dotfile**, and cPanel's File Manager silently drops dotfiles when
   extracting a zip. Deploys must go over rsync/lftp, never a manual upload.
4. **No server-side secrets are possible.** Anything in the bundle is public. With no API
   calls this is moot — which is precisely why dropping the API is a simplification and
   not a compromise.

## New design brief

A five-route static Next.js 16 site, content-driven from typed TS modules, deployed as
files to a MilesWeb addon-domain document root.

| Route | Content | Source |
|---|---|---|
| `/` | Hero, problem/solution, feature highlights, social proof, CTA | static |
| `/features` | Full capability list by module (Jobs, Inventory, Masters, Reports, WhatsApp, Extended Warranty) | static, `content/features.ts` |
| `/pricing` | The four subscription tiers + comparison table + FAQ | static, `content/pricing.ts`, sourced from `plans/prompt1.md` |
| `/testimonials` | Quotes, logos, case-study cards | static, `content/testimonials.ts` |
| `/contact` | Address, phone, email, map link, enquiry form | static + one form POST (Step 5) |

Plus a "Login" / "Go to app" button in the header linking out to the running app.

**Content lives in typed data modules, not inside JSX.** Same discipline as
`help-content.ts` in the client: a `FeatureType[]` / `PricingTierType[]` /
`TestimonialType[]` array per file, rendered by one component each. Editing a price then
means editing one line in one file, not hunting through markup.

## Steps

### Step 1 — Domain. (Your Part)

- Confirm `myserviceplus.in` is registerable and buy it; grab the `.com` too if free.
  `notes/todo.md` already records `serviceplus.*` as taken, so verify before any naming
  work depends on it.
- Point its nameservers at MilesWeb, add it in cPanel as an **addon domain** with its own
  document root, and issue the AutoSSL certificate.
- Note the document root path and SSH/FTP details — Step 6 needs them.

### Step 2 — Scaffold

New package `dev/service-plus-portal/`. Next.js 16, React 19, Tailwind 4, shadcn,
TypeScript, pnpm. Dev port **3005** (3000 = client, 3002 = service-plus-web,
3004 = kush-infotech-web).

```ts
// next.config.ts
const nextConfig: NextConfig = {
    output: "export",
    trailingSlash: true,
    typedRoutes: true,
    images: { unoptimized: true },
};
```

`trailingSlash` emits `pricing/index.html` instead of a flat `pricing.html`. Without it
every route except `/` returns 404 on direct load or refresh, while in-app navigation
keeps working — so the breakage is invisible unless you type a deep link. This is
documented in full in `dev/service-plus-web/deploy/README.md`; do not drop it.

### Step 3 — Shell and design system

`app/layout.tsx` with a top header (logo, nav, theme toggle, "Login" CTA → the app URL)
and a footer. A marketing site wants a horizontal top nav, not the left rail used in
`service-plus-web` — different job, different navigation.

Lift the `oklch` light/dark token set and brand gradient from `service-plus-web`'s
`app/globals.css` rather than inventing a second palette, so the portal and the product
look related.

### Step 4 — Content modules and pages

`content/features.ts`, `content/pricing.ts`, `content/testimonials.ts`, `content/faq.ts` —
each a typed array. One rendering component per content type
(`components/features/feature-grid.tsx`, `components/pricing/tier-card.tsx`, …).

Strings longer than two words go in `constants/messages.ts` per the house convention;
control labels stay inline.

### Step 5 — The contact form (the one real decision)

A static site cannot process a form by itself. Four options, in the order I'd rank them:

1. **Third-party form service** (Web3Forms, Formspree — free tier). A `POST` to their
   endpoint with an access key. No backend, no CORS entry, no server change, built-in
   spam filtering. **Recommended** — it is the only option that keeps "zero changes to
   production" literally true.
2. **Reuse `POST /api/public/contact`** on the Service+ server. It already exists, is
   already used by `kush-infotech-web`, has HTML+text email templates, and is rate-limited
   at 5/min/IP. Costs two lines of production config: add `https://myserviceplus.in` and
   `https://www.myserviceplus.in` to `CORS_ORIGINS`, and set the website key in the
   portal's env. Pick this if you'd rather not add a vendor — but it re-introduces the API
   dependency you just removed.
3. **A small PHP script** in the cPanel document root using `mail()`. Same origin, no
   CORS, works on LiteSpeed — but `mail()` deliverability is poor and it is a spam magnet
   without a captcha.
4. **`mailto:` link.** Zero infrastructure, worst conversion. Fine as a v1 placeholder.

Whichever is chosen, still show the phone number and email address as plain text — for a
B2B SaaS site a visible phone number converts better than any form.

### Step 6 — Deploy pipeline

Port `deploy/build-and-deploy-milesweb.sh` from `dev/service-plus-web/deploy/`. It already
does: install → `pnpm build` → write `.htaccess` (force https, long-cache `/_next/`, set
the 404 page) → `rsync --delete` over SSH (or `lftp mirror` for FTP) → smoke-check the
homepage, every sub-route, and the `Cache-Control` header on a hashed asset, failing the
deploy if anything is off.

Copy `deploy/README.md` alongside it and adjust the domain. Use the script, never a zip
upload — see constraint 3.

### Step 7 — Brand the app's URL (optional, later, DNS only)

CNAME `app.myserviceplus.in` → the Cloudjiffy env, following
`notes/Subdomain to point Cloudjiffy env.md` (CNAME not A, because the env sits behind a
rotating shared IP pool; bind the domain in Cloudjiffy; then Let's Encrypt). Point the
portal's "Login" button there instead of at `serviceplus.cloudjiffy.net`.

This is DNS and a Cloudjiffy domain binding — no code, and still no coupling between the
two sites beyond a hyperlink.

## Files touched

**New package** `dev/service-plus-portal/`:
`next.config.ts`, `package.json`, `app/layout.tsx`, `app/globals.css`,
`app/{,features,pricing,testimonials,contact}/page.tsx`,
`content/{features,pricing,testimonials,faq}.ts`, `constants/messages.ts`,
`components/{layout,home,features,pricing,testimonials,contact,ui}/…`,
`deploy/build-and-deploy-milesweb.sh`, `deploy/README.md`, `.env.example`.

**Existing files changed: none** — unless contact-form option 2 is chosen, in which case
`CORS_ORIGINS` in the production server `.env`.

## Testing

1. `pnpm build`, then confirm `out/pricing/index.html` exists — directory form, not
   `out/pricing.html`. That single check catches the entire `trailingSlash` failure class.
2. `pnpm lint` and `pnpm exec tsc --noEmit` clean.
3. Serve `out/` locally (`npx serve out`) and click every route plus the Login CTA.
4. Deploy, then load `https://myserviceplus.in/pricing/` **by typing the URL**, not by
   clicking through — then hard-refresh it. Repeat for each route.
5. `curl -I https://myserviceplus.in` → 200, https redirect present; a hashed `/_next/`
   asset returns a long `Cache-Control`; a bogus path returns the app's 404, not the
   host's.
6. Submit the contact form and confirm the mail arrives.
7. Responsive check at phone, tablet and desktop widths.
8. Confirm `serviceplus.cloudjiffy.net` is untouched — SPA loads, login works, a protected
   GraphQL query returns data. (With no server change this is a formality, but it is the
   assertion the whole design rests on, so verify it once.)

## Flags and constraints

- **This is a one-way door on interactivity.** The moment the portal needs something live
  — a real job-status widget, a spare-parts catalogue, a self-serve signup that creates a
  tenant — you need either the API (browser → `/api/public/*` with a website key and a
  CORS entry, exactly as `service-plus-web` does today) or a Node runtime. The static
  design is right for a marketing site; just know which change forces a revisit.
- **Check whether your cPanel plan has "Setup Node.js App"** (Phusion Passenger). It
  changes nothing today, but it is the difference between "static is a choice" and
  "static is the only option", and it is cheaper to know now.
- **No CDN on MilesWeb shared hosting.** If page speed becomes a marketing concern, put
  Cloudflare's free DNS-level proxy in front of the MilesWeb origin — no host change.
- **Two audiences, one brand.** This portal sells to repair-shop *owners*. The existing
  `service-plus-web` serves their *end customers* (track a repair, buy parts). Keeping
  them as separate sites is the right call; just decide deliberately whether the end-
  customer site eventually lives at a subdomain of the same brand.
- **Latent bug, unrelated but worth fixing while nearby:** `cors_origins` in
  `app/core/settings/api_settings.py` contains `"wow-wildness-ravioli.ngrok-free.dev"`
  with no `https://` scheme. A CORS origin must include the scheme, so that entry can
  never match — dead config that reads as though ngrok is allow-listed when it is not.
- Per `plans/prompt2.md` this session is advice only; no code has been written.
