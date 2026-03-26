"""
BU schema DDL and seed SQL for Business Unit creation.

Both constants use unqualified table names (no schema prefix).
exec_sql sets search_path to the BU code at runtime so all statements
execute in the correct schema automatically.
"""


class SqlBu:
    """DDL and seed SQL constants for creating a new Business Unit schema."""

    BU_SCHEMA_DDL = """
        CREATE TABLE app_setting (
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

        CREATE TABLE branch (
            id bigint NOT NULL,
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

        ALTER TABLE branch ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME branch_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE brand (
            id bigint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT brand_code_check CHECK ((code ~ '^[A-Z_]+$'::text))
        );

        ALTER TABLE brand ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME brand_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE company_info (
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

        CREATE TABLE customer_contact (
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

        ALTER TABLE customer_contact ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME customer_contact_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE customer_type (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            description text,
            is_active boolean DEFAULT true NOT NULL,
            display_order smallint,
            is_system boolean NOT NULL
        );

        CREATE TABLE document_sequence (
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

        ALTER TABLE document_sequence ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME document_sequence_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE document_type (
            id smallint NOT NULL,
            code text NOT NULL,
            prefix text NOT NULL,
            name text NOT NULL,
            description text,
            is_system boolean NOT NULL,
            CONSTRAINT document_type_code_chk CHECK ((code ~ '^[A-Z_]+$'::text))
        );

        CREATE TABLE financial_year (
            id integer NOT NULL,
            start_date date NOT NULL,
            end_date date NOT NULL,
            CONSTRAINT financial_year_date_check CHECK ((start_date < end_date))
        );

        CREATE TABLE job (
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

        ALTER TABLE job ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_additional_charge (
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

        ALTER TABLE job_additional_charge ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_additional_charge_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_delivery_manner (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            display_order smallint,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            is_system boolean NOT NULL
        );

        CREATE TABLE job_invoice (
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

        ALTER TABLE job_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_invoice_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_invoice_line (
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

        ALTER TABLE job_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_invoice_line_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_part_used (
            id bigint NOT NULL,
            job_id bigint NOT NULL,
            part_id bigint NOT NULL,
            quantity numeric(10,2) NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT job_part_used_quantity_check CHECK ((quantity > (0)::numeric))
        );

        ALTER TABLE job_part_used ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_part_used_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_payment (
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

        ALTER TABLE job_payment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_payment_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_receive_condition (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            description text,
            display_order smallint,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            is_system boolean NOT NULL
        );

        CREATE TABLE job_receive_manner (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            is_system boolean DEFAULT true NOT NULL,
            is_active boolean DEFAULT true NOT NULL,
            display_order smallint DEFAULT 0 NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE job_status (
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

        CREATE TABLE job_transaction (
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

        ALTER TABLE job_transaction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME job_transaction_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE job_type (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            description text,
            display_order smallint,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            is_system boolean NOT NULL
        );

        CREATE TABLE product (
            id bigint NOT NULL,
            name text NOT NULL,
            is_active boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT product_name_check CHECK ((name ~ '^[A-Z_]+$'::text))
        );

        ALTER TABLE product ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME product_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE product_brand_model (
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

        ALTER TABLE product_brand_model ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME product_brand_model_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE purchase_invoice (
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

        ALTER TABLE purchase_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME purchase_invoice_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE purchase_invoice_line (
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

        ALTER TABLE purchase_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME purchase_invoice_line_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE sales_invoice (
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

        ALTER TABLE sales_invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME sales_invoice_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE sales_invoice_line (
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

        ALTER TABLE sales_invoice_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME sales_invoice_line_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE spare_part_master (
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

        ALTER TABLE spare_part_master ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME spare_part_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE state (
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

        CREATE TABLE stock_adjustment (
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

        ALTER TABLE stock_adjustment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME stock_adjustment_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE stock_adjustment_line (
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

        ALTER TABLE stock_adjustment_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME stock_adjustment_line_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE stock_transaction (
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

        ALTER TABLE stock_transaction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME stock_transaction_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE stock_transaction_type (
            id smallint NOT NULL,
            code text NOT NULL,
            name text NOT NULL,
            dr_cr character(1) NOT NULL,
            description text,
            is_active boolean DEFAULT true NOT NULL,
            is_system boolean NOT NULL,
            CONSTRAINT stock_transaction_type_dr_cr_check CHECK ((dr_cr = ANY (ARRAY['D'::bpchar, 'C'::bpchar])))
        );

        CREATE TABLE supplier (
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

        ALTER TABLE supplier ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME supplier_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        CREATE TABLE technician (
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

        ALTER TABLE technician ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
            SEQUENCE NAME technician_id_seq
            START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1
        );

        -- Primary keys and unique constraints
        ALTER TABLE ONLY app_setting ADD CONSTRAINT app_setting_key_uidx UNIQUE (setting_key);
        ALTER TABLE ONLY app_setting ADD CONSTRAINT app_setting_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY branch ADD CONSTRAINT branch_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY brand ADD CONSTRAINT brand_code_key UNIQUE (code);
        ALTER TABLE ONLY brand ADD CONSTRAINT brand_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY company_info ADD CONSTRAINT company_info_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY customer_contact ADD CONSTRAINT customer_contact_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY customer_type ADD CONSTRAINT customer_type_code_uidx UNIQUE (code);
        ALTER TABLE ONLY customer_type ADD CONSTRAINT customer_type_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY document_sequence ADD CONSTRAINT document_sequence_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY document_sequence ADD CONSTRAINT document_sequence_unique UNIQUE (document_type_id, branch_id);
        ALTER TABLE ONLY document_type ADD CONSTRAINT document_type_code_uidx UNIQUE (code);
        ALTER TABLE ONLY document_type ADD CONSTRAINT document_type_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY financial_year ADD CONSTRAINT financial_year_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_additional_charge ADD CONSTRAINT job_additional_charge_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job ADD CONSTRAINT job_branch_job_no_uidx UNIQUE (branch_id, job_no);
        ALTER TABLE ONLY job_delivery_manner ADD CONSTRAINT job_delivery_manner_code_uidx UNIQUE (code);
        ALTER TABLE ONLY job_delivery_manner ADD CONSTRAINT job_delivery_manner_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_invoice ADD CONSTRAINT job_invoice_company_no_uidx UNIQUE (company_id, invoice_no);
        ALTER TABLE ONLY job_invoice_line ADD CONSTRAINT job_invoice_line_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_invoice ADD CONSTRAINT job_invoice_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job ADD CONSTRAINT job_no_uidx UNIQUE (job_no);
        ALTER TABLE ONLY job_part_used ADD CONSTRAINT job_part_used_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_payment ADD CONSTRAINT job_payment_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job ADD CONSTRAINT job_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_receive_condition ADD CONSTRAINT job_receive_condition_code_uidx UNIQUE (code);
        ALTER TABLE ONLY job_receive_condition ADD CONSTRAINT job_receive_condition_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_receive_manner ADD CONSTRAINT job_receive_manner_code_uidx UNIQUE (code);
        ALTER TABLE ONLY job_receive_manner ADD CONSTRAINT job_receive_manner_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_status ADD CONSTRAINT job_status_code_uidx UNIQUE (code);
        ALTER TABLE ONLY job_status ADD CONSTRAINT job_status_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_transaction ADD CONSTRAINT job_transaction_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY job_type ADD CONSTRAINT job_type_code_uidx UNIQUE (code);
        ALTER TABLE ONLY job_type ADD CONSTRAINT job_type_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY product_brand_model ADD CONSTRAINT pbm_unique_model UNIQUE (product_id, brand_id, model_name);
        ALTER TABLE ONLY product_brand_model ADD CONSTRAINT product_brand_model_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY product ADD CONSTRAINT product_name_key UNIQUE (name);
        ALTER TABLE ONLY product ADD CONSTRAINT product_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY purchase_invoice_line ADD CONSTRAINT purchase_invoice_line_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY purchase_invoice ADD CONSTRAINT purchase_invoice_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY purchase_invoice ADD CONSTRAINT purchase_invoice_supplier_no_uidx UNIQUE (supplier_id, invoice_no);
        ALTER TABLE ONLY sales_invoice ADD CONSTRAINT sales_invoice_company_no_uidx UNIQUE (company_id, invoice_no);
        ALTER TABLE ONLY sales_invoice_line ADD CONSTRAINT sales_invoice_line_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY sales_invoice ADD CONSTRAINT sales_invoice_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY spare_part_master ADD CONSTRAINT spare_part_code_brand_unique UNIQUE (brand_id, part_code);
        ALTER TABLE ONLY spare_part_master ADD CONSTRAINT spare_part_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY state ADD CONSTRAINT state_code_uidx UNIQUE (code);
        ALTER TABLE ONLY state ADD CONSTRAINT state_name_uidx UNIQUE (name);
        ALTER TABLE ONLY state ADD CONSTRAINT state_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY stock_adjustment_line ADD CONSTRAINT stock_adjustment_line_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY stock_adjustment ADD CONSTRAINT stock_adjustment_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY stock_transaction_type ADD CONSTRAINT stock_transaction_type_code_uidx UNIQUE (code);
        ALTER TABLE ONLY stock_transaction_type ADD CONSTRAINT stock_transaction_type_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY supplier ADD CONSTRAINT supplier_name_key UNIQUE (name);
        ALTER TABLE ONLY supplier ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);
        ALTER TABLE ONLY technician ADD CONSTRAINT technician_bu_code_uidx UNIQUE (branch_id, code);
        ALTER TABLE ONLY technician ADD CONSTRAINT technician_pkey PRIMARY KEY (id);

        -- Indexes
        CREATE INDEX branch_state_idx ON branch USING btree (state_id);
        CREATE INDEX idx_customer_contact_mobile ON customer_contact USING btree (mobile);
        CREATE INDEX idx_job_delivery_date ON job USING btree (delivery_date);
        CREATE INDEX idx_job_invoice_job ON job_invoice USING btree (job_id);
        CREATE INDEX idx_job_invoice_line_invoice ON job_invoice_line USING btree (job_invoice_id);
        CREATE INDEX idx_job_invoice_line_part ON job_invoice_line USING btree (part_code);
        CREATE INDEX idx_job_part_used_job ON job_part_used USING btree (job_id);
        CREATE INDEX idx_job_part_used_part ON job_part_used USING btree (part_id);
        CREATE INDEX idx_job_payment_date ON job_payment USING btree (payment_date);
        CREATE INDEX idx_job_payment_job ON job_payment USING btree (job_id);
        CREATE INDEX idx_job_transaction_job_id ON job_transaction USING btree (job_id);
        CREATE INDEX idx_job_transaction_performed_at ON job_transaction USING btree (performed_at);
        CREATE INDEX idx_job_transaction_status ON job_transaction USING btree (status_id);
        CREATE INDEX idx_purchase_invoice_line_spare_part ON purchase_invoice_line USING btree (part_id);
        CREATE INDEX idx_purchase_invoice_supplier ON purchase_invoice USING btree (supplier_id);
        CREATE INDEX idx_sales_invoice_customer ON sales_invoice USING btree (customer_contact_id);
        CREATE INDEX idx_sales_invoice_line_spare_part ON sales_invoice_line USING btree (part_id);
        CREATE INDEX idx_stock_adj_date ON stock_adjustment USING btree (adjustment_date);
        CREATE INDEX idx_stock_adj_line_adj_id ON stock_adjustment_line USING btree (stock_adjustment_id);
        CREATE INDEX idx_stock_adj_line_part ON stock_adjustment_line USING btree (part_id);
        CREATE INDEX idx_stock_tx_date ON stock_transaction USING btree (transaction_date);
        CREATE INDEX idx_stock_tx_part ON stock_transaction USING btree (part_id);
        CREATE INDEX idx_stock_tx_type ON stock_transaction USING btree (stock_transaction_type_id);
        CREATE INDEX job_branch_idx ON job USING btree (branch_id);
        CREATE INDEX job_customer_idx ON job USING btree (customer_contact_id);
        CREATE INDEX job_job_date_idx ON job USING btree (job_date);
        CREATE INDEX job_status_idx ON job USING btree (job_status_id);
        CREATE INDEX job_technician_idx ON job USING btree (technician_id);
        CREATE INDEX technician_phone_idx ON technician USING btree (phone);

        -- Foreign key constraints
        ALTER TABLE ONLY branch ADD CONSTRAINT branch_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY company_info ADD CONSTRAINT company_info_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY customer_contact ADD CONSTRAINT customer_contact_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY customer_contact ADD CONSTRAINT customer_contact_type_fk FOREIGN KEY (customer_type_id) REFERENCES customer_type(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY document_sequence ADD CONSTRAINT document_sequence_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY document_sequence ADD CONSTRAINT document_sequence_type_fk FOREIGN KEY (document_type_id) REFERENCES document_type(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_additional_charge ADD CONSTRAINT job_additional_charge_job_id_fkey FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE;
        ALTER TABLE ONLY job ADD CONSTRAINT job_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_invoice ADD CONSTRAINT job_invoice_company_fk FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_invoice ADD CONSTRAINT job_invoice_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_invoice_line ADD CONSTRAINT job_invoice_line_invoice_fk FOREIGN KEY (job_invoice_id) REFERENCES job_invoice(id) ON DELETE CASCADE;
        ALTER TABLE ONLY job_part_used ADD CONSTRAINT job_part_used_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_part_used ADD CONSTRAINT job_part_used_part_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_payment ADD CONSTRAINT job_payment_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE;
        ALTER TABLE ONLY job ADD CONSTRAINT job_product_brand_model_fk FOREIGN KEY (product_brand_model_id) REFERENCES product_brand_model(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_receive_condition_fk FOREIGN KEY (job_receive_condition_id) REFERENCES job_receive_condition(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_receive_manner_fk FOREIGN KEY (job_receive_manner_id) REFERENCES job_receive_manner(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_status_fk FOREIGN KEY (job_status_id) REFERENCES job_status(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_technician_fk FOREIGN KEY (technician_id) REFERENCES technician(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_transaction ADD CONSTRAINT job_transaction_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE;
        ALTER TABLE ONLY job_transaction ADD CONSTRAINT job_transaction_status_fk FOREIGN KEY (status_id) REFERENCES job_status(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job_transaction ADD CONSTRAINT job_transaction_technician_fk FOREIGN KEY (technician_id) REFERENCES technician(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY job ADD CONSTRAINT job_type_fk FOREIGN KEY (job_type_id) REFERENCES job_type(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY product_brand_model ADD CONSTRAINT pbm_brand_fk FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY product_brand_model ADD CONSTRAINT pbm_product_fk FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY purchase_invoice ADD CONSTRAINT purchase_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY purchase_invoice_line ADD CONSTRAINT purchase_invoice_line_invoice_fk FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoice(id) ON DELETE CASCADE;
        ALTER TABLE ONLY purchase_invoice_line ADD CONSTRAINT purchase_invoice_line_part_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY purchase_invoice ADD CONSTRAINT purchase_invoice_supplier_fk FOREIGN KEY (supplier_id) REFERENCES supplier(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY sales_invoice ADD CONSTRAINT sales_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY sales_invoice ADD CONSTRAINT sales_invoice_company_fk FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY sales_invoice ADD CONSTRAINT sales_invoice_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY sales_invoice_line ADD CONSTRAINT sales_invoice_line_invoice_fk FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoice(id) ON DELETE CASCADE;
        ALTER TABLE ONLY sales_invoice_line ADD CONSTRAINT sales_invoice_line_part_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY spare_part_master ADD CONSTRAINT spare_part_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brand(id);
        ALTER TABLE ONLY stock_adjustment ADD CONSTRAINT stock_adjustment_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY stock_adjustment_line ADD CONSTRAINT stock_adjustment_line_adjustment_fk FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustment(id) ON DELETE CASCADE;
        ALTER TABLE ONLY stock_adjustment_line ADD CONSTRAINT stock_adjustment_line_spare_part_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_adjustment_line_id_fkey FOREIGN KEY (adjustment_line_id) REFERENCES stock_adjustment_line(id);
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_job_part_used_id_fkey FOREIGN KEY (job_part_used_id) REFERENCES job_part_used(id);
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_part_id_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_purchase_line_id_fkey FOREIGN KEY (purchase_line_id) REFERENCES purchase_invoice_line(id);
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_sales_line_id_fkey FOREIGN KEY (sales_line_id) REFERENCES sales_invoice_line(id);
        ALTER TABLE ONLY stock_transaction ADD CONSTRAINT stock_transaction_type_fk FOREIGN KEY (stock_transaction_type_id) REFERENCES stock_transaction_type(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY supplier ADD CONSTRAINT supplier_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT;
        ALTER TABLE ONLY technician ADD CONSTRAINT technician_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT;
    """

    BU_SEED_SQL = """
        INSERT INTO customer_type (id, code, name, is_system) VALUES
            (1, 'INDIVIDUAL',      'Individual Customer',              true),
            (2, 'CORPORATE',       'Corporate / Company',              true),
            (3, 'DEALER',          'Dealer / Retail Partner',          true),
            (4, 'SERVICE_PARTNER', 'Authorized Service Partner',       true),
            (5, 'INSTITUTION',     'Institution (School, Govt, NGO)',  true),
            (6, 'MARKETPLACE',     'Online Marketplace Customer',      true),
            (7, 'MISCELLANEOUS',   'Miscellaneous',                    true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO document_type (id, code, prefix, name, description, is_system) VALUES
            (1, 'JOB_SHEET',               'JS',  'Job Sheet',               'Service job intake and tracking document',              true),
            (2, 'SERVICE_INVOICE',         'SI',  'Service Invoice',         'Service invoice issued to customer',                    true),
            (3, 'MONEY_RECEIPT',           'MR',  'Money Receipt',           'Receipt issued against payment received from customer',  true),
            (4, 'SALES_INVOICE',           'SAL', 'Sales Invoice',           'Sales invoice issued to customer',                      true),
            (5, 'PURCHASE_INVOICE',        'PI',  'Purchase Invoice',        'Purchase invoice from supplier',                        true),
            (6, 'SALES_RETURN_INVOICE',    'SRI', 'Sales Return Invoice',    'Sales return invoice issued to customer',               true),
            (7, 'PURCHASE_RETURN_INVOICE', 'PRI', 'Purchase Return Invoice', 'Purchase return invoice issued to supplier',            true),
            (8, 'SERVICE_RETURN_INVOICE',  'SVI', 'Service Return Invoice',  'Service return invoice issued to customer',             true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_delivery_manner (id, code, name, is_system) VALUES
            (1, 'SELF',           'Self',           true),
            (2, 'HOME_DELIVERY',  'Home Delivery',  true),
            (3, 'COURIER',        'Courier',        true),
            (4, 'POST',           'Post',           true),
            (5, 'OTHER',          'Other',          true),
            (6, 'NOT_APPLICABLE', 'Not Applicable', true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_receive_condition (id, code, name, description, is_system) VALUES
            (1,  'DEAD',           'Dead',                        'Item is completely dead',                                           true),
            (2,  'NOT_WORKING',    'Not Working',                 'Item is completely non-functional at the time of receipt',          true),
            (3,  'PARTIAL_WORKING','Partially Working',           'Item is working but with reported issues or faults',                true),
            (4,  'DAMAGED',        'Damaged',                     'Item has visible physical damage affecting usability',             true),
            (5,  'MINOR_DAMAGE',   'Minor Damage',                'Item has minor scratches, dents, or cosmetic issues',              true),
            (6,  'MISSING_PARTS',  'Missing Parts / Accessories', 'Some parts or accessories are missing',                           true),
            (7,  'WATER_DAMAGE',   'Water Damaged',               'Item shows signs of liquid damage',                               true),
            (8,  'BURNT',          'Burnt / Electrical Damage',   'Item has electrical damage',                                      true),
            (9,  'PHYSICAL_BREAK', 'Physically Broken',           'Item is broken',                                                  true),
            (10, 'UNKNOWN',        'Condition Unknown',           'Condition not verified',                                          true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_receive_manner (id, code, name) VALUES
            (1, 'WALKIN', 'Walk-in (Customer Visit)'),
            (2, 'PICKUP', 'Home Pickup'),
            (3, 'ONLINE', 'Online Booking'),
            (4, 'PHONE',  'Phone Booking'),
            (5, 'COURIER','Received via Courier'),
            (6, 'AMC',    'AMC / Contract Service'),
            (7, 'POST',   'Received via Postal Service'),
            (8, 'OTHER',  'Other')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_status (id, code, name, description, display_order) VALUES
            (1,  'RECEIVED',          'Received',         'Item received',               1),
            (2,  'ASSIGNED',          'Assigned',         'Assigned to technician',      2),
            (3,  'ESTIMATED',         'Estimated',        'Cost estimation is done',     3),
            (4,  'ESTIMATE_APPROVED', 'Estimate Approved','Customer approved estimate',  4),
            (5,  'ESTIMATE_REJECTED', 'Estimate Rejected','Customer rejected estimate',  5),
            (6,  'IN_PROGRESS',       'In Progress',      'Work in progress',            6),
            (7,  'PARTS_PENDING',     'Parts Pending',    'Waiting for parts',           7),
            (8,  'ON_HOLD',           'On Hold',          'Temporarily paused',          8),
            (9,  'OUTSOURCED',        'Outsourced',       'Sent to vendor',              9),
            (10, 'SENT_TO_COMPANY',   'Sent to Company',  'Sent to company',            10),
            (11, 'COMPLETED_OK',      'Completed OK',     'Work completed',             11),
            (12, 'RETURN',            'Return',           'Ready to return',            12),
            (13, 'DELIVERED_OK',      'Delivered OK',     'Delivered successfully',     13),
            (14, 'DELIVERED_NOT_OK',  'Delivered Not OK', 'Delivered but issue remains',14),
            (15, 'CANCELLED',         'Cancelled',        'Job cancelled',              15),
            (16, 'DISPOSED',          'Disposed',         'Item disposed',              16)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO job_type (id, code, name, description, is_system) VALUES
            (1,  'MAKE_READY',     'Make Ready',    'Make item ready',          true),
            (2,  'ESTIMATE',       'Estimate',      'Estimate for repair',      true),
            (3,  'UNDER_WARRANTY', 'Under Warranty','Warranty service',         true),
            (4,  'INSTALLATION',   'Installation',  'Installing product',       true),
            (5,  'DEMO',           'Demo',          'Product demo',             true),
            (6,  'MAINTENANCE',    'Maintenance',   'Preventive maintenance',   true),
            (7,  'INSPECTION',     'Inspection',    'Diagnosis only',           true),
            (8,  'AMC_SERVICE',    'AMC Service',   'AMC service',              true),
            (9,  'UPGRADE',        'Upgrade',       'Upgrade components',       true),
            (10, 'REFURBISH',      'Refurbishment', 'Restore item',             true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO stock_transaction_type (id, code, name, dr_cr, description, is_system) VALUES
            (1,  'CONSUMPTION',     'Consumption',    'C', 'Consumed',            true),
            (2,  'PURCHASE',        'Purchase',       'D', 'Stock received',      true),
            (3,  'SALES',           'Sales',          'C', 'Stock sold',          true),
            (4,  'SALES_RETURN',    'Sales Return',   'D', 'Customer return',     true),
            (5,  'PURCHASE_RETURN', 'Purchase Return','C', 'Return to supplier',  true),
            (6,  'OPENING',         'Opening Stock',  'D', 'Opening stock',       true),
            (7,  'ADJUSTMENT_IN',   'Adjustment In',  'D', 'Increase',            true),
            (8,  'ADJUSTMENT_OUT',  'Adjustment Out', 'C', 'Decrease',            true),
            (9,  'LOAN_IN',         'Loan In',        'D', 'Received loan',       true),
            (10, 'LOAN_OUT',        'Loan Out',       'C', 'Given loan',          true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO state (id, code, name, country_code, gst_state_code, is_union_territory) VALUES
            (1,  'AN', 'Andaman and Nicobar Islands',              'IN', '35', true),
            (2,  'AP', 'Andhra Pradesh',                           'IN', '37', false),
            (3,  'AR', 'Arunachal Pradesh',                        'IN', '12', false),
            (4,  'AS', 'Assam',                                    'IN', '18', false),
            (5,  'BR', 'Bihar',                                    'IN', '10', false),
            (6,  'CG', 'Chhattisgarh',                             'IN', '22', false),
            (7,  'GA', 'Goa',                                      'IN', '30', false),
            (8,  'GJ', 'Gujarat',                                  'IN', '24', false),
            (9,  'HR', 'Haryana',                                  'IN', '06', false),
            (10, 'HP', 'Himachal Pradesh',                         'IN', '02', false),
            (11, 'JH', 'Jharkhand',                                'IN', '20', false),
            (12, 'KA', 'Karnataka',                                'IN', '29', false),
            (13, 'KL', 'Kerala',                                   'IN', '32', false),
            (14, 'MP', 'Madhya Pradesh',                           'IN', '23', false),
            (15, 'MH', 'Maharashtra',                              'IN', '27', false),
            (16, 'MN', 'Manipur',                                  'IN', '14', false),
            (17, 'ML', 'Meghalaya',                                'IN', '17', false),
            (18, 'MZ', 'Mizoram',                                  'IN', '15', false),
            (19, 'NL', 'Nagaland',                                 'IN', '13', false),
            (20, 'OD', 'Odisha',                                   'IN', '21', false),
            (21, 'PB', 'Punjab',                                   'IN', '03', false),
            (22, 'RJ', 'Rajasthan',                                'IN', '08', false),
            (23, 'SK', 'Sikkim',                                   'IN', '11', false),
            (24, 'TN', 'Tamil Nadu',                               'IN', '33', false),
            (25, 'TS', 'Telangana',                                'IN', '36', false),
            (26, 'TR', 'Tripura',                                  'IN', '16', false),
            (27, 'UP', 'Uttar Pradesh',                            'IN', '09', false),
            (28, 'UK', 'Uttarakhand',                              'IN', '05', false),
            (29, 'WB', 'West Bengal',                              'IN', '19', false),
            (30, 'CH', 'Chandigarh',                               'IN', '04', true),
            (31, 'DN', 'Dadra and Nagar Haveli and Daman and Diu', 'IN', '26', true),
            (32, 'DL', 'Delhi',                                    'IN', '07', true),
            (33, 'JK', 'Jammu and Kashmir',                        'IN', '01', true),
            (34, 'LA', 'Ladakh',                                   'IN', '38', true),
            (35, 'LD', 'Lakshadweep',                              'IN', '31', true),
            (36, 'PY', 'Puducherry',                               'IN', '34', true)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO branch (code, name, address_line1, state_id, pincode, is_head_office)
        SELECT 'HO', 'Head Office', '123 Main St', 29, '700001', true
        WHERE NOT EXISTS (SELECT 1 FROM branch WHERE code = 'HO');

        INSERT INTO financial_year (id, start_date, end_date) VALUES
            (2022, '2022-04-01', '2023-03-31'),
            (2023, '2023-04-01', '2024-03-31'),
            (2024, '2024-04-01', '2025-03-31'),
            (2025, '2025-04-01', '2026-03-31'),
            (2026, '2026-04-01', '2027-03-31'),
            (2027, '2027-04-01', '2028-03-31'),
            (2028, '2028-04-01', '2029-03-31'),
            (2029, '2029-04-01', '2030-03-31'),
            (2030, '2030-04-01', '2031-03-31'),
            (2031, '2031-04-01', '2032-03-31'),
            (2032, '2032-04-01', '2033-03-31'),
            (2033, '2033-04-01', '2034-03-31'),
            (2034, '2034-04-01', '2035-03-31'),
            (2035, '2035-04-01', '2036-03-31'),
            (2036, '2036-04-01', '2037-03-31'),
            (2037, '2037-04-01', '2038-03-31'),
            (2038, '2038-04-01', '2039-03-31'),
            (2039, '2039-04-01', '2040-03-31'),
            (2040, '2040-04-01', '2041-03-31'),
            (2041, '2041-04-01', '2042-03-31'),
            (2042, '2042-04-01', '2043-03-31'),
            (2043, '2043-04-01', '2044-03-31'),
            (2044, '2044-04-01', '2045-03-31'),
            (2045, '2045-04-01', '2046-03-31'),
            (2046, '2046-04-01', '2047-03-31'),
            (2047, '2047-04-01', '2048-03-31'),
            (2048, '2048-04-01', '2049-03-31'),
            (2049, '2049-04-01', '2050-03-31'),
            (2050, '2050-04-01', '2051-03-31'),
            (2051, '2051-04-01', '2052-03-31'),
            (2052, '2052-04-01', '2053-03-31'),
            (2053, '2053-04-01', '2054-03-31'),
            (2054, '2054-04-01', '2055-03-31'),
            (2055, '2055-04-01', '2056-03-31')
        ON CONFLICT (id) DO NOTHING;
    """
