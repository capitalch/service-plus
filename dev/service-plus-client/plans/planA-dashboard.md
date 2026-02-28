# Plan for Super Admin Dashboard Data Population

## Overview
This plan focuses on making the Super Admin dashboard dynamic by fetching real data from the database. It involves backend work in `service-plus-server` to serve the data via a custom SQL query mapped correctly for the `genericQuery` resolver, and frontend work in `service-plus-client` to consume this endpoint and update Redux state, replacing dummy data.

## Workflow

1.  **Backend Implementation (`service-plus-server`)**
    *   Locate the central spot where `get_all_clients` sql execution logic runs.
    *   Write the new raw SQL query to compute client stats and list BUs (business units).
    *   Expose this correctly to the generic GraphQL endpoint so frontend requests mapping to `SQL_MAP.GET_ALL_CLIENTS` execute the correct queries.
2.  **Frontend State Integration (`service-plus-client`)**
    *   Modify `SuperAdminDashboard` to call `executeGenericQuery` inside a `useEffect` when the component mounts.
    *   Parse the JSON response payload.
    *   Dispatch `setClients` and `setStats` Redux actions using the mapped data.
    *   Remove or stop defaulting to `dummy-data.ts` in production flow.

## Steps of execution

### Step 1: Write SQL query for Backend
Create the necessary SQL querying logic within `service-plus-server` for `GET_ALL_CLIENTS`. The query logic needs to:
*   Aggregate a summary statistics row (Total BUs, Active BUs, Inactive BUs, Total Admins, Active Admins, Inactive Admins).
*   Select the list of all clients (BUs), computing their individual `activeAdminCount` and `inactiveAdminCount` via joins on the user table.

### Step 2: Implement query resolution in service-plus-server
Map the ID passed by the `buildGenericQueryValue` (e.g., `GET_ALL_CLIENTS`) to execute the new queries. Ensure the responses are assembled into a specific JSON serialized structure (or whatever standard format the `genericQuery` string returns).

### Step 3: Implement data fetch in Frontend (`SuperAdminDashboard`)
*   Refactor the `handleTestGraphQl` in `src/features/super-admin/pages/super-admin-dashboard-page.tsx`.
*   Implement `useEffect` to safely call this query as the page loads instead of only on button click.
*   Import `useDispatch` and dispatch `setStats` as well as `setClients` from `super-admin-slice` with the payload coming from the Apollo query response.

### Step 4: Map data properties correctly
Ensure the parsed properties maps appropriately:
*   Map client table columns to `ClientType` attributes (`id`, `name`, `code`, `is_active`, `activeAdminCount`, `inactiveAdminCount`, `created_at`).
*   Map overall aggregates to `StatsType` attributes (`totalBu`, `activeBu`, `inactiveBu`, `totalAdminUsers`, `activeAdminUsers`, `inactiveAdminUsers`).

### Step 5: Test and Validation
*   Verify that `StatsCards` and `ClientOverviewTable` correctly display the newly pulled data instead of dummy data.
*   Check proper loading disabled-state styling and error toast integrations.
