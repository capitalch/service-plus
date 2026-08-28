# Paperless Job Delivery via WhatsApp — Design

**New file.** The previous `plan1.md` (WhatsApp Completion Messages) shipped — see
`git log -- plans/plan1.md` for its history — and this file was removed in favour of
`plan.md` (a small, now-also-shipped Customer Connect grid tweak). This document starts
fresh: how to take the *rest* of Deliver Job paperless, riding on the WhatsApp rail that
Part 1 already built.

## What already exists (verified against the actual code, not assumed)

Part 1 built a real, working send/track path for exactly one message —
`job_completed_ready_for_pickup_v2`, text-only, "your device is ready for pickup":

```
server  app/whatsapp/{client.py, sender.py, templates.py, mobile.py}   send_template(), one TemplateSpec
        app/routers/webhooks/whatsapp_webhook_router.py                GET verify + POST status callback
        app/db/sql/sql_jobs.py  SET_JOB_WHATSAPP_ATTEMPT / _OUTCOME     job.whatsapp_notifications->'JOB_COMPLETION'
        app/graphql/resolvers/subscription.py                          whatsapp_delivery_status pubsub → GraphQL subscription
client  jobs/customer-connect/*                                        grid + live subscription (no polling — better than
                                                                        the original plan called for)
        jobs/send-whatsapp-completion.ts                                sendWhatsappCompletion mutation wrapper
```

Confirmed by reading the code, not the old plan: `biz_opaque_callback_data` tenant routing
works (`db_name|schema|job_ids`), the status ladder is enforced in SQL
(`SET_JOB_WHATSAPP_OUTCOME`'s `WHERE` clause), and delivery status reaches the client via a
**live GraphQL subscription** (`whatsappDeliveryStatus`, filtered by `db_name`) that the
webhook publishes to directly — there is no polling anywhere in the shipped feature.

There's also a second piece of infrastructure this design leans on, unrelated to Part 1:
`app/routers/public/website_router.py` — a public, unauthenticated (well, `X-Website-Key`
+ per-IP rate-limited) REST API already serves the **service-plus-web** marketing site's
"check your repair status" widget (`components/home/repair-status-card.tsx`, job-status-
by-job-no and open-jobs-by-mobile). That's the existing precedent for "customer looks at
their job with no login" — this design's confirmation page is the same shape, not a new
invention.

**Deliver Job itself has none of this.** `delivery-modal.tsx` (1330 lines, read in full)
is 100% client-generated PDFs and print buttons: `buildInvoicePdf`,
`buildPackedInvoicePdf`, `buildReceiptPdf`, `buildDeliveryNotePdf`, all via jsPDF, all
ending in a browser print/download dialog. Zero WhatsApp involvement. That's the gap this
document designs a fill for.

## What "paperless job delivery" means here

Replace the two paper artifacts Deliver Job produces — the **Invoice + Receipt PDF** the
customer is handed, and the **Delivery Note** they'd sign — with:

1. The same combined Invoice + Receipt PDF, sent as a **WhatsApp document**, tracked to
   real delivery the same way the completion message already is.
2. A **one-tap confirmation link** in that message, replacing the paper signature — the
   customer taps it, no app, no login, no typing a job number.

Money Receipts (Step 2, cash/UPI/card collection) are **not** redesigned here — collecting
payment remotely is a payment-gateway integration, explicitly out of scope (see below).

## Fixed decisions

| Question | Decision |
|---|---|
| What gets sent | The existing combined Invoice + Receipt PDF (`handleInvoiceReceipt`'s `buildPackedInvoicePdf` output) — no new PDF layout. |
| Channel | A **second** WhatsApp template, `job_delivery_documents_v1` — Document header, separate from `job_completed_ready_for_pickup_v2`'s plain-text header. Meta templates can't mix header types after approval. |
| Trigger | A new button in Deliver Job's footer, **"Deliver (Paperless)"**, next to today's combined "Receipts + Delivery + Invoice" action — not a replacement for it. Staff choose per delivery; nothing is forced paperless. |
| Proof of delivery | A **tokenized link**, not a WhatsApp button reply. Confirmed watch-out from Part 1 stands: inbound WhatsApp replies aren't attributed to a tenant in this codebase, and building that out is a bigger lift than a signed link. |
| Token shape | Stateless HMAC — `db_name.schema.job_ids.exp`, signed with a server secret. Same "no lookup table if a signed string will do" call this codebase already made for `biz_opaque_callback_data`. |
| Confirmation surface | A **new route on service-plus-web** (`/delivery/[token]`), not a new site. It's the same "customer, no login, minimal fields" shape as the existing repair-status widget, on infrastructure that's already live and already talks to `website_router.py`'s public API family. |
| Where confirmation is recorded | A second key in the existing `job.whatsapp_notifications` jsonb, `JOB_DELIVERY`, extended with `confirmed_at` / `confirmation_method` — not new columns, not a new table. Matches the "leave alone, extend the jsonb" precedent Part 1 already set. |
| Staff override | A checkbox on the Deliver Job screen — "Customer confirmed in person / no WhatsApp" — sets `confirmation_method = 'manual_override'` directly, no token. Always available; some customers have no WhatsApp at all. |
| Does this gate `is_closed`? | **No.** `is_closed`/accounts posting keep firing exactly when they do today. Confirmation is a second, informational signal surfaced in the UI — making it a hard gate is a bigger, separate decision, not assumed here (see "What doesn't change" below). |
| Payment via WhatsApp | **Out of scope.** No payment gateway exists anywhere in this codebase today; that's a separate integration, not a paperless-delivery detail. Money Receipts keep working as they do now. |

## Data model

`job.whatsapp_notifications` already has one key, `JOB_COMPLETION`:
```jsonc
{ "JOB_COMPLETION": { "attempt_count", "success_count", "fail_count",
                       "last_wamid", "last_status", "last_error" } }
```
Add a sibling key, same shape, plus two confirmation fields:
```jsonc
{ "JOB_DELIVERY": { "attempt_count", "success_count", "fail_count",
                     "last_wamid", "last_status", "last_error",
                     "confirmed_at": null,
                     "confirmation_method": null   // "whatsapp_link" | "manual_override"
} }
```

**Real implementation snag, worth flagging now, not discovered mid-build:**
`SET_JOB_WHATSAPP_ATTEMPT` and `SET_JOB_WHATSAPP_OUTCOME`
(`app/db/sql/sql_jobs.py:1926,1988`) hardcode the literal string `'JOB_COMPLETION'` at
every `jsonb -> '...'` step — they are not parameterized by event type. Adding
`JOB_DELIVERY` means either:
- parameterizing both queries on an `event_type` SQL arg (one query, two callers), or
- duplicating them as `..._FOR_DELIVERY` variants (two queries, no parameter).

Given the queries are already deeply nested `jsonb_set` chains (four levels, per the
comment at `sql_jobs.py:1914-1920` about an earlier single-chain version silently no-op'ing),
parameterizing the key is the safer edit — smaller diff, one code path to re-verify against
real Meta traffic, not two.

## Server design

### New template

Submit `job_delivery_documents_v1` to Meta the same way `job_completed_ready_for_pickup_v2`
was: Utility category, named parameters, plain English (`en`). Header type **Document** (no
fixed sample file — Meta approves the shape; the actual PDF `media_id` is supplied per
send). Body: job no(s), amount paid/balance ("Paid in full" when balance is zero, mirroring
the existing `_format_amount`→"No charge" pattern), and a line for the confirmation link.
Whether the link is a body-text URL or a **URL button** component needs a throwaway test
send against Meta before locking the template text — button-type links render more
reliably across WhatsApp clients than a bare URL inside a sentence, but the template can't
be edited once approved, so this is worth 15 minutes of testing before submission, the same
discipline Part 1 applied to the `en` vs `en_US` template-language trap.

### `app/whatsapp/client.py` — media upload comes back

`send_template()` already exists; a document header needs `upload_media()` (POST the PDF
bytes, get a `media_id`, reference it in the header component) — the exact call Part 1
deliberately deleted as dead weight once only a text template remained. Reinstating it here
is narrower than what was removed: one call site (`sender.py`'s new
`send_delivery_documents()`), not four scattered buttons.

### `app/whatsapp/sender.py` — a second send function, same shape

`send_delivery_documents(db_name, schema, branch_id, job_ids)` mirrors
`resolve_send_whatsapp_completion_helper` almost line for line: re-filter server-side
(never trust the client's job_ids), group by `customer_contact_id`, build
`biz_opaque_callback_data` the same way, persist the attempt. The one new step: build the
combined Invoice+Receipt PDF **server-side** (today it's built client-side in jsPDF inside
`delivery-modal.tsx` — the server has no PDF generation of its own for this document yet),
upload it via `upload_media()`, then call `send_template()` with the `JOB_DELIVERY_DOCUMENTS`
template. Building the PDF server-side is a real, non-trivial addition — either port the
jsPDF layout logic to a Python PDF library, or have the client build the PDF and upload the
bytes to the server in the same mutation call (multipart, same reasoning `image_router.py`
already uses for binary payloads) rather than the server re-deriving invoice lines from
scratch. **Decide this in Phase P1**, not assumed here — both are legitimate, and the
client-builds-then-uploads route reuses `buildPackedInvoicePdf` as-is with less duplicated
logic, at the cost of one binary REST hop instead of a clean GraphQL mutation.

### `app/whatsapp/token.py` — new, small

```python
def sign(db_name: str, schema: str, job_ids: list[int], ttl_days: int = 14) -> str: ...
def verify(token: str) -> tuple[str, str, list[int]] | None: ...
```
Plain HMAC-SHA256 over a pipe-delimited payload plus an expiry timestamp — same shape
discipline as `biz_opaque_callback_data`: short, no JSON, no table, no DB round-trip to
validate. Sign with a dedicated secret (not `whatsapp_app_secret`, which authenticates
*Meta*, not customers — reusing it would let a webhook-signature key double as a customer-
facing token key, worth keeping separate on principle even though nothing forces it today).

### `app/routers/public/` — new confirmation endpoints

Same package as `website_router.py`, same spirit ("no amounts, no internal ids beyond
what's already implied"), different guard — a customer's browser has no `X-Website-Key`, so
these two routes are gated by the token alone, plus rate limiting:

```
GET  /api/public/delivery-confirm/{token}   → verify token, return job no(s)/device/amount
                                               read-only, for the confirmation page to render
POST /api/public/delivery-confirm/{token}   → verify token again, set confirmed_at +
                                               confirmation_method='whatsapp_link' on every
                                               job_id in the token. Idempotent.
```
Expired/invalid token → a plain "this link has expired, contact the shop" response, not a
stack trace — matches `website_router.py`'s existing error-shape discipline for public
routes. Rate-limit both the same way the webhook router already is
(`rate_limit("delivery-confirm", limit=..., window_seconds=...)`).

### Confirmation reaches the UI the same way delivery status already does

The `POST` handler calls `pubsub.publish("whatsapp_delivery_status", ...)` exactly like
`_apply_status_callback` does today, with a new `status` value (`"CONFIRMED"`) alongside
the existing `SENT`/`DELIVERED`/`READ`/`FAILED` set. **No new subscription, no new
GraphQL type** — Deliver Job's UI subscribes to the same `whatsappDeliveryStatus` channel
Customer Connect already consumes, filtered to the jobs it has open. This is the single
biggest simplification this design gets for free from Part 1's existing shape.

## Client design

### Deliver Job — `delivery-modal.tsx`

- New button, **"Deliver (Paperless)"**, next to the existing combined action (around
  line 1091's primary button) — same busy/disabled states as the existing flow
  (`flowBusy`/`flowDone`), running receipts→delivery→invoice exactly as today, then calling
  a new `sendDeliveryDocuments` mutation wrapper (mirrors `send-whatsapp-completion.ts`'s
  shape) instead of opening the PDF preview modal.
- A **Documents** badge and a **Confirmation** badge per job, subscribed the same way
  Customer Connect's grid already is (`whatsappDeliveryStatus`, filtered by `job_id`) —
  two independent signals: did the *message* arrive (Accepted → Sent → Delivered → Read /
  Failed), did the *customer* confirm (Pending → Confirmed, or "Confirmed in person").
- The manual-override checkbox sits next to the Confirmation badge — a direct, small
  mutation (no token), for customers without WhatsApp.
- Existing "Invoice + Receipt PDF" and "Delivery Note" print buttons **stay** — paperless
  is an additional path, not a replacement; a customer without WhatsApp still gets paper.

### service-plus-web — `/delivery/[token]` (new route)

Same design language as `repair-status-card.tsx`, but no form — the token already identifies
the job(s). Shows device/job summary and amount (via the new public GET), one primary
button ("I received my device — Confirm"), one secondary link ("Report a problem" — logged,
non-blocking, doesn't call the confirm endpoint). Calls the new public POST on tap; shows a
plain success state after. `lib/api.ts` gains one small wrapper matching its existing
`fetch` + `X-Website-Key`-less call shape (this one call in the file that doesn't send the
key, since the token is the credential).

## Phases

1. **P0 — Template.** Submit `job_delivery_documents_v1`; resolve the URL-button-vs-body-
   link question against a real Meta send before locking wording; verify `APPROVED` the
   same way Part 0 did for the completion template.
2. **P1 — Server send path.** `upload_media()` back in `client.py`; decide client-builds-PDF
   vs server-builds-PDF (recommend client-builds, server-uploads, per the reasoning above);
   `send_delivery_documents()` in `sender.py`; parameterize `SET_JOB_WHATSAPP_ATTEMPT`/
   `_OUTCOME` on `event_type` rather than duplicating them.
3. **P2 — Token + public confirm routes.** `token.py`; the two `/api/public/delivery-
   confirm/{token}` routes; wire the `CONFIRMED` status into the existing
   `whatsapp_delivery_status` pubsub publish — no new subscription type.
4. **P3 — Deliver Job UI.** The paperless button, the two live badges (reusing the
   subscription Customer Connect already proved out), the manual-override control.
5. **P4 — service-plus-web confirmation page.** `/delivery/[token]`, the `lib/api.ts`
   wrapper, the confirm/report-problem UI.
6. **P5 — Help content.** Extend `whatsapp-integration`/`dev-whatsapp-integration` (the
   Appendix-A-shaped articles Part 1 already added) with the second send point and the
   confirmation flow — same pattern, not designed in detail here.

## What doesn't change

- `is_closed`, accounts posting, stock — all keep firing on the existing Deliver Job action,
  paperless or not. Confirmation is additive, not a gate. Making it a hard gate (job can't
  close until confirmed) is a real, separate product decision with real support-burden
  implications (a customer who never taps the link) — flagged as a possible future phase,
  not decided here.
- Money Receipts (Step 2) — unchanged. Paperless delivery assumes payment is already
  handled by the time "Deliver (Paperless)" is clicked, same as the existing flow assumes
  for the print path today.

## Explicitly out of scope

- **Payment collection via WhatsApp** (a payment link before handover) — no gateway
  integration exists in this codebase to build on; a real scoping exercise of its own.
- **Reading WhatsApp inbound replies** — still unattributed to a tenant per Part 1's
  watch-out; the tokenized link exists specifically to avoid needing this.
- **A hard confirmation gate on job closure** — see above.

## Watch-outs

- **Document templates are priced and throttled differently from Utility text templates**
  in Meta's model — verify current per-category pricing before rolling out past a pilot
  branch, not after.
- **The confirmation link is unauthenticated by construction** (the token *is* the
  credential) — fine for "did the device leave the shop," not a legal-signature substitute.
  Say so plainly if this is ever positioned as a warranty/insurance proof.
- **A customer without a smartphone or data plan** still needs the manual-override path —
  this covers customers reachable on WhatsApp, not all of them; Part 1's own mobile-number
  validation already tells you who that excludes.
- **`SET_JOB_WHATSAPP_ATTEMPT`/`_OUTCOME` hardcode `'JOB_COMPLETION'` today** — re-read
  P1 above before touching these queries; a copy-paste duplicate is the wrong fix.
- **PDF must be a real `Blob`, not a `blob:` URL string** if the client-builds-PDF route is
  chosen — `buildPackedInvoicePdf(...).output("blob")` already returns the right thing per
  `delivery-modal.tsx:670`; a multipart upload needs that, not `.output('bloburl')`. This is
  the exact trap Part 1's own dev-help article documented from the original (pre-deletion)
  document-send build — it will bite again here if not checked.
