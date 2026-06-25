# Plan: Service+ Customer Portal Website

## Source
`plans/tran.md` — Customer-facing website for job tracking, delivery requests, and spare-parts e-commerce with online payment.

---

## Requirements (from tran.md)

| # | Requirement |
|---|---|
| R1 | Customer selects client, BU and enters job number → detailed job info |
| R2 | If job is finalised → request delivery after paying repair cost + delivery charge |
| R3 | Spare-parts catalog with part images; order and pay online |
| R4 | Search parts by model, name, part code; order if in stock |
| R5 | Integrate with existing Service+ codebase |
| R6 | Integrate with Trace-plus (accounting) |
| R7 | Recommend technology and create architecture |

---

## Technology Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Website framework | **Next.js 15** (App Router) | SSR for parts catalog SEO; public route + protected route split built in; shares Tailwind v4 with existing client |
| Styling | **Tailwind v4** | Already used in service-plus-client; share design tokens |
| State | **Zustand** (lightweight) | No need for Redux on a public-facing site |
| API client | **Axios / fetch** | Calls new REST endpoints; no need for Apollo on this site |
| Payment | **Razorpay** | Dominant payment gateway in India; supports UPI, cards, netbanking; has Node.js and Python SDKs |
| Image storage | **Existing file server** (`service-plus-file-server`) | Parts images uploaded here; URL stored in DB |
| Hosting | Separate subdomain e.g. `portal.<domain>` | Clean separation from the internal app |

---

## Architecture Overview

```
┌───────────────────────────────────┐    ┌──────────────────────────────┐
│   service-plus-website (Next.js)  │    │  service-plus-server (FastAPI)│
│                                   │    │                              │
│  /                  Home          │    │  /graphql  (existing)        │
│  /track             Job Tracker   │────▶  /api/public/*  (NEW)       │
│  /parts             Parts Catalog │    │    ├─ GET /clients            │
│  /cart              Cart          │    │    ├─ GET /job               │
│  /checkout          Checkout      │    │    ├─ GET /parts             │
│  /order/[id]        Order status  │    │    ├─ POST /delivery-request │
│                                   │    │    └─ POST /part-order       │
└───────────────────────────────────┘    │                              │
                                         │  /api/payment/*  (NEW)       │
                                         │    ├─ POST /create-order     │
                                         │    └─ POST /verify           │
                                         └──────────────┬───────────────┘
                                                        │
                                         ┌──────────────▼───────────────┐
                                         │   PostgreSQL (multi-tenant)  │
                                         │   + new tables (see below)   │
                                         └──────────────────────────────┘
                                                        │
                                         ┌──────────────▼───────────────┐
                                         │   Trace-plus server          │
                                         │   (existing integration)     │
                                         └──────────────────────────────┘
```

---

## New Project: `service-plus-website`

Location: `/home/sushant/projects/service-plus/dev/service-plus-website/`

```
service-plus-website/
  app/
    (public)/
      page.tsx                  ← Home / landing
      track/
        page.tsx                ← Job tracker (R1, R2)
      parts/
        page.tsx                ← Parts catalog (R3, R4)
        [part_code]/
          page.tsx              ← Part detail + add to cart
      cart/
        page.tsx                ← Cart review
      checkout/
        page.tsx                ← Address + payment
      order/
        [id]/
          page.tsx              ← Order confirmation / status
  components/
    job-tracker/
    parts/
    cart/
    payment/
    shared/
  lib/
    api.ts                      ← API client (calls /api/public/*)
    razorpay.ts                 ← Payment helpers
  store/
    cart-store.ts               ← Zustand cart state
```

---

## Backend Changes (service-plus-server)

### 1. New Router: `public_router.py`

Add to `app/routers/`. Register in `main.py` under prefix `/api/public`. **No authentication required** on these endpoints — data is scoped to public-safe fields only (no cost prices, no internal notes).

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/clients` | List active clients (id, name) from `service_plus_client` DB |
| GET | `/api/public/clients/{client_id}/bus` | List BUs (id, code, name) for a client |
| GET | `/api/public/job` | Job detail by job_no + client_id + bu_code. Returns public-safe fields only. |
| GET | `/api/public/parts` | Paged parts catalog with stock. Params: search, brand, model, category, page, page_size. |
| GET | `/api/public/parts/{part_code}` | Single part detail with stock qty. |
| POST | `/api/public/delivery-request` | Create delivery request + Razorpay order for repair payment. |
| POST | `/api/public/part-order` | Place online parts order (after payment verified). |

#### SQL needed (in SqlStore)

```python
# Public job lookup — no internal data
GET_PUBLIC_JOB_BY_NO = """
    SELECT j.id, j.job_no, j.alternate_job_no, j.job_date,
           j.problem_reported, j.diagnosis, j.work_done,
           j.amount, j.is_final, j.is_closed, j.delivery_date,
           cc.full_name AS customer_name, cc.mobile,
           js.name      AS job_status_name,
           jt.name      AS job_type_name,
           jt.code      AS job_type_code,
           bn.name      AS brand_name,
           p.name       AS product_name,
           pbm.model_name,
           j.serial_no,
           ji.invoice_no, ji.amount AS invoice_total,
           COALESCE(SUM(jp.amount), 0) AS amount_paid
    FROM job j
    JOIN customer_contact cc ON cc.id = j.customer_contact_id
    JOIN job_status        js ON js.id = j.job_status_id
    JOIN job_type          jt ON jt.id = j.job_type_id
    LEFT JOIN job_invoice  ji ON ji.job_id = j.id
    LEFT JOIN job_payment  jp ON jp.job_id = j.id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand  bn ON bn.id = pbm.brand_id
    LEFT JOIN product p ON p.id  = pbm.product_id
    WHERE j.job_no = %(job_no)s
    GROUP BY j.id, cc.full_name, cc.mobile, js.name, jt.name, jt.code,
             bn.name, p.name, pbm.model_name, ji.invoice_no, ji.amount
"""

# Public parts catalog — selling_price exposed, cost_price NOT
GET_PUBLIC_PARTS_PAGED  # → reuse PART_FINDER_PAGED, strip cost_price in Python
GET_PUBLIC_PART_BY_CODE # → reuse GET_PART_BY_CODE, strip cost_price
```

### 2. New Router: `payment_router.py`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payment/create-order` | Create Razorpay order; return order_id + amount |
| POST | `/api/payment/verify` | Verify Razorpay signature; on success → write receipt + trigger Trace-plus post |

Implementation: use `razorpay` Python SDK. Credentials stored in `config.py` (`razorpay_key_id`, `razorpay_key_secret`).

---

## Database Changes

### Schema changes in each tenant DB (`{schema}`)

```sql
-- 1. Add image to spare part master
ALTER TABLE spare_part_master
    ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- 2. Online delivery requests
CREATE TABLE IF NOT EXISTS online_delivery_request (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT NOT NULL REFERENCES job(id),
    customer_mobile TEXT NOT NULL,
    delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_mode    TEXT NOT NULL,          -- 'razorpay'
    razorpay_order_id   TEXT NOT NULL,
    razorpay_payment_id TEXT NULL,
    payment_status  TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Online parts orders
CREATE TABLE IF NOT EXISTS online_part_order (
    id              BIGSERIAL PRIMARY KEY,
    order_no        TEXT NOT NULL UNIQUE,
    customer_name   TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    customer_email  TEXT NULL,
    delivery_address JSONB NOT NULL,
    razorpay_order_id   TEXT NOT NULL,
    razorpay_payment_id TEXT NULL,
    payment_status  TEXT NOT NULL DEFAULT 'pending',
    order_status    TEXT NOT NULL DEFAULT 'new',  -- new|confirmed|shipped|delivered|cancelled
    total_amount    NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS online_part_order_line (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES online_part_order(id) ON DELETE CASCADE,
    part_id         BIGINT NOT NULL REFERENCES spare_part_master(id),
    part_code       TEXT NOT NULL,
    part_name       TEXT NOT NULL,
    qty             INT NOT NULL,
    unit_price      NUMERIC(10,2) NOT NULL,
    gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
    amount          NUMERIC(10,2) NOT NULL
);
```

Add SQL constants for all of the above to `SqlStore`.

---

## Feature 1: Job Tracker & Delivery Request

### Page: `/track`

**UX Flow:**
1. Dropdowns: Select Client → (loads BUs) → Select BU
2. Input: Enter Job Number → Search
3. Result card shows:
   - Job No, Date, Device (Brand / Model / Serial)
   - Status badge (colour-coded)
   - Problem Reported, Diagnosis, Work Done
   - Invoice Total, Amount Paid, **Balance Due** (highlighted if >0)
4. If `is_final = true` AND `is_closed = false`:
   - Show "Request Delivery" section
   - Delivery charge field (editable by customer, or from app settings)
   - Total to pay = Balance Due + Delivery Charge
   - "Pay Now" button → Razorpay checkout
   - On payment success → POST `/api/public/delivery-request`
   - Server: creates `online_delivery_request` record, creates `job_payment`, posts to Trace-plus

**Public data rules:**
- Never expose `cost_price`
- Never expose internal `division_id`, `batch_no`, `last_transaction_id`
- Expose: job_no, dates, status, device info, customer name (masked: first 3 chars + ***), invoice_total, amount_paid

---

## Feature 2: Parts Catalog & Online Ordering

### Page: `/parts`

**UX:**
- Search bar (model, name, part code)
- Filter sidebar: Brand, Category, In-Stock Only toggle
- Grid of part cards: image, name, brand, part code, selling price (+ GST), stock status badge
- "Add to Cart" if in stock (qty > 0)
- Pagination (20 per page)

### Page: `/parts/[part_code]`
- Part detail: full description, images, HSN, GST rate, stock qty
- Quantity selector + Add to Cart

### Page: `/cart`
- Line items with quantity control
- Subtotal + GST breakdown
- Proceed to Checkout

### Page: `/checkout`
- Customer details form (name, mobile, email, delivery address)
- Order summary
- "Pay Now" → Razorpay
- On success → POST `/api/public/part-order`
- Server: creates `online_part_order` + lines, decrements stock (as a CONSUMPTION transaction), posts to Trace-plus

**Important:** Stock decrement happens ONLY after payment is verified, not at cart add. Concurrency handled with DB-level row locking on stock_balance.

---

## Feature 3: Parts Image Management

### Admin side (in existing service-plus-client)

Add to Masters → Parts (part detail form):
- Image upload control (reuse existing `react-dropzone` + file server upload)
- Sends image to `service-plus-file-server` → returns URL
- Saves `image_url` to `spare_part_master`

Public website uses this URL directly from the file server.

---

## Trace-plus Integration

### Scenario 1: Delivery payment
1. Customer pays via Razorpay → payment verified
2. Server creates `job_payment` record
3. Server calls existing `accountsPosting` logic for this receipt
4. Existing `trace_plus_url` + service-to-service auth handles the post

### Scenario 2: Parts order payment
1. Customer pays → payment verified
2. Server creates `online_part_order` + stock movement (SALES transaction type)
3. Server triggers accounts posting for the sales entry
4. Trace-plus receives the debit/credit entries

No changes needed to the existing Trace-plus integration layer — just call it from the new payment verification handler.

---

## Implementation Steps

### Step 1 — Database migrations
- Add `image_url` to `spare_part_master`
- Create `online_delivery_request`, `online_part_order`, `online_part_order_line` tables
- Add all new SQL constants to `SqlStore` in `sql_store.py`
- Add to `sql_bu.py` (the BU schema migration runner) so new tables appear in new tenants

### Step 2 — Backend: Public API router
- Create `app/routers/public_router.py`
- Implement `GET /clients`, `GET /clients/{id}/bus`, `GET /job`, `GET /parts`, `GET /parts/{code}`
- Register in `main.py`

### Step 3 — Backend: Payment router
- Add `razorpay_key_id`, `razorpay_key_secret` to `config.py`
- Create `app/routers/payment_router.py`
- Implement `POST /create-order` (creates Razorpay order)
- Implement `POST /verify` (signature check → write receipt → Trace-plus post)
- Register in `main.py`

### Step 4 — Parts image upload (internal admin)
- Add `image_url` field to Parts form in `service-plus-client/src/features/client/components/masters/`
- Reuse file-server upload hook already present in codebase

### Step 5 — Website: scaffolding
- Create `service-plus-website/` with Next.js 15 + Tailwind v4
- Share design tokens (CSS variables) with the existing client app
- Configure CORS on service-plus-server to allow the new origin

### Step 6 — Website: Job Tracker page
- Client/BU selector dropdowns (calls `/api/public/clients`)
- Job lookup form and result card
- Delivery request with Razorpay checkout

### Step 7 — Website: Parts Catalog
- Search + filter UI
- Grid / list view
- Zustand cart store (persisted to localStorage)
- Part detail page

### Step 8 — Website: Checkout & Order Confirmation
- Checkout form
- Razorpay integration
- Order confirmation page with order number

### Step 9 — Admin: Order Management (in service-plus-client)
- New section: Inventory → Online Orders
- List of online part orders with status management (confirm / ship / deliver)
- New section: Jobs → Online Delivery Requests
- Shows pending delivery requests from website

### Step 10 — Testing & Deployment
- Test Razorpay in test mode end-to-end
- Verify Trace-plus posting on payment events
- Deploy website to subdomain

---

## Key Decisions & Constraints

| Decision | Rationale |
|---|---|
| Next.js (not Vite SPA) | Parts catalog needs SSR for SEO; job tracker is SPR-compatible |
| REST (not GraphQL) for public API | Avoids exposing existing generic GraphQL to unauthenticated public |
| Payment before delivery | Server only triggers delivery after Razorpay signature is verified |
| Stock decrement after payment | Prevents overselling; concurrency handled with row-level lock |
| Separate `online_*` tables | Clean audit trail; does not pollute existing job_payment table with unconfirmed intents |
| Razorpay (not Stripe) | India-first stack; supports UPI which is 60%+ of Indian digital payments |
| No customer login required | Job lookup by job_no + mobile verification is sufficient for B2C; reduces friction |

---

## Open Questions (Need Business Input)

1. **Customer verification** — Is job_no alone sufficient, or should customer enter their mobile too (to prevent fishing)?
2. **Delivery charge** — Fixed amount per App Settings, or customer-entered, or based on pincode?
3. **Parts order** — Does Service+ ship parts directly to end customers, or is this workshop-to-workshop only?
4. **Trace-plus** — Should online payments post to accounts immediately (synchronous) or via the existing scheduled batch poster?
5. **Multi-branch parts catalog** — Which branch's stock does the website show? The HO branch? Aggregate across branches?
