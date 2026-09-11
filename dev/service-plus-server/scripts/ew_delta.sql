-- Extended Warranty reminders — delta for an EXISTING BU schema (plans/plan.md, Step 1).
--
-- Idempotent throughout: safe to run more than once, and safe against a schema that has
-- already been partly migrated. Run once per BU schema, e.g.:
--   psql "<conn>" -c "SET search_path TO demo1;" -f scripts/ew_delta.sql
--
-- New BU schemas do NOT need this — the same objects are in BU_SCHEMA_DDL
-- (app/db/sql/sql_bu_admin_ddl.py) and the two app_setting rows are in
-- SeedBuData.APP_SETTING_SEED_SQL, so a BU created from scratch arrives complete.
--
-- After applying this to the `demo1` TEMPLATE schema, regenerate the schema dumps with
-- app/db/tools/extract_schema.py — never by hand.

-- ── The one table ────────────────────────────────────────────────────────────
-- Everything about one warranty lead on one row. Flat columns carry anything a grid
-- filters or sorts on; the two jsonb columns carry history. See
-- app/db/sql/sql_extended_warranty.py for the shapes and the four jsonb rules.

CREATE TABLE IF NOT EXISTS ew_customer (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    branch_id         bigint NOT NULL,
    full_name         text   NOT NULL,
    mobile            text   NOT NULL,
    email             text,
    address           text,
    city              text,
    brand_id          bigint NOT NULL,
    product_id        bigint,
    model_name        text,
    serial_no         text,
    purchase_date     date,
    warranty_end_date date   NOT NULL,
    remarks           text,

    -- per-stage reminder + interest state, keyed by days-before ('30'/'7'/'0')
    stages            jsonb  DEFAULT '{}'::jsonb  NOT NULL,
    -- append-only staff activity log, capped at 50 by APPEND_EW_FOLLOW_UP
    follow_ups        jsonb  DEFAULT '[]'::jsonb  NOT NULL,

    -- denormalised for grid filter/sort; derived on write
    outcome           text   DEFAULT 'OPEN' NOT NULL,
    outcome_at        timestamp with time zone,
    last_stage_sent   smallint,
    last_sent_at      timestamp with time zone,
    interest_count    integer DEFAULT 0 NOT NULL,
    follow_up_count   integer DEFAULT 0 NOT NULL,

    is_opted_out      boolean DEFAULT false NOT NULL,
    opted_out_at      timestamp with time zone,
    is_active         boolean DEFAULT true  NOT NULL,
    created_at        timestamp with time zone DEFAULT now() NOT NULL,
    updated_at        timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ew_customer_pkey PRIMARY KEY (id),
    CONSTRAINT ew_customer_branch_fkey  FOREIGN KEY (branch_id)  REFERENCES branch(id),
    CONSTRAINT ew_customer_brand_fkey   FOREIGN KEY (brand_id)   REFERENCES brand(id),
    CONSTRAINT ew_customer_product_fkey FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT ew_customer_outcome_chk  CHECK (outcome IN ('OPEN', 'CONVERTED', 'NOT_INTERESTED', 'UNREACHABLE'))
);

-- Import is out of scope for now (records are entered one at a time), so there is no
-- `source`/`import_batch_no` pair here. Adding import later re-adds them; nothing in the
-- write path or the jsonb shape changes.

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- The dedup index is a real unique constraint and stays one: it is the only place a
-- duplicate record is structurally impossible. (Exactly-once *sending* is a different
-- problem, solved by CLAIM_EW_REMINDER_STAGE's WHERE clause.)
CREATE UNIQUE INDEX IF NOT EXISTS ew_customer_dedup_idx
    ON ew_customer (mobile, COALESCE(serial_no, ''), warranty_end_date);
CREATE INDEX IF NOT EXISTS ew_customer_due_idx
    ON ew_customer (warranty_end_date) WHERE is_active AND NOT is_opted_out;
CREATE INDEX IF NOT EXISTS ew_customer_mobile_idx  ON ew_customer (mobile);
CREATE INDEX IF NOT EXISTS ew_customer_branch_idx  ON ew_customer (branch_id);
CREATE INDEX IF NOT EXISTS ew_customer_outcome_idx ON ew_customer (outcome);
CREATE INDEX IF NOT EXISTS ew_customer_stages_gin  ON ew_customer USING gin (stages jsonb_path_ops);

-- ── The flattening view ──────────────────────────────────────────────────────
-- Every grid, report and dashboard query reads THIS, not the raw jsonb — so all
-- reporting SQL is ordinary GROUP BY over a normal-looking relation and only the write
-- statements ever touch jsonb directly.
--
-- CROSS JOIN LATERAL: a customer with no sends yet has NO rows here. "Due" and
-- "not contacted" counts must come from ew_customer directly.
CREATE OR REPLACE VIEW ew_stage_v AS
SELECT c.id                                                    AS ew_customer_id,
       c.branch_id,
       c.full_name,
       c.mobile,
       c.brand_id,
       c.product_id,
       c.model_name,
       c.warranty_end_date,
       c.outcome,
       c.is_active,
       c.is_opted_out,
       (s.key)::smallint                                       AS stage,
       s.value ->> 'delivery_status'                           AS delivery_status,
       s.value ->> 'stage_status'                              AS stage_status,
       s.value ->> 'wamid'                                     AS wamid,
       (s.value ->> 'sent_at')::timestamptz                    AS sent_at,
       (s.value ->> 'sent_by')::bigint                         AS sent_by,
       s.value ->> 'error'                                     AS error,
       (s.value -> 'interest' ->> 'expressed_at')::timestamptz AS interest_at,
       s.value -> 'interest' ->> 'preferred_contact'           AS preferred_contact,
       s.value -> 'interest' ->> 'customer_remarks'            AS customer_remarks,
       s.value -> 'interest' -> 'alert' ->> 'delivery_status'  AS alert_status,
       s.value -> 'interest' -> 'alert' ->> 'error'            AS alert_error
FROM ew_customer c
CROSS JOIN LATERAL jsonb_each(c.stages) AS s(key, value);

-- ── App settings ─────────────────────────────────────────────────────────────
-- Two switches, deliberately. `extended_warranty.enabled` makes the module VISIBLE (menu
-- + screens); whatsapp_notifications.EXTENDED_WARRANTY makes sends ALLOWED. Both must be
-- true before a message goes out — an owner will want to enter and review leads first.
-- Keeping the send switch in the existing jsonb row means _is_event_enabled needs no
-- change at all.
--
-- `enabled` used to be its own row, id 16 `extended_warranty_notifications_enabled`. It
-- was folded into the config object and that row took id 16; a schema still carrying the
-- old shape is migrated by scripts/ew_enabled_merge.sql, not by this script.

INSERT INTO app_setting (id, setting_key, setting_value, description, is_editable) VALUES
    (16, 'extended_warranty',
     '{"auto_send_enabled": false, "contact_phone": "", "daily_send_cap": 250, "enabled": false, "notify_email": "", "reminder_days_before": [30, 7, 0], "staff_whatsapp_number": "", "whatsapp_number": ""}',
     'Extended Warranty settings. `enabled` shows the Custom → Extended Warranty menu; sending also needs whatsapp_notifications.EXTENDED_WARRANTY.', true)
ON CONFLICT (id) DO NOTHING;

-- Add the EXTENDED_WARRANTY key to row 15 without disturbing the other event switches,
-- and only when it is absent — re-running must never flip a switch an admin turned on.
UPDATE app_setting
SET setting_value = setting_value || '{"EXTENDED_WARRANTY": false}'::jsonb,
    updated_at    = now()
WHERE setting_key = 'whatsapp_notifications'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT (setting_value ? 'EXTENDED_WARRANTY');
