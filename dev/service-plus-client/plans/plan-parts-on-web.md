# Spare Parts Sale on the Web — Design

## 1. Context

`service-plus-web` (the public Next.js static site) has a "Genuine spare parts — Coming soon" teaser card (`components/home/feature-cards.tsx`) sitting next to the live "Track your repair" feature. This design fills that placeholder.

**What the feature is.** A public, per-branch spare-parts catalogue that customers browse without logging in, plus a lightweight order request that lands in staff's inbox. There is no payment gateway and no automated fulfillment: prices are explicitly "indicative, subject to change without notice," there is no return/replace policy, and delivery and billing are manual, staff-driven processes outside the app. An email to staff plus a visible staff phone number is the entire "checkout."

**The catalogue is web-exclusive.** It is backed by its own table, `spare_part_web` — not `spare_part_master` or `stock_balance`. Staff can list market-sourced parts that have no internal part code at all (`part_id` is nullable), which is why the catalogue is decoupled from inventory entirely (§3d).

**Tenancy and branch scoping.** The chain is `client → database`, `bu → schema`, `branch → rows within that schema`:

- One client = one PostgreSQL database. One BU = one schema inside it, with its own full set of tables. Both are handled by the existing public company token (§2).
- A BU has **one or many branches** (`branch` table, §3a). **Each branch keeps its own part catalogue** — `spare_part_web.branch_id` — and every public read plus the order submission is scoped to one branch.
- **Single-branch BUs**: the one branch is selected automatically and **the branch dropdown is not rendered at all**. The customer sees a one-step flow: pick company → browse.
- **Multi-branch BUs**: a branch dropdown appears next to the company picker, **defaulting to the first branch** returned by the API. Changing it swaps the catalogue.

**Images.** A part's photos are an ordered `text[]` of file-server paths on `spare_part_web` itself (§3c) — there is no child image table and no separate cover column; element 1 *is* the cover. Photos are stored per branch under a dedicated folder that can be deleted in one shot (§4).

This spans four repos in the monorepo (`/home/sushant/projects/service-plus/dev/`):
- **`service-plus-server`** — new tenant-schema tables, a new internal CRUD surface (GraphQL generic query/update, matching every other master table), new public (unauthenticated, key-gated) read + order-submission endpoints, and new image-upload/delete REST routes.
- **`service-plus-client`** — new internal admin screen under Masters where staff maintain the web catalogue and its photos.
- **`service-plus-web`** — new public pages for browsing the catalogue and submitting an order request.
- **`service-plus-file-server`** — **no route changes needed for per-part image storage**; the existing job-attachment upload/read/delete API is reused unmodified by repurposing its `branch_code`/`job_no` path segments (§4). One new route is needed only for the "delete a branch's entire web-catalogue image folder in one shot" capability.

Everything below is grounded in the actual code, not guessed: `sql_bu_admin_ddl.py`'s `spare_part_master`/`branch`/`job_image_doc` DDL, `service-plus-file-server`'s `app/routers/files.py`, `service-plus-server`'s `image_router.py`/`file_client.py`/`psycopg_driver.py`/`app/core/email.py`, and `service-plus-client`'s `masters/parts/` screen, `job-image-upload.tsx` and `store/context-slice.ts`.

## 2. How the public site talks to the backend (the pattern to replicate)

- **Static export, no server code**: `service-plus-web`'s `next.config.ts` sets `output: "export"`. Every page is a `"use client"` component doing plain `fetch` straight to `service-plus-server`, via `lib/api.ts`'s `publicGet<T>(path, params)` helper. Base URL from `NEXT_PUBLIC_API_BASE_URL`, plus a required `X-Website-Key` header (`NEXT_PUBLIC_WEBSITE_KEY`) baked into the static bundle.
- **Backend gate**: `app/routers/public/website_router.py` (FastAPI, prefix `/api/public`) — every route is `Depends(require_website_key)` plus a per-route rate limiter.
- **Tenant resolution without login — the mechanism to reuse, not reinvent**: `app/services/public_directory.py`'s `public_directory` singleton fans out across every active row in `public.client`, reads each one's `security.bu`, and builds a 5-minute-TTL cache mapping an **opaque token** (`sha256(f"{db_name}:{bu_code}")[:20]`) → `(db_name, bu_code)`. `GET /api/public/companies` returns only `{id: token, label}` pairs — the browser never sees or can forge a real `db_name`/schema. This satisfies the "select a client + bu as in job query" requirement as-is; it is the same picker the "Track your repair" / open-jobs pages already use. **The parts endpoints reuse this token**, resolved server-side via `public_directory.resolve_company(token)` before any SQL runs.
  - The directory already collapses the client/BU distinction for display: `_refresh()` labels a company `"{client_name} — {bu_name}"` only when that client has more than one active BU, otherwise just `client_name`. **The branch dropdown (§5, §9) applies the same show-only-when-it-matters principle one level down.**
  - **Branch is deliberately *not* folded into the company token.** The token identifies `(db_name, bu_code)` = (database, schema), which is what SQL routing needs; branch is an ordinary column filter inside that schema. Branches are addressed by their own public identifier — `branch.code` — validated server-side against the resolved tenant on every request (§5).
- **No internal ids on the wire**: `website_router.py`'s module docstring states the rule outright — *"No amounts and no internal ids are ever returned."* This is why the branch parameter is `branch.code` (stable, human-meaningful, tenant-scoped) and not `branch.id`.
- SQL for public routes lives in `app/db/sql/sql_public.py` (`PublicSql` class) as whitelisted-column queries — no `SELECT *`, no raw SQL in the frontend.

## 3. Data model

### 3a. What exists today

- **`spare_part_master`**: `id, brand_id (FK brand), part_code, part_name, part_description, category, model (free text), uom, cost_price, mrp, hsn_code, gst_rate, is_active, selling_price, created_at, updated_at`. Internal parts catalogue, requires a `part_code` and a `brand_id`.
- **`branch`**: `id, code, name, phone, email, address_line1/2, state_id, city, pincode, gstin, is_active, is_head_office, created_at, updated_at`. There is **no separate "service center" table** — `branch` *is* the service-center concept in this codebase, and it carries a public-facing `phone`/`email` that §7 reuses for the "staff phone visible on web" requirement. Two properties matter here:
  - `CONSTRAINT branch_code_check CHECK (code ~ '^[A-Z0-9_]+$')` — `code` is restricted to uppercase alphanumerics plus underscore, making it safe to drop straight into a URL query param (§5) and a filesystem path segment (§4) with no escaping.
  - `is_head_office boolean` — the fallback when resolving a support phone number for a BU that hasn't set a per-branch one.
- **Branch membership is already first-class in the internal client app**: `src/store/context-slice.ts` holds `availableBranches: BranchContextType[]` / `currentBranch` in Redux, with `selectIsBuBranchDivisionComplete` gating screens until a BU **and** branch are chosen, and `bu-branch-switcher.tsx` / `bu-branch-division-gate.tsx` driving it. The admin screen (§6) inherits branch scoping from this machinery rather than adding its own picker.
- **`job_image_doc`**: `id, job_id (FK job), url, created_at, about` — the codebase's one-parent-many-images pattern (child table, not an array/JSON column). **This design deliberately does not follow it**; see §3c.
  - The load-bearing detail is `about`: `job-image-upload.tsx` treats it as a **required** per-image caption (blocks upload when any staged file has an empty `about`, line ~249) and renders it as both the visible label and the `alt` text. A row per image exists largely to hold that caption.
- **`jsonb` precedent**: `app_setting.setting_value` and `division.account_setting` are `jsonb`. Worth knowing because it establishes how a non-scalar column is written through the generic envelope — the client `JSON.stringify()`s the value and sends it as a string (`edit-division-dialog.tsx:287`), which Postgres casts on the way in. There is **no `text[]` column in the DDL yet**; §3c explains why one is still the right call.
- No existing order/inquiry table anywhere, confirmed via grep — `web_part_order`/`web_part_order_line` are from scratch.

### 3b. New tables

Added per-tenant-schema, in the same hand-maintained style as `spare_part_master`/`job_image_doc` (`app/db/sql/sql_bu_admin_ddl.py`, subclassed by `app/db/sql/sql_bu_admin.py`). **Important constraint discovered during research: there is no migration runner in this codebase.** New-tenant provisioning applies the whole `BU_SCHEMA_DDL` string wholesale (`app/graphql/resolvers/bu_admin/provisioning.py`); for tables added later, existing tenants need the DDL hand-applied to each live schema, and the template `service_plus_service.sql` re-extracted via `python -m app.db.tools.extract_schema` so `sql_bu_admin_ddl.py` stays in sync. Budget for this manual step explicitly in the rollout — it is not automatic.

```sql
CREATE TABLE spare_part_web (
    id               bigint NOT NULL,
    branch_id        bigint NOT NULL REFERENCES branch(id),    -- the catalogue is per branch; every row belongs to exactly one
    part_id          bigint REFERENCES spare_part_master(id),  -- nullable: NULL for market-sourced parts with no internal part code
    part_name        text NOT NULL,
    part_description text,
    price            numeric(12,2) NOT NULL,
    model            text,                                     -- free text, same convention as spare_part_master.model
    hsn_code         text,
    is_active        boolean NOT NULL DEFAULT true,
    -- Ordered gallery. Element 1 is the cover/thumbnail; there is no separate cover column.
    -- Relative file-server paths, e.g. "uploads/acme/mumbai/spare_parts_web_bhopal/42/front_....webp".
    -- NOT NULL + DEFAULT '{}' so every read can assume a real array and skip NULL handling.
    image_urls       text[] NOT NULL DEFAULT '{}',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spare_part_web ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME spare_part_web_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE spare_part_web ADD CONSTRAINT spare_part_web_pkey PRIMARY KEY (id);

-- Every public read filters on (branch_id, is_active); this is the one index that matters.
CREATE INDEX spare_part_web_branch_active_idx ON spare_part_web (branch_id, is_active);

-- A branch should not list the same internal part twice. Partial, because part_id is NULL for
-- market-sourced rows and a branch may legitimately list several distinct unlinked parts.
CREATE UNIQUE INDEX spare_part_web_branch_part_uq
    ON spare_part_web (branch_id, part_id) WHERE part_id IS NOT NULL;

CREATE TABLE web_part_order (
    id               bigint NOT NULL,
    branch_id        bigint NOT NULL REFERENCES branch(id),  -- the branch whose catalogue was ordered from; also decides who gets the email (§7)
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
    line_total          numeric(12,2) NOT NULL
);
ALTER TABLE web_part_order_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME web_part_order_line_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
);
ALTER TABLE web_part_order_line ADD CONSTRAINT web_part_order_line_pkey PRIMARY KEY (id);
```

Three tables total. Images need no table of their own (§3c).

**An order never spans two branches.** `web_part_order.branch_id` is on the header, not the line, and the server rejects the whole submission if any `spare_part_web_id` in `lines` belongs to a different branch (§5). This is enforced server-side rather than by a DB constraint because the cross-table check would need a trigger; the frontend also prevents it structurally by scoping the cart to one branch (§9).

### 3c. Image urls: why `image_urls text[]`

A part's photos are an ordered array of file-server paths in one column on `spare_part_web`. The two alternatives were weighed against the actual code:

**A comma-separated string is rejected.** It needs `split`/`join` glue at every read and write, carries no type information, can't be manipulated or validated by Postgres, and silently corrupts the day a stored path contains a comma. It buys nothing over a real array — `text[]` is the same "one column" win without any of the downsides.

**A child table (`spare_part_web_image`) is rejected.** The `job_image_doc` precedent (§3a) is correct for jobs for a reason that doesn't transfer: it exists largely to carry a **required per-image `about` caption**, because a job's photos are pictures of different unnamed things ("front panel dent", "serial plate") and each needs its own description. **A part's photos are all photos of the same, already-named part** — alt text is derivable (`alt={part_name}`, plus an index for the 2nd+ image), and captions are explicitly not wanted. Strip `about` away and the child table is a `sort_order` column and a join wrapped around a list of strings.

What `text[]` buys concretely:
- **One less table**, one less identity sequence, one less FK, one less hand-applied DDL statement per existing tenant — not a small thing given there is no migration runner (§3b) and every table is rolled out manually per schema.
- **The public detail endpoint loses a query.** §5's `GET /parts/{id}` returns `images: string[]` straight off the row instead of a second SELECT or a join with an ORDER BY.
- **Ordering is free.** Array order *is* display order, so a `sort_order` column and reorder-N-rows updates never exist. Reordering is one full-array write.
- **It writes through the existing generic envelope with zero glue.** `get_sql()` (`psycopg_driver.py:503`) drops values straight into the params tuple, and psycopg3 adapts a Python list of strings to `text[]` natively — so a JSON array in the `genericUpdate` payload lands correctly with no server change. This is also why `text[]` beats `jsonb` despite `jsonb` having the codebase precedent: jsonb would need the `JSON.stringify()`-to-string dance that `account_setting` uses, and psycopg would adapt a *list of dicts* to `jsonb[]` rather than `jsonb` anyway.

**Concurrency is the one real trade-off, and it is manageable.** A child table gets safe concurrent inserts for free; an array read-modify-write can lose a write. Avoid it by never doing read-modify-write in Python — do it in SQL, in one statement:
- append on upload: `UPDATE spare_part_web SET image_urls = image_urls || %s::text[] WHERE id = %s`
- remove one image: `UPDATE spare_part_web SET image_urls = array_remove(image_urls, %s) WHERE id = %s`
- reorder / clear: a deliberate full-array write, last-writer-wins — acceptable, since reordering is an explicit single-user action on one part in an admin screen.

**What this gives up**, all acceptable and none silent:
- No per-image caption or alt-text field, by design. Should that ever be wanted, the path is `image_urls text[]` → `jsonb` (`[{url, about}]`) plus a rewrite of the three statements above — and with no migration tooling, a hand-applied change per tenant schema (§10).
- No `ON DELETE CASCADE` for images; deleting a part row just drops the array. No integrity is lost, because neither approach has referential integrity to the *filesystem* — orphaned files are cleaned by the file-server calls in §4 regardless.
- No efficient "which parts use this url" query without a GIN index. Nothing in this design asks that question.

### 3d. No inventory coupling

**There is deliberately no `stock_balance` interaction anywhere in this design.** `spare_part_web` rows are not linked to inventory — many will have `part_id IS NULL`, and no `stock_balance` row could exist for those even in principle — and prices are explicitly indicative and subject to change without prior information. Availability is `is_active` only; there is no quantity or stock concept, and therefore no live-stock validation at order time.

## 4. Image storage — reusing the existing file-server API unmodified

`service-plus-file-server`'s `app/routers/files.py` upload API takes `client_code, bu_code, branch_code, job_no` (all slugified) and nests files as `client_snake/bu_snake/branch_snake/job_no_snake/{stem}_{epoch_ms}.{ext}`; it returns a relative `url` like `uploads/<client>/<bu>/<branch>/<job_no>/<file>`. Reads (`GET /files/uploads/{path}`) and per-job deletes (`DELETE /files/delete-job`) key off those same four segments. None of this is job-specific in the route signature — `job_no` is just a path segment name.

**Design decision: repurpose those four segments instead of adding new file-server routes.** Because the catalogue is branch-scoped, it maps onto the file server's existing hierarchy almost exactly.

- `client_code` / `bu_code` — the tenant, exactly as for job images.
- `branch_code` → the literal `"spare-parts-web-"` prefixed with the row's own `branch.code`, e.g. `"spare-parts-web-BHOPAL"`. The file server's `_to_snake_case()` (`re.sub(r"[^a-z0-9]", "_", s.lower())`, collapsing runs and stripping edges) turns that into `spare_parts_web_bhopal`. This satisfies "a service center folder, so the entire folder can be deleted" literally: **each branch's web-catalogue images live in exactly one directory that can be deleted in one shot.**
  - *Why not the bare branch code?* Because `.../{client}/{bu}/{branch}/` is already the job-image folder for that branch. Sharing it would (a) let a `job_no` and a `spare_part_web_id` collide on the 4th segment, and (b) make "delete this branch's part photos" indistinguishable from "delete this branch's job photos." The prefix keeps the two feature namespaces disjoint while staying per-branch.
  - *Residual collision risk, noted and accepted*: `branch.code` is `^[A-Z0-9_]+$` (§3a), so a branch literally named `SPARE_PARTS_WEB_BHOPAL` would slugify onto another branch's part folder. Vanishingly unlikely, unenforceable at the DB level, and cheap to guard against in the admin UI if it ever matters.
- `job_no` → `str(spare_part_web_id)`. The id comes from a schema-level identity sequence, so it is unique across every branch in the BU — no cross-branch path collision is possible even before the branch folder scopes it. This means **`DELETE /files/delete-job` works unmodified as "delete all images for this one part"**; no file-server change is needed for per-part cleanup.

**The one actual file-server change needed**: a route to delete a whole 3-level `client/bu/{branch-folder}` subtree in one call. There is no delete-above-job-level capability today — the closest precedent is `delete-job`'s per-file `iterdir()` loop. Add `DELETE /files/delete-folder` taking `client_code, bu_code, branch_code`, doing the equivalent of `shutil.rmtree` on that resolved 3-level directory, behind the same `X-API-Key` gate as every other route. This is what satisfies "if required entire folder can be deleted."
- Called with `branch_code="spare-parts-web-{CODE}"` it wipes **one branch's** catalogue images — the common case, e.g. a branch that stops selling parts online.
- A **tenant-wide** reset is that same call looped over the BU's branches. Deliberately *not* a 2-level `client/bu` rmtree, which would take every branch's job images with it.

**`service-plus-server` side** (`app/routers/media/image_router.py`, `app/services/file_client.py`) — extend, don't replace:
- `POST /api/images/spare-part-web/upload` — sibling route next to the job-scoped `/api/images/upload`. Body: `db_name, schema, spare_part_web_id, client_code, bu_code, files`. Calls `file_client.upload(...)` with `branch_code=f"spare-parts-web-{branch_code}"` and `job_no=str(spare_part_web_id)` (existing `FileClient.upload`, unchanged — it forwards a `form_data` dict, so no signature change), then appends the returned urls in **one statement**: `UPDATE spare_part_web SET image_urls = image_urls || %s::text[], updated_at = now() WHERE id = %s` (§3c). No cover-assignment step exists, because element 1 is the cover by definition — the first upload onto an empty array becomes the cover automatically. The route resolves the part's `branch_id → branch.code` itself rather than trusting a client-supplied branch, so an image can never be filed under a branch the part doesn't belong to.
- `DELETE /api/images/spare-part-web/{db_name}/{schema}/{spare_part_web_id}/image` with the url in the body — **keyed by url, not by an image id**, since there are no per-image ids. Calls the existing `file_client.delete_by_url(url)` (unchanged), then `UPDATE spare_part_web SET image_urls = array_remove(image_urls, %s) WHERE id = %s`. Both halves key off the same url, matching `DELETE /files/by-url`, which is the file server's native single-file idiom.
  - Removing element 1 promotes element 2 to cover automatically — no cover-repair step.
- `PUT /api/images/spare-part-web/{db_name}/{schema}/{spare_part_web_id}/order` — accepts the full reordered url list and writes it in one `UPDATE ... SET image_urls = %s`. Validate that the submitted list is a permutation of the stored one (same multiset) and reject otherwise, so a stale client can't inject or drop urls through the reorder path.
- `DELETE /api/images/spare-part-web/{db_name}/{schema}/part/{spare_part_web_id}` — mirrors `delete_job_images`: `UPDATE spare_part_web SET image_urls = '{}' WHERE id = %s`, then `file_client.delete_job_files(client_code, bu_code, f"spare-parts-web-{branch_code}", str(spare_part_web_id))` (existing method, unchanged), with `branch_code` again resolved server-side from the part's `branch_id`.
- **Deleting a part row** must call that route first. There is no `ON DELETE CASCADE` to lean on, and clearing an array is not what removes files anyway — wire it into the admin delete action so a deleted part doesn't strand its folder on disk.
- **Reads need no new route at all.** `GET /api/images/uploads/{path}` exists, is unauthenticated by design ("paths are unguessable" — stated in `image_router.py`), and proxies the file server with the server's own trusted API key. It is safe to use directly as the public image URL for the catalogue (`{API_BASE}/api/images/{any element of spare_part_web.image_urls, with the leading "uploads/" segment}`), and needs no branch awareness, since the branch is baked into the stored path.

Client-side compression: `job-image-upload.tsx` already does canvas-based compression before upload against a server-provided max-KB config (`GET /api/images/config`). Reusing that component (§6b) carries the max-size guard to part photos for free.

## 5. Public API endpoints (`app/routers/public/website_router.py` + `sql_public.py`)

All under the existing `require_website_key` + rate-limit pattern; writes get a stricter limit than reads.

**Branch resolution — one shared helper used by every route below.** Add `resolve_branch(db_name, schema, branch_code | None) -> Branch` alongside the existing `public_directory.resolve_company` call in each route:

- Query the tenant schema for active branches (`SELECT id, code, name, phone, email, city, is_head_office FROM branch WHERE is_active = true ORDER BY is_head_office DESC, code`, whitelisted columns, added to `PublicSql` — `sql_public.py` has no branch query today).
- If `branch_code` is omitted → **return the first row** (head office first, then code order). This is the "default the first branch" rule, and it makes `branch` an optional param everywhere, so a single-branch tenant's frontend can simply never send it.
- If `branch_code` is supplied but doesn't match an active branch of *that* tenant → `404 Unknown branch`. This stops a customer hand-editing the query string to reach an inactive branch's catalogue. The company token pins the database and schema, so a forged `branch` can at worst name a branch inside the tenant they already selected — and that is rejected too unless it is active.

Endpoints:

- **`GET /api/public/companies`** — the existing route, reused as-is for "select client + bu."
- **`GET /api/public/branches?company=`** — returns `[{code, name, city, is_head_office}]` for the tenant's active branches, in the order above. No `id`, no `email`, no address — whitelist discipline per §2.
  - **This is the endpoint that drives the show/hide rule**: the frontend fetches it once per company; **exactly one** branch means no dropdown is rendered and that branch is used implicitly (§9), more than one means a dropdown preselected to `[0]`.
  - Rate-limited like `/companies` (30/min) — a cheap, cacheable read hit once per company selection.
- **`GET /api/public/company-info?company=&branch=`** — returns `{support_phone, branch_name}` for the **selected branch** (`branch.phone`), falling back to the head-office branch's phone when the selected branch has none, then to the first active branch. Backs the "phone no of staff will be visible on web" requirement (§9); per-branch matters, since a customer ordering from the Bhopal catalogue should be calling Bhopal. If a dedicated public-facing number is wanted later instead of the branch line, add a `web_support_phone` app-setting following the existing `track_job_url` pattern — not needed for v1.
- **`GET /api/public/parts?company=&branch=&search=&page=&page_size=`** → paginated `{items: PartOut[], total, page, page_size}`. `PartOut = {id, part_name, part_description, price, model, image_url}`, where `image_url` is the **cover only**, selected as `image_urls[1] AS image_url` (Postgres arrays are 1-based, and the expression yields `NULL` for an empty array, so no CASE is needed). The listing deliberately does not ship the whole gallery. Query: `SELECT ... FROM spare_part_web WHERE branch_id = %(branch_id)s AND is_active = true`, `ILIKE` on `part_name`/`part_description`/`model` for `search`, ordered newest-first or by name. **`hsn_code`, `part_id` and `branch_id` are excluded from the response** — HSN isn't sensitive but customers have no use for it, and `part_id`/`branch_id` are internal ids (§2).
- **`GET /api/public/parts/{part_id}?company=&branch=`** → single `PartOut` plus `images: string[]`, read straight off the same row's `image_urls`, already in display order, **no second query and no join** (§3c). psycopg returns a `text[]` as a Python list, so it serialises to a JSON array with no conversion code. 404 if not found, inactive, **or not owned by the resolved branch** — the `branch_id` predicate belongs in this query too, not just the list query, so a guessed part id from a sibling branch returns 404 rather than leaking a row.
- **`POST /api/public/part-orders`** → body `{company, branch?, customer_name, mobile, email?, remarks?, lines: [{part_id, qty}]}`. Resolves the branch as above, then re-validates each line **against that branch**: the part must exist, be `is_active`, **and have `branch_id` = the resolved branch** (no stock check, per §3d). Recomputes `unit_price`/`line_total`/`total_amount` from the current `spare_part_web.price`, never trusting a client-cached price; rejects with a clear per-line error if a part is inactive, deleted, or from another branch; otherwise inserts `web_part_order` (with `branch_id`) + `web_part_order_line`, **sends a notification email to staff** (§7), and returns `{order_id, status: "NEW"}`. Rate-limited tighter than reads.

## 6. Internal admin interface (`service-plus-client`) — maintaining the web catalogue

Staff need a full CRUD screen before there is anything to show on the public site.

### 6a. Catalogue CRUD screen

Follows the pattern already used for `spare_part_master` at `src/features/client/components/masters/parts/` (`parts-section.tsx` + `part-dialog.tsx`) — table + toolbar + single add/edit dialog (`mode: "add" | "edit"`), `react-hook-form` + `zod`, persistence through the **GraphQL generic-query/generic-update envelope** (`GRAPHQL_MAP.genericQuery` / `genericUpdate`, `SQL_MAP.*` named queries resolved server-side, `tableName: "spare_part_web"` for writes). This is the established convention for every master-data table in this app; there are no per-table REST CRUD routers to build.

- New folder `src/features/client/components/masters/spare-parts-web/`: `spare-parts-web-section.tsx` (table: thumbnail, part name, model, price, HSN, "linked to `{part_code}`" badge when `part_id` is set vs. a "Market part" badge when null, is_active toggle, search) + `spare-part-web-dialog.tsx` (form fields matching §3b's columns, plus an optional autocomplete against `spare_part_master` to set `part_id`).
- **Branch scoping comes from the existing context** (§3a): read `selectCurrentBranch` from `src/store/context-slice.ts`, filter the list query by that `branch.id`, and stamp it onto `branch_id` on insert — `branch_id` is never a form field. Staff maintain "this branch's web catalogue" and switch branches with the existing `bu-branch-switcher.tsx` in the top nav, exactly as they do for every other branch-scoped screen. Show the current branch name in the section header so it is unambiguous which catalogue is being edited.
  - The screen must react to a branch switch by refetching (the same invalidation the other branch-scoped sections use), not show a stale list.
  - `selectIsBuBranchDivisionComplete` already blocks the client area until a branch is chosen, so `currentBranch` can be treated as non-null here.
- **Optional convenience for multi-branch tenants**: a "Copy to branch…" bulk action that clones selected rows into another branch (new `spare_part_web` rows with `image_urls` reset to `'{}'` — images are physically filed under the source branch's folder per §4, so copying the paths would break the delete-one-branch guarantee). Without it, a 6-branch tenant with a largely identical catalogue re-keys everything six times. Include it in Phase 1 only if a real tenant has that shape; otherwise it is a fast-follow.
- Sidebar: add a `<TreeItem label="Spare Parts – Web Catalogue">` to the "Product & Parts" group in `client-explorer-panel.tsx`, and the matching `if (selected === "...")` branch in `client-masters-page.tsx` — the same two-file pattern every existing Masters entry uses.
- Access gating: add `spare_part_web` to `BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS` (`app/graphql/resolvers/bu_admin/provisioning.py`) with a new right code, same as every other master table.

### 6b. Image management

`job-image-upload.tsx` is job-specific (hardcoded `jobId`/`jobNo` params calling `/api/images/upload`). Generalize it into an entity-agnostic uploader component (accepting an `entityId` plus upload/delete endpoint props) and reuse it against the `/api/images/spare-part-web/*` routes from §4, rather than writing a second bespoke uploader. Two deliberate differences from the job version, both following from §3c:

- **No `about` field.** The job uploader makes `about` a required per-file caption and blocks upload without it (`job-image-upload.tsx:249`); the generalized component must make that behaviour opt-in via a prop, since part photos have no caption to write and forcing staff to invent one for every photo is pure friction. The public gallery uses `alt={part_name}` instead (§9).
- **Reorder posts the full url list** to the `/order` route rather than patching per-row sort values.

Everything else carries over: `react-dropzone`, client-side compression against the shared max-KB config, staged preview list, drag-to-reorder. The uploader stays branch-unaware — it passes the `spare_part_web_id` and the server derives the branch folder from the row (§4), so the admin UI cannot file an image under the wrong branch.

## 7. Order notification & staff contact — the entire "checkout"

There is no payment gateway and no automated fulfillment workflow: customers select parts and order, staff receive an email, and delivery and billing are manual staff processes. No staff-side state machine is required to ship (§8).

- On order submission (§5's `POST /api/public/part-orders`), staff get an email via the existing `send_email(to, subject, body)` in `app/core/email.py` — no new SMTP or notification infrastructure, just a new call site.
- **Recipient resolution is branch-first**, since the order belongs to one branch and that branch fulfills it: `branch.email` of the ordered-from branch → a per-BU `web_order_notify_email` app-setting (same two-step DDL pattern as the existing `track_job_url` setting) → the head-office branch's email. If none resolves, log a clear warning and **still persist the order**; an order row with no email is recoverable, a lost order is not.
- Put the branch name in the subject line (e.g. `New web parts order #142 — BHOPAL`) so a shared BU-level inbox can still route by branch.
- The public site shows the **selected branch's** staff phone number (from `GET /api/public/company-info?branch=`, §5) prominently on both the catalogue page and the order-confirmation screen, so customers can also just call the branch that will actually deliver.

## 8. Staff-side fulfillment — optional fast-follow, not required for v1

Since delivery and billing are manual and offline, `web_part_order` rows need only be queryable to ship — a direct DB query or a simple read-only admin list is enough, with no state-machine UI. If and when it is worth building:

- A "Web Part Orders" list screen (list + expandable line items, filter by `status`), status transitions `NEW → CONTACTED → (fulfilled offline, no further status)` or `CANCELLED`. Scope it to `currentBranch` like §6a, with the branch name in the header — branch staff should see their own orders by default. A BU-wide "all branches" toggle for managers is a nice-to-have.
- **Do not** auto-generate a Sales Invoice from every order. Many lines will have `spare_part_web.part_id IS NULL` (market-sourced parts with no `spare_part_master` row), so there is nothing to invoice against automatically. For lines where `part_id IS NOT NULL`, staff *may* manually create a normal Sales Invoice through the existing flow if they want stock and accounting reconciliation — a manual staff action, not something this feature automates, consistent with billing being manual.

## 9. `service-plus-web` frontend additions

Following the conventions the "Track your repair" feature established (`react-hook-form` + `zod` + shadcn/ui, `lib/api.ts`'s `publicGet`/`ApiError`, `sonner` toasts):

- New route `app/spare-parts/page.tsx` (static export supports multiple routes fine).
- `components/spare-parts/`:
  - `company-select.tsx` — extract the inline client+BU picker out of `job-status-form.tsx`/`open-jobs-form.tsx` into one shared component, now used by three features rather than two.
  - `branch-select.tsx` — **renders nothing at all in the common case.** On company change, fetch `GET /api/public/branches` (§5) and:
    - `branches.length === 1` → select it silently, **render `null`**. No dropdown, no label, no layout shift — a single-branch tenant's customer never learns branches exist.
    - `branches.length > 1` → render a dropdown preselected to `branches[0]`, labelled with `name` (+ `city` when two branches share a name).
    - `branches.length === 0` → treat as "catalogue unavailable" and show the empty state rather than an empty dropdown.
    - Keep the resolved branch in page state and pass its `code` to every subsequent call; **do not** persist it across a company change.
  - `parts-search.tsx` — search box (name/model/description); resets on branch change, since results are branch-scoped.
  - `parts-grid.tsx` / `part-card.tsx` — thumbnail (`PartOut.image_url`, the cover = `image_urls[1]`, §5), name, model, price, qty stepper, "Add to cart." Handle an empty gallery with a placeholder: `image_urls` defaults to `'{}'`, so a part with no photos yet is a normal state, not an error. Prominent, persistent disclaimer near the price: **"Prices are indicative and subject to change without prior notice."**
  - `part-detail-dialog.tsx` — full description, HSN not shown (§5), image gallery straight from the detail response's `images: string[]` (already in display order, cover first) with a simple lightbox/carousel for the multiple-images case. `alt={part_name}` for the cover and `alt={`${part_name} — photo ${i+1}`}` for the rest, since there are no stored per-image captions (§3c).
  - `cart-drawer.tsx` — client-side only, `localStorage`-persisted, line items + qty + running total. **The cart is scoped to one (company, branch) pair**: key the stored cart on both, and when the customer switches company or branch, show the cart belonging to that pair (an empty one if none). A cart must never accumulate parts from two branches — §5 would reject the submission, and it is better to make that structurally impossible than to explain it in an error. If a non-empty cart exists and the customer switches branch, prompt before discarding rather than silently dropping it.
  - `checkout-form.tsx` — customer name/mobile/email, remarks, submit → `submitPartOrder`. No pickup/delivery choice, no address field, no payment step, since fulfillment is entirely manual and offline.
  - `order-confirmation.tsx` — order id, explicit **"No online payment. No return or replacement once shipped. Our team will contact you to arrange delivery and billing."** messaging, plus the branch name and its staff phone number from `company-info`.
- `lib/api.ts` + `lib/types.ts`: add `fetchBranches`, `fetchParts`, `fetchPartById`, `fetchCompanyInfo`, `submitPartOrder` and matching types. All except `fetchBranches` take the branch code as a parameter; make it a required argument in the TS signature (resolved once by `branch-select.tsx`) so a call site can't forget it and silently get the default branch's catalogue.
- `components/home/feature-cards.tsx`: flip "Genuine spare parts" from "Coming soon" to a real link to `/spare-parts`.
- `components/layout/header.tsx`: add the nav link to the new route (currently a single-page site with no nav).

## 10. Known limitations to flag explicitly

- **The catalogue is fully decoupled from live inventory** (§3d) — a part can show as available on the website while actually out of stock at the branch that would fulfill it. This is the direct consequence of indicative pricing and manual fulfillment; staff are the backstop, not the system.
- **Search is free-text only** (`part_name`/`part_description`/`model`). `spare_part_web` has no FK to `product`/`product_brand_model`, and many rows won't even have a `part_id`, so there is nothing structured to filter on.
- **No versioned migration tooling exists in this codebase** (§3b) — rolling the new tables out to existing tenants is a manual, per-tenant step every time, not a deploy-time migration. Plan the rollout accordingly.
- **Per-branch catalogues mean duplicated data entry.** There is no BU-level "shared catalogue" that branches inherit from and override — a part sold at five branches is five `spare_part_web` rows with five prices and five sets of images. This is the direct reading of "each branch will have its own part catalogue," and it is the right default, since branch-level pricing is exactly why the requirement exists. But for tenants whose branches carry near-identical stock it is real repeated work. The §6a "Copy to branch…" action is the mitigation; a genuine inherit-and-override model is a much larger change and is out of scope.
- **A customer cannot order across branches in one go.** If a Bhopal-only part and an Indore-only part are both wanted, that is two orders. Given fulfillment is manual per branch this is arguably correct rather than a defect, but it will surprise customers of multi-branch tenants, so the branch name should stay visible throughout the flow.
- **Part images carry no captions or per-image alt text** (§3c). Alt text is derived from `part_name`, which is right for photos of a single named part but would not support labelling "box contents" vs. "fitted view." Adding that means migrating `image_urls text[]` → `jsonb` and rewriting the §4 array statements — with no migration tooling, a hand-applied change on every tenant schema.
- **Deactivating a branch silently hides its catalogue** — `resolve_branch` filters on `branch.is_active`, so an inactive branch's parts vanish from the web with no separate switch. Intended, but worth telling staff, since it is a side effect of a `branch` master edit that isn't obviously about the website.

## 11. Phased rollout

1. **Phase 1 — schema + admin only, nothing public.** The three tables from §3b (new tenants via template; existing tenants hand-applied per §3b); the `/api/images/spare-part-web/*` routes (§4); the branch-scoped Masters admin screen + image manager (§6). Staff populate at least one branch's catalogue and confirm image upload/delete/reordering works, and that switching branch in the top nav swaps the list, before anything is public.
2. **Phase 2 — public read-only catalogue.** `GET /api/public/branches`, `GET /api/public/parts*`, `GET /api/public/company-info`, and the `service-plus-web` browse/detail pages including `branch-select.tsx` (§9, minus checkout). **Test against both shapes**: a single-branch tenant (no dropdown at all) and a multi-branch one (dropdown, first branch default). Verify images render through the existing unauthenticated proxy.
3. **Phase 3 — order submission.** `POST /api/public/part-orders` with branch validation, branch-scoped cart/checkout/confirmation UI, branch-routed staff email notification (§5, §7). This is the point the feature is usable end-to-end.
4. **Phase 4 (optional)** — the "Web Part Orders" staff list screen, the §6a "Copy to branch…" bulk action, and/or the per-branch `DELETE /files/delete-folder` capability (§4, §8), added only if and when actually needed.

## 12. Implementation steps

Each step maps onto the corresponding phase in §11; substeps are in dependency order within the step and tagged with the repo they touch. A step's "Exit check" is the minimum bar for moving to the next one — it is a fast smoke test, not a substitute for §13.

### Step 1 — schema + internal admin (Phase 1: nothing public yet)

1. **[server]** Add `spare_part_web`, `web_part_order`, `web_part_order_line` DDL (§3b) to the template `service_plus_service.sql`; regenerate `sql_bu_admin_ddl.py` via `python -m app.db.tools.extract_schema`.
2. **[server]** Add the `web_order_notify_email` app-setting (two-step DDL pattern, matching the existing `track_job_url` setting) — needed by §7's recipient resolution in Step 3.
3. **[server]** Hand-apply the new DDL to every existing tenant schema (no migration runner exists — §3b); track which schemas are done.
4. **[server]** Add `spare_part_web` to `BU_ADMIN_GENERIC_UPDATE_TABLE_RIGHTS` (`provisioning.py`) with a new right code, and register the `SQL_MAP` read query the admin list needs (parts by branch).
5. **[file-server]** Add `DELETE /files/delete-folder` (`client_code, bu_code, branch_code` → `shutil.rmtree`, `X-API-Key` gated) — the one net-new file-server route this whole design needs (§4).
6. **[server]** Add the four `/api/images/spare-part-web/*` routes in `image_router.py` — upload (append to `image_urls`), delete-by-url, reorder, delete-all-for-part — plus a `FileClient.delete_folder()` wrapper calling substep 5's new route (§4).
7. **[client]** Add the sidebar entry (`TreeItem` in `client-explorer-panel.tsx` + matching branch in `client-masters-page.tsx`) and the new `src/features/client/components/masters/spare-parts-web/` folder: `spare-parts-web-section.tsx` (branch-scoped table + toolbar) and `spare-part-web-dialog.tsx` (RHF+zod form, optional `part_id` autocomplete against `spare_part_master`) (§6a).
8. **[client]** Generalize `job-image-upload.tsx` into an entity-agnostic uploader — drop the required `about` caption, post the full url list on reorder — and wire it into the dialog against substep 6's routes (§6b).
9. **[client]** Wire the part-delete action to call the delete-all-for-part image route (substep 6) *before* the GraphQL delete, so a removed part never strands its image folder (§4).
10. **[client]** *(optional — only if a live tenant's branch shape calls for it)* Add the "Copy to branch…" bulk action (§6a).

**Exit check**: staff can create/edit/deactivate a `spare_part_web` row, upload/delete/reorder its photos, and switching branch in the top-nav switcher swaps the list — all with nothing public-facing yet.

### Step 2 — public read-only catalogue (Phase 2)

1. **[server]** Add the branch query, `company-info` query, parts-list query, and part-detail query to `sql_public.py` (§5).
2. **[server]** Add the shared `resolve_branch(db_name, schema, branch_code | None)` helper in `website_router.py` (§5).
3. **[server]** Add `GET /api/public/branches`, `GET /api/public/company-info`, `GET /api/public/parts`, `GET /api/public/parts/{part_id}` — each behind `require_website_key` + a read-tier rate limit (§5).
4. **[web]** Add `fetchBranches`, `fetchParts`, `fetchPartById`, `fetchCompanyInfo` to `lib/api.ts` / `lib/types.ts` (§9).
5. **[web]** Extract the shared `company-select.tsx` out of `job-status-form.tsx` / `open-jobs-form.tsx` (§9).
6. **[web]** Build `branch-select.tsx` — silent auto-select and no render at exactly one branch, preselected dropdown at more than one, empty state at zero (§9).
7. **[web]** Build `parts-search.tsx` and `parts-grid.tsx` / `part-card.tsx`, including the empty-gallery placeholder and the persistent "prices are indicative" disclaimer (§9).
8. **[web]** Build `part-detail-dialog.tsx` with the image gallery/lightbox sourced from the detail endpoint's `images: string[]` (§9).
9. **[web]** Wire `app/spare-parts/page.tsx` end to end — company → branch → grid → detail — read-only, no cart/checkout yet.
10. **[web]** Flip `feature-cards.tsx`'s "Coming soon" card to link to `/spare-parts`; add the nav link in `header.tsx` (§9).

**Exit check**: both a single-branch and a multi-branch seeded tenant browse correctly end to end, and part images load through the existing unauthenticated `/api/images/uploads/{path}` proxy.

### Step 3 — order submission (Phase 3: usable end to end)

1. **[server]** Implement `POST /api/public/part-orders` — branch-scoped re-validation of every line, server-recomputed pricing, insert into `web_part_order` + `web_part_order_line` (§5).
2. **[server]** Wire the staff notification email — `send_email` call, branch-first recipient resolution (`branch.email` → `web_order_notify_email` setting → head office), branch name in the subject line (§7).
3. **[web]** Build `cart-drawer.tsx`, keyed on `(company, branch)`, with a discard-confirmation prompt on branch switch (§9).
4. **[web]** Build `checkout-form.tsx` and `order-confirmation.tsx` with the no-payment / no-return / manual-fulfillment messaging and the selected branch's phone number (§7, §9).
5. **[web]** Add `submitPartOrder` to `lib/api.ts` and wire cart → checkout → confirmation.

**Exit check**: a real order submitted through the UI lands in the DB with the correct `branch_id`, staff receive the email, and a hand-crafted cross-branch or stale-price request is rejected server-side, not silently accepted.

### Step 4 — optional fast-follow (Phase 4)

1. **[client]** "Web Part Orders" staff list screen, branch-scoped by default, `NEW → CONTACTED/CANCELLED` status (§8).
2. **[client]** The §6a "Copy to branch…" bulk action, if not already built in Step 1.
3. **[server + file-server]** Expose substep 1.5's `DELETE /files/delete-folder` as an admin-triggered action (e.g. "clear this branch's web catalogue photos"), only once an actual need for it shows up (§4, §10).

## 13. Verification

- **Backend**: confirm the public endpoints are unreachable without `X-Website-Key`; that the opaque `company` token round-trips correctly and can't be forged into a different tenant's data; that `POST /api/public/part-orders` rejects a line for a part that has since been deactivated and recomputes price server-side rather than trusting the client; that the staff notification email actually sends (or logs a clear warning when SMTP isn't configured, per the existing `send_email` behaviour); and that rate limits apply.
- **Branch scoping** — test with a seeded two-branch BU where each branch has at least one part the other doesn't:
  - `GET /api/public/branches` returns exactly one row for a single-branch BU and the head-office-first order for a multi-branch one; inactive branches never appear.
  - Omitting `branch` on `/parts`, `/parts/{id}`, `/company-info` and `/part-orders` resolves to the **first** branch, not to "all branches" — a missing param must never widen the result set.
  - `/parts?branch=OTHER` returns only that branch's rows; `/parts/{id}` for a part belonging to a different branch returns **404, not the row**.
  - `POST /api/public/part-orders` with a hand-crafted body mixing two branches' part ids is **rejected**, and the persisted `web_part_order.branch_id` matches the resolved branch.
  - An unknown or inactive `branch` code 404s rather than falling back to the default branch.
  - The notification email lands at the ordered-from branch's address, and falls back correctly when `branch.email` is null.
- **Images**: confirm an uploaded part image lands at `.../{client}/{bu}/spare_parts_web_{branch}/{spare_part_web_id}/...` — under the **owning branch's** folder, and *not* in that branch's job-image folder; that deleting a part's images both empties `image_urls` and removes the on-disk files (via the reused `delete-job` route); that `DELETE /files/delete-folder` for one branch's part folder leaves the other branch's part images **and** that branch's job images untouched; and that the public detail page can load images through `GET /api/images/uploads/{path}` unauthenticated.
- **`image_urls` array behaviour** — the failure modes here are array-specific, so test them deliberately:
  - Uploading two images in one request, and two images in two concurrent requests, both end with **both** urls present. This is the read-modify-write regression the `||` append (§3c) exists to prevent; don't assume it.
  - Deleting the first image promotes the second to cover on the listing page with no extra action; deleting the last leaves `'{}'` (never `NULL`) and the card renders its placeholder.
  - The reorder route rejects a payload that adds or drops a url instead of silently overwriting the array.
  - A part with no images returns `image_url: null` and `images: []` from the public API rather than erroring.
- **Admin CRUD**: confirm the Masters screen respects the new access-right gate (a role without it can't see or edit `spare_part_web`); that the optional `part_id` autocomplete correctly leaves it `NULL` for market-sourced entries; that a new row is stamped with `currentBranch.id` and never appears in another branch's list; and that switching branch in the top-nav switcher refetches rather than showing the previous branch's rows.
- **Frontend**: `next build` (static export) and confirm the new route emits into `out/`; verify the cart survives a page reload (localStorage) and clears after a successful order; **verify the branch dropdown is entirely absent (not merely disabled) for a single-branch company, appears preselected to the first branch for a multi-branch one, and that switching branch swaps the catalogue and prompts before discarding a non-empty cart**; verify the indicative-price and no-return-policy disclaimers are visible on both the listing and the order-confirmation screen.
