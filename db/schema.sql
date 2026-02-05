-- ============================================================================
-- Database Schema for Electronic Gadgets Repairing Shop
-- Generated based on tran.md specifications
-- ============================================================================

-- ============================================================================
-- STEP 1: LOOKUP/REFERENCE TABLES
-- ============================================================================

-- State table
CREATE TABLE state (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_state_name UNIQUE (name)
);

COMMENT ON TABLE state IS 'Stores list of states/provinces';

-- City table
CREATE TABLE city (
    id SERIAL PRIMARY KEY,
    state_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_city_state FOREIGN KEY (state_id) REFERENCES state(id),
    CONSTRAINT uq_city_state_name UNIQUE (state_id, name)
);

CREATE INDEX idx_city_state_id ON city(state_id);

COMMENT ON TABLE city IS 'Stores cities with reference to state';

-- Job Status table
CREATE TABLE job_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_job_status_name UNIQUE (name)
);

COMMENT ON TABLE job_status IS 'Status values for jobs (Received, In Progress, Completed, etc.)';

-- Job Receive Type table
CREATE TABLE job_receive_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_job_receive_type_name UNIQUE (name)
);

COMMENT ON TABLE job_receive_type IS 'How job was received (Walk-in, Pickup, Courier, etc.)';

-- Job Receive Source table
CREATE TABLE job_receive_source (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_job_receive_source_name UNIQUE (name)
);

COMMENT ON TABLE job_receive_source IS 'Source of job (Direct, Referral, Online, Advertisement, etc.)';

-- Job Transaction Type table
CREATE TABLE job_transaction_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_job_transaction_type_name UNIQUE (name)
);

COMMENT ON TABLE job_transaction_type IS 'Types of job transactions (Status Change, Note Added, Part Used, etc.)';

-- Brand table
CREATE TABLE brand (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_brand_name UNIQUE (name)
);

COMMENT ON TABLE brand IS 'Electronic brands (Casio, Sony, Nikon, etc.)';

-- Product table
CREATE TABLE product (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_product_name UNIQUE (name)
);

COMMENT ON TABLE product IS 'Product categories (Watch, Camera, TV, Mobile, etc.)';

-- ============================================================================
-- STEP 2: MASTER TABLES
-- ============================================================================

-- Branch table
CREATE TABLE branch (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    address VARCHAR(500),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_main_branch BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_branch_city FOREIGN KEY (city_id) REFERENCES city(id),
    CONSTRAINT uq_branch_code UNIQUE (code),
    CONSTRAINT chk_branch_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_branch_city_id ON branch(city_id);
CREATE INDEX idx_branch_name ON branch(name);

COMMENT ON TABLE branch IS 'Company branches/service centers';

-- Customer Contact table
CREATE TABLE customer_contact (
    id SERIAL PRIMARY KEY,
    city_id INTEGER,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    full_name VARCHAR(100) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(last_name, '')) STORED,
    phone VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(500),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_customer_contact_city FOREIGN KEY (city_id) REFERENCES city(id),
    CONSTRAINT chk_customer_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_customer_contact_city_id ON customer_contact(city_id);
CREATE INDEX idx_customer_contact_phone ON customer_contact(phone);
CREATE INDEX idx_customer_contact_email ON customer_contact(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customer_contact_full_name ON customer_contact(full_name);

COMMENT ON TABLE customer_contact IS 'Customer information for the repair shop';

-- Technician table
CREATE TABLE technician (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    employee_code VARCHAR(20),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    full_name VARCHAR(100) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(last_name, '')) STORED,
    phone VARCHAR(20),
    email VARCHAR(100),
    specialization VARCHAR(255),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_technician_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT uq_technician_employee_code UNIQUE (employee_code),
    CONSTRAINT chk_technician_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_technician_branch_id ON technician(branch_id);
CREATE INDEX idx_technician_full_name ON technician(full_name);

COMMENT ON TABLE technician IS 'Technician/repair staff details';

-- Supplier table
CREATE TABLE supplier (
    id SERIAL PRIMARY KEY,
    city_id INTEGER,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(500),
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_supplier_city FOREIGN KEY (city_id) REFERENCES city(id),
    CONSTRAINT chk_supplier_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_supplier_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT chk_supplier_credit_days CHECK (credit_days >= 0)
);

CREATE INDEX idx_supplier_city_id ON supplier(city_id);
CREATE INDEX idx_supplier_name ON supplier(name);

COMMENT ON TABLE supplier IS 'Supplier/vendor information for spare parts';

-- Product Brand Model table
CREATE TABLE product_brand_model (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    brand_id INTEGER NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_number VARCHAR(50),
    specifications TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_product_brand_model_product FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT fk_product_brand_model_brand FOREIGN KEY (brand_id) REFERENCES brand(id),
    CONSTRAINT uq_product_brand_model UNIQUE (product_id, brand_id, model_name)
);

CREATE INDEX idx_product_brand_model_product_id ON product_brand_model(product_id);
CREATE INDEX idx_product_brand_model_brand_id ON product_brand_model(brand_id);
CREATE INDEX idx_product_brand_model_name ON product_brand_model(model_name);

COMMENT ON TABLE product_brand_model IS 'Product models linking product category and brand';

-- Fiscal Year table
CREATE TABLE fiscal_year (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_fiscal_year_name UNIQUE (name),
    CONSTRAINT chk_fiscal_year_dates CHECK (end_date > start_date)
);

COMMENT ON TABLE fiscal_year IS 'Financial year definitions';

-- App Setting table
CREATE TABLE app_setting (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'STRING',
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_app_setting_key UNIQUE (setting_key),
    CONSTRAINT chk_app_setting_type CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE'))
);

COMMENT ON TABLE app_setting IS 'Application configuration settings';

-- ============================================================================
-- STEP 3: JOB MANAGEMENT TABLES
-- ============================================================================

-- Job table
CREATE TABLE job (
    id SERIAL PRIMARY KEY,
    job_number VARCHAR(30) NOT NULL,
    customer_contact_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    technician_id INTEGER,
    product_brand_model_id INTEGER,
    job_status_id INTEGER NOT NULL,
    job_receive_type_id INTEGER,
    job_receive_source_id INTEGER,
    fiscal_year_id INTEGER,
    serial_number VARCHAR(100),
    problem_description TEXT NOT NULL,
    diagnosis TEXT,
    resolution TEXT,
    estimated_cost DECIMAL(12, 2),
    final_cost DECIMAL(12, 2),
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_completion_date DATE,
    actual_completion_date TIMESTAMP,
    delivery_date TIMESTAMP,
    warranty_end_date DATE,
    is_under_warranty BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_job_customer_contact FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id),
    CONSTRAINT fk_job_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT fk_job_technician FOREIGN KEY (technician_id) REFERENCES technician(id),
    CONSTRAINT fk_job_product_brand_model FOREIGN KEY (product_brand_model_id) REFERENCES product_brand_model(id),
    CONSTRAINT fk_job_status FOREIGN KEY (job_status_id) REFERENCES job_status(id),
    CONSTRAINT fk_job_receive_type FOREIGN KEY (job_receive_type_id) REFERENCES job_receive_type(id),
    CONSTRAINT fk_job_receive_source FOREIGN KEY (job_receive_source_id) REFERENCES job_receive_source(id),
    CONSTRAINT fk_job_fiscal_year FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_year(id),
    CONSTRAINT uq_job_number UNIQUE (job_number),
    CONSTRAINT chk_job_estimated_cost CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CONSTRAINT chk_job_final_cost CHECK (final_cost IS NULL OR final_cost >= 0)
);

CREATE INDEX idx_job_customer_contact_id ON job(customer_contact_id);
CREATE INDEX idx_job_branch_id ON job(branch_id);
CREATE INDEX idx_job_technician_id ON job(technician_id);
CREATE INDEX idx_job_product_brand_model_id ON job(product_brand_model_id);
CREATE INDEX idx_job_status_id ON job(job_status_id);
CREATE INDEX idx_job_receive_type_id ON job(job_receive_type_id);
CREATE INDEX idx_job_receive_source_id ON job(job_receive_source_id);
CREATE INDEX idx_job_fiscal_year_id ON job(fiscal_year_id);
CREATE INDEX idx_job_received_date ON job(received_date);
CREATE INDEX idx_job_job_number ON job(job_number);
CREATE INDEX idx_job_serial_number ON job(serial_number) WHERE serial_number IS NOT NULL;

COMMENT ON TABLE job IS 'Main job/repair order table';

-- Job Transaction table
CREATE TABLE job_transaction (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    job_transaction_type_id INTEGER NOT NULL,
    previous_status_id INTEGER,
    new_status_id INTEGER,
    description TEXT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_transaction_job FOREIGN KEY (job_id) REFERENCES job(id),
    CONSTRAINT fk_job_transaction_type FOREIGN KEY (job_transaction_type_id) REFERENCES job_transaction_type(id),
    CONSTRAINT fk_job_transaction_prev_status FOREIGN KEY (previous_status_id) REFERENCES job_status(id),
    CONSTRAINT fk_job_transaction_new_status FOREIGN KEY (new_status_id) REFERENCES job_status(id)
);

CREATE INDEX idx_job_transaction_job_id ON job_transaction(job_id);
CREATE INDEX idx_job_transaction_type_id ON job_transaction(job_transaction_type_id);
CREATE INDEX idx_job_transaction_date ON job_transaction(transaction_date);

COMMENT ON TABLE job_transaction IS 'Transaction/audit history for jobs';

-- Job Invoice table
CREATE TABLE job_invoice (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    invoice_number VARCHAR(30) NOT NULL,
    invoice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_job_invoice_job FOREIGN KEY (job_id) REFERENCES job(id),
    CONSTRAINT uq_job_invoice_number UNIQUE (invoice_number),
    CONSTRAINT chk_job_invoice_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_job_invoice_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_job_invoice_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_job_invoice_total CHECK (total_amount >= 0),
    CONSTRAINT chk_job_invoice_paid CHECK (paid_amount >= 0)
);

CREATE INDEX idx_job_invoice_job_id ON job_invoice(job_id);
CREATE INDEX idx_job_invoice_number ON job_invoice(invoice_number);
CREATE INDEX idx_job_invoice_date ON job_invoice(invoice_date);

COMMENT ON TABLE job_invoice IS 'Invoices generated for repair jobs';

-- Job Payment table
CREATE TABLE job_payment (
    id SERIAL PRIMARY KEY,
    job_invoice_id INTEGER NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_job_payment_invoice FOREIGN KEY (job_invoice_id) REFERENCES job_invoice(id),
    CONSTRAINT chk_job_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_job_payment_method CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'))
);

CREATE INDEX idx_job_payment_invoice_id ON job_payment(job_invoice_id);
CREATE INDEX idx_job_payment_date ON job_payment(payment_date);

COMMENT ON TABLE job_payment IS 'Payment records for job invoices';

-- ============================================================================
-- STEP 4: INVENTORY TABLES (with Partitioning)
-- ============================================================================

-- Spare Part table (Parent table for partitioning)
CREATE TABLE spare_part (
    id SERIAL,
    brand_id INTEGER NOT NULL,
    part_number VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    unit VARCHAR(20) DEFAULT 'PCS',
    cost_price DECIMAL(12, 2) DEFAULT 0,
    selling_price DECIMAL(12, 2) DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (id, brand_id),
    CONSTRAINT chk_spare_part_cost CHECK (cost_price >= 0),
    CONSTRAINT chk_spare_part_selling CHECK (selling_price >= 0),
    CONSTRAINT chk_spare_part_reorder CHECK (reorder_level >= 0)
) PARTITION BY LIST (brand_id);

CREATE INDEX idx_spare_part_brand_id ON spare_part(brand_id);
CREATE INDEX idx_spare_part_part_number ON spare_part(part_number);
CREATE INDEX idx_spare_part_name ON spare_part(name);

COMMENT ON TABLE spare_part IS 'Master spare parts table (partitioned by brand)';

-- Partition for Casio (assuming brand_id = 1)
CREATE TABLE spare_part__brand_casio PARTITION OF spare_part
    FOR VALUES IN (1);

COMMENT ON TABLE spare_part__brand_casio IS 'Spare parts partition for Casio brand';

-- Partition for Sony (assuming brand_id = 2)
CREATE TABLE spare_part__brand_sony PARTITION OF spare_part
    FOR VALUES IN (2);

COMMENT ON TABLE spare_part__brand_sony IS 'Spare parts partition for Sony brand';

-- Partition for Nikon (assuming brand_id = 3)
CREATE TABLE spare_part__brand_nikon PARTITION OF spare_part
    FOR VALUES IN (3);

COMMENT ON TABLE spare_part__brand_nikon IS 'Spare parts partition for Nikon brand';

-- Default partition for other brands
CREATE TABLE spare_part__brand_other PARTITION OF spare_part
    DEFAULT;

COMMENT ON TABLE spare_part__brand_other IS 'Spare parts partition for other brands';

-- Job Part Used table
CREATE TABLE job_part_used (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    spare_part_id INTEGER NOT NULL,
    spare_part_brand_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_job_part_used_job FOREIGN KEY (job_id) REFERENCES job(id),
    CONSTRAINT fk_job_part_used_spare_part FOREIGN KEY (spare_part_id, spare_part_brand_id) REFERENCES spare_part(id, brand_id),
    CONSTRAINT chk_job_part_used_qty CHECK (quantity > 0),
    CONSTRAINT chk_job_part_used_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_job_part_used_job_id ON job_part_used(job_id);
CREATE INDEX idx_job_part_used_spare_part_id ON job_part_used(spare_part_id, spare_part_brand_id);

COMMENT ON TABLE job_part_used IS 'Parts used in repair jobs';

-- ============================================================================
-- STEP 5: PURCHASE MANAGEMENT TABLES
-- ============================================================================

-- Purchase Invoice table
CREATE TABLE purchase_invoice (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    fiscal_year_id INTEGER,
    invoice_number VARCHAR(50) NOT NULL,
    supplier_invoice_number VARCHAR(50),
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status VARCHAR(20) DEFAULT 'DRAFT',
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_purchase_invoice_supplier FOREIGN KEY (supplier_id) REFERENCES supplier(id),
    CONSTRAINT fk_purchase_invoice_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT fk_purchase_invoice_fiscal_year FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_year(id),
    CONSTRAINT uq_purchase_invoice_number UNIQUE (invoice_number),
    CONSTRAINT chk_purchase_invoice_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_purchase_invoice_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_purchase_invoice_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_purchase_invoice_shipping CHECK (shipping_amount >= 0),
    CONSTRAINT chk_purchase_invoice_total CHECK (total_amount >= 0),
    CONSTRAINT chk_purchase_invoice_paid CHECK (paid_amount >= 0),
    CONSTRAINT chk_purchase_invoice_status CHECK (status IN ('DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'))
);

CREATE INDEX idx_purchase_invoice_supplier_id ON purchase_invoice(supplier_id);
CREATE INDEX idx_purchase_invoice_branch_id ON purchase_invoice(branch_id);
CREATE INDEX idx_purchase_invoice_fiscal_year_id ON purchase_invoice(fiscal_year_id);
CREATE INDEX idx_purchase_invoice_date ON purchase_invoice(invoice_date);
CREATE INDEX idx_purchase_invoice_status ON purchase_invoice(status);

COMMENT ON TABLE purchase_invoice IS 'Purchase invoices from suppliers';

-- Purchase Line Item table
CREATE TABLE purchase_line_item (
    id SERIAL PRIMARY KEY,
    purchase_invoice_id INTEGER NOT NULL,
    spare_part_id INTEGER NOT NULL,
    spare_part_brand_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_rate DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_purchase_line_item_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoice(id),
    CONSTRAINT fk_purchase_line_item_spare_part FOREIGN KEY (spare_part_id, spare_part_brand_id) REFERENCES spare_part(id, brand_id),
    CONSTRAINT chk_purchase_line_qty CHECK (quantity > 0),
    CONSTRAINT chk_purchase_line_price CHECK (unit_price >= 0),
    CONSTRAINT chk_purchase_line_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT chk_purchase_line_discount_rate CHECK (discount_rate >= 0 AND discount_rate <= 100),
    CONSTRAINT chk_purchase_line_received CHECK (received_quantity >= 0)
);

CREATE INDEX idx_purchase_line_item_invoice_id ON purchase_line_item(purchase_invoice_id);
CREATE INDEX idx_purchase_line_item_spare_part_id ON purchase_line_item(spare_part_id, spare_part_brand_id);

COMMENT ON TABLE purchase_line_item IS 'Line items for purchase invoices';

-- ============================================================================
-- STEP 6: SALES MANAGEMENT TABLES
-- ============================================================================

-- Sales Invoice table
CREATE TABLE sales_invoice (
    id SERIAL PRIMARY KEY,
    customer_contact_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    fiscal_year_id INTEGER,
    invoice_number VARCHAR(30) NOT NULL,
    invoice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status VARCHAR(20) DEFAULT 'DRAFT',
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_sales_invoice_customer FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id),
    CONSTRAINT fk_sales_invoice_branch FOREIGN KEY (branch_id) REFERENCES branch(id),
    CONSTRAINT fk_sales_invoice_fiscal_year FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_year(id),
    CONSTRAINT uq_sales_invoice_number UNIQUE (invoice_number),
    CONSTRAINT chk_sales_invoice_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_sales_invoice_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_sales_invoice_discount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sales_invoice_total CHECK (total_amount >= 0),
    CONSTRAINT chk_sales_invoice_paid CHECK (paid_amount >= 0),
    CONSTRAINT chk_sales_invoice_status CHECK (status IN ('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'))
);

CREATE INDEX idx_sales_invoice_customer_id ON sales_invoice(customer_contact_id);
CREATE INDEX idx_sales_invoice_branch_id ON sales_invoice(branch_id);
CREATE INDEX idx_sales_invoice_fiscal_year_id ON sales_invoice(fiscal_year_id);
CREATE INDEX idx_sales_invoice_date ON sales_invoice(invoice_date);
CREATE INDEX idx_sales_invoice_number ON sales_invoice(invoice_number);
CREATE INDEX idx_sales_invoice_status ON sales_invoice(status);

COMMENT ON TABLE sales_invoice IS 'Sales invoices for spare parts sold to customers';

-- Sales Line Item table
CREATE TABLE sales_line_item (
    id SERIAL PRIMARY KEY,
    sales_invoice_id INTEGER NOT NULL,
    spare_part_id INTEGER NOT NULL,
    spare_part_brand_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_rate DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_sales_line_item_invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoice(id),
    CONSTRAINT fk_sales_line_item_spare_part FOREIGN KEY (spare_part_id, spare_part_brand_id) REFERENCES spare_part(id, brand_id),
    CONSTRAINT chk_sales_line_qty CHECK (quantity > 0),
    CONSTRAINT chk_sales_line_price CHECK (unit_price >= 0),
    CONSTRAINT chk_sales_line_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT chk_sales_line_discount_rate CHECK (discount_rate >= 0 AND discount_rate <= 100)
);

CREATE INDEX idx_sales_line_item_invoice_id ON sales_line_item(sales_invoice_id);
CREATE INDEX idx_sales_line_item_spare_part_id ON sales_line_item(spare_part_id, spare_part_brand_id);

COMMENT ON TABLE sales_line_item IS 'Line items for sales invoices';

-- ============================================================================
-- STEP 12: VIEWS
-- ============================================================================

-- Spare Part Stock Summary View (Logical table)
CREATE VIEW spare_part_stock_summary AS
SELECT
    sp.id AS spare_part_id,
    sp.brand_id,
    sp.part_number,
    sp.name,
    b.name AS brand_name,
    sp.unit,
    sp.cost_price,
    sp.selling_price,
    sp.reorder_level,
    COALESCE(purchased.total_purchased, 0) AS total_purchased,
    COALESCE(sold.total_sold, 0) AS total_sold,
    COALESCE(used.total_used, 0) AS total_used_in_jobs,
    COALESCE(purchased.total_purchased, 0) - COALESCE(sold.total_sold, 0) - COALESCE(used.total_used, 0) AS current_stock,
    CASE
        WHEN (COALESCE(purchased.total_purchased, 0) - COALESCE(sold.total_sold, 0) - COALESCE(used.total_used, 0)) <= sp.reorder_level
        THEN TRUE
        ELSE FALSE
    END AS needs_reorder
FROM spare_part sp
LEFT JOIN brand b ON sp.brand_id = b.id
LEFT JOIN (
    SELECT spare_part_id, spare_part_brand_id, SUM(received_quantity) AS total_purchased
    FROM purchase_line_item pli
    JOIN purchase_invoice pi ON pli.purchase_invoice_id = pi.id AND pi.is_cancelled = FALSE
    GROUP BY spare_part_id, spare_part_brand_id
) purchased ON sp.id = purchased.spare_part_id AND sp.brand_id = purchased.spare_part_brand_id
LEFT JOIN (
    SELECT spare_part_id, spare_part_brand_id, SUM(quantity) AS total_sold
    FROM sales_line_item sli
    JOIN sales_invoice si ON sli.sales_invoice_id = si.id AND si.is_cancelled = FALSE
    GROUP BY spare_part_id, spare_part_brand_id
) sold ON sp.id = sold.spare_part_id AND sp.brand_id = sold.spare_part_brand_id
LEFT JOIN (
    SELECT spare_part_id, spare_part_brand_id, SUM(quantity) AS total_used
    FROM job_part_used
    GROUP BY spare_part_id, spare_part_brand_id
) used ON sp.id = used.spare_part_id AND sp.brand_id = used.spare_part_brand_id
WHERE sp.is_active = TRUE;

COMMENT ON VIEW spare_part_stock_summary IS 'Logical view showing stock summary for spare parts';

-- ============================================================================
-- SEED DATA FOR LOOKUP TABLES
-- ============================================================================

-- Insert default Job Statuses
INSERT INTO job_status (name, description, display_order) VALUES
('Received', 'Job has been received', 1),
('Diagnosed', 'Problem has been diagnosed', 2),
('Waiting for Parts', 'Waiting for spare parts', 3),
('In Progress', 'Repair work in progress', 4),
('Completed', 'Repair completed', 5),
('Ready for Delivery', 'Ready for customer pickup/delivery', 6),
('Delivered', 'Delivered to customer', 7),
('Cancelled', 'Job cancelled', 8);

-- Insert default Job Receive Types
INSERT INTO job_receive_type (name, description) VALUES
('Walk-in', 'Customer brought item to shop'),
('Pickup', 'Item picked up from customer location'),
('Courier', 'Item received via courier');

-- Insert default Job Receive Sources
INSERT INTO job_receive_source (name, description) VALUES
('Direct', 'Direct walk-in customer'),
('Referral', 'Referred by existing customer'),
('Online', 'Online inquiry/booking'),
('Advertisement', 'Through advertisement'),
('Corporate', 'Corporate/business client');

-- Insert default Job Transaction Types
INSERT INTO job_transaction_type (name, description) VALUES
('Status Change', 'Job status was changed'),
('Note Added', 'Note was added to job'),
('Part Used', 'Spare part was used'),
('Technician Assigned', 'Technician was assigned'),
('Cost Updated', 'Cost estimate was updated'),
('Invoice Generated', 'Invoice was generated'),
('Payment Received', 'Payment was received');

-- Insert default Brands (for partitioning)
INSERT INTO brand (name) VALUES
('Casio'),
('Sony'),
('Nikon'),
('Canon'),
('Samsung'),
('LG'),
('Panasonic'),
('Apple'),
('Other');

-- Insert default Products
INSERT INTO product (name, description) VALUES
('Watch', 'Wrist watches and clocks'),
('Camera', 'Digital and film cameras'),
('Television', 'TVs and monitors'),
('Mobile Phone', 'Smartphones and basic phones'),
('Laptop', 'Notebooks and laptops'),
('Audio System', 'Speakers, headphones, amplifiers'),
('Gaming Console', 'Video game consoles'),
('Kitchen Appliance', 'Microwaves, mixers, etc.'),
('Other', 'Other electronic gadgets');

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER tr_state_updated_at BEFORE UPDATE ON state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_city_updated_at BEFORE UPDATE ON city FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_status_updated_at BEFORE UPDATE ON job_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_receive_type_updated_at BEFORE UPDATE ON job_receive_type FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_receive_source_updated_at BEFORE UPDATE ON job_receive_source FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_transaction_type_updated_at BEFORE UPDATE ON job_transaction_type FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_brand_updated_at BEFORE UPDATE ON brand FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_product_updated_at BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_branch_updated_at BEFORE UPDATE ON branch FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_customer_contact_updated_at BEFORE UPDATE ON customer_contact FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_technician_updated_at BEFORE UPDATE ON technician FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_supplier_updated_at BEFORE UPDATE ON supplier FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_product_brand_model_updated_at BEFORE UPDATE ON product_brand_model FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_fiscal_year_updated_at BEFORE UPDATE ON fiscal_year FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_app_setting_updated_at BEFORE UPDATE ON app_setting FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_updated_at BEFORE UPDATE ON job FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_invoice_updated_at BEFORE UPDATE ON job_invoice FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_payment_updated_at BEFORE UPDATE ON job_payment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_spare_part_updated_at BEFORE UPDATE ON spare_part FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_job_part_used_updated_at BEFORE UPDATE ON job_part_used FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_purchase_invoice_updated_at BEFORE UPDATE ON purchase_invoice FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_purchase_line_item_updated_at BEFORE UPDATE ON purchase_line_item FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_sales_invoice_updated_at BEFORE UPDATE ON sales_invoice FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_sales_line_item_updated_at BEFORE UPDATE ON sales_line_item FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER FOR JOB INVOICE PAID AMOUNT UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_job_invoice_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE job_invoice
        SET paid_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM job_payment
            WHERE job_invoice_id = OLD.job_invoice_id AND is_cancelled = FALSE
        )
        WHERE id = OLD.job_invoice_id;
        RETURN OLD;
    ELSE
        UPDATE job_invoice
        SET paid_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM job_payment
            WHERE job_invoice_id = NEW.job_invoice_id AND is_cancelled = FALSE
        )
        WHERE id = NEW.job_invoice_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_job_payment_update_invoice
AFTER INSERT OR UPDATE OR DELETE ON job_payment
FOR EACH ROW EXECUTE FUNCTION update_job_invoice_paid_amount();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
