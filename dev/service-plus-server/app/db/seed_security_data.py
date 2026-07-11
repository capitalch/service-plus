"""
security-schema seed data. Hand-maintained — not touched by the extractor.

Ported from the frontend's SEED_BATCHES (src/features/super-admin/constants/seed-data.ts),
which this replaces. All INSERTs use ON CONFLICT DO NOTHING and are safe to re-run.

access_right / role_access_right rows below implement the 13-code catalog and
role -> rights mapping from plans/plan-access-control.md ("Access-right catalog"
and "Role -> rights mapping" tables), plus the 7-code extension from plans/plan.md
("Design: seven new access-right codes" and its "Role -> rights mapping"), plus
the 2-code Masters extension (MASTERS_ORGANIZATION, MASTERS_SERVICE_CONFIG) that
restricts Receptionist from Masters -> Organization and Masters -> Service Config.
TECHNICIAN intentionally gets zero role_access_right rows — the mapping grants
it none of the gated rights.
"""


class SeedSecurityData:
    """Seed SQL for a newly created (or re-seeded) client's security schema."""

    # Add more seed batches here as needed.
    ROLE_SEED_SQL = """
        INSERT INTO security.role (id, code, name, description, is_system) VALUES
            (1, 'MANAGER',      'Manager',      'Manage orders, customers, reports',      true),
            (2, 'TECHNICIAN',   'Technician',   'Manage service orders and update status', true),
            (3, 'RECEPTIONIST', 'Receptionist', 'Create orders, view customers',           true)
        ON CONFLICT (id) DO NOTHING;
    """

    ACCESS_RIGHT_SEED_SQL = """
        INSERT INTO security.access_right (id, code, name, module, description)
        OVERRIDING SYSTEM VALUE VALUES
            (1,  'JOBS_RECEIPTS',               'Receipts',              'JOBS',      'Access to Jobs -> Receipts'),
            (2,  'JOBS_OPENING_JOBS',           'Opening Jobs',          'JOBS',      'Access to Jobs -> Opening Jobs'),
            (3,  'JOBS_ACCOUNTS_POSTING',       'Accounts Posting',      'JOBS',      'Access to Jobs -> Accounts Posting'),
            (4,  'MASTERS_MENU',                'Masters',               'MASTERS',        'Access to the Masters tab'),
            (5,  'CONFIG_MENU',                 'Configurations',        'CONFIGURATIONS', 'Access to the Configurations tab'),
            (6,  'ADMIN_MENU',                  'Admin',                 'ADMIN',          'Access to the Admin (Post/Unpost) tab'),
            (7,  'JOBS_DELIVER_JOB',            'Deliver Job',           'JOBS',      'Access to Jobs -> Deliver Job'),
            (8,  'INVENTORY_PURCHASE_ENTRY',    'Purchase Entry',        'INVENTORY', 'Access to Inventory -> Purchase Entry'),
            (9,  'INVENTORY_SALES_ENTRY',       'Sales Entry',           'INVENTORY', 'Access to Inventory -> Sales Entry'),
            (10, 'INVENTORY_STOCK_ADJUSTMENT',  'Stock Adjustment',      'INVENTORY', 'Access to Inventory -> Stock Adjustment'),
            (11, 'INVENTORY_BRANCH_TRANSFER',   'Branch Transfer',       'INVENTORY', 'Access to Inventory -> Branch Transfer'),
            (12, 'INVENTORY_OPENING_STOCK',     'Opening Stock',         'INVENTORY', 'Access to Inventory -> Opening Stock'),
            (13, 'INVENTORY_SET_PART_LOCATION', 'Set Part Location',     'INVENTORY', 'Access to Inventory -> Set Part Location'),
            (14, 'MASTERS_ORGANIZATION',        'Masters: Organization', 'MASTERS',   'Access to Masters -> Organization'),
            (15, 'MASTERS_SERVICE_CONFIG',      'Masters: Service Config', 'MASTERS', 'Access to Masters -> Service Config')
        ON CONFLICT (id) DO NOTHING;

        -- MANAGER (role_id=1): every right
        -- RECEPTIONIST (role_id=3): every right except CONFIG_MENU, ADMIN_MENU,
        --                           MASTERS_ORGANIZATION and MASTERS_SERVICE_CONFIG
        -- TECHNICIAN (role_id=2): none — no rows
        INSERT INTO security.role_access_right (role_id, access_right_id) VALUES
            (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15),
            (3, 1), (3, 2), (3, 3), (3, 4), (3, 7), (3, 8), (3, 9), (3, 10), (3, 11), (3, 12), (3, 13)
        ON CONFLICT (role_id, access_right_id) DO NOTHING;
    """

    # Automatic new-client-creation path (resolve_create_service_db_helper)
    # calls this combined constant so it doesn't need to know about the
    # roles/access-rights split used by the two-step re-seed wizard.
    SECURITY_SEED_SQL = ROLE_SEED_SQL + ACCESS_RIGHT_SEED_SQL
