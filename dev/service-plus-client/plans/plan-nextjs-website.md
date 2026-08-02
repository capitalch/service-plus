# Plan — Public Website (`service-plus-web`, Next.js)

Source of requirements: `plans/tran.md`. This is the exhaustive plan requested by its final
bullet ("Create exhaustive plan for above in plans/plan-nextjs-website.md"). Nothing here is
built yet — this document is for review/approval. Per the tran.md workflow, the **first shippable
artifact is a single-page POC** deployable to milesweb.in for the user to test; full
implementation proceeds only after approval.

---

## 1. Goal

A new, public-facing marketing + self-service website, hosted on **milesweb.in** (domain or
subdomain), that lets an end customer:

- Learn what Service Plus offers (eye-catching home page).
- Query the **repair/job status** of a product they left at a service center.
- (Future) query genuine spare-part availability & prices.
- (Future) get AI-driven fault help + repair-cost estimates.
- See the list of service centers and email them.

It talks to the existing **`service-plus-server`** (FastAPI + Ariadne GraphQL, PostgreSQL) over a
**secured, read-only public API**. It is a **peer project** to `service-plus-server` and
`service-plus-client`, living at `service-plus/dev/service-plus-web`.

---

## 2. How the existing system is shaped (grounding for the design)

Confirmed by reading the server:

- **Two DB tiers** (`app/db/connection/pool_manager.py`):
  - **Client DB** `service_plus_client` → `public.client` table. Each row is one client
    (company) with a **unique `name`** and a **`db_name`** pointing at that client's own tenant
    DB. Columns available: `id, code, name, is_active, db_name, address_line1, address_line2,
    city, country_code, email, gstin, pan, phone, pincode, state` (`sql_bu_admin.py`
    `GET_CLIENT_DB_NAMES`).
  - **Tenant/service DBs** (one per client, e.g. `service_plus_service`, `demo1`) opened lazily
    by `pool_manager.get_service_pool(db_name)`.
- **Business units are Postgres schemas.** Inside a tenant DB, `security.bu` lists business units
  (`id, code, name, is_active` — `GET_ALL_BUS`), and **each BU has its own schema named
  `lower(bu.code)`** (`GET_ALL_BUS_WITH_SCHEMA_STATUS` checks `pg_namespace.nspname =
  lower(b.code)`). The operational tables — `job`, `customer_contact`, `branch`, `job_status`,
  `product`, `brand`, `product_brand_model`, `technician` — live **inside each BU schema**.
  Access sets `search_path` to the BU schema; the pool resets it on release
  (`_reset_conn → RESET search_path`).
- **Jobs data** (`app/db/sql/sql_jobs.py`): `job` joins `customer_contact` (`full_name`,
  `mobile`, `gstin`, address…), `job_status` (`code`, `name`), `job_type`,
  `product_brand_model → brand/product`, `technician`, `branch`. Existing paged/search queries
  (`GET_JOB_SEARCH_PAGED`, `GET_JOB_DETAIL`) are the templates the public queries will be
  distilled from — **read-only, minimal columns**.
- **Service centers = `branch`** (`GET_ALL_BRANCHES`): `name, code, address_line1/2, city,
  pincode, state, email, phone, gstin, is_head_office, is_active`.
- **Pre-shared-key pattern already exists.** The server already authenticates internal callers
  with a shared key in a header — `trace_plus_service_key` via `X-Service-Key`, and
  `file_server_api_key` (`api_settings.py`). The website API will reuse this exact pattern with a
  new key + header. CORS is configured in `app/main.py` from `settings.cors_origins`.

**"Company" for the dropdown = a business unit, across all active clients.** A selection must
resolve to the triple **(db_name, bu_code, and optionally branch)** so a job lookup can pick the
right tenant DB + schema. The public "companies" list is therefore an **aggregation**: for each
active `public.client`, connect to its `db_name`, read active rows from `security.bu`, and emit an
opaque company id. This list is small and slow-changing → **cache it** (see §5.3).

> Terminology note: tran.md uses "company" / "client" / "business unit" loosely. This plan treats
> the customer-visible "company" as a **business unit** (what a walk-in customer recognises as the
> shop/brand), labelled `"<client name> — <bu name>"` when a client has more than one BU. Confirm
> during full-build kickoff (see §12, Q1).

---

## 3. Key decisions (please confirm — see §12)

| # | Decision | Recommendation |
|---|----------|----------------|
| A | Project name | **`service-plus-web`** (clear peer to `-server`/`-client`). |
| B | Framework | **Next.js (App Router, TypeScript)**. |
| C | Build/output for milesweb | **Static export** (`output: 'export'` → `out/`). MilesWeb standard plans are shared cPanel/Apache; a static bundle drops into `public_html` and "just works", is cheap, SEO-friendly, and CDN-cacheable. |
| D | How the API key stays safe | With a static site the browser holds the key, so it is **not a true secret**. Treat it as a coarse gate; real protection = **customer must supply job_no + mobile** (secrets only they know), **strict CORS** locked to the website origin, **rate limiting**, **read-only endpoints**, **minimal columns**. If MilesWeb plan has **Node.js**, upgrade to Next.js **route handlers acting as a server-side proxy** so the key never reaches the browser (see §7.4). |
| E | UI system | **Tailwind CSS v4 + shadcn/ui + Radix + lucide-react + framer-motion** — mirrors `service-plus-client`'s stack so design language and know-how carry over. |
| F | Server↔web transport | **REST JSON** under `/api/public/*` (simpler to lock down and rate-limit than exposing GraphQL publicly). GraphQL stays internal/admin-only. |
| G | Plan/POC hosting target | Deploy POC to a **subdomain** first (e.g. `beta.<domain>` or `serviceplus.<domain>`) to test without touching any live site. |

---

## 4. New project: `service-plus-web`

Location: `service-plus/dev/service-plus-web` (peer dir). Package manager **pnpm** (matches repo).

### 4.1 Stack
- Next.js (App Router) + React + TypeScript, `output: 'export'`, `images: { unoptimized: true }`
  (required for static export).
- Tailwind v4, shadcn/ui, Radix, lucide-react, framer-motion.
- `zod` + `react-hook-form` + `@hookform/resolvers` for form validation (same as client).
- Data fetching: native `fetch` wrapped in a tiny typed API client (`lib/api.ts`) — no Apollo
  (REST, not GraphQL, on the public surface).
- `sonner` for toasts.

### 4.2 Proposed structure
```
service-plus-web/
  app/
    layout.tsx                 # root layout, fonts, theme, header/footer
    page.tsx                   # HOME (eye-catching landing)
    job-status/page.tsx        # Job status query (Option 1 + Option 2 tabs)
    spare-parts/page.tsx       # "Under construction" placeholder
    contacts/page.tsx          # Service-center list + contact form
    (future) ai-help/…         # AI fault help + cost estimate
  components/
    ui/                        # shadcn primitives
    layout/ (Header, Footer, ThemeToggle, Container)
    home/ (Hero, FeatureCards, HowItWorks, CTA)
    job-status/ (CompanySelect, JobNoForm, CustomerSearch, JobStatusCard, OpenJobsTable)
    contacts/ (ServiceCenterCard, ContactForm)
  lib/
    api.ts                     # typed fetch client (base URL + website key header)
    types.ts                   # shared response types
    format.ts                  # date/currency (INR) helpers
  public/                      # logo, og image, favicon
  next.config.ts               # output:'export', images unoptimized, basePath if subfolder
  .env.example                 # NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_WEBSITE_KEY
  deploy/
    build-and-deploy-milesweb.sh   # Kubuntu deploy script (see §9)
    README.md                      # deploy runbook
  plans/                       # (optional) copy of this plan for the new repo
```

### 4.3 Design/UX principles
- Responsive-first (mobile customers are the norm for "track my repair").
- Light/dark aware, accessible (labels, focus states, ARIA), fast (static + lazy media).
- One cohesive design system; reuse client's color tokens where sensible.
- Motion used sparingly (hero, card reveals) via framer-motion.

---

## 5. `service-plus-server` changes (FastAPI)

Add a **self-contained public module** — isolated from admin/GraphQL so its blast radius is
small.

### 5.1 New router `app/routers/public/website_router.py` (prefix `/api/public`)
Read-only endpoints, all guarded by the website-key dependency (§5.2) and rate-limited (§5.4):

| Method & path | Purpose | Notes |
|---|---|---|
| `GET /api/public/companies` | Dropdown list of companies (BUs across active clients) | Returns `[{ id, label }]`; `id` is an **opaque, signed/encoded token** for (db_name, bu_code) so the browser never sees raw db/schema names. Cached (§5.3). |
| `GET /api/public/job-status?company=<id>&job_no=<>&mobile=<>` | **Option 1** — single job lookup | Requires exact `job_no` + `mobile`. Returns one sanitized status record or 404. |
| `GET /api/public/customers?company=<id>&q=<>` | **Option 2 step 1** — name typeahead (min 2 chars) | Returns `[{ id, name_masked }]`, capped (e.g. 10). See PII note §5.5. |
| `GET /api/public/open-jobs?company=<id>&customer=<id>&mobile=<>` | **Option 2 step 2** — open jobs for a customer | Requires mobile match; returns table rows (jobno, date, product, status…). |
| `GET /api/public/service-centers` | Contacts page data | Aggregated active branches across clients: name, city, address, email, phone. Cached. |
| `POST /api/public/contact` | Send email to a center or to Service Plus | Body validated; uses existing `app/core/email.py send_email`; honeypot + rate limit for spam. |

All responses go through **explicit response models** (Pydantic) exposing **only** whitelisted
fields — never `SELECT *`, never internal ids/amounts beyond what's needed.

### 5.2 Website API-key auth — `app/core/settings/api_settings.py` + a dependency
- Add `website_api_key: str` setting (loaded from `.env`), mirroring `trace_plus_service_key`.
- New dependency `require_website_key` (in `app/core/dependencies.py`) checking header
  `X-Website-Key` (constant-time compare); 401 on mismatch. Applied to every `/api/public/*`
  route via router-level `dependencies=[Depends(require_website_key)]`.

### 5.3 New SQL — `app/db/sql/sql_public.py` (new `PublicSql` class)
Distilled, minimal, read-only variants (do **not** reuse the heavy admin queries):
- `GET_ACTIVE_CLIENT_DBS` — from client DB: `id, name, db_name` where `is_active` and
  `db_name IS NOT NULL` (a public variant of the existing pattern in `sql_shared.py`).
- `LIST_ACTIVE_BUS` — per tenant DB: `id, code, name` from `security.bu` where `is_active`.
- `GET_PUBLIC_JOB_STATUS` — within a BU schema: `job` ⋈ `customer_contact` ⋈ `job_status`
  ⋈ product/brand/model, filtered by `job_no = %(job_no)s AND cc.mobile = %(mobile)s`; returns
  job_no, job_date, device_details, status name, is_closed, delivery_date, est/estimate only if
  we choose to expose it (default: hide amounts). Modeled on `GET_JOB_DETAIL`.
- `SEARCH_PUBLIC_CUSTOMERS` — within a BU schema: `customer_contact` where
  `full_name ILIKE q%` and `char_length(q) >= 2`, `LIMIT 10`.
- `GET_PUBLIC_OPEN_JOBS` — within a BU schema: open jobs (`is_closed = false` and status not in
  delivered/disposed) for `customer_contact_id` **and** matching `mobile`; columns: job_no,
  job_date, device_details, status name. Modeled on `GET_JOB_SEARCH_PAGED`.
- `LIST_PUBLIC_SERVICE_CENTERS` — per BU schema: active branches (`GET_ALL_BRANCHES` subset).

A small service layer `app/services/public_directory.py` orchestrates cross-tenant fan-out:
iterate active clients → `get_service_pool(db_name)` → per BU set `search_path` → collect. Results
for `companies` and `service-centers` are **cached in-process with a TTL** (e.g. 5–10 min) to
avoid fanning out on every request.

### 5.4 Rate limiting
Add lightweight per-IP rate limiting for `/api/public/*` (e.g. `slowapi`, or a small in-memory
token-bucket dependency if we want zero new deps). Stricter limits on `/customers`,
`/job-status`, and `/contact`.

### 5.5 CORS + privacy hardening
- Add the website origin(s) to `settings.cors_origins` (currently only `http://localhost:3000`).
  Production: the milesweb domain/subdomain over **https**.
- **PII note (Option 2):** returning customer names from a 2-letter query is a privacy exposure.
  Mitigations baked into the design: **mask** returned names (e.g. `Ravi K****`), cap results,
  rate-limit hard, and **never reveal job details until the 10-digit mobile matches**. Flag Q3 in
  §12 — the user may prefer "mobile-first" (enter mobile, then pick from that customer's jobs).

### 5.6 Wiring
- `app/main.py`: `app.include_router(website_router)`.
- `.env` / `.env.example`: add `WEBSITE_API_KEY=...` and document it.
- No changes to existing GraphQL/admin auth.

---

## 6. `service-plus-client` (admin app) changes

tran.md asks for "necessary changes in service-plus-client". The admin app is where staff should
**control what the public sees** and **manage the key**. Proposed (kept minimal for v1):

1. **Super-admin: Website API key management** — a small screen to view/rotate `website_api_key`
   (or at least document it as an env-managed secret if rotation is out of scope for v1).
2. **"Show on public website" toggles** — optional booleans so staff choose which **BUs** appear
   in the company dropdown and which **branches** appear on Contacts. Requires small DDL (§7) +
   admin UI + resolver. *If we want the fastest path, v1 can skip toggles and expose all active
   BUs/branches; add toggles in a later phase.* (Q2 in §12.)

If the user prefers zero client-app changes for v1, this section is deferred and the public API
simply exposes all active BUs/branches.

---

## 7. Database changes

Kept intentionally minimal (only if toggles in §6 are approved):
- `security.bu`: add `show_on_website boolean not null default false` (or `true` to expose all by
  default). Per tenant DB.
- `branch`: add `show_on_website boolean not null default false`.
- Public queries then filter on these flags.
- Seed/DDL added under `app/db/sql/sql_bu_admin_ddl.py` conventions and applied per tenant.

If §6 toggles are deferred, **no schema change is required** for v1 (we read existing `is_active`).
The `website_api_key` is an **env var**, not a table.

### 7.4 Alternative if MilesWeb Node hosting is available (more secure)
Instead of the browser holding the key: build Next.js **without** static export and deploy the
Node server on MilesWeb; put the calls in **route handlers** (`app/api/*/route.ts`) that read the
key from a server-only env var and proxy to FastAPI. Browser → Next route (same origin) → FastAPI
with `X-Website-Key`. Key never leaves the server; CORS becomes same-origin. Decision D / Q4.

---

## 8. Pages & features (full build)

### 8.1 Home (`/`)
Hero (headline + value prop + primary CTA "Track your repair"), feature cards (Job status query;
AI repair help *(coming soon)*; Genuine spare parts *(coming soon)*), "How it works" 3-step strip,
trust/【about】section, footer with links + contact. Fully responsive, animated on scroll.

### 8.2 Job status (`/job-status`) — two tabs
- **Option 1 — By job number:** `CompanySelect` (from `/companies`) → `job_no` input → 10-digit
  `mobile` input → Submit → `JobStatusCard` (status badge, device, dates, center; no amounts by
  default). Clear "not found / check details" states.
- **Option 2 — By customer:** `CompanySelect` → debounced name search (min 2 chars) →
  `CustomerSearch` dropdown of masked names → select → 10-digit `mobile` → `OpenJobsTable`
  (job_no, date, product, status). Empty/edge states handled.

### 8.3 Spare parts (`/spare-parts`)
"Under construction" page — on-brand placeholder + "notify me"/back-to-home CTA. No backend.

### 8.4 Contacts (`/contacts`)
Grid of `ServiceCenterCard` (name, address, city, phone, email) from `/service-centers`. Each card
has "Email this center"; page also has a "Email Service Plus" general form. `ContactForm` posts to
`/api/public/contact` (honeypot + validation + success/error toast).

### 8.5 Future (documented, not built now)
- **AI fault help & cost estimate** — a chat/guided form calling a new server endpoint backed by
  an LLM (use latest Claude model, key server-side only — this feature specifically needs the
  Node/route-handler path or a dedicated server endpoint, never a browser-held LLM key).
- **Spare-parts query** — prices/availability "directly from parent company".

---

## 9. Deployment to milesweb (Kubuntu bash script)

Deliver `service-plus-web/deploy/build-and-deploy-milesweb.sh` + `deploy/README.md`.

**Assumptions (confirm — Q5):** MilesWeb shared cPanel, deploy target is `public_html/` (domain)
or `public_html/<subdir>` / a subdomain docroot; access via **SSH+rsync** (preferred) or **FTP**.

Script outline (idempotent, safe):
```bash
#!/usr/bin/env bash
set -euo pipefail
# 1. Load deploy config (host, user, remote path, ssh key) from deploy/.env.deploy (gitignored)
# 2. pnpm install --frozen-lockfile
# 3. pnpm build           # next build -> static export to ./out
# 4. Create a .htaccess in out/ for SPA-style routing + caching + https redirect
# 5. rsync -az --delete ./out/  user@host:REMOTE_PATH/    (or lftp mirror for FTP)
# 6. Print deployed URL and a curl smoke-check of the homepage
```
Notes:
- If served from a subfolder, set `basePath`/`assetPrefix` in `next.config.ts` accordingly.
- `.htaccess`: gzip/br + long cache for `/_next/`/assets, `index.html` fallback, force https.
- FTP fallback variant using `lftp mirror -R` documented in README for plans without SSH.
- Zero secrets in the bundle beyond `NEXT_PUBLIC_*` (which are intentionally public).

---

## 10. POC (the first deliverable to test) 

Per tran.md: "initially create a single page minimum POC which can be deployed on milesweb.in …
After my approval, I will ask you to proceed for full implementation." Scope:

- Scaffold `service-plus-web` with Next.js static export + Tailwind.
- **One page**: a polished **Home** with the hero + feature cards + a live **"Check job status
  (Option 1)"** mini-form that calls a **first real endpoint** `GET /api/public/companies` +
  `GET /api/public/job-status` on the server (so the end-to-end path — CORS, website key,
  tenant/BU resolution — is proven), OR, if we want zero server work first, a **static-only**
  home page with a stubbed form. **Recommended:** wire the real `companies` + `job-status`
  endpoints so the deployment truly exercises the architecture.
- The `deploy/build-and-deploy-milesweb.sh` script + runbook so the user can push it live to a
  subdomain and test.
- Server side for POC: minimal `website_router` with just `/companies` + `/job-status`, the
  `X-Website-Key` dependency, CORS entry, and `PublicSql` for those two.

Deliver, user tests on milesweb, approves → proceed to full build (§8) in phases (§11).

---

## 11. Phased roadmap

1. **P0 — POC** (§10): scaffold + Home + companies/job-status endpoints + milesweb deploy script.
   *Milestone: user tests live on a subdomain.*
2. **P1 — Job status full**: Option 1 + Option 2 tabs, all four query endpoints, hardening
   (rate-limit, masking, CORS prod origin).
3. **P2 — Contacts**: service-centers endpoint + Contacts page + contact email endpoint.
4. **P3 — Home polish + Spare-parts placeholder**: full landing content, SEO/OG, a11y pass.
5. **P4 — Admin controls** (§6/§7 toggles + key management) if approved.
6. **P5 — AI help & spare-parts** (server-side LLM/parts integration) — future.

---

## 12. Open questions for the user

1. **Q1 — "Company" meaning:** dropdown = business units (BUs) across clients, labelled
   `"<client> — <bu>"`? Or one entry per client only?
2. **Q2 — Public visibility control:** expose **all active** BUs/branches in v1 (no client-app
   change, no DDL), or add `show_on_website` toggles + admin UI now?
3. **Q3 — Option 2 privacy:** OK to show masked customer names from a 2-char search (job details
   still gated by mobile), or switch to **mobile-first** (enter mobile → pick from that number's
   jobs) to avoid any name enumeration?
4. **Q4 — API-key secrecy:** MilesWeb plan Node-capable? If yes, use the **route-handler proxy**
   (key stays server-side, recommended). If not, accept the browser-held key + hardening model.
5. **Q5 — MilesWeb deploy details:** domain vs subdomain, and SSH+rsync vs FTP access?
6. **Q6 — Amounts:** expose repair **estimate/amount** to customers in job status, or hide (plan
   defaults to **hide**)?

---

## 13. Files that will be created/changed (summary)

**New — `service-plus-web/`:** whole project (§4.2), incl. `deploy/build-and-deploy-milesweb.sh`.

**`service-plus-server/` (new):**
- `app/routers/public/__init__.py`, `app/routers/public/website_router.py`
- `app/services/public_directory.py`
- `app/db/sql/sql_public.py`

**`service-plus-server/` (edit):**
- `app/main.py` (include router)
- `app/core/settings/api_settings.py` (`website_api_key`)
- `app/core/dependencies.py` (`require_website_key`)
- `app/core/settings/api_settings.py` / `.env.example` (CORS origin, key)
- (P2) reuse `app/core/email.py`

**`service-plus-client/` (edit, only if §6 approved):** super-admin website-key screen +
`show_on_website` toggles UI/resolvers.

**Database (only if §6 approved):** `security.bu.show_on_website`, `branch.show_on_website` per
tenant DB.
