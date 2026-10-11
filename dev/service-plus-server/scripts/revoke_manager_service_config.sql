-- Migration: take MASTERS_SERVICE_CONFIG away from the MANAGER role (plans/plan.md Step 2).
-- Configurations -> Service Config is now hidden from Manager; Admin / super-admin bypass
-- every right check, and a custom role can still be granted the right.
--
-- Matches SeedSecurityData.ACCESS_RIGHT_SEED_SQL (app/db/seeds/seed_security_data.py),
-- which no longer inserts (role 1, right 15). Looks both rows up by code, not by id.
-- Idempotent: DELETE 1 the first time, DELETE 0 after.
--
-- Run against each tenant database (and the default customer database), e.g.:
--   psql "<conn>" -f scripts/revoke_manager_service_config.sql
--
-- To give the right to another role later:
--   INSERT INTO security.role_access_right (role_id, access_right_id)
--   SELECT r.id, a.id FROM security.role r, security.access_right a
--   WHERE r.code = '<ROLE_CODE>' AND a.code = 'MASTERS_SERVICE_CONFIG'
--   ON CONFLICT (role_id, access_right_id) DO NOTHING;

DELETE FROM security.role_access_right
WHERE role_id = (SELECT id FROM security.role WHERE code = 'MANAGER')
  AND access_right_id = (SELECT id FROM security.access_right WHERE code = 'MASTERS_SERVICE_CONFIG');
