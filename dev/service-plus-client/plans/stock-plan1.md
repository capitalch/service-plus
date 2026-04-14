# 📦 Scalable Stock Management System (No Financial Year Dependency)

## 🎯 Problem

You currently store all stock movements in:

Over time this leads to:

- 📈 Huge table size
- 🐢 Slow stock queries (`SUM`)
- ❌ Difficult reporting
- ❌ No clean opening stock strategy

---

# 🧠 Core Solution

Use a **Hybrid Stock Architecture (3-layer system)**
stock_transaction → Ledger (source of truth)
stock_balance → Current stock (fast lookup)
stock_snapshot → Historical checkpoints (optional)


---

# 🪜 STEP 1 — Create stock_transaction (Ledger)

## Purpose
- Store ALL stock movements
- Maintain audit trail
- Never depend on this for real-time stock

## Table

```sql
CREATE TABLE stock_transaction (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    qty NUMERIC NOT NULL,
    dr_cr CHAR(2) NOT NULL, -- 'DR' = IN, 'CR' = OUT
    tran_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    ref_type TEXT,
    ref_id BIGINT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

🪜 STEP 2 — Create stock_balance (CRITICAL)
Purpose
Maintain real-time stock
Replace heavy aggregation

CREATE TABLE stock_balance (
    product_id BIGINT,
    branch_id BIGINT,
    qty NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, branch_id)
);

🪜 STEP 3 — Opening Stock Strategy (No Financial Year)
✅ Rule
Do NOT depend on financial year
Do NOT recalculate yearly opening

INSERT INTO stock_transaction (
    product_id, branch_id, qty, dr_cr, tran_date, ref_type
)
VALUES (1, 1, 100, 'DR', now(), 'OPENING');

INSERT INTO stock_balance (product_id, branch_id, qty)
VALUES (1, 1, 100)
ON CONFLICT (product_id, branch_id)
DO UPDATE SET qty = EXCLUDED.qty;

🪜 STEP 4 — Transaction Handling (CORE LOGIC)
🔴 RULE

Every stock movement MUST update BOTH tables

-- 1. Insert into ledger
INSERT INTO stock_transaction (...);

-- 2. Update balance
INSERT INTO stock_balance (product_id, branch_id, qty)
VALUES (:product_id, :branch_id, :qty_effect)
ON CONFLICT (product_id, branch_id)
DO UPDATE SET
    qty = stock_balance.qty + EXCLUDED.qty,
    updated_at = now();

qty_effect Formula
dr_cr	effect
DR	+qty
CR	-qty
Example: Purchase
INSERT INTO stock_transaction (...)
VALUES (1, 1, 10, 'DR', now(), 'PURCHASE');

-- balance update
+10
Example: Sale
INSERT INTO stock_transaction (...)
VALUES (1, 1, 5, 'CR', now(), 'SALE');

-- balance update
-5
Example: Branch Transfer

Two entries:

Source branch → CR
Destination branch → DR
🪜 STEP 5 — Query Strategy
✅ Current Stock (FAST)
SELECT qty 
FROM stock_balance
WHERE product_id = :product_id
AND branch_id = :branch_id;
❌ Avoid
SELECT SUM(qty) FROM stock_transaction;
🪜 STEP 6 — Indexing
CREATE INDEX idx_stock_tran 
ON stock_transaction(product_id, branch_id, tran_date);
🪜 STEP 7 — Partitioning (VERY IMPORTANT)
Why?
Prevent large table slowdown
Improve query performance
Setup
ALTER TABLE stock_transaction
PARTITION BY RANGE (tran_date);
Example
CREATE TABLE stock_transaction_2026 
PARTITION OF stock_transaction
FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
🪜 STEP 8 — stock_snapshot (Optional but Recommended)
Purpose
Improve historical queries
Avoid scanning entire ledger
Table
CREATE TABLE stock_snapshot (
    snapshot_date DATE,
    product_id BIGINT,
    branch_id BIGINT,
    qty NUMERIC,
    PRIMARY KEY (snapshot_date, product_id, branch_id)
);
Daily Snapshot Job
INSERT INTO stock_snapshot (snapshot_date, product_id, branch_id, qty)
SELECT CURRENT_DATE, product_id, branch_id, qty
FROM stock_balance;
🪜 STEP 9 — Historical Stock Query
SELECT 
    s.qty + COALESCE(SUM(
        CASE WHEN t.dr_cr='DR' THEN t.qty ELSE -t.qty END
    ), 0) AS stock
FROM stock_snapshot s
LEFT JOIN stock_transaction t
ON t.product_id = s.product_id
AND t.branch_id = s.branch_id
AND t.tran_date > s.snapshot_date
WHERE s.snapshot_date = (
    SELECT MAX(snapshot_date)
    FROM stock_snapshot
    WHERE snapshot_date <= :date
);
⚠️ CRITICAL RULES
❌ NEVER
Query stock using full transaction sum
Depend on financial year openings
✅ ALWAYS
Use stock_balance for current stock
Use snapshot + delta for history
🧱 Optional Enhancements
stock_transaction_type
CREATE TABLE stock_transaction_type (
    id SMALLINT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT
);

Example values:

PURCHASE
SALE
ADJUSTMENT
TRANSFER
LOAN_IN
LOAN_OUT
JOB_CONSUMPTION
qty_effect column (optimization)

Instead of dr_cr:

qty_effect = +qty or -qty
🏆 Final Architecture
Layer	Table	Purpose
Ledger	stock_transaction	Full audit
Runtime	stock_balance	Fast stock
Analytics	stock_snapshot	Historical
🚀 Benefits
⚡ Instant stock queries
📈 Scales to millions of rows
🧠 No financial year dependency
🔍 Full audit trail
🏢 ERP-grade system