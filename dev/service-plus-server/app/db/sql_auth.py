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

    CHECK_DB_NAME_EXISTS = """
        with "db_name" as (values(%(db_name)s::text))
        -- with "db_name" as (values('service_plus_demo'::text)) -- Test line
        SELECT EXISTS(
            SELECT 1 FROM pg_database WHERE datname = (table "db_name")
        ) AS exists
    """

    CHECK_ROLE_SEED_EXISTS = """
        SELECT EXISTS(
            SELECT 1 FROM security.role LIMIT 1
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

    UPDATE_CLIENT_DB_NAME = """
        with
            "p_db_name" as (values(%(db_name)s::text)),
            -- "p_db_name" as (values('service_plus_demo'::text)) -- Test line
            "p_id"      as (values(%(id)s::int))
            -- "p_id"      as (values(1::int)) -- Test line
        UPDATE public.client
        SET db_name = (table "p_db_name")
        WHERE id = (table "p_id")
        RETURNING id, db_name
    """

    SECURITY_SCHEMA_DDL = """
        DROP SCHEMA IF EXISTS public CASCADE;

        CREATE SCHEMA IF NOT EXISTS security;

        CREATE TABLE security.access_right (
            id          bigint NOT NULL,
            code        text   NOT NULL,
            name        text   NOT NULL,
            module      text   NOT NULL,
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
            id          bigint  NOT NULL,
            code        text    NOT NULL,
            name        text    NOT NULL,
            description text,
            is_system   boolean DEFAULT false NOT NULL,
            created_at  timestamp with time zone DEFAULT now() NOT NULL,
            updated_at  timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT role_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
        );
        ALTER TABLE security.role ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME security.role_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );
        ALTER TABLE ONLY security.role ADD CONSTRAINT role_code_key UNIQUE (code);
        ALTER TABLE ONLY security.role ADD CONSTRAINT role_pkey PRIMARY KEY (id);
        CREATE INDEX role_is_system_idx ON security.role USING btree (is_system);

        CREATE TABLE security.role_access_right (
            role_id         bigint NOT NULL,
            access_right_id bigint NOT NULL
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

