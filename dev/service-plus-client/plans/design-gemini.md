# Design for Posting Service Plus Data to Trace Plus Accounts

## 1. Overview
The objective is to seamlessly and securely transfer financial transactions (Purchase Invoices, Sales Invoices, Job Invoices, and Money Receipts) from the Service Plus application into the Trace Plus accounting software. The system will prioritize atomicity—updating the `is_posted` flag in Service Plus only after successful confirmation of posting from Trace Plus.

## 2. Handshake Architecture: Client -> Service Server -> Trace Server

**Decision**: The Server-to-Server communication model is highly recommended over direct Client-to-Trace communication.

The flow will be: `Service Plus Client Browser -> Service Plus Server API -> Trace Plus Server API`.

**Why this approach is superior:**
- **Security:** Credentials, target database names (`dbName`), and external database connection parameters (`dbParams`) for Trace Plus are kept entirely server-side. The client browser is never exposed to Trace Plus authentication details or database schemas.
- **Atomicity and Reliability:** The Service Plus Server coordinates the state. It handles the database transaction to update the `is_posted` flag immediately upon receiving a success response from Trace. If a direct client-to-Trace call were made, the client could fail to update the `is_posted` flag in Service Plus due to an interrupted connection, resulting in a dual-post on the next attempt.
- **CORS Mitigation:** Trace Plus does not need to allow cross-origin requests from the Service Plus client domain.

## 3. Detailed Component Design

### 3.1 Service Plus Client
- **UI Interaction**: In the "Accounts Posting" menu, the user selects rows in the data grids (Purchase, Sales, Job, or Money Receipts) and clicks the "Post Selected" button.
- **Method Implementation**: The `handlePostSelected` function handles the operation:
  1. Gathers the IDs of the selected entities.
  2. Uses Apollo Client to execute an authenticated GraphQL mutation (e.g., `postToAccounts`) against the Service Plus Server, passing the entity type and the list of selected IDs.
  3. Displays a loading indicator (using Sonner).
  4. Upon response, displays a success or failure notification detailing the number of successful and failed postings.
  5. Refreshes the grids to reflect the updated `is_posted` status (moving them from the "Posting" tab to the "Posted" tab).

### 3.2 Service Plus Server (FastAPI + GraphQL)
- **Data Assembly**: For the given IDs and entity type, the server fetches the complete details (header, line items, taxes) from the local PostgreSQL database using optimized SQL queries. It must verify that `is_posted` is `false` to prevent duplicate processing.
- **Data Transformation (JSON Generation)**: Maps the Service Plus data to the strict JSON structure required by Trace Plus (e.g., matching Debits and Credits, mapping to proper `AccM` account IDs for suppliers, customers, and tax ledgers).
- **Secure API Call to Trace**:
  - The server authenticates with the Trace Plus server (using a service-level JWT token or API key configured in environment variables).
  - It sends an HTTP POST request to Trace Plus's GraphQL API (e.g., invoking the `validateDebitCreditAndUpdate` mutation).
- **State Management & Transaction**:
  - On receiving a "Success" response from Trace Plus for an invoice, the Service Plus server opens a local database transaction.
  - Updates the `is_posted` flag to `true` for that entity.
  - Stores the returned Trace Plus voucher reference number in a local table or log for auditability.
  - If Trace Plus returns an error, the `is_posted` flag remains `false`, and the error is logged and returned to the client for display.

### 3.3 Trace Plus Server (FastAPI + GraphQL)
- **API Endpoint**: Provides a secured GraphQL mutation.
- **Authentication**: Validates the incoming service token from the Service Plus Server.
- **Validation Engine**: Validates that the JSON voucher balances (Total Debit == Total Credit).
- **Database Insertion**: Inserts the data into its accounting tables (`TranH`, `TranD`, etc.) and automatically generates a reference voucher number.
- **Response**: Returns the success status, the generated voucher number, and any relevant error messages.

## 4. Step-by-Step Workflow

1. **User Action**: The user selects records in the Service Plus Client and clicks "Post Selected".
2. **Client Request**: The client triggers the `postToAccounts` GraphQL mutation with the selected IDs and entity type.
3. **Authentication**: The Service Plus Server validates the user's JWT token.
4. **Data Retrieval**: The Service Plus Server queries its local DB for the full details of the selected IDs.
5. **Formatting**: The Service Plus Server formats the fetched records into Trace Plus Voucher JSON format (matching debits and credits).
6. **Integration Call**: The Service Plus Server makes an authenticated, secure HTTP call to the Trace Plus Server API with the generated JSON payloads.
7. **Trace Validation**: The Trace Plus Server validates the payloads, inserts them into its accounting tables, and returns a success response containing the generated voucher numbers.
8. **Confirmation**: The Service Plus Server receives the success response and updates the `is_posted` flag to `true` for the successful records in the Service Plus Database.
9. **Client Response**: The Service Plus Server returns a summary of the operation (Successful, Failed, Skipped counts and error reasons) back to the Client.
10. **UI Update**: The Client displays the result via a toast notification and refreshes the data grids to update the UI.

## 5. Security & Best Practices
- **No Client Exposure:** Never expose Trace Plus database parameters, schemas, or authentication credentials to the Service Plus client bundle.
- **Idempotency:** A combination of checking `is_posted` before sending, and utilizing any duplicate-check features in Trace Plus, guarantees that retries are safe.
- **Itemized Processing:** Rather than wrapping the entire batch in a single payload that fails entirely if one record has an error, the Service Plus server should process the items individually or handle batch errors gracefully. This ensures valid invoices are posted even if one in the batch fails.
- **Audit Logging:** Maintain a logging table in Service Plus that records the date, user, entity ID, and the Trace Plus reference number for every successful posting.
- **Centralized Messaging:** Ensure any error messages propagated back to the UI use the centralized `messages.ts` structure according to the project's standards.
