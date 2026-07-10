"""
security-schema seed data. Hand-maintained — not touched by the extractor.

Ported from the frontend's SEED_BATCHES (src/features/super-admin/constants/seed-data.ts),
which this replaces. All INSERTs use ON CONFLICT DO NOTHING and are safe to re-run.

access_right / role_access_right rows below implement the 6-code catalog and
role -> rights mapping from plans/plan-access-control.md ("Access-right catalog"
and "Role -> rights mapping" tables). TECHNICIAN intentionally gets zero
role_access_right rows — the mapping grants it none of the 6 gated rights.
"""


class SeedSecurityData:
    """Seed SQL for a newly created (or re-seeded) client's security schema."""

    # Add more seed batches here as needed.
    SECURITY_SEED_SQL = """
        INSERT INTO security.role (id, code, name, description, is_system) VALUES
            (1, 'MANAGER',      'Manager',      'Manage orders, customers, reports',      true),
            (2, 'TECHNICIAN',   'Technician',   'Manage service orders and update status', true),
            (3, 'RECEPTIONIST', 'Receptionist', 'Create orders, view customers',           true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO security.access_right (id, code, name, module, description)
        OVERRIDING SYSTEM VALUE VALUES
            (1, 'JOBS_RECEIPTS',         'Receipts',         'JOBS',           'Access to Jobs -> Receipts'),
            (2, 'JOBS_OPENING_JOBS',     'Opening Jobs',     'JOBS',           'Access to Jobs -> Opening Jobs'),
            (3, 'JOBS_ACCOUNTS_POSTING', 'Accounts Posting', 'JOBS',           'Access to Jobs -> Accounts Posting'),
            (4, 'MASTERS_MENU',          'Masters',          'MASTERS',        'Access to the Masters tab'),
            (5, 'CONFIG_MENU',           'Configurations',   'CONFIGURATIONS', 'Access to the Configurations tab'),
            (6, 'ADMIN_MENU',            'Admin',            'ADMIN',          'Access to the Admin (Post/Unpost) tab')
        ON CONFLICT (id) DO NOTHING;

        -- MANAGER (role_id=1): every right
        -- RECEPTIONIST (role_id=3): every right except CONFIG_MENU and ADMIN_MENU
        -- TECHNICIAN (role_id=2): none — no rows
        INSERT INTO security.role_access_right (role_id, access_right_id) VALUES
            (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
            (3, 1), (3, 2), (3, 3), (3, 4)
        ON CONFLICT (role_id, access_right_id) DO NOTHING;
    """
