# Plan: Stock Snapshot Strategy

## Context
The `stock_snapshot` table captures periodic (monthly) summaries of stock movements per part per branch. Currently the table exists but is not populated. The goals are:
1. Auto-populate it at end of every month (FastAPI background job).
2. Allow Admin to manually trigger snapshot generation for any selected period (to handle back-dated stock transactions).
3. Enhance the part-finder stock detail panel to show an up-to-date summary = **last snapshot closing balance + transactions after the snapshot date**.

**Note on back-dated transactions:** Since `stock_balance` is maintained by a PostgreSQL trigger (`fn_maintain_stock_balance`) that runs on every INSERT/UPDATE/DELETE of `stock_transaction` — regardless of `transaction_date` — the **current balance is always accurate**. However, already-generated snapshots for past months will be stale when back-dated transactions are added. Recommended strategy: allow admin to **re-run** the snapshot for any period, which overwrites the previous snapshot via UPSERT.

---

## Workflow
```
End of month (auto)
  FastAPI scheduler detects month change (1st of month at 00:05)
        ↓
  Calls generate_stock_snapshot(db_name, schema, year, month)
        ↓
  Sums stock_transaction rows for that month by part+branch
  Computes opening (= prev snapshot closing or 0)
  UPSERTs into stock_snapshot
        ↓
  Logs result

Admin manual trigger (UI)
  Selects year + month → POST /api/{db_name}/{schema}/stock-snapshot/generate
        ↓
  Same generate_stock_snapshot logic, overwrites existing snapshot
        ↓
  Success notification with row count

Part Finder Detail Panel — Stock Tab
  Query: last snapshot + transactions since last snapshot date
        ↓
  Shows: snapshot_date, snapshot_closing, movements breakdown since, current_total
  (current_total always matches stock_balance.qty — ground truth from triggers)
```

---

## Step 1 — Add SQL to sql_store.py
**File:** `service-plus-server/app/db/sql_store.py`

### SQL_GENERATE_STOCK_SNAPSHOT
Generates/overwrites snapshot for a given month. Parameters: `p_year` (int), `p_month` (int).

Key logic:
- `period_start` = first day of month, `period_end` = last day of month, `snapshot_date` = last day
- `opening` = `closing` from the most recent snapshot BEFORE this period (or 0 if none)
- `closing` = opening + net movements for the month
- Each in/out column = SUM filtered by `stock_transaction_type.code`
- `ON CONFLICT ... DO UPDATE SET` overwrites all columns (handles re-runs for back-dated corrections)

```sql
WITH period AS (
    SELECT
        DATE_TRUNC('month', make_date(:p_year, :p_month, 1))::date                                   AS period_start,
        (DATE_TRUNC('month', make_date(:p_year, :p_month, 1)) + INTERVAL '1 month - 1 day')::date    AS period_end,
        (DATE_TRUNC('month', make_date(:p_year, :p_month, 1)) + INTERVAL '1 month - 1 day')::date    AS snapshot_date
),
prev_snapshot AS (
    SELECT ss.part_id, ss.branch_id, ss.closing
    FROM demo1.stock_snapshot ss
    INNER JOIN (
        SELECT part_id, branch_id, MAX(snapshot_date) AS max_date
        FROM demo1.stock_snapshot
        WHERE snapshot_date < (SELECT period_start FROM period)
        GROUP BY part_id, branch_id
    ) latest ON latest.part_id = ss.part_id
           AND latest.branch_id = ss.branch_id
           AND latest.snapshot_date = latest.max_date
),
tran_summary AS (
    SELECT
        st.part_id,
        st.branch_id,
        SUM(CASE WHEN stt.dr_cr = 'D' THEN st.qty ELSE -st.qty END)           AS net_qty,
        SUM(CASE WHEN stt.code = 'PURCHASE' AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS purchase_in,
        SUM(CASE WHEN stt.code = 'PURCHASE' AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS purchase_out,
        SUM(CASE WHEN stt.code = 'SALES'    AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS sales_in,
        SUM(CASE WHEN stt.code = 'SALES'    AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS sales_out,
        SUM(CASE WHEN stt.code = 'ADJUST'   AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS adjust_in,
        SUM(CASE WHEN stt.code = 'ADJUST'   AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS adjust_out,
        SUM(CASE WHEN stt.code = 'LOAN'     AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS loan_in,
        SUM(CASE WHEN stt.code = 'LOAN'     AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS loan_out,
        SUM(CASE WHEN stt.code = 'TRANSFER' AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS branch_transfer_in,
        SUM(CASE WHEN stt.code = 'TRANSFER' AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS branch_transfer_out
    FROM demo1.stock_transaction st
    JOIN demo1.stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
    WHERE st.transaction_date BETWEEN (SELECT period_start FROM period)
                                  AND (SELECT period_end   FROM period)
    GROUP BY st.part_id, st.branch_id
)
INSERT INTO demo1.stock_snapshot (
    snapshot_date, part_id, branch_id,
    opening, closing,
    purchase_in, purchase_out, sales_in, sales_out,
    adjust_in, adjust_out, loan_in, loan_out,
    branch_transfer_in, branch_transfer_out
)
SELECT
    (SELECT snapshot_date FROM period),
    ts.part_id, ts.branch_id,
    COALESCE(ps.closing, 0)                        AS opening,
    COALESCE(ps.closing, 0) + ts.net_qty           AS closing,
    ts.purchase_in,  ts.purchase_out,
    ts.sales_in,     ts.sales_out,
    ts.adjust_in,    ts.adjust_out,
    ts.loan_in,      ts.loan_out,
    ts.branch_transfer_in, ts.branch_transfer_out
FROM tran_summary ts
LEFT JOIN prev_snapshot ps ON ps.part_id = ts.part_id AND ps.branch_id = ts.branch_id
ON CONFLICT (snapshot_date, part_id, branch_id) DO UPDATE SET
    opening              = EXCLUDED.opening,
    closing              = EXCLUDED.closing,
    purchase_in          = EXCLUDED.purchase_in,
    purchase_out         = EXCLUDED.purchase_out,
    sales_in             = EXCLUDED.sales_in,
    sales_out            = EXCLUDED.sales_out,
    adjust_in            = EXCLUDED.adjust_in,
    adjust_out           = EXCLUDED.adjust_out,
    loan_in              = EXCLUDED.loan_in,
    loan_out             = EXCLUDED.loan_out,
    branch_transfer_in   = EXCLUDED.branch_transfer_in,
    branch_transfer_out  = EXCLUDED.branch_transfer_out
RETURNING part_id
```
> **Important:** Verify exact `code` values in `stock_transaction_type` table before finalising the CASE expressions.

### SQL_PART_FINDER_STOCK_SUMMARY
New query for part-finder detail panel. Parameters: `p_part_id`, `p_branch_id`.

Returns a single row: last snapshot info + aggregate of transactions since that snapshot date.

```sql
WITH last_snap AS (
    SELECT snapshot_date, closing,
           purchase_in, purchase_out, sales_in, sales_out,
           adjust_in, adjust_out, loan_in, loan_out,
           branch_transfer_in, branch_transfer_out
    FROM demo1.stock_snapshot
    WHERE part_id = :p_part_id AND branch_id = :p_branch_id
    ORDER BY snapshot_date DESC
    LIMIT 1
),
tran_since AS (
    SELECT
        SUM(CASE WHEN stt.dr_cr = 'D' THEN st.qty ELSE -st.qty END)           AS net_qty,
        SUM(CASE WHEN stt.code = 'PURCHASE' AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS purchase_in,
        SUM(CASE WHEN stt.code = 'PURCHASE' AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS purchase_out,
        SUM(CASE WHEN stt.code = 'SALES'    AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS sales_out,
        SUM(CASE WHEN stt.code = 'ADJUST'   AND stt.dr_cr = 'D' THEN st.qty ELSE 0 END) AS adjust_in,
        SUM(CASE WHEN stt.code = 'ADJUST'   AND stt.dr_cr = 'C' THEN st.qty ELSE 0 END) AS adjust_out
    FROM demo1.stock_transaction st
    JOIN demo1.stock_transaction_type stt ON stt.id = st.stock_transaction_type_id
    WHERE st.part_id   = :p_part_id
      AND st.branch_id = :p_branch_id
      AND st.transaction_date > COALESCE((SELECT snapshot_date FROM last_snap), '1900-01-01'::date)
)
SELECT
    ls.snapshot_date                                        AS last_snapshot_date,
    COALESCE(ls.closing, 0)                                 AS snapshot_closing,
    COALESCE(ts.net_qty, 0)                                 AS net_since_snapshot,
    COALESCE(ls.closing, 0) + COALESCE(ts.net_qty, 0)      AS current_stock,
    COALESCE(ts.purchase_in,  0)                            AS purchase_in_since,
    COALESCE(ts.purchase_out, 0)                            AS purchase_out_since,
    COALESCE(ts.sales_out,    0)                            AS sales_out_since,
    COALESCE(ts.adjust_in,    0)                            AS adjust_in_since,
    COALESCE(ts.adjust_out,   0)                            AS adjust_out_since
FROM last_snap ls
FULL OUTER JOIN tran_since ts ON true
```

---

## Step 3 — FastAPI Background Scheduler
**New file:** `service-plus-server/app/scheduler.py`

- Use `apscheduler` library (add to `requirements.txt`: `apscheduler>=3.10`)
- `AsyncIOScheduler` with a cron trigger: runs at `00:05` on the 1st of every month
- Job logic:
  1. Calculate previous month's year + month
  2. Query all active clients from `service_plus_client.public.client` table (get `db_name`, `schema`)
  3. For each client: execute `SQL_GENERATE_STOCK_SNAPSHOT` using that client's db_name + schema
  4. Log results (rows generated per client)

**Modified file:** `service-plus-server/app/main.py`
- In the `lifespan` context manager: start scheduler on startup, shutdown on exit

---

## Step 4 — Client: Admin Manual Trigger UI
**No separate FastAPI REST endpoint needed.** Use `genericUpdateScript` via Apollo — this is the project-standard pattern for all mutations and is already authenticated globally via `authMiddleware` (Bearer token sent on every Apollo call).

**New file:** `src/features/client/components/inventory/stock-snapshot/stock-snapshot-trigger.tsx`

- Add `SQL_GENERATE_STOCK_SNAPSHOT` to `src/constants/sql-map.ts`
- Form: Year (number input, default current year) + Month (Select 1-12, default previous month)
- Uses `react-hook-form` + `zod` for validation (year ≥ 2020, month 1-12); `*` on required fields shown in red
- On submit:
```ts
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdateScript,
    variables: {
        db_name: dbName,
        schema,
        value: encodeObj({
            sql_id:   SQL_MAP.SQL_GENERATE_STOCK_SNAPSHOT,
            sql_args: { year: selectedYear, month: selectedMonth },
        }),
    },
});
```
- On success: Sonner toast "Snapshot generated: {count} parts updated for {month}/{year}"
- On error: error toast

**Admin-only visibility:** Check `user.userType === 'A' || user.userType === 'S'` (from `selectCurrentUser` selector) — hide the menu item entirely for non-admin users.

**New menu item in Inventory sidebar:**
- File: `src/features/client/components/client-explorer-panel.tsx`
- Add a new `CollapsibleGroup label="Admin"` section at the bottom of `InventoryExplorer` (same pattern as `MastersExplorer` uses for group labels)
- Inside it: `<TreeItem icon={Camera} label="Stock Snapshot" />`  
- Wrap the entire `CollapsibleGroup` in a conditional: only render when `userType === 'A' || userType === 'S'`

**Wire up in page:**
- File: `src/features/client/pages/client-inventory-page.tsx`
- Add `case "Stock Snapshot": return <StockSnapshotTrigger />;`

---

## Step 6 — Client: Enhance Part Finder Stock Tab
**File:** `src/features/client/components/inventory/part-finder/part-finder-detail-panel.tsx`

- Add new SQL key `PART_FINDER_STOCK_SUMMARY` to `src/constants/sql-map.ts`
- Add `PartFinderStockSummaryType` to `src/features/client/types/part-finder.ts`:
  ```ts
  type PartFinderStockSummaryType = {
      adjust_in_since:    number;
      adjust_out_since:   number;
      current_stock:      number;
      last_snapshot_date: string | null;
      net_since_snapshot: number;
      purchase_in_since:  number;
      purchase_out_since: number;
      sales_out_since:    number;
      snapshot_closing:   number;
  }
  ```
- In the Stock tab, fire `SQL_PART_FINDER_STOCK_SUMMARY` (in addition to the existing `PART_FINDER_STOCK_BY_LOCATION` query)
- Render a summary block above the location table:

```
Last Snapshot: 31 Mar 2026          Snapshot Balance: 45.000
─────────────────────────────────────────────────────────────
Movements since snapshot:
  Purchase In:   +12.000    Sales Out:  -8.000
  Adjustments:   +2.000 in / -0.000 out
  Net:           +6.000
─────────────────────────────────────────────────────────────
Current Stock:  51.000   [In Stock]
```

- If no snapshot exists: show "No snapshot yet — all stock from live transactions" and display full stock from `stock_balance`.

---

## Step 7 — Client: messages.ts
Add to `src/constants/messages.ts`:
```ts
STOCK_SNAPSHOT_ERROR:       'Failed to generate stock snapshot. Please try again.',
STOCK_SNAPSHOT_NO_DATA:     'No stock transactions found for the selected period.',
STOCK_SNAPSHOT_NO_SNAPSHOT: 'No snapshot recorded yet. Showing live transaction data.',
STOCK_SNAPSHOT_SUCCESS:     'Stock snapshot generated successfully.',
```

---

## Back-Dated Transactions — Final Recommendation

| Option | Complexity | Accuracy |
|--------|-----------|----------|
| **Manual re-run** (chosen) | Low | Admin re-runs affected month | Accurate after re-run |
| Auto-dirty flag | Medium | PostgreSQL trigger flags stale snapshots; scheduler re-runs them | Fully automatic |
| No snapshots for balance | Low | Always compute from live transactions; snapshots for analytics only | Always accurate |

**Recommendation:** Implement manual re-run (Steps 4+5) now. The part-finder stock summary query (Step 6) already provides accurate live data regardless of whether snapshots are up-to-date, because it computes `last_snapshot.closing + net transactions since snapshot` — which will always equal `stock_balance.qty` (the trigger-maintained ground truth).

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `service-plus-server/app/db/sql_store.py` | Add `SQL_GENERATE_STOCK_SNAPSHOT` + `SQL_PART_FINDER_STOCK_SUMMARY` |
| `service-plus-server/app/scheduler.py` | NEW — APScheduler monthly job |
| `service-plus-server/app/main.py` | Wire scheduler into lifespan |
| `service-plus-client/src/constants/sql-map.ts` | Add `SQL_GENERATE_STOCK_SNAPSHOT` + `PART_FINDER_STOCK_SUMMARY` |
| `service-plus-client/src/constants/messages.ts` | Add 4 messages |
| `service-plus-client/src/features/client/types/part-finder.ts` | Add `PartFinderStockSummaryType` |
| `service-plus-client/src/features/client/components/inventory/part-finder/part-finder-detail-panel.tsx` | Enhance Stock tab |
| `service-plus-client/src/features/client/components/client-explorer-panel.tsx` | Add Admin `CollapsibleGroup` + Stock Snapshot item (admin-only) |
| `service-plus-client/src/features/client/pages/client-inventory-page.tsx` | Add `case "Stock Snapshot"` |
| `service-plus-client/src/features/client/components/inventory/stock-snapshot/stock-snapshot-trigger.tsx` | NEW — Admin UI (uses `genericUpdateScript`) |

---

## Verification
1. Run DB migration; verify `uq_stock_snapshot_date_part_branch` constraint exists.
2. Start FastAPI; verify scheduler starts in logs.
3. Use admin UI: select previous month → Generate → verify `stock_snapshot` rows in DB.
4. Re-run same month (simulate back-dated transaction fix) → verify UPSERT updates rows.
5. Open Part Finder → select a part with transactions → Stock tab shows snapshot summary + movements since.
6. Test a part with NO snapshot → shows "No snapshot yet" + live stock from `stock_balance`.
7. Manually invoke scheduler function in a test script to verify end-of-month logic.
