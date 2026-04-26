# Plan to Correct Job Status for New Single Job

## Goal Description
In `single-job-section.tsx`, when creating a new job (`mode === "new"`), ensure the `job_status_id` is always the ID corresponding to the code `RECEIVED`.

## Workflow
1. Identify the status ID for code `RECEIVED` from the `jobStatuses` state.
2. Update the `executeSave` function in `single-job-section.tsx` to use this ID when creating a new job.
3. Verify the change.

## Steps
### Step 1: Update executeSave logic
- In `src/features/client/components/jobs/single-job/single-job-section.tsx`:
    - Locate the `executeSave` function.
    - In the `else` block (where `createSingleJob` mutation is prepared), calculate the `receivedStatusId`.
    - Replace `job_status_id: values.job_status_id ?? null` with the calculated `receivedStatusId`.

### Step 2: Verification
- Run `pnpm tsc --noEmit` to check for type errors.
- Run `pnpm eslint` to check for linting errors.
