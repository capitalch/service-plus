# Extended Warranty Reminders — Design

WhatsApp warranty-expiry reminders to dealer-supplied device owners who are **not**
in `customer_contact` and never will be. New **Options** top-nav menu → **Extended
Warranty**. Message carries a URL button → public page → "I am interested" button →
staff follow up manually.

Fifth WhatsApp event (after `JOB_CREATION`/`JOB_COMPLETION`/`JOB_DELIVERY`/
`JOB_MONEY_RECEIPT`/`JOB_INVOICE`), and the first not anchored to a `job` row.

## Key constraints

- URL button, not quick-reply: an inbound reply carries no `biz_opaque_callback_data`,
  so tenant routing would need a new global wamid→tenant table + inbound handling.
- `reminder_stage` is **stored**, not recomputed — it is half the uniqueness key.
- MARKETING category (not Utility) and a non-opt-in list. Mitigations: event
  default-OFF and fail-closed, auto-send separately default-OFF, `daily_send_cap`,
  partial unique index preventing repeat sends, opt-out link, invalid mobiles skipped.

---

## Data model — BU schema

```sql
CREATE TABLE ew_customer (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    branch_id         bigint NOT NULL,
    full_name         text   NOT NULL,
    mobile            text   NOT NULL,
    email             text,
    brand_id          bigint NOT NULL,          -- FK brand(id)
    product_id        bigint,                   -- FK product(id)
    model_name        text,                     -- free text; not in product_brand_model
    serial_no         text,
    purchase_date     date,
    warranty_end_date date   NOT NULL,
    city              text,
    source            text   DEFAULT 'IMPORT' NOT NULL,   -- 'IMPORT' | 'MANUAL'
    import_batch_no   integer,
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

CREATE UNIQUE INDEX ew_customer_dedup_idx
    ON ew_customer (mobile, COALESCE(serial_no, ''), warranty_end_date);
CREATE INDEX ew_customer_warranty_end_idx ON ew_customer (warranty_end_date);
CREATE INDEX ew_customer_branch_idx       ON ew_customer (branch_id);

CREATE TABLE ew_reminder (
    id             bigint GENERATED ALWAYS AS IDENTITY,
    ew_customer_id bigint   NOT NULL,
    reminder_stage smallint NOT NULL,           -- days-before bucket: 60 / 30 / 7 / 0
    wamid          text,
    status         text     DEFAULT 'PENDING' NOT NULL,  -- PENDING/ACCEPTED/SENT/DELIVERED/READ/FAILED
    status_rank    smallint DEFAULT 0 NOT NULL,          -- 0..4, 9 = FAILED
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

CREATE UNIQUE INDEX ew_reminder_once_per_stage_idx
    ON ew_reminder (ew_customer_id, reminder_stage) WHERE (status <> 'FAILED');
CREATE INDEX ew_reminder_wamid_idx    ON ew_reminder (wamid);
CREATE INDEX ew_reminder_customer_idx ON ew_reminder (ew_customer_id);

CREATE TABLE ew_interest (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    ew_customer_id    bigint NOT NULL,
    ew_reminder_id    bigint,
    expressed_at      timestamp with time zone DEFAULT now() NOT NULL,
    source            text DEFAULT 'LINK' NOT NULL,   -- 'LINK' | 'MANUAL'
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

CREATE UNIQUE INDEX ew_interest_open_idx
    ON ew_interest (ew_customer_id) WHERE (follow_up_status IN ('NEW', 'IN_PROGRESS'));
CREATE INDEX ew_interest_status_idx ON ew_interest (follow_up_status);
```

### `app_setting`

- **Row 15** (`whatsapp_notifications`) default gains `"EXTENDED_WARRANTY": false`.
  No migration needed — `_is_event_enabled` fails closed on a missing key.
- **New row 16**, `extended_warranty`:

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

---

## Meta template — `extended_warranty_reminder_v1`

Category MARKETING, language `en`.

- **Header** (named): `Warranty reminder from {{business_unit}}` — 40-char truncation.
- **Body** params in order: `customer_name`, `brand`, `product`, `expiry_date`,
  `contact_phone`, `whatsapp_number`.

```
Hello {{customer_name}},

Greetings from {{brand}}! The warranty of your {{brand}} {{product}} will expire
on {{expiry_date}}. You may extend the warranty period for a further 1 or 2 years.

For details please call {{contact_phone}}, or WhatsApp {{whatsapp_number}}.
```

- **Footer** (static): `Tap below if you'd like us to call you.`
- **Button:** one dynamic-URL, text `I'm interested — contact me`, URL field holds the
  bare prefix `https://<public-host>/extended-warranty/` with **no placeholder** — the
  only registration shape that works (`{{token}}` and `{{1}}` both ship broken). The
  send supplies the token suffix.

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

`product` = `COALESCE(NULLIF(model_name,''), product.name, '')`.

---

## Public routes

New `app/routers/public/extended_warranty_router.py`, prefix `/extended-warranty`,
modelled on `job_intake_router.py`: signed token is the only credential, HTML
returned directly, never raises on a bad token. No CSRF (no ambient authority; write
is idempotent).

| Route | Method | Limit | Purpose |
|-------|--------|-------|---------|
| `/{token}` | GET | 60/60s | Landing: brand, product, expiry, interest button, contact-preference radio, remarks, opt-out link |
| `/{token}/interest` | POST | 20/60s | Records interest, thank-you page |
| `/{token}/opt-out` | POST | 20/60s | Sets `is_opted_out`/`opted_out_at` |

Primary control is a plain form-submit button labelled exactly **"I am interested in
extended warranty. Please contact me"**. No JavaScript required.

---

## Send path

```
sendWhatsappExtendedWarranty (per customer, ≤5 concurrent)
  ├─ _is_event_enabled('EXTENDED_WARRANTY')          … fail closed
  ├─ is_valid_mobile                                 … else SKIPPED
  ├─ INSERT ew_reminder (PENDING) ON CONFLICT DO NOTHING RETURNING id
  │     no id ⇒ already sent for this stage ⇒ skip
  ├─ sign_ew(db, schema, customer_id, reminder_id)
  ├─ send_template(..., callback = "db|schema|EW|reminder_id")
  └─ UPDATE ew_reminder → ACCEPTED + wamid + sent_at, or FAILED + error

webhook → decode "EW" → SET_EW_REMINDER_OUTCOME (ladder-guarded)
        → pubsub whatsapp_delivery_status {kind:"EW", ew_reminder_id, status}
```

Token is minted **after** the insert, so it can name the reminder id.

---

## Implementation steps

### Step 1 — Database

1. Apply the three `CREATE TABLE` blocks + indexes to the `demo1` template schema in
   `service_plus_service`.
2. Regenerate, in order (per `app/db/tools/extract_schema.py`, not by hand):
   `pg_dump --schema-only` → `app/db/schema_dumps/service_plus_service.sql`;
   `python -m app.db.tools.extract_schema` → rewrites `BuAdminDdl.BU_SCHEMA_DDL` in
   `app/db/sql/sql_bu_admin_ddl.py`; refresh `db/service_plus_demo.sql`.
3. `app/db/seeds/seed_bu_data.py` — add `app_setting` row 16, extend row 15.
4. `scripts/seed_extended_warranty.sql` — delta migration for existing BU schemas
   (`seed_access_right.sql` precedent): `CREATE TABLE IF NOT EXISTS` × 3, indexes,
   `INSERT … ON CONFLICT DO NOTHING` for row 16, `jsonb_set` adding
   `EXTENDED_WARRANTY: false` to row 15 only when absent. Idempotent.

### Step 2 — Access rights

1. `app/db/seeds/seed_security_data.py` → `ACCESS_RIGHT_SEED_SQL`:
   ```
   (19, 'OPTIONS_MENU',              'Options',           'OPTIONS', 'Access to the Options tab'),
   (20, 'OPTIONS_EXTENDED_WARRANTY', 'Extended Warranty', 'OPTIONS', 'Access to Options -> Extended Warranty')
   ```
   Roles: MANAGER (1) → 19, 20. RECEPTIONIST (3) → 19, 20. TECHNICIAN (2) → none.
2. `scripts/seed_access_right_options.sql` — delta migration, same shape as id-18.

### Step 3 — SQL store

New `app/db/sql/sql_extended_warranty.py`, `class ExtendedWarrantySql`, added to the
`SqlStore` bases in `sql_base.py`.

| Constant | Purpose |
|----------|---------|
| `GET_EW_CUSTOMERS_PAGED` / `_COUNT` | Customers tab; joins brand/product; search name/mobile/model/serial |
| `GET_EW_DUE_REMINDERS` | `warranty_end_date - CURRENT_DATE = ANY(%(stages)s)`, `is_active`, `NOT is_opted_out`, `NOT EXISTS` a non-FAILED `ew_reminder` for that stage, `branch_id` |
| `GET_EW_CUSTOMERS_FOR_WHATSAPP` | Server-side re-filter before send: `id = ANY(...) AND branch_id = ... AND is_active AND NOT is_opted_out` |
| `INSERT_EW_REMINDER` | `… VALUES (…, 'PENDING', …) ON CONFLICT DO NOTHING RETURNING id` |
| `SET_EW_REMINDER_ATTEMPT` | `UPDATE … SET wamid, status, status_rank, sent_at, error` |
| `SET_EW_REMINDER_OUTCOME` | Ladder-guarded: `… WHERE id = %(reminder_id)s AND status_rank < %(new_rank)s RETURNING id` |
| `GET_EW_REMINDER_LOG_PAGED` / `_COUNT` | Message Log tab |
| `GET_EW_INTEREST_PAGED` / `_COUNT` | Interest tab |
| `COUNT_EW_NEW_INTEREST` | Bell count (`follow_up_status = 'NEW'`) |
| `CHECK_EW_CUSTOMER_DUPLICATE` / `_EXCLUDE_ID` | Dialog duplicate check, keyed as `ew_customer_dedup_idx` |
| `GET_EW_DASHBOARD_STATS` | Tiles: due, sent-this-month, delivered, interested, converted |
| `GET_EW_AUTO_SEND_DUE` | Scheduler variant, no `branch_id`, `LIMIT %(cap)s` |

In `sql_public.py` (`PublicSql`): `GET_EW_LANDING_DATA`, `INSERT_EW_INTEREST` (with
`ON CONFLICT DO NOTHING`), `SET_EW_OPT_OUT`, `GET_EW_NOTIFY_EMAIL`.

### Step 4 — Token

`app/whatsapp/token.py` — add `sign_ew()` / `verify_ew()`, copied from
`sign_receipt`/`verify_receipt`. Payload `db_name|schema|ew_customer_id|ew_reminder_id|exp`,
`ttl_days=400`.

### Step 5 — Shared helpers

New `app/whatsapp/common.py`. Move `_sanitize`, `_truncate_business_unit`,
`_is_event_enabled`, `_build_biz_opaque_callback_data`, `_EVENT_CODE_BY_KEY` out of
`sender.py` and import them back. Pure move — run the app-boot smoke test after.

Add `"EXTENDED_WARRANTY": "EW"` to `_EVENT_CODE_BY_KEY`, commented: for this code the
trailing ids are **reminder ids, not job ids**.

### Step 6 — Template registration

`app/whatsapp/templates.py` — add the `TEMPLATES["EXTENDED_WARRANTY"]` entry above.

### Step 7 — Sender

New `app/whatsapp/ew_sender.py` (not in `sender.py`, whose every function assumes a
job row):

- `_build_ew_params(bu_name, row, settings) -> (header_values, body_values)` —
  `expiry_date` as `%d %b %Y`, all values through `_sanitize`.
- `_send_one(db_name, schema, bu_name, row, stage, sent_by, semaphore)` → returns
  `{customer_name, ew_customer_id, ew_reminder_id, status: SENT|FAILED|SKIPPED, error}`.
- `send_extended_warranty_reminders(db_name, schema="public", value="", sent_by=None)`
  — mutation entry point. `value` decodes to `{branch_id, ew_customer_ids,
  reminder_stage}`. Returns `{"results": [...], "disabled": bool}`, matching
  `resolve_send_whatsapp_completion_helper` so the client results dialog is reused.
- `run_ew_auto_send(db_name, schema)` — scheduler entry point; returns early unless
  `auto_send_enabled`, caps at `daily_send_cap`, `sent_by=None`.
- `_SEND_CONCURRENCY = 5`.

### Step 8 — Webhook

`app/routers/webhooks/whatsapp_webhook_router.py`:

1. `_EVENT_KEY_BY_CODE` += `"EW": "EXTENDED_WARRANTY"`.
2. In `_apply_status_callback`, branch after decode: `EXTENDED_WARRANTY` → ids are
   reminder ids → `SET_EW_REMINDER_OUTCOME`; otherwise the existing
   `SET_JOB_WHATSAPP_OUTCOME` path untouched.
3. Publish `{"db_name", "kind": "EW", "ew_reminder_id", "status", "error"}`. Job
   publishes gain `"kind": "JOB"`; the Customer Connect subscriber must treat a
   **missing** `kind` as `"JOB"` for messages in flight during a deploy.

### Step 9 — Public router

New `app/routers/public/extended_warranty_router.py` (routes per table above),
registered in `app/main.py`. On successful interest insert: publish to pubsub;
resolve alert address (`extended_warranty.notify_email` → branch email → head-office
email) and `send_email`, wrapped in its own try/except so a mail failure never turns
the customer's tap into an error page.

### Step 10 — GraphQL

1. `app/graphql/schema.graphql`:
   ```
   sendWhatsappExtendedWarranty(db_name: String!, schema: String, value: String!): Generic
   importExtendedWarrantyCustomers(db_name: String!, schema: String, value: String!): Generic
   ```
   Reads via `genericQuery`, CRUD via `genericUpdate`. No new query fields.
2. New `app/graphql/resolvers/options/extended_warranty.py` exporting
   `OPTIONS_GENERIC_UPDATE_TABLE_RIGHTS = {"ew_customer": "OPTIONS_EXTENDED_WARRANTY",
   "ew_interest": "OPTIONS_EXTENDED_WARRANTY"}` and
   `resolve_import_ew_customers_helper` (mirrors `resolve_import_spare_parts_helper`:
   decode list → `bulk_insert_records` → `{"success_count": n}`).
3. `app/graphql/resolvers/mutation.py` — merge that dict into
   `GENERIC_UPDATE_TABLE_RIGHTS`; register both with `@handle_graphql_errors`.
   `sendWhatsappExtendedWarranty` carries an explicit
   `require_access_right(info, "OPTIONS_EXTENDED_WARRANTY")` — a departure from the
   job WhatsApp mutations, because this one spends money. `sent_by` comes from
   `info.context["user_id"]`, never the client.

### Step 11 — Scheduler

`app/scheduler.py` — `run_daily_ew_reminders()` reusing the existing
`GET_ACTIVE_CLIENTS` → `GET_ACTIVE_SCHEMAS` iteration, calling `run_ew_auto_send`
per BU. `trigger="cron", hour=10, minute=0, id="daily_ew_reminders"`. No-op for
every existing client until both flags are switched on.

### Step 12 — Client: navigation shell

| File | Change |
|------|--------|
| `src/router/routes.ts` | `client.options: '/client/options'` |
| `src/router/index.tsx` | `{ element: <ClientOptionsPage />, path: 'options' }` |
| `features/auth/utils/access-rights.ts` | `OPTIONS_MENU`, `OPTIONS_EXTENDED_WARRANTY` |
| `layout/client-layout.tsx` | `Section` += `'options'`; `sectionFromPath`; `SECTION_LABELS.options='Options'`; `SECTION_DEFAULTS.options='Extended Warranty'`; `SECTION_DEFAULT_GROUPS.options=''` |
| `layout/client-top-nav.tsx` | `NAV_ITEMS` += `{ label:'Options', section:'options', to:ROUTES.client.options, requiredRight:ACCESS_RIGHTS.OPTIONS_MENU }`, after Reports |
| `layout/client-explorer-panel.tsx` | `OptionsExplorer()` with one `TreeItem` (`icon={ShieldCheck}`, `iconColor="text-violet-600"`, `helpArticleId="extended-warranty"`, disabled + title when right missing); `EXPLORERS.options`; `SECTION_TITLES.options='Add-on Services'`; `MOBILE_NAV_ITEMS` += Options |
| `layout/client-activity-bar.tsx` | `ACTIVITY_ITEMS` += `{ color:'text-violet-600', icon:ShieldCheck, section:'options' }` |
| `pages/client-options-page.tsx` | New — `<ClientLayout>` + `switch (selected)` → `<ExtendedWarrantySection />`, else `ComingSoon`; mirrors `client-configurations-page.tsx` |

`NAV_ITEMS` and `MOBILE_NAV_ITEMS` are separate arrays in separate files — edit both.

### Step 13 — Client: types and constants

- `features/client/types/extended-warranty.ts` — `EwCustomerType`, `EwDueRowType`,
  `EwInterestType`, `EwReminderLogType`, `EwSendResultType`, `ParsedEwCustomerType`,
  `ImportEwCustomersResultType`, `EwSettingsType`. Types not interfaces, `…Type`
  suffix, properties sorted.
- `constants/sql-map.ts` — one entry per Step 3 constant.
- `constants/graphql-map.ts` — both mutations, standard
  `($db_name: String!, $schema: String, $value: String!)` shape.
- `constants/messages.ts` — every string over two words.

### Step 14 — Client: promote send dialogs to shared

Move `jobs/customer-connect/send-messages-modal.tsx` and `send-results-dialog.tsx` to
`src/components/shared/whatsapp/`, updating imports in `customer-connect-section.tsx`
(the only caller). Already generic over "N customers, M messages, results".

### Step 15 — Client: the screen

`src/features/client/components/options/extended-warranty/`:

| File | Role |
|------|------|
| `extended-warranty-section.tsx` | Tab shell — Due Reminders / Customers / Interest / Message Log — plus stats tiles. Owns the `whatsappDeliveryStatus` subscription (filter `kind === "EW"`) and dispatch banner; shaped after `customer-connect-section.tsx` |
| `ew-due-grid.tsx` | Multi-select due rows: name, mobile, brand, product/model, expiry, days left, stage. Invalid-mobile rows shown but not selectable (`isRowSelectable`) |
| `ew-customer-grid.tsx` | Full list, search/sort/paging, Edit / Deactivate / Delete, opted-out badge |
| `add-` / `edit-` / `delete-ew-customer-dialog.tsx` | react-hook-form + zod, `mode:"onChange"`, submit disabled while invalid, 1200 ms debounced duplicate check, red `*` on mandatory labels |
| `import-ew-customers-dialog.tsx` | 5-step xlsx wizard copied from `masters/parts/import-part-dialog.tsx`. Fields: Full Name*, Mobile*, Brand*, Warranty End Date*, Product, Model, Serial No, Purchase Date, Email, City, Remarks. Validation flags bad mobiles, unparseable/past dates, unknown brands, in-file duplicates |
| `ew-interest-grid.tsx` + `ew-follow-up-dialog.tsx` | Leads; dialog writes `follow_up_status`/`staff_remarks` via `genericUpdate` on `ew_interest` |
| `ew-reminder-log-grid.tsx` | Sends with live status chip, reusing `whatsapp-status-cell.tsx` |
| `send-ew-reminders.ts` | Copy of `send-whatsapp-completion.ts` with `ew_customer_ids` + `reminder_stage` |
| `extended-warranty-helpers.ts`, `-schema.ts` | Row/stage helpers, zod schemas |

Responsive (grids scroll in their own container), shadcn + framer-motion, Sonner
toasts, `apolloClient.query(...)` never `useApolloClient()`, `useAppSelector`/
`useAppDispatch` only.

### Step 16 — Client: settings, notifications, help

1. `edit-whatsapp-notifications-dialog.tsx` — add `EXTENDED_WARRANTY` to
   `WhatsappNotificationsValue`, `toValue()`, and the switch list.
2. New `edit-extended-warranty-settings-dialog.tsx` — editor for row 16 (phone,
   WhatsApp number, reminder-day chips, daily cap, notify email, auto-send switch),
   wired into `app-settings-section.tsx`. Quality-of-life, not a blocker — the row is
   editable via the generic JSON editor regardless.
3. `layout/use-notifications-summary.ts` + `client-top-nav.tsx` — fourth bell item
   "Extended warranty interest", count from `COUNT_EW_NEW_INTEREST`, navigating to
   `ROUTES.client.options` with `state: { subItem: "Extended Warranty" }`.
4. `help/help-content.ts` — article `id: "extended-warranty"`, category `"WhatsApp"`:
   setup, import columns, due windows, what the customer sees, follow-up. Add to the
   Options row of the navigation table in `what-is-service-plus`.

### Step 17 — Verification

1. `python -c "import app.main"` in the server venv — proves the Ariadne schema builds
   and every new import resolves. **Do not skip.**
2. Run both delta scripts against `demo1`, then re-run to confirm idempotency.
3. Create a BU from scratch; confirm the three tables and both `app_setting` rows
   arrive from `BU_SCHEMA_DDL` + seeds with no manual step.
4. `pnpm tsc --noEmit` and `pnpm lint`.
5. Submit the template to Meta and wait for approval **before** wiring the send button
   to anything reachable — an unapproved name fails every send permanently.
6. End-to-end on one test number: send → `ew_reminder.wamid` + status advancing →
   tap button → landing page → tap interest → `ew_interest` row + bell + email → tap
   opt-out on a second record → confirm it leaves the due list.

---

## Out of scope

Inbound "STOP" handling (webhook still drops inbound; opt-out is the link only) ·
quick-reply variant and its global wamid→tenant table · converting a lead into
`customer_contact` or a job · payment/warranty contracts/accounting · per-brand
message variants · retry queues (a FAILED row is simply re-selectable).

## Watch-outs

- **Webhook id list changes meaning for `EW` only.** Anything assuming trailing ids in
  `biz_opaque_callback_data` are job ids must check the event code first.
- **`kind` on pubsub is a deploy-window hazard.** Old processes publish without it;
  default a missing `kind` to `"JOB"` rather than dropping the event.
- **`MARKETING` is new to `client.py`.** It takes the same named header/body path as
  `UTILITY` (only `AUTHENTICATION` branches), so no change expected — confirm on the
  first real send.
- **Brand matching on import** is the likeliest bad-data source. Match
  case-insensitively on `brand.name` and `brand.code`; fail the row loudly in
  Validation rather than creating brands.
- **`daily_send_cap` is per BU schema per run**, not per client database — a multi-BU
  client sends up to `cap × BUs` per day.
