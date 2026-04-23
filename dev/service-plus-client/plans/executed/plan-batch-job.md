# Plan: Batch Job Entry Feature

## Overview
Add "Batch Jobs" as a sidebar option (already wired in `client-explorer-panel.tsx` and `client-jobs-page.tsx`). Batch jobs share `customer_contact_id`, `job_type_id`, and `job_receive_manner_id` across all rows, while each row is a full `job` record with its own `job_no`, `model`, `serial_no`, `problem_reported`, `warranty_card_no`, `job_receive_condition_id`, and `remarks`. The **primary purpose** is to receive multiple jobs together from a single source (e.g. corporate office, collection center) and print a single consolidated job sheet for all jobs in the batch — saving time over printing individual job sheets.

**No new table.** A nullable `batch_no integer` column is added to the existing `job` table. Jobs sharing the same `batch_no` form a batch. A dedicated PostgreSQL sequence generates each new batch number atomically — O(1), race-condition-free.

---

## Current State (What's Already Done)

- `client-explorer-panel.tsx`: "New Job" collapsible group already has "Single Job" and "Batch Jobs" tree items.
- `client-jobs-page.tsx`: routes "Batch Jobs" → `<ComingSoon label="Batch Jobs Entry" />` (placeholder to replace).
- `client-layout.tsx`: `SECTION_DEFAULTS.jobs = 'Single Job'` — no change needed.
- Single job flow fully implemented in `src/features/client/components/jobs/single-job/`.

---

## Database Changes

### Alter `job` table
```sql
ALTER TABLE job ADD COLUMN batch_no integer;
CREATE INDEX idx_job_batch_no ON job(batch_no) WHERE batch_no IS NOT NULL;
```
`batch_no` is nullable — `NULL` means a standalone (single) job. Backward-compatible; no existing rows affected.

### Sequence for batch number generation
```sql
CREATE SEQUENCE job_batch_no_seq;
```
Used server-side via `nextval('job_batch_no_seq')`. Atomic, lock-free, O(1). The sequence is global (not per-branch); batch numbers are unique across all branches.

---

## GraphQL Strategy

Three new mutations only. Reads use the existing `genericQuery`.

```graphql
type Mutation {
  createJobBatch(db_name: String!, schema: String, value: String!): Generic
  updateJobBatch(db_name: String!, schema: String, value: String!): Generic
  deleteJobBatch(db_name: String!, schema: String, value: String!): Generic
}
```

Batch list and detail are fetched via `genericQuery` (already in schema) with new SQL ids added to `sql_store.py` — the same pattern used by every other read in the app. No new query resolver code needed.

---

## Server-Side Strategy

### `createJobBatch` payload
```json
{
  "sharedData": {
    "branch_id": 1,
    "batch_date": "2026-04-22",
    "customer_contact_id": 10,
    "job_type_id": 2,
    "job_receive_manner_id": 3,
    "job_status_id": 5,
    "performed_by_user_id": 1,
    "job_doc_sequence_id": 7,
    "job_doc_sequence_next": 42
  },
  "jobs": [
    {
      "job_no": "JOB-042",
      "product_brand_model_id": 15,
      "serial_no": "SN001",
      "problem_reported": "Screen cracked",
      "warranty_card_no": null,
      "job_receive_condition_id": 2,
      "remarks": null
    }
  ]
}
```

**`resolve_create_job_batch_helper` steps (single transaction):**
1. `batch_no = await conn.fetchval("SELECT nextval('job_batch_no_seq')")`
2. For each job row: INSERT into `job` (shared fields + job-specific fields + `batch_no`) → get `job_id`.
3. For each job: INSERT initial `job_transaction` row.
4. UPDATE `document_sequence` for job (+N rows added).
5. Rollback entirely on any error.
6. Return `{ batch_no, job_ids: [...] }`.

### `updateJobBatch` payload
```json
{
  "batch_no": 5,
  "sharedData": {
    "batch_date": "2026-04-23",
    "customer_contact_id": 10,
    "job_type_id": 2,
    "job_receive_manner_id": 3
  },
  "addedJobs": [ { "job_no": "JOB-050", ... } ],
  "updatedJobs": [ { "id": 42, "serial_no": "SN002", ... } ],
  "deletedJobIds": [43],
  "job_doc_sequence_id": 7,
  "job_doc_sequence_next": 50
}
```

**`resolve_update_job_batch_helper` steps (single transaction):**
1. UPDATE `job` SET `customer_contact_id`, `job_type_id`, `job_receive_manner_id`, `job_date` WHERE `batch_no = ?` (updates shared fields on all rows at once).
2. For each `deletedJobId`: verify no additional `job_transaction` rows exist beyond the initial one (return error if so). Then DELETE `job_transaction`, DELETE `job`.
3. For each `updatedJob`: UPDATE `job` row (job-specific fields only).
4. For each `addedJob`: INSERT `job` (with same `batch_no`) + initial `job_transaction`.
5. If added jobs exist, UPDATE `document_sequence` for job (+len(addedJobs)).
6. Return `{ batch_no }`.

### `deleteJobBatch` payload
```json
{ "batch_no": 5 }
```

**`resolve_delete_job_batch_helper` steps (single transaction):**
1. SELECT all job ids WHERE `batch_no = ?`. If any has more than 1 `job_transaction` row, return error: "Batch has jobs with activity and cannot be deleted."
2. DELETE `job_transaction` rows for all jobs in batch.
3. DELETE `job` rows WHERE `batch_no = ?`.
4. Return `{ success: true }`.

### Reads via `genericQuery`

#### `GET_JOB_BATCHES_PAGED` (sql_store.py)
```sql
SELECT
    j.batch_no,
    MIN(j.job_date)         AS batch_date,
    cc.full_name            AS customer_name,
    cc.mobile,
    jt.name                 AS job_type_name,
    COUNT(j.id)             AS job_count
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_type jt          ON jt.id = j.job_type_id
WHERE j.batch_no IS NOT NULL
  AND j.branch_id = :branch_id
  -- optional date / search filters
GROUP BY j.batch_no, cc.full_name, cc.mobile, jt.name
ORDER BY j.batch_no DESC
LIMIT :limit OFFSET :offset
```

#### `GET_JOB_BATCH_DETAIL` (sql_store.py)
Returns all job rows for the batch with joins. The client extracts shared fields from row[0].
```sql
SELECT
    j.*,
    cc.full_name AS customer_name, cc.mobile,
    jt.name      AS job_type_name,
    jrm.name     AS receive_manner_name,
    pbm.model_name, pbm.brand_name, pbm.product_name,
    (SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
FROM job j
JOIN customer_contact  cc  ON cc.id  = j.customer_contact_id
JOIN job_type          jt  ON jt.id  = j.job_type_id
JOIN job_receive_manner jrm ON jrm.id = j.job_receive_manner_id
LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
WHERE j.batch_no = :batch_no
ORDER BY j.id
```

---

## Client-Side Strategy

### File structure (mirrors single-job pattern)
```
src/features/client/components/jobs/batch-job/
  batch-job-section.tsx      ← outer section (header, view-mode toggle, list)
  new-batch-job-form.tsx     ← create / edit form
```

### Types (`job.ts` additions)
```typescript
type BatchJobRow = {
  localId: string                     // uuid — React key only, not sent to server
  id?: number                         // set when editing an existing job in the batch
  job_no: string                      // pre-computed from job sequence
  product_brand_model_id: number | null
  serial_no: string
  problem_reported: string
  warranty_card_no: string
  job_receive_condition_id: number | null
  remarks: string
  pendingAttachments: StagedFile[]
  isDeletable: boolean                // false when transaction_count > 1
}

type JobBatchListRow = {
  batch_no: number
  batch_date: string
  customer_name: string
  mobile: string
  job_type_name: string
  job_count: number
}

// getJobBatchDetail returns JobDetailType[] (existing type, extended with transaction_count)
// Client reconstructs header from row[0]: customer_contact_id, job_type_id, job_receive_manner_id, job_date
```

### Sequence management (create)
Fetch only the job `document_sequence` on form load (same as single job). Pre-assign `job_no` for row 1. Each added row increments the local job sequence counter. No batch sequence is fetched — `batch_no` is assigned server-side via `nextval`.

### Submit flow (create)
1. Validate shared fields.
2. Validate each row (at least one row required).
3. Call `createJobBatch` mutation → receive `{ batch_no, job_ids }`.
4. Upload images per job in parallel via existing `uploadJobFile()`.
5. Toast "Batch #5 created with 4 jobs" and reset form.

### Edit flow
1. Load batch detail via `getJobBatchDetail` (returns job rows; extract shared fields from row[0]).
2. Pre-populate shared fields and job rows (`isDeletable = transaction_count === 1`).
3. Track `addedJobs`, `updatedJobs`, `deletedJobIds` as diff arrays in state.
4. On submit call `updateJobBatch`, then handle new image uploads.

---

## UI Strategy

### `batch-job-section.tsx`
Follows the same `new` / `view` mode pattern as `single-job-section.tsx`:

- **Header**: Briefcase icon, "Batch Jobs — New / Edit / View", ViewModeToggle, Reset + Save buttons (hidden in view mode).
- **New / Edit mode**: renders `<NewBatchJobForm ref={...} ... />`.
- **View mode**: paginated table of `JobBatchListRow` with columns:  
  `#` · Batch No · Date · Customer · Mobile · Job Type · # Jobs · Actions (Edit / Delete).
- **Delete**: confirmation dialog "This will delete all N jobs in this batch."; blocked (greyed with tooltip) if any job has activity.

### `new-batch-job-form.tsx`

**Top shared section (card):**
| Field | Component |
|---|---|
| Batch No | Read-only — shows "Auto" on create, actual number after save / on edit |
| Batch Date | `<Input type="date" />` |
| Customer | `<CustomerInput />` |
| Job Type | `<select>` |
| Receive Manner | `<select>` |

**Tabular job rows:**  
Columns: `#` · Job No · Model (+ Add button) · Serial No · Problem Reported · Warranty Card No · Receive Condition · Remarks · Images · Delete

- Minimum 1 row; Delete hidden when only 1 row remains.
- **"+ Add Job"** appends a blank row with next auto-assigned `job_no`.
- Warranty Card No disabled unless selected `job_type.code === "UNDER_WARRANTY"`.
- Images: icon button with count badge; clicking expands inline `<JobImageUpload />` below that row.

**Footer:** "`N` jobs to be created" · Cancel · Submit

---

## File Changes Required

| File | Change |
|---|---|
| `service_plus_service.sql` | `ALTER TABLE job ADD COLUMN batch_no integer`; `CREATE INDEX`; `CREATE SEQUENCE job_batch_no_seq` |
| `sql_store.py` | Add `GET_JOB_BATCHES_PAGED`, `GET_JOB_BATCH_DETAIL` |
| `schema.graphql` | Add `createJobBatch`, `updateJobBatch`, `deleteJobBatch` mutations only |
| `mutation.py` | Add 3 resolver bindings |
| `mutation_helper.py` | Add 3 helper functions |
| `sql-map.ts` | Add `GET_JOB_BATCHES_PAGED`, `GET_JOB_BATCH_DETAIL` constants |
| `graphql-map.ts` | Add `createJobBatch`, `updateJobBatch`, `deleteJobBatch` mutation strings |
| `job.ts` | Add `BatchJobRow`, `JobBatchListRow` |
| `batch-job-section.tsx` *(new)* | Section with new/view mode, batch list, delete dialog |
| `new-batch-job-form.tsx` *(new)* | Create + edit batch form |
| `client-jobs-page.tsx` | Replace `ComingSoon` for "Batch Jobs" with `<BatchJobSection />` |

No new query resolvers (`query.py`, `query_helper.py`) needed. No changes to `client-explorer-panel.tsx`, `client-layout.tsx`, `single-job-section.tsx`, `new-single-job-form.tsx`, or any existing single-job flow.

---

## Execution Order
1. DB: `service_plus_service.sql` (`ALTER TABLE job`, `CREATE INDEX`, `CREATE SEQUENCE`)
2. Server queries: `sql_store.py` (`GET_JOB_BATCHES_PAGED`, `GET_JOB_BATCH_DETAIL`)
3. Server GraphQL: `schema.graphql` → `mutation.py` → `mutation_helper.py`
4. Client types: `job.ts`
5. Client UI: `new-batch-job-form.tsx` → `batch-job-section.tsx` → `client-jobs-page.tsx`
