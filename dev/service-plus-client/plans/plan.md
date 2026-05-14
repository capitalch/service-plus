# Plan: Implement `alternate_job_no`

## Context

The `job` table already has an `alternate_job_no text` column (nullable, indexed via `job_alternate_job_no_idx`). It is not yet exposed anywhere in the UI or queries. The goal is to:

- Allow entry of `alternate_job_no` on the single-job and batch-job forms
- Display it next to `job_no` in all grid views and the job details modal
- Include it in all search/filter queries

---

## Server Changes

### A. `app/db/sql_store.py`

**1. `GET_JOB_PIPELINE_PAGED` and `GET_JOB_PIPELINE_ALL_PAGED`**
Add `j.alternate_job_no` to the SELECT column list.

**2. `GET_JOB_PIPELINE_COUNT` and `GET_JOB_PIPELINE_ALL_COUNT`**
Add `OR j.alternate_job_no ILIKE %(search)s` to the WHERE search clause (alongside existing `j.job_no ILIKE ...`).

**3. `GET_JOB_SEARCH_PAGED` and `GET_JOB_SEARCH_COUNT`**
- Add `j.alternate_job_no` to SELECT.
- Add `OR j.alternate_job_no ILIKE %(search)s` to WHERE search.

**4. `GET_JOBS_PAGED` and `GET_JOBS_COUNT`**
Add `OR j.alternate_job_no ILIKE %(search)s` to WHERE search.

**5. `GET_JOB_DETAIL`**
Uses `j.*` — already includes `alternate_job_no` automatically. No change needed.

**6. `GET_READY_JOBS_PAGED` and `GET_DELIVERABLE_JOBS_PAGED`**
Add `j.alternate_job_no` to SELECT if those queries explicitly list columns (check at implementation time). Add to search WHERE if applicable.

**7. `GET_JOBS_FOR_RECEIPT_LOOKUP`**
Add `j.alternate_job_no` to SELECT for display in the lookup combobox.

### B. `app/graphql/resolvers/mutation_helper.py`

**`resolve_create_job_batch_helper` (explicit INSERT)**
Add `alternate_job_no` to the INSERT column list and pass from xData. Value comes from each job row's `alternate_job_no` field (may be NULL if not entered).

**`resolve_update_job_batch_helper` (explicit UPDATE)**
Add `alternate_job_no = %(alternate_job_no)s` to the SET clause.

**`resolve_create_single_job_helper` and `resolve_update_job_helper`**
Both use `process_data(x_data, ...)` which is fully dynamic — no change needed here. Sending `alternate_job_no` in the client's xData is sufficient.

---

## Client Changes

### 1. Types — `src/features/client/types/job.ts`

Add `alternate_job_no: string | null` to:
- `JobDetailType`
- `OpenJobRow`
- `JobSearchRow`

(BatchJobRow and other types can be updated if they need to show it in grids.)

---

### 2. Single-Job Form

**Files:**
- `src/features/client/components/jobs/single-job/single-job-schema.ts`
- `src/features/client/components/jobs/single-job/new-single-job-form.tsx`

**Schema:** Add `alternate_job_no: z.string().optional()` to `singleJobSchema`.

**Form UI:** Add an optional text input labelled "Alt Job No" in Row 1 (alongside Job No / Job Date). Place it immediately after Job No. Send `alternate_job_no: values.alternate_job_no || null` in xData on submit.

---

### 3. Batch-Job Form

**Files:**
- `src/features/client/components/jobs/batch-job/batch-job-schema.ts`
- `src/features/client/components/jobs/batch-job/new-batch-job-form.tsx`

**Schema:** Add `alternate_job_no: z.string().optional()` to `batchJobRowSchema`.

**Form UI:** Add "Alt Job No" text input in the **expanded section** of each job row (alongside Serial No / Warranty Card No). Send `alternate_job_no` per job row in the batch INSERT/UPDATE xData.

---

### 4. Job Details Modal

**File:** `src/features/client/components/jobs/job-pipeline/job-details-modal.tsx`

**Service Information grid (line ~274):** Add `["Alt Job No", job.alternate_job_no]` immediately after `["Job No", job.job_no]` in the array. The existing `.filter(([, v]) => v != null)` guard means it only renders when a value exists.

---

### 5. Job Pipeline Grid

**File:** `src/features/client/components/jobs/job-pipeline/job-pipeline-status-drilldown.tsx`

In the Job No table cell (line ~334), add below the `job_no` span:

```tsx
{row.alternate_job_no && (
    <span className="text-[10px] text-[var(--cl-text-muted)]">
        Alt: {row.alternate_job_no}
    </span>
)}
```

Update the search placeholder to include "alt job no".

---

### 6. Job Search Section

**File:** `src/features/client/components/jobs/job-search/job-search-section.tsx`

In the Job No grid cell (line ~282), add below `job.job_no`:

```tsx
{job.alternate_job_no && (
    <span className="text-[10px] text-muted-foreground">Alt: {job.alternate_job_no}</span>
)}
```

Update search placeholder to include "alt job no".

---

### 7. Job Lookup Combobox

**File:** `src/features/client/components/jobs/receipts/job-lookup-combobox.tsx`

Show `alternate_job_no` in each dropdown result row (lines ~183) when it exists.

---

### 8. Ready-for-Delivery, Receipts, Deliver-Job Grids

**Files:**
- `src/features/client/components/jobs/ready-for-delivery/ready-for-delivery-section.tsx`
- `src/features/client/components/jobs/receipts/receipts-section.tsx`
- `src/features/client/components/jobs/deliver-job/deliver-job-section.tsx`

In each job_no table cell, add the same pattern:
```tsx
{row.alternate_job_no && (
    <span className="text-[10px] text-muted-foreground">Alt: {row.alternate_job_no}</span>
)}
```

(Requires those SQL queries to SELECT `alternate_job_no` — verify at implementation time.)

---

## Files Modified Summary

| File | Change |
|------|--------|
| `app/db/sql_store.py` | Add `alternate_job_no` to SELECT and search WHERE in pipeline, search, ready, deliverable, receipt-lookup queries |
| `app/graphql/resolvers/mutation_helper.py` | Add `alternate_job_no` to batch job INSERT/UPDATE |
| `src/features/client/types/job.ts` | Add field to `JobDetailType`, `OpenJobRow`, `JobSearchRow` |
| `src/features/client/components/jobs/single-job/single-job-schema.ts` | Add optional field |
| `src/features/client/components/jobs/single-job/new-single-job-form.tsx` | Add input, send in xData |
| `src/features/client/components/jobs/batch-job/batch-job-schema.ts` | Add optional field to row schema |
| `src/features/client/components/jobs/batch-job/new-batch-job-form.tsx` | Add input per row, send in xData |
| `src/features/client/components/jobs/job-pipeline/job-details-modal.tsx` | Show in Service Information |
| `src/features/client/components/jobs/job-pipeline/job-pipeline-status-drilldown.tsx` | Show below job_no in grid, update search placeholder |
| `src/features/client/components/jobs/job-search/job-search-section.tsx` | Show below job_no in grid, update search placeholder |
| `src/features/client/components/jobs/receipts/job-lookup-combobox.tsx` | Show in dropdown results |
| `src/features/client/components/jobs/ready-for-delivery/ready-for-delivery-section.tsx` | Show below job_no |
| `src/features/client/components/jobs/receipts/receipts-section.tsx` | Show below job_no |
| `src/features/client/components/jobs/deliver-job/deliver-job-section.tsx` | Show below job_no |

---

## Verification

1. `npm run build` — must compile clean.
2. Create a new single job with an alt job no → saved correctly.
3. Create a batch job with alt job nos on individual rows → saved correctly.
4. Open job details modal → "Alt Job No" appears in Service Information when set.
5. Pipeline grid → "Alt: XYZ" appears below job_no in the row.
6. Search for a job by its alt job no → result appears in pipeline and search grids.
7. Edit a job → existing alt job no pre-filled; can be changed or cleared.
