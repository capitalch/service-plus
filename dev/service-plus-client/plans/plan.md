# Plan — Extended Warranty WhatsApp reminders (single-table design)

Three decisions are settled before implementation starts: the data model is **one table
with JSONB**, the top-nav container is **Custom**, and one interest tap fans out to **two
follow-up channels**. This is the sixth WhatsApp event — after `JOB_CREATION`,
`JOB_COMPLETION`, `JOB_DELIVERY`, `JOB_MONEY_RECEIPT` and `JOB_INVOICE` — and the first
not anchored to a `job` row.

---

## Status — implemented 2026-09-10

Code complete and verified: `python -c "import app.main"` passes (the Ariadne schema
builds and every new import resolves), `pnpm exec tsc -b --noEmit` passes, `pnpm build`
succeeds, and every new/changed client file has been run through `pnpm format`.

| Step | What | Status |
| --- | --- | --- |
| 1 | Database | **done** — `scripts/ew_delta.sql` (table, 6 indexes, `ew_stage_v`, both app_setting rows, the `whatsapp_notifications` key) applied to every schema, plus the same objects in `BU_SCHEMA_DDL` and `SeedBuData` so a new BU arrives complete |
| 2 | Access rights | **done** — `CUSTOM_MENU` (19) and `CUSTOM_EXTENDED_WARRANTY` (20) in all four places, plus `scripts/seed_access_right_ew.sql` |
| 3 | SQL store | **done** — `app/db/sql/sql_extended_warranty.py`, mixed into `SqlStore` |
| 4 | Tokens | **done** — `sign_ew` / `verify_ew`, TTL 180 days |
| 5 | Templates | **done** — `EXTENDED_WARRANTY` + `EXTENDED_WARRANTY_LEAD`, both **approved by Meta**; the registered definitions are recorded in Steps 5a/5b |
| 6 | Sender | **done** — `send_ew_reminders`, `send_ew_lead_alert`, webhook routing for `EW`/`EL`, `kind` on pubsub |
| 7 | Public routes | **done** — `extended_warranty_router.py`, mounted in `main.py`, with its nginx `location` block deployed (Step 7a) |
| 8 | GraphQL | **done** — `sendEwReminders`, `addEwFollowUp`, `resendEwLeadAlert` |
| 9 | Scheduler | **not built** — optional and default-OFF in this plan; manual send is complete. See below |
| 10 | Custom menu shell | **done** — registry, `Section`, routes, explorer, activity bar, deep-link page |
| 11 | Types, constants, shared move | **done** except the `send-messages-modal` move — see below |
| 12 | The screen | **done** — 5 tabs, 11 new files |
| 13 | Dashboard | **done** — 8 KPIs + funnel + trend, all drilling through one dialog |
| 14 | Settings, notifications, help | **done** — WhatsApp switch, bell item, help article |

**Two deliberate omissions, both flagged rather than silently skipped:**

- **Step 9 (scheduler).** The plan marks it optional and default-OFF, and nothing else
  depends on it — `auto_send_enabled` is seeded `false` and read by `get_ew_settings`, so
  wiring a daily job later needs no schema or send-path change. Manual sending is
  complete and is what the prompt asked for ("Reminders are sent on button click").
- **Step 11's promotion of `send-messages-modal.tsx` / `send-results-dialog.tsx` to
  `components/shared/whatsapp/`.** The EW send reports its results as toasts rather than
  a modal, so moving those two files would have been a pure refactor of working Customer
  Connect code with no caller in this feature. Left where they are; if a later screen
  wants that modal, the move is unchanged and still worth doing.

**Also still yours:**

1. **Re-run the Seed Roles dialog** for existing tenants, so their roles pick up
   `CUSTOM_MENU` and `CUSTOM_EXTENDED_WARRANTY`.
2. **Test with a single record** before sending in bulk, as Step 5c sets out. `demo1`
   already has its three numbers filled in and both switches on; `capitalelectronics` and
   `navtechnology` are still `enabled: false` with blank numbers.

Both templates are approved and the nginx block is deployed, so nothing else is blocking
the first send.

`pnpm lint` currently fails repo-wide with "typescript-eslint does not support TS 7.0" —
a pre-existing toolchain incompatibility, not something this feature introduced.

---

## Goal

A Sony-authorised service centre holds warranty-expiry data for device owners who are
**not** in `customer_contact` and never will be — it arrives from Sony's own parallel
system and is copy-pasted into Service+ by staff, one record at a time. The owner wants
to WhatsApp those people at 30 / 7 / 0 days before expiry, let them register interest with
one tap, and — on that one tap — both alert staff on the company WhatsApp number with the
full customer details **and** raise the lead inside Service+, so staff can follow up from
whichever is at hand and close it in one place. Every follow-up action is tracked until the
deal is won or lost, and the whole funnel shows on a dashboard he can drill into.

Gated behind `extended_warranty.enabled`, default **false** — this is a custom feature,
off for every tenant that has not bought it.

---

## Present context and current design

### The JSONB precedent — why the single-table choice is the house pattern

`job.whatsapp_notifications` already stores exactly this shape: an object keyed by event,
each holding flat `last_*` fields plus a capped `attempts` array. Its two SQL statements
encode four hard-won rules this plan must obey (all documented in comments at
`sql_jobs.py:2020-2046`):

1. **`jsonb_set` cannot auto-vivify a path more than one level deep.** Build the nested
   object as its own expression, then attach it with **one single-level `jsonb_set`**. A
   multi-level path chain silently no-ops — this shipped broken and was caught in
   production on 2026-08-25.
2. **Guard every read with `jsonb_typeof(...) = 'object'`**, so a legacy or corrupted
   value self-heals to `'{}'` instead of erroring.
3. **Read with chained `->` / `->>`, never `#>>` path arrays** — the latter raises when a
   path segment can't be resolved against the runtime type.
4. **Cap every array.** `attempts` keeps 20; the row is read on every grid page.

And `SET_JOB_WHATSAPP_OUTCOME`'s `WHERE` clause is the key technique: the status ladder is
enforced **in the WHERE**, with `RETURNING id` reporting whether the claim succeeded. That
is what replaces a unique index for concurrency safety.

---

## Key constraints

- **Exactly-once per stage must survive concurrent senders.** Two staff clicking Send for
  the same customer, or staff racing the scheduler, must produce one message. With no
  `ew_reminder` table there is no partial unique index to lean on.
- **MARKETING category, non-opt-in list.** Mitigated by: feature flag default-OFF, event
  switch default-OFF and fail-closed, auto-send separately default-OFF, `daily_send_cap`,
  the once-per-stage guard, an opt-out link, and skipping invalid mobiles.
- **URL button, not quick-reply.** An inbound reply carries no `biz_opaque_callback_data`,
  so tenant routing would need a new global wamid→tenant table.
- **Button URL registration has no placeholder.** The URL field holds the bare prefix only;
  the send appends the token. `{{token}}` and `{{1}}` both shipped broken — see
  `TemplateSpec`'s docstring.
- **Meta miscategorisation is a real, repeated failure here.** A body containing a numeric
  confirmation code got auto-flagged Authentication and rejected as Utility (2026-09-02).
  The staff-alert template carries the same class of risk.
- **`daily_send_cap` is per BU schema per run** — a multi-BU tenant can send `cap × BUs`.

---

## New design brief

### One table, JSONB for history — flat columns for anything the grid filters on

This mirrors the existing rule that `job`'s flat `last_*` fields "stay authoritative for
badges/sorting/selection" while the array is "purely additive". Flat columns carry anything
the grid filters or sorts on; `stages` and `follow_ups` carry the history behind them.

The DDL — `ew_customer`, its six indexes and the `ew_stage_v` view — is in
**Step 1 — Database**.

### `stages` shape

```json
{
  "30": {
    "delivery_status":  "DELIVERED",
    "stage_status":     "INTERESTED",
    "wamid":            "wamid.HBgM…",
    "sent_at":          "2026-09-10T06:12:04Z",
    "sent_by":          12,
    "settled_at":       "2026-09-10T06:12:09Z",
    "error":            null,
    "interest": {
      "expressed_at":      "2026-09-10T07:40:11Z",
      "preferred_contact": "CALL",
      "customer_remarks":  "call after 6pm",
      "alert": {
        "delivery_status": "DELIVERED",
        "wamid":           "wamid.HBgN…",
        "sent_at":         "2026-09-10T07:40:12Z",
        "error":           null
      }
    }
  },
  "7":  { "delivery_status": "FAILED", "stage_status": "MESSAGE_SENT", "error": "…" }
}
```

Two ladders live side by side, deliberately:

- **`delivery_status`** — Meta's ladder, identical ranks to the job events:
  `PENDING`(0) `ACCEPTED`(1) `SENT`(2) `DELIVERED`(3) `READ`(4) `FAILED`(9).
  Drives the Message Log chip.
- **`stage_status`** — the prompt's business ladder, per customer **per stage**:
  `START`(0, never stored — the absence of the key) `MESSAGE_SENT`(1) `INTERESTED`(2)
  `FOLLOWED_UP`(3) `CONVERTED`/`NOT_INTERESTED`/`UNREACHABLE`(9, terminal).
  Drives the dashboard and every drill-down.

### Two follow-up channels, one outcome

One customer tap fans out to **both** channels at once — they are redundant paths to the
same lead, not alternatives:

```
customer taps "I am interested…"
  └─ POST /extended-warranty/{token}/interest
       ├─ SET_EW_INTEREST                    … the lead, recorded first and unconditionally
       ├─ send_ew_lead_alert  → staff WhatsApp, full customer details + deep link
       ├─ notify_email                       … unchanged fallback
       └─ bell count (COUNT_EW_NEW_INTEREST) … unchanged fallback
```

**Channel 1 — WhatsApp.** Staff read the whole lead on their phone without opening the
app: name, mobile, address, device, expiry, preferred contact and the customer's own
remarks. They call, then tap the alert's **"Open in Service+"** button, which deep-links
straight to that customer's follow-up dialog to record the result.

**Channel 2 — in-app.** The same lead appears in the Interest tab and the notification
bell. Staff follow up and close from there.

Three properties this design must hold, and they are what the rest of the plan is built
around:

1. **The lead is recorded before either notification is attempted.** `SET_EW_INTEREST`
   commits first; the alert and the email are fire-and-forget afterwards. A customer tap
   can never be lost to a Meta outage or a bad `staff_whatsapp_number`.
2. **Both channels write to the same place.** Whichever way staff arrive, the outcome goes
   through `APPEND_EW_FOLLOW_UP` into `follow_ups` + `outcome` + `stage_status`. There is
   one lead and one history, never a WhatsApp-side record and an app-side record to
   reconcile.
3. **A failed alert is visible, not swallowed.** Its own `delivery_status` lives at
   `stages[n].interest.alert`, shows as a chip on the Interest grid, and is re-sendable
   from there. Silent failure here would mean staff never learn a customer raised a hand.

### `follow_ups` shape — append-only, capped at 50

```json
[{ "at": "2026-09-11T05:00:00Z", "by": 12, "by_name": "Ramesh",
   "stage": 30, "action": "CALL", "outcome": "IN_PROGRESS", "remarks": "…" }]
```

`action` ∈ `CALL` / `WHATSAPP` / `SMS` / `VISIT` / `OTHER`. Follow-ups sit at customer
level (each naming the stage that prompted it) because a converted deal is a
customer-level fact, while interest is per-stage.

### Exactly-once sends without a unique index

```sql
UPDATE ew_customer
SET stages = jsonb_set(COALESCE(stages, '{}'::jsonb), ARRAY[%(stage)s],
                       <object built in one expression>, true),
    updated_at = now()
WHERE id = %(ew_customer_id)s
  AND is_active AND NOT is_opted_out
  AND COALESCE(stages -> %(stage)s ->> 'delivery_status', 'NONE') IN ('NONE', 'FAILED')
RETURNING id
```

Under `READ COMMITTED`, an `UPDATE` that blocks on a concurrent writer re-evaluates its
`WHERE` against the **updated** row before proceeding (EvalPlanQual). So of two racing
senders exactly one gets a row back; the other sees zero rows and skips without calling
Meta. This is the same mechanism `SET_JOB_WHATSAPP_OUTCOME`'s ladder guard already
depends on. `IN ('NONE','FAILED')` is what keeps a failed stage re-sendable.

**The claim happens before the Meta call**, writing `delivery_status: 'PENDING'`; a second
statement settles it to `ACCEPTED` + `wamid` or `FAILED` + `error`. The token needs no id
round-trip — it names `(customer_id, stage)`, both known up front.

### The flattening view — JSONB stays invisible to every reader

`ew_stage_v` (DDL in **Step 1**) unnests `stages` with a `CROSS JOIN LATERAL jsonb_each`,
yielding one row per customer per stage with every JSONB field as a typed column.

Every report, grid and dashboard query reads this view, so all reporting SQL is ordinary
`GROUP BY` over a normal-looking relation. Only the four write statements ever touch raw
JSONB. At service-centre volumes (thousands of rows, not millions) the lateral unnest cost
is irrelevant.

### Name mapping — prompt wording → implementation

| Prompt | Implementation |
|---|---|
| `extended_warranty_notifications_enabled` | The **feature flag**: menu visibility + module existence. Originally its own `app_setting` row; now the `enabled` field of the `extended_warranty` row — see "Settings consolidation" at the end |
| "Custom" top nav | `Section` `'custom'`, `ROUTES.client.custom`, `ACCESS_RIGHTS.CUSTOM_MENU` |
| "Extended Warranty" left nav | `CUSTOM_MENU_ITEMS[0]`, right `CUSTOM_EXTENDED_WARRANTY` |
| "staff gets a message to company's whatsapp" | `EXTENDED_WARRANTY_LEAD` template → `staff_whatsapp_number` |
| "actions taken during follow up" | `follow_ups` JSONB array |
| "statuses … for each customer and for each stage" | `stages[n].stage_status` |
| "0 days" stage | `reminder_days_before` default `[30, 7, 0]` — the stage set is data, not code |

**Two switches, not one.** The feature flag makes the module *visible*;
`whatsapp_notifications.EXTENDED_WARRANTY` makes sends *allowed*. Both must be true to
send. They are separate because an owner will want to enter and review data before any
message goes out, and because keeping the send switch in the existing JSONB means
`_is_event_enabled` needs no change at all.

---

## Files touched

**Server** — `app/db/sql/sql_extended_warranty.py` (new), `sql_base.py`,
`sql_bu_admin_ddl.py`, `app/whatsapp/{templates,token,sender}.py`,
`app/routers/public/extended_warranty_router.py` (new), `app/routers/public/__init__.py`,
`app/graphql/{schema.graphql,resolvers/…}`, `app/graphql/pubsub.py` consumers,
`app/db/schema_dumps/` (regenerated), `scripts/seed_access_right.sql`.

**Client** — `src/router/{routes.ts,index.tsx}`,
`features/auth/utils/access-rights.ts`, `store/context-slice.ts`,
`features/client/components/layout/{client-layout,client-top-nav,client-explorer-panel,client-activity-bar,use-notifications-summary}.tsx`,
`features/client/components/layout/custom-menu-registry.ts` (new),
`features/client/pages/{client-custom-page,client-custom-ew-ref-page}.tsx` (new),
`features/client/components/custom/extended-warranty/**` (new),
`components/shared/whatsapp/` (moved),
`constants/{sql-map,graphql-map,messages}.ts`,
`features/client/types/extended-warranty.ts` (new),
`features/client/components/configurations/app-settings/*`,
`features/client/components/help/help-content.ts`,
`features/super-admin/components/seed-roles-dialog.tsx`.

---

## Implementation

### Step 1 — Database — ✅ DONE

**`service-plus-server/scripts/ew_delta.sql`** is the source of truth for the schema and
has been applied to the `demo1` template and to every existing BU schema; the dumps are
regenerated. This section records what it created.

**Objects it created**

| Object | Notes |
|---|---|
| `ew_customer` | The one table. Person + device + two JSONB history columns (`stages`, `follow_ups`) + six columns denormalised out of them for grid filter/sort + the usual lifecycle/audit columns. See "One table, JSONB for history" above for why it is shaped this way |
| `ew_customer_dedup_idx` | UNIQUE on `(mobile, COALESCE(serial_no,''), warranty_end_date)` — the same device+owner+expiry pasted twice is rejected |
| `ew_customer_due_idx` | Partial on `warranty_end_date WHERE is_active AND NOT is_opted_out` — the due-customers scan |
| `ew_customer_mobile_idx`, `ew_customer_branch_idx`, `ew_customer_outcome_idx` | Lookup, branch scoping, dashboard/grid filtering |
| `ew_customer_stages_gin` | GIN `jsonb_path_ops` on `stages` |
| `ew_stage_v` | The flattening view — one row per customer per stage, every JSONB field typed. Every read in Step 3 goes through it, so no reporting query ever touches raw JSONB |
| `app_setting` rows 16 and 17 | As originally applied: 16 = `extended_warranty_notifications_enabled` (visibility flag, default `false`); 17 = `extended_warranty` (config: `reminder_days_before [30,7,0]`, `daily_send_cap 250`, the numbers and emails). **Superseded** — the flag becomes a field on the config row and that row moves to id 16; see "Settings consolidation" at the end |
| `app_setting` row 15, updated | `EXTENDED_WARRANTY: false` merged into the existing `whatsapp_notifications` object with `||`, guarded by `NOT (setting_value ? 'EXTENDED_WARRANTY')` so a re-run never flips a switch an admin turned on |

The whole script is idempotent — `IF NOT EXISTS` on the table and indexes,
`CREATE OR REPLACE VIEW`, `ON CONFLICT (id) DO NOTHING` on the inserts, and the existence
guard on the merge — so it is safe to re-run against a schema that already has some of it.

**How it was applied** — the script does not iterate schemas itself, the target comes
from `search_path`, so it was run once per schema (the `demo1` template first):

```bash
psql "<conn>" -c "SET search_path TO demo1;" -f scripts/ew_delta.sql
```

A newly created BU needs none of this: `BU_SCHEMA_DDL` (`sql_bu_admin_ddl.py`) and
`SeedBuData` (`seed_bu_data.py`) carry the same objects, and row 15's seeded literal
already includes `"EXTENDED_WARRANTY": false`. Schema dumps were regenerated with
`app/db/tools/extract_schema.py` — never by hand.

### Step 2 — Access rights — ✅ DONE (seed re-run still needed for existing tenants)

`CUSTOM_MENU` and `CUSTOM_EXTENDED_WARRANTY`, in **all four** places or they silently do
nothing: the server seed (`scripts/seed_access_right.sql`), the server's
`GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS` map, `ACCESS_RIGHTS` in
`features/auth/utils/access-rights.ts`, and `ACCESS_RIGHT_PREVIEW_ITEMS` in
`features/super-admin/components/seed-roles-dialog.tsx`. Existing tenants only receive
new rights by re-running the seed-roles dialog.

### Step 3 — SQL store — ✅ DONE

New `app/db/sql/sql_extended_warranty.py`, mixed into `SqlStore` via `sql_base.py`.

**Writes (raw JSONB — obey all four rules from "The JSONB precedent"):**

| Constant | Purpose |
|---|---|
| `CLAIM_EW_REMINDER_STAGE` | The exactly-once claim above. `RETURNING id` |
| `SET_EW_REMINDER_OUTCOME` | Settles `delivery_status` after the Meta call and on webhook. Ladder guard **in the WHERE**, plus `(stages -> stage ->> 'wamid') = %(wamid)s` so a late callback for a prior wamid can't clobber a resend |
| `SET_EW_INTEREST` | Public route: writes `stages[n].interest`, advances `stage_status` to `INTERESTED` (rank-guarded), bumps `interest_count`. **`RETURNING id` reports whether this tap actually created the lead** — the notification fan-out keys off that, so a second tap produces neither a second lead nor a second alert |
| `SET_EW_ALERT_OUTCOME` | Settles `stages[n].interest.alert` after the staff-alert send and on its webhook. Same ladder guard and `wamid` match as `SET_EW_REMINDER_OUTCOME` |
| `APPEND_EW_FOLLOW_UP` | Appends to `follow_ups` (kept 49 + new, same `LIMIT 19` idiom), advances `stage_status`, sets `outcome`/`outcome_at` on a terminal action, bumps `follow_up_count` |
| `SET_EW_OPT_OUT` | Sets `is_opted_out`/`opted_out_at` |

**Reads (all against `ew_stage_v` or flat columns — plain SQL):**
`GET_EW_DUE_CUSTOMERS` (stage computed from `warranty_end_date` vs
`reminder_days_before`, excludes stages already claimed, excludes opted-out and invalid
mobiles), `GET_EW_CUSTOMERS_PAGED`, `GET_EW_CUSTOMER_BY_MOBILE`,
`GET_EW_INTEREST_PAGED` (carries the alert's own status), `GET_EW_LEAD_DETAIL` (the one
read behind the five composed alert lines), `GET_EW_REMINDER_LOG_PAGED`, `GET_EW_FOLLOW_UPS`,
`GET_EW_DASHBOARD_KPIS`, `GET_EW_FUNNEL_BY_STAGE`, `GET_EW_BY_BRAND` (written, but no
longer read by any screen — the brand card was removed from the dashboard),
`GET_EW_MONTHLY_TREND`, `GET_EW_DRILLDOWN` (one parameterised drill-down read behind
every KPI/segment), `COUNT_EW_NEW_INTEREST`, `GET_EW_SENT_TODAY_COUNT` (daily cap).

Mirror every constant name into `constants/sql-map.ts` — the string must match exactly.

### Step 4 — Tokens — ✅ DONE

`sign_ew(db_name, schema, ew_customer_id, stage, ttl_days=400)` / `verify_ew` in
`app/whatsapp/token.py`, same pipe-delimited HMAC shape as `sign_receipt`. Payload
`db|schema|customer_id|stage|exp`. TTL 180 days — the earliest send is 30 days before
expiry and the offer stays worth acting on for a few months after, so this outlives the
whole window with slack while staying far shorter than a job slip's 730.
Reuse `_link_secret()`, which already refuses to sign with an empty key.

### Step 5 — Templates — ✅ DONE (approved by Meta)

Two new `TemplateSpec` entries.

**`EXTENDED_WARRANTY`** — MARKETING, `en`, header `["business_unit"]`, body
`["customer_name","brand","product","expiry_date","contact_phone","whatsapp_number"]`,
`button_count=1`. Body as drafted in the prompt; footer *"Tap below if you'd like us to
call you."*; button text *"I'm interested — contact me"*; URL field holds the bare prefix
`https://<public-host>/extended-warranty/` with **no placeholder**.
`product = COALESCE(NULLIF(model_name,''), product.name, '')`.

**`EXTENDED_WARRANTY_LEAD`** — UTILITY, `en`, header `["business_unit"]`, body
`["customer_line","device_line","warranty_line","contact_line","remarks_line"]`,
`button_count=1`. Sent to `staff_whatsapp_number` the moment a customer taps interested.

"Full details of the customer" is carried in **five composed lines, not fifteen
variables** — the same technique `_build_reference_line` / `_build_amount_line` /
`_format_item_summary` already use, and for the same reason: Meta templates cannot branch,
so any "show this field only when present" logic has to happen in Python. It also keeps
the body inside Meta's variable and length limits.

| Param | Built from |
|---|---|
| `customer_line` | `full_name` · `mobile` |
| `device_line` | brand · product/model · serial no (each omitted when blank) |
| `warranty_line` | `Warranty ends <date>` · purchase date when present · which stage triggered it |
| `contact_line` | address / city · preferred contact (`Prefers a call` / `Prefers WhatsApp`) |
| `remarks_line` | the customer's own remarks, or `No remarks` |

**Every one of those is a single line.** `_sanitize` (`sender.py:42`) strips newlines and
tabs and collapses 4+ spaces because Meta rejects the send otherwise — so a line break
inside a parameter is not available. Separate fields within a line with ` · `, and let the
template's own body text supply the line breaks between params.

The body closes with *"This lead is already saved in Service+ — tap below to record the
result."* so staff know there is nothing to transcribe. Button text **"Open in Service+"**,
URL field holding the bare prefix `https://<client-host>/client/custom/ew/` with **no
placeholder**; the send appends `<customer_id>-<stage>`. That is a deep link into the
**authenticated** app — `ProtectedRoute` is the credential, so unlike the customer-facing
link it needs no signed token.

Add `"EXTENDED_WARRANTY": "EW"` and `"EXTENDED_WARRANTY_LEAD": "EL"` to
`_EVENT_CODE_BY_KEY`. The `EW` callback's trailing segment is
`customer_id,stage` — **not** job ids.

---

#### Step 5a — `extended_warranty_reminder_v1` as registered with Meta — ✅ APPROVED

WhatsApp Manager → Templates → Create. Everything below must match `templates.py:171`
**exactly** — name, language, category and every parameter name. A mismatch is not a
soft failure: an unapproved or misnamed template fails every send permanently.

| Field | Value |
|---|---|
| Name | `extended_warranty_reminder_v1` |
| Category | **Marketing** |
| Language | English (`en`) |

**Header** — type Text:

```
Warranty offer from {{business_unit}}
```

**Body** — the six parameters in this exact order (`customer_name`, `brand`, `product`,
`expiry_date`, `contact_phone`, `whatsapp_number`):

```
Hello {{customer_name}},

Greetings from {{brand}}.
The warranty on your {{product}} ends on {{expiry_date}}.

You can extend it for a further 1 or 2 years and stay covered for parts and labour. For
details call {{contact_phone}} or WhatsApp {{whatsapp_number}}.
```

**Footer:**

```
Tap below if you'd like us to call you.
```

**Button** — one button, type **URL**, sub-type **Dynamic**:

| | |
|---|---|
| Button text | `I'm interested — contact me` |
| URL | `https://serviceplus.cloudjiffy.net/extended-warranty/`

**The URL field holds that bare prefix and nothing else — no `{{1}}`, no `{{token}}`.**
Both were tried on 2026-08-30 and both shipped broken in exactly the same way: the
placeholder was stored as literal text and the sent value appended after it. The working
theory is that the Dynamic type alone drives the append. That theory is still untested —
**verify it on the first real send** by opening the received link before sending in bulk.

**Sample values** (Meta requires one per named parameter):

| Parameter | Sample |
|---|---|
| `business_unit` | `Capital Chowringhee` |
| `customer_name` | `Ramesh Kumar` |
| `brand` | `Sony` |
| `product` | `KD-55X80K` |
| `expiry_date` | `12 Oct 2026` |
| `contact_phone` | `033 4000 1234` |
| `whatsapp_number` | `+91 98300 12345` |
| Button URL | `https://serviceplus.cloudjiffy.net/extended-warranty/abc123.def456`

`expiry_date` is `_format_expiry_date`'s `%d %b %Y` — a spelled month, so a customer
reading it on a phone cannot misread dd/mm as mm/dd.

#### Step 5b — `extended_warranty_lead_alert_v1` as registered with Meta — ✅ APPROVED

| Field | Value |
|---|---|
| Name | `extended_warranty_lead_alert_v1` |
| Category | **Utility** — see the caveat below |
| Language | English (`en`) |

**Header** — type Text:

```
New warranty lead — {{business_unit}}
```

**Body** — the five composed lines in this exact order (`customer_line`, `device_line`,
`warranty_line`, `contact_line`, `remarks_line`):

```
A customer has asked about extending their warranty.

Customer: {{customer_line}}
Device: {{device_line}}
Warranty: {{warranty_line}}
Contact: {{contact_line}}
Remarks: {{remarks_line}}

This lead is already saved in Service+ — tap below to record the result.
```

The line breaks must live in the **template body**, as above. `_sanitize` strips newlines
and tabs out of every parameter, so a parameter can never carry one.

**Button** — one button, type **URL**, sub-type **Dynamic**:

| | |
|---|---|
| Button text | `Open in Service+` |
| URL | `https://serviceplus.cloudjiffy.net/client/custom/ew/`

Same bare-prefix rule. The send appends `<customer_id>-<stage>`. This one deep-links into
the **authenticated** app, so `ProtectedRoute` is the credential and no signed token is
minted for it.

**Sample values:**

| Parameter | Sample |
|---|---|
| `business_unit` | `Capital Chowringhee` |
| `customer_line` | `Ramesh Kumar · 9830012345` |
| `device_line` | `Sony · KD-55X80K · SN12345678` |
| `warranty_line` | `Warranty ends 12 Oct 2026 · Bought 12 Oct 2024 · 30-day reminder` |
| `contact_line` | `12 Park Street · Kolkata · Prefers a call` |
| `remarks_line` | `Call after 6pm` |
| Button URL | `https://serviceplus.cloudjiffy.net/client/custom/ew/1234-30`

Those samples are literally what `_join_parts` produces — ` · `-separated, blanks dropped,
`-` when everything is blank.

**If Meta rejects the Utility category, resubmit as Marketing and change nothing else** —
`category` in `templates.py` is metadata for the submission, and the send path does not
branch on it. A lead alert to your own staff number is arguably Utility, but Meta's
classifier has rejected a Utility submission here before over content it read differently
(the JOB_DELIVERY OTP split, 2026-09-02).

#### Step 5c — After both are approved — ⏳ PARTLY YOURS

1. ~~Confirm both show **Approved** in WhatsApp Manager.~~ ✅ Both approved.
2. Check the header truncation budget still holds: the header is 60 characters, both
   fixed prefixes above are exactly 20, and `_truncate_business_unit` cuts the BU name at
   40 at a word boundary. Changing the header wording means changing that constant.
3. Set `staff_whatsapp_number`, `whatsapp_number` and `contact_phone` in App Settings →
   `extended_warranty` — the reminder prints two of them, and a blank one sends `-`.
4. Turn on `whatsapp_notifications.EXTENDED_WARRANTY`, then send to **one** test record
   and open both the customer link and the staff alert's deep link before doing anything
   in bulk. The `daily_send_cap` of 250 is per BU schema per run, not per tenant.

### Step 6 — Sender — ✅ DONE

`send_ew_reminders(db_name, schema, value)` in `sender.py`, shaped after
`send_whatsapp_money_receipt`, fanning out at the existing `_SEND_CONCURRENCY = 5`:

```
per customer × stage
  ├─ feature flag AND _is_event_enabled('EXTENDED_WARRANTY')   … fail closed
  ├─ daily cap check (GET_EW_SENT_TODAY_COUNT)                 … else CAPPED
  ├─ is_valid_mobile                                           … else SKIPPED
  ├─ CLAIM_EW_REMINDER_STAGE → no row ⇒ already sent ⇒ skip
  ├─ sign_ew(db, schema, customer_id, stage)
  ├─ send_template(callback = "db|schema|EW|customer_id,stage")
  └─ SET_EW_REMINDER_OUTCOME → ACCEPTED + wamid, or FAILED + error
```

`send_ew_lead_alert(db_name, schema, ew_customer_id, stage)` — channel 1 of the two above:

```
├─ read staff_whatsapp_number       … unset ⇒ return, no error, no alert row
├─ is_valid_mobile                  … else record SKIPPED
├─ build the five composed lines from one GET_EW_LEAD_DETAIL read
├─ send_template(EXTENDED_WARRANTY_LEAD, callback = "db|schema|EL|customer_id,stage")
└─ SET_EW_ALERT_OUTCOME → stages[stage].interest.alert
```

Called **after** `SET_EW_INTEREST` has committed, and wrapped so that no failure — unset
number, invalid number, Meta 4xx/5xx, timeout — can propagate into the customer's request.
The customer sees a thank-you page regardless; the lead is already saved either way.

Webhook: decode `EW` → `SET_EW_REMINDER_OUTCOME`; decode `EL` → `SET_EW_ALERT_OUTCOME`.
Both publish `whatsapp_delivery_status {kind:"EW", ew_customer_id, stage, status}`, the
alert carrying `target: "STAFF"` so the Interest grid's chip and the Message Log's chip
update independently.

### Step 7 — Public routes — ✅ DONE

New `app/routers/public/extended_warranty_router.py`, prefix `/extended-warranty`,
modelled on `job_intake_router.py`: signed token is the only credential, HTML returned
directly, never raises on a bad token, no CSRF (no ambient authority, writes idempotent).

| Route | Method | Limit | Purpose |
|---|---|---|---|
| `/{token}` | GET | 60/60s | Landing: brand, product, expiry, interest button, contact-preference radio, remarks, opt-out link |
| `/{token}/interest` | POST | 20/60s | `SET_EW_INTEREST` **commits first**, then fires the staff alert, the email and the bell; thank-you page |
| `/{token}/opt-out` | POST | 20/60s | `SET_EW_OPT_OUT` |

The primary control is a plain form-submit button reading exactly **"I am interested in
extended warranty. Please contact me"**. No JavaScript required.

`SET_EW_INTEREST` is idempotent on `(customer, stage)`: a second tap — a double-click, a
retried form post, a customer re-opening the link days later — must not create a second
lead **or a second staff alert**. Fan out to the notification channels only when the
statement reports it actually created the interest.

#### Step 7a — nginx reverse proxy — ✅ DONE

**`/extended-warranty` is a new top-level public prefix, and nginx does not know about
it.** `notes/Deployment.md` gives one `location` block per public WhatsApp prefix
(`/job-intake/`, `/job-delivery/`, `/job-money-receipt/`); there is none for this one, so
`location / { try_files $uri /index.html; }` swallows it and every customer who taps
"I am interested" is served the React SPA shell instead of the interest page. The SPA has
no route for `/extended-warranty/<token>`, so they see a dead page — while the send itself
reports success. Silent failure, on the customer-facing half of the feature.

The block is live on the server and is also in `notes/Deployment.md`'s reference config,
so a fresh deploy picks it up:

```nginx
    # Extended Warranty — public interest / opt-out pages
    location /extended-warranty/ {
        proxy_pass http://127.0.0.1:8000/extended-warranty/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Applied with `sudo nginx -t` and a reload. It had to be live before the first send — the
button URL registered with Meta (Step 5a) points at this prefix.

Nothing else changes:

- **The webhook needs no block.** `whatsapp_webhook_router.py` mounts at `/api/webhooks`,
  already inside the existing `location /api/`.
- **The staff alert's deep link needs no block.** `/client/custom/ew/<id>-<stage>` is an
  SPA route, correctly served by `try_files $uri /index.html`.

### Step 8 — GraphQL — ✅ DONE

`sendEwReminders` and `sendEwLeadAlert` mutations in the standard
`($db_name: String!, $schema: String, $value: String!)` envelope. Everything else —
every read, plus customer create/edit/delete and the follow-up write — goes through the
existing `genericQuery` / `genericBatchQuery` / `genericUpdate` /
`genericUpdateScript`. No bespoke per-entity operations.

### Step 9 — Scheduler (optional, default OFF) — ⛔ NOT BUILT (deliberate, see Status)

Daily job honouring `auto_send_enabled`, `reminder_days_before` and `daily_send_cap`,
calling the same `send_ew_reminders` path with `sent_by = NULL`. The claim guard makes it
safe to run alongside manual sends.

### Step 10 — Client: the "Custom" menu shell — ✅ DONE

New `features/client/components/layout/custom-menu-registry.ts` — the one piece of new
shared plumbing, and the reason "Custom" exists as a container rather than a single item:

```ts
export type CustomMenuItemType = {
    helpArticleId: string;
    icon: LucideIcon;
    iconColor: string;
    isEnabled: (ctx: CustomMenuContextType) => boolean;
    label: string;
    requiredRight?: AccessRightCode;
};

export const CUSTOM_MENU_ITEMS: CustomMenuItemType[] = [
    {
        helpArticleId: "extended-warranty",
        icon:          ShieldCheck,
        iconColor:     "text-violet-600",
        isEnabled:     ctx => ctx.extendedWarrantyNotificationsEnabled,
        label:         "Extended Warranty",
        requiredRight: ACCESS_RIGHTS.CUSTOM_EXTENDED_WARRANTY,
    },
];

export function getVisibleCustomMenuItems(user, ctx) { … }
```

| File | Change |
|---|---|
| `store/context-slice.ts` | `extendedWarrantyNotificationsEnabled: boolean` + `setExtendedWarrantyNotificationsEnabled` + `selectExtendedWarrantyNotificationsEnabled` |
| `layout/client-layout.tsx` | Parse the new setting in the existing `GET_APP_SETTINGS` effect (same `JSON.parse`-in-try/catch shape as `post_data_to_accounts`, `:209`); `Section` += `'custom'`; `sectionFromPath`; `SECTION_LABELS/DEFAULTS/DEFAULT_GROUPS` |
| `layout/client-top-nav.tsx` | `NavItem` gains optional `isVisible?: boolean`; add the Custom item after Reports, visible only when `getVisibleCustomMenuItems(...).length > 0` |
| `layout/client-explorer-panel.tsx` | `CustomExplorer()` rendering `getVisibleCustomMenuItems(...)`; `EXPLORERS.custom`; `SECTION_TITLES.custom = 'Add-on Services'`; `MOBILE_NAV_ITEMS` += Custom |
| `layout/client-activity-bar.tsx` | `ACTIVITY_ITEMS` += `{ color:'text-violet-600', icon:ShieldCheck, section:'custom' }` |
| `router/routes.ts`, `router/index.tsx` | `client.custom: '/client/custom'` plus `client.customEwRef: '/client/custom/ew/:ref'`; both route elements |
| `pages/client-custom-ew-ref-page.tsx` | New — resolves the staff alert's deep link. Parses `:ref` (`<customer_id>-<stage>`), then renders the Custom page with Extended Warranty selected, the Interest tab active and that customer's follow-up dialog open. Sits behind `ProtectedRoute` like every other client route, so an unauthenticated tap lands on login and returns here afterwards |
| `pages/client-custom-page.tsx` | New — `<ClientLayout>` + `switch (selected)`; mirrors `client-configurations-page.tsx` |

`NAV_ITEMS` and `MOBILE_NAV_ITEMS` are separate arrays in separate files — edit both.

### Step 11 — Client: types, constants, shared move — ✅ DONE except the shared move (see Status)

- `features/client/types/extended-warranty.ts` — `EwCustomerType`, `EwDueRowType`,
  `EwFollowUpType`, `EwInterestRowType`, `EwReminderLogRowType`, `EwSendResultType`,
  `EwSettingsType`, `EwStageStatusType`. Derive column shapes from `types/db-schema-service.ts`; `type`
  not `interface`, `…Type` suffix, properties sorted.
- `constants/sql-map.ts`, `constants/graphql-map.ts`, `constants/messages.ts` (every
  string over two words).
- Move `send-messages-modal.tsx` and `send-results-dialog.tsx` to
  `components/shared/whatsapp/`, updating imports in `customer-connect-section.tsx` (the
  only caller). Both are already generic over "N customers, M messages, results".

### Step 12 — Client: the Extended Warranty screen — ✅ DONE

`features/client/components/custom/extended-warranty/`:

| File | Role |
|---|---|
| `extended-warranty-section.tsx` | Tab shell — **Dashboard** / Due Reminders / Customers / Interest / Follow-ups / Message Log. Owns the `whatsappDeliveryStatus` subscription (`kind === "EW"`, defaulting a missing `kind` to `"JOB"`) and the dispatch banner; shaped after `customer-connect-section.tsx` |
| `ew-dashboard.tsx` | See Step 13 |
| `ew-due-grid.tsx` | Multi-select due rows: name, mobile, brand, product/model, expiry, days left, stage. Invalid-mobile rows shown but not selectable (`isRowSelectable`) |
| `ew-customer-grid.tsx` | Full list, search/sort/paging, Edit / Deactivate / Delete, opted-out and outcome badges |
| `add-` / `edit-` / `delete-ew-customer-dialog.tsx` | react-hook-form + zod, `mode:"onChange"`, submit disabled while invalid, red `*` on mandatory labels. **On mobile blur → `GET_EW_CUSTOMER_BY_MOBILE`, which searches `customer_contact` *and* `ew_customer` and prefills whichever hits** (the prompt's cross-lookup); debounce from `constants/timing.ts`, never a literal. Fields: Full Name*, Mobile*, Brand* (select from `brand`), Warranty End Date*, Purchase Date, Product (select), Model, Serial No, Address, City, Email, Remarks. This is the only way records enter the system, so it carries the whole validation burden: reject an unparseable or already-past warranty date, and warn on a duplicate `(mobile, serial_no, warranty_end_date)` before the unique index does |
| `ew-interest-grid.tsx` | Leads, newest first, with stage, preferred contact, customer remarks, and a **staff-alert status chip** (reusing `whatsapp-status-cell.tsx`) with a Resend action for a `FAILED` or never-sent alert |
| `ew-follow-up-dialog.tsx` | Records one action (type, outcome, remarks) via `APPEND_EW_FOLLOW_UP`; shows the full prior history from `follow_ups`. **The single close point for both channels** — reached from the Interest grid, or deep-linked straight here from the staff WhatsApp alert |
| `ew-reminder-log-grid.tsx` | Sends with live status chip, reusing `whatsapp-status-cell.tsx` |
| `send-ew-reminders.ts` | Copy of `send-whatsapp-completion.ts`, carrying `ew_customer_ids` + `stage` |
| `extended-warranty-helpers.ts`, `-schema.ts` | Stage/status helpers, zod schemas |

Responsive (grids scroll in their own container), shadcn + framer-motion, sonner toasts,
`apolloClient.query(...)` never `useApolloClient()`, `useAppSelector`/`useAppDispatch` only.

### Step 13 — Client: the drill-down dashboard — ✅ DONE

`ew-dashboard.tsx`, assembled from `reports/common/` — do not write new chart or card
components:

- **KPI row** (`KpiGrid` + `KpiCard`, one `GET_EW_DASHBOARD_KPIS` call): Due in window ·
  Messages sent · Delivered · Interested · Followed up · Converted · Conversion % ·
  Opted out. Every card is clickable.
- **Funnel by stage** (`ChartCard` + `GET_EW_FUNNEL_BY_STAGE`): stacked bars, one column
  per stage (30/7/0 today), segments by `stage_status`. Every segment is clickable. Build
  the columns from `reminder_days_before`, never from a literal list — that is what keeps
  adding a 60-day stage a settings edit.
- **Monthly trend** (`ChartCard` + `GET_EW_MONTHLY_TREND`), full width, last 6 months.
- **Drill-down**: one `EwDrilldownDialog` modelled on `dashboard-jobs-list-dialog.tsx`,
  driven by the same `{ description, sqlArgs, sqlId, title }` state object
  `dashboard-section.tsx:30-35` already uses. Every KPI and every chart segment sets that
  state with `GET_EW_DRILLDOWN` plus its own filter args — so the whole surface is
  drillable through one dialog and one SQL id.
- Date range via `ReportToolbar` + `fiscal.ts` `getRange`, exactly as
  `dashboard-section.tsx` does. `ReportLoading` / `ReportEmpty` / `ReportError` for the
  three non-data states. xlsx/pdf export via the existing `xlsx-export.ts` /
  `pdf-export.ts`.

### Step 14 — Client: settings, notifications, help — ✅ DONE

1. `edit-whatsapp-notifications-dialog.tsx` — add `EXTENDED_WARRANTY` to
   `WhatsappNotificationsValue`, `toValue()` and the switch list.
2. New `edit-extended-warranty-settings-dialog.tsx` for the `extended_warranty` row
   (contact phone, WhatsApp number, staff WhatsApp number, reminder-day chips, daily cap,
   notify email, auto-send switch), wired into `app-settings-section.tsx`. Quality-of-life
   — the row is editable through the generic JSON editor regardless.
3. `use-notifications-summary.ts` + `client-top-nav.tsx` — fourth bell item "Extended
   warranty interest", count from `COUNT_EW_NEW_INTEREST`, navigating to
   `ROUTES.client.custom` with `state: { subItem: "Extended Warranty" }`.
4. `help/help-content.ts` — article `id: "extended-warranty"`, category `"WhatsApp"`:
   enabling the feature, entering a record, due windows, what the customer sees, the
   follow-up loop, reading the dashboard. Add a Custom row to the navigation table in
   `what-is-service-plus`.

---

## Testing

Every case below needing a live database or a Meta-approved template is **⏳ PENDING** —
those wait on the DB work. The two that could be run without either were run and pass.

1. ✅ **PASSED** — **Schema builds** — `python -c "import app.main"` in the server venv. Proves the
   Ariadne schema builds and every new import resolves. **Do not skip.**
2. ⏳ **Delta idempotency** — run the delta script against `demo1` twice; the second run
   must be a no-op.
3. ⏳ **Fresh BU** — create a BU from scratch; the table, view and both settings rows must
   arrive from `BU_SCHEMA_DDL` + seeds with no manual step.
4. ⏳ **JSONB auto-vivify** — on a customer whose `stages` is `'{}'`, run
   `CLAIM_EW_REMINDER_STAGE` and confirm the stage key is actually created. This is the
   exact bug that shipped on the job path; a single-level `jsonb_set` is the only shape
   that works.
5. ⏳ **Exactly-once under concurrency** — fire two `CLAIM_EW_REMINDER_STAGE` statements for
   the same `(customer, stage)` from two psql sessions inside overlapping transactions.
   Exactly one must return a row. Repeat with a `FAILED` stage: that one **must** be
   re-claimable.
6. ⏳ **Ladder guard** — replay an out-of-order webhook (`DELIVERED` then a stale `SENT`);
   `delivery_status` must not move backwards. Replay a callback carrying a *prior* wamid
   after a resend; it must not clobber the new send.
7. ⏳ **Interest fan-out** — one tap must produce all four: the lead row, the staff WhatsApp
   alert, the email, and the bell count. Verify the lead is written **before** the alert is
   attempted by pointing `staff_whatsapp_number` at an invalid number — the lead, email and
   bell must still be there, and the alert must show `FAILED` with a Resend action, not
   vanish.
7b. ⏳ **Interest idempotency** — tap twice (and re-post the form); exactly one lead and
   exactly **one** staff alert. Then re-open the same link a day later: still no second
   alert.
7c. ⏳ **Deep link closes the loop** — tap "Open in Service+" on the alert while logged out;
   land on login, then arrive at that customer's follow-up dialog with the Interest tab
   active. Record an outcome there and confirm it lands in the same `follow_ups` array the
   in-app path writes to.
7d. ⏳ **Both channels, one history** — close one lead from the deep link and another from the
   Interest grid; both must produce identical row shapes in `follow_ups` and move
   `outcome` / `stage_status` the same way.
8. ⏳ **Array cap** — append 60 follow-ups; the array holds 50 and the oldest are dropped.
9. ⏳ **Fail-closed switches** — with the feature flag off, the Custom menu must not render
   at all; with the flag on but `whatsapp_notifications.EXTENDED_WARRANTY` off, the screen
   renders and Send refuses.
10. ⏳ **Menu container logic** — with `CUSTOM_EXTENDED_WARRANTY` revoked and no other custom
    item enabled, "Custom" must disappear entirely, not render empty.
11. ⏳ **Cross-lookup** — enter a mobile that exists only in `customer_contact`, then one that
    exists only in `ew_customer`; both must prefill.
12. ⏳ **Dashboard drill-down** — every KPI card and every funnel segment opens the dialog,
    and its row count matches the number on the card.
13. ⏳ **Daily cap** — set `daily_send_cap` to 2, select 5; exactly 2 send and 3 report
    `CAPPED`.
14. ✅ **PASSED (with one caveat)** — **Client build** — `pnpm exec tsc -b --noEmit` clean,
    `pnpm build` succeeds, `pnpm format` run on every touched file. `pnpm lint` could NOT
    be run: it fails repo-wide with "typescript-eslint does not support TS 7.0", a
    pre-existing toolchain incompatibility this feature did not introduce — so eslint gave
    this work no coverage at all.
15. ⏳ **Meta approval before wiring** — submit both templates and wait for approval **before**
    the Send button is reachable. An unapproved name fails every send permanently.
16. ⏳ **End-to-end on one test number** — send → `wamid` present and status advancing → tap
    the button → landing page → tap interest → lead row + staff WhatsApp alert + bell +
    email → log a follow-up → mark Converted → confirm the dashboard funnel moves → tap
    opt-out on a second record and confirm it leaves the due list.

---

## Flags and constraints

- **The staff-alert template is the likeliest Meta rejection**, and it is now a
  first-class channel rather than a garnish — so treat approval as a gating item, not a
  nice-to-have. A lead notification to your own number is arguably Utility, but Meta's
  classifier has already rejected a Utility submission in this codebase for content it read
  differently (2026-09-02). If it is rejected, resubmit under MARKETING; nothing else in
  the design changes. Until it is approved, channel 2 (bell + email + Interest tab) carries
  the whole feature on its own — which is exactly why the lead is committed before any
  notification is attempted.
- **Two channels are redundancy, not duplication.** The temptation during implementation
  will be to let staff close a lead by replying to the WhatsApp alert. Do not — an inbound
  reply carries no `biz_opaque_callback_data`, so there is no way to route it back to a
  tenant, which is the same constraint that forced a URL button on the customer-facing
  message. The deep link is the return path.
- **`staff_whatsapp_number` is a single number.** If the owner later wants a group of
  staff, that is a list plus a fan-out loop in `send_ew_lead_alert` — no schema change,
  since the alert's state is keyed per lead, not per recipient. Worth knowing before
  someone stores comma-separated numbers in the existing field.
- **Single table is the user's explicit choice**, and it matches
  `job.whatsapp_notifications`. The correctness cost is real but contained: exactly-once
  now depends on `CLAIM_EW_REMINDER_STAGE`'s `WHERE` clause rather than on a partial
  unique index, so **that statement must never be edited without re-running test 5**. A
  unique index enforces itself; a `WHERE` clause only works while it is correct.
- **`stage` is a JSONB object key, so it is a string.** `stages -> '30'`, never
  `stages -> 30`. Cast on the way out (`(s.key)::smallint` in the view), and always pass
  `%(stage)s` as text from Python.
- **`ew_stage_v` uses `CROSS JOIN LATERAL`**, so a customer with no sends yet has **no
  rows** in the view. Due-list and "not yet contacted" counts must come from
  `ew_customer` directly, not from the view.
- **`kind` on pubsub is a deploy-window hazard.** Old processes publish without it;
  default a missing `kind` to `"JOB"` rather than dropping the event.
- **The `EW` callback's trailing ids are `customer_id,stage`, not job ids.** Anything
  assuming otherwise must check the event code first.
- **`MARKETING` is new to `client.py`.** It takes the same named header/body path as
  `UTILITY` (only `AUTHENTICATION` branches), so no change is expected — confirm on the
  first real send.
- **Brand is a select, not free text.** Manual-only entry removes the bad-brand-data risk
  an import would carry; keep it a picker over `brand` so it stays that way.
- **`daily_send_cap` is per BU schema per run**, not per client database — a multi-BU
  tenant sends up to `cap × BUs` per day.
- **Access rights reach existing tenants only via the seed-roles dialog.** Adding them to
  the four places is not enough for a live tenant; someone must re-run that dialog.

## Out of scope

Inbound "STOP" handling (the webhook still drops inbound; opt-out is the link only) ·
the quick-reply variant and its global wamid→tenant table · converting a lead into
`customer_contact` or a job · payment, warranty contracts and accounting · per-brand
message variants · retry queues (a `FAILED` stage is simply re-selectable) · additional
"Custom" menu items beyond Extended Warranty.

Two things were cut from scope deliberately, both cheap to add back:

- **xlsx import.** Records are copy-pasted one at a time for now. Adding import later means
  a `source text DEFAULT 'MANUAL'` + `import_batch_no integer` column pair, an
  `import-ew-customers-dialog.tsx` copied from `masters/parts/import-part-dialog.tsx`
  (5-step wizard), and case-insensitive brand matching on `brand.name` / `brand.code` —
  which is where an import's bad-data risk lives. Nothing in the write path or the JSONB
  shape changes.
- **The 60-day stage.** Only 30 / 7 / 0 are wanted now. Because the stage set lives in
  `reminder_days_before` and stage keys are created on demand by `jsonb_set`, adding 60
  later is **a settings edit, not a migration** — no new column, no backfill, no code
  change. Nothing in the design may hard-code the list of stages; read it from the setting
  everywhere, including the dashboard funnel's columns.


---

# Settings consolidation — `extended_warranty.enabled`

Added after the feature shipped. The add-on was gated by **two** `app_setting` rows —
16 `extended_warranty_notifications_enabled` (a bare boolean) and 17 `extended_warranty`
(the config object). Both belong to the same feature and are always provisioned together,
so the flag becomes a field on the config row, and the config row moves to **id 16** so the
numbering stays contiguous.

This does **not** touch `whatsapp_notifications.EXTENDED_WARRANTY` (row 15). That one
answers "may a message go out"; this one answers "does this tenant have the add-on". They
keep separate lifecycles — an operator pausing sends must not also hide the screen and its
lead queue — so the two-switch design is unchanged. Only *where the visibility switch is
stored* moves.

Two gains beyond tidiness:

1. **One fewer settings round trip.** `send_ew_reminders` issues **three** separate
   `GET_APP_SETTING_BY_KEY` queries before doing any work — `_is_ew_feature_enabled`,
   `_is_event_enabled`, `get_ew_settings` (`sender.py:1330/1332/1335`), unbatched and
   uncached. After the merge the `enabled` check comes free off the row `get_ew_settings`
   already fetches.
2. **A safer editing surface.** The generic App Settings editor is not type-aware:
   `detectMode` (`edit-app-setting-dialog.tsx:58-61`) sends objects to a raw JSON textarea
   and everything else — booleans included — to a plain text Input. So the flag is edited
   today by typing the word `true` into a textbox, and a typo (`ture`) saves as the JSON
   string `"ture"`, which `_is_ew_feature_enabled` reads as disabled. Silently. Moving the
   switch into the config row is the occasion to give that row its own dialog.

**Constraints confirmed before planning this:**

- **Nothing references `app_setting.id`** — no FK, no code path, no SQL. Every reader looks
  up `setting_key`; the edit dialogs pass through whatever `record.id` they were handed.
  `id` is a plain `smallint NOT NULL`, not an identity column. That is what makes the
  renumber safe.
- **The reader must fail closed.** A missing key, a non-object value or a missing row all
  mean disabled — as `_is_event_enabled` (`sender.py:140-152`) already does.
- **`edit-whatsapp-notifications-dialog.tsx` writes the whole object**
  (`JSON.stringify(value)`, line 94) and drops any key its field list does not know about.
  A cloned dialog must round-trip every key, or saving it would silently delete settings.
- **`auto_send_enabled` is read by nothing** — it exists in `_EW_DEFAULT_SETTINGS`
  (`sender.py:1137`), the seed and a TS type, with no consumer. `app/scheduler.py` is the
  stock-snapshot job only. Its switch stays inert until Step 9 is built.

### Step S1 — Migration — ✅ DONE (applied and verified 2026-09-11)

`service-plus-server/scripts/ew_enabled_merge.sql`, applied to all three live schemas —
`service_plus_demo.demo1`, `service_plus_capitalgroup.capitalelectronics` and
`.navtechnology`. Verified: the flag row is gone, `extended_warranty` sits at id 16 in each,
carries a boolean `enabled`, retains all eight config keys with no strays, and `demo1`'s
already-on switch survived as `true`. `app_setting` ids run 1..16 with no gaps.
No schema dump regeneration was needed — the dumps are `--schema-only`, and this migration
changed no DDL. `ew_delta.sql` was left alone for the data move. Idempotent, ordered so id 16 is
freed before it is reclaimed, and it **preserves a switch the owner already turned on**:

```sql
-- 1. Carry the flag's value into the config object.
UPDATE app_setting t
SET setting_value = t.setting_value || jsonb_build_object('enabled', f.setting_value),
    updated_at    = now()
FROM app_setting f
WHERE t.setting_key = 'extended_warranty'
  AND f.setting_key = 'extended_warranty_notifications_enabled'
  AND jsonb_typeof(t.setting_value) = 'object'
  AND jsonb_typeof(f.setting_value) = 'boolean'
  AND NOT (t.setting_value ? 'enabled');

-- 2. Default the key in where the flag row was absent, or its value was corrupted to a
--    string by the old free-text editor. Fail closed: absent means off.
UPDATE app_setting
SET setting_value = setting_value || '{"enabled": false}'::jsonb,
    updated_at    = now()
WHERE setting_key = 'extended_warranty'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT (setting_value ? 'enabled');

-- 3. Drop the old flag row. This frees id 16.
DELETE FROM app_setting WHERE setting_key = 'extended_warranty_notifications_enabled';

-- 4. Close the gap — extended_warranty takes id 16. The NOT EXISTS keeps this idempotent
--    and safe: if 16 is somehow still occupied it no-ops instead of raising on the pkey.
UPDATE app_setting
SET id = 16, updated_at = now()
WHERE setting_key = 'extended_warranty'
  AND id <> 16
  AND NOT EXISTS (SELECT 1 FROM app_setting a WHERE a.id = 16);
```

Run once per BU schema via `search_path`, template schema first:

```bash
psql "<conn>" -c "SET search_path TO demo1;" -f scripts/ew_enabled_merge.sql
```

Then regenerate dumps with `app/db/tools/extract_schema.py`, and **verify per schema** —
the renumber is the one statement that can no-op:

```sql
SELECT id, setting_key, setting_value FROM app_setting WHERE id >= 15 ORDER BY id;
-- expect exactly: 15 whatsapp_notifications, 16 extended_warranty (carrying "enabled")
```

### Step S2 — Seeds, so a new BU arrives correct — ✅ DONE

- `app/db/seeds/seed_bu_data.py:234-235` — delete the flag tuple; renumber the
  `extended_warranty` tuple to **16**, add `"enabled": false`, update its description.
  Keys alphabetical: `auto_send_enabled`, `contact_phone`, `daily_send_cap`, `enabled`,
  `notify_email`, `reminder_days_before`, `staff_whatsapp_number`, `whatsapp_number`.
- `app/db/sql/sql_bu_admin_ddl.py` — **no change needed.** It carries the `app_setting`
  *table* DDL only; the seed rows live solely in `seed_bu_data.py`.
- `scripts/ew_delta.sql` — update the comment block, drop the flag insert, and move the
  config row to id 16, so a schema migrated from scratch lands directly in the new shape.
  It is re-runnable and must not reintroduce the flag row.

The seed inserts use `ON CONFLICT (id) DO NOTHING` and run only for a **new** BU, so the
changed meaning of id 16 cannot collide with a migrated schema — but the seed and the delta
must agree on the number, or a new BU and a migrated one will disagree.

### Step S3 — Server read path — ✅ DONE

`_is_ew_feature_enabled` is now **synchronous and query-free** — it takes the settings row
`get_ew_settings` already returned and reads `enabled` off it with strict `is True`, so a
missing key, a non-bool, or the string `"true"` left by the old free-text editor all read
as off. `_EW_DEFAULT_SETTINGS` gained `"enabled": False`, keeping the merged-defaults path
fail-closed for an unmigrated schema.

`send_ew_reminders` now fetches the settings row **before** the two switch checks and reads
the flag from it, dropping one of the three `GET_APP_SETTING_BY_KEY` round trips.

### Step S4 — Client read path — ✅ DONE

`client-layout.tsx:224-227` reads the scalar row today; it must read the
`extended_warranty` row and take `.enabled`, keeping the existing string-or-object
tolerance.

The Redux action `setExtendedWarrantyNotificationsEnabled`, the `context-slice` field and
the selector keep their names — they describe intent, not storage — so the three consumers
(`client-top-nav.tsx`, `client-explorer-panel.tsx`, `use-notifications-summary.ts`) and
`custom-menu-registry.ts:36` need **no change at all**.

### Step S5 — New App Settings dialog — ✅ DONE

New `configurations/app-settings/edit-extended-warranty-dialog.tsx`, modelled on
`edit-whatsapp-notifications-dialog.tsx` in the same folder: same
`{ open, record, onOpenChange, onSuccess }` props, same fail-closed JSONB parse with
defaults, same `genericUpdate` write against `tableName: "app_setting"` — no new SQL id, no
new resolver, no server change. Branch to it from `app-settings-section.tsx:284-300`,
beside the existing `setting_key === "whatsapp_notifications"` branch.

Fields, in the order the owner reads them:

| Field | Control | Notes |
|---|---|---|
| Enabled | Switch | Shows the Custom → Extended Warranty menu. Note that sending also needs `whatsapp_notifications → Extended Warranty` |
| Auto send | Switch | `auto_send_enabled`. **Inert** until Step 9 — omit it, or label it as not yet in effect. Do not ship a switch that looks live and is not |
| Reminder days before | list editor | `[30, 7, 0]`; positive integers, de-duplicated, sorted descending on save, never empty |
| Daily send cap | number | non-negative |
| Contact phone / WhatsApp number / Staff WhatsApp number | text | reuse the mobile helper in `lib/`, not a new regex |
| Notify email | text | optional, validated when non-empty |

**The save must preserve unknown keys.** The cloned pattern serialises the whole object, so
build the payload by spreading the parsed original and overwriting known fields — never
from the field list alone.

### Step S6 — Docs — ✅ DONE

- `help-content.ts:1343` — delete the `extended_warranty_notifications_enabled` row from
  the App Settings table; fold its description into the `extended_warranty` row below it.
- `help-content.ts:1366` and `:1384` — repoint both to
  "Configurations → App Settings → extended_warranty → Enabled".
- Add a paragraph noting `extended_warranty` now opens its own dialog, mirroring the
  existing "Turning WhatsApp messages on or off" paragraph.

### Verification

1. `pnpm exec tsc -b --noEmit` and `pnpm build`; `pnpm format` on touched client files.
   (`pnpm lint` is broken repo-wide on TS 7 — not a signal.)
2. `python -c "import app.main"` on the server.
3. Apply the delta to a scratch schema: flag row gone, `extended_warranty` at id **16**
   carrying `enabled`, an owner-flipped `true` survived. Re-run — nothing changes.
4. With `enabled` false the Custom tab is absent and the bell does not query
   `COUNT_EW_NEW_INTEREST`; flip it in the new dialog and both appear after reload.
5. Save the new dialog and re-open it — every field round-trips, no key dropped.
6. A send is still blocked until `whatsapp_notifications.EXTENDED_WARRANTY` is also on.

### Watch-outs

- **Breaking settings change with no dual-read period.** The moment client and server ship,
  a schema that has not run the migration reports the add-on disabled — fails closed, so no
  wrong messages go out, but the menu vanishes until the delta runs. Ship the migration
  first, or accept that window.
- **Verify the renumber per schema.** Statements 1-3 always apply; statement 4 is the only
  one that can no-op silently, by design, to avoid a pkey error. A schema left at id 17
  still works — nothing reads the id — but its numbering has drifted from the seed.
- Noticed while planning, out of scope here: `is_editable` is not enforced server-side, and
  `/client/custom/ew/:ref` has no flag guard, so the staff alert's deep link opens even when
  the add-on is switched off.
