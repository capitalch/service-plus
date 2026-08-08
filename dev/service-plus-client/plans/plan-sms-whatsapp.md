# SMS / WhatsApp Job-Completion Notifications — Design

## 1. Context

**The ask.** When a customer's repair job is completed and its charges are known, the customer should get an SMS and/or WhatsApp message telling them the job is done and what they owe (if anything). If a customer has **several jobs finish close together**, they get **one combined message**, not one per job — mirroring how this codebase already combines multiple jobs into a single artifact elsewhere (`fetchDeliveryNoteJobsByIds` in `deliver-job/fetch-delivery-note-jobs.ts` already batches N `job_id`s into one delivery note/PDF for one customer; the notification batching is the same idea applied to messaging).

**What "completion" means in this codebase — this is the load-bearing finding of the research.** There is no single `job_status_id` that means "done and billed." Grepping the actual save paths shows:

- **"Final a Job"** (`final-a-job/finalize-job-save.ts`) is a *distinct* step from the Job Control status pipeline. It writes `job.is_final = true` and computes `job.amount` as the true line total of parts + additional charges (`computedTotal` at `finalize-job-save.ts:168-174`) via a **direct `genericUpdate` mutation** — it does not go through `resolve_update_job_helper` or `resolve_deliver_job_helper` in `service-plus-server/app/graphql/resolvers/jobs/mutations.py`.
- `resolve_update_job_helper`'s own comment says it plainly (`mutations.py:266-268`): *"is_final is intentionally left to the client because it is set in a separate 'Final the Job' step."*
- Job Control (`job-control-section.tsx`) can independently push `job_status_id` to `COMPLETED_OK` (11) via `resolve_update_job_helper`, and delivery (`resolve_deliver_job_helper`) closes the job later, separately, when the customer actually picks it up. **Charges are not necessarily known yet at either of those points** — `job.amount` is only authoritative once Finalize has run.
- There's also a real drift in the codebase worth flagging (not fixing here): the server's `_STATUS_FLAGS[11]` (`mutations.py:340`) says `COMPLETED_OK` implies `is_final: True`, but the client's `STATUS_FLAGS[11]` (`status-transitions.ts:23`) says `is_final: false` for the same status. Neither is actually what sets `is_final` in practice — only Finalize does. This is exactly why the design below **does not hook any status code**; it hooks the `is_final` column itself.

**Conclusion:** "job completion with charges" = **the moment `job.is_final` flips `false → true`**, for any job whose resulting status is not `CANCELLED` or `DISPOSED` (those are also `is_final = true` in principle, but a cancelled/disposed job is not a "your item is ready, here's what you owe" event — the trigger excludes them explicitly). At that instant `job.amount` is the settled charge for that job. Delivery and invoicing happen afterward and are out of scope for *this* message (see §9 for the optional Phase 2 delivery/thank-you message).

**Why a DB trigger, not an application hook.** `is_final` is written from at least one place today (`finalizeJobSave`) and, per the resolver comments, is architecturally meant to be settable elsewhere later. Rather than instrumenting every call site (and re-instrumenting every future one), the enqueue logic goes into a **Postgres `AFTER UPDATE` trigger on `job`**, in the same hand-maintained-DDL style as the rest of the schema (`app/db/sql/sql_bu_admin_ddl.py`). This is robust to *how* `is_final` gets set — batch finalize, a future bulk action, a manual SQL fix — it always fires.

**Scope — three repos, same monorepo layout `plan-parts-on-web.md` used:**
- **`service-plus-server`** — new tenant-schema tables + trigger, new settings classes, a provider client, a scheduled digest sender, new GraphQL surface for staff to view/retry sends and manage templates.
- **`service-plus-client`** — customer opt-in fields, a notification-settings screen, a sent-notifications log/audit screen, small status affordances on the Jobs/Final-a-Job grids.
- **`service-plus-web`** — not touched by this design; the message body may eventually link to a public tracking page there, but no such route exists yet (checked: `service-plus-web/app/` has no `track` route today), so this stays a plain-text mention, not a hyperlink, until that page ships.

No migration runner exists in this codebase (confirmed the same way `plan-parts-on-web.md` did) — new-tenant DDL is applied wholesale at provisioning time (`app/graphql/resolvers/bu_admin/provisioning.py`), and **existing live schemas need the new tables/trigger hand-applied**, plus `service_plus_service.sql` re-extracted via `python -m app.db.tools.extract_schema`. Budget for that rollout step explicitly.

---

## 2. Data model (new, per tenant schema)

Three new tables, added to `sql_bu_admin_ddl.py` next to `job_*`:

```sql
-- One row per customer-facing notification "event" a job produces once
-- Finalize makes its charge final. The trigger inserts here; it never
-- sends anything itself — sending is the scheduler's job (§4).
CREATE TABLE job_notification_queue (
    id                  bigint NOT NULL,
    job_id              bigint NOT NULL REFERENCES job(id),
    customer_contact_id bigint NOT NULL REFERENCES customer_contact(id),
    branch_id           bigint NOT NULL REFERENCES branch(id),
    event_type          text NOT NULL DEFAULT 'JOB_COMPLETED',  -- room for 'JOB_DELIVERED' later (§9)
    amount              numeric(12,2) NOT NULL,                 -- job.amount snapshot at enqueue time
    status              text NOT NULL DEFAULT 'PENDING',        -- PENDING | SENT | FAILED | SKIPPED
    queued_at           timestamptz NOT NULL DEFAULT now(),
    batch_id            bigint,                                 -- FK to customer_notification_log once sent/attempted
    CONSTRAINT job_notification_queue_status_check
        CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
    -- A job can only be queued once per event_type — Finalize can in principle
    -- run again (edit-after-finalize flows); re-finalizing the same job must not
    -- double-queue it. Enforced by a partial unique index, not a bare UNIQUE,
    -- so it doesn't block SENT rows from ever being cleaned up/archived later.
    CONSTRAINT job_notification_queue_pending_uidx
        UNIQUE (job_id, event_type, status)  -- see note below
);

CREATE INDEX job_notification_queue_pending_idx
    ON job_notification_queue (customer_contact_id, queued_at)
    WHERE status = 'PENDING';

-- One row per actual outbound message attempt (after batching N queue rows
-- into one customer-facing message). This is what staff sees in the audit
-- screen (§7) and what a "Resend" action retries.
CREATE TABLE customer_notification_log (
    id                   bigint NOT NULL,
    customer_contact_id  bigint NOT NULL REFERENCES customer_contact(id),
    branch_id            bigint NOT NULL REFERENCES branch(id),
    channel              text NOT NULL,             -- 'SMS' | 'WHATSAPP'
    job_ids              bigint[] NOT NULL,          -- every job this one message covers
    total_amount         numeric(12,2) NOT NULL,
    message_body         text NOT NULL,              -- rendered text actually sent (or template+params, §6)
    provider_message_id  text,                       -- Twilio SID / provider message id, for status webhooks
    status                text NOT NULL DEFAULT 'QUEUED',  -- QUEUED | SENT | DELIVERED | FAILED
    error_message        text,
    attempt_count        smallint NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    sent_at              timestamptz,
    CONSTRAINT customer_notification_log_channel_check CHECK (channel IN ('SMS','WHATSAPP')),
    CONSTRAINT customer_notification_log_status_check
        CHECK (status IN ('QUEUED','SENT','DELIVERED','FAILED'))
);
```

Plus generated-identity `ALTER TABLE ... ADD GENERATED ALWAYS AS IDENTITY` blocks for both, matching every other table in the file.

**Config** goes in the existing `app_setting` (jsonb, already the precedent for non-scalar per-BU config — `division.account_setting` and `app_setting.setting_value` both use it, per `plan-parts-on-web.md §3a`). Two keys, seeded like the rest of `seed_bu_data.py`:

```sql
INSERT INTO app_setting (id, setting_key, setting_value, description, is_editable) VALUES
  (<next>, 'customer_notifications', '{
      "sms_enabled": false,
      "whatsapp_enabled": false,
      "batch_window_minutes": 15,
      "quiet_hours_start": "21:00",
      "quiet_hours_end": "09:00",
      "sms_template": "Hi {name}, your job(s) {job_nos} at {branch} are ready. Amount due: Rs.{amount}. Please collect at your convenience.",
      "whatsapp_template_name": "job_completion_v1"
  }', 'Job-completion SMS/WhatsApp notification settings', true)
ON CONFLICT (id) DO NOTHING;
```

`sms_template` is a fallback for plain SMS (no pre-approval needed). `whatsapp_template_name` refers to a **Meta-pre-approved template** registered with the chosen BSP (§5) — WhatsApp cannot send arbitrary free text to a customer outside a 24-hour reply window, only approved templates with fixed placeholder slots. This is why the two channels need separate template representations even though they describe "the same" message.

`sms_enabled`/`whatsapp_enabled` default to **false** — a BU must opt in after configuring a provider; the feature must never silently start texting customers for a tenant that hasn't set up billing with an SMS/WhatsApp vendor.

**Customer opt-in.** Add two nullable-defaulting booleans to `customer_contact`:

```sql
ALTER TABLE customer_contact ADD COLUMN sms_opt_in boolean DEFAULT true NOT NULL;
ALTER TABLE customer_contact ADD COLUMN whatsapp_opt_in boolean DEFAULT true NOT NULL;
```

Defaulting to `true` (opt-out model) matches how this business already contacts customers by phone/SMS for pickup today; TRAI/DLT rules (§5) govern *transactional* SMS content, not consent — but WhatsApp Business messaging still expects the recipient hasn't blocked/opted out, so the column exists for staff to flip off per-customer on request, and the digest job (§4) must check it.

---

## 3. The trigger (server, DB layer)

```sql
CREATE OR REPLACE FUNCTION fn_enqueue_job_completion_notification() RETURNS trigger AS $$
DECLARE
    v_status_code text;
BEGIN
    -- Only fire on the false -> true transition, never on true -> true no-op saves
    -- (e.g. an unrelated field edit on an already-final job).
    IF NEW.is_final IS DISTINCT FROM OLD.is_final AND NEW.is_final = true THEN
        SELECT code INTO v_status_code FROM job_status WHERE id = NEW.job_status_id;

        IF v_status_code NOT IN ('CANCELLED', 'DISPOSED') THEN
            INSERT INTO job_notification_queue
                (job_id, customer_contact_id, branch_id, amount)
            VALUES
                (NEW.id, NEW.customer_contact_id, NEW.branch_id, NEW.amount)
            ON CONFLICT (job_id, event_type, status) DO NOTHING;  -- re-finalize is a no-op, not a re-send
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_job_completion_notification
    AFTER UPDATE ON job
    FOR EACH ROW
    EXECUTE FUNCTION fn_enqueue_job_completion_notification();
```

This is the entire "detection" half of the system. No application code anywhere needs to know this exists — Finalize keeps working exactly as it does today.

---

## 4. The sender (server, background job)

**Why a scheduler, and why it's the batching mechanism.** `service-plus-server` already runs `APScheduler` (`app/scheduler.py`, wired in `app/main.py:52/54`) for the monthly stock snapshot, looping every active client DB and every active BU schema (`SqlStore.GET_ACTIVE_CLIENTS` / `GET_ACTIVE_SCHEMAS`). The notification digest reuses that exact loop shape, just on a short interval instead of monthly:

```python
# app/notification_scheduler.py — new file, sibling to scheduler.py
async def run_notification_digest() -> None:
    for db_name in <active clients, same as run_monthly_snapshot>:
        for schema in <active schemas for that client>:
            await send_pending_notifications_for_schema(db_name, schema)

async def send_pending_notifications_for_schema(db_name: str, schema: str) -> None:
    settings = await load_app_setting(db_name, schema, "customer_notifications")
    if not (settings["sms_enabled"] or settings["whatsapp_enabled"]):
        return
    if _within_quiet_hours(settings):     # don't wake a customer up about a repair at 11pm
        return

    pending = await fetch_pending_queue_rows(db_name, schema)      # status='PENDING'
    for customer_id, rows in group_by(pending, key="customer_contact_id").items():
        await send_combined_notification(db_name, schema, customer_id, rows, settings)
```

Registered in `start_scheduler()` next to the existing job:
```python
_scheduler["instance"].add_job(
    run_notification_digest, trigger="interval", minutes=5,
    id="job_completion_notification_digest", replace_existing=True,
)
```

**The batching rule** is deliberately the simplest correct one: every tick (default every **5 minutes**), collect *all currently-`PENDING`* queue rows per `customer_contact_id` and send them as **one message**. Two jobs finalized 20 minutes apart land in different ticks (two messages) — jobs finalized within the same 5-minute window get one. `batch_window_minutes` in `app_setting` is read by the digest as an *additional* hold-back — e.g. don't flush a customer's pending rows until the oldest one is at least `batch_window_minutes` old — trading latency for a wider coalescing window on branches that batch-drop-off many devices for one customer at once. Default 15 minutes is a reasonable starting point; it's a config value specifically so a BU that finds it's still splitting messages can raise it without a deploy.

**Sending**, per customer group:
1. Build `job_nos = [row.job_no for row in rows]`, `total_amount = sum(row.amount)`.
2. Look up the customer's `mobile`, `sms_opt_in`, `whatsapp_opt_in` (skip channels the customer opted out of; if both are off, mark rows `SKIPPED` and stop — don't retry forever).
3. Render the SMS body from `sms_template` (simple `.format()`/f-string substitution — no HTML, no markdown, since carriers strip it) and/or invoke the WhatsApp template by name with positional params (§6 covers the placeholder-count constraint).
4. Call the provider client (§5) for each enabled channel.
5. Insert one `customer_notification_log` row per channel actually attempted; update every `job_notification_queue` row in the group to `SENT` (or `FAILED`, pointing `batch_id` at the log row either way) — a Finalize that already failed to notify must not re-queue forever; failures surface in the audit screen (§7) for a manual "Resend" instead of infinite retry.

**Provider client — one new module, mirrors an existing pattern exactly.** `app/services/file_client.py` (§ referenced in `plan-parts-on-web.md`) is a small class wrapping `httpx.AsyncClient` with a base URL + API-key header and typed async methods; `app/core/email.py` is the "silently skip if not configured, else raise on failure" async wrapper. The new `app/services/notification_client.py` combines both shapes:

```python
class NotificationClient:
    """Thin async wrapper over the SMS/WhatsApp provider's REST API."""
    def __init__(self, base_url: str, api_key: str): ...
    async def send_sms(self, to_mobile: str, body: str) -> str: ...        # returns provider message id
    async def send_whatsapp_template(self, to_mobile: str, template_name: str, params: list[str]) -> str: ...
```

Backed by two new settings classes following `EmailSettings`'s exact shape (`app/core/settings/sms_settings.py`, `whatsapp_settings.py`, both added to the `Settings(...)` inheritance chain in `app/config.py`) — `sms_api_key`, `sms_sender_id`, `whatsapp_api_key`, `whatsapp_business_number`, etc., loaded from `.env` the same way `smtp_host`/`smtp_password` are today. `httpx` is already a pinned dependency (`requirements.txt: httpx>=0.28,<0.29`) — no new dependency needed for the HTTP side.

**Per-tenant vs. platform-level credentials — a decision to make explicitly, not default silently.** This is a multi-tenant SaaS (one Postgres DB per client, one schema per BU) serving many independent repair businesses. Two credible models:
- **Platform account** (recommended to start): Service Plus holds one Twilio/BSP account; every tenant's messages go out from the same sender ID/WhatsApp number, with the branch/business name spoken *inside* the message body ("Your job at {branch} is ready..."). Fastest to ship — zero per-tenant provider onboarding.
- **Bring-your-own** (Phase 2): a tenant supplies their own provider API key + sender ID/WhatsApp number in `app_setting`, so messages appear to come from *their* business identity. Needed once a client wants their own branded WhatsApp number, but pushes DLT/Meta template registration work onto every tenant individually.

Store the choice so both are representable without a schema change: `customer_notifications.provider_credentials` can be `null` (use platform-level env credentials) or an object with tenant-specific keys — the digest job checks for a per-tenant override before falling back to `settings.sms_api_key`/`settings.whatsapp_api_key`.

---

## 5. Third-party service recommendation

**India-specific regulatory constraints that shape the whole design (not optional, not a "nice to have"):**
- **SMS: TRAI DLT registration is legally mandatory.** Any transactional or promotional SMS sent to an Indian mobile number must be sent via a Sender ID and message **Template** pre-registered on one of the telecom-operator DLT platforms. This is done *through* the SMS aggregator (they provide the DLT portal access), takes on the order of days to a couple of weeks for approval, and every distinct message template — including "job {job_no} ready, amount due ₹{amount}" — must be registered with its exact variable placeholders before it can be sent. **Any client onboarding "bring your own" SMS (§4) inherits this same registration burden.** Budget real calendar time for this before "go live," not just dev time.
- **WhatsApp: Meta template pre-approval is mandatory** for any business-initiated message (which this always is — it's the business notifying the customer, not replying within a 24-hour customer-service window). Templates are submitted through the chosen BSP, reviewed by Meta (usually within a day or two, sometimes longer), and once approved the placeholder *count and order* are fixed — this is exactly why `job_nos` in a batched message can't just be "however many, comma-joined" without limit: the template has a fixed number of `{{n}}` slots. Recommendation: cap the rendered job-list at 3 (`"JC-101, JC-102, and 2 more"`) so one template covers any batch size.

**Vendor recommendation: start with a single India-focused BSP that offers both SMS and WhatsApp under one contract**, rather than stitching two vendors together — it halves the integration surface (one `NotificationClient`, one webhook shape, one invoice) and halves the compliance paperwork contact point:

| Option | Why it fits here | Trade-off |
|---|---|---|
| **MSG91** (recommended default) | India-origin, does SMS + WhatsApp Business API under one account, handles DLT registration for you as part of onboarding, has a clean REST API and a generous free trial tier — good fit for a SaaS billing many small repair-shop tenants where cost-per-message matters | Smaller global footprint than Twilio; less relevant here since this product is India-only today |
| **Gupshup / AiSensy / Interakt** | Also India-first BSPs, strong WhatsApp-specific tooling (template builder UIs), similar DLT support | Split SMS to a second vendor in some plans — check current bundling before committing |
| **Twilio** | Best-in-class docs, one global vendor if this product ever expands outside India, unified status-webhook model | DLT compliance for India SMS still has to be done via Twilio's India entity/reseller — more friction than an India-native BSP for a purely domestic customer base; typically pricier per message at this volume |

Given `customer_contact`'s `state_id`/`gstin`/`hsn_code` fields make clear this is an India-only, GST-compliant product today, **MSG91 (or an equivalent India-native BSP)** is the pragmatic default; the `NotificationClient` interface in §4 is intentionally vendor-agnostic (two methods, plain strings in/out) so swapping providers later — or supporting Twilio for a future international tenant — is a new implementation of the same interface, not a redesign.

---

## 6. Message content

**SMS** (plain text, DLT-registered template, `{name}`/`{job_nos}`/`{amount}`/`{branch}` placeholders):
> Hi Rajesh, your job(s) JC-1042, JC-1043 at Acme Service Center are ready. Amount due: Rs.1,450. Please collect at your convenience. — Acme Service Center

**WhatsApp** (Meta-approved template, fixed 4-slot layout so it works for 1 job or N):
> Template `job_completion_v1`: "Hi {{1}}, your service job(s) ({{2}}) are complete. Total amount due: ₹{{3}}. Thank you for choosing {{4}}."
> Params: `["Rajesh", "JC-1042, JC-1043", "1,450", "Acme Service Center"]`

Both explicitly state "amount due" rather than assuming payment is outstanding — `job.amount` reflects the settled charge, not whether it's been paid (payment happens at delivery, per `job_payment`/delivery flow, which this message predates). If `amount = 0` (e.g. a warranty job, where `finalize-job-save.ts:174` forces `amount = 0` for `UNDER_WARRANTY` jobs), the template should render "no charges — covered under warranty" instead of "₹0", via a small branch in the render step, not a separate template.

---

## 7. Client (`service-plus-client`) changes

1. **Customer master** (`masters/customer/edit-customer-dialog.tsx`, `add-customer-dialog.tsx`): add `SMS opt-in` / `WhatsApp opt-in` checkboxes next to the existing `mobile`/`alternate_mobile` fields (which already use `MOBILE_REGEX`/`normalizeMobile` from `lib/mobile.ts` — no new validation needed, WhatsApp/SMS both key off the same 10-digit number with a `+91` prefix added server-side at send time).

2. **Notification settings.** MVP needs no new screen at all: `app_setting` already has a generic JSON editor (`configurations/app-settings/edit-app-setting-dialog.tsx`, a `Textarea` bound to `setting_value` with JSON parse/format) — the `customer_notifications` key (§2) is editable there immediately. Phase 2: a dedicated `Configurations → Notifications` screen with real form fields (toggles, a template preview showing today's placeholder substitution, quiet-hours time pickers) once the JSON-editing UX proves it's the wrong long-term interface for non-technical staff.

3. **Notification status visibility on existing job screens** — small, additive:
   - `final-a-job/finalized-jobs-grid.tsx`: a column or badge showing `Notification: Sent / Pending / Failed / Skipped` per job, sourced from a join to `job_notification_queue`/`customer_notification_log` (new `SQL_MAP` entry, generic-query pattern already used everywhere else in this file's siblings).
   - A **"Resend"** action (icon button) on a `FAILED` row — calls a new `resendJobNotification` GraphQL mutation that re-inserts (or resets) the relevant queue row so the next scheduler tick picks it up, rather than re-implementing send logic in the client.

4. **New audit screen**: `Configurations → Notification Log` (or under Reports, matching where `revenue-report-section.tsx`-style screens live) — a paged grid over `customer_notification_log`: customer, channel, jobs covered, amount, status, sent-at, error message if failed. Read-only, generic-query-backed, same shape as every other report grid in `reports/`.

---

## 8. GraphQL/API surface (server)

All additive, following the existing `genericQuery`/`genericUpdate` envelope wherever a plain CRUD read/write suffices (no new resolver needed for the audit-log read, for instance — just a new `SQL_MAP` entry). Two things need real resolvers because they're not simple table CRUD:

- `resendJobNotification(db_name, schema, value: { job_ids: [...] })` — resets the named queue rows to `PENDING` (or re-inserts if already archived), so the digest job resends them in the next tick. Lives in `app/graphql/resolvers/jobs/mutations.py` next to the other job mutations.
- Optionally, `sendTestNotification(db_name, schema, value: { channel, mobile })` for the settings screen's "send me a test message" button — directly calls `NotificationClient` bypassing the queue, useful for verifying provider credentials without waiting on a real job.

---

## 9. Explicitly out of scope for this design (candidates for later)

- **A second message at delivery** ("thank you for collecting your item") — the queue/log schema already has `event_type` as a column specifically so `'JOB_DELIVERED'` can be added later without a schema change, hooked off `resolve_deliver_job_helper` (or, more consistently with §1's reasoning, a second DB trigger on `job.is_closed`).
- **Inbound WhatsApp** (customers replying, or a chatbot) — this design is outbound-only.
- **Linking to a public job-status page** in the message body — `service-plus-web` has no live tracking route today; add the link once one exists rather than shipping a dead/placeholder URL.
- **Per-tenant BYO provider credentials** (§4) — ship platform-level first, add the override path once a real client asks for their own branded sender.

## 10. Rollout checklist

1. Add the three DDL blocks (§2) + trigger (§3) to `sql_bu_admin_ddl.py`; re-extract `service_plus_service.sql` via `app.db.tools.extract_schema` so it's the template for new tenants.
2. Hand-apply the same DDL to every existing live schema (no migration runner — same caveat `plan-parts-on-web.md` called out).
3. Pick and contract with the BSP (§5); get SMS DLT template(s) and the WhatsApp template approved **before** writing the sender code against final template text — approved wording can't be changed without re-approval.
4. Ship `NotificationClient` + settings classes + `notification_scheduler.py`, wired into `main.py` alongside `start_scheduler()`, with `sms_enabled`/`whatsapp_enabled` defaulting `false` per tenant.
5. Ship customer opt-in fields + notification log/resend UI in the client.
6. Turn `sms_enabled`/`whatsapp_enabled` on for one pilot BU, watch `customer_notification_log` for a few days, then roll out tenant by tenant.
