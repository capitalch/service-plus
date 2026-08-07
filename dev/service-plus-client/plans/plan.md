# Spare Parts Sale on the Web — Design

## 1. Context

`service-plus-web` (the public Next.js static site) already has a "Genuine spare parts — Coming soon" teaser card (`components/home/feature-cards.tsx`) sitting next to the live "Track your repair" feature. This design fills that placeholder.

**Revision note (this version):** the catalogue is now backed by a **new, web-exclusive table `spare_part_web`** — not `spare_part_master`/`stock_balance`. Staff can list market-sourced parts that have no internal part code at all (`part_id` is nullable), prices are explicitly "indicative, subject to change without notice," there is no return/replace policy, and fulfillment (delivery + billing) is a manual, staff-driven process outside the app — an email to staff plus a visible staff phone number is the extent of "checkout." This removes the live-stock-validation requirement of the previous version and simplifies staff-side fulfillment considerably (§8).

This spans three repos in the monorepo (`/home/sushant/projects/service-plus/dev/`):
- **`service-plus-server`** — new tenant-schema tables, a new internal CRUD surface (GraphQL generic query/update, matching every other master table), new public (unauthenticated, key-gated) read + order-submission endpoints, and new image-upload/delete REST routes.
- **`service-plus-client`** — new internal admin screen under Masters where staff maintain the web catalogue and its photos.
- **`service-plus-web`** — new public pages for browsing the catalogue and submitting an order request.
- **`service-plus-file-server`** — **no route changes needed for per-part image storage** — the existing job-attachment upload/read/delete API is reused unmodified by repurposing its `branch_code`/`job_no` path segments (§4). One new route is needed only for the "delete an entire tenant's web-catalogue image folder in one shot" capability.

Everything below is grounded in the actual code (not guessed): `sql_bu_admin_ddl.py`'s `spare_part_master`/`branch`/`job_image_doc` DDL, `service-plus-file-server`'s `app/routers/files.py`, `service-plus-server`'s `image_router.py`/`file_client.py`/`app/core/email.py`, and `service-plus-client`'s existing `masters/parts/` screen and `job-image-upload.tsx`.

## 2. How the public site currently talks to the backend (the pattern to replicate)

- **Static export, no server code**: `service-plus-web`'s `next.config.ts` sets `output: "export"`. Every page is a `"use client"` component doing plain `fetch` straight to `service-plus-server`, via `lib/api.ts`'s `publicGet<T>(path, params)` helper. Base URL from `NEXT_PUBLIC_API_BASE_URL`, plus a required `X-Website-Key` header (`NEXT_PUBLIC_WEBSITE_KEY`) baked into the static bundle.
- **Backend gate**: `app/routers/public/website_router.py` (FastAPI, prefix `/api/public`) — every route is `Depends(require_website_key)` plus a per-route rate limiter.
- **Tenant resolution without login — the mechanism to reuse, not reinvent**: `app/services/public_directory.py`'s `public_directory` singleton fans out across every active row in `public.client`, reads each one's `security.bu`, and builds a 5-minute-TTL cache mapping an **opaque token** (`sha256(f"{db_name}:{bu_code}")[:20]`) → `(db_name, bu_code)`. `GET /api/public/companies` returns only `{id: token, label}` pairs — the browser never sees or can forge a real `db_name`/schema. This satisfies the prompt's "select a client + bu as in job query" requirement as-is — it's the exact same picker already used by the "Track your repair" / open-jobs pages. **The new parts endpoints reuse this same token**, resolved server-side via `public_directory.resolve_company(token)` before any SQL runs.
- SQL for public routes lives in `app/db/sql/sql_public.py` (`PublicSql` class) as whitelisted-column queries — no `SELECT *`, no raw SQL in the frontend.

## 3. Data model

### 3a. What exists today

- **`spare_part_master`**: `id, brand_id (FK brand), part_code, part_name, part_description, category, model (free text), uom, cost_price, mrp, hsn_code, gst_rate, is_active, selling_price, created_at, updated_at`. Internal parts catalogue, requires a `part_code` and a `brand_id`.
- **`branch`**: `id, code, name, phone, email, address_line1/2, state_id, city, pincode, gstin, is_active, is_head_office, created_at, updated_at`. There is **no separate "service center" table** — `branch` *is* the service-center concept in this codebase, and it already carries a public-facing `phone`/`email`, which §7 reuses for the "staff phone visible on web" requirement.
- **`job_image_doc`**: `id, job_id (FK job), url, created_at, about` — the established one-parent-many-images pattern (child table, not an array/JSON column). `spare_part_web_image` (below) mirrors this exactly.
- No existing order/inquiry table anywhere — confirmed via grep. `web_part_order`/`web_part_order_line` (below) are from-scratch, same as the prior version of this design.

### 3b. New tables

Added per-tenant-schema, in the same hand-maintained style as `spare_part_master`/`job_image_doc` (`app/db/sql/sql_bu_admin_ddl.py`, subclassed by `app/db/sql/sql_bu_admin.py`). **Important constraint discovered during research: there is no migration runner in this codebase.** New-tenant provisioning applies the whole `BU_SCHEMA_DDL` string wholesale (`app/graphql/resolvers/bu_admin/provisioning.py`); for tables added later, existing tenants need the DDL hand-applied to each live schema, and the template `service_plus_service.sql` re-extracted via `python -m app.db.tools.extract_schema` so `sql_bu_admin_ddl.py` stays in sync. Budget for this manual step explicitly in the rollout — it is not automatic.

```sql
CREATE TABLE spare_part_web (
    id               bigint NOT NULL,
    part_id          bigint REFERENCES spare_part_master(id),  -- nullable: NULL for market-sourced parts with no internal part code
    part_name        text NOT NULL,
    part_description text,
    price            numeric(12,2) NOT NULL,
    model            text,                                      -- free text, same convention as spare_part_master.model
    hsn_code         text,
    is_active        boolean NOT NULL DEFAULT true,
    image_url        text,                                      -- cover/thumbnail image; relative file-server path, e.g. "uploads/acme/mumbai/spare-parts-web/42/cover_....webp"
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spare_part_web ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME spare_part_web_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE spare_part_web ADD CONSTRAINT spare_part_web_pkey PRIMARY KEY (id);

-- Optional additional gallery images beyond the cover image (prompt: "if possible provide for
-- multiple images"). Mirrors job_image_doc exactly — child table, not an array column, matching
-- this codebase's one established convention for one-to-many images.
CREATE TABLE spare_part_web_image (
    id                 bigint NOT NULL,
    spare_part_web_id  bigint NOT NULL REFERENCES spare_part_web(id) ON DELETE CASCADE,
    url                text NOT NULL,
    sort_order         integer NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spare_part_web_image ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME spare_part_web_image_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE spare_part_web_image ADD CONSTRAINT spare_part_web_image_pkey PRIMARY KEY (id);

CREATE TABLE web_part_order (
    id               bigint NOT NULL,
    customer_name    text NOT NULL,
    mobile           text NOT NULL,
    email            text,
    remarks          text,
    status           text NOT NULL DEFAULT 'NEW'          -- NEW | CONTACTED | CANCELLED (see §8 — no automated fulfillment state machine in v1)
                        CHECK (status IN ('NEW','CONTACTED','CANCELLED')),
    total_amount     numeric(12,2) NOT NULL DEFAULT 0,     -- snapshot at submission time, server-computed
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE web_part_order ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME web_part_order_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE web_part_order ADD CONSTRAINT web_part_order_pkey PRIMARY KEY (id);

CREATE TABLE web_part_order_line (
    id                  bigint NOT NULL,
    web_part_order_id   bigint NOT NULL REFERENCES web_part_order(id) ON DELETE CASCADE,
    spare_part_web_id   bigint NOT NULL REFERENCES spare_part_web(id),
    qty                 integer NOT NULL CHECK (qty > 0),
    unit_price          numeric(12,2) NOT NULL,   -- spare_part_web.price snapshot at order time, server-recomputed, never client-trusted
    line_total           numeric(12,2) NOT NULL
);
ALTER TABLE web_part_order_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME web_part_order_line_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE web_part_order_line ADD CONSTRAINT web_part_order_line_pkey PRIMARY KEY (id);
```

**Deliberately no `stock_balance` interaction anywhere in this design.** `spare_part_web` rows are not linked to inventory (many will have `part_id IS NULL` and no `stock_balance` row could exist even if they wanted one), and prices are explicitly "indicative and can change without prior information" per the prompt. Availability is `is_active` only — no quantity/stock concept. This is a real simplification versus the previous version of this plan, which tried to gate the catalog on live `stock_balance` quantity; that no longer applies since the source table changed.

## 4. Image storage design — reusing the existing file-server API unmodified

Investigated `service-plus-file-server`'s `app/routers/files.py` directly. Its upload API takes `client_code, bu_code, branch_code, job_no` (all slugified) and nests files as `client_snake/bu_snake/branch_snake/job_no_snake/{stem}_{epoch_ms}.{ext}`; it returns a relative `url` like `uploads/<client>/<bu>/<branch>/<job_no>/<file>`. Reads (`GET /files/uploads/{path}`) and per-job deletes (`DELETE /files/delete-job`) key off those same four segments. None of this is job-specific in the route signature — `job_no` is just a path segment name.

**Design decision: repurpose those same four segments instead of adding new file-server routes.**
- `client_code` / `bu_code` — the tenant, exactly as for job images.
- `branch_code` → the fixed literal `"spare-parts-web"` (not an actual operational branch). The prompt asks for "a service center folder, so the entire folder can be deleted" — `spare_part_web` has no `branch_id` column (deliberately, per the prompt's own column list, since the web catalogue is BU-wide, not per-branch), so the natural "service-center-style" folder for this feature is a dedicated pseudo-branch segment per tenant: `.../{client}/{bu}/spare-parts-web/...`. Deleting that one path wipes every web-catalogue image for a tenant in one shot — the same guarantee the prompt describes for a real service-center folder, without requiring a `branch_id` on the table.
- `job_no` → `str(spare_part_web_id)`. This means **`DELETE /files/delete-job` already works unmodified as "delete all images for this one part"** — no file-server change needed for per-part cleanup.

**The one actual file-server change needed**: a new route to delete the whole `client/bu/spare-parts-web` subtree in one call (there is currently no delete-above-job-level capability — confirmed by reading `app/routers/files.py`; the closest precedent is `delete-job`'s per-file `iterdir()` loop). Add `DELETE /files/delete-folder` taking `client_code, bu_code, branch_code`, doing the equivalent of `shutil.rmtree` on that resolved 3-level directory, same `X-API-Key` gate as every other route. This is what actually satisfies "if required entire folder can be deleted" — used for a tenant-wide photo reset or feature offboarding, not part of the normal per-part CRUD flow.

**`service-plus-server` side** (`app/routers/media/image_router.py`, `app/services/file_client.py`) — extend, don't replace:
- `POST /api/images/spare-part-web/upload` — new sibling route next to the existing job-scoped `/api/images/upload`. Body: `db_name, schema, spare_part_web_id, client_code, bu_code, about?, files`. Calls `file_client.upload(client_code, bu_code, branch_code="spare-parts-web", job_no=str(spare_part_web_id), about, files)` (existing `FileClient.upload`, unchanged), then inserts one `spare_part_web_image` row per returned `{url}` via `exec_sql_object`. If `spare_part_web.image_url` is still `NULL`, auto-assign it to the first uploaded url as the cover.
- `DELETE /api/images/spare-part-web/{db_name}/{schema}/{image_id}` — mirrors the existing single-image delete: look up the row's `url`, `file_client.delete_by_url`, delete the DB row.
- `DELETE /api/images/spare-part-web/{db_name}/{schema}/part/{spare_part_web_id}` — mirrors `delete_job_images`: delete all `spare_part_web_image` rows for the part, then `file_client.delete_job_files(client_code, bu_code, "spare-parts-web", str(spare_part_web_id))` (existing method, unchanged — this is the reuse described above).
- **Reads need no new route at all.** `GET /api/images/uploads/{path}` already exists, is already unauthenticated ("paths are unguessable" — confirmed in `image_router.py`), and already proxies the file-server with the server's own trusted API key. It's already safe to use directly as the public image URL for the parts catalogue (`{API_BASE}/api/images/{spare_part_web.image_url with the leading "uploads/" segment}`). This also **resolves the deferred "Phase 3 image proxy" from the earlier version of this design** — it turns out to already exist for job images and needs zero new code to serve part images too.

Client-side compression: the existing `job-image-upload.tsx` already does canvas-based client-side compression before upload against a server-provided max-KB config (`GET /api/images/config`) — reuse this behavior in the new admin uploader (§6b), which is the max-size guard for part photos too.

## 5. New public API endpoints (`app/routers/public/website_router.py` + `sql_public.py`)

All under the existing `require_website_key` + rate-limit pattern; writes get a stricter limit than reads.

- **`GET /api/public/companies`** — unchanged from the existing "Track your repair" flow; reused as-is for "select client + bu."
- **`GET /api/public/company-info?company=`** — new, small addition: returns `{support_phone}` sourced from the tenant's head-office `branch.phone` (`WHERE is_head_office = true`, fallback to the first active branch if no head office is flagged). Backs the "phone no of staff will be visible on web" requirement (§9). If a dedicated public-facing number is later wanted instead of the head-office line, add a `web_support_phone` app-setting following the same pattern as the existing `track_job_url` setting — not needed for v1.
- **`GET /api/public/parts?company=&search=&page=&page_size=`** → paginated `{items: PartOut[], total, page, page_size}`. `PartOut = {id, part_name, part_description, price, model, image_url}`. Query: `SELECT ... FROM spare_part_web WHERE is_active = true`, `ILIKE` on `part_name`/`part_description`/`model` for `search`, ordered newest-first or by name. **`hsn_code` and `part_id` excluded from the public response** — same whitelist-columns discipline as the rest of the public API; HSN isn't sensitive but customers have no use for it, and `part_id` is an internal FK.
- **`GET /api/public/parts/{part_id}?company=`** → single `PartOut` plus `images: string[]` (from `spare_part_web_image`, ordered by `sort_order`), 404 if not found/inactive for that tenant.
- **`POST /api/public/part-orders`** → body `{company, customer_name, mobile, email?, remarks?, lines: [{part_id, qty}]}`. Server re-validates **only `is_active`** for each line (no stock check — there is no stock concept for this table), recomputes `unit_price`/`line_total`/`total_amount` from the current `spare_part_web.price` (never trusts a client-cached price), rejects with a clear per-line error if a part is now inactive or deleted, otherwise inserts `web_part_order` + `web_part_order_line`, **sends a notification email to staff** (reusing `app/core/email.py`'s existing `send_email(to, subject, body)` — no new email infra needed; recipient from a per-BU app-setting, e.g. `web_order_notify_email`, same two-step DDL pattern as `track_job_url`) with the order + line details, and returns `{order_id, status: "NEW"}`. Rate-limited tighter than reads.

## 6. Internal admin interface (`service-plus-client`) — maintaining the web catalogue

This is new scope versus the earlier version of this plan (which deferred images entirely). Staff need a full CRUD screen before there's anything to show on the public site.

### 6a. Catalogue CRUD screen

Follows the exact pattern already used for `spare_part_master` at `src/features/client/components/masters/parts/` (`parts-section.tsx` + `part-dialog.tsx`) — table + toolbar + single add/edit dialog (`mode: "add" | "edit"`), `react-hook-form` + `zod`, persistence through the existing **GraphQL generic-query/generic-update envelope** (`GRAPHQL_MAP.genericQuery` / `genericUpdate`, `SQL_MAP.*` named queries resolved server-side, `tableName: "spare_part_web"` for writes) — this is the established convention for every master-data table in this app; there are no per-table REST CRUD routers to build.

- New folder `src/features/client/components/masters/spare-parts-web/`: `spare-parts-web-section.tsx` (table: thumbnail, part name, model, price, HSN, "linked to `{part_code}`" badge when `part_id` is set vs. a "Market part" badge when null, is_active toggle, search) + `spare-part-web-dialog.tsx` (form fields matching §3b's columns, plus an optional autocomplete against `spare_part_master` to set `part_id`).
- Sidebar: add a `<TreeItem label="Spare Parts – Web Catalogue">` to the "Product & Parts" group in `client-explorer-panel.tsx`, and the matching `if (selected === "...")` branch in `client-masters-page.tsx` — same two-file pattern every existing Masters entry uses.
- Access gating: add `spare_part_web` to `BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS` (`app/graphql/resolvers/bu_admin/provisioning.py`) with a new right code, same as every other master table.

### 6b. Image management

`job-image-upload.tsx` is currently job-specific (hardcoded `jobId`/`jobNo` params calling `/api/images/upload`) — generalize it into an entity-agnostic uploader component (accepting an `entityId` + upload/delete endpoint props) reused here against the new `/api/images/spare-part-web/*` routes from §4, rather than writing a second bespoke uploader from scratch. Same UX as the job version: `react-dropzone`, client-side compression against the shared max-KB config, staged preview list, drag-to-reorder feeding `sort_order` on save.

## 7. Order notification & staff contact — the entire "checkout" in v1

Per the prompt, there is no payment gateway and no automated fulfillment workflow: "customer can select part and order. Email will be received by staff. Delivery and billing will be manual process by staff." This is deliberately lighter than the staff-fulfillment screen the earlier version of this plan proposed — that becomes an optional fast-follow (§8), not a v1 requirement.

- On order submission (§5's `POST /api/public/part-orders`), staff get an email via the existing `send_email` utility — no new SMTP/notification infrastructure needed, just a new call site and a per-BU recipient-address setting.
- The public site shows the staff phone number (from `GET /api/public/company-info`, §5) prominently on both the catalogue page and the order-confirmation screen, so customers can also just call.

## 8. Staff-side fulfillment — optional fast-follow, not required for v1

Since delivery/billing are explicitly manual/offline, `web_part_order` rows in v1 need only be queryable (a direct DB query, or a simple read-only admin list is enough — no state-machine UI required to ship). If/when it's worth building:

- A "Web Part Orders" list screen (list + expandable line items, filter by `status`), status transitions `NEW → CONTACTED → (fulfilled offline, no further status)` or `CANCELLED`.
- **Do not** auto-generate a Sales Invoice from every order — many lines will have `spare_part_web.part_id IS NULL` (no corresponding `spare_part_master` row, since these are market-sourced parts with no internal code), so there's nothing to invoice against automatically. For lines where `part_id IS NOT NULL`, staff *may* manually create a normal Sales Invoice through the existing flow if they want proper stock/accounting reconciliation — but that's a manual staff action, not something this feature should automate, consistent with "delivery and billing will be manual process by staff."

## 9. `service-plus-web` frontend additions

Following the conventions the "Track your repair" feature already established (`react-hook-form` + `zod` + shadcn/ui, `lib/api.ts`'s `publicGet`/`ApiError`, `sonner` toasts):

- New route `app/spare-parts/page.tsx` (static export supports multiple routes fine).
- `components/spare-parts/`:
  - `company-select.tsx` — reuse/extract the existing inline client+BU picker out of `job-status-form.tsx`/`open-jobs-form.tsx` into one shared component (now used by three features, not two — worth actually extracting this time).
  - `parts-search.tsx` — search box (name/model/description).
  - `parts-grid.tsx` / `part-card.tsx` — thumbnail (`spare_part_web.image_url`), name, model, price, qty stepper, "Add to cart." Prominent, persistent disclaimer near the price: **"Prices are indicative and subject to change without prior notice."**
  - `part-detail-dialog.tsx` — full description, HSN not shown (§5), image gallery (cover + `spare_part_web_image` list) with a simple lightbox/carousel for the "if available, multiple images" case.
  - `cart-drawer.tsx` — client-side only, `localStorage`-persisted, line items + qty + running total.
  - `checkout-form.tsx` — customer name/mobile/email, remarks, submit → `submitPartOrder`. No pickup/delivery choice, no address field, no payment step — those were part of the earlier, more elaborate version of this design and don't apply now that fulfillment is entirely manual/offline.
  - `order-confirmation.tsx` — order id, explicit **"No online payment. No return or replacement once shipped. Our team will contact you to arrange delivery and billing."** messaging, plus the staff phone number from `company-info`.
- `lib/api.ts` + `lib/types.ts`: add `fetchParts`, `fetchPartById`, `fetchCompanyInfo`, `submitPartOrder` + matching types.
- `components/home/feature-cards.tsx`: flip "Genuine spare parts" from "Coming soon" to a real link to `/spare-parts`.
- `components/layout/header.tsx`: add the nav link to the new route (currently a single-page site with no nav).

## 10. Known limitations to flag explicitly

- The catalogue is fully decoupled from live inventory by design (no `stock_balance` check) — a part can show as available on the website while actually out of stock in the branch that would fulfill it. This is the direct consequence of "prices are indicative and can change without prior information" and the manual fulfillment model; staff are the backstop, not the system.
- Search is free-text only (`part_name`/`description`/`model`) — same limitation as the earlier version of this plan, now more clearly correct: `spare_part_web` has no FK to `product`/`product_brand_model` either, and many rows won't even have a `part_id`.
- No versioned migration tooling exists in this codebase (§3b) — rolling the new tables out to existing tenants is a manual, per-tenant step every time, not a deploy-time migration. Plan the rollout accordingly.

## 11. Phased rollout

1. **Phase 1 — schema + admin only, nothing public.** `spare_part_web`, `spare_part_web_image`, `web_part_order`, `web_part_order_line` DDL (new tenants via template; existing tenants hand-applied per §3b); the `/api/images/spare-part-web/*` routes (§4); the Masters admin screen + image manager (§6). Staff populate the catalogue and confirm image upload/delete/reordering works before anything is public.
2. **Phase 2 — public read-only catalog.** `GET /api/public/parts*`, `GET /api/public/company-info`, the `service-plus-web` browse/detail pages (§9, minus checkout). Verify images render correctly via the existing unauthenticated proxy.
3. **Phase 3 — order submission.** `POST /api/public/part-orders`, cart/checkout/confirmation UI, staff email notification (§5, §7). This is the point the feature is genuinely usable end-to-end.
4. **Phase 4 (optional)** — the "Web Part Orders" staff list screen and/or the tenant-wide `DELETE /files/delete-folder` capability (§4, §8), added only if/when actually needed.

## 12. Verification

- **Backend**: confirm the new public endpoints are unreachable without `X-Website-Key`; confirm the opaque `company` token round-trips correctly and can't be forged into a different tenant's data; confirm `POST /api/public/part-orders` rejects a line for a part that's since been deactivated, and that it recomputes price server-side rather than trusting the client; confirm the staff notification email actually sends (or logs a clear warning when SMTP isn't configured, per the existing `send_email` behavior); confirm rate limits apply.
- **Images**: confirm an uploaded part image lands at `.../{client}/{bu}/spare-parts-web/{spare_part_web_id}/...`; confirm deleting a part's images removes both the `spare_part_web_image` rows and the on-disk files (via the reused `delete-job` file-server route); confirm the public detail page can actually load images through `GET /api/images/uploads/{path}` unauthenticated.
- **Admin CRUD**: confirm the new Masters screen respects the new access-right gate (a role without it can't see/edit `spare_part_web`), and that the optional `part_id` autocomplete correctly leaves it `NULL` for market-sourced entries.
- **Frontend**: `next build` (static export) and confirm the new route emits into `out/`; verify the cart survives a page reload (localStorage) and clears after a successful order; verify the indicative-price and no-return-policy disclaimers are visible on both the listing and the order-confirmation screen.
