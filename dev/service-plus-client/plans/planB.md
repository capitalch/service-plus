# Implementation Plan: Server-Side Job Number Generation

## Overview
Move the job number generation from the client to the server to eliminate race conditions and ensure data integrity. The process will become atomic and transactional.

## Detailed Steps

### 1. Server-Side Implementation (`service-plus-server`)

#### 1.1 Database Layer
- Create a new SQL query or update existing ones to perform an atomic increment and return the sequence details.
- **Query**: 
  ```sql
  UPDATE document_sequence 
  SET next_number = next_number + 1 
  WHERE document_type_id = (SELECT id FROM document_type WHERE code = 'JOB')
    AND branch_id = %(branch_id)s
  RETURNING prefix, (next_number - 1) AS assigned_number, padding, separator;
  ```

#### 1.2 Logic Layer (`resolve_create_single_job_helper`)
- **Transaction Wrapping**: Wrap the entire job creation process (Insert Job $\rightarrow$ Insert Transaction $\rightarrow$ Update Sequence) in a single database transaction.
- **Sequence Claim**: 
  - Call the atomic `UPDATE ... RETURNING` query first to "claim" the next number.
  - If no row is returned, throw a validation error: `"Job sequence not configured for this branch"`.
- **Server-Side Formatting**:
  - Format the `job_no` using the retrieved sequence data in Python:
    `job_no = f"{prefix}{separator}{str(assigned_number).zfill(padding)}"`
- **Job Insertion**: Use the server-generated `job_no` for the `INSERT INTO job` statement.
- **Remove Client Trust**: Ignore `doc_sequence_id` and `doc_sequence_next` sent from the client.

#### 1.3 GraphQL Schema
- Update the `createSingleJob` mutation input to mark `doc_sequence_id` and `doc_sequence_next` as optional or remove them entirely to clean up the API.

### 2. Client-Side Implementation (`service-plus-client`)

#### 2.1 Logic Changes (`single-job-section.tsx` & `single-job-schema.ts`)
- **Remove Calculation**: Remove the logic that computes `jobNo`, `doc_sequence_id`, and `doc_sequence_next` before calling `executeSave`.
- **Update Mutation Call**: Remove these fields from the payload sent to `createSingleJob`.
- **Clean Up**: If `buildJobNo` is no longer used anywhere else, it can be removed from `single-job-schema.ts`.

#### 2.2 UI/UX Adjustments
- **Read-only Job Number**: Keep the `job_no` field as read-only. 
- **Post-Save Refresh**: After a successful save, use the returned `job_no` from the server to update the UI, and call `refreshDocSequences()` to update the "next" sequence preview for the next entry.

### 3. Verification & Testing

#### 3.1 Race Condition Test
- Use a script to send multiple concurrent `createSingleJob` requests for the same branch.
- **Success Criteria**: Every job has a unique `job_no` and no two jobs share the same number.

#### 3.2 Transactional Integrity Test
- Simulate a failure (e.g., a constraint violation) during the `INSERT INTO job` step after the sequence has been incremented.
- **Success Criteria**: The sequence `next_number` should not have advanced in the database (rollback).

#### 3.3 Edge Case: Unconfigured Sequence
- Create a job for a branch where the "JOB" sequence is missing from `document_sequence`.
- **Success Criteria**: Server returns a clear error message and no job is created.

## Files Involved
- **Server**: `mutation_helper.py` (resolve_create_single_job_helper), `sql_store.py`
- **Client**: `single-job-section.tsx`, `single-job-schema.ts`
