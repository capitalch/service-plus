class SqlAuth:
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

    INSERT_CLIENT = """
        with
            "p_code"    as (values(%(code)s::text)),
            -- "p_code"    as (values('DEMO01'::text)) -- Test line
            "p_db_name" as (values(%(db_name)s::text)),
            -- "p_db_name" as (values('service_plus_demo01'::text)) -- Test line
            "p_email"   as (values(%(email)s::text)),
            -- "p_email"   as (values('admin@demo.com'::text)) -- Test line
            "p_name"    as (values(%(name)s::text)),
            -- "p_name"    as (values('Demo Client'::text)) -- Test line
            "p_phone"   as (values(%(phone)s::text))
            -- "p_phone"   as (values('9999999999'::text)) -- Test line
        INSERT INTO public.client (code, db_name, email, is_active, name, phone)
        VALUES (
            (table "p_code"),
            NULLIF((table "p_db_name"), ''),
            NULLIF((table "p_email"), ''),
            true,
            (table "p_name"),
            NULLIF((table "p_phone"), '')
        )
        RETURNING id, code, name, is_active, db_name, created_at, updated_at
    """

    # GET_CLIENT_DB_NAME = """
    #     with "client_id" as (values(%(client_id)s::bigint))
    #     -- with "client_id" as (values(1::bigint)) -- Test line
    #     SELECT db_name
    #     FROM client
    #     WHERE id = (table "client_id")
    #       AND is_active = true
    # """

    # GET_USER_BY_IDENTITY = """
    #     with "identity" as (values(%(identity)s::text))
    #     -- with "identity" as (values('john@example.com'::text)) -- Test line
    #     SELECT u.id, u.username, u.email, u.mobile, u.password_hash, u.full_name,
    #            u.is_active, u.is_admin,
    #            (SELECT r.name
    #             FROM user_bu_role ubr
    #             JOIN role r ON r.id = ubr.role_id
    #             WHERE ubr.user_id = u.id AND ubr.is_active = true
    #             ORDER BY r.name LIMIT 1) AS role_name,
    #            ARRAY(SELECT DISTINCT ar.code
    #                  FROM user_bu_role ubr
    #                  JOIN role_access_right rar ON rar.role_id = ubr.role_id
    #                  JOIN access_right ar ON ar.id = rar.access_right_id
    #                  WHERE ubr.user_id = u.id AND ubr.is_active = true
    #                  ORDER BY ar.code) AS access_rights
    #     FROM "user" u
    #     WHERE u.username = (table "identity")
    #        OR u.email = (table "identity")
    #     LIMIT 1
    # """
