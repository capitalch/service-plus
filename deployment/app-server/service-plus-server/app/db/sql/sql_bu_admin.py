"""SQL constants for the bu admin domain.

Split from app/db/sql_store.py — see plans/plan.md Step 3. Also absorbs the
auto-generated DDL previously in app/db/sql_bu.py and app/db/sql_security.py
(now app/db/sql/sql_bu_admin_ddl.py) via inheritance, so the extractor can
keep regenerating that file without touching the hand-maintained constants
below.
"""

from app.db.sql.sql_bu_admin_ddl import BuAdminDdl


class BuAdminSql(BuAdminDdl):
    """SQL constants for the bu admin domain."""

    # ── Admin Users ───────────────────────────────────────────────────────────

    CHECK_ADMIN_EMAIL_EXISTS = """
        with "p_email" as (values(%(email)s::text))
        -- with "p_email" as (values('admin@example.com'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(email) = LOWER((table "p_email"))
        ) AS exists
    """

    CHECK_ADMIN_EMAIL_EXISTS_EXCLUDE_ID = """
        with
            "p_email" as (values(%(email)s::text)),
            "p_id"    as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(email) = LOWER((table "p_email"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_ADMIN_USERNAME_EXISTS = """
        with "p_username" as (values(%(username)s::text))
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(username) = LOWER((table "p_username"))
        ) AS exists
    """

    GET_ADMIN_USER_BY_ID = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT id, username, email, full_name
        FROM security."user"
        WHERE id = (table "p_id") AND is_admin = true
    """

    GET_ADMIN_USERS = """
        SELECT id, username, email, mobile, full_name, is_active, created_at, updated_at
        FROM security."user"
        WHERE is_admin = true
        ORDER BY full_name
    """

    RESET_ADMIN_PASSWORD = """
        with
            "p_id"            as (values(%(id)s::bigint)),
            -- "p_id"            as (values(1::bigint)) -- Test line
            "p_password_hash" as (values(%(password_hash)s::text))
        UPDATE security."user"
        SET password_hash = (table "p_password_hash"), updated_at = now()
        WHERE id = (table "p_id") AND is_admin = true
        RETURNING id
    """

    SET_ADMIN_USER_ACTIVE = """
        with
            "p_id"        as (values(%(id)s::bigint)),
            "p_is_active" as (values(%(is_active)s::boolean))
        UPDATE security."user"
        SET is_active = (table "p_is_active"), updated_at = now()
        WHERE id = (table "p_id") AND is_admin = true
        RETURNING id, is_active, updated_at
    """

    UPDATE_ADMIN_USER = """
        with
            "p_id"        as (values(%(id)s::bigint)),
            "p_full_name" as (values(%(full_name)s::text)),
            "p_email"     as (values(%(email)s::text)),
            "p_mobile"    as (values(%(mobile)s::text))
        UPDATE security."user"
        SET full_name = (table "p_full_name"),
            email     = (table "p_email"),
            mobile    = NULLIF((table "p_mobile"), ''),
            updated_at = now()
        WHERE id = (table "p_id") AND is_admin = true
        RETURNING id, email, full_name, mobile, updated_at
    """

    # ── Branches ──────────────────────────────────────────────────────────────

    CHECK_BRANCH_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('HQ'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM branch
            WHERE LOWER(code) = LOWER((table "p_code"))
        ) AS exists
    """

    CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_code" as (values('HQ'::text)),    -- Test line
        --     "p_id"   as (values(1::bigint))       -- Test line
        SELECT EXISTS(
            SELECT 1 FROM branch
            WHERE LOWER(code) = LOWER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_BRANCH_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM technician        WHERE branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM document_sequence WHERE branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM job               WHERE branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM purchase_invoice  WHERE branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice si JOIN division d ON d.id = si.division_id WHERE d.branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_adjustment  WHERE branch_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_transaction WHERE branch_id = (table "p_id")
        ) AS in_use
    """

    CHECK_BRANCH_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Head Office'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM branch
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('Head Office'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))             -- Test line
        SELECT EXISTS(
            SELECT 1 FROM branch
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_BRANCHES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT b.id, b.address_line1, b.address_line2,
               b.city, b.code, b.email,
               b.gstin, b.is_active, b.is_head_office,
               b.name, b.phone, b.pincode,
               b.state_id, s.name AS state_name
        FROM branch b
        LEFT JOIN state s ON s.id = b.state_id
        ORDER BY b.is_head_office DESC, b.name
    """

    GET_BU_BRANCHES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT b.id, b.code, b.is_active, b.is_head_office, b.name,
               b.gstin, s.gst_state_code
        FROM branch b
        LEFT JOIN state s ON s.id = b.state_id
        WHERE b.is_active = true
        ORDER BY b.is_head_office DESC, b.name
    """

    # ── Business Units (BU) ───────────────────────────────────────────────────

    CHECK_BU_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('SALES'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security.bu
            WHERE LOWER(code) = LOWER((table "p_code"))
        ) AS exists
    """

    CHECK_BU_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_code" as (values('SALES'::text)), -- Test line
        --     "p_id"   as (values(1::bigint)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security.bu
            WHERE LOWER(code) = LOWER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_BU_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Sales Unit'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security.bu
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_BU_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('Sales Unit'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))           -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security.bu
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    DELETE_BU_BY_CODE = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('demo1'::text)) -- Test line
        DELETE FROM security.bu
        WHERE LOWER(code) = LOWER((table "p_code"))
        RETURNING id
    """

    GET_ALL_BUS = """
        with "dummy" as (values(1::int))
        SELECT id, code, name, is_active, created_at, updated_at
        FROM security.bu
        ORDER BY name
    """

    GET_ALL_BUS_WITH_SCHEMA_STATUS = """
        with "dummy" as (values(1::int))
        SELECT
            b.id, b.code, b.name, b.is_active, b.created_at, b.updated_at,
            EXISTS (
                SELECT 1 FROM pg_catalog.pg_namespace
                WHERE nspname = LOWER(b.code)
            ) AS schema_exists,
            EXISTS (
                SELECT 1
                FROM   pg_catalog.pg_class     c
                JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE  n.nspname  = LOWER(b.code)
                  AND  c.relname  = 'job_status'
                  AND  c.reltuples > 0
            ) AS seed_exists
        FROM security.bu b
        ORDER BY b.name
    """

    GET_BU_USER_STATS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            (SELECT COUNT(*)                              FROM security.bu)                               AS total_bu,
            (SELECT COUNT(*) FILTER (WHERE is_active)     FROM security.bu)                              AS active_bu,
            (SELECT COUNT(*) FILTER (WHERE NOT is_active) FROM security.bu)                              AS inactive_bu,
            (SELECT COUNT(*)                              FROM security."user" WHERE is_admin)            AS total_admin_users,
            (SELECT COUNT(*) FILTER (WHERE is_active     AND is_admin) FROM security."user")             AS active_admin_users,
            (SELECT COUNT(*) FILTER (WHERE NOT is_active AND is_admin) FROM security."user")             AS inactive_admin_users,
            (SELECT COUNT(*)                              FROM security."user")                           AS total_users,
            (SELECT COUNT(*) FILTER (WHERE is_active)     FROM security."user")                          AS active_users,
            (SELECT COUNT(*) FILTER (WHERE NOT is_active) FROM security."user")                          AS inactive_users
    """

    GET_ORPHAN_BU_SCHEMAS = """
        SELECT n.nspname AS schema_name
        FROM pg_catalog.pg_namespace n
        WHERE n.nspname NOT IN ('public', 'security', 'information_schema')
          AND n.nspname NOT LIKE 'pg_%%'
          AND NOT EXISTS (
              SELECT 1 FROM security.bu
              WHERE LOWER(code) = n.nspname
          )
        ORDER BY n.nspname
    """

    INSERT_BU = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_name" as (values(%(name)s::text))
        -- with
        --     "p_code" as (values('sales'::text)), -- Test line
        --     "p_name" as (values('Sales Unit'::text)) -- Test line
        INSERT INTO security.bu (code, name)
        VALUES ((table "p_code"), (table "p_name"))
        RETURNING id
    """

    # ── Business Users ────────────────────────────────────────────────────────

    CHECK_BUSINESS_USER_EMAIL_EXISTS = """
        with "p_email" as (values(%(email)s::text))
        -- with "p_email" as (values('user@example.com'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(email) = LOWER((table "p_email"))
        ) AS exists
    """

    CHECK_BUSINESS_USER_EMAIL_EXISTS_EXCLUDE_ID = """
        with
            "p_email" as (values(%(email)s::text)),
            "p_id"    as (values(%(id)s::bigint))
        -- with
        --     "p_email" as (values('user@example.com'::text)), -- Test line
        --     "p_id"    as (values(1::bigint)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(email) = LOWER((table "p_email"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_BUSINESS_USER_USERNAME_EXISTS = """
        with "p_username" as (values(%(username)s::text))
        -- with "p_username" as (values('jsmith'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(username) = LOWER((table "p_username"))
              AND is_admin = false
        ) AS exists
    """

    CHECK_BUSINESS_USER_USERNAME_EXISTS_EXCLUDE_ID = """
        with
            "p_username" as (values(%(username)s::text)),
            "p_id"       as (values(%(id)s::bigint))
        -- with
        --     "p_username" as (values('jsmith'::text)), -- Test line
        --     "p_id"       as (values(1::bigint)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(username) = LOWER((table "p_username"))
              AND is_admin = false
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_BUSINESS_USER_BY_ID = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT id, email, full_name, is_active, is_admin, mobile, username
        FROM security."user"
        WHERE id = (table "p_id") AND is_admin = false
    """

    GET_BUSINESS_USERS = """
        with "dummy" as (values(1::int))
        SELECT
            u.id,
            u.created_at,
            u.email,
            u.full_name,
            u.is_active,
            u.mobile,
            u.updated_at,
            u.username,
            COALESCE(
                ARRAY_AGG(ubr.bu_id ORDER BY ubr.bu_id) FILTER (WHERE ubr.bu_id IS NOT NULL),
                ARRAY[]::bigint[]
            ) AS bu_ids,
            MAX(ubr.role_id) AS role_id,
            MAX(r.name)      AS role_name
        FROM security."user" u
        LEFT JOIN security.user_bu_role ubr ON ubr.user_id = u.id
        LEFT JOIN security.role          r   ON r.id = ubr.role_id
        WHERE u.is_admin = false
        GROUP BY u.id, u.created_at, u.email, u.full_name, u.is_active,
                 u.mobile, u.updated_at, u.username
        ORDER BY u.full_name
    """

    GET_USER_BU_ROLE = """
        with "p_user_id" as (values(%(user_id)s::bigint))
        -- with "p_user_id" as (values(1::bigint)) -- Test line
        SELECT bu_id, role_id
        FROM security.user_bu_role
        WHERE user_id = (table "p_user_id")
        ORDER BY bu_id
    """

    RESET_BUSINESS_USER_PASSWORD = """
        with
            "p_id"            as (values(%(id)s::bigint)),
            -- "p_id"            as (values(1::bigint)) -- Test line
            "p_password_hash" as (values(%(password_hash)s::text))
        UPDATE security."user"
        SET password_hash = (table "p_password_hash"), updated_at = now()
        WHERE id = (table "p_id") AND is_admin = false
        RETURNING id
    """

    # ── Client Management (Super-Admin) ───────────────────────────────────────

    CHECK_CLIENT_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('ACME01'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM public.client
            WHERE LOWER(code) = LOWER((table "p_code"))
        ) AS exists
    """

    CHECK_CLIENT_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            -- "p_code" as (values('ACME01'::text)), -- Test line
            "p_id"   as (values(%(id)s::int))
            -- "p_id"   as (values(1::int)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM public.client
            WHERE LOWER(code) = LOWER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_CLIENT_DB_NAME_IN_USE = """
        with "p_db_name" as (values(%(db_name)s::text))
        SELECT EXISTS(
            SELECT 1 FROM public.client WHERE db_name = (table "p_db_name")
        ) AS exists
    """

    CHECK_CLIENT_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Acme Corp'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM public.client
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_CLIENT_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            -- "p_name" as (values('Acme Corp'::text)), -- Test line
            "p_id"   as (values(%(id)s::int))
            -- "p_id"   as (values(1::int)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM public.client
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    DELETE_CLIENT = """
        with "p_id" as (values(%(id)s::int))
        -- with "p_id" as (values(1::int)) -- Test line
        DELETE FROM public.client
        WHERE id = (table "p_id")
        RETURNING id
    """

    GET_ALL_CLIENTS_ON_CRITERIA = """
        with "criteria" as (values(%(criteria)s::text))
        -- with "criteria" as (values('cap'::text)) -- Test line
        SELECT id, name, is_active
        FROM client
        WHERE LOWER("name") LIKE LOWER((table "criteria") || '%%')
          AND is_active = true
        ORDER BY name
    """

    GET_CLIENT_BY_ID = """
        with "p_id" as (values(%(id)s::int))
        -- with "p_id" as (values(1::int)) -- Test line
        SELECT id, name, is_active, db_name
        FROM public.client
        WHERE id = (table "p_id")
    """

    GET_CLIENT_DB_NAME = """
        with "p_client_id" as (values(%(client_id)s::int))
        -- with "p_client_id" as (values(1::int)) -- Test line
        SELECT db_name, code
        FROM public.client
        WHERE id = (table "p_client_id")
          AND is_active = true
    """

    GET_CLIENT_DB_NAMES = """
        SELECT id, code, name, is_active, db_name,
               address_line1, address_line2, city, country_code,
               email, gstin, pan, phone, pincode, state,
               created_at, updated_at
        FROM public.client
        ORDER BY name
    """

    GET_CLIENT_STATS = """
        SELECT
            COUNT(*)                              AS total_clients,
            COUNT(*) FILTER (WHERE is_active)     AS active_clients,
            COUNT(*) FILTER (WHERE NOT is_active) AS inactive_clients
        FROM public.client
    """

    GET_ORPHAN_DATABASES = """
        SELECT datname
        FROM pg_database
        WHERE datname LIKE 'service_plus_%%'
          AND datname <> 'service_plus_client'
          AND datname NOT IN (
              SELECT db_name FROM public.client WHERE db_name IS NOT NULL
          )
        ORDER BY datname
    """

    UPDATE_CLIENT_DB_NAME = """
        with
            "p_db_name" as (values(%(db_name)s::text)),
            -- "p_db_name" as (values('service_plus_service'::text)) -- Test line
            "p_id"      as (values(%(id)s::int))
            -- "p_id"      as (values(1::int)) -- Test line
        UPDATE public.client
        SET db_name = (table "p_db_name")
        WHERE id = (table "p_id")
        RETURNING id, db_name
    """

    # ── Division (Configurations) ──────────────────────────────────────────────

    GET_DIVISIONS_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT d.id, d.branch_id, d.code, d.name, d.address_line1, d.address_line2,
               d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
               d.gstin, d.web_site, d.is_active, d.account_setting,
               s.gst_state_code
        FROM division d
        LEFT JOIN state s ON s.id = d.state_id
        WHERE d.branch_id = (table "p_branch_id")
        ORDER BY d.name
    """

    GET_ACTIVE_DIVISIONS_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT d.id, d.branch_id, d.code, d.name, d.address_line1, d.address_line2,
               d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
               d.gstin, d.web_site,
               s.gst_state_code, s.id AS state_id, s.name AS state_name
        FROM division d
        LEFT JOIN state s ON s.id = d.state_id
        WHERE d.branch_id = (table "p_branch_id") AND d.is_active = true
        ORDER BY d.name
    """

    GET_DIVISION_BY_ID = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT d.id, d.branch_id, d.code, d.name, d.address_line1, d.address_line2,
               d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
               d.gstin, d.web_site, d.is_active, s.gst_state_code
        FROM division d
        LEFT JOIN state s ON s.id = d.state_id
        WHERE d.id = (table "p_id")
    """

    CHECK_DIVISION_NAME_EXISTS = """
        with "p_branch_id" as (values(%(branch_id)s::bigint)),
             "p_name"      as (values(%(name)s::text))
        SELECT EXISTS(
            SELECT 1 FROM division
            WHERE branch_id = (table "p_branch_id")
              AND UPPER(name) = UPPER((table "p_name"))
        ) AS exists
    """

    CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID = """
        with "p_branch_id" as (values(%(branch_id)s::bigint)),
             "p_name"      as (values(%(name)s::text)),
             "p_id"        as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM division
            WHERE branch_id = (table "p_branch_id")
              AND UPPER(name) = UPPER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_DIVISION_CODE_EXISTS = """
        with "p_branch_id" as (values(%(branch_id)s::bigint)),
             "p_code"      as (values(%(code)s::text))
        SELECT EXISTS(
            SELECT 1 FROM division
            WHERE branch_id = (table "p_branch_id")
              AND UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_DIVISION_CODE_EXISTS_EXCLUDE_ID = """
        with "p_branch_id" as (values(%(branch_id)s::bigint)),
             "p_code"      as (values(%(code)s::text)),
             "p_id"        as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM division
            WHERE branch_id = (table "p_branch_id")
              AND UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_DIVISION_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM job_invoice ji JOIN job j ON j.id = ji.job_id WHERE j.division_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice WHERE division_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM job WHERE division_id = (table "p_id")
        ) AS in_use
    """

    GET_NEXT_DIVISION_ID = """
        SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM division
    """

    GET_DOCUMENT_SEQUENCES_BY_DIVISION = """
        with "p_branch_id"   as (values(%(branch_id)s::bigint)),
             "p_division_id" as (values(%(division_id)s::bigint))
        SELECT
            dt.id   AS document_type_id,
            dt.name AS document_type_name,
            dt.code AS document_type_code,
            ds.id,
            ds.prefix,
            ds.next_number,
            ds.padding,
            ds.separator,
            ds.branch_id,
            ds.division_id
        FROM document_type dt
        LEFT JOIN document_sequence ds
               ON ds.document_type_id = dt.id
              AND ds.branch_id        = (table "p_branch_id")
              AND ds.division_id      = (table "p_division_id")
        WHERE dt.code IN (
            'SERVICE_INVOICE', 'MONEY_RECEIPT', 'SALES_INVOICE',
            'SALES_RETURN_INVOICE', 'SERVICE_RETURN_INVOICE'
        )
        ORDER BY dt.id
    """

    GET_DIVISION_ACCOUNT_SETTING_BY_CODE = """
        WITH "p_code" AS (VALUES(%(code)s::text))
        SELECT d.id, d.account_setting
        FROM division d
        WHERE LOWER(d.code) = LOWER((TABLE "p_code"))
        LIMIT 1
    """

    # ── Document Sequences (Configurations) ───────────────────────────────────

    GET_DOCUMENT_SEQUENCES = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            dt.id as document_type_id, dt.name as document_type_name, dt.code as document_type_code,
            ds.id as id, ds.prefix, ds.next_number, ds.padding, ds.separator, ds.branch_id
        FROM document_type dt
        LEFT JOIN document_sequence ds ON ds.document_type_id = dt.id AND ds.branch_id = (table "p_branch_id")
        ORDER BY dt.id
    """

    GET_BRANCH_ONLY_DOCUMENT_SEQUENCES = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            dt.id   AS document_type_id,
            dt.name AS document_type_name,
            dt.code AS document_type_code,
            ds.id   AS id,
            ds.prefix, ds.next_number, ds.padding, ds.separator, ds.branch_id
        FROM document_type dt
        LEFT JOIN document_sequence ds
               ON ds.document_type_id = dt.id
              AND ds.branch_id        = (table "p_branch_id")
              AND ds.division_id IS NULL
        WHERE dt.code IN ('JOB_SHEET', 'PURCHASE_INVOICE', 'PURCHASE_RETURN_INVOICE')
        ORDER BY dt.id
    """

    CLAIM_NEXT_BATCH_NUMBER = "SELECT nextval('job_batch_no_seq') AS batch_no"

    CLAIM_NEXT_JOB_NUMBER = """
        UPDATE document_sequence
        SET next_number = next_number + 1
        WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'JOB_SHEET')
          AND branch_id = %(branch_id)s
        RETURNING prefix, (next_number - 1) AS assigned_number, padding, separator;
    """

    CLAIM_NEXT_INVOICE_NUMBER = """
        UPDATE document_sequence
        SET next_number = next_number + 1
        WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'SERVICE_INVOICE')
          AND branch_id = %(branch_id)s
          AND division_id = %(division_id)s
        RETURNING prefix, (next_number - 1) AS assigned_number, padding, separator;
    """

    CLAIM_NEXT_SALES_INVOICE_NUMBER = """
        UPDATE document_sequence
        SET next_number = next_number + 1
        WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'SALES_INVOICE')
          AND branch_id = %(branch_id)s
          AND division_id = %(division_id)s
        RETURNING prefix, (next_number - 1) AS assigned_number, padding, separator;
    """

    CLAIM_NEXT_RECEIPT_NUMBER = """
        UPDATE document_sequence
        SET next_number = next_number + 1
        WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'MONEY_RECEIPT')
          AND branch_id = %(branch_id)s
          AND division_id = (SELECT division_id FROM job WHERE id = %(job_id)s)
        RETURNING prefix, (next_number - 1) AS assigned_number, padding, separator;
    """

    DELETE_JOB_INVOICE_LINES_BY_INVOICE = """
        DELETE FROM job_invoice_line WHERE job_invoice_id = %(invoice_id)s
    """

    DELETE_JOB_INVOICE_BY_JOB = """
        DELETE FROM job_invoice WHERE job_id = %(job_id)s
    """

    GET_JOB_IS_FINAL = """
        SELECT is_final FROM job WHERE id = %(id)s
    """

    GET_JOB_IS_CLOSED = """
        SELECT is_closed FROM job WHERE id = %(job_id)s
    """

    GET_JOB_INVOICE_ID_BY_JOB_FOR_UPDATE = """
        SELECT id FROM job_invoice WHERE job_id = %(job_id)s FOR UPDATE
    """

    UPDATE_JOB_INVOICE_AMOUNTS = """
        UPDATE job_invoice
        SET aggregate   = %(aggregate)s,
            cgst_amount = %(cgst_amount)s,
            sgst_amount = %(sgst_amount)s,
            igst_amount = %(igst_amount)s,
            amount      = %(amount)s
        WHERE id = %(invoice_id)s
    """

    # ── Document Types ────────────────────────────────────────────────────────

    CHECK_DOCUMENT_TYPE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('JOB'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM document_type
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_DOCUMENT_TYPE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('JOB'::text)),  -- Test line
        --     "p_id"   as (values(1::smallint))   -- Test line
        SELECT EXISTS(
            SELECT 1 FROM document_type
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_DOCUMENT_TYPE_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM document_sequence WHERE document_type_id = (table "p_id")
        ) AS in_use
    """

    GET_DOCUMENT_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, prefix, name, description, is_system
        FROM document_type
        ORDER BY code
    """

    # ── Financial Years ───────────────────────────────────────────────────────

    CHECK_FY_DATE_OVERLAP = """
        with
            "p_start" as (values(%(start_date)s::date)),
            "p_end"   as (values(%(end_date)s::date))
        -- with
        --     "p_start" as (values('2024-04-01'::date)), -- Test line
        --     "p_end"   as (values('2025-03-31'::date))  -- Test line
        SELECT EXISTS (
            SELECT 1 FROM financial_year
            WHERE start_date < (table "p_end")
              AND end_date   > (table "p_start")
        ) AS overlaps
    """

    CHECK_FY_DATE_OVERLAP_EXCLUDE_ID = """
        with
            "p_start" as (values(%(start_date)s::date)),
            "p_end"   as (values(%(end_date)s::date)),
            "p_id"    as (values(%(id)s::int))
        -- with
        --     "p_start" as (values('2024-04-01'::date)), -- Test line
        --     "p_end"   as (values('2025-03-31'::date)), -- Test line
        --     "p_id"    as (values(2024::int))            -- Test line
        SELECT EXISTS (
            SELECT 1 FROM financial_year
            WHERE start_date < (table "p_end")
              AND end_date   > (table "p_start")
              AND id        <> (table "p_id")
        ) AS overlaps
    """

    CHECK_FY_ID_EXISTS = """
        with "p_id" as (values(%(id)s::int))
        -- with "p_id" as (values(2024::int)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM financial_year
            WHERE id = (table "p_id")
        ) AS exists
    """

    GET_ALL_FINANCIAL_YEARS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, end_date, start_date
        FROM financial_year
        ORDER BY id DESC
    """

    # ── Roles ─────────────────────────────────────────────────────────────────

    GET_ALL_ROLES = """
        with "dummy" as (values(1::int))
        SELECT id, code, description, is_system, name, created_at, updated_at
        FROM security.role
        ORDER BY name
    """

    # ── Schema / Infrastructure ───────────────────────────────────────────────

    CHECK_DB_NAME_EXISTS = """
        with "db_name" as (values(%(db_name)s::text))
        -- with "db_name" as (values('service_plus_service'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM pg_database WHERE datname = (table "db_name")
        ) AS exists
    """

    CHECK_ROLE_SEED_EXISTS = """
        SELECT EXISTS(
            SELECT 1 FROM security.role LIMIT 1
        ) AS exists
    """

    CHECK_ACCESS_RIGHT_SEED_EXISTS = """
        SELECT EXISTS(
            SELECT 1 FROM security.access_right LIMIT 1
        ) AS exists
    """

    CHECK_SCHEMA_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('demo1'::text)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = (table "p_code")
        ) AS exists
    """

    # NOTE: security-schema DDL now lives in app/db/sql_security.py (SqlSecurity),
    # generated from service_plus_service.sql by app/db/tools/extract_schema.py.

    # ── States ────────────────────────────────────────────────────────────────

    CHECK_STATE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('MH'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM state
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_STATE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::int))
        -- with
        --     "p_code" as (values('MH'::text)),  -- Test line
        --     "p_id"   as (values(1::int))        -- Test line
        SELECT EXISTS(
            SELECT 1 FROM state
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_STATE_IN_USE = """
        with "p_id" as (values(%(id)s::int))
        -- with "p_id" as (values(1::int)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM branch           WHERE state_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM division         WHERE state_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM customer_contact WHERE state_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM supplier         WHERE state_id = (table "p_id")
        ) AS in_use
    """

    CHECK_STATE_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Maharashtra'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM state
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_STATE_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::int))
        -- with
        --     "p_name" as (values('Maharashtra'::text)), -- Test line
        --     "p_id"   as (values(1::int))               -- Test line
        SELECT EXISTS(
            SELECT 1 FROM state
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_STATES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, gst_state_code
        FROM state
        WHERE is_active = true
        ORDER BY name
    """

    GET_ALL_STATES_FULL = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, country_code, gst_state_code, is_union_territory, is_active
        FROM state
        ORDER BY name
    """

    # ── User Authentication ───────────────────────────────────────────────────

    GET_USER_BUS = """
        with "p_user_id" as (values(%(user_id)s::bigint))
        -- with "p_user_id" as (values(1::bigint)) -- Test line
        SELECT b.id, b.code, b.is_active, b.name,
               EXISTS (
                   SELECT 1 FROM pg_catalog.pg_namespace n
                   WHERE n.nspname = LOWER(b.code)
               ) AS schema_exists
        FROM security.user_bu_role ubr
        JOIN security.bu b ON b.id = ubr.bu_id
        WHERE ubr.user_id = (table "p_user_id")
          AND ubr.is_active = true
          AND b.is_active = true
        ORDER BY b.name
    """

    GET_USER_BY_ID_FOR_RESET = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT
            u.id,
            u.username,
            u.full_name,
            u.is_active,
            r.code AS role_code,
            COALESCE(
                ARRAY_AGG(ar.code ORDER BY ar.code) FILTER (WHERE ar.code IS NOT NULL),
                ARRAY[]::text[]
            ) AS access_rights
        FROM security."user" u
        LEFT JOIN security.user_bu_role ubr ON ubr.user_id = u.id AND ubr.is_active = true
        LEFT JOIN security.role          r   ON r.id = ubr.role_id
        LEFT JOIN security.role_access_right rar ON rar.role_id = r.id
        LEFT JOIN security.access_right  ar  ON ar.id = rar.access_right_id
        WHERE u.id = (table "p_id")
        GROUP BY u.id, u.username, u.full_name, u.is_active, r.code
    """

    GET_USER_BY_IDENTITY = """
        with "p_identity" as (values(%(identity)s::text))
        -- with "p_identity" as (values('admin'::text)) -- Test line
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.is_active,
            u.is_admin,
            u.last_used_branch_id,
            u.last_used_bu_id,
            u.mobile,
            u.password_hash,
            u.username,
            r.name AS role_name,
            r.code AS role_code,
            COALESCE(
                ARRAY_AGG(ar.code ORDER BY ar.code) FILTER (WHERE ar.code IS NOT NULL),
                ARRAY[]::text[]
            ) AS access_rights
        FROM security."user" u
        LEFT JOIN security.user_bu_role ubr ON ubr.user_id = u.id AND ubr.is_active = true
        LEFT JOIN security.role          r   ON r.id = ubr.role_id
        LEFT JOIN security.role_access_right rar ON rar.role_id = r.id
        LEFT JOIN security.access_right  ar  ON ar.id = rar.access_right_id
        WHERE (
            LOWER(u.username) = LOWER((table "p_identity"))
            OR LOWER(u.email) = LOWER((table "p_identity"))
        )
        GROUP BY u.id, u.email, u.full_name, u.is_active, u.is_admin,
                 u.last_used_branch_id, u.last_used_bu_id,
                 u.mobile, u.password_hash, u.username, r.name, r.code
    """

    SET_USER_PASSWORD = """
        with
            "p_id"            as (values(%(id)s::bigint)),
            -- "p_id"            as (values(1::bigint)) -- Test line
            "p_password_hash" as (values(%(password_hash)s::text))
        UPDATE security."user"
        SET password_hash = (table "p_password_hash"), updated_at = now()
        WHERE id = (table "p_id")
        RETURNING id
    """
