-- =============================================================================
-- Service Plus Database Schema
-- Complete schema creation script for service management system
-- Schema: service
-- Generated from: db_design2.md
-- =============================================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS service;

-- Set search path
SET search_path TO service;

-- =============================================================================
-- TABLE DEFINITIONS
-- Tables are ordered by dependency (master/lookup tables first)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table 1: state
-- Master table for states/union territories
-- -----------------------------------------------------------------------------
CREATE TABLE state (
  id integer NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'IN',
  gst_state_code char(2),
  is_union_territory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT state_code_uidx UNIQUE (code),
  CONSTRAINT state_name_uidx UNIQUE (name),
  CONSTRAINT state_code_check CHECK (code ~ '^[A-Z]{2}$'),
  CONSTRAINT country_code_check CHECK (country_code ~ '^[A-Z]{2}$')
);

-- -----------------------------------------------------------------------------
-- Table 2: app_setting
-- Application configuration settings
-- -----------------------------------------------------------------------------
CREATE TABLE app_setting (
  id smallint NOT NULL PRIMARY KEY,
  setting_key text NOT NULL,
  setting_type text NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  is_editable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_setting_key_uidx UNIQUE (setting_key),
  CONSTRAINT app_setting_type_check CHECK (setting_type IN ('TEXT', 'INTEGER', 'BOOLEAN', 'JSON'))
);

-- -----------------------------------------------------------------------------
-- Table 3: financial_year
-- Financial year periods
-- -----------------------------------------------------------------------------
CREATE TABLE financial_year (
  id integer NOT NULL PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  CONSTRAINT financial_year_date_check CHECK (start_date < end_date)
);

-- -----------------------------------------------------------------------------
-- Table 4: customer_type
-- Customer classification lookup
-- -----------------------------------------------------------------------------
CREATE TABLE customer_type (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order smallint,
  CONSTRAINT customer_type_code_uidx UNIQUE (code)
);

-- -----------------------------------------------------------------------------
-- Table 5: company_info
-- Company/business information
-- NOTE: References bu table which is not defined in db_design2.md
-- -----------------------------------------------------------------------------
CREATE TABLE company_info (
  id integer NOT NULL PRIMARY KEY,
  company_name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text,
  state_id integer NOT NULL,
  country text DEFAULT 'IN',
  pincode text,
  phone text,
  email text,
  gstin text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_info_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- Table 6: supplier
-- Supplier master data
-- -----------------------------------------------------------------------------
CREATE TABLE supplier (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  is_active boolean NOT NULL DEFAULT true,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_name_key UNIQUE (name),
  CONSTRAINT supplier_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- Table 7: customer_contact
-- Customer contact information
-- -----------------------------------------------------------------------------
CREATE TABLE customer_contact (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_contact_type_fk FOREIGN KEY (customer_type_id) REFERENCES customer_type(id) ON DELETE RESTRICT,
  CONSTRAINT customer_contact_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT
);

CREATE INDEX idx_customer_contact_mobile ON customer_contact (mobile);

-- -----------------------------------------------------------------------------
-- Table 8: product
-- Product type master (e.g., CAMERA, TV, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE product (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_name_key UNIQUE (name),
  CONSTRAINT product_name_check CHECK (name ~ '^[A-Z_]+$')
);

-- -----------------------------------------------------------------------------
-- Table 9: brand
-- Brand master (e.g., SONY, NIKON, CASIO)
-- -----------------------------------------------------------------------------
CREATE TABLE brand (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_code_key UNIQUE (code),
  CONSTRAINT brand_code_check CHECK (code ~ '^[A-Z_]+$')
);

-- -----------------------------------------------------------------------------
-- Table 10: product_brand_model
-- Junction table for product-brand-model combinations
-- -----------------------------------------------------------------------------
CREATE TABLE product_brand_model (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL,
  brand_id bigint NOT NULL,
  model_name text NOT NULL,
  launch_year integer,
  remarks text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pbm_unique_model UNIQUE (product_id, brand_id, model_name),
  CONSTRAINT pbm_product_fk FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT,
  CONSTRAINT pbm_brand_fk FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- Table 11: document_type
-- Document type lookup (JOB, RECEIPT, INVOICE, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE document_type (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  prefix text NOT NULL,
  name text NOT NULL,
  description text,
  CONSTRAINT document_type_code_uidx UNIQUE (code),
  CONSTRAINT document_type_code_chk CHECK (code ~ '^[A-Z_]+$')
);

-- -----------------------------------------------------------------------------
-- Table 12: stock_transaction_type
-- Stock transaction type lookup (PURCHASE, SALE, ADJUSTMENT, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE stock_transaction_type (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  dr_cr char(1) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT stock_transaction_type_code_uidx UNIQUE (code),
  CONSTRAINT stock_transaction_type_dr_cr_check CHECK (dr_cr IN ('D', 'C'))
);

-- -----------------------------------------------------------------------------
-- Table 13: branch
-- Branch/location master
-- NOTE: References bu table which is not defined in db_design2.md
-- You may need to create the bu table or remove this FK constraint
-- -----------------------------------------------------------------------------
CREATE TABLE branch (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  is_active boolean NOT NULL DEFAULT true,
  is_head_office boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_bu_code_uidx UNIQUE (bu_id, code),
  CONSTRAINT branch_code_check CHECK (code ~ '^[A-Z0-9_]+$'),
  CONSTRAINT branch_gstin_check CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT branch_state_fk FOREIGN KEY (state_id) REFERENCES state(id) ON DELETE RESTRICT
);

CREATE INDEX branch_state_idx ON branch (state_id);

-- -----------------------------------------------------------------------------
-- Table 14: technician
-- Technician master
-- -----------------------------------------------------------------------------
CREATE TABLE technician (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id bigint NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  specialization text,
  leaving_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technician_bu_code_uidx UNIQUE (branch_id, code),
  CONSTRAINT technician_code_check CHECK (code ~ '^[A-Z0-9_]+$'),
  CONSTRAINT technician_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT
);

CREATE INDEX technician_phone_idx ON technician (phone);

-- -----------------------------------------------------------------------------
-- Table 15: document_sequence
-- Document numbering sequence management
-- -----------------------------------------------------------------------------
CREATE TABLE document_sequence (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_type_id smallint NOT NULL,
  branch_id bigint NOT NULL,
  prefix text NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  padding smallint NOT NULL DEFAULT 5,
  separator text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_sequence_unique UNIQUE (document_type_id, branch_id),
  CONSTRAINT document_sequence_type_fk FOREIGN KEY (document_type_id) REFERENCES document_type(id) ON DELETE RESTRICT,
  CONSTRAINT document_sequence_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- Table 16: job_type
-- Job type lookup (WORKSHOP, HOME_SERVICE, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_type (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  display_order smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_type_code_uidx UNIQUE (code)
);

-- -----------------------------------------------------------------------------
-- Table 17: job_receive_manner
-- How job was received (WALK_IN, COURIER, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_receive_manner (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_receive_manner_code_uidx UNIQUE (code)
);

-- -----------------------------------------------------------------------------
-- Table 18: job_receive_condition
-- Condition of item when received (DEAD, DAMAGED, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_receive_condition (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  display_order smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_receive_condition_code_uidx UNIQUE (code)
);

-- -----------------------------------------------------------------------------
-- Table 19: job_status
-- Job status lookup (NEW, IN_PROGRESS, DELIVERED, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_status (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  display_order smallint NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_status_code_uidx UNIQUE (code),
  CONSTRAINT job_status_code_check CHECK (code ~ '^[A-Z_]+$')
);

-- -----------------------------------------------------------------------------
-- Table 20: job_delivery_manner
-- How job will be delivered (CUSTOMER_PICKUP, COURIER, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_delivery_manner (
  id smallint NOT NULL PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  display_order smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_delivery_manner_code_uidx UNIQUE (code)
);

-- -----------------------------------------------------------------------------
-- Table 21: job
-- Main job/service card table
-- -----------------------------------------------------------------------------
CREATE TABLE job (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_no text NOT NULL,
  job_date date NOT NULL DEFAULT current_date,
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
  is_closed boolean NOT NULL DEFAULT false,
  is_warranty boolean NOT NULL DEFAULT false,
  warranty_card_no text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_no_uidx UNIQUE (job_no),
  CONSTRAINT job_branch_job_no_uidx UNIQUE (branch_id, job_no),
  CONSTRAINT job_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id) ON DELETE RESTRICT,
  CONSTRAINT job_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT,
  CONSTRAINT job_technician_fk FOREIGN KEY (technician_id) REFERENCES technician(id) ON DELETE RESTRICT,
  CONSTRAINT job_status_fk FOREIGN KEY (job_status_id) REFERENCES job_status(id) ON DELETE RESTRICT,
  CONSTRAINT job_type_fk FOREIGN KEY (job_type_id) REFERENCES job_type(id) ON DELETE RESTRICT,
  CONSTRAINT job_receive_manner_fk FOREIGN KEY (job_receive_manner_id) REFERENCES job_receive_manner(id) ON DELETE RESTRICT,
  CONSTRAINT job_receive_condition_fk FOREIGN KEY (job_receive_condition_id) REFERENCES job_receive_condition(id) ON DELETE RESTRICT,
  CONSTRAINT job_product_brand_model_fk FOREIGN KEY (product_brand_model_id) REFERENCES product_brand_model(id) ON DELETE RESTRICT
);

CREATE INDEX job_status_idx ON job (job_status_id);
CREATE INDEX job_technician_idx ON job (technician_id);
CREATE INDEX job_customer_idx ON job (customer_contact_id);
CREATE INDEX job_job_date_idx ON job (job_date);
CREATE INDEX job_branch_idx ON job (branch_id);
CREATE INDEX idx_job_delivery_date ON job (delivery_date);

-- -----------------------------------------------------------------------------
-- Table 22: job_transaction
-- Job transaction history/audit trail
-- NOTE: References "user" table which is not defined in db_design2.md
-- You may need to create the user table or remove this FK constraint
-- -----------------------------------------------------------------------------
CREATE TABLE job_transaction (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  status_id smallint,
  technician_id bigint,
  amount numeric(12,2),
  notes text,
  performed_by_user_id bigint NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_transaction_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE,
  CONSTRAINT job_transaction_status_fk FOREIGN KEY (status_id) REFERENCES job_status(id) ON DELETE RESTRICT,
  CONSTRAINT job_transaction_technician_fk FOREIGN KEY (technician_id) REFERENCES technician(id) ON DELETE RESTRICT
);

CREATE INDEX idx_job_transaction_job_id ON job_transaction (job_id);
CREATE INDEX idx_job_transaction_performed_at ON job_transaction (performed_at);
CREATE INDEX idx_job_transaction_status ON job_transaction (status_id);

-- -----------------------------------------------------------------------------
-- Table 23: job_payment
-- Job payment records
-- -----------------------------------------------------------------------------
CREATE TABLE job_payment (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  payment_date date NOT NULL,
  payment_mode text NOT NULL,
  amount numeric(14,2) NOT NULL,
  reference_no text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_payment_amount_check CHECK (amount > 0),
  CONSTRAINT job_payment_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_payment_job ON job_payment (job_id);
CREATE INDEX idx_job_payment_date ON job_payment (payment_date);

-- -----------------------------------------------------------------------------
-- Table 24: job_part_used
-- Spare parts used in jobs
-- -----------------------------------------------------------------------------
CREATE TABLE job_part_used (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  part_code text NOT NULL,
  brand_id bigint NOT NULL,
  quantity numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_part_used_quantity_check CHECK (quantity > 0),
  CONSTRAINT job_part_used_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE RESTRICT,
  CONSTRAINT job_part_used_brand_fk FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT
);

CREATE INDEX idx_job_part_used_job ON job_part_used (job_id);
CREATE INDEX idx_job_part_used_part ON job_part_used (part_code);

-- -----------------------------------------------------------------------------
-- Table 25: job_invoice
-- Job service invoices
-- -----------------------------------------------------------------------------
CREATE TABLE job_invoice (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id bigint NOT NULL,
  company_id smallint NOT NULL,
  invoice_no text NOT NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  supply_state_code char(2) NOT NULL,
  taxable_amount numeric(14,2) NOT NULL,
  cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  igst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_tax numeric(14,2) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_invoice_company_no_uidx UNIQUE (company_id, invoice_no),
  CONSTRAINT job_invoice_job_fk FOREIGN KEY (job_id) REFERENCES job(id) ON DELETE RESTRICT,
  CONSTRAINT job_invoice_company_fk FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE RESTRICT
);

CREATE INDEX idx_job_invoice_job ON job_invoice (job_id);

-- -----------------------------------------------------------------------------
-- Table 26: job_invoice_line
-- Job invoice line items
-- -----------------------------------------------------------------------------
CREATE TABLE job_invoice_line (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_invoice_id bigint NOT NULL,
  description text NOT NULL,
  hsn_code text NOT NULL,
  quantity numeric(10,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  taxable_amount numeric(12,2) NOT NULL,
  cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
  sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
  igst_rate numeric(5,2) NOT NULL DEFAULT 0,
  cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  igst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_invoice_line_quantity_check CHECK (quantity > 0),
  CONSTRAINT job_invoice_line_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT job_invoice_line_invoice_fk FOREIGN KEY (job_invoice_id) REFERENCES job_invoice(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_invoice_line_invoice ON job_invoice_line (job_invoice_id);

-- -----------------------------------------------------------------------------
-- Table 27: purchase_invoice
-- Purchase invoices from suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE purchase_invoice (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id bigint NOT NULL,
  invoice_no text NOT NULL,
  invoice_date date NOT NULL,
  supplier_state_code char(2) NOT NULL,
  taxable_amount numeric(14,2) NOT NULL,
  cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  igst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_tax numeric(14,2) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  branch_id bigint NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_invoice_supplier_no_uidx UNIQUE (supplier_id, invoice_no),
  CONSTRAINT purchase_invoice_supplier_fk FOREIGN KEY (supplier_id) REFERENCES supplier(id) ON DELETE RESTRICT,
  CONSTRAINT purchase_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_invoice_supplier ON purchase_invoice (supplier_id);

-- -----------------------------------------------------------------------------
-- Table 28: purchase_invoice_line
-- Purchase invoice line items
-- -----------------------------------------------------------------------------
CREATE TABLE purchase_invoice_line (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_invoice_id bigint NOT NULL,
  part_code text NOT NULL,
  brand_id bigint NOT NULL,
  hsn_code text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  taxable_amount numeric(12,2) NOT NULL,
  cgst_rate numeric(5,2) NOT NULL DEFAULT 0,
  sgst_rate numeric(5,2) NOT NULL DEFAULT 0,
  igst_rate numeric(5,2) NOT NULL DEFAULT 0,
  cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  igst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_invoice_line_quantity_check CHECK (quantity > 0),
  CONSTRAINT purchase_invoice_line_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT purchase_invoice_line_invoice_fk FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoice(id) ON DELETE CASCADE,
  CONSTRAINT purchase_invoice_line_brand_fk FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchase_invoice_line_spare_part ON purchase_invoice_line (part_code);

-- -----------------------------------------------------------------------------
-- Table 29: sales_invoice
-- Sales invoices for spare parts
-- -----------------------------------------------------------------------------
CREATE TABLE sales_invoice (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no text NOT NULL,
  invoice_date date NOT NULL,
  company_id bigint NOT NULL,
  customer_contact_id bigint,
  customer_name text NOT NULL,
  customer_gstin text,
  customer_state_code char(2) NOT NULL,
  taxable_amount numeric(14,2) NOT NULL,
  cgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(14,2) NOT NULL DEFAULT 0,
  igst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_tax numeric(14,2) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  branch_id bigint NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoice_company_no_uidx UNIQUE (company_id, invoice_no),
  CONSTRAINT sales_invoice_company_fk FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE RESTRICT,
  CONSTRAINT sales_invoice_customer_fk FOREIGN KEY (customer_contact_id) REFERENCES customer_contact(id) ON DELETE RESTRICT,
  CONSTRAINT sales_invoice_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_invoice_customer ON sales_invoice (customer_contact_id);

-- -----------------------------------------------------------------------------
-- Table 30: sales_invoice_line
-- Sales invoice line items
-- -----------------------------------------------------------------------------
CREATE TABLE sales_invoice_line (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sales_invoice_id bigint NOT NULL,
  part_code text NOT NULL,
  item_description text NOT NULL,
  hsn_code text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  gst_rate numeric(5,2) NOT NULL DEFAULT 0,
  taxable_amount numeric(12,2) NOT NULL,
  cgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(12,2) NOT NULL DEFAULT 0,
  igst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoice_line_quantity_check CHECK (quantity > 0),
  CONSTRAINT sales_invoice_line_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT sales_invoice_line_invoice_fk FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoice(id) ON DELETE CASCADE
);

CREATE INDEX idx_sales_invoice_line_spare_part ON sales_invoice_line (part_code);

-- -----------------------------------------------------------------------------
-- Table 31: stock_transaction
-- Stock transaction ledger (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE stock_transaction (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_id bigint NOT NULL,
  branch_id bigint NOT NULL,
  stock_transaction_type_id smallint NOT NULL,
  transaction_date date NOT NULL,
  dr_cr char(1) NOT NULL,
  qty numeric(12,3) NOT NULL,
  unit_cost numeric(12,2),
  source_table text NOT NULL,
  source_id bigint NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_transaction_dr_cr_check CHECK (dr_cr IN ('D', 'C')),
  CONSTRAINT stock_transaction_qty_check CHECK (qty > 0),
  CONSTRAINT stock_transaction_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT,
  CONSTRAINT stock_transaction_part_id_fk FOREIGN KEY (part_id) REFERENCES spare_part_master(id) ON DELETE RESTRICT,
  CONSTRAINT stock_transaction_type_fk FOREIGN KEY (stock_transaction_type_id) REFERENCES stock_transaction_type(id) ON DELETE RESTRICT
);

CREATE INDEX idx_stock_tx_part ON stock_transaction (part_id);
CREATE INDEX idx_stock_tx_date ON stock_transaction (transaction_date);
CREATE INDEX idx_stock_tx_type ON stock_transaction (stock_transaction_type_id);
CREATE INDEX idx_stock_tx_source ON stock_transaction (source_table, source_id);

-- -----------------------------------------------------------------------------
-- Table 32: stock_adjustment
-- Stock adjustment header
-- -----------------------------------------------------------------------------
CREATE TABLE stock_adjustment (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adjustment_date date NOT NULL,
  adjustment_reason text NOT NULL,
  ref_no text,
  branch_id bigint NOT NULL,
  remarks text,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_adjustment_branch_fk FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE RESTRICT
);

CREATE INDEX idx_stock_adj_date ON stock_adjustment (adjustment_date);

COMMENT ON COLUMN stock_adjustment.created_by IS 'Loosely coupled to user table - no FK constraint';

-- -----------------------------------------------------------------------------
-- Table 33: stock_adjustment_line
-- Stock adjustment line items
-- -----------------------------------------------------------------------------
CREATE TABLE stock_adjustment_line (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stock_adjustment_id bigint NOT NULL,
  part_code text NOT NULL,
  brand_id bigint NOT NULL,
  dr_cr char(1) NOT NULL,
  qty numeric(12,3) NOT NULL,
  unit_cost numeric(12,2),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_adjustment_line_dr_cr_check CHECK (dr_cr IN ('D', 'C')),
  CONSTRAINT stock_adjustment_line_qty_check CHECK (qty > 0),
  CONSTRAINT stock_adjustment_line_adjustment_fk FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustment(id) ON DELETE CASCADE,
  CONSTRAINT stock_adjustment_line_brand_fk FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT
);

CREATE INDEX idx_stock_adj_line_adj_id ON stock_adjustment_line (stock_adjustment_id);
CREATE INDEX idx_stock_adj_line_part ON stock_adjustment_line (part_code);

-- -----------------------------------------------------------------------------
-- Table 34: spare_part_sony
-- Sony spare parts catalog
-- -----------------------------------------------------------------------------
CREATE TABLE spare_part_sony (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_code text NOT NULL,
  part_name text NOT NULL,
  part_description text,
  category text,
  model text,
  uom text NOT NULL DEFAULT 'NOS',
  cost_price numeric(12,2),
  mrp numeric(12,2),
  hsn_code text,
  gst_rate numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spare_part_sony_part_code_uidx UNIQUE (part_code)
);

CREATE INDEX idx_sp_sony_name ON spare_part_sony (part_name);
CREATE INDEX idx_sp_sony_model ON spare_part_sony (model);

-- -----------------------------------------------------------------------------
-- Table 35: spare_part_casio
-- Casio spare parts catalog
-- -----------------------------------------------------------------------------
CREATE TABLE spare_part_casio (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_code text NOT NULL,
  part_name text NOT NULL,
  part_description text,
  category text,
  model text,
  uom text NOT NULL DEFAULT 'NOS',
  cost_price numeric(12,2),
  mrp numeric(12,2),
  hsn_code text,
  gst_rate numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spare_part_casio_part_code_uidx UNIQUE (part_code)
);

CREATE INDEX idx_sp_casio_name ON spare_part_casio (part_name);
CREATE INDEX idx_sp_casio_model ON spare_part_casio (model);

-- -----------------------------------------------------------------------------
-- Table 36: spare_part_nikon
-- Nikon spare parts catalog
-- -----------------------------------------------------------------------------
CREATE TABLE spare_part_nikon (
  id bigint NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  part_code text NOT NULL,
  part_name text NOT NULL,
  part_description text,
  category text,
  model text,
  uom text NOT NULL DEFAULT 'NOS',
  cost_price numeric(12,2),
  mrp numeric(12,2),
  hsn_code text,
  gst_rate numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spare_part_nikon_part_code_uidx UNIQUE (part_code)
);

CREATE INDEX idx_sp_nikon_name ON spare_part_nikon (part_name);
CREATE INDEX idx_sp_nikon_model ON spare_part_nikon (model);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- View 37: spare_part
-- Unified view of all spare parts across brands
-- -----------------------------------------------------------------------------
CREATE VIEW spare_part AS
SELECT
  'SONY' AS brand_code,
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
  is_active,
  created_at,
  updated_at
FROM spare_part_sony
UNION ALL
SELECT
  'CASIO' AS brand_code,
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
  is_active,
  created_at,
  updated_at
FROM spare_part_casio
UNION ALL
SELECT
  'NIKON' AS brand_code,
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
  is_active,
  created_at,
  updated_at
FROM spare_part_nikon;

-- -----------------------------------------------------------------------------
-- View 38: spare_part_stock_summary
-- Current stock summary by part, brand, and branch
-- -----------------------------------------------------------------------------
CREATE VIEW spare_part_stock_summary AS
SELECT
  part_code,
  brand_id,
  branch_id,
  SUM(
    CASE
      WHEN dr_cr = 'D' THEN qty
      WHEN dr_cr = 'C' THEN -qty
      ELSE 0
    END
  ) AS current_stock
FROM stock_transaction
GROUP BY part_code, brand_id, branch_id;

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seed data: customer_type
-- -----------------------------------------------------------------------------
INSERT INTO customer_type (id, code, name, display_order) VALUES
(1, 'INDIVIDUAL',       'Individual Customer',        1),
(2, 'SERVICE_PARTNER',  'Service Partner',             2),
(3, 'DEALER',           'Dealer',                      3),
(4, 'CORPORATE',        'Corporate / Institutional',   4),
(5, 'OTHER',            'Other',                       99);

-- -----------------------------------------------------------------------------
-- Seed data: document_type
-- -----------------------------------------------------------------------------
INSERT INTO document_type (id, code, prefix, name, description) VALUES
(1, 'JOB',           'JOB',  'Job Card',          'Service job card'),
(2, 'RECEIPT',       'RCPT', 'Receipt',           'Payment receipt'),
(3, 'SALE_INVOICE',  'SI',   'Sale Invoice',      'Spare part / product sale invoice'),
(4, 'JOB_INVOICE',   'JI',   'Job Invoice',       'Service job invoice'),
(5, 'PURCHASE',      'PI',   'Purchase Invoice',  'Purchase invoice from supplier');

-- -----------------------------------------------------------------------------
-- Seed data: job_type
-- -----------------------------------------------------------------------------
INSERT INTO job_type (id, code, name, display_order) VALUES
(1, 'WORKSHOP_GENERAL_REPAIR',      'Workshop - General Repair',      1),
(2, 'WORKSHOP_WARRANTY_REPAIR',     'Workshop - Warranty Repair',     2),
(3, 'WORKSHOP_ESTIMATE',            'Workshop - Estimate',            3),
(4, 'WORKSHOP_REPLACEMENT',         'Workshop - Replacement',         4),
(5, 'WORKSHOP_REPEAT_REPAIR',       'Workshop - Repeat Repair',       5),
(6, 'HOME_SERVICE_GENERAL_REPAIR',  'Home Service - General Repair',  6),
(7, 'HOME_SERVICE_WARRANTY_REPAIR', 'Home Service - Warranty Repair', 7),
(8, 'DEMO',                         'Demo',                           8),
(9, 'SERVICE_CONTRACT',             'Service Contract',               9);

-- -----------------------------------------------------------------------------
-- Seed data: job_receive_manner
-- -----------------------------------------------------------------------------
INSERT INTO job_receive_manner (id, code, name, display_order) VALUES
(1, 'WALK_IN',        'Walk-in',         1),
(2, 'COURIER',        'Courier',         2),
(3, 'PICKUP',         'Pickup',          3),
(4, 'ONLINE_BOOKING', 'Online Booking',  4),
(5, 'PHONE_BOOKING',  'Phone Booking',   5),
(6, 'MISC',           'Miscellaneous',   99);

-- -----------------------------------------------------------------------------
-- Seed data: job_receive_condition
-- -----------------------------------------------------------------------------
INSERT INTO job_receive_condition (id, code, name, display_order) VALUES
(1, 'DEAD',               'Dead / Not Powering On',  1),
(2, 'DAMAGED',            'Damaged',                 2),
(3, 'PHYSICALLY_BROKEN',  'Physically Broken',       3),
(4, 'WATER_LOGGED',       'Water Logged',            4),
(5, 'PARTIALLY_WORKING',  'Partially Working',       5),
(6, 'DISCOLORED',         'Discolored',              6),
(7, 'LCD_DAMAGE',         'LCD Damage',              7),
(8, 'UNKNOWN',            'Unknown',                 99);

-- -----------------------------------------------------------------------------
-- Seed data: job_status
-- -----------------------------------------------------------------------------
INSERT INTO job_status (id, code, name, description, display_order, is_initial, is_final) VALUES
-- Initial
(1,  'NEW',                            'New',                              'New job registered',                       1,  true,  false),

-- Workshop flow
(2,  'ESTIMATED',                      'Estimated',                        'Repair estimate prepared',                 2,  false, false),
(3,  'APPROVED',                       'Approved',                         'Customer approved the estimate',           3,  false, false),
(4,  'NOT_APPROVED',                   'Not Approved',                     'Customer did not approve estimate',        4,  false, false),
(5,  'WAITING_FOR_PARTS',              'Waiting for Parts',                'Waiting for spare parts',                  5,  false, false),
(6,  'TECHNICIAN_ASSIGNED',            'Technician Assigned',              'Technician assigned to job',               6,  false, false),

-- Cancellation & disposal
(7,  'CANCELLED',                      'Cancelled',                        'Job cancelled',                            7,  false, true),
(8,  'MARKED_FOR_DISPOSAL',            'Marked for Disposal',              'Item marked for disposal',                 8,  false, false),
(9,  'DISPOSED',                       'Disposed',                         'Item disposed',                            9,  false, true),

-- Company send/receive
(10, 'SENT_TO_COMPANY',                'Sent to Company',                  'Item sent to company for repair',          10, false, false),
(11, 'RECEIVED_FROM_COMPANY_READY',    'Received from Company (Ready)',    'Received back from company - repaired',    11, false, false),
(12, 'RECEIVED_FROM_COMPANY_RETURN',   'Received from Company (Return)',   'Received back from company - unrepaired',  12, false, false),

-- Delivery
(13, 'READY_FOR_DELIVERY',             'Ready for Delivery',               'Repair done, ready to deliver',            13, false, false),
(14, 'RETURN_FOR_DELIVERY',            'Return for Delivery',              'Unrepaired, ready to return',              14, false, false),
(15, 'DELIVERED',                       'Delivered',                        'Item delivered to customer',               15, false, true),

-- Demo
(16, 'DEMO_COMPLETED',                 'Demo Completed',                   'Product demo completed',                   16, false, true),

-- Home service
(17, 'HOME_SERVICE_ATTENDED',          'Home Service Attended',            'Technician visited customer',              17, false, false),
(18, 'HOME_SERVICE_COMPLETED',         'Home Service Completed',           'Home service work completed',              18, false, true),

-- Installation
(19, 'INSTALLATION_REQUESTED',         'Installation Requested',           'Installation requested by customer',       19, false, false),
(20, 'INSTALLATION_COMPLETED',         'Installation Completed',           'Installation completed',                   20, false, true);

-- -----------------------------------------------------------------------------
-- Seed data: job_delivery_manner
-- -----------------------------------------------------------------------------
INSERT INTO job_delivery_manner (id, code, name, display_order) VALUES
(1, 'CUSTOMER_PICKUP',    'Customer Pickup',     1),
(2, 'COURIER',            'Courier',             2),
(3, 'THIRD_PARTY_PICKUP', 'Third Party Pickup',  3);

-- -----------------------------------------------------------------------------
-- Seed data: stock_transaction_type
-- -----------------------------------------------------------------------------
INSERT INTO stock_transaction_type (id, code, name, dr_cr, description) VALUES
(1, 'OPENING_STOCK',    'Opening Stock',      'D', 'Initial stock entry'),
(2, 'PURCHASE',         'Purchase',           'D', 'Stock received from purchase'),
(3, 'SALE',             'Sale',               'C', 'Stock sold to customer'),
(4, 'JOB_USAGE',        'Job Usage',          'C', 'Stock consumed in service job'),
(5, 'ADJUSTMENT_IN',    'Adjustment In',      'D', 'Stock added via adjustment'),
(6, 'ADJUSTMENT_OUT',   'Adjustment Out',     'C', 'Stock removed via adjustment'),
(7, 'RETURN_FROM_JOB',  'Return from Job',    'D', 'Unused part returned from job'),
(8, 'PURCHASE_RETURN',  'Purchase Return',    'C', 'Stock returned to supplier');

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================

COMMIT;
