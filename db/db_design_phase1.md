## Service database Tables

- app_setting
    CREATE TABLE public.app_setting (
    id smallint PRIMARY KEY,
    setting_key text NOT NULL UNIQUE,
    setting_type text NOT NULL CHECK (
        setting_type IN ('TEXT','INTEGER','BOOLEAN','JSON')
    ),
    setting_value jsonb NOT NULL,
    description text,
    is_editable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
); 

- financial_year
    CREATE TABLE public.financial_year (
    id integer PRIMARY KEY,

    start_date date NOT NULL,
    end_date   date NOT NULL,

    CONSTRAINT financial_year_date_check CHECK (start_date < end_date),
    );

- supplier
    CREATE TABLE public.supplier (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    gstin text,
    pan text,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    state_id smallint NOT NULL
        REFERENCES public.state(id),
    pincode text,

    is_active boolean NOT NULL DEFAULT true,
    remarks text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT supplier_name_key UNIQUE (name)
    );
    
- state
  CREATE TABLE public.state (
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code text NOT NULL,        -- WB, MH, DL
    name text NOT NULL,        -- West Bengal
    country_code text NOT NULL DEFAULT 'IN',

    gst_state_code char(2),    -- 19, 27 (important for GST)
    is_union_territory boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT state_code_check CHECK (code ~ '^[A-Z]{2}$'),
    CONSTRAINT country_code_check CHECK (country_code ~ '^[A-Z]{2}$')
    );

    CREATE UNIQUE INDEX state_code_uidx ON state(code);
    CREATE UNIQUE INDEX state_name_uidx ON state(name);

- customer_type
    id              smallint PRIMARY KEY   -- fixed ids
    code            text UNIQUE            -- INDIVIDUAL, DEALER, etc
    name            text                   -- display name
    description     text
    is_active       boolean DEFAULT true
    display_order   smallint

    Seed
    INSERT INTO customer_type (id, code, name, display_order) VALUES
    (1, 'INDIVIDUAL',      'Individual Customer',     1),
    (2, 'SERVICE_PARTNER','Service Partner',         2),
    (3, 'DEALER',          'Dealer',                  3),
    (4, 'CORPORATE',       'Corporate / Institutional',4),
    (5, 'OTHER',           'Other',                   99);

- customer_contact
  - id  bigint pk identity

  - customer_type_id smallint NOT NULL
  - full_name  nullable for individual
  - gstin  null
  
  - mobile text
  - alternate_mobile  text
  - email text

  - address_line1 text not null,
  - address_line2 text,
  - landmark text
  - state_id int not null, fk -> state(id)
  - city text,
  - postal_code PIN code
  - remarks text

  - is_active
  - created_at  timestamptz NOT NULL DEFAULT now()
  - updated_at  timestamptz NOT NULL DEFAULT now()
  
  - Foreign keys
    FOREIGN KEY (state_id) REFERENCES geo.state(id)
    FOREIGN KEY (customer_type_id) REFERENCES customer_type(id)
    CREATE INDEX idx_customer_contact_mobile ON customer_contact (mobile);

- branch
  CREATE TABLE public.branch (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bu_code_id bigint NOT NULL
        REFERENCES security.bu(id) ON DELETE RESTRICT,

    code text NOT NULL,                -- BR001, KOL_MAIN
    name text NOT NULL,                -- Kolkata Service Center

    -- Contact
    phone text,
    email text,

    -- Address
    address_line1 text NOT NULL,
    address_line2 text,
    state_id int NOT NULL
        REFERENCES public.state(id) ON DELETE RESTRICT,
    city text,
    pincode text not null,

    -- Tax
    gstin text,

    -- Ops
    is_active boolean DEFAULT true NOT NULL,
    is_head_office boolean DEFAULT false NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT branch_code_check CHECK (code ~ '^[A-Z0-9_]+$'),
    CONSTRAINT branch_gstin_check CHECK (
        gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
    )
    );

    -- Unique per business unit
    CREATE UNIQUE INDEX branch_bu_code_uidx
    ON branch(bu_id, code);

    -- Lookup performance
    CREATE INDEX branch_state_idx ON branch(state_id);

    | Table                      | Relationship                     |
    | -------------------------- | -------------------------------- |
    | `bu`                       | 1 → many branches                |
    | `branch` → `job`           | each job belongs to one branch   |
    | `branch` → `technician`    | technicians assigned to a branch |
    | `branch` → `inventory`     | stock maintained per branch      |

- technician
    CREATE TABLE public.technician (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,

    code text NOT NULL,              -- TECH001
    name text NOT NULL,              -- Full display name

    phone text NULL,
    email text,

    specialization text,             -- AC, TV, Camera, Laptop etc
    leaving_date date,

    is_active boolean NOT NULL DEFAULT true

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT technician_code_check CHECK (code ~ '^[A-Z0-9_]+$')

    -- Unique technician code per BU
    CREATE UNIQUE INDEX technician_bu_code_uidx
    ON technician(branch_id, code);

    -- Performance indexes
    CREATE INDEX technician_phone_idx ON technician(phone);

    | Related Table     | Relation                    |
    | ----------------- | --------------------------- |
    | `branch`          | many technicians per branch |
    | `job`             | job assigned to technician  |
    | `job_transaction` | technician action history   |
    | `user` (optional) | technician may have login   |

- product
    CREATE TABLE public.product (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name text NOT NULL,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT product_name_key UNIQUE (name),
    CONSTRAINT product_name_check CHECK (name ~ '^[A-Z_]+$')
    );

- brand
    CREATE TABLE public.brand (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code text NOT NULL,
    name text NOT NULL,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT brand_code_key UNIQUE (code),
    CONSTRAINT brand_code_check CHECK (code ~ '^[A-Z_]+$')
    );

- product_brand_model
    CREATE TABLE public.product_brand_model (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id bigint NOT NULL
        REFERENCES public.product(id) ON DELETE RESTRICT,

    brand_id bigint NOT NULL
        REFERENCES public.brand(id) ON DELETE RESTRICT,

    model_name text NOT NULL,

    launch_year integer,
    remarks text,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pbm_unique_model UNIQUE (product_id, brand_id, model_name)
    );

- document_type
    CREATE TABLE public.document_type (
    id smallint PRIMARY KEY,          -- fixed IDs (1,2,3...)
    
    code text NOT NULL UNIQUE,         -- JOB, RECEIPT, SALE_INVOICE, JOB_INVOICE, PURCHASE
    prefix text NOT NULL,              -- JOB, RCPT, SI, JI, PI
    
    name text NOT NULL,                -- Human readable
    description text,

    CONSTRAINT document_type_code_chk
        CHECK (code ~ '^[A-Z_]+$')
    );

- document_sequence
    CREATE TABLE public.document_sequence (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    document_type_id smallint NOT NULL
        REFERENCES public.document_type(id),

    branch_id bigint NOT NULL
        REFERENCES public.branch(id),

    prefix text NOT NULL,                 -- e.g. JOB, JI, SI, RCPT
    next_number integer NOT NULL DEFAULT 1,

    padding smallint NOT NULL DEFAULT 5,  -- 00001
    separator text NOT NULL DEFAULT '/',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT document_sequence_unique
        UNIQUE (document_type_id, branch_id)
    );

    code: for increment
    BEGIN;

    SELECT next_number
    FROM document_sequence
    WHERE document_type_id = 2   -- JOB_INVOICE
      AND branch_id = 1
    FOR UPDATE;

    UPDATE document_sequence
    SET next_number = next_number + 1,
        updated_at = now()
    WHERE document_type_id = 2
      AND branch_id = 1
    RETURNING next_number - 1 AS issued_number;

    COMMIT;

- company_info
    CREATE TABLE public.company_info (
    id int PRIMARY KEY,

    company_name text NOT NULL,

    address_line1 text NOT NULL,
    address_line2 text,
    city text,
    state_id int not null,
    country text DEFAULT 'IN',
    pincode text,

    phone text,
    email text,

    gstin text, -- NULL = non-GST company

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
    );

- job_type
    id              smallint PRIMARY KEY
    code            text UNIQUE NOT NULL
    name            text NOT NULL
    description     text
    display_order   smallint
    is_active       boolean DEFAULT true

    SEED Values
        WORKSHOP_GENERAL_REPAIR
        WORKSHOP_WARRANTY_REPAIR
        WORKSHOP_ESTIMATE
        WORKSHOP_REPLACEMENT
        WORKSHOP_REPEAT_REPAIR

        HOME_SERVICE_GENERAL_REPAIR
        HOME_SERVICE_WARRANTY_REPAIR

        DEMO
        SERVICE_CONTRACT

- job_receive_manner
    CREATE TABLE service.job_receive_manner (
    id smallint PRIMARY KEY,   -- NOT identity

    code text NOT NULL UNIQUE,
    name text NOT NULL,

    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,

    display_order smallint DEFAULT 0 NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );

    SEED VALUES
        WALK_IN
        COURIER
        PICKUP
        ONLINE_BOOKING
        PHONE_BOOKING
        MISC

- job_receive_condition
    id              smallint PRIMARY KEY
    code            text UNIQUE NOT NULL
    name            text NOT NULL
    description     text
    display_order   smallint

    SEED VALUES
        DEAD
        DAMAGED
        PHYSICALLY_BROKEN
        WATER_LOGGED
        PARTIALLY_WORKING
        DISCOLORED
        LCD_DAMAGE
        UNKNOWN

- job_status_type
    CREATE TABLE service.job_status (
        id smallint PRIMARY KEY,

        code text NOT NULL UNIQUE,
        name text NOT NULL,

        description text,

        display_order smallint NOT NULL,

        -- workflow semantics
        is_initial boolean DEFAULT false NOT NULL,
        is_final boolean DEFAULT false NOT NULL,

        -- visibility / control
        is_active boolean DEFAULT true NOT NULL,
        is_system boolean DEFAULT true NOT NULL,

        created_at timestamptz DEFAULT now() NOT NULL,
        updated_at timestamptz DEFAULT now() NOT NULL,

        CONSTRAINT job_status_code_check CHECK (code ~ '^[A-Z_]+$'),
        
    );
  
    SEED VALUES
        NEW
        ESTIMATED
        APPROVED
        NOT_APPROVED
        WAITING_FOR_PARTS
        TECHNICIAN_ASSIGNED
        CANCELLED
    
        MARKED_FOR_DISPOSAL
        DISPOSED
    
        SENT_TO_COMPANY
        RECEIVED_FROM_COMPANY_READY
        RECEIVED_FROM_COMPANY_RETURN
        READY_FOR_DELIVERY
        RETURN_FOR_DELIVERY
        DELIVERED
    
        DEMO_COMPLETED
    
        HOME_SERVICE_ATTENDED
        HOME_SERVICE_COMPLETED
    
        INSTALLATION_REQUESTED
        INSTALLATION_COMPLETED
             
    CREATE TABLE service.job_transaction_type (
    id smallint PRIMARY KEY,

    code text NOT NULL UNIQUE,
    name text NOT NULL,

    description text,

    display_order smallint NOT NULL,

    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT true NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );
    INSERT INTO service.job_transaction_type
    (id, code, name, description, display_order, is_active, is_system)
    VALUES
    -- Job lifecycle
    (1, 'JOB_CREATED',        'Job Created',        'Initial job entry at reception',                 1,  true, true),
    (2, 'JOB_UPDATED',        'Job Updated',        'General job detail update',                      2,  true, true),
    (3, 'STATUS_CHANGED',     'Status Changed',     'Job status transition',                          3,  true, true),

    -- Diagnosis & repair
    (10, 'DIAGNOSIS_ADDED',   'Diagnosis Added',    'Fault diagnosis recorded',                       10, true, true),
    (11, 'REPAIR_STARTED',   'Repair Started',     'Repair work started',                            11, true, true),
    (12, 'REPAIR_COMPLETED', 'Repair Completed',   'Repair work completed',                          12, true, true),

    -- Spare parts
    (20, 'PART_RESERVED',    'Part Reserved',      'Spare part reserved for job',                    20, true, true),
    (21, 'PART_USED',        'Part Used',          'Spare part consumed in job',                     21, true, true),
    (22, 'PART_RETURNED',    'Part Returned',      'Unused part returned to stock',                  22, true, true),

    -- Billing & payment
    (30, 'ESTIMATE_CREATED', 'Estimate Created',   'Repair estimate generated',                      30, true, true),
    (31, 'INVOICE_CREATED',  'Invoice Created',    'Final job invoice created',                      31, true, true),
    (32, 'PAYMENT_RECEIVED', 'Payment Received',   'Payment received against job',                  32, true, true),
    (33, 'REFUND_ISSUED',    'Refund Issued',      'Refund issued to customer',                      33, true, true),

    -- Closure
    (40, 'JOB_READY',        'Job Ready',          'Job marked ready for delivery',                  40, true, true),
    (41, 'JOB_DELIVERED',    'Job Delivered',      'Job delivered to customer',                      41, true, true),
    (42, 'JOB_CLOSED',       'Job Closed',         'Job closed and archived',                        42, true, true);

- job_delivery_manner
    id              smallint PRIMARY KEY
    code            text UNIQUE NOT NULL
    name            text NOT NULL
    display_order   smallint
    is_active       boolean DEFAULT true

    Seed values
    CUSTOMER_PICKUP
    COURIER
    THIRD_PARTY_PICKUP

- job
    CREATE TABLE service.job (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_no text NOT NULL UNIQUE,
    job_date date NOT NULL DEFAULT current_date,

    customer_contact_id bigint NOT NULL
        REFERENCES service.customer_contact(id),

    branch_id bigint NOT NULL
        REFERENCES service.branch(id),

    technician_id bigint
        REFERENCES service.technician(id),

    job_status_id smallint NOT NULL
        REFERENCES service.job_status(id),

    job_receive_type_id smallint NOT NULL
        REFERENCES service.job_receive_type(id),

    job_receive_source_id smallint
        REFERENCES service.job_receive_source(id),

    product_brand_model_id bigint
        REFERENCES service.product_brand_model(id),

    serial_no text,
    problem_reported text NOT NULL,
    diagnosis text,
    work_done text,
    remarks text,

    amount numeric(12,2),

    delivery_date date,
    is_closed boolean NOT NULL DEFAULT false,
    is_warranty boolean DEFAULT false NOT NULL,
    warranty_card_no text,

    is_active boolean DEFAULT true NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX job_branch_job_no_uidx
    ON job(branch_id, job_no);

    CREATE INDEX job_status_idx       ON job(current_status_id);
    CREATE INDEX job_technician_idx   ON job(assigned_technician_id);
    CREATE INDEX job_customer_idx     ON job(customer_contact_id);
    CREATE INDEX job_job_date_idx     ON job(job_date);
    CREATE INDEX job_branch_idx       ON job(branch_id);
    CREATE INDEX idx_job_delivery_date ON service.job(delivery_date);

    branch              1 ────* job
    customer_contact    1 ────* job
    technician          1 ────* job
    job_status          1 ────* job
    job_receive_type    1 ────* job
    job_receive_source  1 ────* job

    job                 1 ────* job_transaction
    job                 1 ────* job_part_used
    job                 1 ────1 job_invoice
    job                 1 ────* job_payment

- job_transaction
    CREATE TABLE service.job_transaction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE CASCADE,

    transaction_type_id smallint NOT NULL
        REFERENCES service.job_transaction_type(id),

    status_id smallint
        REFERENCES service.job_status(id),

    technician_id bigint
        REFERENCES service.technician(id),

    amount numeric(12,2),

    notes text,

    performed_by_user_id bigint NOT NULL
        REFERENCES security."user"(id),

    performed_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE INDEX idx_job_transaction_job_id
    ON service.job_transaction(job_id);

    CREATE INDEX idx_job_transaction_performed_at
        ON service.job_transaction(performed_at);

    CREATE INDEX idx_job_transaction_type
        ON service.job_transaction(transaction_type_id);

    CREATE INDEX idx_job_transaction_status
        ON service.job_transaction(status_id);

- job_payment
    CREATE TABLE service.job_payment (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE CASCADE,

    payment_date date NOT NULL,

    payment_mode text NOT NULL,
    -- CASH, CARD, UPI, BANK_TRANSFER, ADJUSTMENT

    amount numeric(14,2) NOT NULL CHECK (amount > 0),

    reference_no text,
    -- UTR / cheque / transaction id

    remarks text,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    CREATE INDEX idx_job_payment_job
    ON service.job_payment(job_id);

    CREATE INDEX idx_job_payment_date
    ON service.job_payment(payment_date);

- job_part_used: inventory items
    CREATE TABLE service.job_part_used (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE RESTRICT,

    part_code text NOT NULL,
    brand_id bigint NOT NULL
        REFERENCES public.brand(id) ON DELETE RESTRICT,

    quantity numeric(10,2) NOT NULL CHECK (quantity > 0),

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );

- stock_transaction_type
    CREATE TABLE stock_transaction_type (
    id smallint PRIMARY KEY,                 -- fixed IDs (1,2,3...)
    code text NOT NULL UNIQUE,                -- OPENING_STOCK, PURCHASE, SALE, ADJUSTMENT etc.
    name text NOT NULL,                       -- Human readable
    dr_cr char(1) NOT NULL CHECK (dr_cr IN ('D', 'C')),
    description text,
    is_active boolean DEFAULT true NOT NULL
    );

- stock_transaction
    CREATE TABLE inventory.stock_transaction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    part_code text NOT NULL,
    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,
    brand_id bigint NOT NULL
        REFERENCES public.brand(id) ON DELETE RESTRICT,
    stock_transaction_type_id smallint NOT NULL
        REFERENCES public.stock_transaction_type(id) ON DELETE RESTRICT,
    transaction_date date NOT NULL,

    dr_cr char(1) NOT NULL CHECK (dr_cr IN ('D', 'C')),

    qty numeric(12,3) NOT NULL CHECK (qty > 0),

    unit_cost numeric(12,2),

    source_table text NOT NULL,
    source_id bigint NOT NULL,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_stock_tx_part
    ON inventory.stock_transaction(part_code);

    CREATE INDEX idx_stock_tx_date
    ON inventory.stock_transaction(transaction_date);

    CREATE INDEX idx_stock_tx_type
    ON inventory.stock_transaction(transaction_type);

    CREATE INDEX idx_stock_tx_source
    ON inventory.stock_transaction(source_table, source_id);

- stock_adjustment
    CREATE TABLE inventory.stock_adjustment (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    adjustment_date date NOT NULL,

    adjustment_reason text NOT NULL,
    -- examples:
    -- Physical count mismatch
    -- Damaged items
    -- Missing items
    -- Manual correction
    -- Initial stock

    ref_no text,
    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,

    remarks text,

    created_by bigint,
    -- optional: user id (no FK if you want loose coupling)

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL;

    CREATE INDEX idx_stock_adj_date
    ON inventory.stock_adjustment(adjustment_date);

- stock_adjustment_line
    CREATE TABLE inventory.stock_adjustment_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    stock_adjustment_id bigint NOT NULL
        REFERENCES inventory.stock_adjustment(id) ON DELETE CASCADE,

    part_code text NOT NULL,
    brand_id bigint NOT NULL
        REFERENCES public.brand(id) ON DELETE RESTRICT,

    dr_cr char(1) NOT NULL CHECK (dr_cr IN ('D', 'C')),

    qty numeric(12,3) NOT NULL CHECK (qty > 0),

    unit_cost numeric(12,2),
    -- optional, useful if you later add valuation reports

    remarks text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    );

    CREATE INDEX idx_stock_adj_line_adj_id
    ON inventory.stock_adjustment_line(stock_adjustment_id);

    CREATE INDEX idx_stock_adj_line_part
    ON inventory.stock_adjustment_line(part_code);

- job_invoice
    CREATE TABLE service.job_invoice (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE RESTRICT,

    company_id smallint NOT NULL
        REFERENCES public.company_info(id),

    invoice_no text NOT NULL,
    invoice_date date NOT NULL DEFAULT current_date,

    supply_state_code char(2) NOT NULL, -- customer state (GST code)

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    UNIQUE (company_id, invoice_no)
    );

- job_invoice_line
    CREATE TABLE service.job_invoice_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_invoice_id bigint NOT NULL
        REFERENCES service.job_invoice(id) ON DELETE CASCADE,

    description text NOT NULL,
    hsn_code text NOT NULL,

    quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),

    taxable_amount numeric(12,2) NOT NULL,

    cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    igst_rate numeric(5,2) NOT NULL DEFAULT 0,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    total_amount numeric(12,2) NOT NULL
    );

- purchase_invoice
    CREATE TABLE service.purchase_invoice (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    supplier_id bigint NOT NULL
        REFERENCES service.supplier(id),

    invoice_no text NOT NULL,
    invoice_date date NOT NULL,

    supplier_state_code char(2) NOT NULL,

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,

    remarks text,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    UNIQUE (supplier_id, invoice_no)
    );

    CREATE INDEX idx_purchase_invoice_supplier
    ON service.purchase_invoice(supplier_id);

- purchase_invoice_line
    CREATE TABLE service.purchase_invoice_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    purchase_invoice_id bigint NOT NULL
        REFERENCES service.purchase_invoice(id) ON DELETE CASCADE,

    part_code text NOT NULL,
    brand_id bigint NOT NULL
        REFERENCES public.brand(id) ON DELETE RESTRICT,

    hsn_code text NOT NULL,

    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),

    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),

    taxable_amount numeric(12,2) NOT NULL,

    cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    igst_rate numeric(5,2) NOT NULL DEFAULT 0,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    total_amount numeric(12,2) NOT NULL
    );

    CREATE INDEX idx_purchase_invoice_line_spare_part
    ON service.purchase_invoice_line(part_code);

- sales_invoice
    CREATE TABLE service.sales_invoice (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    invoice_no text NOT NULL,
    invoice_date date NOT NULL,

    company_id bigint NOT NULL
        REFERENCES service.company_info(id),

    customer_contact_id bigint
        REFERENCES service.customer_contact(id),

    customer_name text NOT NULL,
    customer_gstin text,

    customer_state_code char(2) NOT NULL,

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,
    remarks text,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    UNIQUE (company_id, invoice_no)
    );

- sales_invoice_line
    CREATE TABLE service.sales_invoice_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_invoice_id bigint NOT NULL
        REFERENCES service.sales_invoice(id) ON DELETE CASCADE,

    part_code text NOT NULL,

    item_description text NOT NULL,

    hsn_code text NOT NULL,

    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),

    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),

    gst_rate numeric(5,2) NOT NULL DEFAULT 0,

    taxable_amount numeric(12,2) NOT NULL,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    total_amount numeric(12,2) NOT NULL
    );

    CREATE INDEX idx_sales_invoice_line_spare_part
    ON service.sales_invoice_line(part_code);

- spare_part_stock_summary
    CREATE VIEW inventory.spare_part_stock_summary AS
        SELECT
            part_code, brand_id, branch_id,
            SUM(
                CASE dr_cr
                    WHEN 'D' THEN qty
                    ELSE -qty
                END
            ) AS current_stock
        FROM inventory.stock_transaction
        GROUP BY part_code, brand_id, branch_id;

- spare_part: view
    CREATE OR REPLACE VIEW inventory.spare_part AS
        SELECT
            'SONY'::text AS brand_code,
            id,
            part_code,
            part_name,
            part_description,
            category,
            model,
            uom,
            cost_price,
            mrp,
            hsn_code,
            gst_rate,
            is_active
        FROM inventory.spare_part_sony

        UNION ALL

        SELECT
            'CASIO'::text AS brand_code,
            id,
            part_code,
            part_name,
            part_description,
            category,
            model,
            uom,
            cost_price,
            mrp,
            hsn_code,
            gst_rate,
            is_active
        FROM inventory.spare_part_casio

        UNION ALL

        SELECT
            'NIKON'::text AS brand_code,
            id,
            part_code,
            part_name,
            part_description,
            category,
            model,
            uom,
            cost_price,
            mrp,
            hsn_code,
            gst_rate,
            is_active
        FROM inventory.spare_part_nikon;

- spare_part_casio
    CREATE TABLE inventory.spare_part_sony (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    part_code text NOT NULL,
    part_name text NOT NULL,
    part_description text,

    category text,          -- lens, battery, pcb, cable, etc
    model text,             -- camera / device model
    uom text NOT NULL DEFAULT 'NOS',

    cost_price numeric(12,2),   -- last known purchase price
    mrp numeric(12,2),

    hsn_code text,
    gst_rate numeric(5,2),      -- eg: 18.00

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (part_code)
    );

    CREATE INDEX idx_sp_casio_name
    ON inventory.spare_part_sony (part_name);

    CREATE INDEX idx_sp_casio_model
    ON inventory.spare_part_sony (model);

- spare_part_sony

- spare_part_nikon

## Security database

- *user*
  
  - id  bigint pk
  
  - username  text unique not null
  
  - email  text unique not null
  
  - mobile text
  
  - password_hash    text not null
  
  - is_active  boolean not null default true
  
  - created_at timestamp
    
    **Indexes**
    
    - `UNIQUE(username)`
    
    - `UNIQUE(email)`
    
    - `(is_active)`

- *bu*
  
  - id  bigint pk
  
  - client_id  fk -> client(id)
  
  - code  text not null unique
  
  - name  text not null
  
  - is_active  boolean default true
  
  - **Constraints**
    
    - UNIQUE (client_id, code)
  
  - **Indexes**
    
    - (client_id)
    
    - (is_active)

- *user_bu_role*
  
  - id  bigint pk
  
  - user_id  bigint fk -> user(id)
  
  - bu_id  bigint fk -> bu(id)
  
  - role_id  int fk -> role(id)
  
  - is_active  bool default true
  
  - **Constraints**
    
    - UNIQUE (user_id, bu_id)
  
  - **Indexes**
    
    (user_id)
    
    (bu_id)
    
    (role_id)
    
    (user_id, bu_id)
    
    (is_active)

- *client*
  
  - id  bigint pk
  
  - code  text unique not null
  
  - name  text not null
  
  - is_active  bool default true
  
  - **Indexes**
    
    - UNIQUE(code)
    
    - (is_active)

- *role*
  
  - id  int pk
  
  - code  text unique not null
  
  - name  text not null
  
  - description  text
  
  - is_system  boolean default false
  
  - Indexes
    
     `UNIQUE(code)`
    
    - `(is_system)`

- *access_right*
  
  - id   int pk
  
  - code  text unique not null
  
  - name text not null
  
  - module  text not null
  
  - description  text
  
  - **Indexes**
    
    - UNIQUE(code)`
    
    - `(module)`

- *role_access_right*
  
  - id  int pk
  
  - role_id  int fk -> role(id)
  
  - access_right_id  int fk -> access_right(id)
  
  - **Constraint**
    
    - unique role_id + access_right_id
  
  - Indexes
    
    - access_right_iu
