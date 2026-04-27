# Explanation: Current Job Number Generation Strategy

## Summary
The current strategy is **client-calculated, server-atomically-committed**.
The job number is fully assembled in the browser and sent to the server along with
instructions to advance the document sequence counter. The server inserts the job
and increments the counter in a single logical operation (not a DB transaction).

---

## Data Source: `document_sequence` Table

Each branch can have one sequence row per document type (e.g. "JOB").
The relevant columns are:

| Column | Example | Meaning |
|---|---|---|
| `id` | 3 | PK — used to update the row |
| `prefix` | `"JOB"` | Fixed text prefix |
| `separator` | `"-"` | Between prefix and number |
| `next_number` | `42` | The number to use for the NEXT job |
| `padding` | `5` | Zero-pad width |

A sequence with `prefix="JOB"`, `separator="-"`, `next_number=42`, `padding=5`
produces: **`JOB-00042`**

---

## Flow

### 1. Load Sequence on Mount
`refreshDocSequences()` queries `GET_DOCUMENT_SEQUENCES` SQL on component mount
and after every save. Result is stored in `docSequences[]` state.
The row with `document_type_code === "JOB"` is the active job sequence.

### 2. Build Job Number Client-Side
On form submit (`executeSave`):
```ts
const jobSequence = docSequences.find(s => s.document_type_code === "JOB") ?? null;
const jobNo = jobSequence
    ? buildJobNo(jobSequence.prefix, jobSequence.separator, jobSequence.next_number, jobSequence.padding)
    : "";
```
`buildJobNo()` (in `single-job-schema.ts`):
```ts
export function buildJobNo(prefix, separator, nextNumber, padding): string {
    return `${prefix}${separator}${String(nextNumber).padStart(padding, "0")}`;
}
// "JOB" + "-" + "00042" = "JOB-00042"
```
This runs entirely in the browser with no server round-trip.

### 3. Payload Sent to Server
The frontend sends one object to the `createSingleJob` GraphQL mutation:
```json
{
  "tableName": "job",
  "doc_sequence_id":   3,
  "doc_sequence_next": 43,
  "xData": {
    "job_no":    "JOB-00042",
    "branch_id": 1,
    ...all other fields
  }
}
```
`doc_sequence_next` = `next_number + 1` (the new value after this job is created).

### 4. Server Operations (resolve_create_single_job_helper)
Three sequential DB operations — NOT wrapped in an explicit DB transaction:
1. `INSERT INTO job (job_no, ...) RETURNING id` — creates the job row
2. `INSERT INTO job_transaction (job_id, status_id, performed_by_user_id)` — logs initial "RECEIVED" status history
3. `UPDATE document_sequence SET next_number = 43 WHERE id = 3` — advances the counter

### 5. Refresh After Save
After a successful save, the frontend calls `refreshDocSequences()` again so that
the next job creation uses `next_number = 43`.

---

## Known Limitation: Race Condition

This is a **client-calculated** scheme. If two users on the same branch both load the
form when `next_number = 42`, both will generate `"JOB-00042"`.

- If `job_no` has a UNIQUE constraint in the DB → second INSERT fails with an error.
- If not → silent duplicate job numbers.

The server does **not re-generate** or **re-verify** the job number. It trusts the
client-provided value.

---

## When No Sequence Is Configured
If `docSequences` has no row for `"JOB"` (sequence not configured for the branch):
- `jobSequence` is `null`
- `jobNo` is `""`  (empty string)
- `doc_sequence_id` and `doc_sequence_next` are both `null`
- The server skips the sequence update step
- The job is saved with a blank `job_no` — a data quality issue

---

## Files Involved

| File | Role |
|---|---|
| `single-job-schema.ts` | `buildJobNo()` — pure job number formatting function |
| `single-job-section.tsx` | `refreshDocSequences()`, `executeSave()` — orchestration |
| `sql_store.py` `GET_DOCUMENT_SEQUENCES` | Fetches current sequence row for branch |
| `mutation_helper.py` `resolve_create_single_job_helper` | Server-side job creation + sequence increment |

---

## Suggestions to Fix Job Number Generation

To resolve the race condition and ensure data integrity, the job number generation must be moved from the client to the server, and executed atomically within a database transaction.

### 1. Shift Generation to Server-Side (Recommended)
The client should no longer compute `job_no` or `doc_sequence_next`. When creating a new job, the client simply submits the job details (leaving `job_no` blank or omitted).

### 2. Atomic DB Increment (`UPDATE ... RETURNING`)
The server should atomically increment the sequence and fetch the new number in a single query:
```sql
UPDATE document_sequence 
SET next_number = next_number + 1 
WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'JOB')
  AND branch_id = %(branch_id)s
RETURNING prefix, next_number - 1 AS assigned_number, padding, separator;
```
*Note: The `UPDATE` statement locks the `document_sequence` row until the transaction completes, preventing any other concurrent request from getting the same number.*

### 3. Server-Side Assembly
Within `resolve_create_single_job_helper` on the server:
- Wrap the entire operation in a single database transaction (e.g., `async with conn.transaction():` or equivalent `BEGIN/COMMIT`).
- Execute the `UPDATE ... RETURNING` query to claim the next sequence number.
- Format the job number in Python (e.g., `f"{prefix}{separator}{str(assigned_number).zfill(padding)}"`).
- Insert the new `job` record using this safely generated `job_no`.
- (Optional) Return the generated `job_no` to the client so the UI can update automatically.

### 4. Database Transaction Wrapping
Currently, the operations in `resolve_create_single_job_helper` (job insert, transaction insert, sequence update) execute as separate auto-committed statements via `exec_sql_object`. They must be wrapped in a single explicit transaction block so that if the job insert fails, the sequence increment safely rolls back.

### 5. Alternative: Database Trigger
Alternatively, create a `BEFORE INSERT` trigger on the `job` table. The trigger autonomously looks up the branch's sequence, increments it, builds the string, and assigns it to `NEW.job_no`. This completely shields the application code from sequence logic but hides the business logic inside the database.

### 6. Address Unconfigured Sequences
If a branch doesn't have a document sequence configured for "JOB", the server should throw an explicit validation error (e.g., "Job sequence not configured for this branch") rather than allowing the job to be saved with an empty `job_no`.
