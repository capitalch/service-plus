# WhatsApp Messaging Plan

Add WhatsApp send buttons at four points in a job's lifecycle, plus a bulk-send screen for the
completion message. WhatsApp only — no SMS, no email. One BSP (Business Solution Provider — assumed
Meta WhatsApp Cloud API below; swap the client module in §4c if the actual BSP differs). Sends are
**synchronous**: click a button, the server calls the BSP inline, the result comes back in the same
request. No queue, no outbox table, no background worker, no additional database tables — one new
`jsonb` column on `job` is the only schema change.

---

## 1. Scope

| # | Trigger | Where (client) | Message content |
|---|---|---|---|
| 1 | Job creation | `single-job-section.tsx` (single job) **and** `batch-job-section.tsx` / `batch-job-view-modal.tsx` (batch of jobs for one customer) | Job sheet **PDF** + short body (customer name, job no(s), branch) |
| 2 | Job completion / finalization | `final-job-form.tsx` (single job) **and** the new **Customer Connect** screen (many final jobs at once) | Charge-details **text only** — job no(s), amount due. No PDF. |
| 3 | Job delivery | `deliver-job-section.tsx` / `delivery-modal.tsx` | Invoice **PDF** + short body |
| 4 | Job Receipt creation + payment received | `receipts-section.tsx` | Job receipt **PDF** + payment details body (amount, mode, date) |

**Customer Connect** is a new screen under the `Jobs` menu (placed after "Deliver Job") listing every
job eligible for the completion message (`is_final = true`, `is_closed = false`, status not
cancelled/disposed), with a checkbox on every row (checked by default), select-all, search, and one
"Send Messages" button. Multiple jobs belonging to the same customer are grouped into **one message**,
never one message per job — this grouping is the reason the screen exists rather than just adding a
button to the existing job-control grid.

Everything else is out of scope for this build: SMS/email channels, multiple BSPs, a message-outbox
with retry/backoff, delivery/read-receipt webhooks, a Super-Admin UI for editing templates, and
per-message audit history. See §8 for the full list and the reasoning behind each cut.

---

## 2. Workflow

### 2a. Single/batch-job PDF send (creation / delivery / receipt — same shape for all three)

Job creation has two callers of this same flow: a single job (`single-job-section.tsx`) and a **batch**
of jobs for one customer (`batch-job-section.tsx` / `batch-job-view-modal.tsx`, the same grouping the
existing "Print PDF" / "Print All" batch action already uses via `getBatchJobSheetBlobUrl`). A batch
send is still **one** WhatsApp message with **one** combined PDF — never one message per job in the
batch — so `job_id` becomes `job_ids` (one or more) on the wire, and step f below updates every job in
the batch, not just the first.

```
STAFF (browser)                          SERVER (FastAPI)                    BSP (WhatsApp Cloud API)
────────────────                          ─────────────────                   ───────────────────────
Click "Whatsapp" next to
Print PDF / Print All (batch) / Invoice / Print Receipt
  │
  │ 1. Build PDF blob client-side
  │    (same builder the existing Print
  │    button already calls — single-job
  │    or batch builder, per caller)
  │
  │ 2. POST /notifications/whatsapp/send
  │    multipart: pdf, job_ids (one or more),
  │    event_type, db_name, schema
  ├────────────────────────────────────►
  │                                     a. Load job(s) + customer contact (mobile, name) — for a
  │                                        batch, all job_ids must share one customer_contact_id
  │                                     b. Reject with 4xx if mobile is missing/invalid
  │                                     c. Upload PDF bytes
  │                                        ├───────────────────────────►  POST /{phone_number_id}/media
  │                                        │◄──────────────────────────   media_id
  │                                     d. Look up template config for event_type,
  │                                        fill placeholders from job(s) + customer data
  │                                        (job_no becomes a comma-joined list for a batch)
  │                                     e. Send template message
  │                                        ├───────────────────────────►  POST /{phone_number_id}/messages
  │                                        │◄──────────────────────────   message id | error
  │                                     f. For every job_id in the request, UPDATE job SET
  │                                        whatsapp_notifications = jsonb_set(..., event_type key,
  │                                        success_count+1 or fail_count+1, now(), status)
  │◄────────────────────────────────────  { status: SENT | FAILED, error }
  │
Toast: success, or failure with the BSP's error message
Button re-enables; every affected row's "sent" badge reflects the new success/fail count
```

### 2b. Bulk completion send — Customer Connect

```
STAFF                                     SERVER
─────                                     ──────
Jobs → Customer Connect
  │ query the eligible-jobs grid (paged)
  ├────────────────────────────────────►  SQL over job + customer_contact,
  │◄────────────────────────────────────  filtered to is_final=true, is_closed=false,
  │                                       status not in (CANCELLED, DISPOSED)
Grid renders — every eligible row checked by default;
rows with no/invalid mobile are disabled with a tooltip reason
  │
Select rows (selection persists across pages/search) → click "Send Messages"
  │ mutation: sendWhatsappCompletion(branch_id, job_ids[])
  ├────────────────────────────────────►
  │                                     a. Load the jobs + customer_contact, re-filter to is_final=true
  │                                        (server never trusts the client's selection blindly)
  │                                     b. Group job_ids by customer_contact_id — the "one message
  │                                        per customer" rule is enforced here, not in the UI
  │                                     c. For each customer, concurrently (asyncio.gather under a
  │                                        small semaphore): render the body — e.g. "Job(s) JC-101,
  │                                        JC-102 ready for pickup. Amount due ₹450." — and send the
  │                                        JOB_COMPLETION template
  │                                     d. For every job touched, jsonb_set its whatsapp_notifications
  │◄────────────────────────────────────  { results: [{ customer_name, job_ids, status, error }, ...] }
  │
Results dialog lists success/fail per customer — no live progress bar, the call already returned
Grid reloads → "Msgs Sent" badges updated
```

**Why synchronous is acceptable here:** with `asyncio.gather` under a concurrency cap, even ~100
customers resolves in low seconds — well within a normal request timeout. If selections grow large
enough that this becomes a real problem, the fix is a background outbox with retry/backoff, which is a
bigger project deliberately not built now (§8).

---

## 3. Database change

**Status: ✅ done** — the column has been added to the tenant DDL, the schema dump was re-extracted, and
it's been hand-applied to live schemas.

One new column on `job`, added next to the existing `job` DDL (this table already has columns for
`customer_contact_id`, `amount numeric(12,2)`, `is_closed boolean`, `is_final boolean`, `job_status_id`,
`branch_id`; the mobile number itself lives on `customer_contact`, not on `job`):

```sql
ALTER TABLE job ADD COLUMN whatsapp_notifications jsonb NOT NULL DEFAULT '{}'::jsonb;
```

A `jsonb` column for this kind of free-form, evolving per-feature settings/state is an established
pattern elsewhere in the schema (e.g. `division.account_setting jsonb`), so this isn't a new idiom for
the codebase.

**Shape** — one key per event type, so a single column covers all four triggers. `success_count` and
`fail_count` are tracked separately, incrementing exactly one of the two on every attempt depending on
the BSP result:

```jsonc
{
  "JOB_CREATION":   { "success_count": 1, "fail_count": 0, "last_sent_at": "2026-08-10T10:00:00+05:30", "last_status": "SENT",   "last_error": null },
  "JOB_COMPLETION": { "success_count": 1, "fail_count": 1, "last_sent_at": "2026-08-10T11:05:00+05:30", "last_status": "SENT",   "last_error": null },
  "JOB_DELIVERY":   { "success_count": 0, "fail_count": 0, "last_sent_at": null,                        "last_status": null,     "last_error": null },
  "JOB_RECEIPT":    { "success_count": 0, "fail_count": 1, "last_sent_at": "2026-08-10T12:00:00+05:30", "last_status": "FAILED", "last_error": "Invalid mobile number" }
}
```

A missing key means "never attempted" — no migration needed to add a fifth event later, just start
writing a new key. Updated with `jsonb_set` in the same request that calls the BSP; there is no separate
audit table recording every individual send, only the latest state per event type per job. (The
original requirement named only the completion event for this tracking; this plan applies the same
column to all four events instead of tracking one and leaving three unaudited, since it's the same
`ALTER TABLE` either way — flagging this in case only completion-tracking was actually wanted.)

Re-extract the schema dump after this change and hand-apply the `ALTER TABLE` to any already-live
database schemas (there is no migration runner in this codebase — new DDL is applied at tenant
provisioning time, and existing schemas need the statement run by hand).

---

## 4. Server design

### 4a. Settings — the one BSP's account credentials

A new settings module, `app/core/settings/whatsapp_settings.py`, following the shape already used for
email settings elsewhere in `app/core/settings/` (a `pydantic_settings.BaseSettings` subclass reading
from `.env`):

```python
class WhatsappSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="WHATSAPP_", extra="ignore")
    api_version:      str = "v20.0"
    base_url:         str = "https://graph.facebook.com"
    phone_number_id:  str
    waba_id:          str
    access_token_env: str = "WHATSAPP_ACCESS_TOKEN"   # name of the env var holding the token — never the token value itself
```

Wire it into the app's settings chain alongside the existing settings classes.

### 4b. Templates — config file, not a database table

A plain Python dict, deployed like code, in `app/notifications/whatsapp_templates.py`. This is what
"template and account configuration lives at the server as config files" means concretely — no editor
UI, no database row; whoever deploys a template change is trusted to keep it in sync with what's
actually approved on the BSP side.

```python
@dataclass
class TemplateSpec:
    name: str            # BSP-approved template name
    language: str
    has_document: bool   # whether this template expects a document header (a PDF)
    params: list[str]    # ordered placeholder names, must match the approved template's slot count

TEMPLATES: dict[str, TemplateSpec] = {
    "JOB_CREATION":   TemplateSpec(name="job_creation_v1",   language="en", has_document=True,  params=["customer_name", "job_no", "branch_name"]),
    "JOB_COMPLETION": TemplateSpec(name="job_completion_v1", language="en", has_document=False, params=["customer_name", "job_nos", "amount"]),
    "JOB_DELIVERY":   TemplateSpec(name="job_delivery_v1",   language="en", has_document=True,  params=["customer_name", "job_no", "amount"]),
    "JOB_RECEIPT":    TemplateSpec(name="job_receipt_v1",    language="en", has_document=True,  params=["customer_name", "receipt_no", "amount", "payment_mode"]),
}
```

Each of these four templates must be pre-approved on the BSP side with a matching placeholder count
before this ships — approval turnaround is typically measured in days, so register and submit them
early, in parallel with the coding steps below.

### 4c. BSP client — one module, two functions

`app/notifications/whatsapp_client.py`. One BSP means there's no need for a provider-registry
abstraction — a single module is enough, and swapping to a different BSP later means editing this one
file, not redesigning a dispatch layer:

```python
async def upload_media(pdf_bytes: bytes, filename: str) -> str:
    """POST to the BSP's media endpoint, return the resulting media id."""

async def send_template(to: str, template: TemplateSpec, params: list[str], media_id: str | None) -> WhatsappSendResult:
    """POST a template message; media_id fills the document header when template.has_document."""
```

For Meta's WhatsApp Cloud API specifically: `send_template` POSTs to
`{base_url}/{api_version}/{phone_number_id}/messages` with `type: "template"` and
`components: [{type: "header", parameters: [{type: "document", document: {id: media_id}}]}, {type:
"body", parameters: [{type: "text", text: p} for p in params]}]` (header component omitted when
`has_document` is false). `upload_media` POSTs the raw bytes to
`{base_url}/{api_version}/{phone_number_id}/media` first — a document **link** isn't usable here
because the PDFs are generated client-side and there's no public, unauthenticated URL to hand the BSP;
uploading the bytes and referencing the returned media id is the only viable path.

`WhatsappSendResult` carries `ok`, `provider_message_id`, `error_code`, `error_message`, and a
`permanent: bool` flag (Meta's `131026`/`132xxx` error codes mean "don't bother retrying, the number or
template itself is bad") — used only to shape the toast/error text shown to staff, since there is no
retry queue to route a "retryable" result into.

### 4d. Text-only send path — `sendWhatsappCompletion`

A GraphQL mutation, using the app's standard mutation envelope (`db_name`, `schema`, plus a JSON
`value`):

```jsonc
// sendWhatsappCompletion
{ "branch_id": 1, "job_ids": [101, 102, 145] }
```

Server-side, in one request:
1. Load the jobs, join `customer_contact` for mobile/name, re-filter to `is_final = true` (never trust
   the client's selection as-is).
2. Group by `customer_contact_id`.
3. For each customer, concurrently (`asyncio.gather` under a small semaphore, a constant — no
   per-BSP rate-limit config table needed for a single BSP), call `send_template("JOB_COMPLETION",
   ...)` with the rendered body params.
4. For every job touched, `UPDATE job SET whatsapp_notifications = jsonb_set(...)`.
5. Return `{ "results": [{ "customer_name", "job_ids", "status": "SENT"|"FAILED", "error" }] }`
   directly in the mutation response.

This same mutation and grouping logic serves both the single-job "Whatsapp" button on the finalize
form (called with one job id) and the bulk Customer Connect screen (called with the full multi-select)
— one code path, two callers.

### 4e. Document send path — REST endpoint, not GraphQL

The other three triggers carry a PDF, and a binary payload doesn't fit a JSON mutation envelope well, so
these go through a plain REST endpoint instead: `app/routers/notifications/whatsapp_router.py`.

```
POST /notifications/whatsapp/send
  multipart form fields: pdf (file), job_ids (int, repeated — one for a single job, several for a
                          batch-job-creation send), event_type ("JOB_CREATION"|"JOB_DELIVERY"|"JOB_RECEIPT"),
                          db_name, schema
```

`job_ids` is plural on the wire even though `JOB_DELIVERY`/`JOB_RECEIPT` always send exactly one — only
`JOB_CREATION` from the batch-job screen sends more than one, keeping the endpoint shape uniform rather
than adding a second field just for that case.

Flow: load the job(s) + customer contact → for more than one `job_id`, reject with 4xx unless every job
shares the same `customer_contact_id` (a batch send is still one message to one customer) → reject if
mobile is missing/invalid → `upload_media(pdf_bytes)` → `send_template(...)` with the returned
`media_id`, rendering `job_no` as a comma-joined list when there's more than one job → for every
`job_id` in the request, `jsonb_set` that job's `whatsapp_notifications` for the event key → return
`{ "status": "SENT"|"FAILED", "error": ... }` synchronously. Mount this
router in the app's startup alongside the other REST routers (there's already precedent for a REST,
non-GraphQL upload endpoint used for image uploads — follow that same mounting pattern).

---

## 5. Client design

No new Redux slice — each screen owns its own local state for the send-in-flight/result UI. Every
button:
- Uses a `MessageCircle` icon and the label **"Whatsapp"**; enabled state is emerald, matching this
  codebase's existing "primary send/success action" color convention (emerald = send/success, amber =
  warning/ineligible, red = reserved for genuine errors only).
- Is **disabled with an explanatory tooltip** whenever the customer's mobile number fails validation
  (this codebase already has a mobile validator, `isValidMobile(value): boolean`, that normalizes and
  checks a 10-digit Indian mobile number, stripping a `+91`/`91` prefix — reuse it, don't rewrite it).
- Shows a spinner while its request is in flight (synchronous call, no progress modal needed) and a
  toast on completion — success, or failure with the BSP's error text.

### 5a. Job creation (single job and batch)

In `single-job-section.tsx`, add a "Whatsapp" button beside the existing "Print PDF" action. On click:
build the job-sheet PDF blob using the same builder function the Print button already calls (`getJobSheetBlobUrl`), then POST
it (multipart, via `fetch`, not the Apollo client — this call bypasses GraphQL) to
`/notifications/whatsapp/send` with `event_type=JOB_CREATION` and a single-element `job_ids`.

Batch job creation gets the same button, wired the same way, wherever the existing batch "Print PDF" /
"Print All" action already lives:
- `batch-job-section.tsx`'s `BatchGroupRow` — beside the row-level "Print PDF" action (mirrors
  `handlePrintBatch`).
- `batch-job-view-modal.tsx` — beside "Print All (N)".
- `batch-job-quick-info-card.tsx` — beside its "Print" action.

Each builds the combined batch PDF with the existing `getBatchJobSheetBlobUrl(batchJobs, ...)` builder
and POSTs it with `event_type=JOB_CREATION` and `job_ids` set to every job id in the batch — one
message, one PDF, one customer, exactly like the existing batch print flow already assumes (a batch is
always jobs for a single customer, so there's no cross-customer grouping question here the way there is
in Customer Connect).

### 5b. Job completion

In `final-job-form.tsx`, add a "Whatsapp" button beside the "Save & Mark Final" action. Calls
`sendWhatsappCompletion` (§4d) with the single job id — the same mutation the bulk screen uses. The
amount comes from data the form already has loaded; no new fetch needed.

### 5c. Job delivery

In the delivery flow (`deliver-job-section.tsx` / `delivery-modal.tsx`), add a "Whatsapp" button in the
invoice action row, for both the single-job deliver path and inside the bulk delivery modal. Builds the
invoice PDF via the existing invoice-PDF builder already used for printing, posts with
`event_type=JOB_DELIVERY`.

### 5d. Job Receipt + payment

In `receipts-section.tsx`, add a "Whatsapp" button next to the existing "Print Receipt" action, and —
since the trigger is "on creation of Job Receipt and payment received" — surface the same send as an
action button on the success toast right after Save (a deliberate follow-up click, not an automatic
silent send; sending should always be a staff decision). Reuses the existing receipt-PDF builder
already used for the Print Receipt button, posts with `event_type=JOB_RECEIPT`.

### 5e. Customer Connect screen

A new folder under the jobs feature area, `customer-connect/`:

| File | Role |
|---|---|
| `customer-connect-section.tsx` | Screen shell: toolbar, selection state, send orchestration |
| `customer-connect-schema.ts` | Types (row shape, send-result shape) |
| `customer-connect-helpers.ts` | Grouping-by-customer, mobile eligibility, page size constant |
| `customer-connect-grid.tsx` | Grid: checkbox column + the standard job columns |
| `send-messages-modal.tsx` | Pre-send confirmation: per-customer message preview, drop-a-customer |
| `send-results-dialog.tsx` | Post-send results: per-customer success/fail list |
| `send-whatsapp-completion.ts` | Mutation call wrapper |

**Grid columns:** `[☑] # Date Job No Customer Mobile Device Details Job Type Status Amount Msgs Sent
Actions`. "Msgs Sent" reads `success_count` (and `fail_count` when nonzero) out of
`whatsapp_notifications->'JOB_COMPLETION'` on each row, shown as a badge — a dash when both are zero,
otherwise the success count and last-sent date, with an amber warning icon when the last attempt failed
(tooltip shows the BSP error and the fail count).

**Selection rules:**
- Every eligible row starts checked.
- Rows already messaged start unchecked but remain selectable — a resend must be a deliberate click.
- Rows with no/invalid mobile are disabled and unchecked, muted styling, tooltip explaining why.
- Header checkbox toggles the current page (tri-state); a "select all N matching" link (backed by a
  separate ids-only query) extends selection beyond the current page.
- Selection is a `Set<number>` of job ids that survives paging and search changes, not page-local
  state — the Send button always reads "N jobs · M customers" computed from the full selection, so the
  one-message-per-customer promise is visible before the click.

**Toolbar:** icon + title + count, debounced search with a clear button, Refresh, and the Send button —
deliberately large, emerald, disabled with an explanatory tooltip when nothing is selected or WhatsApp
isn't configured.

Menu wiring: add a tree item under the Jobs explorer, icon `MessageCircle`, label "Customer Connect",
placed after "Deliver Job", gated by a new access right; add the matching case in the jobs page's
section switch.

---

## 6. Client infra plumbing

- **SQL map**: ids for the eligible-jobs paged query + count query, and an ids-only query used by
  "select all N matching".
- **GraphQL map**: `sendWhatsappCompletion`. (The three document sends are REST, not GraphQL, so they
  don't need an entry here.)
- **Messages constants**: a block for this feature — send-failed error, jobs-load-failed error,
  not-configured info message, no-eligible-jobs info message, no-mobile info message, send-succeeded
  success message, partial-send warning message.
- **Access rights**: one new right gating the Customer Connect menu item. The four inline buttons ride
  the existing access right for their host screen — being able to create/finalize/deliver/receipt a job
  already implies being allowed to message about it, so no new right per button.
- **Help content**: one new help article for Customer Connect (what the screen shows, why some rows are
  disabled, what "Msgs Sent" means, that this only covers the completion message), plus a short
  cross-link line added to the existing help text for each of the other three screens noting the new
  button.

---

## 7. Steps of execution

**Step 1 — Database ✅ done**
- 1.1. ✅ Add the `ALTER TABLE job ADD COLUMN whatsapp_notifications jsonb NOT NULL DEFAULT '{}'::jsonb;`
  statement to the tenant DDL. Re-extract the schema dump. Hand-apply to live schemas.

**Step 2 — Server core (no API surface yet, safe to build and merge independently)**
- 2.1. `whatsapp_settings.py` (§4a) and wire into the settings chain.
- 2.2. `whatsapp_templates.py` (§4b) with the four `TemplateSpec` entries.
- 2.3. `whatsapp_client.py` (§4c): `upload_media`, `send_template`, `WhatsappSendResult`.
- 2.4. In parallel with 2.1–2.3: register the WhatsApp Business number with the BSP and submit all four
  templates for approval — this has the longest lead time of anything in this plan.

**Step 3 — Server API**
- 3.1. `sendWhatsappCompletion` resolver (§4d): load + group + fan-out send + `jsonb_set` + return
  results. Update the GraphQL schema.
- 3.2. `whatsapp_router.py` REST endpoint (§4e), mounted at startup.

**Step 4 — Client infra**
- 4.1. Add the SQL-map ids, the GraphQL-map entry, the messages constants, and the access right (§6).

**Step 5 — The three inline PDF buttons (each independently shippable and testable)**
- 5.1. Job creation button (§5a) — single-job (`single-job-section.tsx`) and batch
  (`batch-job-section.tsx`, `batch-job-view-modal.tsx`, `batch-job-quick-info-card.tsx`).
- 5.2. Job delivery button (§5c).
- 5.3. Job Receipt button (§5d).

**Step 6 — Job completion**
- 6.1. Single-job "Whatsapp" button on the finalize form (§5b), calling the same mutation built in
  step 3.1.

**Step 7 — Customer Connect screen**
- 7.1. Grid + selection + send-results dialog (§5e).
- 7.2. Menu entry and page routing.

**Step 8 — Help and verification**
- 8.1. Help article + cross-link lines (§6).
- 8.2. Lint and build clean. Manual verification, per trigger:
  - A job with a valid mobile number sends successfully; the row's badge/jsonb `success_count`
    updates.
  - A job with an invalid/missing mobile disables the button with a tooltip, no request is made.
  - A forced BSP failure (e.g. a deliberately wrong template name) surfaces the BSP's error in the
    toast and in the grid's per-row warning, and increments `fail_count` rather than `success_count`.
  - Re-sending on the same job increments `success_count` or `fail_count` rather than erroring or
    overwriting history.
  - In Customer Connect, a 3-job selection where two jobs belong to the same customer sends exactly
    two messages, not three.
  - A batch job creation send (2+ jobs, one customer) produces exactly one WhatsApp message with one
    combined PDF, and every job in the batch has its `whatsapp_notifications` updated, not just the
    first.
  - Selection survives paging and search changes; "select all N matching" extends past the current
    page.
  - Responsive check at common mobile/tablet/desktop widths for the Customer Connect grid.

---

## 8. Explicitly out of scope, and why

| Not built | Why |
|---|---|
| SMS / email channels | Only WhatsApp is wanted this time; adding a `channel` column now for a future that may not come would be speculative generality |
| A second BSP / provider registry | Only one BSP is in use; a registry abstraction is premature until there's a second implementation to abstract over |
| Outbox table + background worker + retry/backoff | No new tables allowed, and nothing in this design needs multi-minute background processing — everything resolves inside one request |
| Live progress subscription / progress bar | Nothing runs long enough in the background to need a progress stream; the mutation's own response is the result |
| Delivery/read-receipt webhooks | Outbound-only messaging; no requirement to track whether a customer opened the message |
| Super-Admin template/provider editor UI | Templates and BSP account settings are config files deployed with the server, not database rows edited at runtime |
| Per-message audit trail / history drawer | There's no outbox table to log individual attempts against; only the latest state per event type per job is kept, in the `jsonb` column |
| Job-delivery message as a "later" phase | It's in scope from day one here (trigger #3), unlike designs that defer it |
| Per-customer opt-out, scheduled/automatic sending, per-tenant BSP credentials | None of these were requested; each is a small, additive change on top of this design if they come up later — an opt-out flag is one more eligibility check, per-tenant credentials is one more settings key, scheduled sending is one more caller of the same send functions |
