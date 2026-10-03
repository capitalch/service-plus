--
-- PostgreSQL database dump
--

\restrict Bw0rZOmUW0ovjoeuw3syOrdlf9qs01nbcrwlE5Lb1TEtjxw6mJxc8Mm6FE7kpln

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
    db_name text
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
-- Name: sales_enquiry; Type: TABLE; Schema: public; Owner: webadmin
--

CREATE TABLE public.sales_enquiry (
    id bigint NOT NULL,
    plan_code text NOT NULL,
    name text NOT NULL,
    business_name text NOT NULL,
    mobile text NOT NULL,
    email text NOT NULL,
    city text NOT NULL,
    gstin text,
    branches integer DEFAULT 1 NOT NULL,
    message text,
    status text DEFAULT 'new'::text NOT NULL,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reference text,
    client_id bigint,
    bu_id bigint,
    bu_schema_ready_at timestamp with time zone,
    user_id bigint,
    login_email_sent boolean DEFAULT false NOT NULL,
    processing_started_at timestamp with time zone,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    setup_fee_paise bigint DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_amount_paise bigint,
    payment_mode text,
    payment_reference text,
    payment_received_on date,
    payment_recorded_by text,
    payment_recorded_at timestamp with time zone,
    payment_note text,
    CONSTRAINT sales_enquiry_branches_check CHECK (((branches >= 1) AND (branches <= 50))),
    CONSTRAINT sales_enquiry_plan_code_check CHECK ((plan_code = ANY (ARRAY['lite'::text, 'basic'::text, 'standard'::text, 'enterprise'::text]))),
    CONSTRAINT sales_enquiry_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'converted'::text, 'rejected'::text])))
);


ALTER TABLE public.sales_enquiry OWNER TO webadmin;

--
-- Name: sales_enquiry_id_seq; Type: SEQUENCE; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sales_enquiry_id_seq
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
-- Name: sales_enquiry sales_enquiry_converted_paid_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_converted_paid_check CHECK (((status <> 'converted'::text) OR (payment_status = 'received'::text))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_failed_note_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_failed_note_check CHECK (((payment_status <> 'failed'::text) OR (payment_note IS NOT NULL))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_not_required_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_not_required_check CHECK (((payment_status <> 'not_required'::text) OR (setup_fee_paise = 0))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_payment_mode_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_payment_mode_check CHECK (((payment_mode IS NULL) OR (payment_mode = ANY (ARRAY['bank_transfer'::text, 'upi'::text, 'cash'::text, 'other'::text])))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_payment_status_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_payment_status_check CHECK ((payment_status = ANY (ARRAY['not_required'::text, 'pending'::text, 'received'::text, 'failed'::text]))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_pkey PRIMARY KEY (id);


--
-- Name: sales_enquiry sales_enquiry_received_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_received_check CHECK (((payment_status <> 'received'::text) OR ((payment_mode IS NOT NULL) AND (payment_reference IS NOT NULL) AND (payment_received_on IS NOT NULL) AND (payment_amount_paise IS NOT NULL) AND (payment_amount_paise >= setup_fee_paise)))) NOT VALID;


--
-- Name: sales_enquiry sales_enquiry_setup_fee_check; Type: CHECK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_setup_fee_check CHECK ((setup_fee_paise >= 0)) NOT VALID;


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
-- Name: sales_enquiry_created_at_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX sales_enquiry_created_at_idx ON public.sales_enquiry USING btree (created_at DESC);


--
-- Name: sales_enquiry_reference_key; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE UNIQUE INDEX sales_enquiry_reference_key ON public.sales_enquiry USING btree (reference);


--
-- Name: sales_enquiry_status_idx; Type: INDEX; Schema: public; Owner: webadmin
--

CREATE INDEX sales_enquiry_status_idx ON public.sales_enquiry USING btree (status);


--
-- Name: client trg_client_updated; Type: TRIGGER; Schema: public; Owner: webadmin
--

CREATE TRIGGER trg_client_updated BEFORE UPDATE ON public.client FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sales_enquiry sales_enquiry_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: webadmin
--

ALTER TABLE ONLY public.sales_enquiry
    ADD CONSTRAINT sales_enquiry_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) NOT VALID;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict Bw0rZOmUW0ovjoeuw3syOrdlf9qs01nbcrwlE5Lb1TEtjxw6mJxc8Mm6FE7kpln

