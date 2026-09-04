-- Migration: add the JOBS_CORRECT_COST access right (plans/plan.md Step 1).
-- Delta only — id 18 and its one role mapping, not a restatement of ids 1-17.
--
-- Matches SeedSecurityData.ACCESS_RIGHT_SEED_SQL (app/db/seeds/seed_security_data.py)
-- exactly for these two rows. Idempotent (ON CONFLICT DO NOTHING) — safe to run
-- more than once, and safe against a schema that already has row 17 seeded.
--
-- Run against each BU's `security` schema, e.g.:
--   psql "<conn>" -c "SET search_path TO security;" -f scripts/seed_access_right.sql

INSERT INTO security.access_right (id, code, name, module, description)
OVERRIDING SYSTEM VALUE VALUES
    (18, 'JOBS_CORRECT_COST', 'Correct Job Cost', 'JOBS', 'Access to correct cost on finalized/posted jobs')
ON CONFLICT (id) DO NOTHING;

-- MANAGER (role_id=1) only. Deliberately no row for RECEPTIONIST (role_id=3) or
-- TECHNICIAN (role_id=2) — see plan.md's access-right decision.
INSERT INTO security.role_access_right (role_id, access_right_id) VALUES
    (1, 18)
ON CONFLICT (role_id, access_right_id) DO NOTHING;
