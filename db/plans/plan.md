# Plan: Execute tran.md - Database Schema Creation

## Objective
Create a complete database schema for an electronic gadgets repairing shop system based on the specifications in tran.md.

---

## Step 1: Create Lookup/Reference Tables
Create foundational tables that other tables will reference:
- `state` - List of states
- `city` - Cities with foreign key to state
- `job_status` - Status values for jobs (e.g., Received, In Progress, Completed)
- `job_receive_type` - How job was received (Walk-in, Pickup, etc.)
- `job_receive_source` - Source of job (Direct, Referral, Online, etc.)
- `job_transaction_type` - Types of job transactions
- `brand` - Electronic brands (Casio, Sony, Nikon, etc.)
- `product` - Product categories (Watch, Camera, TV, etc.)

---

## Step 2: Create Master Tables
Create core business entity tables:
- `branch` - Company branches with city reference
- `customer_contact` - Customer information with city reference
- `technician` - Technician details with branch reference
- `supplier` - Supplier information with city reference
- `product_brand_model` - Product models linking product and brand
- `fiscal_year` - Financial year definitions
- `app_setting` - Application configuration settings

---

## Step 3: Create Job Management Tables
Create tables for job/repair workflow:
- `job` - Main job/repair order table with references to customer, branch, technician, product_brand_model, job_status, job_receive_type, job_receive_source
- `job_transaction` - Transaction history for jobs with job_transaction_type reference
- `job_part_used` - Parts used in repairs linking job and spare_part
- `job_invoice` - Invoices generated for jobs
- `job_payment` - Payment records for job invoices

---

## Step 4: Create Inventory Tables
Create tables for spare parts and inventory:
- `spare_part` - Master spare parts table
- `spare_part_stock_summary` - Logical/view table for stock aggregation
- Partitioned tables by brand:
  - `spare_part__brand_casio`
  - `spare_part__brand_sony`
  - `spare_part__brand_nikon`

---

## Step 5: Create Purchase Management Tables
Create tables for supplier purchases:
- `purchase_invoice` - Purchase invoices from suppliers
- `purchase_line_item` - Line items for purchase invoices linking to spare_part

---

## Step 6: Create Sales Management Tables
Create tables for spare part sales:
- `sales_invoice` - Sales invoices to customers
- `sales_line_item` - Line items for sales invoices linking to spare_part

---

## Step 7: Add Constraints
Apply constraints across all tables:
- Primary keys (preferably UUID or SERIAL)
- NOT NULL constraints on required fields
- UNIQUE constraints (e.g., email, phone numbers)
- CHECK constraints (e.g., valid email format, positive amounts)
- DEFAULT values where appropriate (e.g., created_at, status)

---

## Step 8: Add Foreign Keys
Establish referential integrity:
- city -> state
- branch -> city
- customer_contact -> city
- technician -> branch
- supplier -> city
- product_brand_model -> product, brand
- job -> customer_contact, branch, technician, product_brand_model, job_status, job_receive_type, job_receive_source
- job_transaction -> job, job_transaction_type
- job_part_used -> job, spare_part
- job_invoice -> job
- job_payment -> job_invoice
- purchase_invoice -> supplier, branch
- purchase_line_item -> purchase_invoice, spare_part
- sales_invoice -> customer_contact, branch
- sales_line_item -> sales_invoice, spare_part

---

## Step 9: Create Indexes
Add indexes for performance optimization:
- Indexes on all foreign key columns
- Indexes on frequently searched columns (name, email, phone, dates)
- Composite indexes for common query patterns
- Partial indexes where appropriate

---

## Step 10: Create Audit Columns
Add standard audit columns to all tables:
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `created_by` (reference to user)
- `updated_by` (reference to user)
- `is_active` or `deleted_at` for soft delete

---

## Step 11: Implement Table Partitioning
Set up partitioning for spare_part tables:
- Create parent table `spare_part` with partitioning strategy
- Create partition tables: `spare_part__brand_casio`, `spare_part__brand_sony`, `spare_part__brand_nikon`
- Set up partition routing based on brand

---

## Step 12: Create Views
Create logical/computed views:
- `spare_part_stock_summary` view aggregating stock across partitions
- Any other reporting views needed

---

## Output
Generate complete SQL DDL script with:
- All CREATE TABLE statements
- All constraints (inline and ALTER TABLE)
- All indexes
- All views
- Comments documenting each table's purpose
