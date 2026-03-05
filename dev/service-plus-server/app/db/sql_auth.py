class SqlAuth:
    CHECK_CLIENT_CODE_EXISTS = """
        with "p_code" as (values(%(code)s::text))
        -- with "p_code" as (values('ACME01'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM public.client
            WHERE LOWER(code) = LOWER((table "p_code"))
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

    GET_ALL_CLIENTS_ON_CRITERIA = """
        with "criteria" as (values(%(criteria)s::text))
        -- with "criteria" as (values('cap'::text)) -- Test line
        SELECT id, name, is_active
        FROM client
        WHERE LOWER("name") LIKE LOWER((table "criteria") || '%%')
          AND is_active = true
        ORDER BY name
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

    GET_CLIENT_DB_NAMES = """
        SELECT id, code, name, is_active, db_name, created_at, updated_at
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

    # INSERT_CLIENT = """
    #     with
    #         "p_code"    as (values(%(code)s::text)),
    #         -- "p_code"    as (values('DEMO01'::text)) -- Test line
    #         "p_db_name" as (values(%(db_name)s::text)),
    #         -- "p_db_name" as (values('service_plus_demo01'::text)) -- Test line
    #         "p_email"   as (values(%(email)s::text)),
    #         -- "p_email"   as (values('admin@demo.com'::text)) -- Test line
    #         "p_name"    as (values(%(name)s::text)),
    #         -- "p_name"    as (values('Demo Client'::text)) -- Test line
    #         "p_phone"   as (values(%(phone)s::text))
    #         -- "p_phone"   as (values('9999999999'::text)) -- Test line
    #     INSERT INTO public.client (code, db_name, email, is_active, name, phone)
    #     VALUES (
    #         (table "p_code"),
    #         NULLIF((table "p_db_name"), ''),
    #         NULLIF((table "p_email"), ''),
    #         true,
    #         (table "p_name"),
    #         NULLIF((table "p_phone"), '')
    #     )
    #     RETURNING id, code, name, is_active, db_name, created_at, updated_at
    # """
