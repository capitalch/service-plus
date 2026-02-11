# Plan: Execute tran.md — Complete Table Design for Service Database

## Objective
Analyse the "Service database Tables" section from `db_design.md`, which contains a mix of SQL and natural language table definitions. Produce a complete, SQL-free table design document (suitable for manual creation in pgAdmin) with all columns, foreign keys, indexes, constraints, and seed data — ordered so master/lookup tables appear before their dependents.

---

## Step 1: Identify all schemas used
- Two schemas: `security` and `service`.
- All tables previously under `public` and `inventory` now belong to `service`.
- Note which tables belong to which schema.

## Step 2: Catalogue all tables and classify them
- List every table from db_design.md.
- Classify each as **master/lookup** (no FK dependencies or only self-references) or **dependent** (has FKs to other tables).
- Build a dependency graph to determine creation order.

## Step 3: Resolve inconsistencies and missing details
- Identify naming mismatches (e.g., `job_receive_type` vs `job_receive_manner`, `job_receive_source` vs `job_receive_condition`, `bu_code_id` vs `bu_id` in branch, index column names that don't match table columns like `current_status_id` vs `job_status_id`).
- Identify tables referenced but not fully defined (e.g., `spare_part_sony`, `spare_part_nikon` share same structure as `spare_part_casio`).
- Note missing `NOT NULL`, default values, data types for natural-language-only definitions.
- Since all non-security tables are now in `service` schema, verify all cross-table FK references use `service.` prefix consistently.

## Step 4: Determine final table creation order
Based on dependency analysis, order tables as:
1. **service.state** (no dependencies)
2. **service.app_setting** (no dependencies)
3. **service.financial_year** (no dependencies)
4. **service.company_info** (depends on state)
5. **service.supplier** (depends on state)
6. **service.customer_type** (no dependencies — lookup)
7. **service.customer_contact** (depends on state, customer_type)
8. **service.product** (no dependencies)
9. **service.brand** (no dependencies)
10. **service.product_brand_model** (depends on product, brand)
11. **service.document_type** (no dependencies — lookup)
12. **service.stock_transaction_type** (no dependencies — lookup)
13. **security.client** (no dependencies)
14. **security.role** (no dependencies)
15. **security.access_right** (no dependencies)
16. **security.user** (no dependencies)
17. **security.bu** (depends on client)
18. **security.user_bu_role** (depends on user, bu, role)
19. **security.role_access_right** (depends on role, access_right)
20. **service.branch** (depends on bu, state)
21. **service.technician** (depends on branch)
22. **service.document_sequence** (depends on document_type, branch)
23. **service.job_type** (no dependencies — lookup)
24. **service.job_receive_manner** (no dependencies — lookup)
25. **service.job_receive_condition** (no dependencies — lookup)
26. **service.job_status** (no dependencies — lookup)
27. **service.job_transaction_type** (no dependencies — lookup)
28. **service.job_delivery_manner** (no dependencies — lookup)
29. **service.job** (depends on customer_contact, branch, technician, job_status, job_receive_manner, job_receive_condition, product_brand_model)
30. **service.job_transaction** (depends on job, job_transaction_type, job_status, technician, security.user)
31. **service.job_payment** (depends on job)
32. **service.job_part_used** (depends on job, brand)
33. **service.job_invoice** (depends on job, company_info)
34. **service.job_invoice_line** (depends on job_invoice)
35. **service.purchase_invoice** (depends on supplier, branch)
36. **service.purchase_invoice_line** (depends on purchase_invoice, brand)
37. **service.sales_invoice** (depends on company_info, customer_contact, branch)
38. **service.sales_invoice_line** (depends on sales_invoice)
39. **service.stock_transaction** (depends on branch, brand, stock_transaction_type)
40. **service.stock_adjustment** (depends on branch)
41. **service.stock_adjustment_line** (depends on stock_adjustment, brand)
42. **service.spare_part_sony** (no dependencies)
43. **service.spare_part_casio** (no dependencies)
44. **service.spare_part_nikon** (no dependencies)
45. **service.spare_part** (VIEW — depends on spare_part_sony, spare_part_casio, spare_part_nikon)
46. **service.spare_part_stock_summary** (VIEW — depends on stock_transaction)

## Step 5: Write complete table designs (no SQL)
For each table, document in a structured, pgAdmin-friendly format:
- **Schema.Table name**
- **Columns**: name, data type, nullable, default, identity
- **Primary Key**
- **Unique Constraints**
- **Check Constraints**
- **Foreign Keys** (with referenced table, column, and ON DELETE action)
- **Indexes** (name, columns, unique or not)
- **Notes** on any suggested additions (e.g., missing `updated_at`, missing `is_active`, suggested CHECK constraints like GSTIN format, email format, etc.)

## Step 6: Write seed value SQL
Generate INSERT statements for all lookup/master tables that have seed data:
- **customer_type** — already provided, verify completeness
- **job_type** — codes provided, generate appropriate `name` values (e.g., `WORKSHOP_GENERAL_REPAIR` → 'Workshop - General Repair')
- **job_receive_manner** — codes provided, generate `name` values
- **job_receive_condition** — codes provided, generate `name` values
- **job_status** — codes provided, generate `name`, `description`, `is_initial`, `is_final`, and `display_order` values
- **job_transaction_type** — already has full INSERT statements, include as-is
- **job_delivery_manner** — codes provided, generate `name` values
- **document_type** — codes and prefixes provided, generate `name` values
- **stock_transaction_type** — codes mentioned, generate full seed with `dr_cr` values

## Step 7: Write the output document
- Create the final output file with:
  - Section 1: All table designs ordered by dependency (Step 5)
  - Section 2: All seed value SQL statements (Step 6)
- Write output to `db_design_complete.md` in the root `db` folder

## Step 8: Review and validate
- Cross-check all FK references point to valid tables/columns
- Ensure no circular dependencies exist
- Verify all index column names match actual column names
- Confirm seed data IDs and display_orders are consistent and non-overlapping
