# Spare Parts Sale on the Web — Design

## 1. Context

`service-plus-web` (the public Next.js static site) already has a "Genuine spare parts — Coming soon" teaser card (`components/home/feature-cards.tsx`) sitting next to the live "Track your repair" feature. This design fills that placeholder: a public parts catalog (search/browse, in-stock + active parts only, per company/tenant) plus a payment-free "order request" flow (no payment gateway — customer submits an order, staff fulfills it manually, presumably cash-on-pickup/delivery).

This spans three repos in the monorepo (`/home/sushant/projects/service-plus/dev/`):
- **`service-plus-web`** — new pages/components for browsing + ordering.
- **`service-plus-server`** — new public (unauthenticated, key-gated) API endpoints + new tables.
- **`service-plus-file-server`** — evaluated for part images; **recommendation: don't extend it for this** (see §6).

I read the actual existing code for all three before writing this (not guessing): the live "Track your repair" feature, the public API's tenant-resolution mechanism, the `spare_part_master`/`stock_balance` schema, and the file-server's auth model.

## 2. How the public site currently talks to the backend (the pattern to replicate)

- **Static export, no server code**: `service-plus-web`'s `next.config.ts` sets `output: "export"`. There are zero `app/api/*/route.ts` files — every page is a `"use client"` component doing plain `fetch` straight to `service-plus-server`, via `lib/api.ts`'s `publicGet<T>(path, params)` helper. Base URL from `NEXT_PUBLIC_API_BASE_URL`, plus a required `X-Website-Key` header (`NEXT_PUBLIC_WEBSITE_KEY`) baked into the static bundle.
- **Backend gate**: `app/routers/public/website_router.py` (FastAPI, prefix `/api/public`) — every route is `Depends(require_website_key)` (compares the header against `settings.website_api_key` via `secrets.compare_digest`) plus a per-route rate limiter.
- **Tenant resolution without login — the critical mechanism to reuse, not reinvent**: `app/services/public_directory.py`'s `public_directory` singleton fans out across every active row in `public.client`, reads each one's `security.bu`, and builds a 5-minute-TTL cache mapping an **opaque token** (`sha256(f"{db_name}:{bu_code}")[:20]`) → `(db_name, bu_code)`. `GET /api/public/companies` returns only `{id: token, label}` pairs — the browser never sees or can forge a real `db_name`/schema. Every subsequent request (existing job-status/open-jobs, and the new parts endpoints) just echoes back that same `company` token; the router resolves it server-side via `public_directory.resolve_company(token)` before running any SQL. **The new parts endpoints must use this exact same token, not the raw-id `/api/auth/clients` pattern** (that one exists only to let a human pick a tenant before a real login+JWT, and is not safe as an authorization boundary for a public write).
- SQL lives in `app/db/sql/sql_public.py` (`PublicSql` class) as whitelisted-column queries called via the same `exec_sql_query(db_name, schema, ...)` used elsewhere — no raw SQL in the frontend, consistent with the rest of the app.

## 3. Data model

### 3a. What exists today (confirmed by reading `db-schema-service.ts`)

- **`spare_part_master`**: `id, brand_id (FK brand), part_code, part_name, part_description, category, model (free text — NOT an FK), uom, cost_price, mrp, hsn_code, gst_rate, is_active, selling_price, created_at, updated_at`. **No image column. No link to `product`/`product_brand_model`** — only a free-text `model`/`category` string, and a real FK to `brand`.
- **`stock_balance`**: `part_id (FK), branch_id (FK), qty, location_id, updated_at` — stock is per-branch; "current stock" for a part = `SUM(qty)` across all its branch rows.
- Existing query to adapt: `GET_PARTS_CURRENT_STOCK` (`sql_reports_audit.py`) already does `LEFT JOIN stock_balance ... GROUP BY spm.id ... WHERE spm.is_active = true` — the new public catalog query is this pattern plus a search filter and `HAVING COALESCE(SUM(sb.qty),0) > 0`.
- **No existing order/inquiry/quote table anywhere** — confirmed via grep across both repos. This is a from-scratch addition.

### 3b. New tables (added per-tenant-schema, same DDL file that defines `job`/`sales_invoice` etc. — `app/db/sql/sql_bu_admin_ddl.py` — plus a backfill migration for existing tenants, same two-step pattern used for the `track_job_url` app setting earlier: new tenants get it via DDL, existing tenants need an explicit migration run)

```sql
CREATE TABLE web_part_order (
    id               bigserial PRIMARY KEY,
    customer_name    text NOT NULL,
    mobile           text NOT NULL,
    email            text,
    fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('PICKUP', 'DELIVERY')),
    branch_id        bigint REFERENCES branch(id),      -- pickup branch, or nearest branch for delivery
    delivery_address text,                               -- required when fulfillment_type = 'DELIVERY'
    remarks          text,
    status           text NOT NULL DEFAULT 'NEW'         -- NEW | CONFIRMED | FULFILLED | CANCELLED
                        CHECK (status IN ('NEW','CONFIRMED','FULFILLED','CANCELLED')),
    total_amount     numeric NOT NULL DEFAULT 0,          -- snapshot at submission time
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE web_part_order_line (
    id               bigserial PRIMARY KEY,
    web_part_order_id bigint NOT NULL REFERENCES web_part_order(id) ON DELETE CASCADE,
    part_id          bigint NOT NULL REFERENCES spare_part_master(id),
    qty              integer NOT NULL CHECK (qty > 0),
    unit_price       numeric NOT NULL,   -- selling_price snapshot at order time, not live-linked
    line_total       numeric NOT NULL
);
```

Deliberately **not** touching `stock_balance` at order-submission time — a web order is a *request*, not a confirmed sale. Stock only actually moves when staff fulfills it through the existing Sales flow (§5), so there is exactly one code path that ever mutates `stock_balance`/`stock_transaction`, avoiding a second, inconsistent stock-deduction mechanism.

Optional, only if images are done (§6): `ALTER TABLE spare_part_master ADD COLUMN image_url text;`

## 4. New public API endpoints (`app/routers/public/website_router.py` + `sql_public.py`)

All under the existing `require_website_key` + rate-limit pattern; writes get a stricter limit than reads.

- **`GET /api/public/parts?company=&search=&category=&brand=&page=&page_size=`** → paginated `{items: PartOut[], total, page, page_size}`. `PartOut = {id, part_code, part_name, part_description, category, brand_name, model, uom, selling_price, stock_qty}`. Query: adapt `GET_PARTS_CURRENT_STOCK`, add `WHERE spm.is_active = true`, `HAVING SUM(sb.qty) > 0`, and `ILIKE` filters on `part_code`/`part_name`/`category`/`model`/`brand.name` for `search`. **No `cost_price`/`hsn_code`/`gst_rate` in the response** — same whitelist-columns discipline as the existing public job-status query (don't leak internal costing).
- **`GET /api/public/parts/{part_id}?company=`** → single `PartOut`, 404 if not found/inactive/out-of-stock for that tenant (mirrors the existing job-status 404 handling the frontend already expects).
- **`POST /api/public/part-orders`** → body `{company, customer_name, mobile, email?, fulfillment_type, branch_id?, delivery_address?, remarks?, lines: [{part_id, qty}]}`. Server **re-validates price and stock at submission time** (never trusts client-cached values — a cart built minutes earlier could be stale), rejects with a clear per-line error if any part is now inactive/out of stock/qty exceeds available stock, otherwise inserts `web_part_order` + `web_part_order_line` rows (using the tenant-resolved `db_name`/schema from the token, same as every other public write in this app) and returns `{order_id, status: "NEW"}`. Rate-limited tighter than reads (e.g. a handful per hour per IP) since it's a write with no other abuse defense yet.

## 5. Staff-side fulfillment (`service-plus-client`)

Web orders need to be visible and actionable inside the existing internal app — otherwise they just pile up in a table nobody looks at. Add a small **"Web Part Orders"** screen (new item under the existing Jobs or Sales sidebar group, whichever fits the app's current IA best — the codebase already has patterns for both a list+detail modal, e.g. `job-pipeline/job-details-modal.tsx`, to mirror):

- List view: `web_part_order` rows filterable by `status`, newest first, with line items expandable per row.
- Actions: mark `CONFIRMED` (staff has called the customer to confirm) → `FULFILLED` or `CANCELLED`.
- **Fulfillment should create/link a normal Sales Invoice** (reusing the existing `sales_invoice`/`sales_invoice_line` creation flow already in the app) rather than inventing a second stock-deduction path — this is the one place `stock_balance` actually changes, going through the same `stock_transaction` mechanism as every other sale. `web_part_order.status` flips to `FULFILLED` once that invoice is created, with `sales_invoice_id` optionally recorded for traceability (add the column if this is wired up in v1, or leave it for the fast-follow that connects the two).

## 6. Part images — recommendation: skip for v1, don't extend the file-server

Investigated `service-plus-file-server` directly: it's a small internal-only Python/FastAPI microservice, every route (including file *reads*) requires `X-API-Key`, local-disk storage with no CDN, and it's wired for exactly one purpose today (private job-attachment photos, called only by the trusted internal API server). **It is not safely reusable as-is for public traffic** — opening it up would mean adding unauthenticated read routes and tenant-safe path validation to a service that currently assumes only one trusted caller, plus it has no CDN in front of it.

Two real options, in order of recommendation:
1. **Skip images in v1.** Show a category icon/placeholder client-side. Given `spare_part_master` has no image column today either, this needs zero schema change and zero new infra — ship the catalog + order flow first, add photos later if it turns out to matter.
2. **Fast-follow, if photos are wanted**: add `spare_part_master.image_url` (nullable) populated by staff through the *existing* internal upload flow (already authenticated, already working), then add a narrow **public image-proxy** endpoint on `service-plus-server` itself — e.g. `GET /api/public/part-image/{id}` — that fetches the image server-side (using the server's own trusted `FILE_SERVER_API_KEY`, exactly like `image_router.py` already does for job attachments) and streams it back. This never exposes the file-server or its key publicly and reuses 100% of the existing upload/storage code; it just adds one more authenticated-outbound, public-inbound passthrough route, isolated to a `parts/` namespace.

Do **not** point the public website directly at the file-server or add public credentials to it — that changes its trust model for every existing (private, job-attachment) use case too.

## 7. `service-plus-web` frontend additions

Following the exact conventions the "Track your repair" feature already established (`react-hook-form` + `zod` + shadcn/ui primitives, `lib/api.ts`'s `publicGet`/`ApiError` pattern, `sonner` toasts):

- New route `app/spare-parts/page.tsx` (static export supports multiple routes fine — the constraint is no *dynamic server* routes, which this doesn't need).
- `components/spare-parts/`:
  - `company-select.tsx` — the company picker is now needed in two features; worth extracting the existing inline dropdown logic out of `job-status-form.tsx`/`open-jobs-form.tsx` into one shared component both features use, rather than a third copy-paste.
  - `parts-search.tsx` — search box + category/brand filters.
  - `parts-grid.tsx` / `part-card.tsx` — catalog display (name, code, brand, price, stock badge, qty stepper + "Add to cart").
  - `cart-drawer.tsx` — client-side only, `localStorage`-persisted (no server session needed since there's no auth) — line items + qty, running total.
  - `checkout-form.tsx` — customer name/mobile/email, pickup-branch vs delivery-address choice, remarks, submit → calls the new `submitPartOrder`.
  - `order-confirmation.tsx` — shows the returned order id/status, explicit "no online payment — pay on pickup/delivery" messaging.
- `lib/api.ts` + `lib/types.ts`: add `fetchParts`, `fetchPartById`, `submitPartOrder` + matching types, snake_case→camelCase mapping like the existing `mapJobStatus`.
- `components/home/feature-cards.tsx`: flip "Genuine spare parts" from "Coming soon" to a real link to `/spare-parts`.
- `components/layout/header.tsx`: currently has no nav links at all (single-page site) — add one link to the new route now that there are two pages.

## 8. Known limitation to flag explicitly

Search/browse can only filter on `part_code`/`part_name`/`category`/free-text `model`/`brand` — there's no FK from `spare_part_master` to `product`/`product_brand_model`, so there's no way to browse "parts for my exact phone model" the way the internal app browses jobs by device. Living with free-text search is the pragmatic v1 choice (zero schema risk to the core parts table); adding a real `product_brand_model_id` FK to `spare_part_master` would enable structured browsing but is a larger, separate migration touching a core table used everywhere else in the app — not bundled into this feature.

## 9. Phased rollout

1. **Phase 1**: read-only catalog (`GET /api/public/parts*`) + order-request submission (`POST /api/public/part-orders`), web frontend, no images, no staff-side screen yet (orders land in the DB; staff query them manually if needed for the very first soft-launch).
2. **Phase 2**: staff-side "Web Part Orders" screen + Sales Invoice linkage (§5) — required before this is genuinely usable end-to-end, should ship close behind Phase 1, not be deferred indefinitely.
3. **Phase 3 (optional)**: image proxy (§6, option 2); structured product/model browsing (§8) if free-text search proves insufficient in practice.

## 10. Verification

- Backend: confirm the new public endpoints are unreachable without `X-Website-Key`, confirm the opaque `company` token round-trips correctly end-to-end (can't be forged into a different tenant's data), confirm stock/price re-validation actually rejects a stale/tampered cart at submit time, confirm rate limits apply.
- Frontend: build with `next build` (static export) and confirm the new route emits correctly into `out/`; verify the cart survives a page reload (localStorage) and clears after a successful order.
- Data: after submitting a test order, confirm it's visible via a direct DB query in the target tenant schema, and (once Phase 2 ships) visible and actionable in the staff-side screen, and that fulfilling it produces a normal Sales Invoice with correct stock deduction.
