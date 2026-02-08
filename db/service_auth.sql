--
-- Name: access_right; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security.access_right (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_right_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
);


ALTER TABLE security.access_right OWNER TO webadmin;

--
-- Name: access_right_id_seq; Type: SEQUENCE; Schema: security; Owner: webadmin
--

ALTER TABLE security.access_right ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME security.access_right_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bu; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security.bu (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE security.bu OWNER TO webadmin;

--
-- Name: bu_id_seq; Type: SEQUENCE; Schema: security; Owner: webadmin
--

ALTER TABLE security.bu ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME security.bu_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: role; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security.role (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
);


ALTER TABLE security.role OWNER TO webadmin;

--
-- Name: role_access_right; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security.role_access_right (
    role_id bigint NOT NULL,
    access_right_id bigint NOT NULL
);


ALTER TABLE security.role_access_right OWNER TO webadmin;

--
-- Name: role_id_seq; Type: SEQUENCE; Schema: security; Owner: webadmin
--

ALTER TABLE security.role ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME security.role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security."user" (
    id bigint NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    mobile text,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text NOT NULL
);


ALTER TABLE security."user" OWNER TO webadmin;

--
-- Name: user_bu_role; Type: TABLE; Schema: security; Owner: webadmin
--

CREATE TABLE security.user_bu_role (
    user_id bigint NOT NULL,
    bu_id bigint NOT NULL,
    role_id bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE security.user_bu_role OWNER TO webadmin;

--
-- Name: user_id_seq; Type: SEQUENCE; Schema: security; Owner: webadmin
--

ALTER TABLE security."user" ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME security.user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: access_right access_right_code_key; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.access_right
    ADD CONSTRAINT access_right_code_key UNIQUE (code);


--
-- Name: access_right access_right_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.access_right
    ADD CONSTRAINT access_right_pkey PRIMARY KEY (id);

--
-- Name: bu bu_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.bu
    ADD CONSTRAINT bu_pkey PRIMARY KEY (id);

--
-- Name: role_access_right role_access_right_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.role_access_right
    ADD CONSTRAINT role_access_right_pkey PRIMARY KEY (role_id, access_right_id);


--
-- Name: role role_code_key; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.role
    ADD CONSTRAINT role_code_key UNIQUE (code);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: user_bu_role user_bu_role_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.user_bu_role
    ADD CONSTRAINT user_bu_role_pkey PRIMARY KEY (user_id, bu_id, role_id);


--
-- Name: user_bu_role user_bu_role_user_id_bu_id_key; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.user_bu_role
    ADD CONSTRAINT user_bu_role_user_id_bu_id_key UNIQUE (user_id, bu_id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user user_username_key; Type: CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security."user"
    ADD CONSTRAINT user_username_key UNIQUE (username);


--
-- Name: access_right_module_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX access_right_module_idx ON security.access_right USING btree (module) WITH (deduplicate_items='true');


--
-- Name: role_access_right_access_right_id_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX role_access_right_access_right_id_idx ON security.role_access_right USING btree (access_right_id) WITH (deduplicate_items='true');


--
-- Name: role_is_system_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX role_is_system_idx ON security.role USING btree (is_system) WITH (deduplicate_items='true');


--
-- Name: user_bu_role_bu_id_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX user_bu_role_bu_id_idx ON security.user_bu_role USING btree (bu_id) WITH (deduplicate_items='true');


--
-- Name: user_bu_role_role_id_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX user_bu_role_role_id_idx ON security.user_bu_role USING btree (role_id) WITH (deduplicate_items='true');


--
-- Name: user_bu_role_user_id_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX user_bu_role_user_id_idx ON security.user_bu_role USING btree (user_id) WITH (deduplicate_items='true');


--
-- Name: user_full_name_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE INDEX user_full_name_idx ON security."user" USING btree (full_name) WITH (deduplicate_items='true');


--
-- Name: user_mobile_unique_idx; Type: INDEX; Schema: security; Owner: webadmin
--

CREATE UNIQUE INDEX user_mobile_unique_idx ON security."user" USING btree (mobile) WHERE (mobile IS NOT NULL);

--
-- Name: role_access_right role_access_right_access_right_id_fkey; Type: FK CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.role_access_right
    ADD CONSTRAINT role_access_right_access_right_id_fkey FOREIGN KEY (access_right_id) REFERENCES security.access_right(id) ON DELETE CASCADE;


--
-- Name: role_access_right role_access_right_role_id_fkey; Type: FK CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.role_access_right
    ADD CONSTRAINT role_access_right_role_id_fkey FOREIGN KEY (role_id) REFERENCES security.role(id) ON DELETE CASCADE;


--
-- Name: user_bu_role user_bu_role_bu_id_fkey; Type: FK CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.user_bu_role
    ADD CONSTRAINT user_bu_role_bu_id_fkey FOREIGN KEY (bu_id) REFERENCES security.bu(id) ON DELETE CASCADE;


--
-- Name: user_bu_role user_bu_role_role_id_fkey; Type: FK CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.user_bu_role
    ADD CONSTRAINT user_bu_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES security.role(id) ON DELETE CASCADE;


--
-- Name: user_bu_role user_bu_role_user_id_fkey; Type: FK CONSTRAINT; Schema: security; Owner: webadmin
--

ALTER TABLE ONLY security.user_bu_role
    ADD CONSTRAINT user_bu_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES security."user"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

