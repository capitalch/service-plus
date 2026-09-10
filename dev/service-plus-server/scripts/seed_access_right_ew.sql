-- Migration: add the Extended Warranty access rights (plans/plan.md, Step 2).
-- Delta only — ids 19 and 20 plus their role mappings, not a restatement of ids 1-18.
--
-- Matches SeedSecurityData.ACCESS_RIGHT_SEED_SQL (app/db/seeds/seed_security_data.py)
-- exactly for these rows. Idempotent (ON CONFLICT DO NOTHING).
--
-- Run against each tenant's `security` schema, e.g.:
--   psql "<conn>" -f scripts/seed_access_right_ew.sql
--
-- NOTE: an EXISTING tenant only receives new rights when someone re-runs the
-- super-admin Seed Roles dialog (or this script). Adding the codes to the four
-- client/server maps is not enough on its own.

INSERT INTO security.access_right (id, code, name, module, description)
OVERRIDING SYSTEM VALUE VALUES
    (19, 'CUSTOM_MENU',               'Custom',             'CUSTOM', 'Access to the Custom tab (add-on services)'),
    (20, 'CUSTOM_EXTENDED_WARRANTY',  'Extended Warranty',  'CUSTOM', 'Access to Custom -> Extended Warranty')
ON CONFLICT (id) DO NOTHING;

-- MANAGER (role_id=1): both. RECEPTIONIST (role_id=3): both — following up warranty
-- leads is front-desk work, the same reasoning that gives them JOBS_CUSTOMER_CONNECT.
-- TECHNICIAN (role_id=2): none.
INSERT INTO security.role_access_right (role_id, access_right_id) VALUES
    (1, 19), (1, 20),
    (3, 19), (3, 20)
ON CONFLICT (role_id, access_right_id) DO NOTHING;
