--
-- PostgreSQL database dump
--

\restrict WXjSp3OlfpRpY5NJMHhdtANgSesnjrUE9bFCyA9i7hlz7aeXVQgDcC10BCgfYHt

-- Dumped from database version 14.6
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: webadmin
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO webadmin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: client; Type: TABLE; Schema: public; Owner: webadmin
--

CREATE TABLE public.client (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    gstin text,
    pan text,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    pincode text,
    country_code character(2) DEFAULT 'IN'::bpchar,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    db_name text,
    subscription_tier text DEFAULT 'BASIC'::text NOT NULL,
    CONSTRAINT client_subscription_tier_chk CHECK ((subscription_tier = ANY (ARRAY['BASIC'::text, 'PRO'::text, 'ENTERPRISE'::text])))
);


ALTER TABLE public.client OWNER TO webadmin;

--
-- Name: client_id_seq; Type: SEQUENCE; Schema: public; Owner: webadmin
--

ALTER TABLE public.client ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.client_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: client client_code_unique; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_code_unique UNIQUE (code);


--
-- Name: client client_db_name_key; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_db_name_key UNIQUE (db_name);


--
-- Name: client client_email_unique; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_email_unique UNIQUE (email);


--
-- Name: client client_name_key; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_name_key UNIQUE (name);


--
-- Name: client client_pkey; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_pkey PRIMARY KEY (id);


--
-- Name: client_gstin_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX client_gstin_idx ON public.client USING btree (gstin);


--
-- Name: client_is_active_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX client_is_active_idx ON public.client USING btree (is_active);


--
-- Name: client_name_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX client_name_idx ON public.client USING btree (name);


--
-- Name: client_phone_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX client_phone_idx ON public.client USING btree (phone);


--
-- Name: client trg_client_updated; Type: TRIGGER; Schema: public; Owner: webadmin
--

CREATE TRIGGER trg_client_updated BEFORE UPDATE ON public.client FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict WXjSp3OlfpRpY5NJMHhdtANgSesnjrUE9bFCyA9i7hlz7aeXVQgDcC10BCgfYHt

