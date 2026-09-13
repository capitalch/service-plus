-- Extended Warranty — remove the old implementation (plans/plan-ew-final.md, Part A, §A2).
--
-- Drops the old objects and settings. Nothing is migrated: the new module
-- (plans/plan-ew-final.md, Part C) starts from empty tables.
--
-- Removes:
--   - view  ew_stage_v
--   - table ew_customer (takes its identity sequence, six indexes, pkey and three FKs with it)
--   - app_setting rows `extended_warranty` and, where an old schema still has it,
--     `extended_warranty_notifications_enabled`
--   - the EXTENDED_WARRANTY key inside the `whatsapp_notifications` row
--
-- Idempotent: safe to run more than once; a second run changes nothing. Run once per BU
-- schema, including the `demo1` TEMPLATE schema, e.g.:
--   psql "<conn>" -c "SET search_path TO demo1;" -f scripts/ew_cleanup.sql
--
-- Afterwards (demo1 only) regenerate the schema dump and BU_SCHEMA_DDL — never by hand.
-- Delete this file once every tenant's BU schemas have run it (plan step D2.7).

BEGIN;

DROP VIEW  IF EXISTS ew_stage_v;
DROP TABLE IF EXISTS ew_customer;

DELETE FROM app_setting
WHERE setting_key IN ('extended_warranty', 'extended_warranty_notifications_enabled');

UPDATE app_setting
SET setting_value = setting_value - 'EXTENDED_WARRANTY',
    updated_at    = now()
WHERE setting_key = 'whatsapp_notifications'
  AND jsonb_typeof(setting_value) = 'object'
  AND setting_value ? 'EXTENDED_WARRANTY';

COMMIT;
