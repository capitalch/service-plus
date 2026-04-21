# Plan: Deliver Job (Jobs > Deliver Job)

## Context
"Deliver Job" is the final step in the service-centre workflow. After counter staff has created a job invoice in "Ready for Delivery", the customer arrives, pays, and takes the device. This step:

1. Shows jobs that are **ready to be handed over** (status = "Ready for Delivery", `is_closed = false`)
2. Records the **payment** (`job_payment` table)
3. **Closes the job**: sets `is_closed = true`, `delivery_date`, advances `job_status_id` to "Delivered"
4. Creates a `job_transaction` row for the audit trail (same chain as Update Job)

### Relevant DB Tables
| Table | Purpose |
|-------|---------|
| `job` | `is_closed`, `delivery_date`, `job_status_id`, `last_transaction_id` |
| `job_payment` | `job_id`, `payment_date`, `payment_mode`, `amount`, `reference_no`, `remarks` |
| `job_transaction` | Audit trail — one row per status change, chained via `previous_transaction_id` |
| `job_invoice` | Read-only reference — shows amount due to the customer |
| `job_delivery_manner` | Lookup: how the device is handed back (Walk-in pickup, Courier, etc.) — captured in `job_transaction.notes` since `job` has no `delivery_manner_id` column |

`job_payment` cascades on `job` delete.

---

## Architecture

Single-file section (`deliver-job-section.tsx`) with two sub-views:
1. **List view** — paginated grid of ready-to-deliver jobs; click row → delivery view
2. **Delivery view** — read-only job + invoice summary + payment form + "Deliver" action

No separate form file — payment form is simple (no line items).

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/components/jobs/deliver-job-section.tsx` | All-in-one section |

---

## Files to Modify

### Backend
1. **`app/db/sql_store.py`**
   - Add `GET_DELIVERABLE_JOBS_COUNT` — count where job's status code = `'READY'` (or `is_final=true`) and `is_closed=false`, with branch/date/search filters
   - Add `GET_DELIVERABLE_JOBS_PAGED` — same filter + columns: id, job_no, job_date, customer_name, mobile, job_status_name, technician_name, amount, invoice total (from `job_invoice`), last_transaction_id
   - Add `GET_JOB_DELIVERY_DETAIL` — full job + invoice summary + existing payments for a given `job_id`
   - Add `GET_JOB_DELIVERY_MANNERS` — already exists ✅ (reuse)

2. **`app/graphql/schema.graphql`**
   - Add `deliverJob(db_name: String!, schema: String, value: String!): Generic`

3. **`app/graphql/resolvers/mutation_helper.py`**
   - Add `resolve_deliver_job_helper` — atomic: insert `job_payment` (if amount > 0) + update `job` fields + insert `job_transaction` + update `job.last_transaction_id`

4. **`app/graphql/resolvers/mutation.py`**
   - Import + add `@mutation.field("deliverJob")` resolver

### Frontend
5. **`src/constants/sql-map.ts`**
   - Add: `GET_DELIVERABLE_JOBS_COUNT`, `GET_DELIVERABLE_JOBS_PAGED`, `GET_JOB_DELIVERY_DETAIL`

6. **`src/constants/graphql-map.ts`**
   - Add `deliverJob` mutation

7. **`src/constants/messages.ts`**
   - Add:
     ```
     ERROR_DELIVERABLE_JOBS_LOAD_FAILED: 'Failed to load jobs for delivery. Please try again.'
     ERROR_JOB_DELIVERY_DETAIL_FAILED:   'Failed to load job delivery details. Please try again.'
     ERROR_JOB_DELIVER_FAILED:           'Failed to deliver job. Please try again.'
     SUCCESS_JOB_DELIVERED:              'Job delivered and closed successfully.'
     ```

8. **`src/features/client/pages/client-jobs-page.tsx`**
   - Add `case "Deliver Job": return <DeliverJobSection />;`

---

## Implementation Details

### SQL: `GET_DELIVERABLE_JOBS_COUNT`
```sql
-- Parameters: branch_id, from_date, to_date, search
-- Filter: jobs with a "Ready for Delivery" status (is_final=true AND is_closed=false)
-- Use status code-based filter: js.code = 'READY' (or is_final=true depending on setup)
SELECT COUNT(*) AS total
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_status        js ON js.id = j.job_status_id
WHERE j.branch_id = %(branch_id)s
  AND j.job_date BETWEEN %(from_date)s AND %(to_date)s
  AND j.is_final  = true
  AND j.is_closed = false
  AND (%(search)s = ''
   OR LOWER(j.job_no)     LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.mobile)    LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.full_name) LIKE '%' || LOWER(%(search)s) || '%')
```

### SQL: `GET_DELIVERABLE_JOBS_PAGED`
```sql
SELECT j.id, j.job_no, j.job_date, j.amount, j.last_transaction_id,
       cc.full_name AS customer_name, cc.mobile,
       js.name      AS job_status_name,
       t.name       AS technician_name,
       ji.total_amount AS invoice_total,
       ji.invoice_no
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_status        js ON js.id = j.job_status_id
LEFT JOIN technician   t  ON t.id  = j.technician_id
LEFT JOIN job_invoice  ji ON ji.job_id = j.id
WHERE ... (same filter as count)
ORDER BY j.job_date DESC, j.job_no
LIMIT %(limit)s OFFSET %(offset)s
```

### SQL: `GET_JOB_DELIVERY_DETAIL`
```sql
-- Parameters: job_id
-- Returns: job fields + customer info + invoice summary + existing payments
SELECT
    j.id, j.job_no, j.job_date, j.problem_reported, j.diagnosis, j.work_done,
    j.amount, j.delivery_date, j.is_closed, j.last_transaction_id,
    cc.full_name AS customer_name, cc.mobile,
    js.name      AS job_status_name,
    t.name       AS technician_name,
    ji.id        AS invoice_id,
    ji.invoice_no,
    ji.invoice_date,
    ji.total_amount AS invoice_total,
    -- Aggregate existing payments
    COALESCE(
        json_agg(
            json_build_object(
                'id',           jp.id,
                'payment_date', jp.payment_date,
                'payment_mode', jp.payment_mode,
                'amount',       jp.amount,
                'reference_no', jp.reference_no,
                'remarks',      jp.remarks
            ) ORDER BY jp.created_at
        ) FILTER (WHERE jp.id IS NOT NULL),
        '[]'
    ) AS payments
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_status        js ON js.id = j.job_status_id
LEFT JOIN technician   t  ON t.id  = j.technician_id
LEFT JOIN job_invoice  ji ON ji.job_id = j.id
LEFT JOIN job_payment  jp ON jp.job_id = j.id
WHERE j.id = %(job_id)s
GROUP BY j.id, cc.full_name, cc.mobile, js.name, t.name,
         ji.id, ji.invoice_no, ji.invoice_date, ji.total_amount
```

### `deliverJob` Mutation Payload
```typescript
{
    job_id:               number,
    last_transaction_id:  number | null,     // for audit chain
    performed_by_user_id: number,
    delivered_status_id:  number,            // job_status.id for "Delivered"
    delivery_date:        string,            // date
    delivery_manner_name: string,            // e.g. "Walk-in Pickup" — stored in txn notes
    transaction_notes:    string,            // goes into job_transaction.notes
    // Payment (optional — amount=0 means no payment row inserted)
    payment: {
        payment_date:  string,
        payment_mode:  string,
        amount:        number,
        reference_no:  string,
        remarks:       string,
    }
}
```

### `resolve_deliver_job_helper` (Python)
```python
async def resolve_deliver_job_helper(db_name, schema, value):
    # 1. Decode payload
    # 2. Pop: job_id, last_transaction_id, performed_by_user_id,
    #         delivered_status_id, delivery_date, delivery_manner_name,
    #         transaction_notes, payment
    # 3. If payment.amount > 0:
    #    exec_sql_object → INSERT job_payment {job_id, payment_date, payment_mode,
    #                        amount, reference_no, remarks}
    # 4. exec_sql_object → UPDATE job:
    #    {id=job_id, is_closed=true, delivery_date=delivery_date,
    #     job_status_id=delivered_status_id}
    # 5. Build txn notes: f"{delivery_manner_name}. {transaction_notes}".strip()
    # 6. exec_sql_object → INSERT job_transaction:
    #    {job_id, status_id=delivered_status_id, performed_by_user_id,
    #     previous_transaction_id=last_transaction_id, notes=full_notes}
    #    → returns new_txn_id
    # 7. exec_sql_object → UPDATE job SET last_transaction_id = new_txn_id
    # Returns: new_txn_id
```

### Delivery View UI Layout

```
─── Job Summary (read-only) ────────────────────────────────────────────
  Job No  |  Date  |  Customer  |  Mobile  |  Technician  |  Status

─── Problem / Work Done (read-only, collapsed by default) ──────────────
  Problem Reported: ...
  Diagnosis:        ...
  Work Done:        ...

─── Invoice Summary (read-only) ────────────────────────────────────────
  Invoice No  |  Invoice Date  |  Total Amount: ₹ ___
  (if no invoice: "No invoice found — create one in Ready for Delivery first")

─── Existing Payments (read-only list, if any) ─────────────────────────
  # | Date | Mode | Amount | Ref No | Remarks

─── Delivery Details ───────────────────────────────────────────────────
  Delivery Date * (date, default today)
  Delivery Manner (dropdown from GET_JOB_DELIVERY_MANNERS)
  Transaction Notes (textarea)

─── Payment (optional — leave amount = 0 to skip) ──────────────────────
  Payment Date * (default today)
  Payment Mode * (text or select: Cash / Card / UPI / Cheque / Online)
  Amount         (number, default = invoice_total − already_paid)
  Reference No   (text, optional)
  Remarks        (text, optional)

─── Footer ─────────────────────────────────────────────────────────────
  [← Back to List]              [Deliver & Close Job]
```

**"Deliver & Close Job" button** is disabled until:
- `delivery_date` is set
- If `invoice_total > 0` and `amount_paid_so_far < invoice_total`: `payment.amount > 0`

**Amount pre-fill**: `invoice_total − SUM(existing_payments.amount)` (the balance due).

**Payment mode options** (hardcoded in frontend): `["Cash", "Card", "UPI", "Cheque", "Online Transfer", "Other"]`

### List View Columns

| Col | Field | Notes |
|-----|-------|-------|
| # | row number | |
| Date | job_date | |
| Job No | job_no | |
| Customer | customer_name | |
| Mobile | mobile | |
| Status | job_status_name | colored badge |
| Technician | technician_name | |
| Invoice | invoice_no | monospace, `—` if none |
| Invoice Total | invoice_total | ₹ formatted |
| Actions | Deliver button | → delivery view |

---

## Existing Utilities to Reuse

| Utility | Notes |
|---------|-------|
| `GET_JOB_DELIVERY_MANNERS` | Already in `SQL_MAP` — no change needed |
| `GET_JOB_STATUSES` | Find "Delivered" status id by code at runtime |
| `selectCurrentUser` | `performed_by_user_id` |
| `selectCurrentBranch` | `branch_id` for list queries |
| `currentFinancialYearRange()` | Default date filter |
| Pagination + skeleton | Clone from job-section.tsx |
| `thClass` / `tdClass` | Same CSS variables |
| `resolve_create_job_helper` | Reference pattern for txn chain logic |

---

## Verification Steps

1. Navigate to **Jobs > Deliver Job**
2. **List view**: only `is_final=true, is_closed=false` jobs appear; date/search filters work; invoice_no and invoice_total columns populated
3. **Click a job** → delivery view loads with read-only summary and pre-filled payment amount (balance due)
4. **Fill payment**: set payment mode = "Cash", amount = balance — "Deliver & Close Job" button enables
5. **Deliver**: click button → toast success; back to list; job disappears (now `is_closed=true`)
6. **DB check**:
   - `job_payment` row inserted with correct amount/mode
   - `job.is_closed = true`, `job.delivery_date` set, `job.job_status_id` = Delivered
   - New `job_transaction` row with `previous_transaction_id` chain intact
   - `job.last_transaction_id` points to the new transaction
7. **No invoice case**: Job with no `job_invoice` shows warning; "Deliver & Close" still works (payment optional if invoice_total = 0)
8. **Zero payment**: If invoice total = 0 or warranty job, leave amount = 0 — no `job_payment` row inserted; job still closes
9. **Back without delivering**: clicking Back discards form state; job remains open in list
