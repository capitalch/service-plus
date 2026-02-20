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

    GET_CLIENT_DB_NAME = """
        with "client_id" as (values(%(client_id)s::bigint))
        -- with "client_id" as (values(1::bigint)) -- Test line
        SELECT db_name
        FROM client
        WHERE id = (table "client_id")
          AND is_active = true
    """

    GET_USER_BY_IDENTITY = """
        with "identity" as (values(%(identity)s::text))
        -- with "identity" as (values('john@example.com'::text)) -- Test line
        SELECT u.id, u.username, u.email, u.mobile, u.password_hash, u.full_name,
               u.is_active, u.is_admin,
               (SELECT r.name
                FROM user_bu_role ubr
                JOIN role r ON r.id = ubr.role_id
                WHERE ubr.user_id = u.id AND ubr.is_active = true
                ORDER BY r.name LIMIT 1) AS role_name,
               ARRAY(SELECT DISTINCT ar.code
                     FROM user_bu_role ubr
                     JOIN role_access_right rar ON rar.role_id = ubr.role_id
                     JOIN access_right ar ON ar.id = rar.access_right_id
                     WHERE ubr.user_id = u.id AND ubr.is_active = true
                     ORDER BY ar.code) AS access_rights
        FROM "user" u
        WHERE u.username = (table "identity")
           OR u.email = (table "identity")
        LIMIT 1
    """
