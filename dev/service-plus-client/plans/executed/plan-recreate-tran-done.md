# Plan: Recreate Stock Transaction and Balance Data

## Steps

### Step 1: TRUNCATE both tables
```sql
TRUNCATE stock_transaction, stock_balance;
```
TRUNCATE does NOT fire row-level triggers — safe to use without disabling triggers.

### Step 2: Insert from each source (10 INSERT statements)

All queries run with `SET search_path TO {schema}` in effect.

**Opening Balance**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, unit_cost, remarks, stock_opening_balance_line_id)
SELECT l.part_id, h.branch_id, 6, h.entry_date, 'D', l.qty, l.unit_cost, l.remarks, l.id
FROM stock_opening_balance_line l JOIN stock_opening_balance h ON h.id = l.stock_opening_balance_id;
```

**Purchase**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, unit_cost, remarks, purchase_line_id)
SELECT l.part_id, h.branch_id, 2, h.invoice_date, 'D', l.quantity, l.unit_price, l.remarks, l.id
FROM purchase_invoice_line l JOIN purchase_invoice h ON h.id = l.purchase_invoice_id;
```

**Sales**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, unit_cost, remarks, sales_line_id)
SELECT l.part_id, h.branch_id, 3, h.invoice_date, 'C', l.quantity, l.unit_price, l.remarks, l.id
FROM sales_invoice_line l JOIN sales_invoice h ON h.id = l.sales_invoice_id;
```

**Adjustment In**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_adjustment_line_id)
SELECT l.part_id, h.branch_id, 7, h.adjustment_date, 'D', l.qty, l.remarks, l.id
FROM stock_adjustment_line l JOIN stock_adjustment h ON h.id = l.stock_adjustment_id
WHERE l.dr_cr = 'D';
```

**Adjustment Out**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_adjustment_line_id)
SELECT l.part_id, h.branch_id, 8, h.adjustment_date, 'C', l.qty, l.remarks, l.id
FROM stock_adjustment_line l JOIN stock_adjustment h ON h.id = l.stock_adjustment_id
WHERE l.dr_cr = 'C';
```

**Loan In**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_loan_line_id)
SELECT l.part_id, h.branch_id, 9, h.loan_date, 'D', l.qty, l.remarks, l.id
FROM stock_loan_line l JOIN stock_loan h ON h.id = l.stock_loan_id WHERE l.dr_cr = 'D';
```

**Loan Out**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_loan_line_id)
SELECT l.part_id, h.branch_id, 10, h.loan_date, 'C', l.qty, l.remarks, l.id
FROM stock_loan_line l JOIN stock_loan h ON h.id = l.stock_loan_id WHERE l.dr_cr = 'C';
```

**Branch Transfer Out (source branch)**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_branch_transfer_line_id)
SELECT l.part_id, h.from_branch_id, 12, h.transfer_date, 'C', l.qty, l.remarks, l.id
FROM stock_branch_transfer_line l JOIN stock_branch_transfer h ON h.id = l.stock_branch_transfer_id;
```

**Branch Transfer In (destination branch)**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, remarks, stock_branch_transfer_line_id)
SELECT l.part_id, h.to_branch_id, 11, h.transfer_date, 'D', l.qty, l.remarks, l.id
FROM stock_branch_transfer_line l JOIN stock_branch_transfer h ON h.id = l.stock_branch_transfer_id;
```

**Job Consumption**
```sql
INSERT INTO stock_transaction
  (part_id, branch_id, stock_transaction_type_id, transaction_date, dr_cr, qty, job_part_used_id)
SELECT l.part_id, j.branch_id, 1, j.job_date, 'C', l.quantity, l.id
FROM job_part_used l JOIN job j ON j.id = l.job_id;
```
