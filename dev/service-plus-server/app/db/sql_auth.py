class SqlAuth:
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

    CHECK_ADMIN_EMAIL_EXISTS = """
        with "p_email" as (values(%(email)s::text))
        -- with "p_email" as (values('admin@example.com'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(email) = LOWER((table "p_email"))
        ) AS exists
    """

    CHECK_ADMIN_USERNAME_EXISTS = """
        with "p_username" as (values(%(username)s::text))
        SELECT EXISTS(
            SELECT 1 FROM security."user"
            WHERE LOWER(username) = LOWER((table "p_username"))
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

    CHECK_CLIENT_DB_NAME_IN_USE = """
        with "p_db_name" as (values(%(db_name)s::text))
        SELECT EXISTS(
            SELECT 1 FROM public.client WHERE db_name = (table "p_db_name")
        ) AS exists
    """

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

    DELETE_CLIENT = """
        with "p_id" as (values(%(id)s::int))
        -- with "p_id" as (values(1::int)) -- Test line
        DELETE FROM public.client
        WHERE id = (table "p_id")
        RETURNING id
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

    GET_ALL_BUS = """
        with "dummy" as (values(1::int))
        SELECT id, code, name, is_active, created_at, updated_at
        FROM security.bu
        ORDER BY name
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

    GET_ALL_ROLES = """
        with "dummy" as (values(1::int))
        SELECT id, code, description, is_system, name, created_at, updated_at
        FROM security.role
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

    GET_USER_BY_IDENTITY = """
        with "p_identity" as (values(%(identity)s::text))
        -- with "p_identity" as (values('admin'::text)) -- Test line
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.is_active,
            u.is_admin,
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
                 u.mobile, u.password_hash, u.username, r.name
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
        SELECT db_name
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

