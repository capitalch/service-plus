--
-- PostgreSQL database dump
--

\restrict kcWNVQBdc1N4hGs4idlpEjFPj2LRlzaPSt0Tk9lvYdsuEt7aZ9zaydt7fk9lGCh

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address_snapshot text,
    last_transaction_id bigint,
    is_final boolean DEFAULT false NOT NULL
);


ALTER TABLE demo1.job OWNER TO webadmin;

--
-- Name: job_additional_charge; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.job_additional_charge (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    charge_name text NOT NULL,
    ref_no text,
    description text,
    cost_price numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_add_charge_cost_check CHECK ((cost_price >= (0)::numeric)),
    CONSTRAINT job_add_charge_sell_check CHECK ((selling_price >= (0)::numeric))
);


ALTER TABLE demo1.job_additional_charge OWNER TO webadmin;

--
-- Name: job_additional_charge_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.job_additional_charge ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.job_additional_charge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
    part_code text,
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
    part_id bigint NOT NULL,
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
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_transaction_id bigint
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
    part_id bigint NOT NULL,
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
    part_id bigint NOT NULL,
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
-- Name: spare_part_master; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.spare_part_master (
    id bigint NOT NULL,
    brand_id bigint NOT NULL,
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE demo1.spare_part_master OWNER TO webadmin;

--
-- Name: spare_part_id_seq; Type: SEQUENCE; Schema: demo1; Owner: webadmin
--

ALTER TABLE demo1.spare_part_master ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.spare_part_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
    part_id bigint NOT NULL,
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
-- Name: stock_transaction; Type: TABLE; Schema: demo1; Owner: webadmin
--

CREATE TABLE demo1.stock_transaction (
    id bigint NOT NULL,
    part_id bigint NOT NULL,
    branch_id bigint NOT NULL,
    stock_transaction_type_id smallint NOT NULL,
    transaction_date date NOT NULL,
    dr_cr character(1) NOT NULL,
    qty numeric(12,3) NOT NULL,
    unit_cost numeric(12,2),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_line_id bigint,
    sales_line_id bigint,
    adjustment_line_id bigint,
    job_part_used_id bigint,
    CONSTRAINT check_one_source_line_only CHECK (((((((purchase_line_id IS NOT NULL))::integer + ((sales_line_id IS NOT NULL))::integer) + ((adjustment_line_id IS NOT NULL))::integer) + ((job_part_used_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT stock_transaction_dr_cr_check CHECK ((dr_cr = ANY (ARRAY['D'::bpchar, 'C'::bpchar]))),
    CONSTRAINT stock_transaction_qty_check CHECK ((qty > (0)::numeric))
);


ALTER TABLE demo1.stock_transaction OWNER TO webadmin;

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
    full_name text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL
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
-- Data for Name: app_setting; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.app_setting (id, setting_key, setting_type, setting_value, description, is_editable, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: branch; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.branch (id, bu_id, code, name, phone, email, address_line1, address_line2, state_id, city, pincode, gstin, is_active, is_head_office, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: brand; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.brand (id, code, name, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: company_info; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.company_info (id, company_name, address_line1, address_line2, city, state_id, country, pincode, phone, email, gstin, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_contact; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.customer_contact (id, customer_type_id, full_name, gstin, mobile, alternate_mobile, email, address_line1, address_line2, landmark, state_id, city, postal_code, remarks, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_type; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.customer_type (id, code, name, description, is_active, display_order) FROM stdin;
1	INDIVIDUAL	Individual Customer	\N	t	1
2	SERVICE_PARTNER	Service Partner	\N	t	2
3	DEALER	Dealer	\N	t	3
4	CORPORATE	Corporate / Institutional	\N	t	4
5	OTHER	Other	\N	t	99
\.


--
-- Data for Name: document_sequence; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.document_sequence (id, document_type_id, branch_id, prefix, next_number, padding, separator, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: document_type; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.document_type (id, code, prefix, name, description) FROM stdin;
1	JOB	JOB	Job Card	Service job card
2	RECEIPT	RCPT	Receipt	Payment receipt
3	SALE_INVOICE	SI	Sale Invoice	Spare part / product sale invoice
4	JOB_INVOICE	JI	Job Invoice	Service job invoice
5	PURCHASE	PI	Purchase Invoice	Purchase invoice from supplier
\.


--
-- Data for Name: financial_year; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.financial_year (id, start_date, end_date) FROM stdin;
\.


--
-- Data for Name: job; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job (id, job_no, job_date, customer_contact_id, branch_id, technician_id, job_status_id, job_type_id, job_receive_manner_id, job_receive_condition_id, product_brand_model_id, serial_no, problem_reported, diagnosis, work_done, remarks, amount, delivery_date, is_closed, is_warranty, warranty_card_no, is_active, created_at, updated_at, address_snapshot, last_transaction_id, is_final) FROM stdin;
\.


--
-- Data for Name: job_additional_charge; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_additional_charge (id, job_id, charge_name, ref_no, description, cost_price, selling_price, created_at) FROM stdin;
\.


--
-- Data for Name: job_delivery_manner; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_delivery_manner (id, code, name, display_order, is_active, created_at, updated_at) FROM stdin;
1	CUSTOMER_PICKUP	Customer Pickup	1	t	2026-02-11 19:24:25.648502+00	2026-02-11 19:24:25.648502+00
2	COURIER	Courier	2	t	2026-02-11 19:24:25.648502+00	2026-02-11 19:24:25.648502+00
3	THIRD_PARTY_PICKUP	Third Party Pickup	3	t	2026-02-11 19:24:25.648502+00	2026-02-11 19:24:25.648502+00
\.


--
-- Data for Name: job_invoice; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_invoice (id, job_id, company_id, invoice_no, invoice_date, supply_state_code, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_invoice_line; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_invoice_line (id, job_invoice_id, description, part_code, hsn_code, quantity, unit_price, taxable_amount, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_part_used; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_part_used (id, job_id, part_id, quantity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_payment; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_payment (id, job_id, payment_date, payment_mode, amount, reference_no, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_receive_condition; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_receive_condition (id, code, name, description, display_order, is_active, created_at, updated_at) FROM stdin;
1	DEAD	Dead / Not Powering On	\N	1	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
2	DAMAGED	Damaged	\N	2	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
3	PHYSICALLY_BROKEN	Physically Broken	\N	3	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
4	WATER_LOGGED	Water Logged	\N	4	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
5	PARTIALLY_WORKING	Partially Working	\N	5	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
6	DISCOLORED	Discolored	\N	6	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
7	LCD_DAMAGE	LCD Damage	\N	7	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
8	UNKNOWN	Unknown	\N	99	t	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
\.


--
-- Data for Name: job_receive_manner; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_receive_manner (id, code, name, is_system, is_active, display_order, created_at, updated_at) FROM stdin;
1	WALK_IN	Walk-in	t	t	1	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
2	COURIER	Courier	t	t	2	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
3	PICKUP	Pickup	t	t	3	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
4	ONLINE_BOOKING	Online Booking	t	t	4	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
5	PHONE_BOOKING	Phone Booking	t	t	5	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
6	MISC	Miscellaneous	t	t	99	2026-02-11 19:23:27.408069+00	2026-02-11 19:23:27.408069+00
\.


--
-- Data for Name: job_status; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_status (id, code, name, description, display_order, is_initial, is_final, is_active, is_system, created_at, updated_at) FROM stdin;
1	NEW	New	New job registered	1	t	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
2	ESTIMATED	Estimated	Repair estimate prepared	2	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
3	APPROVED	Approved	Customer approved the estimate	3	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
4	NOT_APPROVED	Not Approved	Customer did not approve estimate	4	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
5	WAITING_FOR_PARTS	Waiting for Parts	Waiting for spare parts	5	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
6	TECHNICIAN_ASSIGNED	Technician Assigned	Technician assigned to job	6	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
7	CANCELLED	Cancelled	Job cancelled	7	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
8	MARKED_FOR_DISPOSAL	Marked for Disposal	Item marked for disposal	8	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
9	DISPOSED	Disposed	Item disposed	9	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
10	SENT_TO_COMPANY	Sent to Company	Item sent to company for repair	10	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
11	RECEIVED_FROM_COMPANY_READY	Received from Company (Ready)	Received back from company - repaired	11	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
12	RECEIVED_FROM_COMPANY_RETURN	Received from Company (Return)	Received back from company - unrepaired	12	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
13	READY_FOR_DELIVERY	Ready for Delivery	Repair done, ready to deliver	13	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
14	RETURN_FOR_DELIVERY	Return for Delivery	Unrepaired, ready to return	14	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
15	DELIVERED	Delivered	Item delivered to customer	15	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
16	DEMO_COMPLETED	Demo Completed	Product demo completed	16	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
17	HOME_SERVICE_ATTENDED	Home Service Attended	Technician visited customer	17	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
18	HOME_SERVICE_COMPLETED	Home Service Completed	Home service work completed	18	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
19	INSTALLATION_REQUESTED	Installation Requested	Installation requested by customer	19	f	f	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
20	INSTALLATION_COMPLETED	Installation Completed	Installation completed	20	f	t	t	t	2026-02-11 19:23:53.817091+00	2026-02-11 19:23:53.817091+00
\.


--
-- Data for Name: job_transaction; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_transaction (id, job_id, status_id, technician_id, amount, notes, performed_by_user_id, performed_at, previous_transaction_id) FROM stdin;
\.


--
-- Data for Name: job_type; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.job_type (id, code, name, description, display_order, is_active, created_at, updated_at) FROM stdin;
1	WORKSHOP_GENERAL_REPAIR	Workshop - General Repair	\N	1	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
2	WORKSHOP_WARRANTY_REPAIR	Workshop - Warranty Repair	\N	2	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
3	WORKSHOP_ESTIMATE	Workshop - Estimate	\N	3	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
4	WORKSHOP_REPLACEMENT	Workshop - Replacement	\N	4	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
5	WORKSHOP_REPEAT_REPAIR	Workshop - Repeat Repair	\N	5	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
6	HOME_SERVICE_GENERAL_REPAIR	Home Service - General Repair	\N	6	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
7	HOME_SERVICE_WARRANTY_REPAIR	Home Service - Warranty Repair	\N	7	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
8	DEMO	Demo	\N	8	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
9	SERVICE_CONTRACT	Service Contract	\N	9	t	2026-02-11 19:22:41.958914+00	2026-02-11 19:22:41.958914+00
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.product (id, name, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_brand_model; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.product_brand_model (id, product_id, brand_id, model_name, launch_year, remarks, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_invoice; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.purchase_invoice (id, supplier_id, invoice_no, invoice_date, supplier_state_code, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount, branch_id, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_invoice_line; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.purchase_invoice_line (id, purchase_invoice_id, part_id, hsn_code, quantity, unit_price, taxable_amount, cgst_rate, sgst_rate, igst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sales_invoice; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.sales_invoice (id, invoice_no, invoice_date, company_id, customer_contact_id, customer_name, customer_gstin, customer_state_code, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount, branch_id, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sales_invoice_line; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.sales_invoice_line (id, sales_invoice_id, part_id, item_description, hsn_code, quantity, unit_price, gst_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: spare_part_master; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.spare_part_master (id, brand_id, part_code, part_name, part_description, category, model, uom, cost_price, mrp, hsn_code, gst_rate, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: state; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.state (id, code, name, country_code, gst_state_code, is_union_territory, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_adjustment; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.stock_adjustment (id, adjustment_date, adjustment_reason, ref_no, branch_id, remarks, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_adjustment_line; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.stock_adjustment_line (id, stock_adjustment_id, part_id, dr_cr, qty, unit_cost, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_transaction; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.stock_transaction (id, part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, unit_cost, remarks, created_at, purchase_line_id, sales_line_id, adjustment_line_id, job_part_used_id) FROM stdin;
\.


--
-- Data for Name: stock_transaction_type; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.stock_transaction_type (id, code, name, dr_cr, description, is_active) FROM stdin;
1	OPENING_STOCK	Opening Stock	D	Initial stock entry	t
2	PURCHASE	Purchase	D	Stock received from purchase	t
3	SALE	Sale	C	Stock sold to customer	t
4	JOB_USAGE	Job Usage	C	Stock consumed in service job	t
5	ADJUSTMENT_IN	Adjustment In	D	Stock added via adjustment	t
6	ADJUSTMENT_OUT	Adjustment Out	C	Stock removed via adjustment	t
7	RETURN_FROM_JOB	Return from Job	D	Unused part returned from job	t
8	PURCHASE_RETURN	Purchase Return	C	Stock returned to supplier	t
9	SALES_RETURN	Sales return	D	Sales return from customer	t
\.


--
-- Data for Name: supplier; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.supplier (id, name, gstin, pan, phone, email, address_line1, address_line2, city, state_id, pincode, is_active, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: technician; Type: TABLE DATA; Schema: demo1; Owner: webadmin
--

COPY demo1.technician (id, branch_id, code, name, phone, email, specialization, leaving_date, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: access_right; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security.access_right (id, code, name, module, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bu; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security.bu (id, code, name, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security.role (id, code, name, description, is_system, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role_access_right; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security.role_access_right (role_id, access_right_id) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security."user" (id, username, email, mobile, password_hash, is_active, created_at, updated_at, full_name, is_admin) FROM stdin;
\.


--
-- Data for Name: user_bu_role; Type: TABLE DATA; Schema: security; Owner: webadmin
--

COPY security.user_bu_role (user_id, bu_id, role_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Name: branch_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.branch_id_seq', 1, false);


--
-- Name: brand_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.brand_id_seq', 1, false);


--
-- Name: customer_contact_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.customer_contact_id_seq', 1, false);


--
-- Name: document_sequence_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.document_sequence_id_seq', 1, false);


--
-- Name: job_additional_charge_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_additional_charge_id_seq', 1, false);


--
-- Name: job_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_id_seq', 1, false);


--
-- Name: job_invoice_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_invoice_id_seq', 1, false);


--
-- Name: job_invoice_line_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_invoice_line_id_seq', 1, false);


--
-- Name: job_part_used_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_part_used_id_seq', 1, false);


--
-- Name: job_payment_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_payment_id_seq', 1, false);


--
-- Name: job_transaction_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.job_transaction_id_seq', 1, false);


--
-- Name: product_brand_model_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.product_brand_model_id_seq', 1, false);


--
-- Name: product_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.product_id_seq', 1, false);


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.purchase_invoice_id_seq', 1, false);


--
-- Name: purchase_invoice_line_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.purchase_invoice_line_id_seq', 1, false);


--
-- Name: sales_invoice_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.sales_invoice_id_seq', 1, false);


--
-- Name: sales_invoice_line_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.sales_invoice_line_id_seq', 1, false);


--
-- Name: spare_part_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.spare_part_id_seq', 1, false);


--
-- Name: state_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.state_id_seq', 1, false);


--
-- Name: stock_adjustment_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.stock_adjustment_id_seq', 1, false);


--
-- Name: stock_adjustment_line_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.stock_adjustment_line_id_seq', 1, false);


--
-- Name: stock_transaction_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.stock_transaction_id_seq', 1, false);


--
-- Name: supplier_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.supplier_id_seq', 1, false);


--
-- Name: technician_id_seq; Type: SEQUENCE SET; Schema: demo1; Owner: webadmin
--

SELECT pg_catalog.setval('demo1.technician_id_seq', 1, false);


--
-- Name: access_right_id_seq; Type: SEQUENCE SET; Schema: security; Owner: webadmin
--

SELECT pg_catalog.setval('security.access_right_id_seq', 1, false);


--
-- Name: bu_id_seq; Type: SEQUENCE SET; Schema: security; Owner: webadmin
--

SELECT pg_catalog.setval('security.bu_id_seq', 1, false);


--
-- Name: role_id_seq; Type: SEQUENCE SET; Schema: security; Owner: webadmin
--

SELECT pg_catalog.setval('security.role_id_seq', 1, false);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: security; Owner: webadmin
--

SELECT pg_catalog.setval('security.user_id_seq', 1, false);


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
-- Name: job_additional_charge job_additional_charge_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_additional_charge
    ADD CONSTRAINT job_additional_charge_pkey PRIMARY KEY (id);


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
-- Name: spare_part_master spare_part_code_brand_unique; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_master
    ADD CONSTRAINT spare_part_code_brand_unique UNIQUE (brand_id, part_code);


--
-- Name: spare_part_master spare_part_pkey; Type: CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_master
    ADD CONSTRAINT spare_part_pkey PRIMARY KEY (id);


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
-- Name: idx_job_invoice_line_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_invoice_line_part ON demo1.job_invoice_line USING btree (part_code);


--
-- Name: idx_job_part_used_job; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_part_used_job ON demo1.job_part_used USING btree (job_id);


--
-- Name: idx_job_part_used_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_job_part_used_part ON demo1.job_part_used USING btree (part_id);


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

CREATE INDEX idx_purchase_invoice_line_spare_part ON demo1.purchase_invoice_line USING btree (part_id);


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

CREATE INDEX idx_sales_invoice_line_spare_part ON demo1.sales_invoice_line USING btree (part_id);


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

CREATE INDEX idx_stock_adj_line_part ON demo1.stock_adjustment_line USING btree (part_id);


--
-- Name: idx_stock_tx_date; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_date ON demo1.stock_transaction USING btree (transaction_date);


--
-- Name: idx_stock_tx_part; Type: INDEX; Schema: demo1; Owner: webadmin
--

CREATE INDEX idx_stock_tx_part ON demo1.stock_transaction USING btree (part_id);


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
-- Name: job_additional_charge job_additional_charge_job_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_additional_charge
    ADD CONSTRAINT job_additional_charge_job_id_fkey FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE CASCADE;


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
-- Name: job_part_used job_part_used_job_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_part_used
    ADD CONSTRAINT job_part_used_job_fk FOREIGN KEY (job_id) REFERENCES demo1.job(id) ON DELETE RESTRICT;


--
-- Name: job_part_used job_part_used_part_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.job_part_used
    ADD CONSTRAINT job_part_used_part_fk FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;


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
-- Name: purchase_invoice_line purchase_invoice_line_invoice_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice_line
    ADD CONSTRAINT purchase_invoice_line_invoice_fk FOREIGN KEY (purchase_invoice_id) REFERENCES demo1.purchase_invoice(id) ON DELETE CASCADE;


--
-- Name: purchase_invoice_line purchase_invoice_line_part_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.purchase_invoice_line
    ADD CONSTRAINT purchase_invoice_line_part_fk FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;


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
-- Name: sales_invoice_line sales_invoice_line_part_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.sales_invoice_line
    ADD CONSTRAINT sales_invoice_line_part_fk FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;


--
-- Name: spare_part_master spare_part_brand_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.spare_part_master
    ADD CONSTRAINT spare_part_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES demo1.brand(id);


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
-- Name: stock_adjustment_line stock_adjustment_line_spare_part_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_adjustment_line
    ADD CONSTRAINT stock_adjustment_line_spare_part_fk FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_adjustment_line_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_adjustment_line_id_fkey FOREIGN KEY (adjustment_line_id) REFERENCES demo1.stock_adjustment_line(id);


--
-- Name: stock_transaction stock_transaction_branch_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_job_part_used_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_job_part_used_id_fkey FOREIGN KEY (job_part_used_id) REFERENCES demo1.job_part_used(id);


--
-- Name: stock_transaction stock_transaction_part_id_fk; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_part_id_fk FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;


--
-- Name: stock_transaction stock_transaction_purchase_line_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_purchase_line_id_fkey FOREIGN KEY (purchase_line_id) REFERENCES demo1.purchase_invoice_line(id);


--
-- Name: stock_transaction stock_transaction_sales_line_id_fkey; Type: FK CONSTRAINT; Schema: demo1; Owner: webadmin
--

ALTER TABLE ONLY demo1.stock_transaction
    ADD CONSTRAINT stock_transaction_sales_line_id_fkey FOREIGN KEY (sales_line_id) REFERENCES demo1.sales_invoice_line(id);


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

\unrestrict kcWNVQBdc1N4hGs4idlpEjFPj2LRlzaPSt0Tk9lvYdsuEt7aZ9zaydt7fk9lGCh

