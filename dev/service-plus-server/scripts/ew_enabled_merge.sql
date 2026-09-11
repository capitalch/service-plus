-- Extended Warranty — fold the visibility flag into the config row (plans/plan.md,
-- "Settings consolidation" section, Step S1).
--
-- Before: two app_setting rows — 16 `extended_warranty_notifications_enabled` (a bare
-- boolean) and 17 `extended_warranty` (the config object).
-- After:  one row — 16 `extended_warranty`, with the flag as its `enabled` field.
--
-- Idempotent throughout: safe to run more than once, and safe against a schema that has
-- already been partly migrated. Run once per BU schema, e.g.:
--   psql "<conn>" -c "SET search_path TO demo1;" -f scripts/ew_enabled_merge.sql
--
-- Apply to the `demo1` TEMPLATE schema too, then regenerate the schema dumps with
-- app/db/tools/extract_schema.py — never by hand.
--
-- A BU created after this ships needs none of it: SeedBuData.BU_SEED_SQL already carries
-- the merged row at id 16.

-- ── 1. Carry the flag's value into the config object ─────────────────────────
-- An owner who already switched the add-on ON must stay ON. Merge with `||` so the other
-- config fields are untouched, and only when `enabled` is absent, so a re-run can never
-- overwrite a value someone has since changed.
UPDATE app_setting t
SET setting_value = t.setting_value || jsonb_build_object('enabled', f.setting_value),
    updated_at    = now()
FROM app_setting f
WHERE t.setting_key = 'extended_warranty'
  AND f.setting_key = 'extended_warranty_notifications_enabled'
  AND jsonb_typeof(t.setting_value) = 'object'
  AND jsonb_typeof(f.setting_value) = 'boolean'
  AND NOT (t.setting_value ? 'enabled');

-- ── 2. Default the key in where step 1 could not run ─────────────────────────
-- Either the flag row was never created, or the old free-text editor corrupted its value
-- to a string (typing `ture` saved the JSON string "ture"). Fail closed: absent means off,
-- and a corrupted value was already reading as off.
UPDATE app_setting
SET setting_value = setting_value || '{"enabled": false}'::jsonb,
    updated_at    = now()
WHERE setting_key = 'extended_warranty'
  AND jsonb_typeof(setting_value) = 'object'
  AND NOT (setting_value ? 'enabled');

-- ── 3. Drop the old flag row ─────────────────────────────────────────────────
-- This frees id 16 for step 4. Nothing references app_setting.id — every reader looks up
-- setting_key — so removing the row breaks no join.
DELETE FROM app_setting WHERE setting_key = 'extended_warranty_notifications_enabled';

-- ── 4. Close the numbering gap ───────────────────────────────────────────────
-- `id` is a plain smallint, not an identity column, so it can be updated directly. The
-- NOT EXISTS keeps this both idempotent and safe: if 16 is somehow still occupied this
-- no-ops instead of raising on the primary key.
UPDATE app_setting
SET id = 16, updated_at = now()
WHERE setting_key = 'extended_warranty'
  AND id <> 16
  AND NOT EXISTS (SELECT 1 FROM app_setting a WHERE a.id = 16);

-- ── 5. Bring the description in line with the new shape ──────────────────────
-- The row still carried its pre-consolidation description, which describes it as
-- configuration only and never mentions `enabled` — now its most important field. The
-- description column is shown in the App Settings grid, so a stale one is user-visible.
-- Written on one line: a line break inside the literal ends up stored in the value.
UPDATE app_setting
SET description = 'Extended Warranty settings. `enabled` shows the Custom → Extended Warranty menu; sending also needs whatsapp_notifications.EXTENDED_WARRANTY.',
    updated_at  = now()
WHERE setting_key = 'extended_warranty'
  AND description IS DISTINCT FROM 'Extended Warranty settings. `enabled` shows the Custom → Extended Warranty menu; sending also needs whatsapp_notifications.EXTENDED_WARRANTY.';

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Step 4 is the one statement that can silently skip, so check every schema after running:
--
--   SELECT id, setting_key, setting_value FROM app_setting WHERE id >= 15 ORDER BY id;
--   -- expect: 15 whatsapp_notifications, 16 extended_warranty (carrying "enabled")
--
-- A schema left with extended_warranty at 17 still works — nothing reads the id — but its
-- numbering has drifted from the seed.
