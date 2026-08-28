# WhatsApp job-intake receipt — design (not implemented yet)

## Goal

When a customer drops off a device (or a batch of devices) for repair, replace the printed
job slip with a WhatsApp notification, a web page, and an on-demand PDF:

```
WhatsApp: "50 items received — Receipt #1024"
    ↓ (tap "View Receipt")
Web page showing all 50 items, live status
    ↓ (tap "Download PDF")
PDF receipt
```

- **WhatsApp** — short, searchable acknowledgement. Primary notification.
- **Web receipt** — interactive record. Shows every item in the receipt and its current
  status, works for as long as the link is valid, and keeps working after delivery so
  the customer can pull it up any time later.
- **PDF** — formal downloadable/printable copy, generated from the web page. Mainly for
  corporate customers and multi-item drop-offs.

Applies uniformly to a single job and a batch: a single job is a "receipt of one."

## Naming: "Intake Receipt" ≠ Money Receipt

This app already has a "Receipt" — the Money Receipt issued on payment (`MR` prefix). The
new one is issued at drop-off, before any payment, and is not a new document type at all
(see below) — just call it "Intake Receipt" in UI copy/variable names so nobody confuses it
with a Money Receipt when both show up in a job's history.

## Receipt number = job number or batch number, nothing new to claim

No new numbering series. The receipt number *is* an existing number this app already
issues:

- **Single job** → the receipt number is that job's `job_no`.
- **Batch** → the receipt number is the batch's `batch_no` (already claimed atomically,
  once per batch, when the batch is created).

Nothing to claim, no new `document_type`/`document_sequence` row, no year-segment or
FY-rollover question — those only mattered for a dedicated series, which this doesn't need.

## Receipt link (the "View Receipt" token)

A stateless, signed token — no new table. Encodes `{db_name, schema, batch_no_or_job_id,
exp}`, HMAC-signed with a server secret. The server verifies the signature and expiry on
each request; nothing is stored, nothing needs revoking.

- **Long-lived, not short**: expire in ~2 years, not minutes/hours. This is a digital
  replacement for a paper receipt a customer might reasonably need a year later (warranty,
  accounting) — a short-lived link would defeat that. The data behind it is no more
  sensitive than what's already printed on the paper slip.
- **Stays valid after delivery.** The page's content naturally goes terminal (each item
  shows "Delivered") but access isn't cut off — a corporate customer is often *more* likely
  to want the PDF once the job is done, not less.
- **Carries tenant identity**, so opening the link needs no company/branch picker — unlike
  the existing mobile-number "Track your repair" lookup, the token already knows which
  database/schema/receipt it points to.
- Base URL: the existing per-BU `track_job_url` app-setting (today just printed as text on
  job sheets) + `/receipt/{token}`, with `https://` prepended.

## Web receipt page (`service-plus-web`)

New route `app/receipt/[token]/page.tsx`, same "static export + plain `fetch`" pattern this
app already uses for its other public pages.

- **New public endpoint**: `GET /api/public/receipt/{token}` — verifies the token, resolves
  the receipt's jobs, returns whitelisted fields only (`receipt_no` — the job's `job_no` or
  the batch's `batch_no`, whichever the token points to — plus `receipt_date`,
  `customer_name`, `branch_name`, and per job: `job_no`, `device`, `status`) — no amounts,
  no internal ids, same rule this app's public routes already follow. Not filtered by job
  status, so it keeps working after delivery.
- **Page**: receipt number/date, customer/branch line, one row per item with live status,
  a "Download PDF" button.
- **PDF is generated client-side, in the customer's browser**, using the same `jsPDF`
  approach already used for job sheets internally — add `jspdf`/`jspdf-autotable` to
  `service-plus-web` and write a small builder fed by the public endpoint's fields.

## Data model

One `job.whatsapp_notifications` jsonb key, `JOB_CREATION`, alongside the existing
`JOB_COMPLETION` key — same shape (`attempt_count`, `success_count`, `fail_count`,
`last_wamid`, `last_sent_at`, `last_status`, `last_error`), written via a `jsonb_set` whose
key path is a parameter so one pair of SQL statements serves every event type instead of
one copy per type. The webhook's callback data gains an event code
(`db_name|schema|event_code|job_ids`, `JC` for `JOB_CREATION`, `CC` for `JOB_COMPLETION`)
so an incoming delivery status routes back to the right key. A batch send updates every job
in the batch, not just the first.

## Server design (`dev/service-plus-server`)

- **Token issuance**: extend job creation (single and batch) to also issue the receipt
  token in the same transaction, keyed off the `job_id` (single) or `batch_no` (batch)
  already being returned today — no new number to claim, just sign a token over the id
  that already exists.
- **Public receipt endpoint**: `GET /api/public/receipt/{token}` as above.
- **WhatsApp send (default)**: plain GraphQL mutation (`job_ids`) — load job(s) + customer
  contact, re-filter server-side, reject invalid mobile, render `receipt_no` and an item
  count/device summary, send a text-plus-button template with the receipt link as the
  button's dynamic suffix, record the attempt under `event_key="JOB_CREATION"`.
- **Access right**: none new — the right that already gates job creation covers messaging
  about it.

## Client design (`dev/service-plus-client`)

- One shared hook (in-flight state, mobile validation, toast) driving a "WhatsApp" button
  at the existing job-creation call sites (`single-job-section.tsx`,
  `batch-job-section.tsx`/`batch-job-view-modal.tsx`, `job-details-modal.tsx`) — each just
  fires the mutation with the job id(s) already on hand.
- One shared status-indicator component (compact pill for grids, full cell for Job View),
  reading `whatsapp_notifications.JOB_CREATION`.
- Show the receipt number (`job_no` or `batch_no`) in the post-creation success toast, same
  as the job number is shown today.

## Optional: attach the PDF to the WhatsApp message too

Off by default, available as a staff-checked "Attach PDF" option at send time — mainly for
corporate/multi-item customers who want the file immediately rather than tapping through.

- Requires a **second** approved Meta template with a document header — an approved
  template's structure is fixed, so one template can't sometimes have a header and
  sometimes not.
- Mechanism: build the PDF client-side at send time (same job-sheet PDF builder already
  used for printing), upload the bytes to Meta's Media API to get a media id (a document
  header needs an uploaded id, not a public link — the PDF has no public URL to hand Meta),
  send the document-header template with that id. Needs a small multipart REST endpoint
  (binary payload doesn't fit a GraphQL mutation), mirroring this app's existing
  image-upload endpoint.
- Trade-off, why it's off by default: the full job-slip content ends up in the customer's
  WhatsApp media gallery indefinitely (same information already on the paper slip, but now
  persistent and forwardable) — acceptable as a deliberate choice, not as the default for
  every send.

## Meta templates — draft, for review before submission

**`job_intake_receipt_ack_v1`** (default): Utility, `en`, no header.
```
Hi {{customer_name}},

We've received {{item_summary}} for repair.

Receipt No: {{receipt_no}}
Branch: {{branch_name}}

Tap below to view your receipt and track status.
```
Footer: "Thank you for choosing us." One dynamic-URL button, "View Receipt", base URL the
approved `track_job_url` domain with the signed token as the dynamic suffix.
`item_summary` = `"1 item"` or `"{n} items"`.

**`job_intake_receipt_ack_with_pdf_v1`** (opt-in): identical body/footer/button, plus a Document
header (sample: a redacted job slip PDF).

Verify at submission time, against Meta's current docs: per-message length limits on a
dynamic URL suffix, and whether the button's base host needs pre-approval.

## Out of scope for this phase

SMS/email, a second BSP, an outbox/retry queue, per-message audit history beyond the
latest-state jsonb, and job-delivery/payment-receipt WhatsApp triggers.

## Verification

- A single job's receipt number matches its `job_no`; a batch's matches its `batch_no`.
- The WhatsApp message's "View Receipt" link opens the web page directly, no login, showing
  every item in that receipt.
- The web page and its PDF still work after every item is delivered.
- "Download PDF" matches what the public endpoint returned — no internal-only fields in it.
- A tampered or expired token is rejected cleanly, not a 500 or a partial-data leak.
- `whatsapp_notifications.JOB_CREATION` updates on send and resend without touching
  `JOB_COMPLETION` on the same row.
- A `JOB_CREATION` webhook callback routes to the right key; `JOB_COMPLETION` still works.
- "Attach PDF" sends the second template correctly and only when explicitly checked.
