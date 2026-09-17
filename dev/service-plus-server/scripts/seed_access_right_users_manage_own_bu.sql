-- Migration: add the USERS_MANAGE_OWN_BU access right (plans/plan.md, Step 3).
-- Delta only — id 21 plus its role mapping, not a restatement of ids 1-20.
--
-- Matches SeedSecurityData.ACCESS_RIGHT_SEED_SQL (app/db/seeds/seed_security_data.py)
-- exactly for this row. Idempotent (ON CONFLICT DO NOTHING).
--
-- Run against each tenant's `security` schema, e.g.:
--   psql "<conn>" -f scripts/seed_access_right_users_manage_own_bu.sql
--
-- NOTE: an EXISTING tenant only receives new rights when someone re-runs the
-- super-admin Seed Roles dialog (or this script). Adding the code to the four
-- client/server maps is not enough on its own.

INSERT INTO security.access_right (id, code, name, module, description)
OVERRIDING SYSTEM VALUE VALUES
    (21, 'USERS_MANAGE_OWN_BU', 'Manage Own BU Users', 'ADMIN',
     'Create a business user (any role except Manager) for a BU this Manager themself manages — see plans/plan.md')
ON CONFLICT (id) DO NOTHING;

-- MANAGER (role_id=1) only, by design: lets a Manager create Technician/Receptionist
-- users for their own BU, never another Manager. RECEPTIONIST/TECHNICIAN get nothing.
INSERT INTO security.role_access_right (role_id, access_right_id) VALUES
    (1, 21)
ON CONFLICT (role_id, access_right_id) DO NOTHING;
