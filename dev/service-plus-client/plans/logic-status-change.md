# Job Status Transition — Logic Reference

## Overview

A status transition updates the job's current status and appends an immutable audit row to `job_transaction`. The flow is:

```
Row click → getTransitions() → DropdownMenu → StatusTransitionModal → updateJob mutation → Server
```

---

## 1. Allowed Transitions (`status-transitions.ts`)

### `TransitionFields` codes

Each letter in the code signals a UI block. Detected via `fields.includes("<letter>")` in the modal.

| Letter | Meaning                          |
|--------|----------------------------------|
| `R`    | base (Date + Remarks always shown) |
| `A`    | Amount field                     |
| `E`    | Estimate Amount field            |
| `P`    | Parts grid                       |
| `C`    | Additional Charges grid          |
| `T`    | Technician selector (required)   |

| Code    | Fields shown in modal                                               |
|---------|---------------------------------------------------------------------|
| `R`     | Date, Remarks                                                       |
| `RT`    | Technician (required), Date, Remarks                                |
| `RET`   | Technician (required), Estimate Amount, Date, Remarks               |
| `RAT`   | Technician (required), Amount, Date, Remarks                        |
| `RACPT` | Technician (required), Amount, Charges grid, Parts grid, Date, Remarks |
| `PCT`   | Technician (required), Parts grid, Charges grid, Date, Remarks      |
| `none`  | *(defined in type, never used)*                                     |

`PCT` replaces the old `PT`; `RACPT` replaces the old `RAPT`. All transitions whose target is IN_PROGRESS (6) or COMPLETED_OK (11) now use these codes.

### `getTransitions(statusId, jobTypeCode)` — full map

| From status (id)          | → Available targets                                                          |
|---------------------------|------------------------------------------------------------------------------|
| 1 RECEIVED (ESTIMATE type)| 2 Assigned `RT`, 3 Estimated `RET`                                                           |
| 1 RECEIVED (other types)  | 2 Assigned `RT`, 6 In Progress `PCT`, 11 Completed OK `RACPT`, 12 Return `R`, 15 Cancelled `R`, 16 Disposed `R`, 3 Estimated `RET` |
| 2 ASSIGNED                | 2 Re-Assign `RT`, 6 In Progress `PCT`                                                        |
| 3 ESTIMATED               | 4 Estimate Approved `R`, 5 Estimate Rejected `R`, 6 In Progress `PCT`                        |
| 4 ESTIMATE_APPROVED       | 6 In Progress `PCT`                                                                          |
| 5 ESTIMATE_REJECTED       | 12 Return `R`                                                                                |
| 6 IN_PROGRESS             | 2 Re-Assign `RT`, 6 Re-start `PCT`, 7 Parts Pending `R`, 8 On Hold `R`, 9 Outsourced `R`, 10 Sent to Company `R`, 11 Completed OK `RACPT`, 12 Return `R`, 15 Cancelled `R`, 16 Disposed `R`, 3 Estimated `RET` |
| 7 PARTS_PENDING           | 6 In Progress `PCT`                                                                          |
| 8 ON_HOLD                 | 6 In Progress `PCT`                                                                          |
| 9 OUTSOURCED              | 6 In Progress `PCT`                                                                          |
| 10 SENT_TO_COMPANY        | 17 Received Back `R`                                                                         |
| 15 CANCELLED              | 6 Re-open `PCT`                                                                              |
| 16 DISPOSED               | 6 Re-open `PCT`                                                                              |
| 17 RECEIVED_BACK_FROM_COMPANY | 6 In Progress `PCT`                                                                      |
| 11, 12, 13, 14 (read-only)| No transitions — Lock icon shown, no dropdown                                    |

### `STATUS_FLAGS` — written to job row on transition

| Status                | `is_final` | `is_closed` |
|-----------------------|------------|-------------|
| 11 COMPLETED_OK       | `true`     | `false`     |
| 12 RETURN             | `true`     | `false`     |
| 15 CANCELLED          | `true`     | `false`     |
| 16 DISPOSED           | `true`     | `true`      |
| 13 DELIVERED_OK       | `false`    | `true`      |
| 14 DELIVERED_NOT_OK   | `false`    | `true`      |
| all others            | `false`    | `false`     |

---

## 2. Transition Modal (`status-transition-modal.tsx`)

Opened when user picks a transition from the dropdown. Props: `job`, `transition`, `technicians`, `dbName`, `schema`, `onClose`, `onSubmit`.

**Fields rendered based on `transition.fields`:**

- `fields.includes("T")` → Technician (required, validated before submit)
- `fields.includes("E")` → Number input for `estimate_amount`
- `fields.includes("A")` → Number input for `amount`
- `fields.includes("P")` → Parts grid (existing + new rows)
- `fields.includes("C")` → Additional Charges grid (new rows only)
- Always present: Date input (defaults to today, required), Remarks textarea

**Parts grid (`P` in fields — `PCT` / `RACPT` transitions):**

- On open: fetches existing `job_part_used` rows via `GET_JOB_PART_USED_BY_JOB`
- Part lookup: on blur of Part Code input → `GET_PART_BY_CODE` → auto-fills name, UOM
- User can edit quantity/remarks on existing rows, delete existing rows (tracked in `deletedIds`), add new rows
- Submit collects: `newLines` (part_id, quantity, remarks) + `deletedIds`

**Additional Charges grid (`C` in fields — `PCT` / `RACPT` transitions):**

Rendered below Parts Used.

```ts
type AdditionalChargeRow = {
    _key:        string;   // client-only UUID for React key
    charge_name: string;   // label / description of the charge
    amount:      number;   // charge amount
    remarks:     string;
};
```

- No existing-row fetch on open — charges are always entered fresh per transition.
- User can add rows (+ Add Charge button) and remove rows (trash icon).
- Submit collects the rows as-is; empty `charge_name` rows are filtered out.

**On submit → calls `onSubmit(TransitionPayload)`:**

```ts
{
  targetStatusId, technician_id, amount, estimate_amount,
  remarks, transaction_date, is_final, is_closed,
  partsData?:   { newLines, deletedIds },
  chargesData?: { lines: { charge_name: string; amount: number; remarks: string }[] }
}
```

---

## 3. Client Submit Handler (`job-pipeline-status-detail.tsx`)

`handleSubmitTransition(job, transition, payload)`:

1. Builds `xData`:
   ```ts
   { id, job_status_id, technician_id,
     amount:          fields.includes("A") ? payload.amount : job.amount,
     estimate_amount: fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
     is_final, is_closed }   // from STATUS_FLAGS[transition.targetId]
   ```
2. Calls `GRAPHQL_MAP.updateJob` mutation with:
   ```ts
   { job_id, last_transaction_id, performed_by_user_id,
     transaction_notes, transaction_date, xData }
   ```
3. If `fields.includes("P")` and `partsData` has new lines or deleted ids → calls `GRAPHQL_MAP.genericUpdate` on table `job_part_used`
4. If `fields.includes("C")` and `chargesData` has lines → calls `GRAPHQL_MAP.genericUpdate` on table `job_additional_charge` to insert the new rows (each row: `{ job_id, charge_name, amount, remarks }`)
5. On success: clears `pendingTran`, reloads the page data

---

## 4. Server — `resolve_update_job_helper`

Receives the decoded payload and executes three sequential DB writes (no explicit transaction):

| Step | Operation |
|------|-----------|
| 1 | `UPDATE job SET (job_status_id, technician_id, amount, estimate_amount, is_final, is_closed) WHERE id = job_id` |
| 2 | `INSERT INTO job_transaction (job_id, status_id, technician_id, amount, remarks, performed_at, performed_by_user_id, previous_transaction_id)` |
| 3 | `UPDATE job SET last_transaction_id = <new_txn_id>` |

`job_transaction` is append-only — rows are never deleted or updated, forming a full audit trail. `job.last_transaction_id` always points to the most recent transaction, used as an optimistic-concurrency token on the next transition.

Additional charges inserts (`job_additional_charge` table) are handled by a separate `genericUpdate` call from the client (step 4 in section 3 above) — they do not go through `resolve_update_job_helper`. The table schema expected:

```sql
job_additional_charge (
    id          serial primary key,
    job_id      integer not null references job(id),
    charge_name text    not null,
    amount      numeric(12,2) not null,
    remarks     text    not null default ''
)
```

---

## 5. Read-only statuses

Statuses in `NO_ACTION_CODES` show a `Lock` icon instead of a dropdown:

```
COMPLETED_OK  RETURN  DELIVERED_OK  DELIVERED_NOT_OK
```

These rows can still be viewed via the Eye button but cannot be transitioned from the pipeline view.
