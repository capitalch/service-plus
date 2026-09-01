# Paperless Job Delivery via WhatsApp — Design (not implemented yet)

## Goal

Replace the printed **Delivery Note** and the printed **Invoice + Receipt**
with a WhatsApp message carrying a one-time confirmation code and two
on-demand PDFs — a **Delivery Note** (itemized list of every job delivered,
with device and serial number per job) and an **Invoice** (the formal
line-item bill, GST/tax breakdown included) — both served entirely by
`service-plus-server`. No dependency on `service-plus-web`. Third leg of the
existing WhatsApp rail — `JOB_CREATION` and `JOB_COMPLETION` already ship on
it; `JOB_DELIVERY` reuses the same send/track mechanism for a third event.

**One delivery is not one intake batch.** A single "Deliver Selected" action
can include jobs from several different intake `batch_no`s, plus individually
(non-batch) created jobs, all for one customer — delivery grouping is
independent of intake grouping. Nothing in this design may assume a delivery
shares one `batch_no`, the way an intake batch legitimately does.

## What already exists

```
server  app/whatsapp/{client.py, sender.py, templates.py, mobile.py, token.py}
            client.py    send_template() — text + URL buttons, no media/document
                         upload (client.py:62,78,98)
            sender.py    _EVENT_CODE_BY_KEY = {"JOB_COMPLETION":"CC","JOB_CREATION":"JC"}
                         (line 97); _is_event_enabled() (line 100) — per-BU
                         on/off gate from app_setting.whatsapp_notifications,
                         already has an unused JOB_DELIVERY slot
            token.py     sign()/verify() — HMAC-signed link token, reused
                         here only for the Delivery Note PDF link, unchanged
        app/routers/public/job_intake_router.py
            GET /job-intake/{token}, GET /job-intake/pdf/{token} — the
            pattern this design's PDF route copies
        app/routers/webhooks/whatsapp_webhook_router.py
            _EVENT_KEY_BY_CODE = {"CC":"JOB_COMPLETION","JC":"JOB_CREATION"} (line 103)
        app/db/sql/sql_jobs.py
            GET_JOBS_FOR_WHATSAPP_COMPLETION/_CREATION, SET_JOB_WHATSAPP_ATTEMPT/_OUTCOME
            (already event_key-parameterized)
        app/db/sql/sql_public.py    PublicSql.GET_JOB_INTAKE_STATUS (token-gated read)
        app/graphql/resolvers/mutation.py
            sendWhatsappCompletion (421) / sendWhatsappJobIntake (434) — no
            dedicated access-right guard; gated by the calling screen
        app/graphql/schema.graphql   lines 45-46 (Generic scalar)
        app/core/settings/whatsapp_settings.py
            whatsapp_link_token_secret (line 42) — dedicated secret per trust
            boundary; this design adds a sibling secret on the same principle
client  jobs/send-whatsapp-job-intake.ts        {results, disabled} wrapper pattern
        jobs/use-send-whatsapp-job-intake.tsx   confirms before sending (Yes/No,
                                                 default No) — same UX to reuse
        jobs/whatsapp-status-cell.tsx           generalized on an `eventKey` prop
        jobs/deliver-job/deliverable-jobs-grid.tsx
                                                 multi-select grid, "Deliver Selected (N)"
                                                 button, source query filtered on
                                                 is_final=true AND is_closed=false —
                                                 multi-job delivery is the normal path
                                                 here, not an edge case
        jobs/deliver-job/delivery-modal.tsx     isDelivered (line 328): job_status_code
                                                 ∈ {DELIVERED_OK, DELIVERED_NOT_OK};
                                                 isSingleJob (330); branchId in scope
                                                 (505, 792); "Delivery Note" button
                                                 disabled state at line 1134
        jobs/batch-warranty-transactions/*      "Jobs → Batch Warranty Jobs" — a
                                                 SEPARATE screen (own access right,
                                                 JOBS_BATCH_WARRANTY_TRANSACTIONS) that
                                                 cascades several existing warranty jobs
                                                 for one customer through Completed OK →
                                                 Final → Deliver together, with its own
                                                 "Job Delivery Note" button on the results
                                                 screen (process-jobs-modal.tsx) — a second
                                                 UI entry point that produces delivered
                                                 jobs, distinct from delivery-modal.tsx
        jobs/deliver-job/fetch-delivery-note-jobs.ts
                                                 fetchDeliveryNoteJobsByIds — shared by
                                                 both entry points above, confirming both
                                                 ultimately just mark job rows
                                                 DELIVERED_OK/NOT_OK the same way
        jobs/deliver-job/deliver-job-pdf.ts      buildDeliveryNotePdf (line 980) — the
                                                 EXISTING paper Delivery Note. Its
                                                 multi-job table (line 919-922) has no
                                                 dedicated Serial No column; serial_no is
                                                 buried, unlabeled, inside a concatenated
                                                 "Device / Service" string
                                                 (GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                                                 sql_jobs.py:1799), and remarks are one
                                                 shared block for the whole batch, not
                                                 per-job. This design's new Delivery Note
                                                 PDF must not repeat that gap (see Step 1).
```

## What "paperless job delivery" means here

1. WhatsApp message sent once job(s) reach `DELIVERED_OK`/`DELIVERED_NOT_OK`
   — job-list summary, amount paid/balance, a 6-digit confirmation code in
   the body text, and two buttons: **"Download Delivery Note"** and
   **"Download Invoice"**.
2. Customer reads the code to staff at the counter; staff enter it in-app;
   server verifies and records confirmation. No customer-facing web page.
3. **"Download Delivery Note"** serves a server-built PDF (reportlab,
   token-gated, same mechanism as `/job-intake/pdf/{token}`) — one row per
   delivered job with its own device and **serial number**, regardless of
   which intake batch (or none) each job originally came from.
4. **"Download Invoice"** serves a second server-built PDF, the formal
   line-item bill — parts and service charges with GST rate/HSN each,
   subtotal, tax, total, amount paid, balance due — mirroring what the
   existing jsPDF Invoice+Receipt shows today, reimplemented in reportlab
   from whitelisted public fields, not a port of the client-side builder.
   Both PDFs share the same token; neither is ever a WhatsApp document
   attachment.

Existing print buttons in `delivery-modal.tsx` are unchanged — this is an
additional path, not a replacement. Money Receipts are unchanged and out of
scope; payment is assumed already settled by the time this is clicked.

## Design decisions

| Question | Decision |
|---|---|
| What gets sent | Job-list summary + amount paid/balance + a 6-digit numeric code + two buttons, "Download Delivery Note" and "Download Invoice". Neither PDF is attached to the message itself. |
| Channel | Third template, `job_delivery_notice_v1` — text + **two** URL buttons (Utility category), same button-count shape as `job_intake_notice_v2`. |
| Trigger | New "Whatsapp Delivery (Paperless)" button in Deliver Job's footer, `disabled={!isDelivered}`, next to "Delivery Note" — additive. |
| Message wording, multi-job | No `_build_reference_line`/`batch_no` reuse — that helper assumes one shared `batch_no` for the group, true for intake (one drop-off, one batch) but false for delivery (jobs from several intake batches, or unbatched individual jobs, can be delivered together). Delivery gets its own reference-line builder that lists `job_no`s directly (reusing `_format_job_no`'s 3-then-elide truncation), never a "Batch No: N" framing. |
| Proof of delivery | One-time code, delivered only in the WhatsApp body (never a link), read by the customer to staff, entered by staff in-app. Ties confirmation to physical presence and a staff witness — stronger than a tap-link, but still not identity verification (anyone holding the customer's phone can read it out). |
| Where verification happens | Inside the authenticated app, by staff. Not a public route — no customer-facing confirmation page exists in this design. |
| Code lifetime | 6 digits, cryptographically random, 15-minute expiry, max 5 attempts before a resend is required. |
| Code storage | Hashed (HMAC-SHA256, new dedicated secret `whatsapp_delivery_otp_secret`) — never plaintext at rest, never logged, never returned to the client. |
| `token.py` | Unchanged; one token, reused for both the Delivery Note and Invoice PDF links (same "one token, no new parameter" trick `JOB_CREATION`'s two buttons already use). |
| Confirmation record | New key `JOB_DELIVERY` in the existing `job.whatsapp_notifications` jsonb — no new columns/tables. Also records `confirmed_by_staff_id` (which staff member verified/overrode) — accountability, not a secret, so no risk in retaining it. |
| Per-event toggle | Already exists (`app_setting.whatsapp_notifications`, `JOB_DELIVERY` slot, currently `false`) — this design's send path must call the existing `_is_event_enabled(..., "JOB_DELIVERY")`. |
| Staff override | Checkbox/button — "Customer confirmed in person / no WhatsApp" — writes `confirmation_method='manual_override'` directly, no code, always available. |
| Resend | Re-running the send mutation mints a fresh code and invalidates the old one — no separate resend mutation. |
| Meta button URL | Registered with **no placeholder text** — bare prefix, "Dynamic URL" type. Meta appends the sent value to the registered string; it does not substitute placeholders in-place (`job_intake_notice_v1`/its successor both shipped broken this way — see `plans/plan-whatsapp.md`'s Meta-template section). Get this right on first submission; an approved template can't be edited. |
| Public host for the button | Not stored anywhere — no app-setting. Baked directly into the Meta-registered template, same as `JOB_CREATION`'s working template. (An earlier `job_intake_url` setting existed for this and was deleted — it was never actually read by any code.) |
| Gates `is_closed`? | No. Accounts posting/stock fire exactly as today; confirmation is informational only. |
| Payment via WhatsApp | Out of scope — no payment gateway exists in this codebase. |
| Multi-job / batch delivery | The normal case, not an edge case — `deliverable-jobs-grid.tsx` already lets staff multi-select. One send, one shared OTP, written identically to every `job_id` in it. The send mutation returns the exact `job_ids` it actually covers (see Step 3) so the client never assumes a set the server silently narrowed. |
| RETURN-status jobs | Covered automatically, no special-casing — `RETURN` (`is_final=true`) reaches `DELIVERED_OK`/`DELIVERED_NOT_OK` through the same Deliver Job path as a completed repair (`GET_DELIVERABLE_JOBS_PAGED` filters only on `is_final`/`is_closed`, not status code). An unrepaired return with no charge is already handled by `amount_line`'s existing "No charge" fallback. |
| Second entry point | "Jobs → Batch Warranty Jobs" can also produce delivered jobs (cascading Completed OK → Final → Deliver for several existing warranty jobs at once), separate from `delivery-modal.tsx`. The send trigger must be wired into both screens (Step 4) — the server side needs no changes, since it re-filters by status, not by which screen triggered delivery. |

## Data model

`whatsapp_notifications` gains a third key:

```jsonc
{ "JOB_DELIVERY": { "attempt_count", "success_count", "fail_count",
                     "last_wamid", "last_status", "last_sent_at", "last_error",
                     "otp_hash": null,           // HMAC-SHA256(code)
                     "otp_expires_at": null,
                     "otp_attempt_count": 0,     // lockout at 5
                     "confirmed_at": null,
                     "confirmation_method": null,  // "otp_verified" | "manual_override"
                     "confirmed_by_staff_id": null  // logged-in staff user id who verified/overrode
} }
```

`confirmed_by_staff_id` names the specific staff member who performed the
verification (or manual override) — a materially better dispute-defense
record than storing the OTP itself would be ("verified by this named
employee" beats "a correct-looking code was entered somewhere"), with no
security downside since it's not a secret. Populated from the caller's
existing authenticated session, the same identity already available to every
other staff-facing mutation in this codebase — no new auth plumbing.

Attempt/outcome fields need zero SQL changes (`SET_JOB_WHATSAPP_ATTEMPT`/
`_OUTCOME` already take `%(event_key)s`). OTP and confirmation fields are new,
written by dedicated queries (Step 1) — not through `SET_JOB_WHATSAPP_OUTCOME`,
whose `WHERE` clause requires a Meta `wamid`/status-ladder match that an OTP
verification has neither.

A batch writes the same `otp_hash`/`otp_expires_at` onto every `job_id` in
the send, in one transaction (mirrors how attempt/outcome fields are already
written per-job for a group send) — a partial write must never leave some
jobs in a batch with a stale/missing hash while others have the new one.
`verifyJobDeliveryOtp` checks that **every** `job_id` passed shares the same
matching hash before confirming any of them — it does not trust one
representative job on the assumption the rest match. `otp_attempt_count` is
incremented on every job in the batch together on a wrong guess, so the
5-attempt lockout can't drift out of sync across jobs in the same batch.

A send exceeding `MAX_JOBS_PER_WHATSAPP_MESSAGE` (35) splits into multiple
messages, each with its **own** code — documented as a known limitation
(Watch-outs), not specially handled in the UI; a delivery that large is
expected to be rare enough to use manual-override instead.

## Workflow

```mermaid
sequenceDiagram
    participant Staff as Staff (Deliver Job, in-app)
    participant Server as service-plus-server
    participant Meta as Meta WhatsApp Cloud API
    participant Customer as Customer's phone

    Staff->>Server: sendWhatsappJobDelivery(job_ids)
    Server->>Server: re-filter (DELIVERED_OK/NOT_OK), check JOB_DELIVERY toggle
    Server->>Server: generate 6-digit code, hash + store (15 min expiry)
    Server->>Meta: send_template(job_delivery_notice_v1, code, shared token)
    Meta-->>Customer: "Your code: 482913" · "Download Delivery Note" · "Download Invoice"
    Meta-->>Server: status webhook (ACCEPTED/SENT/DELIVERED)
    Server-->>Staff: live badge update (whatsappDeliveryStatus subscription)

    Note over Customer,Staff: At the counter — customer reads the code aloud

    Staff->>Server: verifyJobDeliveryOtp(job_ids, code)
    alt matches, not expired, attempts < 5
        Server->>Server: SET_JOB_DELIVERY_CONFIRMATION (confirmation_method="otp_verified")
        Server-->>Staff: pubsub publish status="CONFIRMED" — badge updates live
    else wrong code
        Server->>Server: increment otp_attempt_count
        Server-->>Staff: error — retry or resend
    end

    Customer->>Server: GET /job-delivery/pdf/{token} (optional)
    Server-->>Customer: Delivery Note PDF (every job, device, serial no)
    Customer->>Server: GET /job-delivery/invoice/{token} (optional)
    Server-->>Customer: Invoice PDF (line items, GST, total, balance)

    Note over Staff,Customer: No WhatsApp / code never arrives → manual-override control,<br/>same confirmed_at/confirmation_method write, no code, no Meta send.
```

## Implementation Steps

Four steps, each independently buildable/testable. Step 1 → Step 2 → Step 3 →
Step 4 (Step 2's proxy config needs Step 1's routes to exist to be worth
verifying; Step 3's button URLs need Step 2 live before a real send is
meaningful to test; Step 4 needs Step 3's mutations to exist) — same
one-step-at-a-time cadence `plan-whatsapp.md` used.

### Step 1 — Server foundation: event key, OTP storage/verification, Delivery Note PDF route — ✅ Done

Implemented and verified: both PDF builders tested locally against sample
data (single job, a delivery spanning two different intake batches plus an
individually-created job, a zero-charge RETURN job, and a multi-job invoice
including a job with no invoice row yet) — all five render cleanly. Two real
bugs caught and fixed during that verification: reportlab's core Helvetica
font has no glyph for `₹` (renders as a solid black box) — switched to
`"Rs. "`; the Serial No/Batch columns wrapped mid-word at their original
widths — widened and tightened padding, mirroring the fix already applied to
the job-intake PDF's own "#" column earlier. `GET_JOB_DELIVERY_INVOICE_DETAIL`
is grounded in the real `job_invoice`/`job_invoice_line` schema, not the
speculative "TBD" placeholder this step originally shipped with.

- `app/whatsapp/sender.py` — add `"JOB_DELIVERY": "JD"` to `_EVENT_CODE_BY_KEY` (line 97).
- `app/routers/webhooks/whatsapp_webhook_router.py` — add `"JD": "JOB_DELIVERY"` to `_EVENT_KEY_BY_CODE` (line 103).
- `app/core/settings/whatsapp_settings.py` — new `whatsapp_delivery_otp_secret` field (same shape as `whatsapp_link_token_secret`); add to `.env.example`.
- `app/whatsapp/otp.py` (new) — `generate()` (6-digit, `secrets` module), `hash_code()` (HMAC-SHA256), `verify()` (constant-time compare). Separate from `token.py` — short-lived/attempt-limited, not a self-contained signed link.
- `app/db/sql/sql_jobs.py`:
  - `GET_JOBS_FOR_WHATSAPP_DELIVERY` — modeled on `GET_JOBS_FOR_WHATSAPP_COMPLETION`/`_CREATION`, filtered `js.code IN ('DELIVERED_OK','DELIVERED_NOT_OK') AND j.branch_id = %(branch_id)s` (mirrors `isDelivered`, line 328) — **`branch_id` is a required argument, cross-checked against `job_ids` the same way both existing WhatsApp source queries already do**; never trust `job_ids` alone to imply the caller is authorized for those jobs' branch. Include a paid-amount subquery for balance.
  - `SET_JOB_DELIVERY_OTP` — writes `otp_hash`/`otp_expires_at`, resets `otp_attempt_count`, per job in the send.
  - `GET_JOB_DELIVERY_OTP` — reads the three OTP fields for Python-side comparison.
  - `INCREMENT_JOB_DELIVERY_OTP_ATTEMPT` — `otp_attempt_count += 1`.
  - `SET_JOB_DELIVERY_CONFIRMATION` — takes `confirmation_method` **and `staff_id`**; writes `confirmed_at`/`confirmation_method`/`confirmed_by_staff_id`, no ladder/wamid check.
  - `GET_JOB_DELIVERY_OTP_PENDING` (new, feeds Step 4's "Verify Code" affordance) — per job, a single boolean: `otp_hash IS NOT NULL AND otp_expires_at > now() AND confirmed_at IS NULL`. Lets the client know a still-valid code is waiting without exposing the hash or expiry timestamp itself.
- `app/db/sql/sql_public.py`:
  - `PublicSql.GET_JOB_DELIVERY_STATUS`, modeled on `GET_JOB_INTAKE_STATUS` but **per-job, not per-batch**: `job_no`, **`batch_no` as each row's own value** (the intake batch that job came from, if any — never treated as one shared value for the whole delivery, unlike `GET_JOB_INTAKE_STATUS`'s use of it), `device`, **`serial_no` as its own column** (not concatenated into `device`), `branch_name`, `customer_name`, `amount` + paid-amount subquery. Not filtered by `is_closed`. Feeds the Delivery Note PDF.
  - `PublicSql.GET_JOB_DELIVERY_INVOICE_DETAIL` (new, for the Invoice PDF) — **resolved against the real schema**, not the "TBD" this step was originally drafted with: `job_invoice` (header — invoice_no, invoice_date, cgst/sgst/igst_amount, amount, is_posted) LEFT JOINed to `job_invoice_line` (description, part_code, hsn_code, qty, price, gst_rate, amount) via `job_invoice_id`, one denormalized row per line item, header fields repeated per line — same shape as this codebase's other multi-row job-detail queries. LEFT JOIN throughout, not JOIN: a job with no invoice yet (e.g. a zero-charge RETURN) still gets a row, with null invoice/line fields, rather than silently vanishing from the PDF.
- `app/routers/public/job_delivery_router.py` (new, PDF-only — no HTML confirmation page):
  ```
  GET /job-delivery/pdf/{token}          → application/pdf (Delivery Note)
  GET /job-delivery/invoice/{token}      → application/pdf (Invoice)
  ```
  Same construction/rate-limiting style as `job_intake_router.py`'s PDF route. The Delivery Note renders one row per delivered job — job no, device, **serial no**, and (informational only) which intake batch it came from, if any — regardless of how many distinct intake batches or individually-created jobs are mixed into this one delivery; deliberately not repeating the existing paper Delivery Note's gap (serial number unlabeled and buried inside a concatenated "Device / Service" string, one shared remarks block for the whole group instead of per-job). The Invoice renders the formal line-item bill from `GET_JOB_DELIVERY_INVOICE_DETAIL`. Both PDFs stand on their own without the customer needing the paper originals. Register in `app/main.py`.
- Manual-override: new `setJobDeliveryManualConfirmation` mutation → `SET_JOB_DELIVERY_CONFIRMATION` with `confirmation_method='manual_override'` and the calling staff member's id (from the existing authenticated session — same identity source every other staff-facing mutation already has), same `pubsub.publish(..., status="CONFIRMED")`.

**Test alone**: hash a test code, verify right/wrong codes, confirm lockout/expiry behavior; hand-sign a `token.py` token and confirm both `GET /job-delivery/pdf/{token}` and `GET /job-delivery/invoice/{token}` download (locally — the nginx step below is what makes these reachable in production). No Meta or client UI needed.

### Step 2 — nginx reverse proxy (production) — ✅ Done

The `location /job-delivery/` block has been applied manually on the
production server, ahead of Steps 1/3/4 — the config exists before the
FastAPI routes it proxies to do. Until Step 1 ships, a request here reaches
nginx correctly but gets a plain FastAPI 404 (no route registered yet), not
the SPA's static-file fallback that showed up before this was applied.

Without this, both PDF routes 404 once deployed: the SPA's catch-all
`try_files` intercepts any path with no matching `location` block before it
ever reaches FastAPI — exactly the bug hit and fixed for `/job-intake/`
during `JOB_CREATION`'s rollout (`notes/Deployment.md`). Same fix, same file,
same shape:

1. Edit `notes/Deployment.md`'s documented nginx config first — add the new
   block immediately after the existing `location /job-intake/` block, so
   the doc and the live server never drift apart:
   ```
   location /job-delivery/ {
       proxy_pass http://127.0.0.1:8000/job-delivery/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
2. Apply the identical block to the live file,
   `/etc/nginx/conf.d/service-plus-server.conf` (per `notes/Deployment.md`'s
   own setup steps).
3. `sudo nginx -t` — validate syntax **before** touching the running server;
   a typo here should fail loudly here, not by taking `/api/`/`/graphql/`
   down with it.
4. `sudo nginx -t && sudo systemctl reload nginx` — reload, not restart, so
   in-flight connections (including any open GraphQL subscription sockets)
   aren't dropped. Same one-liner `notes/Deployment.md` already documents
   for this exact operation.
5. Verify from outside the server: `curl -sI https://<prod-host>/job-delivery/pdf/anything`
   should show FastAPI/uvicorn response headers, not openresty's static-file
   headers (`etag`, `last-modified`, `accept-ranges`) — the same diagnostic
   that caught the original `/job-intake/` gap.

**Dependencies**: Step 1's routes need to exist in `job_delivery_router.py`
(even returning a placeholder) for step 5's `curl` check to be meaningful —
otherwise identical to how `/job-intake/`'s own nginx fix was applied.

**Test alone**: the `curl` check above, run against a real deployment. No
Meta, no client UI, no database state needed — this step is pure
infrastructure and can be verified in complete isolation from the rest of
the feature.

### Step 3 — Meta template and the WhatsApp send + verify path

- `app/whatsapp/templates.py` — `TEMPLATES["JOB_DELIVERY"]`, **registered Meta template name: `job_delivery_notice_v1`** (Utility category, language `en`), `button_count=2` ("Download Delivery Note" and "Download Invoice" — the code itself is body text, not a button):
  ```
  Header: Service update from {{business_unit}} team
  Body: Hi {{customer_name}},
        Your {{reference_line}} has been delivered.
        {{amount_line}}
        Branch: {{branch_name}}  Contact: {{branch_contact}}
        Your confirmation code is {{otp_code}}. Share it with our staff to confirm receipt.
  Footer: This is an automated message. Do not share this code with anyone except our staff.
  Button 1: "Download Delivery Note" — Dynamic URL, bare prefix https://serviceplus.cloudjiffy.net/job-delivery/pdf/, no placeholder text.
  Button 2: "Download Invoice"       — Dynamic URL, bare prefix https://serviceplus.cloudjiffy.net/job-delivery/invoice/, no placeholder text.
  ```
  Named params: `business_unit`, `customer_name`, `reference_line`, `amount_line` (reuse `_format_amount`'s pattern), `branch_name`, `branch_contact`, `otp_code`.

  **Sample values for Meta's template review** (same requirement `plan-whatsapp.md`'s Meta-template section documents for `JOB_CREATION` — Meta needs one sample per variable, plus a sample destination per dynamic-URL button, to review the template):

  | Field | Sample value |
  |---|---|
  | `business_unit` | `Cellcare Services` |
  | `customer_name` | `Rahul Sharma` |
  | `reference_line` | `Job Nos: JOB-1024, JOB-1030, JOB-2001` (or `Job No: JOB-1024` for a single job — never `Batch No: …`) |
  | `amount_line` | `Balance due: ₹450.00` (or `Paid in full`) |
  | `branch_name` | `MG Road Branch` |
  | `branch_contact` | `080-4123 5566` |
  | `otp_code` | `482913` |
  | Button 1 sample destination | `https://serviceplus.cloudjiffy.net/job-delivery/pdf/c2VydmljZV9wbHVzX2RlbW98ZGVtbzF8NTM5Mw` |
  | Button 2 sample destination | `https://serviceplus.cloudjiffy.net/job-delivery/invoice/c2VydmljZV9wbHVzX2RlbW98ZGVtbzF8NTM5Mw` |

  Both buttons' sample destinations share the same token suffix, same as
  `JOB_CREATION`'s two buttons — one token, two routes.

  **`reference_line` needs its own builder, not `_build_reference_line`.** That
  function's signature (`batch_no, job_nos`) assumes one shared `batch_no` for
  the whole group — true for `JOB_CREATION` (one drop-off is atomically one
  batch) but false here: a single delivery can span jobs from several
  different intake batches, plus individually-created jobs, all for one
  customer. New `_build_delivery_reference_line(job_nos)` just lists job
  numbers directly (reusing `_format_job_no`'s existing 3-then-elide
  truncation) — never a "Batch No: N" framing, since no single batch number
  can correctly describe the group.
- `app/whatsapp/sender.py` — `send_job_delivery_notice(db_name, schema, value)` where `value` decodes to `{branch_id, job_ids}` (**`branch_id` required, same as `resolve_send_whatsapp_completion_helper`/`send_job_creation_notice` already take** — never trust `job_ids` alone), mirroring `send_job_creation_notice`: check `_is_event_enabled(..., "JOB_DELIVERY")` → `{"results": [], "disabled": True}` if off; re-filter via `GET_JOBS_FOR_WHATSAPP_DELIVERY(branch_id, job_ids)` (this is where a client-selected job that isn't actually `DELIVERED_OK`/`NOT_OK`, or doesn't belong to `branch_id`, gets silently dropped); group by customer **only** (never by `batch_no`), chunk at `MAX_JOBS_PER_WHATSAPP_MESSAGE`; compute `amount_line` and `reference_line` (via `_build_delivery_reference_line`, above); generate + hash + persist one OTP per chunk (`SET_JOB_DELIVERY_OTP`, one transaction per chunk); mint one `token.py` token, used for both PDF buttons; send; persist attempt (`event_key="JOB_DELIVERY"`). Plaintext code lives in memory only until the `send_template()` call. **Each per-customer result includes the exact `job_ids` that chunk's OTP covers** — the client must use this set, not its original selection, when later calling `verifyJobDeliveryOtp`. A customer with no valid mobile on file is skipped into the existing `FAILED — Invalid or missing mobile number` result shape (same as the other two events) — for this event specifically, that result means **manual-override is the only way to record this delivery**, not just a missed convenience notification (see Step 4, Watch-outs).
- `app/graphql/resolvers/mutation.py`:
  - `sendWhatsappJobDelivery` — same shape/no-guard precedent as `sendWhatsappJobIntake` (line 434); response includes `job_ids` per result (see above).
  - `verifyJobDeliveryOtp(job_ids, code)` — loads OTP fields via `GET_JOB_DELIVERY_OTP` for **every** `job_id` passed and requires them all to share one matching, unexpired hash under `otp_attempt_count < 5` — a mismatch or a missing hash on any single job fails the whole call rather than partially confirming. On match: `SET_JOB_DELIVERY_CONFIRMATION(confirmation_method='otp_verified', staff_id=<current staff user id>)` + `pubsub.publish(status="CONFIRMED")` per job. On wrong code: `INCREMENT_JOB_DELIVERY_OTP_ATTEMPT` on every job in the set together, with a distinct "incorrect code" result (separate from "expired"/"too many attempts"/"job set doesn't match a single OTP"). Authenticated, staff-facing — not a public route; the staff id comes from the same session context every other authenticated mutation already reads, not a new input field a caller could spoof.
  - `getJobDeliveryOtpPending(job_ids)` (new, small read) — wraps `GET_JOB_DELIVERY_OTP_PENDING`; feeds Step 4's "Verify Code" affordance without exposing the hash/expiry themselves.
- `app/graphql/schema.graphql` — add `sendWhatsappJobDelivery`, `verifyJobDeliveryOtp`, and `getJobDeliveryOtpPending` (all `: Generic`) next to `sendWhatsappJobIntake` (line 46).

**Test alone**: with Steps 1-2 merged (routes registered and reachable in production) and the template approved, trigger `sendWhatsappJobDelivery` for a real delivered job, read the code off a phone, call `verifyJobDeliveryOtp` — confirm success once, confirm wrong codes increment attempts and eventually lock out. No Deliver Job UI needed.

### Step 4 — Client: Deliver Job UI and mutation wrappers

- `src/constants/graphql-map.ts` — `sendWhatsappJobDelivery`, `verifyJobDeliveryOtp`, `getJobDeliveryOtpPending`, `setJobDeliveryManualConfirmation` (same shape as `sendWhatsappJobIntake`, line 207).
- New `jobs/send-whatsapp-job-delivery.ts` — copy of `send-whatsapp-job-intake.ts`, same `{results, disabled}` shape. A `FAILED — Invalid or missing mobile number` result here means more than it does for the other two events: there is no other way to deliver the code, so the caller should treat this as "go straight to manual-override," not just "send failed, maybe retry."
- New `jobs/use-send-whatsapp-job-delivery.ts` — copy of `use-send-whatsapp-job-intake.tsx`, confirmation dialog included ("Send Whatsapp message for Job Delivery?", Yes/No, default No).
- New OTP-entry dialog (e.g. `jobs/deliver-job/verify-otp-dialog.tsx`) — numeric input, "Verify" button, "Resend Code" link (re-calls the send mutation, same as clicking the main send button again — mints a fresh code and invalidates the old one either way); distinct messages for wrong/expired/locked-out; when opened for a customer with no valid mobile, skips straight to a "No WhatsApp number on file — use manual confirmation" state instead of showing a numeric input with nothing to enter.
- **"Verify Code" is reachable independently of sending**, not only right after a fresh send. If the OTP dialog is closed (refresh, accidental navigation, staff interrupted) after a successful send but before the customer reads the code out, re-clicking "Whatsapp Delivery (Paperless)" would send a **second** message and invalidate the first — confusing for a customer who already has the first one in hand. Instead: `whatsapp-status-cell.tsx` (or an adjacent small action) calls `getJobDeliveryOtpPending(job_ids)` and, when true, shows a "Verify Code" action that reopens the same OTP dialog against the existing pending code — no new send, no new message.
- `delivery-modal.tsx` — new "Whatsapp Delivery (Paperless)" button next to "Delivery Note" (line 1134's disabled state), same gate/busy/toast pattern as `handleInvoiceReceipt`/`handleDeliveryNote`. On confirmed click: send with the full selected `jobIds` (multi-job included) and `branchId` (already in scope, lines 505/792), then open the OTP dialog using the `job_ids` the send response actually covers. Existing print buttons untouched.
- **`batch-warranty-transactions/process-jobs-modal.tsx`** — same button, same hook, next to the existing "Job Delivery Note" action on its results screen — this is a second, independent trigger point for the identical mutation, needed because Batch Warranty Jobs is a separate screen from Deliver Job that can also produce delivered jobs.
- `customer-connect-schema.ts` — extend `WhatsappCompletionState` with optional `confirmed_at`/`confirmation_method: "otp_verified" | "manual_override" | null`/`confirmed_by_staff_id?: number | null`, plus `otp_pending?: boolean` for the "Verify Code" affordance above.
- `whatsapp-status-cell.tsx` — widen `eventKey` to include `"JOB_DELIVERY"`; render a second badge ("Confirmed"/"Confirmed in person") when `confirmed_at` is present, or "Verify Code" when `otp_pending` is true and nothing is confirmed yet.
- Manual-override checkbox/button next to that badge, wired to the manual-confirmation mutation — always available, and the action the UI should visibly steer staff toward when the send result shows no valid mobile on file.

**Test alone**: with Steps 1-3 merged, click "Whatsapp Delivery (Paperless)", confirm the Yes/No dialog (default No), confirm Yes sends and opens the OTP dialog, enter the real code and watch the badge update; repeat with a wrong code and confirm a clear error with no crash/double-count. Separately: send, close the dialog without verifying, confirm "Verify Code" reappears and completes verification against the same code without a second send. Separately: test against a customer with no mobile on file and confirm the UI goes straight to manual-override guidance instead of a dead-end numeric input.

**After shipping**: extend `whatsapp-integration`/`dev-whatsapp-integration` help articles with the third event and the OTP flow — same pattern as `JOB_CREATION`'s rollout, not designed here.

## What doesn't change

- `is_closed`, accounts posting, stock — fire on Deliver Job regardless of paperless send/confirmation.
- Money Receipts — unchanged.
- Existing print-based Invoice+Receipt/Delivery Note buttons — unchanged.

## Explicitly out of scope

- Payment collection via WhatsApp.
- Reading WhatsApp inbound replies (still unattributed to a tenant).
- A hard confirmation gate on job closure.
- Attaching the Delivery Note as a WhatsApp document/media attachment.
- Any customer-facing confirmation web page.

## Watch-outs

- **Rate-limit OTP verification** — the 5-attempt lockout + 15-minute expiry are load-bearing, not optional; a 6-digit code is brute-forceable without both.
- **Never let the plaintext code reach a log, error message, or the client** — only `otp_hash` persists or gets compared.
- **Register both button URLs with no placeholder text** — bare prefix, "Dynamic URL" type, on both the Delivery Note and Invoice buttons; an approved template can't be edited.
- **No app-setting for the public host** — it's baked into the Meta template, not read from the DB.
- **The nginx `location /job-delivery/` block is not optional** — this exact class of bug (a new public router 404ing in production because the SPA's catch-all intercepts it first) already happened once for `/job-intake/`; don't rediscover it for `/job-delivery/`.
- **Wire `_is_event_enabled(..., "JOB_DELIVERY")` in from the first version**, not bolted on later.
- **OTP confirmation is circumstantial evidence, not a legal signature** — proves phone possession at the counter, not identity. Say so plainly if ever positioned as warranty/insurance proof.
- **Manual-override remains necessary** for customers without a smartphone/data plan.
- **A batch's OTP write must be one transaction** — a partial failure across job rows must never leave some jobs with the new hash and others with a stale one; `verifyJobDeliveryOtp` checking all job_ids, not one, is the backstop, but the write itself should still be atomic.
- **The client must use the server's returned `job_ids`, not its own selection**, when verifying — `GET_JOBS_FOR_WHATSAPP_DELIVERY`'s re-filter can silently drop a job that wasn't actually `DELIVERED_OK`/`NOT_OK` yet.
- **A delivery over 35 jobs produces multiple codes**, one per chunk — not specially handled in the UI; expected to be rare enough for manual-override instead.
- **Two independent UI entry points** (Deliver Job, Batch Warranty Jobs) must both wire in the send button — easy to ship one and forget the other since they're separate components.
- **Never assume a delivery shares one `batch_no`** — that's an intake-time invariant (`_build_reference_line`, `GET_JOB_INTAKE_STATUS`'s use of `batch_no`), not a delivery-time one. A single delivery can mix jobs from several intake batches and individually-created jobs; treat `batch_no` as a per-job, informational field only, never a group header.
- **`branch_id` must be a required, cross-checked argument on `sendWhatsappJobDelivery`**, exactly like the other two events' send functions — don't let `job_ids` alone imply authorization for those jobs' branch.
- **A customer with no valid mobile has no way to receive the code at all** — for `JOB_DELIVERY`, unlike the other two events, this makes manual-override the *only* path to record that delivery, not an optional fallback. The UI should say so plainly rather than presenting a numeric input that can never be filled.
- **No way to resume verification without a fresh send is a real gap, not a nice-to-have** — without `getJobDeliveryOtpPending`/"Verify Code," a staff member who loses the dialog (refresh, interruption) has no option but to send a second message and invalidate the first customer-visible code.
- **Two concurrent sends for overlapping `job_ids` invalidate each other's code** — last write wins, per the one-transaction-per-send design. Rare for a single-counter shop; documented here as an accepted limitation, not solved.
- **`confirmed_by_staff_id` is accountability data, not a secret** — safe to retain indefinitely, unlike the OTP itself; don't conflate the two when reviewing what this feature stores.

## Verification

- `curl -sI https://<prod-host>/job-delivery/pdf/anything` reaches FastAPI (a token-decode error response), not the SPA's static-file headers — confirms the nginx `location` block is live before the first real customer hits it.
- `JOB_DELIVERY` send updates only `whatsapp_notifications.JOB_DELIVERY`.
- Toggling `whatsapp_notifications.JOB_DELIVERY` off → `sendWhatsappJobDelivery` returns `disabled: true`, no Meta call.
- Delivered message has working "Download Delivery Note" and "Download Invoice" buttons and a plaintext code, no leftover placeholder text on either button.
- Correct code within window/attempt-limit → `confirmed_at`/`confirmation_method='otp_verified'`, live badge update, no polling.
- Wrong code → attempt count increments, distinct "incorrect code" result; 6th attempt rejected outright.
- Expired code → distinct "expired" result.
- Resend invalidates the previous code.
- "Download Delivery Note" PDF matches the WhatsApp message's amount/balance; works after job close.
- "Download Invoice" PDF's total/balance matches both the Delivery Note and the WhatsApp message's `amount_line`; line items sum correctly.
- Tampered/expired token → clean rejection on both PDF routes, never a 500 or partial-data leak.
- Manual-override records `confirmation_method='manual_override'`, updates the badge, no WhatsApp/OTP involved.
- "Whatsapp Delivery (Paperless)" shows the Yes/No dialog (default No) before any send.
- `is_closed`/accounts posting fire identically regardless of send/confirmation state.
- A multi-job delivery (several jobs, one customer, one message) verifies correctly with a single code entry, and the Delivery Note PDF lists every job with its own labeled Serial No — not concatenated or buried.
- A delivery spanning jobs from **multiple different intake batches, plus individually-created jobs**, for one customer, produces one correct message/code/PDF — no "Batch No: N" wording anywhere, and the PDF's per-job batch reference (if any) reflects each job's own origin, not a single group-level value.
- If one selected job isn't actually `DELIVERED_OK`/`NOT_OK` yet, the send response's `job_ids` reflects only the jobs actually covered, and verification against that returned set still succeeds.
- A `RETURN`-origin job (unrepaired, handed back) reaching `DELIVERED_OK`/`NOT_OK` gets the same WhatsApp/OTP flow as a repaired job, with `amount_line` correctly showing "No charge" where applicable.
- The "Whatsapp Delivery (Paperless)" trigger works identically from both the Deliver Job screen and the Batch Warranty Jobs results screen.
- Successful OTP verification and manual-override both record `confirmed_by_staff_id` matching whichever staff member's session actually performed the action.
- Sending for `job_ids` belonging to a branch the caller isn't authorized for is rejected by `GET_JOBS_FOR_WHATSAPP_DELIVERY`'s `branch_id` cross-check, same as it already is for `JOB_COMPLETION`/`JOB_CREATION`.
- A customer with no valid mobile on file produces a send result the UI renders as "use manual confirmation," not a generic failure with no next step.
- After a successful send, closing the OTP dialog and reopening "Verify Code" (without re-sending) still successfully verifies the original code — no second message goes out.
