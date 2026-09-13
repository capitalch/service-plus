-- Extended Warranty — lead state machine schema (plans/plan-ew-final.md, Part C, §C3).
--
-- Creates:
--   - table ew_lead        one row per warranty lead; `state` is the state machine,
--                          `is_closed` is GENERATED from it and never written
--   - table ew_message     one row per WhatsApp send (REMINDER or LEAD_ALERT)
--   - table ew_lead_event  history: state / stage changes, interest, follow-ups, opt-out
--   - view  ew_lead_view   the single home of the expiry-band rule, the 7-day grace
--                          window and `can_send`
--   - app_setting row 16 `extended_warranty` and the EXTENDED_WARRANTY key on the
--     `whatsapp_notifications` row (both default OFF)
--
-- Idempotent: safe to run more than once; every run ends in the same schema (the two
-- NULL-safe CHECKs are dropped and re-added each time — see that section). Run once per BU
-- schema, including the `demo1` TEMPLATE schema.
--
-- No BEGIN/COMMIT in this file — the runner supplies the transaction, so a failure leaves
-- the schema untouched:
--   - migration tool: wraps each schema in its own transaction and sets search_path. An
--     embedded COMMIT would commit even during its Check dry run.
--   - psql: pass -1 (single transaction):
--     psql "<conn>" -1 -v ON_ERROR_STOP=1 -c "SET search_path TO demo1;" -f scripts/ew_schema.sql
--
-- Afterwards (demo1 only) regenerate the schema dump and BU_SCHEMA_DDL — never by hand.
-- A BU created after that needs none of this: BU_SCHEMA_DDL and SeedBuData carry it.

-- ── Guard: app_setting id 16 must be free or already ours ─────────────────────
-- Fail loudly rather than let ON CONFLICT silently skip a row that belongs to
-- another setting.
DO $$
DECLARE
    taken_by text;
BEGIN
    SELECT setting_key INTO taken_by FROM app_setting WHERE id = 16;
    IF taken_by IS NOT NULL AND taken_by <> 'extended_warranty' THEN
        RAISE EXCEPTION 'app_setting id 16 is already used by "%" — resolve that before running ew_schema.sql', taken_by;
    END IF;
    IF EXISTS (SELECT 1 FROM app_setting WHERE setting_key = 'extended_warranty' AND id <> 16) THEN
        RAISE EXCEPTION 'app_setting "extended_warranty" exists under an id other than 16 — resolve that before running ew_schema.sql';
    END IF;
END $$;

-- ── ew_lead ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ew_lead (
    id                 bigint GENERATED ALWAYS AS IDENTITY,
    branch_id          bigint NOT NULL,
    full_name          text   NOT NULL,
    mobile             text   NOT NULL,
    email              text,
    address            text,
    city               text,
    brand_id           bigint NOT NULL,
    product_id         bigint,
    model_name         text,
    serial_no          text,
    purchase_date      date,
    warranty_end_date  date   NOT NULL,
    remarks            text,
    state              text     DEFAULT 'NEW_LEAD' NOT NULL,
    progress_stage     smallint,
    is_closed          boolean GENERATED ALWAYS AS (state IN ('WON', 'LOST', 'CANCELLED')) STORED,
    state_changed_at   timestamp with time zone DEFAULT now() NOT NULL,
    closed_at          timestamp with time zone,
    interest_at        timestamp with time zone,
    preferred_contact  text,
    customer_remarks   text,
    next_follow_up_at  timestamp with time zone,
    last_follow_up_at  timestamp with time zone,
    follow_up_count    integer DEFAULT 0 NOT NULL,
    is_opted_out       boolean DEFAULT false NOT NULL,
    opted_out_at       timestamp with time zone,
    created_by         bigint,
    created_at         timestamp with time zone DEFAULT now() NOT NULL,
    updated_at         timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_lead_pkey PRIMARY KEY (id),
    CONSTRAINT ew_lead_branch_fkey  FOREIGN KEY (branch_id)  REFERENCES branch(id),
    CONSTRAINT ew_lead_brand_fkey   FOREIGN KEY (brand_id)   REFERENCES brand(id),
    CONSTRAINT ew_lead_product_fkey FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT ew_lead_state_chk CHECK (state IN
        ('NEW_LEAD', 'MESSAGE_SENT', 'INTERESTED', 'IN_PROGRESS', 'WON', 'LOST', 'CANCELLED')),
    -- ew_lead_progress_chk is added below, outside CREATE TABLE (see "NULL-safe constraints").
    -- closed_at is set exactly when the lead is Won / Lost / Cancelled.
    CONSTRAINT ew_lead_closed_at_chk CHECK ((state IN ('WON', 'LOST', 'CANCELLED')) = (closed_at IS NOT NULL)),
    CONSTRAINT ew_lead_preferred_contact_chk CHECK (preferred_contact IS NULL OR preferred_contact IN ('CALL', 'WHATSAPP'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ew_lead_dedup_idx        ON ew_lead (mobile, COALESCE(serial_no, ''), warranty_end_date);
CREATE INDEX        IF NOT EXISTS ew_lead_branch_state_idx ON ew_lead (branch_id, state);
CREATE INDEX        IF NOT EXISTS ew_lead_created_idx      ON ew_lead (branch_id, created_at DESC);
CREATE INDEX        IF NOT EXISTS ew_lead_expiry_open_idx  ON ew_lead (warranty_end_date) WHERE NOT is_closed;
CREATE INDEX        IF NOT EXISTS ew_lead_mobile_idx       ON ew_lead (mobile);
CREATE INDEX        IF NOT EXISTS ew_lead_follow_up_idx    ON ew_lead (next_follow_up_at) WHERE state = 'IN_PROGRESS';

-- ── ew_message ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ew_message (
    id               bigint GENERATED ALWAYS AS IDENTITY,
    ew_lead_id       bigint   NOT NULL,
    kind             text     DEFAULT 'REMINDER' NOT NULL,   -- REMINDER | LEAD_ALERT
    band             text,                                   -- REMINDER: band at send time; NULL for LEAD_ALERT
    delivery_status  text     DEFAULT 'PENDING' NOT NULL,
    status_rank      smallint DEFAULT 0 NOT NULL,            -- PENDING 0 ACCEPTED 1 SENT 2 DELIVERED 3 READ 4 FAILED 9
    wamid            text,
    error            text,
    sent_at          timestamp with time zone DEFAULT now() NOT NULL,
    sent_by          bigint,
    settled_at       timestamp with time zone,
    CONSTRAINT ew_message_pkey PRIMARY KEY (id),
    CONSTRAINT ew_message_lead_fkey FOREIGN KEY (ew_lead_id) REFERENCES ew_lead(id) ON DELETE CASCADE,
    CONSTRAINT ew_message_kind_chk CHECK (kind IN ('REMINDER', 'LEAD_ALERT')),
    CONSTRAINT ew_message_status_chk CHECK (delivery_status IN
        ('PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED'))
    -- ew_message_band_chk is added below, outside CREATE TABLE (see "NULL-safe constraints").
);
-- D7: exactly one live reminder per (lead, band). FAILED drops out, so a failed band can be retried.
CREATE UNIQUE INDEX IF NOT EXISTS ew_message_once_per_band_idx
    ON ew_message (ew_lead_id, band) WHERE kind = 'REMINDER' AND delivery_status <> 'FAILED';
CREATE UNIQUE INDEX IF NOT EXISTS ew_message_wamid_idx ON ew_message (wamid) WHERE wamid IS NOT NULL;
CREATE INDEX        IF NOT EXISTS ew_message_lead_idx  ON ew_message (ew_lead_id, sent_at DESC);
CREATE INDEX        IF NOT EXISTS ew_message_sent_idx  ON ew_message (sent_at) WHERE kind = 'REMINDER';

-- ── ew_lead_event ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ew_lead_event (
    id                 bigint GENERATED ALWAYS AS IDENTITY,
    ew_lead_id         bigint NOT NULL,
    event_type         text   NOT NULL,     -- STATE_CHANGE | STAGE_CHANGE | INTEREST | FOLLOW_UP | OPT_OUT
    from_state         text,
    to_state           text,
    progress_stage     smallint,
    action             text,                -- FOLLOW_UP: CALL | WHATSAPP | SMS | VISIT | OTHER
    notes              text,
    next_follow_up_at  timestamp with time zone,
    ew_message_id      bigint,              -- INTEREST: the reminder whose link was tapped
    created_by         bigint,              -- NULL = customer / system
    created_by_name    text,                -- stamped server-side from created_by
    created_at         timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_lead_event_pkey PRIMARY KEY (id),
    CONSTRAINT ew_lead_event_lead_fkey    FOREIGN KEY (ew_lead_id)    REFERENCES ew_lead(id)    ON DELETE CASCADE,
    CONSTRAINT ew_lead_event_message_fkey FOREIGN KEY (ew_message_id) REFERENCES ew_message(id) ON DELETE SET NULL,
    CONSTRAINT ew_lead_event_type_chk CHECK (event_type IN
        ('STATE_CHANGE', 'STAGE_CHANGE', 'INTEREST', 'FOLLOW_UP', 'OPT_OUT')),
    CONSTRAINT ew_lead_event_action_chk CHECK (action IS NULL OR action IN
        ('CALL', 'WHATSAPP', 'SMS', 'VISIT', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS ew_lead_event_lead_idx ON ew_lead_event (ew_lead_id, created_at DESC);

-- ── NULL-safe constraints ─────────────────────────────────────────────────────
-- A CHECK passes when its expression is NULL, not only when it is TRUE. The first
-- version wrote these as `(state = 'IN_PROGRESS' AND progress_stage BETWEEN 1 AND 3) OR …`,
-- which lets a NULL through (TRUE AND NULL = NULL): an In Progress lead with no stage,
-- and a REMINDER with no band — the second also slips past ew_message_once_per_band_idx,
-- since NULLs never collide in a unique index. Both are now FALSE, never NULL, for a
-- missing value. Dropped and re-added on every run, so a schema created by the first
-- version is corrected as well; validation is instant on these small tables.
ALTER TABLE ew_lead DROP CONSTRAINT IF EXISTS ew_lead_progress_chk;
-- In Progress always carries a stage 1..3; every other state carries none.
ALTER TABLE ew_lead ADD CONSTRAINT ew_lead_progress_chk CHECK (
    CASE WHEN state = 'IN_PROGRESS' THEN COALESCE(progress_stage BETWEEN 1 AND 3, false)
         ELSE progress_stage IS NULL END);

ALTER TABLE ew_message DROP CONSTRAINT IF EXISTS ew_message_band_chk;
-- A REMINDER always records the band it was sent in; a LEAD_ALERT never has one.
ALTER TABLE ew_message ADD CONSTRAINT ew_message_band_chk CHECK (
    CASE WHEN kind = 'REMINDER' THEN COALESCE(band IN ('D61_PLUS', 'D31_60', 'D8_30', 'D0_7', 'OVERDUE'), false)
         ELSE band IS NULL END);

-- ── ew_lead_view ──────────────────────────────────────────────────────────────
-- The ONLY place the band rule, the 7-day grace window and can_send are written.
-- Columns are listed explicitly (no l.*), so adding a column to ew_lead is a deliberate
-- edit here rather than a silent mismatch.
CREATE OR REPLACE VIEW ew_lead_view AS
SELECT l.id, l.branch_id, l.full_name, l.mobile, l.email, l.address, l.city,
       l.brand_id, l.product_id, l.model_name, l.serial_no, l.purchase_date, l.warranty_end_date,
       l.remarks, l.state, l.progress_stage, l.is_closed, l.state_changed_at, l.closed_at,
       l.interest_at, l.preferred_contact, l.customer_remarks,
       l.next_follow_up_at, l.last_follow_up_at, l.follow_up_count,
       l.is_opted_out, l.opted_out_at, l.created_by, l.created_at, l.updated_at,
       dl.days_left,
       bd.band,
       lm.id              AS last_message_id,
       lm.delivery_status AS last_delivery_status,
       lm.sent_at         AS last_sent_at,
       lm.error           AS last_error,
       COALESCE(mc.message_count, 0) AS message_count,
       la.delivery_status AS alert_status,
       la.error           AS alert_error,
       CASE WHEN l.state <> 'MESSAGE_SENT'       THEN NULL
            WHEN lm.delivery_status = 'READ'      THEN 'READ'
            WHEN lm.delivery_status = 'DELIVERED' THEN 'DELIVERED'
            WHEN lm.delivery_status = 'FAILED'    THEN 'FAILED'
            ELSE 'AWAITING' END  AS message_group,
       (l.state IN ('NEW_LEAD', 'MESSAGE_SENT')
        AND NOT l.is_opted_out
        AND dl.days_left >= -7
        AND NOT EXISTS (SELECT 1 FROM ew_message x
                        WHERE x.ew_lead_id = l.id AND x.kind = 'REMINDER'
                          AND x.band = bd.band AND x.delivery_status <> 'FAILED')
       ) AS can_send
FROM ew_lead l
CROSS JOIN LATERAL (SELECT (l.warranty_end_date - CURRENT_DATE) AS days_left) dl
CROSS JOIN LATERAL (
    SELECT CASE WHEN dl.days_left < 0   THEN 'OVERDUE'
                WHEN dl.days_left <= 7  THEN 'D0_7'
                WHEN dl.days_left <= 30 THEN 'D8_30'
                WHEN dl.days_left <= 60 THEN 'D31_60'
                ELSE 'D61_PLUS' END AS band) bd
LEFT JOIN LATERAL (
    SELECT m.id, m.delivery_status, m.sent_at, m.error FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'REMINDER'
    ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) lm ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS message_count FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'REMINDER') mc ON true
LEFT JOIN LATERAL (
    SELECT m.delivery_status, m.error FROM ew_message m
    WHERE m.ew_lead_id = l.id AND m.kind = 'LEAD_ALERT'
    ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) la ON true;

-- ── Settings (both default OFF) ───────────────────────────────────────────────
INSERT INTO app_setting (id, setting_key, setting_value, description, is_editable) VALUES
  (16, 'extended_warranty',
   '{"contact_phone": "", "daily_send_cap": 250, "enabled": false, "notify_email": "", "staff_whatsapp_number": "", "whatsapp_number": ""}',
   'Extended Warranty. `enabled` shows Custom → Extended Warranty; sending also needs whatsapp_notifications.EXTENDED_WARRANTY.', true)
ON CONFLICT (id) DO NOTHING;

UPDATE app_setting
SET setting_value = setting_value || '{"EXTENDED_WARRANTY": false}'::jsonb,
    updated_at    = now()
WHERE setting_key = 'whatsapp_notifications'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT (setting_value ? 'EXTENDED_WARRANTY');
