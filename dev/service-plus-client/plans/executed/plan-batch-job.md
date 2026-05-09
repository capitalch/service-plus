# Plan: Batch Job Redesign

## Overview

Redesign the batch job feature to enforce minimum-2-jobs validation, move job number
generation fully to the server, add a quick info card at the top (mirroring single job),
make each job row compact (one line), defer file attachment to post-save, and clean up
both client and server code.

---

## Current State

| Area | Current Behaviour | Problem |
|---|---|---|
| Min jobs | `rows.min(1)` | Requirement is 2 |
| Job numbers | Client pre-generates from `docSequence` | Should be server-side (like single job) |
| File attachment | Staged in-form with `pendingFiles` per row | Should happen after save using real job_nos |
| Quick info card | Absent | Single job has one; batch job needs one |
| Job row UI | Expanded card per job (lots of vertical space) | Requirement: each job = single compact line |
| Server create | Accepts `job_no` from client | Should auto-claim number (CLAIM_NEXT_JOB_NUMBER) |
| Server response | Returns `batch_no` + `job_ids` | Also needs `job_nos` for post-save attachment |

---

## Files to Change

### Client

```
src/features/client/components/jobs/batch-job/
  batch-job-schema.ts          (validation, default values)
  new-batch-job-form.tsx        (form UI — compact rows, no attachment)
  batch-job-section.tsx         (section — add quick info card, post-save attachment)
  batch-job-quick-info-card.tsx (NEW — like SingleJobQuickInfoCard but for batches)

src/constants/sql-map.ts        (add GET_JOB_BATCH_QUICK_INFO key)
src/features/client/types/job.ts (add BatchJobQuickInfoRow type)
```

### Server

```
app/graphql/resolvers/mutation_helper.py  (server-side job_no generation)
app/db/sql_store.py                        (add GET_JOB_BATCH_QUICK_INFO SQL,
                                            update GET_JOB_BATCH_DETAIL to include file_count)
```

---

## Detailed Changes

### 1. batch-job-schema.ts

**a) Raise minimum row count to 2**

```typescript
rows: z.array(batchJobRowSchema).min(2, "Minimum 2 jobs are required for a batch")
```

**b) Remove `job_no` from `batchJobRowSchema`**  
Job numbers are auto-generated server-side; the form no longer needs them.

```typescript
// Remove:
job_no: z.string()
// Remove buildJobNo(), getInitialBatchJobRow(seq, offset), blankBatchRow(seq, offset)
```

**c) Simplify `getInitialBatchJobRow`**  
No seq parameter. Just returns a blank row with a `localId`.

```typescript
export function getInitialBatchJobRow(): BatchJobRowFormValues {
    return {
        id: null,
        localId: crypto.randomUUID(),
        product_brand_model_id: null,
        serial_no: "",
        problem_reported: "",
        warranty_card_no: "",
        job_receive_condition_id: null,
        remarks: "",
        quantity: 1,
        isDeletable: true,
    };
}
```

**d) `getBatchJobDefaultValues`**  
Start with 2 blank rows (enforcing the minimum visually from the start).

```typescript
export function getBatchJobDefaultValues(): BatchJobFormValues {
    return {
        batch_date: new Date().toISOString().slice(0, 10),
        customer_id: undefined as unknown as number,
        customer_name: "",
        job_type_id: undefined as unknown as number,
        receive_manner_id: undefined as unknown as number,
        rows: [getInitialBatchJobRow(), getInitialBatchJobRow()],
    };
}
```

---

### 2. new-batch-job-form.tsx

**a) Remove `docSequence` and `setPendingFiles` props**  
These are no longer needed.

**b) Remove `JobImageUpload` entirely from the form**  
File attachment happens post-save. The form has no attachment UI.

**c) Compact job row design — one line per job**  

Each job in the batch list occupies a single horizontal row, not an expanded card.
Suggested compact layout (horizontal flex/grid):

```
[#1]  [Model combobox ──────────────────] [Serial] [Condition] [Qty] [Remarks] [×]
[#2]  [Model combobox ──────────────────] [Serial] [Condition] [Qty] [Remarks] [×]
```

- Model combobox takes the most width (`flex-1` or `col-span-4`)
- Serial No: short input (`w-28`)
- Condition: compact select (`w-32`)
- Qty: number input (`w-16`)
- Remarks: short input (`w-40`, optional)
- Warranty card field: only visible/enabled when job type is `UNDER_WARRANTY`,
  shown inline in the same row
- Delete button: only shown when `isDeletable` and row count > 2
- Problem Reported: collapsed by default, with an expand toggle icon per row
  (to keep the line compact but allow full input when needed)

Use a `<table>` or CSS grid with sticky column headers for alignment across rows.

**d) Validation feedback**  
Show a warning banner when `rows.length < 2`:
```
"Add at least 2 jobs to create a batch."
```

**e) Footer counter**  
```
{fields.length} job{fields.length !== 1 ? "s" : ""} in this batch
{fields.length < 2 && <span className="text-red-500 ml-2">· Minimum 2 required</span>}
```

**f) `handleAddRow` simplified**

```typescript
const handleAddRow = () => append(getInitialBatchJobRow());
```

**g) `handleRemoveRow` — enforce minimum 2**

```typescript
const handleRemoveRow = (index: number) => {
    if (fields.length > 2) {
        remove(index);
    }
};
```

---

### 3. batch-job-section.tsx

**a) Add `BatchJobQuickInfoCard` at top (in "new" mode)**  
Render above the form, using a `refreshTrigger` incremented after each successful save.

**b) Remove `docSequences` / `jobSequence` state and fetch**  
Client no longer pre-generates job numbers.

**c) Remove `pendingFiles` state**  
No pending file staging during form entry.

**d) Add post-save file attachment state**

After a successful create, the server returns `{ batch_no, job_ids, job_nos }`.
Store this to show a post-save attachment panel:

```typescript
const [postSaveAttach, setPostSaveAttach] = useState<
    { jobId: number; jobNo: string }[] | null
>(null);
```

**e) Update `executeSave` for create**

Remove `job_no`, `job_doc_sequence_id`, `job_doc_sequence_next` from payload:

```typescript
const payload = encodeURIComponent(JSON.stringify({
    sharedData: {
        branch_id: branchId,
        batch_date: values.batch_date,
        customer_contact_id: values.customer_id,
        job_type_id: values.job_type_id,
        job_receive_manner_id: values.receive_manner_id,
        job_status_id: jobStatuses.find(s => s.is_initial)?.id ?? null,
        performed_by_user_id: currentUser?.id ?? null,
    },
    jobs: formRows.map(r => ({
        product_brand_model_id: r.product_brand_model_id,
        serial_no: r.serial_no || null,
        problem_reported: r.problem_reported || null,
        warranty_card_no: r.warranty_card_no || null,
        job_receive_condition_id: r.job_receive_condition_id,
        remarks: r.remarks || null,
        quantity: r.quantity,
    })),
}));
```

After mutation, extract `{ batch_no, job_ids, job_nos }` and set `postSaveAttach`.
Increment `refreshTrigger` to refresh the quick info card.

**f) Update `executeSave` for update (edit)**

Remove client-generated `job_no` from `addedJobs`. Server generates job numbers for
newly added jobs atomically.

```typescript
addedJobs: formRows.filter(r => !r.id).map(r => ({
    product_brand_model_id: r.product_brand_model_id,
    serial_no: r.serial_no || null,
    problem_reported: r.problem_reported || null,
    warranty_card_no: r.warranty_card_no || null,
    job_receive_condition_id: r.job_receive_condition_id,
    remarks: r.remarks || null,
    quantity: r.quantity,
})),
// Remove: job_doc_sequence_id, job_doc_sequence_next
```

**g) Post-save attachment panel**  
After create, show a modal or inline panel listing each job with a `JobImageUpload`
component (using the real `jobId`):

```
Batch #42 created — attach files to each job:

  [JOB-0001]  [JobImageUpload jobId=101]
  [JOB-0002]  [JobImageUpload jobId=102]
  [JOB-0003]  [JobImageUpload jobId=103]
  
  [ Done ]
```

On "Done", clear `postSaveAttach`, reset form, switch to "view" mode.

**h) Remove `rowsValid` custom check**  
Zod schema with `min(2)` and `product_brand_model_id` required handles validity.
The save button condition:

```typescript
disabled={!form.formState.isValid || submitting}
```

**i) `handleReset` simplified**

```typescript
function handleReset() {
    form.reset(getBatchJobDefaultValues()); // already includes 2 blank rows
    setPostSaveAttach(null);
}
```

**j) Remove unused `jobStatuses` fetch** (only `is_initial` status is needed — keep it
but remove the state variable entirely and inline into `executeSave` if preferred, or
keep as-is since it is already fetched).

---

### 4. batch-job-quick-info-card.tsx (NEW)

Model this closely on `SingleJobQuickInfoCard`.

**Data fetched:** Latest batch using `GET_JOB_BATCH_QUICK_INFO` (new SQL).

**Display structure:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Batch #42  [Latest]  2025-05-01  •  John Doe                    │
│  ─────────────────────────────────────────────────────────────── │
│  JOB-0001  Samsung Galaxy S24 — Screen  •  SN: ABC123  [2 files] │
│  JOB-0002  Apple iPhone 15 — Battery    •  SN: XYZ789  [1 file]  │
│  JOB-0003  OnePlus 12 — Charging Port   •  —           [0 files] │
│                                          [← ←] [→ →]  [Attach]  │
└──────────────────────────────────────────────────────────────────┘
```

- **Left column:** Batch header (batch no, date badge, customer name)
- **Job rows:** Each job on one line: `job_no · brand/product/model · serial_no · file_count badge`
- **Right:** Navigation buttons (prev/next batch by `batch_no`) + "Attach Files" button
  that opens attachment panel for that batch
- **File count badge:** Clickable per job, opens `JobImageUpload` for that `jobId`
- `refreshTrigger` prop: refetch latest on increment

**Props:**

```typescript
type BatchJobQuickInfoCardProps = {
    onAttach?: (jobs: { jobId: number; jobNo: string }[]) => void;
    refreshTrigger?: number;
};
```

**Navigation:** By `batch_no` offset (same pattern as single job card — offset 0 = latest).

**Query:** `GET_JOB_BATCH_QUICK_INFO` (see SQL section below).

---

### 5. sql-map.ts (client constants)

Add:

```typescript
GET_JOB_BATCH_QUICK_INFO: "GET_JOB_BATCH_QUICK_INFO",
```

---

### 6. job.ts types

Add `BatchJobQuickInfoRow` type:

```typescript
export type BatchJobQuickInfoRow = {
    batch_no: number;
    batch_date: string;
    customer_name: string | null;
    mobile: string;
    job_type_name: string;
    job_id: number;
    job_no: string;
    device_details: string | null;   // brand — product — model
    serial_no: string | null;
    file_count: number;
};
```

---

### 7. sql_store.py (server SQL)

**a) Add `GET_JOB_BATCH_QUICK_INFO`**

Returns all jobs for the Nth most-recent batch (by `batch_no` DESC, offset-based).

```sql
GET_JOB_BATCH_QUICK_INFO = """
    with
        "p_branch_id" as (values(%(branch_id)s::bigint)),
        "p_offset"    as (values(%(offset)s::int)),
        "target_batch" as (
            SELECT DISTINCT j.batch_no
            FROM job j
            WHERE j.batch_no IS NOT NULL
              AND j.branch_id = (table "p_branch_id")
            ORDER BY j.batch_no DESC
            LIMIT 1 OFFSET (table "p_offset")
        )
    SELECT
        j.batch_no,
        MIN(j.job_date)                                    AS batch_date,
        cc.full_name                                       AS customer_name,
        cc.mobile,
        jt.name                                            AS job_type_name,
        j.id                                               AS job_id,
        j.job_no,
        CASE WHEN pbm.id IS NOT NULL
             THEN CONCAT(b.name, ' — ', p.name, ' — ', pbm.model_name)
             ELSE NULL END                                 AS device_details,
        j.serial_no,
        (SELECT COUNT(*) FROM job_document jd WHERE jd.job_id = j.id) AS file_count
    FROM job j
    JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
    JOIN job_type              jt  ON jt.id  = j.job_type_id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand            b   ON b.id   = pbm.brand_id
    LEFT JOIN product          p   ON p.id   = pbm.product_id
    WHERE j.batch_no = (SELECT batch_no FROM target_batch)
    ORDER BY j.id
"""
```

**b) Add `GET_JOB_BATCH_QUICK_INFO_COUNT`** (to check if can navigate older)

```sql
GET_JOB_BATCH_QUICK_INFO_COUNT = """
    with "p_branch_id" as (values(%(branch_id)s::bigint))
    SELECT COUNT(DISTINCT batch_no) AS total
    FROM job
    WHERE batch_no IS NOT NULL
      AND branch_id = (table "p_branch_id")
"""
```

**c) Update `GET_JOB_BATCH_DETAIL` to include `file_count` per job**  
Add to the SELECT:

```sql
(SELECT COUNT(*) FROM job_document jd WHERE jd.job_id = j.id) AS file_count
```

---

### 8. mutation_helper.py (server)

**a) `resolve_create_job_batch_helper` — server-side job number generation**

Remove reliance on client-provided `job_no` and `job_doc_sequence_*`. Instead, call
`CLAIM_NEXT_JOB_NUMBER` (same pattern as `resolve_create_single_job_helper`) once per
job, atomically inside the transaction.

```python
job_ids = []
job_nos = []
for job in jobs:
    # Atomically claim next job number
    await cur.execute(SqlStore.CLAIM_NEXT_JOB_NUMBER, {"branch_id": branch_id})
    seq = await cur.fetchone()
    if not seq:
        raise ValidationException(
            message="Job sequence not configured for this branch"
        )
    job_no = f"{seq['prefix'] or ''}{seq['separator'] or ''}{str(seq['assigned_number']).zfill(seq['padding'])}"

    await cur.execute(
        "INSERT INTO job (...) VALUES (...) RETURNING id",
        (branch_id, batch_no, job_no, ...)
    )
    job_id = (await cur.fetchone())["id"]
    job_ids.append(job_id)
    job_nos.append(job_no)
    ...

# Remove: manual doc_sequence UPDATE (CLAIM_NEXT_JOB_NUMBER handles it atomically)
return {"batch_no": batch_no, "job_ids": job_ids, "job_nos": job_nos}
```

**b) `resolve_update_job_batch_helper` — same for `added_jobs`**

Use `CLAIM_NEXT_JOB_NUMBER` per added job instead of client-provided `job_no`.
Remove `doc_seq_id` / `doc_seq_next` parameters.

**c) Remove `job_doc_sequence_id` and `job_doc_sequence_next` from both helpers**  
The `CLAIM_NEXT_JOB_NUMBER` SQL already does an atomic UPDATE+RETURNING, making
the manual sequence update redundant.

---

## Implementation Order

1. **Server first** (`mutation_helper.py`, `sql_store.py`)  
   - Switch `create_job_batch` to server-side job number generation  
   - Switch `update_job_batch` added-jobs to server-side numbers  
   - Add `GET_JOB_BATCH_QUICK_INFO` + `GET_JOB_BATCH_QUICK_INFO_COUNT` SQL  
   - Update `GET_JOB_BATCH_DETAIL` with `file_count`

2. **Schema** (`batch-job-schema.ts`)  
   - Min rows = 2  
   - Remove `job_no` from row  
   - Simplify helpers

3. **Form** (`new-batch-job-form.tsx`)  
   - Remove `docSequence`, `setPendingFiles` props  
   - Compact one-line row layout  
   - Remove `JobImageUpload`

4. **Types** (`job.ts`) — add `BatchJobQuickInfoRow`

5. **SQL map** (`sql-map.ts`) — add `GET_JOB_BATCH_QUICK_INFO` key

6. **Quick info card** (`batch-job-quick-info-card.tsx`) — new component

7. **Section** (`batch-job-section.tsx`)  
   - Add quick info card at top  
   - Remove `docSequences` fetch  
   - Update `executeSave` payloads  
   - Add post-save attachment panel

---

## Invariants & Rules to Preserve

- Customer is shared across all jobs in a batch — enforced at form level (single customer field)
- Batch date applies to all jobs — enforced at form level
- Job type and receive manner are shared — enforced at form level
- File attachment for existing jobs (edit mode) still uses `JobImageUpload` with real `jobId`
- Deleting a job row in edit mode is blocked if `transaction_count > 1` (server enforces)
- Minimum row count = 2 enforced both in Zod schema and `handleRemoveRow` (no remove when count ≤ 2)
- The "Save Batch" button must remain disabled while `form.formState.isValid === false`
  (covers the min-2 validation via Zod)

---

## Out of Scope

- Print/PDF for batch jobs (not requested)
- Batch job search/filter changes in view mode (not requested)
- Any change to single-job flow
