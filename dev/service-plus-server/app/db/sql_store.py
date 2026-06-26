"""
Centralized SQL store for the entire application.

All SQL strings (application, admin, auth, and super-admin) live here in a
single class — SqlStore.  Sections are ordered alphabetically.
"""
# from psycopg import sql as pgsql


class SqlStore:
    """Single source of truth for every SQL query and builder in the server."""

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

    # ── Brands ────────────────────────────────────────────────────────────────

    CHECK_BRAND_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('SAMSUNG'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM brand
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_BRAND_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_code" as (values('SAMSUNG'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))        -- Test line
        SELECT EXISTS(
            SELECT 1 FROM brand
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_BRAND_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM spare_part_master   WHERE brand_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM product_brand_model WHERE brand_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_ADDITIONAL_CHARGES = """
        with "dummy" as (values(1::int))
        SELECT id, name, hsn_code
        FROM additional_charge
        ORDER BY name
    """

    GET_ALL_BRANDS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, is_active,
               false       AS is_system,
               NULL::text  AS description,
               NULL::int   AS display_order,
               NULL::text  AS prefix
        FROM brand
        ORDER BY name
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
               s.gst_state_code, s.id AS state_id
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

    # ── Customer Types ────────────────────────────────────────────────────────

    CHECK_CUSTOMER_TYPE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('IND'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM customer_type
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_CUSTOMER_TYPE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('IND'::text)),  -- Test line
        --     "p_id"   as (values(1::smallint))   -- Test line
        SELECT EXISTS(
            SELECT 1 FROM customer_type
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_CUSTOMER_TYPE_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM customer_contact WHERE customer_type_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_CUSTOMER_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name
        FROM customer_type
        WHERE is_active = true
        ORDER BY display_order NULLS LAST, name
    """

    GET_CUSTOMER_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM customer_type
        ORDER BY display_order NULLS LAST, name
    """

    # ── Customers ─────────────────────────────────────────────────────────────

    CHECK_CUSTOMER_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job           WHERE customer_contact_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice WHERE customer_contact_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_CUSTOMERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            cc.id, cc.customer_type_id, cc.full_name, cc.gstin,
            cc.mobile, cc.alternate_mobile, cc.email,
            cc.address_line1, cc.address_line2, cc.landmark,
            cc.state_id, cc.city, cc.postal_code, cc.remarks, cc.is_active,
            ct.name AS customer_type_name,
            s.name  AS state_name
        FROM customer_contact cc
        JOIN  customer_type ct ON ct.id = cc.customer_type_id
        LEFT JOIN state s      ON s.id  = cc.state_id
        ORDER BY cc.full_name NULLS LAST, cc.mobile
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

    # ── Job Delivery Manners ──────────────────────────────────────────────────

    CHECK_JOB_DELIVERY_MANNER_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('PICKUP'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_delivery_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_DELIVERY_MANNER_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('PICKUP'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_delivery_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_DELIVERY_MANNER_IN_USE = """
        with "dummy" as (values(1::int))
        SELECT false AS in_use
    """

    GET_JOB_DELIVERY_MANNERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, display_order, is_active, is_system
        FROM job_delivery_manner
        ORDER BY display_order NULLS LAST, name
    """

    # ── Job Receive Conditions ────────────────────────────────────────────────

    CHECK_JOB_RECEIVE_CONDITION_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('GOOD'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_condition
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_RECEIVE_CONDITION_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('GOOD'::text)),  -- Test line
        --     "p_id"   as (values(1::smallint))    -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_condition
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_RECEIVE_CONDITION_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_receive_condition_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_RECEIVE_CONDITIONS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_receive_condition
        ORDER BY (display_order = 0), display_order, name
    """

    # ── Job Receive Manners ───────────────────────────────────────────────────

    CHECK_JOB_RECEIVE_MANNER_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('WALKIN'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_RECEIVE_MANNER_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('WALKIN'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_receive_manner
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_RECEIVE_MANNER_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_receive_manner_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_RECEIVE_MANNERS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, display_order, is_active, is_system
        FROM job_receive_manner ORDER BY (display_order = 0), display_order, code
    """

    # ── Job Statuses ──────────────────────────────────────────────────────────

    GET_JOB_STATUSES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_status
        ORDER BY display_order NULLS LAST, name
    """

    # ── Job Types ─────────────────────────────────────────────────────────────

    CHECK_JOB_TYPE_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('REPAIR'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_type
            WHERE UPPER(code) = UPPER((table "p_code"))
        ) AS exists
    """

    CHECK_JOB_TYPE_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code" as (values(%(code)s::text)),
            "p_id"   as (values(%(id)s::smallint))
        -- with
        --     "p_code" as (values('REPAIR'::text)), -- Test line
        --     "p_id"   as (values(1::smallint))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM job_type
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND id <> (table "p_id")
        ) AS exists
    """

    CHECK_JOB_TYPE_IN_USE = """
        with "p_id" as (values(%(id)s::smallint))
        -- with "p_id" as (values(1::smallint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE job_type_id = (table "p_id")
        ) AS in_use
    """

    GET_JOB_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, description, display_order, is_active, is_system
        FROM job_type
        ORDER BY (display_order = 0), display_order, code;
    """

    # ── Models (product_brand_model) ──────────────────────────────────────────

    CHECK_MODEL_EXISTS = """
        with
            "p_product_id" as (values(%(product_id)s::bigint)),
            "p_brand_id"   as (values(%(brand_id)s::bigint)),
            "p_model_name" as (values(%(model_name)s::text))
        SELECT EXISTS(
            SELECT 1 FROM product_brand_model
            WHERE product_id            = (table "p_product_id")
              AND brand_id              = (table "p_brand_id")
              AND UPPER(model_name)     = UPPER((table "p_model_name"))
        ) AS exists
    """

    CHECK_MODEL_EXISTS_EXCLUDE_ID = """
        with
            "p_product_id" as (values(%(product_id)s::bigint)),
            "p_brand_id"   as (values(%(brand_id)s::bigint)),
            "p_model_name" as (values(%(model_name)s::text)),
            "p_id"         as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM product_brand_model
            WHERE product_id            = (table "p_product_id")
              AND brand_id              = (table "p_brand_id")
              AND UPPER(model_name)     = UPPER((table "p_model_name"))
              AND id                   <> (table "p_id")
        ) AS exists
    """

    CHECK_MODEL_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job WHERE product_brand_model_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_MODELS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            m.id, m.product_id, m.brand_id, m.model_name,
            m.launch_year, m.remarks, m.is_active,
            p.name AS product_name,
            b.name AS brand_name
        FROM product_brand_model m
        JOIN product p ON p.id = m.product_id
        JOIN brand   b ON b.id = m.brand_id
        ORDER BY p.name, b.name, m.model_name
    """

    # ── Parts (spare_part_master) ─────────────────────────────────────────────

    CHECK_PART_CODE_EXISTS = """
        with
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text))
        SELECT EXISTS(
            SELECT 1 FROM spare_part_master
            WHERE brand_id              = (table "p_brand_id")
              AND UPPER(part_code)      = UPPER((table "p_part_code"))
        ) AS exists
    """

    CHECK_PART_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text)),
            "p_id"        as (values(%(id)s::bigint))
        SELECT EXISTS(
            SELECT 1 FROM spare_part_master
            WHERE brand_id              = (table "p_brand_id")
              AND UPPER(part_code)      = UPPER((table "p_part_code"))
              AND id                   <> (table "p_id")
        ) AS exists
    """

    CHECK_PART_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job_part_used         WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM purchase_invoice_line WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM sales_invoice_line    WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_adjustment_line WHERE part_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_transaction     WHERE part_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_PARTS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        ORDER BY b.name, p.part_code
    """

    GET_PARTS_USAGE_STATS_BY_BRAND = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        SELECT
            COUNT(*)                                                          AS total,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM job_part_used         WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM purchase_invoice_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM sales_invoice_line    WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_adjustment_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_transaction     WHERE part_id = p.id
            ))                                                                AS in_use_count,
            COUNT(*) FILTER (WHERE NOT EXISTS (
                SELECT 1 FROM job_part_used         WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM purchase_invoice_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM sales_invoice_line    WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_adjustment_line WHERE part_id = p.id
                UNION ALL
                SELECT 1 FROM stock_transaction     WHERE part_id = p.id
            ))                                                                AS deletable_count
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
    """

    DELETE_UNUSED_PARTS_BY_BRAND = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        DELETE FROM spare_part_master
        WHERE brand_id = (table "p_brand_id")
          AND NOT EXISTS (
              SELECT 1 FROM job_part_used         WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM purchase_invoice_line WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM sales_invoice_line    WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM stock_adjustment_line WHERE part_id = spare_part_master.id
              UNION ALL
              SELECT 1 FROM stock_transaction     WHERE part_id = spare_part_master.id
          )
        RETURNING id
    """

    # ── Part Location Master ──────────────────────────────────────────────────

    CHECK_PART_LOCATION_EXISTS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_location"  as (values(%(location)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)),          -- Test line
        --     "p_location"  as (values('Shelf A'::text))     -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_location_master
            WHERE branch_id       = (table "p_branch_id")
              AND LOWER(name)     = LOWER((table "p_location"))
        ) AS exists
    """

    CHECK_PART_LOCATION_EXISTS_EXCLUDE_ID = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_location"  as (values(%(location)s::text)),
            "p_id"        as (values(%(id)s::bigint))
        -- with
        --     "p_branch_id" as (values(1::bigint)),          -- Test line
        --     "p_location"  as (values('Shelf A'::text)),    -- Test line
        --     "p_id"        as (values(1::bigint))           -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_location_master
            WHERE branch_id       = (table "p_branch_id")
              AND LOWER(name)     = LOWER((table "p_location"))
              AND id             <> (table "p_id")
        ) AS exists
    """

    CHECK_PART_LOCATION_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM stock_balance        WHERE location_id    = (table "p_id")
            UNION ALL
            SELECT 1 FROM stock_location_change WHERE to_location_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_PART_LOCATIONS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            pl.id, pl.branch_id, pl.name AS location, pl.is_active,
            b.name AS branch_name
        FROM stock_location_master pl
        JOIN branch b ON b.id = pl.branch_id
        ORDER BY b.name, pl.name
    """

    # ── Set Part Location ─────────────────────────────────────────────────────

    GET_STOCK_BALANCE_WITH_LOCATION = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            sb.part_id,
            p.part_code,
            p.part_name,
            p.part_description,
            p.category,
            p.model,
            p.uom,
            sb.qty,
            sb.location_id,
            lm.name AS location_name
        FROM stock_balance sb
        JOIN spare_part_master p           ON p.id  = sb.part_id
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE sb.branch_id = (table "p_branch_id")
        ORDER BY p.part_code
    """

    GET_ACTIVE_LOCATIONS_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT id, name AS location
        FROM stock_location_master
        WHERE branch_id = (table "p_branch_id")
          AND is_active = true
        ORDER BY name
    """

    GET_PART_IN_STOCK_BY_CODE = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_part_code" as (values(%(part_code)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)),        -- Test line
        --     "p_part_code" as (values('ABC-001'::text))   -- Test line
        SELECT
            p.id        AS part_id,
            p.part_code,
            p.part_name,
            p.uom,
            sb.qty,
            sb.location_id,
            lm.name     AS location_name
        FROM spare_part_master p
        JOIN stock_balance sb              ON sb.part_id   = p.id
                                          AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id        = sb.location_id
        WHERE LOWER(p.part_code) = LOWER((table "p_part_code"))
    """

    GET_PART_LOCATION_HISTORY = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_part_id" as (values(1::bigint)), "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            slc.id,
            slc.transaction_date,
            slc.ref_no,
            slc.remarks,
            lm.name AS location_name
        FROM stock_location_change slc
        JOIN stock_location_master lm ON lm.id = slc.to_location_id
        WHERE slc.part_id   = (table "p_part_id")
          AND slc.branch_id = (table "p_branch_id")
        ORDER BY slc.transaction_date DESC, slc.created_at DESC
        LIMIT 20
    """

    # ── Part Finder ───────────────────────────────────────────────────────────

    PART_FINDER_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_brand"     as (values(%(brand)s::text)),
            "p_location"  as (values(%(location)s::text)),
            "p_status"    as (values(%(stock_status)s::text))
        -- with "p_branch_id" as (values(1::bigint)), "p_search" as (values(''::text)),
        --      "p_brand" as (values(''::text)), "p_location" as (values(''::text)),
        --      "p_status" as (values('all'::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        LEFT JOIN brand b                  ON b.id  = p.brand_id
        LEFT JOIN stock_balance sb         ON sb.part_id  = p.id
                                         AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE p.is_active = true
          AND ((table "p_search") = ''
               OR LOWER(p.part_code)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(p.part_name)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.category, ''))         LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
          AND ((table "p_brand")    = '' OR LOWER(COALESCE(b.name, ''))   = LOWER((table "p_brand")))
          AND ((table "p_location") = '' OR LOWER(COALESCE(lm.name, '')) = LOWER((table "p_location")))
          AND (
              (table "p_status") = 'all'
              OR ((table "p_status") = 'out_of_stock' AND COALESCE(sb.qty, 0) = 0)
              OR ((table "p_status") = 'low_stock'    AND COALESCE(sb.qty, 0) > 0
                                                      AND COALESCE(sb.qty, 0) <= 5)
              OR ((table "p_status") = 'in_stock'     AND COALESCE(sb.qty, 0) > 5)
          )
    """

    PART_FINDER_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_brand"     as (values(%(brand)s::text)),
            "p_location"  as (values(%(location)s::text)),
            "p_status"    as (values(%(stock_status)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        -- with "p_branch_id" as (values(1::bigint)), "p_search" as (values(''::text)),
        --      "p_brand" as (values(''::text)), "p_location" as (values(''::text)),
        --      "p_status" as (values('all'::text)),
        --      "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id,
            p.part_code,
            p.part_name,
            p.part_description,
            p.category,
            p.model,
            b.name                                          AS brand_name,
            p.uom,
            p.cost_price,
            p.mrp,
            p.hsn_code,
            p.gst_rate,
            COALESCE(sb.qty, 0)                             AS qty,
            CASE WHEN sb.location_id IS NOT NULL THEN 1
                 ELSE 0 END                                 AS location_count,
            lm.name                                         AS primary_location,
            lm.id                                           AS primary_location_id,
            COUNT(*) OVER()                                 AS total
        FROM spare_part_master p
        LEFT JOIN brand b                  ON b.id  = p.brand_id
        LEFT JOIN stock_balance sb         ON sb.part_id  = p.id
                                         AND sb.branch_id = (table "p_branch_id")
        LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE p.is_active = true
          AND ((table "p_search") = ''
               OR LOWER(p.part_code)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(p.part_name)                      LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.category, ''))         LIKE '%%' || LOWER((table "p_search")) || '%%'
               OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
          AND ((table "p_brand")    = '' OR LOWER(COALESCE(b.name, ''))   = LOWER((table "p_brand")))
          AND ((table "p_location") = '' OR LOWER(COALESCE(lm.name, '')) = LOWER((table "p_location")))
          AND (
              (table "p_status") = 'all'
              OR ((table "p_status") = 'out_of_stock' AND COALESCE(sb.qty, 0) = 0)
              OR ((table "p_status") = 'low_stock'    AND COALESCE(sb.qty, 0) > 0
                                                      AND COALESCE(sb.qty, 0) <= 5)
              OR ((table "p_status") = 'in_stock'     AND COALESCE(sb.qty, 0) > 5)
          )
        ORDER BY p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    PART_FINDER_DISTINCT_CATEGORIES = """
        SELECT DISTINCT category AS value
        FROM spare_part_master
        WHERE is_active = true
          AND category IS NOT NULL
          AND category <> ''
        ORDER BY category
    """

    PART_FINDER_DISTINCT_MODELS = """
        SELECT DISTINCT model AS value
        FROM spare_part_master
        WHERE is_active = true
          AND model IS NOT NULL
          AND model <> ''
        ORDER BY model
    """

    PART_FINDER_STOCK_BY_LOCATION = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_part_id" as (values(1::bigint)), "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            lm.id   AS location_id,
            lm.name AS location_name,
            sb.qty
        FROM stock_balance sb
        JOIN stock_location_master lm ON lm.id = sb.location_id
        WHERE sb.part_id   = (table "p_part_id")
          AND sb.branch_id = (table "p_branch_id")
        ORDER BY lm.name
    """

    SET_PART_LOCATIONS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_date"      as (values(%(transaction_date)s::date)),
            "p_ref_no"    as (values(%(ref_no)s::text)),
            "p_remarks"   as (values(%(remarks)s::text)),
        -- with
        --     "p_branch_id" as (values(1::bigint)),             -- Test line
        --     "p_date"      as (values('2026-04-17'::date)),    -- Test line
        --     "p_ref_no"    as (values(''::text)),              -- Test line
        --     "p_remarks"   as (values(''::text)),              -- Test line
            "p_pairs" AS (
                SELECT
                    UNNEST(%(part_ids)s::bigint[])     AS part_id,
                    UNNEST(%(location_ids)s::bigint[]) AS location_id
            ),
            insert_history AS (
                INSERT INTO stock_location_change
                    (part_id, branch_id, to_location_id, transaction_date, ref_no, remarks)
                SELECT
                    p.part_id,
                    (table "p_branch_id"),
                    p.location_id,
                    (table "p_date"),
                    NULLIF((table "p_ref_no"),  ''),
                    NULLIF((table "p_remarks"), '')
                FROM "p_pairs" p
                RETURNING id
            )
        UPDATE stock_balance sb
        SET    location_id = pairs.location_id,
               updated_at  = now()
        FROM   "p_pairs" pairs
        WHERE  sb.part_id   = pairs.part_id
          AND  sb.branch_id = (table "p_branch_id")
    """

    GET_EXISTING_PART_CODES = """
        with "p_brand_id" as (values(%(brand_id)s::bigint))
        -- with "p_brand_id" as (values(1::bigint)) -- Test line
        SELECT UPPER(part_code) AS part_code
        FROM spare_part_master
        WHERE brand_id = (table "p_brand_id")
    """

    GET_PARTS_BY_BRAND_COUNT = """
        with
            "p_brand_id" as (values(%(brand_id)s::bigint)),
            "p_search"   as (values(%(search)s::text))
        -- with "p_brand_id" as (values(1::bigint)), "p_search" as (values(''::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
          AND ((table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PARTS_BY_BRAND_PAGED = """
        with
            "p_brand_id" as (values(%(brand_id)s::bigint)),
            "p_search"   as (values(%(search)s::text)),
            "p_limit"    as (values(%(limit)s::int)),
            "p_offset"   as (values(%(offset)s::int))
        -- with "p_brand_id" as (values(1::bigint)), "p_search" as (values(''::text)), "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active
        FROM spare_part_master p
        WHERE p.brand_id = (table "p_brand_id")
          AND ((table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))            LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_COUNT = """
        with "p_search" as (values(%(search)s::text))
        -- with "p_search" as (values(''::text)) -- Test line
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
    """

    GET_PARTS_PAGED = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        -- with "p_search" as (values(''::text)), "p_limit" as (values(50::int)), "p_offset" as (values(0::int)) -- Test line
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.part_name)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PART_BY_CODE = """
        with
            "p_code"     as (values(%(code)s::text)),
            "p_brand_id" as (values(%(brand_id)s::bigint))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE LOWER(p.part_code) = LOWER((table "p_code"))
          AND ((table "p_brand_id") IS NULL OR p.brand_id = (table "p_brand_id"))
    """

    GET_PARTS_BY_CODE_PREFIX = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code) LIKE LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_BY_KEYWORD = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            p.id, p.brand_id, p.part_code, p.part_name,
            p.part_description, p.category, p.model, p.uom,
            p.cost_price, p.selling_price, p.mrp, p.hsn_code, p.gst_rate, p.is_active,
            b.name AS brand_name
        FROM spare_part_master p
        JOIN brand b ON b.id = p.brand_id
        WHERE (table "p_search") = ''
           OR LOWER(p.part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, ''))           LIKE '%%' || LOWER((table "p_search")) || '%%'
        ORDER BY b.name, p.part_code
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PARTS_BY_CODE_PREFIX_COUNT = """
        with "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE (table "p_search") = ''
           OR LOWER(p.part_code) LIKE LOWER((table "p_search")) || '%%'
    """

    GET_PARTS_BY_KEYWORD_COUNT = """
        with "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM spare_part_master p
        WHERE (table "p_search") = ''
           OR LOWER(p.part_name)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.part_description, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.model, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(p.category, ''))           LIKE '%%' || LOWER((table "p_search")) || '%%'
    """

    # ── Products ──────────────────────────────────────────────────────────────

    CHECK_PRODUCT_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM product_brand_model WHERE product_id = (table "p_id")
        ) AS in_use
    """

    CHECK_PRODUCT_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('LAPTOP'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM product
            WHERE UPPER(name) = UPPER((table "p_name"))
        ) AS exists
    """

    CHECK_PRODUCT_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('LAPTOP'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))       -- Test line
        SELECT EXISTS(
            SELECT 1 FROM product
            WHERE UPPER(name) = UPPER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_PRODUCTS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, name, is_active
        FROM product
        ORDER BY name
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

    CHECK_SCHEMA_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('demo1'::text)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = (table "p_code")
        ) AS exists
    """

    SECURITY_SCHEMA_DDL = """
        DROP SCHEMA IF EXISTS public CASCADE;

        CREATE SCHEMA IF NOT EXISTS security;

        CREATE TABLE security.access_right (
            id          integer NOT NULL,
            code        text    NOT NULL,
            name        text    NOT NULL,
            module      text    NOT NULL,
            description text,
            created_at  timestamp with time zone DEFAULT now() NOT NULL,
            updated_at  timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT access_right_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
        );
        ALTER TABLE security.access_right ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME security.access_right_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY security.access_right ADD CONSTRAINT access_right_code_key UNIQUE (code);
        ALTER TABLE ONLY security.access_right ADD CONSTRAINT access_right_pkey PRIMARY KEY (id);
        CREATE INDEX access_right_module_idx ON security.access_right USING btree (module);

        CREATE TABLE security.bu (
            id         bigint  NOT NULL,
            code       text    NOT NULL,
            name       text    NOT NULL,
            is_active  boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );
        ALTER TABLE security.bu ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME security.bu_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY security.bu ADD CONSTRAINT bu_pkey PRIMARY KEY (id);

        CREATE TABLE security.role (
            id          smallint NOT NULL,
            code        text     NOT NULL,
            name        text     NOT NULL,
            description text,
            is_system   boolean  DEFAULT false NOT NULL,
            created_at  timestamp with time zone DEFAULT now() NOT NULL,
            updated_at  timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT role_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
        );
        ALTER TABLE ONLY security.role ADD CONSTRAINT role_code_key UNIQUE (code);
        ALTER TABLE ONLY security.role ADD CONSTRAINT role_pkey PRIMARY KEY (id);
        CREATE INDEX role_is_system_idx ON security.role USING btree (is_system);

        CREATE TABLE security.role_access_right (
            role_id         smallint NOT NULL,
            access_right_id integer  NOT NULL
        );
        ALTER TABLE ONLY security.role_access_right
            ADD CONSTRAINT role_access_right_pkey PRIMARY KEY (role_id, access_right_id);
        ALTER TABLE ONLY security.role_access_right
            ADD CONSTRAINT role_access_right_access_right_id_fkey
                FOREIGN KEY (access_right_id) REFERENCES security.access_right(id) ON DELETE CASCADE;
        ALTER TABLE ONLY security.role_access_right
            ADD CONSTRAINT role_access_right_role_id_fkey
                FOREIGN KEY (role_id) REFERENCES security.role(id) ON DELETE CASCADE;
        CREATE INDEX role_access_right_access_right_id_idx
            ON security.role_access_right USING btree (access_right_id);

        CREATE TABLE security."user" (
            id            bigint  NOT NULL,
            username      text    NOT NULL,
            email         text    NOT NULL,
            mobile        text,
            password_hash text    NOT NULL,
            is_active     boolean DEFAULT true  NOT NULL,
            is_admin      boolean DEFAULT false NOT NULL,
            full_name     text    NOT NULL,
            created_at    timestamp with time zone DEFAULT now() NOT NULL,
            updated_at    timestamp with time zone DEFAULT now() NOT NULL
        );
        ALTER TABLE security."user" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME security.user_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY security."user" ADD CONSTRAINT user_email_key    UNIQUE (email);
        ALTER TABLE ONLY security."user" ADD CONSTRAINT user_pkey         PRIMARY KEY (id);
        ALTER TABLE ONLY security."user" ADD CONSTRAINT user_username_key UNIQUE (username);
        CREATE INDEX        user_full_name_idx      ON security."user" USING btree (full_name);
        CREATE UNIQUE INDEX user_mobile_unique_idx  ON security."user" USING btree (mobile)
            WHERE (mobile IS NOT NULL);

        CREATE TABLE security.user_bu_role (
            user_id    bigint  NOT NULL,
            bu_id      bigint  NOT NULL,
            role_id    bigint  NOT NULL,
            is_active  boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );
        ALTER TABLE ONLY security.user_bu_role
            ADD CONSTRAINT user_bu_role_pkey PRIMARY KEY (user_id, bu_id, role_id);
        ALTER TABLE ONLY security.user_bu_role
            ADD CONSTRAINT user_bu_role_user_id_bu_id_key UNIQUE (user_id, bu_id);
        ALTER TABLE ONLY security.user_bu_role
            ADD CONSTRAINT user_bu_role_bu_id_fkey
                FOREIGN KEY (bu_id)   REFERENCES security.bu(id)     ON DELETE CASCADE;
        ALTER TABLE ONLY security.user_bu_role
            ADD CONSTRAINT user_bu_role_role_id_fkey
                FOREIGN KEY (role_id) REFERENCES security.role(id)   ON DELETE CASCADE;
        ALTER TABLE ONLY security.user_bu_role
            ADD CONSTRAINT user_bu_role_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES security."user"(id) ON DELETE CASCADE;
        CREATE INDEX user_bu_role_bu_id_idx   ON security.user_bu_role USING btree (bu_id);
        CREATE INDEX user_bu_role_role_id_idx ON security.user_bu_role USING btree (role_id);
        CREATE INDEX user_bu_role_user_id_idx ON security.user_bu_role USING btree (user_id);
        """

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

    # ── Stock (Inventory Overview) ────────────────────────────────────────────

    GET_STOCK_OVERVIEW_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(distinct sp.id) as total
        FROM spare_part_master sp
        JOIN stock_transaction st ON st.part_id = sp.id AND st.branch_id = (table "p_branch_id")
        WHERE (
            ((table "p_brand_id") = 0 OR sp.brand_id = (table "p_brand_id")) AND
            ((table "p_search") = '' OR
             LOWER(sp.part_code) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_name) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.category)  ILIKE '%%' || LOWER((table "p_search")) || '%%')
        )
    """

    GET_STOCK_OVERVIEW_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_brand_id"  as (values(%(brand_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sp.id AS part_id,
            sp.part_code,
            sp.part_name,
            sp.category,
            sp.uom,
            sp.cost_price,
            COALESCE(SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE -st.qty END), 0) AS current_stock
        FROM spare_part_master sp
        JOIN stock_transaction st ON st.part_id = sp.id AND st.branch_id = (table "p_branch_id")
        WHERE (
            ((table "p_brand_id") = 0 OR sp.brand_id = (table "p_brand_id")) AND
            ((table "p_search") = '' OR
             LOWER(sp.part_code) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.part_name) ILIKE '%%' || LOWER((table "p_search")) || '%%' OR
             LOWER(sp.category)  ILIKE '%%' || LOWER((table "p_search")) || '%%')
        )
        GROUP BY sp.id, sp.part_code, sp.part_name, sp.category, sp.uom, sp.cost_price
        ORDER BY sp.part_name
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Consumption (Parts Usage) ─────────────────────────────────────────────

    GET_PARTS_CONSUMPTION_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        --     "p_search"    as (values(''::text))   -- Test line
        SELECT COUNT(*) AS total
        FROM job_part_used jpu
        JOIN job             j  ON j.id  = jpu.job_id
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_code) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PARTS_CONSUMPTION = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        -- with
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        --     "p_search"    as (values(''::text)),  -- Test line
        --     "p_limit"     as (values(50::int)),   -- Test line
        --     "p_offset"    as (values(0::int))     -- Test line
        SELECT
            jpu.id,
            jpu.created_at,
            j.id       AS job_id,
            j.job_no,
            j.job_date,
            j.is_closed,
            j.is_final,
            js.name AS job_status_name,
            jt.name AS job_type_name,
            jpu.part_id,
            sp.brand_id,
            sp.part_code,
            sp.part_name,
            sp.uom,
            jpu.qty,
            jpu.cost_price,
            jpu.selling_price,
            jpu.gst_rate,
            COALESCE(jpu.hsn_code, sp.hsn_code) AS hsn_code,
            jpu.remarks,
            b.name AS branch_name,
            st.id  AS stock_transaction_id
        FROM job_part_used jpu
        JOIN job             j  ON j.id  = jpu.job_id
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        JOIN branch          b  ON b.id  = j.branch_id
        JOIN job_status      js ON js.id = j.job_status_id
        JOIN job_type        jt ON jt.id = j.job_type_id
        LEFT JOIN stock_transaction st ON st.job_part_used_id = jpu.id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_code) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(sp.part_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jpu.created_at DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Purchase Entry ────────────────────────────────────────────────────────

    GET_STOCK_TRANSACTION_TYPES = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, code, name, dr_cr
        FROM stock_transaction_type
        ORDER BY id
    """

    GET_PURCHASE_INVOICES_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        -- with
        --     "p_branch_id" as (values(1::bigint)),           -- Test line
        --     "p_from_date" as (values('2024-01-01'::date)),   -- Test line
        --     "p_to_date"   as (values('2024-12-31'::date)),   -- Test line
        --     "p_search"    as (values(''::text))              -- Test line
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)         LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        -- with
        --     "p_branch_id" as (values(1::bigint)),           -- Test line
        --     "p_from_date" as (values('2024-01-01'::date)),   -- Test line
        --     "p_to_date"   as (values('2024-12-31'::date)),   -- Test line
        --     "p_search"    as (values(''::text)),             -- Test line
        --     "p_limit"     as (values(50::int)),              -- Test line
        --     "p_offset"    as (values(0::int))               -- Test line
        SELECT
            pi.id,
            pi.branch_id,
            pi.brand_id,
            pi.supplier_id,
            s.name        AS supplier_name,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_tax,
            pi.total_amount,
            pi.remarks,
            pi.is_return,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)         LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            pi.id,
            pi.branch_id,
            pi.invoice_no,
            pi.invoice_date,
            s.name           AS supplier_name,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_amount,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND pi.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICE_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT
            pi.id,
            pi.branch_id,
            pi.supplier_id,
            s.name              AS supplier_name,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_tax,
            pi.total_amount,
            pi.remarks,
            pi.is_return,
            json_agg(
                json_build_object(
                    'id',               pil.id,
                    'part_id',          pil.part_id,
                    'part_code',        sp.part_code,
                    'part_name',        sp.part_name,
                    'hsn_code',         pil.hsn_code,
                    'qty',         pil.qty,
                    'unit_price',       pil.unit_price,
                    'aggregate_amount', pil.aggregate_amount,
                    'gst_rate',         pil.gst_rate,
                    'cgst_amount',      pil.cgst_amount,
                    'sgst_amount',      pil.sgst_amount,
                    'igst_amount',      pil.igst_amount,
                    'total_amount',     pil.total_amount,
                    'under_warranty',   pil.under_warranty,
                    'remarks',          pil.remarks
                ) ORDER BY pil.id
            ) AS lines
        FROM purchase_invoice pi
        JOIN supplier              s   ON s.id   = pi.supplier_id
        JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
        JOIN spare_part_master     sp  ON sp.id  = pil.part_id
        WHERE pi.id = (table "p_id")
        GROUP BY pi.id, s.name
    """

    CHECK_SUPPLIER_INVOICE_EXISTS = """
        with
            "p_supplier_id" as (values(%(supplier_id)s::bigint)),
            "p_invoice_no"  as (values(%(invoice_no)s::text))
        -- with
        --     "p_supplier_id" as (values(1::bigint)), -- Test line
        --     "p_invoice_no"  as (values('INV-001'::text)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice
            WHERE supplier_id = (table "p_supplier_id")
              AND UPPER(invoice_no) = UPPER((table "p_invoice_no"))
        ) AS exists
    """

    CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID = """
        with
            "p_supplier_id" as (values(%(supplier_id)s::bigint)),
            "p_invoice_no"  as (values(%(invoice_no)s::text)),
            "p_id"          as (values(%(id)s::bigint))
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice
            WHERE supplier_id = (table "p_supplier_id")
              AND UPPER(invoice_no) = UPPER((table "p_invoice_no"))
              AND id <> (table "p_id")
        ) AS exists
    """

    DELETE_PURCHASE_INVOICE = """
        with
            "p_id" as (values(%(id)s::bigint)),
            deleted_txns AS (
                DELETE FROM stock_transaction
                WHERE purchase_line_id IN (
                    SELECT id FROM purchase_invoice_line
                    WHERE purchase_invoice_id = (table "p_id")
                )
            )
        DELETE FROM purchase_invoice WHERE id = (table "p_id")
    """

    # ── Sales Entry ───────────────────────────────────────────────────────────

    GET_CUSTOMERS_BY_KEYWORD = """
        with
            "p_search" as (values(%(search)s::text)),
            "p_limit"  as (values(%(limit)s::int)),
            "p_offset" as (values(%(offset)s::int))
        SELECT
            cc.id, cc.full_name, cc.mobile, cc.gstin,
            cc.state_id, s.code AS state_code, s.name AS state_name,
            cc.address_line1, cc.address_line2, cc.city, cc.postal_code,
            ct.name AS customer_type_name
        FROM customer_contact cc
        JOIN customer_type ct ON ct.id = cc.customer_type_id
        LEFT JOIN state s     ON s.id  = cc.state_id
        WHERE cc.is_active = true
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(cc.full_name, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR cc.mobile                         LIKE '%%' || (table "p_search")         || '%%')
        ORDER BY cc.full_name NULLS LAST, cc.mobile
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_CUSTOMERS_BY_KEYWORD_COUNT = """
        with
            "p_search" as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM customer_contact cc
        WHERE cc.is_active = true
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(cc.full_name, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR cc.mobile                         LIKE '%%' || (table "p_search")         || '%%')
    """

    GET_SALES_INVOICES_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR si.division_id = (table "p_division_id"))
          AND si.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_from_date"   as (values(%(from_date)s::date)),
            "p_to_date"     as (values(%(to_date)s::date)),
            "p_search"      as (values(%(search)s::text)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            d.name AS division_name,
            si.customer_contact_id,
            si.customer_name,
            si.customer_gstin,
            si.customer_state_code,
            si.invoice_no,
            si.invoice_date,
            si.aggregate_amount,
            si.cgst_amount,
            si.sgst_amount,
            si.igst_amount,
            si.total_tax,
            si.total_amount,
            si.remarks,
            si.is_return
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_division_id") IS NULL OR si.division_id = (table "p_division_id"))
          AND si.invoice_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND si.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            d.name        AS division_name,
            si.invoice_no,
            si.invoice_date,
            si.customer_name,
            si.aggregate      AS aggregate_amount,
            si.cgst_amount,
            si.sgst_amount,
            si.igst_amount,
            si.amount         AS total_amount,
            si.is_return,
            si.is_posted
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND si.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICE_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            si.id, si.division_id, si.customer_contact_id, si.customer_name,
            si.customer_gstin, si.customer_state_code,
            si.invoice_no, si.invoice_date,
            si.aggregate_amount, si.cgst_amount, si.sgst_amount, si.igst_amount,
            si.total_tax, si.total_amount, si.remarks, si.is_return,
            json_agg(
                json_build_object(
                    'id',               sil.id,
                    'part_id',          sil.part_id,
                    'part_code',        sp.part_code,
                    'part_name',        sp.part_name,
                    'item_description', sil.item_description,
                    'hsn_code',         sil.hsn_code,
                    'qty',         sil.qty,
                    'unit_price',       sil.unit_price,
                    'aggregate_amount', sil.aggregate_amount,
                    'gst_rate',         sil.gst_rate,
                    'cgst_amount',      sil.cgst_amount,
                    'sgst_amount',      sil.sgst_amount,
                    'igst_amount',      sil.igst_amount,
                    'total_amount',     sil.total_amount,
                    'remarks',          sil.remarks
                ) ORDER BY sil.id
            ) AS lines
        FROM sales_invoice si
        JOIN sales_invoice_line sil ON sil.sales_invoice_id = si.id
        JOIN spare_part_master sp   ON sp.id = sil.part_id
        WHERE si.id = (table "p_id")
        GROUP BY si.id
    """

    # ── Stock Adjustment ──────────────────────────────────────────────────────

    GET_STOCK_ADJUSTMENTS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM stock_adjustment sa
        WHERE sa.branch_id = (table "p_branch_id")
          AND sa.adjustment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(sa.adjustment_reason) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(sa.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_STOCK_ADJUSTMENTS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sa.id,
            sa.branch_id,
            sa.adjustment_date,
            sa.adjustment_reason,
            sa.ref_no,
            sa.remarks,
            sa.created_by,
            sa.created_at,
            sa.updated_at
        FROM stock_adjustment sa
        WHERE sa.branch_id = (table "p_branch_id")
          AND sa.adjustment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(sa.adjustment_reason) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(sa.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY sa.adjustment_date DESC, sa.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_ADJUSTMENT_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sa.id,
            sa.branch_id,
            sa.adjustment_date,
            sa.adjustment_reason,
            sa.ref_no,
            sa.remarks,
            sa.created_by,
            sa.created_at,
            sa.updated_at,
            json_agg(
                json_build_object(
                    'id',        sal.id,
                    'part_id',   sal.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'dr_cr',     sal.dr_cr,
                    'qty',       sal.qty,
                    'remarks',   sal.remarks
                ) ORDER BY sal.id
            ) AS lines
        FROM stock_adjustment sa
        JOIN stock_adjustment_line sal ON sal.stock_adjustment_id = sa.id
        JOIN spare_part_master      sp  ON sp.id = sal.part_id
        WHERE sa.id = (table "p_id")
        GROUP BY sa.id
    """

    # ── Stock Branch Transfer ──────────────────────────────────────────────────

    GET_STOCK_BRANCH_TRANSFERS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM stock_branch_transfer sbt
        WHERE (sbt.from_branch_id = (table "p_branch_id") OR sbt.to_branch_id = (table "p_branch_id"))
          AND sbt.transfer_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(sbt.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_STOCK_BRANCH_TRANSFERS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sbt.id,
            sbt.transfer_date,
            sbt.from_branch_id,
            sbt.to_branch_id,
            sbt.ref_no,
            sbt.remarks,
            sbt.created_by,
            sbt.created_at,
            sbt.updated_at,
            fb.name AS from_branch_name,
            tb.name AS to_branch_name
        FROM stock_branch_transfer sbt
        JOIN branch fb ON fb.id = sbt.from_branch_id
        JOIN branch tb ON tb.id = sbt.to_branch_id
        WHERE (sbt.from_branch_id = (table "p_branch_id") OR sbt.to_branch_id = (table "p_branch_id"))
          AND sbt.transfer_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(COALESCE(sbt.ref_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY sbt.transfer_date DESC, sbt.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_BRANCH_TRANSFER_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sbt.id,
            sbt.transfer_date,
            sbt.from_branch_id,
            sbt.to_branch_id,
            sbt.ref_no,
            sbt.remarks,
            sbt.created_by,
            sbt.created_at,
            sbt.updated_at,
            fb.name AS from_branch_name,
            tb.name AS to_branch_name,
            json_agg(
                json_build_object(
                    'id',        sbtl.id,
                    'part_id',   sbtl.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'qty',       sbtl.qty,
                    'remarks',   sbtl.remarks
                ) ORDER BY sbtl.id
            ) AS lines
        FROM stock_branch_transfer sbt
        JOIN branch fb ON fb.id = sbt.from_branch_id
        JOIN branch tb ON tb.id = sbt.to_branch_id
        JOIN stock_branch_transfer_line sbtl ON sbtl.stock_branch_transfer_id = sbt.id
        JOIN spare_part_master      sp   ON sp.id = sbtl.part_id
        WHERE sbt.id = (table "p_id")
        GROUP BY sbt.id, fb.name, tb.name
    """

    GET_STOCK_LOANS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from"      as (values(%(from_date)s::date)),
            "p_to"        as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(*) as total
        FROM stock_loan sl
        WHERE sl.branch_id = (table "p_branch_id")
          AND sl.loan_date >= (table "p_from")
          AND sl.loan_date <= (table "p_to")
          AND (
            (table "p_search") = '' OR
            sl.ref_no ILIKE '%%' || (table "p_search") || '%%' OR
            EXISTS (
                SELECT 1 FROM stock_loan_line sll
                WHERE sll.stock_loan_id = sl.id
                  AND sll.loan_to ILIKE '%%' || (table "p_search") || '%%'
            )
          )
    """

    GET_STOCK_LOANS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from"      as (values(%(from_date)s::date)),
            "p_to"        as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sl.id, sl.loan_date, sl.branch_id, sl.ref_no, sl.remarks,
            sl.created_at, sl.updated_at
        FROM stock_loan sl
        WHERE sl.branch_id = (table "p_branch_id")
          AND sl.loan_date >= (table "p_from")
          AND sl.loan_date <= (table "p_to")
          AND (
            (table "p_search") = '' OR
            sl.ref_no ILIKE '%%' || (table "p_search") || '%%' OR
            EXISTS (
                SELECT 1 FROM stock_loan_line sll
                WHERE sll.stock_loan_id = sl.id
                  AND sll.loan_to ILIKE '%%' || (table "p_search") || '%%'
            )
          )
        ORDER BY sl.loan_date DESC, sl.id DESC
        LIMIT (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_STOCK_LOAN_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sl.id,
            sl.loan_date,
            sl.branch_id,
            sl.ref_no,
            sl.remarks,
            sl.created_at,
            sl.updated_at,
            json_agg(
                json_build_object(
                    'id',        sll.id,
                    'part_id',   sll.part_id,
                    'part_code', sp.part_code,
                    'part_name', sp.part_name,
                    'loan_to',   sll.loan_to,
                    'dr_cr',     sll.dr_cr,
                    'qty',       sll.qty,
                    'remarks',   sll.remarks
                ) ORDER BY sll.id
            ) AS lines
        FROM stock_loan sl
        JOIN stock_loan_line sll ON sll.stock_loan_id = sl.id
        JOIN spare_part_master sp ON sp.id = sll.part_id
        WHERE sl.id = (table "p_id")
        GROUP BY sl.id
    """

    # ── Opening Stock ─────────────────────────────────────────────────────────

    GET_OPENING_BALANCE_BY_BRANCH = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with "p_branch_id" as (values(1::bigint)) -- Test line
        SELECT
            sob.id,
            sob.entry_date,
            sob.ref_no,
            sob.branch_id,
            sob.remarks,
            sob.created_by,
            sob.created_at,
            sob.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',        sobl.id,
                        'part_id',   sobl.part_id,
                        'part_code', sp.part_code,
                        'part_name', sp.part_name,
                        'qty',       sobl.qty,
                        'unit_cost', sobl.unit_cost,
                        'remarks',   sobl.remarks
                    ) ORDER BY sobl.id
                ) FILTER (WHERE sobl.id IS NOT NULL),
                '[]'::json
            ) AS lines
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl ON sobl.stock_opening_balance_id = sob.id
        LEFT JOIN spare_part_master sp ON sp.id = sobl.part_id
        WHERE sob.branch_id = (table "p_branch_id")
        GROUP BY sob.id
    """

    GET_OPENING_STOCK_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT count(*) as total
        FROM stock_opening_balance
        WHERE branch_id  = (table "p_branch_id")
          AND (
            (table "p_search") = '' OR
            ref_no  ILIKE '%%' || (table "p_search") || '%%' OR
            remarks ILIKE '%%' || (table "p_search") || '%%'
          )
    """

    GET_OPENING_STOCK_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            sob.id,
            sob.entry_date,
            sob.branch_id,
            sob.ref_no,
            sob.remarks,
            COUNT(sobl.id)                                     AS line_count,
            COALESCE(SUM(sobl.qty), 0)                         AS total_qty,
            COALESCE(SUM(sobl.qty * sobl.unit_cost), 0)        AS total_value
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl
               ON sobl.stock_opening_balance_id = sob.id
        WHERE sob.branch_id  = (table "p_branch_id")
          AND (
            (table "p_search") = '' OR
            sob.ref_no  ILIKE '%%' || (table "p_search") || '%%' OR
            sob.remarks ILIKE '%%' || (table "p_search") || '%%'
          )
        GROUP BY sob.id
        ORDER BY sob.entry_date DESC, sob.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_OPENING_STOCK_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            sob.id,
            sob.entry_date,
            sob.branch_id,
            sob.ref_no,
            sob.remarks,
            sob.created_at,
            sob.updated_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',        sobl.id,
                        'part_id',   sobl.part_id,
                        'part_code', sp.part_code,
                        'part_name', sp.part_name,
                        'qty',       sobl.qty,
                        'unit_cost', sobl.unit_cost,
                        'remarks',   sobl.remarks
                    ) ORDER BY sobl.id
                ) FILTER (WHERE sobl.id IS NOT NULL),
                '[]'::json
            ) AS lines
        FROM stock_opening_balance sob
        LEFT JOIN stock_opening_balance_line sobl
               ON sobl.stock_opening_balance_id = sob.id
        LEFT JOIN spare_part_master sp ON sp.id = sobl.part_id
        WHERE sob.id = (table "p_id")
        GROUP BY sob.id
    """

    # ── Technicians ───────────────────────────────────────────────────────────

    CHECK_TECHNICIAN_CODE_EXISTS = """
        with
            "p_code"      as (values(%(code)s::text)),
            "p_branch_id" as (values(%(branch_id)s::bigint))
        -- with
        --     "p_code"      as (values('TECH01'::text)),  -- Test line
        --     "p_branch_id" as (values(1::bigint))        -- Test line
        SELECT EXISTS(
            SELECT 1 FROM technician
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND branch_id   = (table "p_branch_id")
        ) AS exists
    """

    CHECK_TECHNICIAN_CODE_EXISTS_EXCLUDE_ID = """
        with
            "p_code"      as (values(%(code)s::text)),
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_id"        as (values(%(id)s::bigint))
        -- with
        --     "p_code"      as (values('TECH01'::text)), -- Test line
        --     "p_branch_id" as (values(1::bigint)),      -- Test line
        --     "p_id"        as (values(1::bigint))       -- Test line
        SELECT EXISTS(
            SELECT 1 FROM technician
            WHERE UPPER(code) = UPPER((table "p_code"))
              AND branch_id   = (table "p_branch_id")
              AND id         <> (table "p_id")
        ) AS exists
    """

    CHECK_TECHNICIAN_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM job              WHERE technician_id = (table "p_id")
            UNION ALL
            SELECT 1 FROM job_transaction  WHERE technician_id = (table "p_id")
        ) AS in_use
    """

    GET_ALL_TECHNICIANS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            t.id, t.branch_id, t.code, t.name, t.phone, t.email,
            t.specialization, t.leaving_date, t.is_active,
            b.name AS branch_name
        FROM technician t
        JOIN branch b ON b.id = t.branch_id
        ORDER BY t.name
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
        SELECT id, username, full_name, is_active
        FROM security."user"
        WHERE id = (table "p_id")
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
                 u.mobile, u.password_hash, u.username, r.name
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

    # ── Vendors ───────────────────────────────────────────────────────────────

    CHECK_VENDOR_IN_USE = """
        with "p_id" as (values(%(id)s::bigint))
        -- with "p_id" as (values(1::bigint)) -- Test line
        SELECT EXISTS (
            SELECT 1 FROM purchase_invoice WHERE supplier_id = (table "p_id")
        ) AS in_use
    """

    CHECK_VENDOR_NAME_EXISTS = """
        with "p_name" as (values(%(name)s::text))
        -- with "p_name" as (values('Acme Corp'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM supplier
            WHERE LOWER(name) = LOWER((table "p_name"))
        ) AS exists
    """

    CHECK_VENDOR_NAME_EXISTS_EXCLUDE_ID = """
        with
            "p_name" as (values(%(name)s::text)),
            "p_id"   as (values(%(id)s::bigint))
        -- with
        --     "p_name" as (values('Acme Corp'::text)), -- Test line
        --     "p_id"   as (values(1::bigint))          -- Test line
        SELECT EXISTS(
            SELECT 1 FROM supplier
            WHERE LOWER(name) = LOWER((table "p_name"))
              AND id <> (table "p_id")
        ) AS exists
    """

    GET_ALL_VENDORS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT
            v.id, v.name, v.gstin, v.pan, v.phone, v.email,
            v.address_line1, v.address_line2, v.city, v.state_id,
            v.pincode, v.is_active, v.remarks,
            s.name AS state_name, s.gst_state_code
        FROM supplier v
        LEFT JOIN state s ON s.id = v.state_id
        ORDER BY v.name
    """

    # ── App Settings ──────────────────────────────────────────────────────────

    GET_APP_SETTINGS = """
        with "dummy" as (values(1::int))
        -- with "dummy" as (values(1::int)) -- Test line
        SELECT id, setting_key, setting_value, description, is_editable,
               created_at, updated_at
        FROM app_setting
        ORDER BY setting_key
    """

    GET_APP_SETTING_BY_KEY = """
        with "p_key" as (values(%(setting_key)s::text))
        SELECT id, setting_key, setting_value
        FROM app_setting
        WHERE setting_key = (table "p_key")
    """

    CHECK_APP_SETTING_KEY_EXISTS = """
        with "p_key" as (values(%(setting_key)s::text))
        -- with "p_key" as (values('default_gst_rate'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM app_setting
            WHERE LOWER(setting_key) = LOWER((table "p_key"))
        ) AS exists
    """

    CHECK_APP_SETTING_KEY_EXISTS_EXCLUDE_ID = """
        with
            "p_key" as (values(%(setting_key)s::text)),
            "p_id"  as (values(%(id)s::smallint))
        -- with
        --     "p_key" as (values('default_gst_rate'::text)), -- Test line
        --     "p_id"  as (values(1::smallint))               -- Test line
        SELECT EXISTS(
            SELECT 1 FROM app_setting
            WHERE LOWER(setting_key) = LOWER((table "p_key"))
              AND id <> (table "p_id")
        ) AS exists
    """

    # ── Stock Snapshot ────────────────────────────────────────────────────────

    SQL_GENERATE_STOCK_SNAPSHOT = """
        with
            "p_year"  as (values(%(year)s::int)),
            "p_month" as (values(%(month)s::int)),
        -- with
        --     "p_year"  as (values(2026::int)), -- Test line
        --     "p_month" as (values(3::int)),    -- Test line
        period as (
            select
                date_trunc('month', make_date((table "p_year"), (table "p_month"), 1))::date                                as period_start,
                (date_trunc('month', make_date((table "p_year"), (table "p_month"), 1)) + interval '1 month - 1 day')::date as period_end,
                (date_trunc('month', make_date((table "p_year"), (table "p_month"), 1)) + interval '1 month - 1 day')::date as snapshot_date
        ),
        prev_snapshot as (
            select ss.part_id, ss.branch_id, ss.closing
            from stock_snapshot ss
            inner join (
                select part_id, branch_id, max(snapshot_date) as max_date
                from stock_snapshot
                where snapshot_date < (select period_start from period)
                group by part_id, branch_id
            ) latest on latest.part_id    = ss.part_id
                    and latest.branch_id  = ss.branch_id
                    and ss.snapshot_date      = latest.max_date
        ),
        tran_summary as (
            select
                st.part_id,
                st.branch_id,
                sum(case when stt.dr_cr = 'D' then st.qty else -st.qty end)           as net_qty,
                sum(case when stt.code = 'PURCHASE'            then st.qty else 0 end) as purchase_in,
                sum(case when stt.code = 'PURCHASE_RETURN'     then st.qty else 0 end) as purchase_out,
                sum(case when stt.code = 'SALES_RETURN'        then st.qty else 0 end) as sales_in,
                sum(case when stt.code = 'SALES'               then st.qty else 0 end) as sales_out,
                sum(case when stt.code = 'ADJUSTMENT_IN'       then st.qty else 0 end) as adjust_in,
                sum(case when stt.code = 'ADJUSTMENT_OUT'      then st.qty else 0 end) as adjust_out,
                sum(case when stt.code = 'LOAN_IN'             then st.qty else 0 end) as loan_in,
                sum(case when stt.code = 'LOAN_OUT'            then st.qty else 0 end) as loan_out,
                sum(case when stt.code = 'BRANCH_TRANSFER_IN'  then st.qty else 0 end) as branch_transfer_in,
                sum(case when stt.code = 'BRANCH_TRANSFER_OUT' then st.qty else 0 end) as branch_transfer_out
            from stock_transaction st
            join stock_transaction_type stt on stt.id = st.stock_transaction_type_id
            where st.transaction_date between (select period_start from period)
                                          and (select period_end   from period)
            group by st.part_id, st.branch_id
        )
        insert into stock_snapshot (
            snapshot_date, part_id, branch_id,
            opening, closing,
            purchase_in, purchase_out, sales_in, sales_out,
            adjust_in, adjust_out, loan_in, loan_out,
            branch_transfer_in, branch_transfer_out
        )
        select
            (select snapshot_date from period),
            ts.part_id, ts.branch_id,
            coalesce(ps.closing, 0)                  as opening,
            coalesce(ps.closing, 0) + ts.net_qty     as closing,
            ts.purchase_in,  ts.purchase_out,
            ts.sales_in,     ts.sales_out,
            ts.adjust_in,    ts.adjust_out,
            ts.loan_in,      ts.loan_out,
            ts.branch_transfer_in, ts.branch_transfer_out
        from tran_summary ts
        left join prev_snapshot ps on ps.part_id = ts.part_id and ps.branch_id = ts.branch_id
        on conflict (snapshot_date, part_id, branch_id) do update set
            opening             = excluded.opening,
            closing             = excluded.closing,
            purchase_in         = excluded.purchase_in,
            purchase_out        = excluded.purchase_out,
            sales_in            = excluded.sales_in,
            sales_out           = excluded.sales_out,
            adjust_in           = excluded.adjust_in,
            adjust_out          = excluded.adjust_out,
            loan_in             = excluded.loan_in,
            loan_out            = excluded.loan_out,
            branch_transfer_in  = excluded.branch_transfer_in,
            branch_transfer_out = excluded.branch_transfer_out
        returning part_id
    """

    SQL_PART_FINDER_STOCK_SUMMARY = """
        with
            "p_part_id"   as (values(%(part_id)s::bigint)),
            "p_branch_id" as (values(%(branch_id)s::bigint)),
        -- with
        --     "p_part_id"   as (values(1::bigint)), -- Test line
        --     "p_branch_id" as (values(1::bigint)), -- Test line
        last_snap as (
            select snapshot_date, closing,
                   purchase_in, purchase_out, sales_in, sales_out,
                   adjust_in, adjust_out, loan_in, loan_out,
                   branch_transfer_in, branch_transfer_out
            from stock_snapshot
            where part_id   = (table "p_part_id")
              and branch_id = (table "p_branch_id")
            order by snapshot_date desc
            limit 1
        ),
        tran_since as (
            select
                sum(case when stt.dr_cr = 'D' then st.qty else -st.qty end)           as net_qty,
                sum(case when stt.code = 'PURCHASE'            then st.qty else 0 end) as purchase_in,
                sum(case when stt.code = 'PURCHASE_RETURN'     then st.qty else 0 end) as purchase_out,
                sum(case when stt.code = 'SALES_RETURN'        then st.qty else 0 end) as sales_in,
                sum(case when stt.code = 'SALES'               then st.qty else 0 end) as sales_out,
                sum(case when stt.code = 'ADJUSTMENT_IN'       then st.qty else 0 end) as adjust_in,
                sum(case when stt.code = 'ADJUSTMENT_OUT'      then st.qty else 0 end) as adjust_out
            from stock_transaction st
            join stock_transaction_type stt on stt.id = st.stock_transaction_type_id
            where st.part_id   = (table "p_part_id")
              and st.branch_id = (table "p_branch_id")
              and st.transaction_date > coalesce(
                    (select snapshot_date from last_snap), '1900-01-01'::date
                  )
        )
        select
            ls.snapshot_date                                    as last_snapshot_date,
            coalesce(ls.closing, 0)                             as snapshot_closing,
            coalesce(ts.net_qty, 0)                             as net_since_snapshot,
            coalesce(ls.closing, 0) + coalesce(ts.net_qty, 0)  as current_stock,
            coalesce(ts.purchase_in,  0)                        as purchase_in_since,
            coalesce(ts.purchase_out, 0)                        as purchase_out_since,
            coalesce(ts.sales_in,     0)                        as sales_in_since,
            coalesce(ts.sales_out,    0)                        as sales_out_since,
            coalesce(ts.adjust_in,    0)                        as adjust_in_since,
            coalesce(ts.adjust_out,   0)                        as adjust_out_since
        from last_snap ls
        full outer join tran_since ts on true
    """

    # ── Job Pipeline ──────────────────────────────────────────────────────────

    GET_JOB_PIPELINE_STATUS_COUNTS = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            js.id   AS status_id,
            js.name AS status_name,
            js.code AS status_code,
            COUNT(j.id) AS count
        FROM job_status js
        LEFT JOIN job j
            ON j.job_status_id = js.id
           AND j.branch_id = (table "p_branch_id")
        GROUP BY js.id, js.name, js.code, js.display_order
        ORDER BY js.display_order NULLS LAST, js.id
    """

    GET_JOB_PIPELINE_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_status_id" as (values(%(status_id)s::smallint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand      b ON b.id  = pbm.brand_id
        LEFT JOIN product    p ON p.id  = pbm.product_id
        LEFT JOIN technician t ON t.id  = j.technician_id
        WHERE j.branch_id     = (table "p_branch_id")
          AND j.job_status_id = (table "p_status_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_PIPELINE_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_status_id" as (values(%(status_id)s::smallint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.job_status_id,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.diagnosis,
            j.last_transaction_id,
            j.batch_no,
            cc.full_name   AS customer_name,
            cc.mobile,
            jt.name        AS job_type_name,
            jt.code        AS job_type_code,
            js.name        AS job_status_name,
            js.code        AS job_status_code,
            j.technician_id,
            t.name         AS technician_name,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id)  AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id)  AS transaction_count,
            jrm.name       AS job_receive_manner_name,
            jrc.name       AS job_receive_condition_name,
            j.division_id
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        LEFT JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id     = (table "p_branch_id")
          AND j.job_status_id = (table "p_status_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PIPELINE_ALL_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand      b ON b.id  = pbm.brand_id
        LEFT JOIN product    p ON p.id  = pbm.product_id
        LEFT JOIN technician t ON t.id  = j.technician_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_PIPELINE_ALL_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.job_status_id,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.diagnosis,
            j.last_transaction_id,
            j.batch_no,
            cc.full_name   AS customer_name,
            cc.mobile,
            jt.name        AS job_type_name,
            jt.code        AS job_type_code,
            js.name        AS job_status_name,
            js.code        AS job_status_code,
            j.technician_id,
            t.name         AS technician_name,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id)  AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id)  AS transaction_count,
            jrm.name       AS job_receive_manner_name,
            jrc.name       AS job_receive_condition_name,
            j.division_id
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        LEFT JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text                   ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.full_name                      ILIKE '%%' || (table "p_search") || '%%'
           OR  cc.mobile                         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.email, '')            ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.address_line1, '')    ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(cc.city, '')             ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(t.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.serial_no, '')         ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(b.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(p.name, '')              ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(pbm.model_name, '')      ILIKE '%%' || (table "p_search") || '%%'
           OR  COALESCE(j.alternate_job_no, '')  ILIKE '%%' || (table "p_search") || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_TRANSACTION_FOR_UNDO = """
        SELECT t.id, t.previous_transaction_id
        FROM   job_transaction t
        JOIN   job j ON j.id = t.job_id
        WHERE  t.job_id = %(job_id)s
          AND  t.id     = %(last_txn_id)s
          AND  j.last_transaction_id = %(last_txn_id)s
    """

    GET_PREV_JOB_TRANSACTION_FALLBACK = """
        SELECT id FROM job_transaction
        WHERE  job_id = %(job_id)s AND id < %(last_txn_id)s
        ORDER  BY id DESC
        LIMIT  1
    """

    GET_JOB_TRANSACTION_STATE = """
        SELECT status_id, technician_id, amount
        FROM   job_transaction
        WHERE  id = %(prev_txn_id)s
    """

    DELETE_JOB_TRANSACTION = """
        DELETE FROM job_transaction WHERE id = %(last_txn_id)s
    """

    RESTORE_JOB_FROM_TRANSACTION = """
        UPDATE job
        SET    job_status_id       = %(job_status_id)s,
               technician_id       = %(technician_id)s,
               amount              = COALESCE(%(amount)s, amount, 0),
               estimate_amount     = COALESCE(%(estimate_amount)s, estimate_amount, 0),
               is_final            = %(is_final)s,
               is_closed           = %(is_closed)s,
               last_transaction_id = %(last_transaction_id)s
        WHERE  id = %(job_id)s
    """

    # ── Undeliver Job ─────────────────────────────────────────────────────────
    # Most recent transaction whose status is NOT a delivered status — i.e. the
    # state the job was in just before it was delivered.
    GET_LAST_NON_DELIVERED_TRANSACTION = """
        SELECT t.id, t.status_id, t.technician_id, t.amount
        FROM   job_transaction t
        JOIN   job_status js ON js.id = t.status_id
        WHERE  t.job_id = %(job_id)s
          AND  js.code NOT IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
        ORDER  BY t.id DESC
        LIMIT  1
    """

    # Remove every delivery transaction on the job (handles re-deliveries too).
    DELETE_DELIVERY_TRANSACTIONS = """
        DELETE FROM job_transaction t
        USING  job_status js
        WHERE  t.status_id = js.id
          AND  t.job_id = %(job_id)s
          AND  js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK')
    """

    UNDELIVER_JOB = """
        UPDATE job
        SET    job_status_id       = %(job_status_id)s,
               technician_id       = %(technician_id)s,
               amount              = COALESCE(%(amount)s, amount, 0),
               is_final            = %(is_final)s,
               is_closed           = false,
               delivery_date       = NULL,
               last_transaction_id = %(last_transaction_id)s
        WHERE  id = %(job_id)s
    """

    GET_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date" as (values(%(from_date)s::date)),
            "p_to_date"   as (values(%(to_date)s::date)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.is_closed,
            j.is_final,
            j.amount,
            cc.full_name  AS customer_name,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name       AS job_type_name,
            js.name       AS job_status_name,
            jrc.name      AS receive_condition_name,
            t.name        AS technician_name,
            j.batch_no    AS batch_no,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)      LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)         LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_SEARCH_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_show_closed" as (values(%(show_closed)s::boolean)),
            "p_status_id"   as (values(%(status_id)s::bigint))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_show_closed") IS NULL
               OR (CASE WHEN js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
                        THEN true ELSE j.is_closed END) = (table "p_show_closed"))
          AND ((table "p_status_id")   IS NULL OR j.job_status_id = (table "p_status_id"))
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
     """

    GET_JOB_SEARCH_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_show_closed" as (values(%(show_closed)s::boolean)),
            "p_status_id"   as (values(%(status_id)s::bigint)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.is_closed,
            j.is_final,
            j.amount,
            j.estimate_amount,
            j.batch_no,
            j.last_transaction_id,
            j.technician_id,
            j.job_status_id,
            js.code      AS job_status_code,
            jt.code      AS job_type_code,
            cc.full_name AS customer_name,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name      AS job_type_name,
            js.name      AS job_status_name,
            t.name       AS technician_name,
            j.division_id,
            ji.is_posted AS invoice_is_posted,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction  jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN job_invoice  ji ON ji.job_id = j.id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_show_closed") IS NULL
               OR (CASE WHEN js.code IN ('DELIVERED_OK', 'DELIVERED_NOT_OK', 'DISPOSED')
                        THEN true ELSE j.is_closed END) = (table "p_show_closed"))
          AND ((table "p_status_id")   IS NULL OR j.job_status_id = (table "p_status_id"))
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(p.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(b.name)       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(pbm.model_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(j.serial_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
         ORDER BY j.job_date DESC, j.id DESC
         LIMIT  (table "p_limit")
         OFFSET (table "p_offset")
     """

    GET_JOB_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            j.*,
            cc.full_name     AS customer_name,
            cc.mobile,
            cc.address_line1 AS customer_address_line1,
            cc.address_line2 AS customer_address_line2,
            cc.landmark      AS customer_landmark,
            cc.city          AS customer_city,
            cc.postal_code   AS customer_postal_code,
            s.name           AS customer_state,
            CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''), NULLIF(cc.city, ''), NULLIF(cc.postal_code, '')) AS address_snapshot,
            jt.name       AS job_type_name,
            js.name       AS job_status_name,
            jrm.name      AS job_receive_manner_name,
            jrc.name      AS job_receive_condition_name,
            t.name        AS technician_name,
            pbm.model_name,
            bn.name        AS brand_name,
            p.name        AS product_name,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN state            s   ON s.id   = cc.state_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            bn  ON bn.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.id = (table "p_id")
    """

    GET_JOB_IMAGE_DOCS = """
        SELECT id, url, about, created_at
        FROM job_image_doc
        WHERE job_id = %(job_id)s
        ORDER BY created_at
    """

    DELETE_JOB_IMAGE_DOC = """
        DELETE FROM job_image_doc
        WHERE id = %(id)s
        RETURNING url
    """

    GET_JOB_IMAGE_DOCS_BY_JOB = """
        SELECT jid.id, jid.url, j.job_no
        FROM job_image_doc jid
        JOIN job j ON j.id = jid.job_id
        WHERE jid.job_id = %(job_id)s
        LIMIT 1
    """

    COUNT_JOB_IMAGE_DOCS_BY_JOB = """
        SELECT COUNT(*) AS count
        FROM job_image_doc
        WHERE job_id = %(job_id)s
    """

    DELETE_JOB_IMAGE_DOCS_BY_JOB = """
        DELETE FROM job_image_doc
        WHERE job_id = %(job_id)s
        RETURNING id, url
    """

    GET_JOB_BATCHES_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            j.batch_no,
            MIN(j.job_date)                                         AS batch_date,
            cc.full_name                                            AS customer_name,
            cc.mobile,
            STRING_AGG(DISTINCT jt.name, ', ' ORDER BY jt.name)    AS job_type_name,
            COUNT(j.id)                                             AS job_count
        FROM job j
        JOIN customer_contact  cc ON cc.id = j.customer_contact_id
        JOIN job_type          jt ON jt.id = j.job_type_id
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
        GROUP BY j.batch_no, cc.full_name, cc.mobile
        ORDER BY j.batch_no DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_BATCHES_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(DISTINCT j.batch_no) AS total
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND j.job_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_BATCHES_WITH_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int)),
            "paged_batches" as (
                SELECT DISTINCT j.batch_no
                FROM job j
                WHERE j.batch_no IS NOT NULL
                  AND j.branch_id = (table "p_branch_id")
                  AND ((table "p_search") = ''
                   OR  LOWER((SELECT cc.full_name FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
                   OR  LOWER((SELECT cc.mobile FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
                   OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
                ORDER BY j.batch_no DESC
                LIMIT  (table "p_limit")
                OFFSET (table "p_offset")
            )
        SELECT
            j.batch_no,
            j.id,
            j.job_no,
            j.job_date,
            j.is_closed,
            j.amount,
            j.serial_no,
            cc.full_name                                    AS customer_name,
            cc.mobile,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            jt.name                                         AS job_type_name,
            js.name                                         AS job_status_name,
            t.name                                          AS technician_name,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc   jid WHERE jid.job_id = j.id) AS file_count,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
        FROM job j
        JOIN paged_batches           pb  ON pb.batch_no = j.batch_no
        JOIN customer_contact        cc  ON cc.id       = j.customer_contact_id
        JOIN job_type                jt  ON jt.id       = j.job_type_id
        LEFT JOIN job_status         js  ON js.id       = j.job_status_id
        LEFT JOIN technician         t   ON t.id        = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id     = j.product_brand_model_id
        LEFT JOIN brand              b   ON b.id        = pbm.brand_id
        LEFT JOIN product            p   ON p.id        = pbm.product_id
        ORDER BY j.batch_no DESC, j.id DESC
    """

    GET_JOB_BATCHES_WITH_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(DISTINCT j.batch_no) AS total
        FROM job j
        WHERE j.batch_no IS NOT NULL
          AND j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  LOWER((SELECT cc.full_name FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER((SELECT cc.mobile FROM customer_contact cc WHERE cc.id = j.customer_contact_id)) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  CAST(j.batch_no AS text) LIKE '%%' || (table "p_search") || '%%')
    """

    GET_JOB_BATCH_DETAIL = """
        with "p_batch_no" as (values(%(batch_no)s::integer))
        SELECT
            j.*,
            cc.full_name  AS customer_name,
            cc.mobile,
            cc.address_line1 AS customer_address_line1,
            cc.address_line2 AS customer_address_line2,
            cc.landmark      AS customer_landmark,
            cc.city          AS customer_city,
            cc.postal_code   AS customer_postal_code,
            s.name           AS customer_state,
            CONCAT_WS(', ', NULLIF(cc.address_line1, ''), NULLIF(cc.address_line2, ''), NULLIF(cc.city, ''), NULLIF(cc.postal_code, '')) AS address_snapshot,
            jt.name       AS job_type_name,
            jrm.name      AS job_receive_manner_name,
            pbm.model_name,
            b.name        AS brand_name,
            p.name        AS product_name,
            (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count,
            (SELECT COUNT(*) FROM job_image_doc  jd  WHERE jd.job_id  = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN state            s   ON s.id   = cc.state_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.batch_no = (table "p_batch_no")
        ORDER BY j.id
    """

    GET_JOB_BATCH_QUICK_INFO = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_offset"    as (values(%(offset)s::int)),
            "target_batch" as (
                SELECT DISTINCT j.batch_no
                FROM job j
                WHERE j.batch_no IS NOT NULL
                  AND j.branch_id = (table "p_branch_id")
                ORDER BY j.batch_no DESC
                LIMIT 1 OFFSET (table "p_offset")
            )
        SELECT
            j.batch_no,
            MIN(j.job_date) OVER (PARTITION BY j.batch_no) AS batch_date,
            cc.full_name                                    AS customer_name,
            cc.mobile,
            jt.name                                         AS job_type_name,
            j.id                                            AS job_id,
            j.job_no,
            CASE WHEN pbm.id IS NOT NULL
                 THEN CONCAT(b.name, ' — ', p.name, ' — ', pbm.model_name)
                 ELSE NULL END                              AS device_details,
            j.serial_no,
            j.division_id,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.batch_no = (SELECT batch_no FROM target_batch)
        ORDER BY j.id
    """

    GET_JOB_BATCH_QUICK_INFO_COUNT = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT COUNT(DISTINCT batch_no) AS total
        FROM job
        WHERE batch_no IS NOT NULL
          AND branch_id = (table "p_branch_id")
    """

    # ── Part Used (Job) ───────────────────────────────────────────────────────

    GET_JOBS_BY_KEYWORD = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int))
        SELECT j.id, j.job_no, j.job_date, j.branch_id, j.is_closed, j.is_final,
               js.code AS job_status_code, js.name AS job_status_name,
               cc.full_name AS customer_name, cc.mobile
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(j.job_no)     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_JOB_PART_USED_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jpu.id, jpu.part_id, jpu.qty, jpu.cost_price, jpu.selling_price, jpu.gst_rate, jpu.remarks,
               sp.part_code, sp.part_name, sp.uom, sp.brand_id,
               COALESCE(jpu.hsn_code, sp.hsn_code) AS hsn_code,
               sp.cost_price    AS master_cost_price,
               sp.selling_price AS master_selling_price,
               sp.gst_rate      AS master_gst_rate
        FROM job_part_used jpu
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    GET_JOB_ADDITIONAL_CHARGES_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT id, charge_name, ref_no, description, hsn_code, gst_rate, qty, cost_price, selling_price
        FROM job_additional_charge
        WHERE job_id = (table "p_job_id")
        ORDER BY id
    """

    # ── Job Receipts (Payments) ───────────────────────────────────────────────

    GET_JOB_PAYMENTS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS count
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND jp.payment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.reference_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_from_date"  as (values(%(from_date)s::date)),
            "p_to_date"    as (values(%(to_date)s::date)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT jp.id, jp.job_id, jp.receipt_no, j.job_no, j.job_date, cc.full_name AS customer_name, cc.mobile,
               jp.payment_date, jp.payment_mode, jp.amount, jp.reference_no, jp.remarks,
               jp.is_posted, jp.created_at, jp.updated_at,
               j.is_closed, j.is_final, js.code AS job_status_code, js.name AS job_status_name
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN job_status js ON js.id = j.job_status_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND jp.payment_date BETWEEN (table "p_from_date") AND (table "p_to_date")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.reference_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    # ── Post / Unpost — all records, no is_posted filter, with division + gst_type ──

    GET_JOB_PAYMENTS_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE jp.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE jp.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            cc.full_name    AS customer_name,
            cc.mobile,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            d.name          AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            jp.is_posted
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)            LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no,'')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE pi.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE pi.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM purchase_invoice pi
        JOIN supplier s ON s.id = pi.supplier_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_PURCHASE_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            pi.id,
            pi.branch_id,
            pi.invoice_no,
            pi.invoice_date,
            s.name           AS supplier_name,
            pi.total_amount,
            d.name           AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            pi.is_posted
        FROM purchase_invoice pi
        JOIN supplier  s ON s.id = pi.supplier_id
        JOIN division  d ON d.id = pi.division_id
        WHERE pi.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(pi.invoice_no) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(s.name)        LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY pi.invoice_date DESC, pi.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_SALES_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE si.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE si.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_SALES_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            si.id,
            si.division_id,
            si.invoice_no,
            si.invoice_date,
            si.customer_name,
            si.amount         AS total_amount,
            si.is_return,
            d.name            AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            si.is_posted
        FROM sales_invoice si
        JOIN division d ON d.id = si.division_id
        WHERE d.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR LOWER(si.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR LOWER(si.customer_name) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY si.invoice_date DESC, si.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_INVOICES_POST_UNPOST_STATS = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT
            COUNT(*) FILTER (WHERE ji.is_posted = true)  AS posted,
            COUNT(*) FILTER (WHERE ji.is_posted = false) AS unposted,
            COUNT(*)                                      AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_POST_UNPOST_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_POST_UNPOST_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            ji.id,
            ji.job_id,
            j.job_no,
            j.job_date,
            cc.full_name  AS customer_name,
            cc.mobile,
            ji.invoice_no,
            ji.invoice_date,
            ji.amount,
            d.name        AS division_name,
            CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
            ji.is_posted
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ((table "p_search") = ''
           OR  j.job_no::text       ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)  LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)   LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY ji.invoice_date DESC, ji.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PAYMENTS_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id  = (table "p_branch_id")
          AND jp.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_PAYMENTS_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            cc.full_name  AS customer_name,
            cc.mobile,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.is_posted
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id  = (table "p_branch_id")
          AND jp.is_posted  = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name)             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(jp.payment_mode)          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(jp.receipt_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY jp.payment_date DESC, jp.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PAYMENTS_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jp.id, jp.job_id, jp.receipt_no, jp.payment_date, jp.payment_mode, jp.amount,
               jp.reference_no, jp.remarks, jp.created_at, jp.updated_at
        FROM job_payment jp
        WHERE jp.job_id = (table "p_job_id")
        ORDER BY jp.payment_date DESC, jp.id DESC
    """

    GET_JOB_TRANSACTIONS_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            jt.id,
            jt.job_id,
            jt.status_id,
            js.name                             AS status_name,
            jt.technician_id,
            t.name                              AS technician_name,
            jt.amount,
            jt.remarks,
            jt.performed_by_user_id,
            COALESCE(su.full_name, su.username) AS performed_by_name,
            jt.performed_at,
            jt.previous_transaction_id,
            jt.transaction_date
        FROM job_transaction jt
        LEFT JOIN job_status      js ON js.id  = jt.status_id
        LEFT JOIN technician      t  ON t.id   = jt.technician_id
        LEFT JOIN security."user" su ON su.id  = jt.performed_by_user_id
        WHERE jt.job_id = (table "p_job_id")

        UNION ALL

        SELECT
            0                                   AS id,
            j.id                                AS job_id,
            js.id                               AS status_id,
            js.name                             AS status_name,
            NULL::bigint                        AS technician_id,
            NULL::text                          AS technician_name,
            NULL::numeric                       AS amount,
            NULL::text                          AS remarks,
            NULL::bigint                        AS performed_by_user_id,
            NULL::text                          AS performed_by_name,
            j.created_at                        AS performed_at,
            NULL::bigint                        AS previous_transaction_id,
            j.created_at::date                  AS transaction_date
        FROM job j
        JOIN job_status js ON js.id = 1
        WHERE j.id = (table "p_job_id")

        ORDER BY performed_at ASC, id ASC
    """

    GET_JOB_TRANSACTION_DETAIL = """
        with "p_id" as (values(%(id)s::bigint))
        SELECT
            jt.id,
            jt.job_id,
            jt.status_id,
            js.name                             AS status_name,
            jt.technician_id,
            t.name                              AS technician_name,
            jt.amount,
            jt.remarks,
            jt.performed_by_user_id,
            COALESCE(su.full_name, su.username) AS performed_by_name,
            jt.performed_at,
            jt.previous_transaction_id
        FROM job_transaction jt
        LEFT JOIN job_status     js ON js.id = jt.status_id
        LEFT JOIN technician     t  ON t.id  = jt.technician_id
        LEFT JOIN security."user" su ON su.id = jt.performed_by_user_id
        WHERE jt.id = (table "p_id")
    """

    GET_JOBS_FOR_RECEIPT_LOOKUP = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount, j.is_closed,
               j.is_final, js.code AS job_status_code, js.name AS job_status_name, jt.code AS job_type_code,
               cc.full_name AS customer_name, cc.mobile, cc.address_line1
        FROM job j
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN  job_status js ON js.id = j.job_status_id
        JOIN  job_type   jt ON jt.id = j.job_type_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_active = true
          AND ((table "p_search") = ''
           OR  j.job_no::text ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(cc.full_name) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_UNPOSTED_MONEY_RECEIPTS = """
        WITH "p_division_code" AS (VALUES(%(division_code)s::text))
        SELECT
            jp.id,
            jp.job_id,
            j.job_no,
            jp.receipt_no,
            jp.payment_date,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.remarks,
            cc.full_name AS customer_name,
            cc.mobile AS customer_mobile,
            cc.gstin AS customer_gstin,
            cc.postal_code AS customer_pin,
            CONCAT_WS(', ',
                NULLIF(cc.address_line1, ''),
                NULLIF(cc.address_line2, ''),
                NULLIF(cc.city, '')
            ) AS customer_address
        FROM job_payment jp
        JOIN job j ON j.id = jp.job_id
        JOIN division d ON d.id = j.division_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE LOWER(d.code) = LOWER((TABLE "p_division_code"))
          AND jp.is_posted = false
        ORDER BY jp.payment_date ASC, jp.id ASC
    """

    MARK_MONEY_RECEIPT_POSTED = """
        UPDATE job_payment SET is_posted = true WHERE id = %(id)s
    """

    GET_UNPOSTED_PURCHASE_INVOICES = """
        WITH
            "p_division_code" AS (VALUES(%(division_code)s::text)),
            "p_division_id" AS (
                SELECT id FROM division
                WHERE LOWER(code) = LOWER((TABLE "p_division_code"))
                LIMIT 1
            )
        SELECT
            pi.id,
            pi.invoice_no,
            pi.invoice_date,
            pi.aggregate_amount,
            pi.cgst_amount,
            pi.sgst_amount,
            pi.igst_amount,
            pi.total_amount,
            pi.remarks,
            s.gstin          AS supplier_gstin,
            s.address_line1  AS supplier_address_line1,
            s.address_line2  AS supplier_address_line2,
            s.city           AS supplier_city,
            st.name          AS supplier_state,
            s.pincode        AS supplier_pincode,
            json_agg(
                json_build_object(
                    'hsn_code',         pil.hsn_code,
                    'qty',              pil.qty,
                    'unit_price',       pil.unit_price,
                    'aggregate_amount', pil.aggregate_amount,
                    'gst_rate',         pil.gst_rate,
                    'cgst_amount',      pil.cgst_amount,
                    'sgst_amount',      pil.sgst_amount,
                    'igst_amount',      pil.igst_amount,
                    'total_amount',     pil.total_amount,
                    'part_code',        spm.part_code
                ) ORDER BY pil.id
            ) AS lines
        FROM purchase_invoice pi
        JOIN supplier              s   ON s.id   = pi.supplier_id
        LEFT JOIN state            st  ON st.id  = s.state_id
        JOIN purchase_invoice_line pil ON pil.purchase_invoice_id = pi.id
        LEFT JOIN spare_part_master spm ON spm.id = pil.part_id
        WHERE pi.division_id = (TABLE "p_division_id")
          AND pi.is_posted = false
        GROUP BY pi.id, s.gstin, s.address_line1, s.address_line2, s.city, st.name, s.pincode
        ORDER BY pi.invoice_date ASC, pi.id ASC
    """

    MARK_PURCHASE_INVOICE_POSTED = """
        UPDATE purchase_invoice SET is_posted = true WHERE id = %(id)s
    """

    # Per-division unposted counts for all four document types, for a branch.
    GET_UNPOSTED_COUNTS_BY_DIVISION = """
        with "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT
            d.id   AS division_id,
            d.code AS division_code,
            d.name AS division_name,
            (SELECT COUNT(*) FROM job_payment jp
                JOIN job j ON j.id = jp.job_id
                WHERE j.division_id = d.id AND jp.is_posted = false) AS money_receipts,
            (SELECT COUNT(*) FROM purchase_invoice pi
                WHERE pi.division_id = d.id AND pi.is_posted = false) AS purchase_invoices,
            (SELECT COUNT(*) FROM sales_invoice si
                WHERE si.division_id = d.id AND si.is_posted = false) AS sales_invoices,
            (SELECT COUNT(*) FROM job_invoice ji
                JOIN job j ON j.id = ji.job_id
                WHERE j.division_id = d.id AND ji.is_posted = false) AS job_invoices
        FROM division d
        WHERE d.branch_id = (table "p_branch_id")
          AND d.is_active = true
        ORDER BY d.name
    """

    # ── Final a Job ────────────────────────────────────────────────────

    GET_COMPLETED_JOBS_COUNT = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_search"      as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact     cc  ON cc.id  = j.customer_contact_id
        JOIN job_status           js  ON js.id  = j.job_status_id
        LEFT JOIN technician      t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand           b   ON b.id   = pbm.brand_id
        LEFT JOIN product         p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          --AND ((table "p_division_id") IS NULL OR j.division_id = (table "p_division_id"))
          AND js.code = 'COMPLETED_OK'
          AND j.is_final = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.email, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.city, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))       LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_COMPLETED_JOBS_PAGED = """
        with
            "p_branch_id"   as (values(%(branch_id)s::bigint)),
            "p_division_id" as (values(%(division_id)s::bigint)),
            "p_search"      as (values(%(search)s::text)),
            "p_limit"       as (values(%(limit)s::int)),
            "p_offset"      as (values(%(offset)s::int))
        SELECT
            j.id,
            j.job_no,
            j.alternate_job_no,
            j.job_date,
            j.amount,
            j.batch_no,
            j.serial_no,
            j.is_closed,
            j.is_final,
            j.division_id,
            cc.full_name  AS customer_name,
            cc.mobile,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            t.name        AS technician_name,
            TRIM(CONCAT_WS(' / ', NULLIF(p.name, ''), NULLIF(b.name, ''), NULLIF(pbm.model_name, ''))) AS device_details,
            (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact     cc  ON cc.id  = j.customer_contact_id
        JOIN job_type             jt  ON jt.id  = j.job_type_id
        JOIN job_status           js  ON js.id  = j.job_status_id
        LEFT JOIN technician      t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand           b   ON b.id   = pbm.brand_id
        LEFT JOIN product         p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          --AND ((table "p_division_id") IS NULL OR j.division_id = (table "p_division_id"))
          AND js.code = 'COMPLETED_OK'
          AND j.is_final = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, ''))   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                       LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.email, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(cc.city, ''))              LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))          LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))               LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))       LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_INVOICE_BY_JOB = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT ji.id, ji.job_id, ji.invoice_no, ji.invoice_date,
               ji.supply_state_code, ji.aggregate, ji.cgst_amount, ji.sgst_amount,
               ji.igst_amount, ji.amount,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'id',          jil.id,
                           'job_invoice_id', jil.job_invoice_id,
                           'description', jil.description,
                           'part_code',   jil.part_code,
                           'hsn_code',    jil.hsn_code,
                           'qty',    jil.qty,
                           'price',       jil.price,
                           'aggregate',   jil.aggregate,
                           'gst_rate',    jil.gst_rate,
                           'cgst_amount', jil.cgst_amount,
                           'sgst_amount', jil.sgst_amount,
                           'igst_amount', jil.igst_amount,
                           'amount',      jil.amount
                       ) ORDER BY jil.id
                   ) FILTER (WHERE jil.id IS NOT NULL),
                   '[]'::json
               ) AS lines
        FROM job_invoice ji
        LEFT JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
        WHERE ji.job_id = (table "p_job_id")
        GROUP BY ji.id
    """

    GET_JOB_INVOICES_FOR_POSTING_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ji.is_posted = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text         ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_JOB_INVOICES_FOR_POSTING_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_is_posted"  as (values(%(is_posted)s::boolean)),
            "p_search"     as (values(%(search)s::text)),
            "p_limit"      as (values(%(limit)s::int)),
            "p_offset"     as (values(%(offset)s::int))
        SELECT
            ji.id,
            ji.job_id,
            j.job_no,
            j.job_date,
            cc.full_name  AS customer_name,
            cc.mobile,
            ji.invoice_no,
            ji.invoice_date,
            ji.aggregate,
            ji.cgst_amount,
            ji.sgst_amount,
            ji.igst_amount,
            ji.amount,
            ji.is_posted
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE j.branch_id = (table "p_branch_id")
          AND ji.is_posted = (table "p_is_posted")
          AND ((table "p_search") = ''
           OR  j.job_no::text         ILIKE '%%' || (table "p_search") || '%%'
           OR  LOWER(ji.invoice_no)    LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY ji.invoice_date DESC, ji.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_PARTS_FOR_INVOICE = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT jpu.qty, sp.part_code, sp.part_name, sp.uom
        FROM job_part_used jpu
        JOIN spare_part_master sp ON sp.id = jpu.part_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    # ── Deliver Job ───────────────────────────────────────────────────────────

    GET_DELIVERABLE_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_DELIVERABLE_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount, j.last_transaction_id,
               j.division_id, j.batch_no, j.serial_no,
               TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
               cc.full_name  AS customer_name, cc.mobile,
               js.name       AS job_status_name,
               t.name        AS technician_name,
               ji.id         AS invoice_id,
               ji.amount     AS invoice_total,
               ji.invoice_no,
               ji.is_posted  AS invoice_is_posted,
               jrm.name       AS receive_manner_name,
               jt.name        AS job_type_name,
               jt.code        AS job_type_code,
               COALESCE(jrc.name, '') AS receive_condition_name,
               j.qty,
               j.estimate_amount,
               COALESCE(
                   (SELECT SUM(jp2.amount) FROM job_payment jp2 WHERE jp2.job_id = j.id),
                   0
               )              AS total_paid,
               (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = false
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.updated_at DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_DELIVERED_JOBS_COUNT = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text))
        SELECT COUNT(*) AS total
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = true
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
    """

    GET_DELIVERED_JOBS_PAGED = """
        with
            "p_branch_id" as (values(%(branch_id)s::bigint)),
            "p_search"    as (values(%(search)s::text)),
            "p_limit"     as (values(%(limit)s::int)),
            "p_offset"    as (values(%(offset)s::int))
        SELECT j.id, j.job_no, j.alternate_job_no, j.job_date, j.delivery_date,
               j.amount, j.last_transaction_id,
               j.division_id, j.batch_no, j.serial_no,
               TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name)) AS device_details,
               cc.full_name  AS customer_name, cc.mobile,
               js.name       AS job_status_name,
               jt.name       AS job_type_name,
               jt.code       AS job_type_code,
               jrm.name      AS receive_manner_name,
               t.name        AS technician_name,
               ji.amount     AS invoice_total,
               ji.invoice_no,
               ji.is_posted  AS invoice_is_posted,
               (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
        FROM job j
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN technician       t   ON t.id   = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id   = pbm.brand_id
        LEFT JOIN product          p   ON p.id   = pbm.product_id
        WHERE j.branch_id = (table "p_branch_id")
          AND j.is_final  = true
          AND j.is_closed = true
          AND ((table "p_search") = ''
           OR  LOWER(j.job_no::text)                   LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.mobile)                        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(cc.full_name)                     LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.alternate_job_no, '')) LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(t.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(j.serial_no, ''))        LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(b.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(p.name, ''))             LIKE '%%' || LOWER((table "p_search")) || '%%'
           OR  LOWER(COALESCE(pbm.model_name, ''))     LIKE '%%' || LOWER((table "p_search")) || '%%')
        ORDER BY j.delivery_date DESC, j.id DESC
        LIMIT  (table "p_limit")
        OFFSET (table "p_offset")
    """

    GET_JOB_DELIVERY_DETAIL = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            j.id, j.job_no, j.alternate_job_no, j.job_date, j.problem_reported, j.diagnosis, j.work_done,
            j.amount, j.delivery_date, j.is_closed, j.last_transaction_id,
            cc.full_name AS customer_name, cc.mobile,
            js.name      AS job_status_name,
            t.name       AS technician_name,
            ji.id        AS invoice_id,
            ji.invoice_no,
            ji.invoice_date,
            ji.amount AS invoice_total,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',           jp.id,
                        'payment_date', jp.payment_date,
                        'payment_mode', jp.payment_mode,
                        'amount',       jp.amount,
                        'reference_no', jp.reference_no,
                        'remarks',      jp.remarks
                    ) ORDER BY jp.created_at
                ) FILTER (WHERE jp.id IS NOT NULL),
                '[]'::json
            ) AS payments
        FROM job j
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        JOIN job_status        js ON js.id = j.job_status_id
        LEFT JOIN technician   t  ON t.id  = j.technician_id
        LEFT JOIN job_invoice  ji ON ji.job_id = j.id
        LEFT JOIN job_payment  jp ON jp.job_id = j.id
        WHERE j.id = (table "p_job_id")
        GROUP BY j.id, cc.full_name, cc.mobile, js.name, t.name,
                 ji.id, ji.invoice_no, ji.invoice_date, ji.amount
    """

    GET_DELIVERABLE_JOBS_DETAIL_MULTI = """
        with "p_job_ids" as (
            SELECT unnest(%(job_ids)s::bigint[]) AS job_id
        )
        SELECT
            j.id, j.job_no, j.alternate_job_no, j.job_date, j.amount,
            j.estimate_amount, j.qty, j.last_transaction_id,
            j.division_id, j.serial_no, j.is_igst, j.to_show_parts_in_job_invoice,
            TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
            cc.full_name      AS customer_name, cc.mobile,
            cc.gstin          AS customer_gstin,
            cc.email          AS customer_email,
            cc.address_line1  AS customer_address_line1,
            cc.address_line2  AS customer_address_line2,
            cc.landmark       AS customer_landmark,
            cc.city           AS customer_city,
            cc.postal_code    AS customer_postal_code,
            s.name            AS customer_state,
            js.name       AS job_status_name,
            js.code       AS job_status_code,
            jt.name       AS job_type_name,
            jt.code       AS job_type_code,
            jrm.name      AS receive_manner_name,
            COALESCE(jrc.name, '') AS receive_condition_name,
            t.name        AS technician_name,
            ji.id         AS invoice_id,
            ji.invoice_no, ji.invoice_date,
            ji.amount     AS invoice_total,
            ji.is_posted  AS invoice_is_posted,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jp.id, 'receipt_no', jp.receipt_no,
                    'payment_date', jp.payment_date,
                    'payment_mode', jp.payment_mode, 'amount', jp.amount,
                    'reference_no', jp.reference_no, 'remarks', jp.remarks
                ) ORDER BY jp.created_at)
                FROM job_payment jp WHERE jp.job_id = j.id
            ), '[]'::json) AS payments,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jpu.id, 'part_code', sp.part_code, 'part_name', sp.part_name,
                    'qty', jpu.qty, 'cost_price', jpu.cost_price,
                    'selling_price', jpu.selling_price, 'gst_rate', jpu.gst_rate,
                    'hsn_code', COALESCE(jpu.hsn_code, sp.hsn_code), 'remarks', jpu.remarks
                ) ORDER BY jpu.id)
                FROM job_part_used jpu
                JOIN spare_part_master sp ON sp.id = jpu.part_id
                WHERE jpu.job_id = j.id
            ), '[]'::json) AS parts,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'id', jac.id, 'charge_name', jac.charge_name, 'qty', jac.qty,
                    'selling_price', jac.selling_price, 'gst_rate', jac.gst_rate,
                    'hsn_code', jac.hsn_code, 'description', jac.description
                ) ORDER BY jac.id)
                FROM job_additional_charge jac WHERE jac.job_id = j.id
            ), '[]'::json) AS charges
        FROM job j
        JOIN "p_job_ids" pj  ON pj.job_id = j.id
        JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
        JOIN job_status            js  ON js.id  = j.job_status_id
        JOIN job_type              jt  ON jt.id  = j.job_type_id
        JOIN job_receive_manner    jrm ON jrm.id = j.job_receive_manner_id
        LEFT JOIN job_receive_condition jrc ON jrc.id = j.job_receive_condition_id
        LEFT JOIN technician       t   ON t.id  = j.technician_id
        LEFT JOIN job_invoice      ji  ON ji.job_id = j.id
        LEFT JOIN state            s   ON s.id  = cc.state_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand            b   ON b.id  = pbm.brand_id
        LEFT JOIN product          p   ON p.id  = pbm.product_id
        GROUP BY j.id, cc.full_name, cc.mobile,
                 cc.gstin, cc.email, cc.address_line1, cc.address_line2,
                 cc.landmark, cc.city, cc.postal_code, s.name,
                 js.name, js.code, jt.name, jt.code,
                 jrm.name, jrc.name, t.name, pbm.model_name, b.name, p.name,
                 ji.id, ji.invoice_no, ji.invoice_date, ji.amount
    """

    # ── Reports — Dashboard ───────────────────────────────────────────────────

    GET_DASHBOARD_KPIS = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            ) AS jobs_received,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
                  AND j.warranty_card_no IS NOT NULL
                  AND j.warranty_card_no <> ''
            ) AS jobs_received_warranty,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
                  AND (j.warranty_card_no IS NULL OR j.warranty_card_no = '')
            ) AS jobs_received_oow,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                  AND j.is_closed = true
            ) AS jobs_delivered,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
            ) AS jobs_open,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = false
                  AND j.job_date < (CURRENT_DATE - INTERVAL '7 days')
            ) AS jobs_overdue,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0) AS revenue
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
    """

    GET_DASHBOARD_MONTHLY_INTAKE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', j.job_date), 'YYYY-MM') AS month,
            COUNT(*) FILTER (
                WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
            ) AS warranty_count,
            COUNT(*) FILTER (
                WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
            ) AS oow_count,
            COUNT(*) AS total_count
        FROM job j
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY date_trunc('month', j.job_date)
        ORDER BY date_trunc('month', j.job_date)
    """

    GET_DASHBOARD_RECENT_JOBS = """
        with "p_limit" as (values(%(limit)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        ORDER BY j.job_date DESC, j.id DESC
        LIMIT (table "p_limit")
    """

    GET_DASHBOARD_OVERDUE_JOBS = """
        with
            "p_limit"      as (values(%(limit)s::int)),
            "p_overdue_days" as (values(%(overdue_days)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            cc.full_name              AS customer_name,
            (CURRENT_DATE - j.job_date) AS days_old,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        WHERE j.is_closed = false
          AND j.job_date < (CURRENT_DATE - (table "p_overdue_days") * INTERVAL '1 day')
        ORDER BY j.job_date ASC, j.id ASC
        LIMIT (table "p_limit")
    """

    GET_DASHBOARD_STATUS_MIX = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            js.code AS status_code,
            js.name AS status_name,
            COUNT(*) AS jobs_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY js.code, js.name, js.display_order
        ORDER BY js.display_order, js.code
    """

    GET_DASHBOARD_TOP_TECHNICIANS = """
        with
            "p_from"  as (values(%(from)s::date)),
            "p_to"    as (values(%(to)s::date)),
            "p_limit" as (values(%(limit)s::int))
        SELECT
            t.id                AS technician_id,
            t.name              AS technician_name,
            COUNT(DISTINCT j.id) AS jobs_count,
            COALESCE(SUM(ji.amount), 0) AS revenue,
            COALESCE(SUM(ji.amount), 0)
              - COALESCE((
                  SELECT SUM(jpu.cost_price * jpu.qty)
                  FROM job_part_used jpu
                  WHERE jpu.job_id = j.id
                ), 0) AS profit
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        JOIN technician t ON t.id = j.technician_id
        WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
          AND j.is_closed = true
        GROUP BY t.id, t.name, j.id
        ORDER BY profit DESC NULLS LAST
        LIMIT (table "p_limit")
    """

    # ── Reports — Warranty (Special) ──────────────────────────────────────────

    GET_WARRANTY_REPAIRS_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) AS warranty_jobs_count,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_final = true
            ) AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
                WHERE j.is_closed = true AND j.delivery_date IS NOT NULL
            ) AS delivered_count,
            COALESCE(SUM(jpu.qty), 0)                         AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0)        AS parts_value,
            COUNT(DISTINCT jpu.part_id)                        AS distinct_parts_count
        FROM job j
        LEFT JOIN job_part_used jpu ON jpu.job_id = j.id
        WHERE j.warranty_card_no IS NOT NULL
          AND j.warranty_card_no <> ''
          AND COALESCE(j.delivery_date, j.job_date) BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_WARRANTY_REPAIRS_LIST_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id,
            j.job_no,
            j.job_date,
            j.delivery_date,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            t.name                    AS technician_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            j.warranty_card_no,
            COALESCE(SUM(jpu.qty), 0)                  AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0) AS parts_value
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        LEFT JOIN job_part_used       jpu ON jpu.job_id = j.id
        WHERE j.warranty_card_no IS NOT NULL
          AND j.warranty_card_no <> ''
          AND COALESCE(j.delivery_date, j.job_date) BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY j.id, j.job_no, j.job_date, j.delivery_date, j.warranty_card_no,
                 cc.full_name, p.name, b.name, pbm.model_name, t.name,
                 js.code, js.name
        ORDER BY COALESCE(j.delivery_date, j.job_date) DESC, j.id DESC
    """

    GET_WARRANTY_PARTS_CONSUMPTION_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jpu.id                                       AS line_id,
            jpu.created_at::date                         AS consumed_date,
            j.id                                         AS job_id,
            j.job_no,
            j.warranty_card_no,
            spm.part_code,
            spm.part_name,
            b.name                                       AS brand_name,
            jpu.qty,
            jpu.cost_price,
            (jpu.cost_price * jpu.qty)                   AS line_value,
            t.name                                       AS technician_name
        FROM job_part_used jpu
        JOIN job              j   ON j.id   = jpu.job_id
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        LEFT JOIN technician   t   ON t.id   = j.technician_id
        WHERE j.warranty_card_no IS NOT NULL
          AND j.warranty_card_no <> ''
          AND jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jpu.created_at DESC, jpu.id DESC
    """

    GET_WARRANTY_PARTS_BY_PART_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            spm.id                                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                                       AS brand_name,
            SUM(jpu.qty)                                 AS total_qty,
            SUM(jpu.cost_price * jpu.qty)                AS total_value,
            COUNT(DISTINCT j.id)                         AS jobs_count
        FROM job_part_used jpu
        JOIN job              j   ON j.id   = jpu.job_id
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        WHERE j.warranty_card_no IS NOT NULL
          AND j.warranty_card_no <> ''
          AND jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name
        ORDER BY total_value DESC NULLS LAST
    """

    GET_WARRANTY_TREND_MONTHLY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(m.month_start, 'YYYY-MM') AS month,
            COUNT(DISTINCT j.id)                          AS warranty_jobs,
            COALESCE(SUM(jpu.qty), 0)                     AS parts_qty,
            COALESCE(SUM(jpu.cost_price * jpu.qty), 0)    AS parts_value
        FROM (
            SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month',
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month'
            )::date AS month_start
        ) m
        LEFT JOIN job j
               ON j.warranty_card_no IS NOT NULL
              AND j.warranty_card_no <> ''
              AND date_trunc('month', COALESCE(j.delivery_date, j.job_date)) = m.month_start
        LEFT JOIN job_part_used jpu ON jpu.job_id = j.id
        GROUP BY m.month_start
        ORDER BY m.month_start
    """

    GET_WARRANTY_JOB_PARTS_DETAIL = """
        with "p_job_id" as (values(%(job_id)s::bigint))
        SELECT
            jpu.id                       AS line_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            jpu.qty,
            jpu.cost_price,
            (jpu.cost_price * jpu.qty)   AS line_value,
            jpu.remarks,
            jpu.created_at
        FROM job_part_used jpu
        JOIN spare_part_master spm ON spm.id = jpu.part_id
        LEFT JOIN brand        b   ON b.id   = spm.brand_id
        WHERE jpu.job_id = (table "p_job_id")
        ORDER BY jpu.id
    """

    # ── Reports — Job Reports ─────────────────────────────────────────────────

    GET_JOBS_RECEIVED_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS warranty_count,
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = '')      AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job j
        WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_JOBS_REPAIRED_OK_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS warranty_count,
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = '')      AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.is_final = true
          AND js.code IN ('COMPLETED_OK', 'DELIVERED_OK')
          AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_JOBS_DELIVERED_OK_RANGE_SPLIT = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS warranty_count,
            COUNT(*) FILTER (WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = '')      AS oow_count,
            COUNT(*)                                                                            AS total_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE js.code = 'DELIVERED_OK'
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_DELIVERED_JOBS_DETAILED_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            j.id, j.job_no, j.delivery_date,
            cc.full_name                        AS customer_name,
            b.name                              AS brand_name,
            pbm.model_name                      AS model_name,
            p.name                              AS product_name,
            t.name                              AS technician_name,
            (j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS is_warranty,
            COALESCE(parts.parts_cost, 0)       AS parts_cost,
            COALESCE(charges.charges_cost, 0)   AS charges_cost,
            COALESCE(ji.amount, 0)              AS selling_total,
            COALESCE(ji.amount, 0)
              - COALESCE(parts.parts_cost, 0)
              - COALESCE(charges.charges_cost, 0) AS profit,
            COALESCE(ji.cgst_amount, 0)
              + COALESCE(ji.sgst_amount, 0)
              + COALESCE(ji.igst_amount, 0)     AS gst
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        LEFT JOIN technician  t  ON t.id  = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand       b  ON b.id  = pbm.brand_id
        LEFT JOIN product     p  ON p.id  = pbm.product_id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE js.code = 'DELIVERED_OK'
          AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY j.delivery_date DESC, j.id DESC
    """

    GET_JOB_TRANSACTION_LEDGER_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jt.id,
            jt.transaction_date,
            j.job_no,
            js.name                AS status_name,
            t.name                 AS technician_name,
            jt.amount,
            jt.remarks
        FROM job_transaction jt
        JOIN job              j  ON j.id  = jt.job_id
        LEFT JOIN job_status  js ON js.id = jt.status_id
        LEFT JOIN technician  t  ON t.id  = jt.technician_id
        WHERE jt.transaction_date::date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jt.transaction_date DESC, jt.id DESC
    """

    GET_JOB_PIPELINE_BY_STATUS_AGE = """
        SELECT
            js.code AS status_code,
            js.name AS status_name,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) <  1) AS bucket_0,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 1  AND 3 ) AS bucket_1_3,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 4  AND 7 ) AS bucket_4_7,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 8  AND 15) AS bucket_8_15,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) BETWEEN 16 AND 30) AS bucket_16_30,
            COUNT(*) FILTER (WHERE (CURRENT_DATE - j.job_date) > 30) AS bucket_over_30,
            COUNT(*) AS total_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.is_closed = false
        GROUP BY js.code, js.name, js.display_order
        ORDER BY js.display_order, js.code
    """

    GET_JOB_PIPELINE_CELL_JOBS = """
        with
            "p_status_code" as (values(%(status_code)s::text)),
            "p_age_min"     as (values(%(age_min)s::int)),
            "p_age_max"     as (values(%(age_max)s::int))
        SELECT
            j.id, j.job_no, j.job_date,
            (CURRENT_DATE - j.job_date) AS days_old,
            cc.full_name              AS customer_name,
            p.name                    AS product_name,
            b.name                    AS brand_name,
            pbm.model_name            AS model_name,
            js.code                   AS status_code,
            js.name                   AS status_name,
            t.name                    AS technician_name,
            (j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> '') AS is_warranty
        FROM job j
        JOIN customer_contact         cc  ON cc.id  = j.customer_contact_id
        JOIN job_status               js  ON js.id  = j.job_status_id
        LEFT JOIN technician          t   ON t.id   = j.technician_id
        LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
        LEFT JOIN brand               b   ON b.id   = pbm.brand_id
        LEFT JOIN product             p   ON p.id   = pbm.product_id
        WHERE j.is_closed = false
          AND js.code = (table "p_status_code")
          AND (CURRENT_DATE - j.job_date) BETWEEN (table "p_age_min") AND (table "p_age_max")
        ORDER BY j.job_date ASC, j.id ASC
    """

    GET_JOB_STATUS_TREND_MONTHLY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(date_trunc('month', j.job_date), 'YYYY-MM') AS month,
            js.code                                            AS status_code,
            js.name                                            AS status_name,
            COUNT(*) AS jobs_count
        FROM job j
        JOIN job_status js ON js.id = j.job_status_id
        WHERE j.job_date >= (date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month')::date
        GROUP BY date_trunc('month', j.job_date), js.code, js.name, js.display_order
        ORDER BY date_trunc('month', j.job_date), js.display_order, js.code
    """

    # ── Reports — Financial ───────────────────────────────────────────────────

    GET_PROFIT_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COALESCE(SUM(ji.amount), 0)                        AS total_revenue,
            COALESCE(SUM(parts.parts_cost), 0)
              + COALESCE(SUM(charges.charges_cost), 0)         AS total_cost,
            COALESCE(SUM(ji.amount), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0)         AS total_profit,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
            ), 0)                                              AS warranty_revenue,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
            ), 0)                                              AS oow_revenue,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
                ), 0)                                          AS warranty_profit,
            COALESCE(SUM(ji.amount) FILTER (
                WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
                ), 0)                                          AS oow_profit
        FROM job j
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
    """

    GET_REVENUE_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COALESCE((SELECT SUM(amount) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0) AS job_invoice_total,
            COALESCE((SELECT SUM(amount) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS sales_invoice_total,
            COALESCE((SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0)
              + COALESCE((SELECT SUM(cgst_amount + sgst_amount + igst_amount) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS gst_total,
            COALESCE((SELECT COUNT(*) FROM job_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")), 0) AS job_invoice_count,
            COALESCE((SELECT COUNT(*) FROM sales_invoice
                      WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                        AND is_return = false), 0)                                         AS sales_invoice_count
    """

    GET_REVENUE_BY_MONTH_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount), 0)                              AS revenue
        FROM (
            SELECT invoice_date, amount FROM job_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT invoice_date, amount FROM sales_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                AND is_return = false
        ) x
        GROUP BY date_trunc('month', invoice_date)
        ORDER BY date_trunc('month', invoice_date)
    """

    GET_CASH_REGISTER_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            jp.payment_date,
            jp.receipt_no,
            j.job_no,
            cc.full_name              AS customer_name,
            jp.payment_mode,
            jp.amount,
            jp.reference_no,
            jp.remarks
        FROM job_payment jp
        JOIN job              j  ON j.id  = jp.job_id
        JOIN customer_contact cc ON cc.id = j.customer_contact_id
        WHERE jp.payment_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY jp.payment_date DESC, jp.id DESC
    """

    GET_SALES_REPORT_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            si.invoice_date,
            si.invoice_no,
            si.customer_name,
            sil.part_id,
            spm.part_code,
            spm.part_name,
            b.name           AS brand_name,
            sil.qty,
            sil.price,
            sil.amount,
            sil.gst_rate,
            (sil.cgst_amount + sil.sgst_amount + sil.igst_amount) AS gst_amount
        FROM sales_invoice si
        JOIN sales_invoice_line sil ON sil.sales_invoice_id = si.id
        JOIN spare_part_master  spm ON spm.id = sil.part_id
        LEFT JOIN brand         b   ON b.id   = spm.brand_id
        WHERE si.invoice_date BETWEEN (table "p_from") AND (table "p_to")
          AND si.is_return = false
        ORDER BY si.invoice_date DESC, si.id DESC, sil.id ASC
    """

    GET_GST_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(cgst_amount), 0) AS cgst,
            COALESCE(SUM(sgst_amount), 0) AS sgst,
            COALESCE(SUM(igst_amount), 0) AS igst,
            COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total_gst,
            COALESCE(SUM(aggregate), 0) AS aggregate
        FROM (
            SELECT invoice_date, cgst_amount, sgst_amount, igst_amount, aggregate
              FROM job_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT invoice_date, cgst_amount, sgst_amount, igst_amount, aggregate
              FROM sales_invoice
              WHERE invoice_date BETWEEN (table "p_from") AND (table "p_to")
                AND is_return = false
        ) x
        GROUP BY date_trunc('month', invoice_date)
        ORDER BY date_trunc('month', invoice_date)
    """

    # ── Reports — Performance ─────────────────────────────────────────────────

    GET_TECHNICIAN_SCORECARD_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS received_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            )                                     AS delivered_count,
            COALESCE(SUM(ji.amount) FILTER (
              WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0)                                 AS revenue,
            COALESCE(SUM(ji.amount) FILTER (
              WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
            ), 0)
              - COALESCE(SUM(parts.parts_cost) FILTER (
                  WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
                ), 0)
              - COALESCE(SUM(charges.charges_cost) FILTER (
                  WHERE ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
                ), 0)                             AS profit,
            COALESCE(AVG(EXTRACT(EPOCH FROM (j.delivery_date::timestamp - j.job_date::timestamp))/86400)
                     FILTER (WHERE j.delivery_date IS NOT NULL
                       AND j.delivery_date BETWEEN (table "p_from") AND (table "p_to")), 0)
                                                  AS avg_turnaround_days
        FROM technician t
        LEFT JOIN job         j  ON j.technician_id = t.id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY profit DESC NULLS LAST, t.name
    """

    GET_TECH_REPAIRED_DELIVERED_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            )                                     AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            )                                     AS delivered_count
        FROM technician t
        LEFT JOIN job j ON j.technician_id = t.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY delivered_count DESC, repaired_count DESC, t.name
    """

    GET_PROFIT_BY_TECHNICIAN_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            COALESCE(SUM(ji.amount), 0)           AS revenue,
            COALESCE(SUM(parts.parts_cost), 0)
              + COALESCE(SUM(charges.charges_cost), 0) AS cost,
            COALESCE(SUM(ji.amount), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0) AS profit
        FROM technician t
        LEFT JOIN job         j  ON j.technician_id = t.id
        LEFT JOIN job_invoice ji ON ji.job_id = j.id
            AND ji.invoice_date BETWEEN (table "p_from") AND (table "p_to")
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name
        ORDER BY profit DESC NULLS LAST
    """

    GET_TECH_PRODUCTIVITY_HEATMAP_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            t.id                                  AS technician_id,
            t.name                                AS technician_name,
            jt.transaction_date::date             AS day,
            COUNT(DISTINCT jt.job_id)             AS jobs_touched
        FROM job_transaction jt
        JOIN technician t ON t.id = jt.technician_id
        WHERE jt.transaction_date::date BETWEEN (table "p_from") AND (table "p_to")
          AND t.is_active = true
        GROUP BY t.id, t.name, jt.transaction_date::date
        ORDER BY t.name, day
    """

    # ── Reports — Inventory ───────────────────────────────────────────────────

    GET_PARTS_LEDGER_FY = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            spm.id                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            COALESCE(opening.opening_qty, 0)   AS opening_qty,
            COALESCE(opening.opening_qty, 0) * COALESCE(spm.cost_price, 0) AS opening_value,
            COALESCE(tx.dr_qty, 0)             AS dr_qty,
            COALESCE(tx.dr_qty, 0) * COALESCE(spm.cost_price, 0)           AS dr_value,
            COALESCE(tx.cr_qty, 0)             AS cr_qty,
            COALESCE(tx.cr_qty, 0) * COALESCE(spm.cost_price, 0)           AS cr_value,
            (COALESCE(opening.opening_qty, 0) + COALESCE(tx.dr_qty, 0) - COALESCE(tx.cr_qty, 0)) AS closing_qty,
            (COALESCE(opening.opening_qty, 0) + COALESCE(tx.dr_qty, 0) - COALESCE(tx.cr_qty, 0))
              * COALESCE(spm.cost_price, 0)                                 AS closing_value
        FROM spare_part_master spm
        LEFT JOIN brand b ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT st.part_id,
                   SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE -st.qty END) AS opening_qty
            FROM stock_transaction st
            WHERE st.transaction_date < (table "p_from")
            GROUP BY st.part_id
        ) opening ON opening.part_id = spm.id
        LEFT JOIN (
            SELECT st.part_id,
                   SUM(CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE 0 END) AS dr_qty,
                   SUM(CASE WHEN st.dr_cr = 'C' THEN st.qty ELSE 0 END) AS cr_qty
            FROM stock_transaction st
            WHERE st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
            GROUP BY st.part_id
        ) tx ON tx.part_id = spm.id
        WHERE spm.is_active = true
        ORDER BY spm.part_code
    """

    GET_PARTS_AGING = """
        SELECT
            spm.id            AS part_id,
            spm.part_code,
            spm.part_name,
            b.name            AS brand_name,
            COALESCE(sb.qty, 0) AS stock_qty,
            COALESCE(spm.cost_price, 0) AS cost_price,
            COALESCE(sb.qty, 0) * COALESCE(spm.cost_price, 0) AS stock_value,
            COALESCE(latest.last_dr_date, NULL) AS last_in_date,
            COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - latest.last_dr_date)), 999) AS age_days
        FROM spare_part_master spm
        LEFT JOIN brand b ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT part_id, SUM(qty) AS qty FROM stock_balance GROUP BY part_id
        ) sb ON sb.part_id = spm.id
        LEFT JOIN (
            SELECT part_id, MAX(transaction_date) AS last_dr_date
            FROM stock_transaction
            WHERE dr_cr = 'D'
            GROUP BY part_id
        ) latest ON latest.part_id = spm.id
        WHERE spm.is_active = true
          AND COALESCE(sb.qty, 0) > 0
        ORDER BY age_days DESC NULLS LAST, spm.part_code
    """

    GET_PARTS_CONSUMPTION_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            x.consumed_date,
            x.part_code,
            x.part_name,
            x.brand_name,
            x.qty,
            x.source,
            x.ref_no,
            x.remarks
        FROM (
            SELECT
                jpu.created_at::date  AS consumed_date,
                spm.part_code,
                spm.part_name,
                b.name                AS brand_name,
                jpu.qty,
                'Job'                 AS source,
                j.job_no              AS ref_no,
                jpu.remarks           AS remarks
            FROM job_part_used jpu
            JOIN spare_part_master spm ON spm.id = jpu.part_id
            JOIN job              j   ON j.id   = jpu.job_id
            LEFT JOIN brand        b  ON b.id   = spm.brand_id
            WHERE jpu.created_at::date BETWEEN (table "p_from") AND (table "p_to")
            UNION ALL
            SELECT
                si.invoice_date       AS consumed_date,
                spm.part_code,
                spm.part_name,
                b.name                AS brand_name,
                sil.qty,
                'Sales'               AS source,
                si.invoice_no         AS ref_no,
                sil.remarks           AS remarks
            FROM sales_invoice_line sil
            JOIN sales_invoice  si  ON si.id  = sil.sales_invoice_id
            JOIN spare_part_master spm ON spm.id = sil.part_id
            LEFT JOIN brand     b   ON b.id   = spm.brand_id
            WHERE si.invoice_date BETWEEN (table "p_from") AND (table "p_to")
              AND si.is_return = false
        ) x
        ORDER BY x.consumed_date DESC
    """

    GET_STOCK_LEDGER_RANGE = """
        with
            "p_from"    as (values(%(from)s::date)),
            "p_to"      as (values(%(to)s::date)),
            "p_part_id" as (values(%(part_id)s::bigint))
        SELECT
            st.id,
            st.transaction_date,
            stt.code                  AS txn_type_code,
            stt.name                  AS txn_type_name,
            st.dr_cr,
            CASE WHEN st.dr_cr = 'D' THEN st.qty ELSE 0 END AS dr_qty,
            CASE WHEN st.dr_cr = 'C' THEN st.qty ELSE 0 END AS cr_qty,
            st.qty,
            st.unit_cost,
            st.remarks
        FROM stock_transaction st
        JOIN stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
        WHERE st.part_id = (table "p_part_id")
          AND st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
        ORDER BY st.transaction_date, st.id
    """

    GET_STOCK_MOVEMENT_SUMMARY_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            stt.code                  AS txn_type_code,
            stt.name                  AS txn_type_name,
            stt.dr_cr,
            COALESCE(SUM(st.qty), 0)  AS total_qty,
            COUNT(*)                  AS total_lines
        FROM stock_transaction st
        JOIN stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
        WHERE st.transaction_date BETWEEN (table "p_from") AND (table "p_to")
        GROUP BY stt.code, stt.name, stt.dr_cr
        ORDER BY total_qty DESC
    """

    GET_PARTS_CONSUMPTION_MONTHLY_LAST_6 = """
        SELECT
            spm.id                                          AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                                          AS brand_name,
            EXTRACT(YEAR FROM age(date_trunc('month', CURRENT_DATE), date_trunc('month', x.consumed_date))) * 12
              + EXTRACT(MONTH FROM age(date_trunc('month', CURRENT_DATE), date_trunc('month', x.consumed_date))) AS month_offset,
            SUM(x.qty)                                      AS qty
        FROM spare_part_master spm
        LEFT JOIN brand        b   ON b.id = spm.brand_id
        LEFT JOIN (
            SELECT jpu.part_id, jpu.created_at::date AS consumed_date, jpu.qty
              FROM job_part_used jpu
            UNION ALL
            SELECT sil.part_id, si.invoice_date AS consumed_date, sil.qty
              FROM sales_invoice_line sil
              JOIN sales_invoice si ON si.id = sil.sales_invoice_id
              WHERE si.is_return = false
        ) x ON x.part_id = spm.id
        WHERE spm.is_active = true
          AND x.consumed_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')::date
          AND x.consumed_date <  date_trunc('month', CURRENT_DATE)::date
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name,
                 date_trunc('month', x.consumed_date)
        ORDER BY spm.part_code, month_offset
    """

    GET_PARTS_CURRENT_STOCK = """
        SELECT
            spm.id                       AS part_id,
            spm.part_code,
            spm.part_name,
            b.name                       AS brand_name,
            COALESCE(SUM(sb.qty), 0)     AS stock_qty
        FROM spare_part_master spm
        LEFT JOIN brand         b  ON b.id  = spm.brand_id
        LEFT JOIN stock_balance sb ON sb.part_id = spm.id
        WHERE spm.is_active = true
        GROUP BY spm.id, spm.part_code, spm.part_name, b.name
        ORDER BY spm.part_code
    """

    # ── Reports — Trends ──────────────────────────────────────────────────────

    GET_JOBS_RECEIVED_BY_MONTH = GET_DASHBOARD_MONTHLY_INTAKE

    GET_JOBS_RECEIVED_BY_YEAR = """
        with
            "p_years_back" as (values(%(years_back)s::int)),
            "p_fy_start"   as (values(%(fy_start_month)s::int))
        SELECT
            CASE WHEN EXTRACT(MONTH FROM j.job_date) >= (table "p_fy_start")
                 THEN EXTRACT(YEAR FROM j.job_date)::int
                 ELSE (EXTRACT(YEAR FROM j.job_date) - 1)::int
            END AS fy_year,
            COUNT(*) FILTER (
              WHERE j.warranty_card_no IS NOT NULL AND j.warranty_card_no <> ''
            ) AS warranty_count,
            COUNT(*) FILTER (
              WHERE j.warranty_card_no IS NULL OR j.warranty_card_no = ''
            ) AS oow_count,
            COUNT(*) AS total_count
        FROM job j
        WHERE j.job_date >= (
            make_date(
                (EXTRACT(YEAR FROM CURRENT_DATE)::int - (table "p_years_back")),
                (table "p_fy_start"),
                1
            )
        )
        GROUP BY 1
        ORDER BY 1
    """

    GET_REPAIR_DELIVER_FUNNEL_RANGE = """
        with
            "p_from" as (values(%(from)s::date)),
            "p_to"   as (values(%(to)s::date))
        SELECT
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.job_date BETWEEN (table "p_from") AND (table "p_to")
            ) AS received_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.is_final = true
                AND j.updated_at::date BETWEEN (table "p_from") AND (table "p_to")
            ) AS repaired_count,
            COUNT(DISTINCT j.id) FILTER (
              WHERE j.delivery_date BETWEEN (table "p_from") AND (table "p_to")
                AND j.is_closed = true
            ) AS delivered_count
        FROM job j
    """

    GET_PROFIT_TREND_YOY = """
        with
            "p_months_back" as (values(%(months_back)s::int))
        SELECT
            to_char(date_trunc('month', ji.invoice_date), 'YYYY-MM') AS month,
            COALESCE(SUM(ji.amount), 0)
              - COALESCE(SUM(parts.parts_cost), 0)
              - COALESCE(SUM(charges.charges_cost), 0) AS profit
        FROM job_invoice ji
        JOIN job j ON j.id = ji.job_id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS parts_cost FROM job_part_used GROUP BY job_id
        ) parts ON parts.job_id = j.id
        LEFT JOIN (
            SELECT job_id, SUM(cost_price * qty) AS charges_cost FROM job_additional_charge GROUP BY job_id
        ) charges ON charges.job_id = j.id
        WHERE ji.invoice_date >= (date_trunc('month', CURRENT_DATE) - ((table "p_months_back") - 1) * INTERVAL '1 month')::date
        GROUP BY date_trunc('month', ji.invoice_date)
        ORDER BY date_trunc('month', ji.invoice_date)
    """
