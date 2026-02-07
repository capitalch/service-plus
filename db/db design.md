## to do
- job transaction mechanism finalize
- strategy for maintaining incremental numbers like job_receipt_no, invoice_no
- using brand_code and spare_part_code instead of spare_part_id
- usage of is_active, created_at, updated_at columns
- usage of bigint, integer and smallint
- filling of prefilled tables

## Service database Table names: version 2

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

- city
    CREATE TABLE public.city (
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    state_id int NOT NULL REFERENCES state(id) ON DELETE RESTRICT,

    name text NOT NULL,        -- Kolkata
    is_active boolean DEFAULT true NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX city_state_name_uidx
    ON city(state_id, name);

    CREATE INDEX city_state_id_idx
    ON city(state_id);

- customer_contact
  - id  bigint pk identity

  - customer_type: INDIVIDUAL, BUSINESS, CORPORATE, DEALER
  - first_name  nullable for business
  - last_name  nullable for business
  - business_name  nullable for individual
  - gstin  null
  
  - mobile text
  - alternate_mobile  text
  - email text

  
  - address_line1 text not null,
  - address_line2 text,
  - landmark text
  - state_id int not null, fk -> state(id)
  - city_id int not null, fk -> city(id)
  - postal_code PIN code
  - remarks text

  - is_active
  - created_at  timestamptz NOT NULL DEFAULT now()
  - updated_at  timestamptz NOT NULL DEFAULT now()

  - CHECK (
    (customer_type = 'INDIVIDUAL' AND first_name IS NOT NULL AND last_name IS NOT NULL)
    OR
    (customer_type <> 'INDIVIDUAL' AND business_name IS NOT NULL)
    )
  - CHECK (customer_type IN ('INDIVIDUAL', 'BUSINESS', CORPORATE, DEALER))
  - Foreign keys
    FOREIGN KEY (state_id) REFERENCES geo.state(id)
    FOREIGN KEY (city_id)  REFERENCES geo.city(id)

    CREATE INDEX idx_customer_contact_city ON customer_contact (city_id);
    CREATE INDEX idx_customer_contact_state ON customer_contact (state_id);
    CREATE INDEX idx_customer_contact_mobile ON customer_contact (mobile);

- branch
  CREATE TABLE public.branch (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bu_code bigint NOT NULL
        REFERENCES security.bu(id) ON DELETE RESTRICT,

    code text NOT NULL,                -- BR001, KOL_MAIN
    name text NOT NULL,                -- Kolkata Service Center

    -- Contact
    phone text,
    email text,

    -- Address
    address_line1 text NOT NULL,
    address_line2 text,
    city_id int NOT NULL
        REFERENCES public.city(id) ON DELETE RESTRICT,
    state_id int NOT NULL
        REFERENCES public.state(id) ON DELETE RESTRICT,
    pincode text,

    -- Tax
    gstin text,                        -- nullable (not all branches GST registered)

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
    CREATE INDEX branch_city_idx ON branch(city_id);
    CREATE INDEX branch_state_idx ON branch(state_id);
    CREATE INDEX branch_active_idx ON branch(is_active);

    | Table                      | Relationship                     |
    | -------------------------- | -------------------------------- |
    | `bu`                       | 1 → many branches                |
    | `branch` → `job`           | each job belongs to one branch   |
    | `branch` → `technician`    | technicians assigned to a branch |
    | `branch` → `inventory`     | stock maintained per branch      |
    | `branch` → `cash register` | daily cash per branch            |

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
    skill_level smallint DEFAULT 1,   -- 1=Junior,2=Mid,3=Senior

    joining_date date,
    leaving_date date,

    is_active boolean NOT NULL DEFAULT true,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT technician_code_check CHECK (code ~ '^[A-Z0-9_]+$'),
    CONSTRAINT technician_skill_level_check CHECK (skill_level BETWEEN 1 AND 5),
    CONSTRAINT technician_dates_check CHECK (
        leaving_date IS NULL OR leaving_date >= joining_date
    )
    );

    -- Unique technician code per BU
    CREATE UNIQUE INDEX technician_bu_code_uidx
    ON technician(branch_id, code);

    -- Performance indexes
    CREATE INDEX technician_branch_idx ON technician(branch_id);
    CREATE INDEX technician_active_idx ON technician(is_active);
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

    code text NOT NULL,
    name text NOT NULL,

    description text,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT product_code_key UNIQUE (code),
    CONSTRAINT product_code_check CHECK (code ~ '^[A-Z_]+$')
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

    model_code text NOT NULL,
    model_name text NOT NULL,

    launch_year integer,
    remarks text,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pbm_unique_model UNIQUE (product_id, brand_id, model_code)
    );

- company_info
    CREATE TABLE public.company_info (
    id smallint PRIMARY KEY,

    company_name text NOT NULL,

    address_line1 text NOT NULL,
    address_line2 text,
    city text,
    state text,
    country text DEFAULT 'IN',
    pincode text,

    phone text,
    email text,

    gstin text, -- NULL = non-GST company

    is_active boolean NOT NULL DEFAULT true
    );

- job_receive_type
  CREATE TABLE service.job_receive_type (
    id smallint PRIMARY KEY,   -- NOT identity

    code text NOT NULL UNIQUE,
    name text NOT NULL,

    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,

    display_order smallint DEFAULT 0 NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );

    INSERT INTO job_receive_type (id, code, name, display_order)
    VALUES
    (1, 'WALK_IN', 'Walk-in', 1),
    (2, 'COURIER', 'Courier', 2),
    (3, 'PICKUP', 'Pickup', 3),
    (4, 'ONLINE', 'Online Booking', 4);

- job_receive_source
  CREATE TABLE service.job_receive_source (
    id smallint PRIMARY KEY,     -- FIXED SYSTEM IDs

    code text NOT NULL UNIQUE,
    name text NOT NULL,

    description text,

    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,

    display_order smallint DEFAULT 0 NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
  );
  INSERT INTO service.job_receive_source (id, code, name, display_order)
  VALUES
  (1, 'CUSTOMER_DIRECT', 'Customer Direct', 1),
  (2, 'DEALER', 'Dealer', 2),
  (3, 'AUTHORIZED_CENTER', 'Authorized Service Center', 3),
  (4, 'ONLINE_PORTAL', 'Online Portal', 4),
  (5, 'CALL_CENTER', 'Call Center', 5),
  (6, 'MARKETPLACE', 'Marketplace', 6);

- job_status
  CREATE TABLE service.job_status (
    id smallint PRIMARY KEY,

    code text NOT NULL UNIQUE,
    name text NOT NULL,

    description text,

    display_order smallint NOT NULL,

    -- workflow semantics
    is_initial boolean DEFAULT false NOT NULL,
    is_final boolean DEFAULT false NOT NULL,

    -- business flags
    allows_billing boolean DEFAULT false NOT NULL,
    allows_payment boolean DEFAULT false NOT NULL,
    allows_part_issue boolean DEFAULT false NOT NULL,

    -- visibility / control
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT true NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT job_status_code_check CHECK (code ~ '^[A-Z_]+$'),
    CONSTRAINT job_status_unique_initial CHECK (
        (is_initial IS FALSE)
        OR
        (is_initial IS TRUE)
    )
  );
  INSERT INTO service.job_status
    (id, code, name, display_order,
     is_initial, is_final, allows_billing, allows_payment, allows_part_issue)
    VALUES
    (1, 'RECEIVED', 'Received', 1, true, false, false, false, false),
    (2, 'IN_DIAGNOSIS', 'In Diagnosis', 2, false, false, false, false, false),
    (3, 'WAITING_FOR_PARTS', 'Waiting for Spare Parts', 3, false, false, false, false, false),
    (4, 'IN_REPAIR', 'In Repair', 4, false, false, false, false, true),
    (5, 'READY', 'Ready for Delivery', 5, false, false, true, true, false),
    (6, 'DELIVERED', 'Delivered', 6, false, true, false, false, false),
    (7, 'CANCELLED', 'Cancelled', 99, false, true, false, false, false);

- job_transaction_type
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

- job
    CREATE TABLE public.job (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    branch_id bigint NOT NULL
        REFERENCES public.branch(id) ON DELETE RESTRICT,

    job_no text NOT NULL,                     -- e.g. JOB-2026-000123
    job_date timestamptz NOT NULL DEFAULT now(),

    customer_contact_id bigint NOT NULL
        REFERENCES public.customer_contact(id) ON DELETE RESTRICT,

    product_brand_model_id bigint
        REFERENCES public.product_brand_model(id) ON DELETE SET NULL,

    serial_no text,

    problem_reported text NOT NULL,

    job_receive_type_id bigint NOT NULL
        REFERENCES public.job_receive_type(id),

    job_receive_source_id bigint
        REFERENCES public.job_receive_source(id),

    current_status_id bigint NOT NULL
        REFERENCES public.job_status(id),

    assigned_technician_id bigint
        REFERENCES public.technician(id) ON DELETE SET NULL,

    expected_delivery_date date,
    actual_delivery_date date,

    warranty_status boolean NOT NULL DEFAULT false,

    remarks text,

    is_closed boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT job_dates_check CHECK (
        actual_delivery_date IS NULL
        OR actual_delivery_date >= job_date::date
    )
    );

    CREATE UNIQUE INDEX job_branch_job_no_uidx
    ON job(branch_id, job_no);

    CREATE INDEX job_status_idx       ON job(current_status_id);
    CREATE INDEX job_technician_idx   ON job(assigned_technician_id);
    CREATE INDEX job_customer_idx     ON job(customer_contact_id);
    CREATE INDEX job_job_date_idx     ON job(job_date);
    CREATE INDEX job_branch_idx       ON job(branch_id);

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

    estimated_amount numeric(12,2),
    final_amount numeric(12,2),

    delivery_date date,

    is_warranty boolean DEFAULT false NOT NULL,
    warranty_card_no text,

    is_active boolean DEFAULT true NOT NULL,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
    );

    CREATE INDEX idx_job_customer ON service.job(customer_contact_id);
    CREATE INDEX idx_job_branch ON service.job(branch_id);
    CREATE INDEX idx_job_status ON service.job(job_status_id);
    CREATE INDEX idx_job_product_model ON service.job(product_brand_model_id);
    CREATE INDEX idx_job_delivery_date ON service.job(delivery_date);

- job_transaction
    CREATE TABLE service.job_transaction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE CASCADE,

    transaction_type_id smallint NOT NULL
        REFERENCES service.job_transaction_type(id),

    from_status_id smallint
        REFERENCES service.job_status(id),

    to_status_id smallint
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

    CREATE INDEX idx_job_transaction_to_status
        ON service.job_transaction(to_status_id);

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

    created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_job_payment_job
    ON service.job_payment(job_id);

    CREATE INDEX idx_job_payment_date
    ON service.job_payment(payment_date);

- job_part_used: inventory items
    CREATE TABLE service.job_part_used (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    job_id bigint NOT NULL
        REFERENCES service.job(id) ON DELETE RESTRICT,

    spare_part_id bigint NOT NULL
        REFERENCES inventory.spare_part(id),

    quantity numeric(10,2) NOT NULL CHECK (quantity > 0),

    used_at timestamptz NOT NULL DEFAULT now()
    );

- stock_transaction
    CREATE TABLE inventory.stock_transaction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    spare_part_id bigint NOT NULL
        REFERENCES inventory.spare_part(id),

    transaction_date date NOT NULL,

    transaction_type text NOT NULL,
    -- OPENING
    -- PURCHASE
    -- JOB_CONSUMPTION
    -- SALE
    -- ADJUSTMENT

    dr_cr char(2) NOT NULL CHECK (dr_cr IN ('DR', 'CR')),

    qty numeric(12,3) NOT NULL CHECK (qty > 0),

    unit_cost numeric(12,2),
    -- purchase cost (optional for CR)

    source_table text NOT NULL,
    source_id bigint NOT NULL,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_stock_tx_part
    ON inventory.stock_transaction(spare_part_id);

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

    reference_no text,

    remarks text,

    created_by bigint,
    -- optional: user id (no FK if you want loose coupling)

    created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_stock_adj_date
    ON inventory.stock_adjustment(adjustment_date);

- stock_adjustment_line
    CREATE TABLE inventory.stock_adjustment_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    stock_adjustment_id bigint NOT NULL
        REFERENCES inventory.stock_adjustment(id) ON DELETE CASCADE,

    spare_part_id bigint NOT NULL
        REFERENCES inventory.spare_part(id),

    dr_cr char(2) NOT NULL CHECK (dr_cr IN ('DR', 'CR')),

    qty numeric(12,3) NOT NULL CHECK (qty > 0),

    unit_cost numeric(12,2),
    -- optional, useful if you later add valuation reports

    remarks text
    );

    CREATE INDEX idx_stock_adj_line_adj_id
    ON inventory.stock_adjustment_line(stock_adjustment_id);

    CREATE INDEX idx_stock_adj_line_part
    ON inventory.stock_adjustment_line(spare_part_id);

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

    is_inter_state boolean NOT NULL,

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),

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

    gst_rate numeric(5,2) NOT NULL DEFAULT 0,

    taxable_amount numeric(12,2) NOT NULL,

    cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    igst_rate numeric(5,2) NOT NULL DEFAULT 0,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

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

    is_inter_state boolean NOT NULL,

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (supplier_id, invoice_no)
    );

    CREATE INDEX idx_purchase_invoice_supplier
    ON service.purchase_invoice(supplier_id);

- purchase_invoice_line
    CREATE TABLE service.purchase_invoice_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    purchase_invoice_id bigint NOT NULL
        REFERENCES service.purchase_invoice(id) ON DELETE CASCADE,

    spare_part_id bigint NOT NULL
        REFERENCES service.spare_part(id),

    hsn_code text NOT NULL,

    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),

    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),

    gst_rate numeric(5,2) NOT NULL DEFAULT 0,

    taxable_amount numeric(12,2) NOT NULL,

    cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    igst_rate numeric(5,2) NOT NULL DEFAULT 0,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

    total_amount numeric(12,2) NOT NULL
    );

    CREATE UNIQUE INDEX uq_purchase_invoice_line
    ON service.purchase_invoice_line(purchase_invoice_id, line_no);

    CREATE INDEX idx_purchase_invoice_line_spare_part
    ON service.purchase_invoice_line(spare_part_id);

- sales_invoice
    CREATE TABLE service.sales_invoice (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    invoice_no text NOT NULL,
    invoice_date date NOT NULL,

    company_id bigint NOT NULL
        REFERENCES service.company_info(id),

    customer_contact_id bigint
        REFERENCES service.customer_contact(id),

    customer_name_snapshot text NOT NULL,
    customer_gstin_snapshot text,

    customer_state_code char(2) NOT NULL,

    is_inter_state boolean NOT NULL,

    taxable_amount numeric(14,2) NOT NULL,

    cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,

    total_tax numeric(14,2) NOT NULL,
    total_amount numeric(14,2) NOT NULL,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (company_id, invoice_no)
    );

    CREATE INDEX idx_sales_invoice_company
    ON service.sales_invoice(company_id);

    CREATE INDEX idx_sales_invoice_customer
    ON service.sales_invoice(customer_contact_id);

- sales_invoice_line
    CREATE TABLE service.sales_invoice_line (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sales_invoice_id bigint NOT NULL
        REFERENCES service.sales_invoice(id) ON DELETE CASCADE,

    spare_part_id bigint
        REFERENCES service.spare_part(id),

    item_description text NOT NULL,

    hsn_code text NOT NULL,

    quantity numeric(12,2) NOT NULL CHECK (quantity > 0),

    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),

    gst_rate numeric(5,2) NOT NULL DEFAULT 0,

    taxable_amount numeric(12,2) NOT NULL,

    cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
    igst_rate numeric(5,2) NOT NULL DEFAULT 0,

    cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
    igst_amount numeric(12,2) NOT NULL DEFAULT 0,

    total_amount numeric(12,2) NOT NULL
    );

    CREATE UNIQUE INDEX uq_sales_invoice_line
    ON service.sales_invoice_line(sales_invoice_id, line_no);

    CREATE INDEX idx_sales_invoice_line_spare_part
    ON service.sales_invoice_line(spare_part_id);

- spare_part_stock_summary
    CREATE VIEW inventory.spare_part_stock_summary AS
        SELECT
            spare_part_id,
            SUM(
                CASE dr_cr
                    WHEN 'DR' THEN qty
                    ELSE -qty
                END
            ) AS current_stock
        FROM inventory.stock_transaction
        GROUP BY spare_part_id;

- app_setting

- fiscal_year
    CREATE TABLE public.fiscal_year (
    id integer PRIMARY KEY,

    start_date date NOT NULL,
    end_date   date NOT NULL,

    CONSTRAINT fiscal_year_date_check CHECK (start_date < end_date),
    );

- supplier
    CREATE TABLE public.supplier (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code text NOT NULL,
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

    CONSTRAINT supplier_code_key UNIQUE (code)
    );

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
