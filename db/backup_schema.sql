--
-- PostgreSQL database dump
--

\restrict X6eFCJQR2CpXT6f47GxD4sUKfmID3JX6muMzFfg3A1kDL0xKPNTSNfgSevfBvvF

-- Dumped from database version 14.6
-- Dumped by pg_dump version 18.0

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_setting; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.app_setting (
    id smallint NOT NULL,
    setting_key text NOT NULL,
    setting_type text NOT NULL,
    setting_value jsonb NOT NULL,
    description text,
    is_editable boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_setting_type_check CHECK ((setting_type = ANY (ARRAY['TEXT'::text, 'INTEGER'::text, 'BOOLEAN'::text, 'JSON'::text])))
);


ALTER TABLE demo1.app_setting OWNER TO webadmin;

--
-- Name: branch; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.branch (
    id bigint NOT NULL,
    bu_id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address_line1 text NOT NULL,
    address_line2 text,
    state_id integer NOT NULL,
    city text,
    pincode text NOT NULL,
    gstin text,
    is_active boolean DEFAULT true NOT NULL,
    is_head_office boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT branch_code_check CHECK ((code ~ '^[A-Z0-9_]+$'::text)),
    CONSTRAINT branch_gstin_check CHECK (((gstin IS NULL) OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text)))
);


ALTER TABLE demo1.branch OWNER TO webadmin;

--
-- Name: branch_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.branch ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.branch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: brand; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.brand (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brand_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
);


ALTER TABLE demo1.brand OWNER TO webadmin;

--
-- Name: brand_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.brand ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.brand_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: company_info; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.company_info (
    id integer NOT NULL,
    company_name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text,
    state_id integer NOT NULL,
    country text DEFAULT 'IN'::text,
    pincode text,
    phone text,
    email text,
    gstin text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.company_info OWNER TO webadmin;

--
-- Name: customer_contact; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.customer_contact (
    id bigint NOT NULL,
    customer_type_id smallint NOT NULL,
    full_name text,
    gstin text,
    mobile text NOT NULL,
    alternate_mobile text,
    email text,
    address_line1 text NOT NULL,
    address_line2 text,
    landmark text,
    state_id integer NOT NULL,
    city text,
    postal_code text,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.customer_contact OWNER TO webadmin;

--
-- Name: customer_contact_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.customer_contact ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.customer_contact_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customer_type; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.customer_type (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    display_order smallint
);


ALTER TABLE demo1.customer_type OWNER TO webadmin;

--
-- Name: document_sequence; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.document_sequence (
    id bigint NOT NULL,
    document_type_id smallint NOT NULL,
    branch_id bigint NOT NULL,
    prefix text NOT NULL,
    next_number integer DEFAULT 1 NOT NULL,
    padding smallint DEFAULT 5 NOT NULL,
    separator text DEFAULT '/'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.document_sequence OWNER TO webadmin;

--
-- Name: document_sequence_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.document_sequence ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.document_sequence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: document_type; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.document_type (
    id smallint NOT NULL,
    code text NOT NULL,
    prefix text NOT NULL,
    name text NOT NULL,
    description text,
    CONSTRAINT document_type_code_chk CHECK ((code ~ '^[A-Z_]+$'::text))
);


ALTER TABLE demo1.document_type OWNER TO webadmin;

--
-- Name: financial_year; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.financial_year (
    id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    CONSTRAINT financial_year_date_check CHECK ((start_date < end_date))
);


ALTER TABLE demo1.financial_year OWNER TO webadmin;

--
-- Name: job; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job (
    id bigint NOT NULL,
    job_no text NOT NULL,
    job_date date DEFAULT CURRENT_DATE NOT NULL,
    customer_contact_id bigint NOT NULL,
    branch_id bigint NOT NULL,
    technician_id bigint,
    job_status_id smallint NOT NULL,
    job_type_id smallint NOT NULL,
    job_receive_manner_id smallint NOT NULL,
    job_receive_condition_id smallint,
    product_brand_model_id bigint,
    serial_no text,
    problem_reported text NOT NULL,
    diagnosis text,
    work_done text,
    remarks text,
    amount numeric(12,2),
    delivery_date date,
    is_closed boolean DEFAULT false NOT NULL,
    is_warranty boolean DEFAULT false NOT NULL,
    warranty_card_no text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job OWNER TO webadmin;

--
-- Name: job_delivery_manner; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_delivery_manner (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    display_order smallint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_delivery_manner OWNER TO webadmin;

--
-- Name: job_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_invoice; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_invoice (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    company_id smallint NOT NULL,
    invoice_no text NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    supply_state_code character(2) NOT NULL,
    taxable_amount numeric(14,2) NOT NULL,
    cgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_invoice OWNER TO webadmin;

--
-- Name: job_invoice_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_invoice_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_invoice_line; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_invoice_line (
    id bigint NOT NULL,
    job_invoice_id bigint NOT NULL,
    description text NOT NULL,
    hsn_code text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    taxable_amount numeric(12,2) NOT NULL,
    cgst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    sgst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    igst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    cgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_invoice_line_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT job_invoice_line_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE demo1.job_invoice_line OWNER TO webadmin;

--
-- Name: job_invoice_line_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_invoice_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_part_used; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_part_used (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    part_code text NOT NULL,
    brand_id bigint NOT NULL,
    quantity numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_part_used_quantity_check CHECK ((quantity > (0)::numeric))
);


ALTER TABLE demo1.job_part_used OWNER TO webadmin;

--
-- Name: job_part_used_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_part_used ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_part_used_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_payment; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_payment (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    payment_date date NOT NULL,
    payment_mode text NOT NULL,
    amount numeric(14,2) NOT NULL,
    reference_no text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_payment_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE demo1.job_payment OWNER TO webadmin;

--
-- Name: job_payment_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_payment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_payment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_receive_condition; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_receive_condition (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    display_order smallint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_receive_condition OWNER TO webadmin;

--
-- Name: job_receive_manner; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_receive_manner (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_receive_manner OWNER TO webadmin;

--
-- Name: job_status; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_status (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    display_order smallint NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_status_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
);


ALTER TABLE demo1.job_status OWNER TO webadmin;

--
-- Name: job_transaction; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_transaction (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    status_id smallint,
    technician_id bigint,
    amount numeric(12,2),
    notes text,
    performed_by_user_id bigint NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_transaction OWNER TO webadmin;

--
-- Name: job_transaction_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_transaction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_type; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_type (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    display_order smallint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.job_type OWNER TO webadmin;

--
-- Name: product; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.product (
    id bigint NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_name_check CHECK ((name ~ '^[A-Z_]+$'::text))
);


ALTER TABLE demo1.product OWNER TO webadmin;

--
-- Name: product_brand_model; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.product_brand_model (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    brand_id bigint NOT NULL,
    model_name text NOT NULL,
    launch_year integer,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.product_brand_model OWNER TO webadmin;

--
-- Name: product_brand_model_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.product_brand_model ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.product_brand_model_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.product ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purchase_invoice; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.purchase_invoice (
    id bigint NOT NULL,
    supplier_id bigint NOT NULL,
    invoice_no text NOT NULL,
    invoice_date date NOT NULL,
    supplier_state_code character(2) NOT NULL,
    taxable_amount numeric(14,2) NOT NULL,
    cgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    branch_id bigint NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.purchase_invoice OWNER TO webadmin;

--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.purchase_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.purchase_invoice_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purchase_invoice_line; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.purchase_invoice_line (
    id bigint NOT NULL,
    purchase_invoice_id bigint NOT NULL,
    part_code text NOT NULL,
    brand_id bigint NOT NULL,
    hsn_code text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    taxable_amount numeric(12,2) NOT NULL,
    cgst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    sgst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    igst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    cgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_invoice_line_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT purchase_invoice_line_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE demo1.purchase_invoice_line OWNER TO webadmin;

--
-- Name: purchase_invoice_line_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.purchase_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.purchase_invoice_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales_invoice; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.sales_invoice (
    id bigint NOT NULL,
    invoice_no text NOT NULL,
    invoice_date date NOT NULL,
    company_id bigint NOT NULL,
    customer_contact_id bigint,
    customer_name text NOT NULL,
    customer_gstin text,
    customer_state_code character(2) NOT NULL,
    taxable_amount numeric(14,2) NOT NULL,
    cgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    branch_id bigint NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.sales_invoice OWNER TO webadmin;

--
-- Name: sales_invoice_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.sales_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.sales_invoice_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sales_invoice_line; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.sales_invoice_line (
    id bigint NOT NULL,
    sales_invoice_id bigint NOT NULL,
    part_code text NOT NULL,
    item_description text NOT NULL,
    hsn_code text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    taxable_amount numeric(12,2) NOT NULL,
    cgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_invoice_line_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT sales_invoice_line_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE demo1.sales_invoice_line OWNER TO webadmin;

--
-- Name: sales_invoice_line_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.sales_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.sales_invoice_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: spare_part_casio; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.spare_part_casio (
    id bigint NOT NULL,
    part_code text NOT NULL,
    part_name text NOT NULL,
    part_description text,
    category text,
    model text,
    uom text DEFAULT 'NOS'::text NOT NULL,
    cost_price numeric(12,2),
    mrp numeric(12,2),
    hsn_code text,
    gst_rate numeric(5,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.spare_part_casio OWNER TO webadmin;

--
-- Name: spare_part_nikon; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.spare_part_nikon (
    id bigint NOT NULL,
    part_code text NOT NULL,
    part_name text NOT NULL,
    part_description text,
    category text,
    model text,
    uom text DEFAULT 'NOS'::text NOT NULL,
    cost_price numeric(12,2),
    mrp numeric(12,2),
    hsn_code text,
    gst_rate numeric(5,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.spare_part_nikon OWNER TO webadmin;

--
-- Name: spare_part_sony; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.spare_part_sony (
    id bigint NOT NULL,
    part_code text NOT NULL,
    part_name text NOT NULL,
    part_description text,
    category text,
    model text,
    uom text DEFAULT 'NOS'::text NOT NULL,
    cost_price numeric(12,2),
    mrp numeric(12,2),
    hsn_code text,
    gst_rate numeric(5,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.spare_part_sony OWNER TO webadmin;

--
-- Name: spare_part; Type: VIEW; Schema: demo1; Owner: webadmin
--

CREATE VIEW demo1.spare_part AS
 SELECT 'SONY'::text AS brand_code,
    spare_part_sony.id,
    spare_part_sony.part_code,
    spare_part_sony.part_name,
    spare_part_sony.part_description,
    spare_part_sony.category,
    spare_part_sony.model,
    spare_part_sony.uom,
    spare_part_sony.cost_price,
    spare_part_sony.mrp,
    spare_part_sony.hsn_code,
    spare_part_sony.gst_rate,
    spare_part_sony.is_active,
    spare_part_sony.created_at,
    spare_part_sony.updated_at
   FROM demo1.spare_part_sony
UNION ALL
 SELECT 'CASIO'::text AS brand_code,
    spare_part_casio.id,
    spare_part_casio.part_code,
    spare_part_casio.part_name,
    spare_part_casio.part_description,
    spare_part_casio.category,
    spare_part_casio.model,
    spare_part_casio.uom,
    spare_part_casio.cost_price,
    spare_part_casio.mrp,
    spare_part_casio.hsn_code,
    spare_part_casio.gst_rate,
    spare_part_casio.is_active,
    spare_part_casio.created_at,
    spare_part_casio.updated_at
   FROM demo1.spare_part_casio
UNION ALL
 SELECT 'NIKON'::text AS brand_code,
    spare_part_nikon.id,
    spare_part_nikon.part_code,
    spare_part_nikon.part_name,
    spare_part_nikon.part_description,
    spare_part_nikon.category,
    spare_part_nikon.model,
    spare_part_nikon.uom,
    spare_part_nikon.cost_price,
    spare_part_nikon.mrp,
    spare_part_nikon.hsn_code,
    spare_part_nikon.gst_rate,
    spare_part_nikon.is_active,
    spare_part_nikon.created_at,
    spare_part_nikon.updated_at
   FROM demo1.spare_part_nikon;


ALTER VIEW demo1.spare_part OWNER TO webadmin;

--
-- Name: spare_part_casio_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.spare_part_casio ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.spare_part_casio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: spare_part_nikon_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.spare_part_nikon ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.spare_part_nikon_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: spare_part_sony_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.spare_part_sony ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.spare_part_sony_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_transaction; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.stock_transaction (
    id bigint NOT NULL,
    part_code text NOT NULL,
    branch_id bigint NOT NULL,
    brand_id bigint NOT NULL,
    stock_transaction_type_id smallint NOT NULL,
    transaction_date date NOT NULL,
    dr_cr character(1) NOT NULL,
    qty numeric(12,3) NOT NULL,
    unit_cost numeric(12,2),
    source_table text NOT NULL,
    source_id bigint NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_transaction_dr_cr_check CHECK ((dr_cr = ANY (ARRAY['D'::bpchar, 'C'::bpchar]))),
    CONSTRAINT stock_transaction_qty_check CHECK ((qty > (0)::numeric))
);


ALTER TABLE demo1.stock_transaction OWNER TO webadmin;

--
-- Name: spare_part_stock_summary; Type: VIEW; Schema: demo1; Owner: webadmin
--

CREATE VIEW demo1.spare_part_stock_summary AS
 SELECT stock_transaction.part_code,
    stock_transaction.brand_id,
    stock_transaction.branch_id,
    sum(
        CASE
            WHEN (stock_transaction.dr_cr = 'D'::bpchar) THEN stock_transaction.qty
            WHEN (stock_transaction.dr_cr = 'C'::bpchar) THEN (- stock_transaction.qty)
            ELSE (0)::numeric
        END) AS current_stock
   FROM demo1.stock_transaction
  GROUP BY stock_transaction.part_code, stock_transaction.brand_id, stock_transaction.branch_id;


ALTER VIEW demo1.spare_part_stock_summary OWNER TO webadmin;

--
-- Name: state; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.state (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    country_code text DEFAULT 'IN'::text NOT NULL,
    gst_state_code character(2),
    is_union_territory boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT state_code_check CHECK ((code ~ '^[A-Z]{2}$'::text))
);


ALTER TABLE demo1.state OWNER TO webadmin;

--
-- Name: state_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.state ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.state_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_adjustment; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.stock_adjustment (
    id bigint NOT NULL,
    adjustment_date date NOT NULL,
    adjustment_reason text NOT NULL,
    ref_no text,
    branch_id bigint NOT NULL,
    remarks text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.stock_adjustment OWNER TO webadmin;

--
-- Name: COLUMN stock_adjustment.created_by; Type: COMMENT; Schema: demo1; Owner: webadmin
--

COMMENT ON COLUMN demo1.stock_adjustment.created_by IS 'Loosely coupled to user table - no FK constraint';


--
-- Name: stock_adjustment_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.stock_adjustment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.stock_adjustment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_adjustment_line; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.stock_adjustment_line (
    id bigint NOT NULL,
    stock_adjustment_id bigint NOT NULL,
    part_code text NOT NULL,
    brand_id bigint NOT NULL,
    dr_cr character(1) NOT NULL,
    qty numeric(12,3) NOT NULL,
    unit_cost numeric(12,2),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_adjustment_line_dr_cr_check CHECK ((dr_cr = ANY (ARRAY['D'::bpchar, 'C'::bpchar]))),
    CONSTRAINT stock_adjustment_line_qty_check CHECK ((qty > (0)::numeric))
);


ALTER TABLE demo1.stock_adjustment_line OWNER TO webadmin;

--
-- Name: stock_adjustment_line_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.stock_adjustment_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.stock_adjustment_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_transaction_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.stock_transaction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.stock_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_transaction_type; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.stock_transaction_type (
    id smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    dr_cr character(1) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT stock_transaction_type_dr_cr_check CHECK ((dr_cr = ANY (ARRAY['D'::bpchar, 'C'::bpchar])))
);


ALTER TABLE demo1.stock_transaction_type OWNER TO webadmin;

--
-- Name: supplier; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.supplier (
    id bigint NOT NULL,
    name text NOT NULL,
    gstin text,
    pan text,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    state_id smallint NOT NULL,
    pincode text,
    is_active boolean DEFAULT true NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE demo1.supplier OWNER TO webadmin;

--
-- Name: supplier_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.supplier ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.supplier_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: technician; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.technician (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    specialization text,
    leaving_date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_code_check CHECK ((code ~ '^[A-Z0-9_]+$'::text))
);


ALTER TABLE demo1.technician OWNER TO webadmin;

--
-- Name: technician_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.technician ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.technician_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_setting app_setting_key_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.app_setting
    ADD CONSTRAINT app_setting_key_uidx UNIQUE (setting_key);


--
-- Name: app_setting app_setting_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.app_setting
    ADD CONSTRAINT app_setting_pkey PRIMARY KEY (id);


--
-- Name: branch branch_bu_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.branch
    ADD CONSTRAINT branch_bu_code_uidx UNIQUE (bu_id, code);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);


--
-- Name: brand brand_code_key; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.brand
    ADD CONSTRAINT brand_code_key UNIQUE (code);


--
-- Name: brand brand_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.brand
    ADD CONSTRAINT brand_pkey PRIMARY KEY (id);


--
-- Name: company_info company_info_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.company_info
    ADD CONSTRAINT company_info_pkey PRIMARY KEY (id);


--
-- Name: customer_contact customer_contact_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.customer_contact
    ADD CONSTRAINT customer_contact_pkey PRIMARY KEY (id);


--
-- Name: customer_type customer_type_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.customer_type
    ADD CONSTRAINT customer_type_code_uidx UNIQUE (code);


--
-- Name: customer_type customer_type_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.customer_type
    ADD CONSTRAINT customer_type_pkey PRIMARY KEY (id);


--
-- Name: document_sequence document_sequence_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_sequence
    ADD CONSTRAINT document_sequence_pkey PRIMARY KEY (id);


--
-- Name: document_sequence document_sequence_unique; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_sequence
    ADD CONSTRAINT document_sequence_unique UNIQUE (document_type_id, branch_id);


--
-- Name: document_type document_type_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_type
    ADD CONSTRAINT document_type_code_uidx UNIQUE (code);


--
-- Name: document_type document_type_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_type
    ADD CONSTRAINT document_type_pkey PRIMARY KEY (id);


--
-- Name: financial_year financial_year_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.financial_year
    ADD CONSTRAINT financial_year_pkey PRIMARY KEY (id);


--
-- Name: job job_branch_job_no_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_branch_job_no_uidx UNIQUE (branch_id, job_no);


--
-- Name: job_delivery_manner job_delivery_manner_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_delivery_manner
    ADD CONSTRAINT job_delivery_manner_code_uidx UNIQUE (code);


--
-- Name: job_delivery_manner job_delivery_manner_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_delivery_manner
    ADD CONSTRAINT job_delivery_manner_pkey PRIMARY KEY (id);


--
-- Name: job_invoice job_invoice_company_no_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice
    ADD CONSTRAINT job_invoice_company_no_uidx UNIQUE (company_id, invoice_no);


--
-- Name: job_invoice_line job_invoice_line_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice_line
    ADD CONSTRAINT job_invoice_line_pkey PRIMARY KEY (id);


--
-- Name: job_invoice job_invoice_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice
    ADD CONSTRAINT job_invoice_pkey PRIMARY KEY (id);


--
-- Name: job job_no_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_no_uidx UNIQUE (job_no);


--
-- Name: job_part_used job_part_used_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_part_used
    ADD CONSTRAINT job_part_used_pkey PRIMARY KEY (id);


--
-- Name: job_payment job_payment_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_payment
    ADD CONSTRAINT job_payment_pkey PRIMARY KEY (id);


--
-- Name: job job_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_pkey PRIMARY KEY (id);


--
-- Name: job_receive_condition job_receive_condition_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_receive_condition
    ADD CONSTRAINT job_receive_condition_code_uidx UNIQUE (code);


--
-- Name: job_receive_condition job_receive_condition_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_receive_condition
    ADD CONSTRAINT job_receive_condition_pkey PRIMARY KEY (id);


--
-- Name: job_receive_manner job_receive_manner_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_receive_manner
    ADD CONSTRAINT job_receive_manner_code_uidx UNIQUE (code);


--
-- Name: job_receive_manner job_receive_manner_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_receive_manner
    ADD CONSTRAINT job_receive_manner_pkey PRIMARY KEY (id);


--
-- Name: job_status job_status_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_status
    ADD CONSTRAINT job_status_code_uidx UNIQUE (code);


--
-- Name: job_status job_status_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_status
    ADD CONSTRAINT job_status_pkey PRIMARY KEY (id);


--
-- Name: job_transaction job_transaction_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_transaction
    ADD CONSTRAINT job_transaction_pkey PRIMARY KEY (id);


--
-- Name: job_type job_type_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_type
    ADD CONSTRAINT job_type_code_uidx UNIQUE (code);


--
-- Name: job_type job_type_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_type
    ADD CONSTRAINT job_type_pkey PRIMARY KEY (id);


--
-- Name: product_brand_model pbm_unique_model; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product_brand_model
    ADD CONSTRAINT pbm_unique_model UNIQUE (product_id, brand_id, model_name);


--
-- Name: product_brand_model product_brand_model_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product_brand_model
    ADD CONSTRAINT product_brand_model_pkey PRIMARY KEY (id);


--
-- Name: product product_name_key; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product
    ADD CONSTRAINT product_name_key UNIQUE (name);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice_line purchase_invoice_line_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice_line
    ADD CONSTRAINT purchase_invoice_line_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice purchase_invoice_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice
    ADD CONSTRAINT purchase_invoice_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice purchase_invoice_supplier_no_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice
    ADD CONSTRAINT purchase_invoice_supplier_no_uidx UNIQUE (supplier_id, invoice_no);


--
-- Name: sales_invoice sales_invoice_company_no_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_company_no_uidx UNIQUE (company_id, invoice_no);


--
-- Name: sales_invoice_line sales_invoice_line_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice_line
    ADD CONSTRAINT sales_invoice_line_pkey PRIMARY KEY (id);


--
-- Name: sales_invoice sales_invoice_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_pkey PRIMARY KEY (id);


--
-- Name: spare_part_casio spare_part_casio_part_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_casio
    ADD CONSTRAINT spare_part_casio_part_code_uidx UNIQUE (part_code);


--
-- Name: spare_part_casio spare_part_casio_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_casio
    ADD CONSTRAINT spare_part_casio_pkey PRIMARY KEY (id);


--
-- Name: spare_part_nikon spare_part_nikon_part_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_nikon
    ADD CONSTRAINT spare_part_nikon_part_code_uidx UNIQUE (part_code);


--
-- Name: spare_part_nikon spare_part_nikon_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_nikon
    ADD CONSTRAINT spare_part_nikon_pkey PRIMARY KEY (id);


--
-- Name: spare_part_sony spare_part_sony_part_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_sony
    ADD CONSTRAINT spare_part_sony_part_code_uidx UNIQUE (part_code);


--
-- Name: spare_part_sony spare_part_sony_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_sony
    ADD CONSTRAINT spare_part_sony_pkey PRIMARY KEY (id);


--
-- Name: state state_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.state
    ADD CONSTRAINT state_code_uidx UNIQUE (code);


--
-- Name: state state_name_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.state
    ADD CONSTRAINT state_name_uidx UNIQUE (name);


--
-- Name: state state_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.state
    ADD CONSTRAINT state_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustment_line stock_adjustment_line_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment_line
    ADD CONSTRAINT stock_adjustment_line_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustment stock_adjustment_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment
    ADD CONSTRAINT stock_adjustment_pkey PRIMARY KEY (id);


--
-- Name: stock_transaction stock_transaction_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_pkey PRIMARY KEY (id);


--
-- Name: stock_transaction_type stock_transaction_type_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction_type
    ADD CONSTRAINT stock_transaction_type_code_uidx UNIQUE (code);


--
-- Name: stock_transaction_type stock_transaction_type_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction_type
    ADD CONSTRAINT stock_transaction_type_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_name_key; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.supplier
    ADD CONSTRAINT supplier_name_key UNIQUE (name);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: technician technician_bu_code_uidx; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.technician
    ADD CONSTRAINT technician_bu_code_uidx UNIQUE (branch_id, code);


--
-- Name: technician technician_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.technician
    ADD CONSTRAINT technician_pkey PRIMARY KEY (id);


--
-- Name: branch_state_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX branch_state_idx ON demo1.branch USING btree (state_id);


--
-- Name: idx_customer_contact_mobile; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_customer_contact_mobile ON demo1.customer_contact USING btree (mobile);


--
-- Name: idx_job_delivery_date; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_delivery_date ON demo1.job USING btree (delivery_date);


--
-- Name: idx_job_invoice_job; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_invoice_job ON demo1.job_invoice USING btree (job_id);


--
-- Name: idx_job_invoice_line_invoice; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_invoice_line_invoice ON demo1.job_invoice_line USING btree (job_invoice_id);


--
-- Name: idx_job_part_used_job; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_part_used_job ON demo1.job_part_used USING btree (job_id);


--
-- Name: idx_job_part_used_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_part_used_part ON demo1.job_part_used USING btree (part_code);


--
-- Name: idx_job_payment_date; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_payment_date ON demo1.job_payment USING btree (payment_date);


--
-- Name: idx_job_payment_job; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_payment_job ON demo1.job_payment USING btree (job_id);


--
-- Name: idx_job_transaction_job_id; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_transaction_job_id ON demo1.job_transaction USING btree (job_id);


--
-- Name: idx_job_transaction_performed_at; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_transaction_performed_at ON demo1.job_transaction USING btree (performed_at);


--
-- Name: idx_job_transaction_status; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_transaction_status ON demo1.job_transaction USING btree (status_id);


--
-- Name: idx_purchase_invoice_line_spare_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_purchase_invoice_line_spare_part ON demo1.purchase_invoice_line USING btree (part_code);


--
-- Name: idx_purchase_invoice_supplier; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_purchase_invoice_supplier ON demo1.purchase_invoice USING btree (supplier_id);


--
-- Name: idx_sales_invoice_customer; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sales_invoice_customer ON demo1.sales_invoice USING btree (customer_contact_id);


--
-- Name: idx_sales_invoice_line_spare_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sales_invoice_line_spare_part ON demo1.sales_invoice_line USING btree (part_code);


--
-- Name: idx_sp_casio_model; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_casio_model ON demo1.spare_part_casio USING btree (model);


--
-- Name: idx_sp_casio_name; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_casio_name ON demo1.spare_part_casio USING btree (part_name);


--
-- Name: idx_sp_nikon_model; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_nikon_model ON demo1.spare_part_nikon USING btree (model);


--
-- Name: idx_sp_nikon_name; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_nikon_name ON demo1.spare_part_nikon USING btree (part_name);


--
-- Name: idx_sp_sony_model; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_sony_model ON demo1.spare_part_sony USING btree (model);


--
-- Name: idx_sp_sony_name; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_sp_sony_name ON demo1.spare_part_sony USING btree (part_name);


--
-- Name: idx_stock_adj_date; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_adj_date ON demo1.stock_adjustment USING btree (adjustment_date);


--
-- Name: idx_stock_adj_line_adj_id; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_adj_line_adj_id ON demo1.stock_adjustment_line USING btree (stock_adjustment_id);


--
-- Name: idx_stock_adj_line_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_adj_line_part ON demo1.stock_adjustment_line USING btree (part_code);


--
-- Name: idx_stock_tx_date; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_date ON demo1.stock_transaction USING btree (transaction_date);


--
-- Name: idx_stock_tx_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_part ON demo1.stock_transaction USING btree (part_code);


--
-- Name: idx_stock_tx_source; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_source ON demo1.stock_transaction USING btree (source_table, source_id);


--
-- Name: idx_stock_tx_type; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_type ON demo1.stock_transaction USING btree (stock_transaction_type_id);


--
-- Name: job_branch_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX job_branch_idx ON demo1.job USING btree (branch_id);


--
-- Name: job_customer_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX job_customer_idx ON demo1.job USING btree (customer_contact_id);


--
-- Name: job_job_date_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX job_job_date_idx ON demo1.job USING btree (job_date);


--
-- Name: job_status_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX job_status_idx ON demo1.job USING btree (job_status_id);


--
-- Name: job_technician_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX job_technician_idx ON demo1.job USING btree (technician_id);


--
-- Name: technician_phone_idx; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX technician_phone_idx ON demo1.technician USING btree (phone);


--
-- Name: branch branch_state_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.branch
    ADD CONSTRAINT branch_state_fk FOREIGN KEY (state_id) REFERENCES demo1.state(id) ON DELETE RESTRICT;


--
-- Name: company_info company_info_state_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.company_info
    ADD CONSTRAINT company_info_state_fk FOREIGN KEY (state_id) REFERENCES demo1.state(id) ON DELETE RESTRICT;


--
-- Name: customer_contact customer_contact_state_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.customer_contact
    ADD CONSTRAINT customer_contact_state_fk FOREIGN KEY (state_id) REFERENCES demo1.state(id) ON DELETE RESTRICT;


--
-- Name: customer_contact customer_contact_type_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.customer_contact
    ADD CONSTRAINT customer_contact_type_fk FOREIGN KEY (customer_type_id) REFERENCES demo1.customer_type(id) ON DELETE RESTRICT;


--
-- Name: document_sequence document_sequence_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_sequence
    ADD CONSTRAINT document_sequence_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: document_sequence document_sequence_type_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.document_sequence
    ADD CONSTRAINT document_sequence_type_fk FOREIGN KEY (document_type_id) REFERENCES demo1.document_type(id) ON DELETE RESTRICT;


--
-- Name: job job_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: job job_customer_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES demo1.customer_contact(id) ON DELETE RESTRICT;


--
-- Name: job_invoice job_invoice_company_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice
    ADD CONSTRAINT job_invoice_company_fk FOREIGN KEY (company_id) REFERENCES demo1.company_info(id) ON DELETE RESTRICT;


--
-- Name: job_invoice job_invoice_job_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice
    ADD CONSTRAINT job_invoice_job_fk FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE RESTRICT;


--
-- Name: job_invoice_line job_invoice_line_invoice_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_invoice_line
    ADD CONSTRAINT job_invoice_line_invoice_fk FOREIGN KEY (job_invoice_id) REFERENCES demo1.job_invoice(id) ON DELETE CASCADE;


--
-- Name: job_part_used job_part_used_brand_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_part_used
    ADD CONSTRAINT job_part_used_brand_fk FOREIGN KEY (brand_id) REFERENCES demo1.brand(id) ON DELETE RESTRICT;


--
-- Name: job_part_used job_part_used_job_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_part_used
    ADD CONSTRAINT job_part_used_job_fk FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE RESTRICT;


--
-- Name: job_payment job_payment_job_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_payment
    ADD CONSTRAINT job_payment_job_fk FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE CASCADE;


--
-- Name: job job_product_brand_model_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_product_brand_model_fk FOREIGN KEY (product_brand_model_id) REFERENCES demo1.product_brand_model(id) ON DELETE RESTRICT;


--
-- Name: job job_receive_condition_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_receive_condition_fk FOREIGN KEY (job_receive_condition_id) REFERENCES demo1.job_receive_condition(id) ON DELETE RESTRICT;


--
-- Name: job job_receive_manner_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_receive_manner_fk FOREIGN KEY (job_receive_manner_id) REFERENCES demo1.job_receive_manner(id) ON DELETE RESTRICT;


--
-- Name: job job_status_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_status_fk FOREIGN KEY (job_status_id) REFERENCES demo1.job_status(id) ON DELETE RESTRICT;


--
-- Name: job job_technician_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_technician_fk FOREIGN KEY (technician_id) REFERENCES demo1.technician(id) ON DELETE RESTRICT;


--
-- Name: job_transaction job_transaction_job_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_transaction
    ADD CONSTRAINT job_transaction_job_fk FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE CASCADE;


--
-- Name: job_transaction job_transaction_status_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_transaction
    ADD CONSTRAINT job_transaction_status_fk FOREIGN KEY (status_id) REFERENCES demo1.job_status(id) ON DELETE RESTRICT;


--
-- Name: job_transaction job_transaction_technician_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_transaction
    ADD CONSTRAINT job_transaction_technician_fk FOREIGN KEY (technician_id) REFERENCES demo1.technician(id) ON DELETE RESTRICT;


--
-- Name: job job_type_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job
    ADD CONSTRAINT job_type_fk FOREIGN KEY (job_type_id) REFERENCES demo1.job_type(id) ON DELETE RESTRICT;


--
-- Name: product_brand_model pbm_brand_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product_brand_model
    ADD CONSTRAINT pbm_brand_fk FOREIGN KEY (brand_id) REFERENCES demo1.brand(id) ON DELETE RESTRICT;


--
-- Name: product_brand_model pbm_product_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.product_brand_model
    ADD CONSTRAINT pbm_product_fk FOREIGN KEY (product_id) REFERENCES demo1.product(id) ON DELETE RESTRICT;


--
-- Name: purchase_invoice purchase_invoice_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice
    ADD CONSTRAINT purchase_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: purchase_invoice_line purchase_invoice_line_brand_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice_line
    ADD CONSTRAINT purchase_invoice_line_brand_fk FOREIGN KEY (brand_id) REFERENCES demo1.brand(id) ON DELETE RESTRICT;


--
-- Name: purchase_invoice_line purchase_invoice_line_invoice_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice_line
    ADD CONSTRAINT purchase_invoice_line_invoice_fk FOREIGN KEY (purchase_invoice_id) REFERENCES demo1.purchase_invoice(id) ON DELETE CASCADE;


--
-- Name: purchase_invoice purchase_invoice_supplier_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice
    ADD CONSTRAINT purchase_invoice_supplier_fk FOREIGN KEY (supplier_id) REFERENCES demo1.supplier(id) ON DELETE RESTRICT;


--
-- Name: sales_invoice sales_invoice_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: sales_invoice sales_invoice_company_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_company_fk FOREIGN KEY (company_id) REFERENCES demo1.company_info(id) ON DELETE RESTRICT;


--
-- Name: sales_invoice sales_invoice_customer_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES demo1.customer_contact(id) ON DELETE RESTRICT;


--
-- Name: sales_invoice_line sales_invoice_line_invoice_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice_line
    ADD CONSTRAINT sales_invoice_line_invoice_fk FOREIGN KEY (sales_invoice_id) REFERENCES demo1.sales_invoice(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment stock_adjustment_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment
    ADD CONSTRAINT stock_adjustment_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: stock_adjustment_line stock_adjustment_line_adjustment_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment_line
    ADD CONSTRAINT stock_adjustment_line_adjustment_fk FOREIGN KEY (stock_adjustment_id) REFERENCES demo1.stock_adjustment(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment_line stock_adjustment_line_brand_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment_line
    ADD CONSTRAINT stock_adjustment_line_brand_fk FOREIGN KEY (brand_id) REFERENCES demo1.brand(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_brand_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_brand_fk FOREIGN KEY (brand_id) REFERENCES demo1.brand(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_type_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_type_fk FOREIGN KEY (stock_transaction_type_id) REFERENCES demo1.stock_transaction_type(id) ON DELETE RESTRICT;


--
-- Name: supplier supplier_state_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.supplier
    ADD CONSTRAINT supplier_state_fk FOREIGN KEY (state_id) REFERENCES demo1.state(id) ON DELETE RESTRICT;


--
-- Name: technician technician_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.technician
    ADD CONSTRAINT technician_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict X6eFCJQR2CpXT6f47GxD4sUKfmID3JX6muMzFfg3A1kDL0xKPNTSNfgSevfBvvF

