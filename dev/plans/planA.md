# File-Based Audit Logging Implementation Plan

## Workflow Overview
1. **Setup File Logger**: Configure the Python backend (FastAPI) to write audit events to a dedicated log file (e.g., `audit.log`) in an easily parsed format like JSON.
2. **Intercept Actions**: Implement a middleware or dependency in the server to capture and log relevant user actions (creates, updates, deletes, logins).
3. **Expose Log Data**: Create a new API endpoint on the server that reads the `audit.log` file (with pagination/chunking to support large files) and returns the data to the client.
4. **Client UI Update**: Modify the existing "Audit Logs" page in the React client to fetch data from this new endpoint, parse the JSON, and display it in a data table.

## Step 1: Server-Side File Logging Configuration
- Modify `service-plus-server/app/logger.py` to add a new customized logger specifically for audit events.
- Implement a `logging.handlers.RotatingFileHandler` configured to write to a designated directory (e.g., `logs/audit.log`).
- Set the log formatter to output logs in JSON format. This will ensure that fields such as `timestamp`, `user_id`, `action`, `resource`, and `details` can be easily parsed by the API later.

## Step 2: Capture Audit Events
- Create a utility function `log_audit_event(user_id, action, resource, details)`.
- Option A (Middleware): Create a FastAPI middleware that intercepts requests where the HTTP method is POST, PUT, PATCH, or DELETE, extracting the user ID from the token and logging the action.
- Option B (Manual Calls): Inject the `log_audit_event` call directly into the specific route handlers or repository methods where significant actions occur. 
- *Recommendation*: Use Option A for broad coverage, supplemented with Option B for sensitive operations requiring specific detail.

## Step 3: Create the Audit Logs API Endpoint
- Create a new router file `service-plus-server/app/routers/audit_logs.py`.
- Define an endpoint `GET /api/v1/audit-logs`.
- Implement logic to read the `audit.log` file. Since log files can grow large, the endpoint should read the file from the bottom up (most recent first) and support pagination parameters (`skip`, `limit`).
- Parse each valid JSON line into a Python dict and return a list of these objects as the JSON response.
- Secure the endpoint so only SuperAdmins (or authorized users) can access it.

## Step 4: Client-Side Integration
- In `service-plus-client/src/features/super-admin/api/` (or equivalent API service folder), add a new API call `getAuditLogs({ skip, limit })` that targets the new endpoint.
- Define the TypeScript interface for the audit log entry (e.g., `AuditLogEntry`).
- Update `service-plus-client/src/features/super-admin/components/` (the Audit Logs page/table component) to use this new API call instead of any existing mock/DB-based calls.
- Implement basic pagination in the UI table to allow navigating older file logs.
