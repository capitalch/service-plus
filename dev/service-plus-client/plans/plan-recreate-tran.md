# Plan: Recreate Stock Transaction and Balance Data

## Context
The `stock_transaction` and `stock_balance` tables need to be rebuilt from scratch by re-processing all source inventory tables. This is a one-time data reconciliation task.

## File to Create
`/home/sushant/projects/service-plus/dev/service-plus-server/scripts/recreate_stock.py`

## Transaction Type ID Mapping (from `sql_bu.py` seed data)
| ID | Code | dr_cr | Source |
|----|------|-------|--------|
| 1  | CONSUMPTION | C | job_part_used |
| 2  | PURCHASE | D | purchase_invoice_line |
| 3  | SALES | C | sales_invoice_line |
| 6  | OPENING | D | stock_opening_balance_line |
| 7  | ADJUSTMENT_IN | D | stock_adjustment_line (dr_cr='D') |
| 8  | ADJUSTMENT_OUT | C | stock_adjustment_line (dr_cr='C') |
| 9  | LOAN_IN | D | stock_loan_line (dr_cr='D') |
| 10 | LOAN_OUT | C | stock_loan_line (dr_cr='C') |
| 11 | BRANCH_TRANSFER_IN | D | stock_branch_transfer_line (to_branch_id) |
| 12 | BRANCH_TRANSFER_OUT | C | stock_branch_transfer_line (from_branch_id) |

## Parent Table Column Reference
| Parent Table | branch_id col | date col |
|---|---|---|
| stock_opening_balance | branch_id | entry_date |
| purchase_invoice | branch_id | invoice_date |
| sales_invoice | branch_id | invoice_date |
| stock_adjustment | branch_id | adjustment_date |
| stock_loan | branch_id | loan_date |
| stock_branch_transfer | from_branch_id / to_branch_id | transfer_date |
| job | branch_id | job_date |

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

## Script Structure
```python
#!/usr/bin/env python3
"""Recreate stock_transaction and stock_balance from all source tables."""
import argparse, logging, os, psycopg
from psycopg.rows import dict_row

# Connection config from env vars:
# SERVICE_DB_HOST, SERVICE_DB_PORT, SERVICE_DB_USER, SERVICE_DB_PASSWORD
# CLIENT_DB_HOST, CLIENT_DB_PORT, CLIENT_DB_USER, CLIENT_DB_PASSWORD, CLIENT_DB_NAME

def get_service_conn(db_name): ...
def get_client_conn(): ...

def recreate_schema(service_conn, schema):
    with service_conn.cursor() as cur:
        cur.execute(f"SET search_path TO {schema}")
        cur.execute("TRUNCATE stock_transaction, stock_balance")
        # Execute 10 INSERT statements, log rowcount after each
    service_conn.commit()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db-name')  # service DB name
    parser.add_argument('--schema')   # BU schema code
    args = parser.parse_args()

    if args.db_name and args.schema:
        with get_service_conn(args.db_name) as conn:
            recreate_schema(conn, args.schema)
    else:
        for db_name, schema in get_all_bus():
            with get_service_conn(db_name) as conn:
                recreate_schema(conn, schema)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    main()
```

## BU Iteration (all-BUs mode)
Pattern from `app/scheduler.py`:
1. Query `public.client` in client DB → get all active `db_name` values
2. For each `db_name`, query `security.bu` → get all active `code` values
3. Call `recreate_schema(conn, code)` for each

## CLI Usage
```bash
# All BUs across all clients
python scripts/recreate_stock.py

# Single BU
python scripts/recreate_stock.py --db-name service_plus_demo --schema demo1
```

## Logging Output Per Schema
```
[demo1] Truncated stock_transaction and stock_balance
[demo1] Opening:           45 rows
[demo1] Purchase:         120 rows
[demo1] Sales:             98 rows
[demo1] Adjustment In:      7 rows
[demo1] Adjustment Out:     5 rows
[demo1] Loan In:            4 rows
[demo1] Loan Out:           4 rows
[demo1] Branch Transfer Out: 12 rows
[demo1] Branch Transfer In:  12 rows
[demo1] Job Consumption:    56 rows
[demo1] Done. Total transactions: 363
```

## Verification After Running
```sql
-- Confirm total counts
SELECT COUNT(*) FROM stock_transaction;

-- Check for negative balances (indicates data issue)
SELECT * FROM stock_balance WHERE qty < 0;

-- Cross-check balance vs transactions
SELECT part_id, branch_id,
    SUM(CASE dr_cr WHEN 'D' THEN qty ELSE -qty END) AS computed_qty
FROM stock_transaction
GROUP BY 1, 2
HAVING SUM(CASE dr_cr WHEN 'D' THEN qty ELSE -qty END)
    != (SELECT qty FROM stock_balance sb WHERE sb.part_id = stock_transaction.part_id AND sb.branch_id = stock_transaction.branch_id);
```

## Reference Files
- `app/db/psycopg_driver.py` — DB connection pattern (async; use sync psycopg directly in script)
- `app/scheduler.py` — BU iteration pattern (active clients + schemas)
- `app/db/sql_bu.py` — transaction type seed data with IDs
- `app/db/service_plus_service.sql` — table definitions and trigger code
