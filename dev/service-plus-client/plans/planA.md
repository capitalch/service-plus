# Plan A: Client Initiation UI

## Workflow
The workflow involves updating the Clients page to display an "Initiate" button for each client. This button's state and the resulting dialog UI depend dynamically on whether the client already has a `db_name` and an `active admin` user. The dialog will conditionally render forms for Database Creation and Admin Creation. Once both are present, the initiation process is complete, and the button is disabled.

## Step 1: Update Clients Table/List UI
Modify the Clients data table to include an "Initiate" action button for each row. Implement logic to disable this button if both `db_name` and an active admin exist for that client.

## Step 2: Create the Initiate Client Dialog Component
Build a new reusable component, `InitiateClientDialog`, using shadcn/ui. This dialog will receive the selected client's data as props to determine which sections to display.

## Step 3: Implement Database Creation Section
Inside the dialog, conditionally render the "Create Database" section if `db_name` is missing. This section should have a form or confirmation button to trigger the API mutation for database creation.

## Step 4: Implement Admin Creation Section
Inside the dialog, conditionally render the "Create Admin" section if no active admin is present. Provide a form (using `react-hook-form` and `zod`) to gather admin details (e.g., username, email, password) and submit them via a GraphQL mutation.

## Step 5: State Management & Integration
Wire up the dialog and its forms to Apollo Client graphQL mutations (`apolloClient.query` and mutations). Ensure that upon successful creation of either the DB or the Admin, the server is re-queried or cache is updated so the UI dynamically adapts (e.g., hiding a section that was just completed) and sonner toast messages are displayed.
