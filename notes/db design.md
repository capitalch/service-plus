## Service database Table names: version 2

- customer_contact
  - id  bigint pk identity
  
  - is_active
  - created_at  timestamptz NOT NULL DEFAULT now()
  - updated_at  timestamptz NOT NULL DEFAULT now()

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
  - country_code text default 'IN'
  - remarks text

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

- state
  CREATE TABLE public.state (
    id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code text NOT NULL,        -- WB, MH, DL
    name text NOT NULL,        -- West Bengal
    country_code char(2) NOT NULL DEFAULT 'IN',

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
    code text,                 -- optional internal code
    is_active boolean DEFAULT true NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX city_state_name_uidx
    ON city(state_id, name);

    CREATE INDEX city_state_id_idx
    ON city(state_id);

- branch
  CREATE TABLE public.branch (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    bu_id bigint NOT NULL
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

    phone text NOT NULL,
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
    ON technician(bu_id, code);

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



- job_transaction

- job_part_used

- job_invoice

- job_payment

- job_receive_type

- job_receive_source

- job_status

- job_transaction_type

- product

- brand

- product_brand_model

- app_setting

- fiscal_year

- supplier

- spare_part

- spare_part_stock_summary: logical table

- spare_part__brand_casio: partioned table

- spare_part__brand_sony: partioned table

- spare_part__brand_nikon: partioned table

- purchase_invoice

- purchase_line_item

- sales_invoice

- sales_line_item

- technician


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
