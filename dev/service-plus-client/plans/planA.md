# Plan: Add Client Implementation

## Workflow
SA fills "Add Client" form → GraphQL mutation `genericUpdate` → server creates client row in `service_plus_client.client` table AND creates new database with `security` schema AND creates admin user → optimistic Redux dispatch (`addClient`) → toast success → dialog closes → table refreshes.

## Step 1: Define Zod Schema & Types
- Create `src/features/super-admin/components/add-client-dialog/add-client-schema.ts`
- Define `AddClientFormType` with `zod`:
  - `adminEmail` (email, required)
  - `adminFullName` (string, required)
  - `adminPassword` (min 6, required)
  - `adminUsername` (alphanumeric, min 5, required)
  - `code` (uppercase letters only, min 2, required)
  - `db_name` (snake_case, required)
  - `is_active` (boolean, default true)
  - `name` (string, required)

## Step 2: Add GraphQL Mutation to graphql-map.ts
- Add `addClient` mutation to `GRAPHQL_MAP` using the existing `genericUpdate` mutation pattern.

## Step 3: Add SQL_MAP Entry
- Add `ADD_CLIENT: "ADD_CLIENT"` to `src/constants/sql-map.ts`

## Step 4: Add Messages
- Add `SUCCESS_CLIENT_ADDED`, `ERROR_CLIENT_ADD_FAILED` to `src/constants/messages.ts`

## Step 5: Create AddClientDialog Component
- Create `src/features/super-admin/components/add-client-dialog/add-client-dialog.tsx`
- Uses `Dialog` (shadcn) for modal
- Uses `react-hook-form` + zod resolver
- Two-column form layout (single column on mobile) with these fields:
  - **Client Info section**: `name`, `code`, `db_name`, `is_active` toggle
  - **Admin User section**: `adminFullName`, `adminEmail`, `adminUsername`, `adminPassword`
- On submit:
  1. Call `useMutation` with `GRAPHQL_MAP.addClient`
  2. On success: dispatch `addClient` to Redux, show `toast.success`, close dialog
  3. On error: show `toast.error(MESSAGES.ERROR_CLIENT_ADD_FAILED)`

## Step 6: Wire Dialog into clients-page.tsx
- Replace `handleAddClient` toast placeholder with state to open the dialog
- Render `<AddClientDialog open={isOpen} onOpenChange={setIsOpen} />`

## Step 7: Wire Dialog into client-overview-table.tsx (Dashboard table)
- Same wiring pattern as Step 6

## Step 8: Add `addClient` mutation to Redux slice (if server call fails gracefully)
- The Redux slice already has `addClient` reducer — no changes needed
