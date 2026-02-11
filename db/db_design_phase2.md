# Complete Database Design — Service Plus (Service Schema Only)

> Service schema tables only
> Tables ordered by dependency (master/lookup tables first, dependent tables after)
> All tables designed for manual creation in pgAdmin

---

## Inconsistencies Resolved

| # | Issue | Resolution |
|---|-------|------------|
| 1 | `branch.bu_code_id` vs index using `bu_id` | Standardized to **bu_id** |
| 2 | `job.job_receive_type_id` but table is `job_receive_manner` | Renamed FK column to **job_receive_manner_id** |
| 3 | `job.job_receive_source_id` but table is `job_receive_condition` | Renamed FK column to **job_receive_condition_id** |
| 4 | `job` index on `current_status_id` but column is `job_status_id` | Index uses **job_status_id** |
| 5 | `job` index on `assigned_technician_id` but column is `technician_id` | Index uses **technician_id** |
| 6 | `stock_transaction` index on `transaction_type` but column is `stock_transaction_type_id` | Index uses **stock_transaction_type_id** |
| 7 | `spare_part_casio` heading but SQL shows `spare_part_sony` | All three brand tables share identical structure |
| 8 | All `public.*` and `inventory.*` schema references | Changed to **service.*** |
| 9 | `customer_contact` FK references `geo.state(id)` | Changed to **service.state(id)** |
| 10 | `company_info.state_id` missing FK declaration | Added FK to **service.state(id)** |
| 11 | `technician` missing comma before `created_at` | Fixed in design |
| 12 | `job_status` table named `job_status_type` in heading | Standardized to **job_status** |

---

# SECTION 1: TABLE DESIGNS

---

## 1. state

**Columns:**
- id: integer NOT NULL GENERATED ALWAYS PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- country_code: text NOT NULL DEFAULT 'IN'
- gst_state_code: char(2)
- is_union_territory: boolean NOT NULL DEFAULT false
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- state_code_uidx — UNIQUE(code)
- state_name_uidx — UNIQUE(name)

**Check Constraints:**
- state_code_check — code must match `^[A-Z]{2}$`
- country_code_check — country_code must match `^[A-Z]{2}$`

**Indexes:**
- state_code_uidx — UNIQUE on (code)
- state_name_uidx — UNIQUE on (name)

---

## 2. app_setting

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- setting_key: text NOT NULL
- setting_type: text NOT NULL
- setting_value: jsonb NOT NULL
- description: text
- is_editable: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(setting_key)

**Check Constraints:**
- setting_type must be one of: 'TEXT', 'INTEGER', 'BOOLEAN', 'JSON'

**Indexes:** None (unique constraint on setting_key provides implicit index)

---

## 3. financial_year

**Columns:**
- id: integer NOT NULL PRIMARY KEY
- start_date: date NOT NULL
- end_date: date NOT NULL

**Check Constraints:**
- financial_year_date_check — start_date < end_date

**Indexes:** None

**Suggested Additions:**
- Add `name` text column (e.g., '2025-26') for display
- Add `is_active` boolean NOT NULL DEFAULT true
- Add `created_at` / `updated_at` timestamptz columns
- Add UNIQUE constraint on (start_date, end_date) to prevent duplicates

---

## 4. customer_type

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- description: text
- is_active: boolean NOT NULL DEFAULT true
- display_order: smallint

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None (unique on code provides implicit index)

---

## 5. company_info

**Columns:**
- id: integer NOT NULL PRIMARY KEY
- company_name: text NOT NULL
- address_line1: text NOT NULL
- address_line2: text
- city: text
- state_id: integer NOT NULL
- country: text DEFAULT 'IN'
- pincode: text
- phone: text
- email: text
- gstin: text
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Foreign Keys:**
- state_id → state(id) ON DELETE RESTRICT

**Check Constraints:**
- (suggested) gstin format: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` (when not NULL)

**Indexes:** None

---

## 6. supplier

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- name: text NOT NULL
- gstin: text
- pan: text
- phone: text
- email: text
- address_line1: text
- address_line2: text
- city: text
- state_id: smallint NOT NULL
- pincode: text
- is_active: boolean NOT NULL DEFAULT true
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- supplier_name_key — UNIQUE(name)

**Check Constraints:**
- (suggested) gstin format: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` (when not NULL)

**Foreign Keys:**
- state_id → state(id) ON DELETE RESTRICT

**Indexes:** None additional (unique on name provides implicit index)

---

## 7. customer_contact

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- customer_type_id: smallint NOT NULL
- full_name: text
- gstin: text
- mobile: text NOT NULL
- alternate_mobile: text
- email: text
- address_line1: text NOT NULL
- address_line2: text
- landmark: text
- state_id: integer NOT NULL
- city: text
- postal_code: text
- remarks: text
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Foreign Keys:**
- customer_type_id → customer_type(id) ON DELETE RESTRICT
- state_id → state(id) ON DELETE RESTRICT

**Indexes:**
- idx_customer_contact_mobile — on (mobile)

**Suggested Additions:**
- Check constraint on gstin format (when not NULL)

---

## 8. product

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- name: text NOT NULL
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- product_name_key — UNIQUE(name)

**Check Constraints:**
- product_name_check — name must match `^[A-Z_]+$`

**Indexes:** None (unique on name provides implicit index)

---

## 9. brand

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- brand_code_key — UNIQUE(code)

**Check Constraints:**
- brand_code_check — code must match `^[A-Z_]+$`

**Indexes:** None (unique on code provides implicit index)

---

## 10. product_brand_model

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- product_id: bigint NOT NULL
- brand_id: bigint NOT NULL
- model_name: text NOT NULL
- launch_year: integer
- remarks: text
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- pbm_unique_model — UNIQUE(product_id, brand_id, model_name)

**Foreign Keys:**
- product_id → product(id) ON DELETE RESTRICT
- brand_id → brand(id) ON DELETE RESTRICT

**Indexes:** None additional (composite unique provides implicit index)

---

## 11. document_type

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- prefix: text NOT NULL
- name: text NOT NULL
- description: text

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- document_type_code_chk — code must match `^[A-Z_]+$`

**Indexes:** None

**Suggested Additions:**
- Add `is_active` boolean NOT NULL DEFAULT true
- Add `created_at` / `updated_at` timestamptz columns

---

## 12. stock_transaction_type

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- dr_cr: char(1) NOT NULL
- description: text
- is_active: boolean NOT NULL DEFAULT true

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- dr_cr must be one of: 'D', 'C'
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None

**Suggested Additions:**
- Add `created_at` / `updated_at` timestamptz columns

---

## 13. branch

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- bu_id: bigint NOT NULL
- code: text NOT NULL
- name: text NOT NULL
- phone: text
- email: text
- address_line1: text NOT NULL
- address_line2: text
- state_id: integer NOT NULL
- city: text
- pincode: text NOT NULL
- gstin: text
- is_active: boolean NOT NULL DEFAULT true
- is_head_office: boolean NOT NULL DEFAULT false
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- branch_bu_code_uidx — UNIQUE(bu_id, code)

**Check Constraints:**
- branch_code_check — code must match `^[A-Z0-9_]+$`
- branch_gstin_check — gstin IS NULL OR gstin must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`

**Foreign Keys:**
- bu_id → bu(id) ON DELETE RESTRICT
- state_id → state(id) ON DELETE RESTRICT

**Indexes:**
- branch_bu_code_uidx — UNIQUE on (bu_id, code)
- branch_state_idx — on (state_id)

---

## 14. technician

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- branch_id: bigint NOT NULL
- code: text NOT NULL
- name: text NOT NULL
- phone: text
- email: text
- specialization: text
- leaving_date: date
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- technician_bu_code_uidx — UNIQUE(branch_id, code)

**Check Constraints:**
- technician_code_check — code must match `^[A-Z0-9_]+$`

**Foreign Keys:**
- branch_id → branch(id) ON DELETE RESTRICT

**Indexes:**
- technician_bu_code_uidx — UNIQUE on (branch_id, code)
- technician_phone_idx — on (phone)

---

## 15. document_sequence

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- document_type_id: smallint NOT NULL
- branch_id: bigint NOT NULL
- prefix: text NOT NULL
- next_number: integer NOT NULL DEFAULT 1
- padding: smallint NOT NULL DEFAULT 5
- separator: text NOT NULL DEFAULT '/'
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- document_sequence_unique — UNIQUE(document_type_id, branch_id)

**Foreign Keys:**
- document_type_id → document_type(id) ON DELETE RESTRICT
- branch_id → branch(id) ON DELETE RESTRICT

**Indexes:** None additional (composite unique provides implicit index)

**Note:** Use SELECT ... FOR UPDATE + UPDATE pattern to safely increment next_number.

---

## 16. job_type

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- description: text
- display_order: smallint
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None

---

## 17. job_receive_manner

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- is_system: boolean NOT NULL DEFAULT true
- is_active: boolean NOT NULL DEFAULT true
- display_order: smallint NOT NULL DEFAULT 0
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None

---

## 18. job_receive_condition

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- description: text
- display_order: smallint
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None

---

## 19. job_status

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- description: text
- display_order: smallint NOT NULL
- is_initial: boolean NOT NULL DEFAULT false
- is_final: boolean NOT NULL DEFAULT false
- is_active: boolean NOT NULL DEFAULT true
- is_system: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- job_status_code_check — code must match `^[A-Z_]+$`

**Indexes:** None

---

## 20. job_delivery_manner

**Columns:**
- id: smallint NOT NULL PRIMARY KEY
- code: text NOT NULL
- name: text NOT NULL
- display_order: smallint
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(code)

**Check Constraints:**
- (suggested) code must match `^[A-Z_]+$`

**Indexes:** None

---

## 21. job

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_no: text NOT NULL
- job_date: date NOT NULL DEFAULT current_date
- customer_contact_id: bigint NOT NULL
- branch_id: bigint NOT NULL
- technician_id: bigint
- job_status_id: smallint NOT NULL
- job_type_id: smallint NOT NULL
- job_receive_manner_id: smallint NOT NULL
- job_receive_condition_id: smallint
- product_brand_model_id: bigint
- serial_no: text
- problem_reported: text NOT NULL
- diagnosis: text
- work_done: text
- remarks: text
- amount: numeric(12,2)
- delivery_date: date
- is_closed: boolean NOT NULL DEFAULT false
- is_warranty: boolean NOT NULL DEFAULT false
- warranty_card_no: text
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(job_no)
- job_branch_job_no_uidx — UNIQUE(branch_id, job_no)

**Foreign Keys:**
- customer_contact_id → customer_contact(id) ON DELETE RESTRICT
- branch_id → branch(id) ON DELETE RESTRICT
- technician_id → technician(id) ON DELETE RESTRICT
- job_status_id → job_status(id) ON DELETE RESTRICT
- job_type_id → job_type(id) ON DELETE RESTRICT
- job_receive_manner_id → job_receive_manner(id) ON DELETE RESTRICT
- job_receive_condition_id → job_receive_condition(id) ON DELETE RESTRICT
- product_brand_model_id → product_brand_model(id) ON DELETE RESTRICT

**Indexes:**
- job_branch_job_no_uidx — UNIQUE on (branch_id, job_no)
- job_status_idx — on (job_status_id)
- job_technician_idx — on (technician_id)
- job_customer_idx — on (customer_contact_id)
- job_job_date_idx — on (job_date)
- job_branch_idx — on (branch_id)
- idx_job_delivery_date — on (delivery_date)

---

## 22. job_transaction

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_id: bigint NOT NULL
- status_id: smallint
- technician_id: bigint
- amount: numeric(12,2)
- notes: text
- performed_by_user_id: bigint NOT NULL
- performed_at: timestamptz NOT NULL DEFAULT now()

**Foreign Keys:**
- job_id → job(id) ON DELETE CASCADE
- status_id → job_status(id) ON DELETE RESTRICT
- technician_id → technician(id) ON DELETE RESTRICT
- performed_by_user_id → "user"(id) ON DELETE RESTRICT

**Indexes:**
- idx_job_transaction_job_id — on (job_id)
- idx_job_transaction_performed_at — on (performed_at)
- idx_job_transaction_status — on (status_id)

---

## 23. job_payment

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_id: bigint NOT NULL
- payment_date: date NOT NULL
- payment_mode: text NOT NULL
- amount: numeric(14,2) NOT NULL
- reference_no: text
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- amount > 0
- (suggested) payment_mode must be one of: 'CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ADJUSTMENT'

**Foreign Keys:**
- job_id → job(id) ON DELETE CASCADE

**Indexes:**
- idx_job_payment_job — on (job_id)
- idx_job_payment_date — on (payment_date)

---

## 24. job_part_used

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_id: bigint NOT NULL
- part_code: text NOT NULL
- brand_id: bigint NOT NULL
- quantity: numeric(10,2) NOT NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- quantity > 0

**Foreign Keys:**
- job_id → job(id) ON DELETE RESTRICT
- brand_id → brand(id) ON DELETE RESTRICT

**Indexes:**
- (suggested) idx_job_part_used_job — on (job_id)
- (suggested) idx_job_part_used_part — on (part_code)

---

## 25. job_invoice

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_id: bigint NOT NULL
- company_id: smallint NOT NULL
- invoice_no: text NOT NULL
- invoice_date: date NOT NULL DEFAULT current_date
- supply_state_code: char(2) NOT NULL
- taxable_amount: numeric(14,2) NOT NULL
- cgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- igst_amount: numeric(14,2) NOT NULL DEFAULT 0
- total_tax: numeric(14,2) NOT NULL
- total_amount: numeric(14,2) NOT NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(company_id, invoice_no)

**Foreign Keys:**
- job_id → job(id) ON DELETE RESTRICT
- company_id → company_info(id) ON DELETE RESTRICT

**Indexes:**
- (suggested) idx_job_invoice_job — on (job_id)

---

## 26. job_invoice_line

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- job_invoice_id: bigint NOT NULL
- description: text NOT NULL
- hsn_code: text NOT NULL
- quantity: numeric(10,2) NOT NULL
- unit_price: numeric(12,2) NOT NULL
- taxable_amount: numeric(12,2) NOT NULL
- cgst_rate: numeric(5,2) NOT NULL DEFAULT 0
- sgst_rate: numeric(5,2) NOT NULL DEFAULT 0
- igst_rate: numeric(5,2) NOT NULL DEFAULT 0
- cgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- igst_amount: numeric(12,2) NOT NULL DEFAULT 0
- total_amount: numeric(12,2) NOT NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- quantity > 0
- unit_price >= 0

**Foreign Keys:**
- job_invoice_id → job_invoice(id) ON DELETE CASCADE

**Indexes:**
- (suggested) idx_job_invoice_line_invoice — on (job_invoice_id)

---

## 27. purchase_invoice

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- supplier_id: bigint NOT NULL
- invoice_no: text NOT NULL
- invoice_date: date NOT NULL
- supplier_state_code: char(2) NOT NULL
- taxable_amount: numeric(14,2) NOT NULL
- cgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- igst_amount: numeric(14,2) NOT NULL DEFAULT 0
- total_tax: numeric(14,2) NOT NULL
- total_amount: numeric(14,2) NOT NULL
- branch_id: bigint NOT NULL
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(supplier_id, invoice_no)

**Foreign Keys:**
- supplier_id → supplier(id) ON DELETE RESTRICT
- branch_id → branch(id) ON DELETE RESTRICT

**Indexes:**
- idx_purchase_invoice_supplier — on (supplier_id)

---

## 28. purchase_invoice_line

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- purchase_invoice_id: bigint NOT NULL
- part_code: text NOT NULL
- brand_id: bigint NOT NULL
- hsn_code: text NOT NULL
- quantity: numeric(12,2) NOT NULL
- unit_price: numeric(12,2) NOT NULL
- taxable_amount: numeric(12,2) NOT NULL
- cgst_rate: numeric(5,2) NOT NULL DEFAULT 0
- sgst_rate: numeric(5,2) NOT NULL DEFAULT 0
- igst_rate: numeric(5,2) NOT NULL DEFAULT 0
- cgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- igst_amount: numeric(12,2) NOT NULL DEFAULT 0
- total_amount: numeric(12,2) NOT NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- quantity > 0
- unit_price >= 0

**Foreign Keys:**
- purchase_invoice_id → purchase_invoice(id) ON DELETE CASCADE
- brand_id → brand(id) ON DELETE RESTRICT

**Indexes:**
- idx_purchase_invoice_line_spare_part — on (part_code)

---

## 29. sales_invoice

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- invoice_no: text NOT NULL
- invoice_date: date NOT NULL
- company_id: bigint NOT NULL
- customer_contact_id: bigint
- customer_name: text NOT NULL
- customer_gstin: text
- customer_state_code: char(2) NOT NULL
- taxable_amount: numeric(14,2) NOT NULL
- cgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(14,2) NOT NULL DEFAULT 0
- igst_amount: numeric(14,2) NOT NULL DEFAULT 0
- total_tax: numeric(14,2) NOT NULL
- total_amount: numeric(14,2) NOT NULL
- branch_id: bigint NOT NULL
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(company_id, invoice_no)

**Foreign Keys:**
- company_id → company_info(id) ON DELETE RESTRICT
- customer_contact_id → customer_contact(id) ON DELETE RESTRICT
- branch_id → branch(id) ON DELETE RESTRICT

**Indexes:**
- (suggested) idx_sales_invoice_customer — on (customer_contact_id)

---

## 30. sales_invoice_line

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- sales_invoice_id: bigint NOT NULL
- part_code: text NOT NULL
- item_description: text NOT NULL
- hsn_code: text NOT NULL
- quantity: numeric(12,2) NOT NULL
- unit_price: numeric(12,2) NOT NULL
- gst_rate: numeric(5,2) NOT NULL DEFAULT 0
- taxable_amount: numeric(12,2) NOT NULL
- cgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- sgst_amount: numeric(12,2) NOT NULL DEFAULT 0
- igst_amount: numeric(12,2) NOT NULL DEFAULT 0
- total_amount: numeric(12,2) NOT NULL
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- quantity > 0
- unit_price >= 0

**Foreign Keys:**
- sales_invoice_id → sales_invoice(id) ON DELETE CASCADE

**Indexes:**
- idx_sales_invoice_line_spare_part — on (part_code)

---

## 31. stock_transaction

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- part_code: text NOT NULL
- branch_id: bigint NOT NULL
- brand_id: bigint NOT NULL
- stock_transaction_type_id: smallint NOT NULL
- transaction_date: date NOT NULL
- dr_cr: char(1) NOT NULL
- qty: numeric(12,3) NOT NULL
- unit_cost: numeric(12,2)
- source_table: text NOT NULL
- source_id: bigint NOT NULL
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- dr_cr must be one of: 'D', 'C'
- qty > 0

**Foreign Keys:**
- branch_id → branch(id) ON DELETE RESTRICT
- brand_id → brand(id) ON DELETE RESTRICT
- stock_transaction_type_id → stock_transaction_type(id) ON DELETE RESTRICT

**Indexes:**
- idx_stock_tx_part — on (part_code)
- idx_stock_tx_date — on (transaction_date)
- idx_stock_tx_type — on (stock_transaction_type_id)
- idx_stock_tx_source — on (source_table, source_id)

**Note:** This table is append-only (no updated_at). source_table + source_id form a polymorphic reference to the originating record (e.g., purchase_invoice_line, job_part_used, stock_adjustment_line).

---

## 32. stock_adjustment

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- adjustment_date: date NOT NULL
- adjustment_reason: text NOT NULL
- ref_no: text
- branch_id: bigint NOT NULL
- remarks: text
- created_by: bigint
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Foreign Keys:**
- branch_id → branch(id) ON DELETE RESTRICT

**Indexes:**
- idx_stock_adj_date — on (adjustment_date)

**Note:** `created_by` is intentionally loosely coupled (no FK) to allow flexibility with user references.

---

## 33. stock_adjustment_line

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- stock_adjustment_id: bigint NOT NULL
- part_code: text NOT NULL
- brand_id: bigint NOT NULL
- dr_cr: char(1) NOT NULL
- qty: numeric(12,3) NOT NULL
- unit_cost: numeric(12,2)
- remarks: text
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Check Constraints:**
- dr_cr must be one of: 'D', 'C'
- qty > 0

**Foreign Keys:**
- stock_adjustment_id → stock_adjustment(id) ON DELETE CASCADE
- brand_id → brand(id) ON DELETE RESTRICT

**Indexes:**
- idx_stock_adj_line_adj_id — on (stock_adjustment_id)
- idx_stock_adj_line_part — on (part_code)

---

## 34. spare_part_sony

**Columns:**
- id: bigint NOT NULL GENERATED ALWAYS PRIMARY KEY
- part_code: text NOT NULL
- part_name: text NOT NULL
- part_description: text
- category: text
- model: text
- uom: text NOT NULL DEFAULT 'NOS'
- cost_price: numeric(12,2)
- mrp: numeric(12,2)
- hsn_code: text
- gst_rate: numeric(5,2)
- is_active: boolean NOT NULL DEFAULT true
- created_at: timestamptz NOT NULL DEFAULT now()
- updated_at: timestamptz NOT NULL DEFAULT now()

**Unique Constraints:**
- UNIQUE(part_code)

**Indexes:**
- idx_sp_sony_name — on (part_name)
- idx_sp_sony_model — on (model)

---

## 35. spare_part_casio

Same structure as spare_part_sony.

**Indexes:**
- idx_sp_casio_name — on (part_name)
- idx_sp_casio_model — on (model)

---

## 36. spare_part_nikon

Same structure as spare_part_sony.

**Indexes:**
- idx_sp_nikon_name — on (part_name)
- idx_sp_nikon_model — on (model)

---

## 37. spare_part (VIEW)

**Definition:** UNION ALL of spare_part_sony, spare_part_casio, spare_part_nikon with an added `brand_code` text column ('SONY', 'CASIO', 'NIKON' respectively).

**Columns:**
- brand_code (text, derived)
- id, part_code, part_name, part_description, category, model, uom, cost_price, mrp, hsn_code, gst_rate, is_active

---

## 38. spare_part_stock_summary (VIEW)

**Definition:** Aggregates stock_transaction by part_code, brand_id, branch_id.

**Columns:**
- part_code (text)
- brand_id (bigint)
- branch_id (bigint)
- current_stock (numeric) — SUM of qty where D is positive, C is negative

---

---

# SECTION 2: SEED DATA SQL

---

## customer_type

```sql
INSERT INTO service.customer_type (id, code, name, display_order) VALUES
(1, 'INDIVIDUAL',       'Individual Customer',        1),
(2, 'SERVICE_PARTNER',  'Service Partner',             2),
(3, 'DEALER',           'Dealer',                      3),
(4, 'CORPORATE',        'Corporate / Institutional',   4),
(5, 'OTHER',            'Other',                       99);
```

---

## document_type

```sql
INSERT INTO service.document_type (id, code, prefix, name, description) VALUES
(1, 'JOB',           'JOB',  'Job Card',          'Service job card'),
(2, 'RECEIPT',       'RCPT', 'Receipt',           'Payment receipt'),
(3, 'SALE_INVOICE',  'SI',   'Sale Invoice',      'Spare part / product sale invoice'),
(4, 'JOB_INVOICE',   'JI',   'Job Invoice',       'Service job invoice'),
(5, 'PURCHASE',      'PI',   'Purchase Invoice',  'Purchase invoice from supplier');
```

---

## job_type

```sql
INSERT INTO service.job_type (id, code, name, display_order) VALUES
(1, 'WORKSHOP_GENERAL_REPAIR',      'Workshop - General Repair',      1),
(2, 'WORKSHOP_WARRANTY_REPAIR',     'Workshop - Warranty Repair',     2),
(3, 'WORKSHOP_ESTIMATE',            'Workshop - Estimate',            3),
(4, 'WORKSHOP_REPLACEMENT',         'Workshop - Replacement',         4),
(5, 'WORKSHOP_REPEAT_REPAIR',       'Workshop - Repeat Repair',       5),
(6, 'HOME_SERVICE_GENERAL_REPAIR',  'Home Service - General Repair',  6),
(7, 'HOME_SERVICE_WARRANTY_REPAIR', 'Home Service - Warranty Repair', 7),
(8, 'DEMO',                         'Demo',                           8),
(9, 'SERVICE_CONTRACT',             'Service Contract',               9);
```

---

## job_receive_manner

```sql
INSERT INTO service.job_receive_manner (id, code, name, display_order) VALUES
(1, 'WALK_IN',        'Walk-in',         1),
(2, 'COURIER',        'Courier',         2),
(3, 'PICKUP',         'Pickup',          3),
(4, 'ONLINE_BOOKING', 'Online Booking',  4),
(5, 'PHONE_BOOKING',  'Phone Booking',   5),
(6, 'MISC',           'Miscellaneous',   99);
```

---

## job_receive_condition

```sql
INSERT INTO service.job_receive_condition (id, code, name, display_order) VALUES
(1, 'DEAD',               'Dead / Not Powering On',  1),
(2, 'DAMAGED',            'Damaged',                 2),
(3, 'PHYSICALLY_BROKEN',  'Physically Broken',       3),
(4, 'WATER_LOGGED',       'Water Logged',            4),
(5, 'PARTIALLY_WORKING',  'Partially Working',       5),
(6, 'DISCOLORED',         'Discolored',              6),
(7, 'LCD_DAMAGE',         'LCD Damage',              7),
(8, 'UNKNOWN',            'Unknown',                 99);
```

---

## job_status

```sql
INSERT INTO service.job_status (id, code, name, description, display_order, is_initial, is_final) VALUES
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
```

---

## job_delivery_manner

```sql
INSERT INTO service.job_delivery_manner (id, code, name, display_order) VALUES
(1, 'CUSTOMER_PICKUP',    'Customer Pickup',     1),
(2, 'COURIER',            'Courier',             2),
(3, 'THIRD_PARTY_PICKUP', 'Third Party Pickup',  3);
```

---

## stock_transaction_type

```sql
INSERT INTO service.stock_transaction_type (id, code, name, dr_cr, description) VALUES
(1, 'OPENING_STOCK',    'Opening Stock',      'D', 'Initial stock entry'),
(2, 'PURCHASE',         'Purchase',           'D', 'Stock received from purchase'),
(3, 'SALE',             'Sale',               'C', 'Stock sold to customer'),
(4, 'JOB_USAGE',        'Job Usage',          'C', 'Stock consumed in service job'),
(5, 'ADJUSTMENT_IN',    'Adjustment In',      'D', 'Stock added via adjustment'),
(6, 'ADJUSTMENT_OUT',   'Adjustment Out',     'C', 'Stock removed via adjustment'),
(7, 'RETURN_FROM_JOB',  'Return from Job',    'D', 'Unused part returned from job'),
(8, 'PURCHASE_RETURN',  'Purchase Return',    'C', 'Stock returned to supplier');
```
