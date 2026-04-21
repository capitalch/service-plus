# Plan: Opening Jobs Feature (Jobs > Opening Jobs)

## Context
"Opening Jobs" is for entering historical/pre-existing job records — jobs that were in-progress or completed before this software was deployed (migrated from a previous system or paper records). Unlike "New Job" (which auto-generates a job_no and captures only intake fields), Opening Jobs lets the user:

- Enter a **manual job_no** from the old system
- Fill in **all fields at once** (both intake and progress/completion fields on one form)
- Set any job status, including Closed/Final, since the jobs may already be resolved

The same `job` table is used. The existing `createJob` mutation already supports skipping the document sequence (when `doc_sequence_id` is null), so **no new backend mutation is needed**.

---

## Architecture

Two-file section following the same pattern as `job-section.tsx` + `new-job-form.tsx`:

| File | Purpose |
|------|---------|
| `opening-job-section.tsx` | Section container: mode toggle, header buttons, view list, delete dialog |
| `opening-job-form.tsx` | forwardRef form with all intake + progress fields + manual job_no |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/components/jobs/opening-job-section.tsx` | Section container |
| `src/features/client/components/jobs/opening-job-form.tsx` | Combined form (all job fields + manual job_no) |

---

## Files to Modify

### Frontend
1. **`src/features/client/types/job.ts`**
   - Add `is_final: boolean` to `JobDetailType` (field exists in DB but missing from type)
   - Add `last_transaction_id: number | null` to `JobDetailType`

2. **`src/constants/messages.ts`**
   - Add opening-job-specific messages:
     ```
     ERROR_OPENING_JOB_NO_REQUIRED: 'Job No is required.'
     ERROR_OPENING_JOB_LOAD_FAILED: 'Failed to load opening jobs. Please try again.'
     ERROR_OPENING_JOB_CREATE_FAILED: 'Failed to save opening job. Please try again.'
     ERROR_OPENING_JOB_DELETE_FAILED: 'Failed to delete opening job. Please try again.'
     SUCCESS_OPENING_JOB_CREATED: 'Opening job saved successfully.'
     SUCCESS_OPENING_JOB_UPDATED: 'Opening job updated successfully.'
     SUCCESS_OPENING_JOB_DELETED: 'Opening job deleted successfully.'
     ```

3. **`src/features/client/pages/client-jobs-page.tsx`**
   - Add `case "Opening Jobs": return <OpeningJobSection />;`

### Backend — None
All existing backend pieces are reused:
- `createJob` mutation (pass `doc_sequence_id: null`, `doc_sequence_next: null`, manual `job_no` in `xData`)
- `genericUpdate` mutation (for edit)
- `genericUpdate` with `deletedIds` (for delete)
- `GET_JOBS_COUNT` + `GET_JOBS_PAGED` (for view list)
- `GET_JOB_DETAIL` (for edit pre-fill)

---

## Implementation Details

### `opening-job-form.tsx`

Modeled after `new-job-form.tsx` with these differences:
- **Manual job_no** text input (required) instead of auto-generated read-only field
- **No `docSequence` prop**
- Additional **Progress / Completion** section at the bottom with these extra fields:
  - Job Status * (dropdown, required — no auto-set to initial; user picks any status)
  - Technician (dropdown, optional)
  - Diagnosis (textarea, optional)
  - Work Done (textarea, optional)
  - Amount (number, optional)
  - Delivery Date (date, optional)
  - Is Closed (toggle)
  - Is Final (toggle)
  - Remarks (textarea, optional)

Handle (same `forwardRef + useImperativeHandle` pattern):
```typescript
export type OpeningJobFormHandle = {
    submit: () => void;
    reset: () => void;
    isSubmitting: boolean;
    isValid: boolean;
};
```

Props:
```typescript
type Props = {
    branchId: number | null;
    jobStatuses: JobLookupRow[];
    jobTypes: JobLookupRow[];
    receiveMannners: JobLookupRow[];
    receiveConditions: JobLookupRow[];
    technicians: TechnicianRow[];
    models: ModelRow[];
    customerTypes: CustomerTypeOption[];
    masterStates: StateOption[];
    editJob: JobDetailType | null;
    onSuccess: () => void;
    onStatusChange: (status: { isValid: boolean; isSubmitting: boolean }) => void;
};
```

Validation: `job_no` required, customer required, job type required, receive manner required, problem_reported required, job_status_id required.

**Save payload (new)**:
```typescript
{
    doc_sequence_id:   null,   // no auto-numbering
    doc_sequence_next: null,
    tableName: "job",
    xData: {
        branch_id,
        job_no,            // manual input
        job_date,
        customer_contact_id,
        job_type_id,
        job_receive_manner_id,
        job_receive_condition_id,
        job_status_id,
        technician_id,
        product_brand_model_id,
        serial_no,
        problem_reported,
        diagnosis,
        work_done,
        amount,
        delivery_date,
        is_closed,
        is_final,
        is_warranty,
        warranty_card_no,
        remarks,
        performed_by_user_id,  // stripped by backend before DB insert
    }
}
```
→ Sent via `GRAPHQL_MAP.createJob`

**Save payload (edit)**:
```typescript
graphQlUtils.buildGenericUpdateValue({
    tableName: "job",
    xData: { id, job_no, job_date, ..., all fields }
})
```
→ Sent via `GRAPHQL_MAP.genericUpdate`

### `opening-job-section.tsx`

Same two-mode structure as `job-section.tsx`:
- Metadata loaded on mount: statuses, types, receive manners, conditions, technicians, models, customer types, states
- **No doc sequences needed** (manual job_no)
- View list uses `GET_JOBS_COUNT` + `GET_JOBS_PAGED` (shows all jobs including closed — opening jobs are often already closed)
- `openingJobRef = useRef<OpeningJobFormHandle>(null)`

Form layout: two visually separated sections using a section divider:
```
─── Job Details ────────────────────────────────────────────────
  Job No *     Job Date     Customer *     Mobile (read-only)
  Job Type *   Receive Manner *   Receive Condition
  Product/Model   Serial No   Problem Reported * (textarea)
  Warranty toggle + Warranty Card No

─── Status / Progress ─────────────────────────────────────────
  Job Status *   Technician
  Diagnosis (textarea)   Work Done (textarea)
  Amount   Delivery Date
  Is Closed (toggle)   Is Final (toggle)
  Remarks (textarea)
```

---

## Existing Utilities to Reuse

| Utility | Notes |
|---------|-------|
| `CustomerInput` component | Same customer combobox as new-job-form |
| `GET_JOB_STATUSES` | Status dropdown (no initial-status auto-select) |
| `GET_ALL_TECHNICIANS` | Technician dropdown |
| `GET_JOBS_COUNT` / `GET_JOBS_PAGED` | View list (same as job-section view mode) |
| `GET_JOB_DETAIL` | Load full record for edit pre-fill |
| `GRAPHQL_MAP.createJob` | Create new opening job (null doc sequence) |
| `GRAPHQL_MAP.genericUpdate` | Edit + delete |
| `selectCurrentUser` | `performed_by_user_id` |
| `currentFinancialYearRange()` | Default date filter |
| Pagination + skeleton pattern | Clone from job-section.tsx |

---

## Verification Steps

1. `npm run dev` — start dev server
2. Navigate to **Jobs > Opening Jobs**
3. **New form**:
   - All dropdowns populate (statuses, types, technicians, etc.)
   - Enter manual job_no (e.g. "OLD/001"), fill in customer, job type, etc.
   - Fill progress fields (status = "Closed", diagnosis, amount, is_closed = true)
   - Save → job created, toast success, switches to view mode
4. **View list**:
   - Saved job appears; date filter and search work; pagination works
5. **Edit**:
   - Click Edit → form pre-fills all fields including progress fields
   - Modify job_no or status → Save → updates correctly
6. **Delete**:
   - Confirm dialog → job deleted; list refreshes
7. **DB check**: verify `job` row has manual `job_no` and correct `last_transaction_id`; one `job_transaction` row exists
