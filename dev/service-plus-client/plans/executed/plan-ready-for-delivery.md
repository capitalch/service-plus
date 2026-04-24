# Plan: Ready for Delivery (Jobs > Ready for Delivery)

## Context
In the service-centre workflow, once a technician marks a job as **final** (`is_final = true`) the counter staff opens "Ready for Delivery" to:
1. Review jobs that are repaired but not yet handed back (`is_final = true`, `is_closed = false`)
2. Create the **job invoice** (`job_invoice` + `job_invoice_line`) — the GST bill the customer pays
3. Mark the job status as "Ready for Delivery" (a specific `job_status` row)

The next step — "Deliver Job" — handles payment collection and actual job closure.

### Relevant DB Tables
| Table | Purpose |
|-------|---------|
| `job` | Master job record; `is_final`, `is_closed`, `job_status_id` |
| `job_invoice` | Invoice header: `job_id`, `invoice_no`, `invoice_date`, GST amounts, `company_id`, `supply_state_code` |
| `job_invoice_line` | Line items: `description`, `part_code`, `hsn_code`, `quantity`, `unit_price`, GST rates/amounts, `total_amount` |
| `job_part_used` + `spare_part_master` | Source for auto-populating parts lines on the invoice |
| `document_sequence` | `document_type_code = 'JINV'` — auto-generates `invoice_no` |

`job_invoice_line` cascades on `job_invoice` delete.

---

## Architecture

Single-file section (`ready-for-delivery-section.tsx`) with two sub-views:
1. **List view** — paginated grid of `is_final=true, is_closed=false` jobs; click row → invoice view
2. **Invoice view** — read-only job summary + create/edit `job_invoice` with line items + "Mark Ready" action

No separate form file — line items are in-line within the section (same as update-job pattern).

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/components/jobs/ready-for-delivery-section.tsx` | All-in-one section |
| `src/features/client/types/job-invoice.ts` | `JobInvoiceType`, `JobInvoiceLineType`, `JobInvoiceFormLine` |

---

## Files to Modify

### Backend
1. **`app/db/sql_store.py`**
   - Add `GET_READY_JOBS_COUNT` — count where `is_final=true AND is_closed=false` + branch/date/search filters
   - Add `GET_READY_JOBS_PAGED` — same filter + columns: id, job_no, job_date, customer_name, mobile, job_status_name, technician_name, amount, has_invoice (EXISTS subquery on job_invoice)
   - Add `GET_JOB_INVOICE_BY_JOB` — full `job_invoice` with its `job_invoice_line` rows for a given `job_id` (null if none)
   - Add `GET_JOB_PARTS_FOR_INVOICE` — `job_part_used` joined to `spare_part_master` for a given `job_id` (used for auto-populate button)

> **No new GraphQL mutation needed.** `genericUpdate` handles this via its `xDetails` sibling pattern: `job_invoice_line`, `job`, and `document_sequence` are all siblings inside `xDetails`. The driver (`process_details`) passes the parent's id as `fkey_value` to each child; siblings that carry their own `id` trigger UPDATE and ignore `fkey_value`; siblings with `fkeyName` receive it for INSERT. All ops run inside a single connection/transaction.

### Frontend
2. **`src/constants/sql-map.ts`**
   - Add: `GET_READY_JOBS_COUNT`, `GET_READY_JOBS_PAGED`, `GET_JOB_INVOICE_BY_JOB`, `GET_JOB_PARTS_FOR_INVOICE`

3. **`src/constants/messages.ts`**
   - Add:
     ```
     ERROR_READY_JOBS_LOAD_FAILED:    'Failed to load ready jobs. Please try again.'
     ERROR_JOB_INVOICE_LOAD_FAILED:   'Failed to load job invoice. Please try again.'
     ERROR_JOB_INVOICE_SAVE_FAILED:   'Failed to save job invoice. Please try again.'
     ERROR_JOB_INVOICE_LINE_REQUIRED: 'Add at least one invoice line.'
     SUCCESS_JOB_INVOICE_SAVED:       'Invoice saved and job marked as Ready for Delivery.'
     ```

4. **`src/features/client/pages/client-jobs-page.tsx`**
   - Add `case "Ready for Delivery": return <ReadyForDeliverySection />;`

---

## Implementation Details

### New Type File: `src/features/client/types/job-invoice.ts`
```typescript
export type JobInvoiceType = {
    id:                 number;
    job_id:             number;
    company_id:         number;
    invoice_no:         string;
    invoice_date:       string;
    supply_state_code:  string;
    taxable_amount:     number;
    cgst_amount:        number;
    sgst_amount:        number;
    igst_amount:        number;
    total_tax:          number;
    total_amount:       number;
};

export type JobInvoiceLineType = {
    id:               number;
    job_invoice_id:   number;
    description:      string;
    part_code:        string | null;
    hsn_code:         string;
    quantity:         number;
    unit_price:       number;
    taxable_amount:   number;
    cgst_rate:        number;
    sgst_rate:        number;
    igst_rate:        number;
    cgst_amount:      number;
    sgst_amount:      number;
    igst_amount:      number;
    total_amount:     number;
};

// Used in the form (no id for new lines)
export type JobInvoiceFormLine = {
    _key:        string;   // local React key
    description: string;
    part_code:   string;
    hsn_code:    string;
    quantity:    string;
    unit_price:  string;
    gst_rate:    string;   // single rate; split to cgst/sgst or igst on save
};
```

### SQL: `GET_READY_JOBS_COUNT`
```sql
-- Parameters: branch_id, from_date, to_date, search
SELECT COUNT(*) AS total
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
WHERE j.branch_id = %(branch_id)s
  AND j.job_date BETWEEN %(from_date)s AND %(to_date)s
  AND j.is_final = true
  AND j.is_closed = false
  AND (%(search)s = ''
   OR LOWER(j.job_no)     LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.mobile)    LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.full_name) LIKE '%' || LOWER(%(search)s) || '%')
```

### SQL: `GET_READY_JOBS_PAGED`
```sql
-- Same filter + extra columns
SELECT j.id, j.job_no, j.job_date, j.amount,
       cc.full_name AS customer_name, cc.mobile,
       js.name AS job_status_name,
       t.name  AS technician_name,
       EXISTS(SELECT 1 FROM job_invoice ji WHERE ji.job_id = j.id) AS has_invoice
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_status        js ON js.id = j.job_status_id
LEFT JOIN technician   t  ON t.id  = j.technician_id
WHERE ... (same filter as count)
ORDER BY j.job_date DESC, j.job_no
LIMIT %(limit)s OFFSET %(offset)s
```

### SQL: `GET_JOB_INVOICE_BY_JOB`
```sql
-- Returns job_invoice row + nested job_invoice_line rows (JSON aggregated)
SELECT ji.*,
       COALESCE(
           json_agg(jil ORDER BY jil.id) FILTER (WHERE jil.id IS NOT NULL),
           '[]'
       ) AS lines
FROM job_invoice ji
LEFT JOIN job_invoice_line jil ON jil.job_invoice_id = ji.id
WHERE ji.job_id = %(job_id)s
GROUP BY ji.id
```

### SQL: `GET_JOB_PARTS_FOR_INVOICE`
```sql
-- Parameters: job_id
SELECT jpu.quantity, sp.part_code, sp.part_name, sp.uom
FROM job_part_used jpu
JOIN spare_part_master sp ON sp.id = jpu.part_id
WHERE jpu.job_id = %(job_id)s
ORDER BY jpu.id
```

### `genericUpdate` Payload — New Invoice
All totals are pre-computed on the frontend. The driver handles everything in one transaction.

```json
{
    "tableName": "job_invoice",
    "xData": {
        "job_id":             "<job_id>",
        "company_id":         "<company_id>",
        "invoice_no":         "<generated from doc sequence>",
        "invoice_date":       "<date>",
        "supply_state_code":  "<state code>",
        "taxable_amount":     "<number>",
        "cgst_amount":        "<number>",
        "sgst_amount":        "<number>",
        "igst_amount":        "<number>",
        "total_tax":          "<number>",
        "total_amount":       "<number>"
    },
    "xDetails": [
        {
            "tableName": "job_invoice_line",
            "fkeyName":  "job_invoice_id",
            "xData": [
                { "description": "...", "hsn_code": "...", "quantity": 1, "unit_price": 500, "taxable_amount": 500, "cgst_rate": 9, "cgst_amount": 45, "sgst_rate": 9, "sgst_amount": 45, "igst_rate": 0, "igst_amount": 0, "total_amount": 590 }
            ]
        },
        {
            "tableName": "job",
            "xData": { "id": "<job_id>", "job_status_id": "<ready_status_id>" }
        },
        {
            "tableName": "document_sequence",
            "xData": { "id": "<doc_seq_id>", "next_number": "<next_number + 1>" }
        }
    ]
}
```

> **Sibling pattern**: `job` and `document_sequence` have their own `id` → driver runs UPDATE, ignores the `fkey_value` (job_invoice.id) passed by the parent. `job_invoice_line` has `fkeyName: "job_invoice_id"` → driver injects the new invoice id as FK.

### `genericUpdate` Payload — Existing Invoice (re-save / edit)
Lines are replaced: `deletedIds` removes old rows, new `xData` inserts replacements. No document_sequence update (invoice_no already generated).

```json
{
    "tableName": "job_invoice",
    "xData": {
        "id":                 "<existing_invoice_id>",
        "invoice_date":       "<date>",
        "supply_state_code":  "<state code>",
        "taxable_amount":     "<number>",
        "cgst_amount":        "<number>",
        "sgst_amount":        "<number>",
        "igst_amount":        "<number>",
        "total_tax":          "<number>",
        "total_amount":       "<number>"
    },
    "xDetails": [
        {
            "tableName":  "job_invoice_line",
            "fkeyName":   "job_invoice_id",
            "deletedIds": ["<old_line_id_1>", "<old_line_id_2>"],
            "xData": [
                { "description": "...", "hsn_code": "...", "quantity": 1, "unit_price": 500, "taxable_amount": 500, "cgst_rate": 9, "cgst_amount": 45, "sgst_rate": 9, "sgst_amount": 45, "igst_rate": 0, "igst_amount": 0, "total_amount": 590 }
            ]
        },
        {
            "tableName": "job",
            "xData": { "id": "<job_id>", "job_status_id": "<ready_status_id>" }
        }
    ]
}
```

> **`deletedIds`**: `process_deleted_ids` runs `DELETE FROM job_invoice_line WHERE id = ANY(...)` before the INSERT. Pass only when the list is non-empty (empty array is falsy in Python and would be skipped anyway).

### Invoice View UI Layout
```
─── Job Summary (read-only) ────────────────────────────────────────────
  Job No | Date | Customer | Mobile | Technician | Amount | Status

─── Invoice ────────────────────────────────────────────────────────────
  Invoice No (auto or existing)   Invoice Date
  Supply State (dropdown)         [IGST toggle]

─── Lines ──────────────────────────────────────────────────────────────
  [Auto-populate from parts used] button   (→ fills lines from GET_JOB_PARTS_FOR_INVOICE)

  # | Description* | Part Code | HSN* | Qty* | Unit Price* | GST % | Amount | [×]
  [+ Add Line] button

─── Totals (auto-computed) ─────────────────────────────────────────────
  Taxable: ₹___   CGST: ₹___   SGST: ₹___   (or IGST: ₹___)   Total: ₹___

─── Footer ─────────────────────────────────────────────────────────────
  [← Back to List]           [Save Invoice & Mark Ready]
```

**Auto-populate from parts used**: Fetches `GET_JOB_PARTS_FOR_INVOICE` and fills new line rows:
- `description` = `{part_name}` 
- `part_code`   = `{part_code}`
- `hsn_code`    = "" (user fills)
- `quantity`    = from `jpu.quantity`
- `unit_price`  = 0 (user fills selling price)

**Supply State**: dropdown of all states (from `GET_ALL_STATES`); defaults to BU's registered state.

**GST calculation**: Same formula as sales invoice — `taxable = qty × unit_price`; `cgst = sgst = taxable × (gst_rate/2)/100`; or `igst = taxable × gst_rate/100` if IGST toggle.

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
| Amount | amount | ₹ formatted |
| Invoice | has_invoice | green ✓ badge or — |
| Actions | View/Edit Invoice button | click → invoice view |

---

## Existing Utilities to Reuse

| Utility | Notes |
|---------|-------|
| `GRAPHQL_MAP.genericUpdate` | Save invoice + lines + job status + doc sequence in one transaction |
| `GET_JOB_DELIVERY_MANNERS` | Available if needed for delivery manner dropdown |
| `GET_DOCUMENT_SEQUENCES` | Load with `document_type_code = 'JINV'` |
| `GET_JOB_STATUSES` | Find "Ready for Delivery" status id by code |
| `GET_COMPANY_INFO` | `company_id` + default `supply_state_code` for invoice |
| `GET_ALL_STATES` | Supply state dropdown |
| `currentFinancialYearRange()` | Default date filter |
| `selectCurrentBranch` | branch_id for queries |
| `selectIsGstRegistered`, `selectDefaultGstRate` | GST defaults |
| Pagination + skeleton | Clone from job-section.tsx |
| `thClass` / `tdClass` | Same CSS variables |

---

## Verification Steps

1. Navigate to **Jobs > Ready for Delivery**
2. **List view**: Only `is_final=true, is_closed=false` jobs appear; date/search filters work; `has_invoice` column shows ✓ for jobs that already have an invoice
3. **Click a job** → invoice view opens with read-only job summary
4. **Auto-populate**: Click "Auto-populate from parts used" → lines fill from `job_part_used`; fill HSN and prices
5. **Add service line**: "Add Line" → enter "Service Charge", HSN, qty=1, price → totals update
6. **Save**: Click "Save Invoice & Mark Ready"
   - Toast success; back to list
   - Job status updates to "Ready for Delivery" in list
   - `has_invoice` badge shows ✓
7. **DB check**: `job_invoice` row exists with correct totals; `job_invoice_line` rows inserted; `job.job_status_id` updated
8. **Re-open same job**: Invoice view shows existing lines pre-filled (edit mode)
9. **Edit and re-save**: Lines replaced; totals recalculated; status unchanged (already ready)
