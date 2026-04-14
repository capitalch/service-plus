# Scalable Stock Management Strategy — Service Plus

## Current Schema (as-is)

Your `stock_transaction` table already has a well-designed structure:

| Column | Purpose |
|--------|---------|
| `id` | BIGSERIAL PK |
| `part_id` → `spare_part_master` | Which part |
| `branch_id` → `branch` | Which branch |
| `stock_transaction_type_id` → `stock_transaction_type` | Type: PURCHASE, SALE, ADJUSTMENT, TRANSFER, LOAN_IN, LOAN_OUT, WARRANTY_IN, JOB_CONSUMPTION, etc. |
| `transaction_date` | Business date |
| `dr_cr` | `D` = stock in, `C` = stock out |
| `qty` | Quantity moved |
| `unit_cost` | Cost at time of movement |
| `purchase_line_id`, `sales_line_id`, `stock_adjustment_line_id`, `job_part_used_id`, `stock_branch_transfer_line_id`, `stock_loan_line_id` | FK links back to each source document line |

This is already a clean **ledger** design. The problem is purely one of **scale and query speed**. The strategy below adds a **balance layer** on top without touching the ledger, and handles opening stock elegantly without any financial year concept.

---

## Architecture Overview (3-layer)

```
┌────────────────────────────────────────────────────────┐
│  Layer 1 — Ledger (existing)                           │
│  stock_transaction  ← immutable audit trail, never     │
│  query for current stock; only for history/reversal    │
├────────────────────────────────────────────────────────┤
│  Layer 2 — Balance (NEW)                               │
│  stock_balance  ← one row per (part_id, branch_id)     │
│  always reflects current real-time stock; O(1) reads   │
├────────────────────────────────────────────────────────┤
│  Layer 3 — Snapshot (NEW, optional)                    │
│  stock_snapshot  ← periodic checkpoint of balance      │
│  enables fast "stock as-of date X" without scanning    │
│  the entire ledger from the beginning                  │
└────────────────────────────────────────────────────────┘
```

---

## Step 1 — Add `stock_balance` Table

This is the most critical addition. It carries one row per `(part_id, branch_id)` combination and is the **only** place you query for current stock.

```sql
-- In your demo1 (BU) schema
CREATE TABLE stock_balance (
    part_id     INTEGER  NOT NULL REFERENCES spare_part_master(id),
    branch_id   INTEGER  NOT NULL REFERENCES branch(id),
    qty         NUMERIC  NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (part_id, branch_id)
);

CREATE INDEX idx_stock_balance_branch ON stock_balance(branch_id);
CREATE INDEX idx_stock_balance_part   ON stock_balance(part_id);
```

### Rule
- `D` (debit / stock IN) → `qty = qty + incoming_qty`
- `C` (credit / stock OUT) → `qty = qty - outgoing_qty`
- **Never** read `stock_transaction` to get current stock.

---

## Step 2 — Opening Stock Strategy (No Financial Year)

### Concept
Opening stock is simply the **first transaction ever recorded** for a `(part_id, branch_id)` pair. You insert a `stock_transaction` row with type `OPENING` and simultaneously set/initialise `stock_balance`.

There is no "year-end closing". The balance is always the *running total* starting from the very first opening entry. Since `stock_balance` always holds the current total, you never need to recalculate it.

### Add `OPENING` to `stock_transaction_type`

```sql
INSERT INTO stock_transaction_type (code, name, dr_cr, is_system)
VALUES ('OPENING', 'Opening Stock', 'D', TRUE);
```

### Opening Stock Insert (application-level, wrapped in single transaction)

```sql
-- Step A: Insert ledger row for opening
INSERT INTO stock_transaction (
    part_id, branch_id, stock_transaction_type_id,
    transaction_date, dr_cr, qty, unit_cost
)
SELECT
    :part_id, :branch_id,
    (SELECT id FROM stock_transaction_type WHERE code = 'OPENING'),
    :date, 'D', :qty, :unit_cost;

-- Step B: Upsert balance
INSERT INTO stock_balance (part_id, branch_id, qty)
VALUES (:part_id, :branch_id, :qty)
ON CONFLICT (part_id, branch_id)
DO UPDATE SET
    qty        = stock_balance.qty + EXCLUDED.qty,
    updated_at = now();
```

**Key point**: Opening entries can be made at any point in time — even mid-year — without any closing routine. The balance simply accumulates from that point forward.

---

## Step 3 — Atomic Balance Update on Every Transaction

Every time any transaction type (PURCHASE, SALE, ADJUSTMENT, TRANSFER, WARRANTY_IN, LOAN_IN/OUT, JOB_CONSUMPTION) writes to `stock_transaction`, it **must** also update `stock_balance` in the same database transaction.

### FastAPI `sql_store.py` Pattern

```python
# sql_store.py
UPSERT_STOCK_BALANCE = """
    INSERT INTO {schema}.stock_balance (part_id, branch_id, qty)
    VALUES (:part_id, :branch_id, :qty_effect)
    ON CONFLICT (part_id, branch_id)
    DO UPDATE SET
        qty        = stock_balance.qty + EXCLUDED.qty,
        updated_at = now()
"""
```

### qty_effect formula

| dr_cr | qty_effect |
|-------|-----------|
| `D` (stock IN) | `+qty` |
| `C` (stock OUT) | `-qty` |

### Branch Transfer — Two Balance Rows in One Transaction

```sql
-- Source branch: stock goes out (C)
UPSERT stock_balance (from_branch_id, part_id, qty_effect = -qty)

-- Destination branch: stock comes in (D)
UPSERT stock_balance (to_branch_id,   part_id, qty_effect = +qty)
```

Both are done inside the same `BEGIN … COMMIT` block so there is never a moment where stock appears to "vanish."

---

## Step 4 — PostgreSQL Trigger (Recommended)

To guarantee that `stock_balance` is **always** updated even if application code misses it, add a database-level trigger on `stock_transaction`.

```sql
CREATE OR REPLACE FUNCTION fn_update_stock_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_effect NUMERIC;
BEGIN
    v_effect := CASE NEW.dr_cr WHEN 'D' THEN NEW.qty ELSE -NEW.qty END;

    INSERT INTO stock_balance (part_id, branch_id, qty)
    VALUES (NEW.part_id, NEW.branch_id, v_effect)
    ON CONFLICT (part_id, branch_id)
    DO UPDATE SET
        qty        = stock_balance.qty + EXCLUDED.qty,
        updated_at = now();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_balance_insert
AFTER INSERT ON stock_transaction
FOR EACH ROW EXECUTE FUNCTION fn_update_stock_balance();
```

> [!IMPORTANT]
> Add a corresponding `AFTER DELETE` and `AFTER UPDATE` trigger if you ever allow editing or reversal of transactions. An update trigger should apply `old effect` → reverse + `new effect` → apply.

---

## Step 5 — Querying Stock

### Current Stock (O(1) — instant)
```sql
SELECT qty
FROM stock_balance
WHERE part_id = :part_id
  AND branch_id = :branch_id;
```

### All Parts Stock for a Branch
```sql
SELECT spm.part_code, spm.part_name, sb.qty, sb.updated_at
FROM stock_balance sb
JOIN spare_part_master spm ON spm.id = sb.part_id
WHERE sb.branch_id = :branch_id
ORDER BY spm.part_name;
```

### ❌ NEVER use this for current stock
```sql
-- This will be slow at scale — avoid for current stock
SELECT SUM(CASE WHEN dr_cr = 'D' THEN qty ELSE -qty END)
FROM stock_transaction
WHERE part_id = :part_id AND branch_id = :branch_id;
```
Reserve this query only for audit / reconciliation.

---

## Step 6 — `stock_snapshot` Table (Optional — for Historical Stock Queries)

If you need to answer "What was the stock on 31-March-2025?", you need either to sum all transactions up to that date (slow) or to use snapshots as a shortcut.

### Table

```sql
CREATE TABLE stock_snapshot (
    snapshot_date   DATE     NOT NULL,
    part_id         INTEGER  NOT NULL REFERENCES spare_part_master(id),
    branch_id       INTEGER  NOT NULL REFERENCES branch(id),
    qty             NUMERIC  NOT NULL,
    PRIMARY KEY (snapshot_date, part_id, branch_id)
);
```

### Snapshot Job (Monthly, run on 1st of every month at 00:01)

```sql
INSERT INTO stock_snapshot (snapshot_date, part_id, branch_id, qty)
SELECT
    (CURRENT_DATE - INTERVAL '1 day')::DATE,  -- last day of previous month
    part_id, branch_id, qty
FROM stock_balance
ON CONFLICT (snapshot_date, part_id, branch_id)
DO UPDATE SET qty = EXCLUDED.qty;
```

In FastAPI, implement this as a background scheduled task using **APScheduler** or **Celery beat** (or even a PostgreSQL `pg_cron` extension job).

### Historical Stock Query: "Stock as of :as_of_date"

```sql
-- Find the latest snapshot on or before the requested date
WITH latest_snap AS (
    SELECT snapshot_date, part_id, branch_id, qty
    FROM stock_snapshot
    WHERE snapshot_date <= :as_of_date
      AND part_id = :part_id
      AND branch_id = :branch_id
    ORDER BY snapshot_date DESC
    LIMIT 1
),
-- Add any transactions after that snapshot up to as_of_date
delta AS (
    SELECT COALESCE(SUM(
        CASE WHEN t.dr_cr = 'D' THEN t.qty ELSE -t.qty END
    ), 0) AS delta_qty
    FROM stock_transaction t, latest_snap ls
    WHERE t.part_id = ls.part_id
      AND t.branch_id = ls.branch_id
      AND t.transaction_date > ls.snapshot_date
      AND t.transaction_date <= :as_of_date
)
SELECT
    COALESCE(ls.qty, 0) + d.delta_qty AS stock_as_of_date
FROM delta d, latest_snap ls;
```

If no snapshot exists yet, fall back to full ledger sum (only needed during early days before first snapshot).

---

## Step 7 — Indexes on `stock_transaction` (Performance)

```sql
-- Primary lookup: part + branch + date range
CREATE INDEX idx_stxn_part_branch_date
    ON stock_transaction(part_id, branch_id, transaction_date DESC);

-- For snapshot delta query
CREATE INDEX idx_stxn_date
    ON stock_transaction(transaction_date DESC);

-- For type-based reporting
CREATE INDEX idx_stxn_type
    ON stock_transaction(stock_transaction_type_id);
```

---

## Step 8 — Partitioning `stock_transaction` (Long-term Scale)

When `stock_transaction` reaches > 1 million rows, use **range partitioning by year**. This keeps each annual partition small and lets PostgreSQL skip entire partitions for date-filtered queries.

### Convert to Partitioned Table

> [!WARNING]
> This requires a one-time migration (dump → re-create → restore). Plan for a maintenance window.

```sql
-- 1. Rename old table
ALTER TABLE stock_transaction RENAME TO stock_transaction_old;

-- 2. Create new partitioned parent
CREATE TABLE stock_transaction (
    id                              BIGSERIAL,
    part_id                         INTEGER NOT NULL,
    branch_id                       INTEGER NOT NULL,
    stock_transaction_type_id       INTEGER NOT NULL,
    transaction_date                DATE    NOT NULL,
    dr_cr                           CHAR(1) NOT NULL,
    qty                             NUMERIC NOT NULL,
    unit_cost                       NUMERIC,
    remarks                         TEXT,
    created_at                      TIMESTAMPTZ DEFAULT now(),
    purchase_line_id                INTEGER,
    sales_line_id                   INTEGER,
    stock_adjustment_line_id        INTEGER,
    job_part_used_id                INTEGER,
    stock_branch_transfer_line_id   INTEGER,
    stock_loan_line_id              INTEGER,
    PRIMARY KEY (id, transaction_date)   -- partition key must be in PK
) PARTITION BY RANGE (transaction_date);

-- 3. Create partitions (one per year)
CREATE TABLE stock_transaction_2024
    PARTITION OF stock_transaction
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE stock_transaction_2025
    PARTITION OF stock_transaction
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE stock_transaction_2026
    PARTITION OF stock_transaction
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- 4. Add default partition for future years
CREATE TABLE stock_transaction_future
    PARTITION OF stock_transaction DEFAULT;

-- 5. Copy data from old table
INSERT INTO stock_transaction SELECT * FROM stock_transaction_old;

-- 6. Drop old table
DROP TABLE stock_transaction_old;
```

Create a **yearly job** to add a new partition before Dec 31 each year — no operational disruption.

---

## Step 9 — Archiving Old Transactions (Optional, after 3+ years)

Since `stock_balance` always holds the current state, old ledger rows are only needed for audit. Move them to a cold `stock_transaction_archive` table:

```sql
-- Archive rows older than 2 years
INSERT INTO stock_transaction_archive
SELECT * FROM stock_transaction
WHERE transaction_date < (CURRENT_DATE - INTERVAL '2 years');

DELETE FROM stock_transaction
WHERE transaction_date < (CURRENT_DATE - INTERVAL '2 years');
```

**This is safe only because `stock_balance` and `stock_snapshot` exist.** You don't need old ledger rows to know today's stock.

---

## Step 10 — Reconciliation (Data Integrity Check)

Run a nightly job to verify `stock_balance` matches the full ledger sum. Alert if discrepancy > 0.

```sql
SELECT
    t.part_id,
    t.branch_id,
    SUM(CASE WHEN t.dr_cr = 'D' THEN t.qty ELSE -t.qty END) AS ledger_qty,
    b.qty AS balance_qty,
    SUM(CASE WHEN t.dr_cr = 'D' THEN t.qty ELSE -t.qty END) - b.qty AS discrepancy
FROM stock_transaction t
JOIN stock_balance b ON b.part_id = t.part_id AND b.branch_id = t.branch_id
GROUP BY t.part_id, t.branch_id, b.qty
HAVING ABS(SUM(CASE WHEN t.dr_cr = 'D' THEN t.qty ELSE -t.qty END) - b.qty) > 0.001;
```

If any row is returned, log it and alert. Use this to catch trigger failures or direct DB inserts that bypassed the trigger.

---

## Step 11 — TypeScript Type Changes

Add types for the new tables to `db-schema-service.ts`:

```typescript
// NEW — Table stock_balance
export interface StockBalance {
  part_id:    number;
  branch_id:  number;
  qty:        number;
  updated_at: Date;
}

// NEW — Table stock_snapshot
export interface StockSnapshot {
  snapshot_date: Date;
  part_id:       number;
  branch_id:     number;
  qty:           number;
}
```

Add corresponding `sql_store.py` SQL IDs:
- `GET_STOCK_BALANCE_BY_PART_BRANCH`
- `GET_STOCK_BALANCE_ALL_BY_BRANCH`
- `GET_STOCK_AS_OF_DATE`
- `UPSERT_STOCK_BALANCE` (internal, called by trigger or service layer)

---

## Implementation Order & Priority

| Priority | Step | Effort | Impact |
|----------|------|--------|--------|
| 🔴 Critical | Step 1 — Create `stock_balance` | Medium | Eliminates slow SUM queries |
| 🔴 Critical | Step 2 — Opening stock type | Low | Clean way to seed initial quantities |
| 🔴 Critical | Step 3/4 — Atomic updates + trigger | Medium | Keeps balance always correct |
| 🟡 Important | Step 5 — Update all queries to use balance | Medium | Performance win |
| 🟡 Important | Step 7 — Indexes | Low | Better ledger query speed |
| 🟢 Optional | Step 6 — Snapshots + historical query | Medium | "Stock as of date" reports |
| 🟢 Optional | Step 8 — Partitioning | High | Only needed at large scale (>1M rows) |
| 🟢 Optional | Step 9 — Archiving | Low | After partitioning is done |
| 🟢 Optional | Step 10 — Reconciliation job | Low | Data integrity assurance |

---

## Summary

```
Opening Stock   →  stock_transaction (type=OPENING) + stock_balance (upsert)
Every Movement  →  stock_transaction (INSERT) + stock_balance (UPSERT via trigger)
Current Stock   →  SELECT qty FROM stock_balance WHERE part_id=? AND branch_id=?
Historical Stock →  snapshot.qty + SUM(transactions after snapshot up to date)
Scale           →  partition stock_transaction by year; archive via stock_snapshot
```

**No financial year. No year-end closing. No recalculation of opening balances.** The balance is always live, always correct, and always O(1) to read.
