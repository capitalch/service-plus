# Implementation Plan: Accounts Posting Integration

## Workflow
1. User selects rows (Purchase, Sales, Job, Receipts) in the Accounts Posting grid.
2. User clicks "Post Selected".
3. Client fires a new GraphQL mutation `postToAccounts` with entity type and selected IDs.
4. Server receives the mutation and authenticates the request.
5. Server fetches the selected records from local DB and skips any that are already `is_posted = true`.
6. Server maps the data to Trace Plus accounting JSON format (Vouchers, Debits, Credits, Taxes).
7. Server makes an HTTP request to Trace Plus API's `validateDebitCreditAndUpdate` endpoint using a secure service token.
8. If successful, Server begins a local DB transaction, updates `is_posted` to `true`, and writes an audit log.
9. Server returns a summary (successful and failed counts) to the Client.
10. Client displays a toast notification with the results and triggers a refetch of the data grids to update the UI state.

## Step 1: Server - Update GraphQL Schema
- File: `service-plus-server/app/graphql/schema.graphql`
- Action: Add the mutation `postToAccounts(db_name: String!, schema: String, value: String!): Generic` to the `Mutation` type.

## Step 2: Server - Data Fetching Queries
- File: `service-plus-server/app/db/sql_store.py`
- Action: Add specific `SELECT` queries for `purchase_invoice`, `sales_invoice`, `job_invoice`, and `job_payment` using CTEs to gather header, line items, and tax breakdown. Include a condition `is_posted = false`.

## Step 3: Server - Trace Plus Service Integration
- File: `service-plus-server/app/services/trace_plus_service.py` (Create new file)
- Action: Create a service class to manage external HTTP calls to Trace Plus.
- Method: `post_voucher(payload: dict) -> dict` to send the generated `sqlObject` JSON to Trace Plus's `validateDebitCreditAndUpdate` GraphQL endpoint. Handle JWT tokens or service API keys securely via environment variables.

## Step 4: Server - Mutation Resolver and Helper
- File: `service-plus-server/app/graphql/resolvers/mutation.py`
  - Action: Register `postToAccounts` to call `resolve_post_to_accounts` in `mutation_helper.py`.
- File: `service-plus-server/app/graphql/resolvers/mutation_helper.py`
  - Action: Implement `resolve_post_to_accounts`. This function should:
    - Parse the `value` JSON parameter to get `entityType` and `ids`.
    - Iterate over `ids`.
    - Fetch data using `sql_store`.
    - Transform the local data structure to Trace Plus `AccM` / `TranH` / `TranD` structure.
    - Call `trace_plus_service.post_voucher`.
    - On success, execute an `UPDATE` query to set `is_posted = true` for that ID.
    - Track success/failure counts and return a summary.

## Step 5: Client - Add GraphQL Map
- File: `service-plus-client/src/graphql/graphql-map.ts`
- Action: Add a constant for `POST_TO_ACCOUNTS` mutation matching the backend schema update.

## Step 6: Client - Hook into "Post Selected" Action
- File: `service-plus-client/src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx`
- Action: 
  - Update `handlePostAllSelected` to group selected IDs by active grid type (Purchase, Sales, Job, Receipts).
  - Use Apollo Client's `mutate` with the `POST_TO_ACCOUNTS` query.
  - Implement a loading state during the server request using Sonner's `toast.promise` or `toast.loading`.
  - On response, show the final success/failure summary toast.
  - Clear the selection sets (e.g., `setSelectedPurchaseIds(new Set())`).
  - Trigger grid refetch or manually manipulate local state so posted items move to the "Posted" outer tab.

## Step 7: Centralized Messages
- File: `service-plus-client/src/constants/messages.ts` (or equivalent location)
- Action: Add keys for posting notifications (e.g., `POSTING_SUCCESS`, `POSTING_PARTIAL_SUCCESS`, `POSTING_FAILED`, `POSTING_IN_PROGRESS`). Use these keys instead of hard-coded strings in the UI.
