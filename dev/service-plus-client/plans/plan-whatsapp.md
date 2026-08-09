# Customer Connect — WhatsApp Messaging on Job Completion

> Full design + execution plan. Covers `service-plus-client` (UI), `service-plus-server`
> (APIs, worker, provider layer), and the database schema.

---

## 0. Feature name

**Recommendation: "Customer Connect"** — menu entry `Jobs → Customer Connect`, internal module namespace
`notifications`.

The name has to survive the extensibility requirement (§13): today WhatsApp, tomorrow SMS/email/push, and a
provider that may be Meta or Twilio. A channel-specific name ("WhatsApp Messages") becomes a lie the moment
SMS ships, and renaming a menu item later costs help articles, access-right codes, and user habit.

| Candidate | Verdict |
|---|---|
| **Customer Connect** | ✅ Channel-neutral, customer-facing intent is obvious, reads well in a menu next to "Job Control" and "Deliver Job" |
| Message Center | Fine, but slightly inward-looking — sounds like an inbox, and this is outbound-only |
| Customer Alerts | "Alerts" implies problems; these are good-news messages |
| Notify Hub / Broadcast | "Broadcast" wrongly implies marketing blasts — these are transactional, one-to-one messages |
| WhatsApp Messages | ❌ Locks the name to one channel and one vendor |

Everything below uses **Customer Connect** for the user-facing feature and `notification_*` for database and
code identifiers (the DB should describe the mechanism, the menu should describe the job to be done).

---

## 1. Scope

A new client screen listing jobs eligible for a customer message, with a checkbox on every row (**checked by
default**), select-all, search, refresh, and one prominent **Send** button. Pressing Send hands the whole
selection to the server, which **enqueues** it and returns immediately; a background **worker** does the
actual provider calls, with live progress streamed back over a GraphQL subscription.

**One message event in this version:**

| Event | Which jobs qualify | Message |
|---|---|---|
| `JOB_COMPLETION` | `is_final = true`, `is_closed = false`, status not `CANCELLED`/`DISPOSED` | "Your job(s) are ready. Amount due ₹X." |

Job-delivery ("thank you for collecting") messages are **deferred to a later version** — see §11. The
`event_type` column and its CHECK still allow `JOB_DELIVERY` so adding it later is a template row and a
second SQL query, not a schema change.

**One message per customer.** A customer with three selected jobs receives a single message naming all three
— never three messages. This is a first-class concept in the schema (§3), not a UI-only convenience.

---

## 2. Workflow — end to end

```
 CLIENT                          SERVER (FastAPI)                    PROVIDER
 ───────                         ────────────────                    ────────
 Jobs → Customer Connect
   │
   │ genericQuery
   │  GET_NOTIFY_COMPLETION_JOBS_PAGED / _COUNT
   ├──────────────────────────────►  SQL over job + notification_message_job
   │◄──────────────────────────────  rows incl. msg_sent_count, last_sent_at, last_error
   │
 Grid renders (Job-Control shaped) — every row checked by default
   • already-sent rows: checked = false, "2 sent" badge
   • no/invalid mobile: checkbox disabled, reason in tooltip
   • header select-all (this page) + "select all N matching" link
   │
 Click  ┌────────────────────────────────────┐
        │  SEND MESSAGES  (12 jobs · 8 msgs) │   ← one big primary button
        └────────────────────────────────────┘
   │
   │ 1. subscribe notificationBatchProgress(db_name, batchId)   [opened first]
   │ 2. mutation queueNotificationBatch(db_name, schema, value)
   │        value = { branch_id, event_type, job_ids[], request_key }
   ├──────────────────────────────►
   │                                 ONE transaction:
   │                                   • group job_ids by customer_contact_id
   │                                   • INSERT notification_batch          (1 row)
   │                                   • INSERT notification_message        (1 per customer)
   │                                   • INSERT notification_message_job    (1 per job)
   │                                 returns { batch_id, message_count, job_count }
   │◄──────────────────────────────  (fast — no provider call in the request path)
   │
 Progress modal opens                WORKER (async task, always running)
   │                                   claim PENDING rows:
   │                                     FOR UPDATE SKIP LOCKED  ← multi-worker safe
   │                                   render body from template
   │                                   resolve provider from notification_provider
   │                                   ├──────────────────────────────────►  POST /messages
   │                                   │◄─────────────────────────────────   message_id | error
   │                                   on success: status=SENT, provider_message_id,
   │                                               bump job.*_msg_sent_count
   │                                   on failure: attempt_count++,
   │                                               next_attempt_at = backoff,
   │                                               FAILED after max_attempts
   │◄── pubsub ── notificationBatchProgress { total, sent, failed, current }
   │
 Progress bar updates live; on done:
   • all ok      → Sonner success
   • partial     → Sonner warning + failure panel listing customer + error detail
   • all failed  → Sonner error + failure panel
   • "Retry failed" button → retryNotificationMessages(batch_id)
   │
 Grid reloads → sent counts and Last Sent badges updated
```

**Why enqueue-then-work instead of sending inside the mutation:** 200 selected jobs is 200 HTTP round trips
to Meta. Inside a request that is a multi-minute hang, a proxy timeout, and no record of what got sent when
it dies halfway. With an outbox table the mutation is a single INSERT transaction that either fully commits
or fully rolls back; every message has a durable row, so a server restart mid-send resumes instead of losing
or duplicating work.

---

## 3. Database design

### 3a. Where each table lives

- **Per-BU tenant schema** (added to `service-plus-server/app/db/sql/sql_bu_admin_ddl.py`, next to `job_*`):
  the operational tables — batches, messages, message↔job links, webhook events.
- **`public` schema of the platform DB**: templates and providers, because Super Admin owns them
  (§10, §12) and because Meta template approval and the sending phone number belong to one platform-level
  WhatsApp Business Account, not to each tenant.

There is no migration runner in this codebase — new-tenant DDL is applied at provisioning
(`app/graphql/resolvers/bu_admin/provisioning.py`), and existing live schemas need the DDL hand-applied,
then `service_plus_service.sql` re-extracted via `python -m app.db.tools.extract_schema`. Budget that step.

### 3b. `notification_batch` — one row per Send click

```sql
CREATE TABLE notification_batch (
    id                bigint NOT NULL,
    branch_id         bigint NOT NULL REFERENCES branch(id),
    event_type        text   NOT NULL,                       -- JOB_COMPLETION (JOB_DELIVERY reserved, §11)
    channel           text   NOT NULL DEFAULT 'WHATSAPP',    -- WHATSAPP | SMS | EMAIL
    provider_code     text   NOT NULL,                       -- snapshot of provider used
    template_code     text   NOT NULL,
    request_key       text   NOT NULL,                       -- client-generated uuid → idempotency
    status            text   NOT NULL DEFAULT 'QUEUED',      -- QUEUED|RUNNING|COMPLETED|COMPLETED_WITH_ERRORS|FAILED
    total_messages    integer NOT NULL DEFAULT 0,
    sent_count        integer NOT NULL DEFAULT 0,
    failed_count      integer NOT NULL DEFAULT 0,
    total_jobs        integer NOT NULL DEFAULT 0,
    requested_by      bigint,                                -- security."user".id
    created_at        timestamptz NOT NULL DEFAULT now(),
    started_at        timestamptz,
    finished_at       timestamptz,
    -- JOB_DELIVERY is allowed by the CHECK from day one even though nothing emits it yet: widening a
    -- CHECK later would mean a hand-applied ALTER on every live schema, and it costs nothing to allow now.
    CONSTRAINT notification_batch_event_check  CHECK (event_type IN ('JOB_COMPLETION','JOB_DELIVERY')),
    CONSTRAINT notification_batch_status_check CHECK (status IN ('QUEUED','RUNNING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED')),
    CONSTRAINT notification_batch_request_key_uidx UNIQUE (request_key)
);
```

`request_key` unique is the **double-click guard**: the client generates one uuid per Send press, so a
retried or duplicated mutation collides instead of queueing the batch twice.

### 3c. `notification_message` — the outbox, one row per customer per batch

```sql
CREATE TABLE notification_message (
    id                  bigint NOT NULL,
    batch_id            bigint NOT NULL REFERENCES notification_batch(id) ON DELETE CASCADE,
    customer_contact_id bigint NOT NULL REFERENCES customer_contact(id),
    channel             text   NOT NULL DEFAULT 'WHATSAPP',
    provider_code       text   NOT NULL,
    template_code       text   NOT NULL,
    to_address          text   NOT NULL,          -- E.164, e.g. +919876543210
    template_params     jsonb  NOT NULL,          -- ordered params for the approved template
    rendered_body       text   NOT NULL,          -- exactly what the customer sees; audit trail
    status              text   NOT NULL DEFAULT 'PENDING',
                        -- PENDING|CLAIMED|SENT|DELIVERED|READ|FAILED|SKIPPED
    attempt_count       smallint NOT NULL DEFAULT 0,
    max_attempts        smallint NOT NULL DEFAULT 3,
    next_attempt_at     timestamptz NOT NULL DEFAULT now(),
    claimed_at          timestamptz,
    claimed_by          text,                     -- worker id: host:pid — for stuck-row forensics
    provider_message_id text,                     -- Meta wamid / Twilio SID → webhook correlation
    error_code          text,
    error_message       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_message_status_check
        CHECK (status IN ('PENDING','CLAIMED','SENT','DELIVERED','READ','FAILED','SKIPPED'))
);

-- The worker's claim query rides this index; partial so it stays tiny as SENT rows accumulate.
CREATE INDEX notification_message_claim_idx
    ON notification_message (next_attempt_at, id)
    WHERE status IN ('PENDING','CLAIMED');

CREATE INDEX notification_message_batch_idx    ON notification_message (batch_id);
CREATE INDEX notification_message_provider_idx ON notification_message (provider_message_id);
```

`rendered_body` is stored, not recomputed: templates change (§10), and six months from now "what exactly did
we tell this customer" must be answerable from the row itself.

### 3d. `notification_message_job` — the link table that makes batching first-class

```sql
CREATE TABLE notification_message_job (
    id          bigint NOT NULL,
    message_id  bigint NOT NULL REFERENCES notification_message(id) ON DELETE CASCADE,
    job_id      bigint NOT NULL REFERENCES job(id),
    amount      numeric(12,2) NOT NULL DEFAULT 0,   -- job.amount snapshot at queue time
    CONSTRAINT notification_message_job_uidx UNIQUE (message_id, job_id)
);

CREATE INDEX notification_message_job_job_idx ON notification_message_job (job_id);
```

This is the **N-jobs-to-one-message** relation. It is also the authoritative source for the per-job sent
count the screen displays:

```sql
SELECT nmj.job_id, count(*) FILTER (WHERE nm.status IN ('SENT','DELIVERED','READ')) AS sent_count
FROM notification_message_job nmj
JOIN notification_message nm ON nm.id = nmj.message_id
GROUP BY nmj.job_id;
```

### 3e. Counter columns on `job` — for the grid's "Msgs Sent" column

The aggregate above is correct but joins two tables on every paged grid load. Denormalize the two numbers
the grid actually shows, written by the worker in the same transaction that marks a message `SENT`:

```sql
ALTER TABLE job ADD COLUMN completion_msg_sent_count   smallint    NOT NULL DEFAULT 0;
ALTER TABLE job ADD COLUMN completion_msg_last_sent_at timestamptz;
```

Deliberately **channel-neutral names** (`msg`, not `whatsapp`) so adding SMS later increments the same
counters, with the per-channel breakdown living in `notification_message`. They are **event-scoped**, so the
deferred delivery message (§11) adds its own pair — `delivery_msg_sent_count` / `delivery_msg_last_sent_at`
— rather than muddling these. Both columns are a cache: a `REBUILD_NOTIFICATION_COUNTERS` maintenance SQL
recomputes them from §3d if they ever drift.

### 3f. `public.notification_template` — Super-Admin-owned message templates

```sql
CREATE TABLE public.notification_template (
    id                     bigint NOT NULL,
    code                   text NOT NULL,          -- JOB_COMPLETION (JOB_DELIVERY later, §11)
    channel                text NOT NULL,          -- WHATSAPP | SMS | EMAIL
    provider_code          text,                   -- NULL = applies to any provider
    provider_template_name text,                   -- Meta-approved name, e.g. job_completion_v1
    language_code          text NOT NULL DEFAULT 'en',
    body_text              text NOT NULL,          -- placeholder form, drives preview + non-template channels
    param_map              jsonb NOT NULL,         -- ordered: ["name","job_nos","amount","branch"]
    is_active              boolean NOT NULL DEFAULT true,
    version                integer NOT NULL DEFAULT 1,
    updated_at             timestamptz NOT NULL DEFAULT now(),
    updated_by             bigint,
    CONSTRAINT notification_template_uidx UNIQUE (code, channel, provider_code, language_code)
);
```

`param_map` is the load-bearing field: WhatsApp templates are approved by Meta with a **fixed number and
order** of `{{1}}…{{n}}` slots. `param_map` names each slot, so the renderer fills them positionally and the
Super Admin editor can validate that the body's placeholder count matches the approved template before
saving. Changing wording after Meta approval requires re-approval — the editor must say so (§10).

### 3g. `public.notification_provider` — swapping Meta ↔ Twilio ↔ a new number

```sql
CREATE TABLE public.notification_provider (
    id           bigint NOT NULL,
    code         text NOT NULL,        -- META_CLOUD | TWILIO | MSG91
    display_name text NOT NULL,
    channel      text NOT NULL,        -- WHATSAPP | SMS
    config       jsonb NOT NULL,       -- {phone_number_id, waba_id, api_version, base_url, from_number, ...}
    secret_ref   text NOT NULL,        -- NAME of the env var holding the token — never the token itself
    is_active    boolean NOT NULL DEFAULT true,
    is_default   boolean NOT NULL DEFAULT false,
    rate_limit_per_sec integer NOT NULL DEFAULT 10,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notification_provider_code_uidx UNIQUE (code, channel)
);

CREATE UNIQUE INDEX notification_provider_default_uidx
    ON public.notification_provider (channel) WHERE is_default = true;
```

This table **is** the answer to "I may change my Meta mobile number or move to Twilio" (§13):

- **New Meta number** → edit `config.phone_number_id` on the `META_CLOUD` row. No deploy.
- **Switch to Twilio** → flip `is_default` to the `TWILIO` row. No deploy.
- **Rotate a token** → change the env var named by `secret_ref` and restart.

Secrets stay in `.env` (loaded via a new `notification_settings.py` following the existing
`app/core/settings/email_settings.py` shape); the DB stores only the *name* of the variable, so a database
dump never leaks a provider token.

### 3h. `notification_webhook_event` — delivery receipts (phase 2, table defined now)

```sql
CREATE TABLE notification_webhook_event (
    id                  bigint NOT NULL,
    provider_code       text NOT NULL,
    provider_message_id text NOT NULL,
    status              text NOT NULL,        -- DELIVERED | READ | FAILED
    raw_payload         jsonb NOT NULL,
    received_at         timestamptz NOT NULL DEFAULT now(),
    processed_at        timestamptz
);
```

All tables get the `ALTER TABLE … ADD GENERATED ALWAYS AS IDENTITY` block that every other table in
`sql_bu_admin_ddl.py` has.

---

## 4. The worker

### 4a. What exists to build on

`service-plus-server` has **APScheduler** (`app/scheduler.py`, started from `app/main.py`) and an in-process
async **pubsub** (`app/graphql/pubsub.py`). It has **no Celery, no Redis, no external queue** — confirmed in
`requirements.txt`. So the worker is an **asyncio task inside the FastAPI process, fed by the Postgres
outbox table**, with APScheduler as the safety net.

### 4b. Design

```python
# app/notifications/worker.py
CLAIM_SQL = """
UPDATE notification_message SET status = 'CLAIMED', claimed_at = now(), claimed_by = %(worker_id)s
WHERE id IN (
    SELECT id FROM notification_message
    WHERE status = 'PENDING' AND next_attempt_at <= now()
    ORDER BY id
    FOR UPDATE SKIP LOCKED          -- ← the whole scalability story is this line
    LIMIT %(batch_size)s
)
RETURNING *;
"""
```

`FOR UPDATE SKIP LOCKED` means two workers claiming concurrently take **disjoint** rows. That is what lets
this scale from one uvicorn process today to N processes or a separate worker container later **with no
redesign** — you run more copies of the same loop.

Loop, per tick:
1. Claim up to `batch_size` (default 25) messages, oldest first.
2. Send them concurrently under an `asyncio.Semaphore` sized from
   `notification_provider.rate_limit_per_sec`.
3. Per message: on success → `status='SENT'`, store `provider_message_id`, bump the `job` counters for its
   linked jobs (§3e), all in one transaction. On failure → `attempt_count++`,
   `next_attempt_at = now() + backoff(attempt_count)` (exponential: 1m, 5m, 25m), `status` back to
   `'PENDING'`, or `'FAILED'` once `attempt_count >= max_attempts`.
4. Distinguish **permanent** from **transient** failures — an invalid number or a rejected template is
   `FAILED` immediately with no retry; a 5xx/timeout/429 retries. Retrying a permanent error 3× just delays
   the truth reaching the user.
5. Recompute and publish batch progress to pubsub.
6. When a batch has no non-terminal messages left → `COMPLETED` / `COMPLETED_WITH_ERRORS` / `FAILED`,
   `finished_at = now()`, publish a final `done: true` event.

**Triggering.** The mutation publishes an in-process wake-up so the worker starts within milliseconds rather
than waiting for the next poll. Two independent safety nets:
- The loop also polls on an interval (default 5s) — so a missed wake-up costs latency, not correctness.
- An **APScheduler sweeper** every 5 minutes releases rows stuck in `CLAIMED` for more than 10 minutes
  (`status='PENDING'` again) — this is what makes a mid-send process crash self-healing.

**Multi-tenancy.** Every claim runs per `db_name`/`schema`, reusing the existing
`GET_ACTIVE_CLIENTS` / `GET_ACTIVE_SCHEMAS` loop shape from `app/scheduler.py:run_monthly_snapshot`.

### 4c. Known limit, stated plainly

`pubsub.py` is **in-memory**. Live progress therefore only reaches a client connected to the same process
that ran the worker. With today's single-process deployment that is fine. If the app is ever scaled to
multiple uvicorn workers, progress must move to Postgres `LISTEN/NOTIFY` or Redis pub/sub — the
*sending* stays correct either way, because correctness lives in the outbox table, not in the event stream.
The progress modal already treats events as best-effort and falls back to polling the batch row.

---

## 5. Provider abstraction (extensibility)

```
app/notifications/
    __init__.py
    worker.py                 # claim loop, retry/backoff, progress publishing
    queue_service.py          # queue_batch(), retry_messages(), batch_status()
    renderer.py               # template + params → rendered_body, placeholder cap logic
    providers/
        base.py               # NotificationProvider protocol + OutboundMessage/ProviderResult
        meta_cloud.py         # Meta WhatsApp Cloud API
        twilio.py             # Twilio WhatsApp/SMS
        registry.py           # code → implementation, resolved from notification_provider row
```

```python
# app/notifications/providers/base.py
class ProviderResult(TypedDict):
    provider_message_id: str | None
    ok:                  bool
    error_code:          str | None
    error_message:       str | None
    permanent:           bool          # True → do not retry

class NotificationProvider(Protocol):
    channel: str
    async def send(self, msg: OutboundMessage) -> ProviderResult: ...
    async def health_check(self) -> bool: ...
```

Adding a channel or vendor is: one file implementing `send()`, one row in `notification_provider`, one entry
in the registry. Nothing in the worker, the schema, or the UI changes. `httpx` is already a pinned dependency
— no new package for the HTTP side.

**Meta Cloud API specifics** to encode in `meta_cloud.py`: `POST
{base_url}/{api_version}/{phone_number_id}/messages`, bearer token from the env var named by `secret_ref`,
body `{"messaging_product":"whatsapp","to":…,"type":"template","template":{"name":…,"language":{"code":…},
"components":[{"type":"body","parameters":[{"type":"text","text":…}]}]}}`, response `messages[0].id` is the
`wamid`. Error `code`/`message` from `error` map to `error_code`/`error_message`; `131026`/`132xxx`
(undeliverable / template problems) are **permanent**.

---

## 6. API surface

### Client → Server

| Operation | Kind | Purpose |
|---|---|---|
| `GET_NOTIFY_COMPLETION_JOBS_PAGED` / `_COUNT` | `genericQuery` | The grid |
| `GET_NOTIFY_JOB_IDS_MATCHING` | `genericQuery` | ids-only, powers "select all N matching" |
| `GET_NOTIFY_MESSAGES_BY_JOB` | `genericQuery` | per-job message history drawer |
| `GET_NOTIFY_BATCHES_PAGED` / `_COUNT` | `genericQuery` | Batch history — SQL defined now, no screen in this version |
| `queueNotificationBatch` | mutation | Enqueue a batch, return `batch_id` |
| `retryNotificationMessages` | mutation | Reset chosen `FAILED` messages to `PENDING` |
| `notificationBatchProgress` | subscription | Live progress |
| `notificationTemplates` / `saveNotificationTemplate` | query / mutation | Super Admin templates |
| `notificationProviders` / `saveNotificationProvider` | query / mutation | Super Admin providers |
| `sendTestNotification` | mutation | Super Admin "send me a test" |

All mutations use the house envelope `($db_name: String!, $schema: String, $value: String!)`; all reads that
are plain SQL go through `genericQuery` rather than bespoke resolvers.

`queueNotificationBatch` decoded `value`:

```jsonc
{
  "branch_id":   1,
  "event_type":  "JOB_COMPLETION",
  "job_ids":     [101, 102, 145],
  "request_key": "5f2c…"          // uuid, idempotency key
}
```

Returns `{ "batch_id": 88, "message_count": 2, "job_count": 3, "skipped": [{ "job_id": 145, "reason": "NO_MOBILE" }] }`.

The server — not the client — groups `job_ids` by `customer_contact_id`, renders bodies, and picks the
provider. The client's grouping is **preview only**; the authoritative grouping happens once, server-side,
inside the transaction that writes the outbox.

---

## 7. Client UI

New folder `src/features/client/components/jobs/customer-connect/`:

| File | Role |
|---|---|
| `customer-connect-section.tsx` | Screen shell: toolbar, selection state, send orchestration |
| `customer-connect-schema.ts` | Types (`NotifyJobRow`, `NotifyBatchProgressType`, …) |
| `customer-connect-helpers.ts` | Grouping, mobile eligibility, preview render, `PAGE_SIZE`, `thClass`/`tdClass` |
| `customer-connect-grid.tsx` | Job-Control-shaped grid + checkbox column |
| `send-messages-modal.tsx` | Pre-send confirmation: per-customer message preview |
| `send-progress-modal.tsx` | Live progress bar + failure list + Retry failed |
| `job-message-history-drawer.tsx` | Per-job message log (what was sent, when, errors) |
| `queue-notification-batch.ts` | Mutation call + subscription wiring |

**Grid columns** — mirroring `job-control-section.tsx:682-691` exactly, plus two:

```
[☑]  #  Date  Job No  Customer  Mobile  Device Details  Job Type  Status  Amount  Msgs Sent  Actions
```

`Msgs Sent` shows `completion_msg_sent_count` as a badge — `—` when zero, sky badge
`2 · 08-Aug` when sent, plus a small amber warning icon when the last attempt for that job failed, with the
provider error in the tooltip and the full history in the drawer.

**Selection rules:**
- Every eligible row starts **checked**.
- Rows already messaged start **unchecked** but remain selectable — a resend must be deliberate.
- Rows with no/invalid mobile (`isValidMobile` from `@/lib/mobile.ts`) are **disabled and unchecked**, muted
  styling with a tooltip reason — not red, since this is not an error.
- Header checkbox = select/deselect **this page** (tri-state). Next to it, when a filter is active, a link
  "Select all N matching" fetches ids via `GET_NOTIFY_JOB_IDS_MATCHING`.
- **Selection persists across pages and search changes** — it is a `Set<number>` of job ids, not page state.
  The Send button always reads `N jobs · M customers`, computed from the full selection, so the "one message
  per customer" promise is visible before pressing it.

**Toolbar** copies the Job Control bar (`job-control-section.tsx:568-648`): icon + title + count, search
input with clear button (debounced `SEARCH_DEBOUNCE_MS`), Refresh. The send button sits on the
right, deliberately oversized and emerald:

```
┌──────────────────────────────────────────┐
│  ✈  SEND MESSAGES   ·  12 jobs · 8 msgs  │      h-10, font-bold, emerald-600
└──────────────────────────────────────────┘
```

Disabled with an explanatory `title` when nothing is selected or WhatsApp is not configured.

**Failure visibility** (explicit requirement): three layers — the progress modal's failure list (customer,
mobile, error message, error code) with a Retry failed button; a persistent per-row warning badge in the
grid; and the per-job history drawer showing every attempt with its error. Red is used here and only here,
because these are genuine errors.

---

## 8. Steps of execution

### Step 1 — Database DDL
Add §3b–§3e to `sql_bu_admin_ddl.py` (tenant tables + `job` counter columns) and §3f–§3g to the public-schema
DDL. Add identity blocks and indexes. Seed the `JOB_COMPLETION` `notification_template` row and one
`notification_provider` row for `META_CLOUD` in `seed_bu_data.py` / public seed. Re-extract
`service_plus_service.sql`; hand-apply to existing live schemas.

### Step 2 — Server settings + provider layer
`app/core/settings/notification_settings.py` (following `email_settings.py`): `whatsapp_api_token`,
`twilio_account_sid`, `twilio_auth_token`, `notification_worker_enabled`, `notification_poll_seconds`,
`notification_claim_batch_size`. Add to the `Settings` chain in `app/config.py`. Then
`app/notifications/providers/{base,meta_cloud,twilio,registry}.py` per §5.

### Step 3 — Renderer
`app/notifications/renderer.py`: template lookup by `(code, channel, provider_code, language_code)`,
placeholder substitution from `param_map`, job-list cap at 3 (`"JC-101, JC-102, JC-103 and 2 more"`) so one
approved template covers any batch size, and the warranty case (`amount = 0` → "no charges — covered under
warranty" rather than "₹0").

### Step 4 — Queue service + worker
`app/notifications/queue_service.py` (`queue_batch`, `retry_messages`, `batch_status`) and
`worker.py` per §4. Start the worker task in `app/main.py` lifespan next to `start_scheduler()`; register the
stuck-row sweeper in `app/scheduler.py`.

### Step 5 — Server SQL + GraphQL
New SQL constants in `app/db/sql/sql_jobs.py` (grid queries, ids-only query, per-job history, batch history,
counter rebuild). New resolvers in `app/graphql/resolvers/jobs/mutations.py`
(`queueNotificationBatch`, `retryNotificationMessages`) and `subscription.py`
(`notificationBatchProgress`, modeled on the existing `accountsPostingProgress`). Super Admin
template/provider resolvers in `query.py` / `mutation.py`. Update the SDL schema file.

### Step 6 — Client constants
`sql-map.ts`: the five `GET_NOTIFY_*` ids. `graphql-map.ts`: `queueNotificationBatch`,
`retryNotificationMessages`, `notificationBatchProgress`, `notificationTemplates`,
`saveNotificationTemplate`, `notificationProviders`, `saveNotificationProvider`, `sendTestNotification`.
`messages.ts`: a `// Customer Connect` block — `ERROR_NOTIFY_JOBS_LOAD_FAILED`, `ERROR_NOTIFY_QUEUE_FAILED`,
`ERROR_NOTIFY_RETRY_FAILED`, `ERROR_NOTIFY_TEMPLATE_SAVE_FAILED`, `INFO_NOTIFY_NOT_CONFIGURED`,
`INFO_NOTIFY_NO_ELIGIBLE_JOBS`, `INFO_NOTIFY_NO_MOBILE`, `INFO_NOTIFY_ALREADY_SENT`,
`SUCCESS_NOTIFY_BATCH_QUEUED`, `SUCCESS_NOTIFY_ALL_SENT`, `WARN_NOTIFY_PARTIAL_SEND`.
`access-rights.ts`: `JOBS_CUSTOMER_CONNECT`; add the matching row to `seed-roles-dialog.tsx`.

### Step 7 — Menu + routing
`client-explorer-panel.tsx` → `JobsExplorer()`: `<TreeItem icon={MessageCircle} label="Customer Connect"
disabled={!canCustomerConnect} helpArticleId="customer-connect" />`, placed after `Deliver Job`.
`client-jobs-page.tsx`: `case "Customer Connect": return <CustomerConnectSection />;`.

### Step 8 — Types and helpers
`customer-connect-schema.ts` and `customer-connect-helpers.ts` per §7 — `type` not `interface`, members
sorted alphabetically, helpers as normal functions sorted alphabetically.

### Step 9 — Grid
`customer-connect-grid.tsx`: the Job-Control column set plus checkbox and Msgs Sent, shadcn `Checkbox`,
tri-state header, `motion.tr` entrance, sticky header, sticky Actions column, the `window.innerHeight`
max-height calc from `finalized-jobs-grid.tsx:52-63`, and the standard pagination footer. Responsive:
`overflow-x-auto`, secondary columns collapse into the Job No cell's stacked layout below `md`.

### Step 10 — Section container
`customer-connect-section.tsx`: toolbar, debounced search, paged loads via `apolloClient.query` +
`graphQlUtils.buildGenericQueryValue` + `Promise.allSettled` (the `final-a-job-section.tsx:257-286` shape),
cross-page `Set<number>` selection, config gate (no active provider/template → informational panel using
`INFO_NOTIFY_NOT_CONFIGURED`, no grid).

### Step 11 — Send flow
`send-messages-modal.tsx` (per-customer preview, drop-a-customer, confirm) →
`queue-notification-batch.ts` (open subscription **first**, then fire the mutation, exactly as
`accounts-posting-section.tsx:117-133` does) → `send-progress-modal.tsx` (progress bar, live counts,
failure list, Retry failed). Toast outcomes via Sonner: success / warning-partial / error.

### Step 12 — Per-job history drawer
`job-message-history-drawer.tsx` over `GET_NOTIFY_MESSAGES_BY_JOB`: every message covering that job, its
status, attempt count, rendered body, provider message id, and error detail.

### Step 13 — Super Admin: templates + providers
New page `features/super-admin/pages/notifications-page.tsx`, sidebar entry "Notifications"
(`sidebar.tsx:30-34` list, plus a `ROUTES.superAdmin.notifications` route). Two tabs:
- **Templates** — one card per `(code, channel)` row, so this version renders a single `JOB_COMPLETION`
  card and needs no change when the delivery template is added; `react-hook-form` + `zod`; fields: provider template name,
  language, body (Textarea), ordered `param_map` builder; **live preview** with sample data; validation that
  the body's placeholder count equals `param_map.length`; a prominent note that changing wording requires
  re-approval from Meta; mandatory-field `*` in red (the one sanctioned red), all controls neutral-colored.
- **Providers** — rows from `notification_provider`; edit `config` (phone number id, base url, from number),
  `rate_limit_per_sec`, toggle `is_active`, and a **"Make default"** action — the one-click Meta↔Twilio
  switch. `secret_ref` is shown as the env var *name*, read-only, never the value. A **Send test message**
  button calls `sendTestNotification`.

### Step 14 — Help system
`features/client/components/help/help-content.ts`: new article `id: "customer-connect"` (category Jobs,
after `deliver-job`) — what the screen does, which jobs appear and why, default-checked behaviour,
one-message-per-customer, why rows are disabled, what Msgs Sent means, how to read failures and retry, and
that wording is Super-Admin-owned. State plainly that this version messages customers **when a job is
finalized and ready for pickup only** — there is no message on delivery yet — so staff don't wait for one.
FAQs: "Why didn't a customer get a message?", "Why did three jobs produce
one message?", "Can I resend?", "Why is the screen greyed out?". Cross-link from `finalize-job` and
`deliver-job`. `features/super-admin/components/help/dev-help-content.ts`: an article covering the outbox
table, the claim query, retry/backoff, and how to add a provider.

### Step 15 — Verification
`pnpm lint` and `pnpm build` clean. Manual: not-configured gate; grid loads; select-all page vs
select-all-matching; selection survives paging and search; a 3-job customer previews as one message; queue
returns instantly; progress bar advances; forced provider failure shows the error and retries; counters and
badges update after reload; double-clicking Send does not double-queue (same `request_key`); killing the
server mid-batch and restarting resumes the remaining messages. Responsive at ~375px, ~768px, ~1440px.

---

## 9. Rollout order

1. DDL + seeds (Step 1) — safe, additive, deployable alone.
2. Provider + renderer + worker with `notification_worker_enabled = false` (Steps 2–4).
3. Server APIs (Step 5).
4. Meta: register the WhatsApp Business number and submit `job_completion_v1` for approval. **Do this early
   — approval is measured in days, and approved wording cannot be edited without re-approval.** Also
   complete TRAI/DLT registration if SMS is ever enabled.
5. Client screen (Steps 6–12) against a sandbox number.
6. Super Admin screens (Step 13) + help (Step 14).
7. Enable the worker for one pilot BU, watch `notification_message` for a few days, then roll out.

---

## 10. Conventions this plan commits to

- shadcn components throughout; framer-motion for row/modal transitions; Sonner for every toast.
- **Red only for errors** — send failures and mandatory-field `*`. Emerald = send/success, sky = already
  sent, amber = warning/ineligible.
- `genericQuery` for all reads; real resolvers only for queue/retry/subscription/Super-Admin writes, which
  cannot be expressed as CRUD. Mutation params always `($db_name: String!, $schema: String, $value: String!)`.
- Every multi-word user-facing string in `constants/messages.ts`; control labels hard-coded inline.
- Components/hooks as arrow functions; helpers and API functions as normal functions; alphabetical sorting of
  functions, object properties, and type members; `type` over `interface`; `…Type` suffix on type names;
  explicit named imports (no `index.ts` re-exports); `useAppSelector`/`useAppDispatch`;
  `apolloClient.query(...)` directly; `react-hook-form` + `zod` for the Super Admin forms.
- No new Redux slice — the screen owns local state; context comes from existing `context-slice` /
  `auth-slice` selectors.

---

## 11. Deliberately out of scope

- **Job-delivery messages** ("thank you for collecting your item") — cut from this version. The design
  already reserves every seam it needs, so adding it later is additive work, not rework:
  1. `INSERT` a `JOB_DELIVERY` row into `public.notification_template` (no DDL — the Super Admin editor
     then renders a second card automatically).
  2. Two new SQL ids, `GET_NOTIFY_DELIVERY_JOBS_PAGED` / `_COUNT`, filtering `is_closed = true`.
  3. One hand-applied `ALTER TABLE job ADD COLUMN delivery_msg_sent_count smallint NOT NULL DEFAULT 0,
     ADD COLUMN delivery_msg_last_sent_at timestamptz;` per live schema.
  4. A tab switcher on the section, passing `event_type` through to the queue mutation.

  The `event_type` column, its CHECK, the worker, the provider layer, the outbox, and the whole send/retry
  path are already event-agnostic and need no change.
- **Delivery/read receipts** — `notification_webhook_event` (§3h) and the `DELIVERED`/`READ` statuses exist
  so the webhook endpoint can be added without touching the schema, but the endpoint itself is phase 2.
- **Inbound WhatsApp** (customer replies, chatbot) — outbound only.
- **Scheduled/automatic sending** — this screen is staff-triggered by design. The worker and outbox are
  already shaped so a scheduled trigger can enqueue batches later with no rework.
- **Per-customer opt-out** (`customer_contact.whatsapp_opt_in`) — one extra clause in the eligibility helper
  and one more disabled-reason when it lands.
- **Per-tenant provider credentials** — `notification_provider` is platform-level; a `bu_id` column and a
  resolution fallback would make it per-tenant when a client wants their own branded number.
- **SMS/email channels** — the `channel` column, provider protocol, and channel-neutral job counters are all
  in place; shipping SMS is a provider implementation plus a template row.
