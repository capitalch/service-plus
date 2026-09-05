# Extended Warranty Reminders — Design (not implemented yet)

## Goal

A new **Options** top-nav menu with one item, **Extended Warranty**, that lets a
Sony-authorised service centre run warranty-expiry reminder campaigns over
WhatsApp to a population of people who are **not** — and will never be — rows in
`customer_contact`:

1. Staff import a dealer/brand-supplied list of device owners (name, mobile,
   brand, product/model, warranty end date).
2. The system shows who is due for a reminder, and sends a WhatsApp template
   message per person.
3. The message carries a button — **"I'm interested — contact me"** — that opens
   a small public page with the actual call-to-action button
   *"I am interested in extended warranty. Please contact me"*.
4. Tapping it records the interest; staff see it in-app (grid + notification
   bell + optional email) and follow up manually by phone.

Fifth WhatsApp event after `JOB_CREATION` / `JOB_COMPLETION` / `JOB_DELIVERY` /
`JOB_MONEY_RECEIPT` / `JOB_INVOICE` — but the **first one not anchored to a
`job` row**, which is the single fact that drives most of the design decisions
below.

---

## Concern to state up front (proceeding regardless)

This is a **Marketing**-category WhatsApp template sent to a list the service
centre did not itself collect. Three real consequences, none of which block the
build, all of which the design mitigates:

- Meta requires opt-in for Marketing templates. A dealer-supplied list is not
  opt-in. Sending at volume risks quality-rating drops and, at the extreme, the
  business number being restricted or blocked.
- Marketing conversations are billed per conversation, and are the most
  expensive category in India.
- There is no "reply STOP" handling in this codebase — inbound WhatsApp messages
  are explicitly dropped (`whatsapp_webhook_router.py:_process_webhook_payload`,
  `"WhatsApp inbound message received (dropped)"`).

Mitigations built into the design, not left to operator discipline: the event is
**default-OFF** and fails closed (`_is_event_enabled`), auto-send is separately
default-OFF, there is a per-day send cap, a partial unique index makes a second
send for the same customer+stage impossible, an opt-out link on the public page
sets `ew_customer.is_opted_out` and permanently removes the row from every due
list, and invalid mobiles are skipped before they ever reach Meta.

Recommend the operator seeds the list only with owners who bought through this
centre or its dealer network, and starts with a small batch to watch the quality
rating.

---

## What already exists (reused, mostly untouched)

```
server  app/whatsapp/client.py     send_template() — named header/body params,
                                    positional URL-button params. Handles the
                                    exact shape this feature needs already; NO
                                    change required.
        app/whatsapp/token.py      sign()/verify(), sign_receipt()/verify_receipt()
                                    — HMAC-SHA256 over a pipe-delimited payload,
                                    b64url, no DB round-trip. New EW pair is a
                                    copy of the sign_receipt/verify_receipt shape.
        app/whatsapp/sender.py     _sanitize, _truncate_business_unit,
                                    _is_event_enabled, _build_biz_opaque_callback_data,
                                    _EVENT_CODE_BY_KEY — all reusable verbatim.
        app/whatsapp/mobile.py     normalize_mobile / is_valid_mobile — verbatim.
        app/routers/public/        job_intake_router.py is the template for a
                                    token-gated public HTML route (no session,
                                    rate-limited, HTMLResponse).
        webhooks/whatsapp_webhook_router.py
                                    signature check, biz_opaque_callback_data
                                    tenant decode, status ladder, pubsub publish.
        app/graphql/resolvers/shared/{generic_query,generic_update}.py
                                    all reads and all CRUD writes go through these.
        app/scheduler.py           AsyncIOScheduler + the
                                    active-clients → active-schemas iteration
                                    already written for the monthly snapshot.
        app/core/email.py          send_email() — the interest alert reuses it.
        resolvers/inventory/mutations.py:resolve_import_spare_parts_helper
                                    + bulk_insert_records — the bulk-import shape.

client  jobs/customer-connect/*    grid + select + send + live-status-subscription
                                    + results dialog. The EW screen is this screen
                                    with a different row source.
        masters/parts/import-part-dialog.tsx
                                    5-step xlsx import wizard (Upload → Map →
                                    Preview → Validate → Results). Copied wholesale.
        configurations/app-settings/edit-whatsapp-notifications-dialog.tsx
                                    friendly editor for one app_setting jsonb row.
        components/shared/whatsapp-icon.tsx, refresh-button, help engine.
```

---

## Design decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **Three new tables** (`ew_customer`, `ew_reminder`, `ew_interest`) in the BU schema, no reuse of `customer_contact` | The requirement is explicit: these people are not customers and never will be. `customer_contact` has `customer_type_id`/`address_line1`/`state_id` NOT NULL — a dealer list has none of that. |
| 2 | **A real `ew_reminder` table**, not a `jsonb` column like `job.whatsapp_notifications` | The jsonb approach exists because a job already had a row to hang it on and the log is per-job. Here the log *is* the entity being reported on (due/sent/delivered/interested funnel), and the webhook has to look a row up by wamid — a column would mean a jsonb scan. |
| 3 | **URL button → public page → interest button**, not a WhatsApp quick-reply button | A quick-reply reply arrives as an *inbound message*, which carries no `biz_opaque_callback_data` — the only tenant hint would be `context.id` (the outbound wamid), so resolving `db_name`/`schema` would need a **new global wamid→tenant routing table in `service_plus_client`**, plus inbound-message handling the webhook does not have today. The URL token is self-describing (`db_name\|schema\|customer_id\|reminder_id\|exp`) and needs neither. It also gives room for the opt-out link and a contact-preference choice. See "Alternative considered" below. |
| 4 | Token minted **after** the `ew_reminder` row is inserted | The token must name the reminder id so the interest row can be attributed to the exact send. Order: `INSERT ew_reminder (PENDING) RETURNING id` → `sign_ew(...)` → `send_template` → `UPDATE ... ACCEPTED/FAILED`. |
| 5 | `ON CONFLICT DO NOTHING` on a **partial unique index** `(ew_customer_id, reminder_stage) WHERE status <> 'FAILED'` | Makes "one reminder per person per stage" a database invariant, so the manual send and the nightly scheduler can never double-charge for the same message, even racing. A FAILED row stays retryable. |
| 6 | Callback data carries **reminder ids**, not job ids: `db_name\|schema\|EW\|reminder_id,…` | Same 4-part format the webhook already parses — only the meaning of the last field changes, and only for the `EW` code. Documented in both `_EVENT_CODE_BY_KEY` and `_EVENT_KEY_BY_CODE`. |
| 7 | Four shared helpers move from `sender.py` into a new `app/whatsapp/common.py` | `_sanitize` / `_truncate_business_unit` / `_is_event_enabled` / `_build_biz_opaque_callback_data` are needed verbatim by the new sender. Pure move + re-import; `sender.py` keeps working unchanged and stops growing past its current 1120 lines. |
| 8 | New sender lives in `app/whatsapp/ew_sender.py`, not in `sender.py` | `sender.py`'s every function assumes a `job` row. Nothing here does. |
| 9 | Two new access rights: `OPTIONS_MENU` (19) and `OPTIONS_EXTENDED_WARRANTY` (20) | Exactly the `MASTERS_MENU` + `MASTERS_ORGANIZATION` precedent — menu-level gate for the tab, feature-level gate for the screen and for the `genericUpdate` table writes. |
| 10 | Scheduled auto-send is **default off**, behind its own flag *and* the existing `whatsapp_notifications` fail-closed switch | Two independent switches, because an accidental nightly marketing blast is the expensive failure mode. |
| 11 | Message text is composed from `brand.name` + model/product, never free text from the operator | The template is fixed at Meta approval time; only parameter values vary. |

### Alternative considered — quick-reply button (rejected for v1)

One-tap is better UX than tap→browser→tap. It was rejected only because it
requires: (a) a `wa_outbound_message(wamid, db_name, schema, entity_id)` table in
the **global** `service_plus_client` database, since inbound webhooks have no
tenant marker; (b) inbound-message handling in the webhook router; (c)
`client.py:send_template` extended with a `quick_reply` sub-type branch. If it is
wanted later, everything else in this design (tables, grids, follow-up flow,
scheduler) stays as-is — only the delivery of the interest signal changes.

---

## Data model

All three tables live in the **BU schema** (`demo1` and every other BU schema),
next to `job` / `customer_contact`.

```sql
CREATE TABLE ew_customer (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    branch_id         bigint NOT NULL,
    full_name         text   NOT NULL,
    mobile            text   NOT NULL,
    email             text,
    brand_id          bigint NOT NULL,          -- FK brand(id)
    product_id        bigint,                   -- FK product(id), the category (TV/AUDIO/…)
    model_name        text,                     -- free text; dealer lists are not in product_brand_model
    serial_no         text,
    purchase_date     date,
    warranty_end_date date   NOT NULL,          -- the {date} in the message
    city              text,
    source            text   DEFAULT 'IMPORT' NOT NULL,   -- 'IMPORT' | 'MANUAL'
    import_batch_no   integer,                  -- groups one spreadsheet upload
    remarks           text,
    is_opted_out      boolean DEFAULT false NOT NULL,
    opted_out_at      timestamp with time zone,
    is_active         boolean DEFAULT true  NOT NULL,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_customer_pkey PRIMARY KEY (id),
    CONSTRAINT ew_customer_branch_fkey  FOREIGN KEY (branch_id)  REFERENCES branch(id),
    CONSTRAINT ew_customer_brand_fkey   FOREIGN KEY (brand_id)   REFERENCES brand(id),
    CONSTRAINT ew_customer_product_fkey FOREIGN KEY (product_id) REFERENCES product(id)
);

-- One person can own two Sony devices, so mobile alone is not the key.
CREATE UNIQUE INDEX ew_customer_dedup_idx
    ON ew_customer (mobile, COALESCE(serial_no, ''), warranty_end_date);
CREATE INDEX ew_customer_warranty_end_idx ON ew_customer (warranty_end_date);
CREATE INDEX ew_customer_branch_idx       ON ew_customer (branch_id);

CREATE TABLE ew_reminder (
    id             bigint GENERATED ALWAYS AS IDENTITY,
    ew_customer_id bigint   NOT NULL,
    reminder_stage smallint NOT NULL,           -- days-before bucket used: 60 / 30 / 7 / 0
    wamid          text,
    status         text     DEFAULT 'PENDING' NOT NULL,  -- PENDING/ACCEPTED/SENT/DELIVERED/READ/FAILED
    status_rank    smallint DEFAULT 0 NOT NULL,          -- 0/1/2/3/4, 9 = FAILED (mirrors the webhook ladder)
    error          text,
    sent_at        timestamp with time zone,
    settled_at     timestamp with time zone,
    sent_by        bigint,                      -- security."user".id; NULL = scheduler
    created_at     timestamp with time zone DEFAULT now() NOT NULL,
    updated_at     timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_reminder_pkey PRIMARY KEY (id),
    CONSTRAINT ew_reminder_customer_fkey FOREIGN KEY (ew_customer_id)
        REFERENCES ew_customer(id) ON DELETE CASCADE
);

-- Decision 5: one non-failed send per customer per stage, enforced by the DB.
CREATE UNIQUE INDEX ew_reminder_once_per_stage_idx
    ON ew_reminder (ew_customer_id, reminder_stage) WHERE (status <> 'FAILED');
CREATE INDEX ew_reminder_wamid_idx    ON ew_reminder (wamid);
CREATE INDEX ew_reminder_customer_idx ON ew_reminder (ew_customer_id);

CREATE TABLE ew_interest (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    ew_customer_id    bigint NOT NULL,
    ew_reminder_id    bigint,
    expressed_at      timestamp with time zone DEFAULT now() NOT NULL,
    source            text DEFAULT 'LINK' NOT NULL,   -- 'LINK' (public page) | 'MANUAL' (staff logged a call)
    preferred_contact text,                           -- 'CALL' | 'WHATSAPP'
    customer_remarks  text,
    follow_up_status  text DEFAULT 'NEW' NOT NULL,    -- NEW/IN_PROGRESS/CONVERTED/NOT_INTERESTED/UNREACHABLE
    followed_up_by    bigint,
    followed_up_at    timestamp with time zone,
    staff_remarks     text,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_interest_pkey PRIMARY KEY (id),
    CONSTRAINT ew_interest_customer_fkey FOREIGN KEY (ew_customer_id)
        REFERENCES ew_customer(id) ON DELETE CASCADE,
    CONSTRAINT ew_interest_reminder_fkey FOREIGN KEY (ew_reminder_id)
        REFERENCES ew_reminder(id) ON DELETE SET NULL
);

-- A double-tap on the public page must not create a second open lead.
CREATE UNIQUE INDEX ew_interest_open_idx
    ON ew_interest (ew_customer_id) WHERE (follow_up_status IN ('NEW', 'IN_PROGRESS'));
CREATE INDEX ew_interest_status_idx ON ew_interest (follow_up_status);
```

### `app_setting` changes

- **Extend row id 15** (`whatsapp_notifications`) default to
  `{"JOB_CREATION": false, "JOB_COMPLETION": true, "JOB_DELIVERY": false, "EXTENDED_WARRANTY": false}`.
  Existing rows need no migration — `_is_event_enabled` already fails closed on a
  missing key.
- **New row id 16**, `extended_warranty`:

```json
{
  "auto_send_enabled":    false,
  "contact_phone":        "",
  "daily_send_cap":       250,
  "notify_email":         "",
  "reminder_days_before": [60, 30, 7],
  "whatsapp_number":      ""
}
```

`contact_phone` / `whatsapp_number` are the `{phone number}` / `{whatsapp number}`
in the message body. `notify_email` mirrors the existing `web_order_notify_email`
precedent (falls back to branch/head-office email when blank).

---

## Meta template — `extended_warranty_reminder_v1`

- **Category:** MARKETING (unavoidable — the body promotes a paid service; a
  Utility submission would be reclassified or rejected, the same classifier
  behaviour `templates.py` already documents for `JOB_DELIVERY_OTP`).
- **Language:** `en`
- **Header** (named): `Warranty reminder from {{business_unit}}` — truncated to 40
  chars by `_truncate_business_unit`, same as every other template here.
- **Body** (named parameters, in order):
  `customer_name`, `brand`, `product`, `expiry_date`, `contact_phone`, `whatsapp_number`

```
Hello {{customer_name}},

Greetings from {{brand}}! The warranty of your {{brand}} {{product}} will expire
on {{expiry_date}}. You may extend the warranty period for a further 1 or 2 years.

For details please call {{contact_phone}}, or WhatsApp {{whatsapp_number}}.
```

- **Footer** (static, no variables allowed): `Tap below if you'd like us to call you.`
- **Buttons:** one **dynamic-URL** button, `button_count = 1`
  - Text: `I'm interested — contact me`
  - URL type: Dynamic, field holds the bare prefix
    `https://<public-host>/extended-warranty/` with **no placeholder text at
    all** — this is the registration discipline `templates.py`'s own docstring
    records as the only shape that ever worked for these buttons (`{{token}}`
    and `{{1}}` both shipped broken). The send supplies only the token suffix.

`TemplateSpec` entry:

```python
"EXTENDED_WARRANTY": TemplateSpec(
    name="extended_warranty_reminder_v1",
    language="en",
    category="MARKETING",
    header_params=["business_unit"],
    body_params=[
        "customer_name", "brand", "product",
        "expiry_date", "contact_phone", "whatsapp_number",
    ],
    button_count=1,
),
```

`{{brand}}` appears twice in the body — a named parameter may be reused, so it is
still one parameter. `product` is computed server-side as
`COALESCE(NULLIF(model_name,''), product.name, '')`, so the message reads
"your SONY BRAVIA 55X80K" or, with no model, "your SONY TV".

---

## Public pages served by the button

New router `app/routers/public/extended_warranty_router.py`,
`APIRouter(prefix="/extended-warranty")`, mounted in `main.py` alongside the other
three public routers. Modelled directly on `job_intake_router.py`: signed token is
the only credential, HTML returned directly, rate-limited, never raises on a bad
token (renders "invalid or expired" instead).

| Route | Method | Rate limit | Purpose |
|-------|--------|-----------|---------|
| `/extended-warranty/{token}` | GET | 60/60s | Landing page: brand, product, expiry date, what an extension covers, the big interest button, contact-preference radio, optional remarks, opt-out link |
| `/extended-warranty/{token}/interest` | POST | 20/60s | Records the interest, renders the thank-you page |
| `/extended-warranty/{token}/opt-out` | POST | 20/60s | Sets `is_opted_out` / `opted_out_at`, renders confirmation |

The primary control on the landing page is a plain form submit button labelled
exactly **"I am interested in extended warranty. Please contact me"** — deliberately
one large button, no JavaScript required.

No CSRF token: there is no session cookie or ambient authority on these routes,
the signed token *is* the entire authorisation, and the write is idempotent
(`ON CONFLICT DO NOTHING` on `ew_interest_open_idx`).

---

## Workflow

```
 ADMIN (once)
   Configurations ▸ App Settings
     • whatsapp_notifications.EXTENDED_WARRANTY  → true
     • extended_warranty: contact_phone, whatsapp_number, reminder_days_before,
       daily_send_cap, notify_email, auto_send_enabled
                                   │
 STAFF                             ▼
   Options ▸ Extended Warranty ▸ Customers ▸ Import
     xlsx → map columns → preview → validate → bulk insert
     duplicates rejected by ew_customer_dedup_idx, invalid mobiles flagged in the
     Validation step before anything is written
                                   │
                                   ▼
   Options ▸ Extended Warranty ▸ Due Reminders
     rows where warranty_end_date - CURRENT_DATE lands in a configured stage,
     is_active, NOT is_opted_out, and no non-FAILED ew_reminder for that stage
     → select rows → "Send Reminders"
                                   │
 SERVER  sendWhatsappExtendedWarranty  (per customer, ≤5 concurrent)
   ├─ _is_event_enabled('EXTENDED_WARRANTY')      … fail closed
   ├─ is_valid_mobile → skip, reported as SKIPPED
   ├─ INSERT ew_reminder (PENDING) ON CONFLICT DO NOTHING RETURNING id
   │     no id back ⇒ already sent for this stage ⇒ skip
   ├─ sign_ew(db, schema, customer_id, reminder_id)
   ├─ send_template(..., callback = "db|schema|EW|reminder_id")
   └─ UPDATE ew_reminder → ACCEPTED + wamid + sent_at, or FAILED + error
                                   │
 META webhook  POST /api/webhooks/whatsapp
   status callback → decode "EW" → SET_EW_REMINDER_OUTCOME (ladder-guarded)
   → pubsub "whatsapp_delivery_status" {kind:"EW", ew_reminder_id, status}
   → the open Due/Log grid updates live
                                   │
 CUSTOMER  taps "I'm interested — contact me"
   GET  /extended-warranty/{token}          → landing page
   POST /extended-warranty/{token}/interest → INSERT ew_interest (NEW)
                                              → pubsub + optional email alert
   (or) POST …/opt-out                      → is_opted_out = true, gone from every
                                              future due list
                                   │
 STAFF                             ▼
   notification bell "Extended warranty interest (N)"
   → Options ▸ Extended Warranty ▸ Interest
   → call the customer → follow_up_status = CONVERTED / NOT_INTERESTED /
     UNREACHABLE, staff_remarks, followed_up_by/at stamped from the session

 SCHEDULER (optional, default off)
   daily 10:00 → for each active client × BU schema:
     auto_send_enabled AND whatsapp_notifications.EXTENDED_WARRANTY
     → same core send path, capped at daily_send_cap, sent_by = NULL
```

---

## Implementation steps

### Step 1 — Database schema

1. Apply the three `CREATE TABLE` blocks + indexes above to the `demo1` template
   schema in `service_plus_service`.
2. Regenerate the dump and the DDL constant, in that order — this is the
   documented workflow in `app/db/tools/extract_schema.py`, not a manual edit:
   - `pg_dump --schema-only` → `app/db/schema_dumps/service_plus_service.sql`
   - `python -m app.db.tools.extract_schema` → rewrites
     `app/db/sql/sql_bu_admin_ddl.py` (`BuAdminDdl.BU_SCHEMA_DDL`), so every
     **new** BU schema gets the tables automatically.
   - Refresh the repo-root copy `db/service_plus_demo.sql` the same way.
3. `app/db/seeds/seed_bu_data.py` — add `app_setting` row id 16
   (`extended_warranty`) and extend row 15's default value with
   `"EXTENDED_WARRANTY": false`.
4. `scripts/seed_extended_warranty.sql` — delta migration for **existing** BU
   schemas (the `scripts/seed_access_right.sql` precedent): the three
   `CREATE TABLE IF NOT EXISTS` blocks, the indexes, and an
   `INSERT … ON CONFLICT DO NOTHING` for app_setting id 16 plus a
   `jsonb_set` that adds the `EXTENDED_WARRANTY: false` key to id 15 only when
   absent. Idempotent, safe to re-run.

### Step 2 — Access rights

1. `app/db/seeds/seed_security_data.py` — `ACCESS_RIGHT_SEED_SQL`:
   ```
   (19, 'OPTIONS_MENU',               'Options',            'OPTIONS', 'Access to the Options tab'),
   (20, 'OPTIONS_EXTENDED_WARRANTY',  'Extended Warranty',  'OPTIONS', 'Access to Options -> Extended Warranty')
   ```
   Role mapping: MANAGER (1) gets 19 and 20; RECEPTIONIST (3) gets 19 and 20 (they
   do the follow-up calls and the sends); TECHNICIAN (2) gets none, consistent
   with its zero-rows rule.
2. `scripts/seed_access_right_options.sql` — delta migration for existing
   schemas, same shape as the id-18 one.

### Step 3 — SQL store

New `app/db/sql/sql_extended_warranty.py`, `class ExtendedWarrantySql`, added to
the `SqlStore` bases in `sql_base.py`.

| Constant | Purpose |
|----------|---------|
| `GET_EW_CUSTOMERS_PAGED` / `_COUNT` | Customers tab; joins brand/product; search on name/mobile/model/serial; `%(limit)s/%(offset)s` |
| `GET_EW_DUE_REMINDERS` | Due tab. `warranty_end_date - CURRENT_DATE = ANY(%(stages)s)` (or a between-window variant), `is_active`, `NOT is_opted_out`, `NOT EXISTS (SELECT 1 FROM ew_reminder r WHERE r.ew_customer_id = c.id AND r.reminder_stage = <stage> AND r.status <> 'FAILED')`, `branch_id = %(branch_id)s` |
| `GET_EW_CUSTOMERS_FOR_WHATSAPP` | Server-side re-filter before a send: `id = ANY(%(ew_customer_ids)s) AND branch_id = %(branch_id)s AND is_active AND NOT is_opted_out`, joined to `brand`/`product`. Same defence-in-depth discipline as `GET_JOBS_FOR_WHATSAPP_COMPLETION`'s `branch_id` cross-check |
| `INSERT_EW_REMINDER` | `INSERT … (ew_customer_id, reminder_stage, status, sent_by) VALUES (…, 'PENDING', …) ON CONFLICT DO NOTHING RETURNING id` |
| `SET_EW_REMINDER_ATTEMPT` | `UPDATE … SET wamid, status, status_rank, sent_at, error, updated_at = now() WHERE id = %(id)s` |
| `SET_EW_REMINDER_OUTCOME` | Ladder-guarded webhook write: `UPDATE … SET status, status_rank, error, settled_at WHERE id = %(reminder_id)s AND status_rank < %(new_rank)s RETURNING id` — empty result means duplicate/out-of-order, exactly how `SET_JOB_WHATSAPP_OUTCOME` signals it today |
| `GET_EW_REMINDER_LOG_PAGED` / `_COUNT` | Message Log tab |
| `GET_EW_INTEREST_PAGED` / `_COUNT` | Interest tab, joined to customer + reminder |
| `COUNT_EW_NEW_INTEREST` | Notification-bell count (`follow_up_status = 'NEW'`) |
| `CHECK_EW_CUSTOMER_DUPLICATE` / `_EXCLUDE_ID` | Debounced uniqueness check in the add/edit dialogs, keyed the same way as `ew_customer_dedup_idx` |
| `GET_EW_DASHBOARD_STATS` | Header tiles: due-in-window, sent-this-month, delivered, interested, converted |
| `GET_EW_AUTO_SEND_DUE` | Scheduler variant of the due query, no `branch_id` filter, `LIMIT %(cap)s` |

New constants in `app/db/sql/sql_public.py` (`PublicSql`, used by the public
router only): `GET_EW_LANDING_DATA`, `INSERT_EW_INTEREST` (with
`ON CONFLICT DO NOTHING`), `SET_EW_OPT_OUT`, `GET_EW_NOTIFY_EMAIL`.

### Step 4 — Token

`app/whatsapp/token.py` — add `sign_ew()` / `verify_ew()`, copied from
`sign_receipt` / `verify_receipt` with the payload
`db_name|schema|ew_customer_id|ew_reminder_id|exp` and `ttl_days=400`. Shorter than
the 730-day job-slip TTL on purpose: this link is a time-boxed campaign
call-to-action, not a durable record of a transaction.

### Step 5 — Shared WhatsApp helpers

New `app/whatsapp/common.py`. Move `_sanitize`, `_truncate_business_unit`,
`_is_event_enabled`, `_build_biz_opaque_callback_data` and `_EVENT_CODE_BY_KEY`
out of `sender.py` and import them back there. Pure move, no behaviour change — but
run the app-boot smoke test afterwards, since `sender.py` is the most heavily
depended-on module in this area.

Then add `"EXTENDED_WARRANTY": "EW"` to `_EVENT_CODE_BY_KEY`, with a comment
recording that for this one code the trailing id list is **reminder ids, not job
ids**.

### Step 6 — Template registration

`app/whatsapp/templates.py` — add the `TEMPLATES["EXTENDED_WARRANTY"]` entry
exactly as specced above, with a comment noting: first MARKETING-category template
in the file, first template not tied to a job, and the bare-prefix dynamic-URL
button registration rule.

### Step 7 — Sender

New `app/whatsapp/ew_sender.py`:

- `_build_ew_params(bu_name, row, settings) -> (header_values, body_values)` —
  `expiry_date` formatted `%d %b %Y` (the `_build_money_receipt_params`
  precedent), `product` from `COALESCE(NULLIF(model_name,''), product_name, '')`,
  all values through `_sanitize`.
- `_send_one(db_name, schema, bu_name, row, stage, sent_by, semaphore)` —
  insert-then-sign-then-send-then-update, per Decision 4. Returns
  `{customer_name, ew_customer_id, ew_reminder_id, status: SENT|FAILED|SKIPPED, error}`.
- `send_extended_warranty_reminders(db_name, schema="public", value="", sent_by=None)`
  — the mutation entry point. `value` decodes to
  `{branch_id, ew_customer_ids, reminder_stage}`. Fails closed on
  `_is_event_enabled`, returns `{"results": [...], "disabled": bool}` — the same
  envelope `resolve_send_whatsapp_completion_helper` returns, so the client's
  results dialog is reused unchanged.
- `run_ew_auto_send(db_name, schema)` — the scheduler entry point, sharing
  `_send_one`; reads `extended_warranty`, returns early unless
  `auto_send_enabled`, caps at `daily_send_cap`, passes `sent_by=None`.
- `_SEND_CONCURRENCY = 5`, same semaphore discipline as `sender.py`.

### Step 8 — Webhook

`app/routers/webhooks/whatsapp_webhook_router.py`:

1. `_EVENT_KEY_BY_CODE` — add `"EW": "EXTENDED_WARRANTY"`.
2. In `_apply_status_callback`, branch after the decode: when
   `event_key == "EXTENDED_WARRANTY"`, treat the id list as reminder ids and call
   `SET_EW_REMINDER_OUTCOME` with `new_rank`; otherwise the existing
   `SET_JOB_WHATSAPP_OUTCOME` path, untouched.
3. Publish `{"db_name", "kind": "EW", "ew_reminder_id", "status", "error"}` on the
   existing `whatsapp_delivery_status` channel. Job publishes gain
   `"kind": "JOB"` so the client can discriminate; the existing Customer Connect
   subscriber must treat a missing `kind` as `"JOB"` for messages already in flight
   during a deploy.

### Step 9 — Public router

New `app/routers/public/extended_warranty_router.py` (routes and limits per the
table above), registered in `app/main.py`. On a successful interest insert:

- publish to pubsub so an open Interest grid updates live;
- resolve the alert address (`extended_warranty.notify_email` → branch email →
  head-office email) and `send_email` a short "New extended-warranty interest"
  message. Wrapped in its own try/except — a mail failure must never turn the
  customer's tap into an error page.

### Step 10 — GraphQL surface

1. `app/graphql/schema.graphql` — two new mutations:
   ```
   sendWhatsappExtendedWarranty(db_name: String!, schema: String, value: String!): Generic
   importExtendedWarrantyCustomers(db_name: String!, schema: String, value: String!): Generic
   ```
   All reads go through the existing `genericQuery`; all CRUD writes through
   `genericUpdate`. No new query fields.
2. New `app/graphql/resolvers/options/extended_warranty.py` exporting
   `OPTIONS_GENERIC_UPDATE_TABLE_RIGHTS = {"ew_customer": "OPTIONS_EXTENDED_WARRANTY",
   "ew_interest": "OPTIONS_EXTENDED_WARRANTY"}` and
   `resolve_import_ew_customers_helper` (mirrors
   `resolve_import_spare_parts_helper` — decode list, `bulk_insert_records` into
   `ew_customer`, return `{"success_count": n}`).
3. `app/graphql/resolvers/mutation.py` — merge that dict into
   `GENERIC_UPDATE_TABLE_RIGHTS`; register both resolvers with
   `@handle_graphql_errors`. `sendWhatsappExtendedWarranty` **does** carry an
   explicit `require_access_right(info, "OPTIONS_EXTENDED_WARRANTY")` — a
   deliberate departure from the "no dedicated guard" precedent the job-related
   WhatsApp mutations set, because this one spends money on marketing
   conversations. `sent_by` comes from `info.context["user_id"]`, never from the
   client (the `verifyJobDeliveryOtp` precedent).

### Step 11 — Scheduler

`app/scheduler.py` — `run_daily_ew_reminders()` reusing the existing
`GET_ACTIVE_CLIENTS` → `GET_ACTIVE_SCHEMAS` iteration verbatim, calling
`run_ew_auto_send(db_name, schema)` per BU. Registered as a
`trigger="cron", hour=10, minute=0, id="daily_ew_reminders"` job. Every BU is
skipped unless it has independently switched on **both** flags, so this is a
no-op for every existing client on day one.

### Step 12 — Client: navigation shell

| File | Change |
|------|--------|
| `src/router/routes.ts` | `client.options: '/client/options'` |
| `src/router/index.tsx` | `{ element: <ClientOptionsPage />, path: 'options' }` |
| `src/features/auth/utils/access-rights.ts` | `OPTIONS_MENU`, `OPTIONS_EXTENDED_WARRANTY` |
| `layout/client-layout.tsx` | `Section` union `+ 'options'`; `sectionFromPath`; `SECTION_LABELS.options = 'Options'`; `SECTION_DEFAULTS.options = 'Extended Warranty'`; `SECTION_DEFAULT_GROUPS.options = ''` |
| `layout/client-top-nav.tsx` | `NAV_ITEMS` += `{ label: 'Options', section: 'options', to: ROUTES.client.options, requiredRight: ACCESS_RIGHTS.OPTIONS_MENU }`, placed after Reports |
| `layout/client-explorer-panel.tsx` | `OptionsExplorer()` with one `TreeItem` (`icon={ShieldCheck}`, `iconColor="text-violet-600"`, `label="Extended Warranty"`, `helpArticleId="extended-warranty"`, disabled + title when the right is missing); `EXPLORERS.options`; `SECTION_TITLES.options = 'Add-on Services'`; `MOBILE_NAV_ITEMS` += `{ label: 'Options', … }` |
| `layout/client-activity-bar.tsx` | `ACTIVITY_ITEMS` += `{ color: 'text-violet-600', icon: ShieldCheck, section: 'options', … }` |
| `pages/client-options-page.tsx` | New — `<ClientLayout>` + a `switch (selected)` returning `<ExtendedWarrantySection />`, `ComingSoon` otherwise, exactly like `client-configurations-page.tsx` |

Both nav lists must be edited together — `NAV_ITEMS` and `MOBILE_NAV_ITEMS` are
separate arrays in separate files.

### Step 13 — Client: types and constants

- `src/features/client/types/extended-warranty.ts` — `EwCustomerType`,
  `EwDueRowType`, `EwInterestType`, `EwReminderLogType`, `EwSendResultType`,
  `ParsedEwCustomerType`, `ImportEwCustomersResultType`, `EwSettingsType`.
  Types not interfaces, `…Type` suffix, properties sorted.
- `constants/sql-map.ts` — one entry per Step 3 constant.
- `constants/graphql-map.ts` — `sendWhatsappExtendedWarranty`,
  `importExtendedWarrantyCustomers`, both in the standard
  `($db_name: String!, $schema: String, $value: String!)` shape.
- `constants/messages.ts` — every string over two words: import errors, send
  outcomes, opt-out confirmation, follow-up save messages, empty-state text.

### Step 14 — Client: promote the two send dialogs to shared

`jobs/customer-connect/send-messages-modal.tsx` and `send-results-dialog.tsx`
move to `src/components/shared/whatsapp/`, with imports updated in
`customer-connect-section.tsx` (the only caller). They are already generic over
"N customers, M messages, here are the results" — copying them a second time for
this feature would violate the reuse rule in `claude.md`.

### Step 15 — Client: the Extended Warranty screen

`src/features/client/components/options/extended-warranty/`:

| File | Role |
|------|------|
| `extended-warranty-section.tsx` | Tab shell — **Due Reminders** / **Customers** / **Interest** / **Message Log** — plus the stats tiles from `GET_EW_DASHBOARD_STATS`. Owns the `whatsappDeliveryStatus` subscription (filtering `kind === "EW"`) and the dispatch banner, copied in shape from `customer-connect-section.tsx` |
| `ew-due-grid.tsx` | Multi-select grid of due rows: name, mobile, brand, product/model, expiry date, days left, stage. Rows with an invalid mobile are shown but not selectable, the `isRowSelectable` precedent |
| `ew-customer-grid.tsx` | Full list, search + sort + paging, row actions Edit / Deactivate / Delete, plus an opted-out badge |
| `add-ew-customer-dialog.tsx`, `edit-ew-customer-dialog.tsx`, `delete-ew-customer-dialog.tsx` | react-hook-form + zod, `mode: "onChange"`, submit disabled while invalid, 1200 ms debounced duplicate check against `CHECK_EW_CUSTOMER_DUPLICATE`, `*` on mandatory labels in red (the only red in the feature) |
| `import-ew-customers-dialog.tsx` | The 5-step xlsx wizard copied from `masters/parts/import-part-dialog.tsx`. Target fields: Full Name*, Mobile*, Brand*, Warranty End Date*, Product, Model, Serial No, Purchase Date, Email, City, Remarks. Validation step flags bad mobiles, unparseable/past dates, unknown brands, and in-file duplicates before anything is sent |
| `ew-interest-grid.tsx` + `ew-follow-up-dialog.tsx` | Leads and their follow-up state; the dialog writes `follow_up_status` / `staff_remarks` via `genericUpdate` on `ew_interest` |
| `ew-reminder-log-grid.tsx` | Every send with its live status chip, reusing `whatsapp-status-cell.tsx` |
| `send-ew-reminders.ts` | Mutation wrapper, a direct copy of `send-whatsapp-completion.ts` with `ew_customer_ids` + `reminder_stage` in place of `job_ids` |
| `extended-warranty-helpers.ts`, `extended-warranty-schema.ts` | Row/stage helpers and the zod schemas |

Responsive throughout (grids scroll inside their own container), shadcn +
framer-motion, Sonner for toasts, `apolloClient.query(...)` never
`useApolloClient()`, `useAppSelector`/`useAppDispatch` only.

### Step 16 — Client: settings + notifications + help

1. `configurations/app-settings/edit-whatsapp-notifications-dialog.tsx` — add
   `EXTENDED_WARRANTY` to `WhatsappNotificationsValue`, `toValue()` and the switch
   list.
2. New `configurations/app-settings/edit-extended-warranty-settings-dialog.tsx` —
   friendly editor for the `extended_warranty` row (phone, WhatsApp number,
   reminder-day chips, daily cap, notify email, auto-send switch), wired the same
   way the WhatsApp-notifications dialog is wired in `app-settings-section.tsx`.
   Without it the row is still editable through the generic JSON editor, so this
   is quality-of-life, not a blocker.
3. `layout/use-notifications-summary.ts` + `client-top-nav.tsx` — fourth bell item
   "Extended warranty interest", count from `COUNT_EW_NEW_INTEREST`, navigating to
   `ROUTES.client.options` with `state: { subItem: "Extended Warranty" }` (the
   deep-link mechanism already in `client-layout.tsx`).
4. `help/help-content.ts` — new article `id: "extended-warranty"`, category
   `"WhatsApp"`, covering the setup, the import spreadsheet columns, the due
   windows, what the customer sees, and the follow-up workflow. Referenced from
   the `TreeItem`'s `helpArticleId`, and added to the "Options" row of the
   navigation table in the `what-is-service-plus` article.

### Step 17 — Verification

1. `python -c "import app.main"` in the server venv — proves the Ariadne schema
   builds and every new import resolves. This is the check the last three WhatsApp
   plans each flagged as outstanding; do not skip it here.
2. Run `scripts/seed_extended_warranty.sql` and
   `scripts/seed_access_right_options.sql` against `demo1`, then re-run both to
   confirm idempotency.
3. Create a BU from scratch and confirm the three tables and both app_setting rows
   arrive from `BU_SCHEMA_DDL` + seeds, with no manual step.
4. `pnpm tsc --noEmit` and `pnpm lint` on the client.
5. Submit the template to Meta and wait for approval **before** wiring the send
   button to anything a user can reach — an unapproved template name fails every
   send with a permanent error.
6. End-to-end on one real test number: send → check `ew_reminder.wamid` and
   status advancing through the webhook → tap the button → confirm the landing
   page renders → tap interest → confirm the `ew_interest` row, the bell count and
   the email → tap opt-out on a second record and confirm it disappears from the
   due list.

---

## Explicitly out of scope

- Inbound "STOP" keyword handling — the webhook still drops inbound messages;
  opt-out is the link on the landing page only.
- The quick-reply button variant and the global wamid→tenant routing table it
  needs (see "Alternative considered").
- Converting an interested person into a `customer_contact` row or a job — the
  requirement is explicit that these people stay outside the customer master.
- Taking payment for the extension, warranty contracts, or any accounting posting.
- Per-brand or per-region message variants; one approved template for now.
- Retry queues for failed sends — a FAILED row is simply re-selectable in the Due
  grid, the same fire-and-forget stance every other WhatsApp event here takes.

## Watch-outs

- **`reminder_stage` must be stored, not recomputed.** It is the second half of
  the uniqueness key; deriving it from `warranty_end_date - CURRENT_DATE` at read
  time would let the same person be messaged again a day later under a different
  bucket.
- **The webhook's id list changes meaning for `EW` only.** Anything that assumes
  the trailing ids in `biz_opaque_callback_data` are job ids must check the event
  code first.
- **`kind` on the pubsub payload is a deploy-window hazard.** Messages published
  by an old server process arrive without it; the Customer Connect subscriber must
  default a missing `kind` to `"JOB"` rather than dropping the event.
- **`MARKETING` is a new category for `client.py`.** It takes the same named
  header/body path as `UTILITY` (only `AUTHENTICATION` branches), so no client
  change is needed — but that is worth confirming on the first real send rather
  than assuming.
- **Brand matching on import is the likeliest source of bad data.** Match
  case-insensitively on `brand.name` and `brand.code`, and fail the row loudly in
  the Validation step rather than silently creating brands.
- **`daily_send_cap` is per BU schema per run**, not per client database — a
  multi-BU client running auto-send sends up to `cap × BUs` in a day.
