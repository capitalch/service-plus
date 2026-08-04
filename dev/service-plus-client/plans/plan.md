# Plan — Minimum Deployable `service-plus-web` (POC)

Distilled from `plans/plan-nextjs.md` §10-11 and `plans/tran.md`, corrected against the current
state of `service-plus-server` and `service-plus-client` (verified 2026-08-03; see §0). Scope is
**only** the first shippable artifact: a single-page site deployable to milesweb.in that proves the
end-to-end path (browser → API key → tenant/BU resolution → real job-status data). Everything else
in `plan-nextjs.md` (Option 2 search, Contacts, admin toggles, AI help) is explicitly **out of
scope** here and unaffected by this plan.

---

## 0. Corrections to `plan-nextjs.md` (verified by re-reading the current code)

These change what counts as "new" vs "reuse" — noted so the plan below isn't built on a false
premise:

1. **No inbound pre-shared-key auth exists in `service-plus-server`.** `plan-nextjs.md` claims the
   server "already authenticates internal callers with a shared key in a header" and that the
   website API will "reuse this exact pattern." False as stated: `X-Service-Key`
   (`trace_plus_service_key`) and `file_server_api_key` are used **outbound only** — this server
   presents them when *calling* trace-plus / the file-server. `app/core/dependencies.py` today
   contains exactly one dependency, `get_current_user`, which validates a JWT bearer token, not a
   static header key. **`require_website_key` must be written from scratch** — a reasonable design,
   just not a reuse of prior art.
2. **`app/main.py`'s `include_router()` calls take no prefix arg** — each router sets its own
   prefix internally (e.g. `image_router = APIRouter(prefix="/api/images", ...)`). Follow that
   convention: `website_router = APIRouter(prefix="/api/public", tags=["public"])`.
3. **`GET_CLIENT_DB_NAMES` lives in `app/db/sql/sql_bu_admin.py`** (line ~503), not `sql_shared.py`
   as `plan-nextjs.md` §5.3 states. `sql_shared.py` only holds app-setting queries.
4. **`service-plus-client` is a Vite + React SPA, not Next.js.** `plan-nextjs.md` §3-E says the UI
   stack "mirrors `service-plus-client`'s stack" — true for the *component/design* layer, not the
   framework. Confirmed reusable from the client: Tailwind **v4** (CSS-first, no `tailwind.config.js`),
   shadcn/ui (`style: radix-nova`, `baseColor: neutral`), the single `radix-ui` package,
   `lucide-react`, `framer-motion`, `zod` + `react-hook-form` + `@hookform/resolvers`, `sonner`,
   `class-variance-authority` + `clsx` + `tailwind-merge`, `@fontsource-variable/inter`, and the
   OKLCH color-token block in `src/index.css`. The client's Vite plugin (`@tailwindcss/vite`) has a
   Next.js equivalent, `@tailwindcss/postcss` — use that instead.
5. **`send_email` in `app/core/email.py` is plain-text only** and raises `RuntimeError` if SMTP
   isn't configured (not silent). Irrelevant to this POC (no contact form in scope) but flagged for
   the later Contacts phase.
6. **No rate-limiting library is installed** (`slowapi` etc. absent) — confirmed gap, must add
   something minimal for the POC's two public endpoints.

Everything else `plan-nextjs.md` asserts about the server (`pool_manager.get_service_pool`,
search-path-per-query via `psycopg_driver.py`, `GET_ALL_BUS`/`GET_ALL_BUS_WITH_SCHEMA_STATUS`,
`GET_ALL_BRANCHES`, `sql_jobs.py`'s `GET_JOB_DETAIL`/`GET_JOB_SEARCH_PAGED` shape) checked out
accurately and is safe to build on.

---

## 1. Scope of this deliverable

- **One page**: Home, with hero + feature cards + a **live** "Check your repair status" mini-form
  (company dropdown → job number → mobile → result card).
- **Two real endpoints** on `service-plus-server`: `GET /api/public/companies`,
  `GET /api/public/job-status`.
- **A deploy script + runbook** that pushes the static build to milesweb.in (domain or subdomain).
- Everything is additive — zero changes to existing GraphQL, auth, or admin behavior.

Deferred to later phases (documented in `plan-nextjs.md`, not touched now): Option 2
(name+mobile search), Spare-parts placeholder, Contacts page, admin `show_on_website` toggles, AI
help.

---

## 2. New project: `service-plus-web`

Location: `service-plus/dev/service-plus-web` (peer to `-server`/`-client`). Package manager
**pnpm** (matches the workspace; `service-plus-client` pins `pnpm@11.16.0` via `packageManager` —
match that pin).

### 2.1 Stack
- Next.js (App Router, TypeScript), `output: 'export'`, `images: { unoptimized: true }` (required
  for static export).
- Tailwind **v4** via `@tailwindcss/postcss` (Next's PostCSS pipeline, not the Vite plugin) —
  port `service-plus-client/src/index.css`'s `:root`/`.dark`/`@theme inline` OKLCH token block
  verbatim into `app/globals.css`, dropping the client-specific `.client-theme` overrides.
- shadcn/ui initialized with the **same `components.json` settings** as the client
  (`style: radix-nova`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`) so
  visual language matches; pull in only the primitives this page needs (Button, Card, Input,
  Select/Combobox, Badge, Form).
- `radix-ui` (single package), `lucide-react`, `framer-motion` for hero/card motion.
- `zod` + `react-hook-form` + `@hookform/resolvers` for the job-status form.
- `sonner` for toast feedback (not-found / error states).
- Data fetching: native `fetch` in a small typed client `lib/api.ts` — no Apollo (this is REST,
  not GraphQL).
- `@fontsource-variable/inter` to match the client's font.

### 2.2 Structure (POC-sized — no placeholder routes for out-of-scope pages)
```
service-plus-web/
  app/
    layout.tsx              # root layout, Inter font, theme tokens, minimal header/footer
    page.tsx                # Home: Hero + FeatureCards + JobStatusForm
    globals.css              # ported OKLCH token block + Tailwind v4 @theme inline
  components/
    ui/                       # shadcn primitives (button, card, input, select, badge, form)
    layout/ (Header, Footer)
    home/ (Hero, FeatureCards, JobStatusForm, JobStatusResult)
  lib/
    api.ts                    # fetch client: base URL + X-Website-Key header
    types.ts                  # Company, JobStatusResult response types
  public/                     # favicon, og image
  next.config.ts              # output:'export', images.unoptimized, basePath if subfolder deploy
  components.json
  .env.example                 # NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_WEBSITE_KEY
  deploy/
    build-and-deploy-milesweb.sh
    .env.deploy.example         # host/path/key — real .env.deploy is gitignored
    README.md
```

### 2.3 Home page content (single page, POC)
- **Hero**: headline, one-line value prop, primary CTA that scrolls to the form.
- **Feature cards** (static, no backend): Job status query (live today), AI repair help
  *(coming soon)*, Genuine spare parts *(coming soon)*.
- **JobStatusForm**: `CompanySelect` (populated from `GET /api/public/companies`) → `job_no` text
  input → 10-digit `mobile` input (zod-validated) → Submit → calls
  `GET /api/public/job-status`. States: loading, not-found ("check your job number and mobile"),
  error, success (`JobStatusResult`: status badge, device/brand, job date, delivery date,
  service-center name — **no amounts**, matching `plan-nextjs.md` §12 Q6's default).

---

## 3. `service-plus-server` changes (additive only)

### 3.1 New router — `app/routers/public/__init__.py`, `app/routers/public/website_router.py`
```python
router = APIRouter(prefix="/api/public", tags=["public"],
                    dependencies=[Depends(require_website_key), Depends(public_rate_limit)])

@router.get("/companies")
async def list_companies() -> list[CompanyOut]: ...

@router.get("/job-status")
async def get_job_status(company: str, job_no: str, mobile: str) -> JobStatusOut: ...
```
Registered in `app/main.py` as `app.include_router(website_router)` (no prefix arg at call site,
per the existing convention — see §0.2). Response models are explicit Pydantic classes exposing
only whitelisted fields (no amounts, no internal ids beyond the opaque `company` token).

### 3.2 Auth dependency — new, in `app/core/dependencies.py`
```python
async def require_website_key(x_website_key: str = Header(...)) -> None:
    if not secrets.compare_digest(x_website_key, settings.website_api_key):
        raise HTTPException(status_code=401, detail="invalid key")
```
Add `website_api_key: str` to `app/core/settings/api_settings.py` (same `Field(...)` pattern as
`file_server_api_key`), sourced from `.env`. Document in `.env.example`.

### 3.3 Rate limiting — minimal, no new dependency
Since nothing is installed (§0.6), add a small in-memory per-IP token-bucket dependency
(`app/core/rate_limit.py`, e.g. 20 req/min for `/companies`, 5 req/min for `/job-status`) rather
than pulling in `slowapi` for two endpoints. Good enough for a POC on a single instance; revisit if
this grows to needing shared/multi-instance rate limiting.

### 3.4 New SQL — `app/db/sql/sql_public.py` (new `PublicSql` class)
Two distilled, read-only queries (do not reuse the heavy admin queries as-is):
- `GET_ACTIVE_CLIENT_DBS` — mirrors `GET_CLIENT_DB_NAMES` (`app/db/sql/sql_bu_admin.py`) but
  selects only `id, name, db_name` where `is_active` and `db_name IS NOT NULL`.
- `LIST_ACTIVE_BUS` — per tenant DB, mirrors `GET_ALL_BUS`: `id, code, name` from `security.bu`
  where `is_active`.
- `GET_PUBLIC_JOB_STATUS` — within a BU schema, new query modeled on `GET_JOB_DETAIL`'s joins
  (`job ⋈ customer_contact ⋈ job_status ⋈ product_brand_model ⋈ brand/product ⋈ branch`) but
  filtered by `job_no = %(job_no)s AND cc.mobile = %(mobile)s` (not by internal `id`, since the
  public caller never has that) and selecting only: job_no, job_date, device (brand+product),
  status name, is_closed, delivery_date, branch/service-center name. No amounts, no `SELECT *`.

### 3.5 Cross-tenant fan-out — `app/services/public_directory.py`
For `/companies`: iterate active clients (`GET_ACTIVE_CLIENT_DBS`) → `pool_manager.get_service_pool(db_name)`
→ per BU, run `LIST_ACTIVE_BUS` with `search_path` set to that BU's schema (same
set-at-query-time pattern already used in `psycopg_driver.py`) → emit
`{ id: opaque_token(db_name, bu_code), label: "<client> — <bu>" }` (per `plan-nextjs.md` §2's
"company = business unit" resolution). Cache the assembled list in-process with a short TTL
(5 min) so a page load doesn't fan out to every tenant DB on every request.

For `/job-status`: decode the opaque `company` token back to `(db_name, bu_code)`, open that one
pool, set `search_path`, run `GET_PUBLIC_JOB_STATUS`. No caching (per-user, per-job data).

### 3.6 CORS + `.env`
- Add the milesweb origin (subdomain first, per §4) to `settings.cors_origins`.
- `.env` / `.env.example`: add `WEBSITE_API_KEY=...`.
- No changes to existing GraphQL, JWT auth, or any other router.

---

## 4. Deployment to milesweb.in

Static export (`next build` → `out/`) is the right default for a POC: cheapest MilesWeb plans are
shared cPanel/Apache, and a static bundle "just works" in `public_html` (or a subdomain docroot)
without needing Node hosting. The browser will hold `NEXT_PUBLIC_WEBSITE_KEY`, which is therefore a
coarse gate, not a secret — real protection for `/job-status` is that the caller must already know
both `job_no` and `mobile`, plus the rate limiting in §3.3 and strict CORS in §3.6. **If MilesWeb's
plan turns out to support Node**, the natural upgrade is Next.js route handlers as a server-side
proxy so the key never reaches the browser — worth revisiting after the POC is live, not before.

`service-plus-web/deploy/build-and-deploy-milesweb.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
# 1. source deploy/.env.deploy (gitignored: SSH host/user/path or FTP creds, remote path)
# 2. pnpm install --frozen-lockfile
# 3. pnpm build            # next build -> static export in ./out
# 4. write out/.htaccess   # https redirect, long cache for /_next/*, index.html fallback
# 5. rsync -az --delete ./out/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"   (FTP/lftp fallback in README)
# 6. curl -sSf smoke-check of the deployed homepage; print the URL
```
`deploy/README.md` documents both SSH+rsync and FTP (`lftp mirror -R`) paths, and how to set
`basePath`/`assetPrefix` in `next.config.ts` if deployed under a subfolder rather than a
subdomain root. Domain-vs-subdomain and SSH-vs-FTP are deploy-time config in `.env.deploy`, not
decisions this plan needs to lock in now.

---

## 5. Verification

1. **Server**: `pytest` for the new `PublicSql`/router (happy path: valid job_no+mobile → 200 with
   expected fields and no amount field present; wrong mobile → 404; missing/invalid
   `X-Website-Key` → 401; missing CORS origin → browser-blocked). Manually hit
   `GET /api/public/companies` and `GET /api/public/job-status` with `curl -H "X-Website-Key: ..."`
   against a local dev DB with known seed data (e.g. the `demo1` client visible in this repo's
   `uploads/demo/demo1/` fixtures) to confirm real tenant fan-out works end-to-end.
2. **Web**: `pnpm build` succeeds as a static export; `pnpm preview`/serve `out/` locally; confirm
   the company dropdown populates and a real job number + mobile returns a status card (and that a
   wrong mobile shows the not-found state, not the actual record).
3. **Deploy**: run `deploy/build-and-deploy-milesweb.sh` against the chosen subdomain, then load it
   in a browser and repeat the job-status check against the live server (with CORS + rate limit
   active) before asking the user to test.

---

## 6. Files created/changed (summary)

**New — `service-plus-web/`:** whole project per §2.2, incl. `deploy/build-and-deploy-milesweb.sh`.

**`service-plus-server/` (new):**
- `app/routers/public/__init__.py`, `app/routers/public/website_router.py`
- `app/services/public_directory.py`
- `app/db/sql/sql_public.py`
- `app/core/rate_limit.py`

**`service-plus-server/` (edit):**
- `app/main.py` (`app.include_router(website_router)`)
- `app/core/dependencies.py` (`require_website_key` — new, not a reuse of existing code, see §0.1)
- `app/core/settings/api_settings.py` (`website_api_key` field)
- `.env.example` (`WEBSITE_API_KEY`, CORS origin)

**No changes** to `service-plus-client` or any database schema for this POC — both are only
touched in later phases of `plan-nextjs.md` (§6-7), which remain deferred.
