# WhatsApp job-slip delivery — design (not implemented yet)

## Context

Today, when a customer drops off a device for repair, staff print a paper job slip.
The ask: send it via WhatsApp instead (or in addition), saving paper, with a
WhatsApp button everywhere the slip can currently be printed/previewed — including
inside the PDF preview modal itself — success/fail tracked per job without
disturbing the existing completion-message tracking, resendable, and extended to
batch jobs too. This document is the approach only; nothing has been implemented.

**This exact feature was built once before and later removed** — `plans/plan-whatsapp.md`
(still in this repo) is a complete historical spec/build-log for it, covering four
WhatsApp triggers (creation, completion, delivery, receipt). Completion survived as
today's Customer Connect feature; the other three — including job creation, what's
being asked for now — were deleted in the same cleanup that produced Customer
Connect's current single-template design. This plan reuses that prior design almost
entirely, scoped down to just the creation trigger, and adjusted for two things that
changed since: the `jsonb_set` self-healing convention this session established for
`whatsapp_notifications`, and Meta's current (2026) document-template mechanics,
verified fresh rather than assumed.

## The design question: text, PDF, or both

**Recommendation: PDF attached (as a WhatsApp document header) with a short text
body — not text-only, and "PDF-only" isn't actually an option WhatsApp offers.**

- A WhatsApp document-header template always carries body text alongside the
  document — there's no way to send a bare file with zero text in this API. So the
  real choice is just "does the header carry a document, or is there no header at
  all" — not a three-way choice.
- The stated goal is to **replace** the printed slip, not just notify that one was
  created. A text summary loses the slip's actual content (device condition notes,
  itemized terms, whatever else is on the real document) — it wouldn't functionally
  substitute for the paper version, undermining "save paper" as anything more than a
  notification feature.
- Verified via Meta's docs (2026): a document-header template's header type
  (DOCUMENT) is fixed at approval time via a *sample* PDF, but the **actual document
  is supplied dynamically per send** — exactly like a body `{{variable}}` — so one
  approved template serves every customer's own, different PDF. Confirmed high-
  confidence against Meta's own template-fundamentals and messages-reference pages.

### Delivery mechanism: upload the PDF bytes, don't link to it

Two ways to supply a document header at send time — a public `link` Meta fetches,
or an `id` from uploading the bytes to Meta's Media API first. **Use `id` upload.**
- The historical plan already concluded this ("a document link isn't usable here
  because the PDFs are generated client-side and there's no public, unauthenticated
  URL to hand the BSP") — still true today, and more clearly so: this session's
  research confirmed the internal file-server sits on a **private IP in production**
  (`192.168.15.85`) and is unreachable by Meta regardless of auth, and its own
  100 KB upload cap would be a problem anyway if it *were* reachable. (That cap is
  moot for this design either way — we're not routing through the file-server at
  all; the PDF goes server→Meta directly.)
- Independent of that constraint, `id` is also the direction both corroborating BSP
  sources (360dialog, Twilio) recommend over `link`, partly for reliability (Meta
  fetches a `link` fresh only if the URL changes — a fixed 10-minute cache otherwise,
  which risks staleness for anything link-based) and partly because it avoids the
  question of exposing a customer-specific PDF at any public URL at all, however
  briefly. Meta's own document-header size cap is 100 MB — a job slip is nowhere
  close, no constraint there.
- Net effect: the PDF never touches a public URL. It goes browser → our server
  (multipart, same trust boundary as every other authenticated upload in this app)
  → Meta's Media API (server-to-server, our own access token) → referenced by `id`
  in the send. This is the most private-by-default option available, and confirmed
  by research rather than assumed.

**One thing worth you personally checking, not a code question**: the job slip PDF's
own content (what `buildSingleJobSheetDoc` actually prints — device details, full
address if it's on there, cost estimate, etc.) will now sit in the customer's
WhatsApp media gallery indefinitely, which is more information than any of today's
WhatsApp texts carry. Worth a quick look at what's actually on the slip before
sending it verbatim — not a WhatsApp-specific risk, just newly relevant now that the
whole document leaves the building.

### Job-status link: worth doing, but a separate follow-up, not part of this phase

The prompt also asks whether to include a job-status-enquiry link in the same
message. Checked: there's no existing link that could safely go in a customer-facing
WhatsApp message today — the current job-status lookup
(`GET /api/public/job-status`, `website_router.py`) is gated by a static pre-shared
`X-Website-Key` meant only for `service-plus-web`'s own server-to-server calls, plus
mobile-number matching; there's no per-job, safely-embeddable token. Building that
(a signed/expiring per-job link) is real, separate scope — a new auth mechanism, not
a one-line addition — so it's better as its own follow-up than bundled into this
phase. This phase's message includes the job number as the natural reference if a
customer wants to enquire by phone/in person, same as the paper slip today.

## Data model — reuses this session's established convention, generalized

`job.whatsapp_notifications` gets a **second key**, `JOB_CREATION`, sibling to the
existing `JOB_COMPLETION` — same shape (`attempt_count`, `success_count`,
`fail_count`, `last_wamid`, `last_sent_at`, `last_status`, `last_error`), written by
the same single-level-`jsonb_set`-with-`jsonb_typeof`-guard pattern
`SET_JOB_WHATSAPP_ATTEMPT`/`SET_JOB_WHATSAPP_OUTCOME` already use — which is exactly
"without disturbing other data in the column," since each key is built and attached
independently.

**Rather than duplicating those two SQL queries for a second key**, generalize them:
`jsonb_set`'s path argument is an ordinary `text[]`, so the hardcoded `'{JOB_COMPLETION}'`
path literal becomes a parameter (`ARRAY[%(event_key)s]::text[]`) and both
`_persist_attempt`-equivalents pass `event_key="JOB_CREATION"` or `"JOB_COMPLETION"`.
One pair of SQL constants serves both event types instead of two near-identical
copies.

The webhook side needs the event key too, to know which key to settle on outcome.
`biz_opaque_callback_data`'s format extends from `db_name|schema|job_ids` to
`db_name|schema|event_code|job_ids` — a short 2-character code (`CC` for
JOB_COMPLETION, `JC` for JOB_CREATION) rather than the full key name, to keep the
byte budget close to what it already was (still comfortably under the 35-job cap's
margin).

## Server design (`dev/service-plus-server` — never `deployment/`)

- **`app/whatsapp/client.py`**: add `upload_media(pdf_bytes: bytes, filename: str) -> str`
  (POST `{base_url}/{api_version}/{phone_number_id}/media`, multipart, returns the
  media id) and extend `send_template` to build a `document` header component
  (`{"type": "header", "parameters": [{"type": "document", "document": {"id": media_id}}]}`)
  when the template calls for one, alongside the existing text-header/body path.
- **`app/whatsapp/templates.py`**: `TemplateSpec` gains a header-kind flag (the old
  design's `has_document: bool` is the right shape); add `TEMPLATES["JOB_CREATION"]`
  once the template below is approved.
- **New**: a job-slip send function (own module or a new function in `sender.py`) —
  load job(s) + customer contact, re-filter server-side (never trust client
  selection), reject if mobile is invalid, `upload_media`, `send_template` with the
  document header + body params (job_no/device joined for a batch, same
  `_format_job_no`/`_format_device`-style helpers already in `sender.py`), persist
  the attempt under `event_key="JOB_CREATION"`.
- **New REST router** (multipart doesn't fit a GraphQL mutation envelope — same
  reasoning as `image_router.py`, the existing precedent for a binary-upload REST
  endpoint in this codebase): `POST /api/notifications/whatsapp/job-slip`,
  `Depends(get_current_user)` auth (db_name/schema resolved from the authenticated
  session the same way `image_router.py` does it — not taken as raw client-supplied
  form fields, which would let a client claim any tenant). Fields: `pdf` (file),
  `job_ids` (repeated int — plural even for a single job, matching the batch case
  uniformly), `branch_id`. For more than one `job_id`, reject with 4xx unless every
  job shares one `customer_contact_id` (a batch send is still one message, one PDF,
  one customer — mirrors the existing batch-print assumption).
- **Webhook router**: `_decode_callback_data` gains the event-code segment; outcome
  settlement passes the decoded `event_key` through to the generalized
  `SET_JOB_WHATSAPP_OUTCOME`.
- **Access right**: none new. Whatever access right already gates job creation
  (`single-job-section.tsx`/`batch-job-section.tsx`) already implies being allowed
  to message about that job — matches the historical design's own reasoning, and
  keeps this from needing its own `ACCESS_RIGHTS` entry the way Customer Connect did
  (Customer Connect needed one because it's a *bulk* screen with its own blast
  radius; a single-job resend button doesn't have that shape).

## Client design (`dev/service-plus-client`)

- **`job-sheet-pdf.ts`**: add `getJobSheetPdfBlob`/`getBatchJobSheetPdfBlob` —
  sibling exports calling the same private `buildSingleJobSheetDoc`/
  `buildBatchJobSheetDoc` builders but returning `doc.output("blob")` (a real
  `Blob`) instead of the existing exports' `"bloburl"` string. This exact gotcha
  (`bloburl` can't be POSTed as multipart) was already hit and fixed once in the
  historical build — re-derived here rather than re-discovered by trial and error.
  The existing Print-button exports are untouched.
- **New `src/lib/whatsapp-job-slip-service.ts`**: REST fetch wrapper mirroring
  `image-service.ts`'s upload pattern (fresh-token refresh, `FormData`, `res.ok`
  check) — not the Apollo client, this call bypasses GraphQL same as the image
  upload does.
- **New shared hook** (`jobs/use-whatsapp-job-slip-send.ts`): in-flight-key state +
  `isValidMobile` guard + toast success/failure, mirroring the pattern
  `use-whatsapp-send.ts` used before removal, so every call site doesn't repeat it.
- **New shared indicator component**, generalized from `customer-connect-grid.tsx`'s
  `WhatsappStatusCell` — same visual language (WhatsApp-green success pill, red fail
  pill, blue "last try", status-ladder badge) but taking a plain
  `state: WhatsappCompletionState | null` prop instead of a Customer-Connect-specific
  row type, plus a `compact` mode (a single small pill + tooltip, for the general
  jobs grid where a full stacked cell would crowd an already-dense row) vs. `full`
  mode (the existing stacked layout, for the Job View modal). Built as a new
  component, not a refactor of `WhatsappStatusCell` itself — keeps this change from
  touching Customer Connect's already-working code.
- **Buttons added, each reusing the existing print-button's already-loaded data —
  no new fetch needed at any site**:
  - `job-details-modal.tsx` — Actions row, sibling to the existing "Job Sheet" button.
  - `single-job-section.tsx` — sibling to the quick-info card's "Print" button, and
    the jobs-list row dropdown's "Print PDF" item.
  - `batch-job-section.tsx` — `BatchJobQuickInfoCard` and `BatchGroupRow`'s dropdown,
    sibling to their "Print PDF"/"Print All" actions; `batch-job-view-modal.tsx`
    likewise.
  - `pdf-preview-modal.tsx` (shared component) — a new optional prop (e.g.
    `onSendWhatsapp`) that renders a WhatsApp button in the modal footer only when
    the caller opts in — so "Job Info"/"Del. Note" previews don't get a button that
    doesn't make sense for them, only the actual job-slip preview does.
- **Jobs grid** (`job-pipeline-status-drilldown.tsx`): add the `compact` indicator
  into the existing badge-cluster-under-Status pattern (where `FINAL`/`GST`/
  `Invoice: Posted` pills already live). Needs the grid's underlying SQL query
  extended to select `whatsapp_notifications` if it doesn't already (verify at
  implementation time — Customer Connect's dedicated query selects it, but this is
  a different, general-purpose jobs query).
- **Job View modal**: `full` indicator alongside the header badge row or the Actions
  row.

## Meta template — draft, for you to review before submission

- **Name**: `job_slip_ready_v1` (not reusing the old `job_creation_v1` name in case
  that submission still exists/was rejected on Meta's side).
- **Category**: Utility. Confirmed a document header doesn't change category/review
  mechanics — categorization is content/intent-based, not structural.
- **Language**: `en`.
- **Header**: Document (sample: a redacted/representative job slip PDF).
- **Body** (named params, single-line values, same sanitize/format conventions as
  the completion template):
  ```
  Hi {{customer_name}},

  We've received your device for repair. Your job slip is attached — please keep it
  for your records and bring it when you collect your device.

  Job No: {{job_no}}
  Device: {{device}}
  Branch: {{branch_name}}
  ```
- **Footer**: `Thank you for choosing us.`
- **Batch behavior**: `job_no` joins up to 3 then "…and N more" (reuse the existing
  `_format_job_no` helper style); `device` becomes "N items" when the batch covers
  more than one (reuse `_format_device`'s style) — identical convention to the
  completion template, not a new one to learn.

## Explicitly out of scope for this phase

Same reasoning as the historical plan's own §8, still applicable: no SMS/email, no
second BSP, no outbox/retry queue (this stays synchronous, one request), no
per-message audit trail beyond the latest-state-per-key jsonb shape, no job-status
link (see above — real but separate follow-up), and job-delivery/job-receipt
WhatsApp sends (the historical plan's other two triggers) are not part of this ask
and aren't being restored here.

## Verification (once implemented)

- A single-job send with a valid mobile succeeds; `whatsapp_notifications.JOB_CREATION`
  updates without touching `JOB_COMPLETION` on the same row.
- A batch send (2+ jobs, one customer) produces exactly one message with one
  combined PDF, and every job in the batch gets its `JOB_CREATION` key updated, not
  just the first.
- Resending increments `attempt_count`/`success_count`/`fail_count` rather than
  overwriting history, same self-healing behavior already verified for
  `JOB_COMPLETION` this session.
- The webhook correctly routes a `JOB_CREATION`-tagged callback to the right event
  key, and a `JOB_COMPLETION`-tagged one still lands correctly too — the
  generalization doesn't regress the existing completion flow.
- Grid/Job-View indicators update live via the existing `whatsappDeliveryStatus`
  subscription infra, same persistent-subscription behavior fixed for Customer
  Connect this session (no 2-minute-window regression).
