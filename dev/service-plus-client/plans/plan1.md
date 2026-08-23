# WhatsApp Completion Messages — Execution Checklist

**Standalone.** Everything needed to build this is here. (`plans/plan.md` was the long
first draft — background reasoning only, and superseded in places. Nothing in it is
required.)

**Scope:** exactly one WhatsApp feature survives — the **Customer Connect** screen sends
a completion message to eligible customers, and delivery is tracked in the DB via Meta
webhooks. **Every other WhatsApp flow is deleted** from client and server.

---

## Fixed decisions

| Question | Decision |
|---|---|
| Platform | WhatsApp Cloud API, direct with Meta. No BSP. Code already calls `graph.facebook.com`. |
| Sender | One shared `phone_number_id` for all tenants, permanently. |
| Webhook → tenant | Central `whatsapp_message` outbox in the **control DB**, keyed on `wamid`. |
| "Success" means | **Delivered** (per webhook), not API-accepted. |
| Grouping | One message per **customer**, may cover several jobs. |
| Template | `job_completed_ready_for_pickup_v1`, category **Utility**. The only template. |
| Eligibility | `COMPLETED_OK` + `is_final = true` only. |
| Entry point | **Customer Connect only.** The two single-job buttons on the finalize screens go. |
| Feature flag | `WHATSAPP_FEATURE_ENABLED` removed entirely, not split. |
| Zero amount | Substitute `"No charge"`. |
| BU name | Truncate to fit the header budget. |
| Everything else | The three PDF flows (creation / delivery / receipt) are **deleted**, not kept. |

---

## What survives, what goes

**Survives — the whole feature:**

```
client   customer-connect/{section,grid,helpers,schema,send-messages-modal,send-results-dialog}
         send-whatsapp-completion.ts        (mutation wrapper)
         whatsapp-icon.tsx                  (menu + screen icon)
         graphql-map.ts → sendWhatsappCompletion
server   app/whatsapp/                      (new package, Phase 3)
         sendWhatsappCompletion resolver    (rewritten)
         app/routers/webhooks/              (new, Phase 4-5)
         SQL: GET_WHATSAPP_ELIGIBLE_JOBS_{COUNT,PAGED,IDS}
              GET_JOBS_FOR_WHATSAPP_COMPLETION, SET_JOB_WHATSAPP_NOTIFICATION
```

**Deleted — everything else.** Full file-by-file list in Phases 6b and 8.

---

## Phase 0 — Meta side, no code

1. **Permanent token.** Business Settings → Users → System Users → Add → assign the app
   with Full control → Generate new token → scopes `whatsapp_business_messaging` +
   `whatsapp_business_management` → expiry **Never**.
   *The token on the WhatsApp → API Setup page expires in 24 hours — do not use it.*
2. **Subscribe the WABA to the app:**
   ```bash
   curl -X POST "https://graph.facebook.com/v20.0/<WABA_ID>/subscribed_apps" \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```
   ✅ `GET /<WABA_ID>/subscribed_apps` lists your app.
   *Without this, sends work and no callback ever arrives.*
3. **Submit the template** (text below). Approval takes minutes to a day — do it first.
4. **Grab the App Secret:** App Settings → Basic.
5. **Invent a verify token** (any strong random string).

---

## Phase 1 — Configuration

Add to `.env.example` (placeholders only):

```bash
# --- WhatsApp Cloud API (Meta, direct) ---
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
# System User permanent token — NOT the 24h API Setup token
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_API_VERSION=v20.0
WHATSAPP_BASE_URL=https://graph.facebook.com
```

Extend `app/core/settings/whatsapp_settings.py` with `whatsapp_app_secret` and
`whatsapp_webhook_verify_token`. Retitle its docstring — it says "Business Solution
Provider (BSP)", which is wrong.

✅ Server boots, settings resolve.

---

## Phase 2 — Outbox table (control DB, `public` schema)

```sql
CREATE TABLE whatsapp_message (
    id                  bigserial PRIMARY KEY,
    wamid               text UNIQUE,
    db_name             text        NOT NULL,
    schema_name         text        NOT NULL,
    branch_id           bigint      NOT NULL,
    phone_number_id     text        NOT NULL,
    event_type          text        NOT NULL,
    template_name       text        NOT NULL,
    customer_contact_id bigint      NOT NULL,
    job_ids             bigint[]    NOT NULL,
    to_mobile           text        NOT NULL,
    status              text        NOT NULL DEFAULT 'PENDING',
    error_code          text,
    error_message       text,
    accepted_at         timestamptz,
    delivered_at        timestamptz,
    read_at             timestamptz,
    failed_at           timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_whatsapp_message_wamid  ON whatsapp_message (wamid);
CREATE INDEX ix_whatsapp_message_tenant ON whatsapp_message (db_name, schema_name, branch_id);
```

Status ladder — **never move backwards** (Meta reorders and retries):
`PENDING(0) < ACCEPTED(1) < SENT(2) < DELIVERED(3) < READ(4)`, `FAILED(9)` terminal.
A callback ranked `<=` the stored value → return 200, change nothing.

### Per-job counters — `job.whatsapp_notifications` (tenant DB)

Existing jsonb column, keyed by event. The webhook writes it; the Customer Connect grid
reads it via `getCompletionState()`. Keep the shape, change what the numbers **mean**:

```jsonc
{
  "JOB_COMPLETION": {
    "attempt_count": 2,             // sends attempted
    "success_count": 1,             // DELIVERED per webhook — not API-accepted
    "fail_count":    1,             // includes async webhook failures
    "last_wamid":    "wamid.HBg…",
    "last_status":   "DELIVERED",   // ACCEPTED|SENT|DELIVERED|READ|FAILED
    "last_sent_at":  "2026-08-23T…",
    "last_error":    null
  }
}
```

Written in two places, not one: `sender.py` records the **attempt** (`attempt_count`,
`last_wamid`, `ACCEPTED`) and the webhook **settles** the outcome (`success_count` /
`fail_count`, `last_status`, `last_error`). This replaces
`build_notification_update_args`, which did both at send time and counted an API 200 as
success.

The client type already matches — `customer-connect-schema.ts` →
`WhatsappCompletionState`. Add `attempt_count` and `last_wamid` to it.

✅ Insert/lookup/settle unit-tested against the control DB.

---

## Phase 2b — Completion SQL

`GET_JOBS_FOR_WHATSAPP_COMPLETION` must also return the template inputs:

- `JOIN branch b ON b.id = j.branch_id` → `b.name`, `b.phone`
- BU name from `security.bu WHERE lower(code) = <schema>` — one row per request, cache
  it, don't join per job

✅ Query returns all 7 template inputs.

---

## Phase 3 — Send path (`app/whatsapp/`)

New package: `client.py`, `templates.py`, `mobile.py`, `outbox.py`, `sender.py`.
Move the existing logic across under Cloud-API naming, minus everything document-related.

`TemplateSpec` — gains a text header, **loses `has_document`** (no PDF template exists
any more):

```python
@dataclass
class TemplateSpec:
    name: str
    language: str
    category: str              # "UTILITY"
    header_params: list[str]   # NEW
    body_params: list[str]     # renamed from `params`
```

`templates.py` holds **one** entry: `JOB_COMPLETION`. `client.py` carries `send_template`
only — **`upload_media()` is deleted** along with the document-header branch inside
`send_template`.

Send sequence:

1. Re-filter server-side — never trust the client's selection (`COMPLETED_OK`,
   `is_final`, correct branch).
2. Group by `customer_contact_id`.
3. **Insert the outbox row first** (`PENDING`), then POST.
4. On 200 → store `wamid`, set `ACCEPTED`, bump `attempt_count` on each job.
   On error → `FAILED` + `fail_count`, keeping the permanent/transient classification.
5. Return per-customer *dispatch* results — not delivery.

Keep `asyncio.Semaphore(5)`.

**Template parameter rules** — applied when building the send, so a bad value never
reaches Meta:

| Slot | Rule |
|---|---|
| Header `{{1}}` BU name | Truncate to fit the 60-char header (~40 usable). Cut at a word boundary. |
| `{{2}}` job numbers | Join up to 3, then `"…and N more"`. Single line. |
| `{{3}}` device | One job → device string; more than one → `"N items"`. Single line. |
| `{{5}}` amount | `SUM(amount) == 0` → the literal string **`"No charge"`**; otherwise `"₹2,450.00"` — symbol included in the value, not in the template. |
| all | Strip newlines/tabs, collapse 4+ spaces — Meta rejects the send otherwise. |

✅ Real send → outbox row shows `ACCEPTED` with a `wamid`.
✅ A zero-amount job renders "No charge", not "₹0.00".

---

## Phase 4 — Webhook verification

`GET /api/webhooks/whatsapp` — Meta sends
`?hub.mode=subscribe&hub.challenge=<n>&hub.verify_token=<token>`.

Respond **200 with the raw `hub.challenge` as plain text** (no JSON, no quotes) when the
token matches; `403` otherwise.

Callback URL: `https://<host>/api/webhooks/whatsapp`
Subscribe to fields: **`messages`** and **`phone_number_quality_update`**
Must be public HTTPS with a valid cert — use a tunnel for local dev.

✅ "Verify and Save" succeeds in the Meta dashboard.

---

## Phase 5 — Webhook receiver

`POST /api/webhooks/whatsapp`. Follow `website_router.py` (dedicated prefix, per-IP
`rate_limit`).

1. **Verify `X-Hub-Signature-256`** — HMAC-SHA256 of the **raw body** with the App
   Secret, compared using `secrets.compare_digest`. Read raw bytes before JSON parsing;
   re-serialized JSON will not match.
2. Parse **all** of `entry[].changes[].value.statuses[]` (Meta batches them). Ignore
   `changes[]` whose `field` isn't `messages`. Tolerate `value.messages[]` — inbound
   replies will arrive; log and drop, don't crash.
3. Look up `wamid` in the outbox → gives `db_name`, `schema_name`, `job_ids`.
4. Apply the status ladder; fan the outcome out to every job in `job_ids`.
5. **Always return 200 fast**, even on unknown `wamid` — a 500 buys an infinite retry
   loop. Log and move on.

The POST body you will be parsing:

```jsonc
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WABA_ID>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "91XXXXXXXXXX",
          "phone_number_id": "<PHONE_NUMBER_ID>"
        },
        "statuses": [{
          "id": "wamid.HBgMOTE5…",     // ← correlate on this
          "status": "delivered",        // sent | delivered | read | failed
          "timestamp": "1755941400",    // unix seconds
          "recipient_id": "91XXXXXXXXXX",
          "errors": [{                  // present only when status = failed
            "code": 131026,
            "title": "Message undeliverable"
          }]
        }]
      }
    }]
  }]
}
```

**Error codes.** Permanent (do not retry, mark the job failed): `131026` (not on
WhatsApp / undeliverable), `131047` (re-engagement required — outside the 24h window),
and the `132xxx` family (template rejected or mismatched — usually the `en`/`en_US`
trap). Retryable: `131048` (rate limit — you hit the shared 24h cap, §Watch-outs).

✅ Real send reaches `DELIVERED`; job jsonb reflects it.
✅ A duplicate callback replayed twice changes nothing the second time.

---

## Phase 6 — Client, Customer Connect

`src/features/client/components/jobs/customer-connect/`

1. **Selection rule** — `customer-connect-section.tsx:90`. Any prior attempt unselects
   the row, not just a successful one:
   ```ts
   const s = getCompletionState(row);
   if (isRowSelectable(row) && ((s?.success_count ?? 0) + (s?.fail_count ?? 0)) === 0)
   ```
2. **Permanent banner** — replace the auto-dismissing `sonner` toast with a dismissible
   banner above the grid (`components/ui/alert.tsx`). Two stages:
   *"12 dispatched to 9 customers. Awaiting delivery confirmation…"* →
   *"9 delivered · 2 pending · 1 failed"*.
3. **Poll for async outcomes** — after a send, re-run the paged query every ~5s for
   ~2 min, then stop and leave the manual Refresh button.
4. Consider a `Delivery` column showing `last_status`.

✅ End-to-end on one job.

---

## Phase 6b — Delete every other WhatsApp flow (client)

Its own commit, after Phase 6. **28 flag sites across 10 files**, plus the document
flows entirely.

### Delete these files outright

| File | Why |
|---|---|
| `src/lib/whatsapp-service.ts` | Contains only the flag, the document types, and `sendWhatsappDocument`. Nothing survives — delete the file, not its contents. |
| `src/features/client/components/jobs/use-whatsapp-send.ts` | The shared hook for the four PDF buttons. No remaining callers. |

### Remove the button + handler from each host

| File | Remove |
|---|---|
| `single-job/single-job-section.tsx` | `useWhatsappSend`, `getJobSheetPdfBlob` import, the `JOB_CREATION` send handler, the button |
| `single-job/single-job-quick-info-card.tsx` | Whatsapp button + its props |
| `single-job/new-single-job-form.tsx` | `onWhatsapp` / `isSendingWhatsapp` props and the chain that threads them down |
| `batch-job/batch-job-section.tsx` | `useWhatsappSend`, `getBatchJobSheetPdfBlob` import, `handleSendWhatsappBatch`, the button |
| `batch-job/batch-job-view-modal.tsx` | Whatsapp button |
| `batch-job/batch-job-quick-info-card.tsx` | Whatsapp button |
| `deliver-job/delivery-modal.tsx` | `useWhatsappSend` |
| `deliver-job/delivery-modal-invoices-section.tsx` | Whatsapp button |
| `receipts/receipts-section.tsx` | `useWhatsappSend`, the button, the `paymentId &&` send branch |
| `final-a-job/final-job-form.tsx` | Whatsapp button |
| `final-a-job/final-a-job-section.tsx:831` | `sendWhatsappCompletion` call + import — per the Customer-Connect-only decision |
| `job-control/final-job-dialog.tsx:493` | `sendWhatsappCompletion` call + import — same |

### Then the now-dead leftovers

- `jobs/job-sheet-pdf.ts` — delete `getJobSheetPdfBlob` and `getBatchJobSheetPdfBlob`.
  Both exist solely for the WhatsApp PDF send (their own comments say so) and have no
  other caller. **Keep** `getJobSheetBlobUrl`, `getBatchJobSheetBlobUrl`,
  `getJobInfoBlobUrl` — those drive print/preview.
- `src/constants/messages.ts` — delete `INFO_WHATSAPP_COMING_SOON` (dies with the flag)
  and `INFO_WHATSAPP_NOT_CONFIGURED` (already 0 uses). Then re-check
  `INFO_WHATSAPP_NO_MOBILE`: its 9 uses are all in deleted buttons, so it should drop to
  0 — delete it if so.
  **Keep** `ERROR_WHATSAPP_SEND_FAILED`, `ERROR_WHATSAPP_JOBS_LOAD_FAILED`,
  `INFO_WHATSAPP_NO_ELIGIBLE_JOBS`, `SUCCESS_WHATSAPP_SENT`,
  `WARN_WHATSAPP_PARTIAL_SEND` — Customer Connect uses all five.
- **Keep** `components/shared/whatsapp-icon.tsx` — the explorer panel and the Customer
  Connect header both render it.
- Help text: `features/client/components/help/help-content.ts` and
  `features/super-admin/components/help/dev-help-content.ts` both document the removed
  flows at length (the dev entry names `whatsapp_router`, `sendWhatsappDocument`,
  `use-whatsapp-send`, `GET_JOBS_FOR_WHATSAPP_SEND`). Rewrite both to describe only
  Customer Connect + webhooks.

✅ `grep -rn "WHATSAPP_FEATURE_ENABLED\|sendWhatsappDocument\|useWhatsappSend" src`
returns nothing.
✅ `tsc --noEmit` clean. (ESLint can't run — see Watch-outs.)

---

## Phase 7 — Narrow eligibility

In `app/db/sql/sql_jobs.py` — all three eligibility queries
(`GET_WHATSAPP_ELIGIBLE_JOBS_COUNT`, `..._PAGED`, `..._JOB_IDS`):

```sql
-- replace
AND j.is_final  = true
AND j.is_closed = false
AND js.code NOT IN ('CANCELLED', 'DISPOSED')
-- with
AND j.is_final = true
AND js.code    = 'COMPLETED_OK'
```

`GET_JOBS_FOR_WHATSAPP_COMPLETION` (the server-side re-filter) gets the same
`js.code = 'COMPLETED_OK'` condition — it currently checks only `is_final`.

Keeping `is_final = true` alongside the code is deliberate belt-and-braces: it catches
rows where status and flag have drifted apart.

**Expect the grid to shrink.** Jobs at `RETURN` are visible today and will disappear.

✅ Grid shows only `COMPLETED_OK`; a `RETURN` job is rejected by the resolver too.

---

## Phase 8 — Delete every other WhatsApp flow (server)

### Delete outright

| Path | Note |
|---|---|
| `app/routers/notifications/whatsapp_router.py` | The whole PDF REST endpoint |
| `app/notifications/whatsapp_client.py` | Superseded by `app/whatsapp/client.py` |
| `app/notifications/whatsapp_helpers.py` | Superseded by `app/whatsapp/mobile.py` + outbox |
| `app/notifications/whatsapp_templates.py` | Superseded by `app/whatsapp/templates.py` |
| `app/graphql/resolvers/jobs/whatsapp.py` | Rewritten inside `app/whatsapp/sender.py` |

If `app/notifications/` and `app/routers/notifications/` are then empty, remove the
packages too.

### Edit

- `app/main.py` — drop the `whatsapp_router` import (line 19) and its
  `include_router` (line 81).
- `app/db/sql/sql_jobs.py` — delete `GET_JOBS_FOR_WHATSAPP_SEND`; its only caller was
  the REST router. **Keep** `SET_JOB_WHATSAPP_NOTIFICATION` and
  `GET_JOBS_FOR_WHATSAPP_COMPLETION`.
- Templates: `JOB_CREATION`, `JOB_DELIVERY`, `JOB_RECEIPT` do not carry over into
  `app/whatsapp/templates.py`. Only `JOB_COMPLETION` does.

### Leave alone

`job.whatsapp_notifications` keeps its jsonb column and its `JOB_COMPLETION` key. The
three dead event keys may linger in existing rows — harmless, and a cleanup migration is
optional. Do **not** drop the column.

✅ `grep -rn "whatsapp" app` returns only `app/whatsapp/`, the webhook router,
`whatsapp_settings.py`, the completion SQL, and the resolver registration.
✅ Server boots; `sendWhatsappCompletion` still resolves.

---

## The template — submit in Phase 0

WhatsApp Manager → Account tools → Message templates → Create template.

- **Name:** `job_completed_ready_for_pickup_v1`
- **Category:** Utility
- **Language:** plain **English** (`en`). If you submit as English (US) it approves as
  `en_US` and every send fails — `templates.py` hardcodes `en`.

**Header** (type: Text):
```
Service Update from {{1}}
```

**Body:**
```
Hello {{1}},

Your service request is complete and your device is ready for collection.

Job No: {{2}}
Device: {{3}}
Branch: {{4}}
Amount Payable: {{5}}
Branch Contact: {{6}}

Please carry a copy of your job sheet when collecting the device.
```

**Footer:**
```
Thank you for choosing us.
```

**Buttons:** none. Phone/URL buttons are static per template, so one button can't carry
each branch's number.

| Slot | Value | Sample |
|---|---|---|
| Header `{{1}}` | BU name — `security.bu.name` | Kush Electronics |
| Body `{{1}}` | Customer name | Ramesh Kumar |
| Body `{{2}}` | Job number(s) | JOB-2026-00412 |
| Body `{{3}}` | Device details | Samsung / Refrigerator / RT28B |
| Body `{{4}}` | Branch name | Salt Lake |
| Body `{{5}}` | Amount **including ₹**, or `"No charge"` when zero | ₹2,450.00 |
| Body `{{6}}` | Branch phone | 033-4000-1234 |

The currency symbol lives **inside** `{{5}}`, not in the template text — otherwise a
zero-amount job renders `₹No charge`.

**Rules that will break sends if ignored:**

- Variable values must be **single-line** — no newlines, tabs, or 4+ consecutive spaces.
- Header is 60 chars total; the prefix eats 20, leaving ~40 for the BU name.
- Body ≤ 1024 chars after substitution; footer ≤ 60.
- Don't start or end the body with a variable.

**Multi-job message** (one customer, several jobs):
- `{{2}}` — join up to 3, then `"…and 2 more"`.
- `{{3}}` — one job → device string; more than one → `"3 items"`.

---

## Watch-outs

- **Quality rating is shared.** One tenant's bad data lowers the number's rating and
  every tenant's limits drop together. `phone_number_quality_update` is the early
  warning.
- **Messaging limits are one shared 24h bucket** across all tenants. Over-limit sends
  fail with `131048`.
- **Inbound replies can't be attributed** to a tenant and currently go nowhere.
- **Policy:** messaging for many client businesses from one WABA is the aggregator
  shape. Worth checking with Meta before a second client joins the shared number.
- **Removal is not reversible for free.** Phases 6b and 8 delete the creation, delivery
  and receipt sends outright. Bringing any of them back later means rebuilding the
  document path — `upload_media`, the document header, the PDF blob helpers and the REST
  endpoint — not flipping a flag. Confirm none is in active use before deleting.
- **ESLint is broken repo-wide** (`typescript-eslint` 8.67 vs TypeScript 7.0.2). Verify
  with `tsc --noEmit`.
