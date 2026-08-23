# WhatsApp — Completion Messages with Delivery Webhooks

**Status:** approved in principle; the four open questions are now decided — see
`plans/plan1.md` for the execution checklist, which is the authoritative do-list.
Decisions: eligibility is `COMPLETED_OK` + `is_final` only; `WHATSAPP_FEATURE_ENABLED`
is removed entirely; zero amounts render `"No charge"`; BU names are truncated to fit.
§9 and §10 below are superseded accordingly. No code changed.
**Scope of this phase:** the Customer Connect → "Completed OK" send flow only, plus
the webhook plumbing that reports what actually happened to each message.

**Platform:** WhatsApp **Cloud API, configured directly with Meta** — our own Meta app
and WABA, no Business Solution Provider (Twilio / 360dialog / Gupshup) in the path. We
call `graph.facebook.com` ourselves and we own the app, its secret, and its webhook
configuration. Everything below assumes that; §2a covers a naming cleanup this implies.

---

## 1. What this phase delivers

1. A staff user opens **Customer Connect**. It lists every **Completed OK, finalized,
   not-closed** job for the current branch.
2. Rows with **zero** message attempts are pre-selected. Rows with **any** prior
   attempt — success or failure — start unselected. The user may tick extra rows.
3. User clicks **Send Messages**. One WhatsApp message per *customer*, never one per
   job, using the Meta-approved `job_completed_ready_for_pickup_v1` template (§6b),
   which names the Business Unit and branch so the customer recognises who is writing.
4. Meta calls our **webhook** as each message progresses (`sent` → `delivered` →
   `read`, or `failed`). Those outcomes are recorded per job.
5. The screen shows a **permanent** (user-dismissed, not time-based) result banner and
   refreshes to reflect real delivery state.

Explicitly **out of scope** this phase: job creation, delivery, and receipt sends
(the three PDF-carrying flows). Section 9 covers what to do with them meanwhile.

---

## 2. What exists today

An audit of the current server implementation, since the brief asks whether to keep or
replace it.

| Piece | File | Verdict |
|---|---|---|
| Cloud API HTTP client | `app/notifications/whatsapp_client.py` | **Keep the logic.** Correct error taxonomy, timeout/connect handling, permanent-vs-transient classification. Already targets Meta directly — see §2a. |
| Template registry | `app/notifications/whatsapp_templates.py` | **Keep the pattern, extend the shape.** `TemplateSpec` has no text-header variables, which the new BU-name header needs — see §6b. |
| Mobile helpers | `app/notifications/whatsapp_helpers.py` | **Keep** `normalize_mobile` / `is_valid_mobile`. **Replace** `build_notification_update_args` — see §4. |
| Completion resolver | `app/graphql/resolvers/jobs/whatsapp.py` | **Rewrite.** Sound grouping logic, but discards the `wamid` and treats an API 200 as "delivered". |
| PDF REST endpoint | `app/routers/notifications/whatsapp_router.py` | **Out of scope**, leave untouched this phase. |
| Eligibility SQL | `app/db/sql/sql_jobs.py` ~L1870–2010 | **Amend.** Filter is wider than this brief wants. |
| Webhook receiver | — | **Does not exist.** The whole of §5. |

### 2a. The code is already direct-to-Meta; only the vocabulary is wrong

Worth stating plainly, because it removes a worry rather than adding work:
`whatsapp_client.py` builds its URL as
`{whatsapp_base_url}/{whatsapp_api_version}/{whatsapp_phone_number_id}` with
`whatsapp_base_url` defaulting to `https://graph.facebook.com`. That **is** the Cloud
API called directly. No BSP endpoint, no BSP auth, no provider indirection exists in
the code today.

What is wrong is only the naming. Sixteen docstring/comment references across
`whatsapp_client.py`, `whatsapp_helpers.py`, `whatsapp_templates.py`,
`whatsapp_settings.py`, and the completion resolver describe Meta as "the BSP" —
including `WhatsappSettings`' own docstring, *"WhatsApp Business Solution Provider
(BSP) account settings"*, and a comment reasoning about *"swapping to a different BSP
later"*. That language would mislead the next reader into hunting for a provider layer
that was never there.

**No migration, no endpoint change, no credential change.** Since §5 creates a new
`app/whatsapp/` package anyway, carry the logic across under correct names
("Cloud API", "Meta", "Graph API") and let the old files go with the §11-8 deletion.
The one file that outlives that move is `whatsapp_settings.py` — retitle its docstring
in place.

### The three real defects

**a. The `wamid` is thrown away.** `send_template()` returns
`provider_message_id`, and `resolve_send_whatsapp_completion_helper` never persists
it. A status webhook identifies a message *only* by that id. Without it there is
nothing to correlate a callback against — this alone blocks webhooks.

**b. "Success" currently means "the API accepted it".** `build_notification_update_args`
increments `success_count` when the POST returns 200. That is *queued at Meta*, not
delivered to the handset. A number that is blocked, invalid, or has never opted in
returns 200 and then fails asynchronously. Today that failure is invisible.

**c. Eligibility is wider than the brief.** The SQL filters
`is_final = true AND is_closed = false AND code NOT IN ('CANCELLED','DISPOSED')`.
Per `seed_bu_data.py` and `_STATUS_FLAGS`, that admits **`COMPLETED_OK` (11)** *and*
**`RETURN` (12)**. The brief says "completed OK". See §10-Q1.

---

## 3. The hard problem: a webhook has no tenant

This is the decision that shapes everything else, so it comes first.

Service+ is multi-tenant: one control DB (`CLIENT_DB_*`) plus a **service DB per
client**, addressed at runtime as `exec_sql(db_name=..., schema=...)`. Every existing
write knows its tenant because a logged-in user's JWT carries it.

**Meta's webhook carries none of that.** It POSTs to one fixed URL with a `wamid` and a
status. Nothing in the payload says which client DB or schema owns the job.

**One sender number, permanently.** Every tenant sends from the same
`phone_number_id` / WhatsApp account, and there is no plan to give tenants their own
numbers. That settles the design rather than complicating it: the sender identity can
never disambiguate the tenant, so correlation must be ours.

| Option | How | Verdict |
|---|---|---|
| **A. Central outbox** in the control DB, written at send time, mapping `wamid → (db_name, schema, job_ids)` | One indexed lookup per callback | **Chosen** |
| **B. Fan out** across every active tenant DB hunting for the `wamid` | N queries per callback, N growing with clients | Rejected — doesn't scale, and callbacks are high-frequency |
| **C. Resolve by `phone_number_id`** from `value.metadata.phone_number_id` | Free, no table | **Not applicable** — one shared number means this value is identical for every tenant and carries no information |

**Decision: A.** This is now the permanent mechanism, not a stepping stone. The outbox
is the *only* thing that knows which tenant a callback belongs to, which raises its
status: losing an outbox row means permanently orphaning that message's delivery
result. Treat the write as part of the send, not as bookkeeping alongside it — insert
the row **before** the API call, so a crash between POST and insert leaves a `PENDING`
row to reconcile rather than an untraceable `wamid`.

The outbox keeps its `phone_number_id` column, but the justification changes: it is now
an audit field recording which number sent a given message — cheap, and the first thing
Meta support asks for. It is no longer a multi-tenancy hook.

---

### 3a. Concerns with a single shared sender number

Asked for explicitly. None of these block the build — they are operational risks to
price in, and the BU/branch placeholders you asked for are the correct mitigation for
the first one.

**1. The customer sees *your* identity, not the tenant's.** The WhatsApp display name,
profile photo, and verification badge belong to one business. A customer of Client B
gets a message from a business they have never heard of, about a device they left with
Client B. Unrecognised sender → higher block-and-report rate.
*Mitigation — the one you proposed:* lead with the BU name in the header and repeat the
branch in the body, so the first line the customer reads names the business they
actually dealt with. §6b does exactly this.

**2. Quality rating is per-number, and the blast radius is everyone.** Meta scores each
phone number Green/Yellow/Red from user blocks and reports. One tenant with sloppy
data — stale mobiles, customers who never expected contact — drags the *shared* number
down, and the consequence lands on **every** tenant at once: reduced messaging limits,
then template pausing, then number flagging. With per-tenant numbers this is contained;
with one number it is systemic.
*Mitigation:* subscribe to the `phone_number_quality_update` webhook field alongside
`messages` so a rating drop is an alert rather than a surprise outage, and keep the
`is_valid_mobile` gate strict — every message to a dead number is a small quality cost.

**3. Messaging limits are a shared bucket.** Cloud API tiers cap *unique recipients per
rolling 24h* (1K → 10K → 100K → unlimited). All tenants draw from one allowance. Two
clients each doing a few hundred completions can collide with the cap, and over-limit
sends fail with error `131048`/rate-limit — not a crash, just silently unsent messages.
*Mitigation:* record the failure honestly in the outbox (it is a `FAILED` with a
retryable code, not a permanent one), and watch the tier before onboarding a client
with real volume.

**4. Inbound replies cannot be attributed.** If a customer replies — and a template
message invites replies — the inbound webhook carries only their phone number. If two
tenants both service the same mobile, nothing in the payload says which one the reply
is about. There is also no inbox UI, so replies currently go nowhere.
*Mitigation for this phase:* the webhook parser must not choke on `value.messages[]`;
log and drop. Flagging it because a customer replying "when can I collect?" into a void
is a worse experience than not messaging at all — an eventual inbox is real work.

**5. A block is a block for all tenants.** A customer who blocks the number after
Client A's message stops receiving Client B's messages too, silently and permanently.

**6. Policy: messaging on behalf of other businesses.** WhatsApp's Business Messaging
Policy expects the business messaging a user to be the business that has the
relationship with them. Sending for many client businesses from one WABA is the
aggregator/reseller shape, which Meta normally expects to run under a Tech Provider or
Solution Partner arrangement. **I am flagging this as worth verifying, not asserting a
violation** — the rules are Meta's, they change, and how they read your setup depends on
how the WABA is registered. The cost of being wrong is number-level enforcement that
takes all tenants down together, so it is worth a direct check with Meta support before
onboarding a second client onto the shared number.

**In short:** the shared number is workable and the plan proceeds on it. The structural
trade is that every risk above is *correlated across tenants* instead of isolated to
one. If per-tenant numbers ever become viable, §3-option-C is the reason to revisit —
but nothing here is built assuming it.

## 4. Data model

### 4a. New: `whatsapp_message` outbox — **control DB**, `public` schema

The single cross-tenant correlation point. Written before/at send, updated by webhook.

```sql
CREATE TABLE whatsapp_message (
    id                bigserial PRIMARY KEY,
    wamid             text UNIQUE,          -- NULL until Meta accepts; set on 200
    db_name           text        NOT NULL, -- tenant routing
    schema_name       text        NOT NULL,
    branch_id         bigint      NOT NULL,
    phone_number_id   text        NOT NULL, -- audit: which sender number (§3)
    event_type        text        NOT NULL, -- 'JOB_COMPLETION' this phase
    template_name     text        NOT NULL,
    customer_contact_id bigint    NOT NULL,
    job_ids           bigint[]    NOT NULL, -- one message can cover several jobs
    to_mobile         text        NOT NULL, -- normalized, 91XXXXXXXXXX
    status            text        NOT NULL DEFAULT 'PENDING',
        -- PENDING → ACCEPTED → SENT → DELIVERED → READ, or FAILED
    error_code        text,
    error_message     text,
    accepted_at       timestamptz,
    delivered_at      timestamptz,
    read_at           timestamptz,
    failed_at         timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_whatsapp_message_wamid  ON whatsapp_message (wamid);
CREATE INDEX ix_whatsapp_message_tenant ON whatsapp_message (db_name, schema_name, branch_id);
```

Note `job_ids` is an array: the existing per-customer grouping means one message can
legitimately cover five jobs, and a single callback must fan back out to all five.

### 4b. Amended: `job.whatsapp_notifications` jsonb — **tenant DB**

Keep the column and its per-event shape; change what the numbers *mean*. The grid reads
this, so the fix is mostly semantic.

```jsonc
{
  "JOB_COMPLETION": {
    "attempt_count":  2,          // sends attempted (was: implicit)
    "success_count":  1,          // NOW: delivered per webhook, not API-accepted
    "fail_count":     1,          // NOW: includes async webhook failures
    "last_wamid":     "wamid.HBg…",
    "last_status":    "DELIVERED", // ACCEPTED|SENT|DELIVERED|READ|FAILED
    "last_sent_at":   "2026-08-23T…",
    "last_error":     null
  }
}
```

`build_notification_update_args` is replaced by two functions: one that records the
*attempt* at send time, one the webhook calls to *settle* the outcome.

### 4c. Status must not regress

Meta does not guarantee callback ordering — `sent` can arrive after `delivered`, and
retries mean the same callback can arrive twice. Rank statuses and only ever move
forward:

```
PENDING(0) < ACCEPTED(1) < SENT(2) < DELIVERED(3) < READ(4)   FAILED(9) terminal
```

A callback whose rank is `<=` the stored rank is acknowledged with 200 and otherwise
ignored. This makes the endpoint idempotent for free, which Meta's retry behaviour
requires.

---

## 5. Server: new `app/whatsapp/` package

The brief asks for a new addition that doesn't disturb the current codebase. A fresh
package, with the proven client/template/mobile logic moved in:

```
app/whatsapp/
    __init__.py
    client.py       # from notifications/whatsapp_client.py, + returns wamid
    templates.py    # from notifications/whatsapp_templates.py
    mobile.py       # normalize_mobile / is_valid_mobile
    outbox.py       # whatsapp_message CRUD against the control DB
    sender.py       # group-by-customer, send, record attempt
    webhook.py      # signature check, payload parse, status settle
app/routers/webhooks/
    whatsapp_webhook.py
```

### 5b. Send path

1. Resolver receives `{branch_id, job_ids}`; re-filters server-side (never trust the
   client's selection) to `COMPLETED_OK`, `is_final`, `not is_closed`, correct branch.
2. Group by `customer_contact_id`.
3. Per group: insert `whatsapp_message` row (`status='PENDING'`), POST to the Cloud API.
4. On 200 → store `wamid`, `status='ACCEPTED'`; bump `attempt_count` on each job.
   On error → `status='FAILED'` + `fail_count`, with the existing permanent/transient
   classification preserved.
5. Return per-customer accepted/rejected to the client — this is *dispatch*, not
   delivery, and the UI must say so (§7).

Keep `asyncio.Semaphore(_SEND_CONCURRENCY = 5)`; it is a sound throttle.

### 5c. Webhook endpoint

Mirror `website_router.py`, which is the established public-router pattern here
(dedicated prefix, header guard, per-IP `rate_limit`).

- `GET /api/webhooks/whatsapp` — Meta's verification handshake.
- `POST /api/webhooks/whatsapp` — status callbacks.

Non-negotiables:

- **Verify `X-Hub-Signature-256`** — HMAC-SHA256 of the **raw** body with the App
  Secret, compared with `secrets.compare_digest`. Must read the raw bytes *before*
  JSON parsing; re-serialized JSON will not match.
- **Return 200 fast.** Meta retries with backoff and disables endpoints that are slow
  or erroring. Acknowledge first, process after — even a failed lookup returns 200
  (log it; a 500 buys an infinite retry loop).
- **Never trust the payload for tenancy** — resolve only via the outbox (§3).

---

## 6. Meta "Configure Webhooks" — the spec you asked for

Paste-ready values for the Meta App Dashboard → WhatsApp → Configuration.

| Field | Value |
|---|---|
| **Callback URL** | `https://<your-server-host>/api/webhooks/whatsapp` |
| **Verify token** | any strong random string you choose; it goes in `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| **Subscribe to fields** | `messages` (carries the status callbacks) and `phone_number_quality_update` (early warning on the shared number's quality rating — §3a-2) |

**Must be HTTPS with a publicly-valid certificate.** Meta will not deliver to plain
HTTP, to a self-signed cert, or to `localhost`. For local development use an ngrok/
Cloudflare tunnel and point the callback URL at that.

### 6a. Two steps that only apply because you configured Meta directly

Both are invisible when a BSP fronts the integration — the BSP does them for you.
Owning the app means they are yours, and both fail *silently*.

**i. Subscribe the WABA to your app.** Saving the callback URL configures the *app*.
It does **not** subscribe your WhatsApp Business Account to it, and Meta sends no
warning — sends keep working and simply no callback ever arrives. Do it once per WABA:

```bash
curl -X POST \
  "https://graph.facebook.com/v20.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Verify with `GET /<WABA_ID>/subscribed_apps` — your app must appear in `data[]`. This
is the single most common reason a correctly-built webhook receives nothing, so make it
step one of §11-4, before debugging any code.

**ii. Use a System User token, not the API Setup token.** The token on the
*WhatsApp → API Setup* page is a **24-hour temporary** token. It is what pilots are
usually built with, and it will expire mid-week and take production sends down with a
`190` / `OAuthException`. Generate a permanent one instead:

> Business Settings → Users → **System Users** → Add → assign your app with **Full
> control** → *Generate new token* → select the app → scopes **`whatsapp_business_messaging`**
> and **`whatsapp_business_management`** → set expiry to **Never**.

That token is what goes in `WHATSAPP_ACCESS_TOKEN`. Treat it as a production credential
— it can send messages and read your WABA.

If your pilot used the temporary token, the send path will work today and break
without code changes within 24 hours. Worth confirming before §11-3.

**Verification handshake** — Meta GETs once when you click *Verify and Save*:

```
GET /api/webhooks/whatsapp
  ?hub.mode=subscribe
  &hub.challenge=1158201444
  &hub.verify_token=<your token>
```

Respond `200` with the raw `hub.challenge` value as **plain text** — not JSON, no
quotes — and only when `hub.verify_token` matches. Otherwise `403`.

**Status callback** — the POST body you will receive:

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
          "id": "wamid.HBgMOTE5…",       // ← correlate on this
          "status": "delivered",          // sent | delivered | read | failed
          "timestamp": "1755941400",      // unix seconds
          "recipient_id": "91XXXXXXXXXX",
          "errors": [{                    // present only when status = failed
            "code": 131026,
            "title": "Message undeliverable"
          }]
        }]
      }
    }]
  }]
}
```

Parse `entry[].changes[].value.statuses[]` — **all of them**; Meta batches multiple
statuses per POST. Ignore any `changes[]` whose `field` is not `messages`, and ignore
`value.messages[]` (inbound customer replies — not this phase, but they *will* arrive
if the customer replies, so the parser must not choke on them).

**Error codes worth special handling:** `131026` (undeliverable — not on WhatsApp),
`131047` (re-engagement required — outside 24h window), `132xxx` (template rejected/
mismatched). The existing `_PERMANENT_ERROR_CODES` / `_PERMANENT_ERROR_PREFIXES`
classification already covers the shape of this; extend it with `131047`.

**One correction to the brief:** you noted that phone number id + access token are all
that's needed. That is true for *sending*, and your pilot proved it. Webhooks need two
more from the Meta app you own: the **App Secret** (to verify `X-Hub-Signature-256`,
under App Settings → Basic) and a **verify token** you invent. Without the App Secret
the endpoint is publicly spoofable — anyone could POST fake "delivered" statuses at it.
Configuring Meta directly is what makes both of these yours to set; there is no
provider holding them on your behalf.

---

### 6b. The message template — ready to submit for approval

Submit in **WhatsApp Manager → Account tools → Message templates → Create template**.

| Setting | Value |
|---|---|
| **Name** | `job_completed_ready_for_pickup_v1` |
| **Category** | **Utility** |
| **Language** | English — see the `en` vs `en_US` warning below |

Category matters: this is a transactional update about a service the customer already
paid for, which is squarely **Utility**. Submitting it as Marketing invites rejection
and imposes marketing opt-in rules you do not want on a job-completion notice.

**Header** — type `Text`:

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

**Footer** (static — footers cannot contain variables):

```
Thank you for choosing us.
```

**Buttons:** none in v1. Deliberate — phone-number and static-URL buttons are fixed at
*template* level, so a single button cannot carry the right number for each branch, and
a wrong "Call us" button is worse than none. If you want a CTA later, the viable form is
a URL button with a dynamic suffix pointing at the existing public job-status page
(`/api/public/job-status` already backs it), submitted as a `_v2`.

#### Variable map

| Slot | Meaning | Source |
|---|---|---|
| Header `{{1}}` | Business Unit name | `security.bu.name` where `lower(code) = <schema>` |
| Body `{{1}}` | Customer name | `customer_contact.full_name` |
| Body `{{2}}` | Job number(s) | `job.job_no`, comma-joined across the customer's jobs |
| Body `{{3}}` | Device details | `product / brand / model`, as `GET_WHATSAPP_ELIGIBLE_JOBS_PAGED` already builds it |
| Body `{{4}}` | Branch name | `branch.name` |
| Body `{{5}}` | Amount payable, **including the ₹ symbol**; the literal `"No charge"` when the total is 0 | `SUM(job.amount)` across the grouped jobs |
| Body `{{6}}` | Branch contact | `branch.phone` |

#### Sample values (Meta requires one per variable at submission)

```
Header {{1}}  Kush Electronics
Body   {{1}}  Ramesh Kumar
Body   {{2}}  JOB-2026-00412
Body   {{3}}  Samsung / Refrigerator / RT28B
Body   {{4}}  Salt Lake
Body   {{5}}  ₹2,450.00
Body   {{6}}  033-4000-1234
```

#### Constraints this template has to respect

- **Variable values cannot contain newlines, tabs, or 4+ consecutive spaces.** Meta
  rejects the *send* (not the template) with a `132xxx` error. This is the trap for
  `{{2}}` and `{{3}}` in the multi-job case — see below.
- **Header text: 60 characters total, one variable maximum.** `"Service Update from "`
  spends 20, leaving 40 for the BU name. A longer BU name will be rejected at send
  time, so truncate defensively in code rather than trusting the data.
- **Body: 1024 characters** after substitution. **Footer: 60.**
- **Never start or end the body with a variable** — the layout above already complies;
  keep it that way if you edit the wording.
- **Language code must match exactly.** `templates.py` hardcodes `language="en"`. If you
  submit the template as **English (US)** it is approved as `en_US`, and sending with
  `en` fails every time with a template-not-found error. Either submit as plain
  **English**, or change the constant. This is a common and very confusing failure.

#### The multi-job case

The existing grouping sends **one message per customer**, which may cover several jobs.
That is correct behaviour and worth keeping, but it strains two slots:

- `{{2}}` job numbers — comma-join is fine for two or three; cap it. Suggest joining up
  to 3, then `"JOB-…-00412, JOB-…-00415 and 2 more"`.
- `{{3}}` device details — joining five device descriptions will blow the body limit and
  reads badly. Suggest: one job → the device string; more than one → `"3 items"`.

Both must be computed as **single-line strings**, per the newline rule above.

#### Code implications

1. **`TemplateSpec` needs a text-header concept.** Today it has `params: list[str]` and
   `has_document: bool` — no notion of header *variables*. It becomes roughly:

   ```python
   @dataclass
   class TemplateSpec:
       name: str
       language: str
       category: str              # "UTILITY"
       header_params: list[str]   # NEW — text-header variables
       body_params: list[str]     # renamed from `params`
       has_document: bool         # document header, unused by this template
   ```

   and `send_template()` gains a text-header component alongside the existing document
   one.

2. **The completion SQL must supply BU, branch, and contact.**
   `GET_JOBS_FOR_WHATSAPP_COMPLETION` currently selects neither branch nor BU. It needs
   `JOIN branch b ON b.id = j.branch_id` for `b.name` and `b.phone`, plus the BU name.
   The BU name comes from `security.bu` — a different schema in the same tenant DB,
   keyed on `lower(code) = <schema>`. It is one row per request and changes almost
   never, so read it once per send and cache it rather than joining it per job.

3. **Old and new template shapes coexist.** `JOB_COMPLETION` (3 body params, no header)
   is what the current code sends. The new template is 1 header + 6 body params. Land
   them as separate registry entries so the rebuild in §11-3 can switch over without a
   flag-day.

## 7. Client changes

Small and contained; the screen is already close.

**a. Selection rule** — `customer-connect-section.tsx:90` currently reads:

```ts
if (isRowSelectable(row) && (getCompletionState(row)?.success_count ?? 0) === 0)
```

That re-selects a row whose every past attempt *failed*. The brief wants any prior
attempt to unselect it:

```ts
const s = getCompletionState(row);
if (isRowSelectable(row) && ((s?.success_count ?? 0) + (s?.fail_count ?? 0)) === 0)
```

**b. Permanent notification.** Today the outcome is a `sonner` toast (auto-dismiss) plus
`SendResultsDialog`. The brief wants persistent. Add a dismissible banner
(`components/ui/alert.tsx` exists) pinned above the grid, surviving until the user
closes it — a webhook outcome lands *after* any toast would have vanished.

State it honestly in two stages, because that is what the system actually knows:
> *"12 messages dispatched to 9 customers. Awaiting delivery confirmation…"*
> then, as callbacks land: *"9 delivered · 2 pending · 1 failed (invalid number)"*

**c. Refresh for async outcomes.** Delivery lands seconds-to-minutes later. No
websocket/SSE infrastructure exists, so: after a send, poll the existing paged query
every ~5s for ~2 minutes, then stop and leave the manual **Refresh** button. Cheap,
no new infrastructure, and honest about being an approximation.

**d. Grid.** The `Msgs Sent` column and `MsgsSentBadge` stay, now fed by real delivery
state. Consider a `Delivery` column showing `last_status`.

---

## 8. Environment variables

New section for `.env.example` (placeholder keys only — you fill the real values in
your own untracked file):

```bash
# --- WhatsApp Cloud API (Meta, direct — no BSP) ---
# Phone number id + WABA id: Meta App Dashboard → WhatsApp → API Setup
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
# Access token: MUST be a System User permanent token (§6a-ii).
# The token shown on the API Setup page is temporary and expires in 24 hours.
WHATSAPP_ACCESS_TOKEN=
# Webhooks — App Settings → Basic (App Secret) + a verify token you invent
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
# Optional overrides; defaults live in whatsapp_settings.py
WHATSAPP_API_VERSION=v20.0
WHATSAPP_BASE_URL=https://graph.facebook.com
```

Note the existing `whatsapp_settings.py` indirection: `whatsapp_access_token_env`
holds the *name* of the variable holding the token, not the token. That is a
deliberate and good choice — keep it.

---

## 9. Interaction with the feature flag — read before starting

`WHATSAPP_FEATURE_ENABLED` was flipped to `true` in the previous task. That flag gates
**all four** flows, not just this one. Right now the job-creation, delivery, and
receipt buttons are live against the *old* REST path, which this plan leaves untouched.

Three ways to handle it, pick one before Phase 1 starts:

1. **Split the flag** into `WHATSAPP_COMPLETION_ENABLED` / `WHATSAPP_DOCUMENTS_ENABLED`
   so this phase ships without exposing the other three. *Recommended.*
2. **Flip back to `false`** until every flow is rebuilt. Safest, but blocks you from
   testing this phase in the real app.
3. **Leave as-is** and accept that the three PDF flows run on old code with
   API-accepted-means-success semantics.

---

## 10. Open questions

**Q1 — Which statuses are eligible?** The brief says "completed OK" and "ready and
final". `COMPLETED_OK` (11) is unambiguous. But `RETURN` (12) is named *"Ready to
return"* and is also `is_final` — and today's SQL includes it. Does "ready" mean
`RETURN` should stay eligible?
*Assumed unless you say otherwise:* **`COMPLETED_OK` only**, since the message text is
"repaired OK". This narrows current behaviour — jobs at `RETURN` would stop appearing.

**Q2 — Does a `read` receipt count as success?** Proposal: `DELIVERED` is success;
`READ` is recorded but doesn't change the count.

**Q3 — Resend policy.** A row with a prior *failure* starts unselected per the brief.
Should re-sending to a permanently-failed number (`131026`, not on WhatsApp) be
blocked outright rather than merely unselected?

**Q4 — Outbox retention.** `whatsapp_message` grows forever. Suggest a
`AUDIT_LOG_RETENTION_DAYS`-style prune, or partition by month.

**Q5 — 24-hour window.** Template messages are exempt from the 24h customer-service
window, so this flow is unaffected. (The `en` vs `en_US` language trap that used to sit
here is now covered properly in §6b.)

**Q6 — Amount when nothing is payable.** `{{5}}` is "Amount Payable". For a warranty or
zero-value job it renders `₹0.00`, which reads oddly on a collection notice. Options:
send `0.00` anyway, substitute `"No charge"`, or approve a second template without the
amount line. Cheapest is `"No charge"` as the substituted string — no second approval.

**Q7 — BU name length.** The 60-char text header leaves ~40 characters for the BU name
(§6b). Do any of your BU names exceed that? If so, decide between truncation and a
shorter display alias held alongside `security.bu.name`.

---

## 11. Suggested sequence

| Phase | Work | Verifiable by |
|---|---|---|
| **0** | *Meta-side, no code.* Swap to a System User permanent token (§6a-ii); subscribe the WABA to the app (§6a-i); **submit `job_completed_ready_for_pickup_v1` for approval (§6b)** | `GET /<WABA_ID>/subscribed_apps` lists your app; template shows **Approved** |
| **1** | `.env.example` keys, `whatsapp_settings.py` extension + docstring rename (§2a) | Server boots; settings resolve |
| **2** | `whatsapp_message` table + outbox module | Unit test against control DB |
| **2b** | Completion SQL gains branch name/phone + BU name lookup (§6b-2) | Query returns all 7 template inputs |
| **3** | `app/whatsapp/` package under Cloud-API naming; `TemplateSpec` header support; send path persists `wamid` | Real send; outbox row shows `ACCEPTED` + wamid |
| **4** | Webhook GET handshake | Meta dashboard "Verify and Save" succeeds |
| **5** | Webhook POST: signature, parse, settle, fan out to jobs | Real send → row reaches `DELIVERED` |
| **6** | Client: selection rule, banner, polling | End-to-end on one job |
| **7** | Narrow eligibility SQL per Q1 | Grid shows only intended statuses |
| **8** | Delete the superseded resolver + `notifications/whatsapp_*` | `tsc` + server tests green |

**Phase 0 is the first thing to do** — it needs no code, and each of its three steps
bites later if skipped: an expiring token takes sends down mid-week; a missing WABA
subscription means phase 5 receives nothing and looks like a code bug; and **template
approval is not instant** (typically minutes to a day, occasionally longer if it is
rejected and needs rewording). Submitting the template on day one means it is approved
by the time phase 3 needs it, instead of becoming the thing everyone waits on.

Phases 1–2 are safe to start before the §10 questions are answered; phase 7 depends
on Q1.

---

## 12. Note on the client toolchain

Unrelated to WhatsApp, but it will block verification: **ESLint cannot run in
`service-plus-client`.** `typescript-eslint@8.67.0` refuses TypeScript 7.0.2 —
*"typescript-eslint does not support TS 7.0"* — on every file, including untouched
ones. `tsc --noEmit` works. Worth fixing before a phase that touches this much client
code.
