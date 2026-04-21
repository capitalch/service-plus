# Plan: Update Job Feature (Jobs > Update Job)

## Context
"Update Job" is the technician workflow for progressing an in-service job. Unlike "New Job" (which captures intake info), "Update Job" records what was found and done: diagnosis, work performed, amount charged, status transition, and technician assignment. Each save creates a `job_transaction` row for full audit trail (linked via `previous_transaction_id` chain; `job.last_transaction_id` always points to the latest).

"New Job" edit already handles intake fields (customer, job type, receive manner, problem reported). "Update Job" focuses on the **progress/completion fields** that are blank at creation: `diagnosis`, `work_done`, `amount`, `job_status_id`, `technician_id`, `delivery_date`, `is_closed`, `is_final`, `remarks` — plus a `notes` field that goes into `job_transaction`.

---

## Architecture

Single-file section (`update-job-section.tsx`) with two sub-views:
1. **List view** — job search/filter with paginated grid, default to non-closed jobs; click a row to enter update view
2. **Update form view** — read-only intake summary + editable progress fields + Save/Back

No separate form file (no line items; fields are simple inputs/selects/textareas).

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/components/jobs/update-job-section.tsx` | All-in-one section: list + inline update form |

---

## Files to Modify

### Frontend
1. **`src/features/client/pages/client-jobs-page.tsx`**
   - Add `case "Update Job": return <UpdateJobSection />;`

2. **`src/constants/sql-map.ts`**
   - Add: `GET_OPEN_JOBS_COUNT`, `GET_OPEN_JOBS_PAGED`
   *(separate from GET_JOBS_COUNT/PAGED to allow filtering by is_closed = false by default)*

3. **`src/constants/graphql-map.ts`**
   - Add: `updateJob` mutation

4. **`src/constants/messages.ts`**
   - Add job-update specific messages (reuse `ERROR_JOB_UPDATE_FAILED`, `SUCCESS_JOB_UPDATED` already added)

### Backend
5. **`app/db/sql_store.py`**
   - Add `GET_OPEN_JOBS_COUNT` — like GET_JOBS_COUNT but with optional `is_closed` filter parameter
   - Add `GET_OPEN_JOBS_PAGED` — like GET_JOBS_PAGED but with `is_closed` filter

6. **`app/graphql/schema.graphql`**
   - Add `updateJob(db_name: String!, schema: String, value: String!): Generic`

7. **`app/graphql/resolvers/mutation_helper.py`**
   - Add `resolve_update_job_helper` — updates job row + inserts job_transaction atomically

8. **`app/graphql/resolvers/mutation.py`**
   - Add `@mutation.field("updateJob")` resolver

---

## Implementation Details

### SQL: `GET_OPEN_JOBS_COUNT` and `GET_OPEN_JOBS_PAGED`

```sql
-- GET_OPEN_JOBS_COUNT
-- Same as GET_JOBS_COUNT but adds: AND j.is_closed = (table "p_show_closed")
-- p_show_closed defaults to false (show only open jobs)

-- GET_OPEN_JOBS_PAGED
-- Same as GET_JOBS_PAGED + diagnosis snippet + is_closed filter
-- Extra columns: j.diagnosis (truncated, to show in list)
```

### `updateJob` mutation payload (from frontend)

```typescript
{
    job_id:               number,
    last_transaction_id:  number | null,   // for audit chain
    performed_by_user_id: number,
    transaction_notes:    string,          // goes into job_transaction.notes
    xData: {
        id:              job_id,
        job_status_id:   ...,
        technician_id:   ...,
        diagnosis:       ...,
        work_done:       ...,
        amount:          ...,
        delivery_date:   ...,
        is_closed:       ...,
        is_final:        ...,
        remarks:         ...,
    }
}
```

### `resolve_update_job_helper` (Python)

```python
async def resolve_update_job_helper(db_name, schema, value):
    # 1. Decode payload
    # 2. Pop: last_transaction_id, performed_by_user_id, transaction_notes, job_id
    # 3. exec_sql_object → update job row (tableName: "job", xData: { id, ...fields })
    # 4. Insert job_transaction:
    #    { job_id, status_id (from xData.job_status_id), technician_id, amount,
    #      notes=transaction_notes, performed_by_user_id,
    #      previous_transaction_id=last_transaction_id }
    # 5. exec_sql_object → update job.last_transaction_id = new_txn_id
    # Returns: new transaction id
```

### `update-job-section.tsx` Structure

```typescript
type SubView = "list" | "form";

// State
const [subView, setSubView] = useState<SubView>("list");
const [selectedJob, setSelectedJob] = useState<JobDetailType | null>(null);
const [showClosed, setShowClosed] = useState(false);

// List view: similar to view mode in job-section.tsx
// Columns: #, Date, Job No, Customer, Mobile, Status, Technician, Diagnosis (truncated), Amount, Actions
// Click row → setSelectedJob(job); setSubView("form")

// Form view:
// ─── Read-only Intake Summary ──────────────────────────────────────
//   Job No | Job Date | Customer | Mobile | Job Type | Problem Reported
// ─── Update Fields ─────────────────────────────────────────────────
//   Job Status * (dropdown)    Technician (dropdown)
//   Diagnosis (textarea)       Work Done (textarea)
//   Amount                     Delivery Date
//   Is Closed (toggle)         Is Final (toggle)
//   Remarks
//   Transaction Notes (textarea) ← goes into job_transaction.notes only
// ─── Footer ────────────────────────────────────────────────────────
//   [← Back to List]  [Save Update]
```

### List View Columns

| Col | Field | Notes |
|-----|-------|-------|
| # | row number | |
| Date | job_date | |
| Job No | job_no | with CLOSED badge if is_closed |
| Customer | customer_name | |
| Mobile | mobile | |
| Status | job_status_name | colored badge |
| Technician | technician_name | |
| Diagnosis | diagnosis (first 40 chars) | italic muted if empty |
| Amount | amount | ₹ formatted |
| Actions | Edit button | click → form view |

---

## Existing Utilities to Reuse

| Utility | Location |
|---------|----------|
| `GET_JOBS_PAGED` / `GET_JOBS_COUNT` | `SQL_MAP` — adapt for open-job filter |
| `GET_JOB_DETAIL` | `SQL_MAP` — load full job on select |
| `GET_JOB_STATUSES` | `SQL_MAP` — status dropdown |
| `GET_ALL_TECHNICIANS` | `SQL_MAP` — technician dropdown |
| `GRAPHQL_MAP.genericUpdate` | fallback for simple job updates (no txn needed) |
| `selectCurrentUser` | auth slice — for `performed_by_user_id` |
| `currentFinancialYearRange()` | default date range filter |
| Pagination buttons JSX | clone from `job-section.tsx` |
| `thClass` / `tdClass` CSS | same variables as other sections |
| `resolve_create_job_helper` | mutation_helper.py — direct model for update helper |

---

## Verification Steps

1. `npm run dev` — start dev server
2. Navigate to **Jobs > Update Job**
3. **List view**: open jobs load; date filter, search, show-closed toggle work; pagination works
4. **Click a job** → form appears with read-only intake summary populated
5. **Update**: change status, add diagnosis, work done, amount → Save
   - Job row updated; toast success; return to list (job reflects new status)
6. **DB check**: verify new `job_transaction` row exists with correct `previous_transaction_id` and `performed_by_user_id`
7. **Close a job**: toggle `is_closed` + save → job disappears from default list (filtered out); reappears with "Show Closed" toggle on
8. **Edit then Back**: clicking Back without saving discards changes, returns to list
