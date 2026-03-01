# Plan: Add Client Feature

## Overview
Implement a disassociated three-step "Add Client" workflow for the Super Admin dashboard:
1. **Step 1 – Create Client** → Insert a row in `service_plus_client.client` table
2. **Step 2 – Create Database** → Provision a new PostgreSQL database named `service_plus_<client_code>` with the `security` schema
3. **Step 3 – Create Admin User** → Insert admin user into the new DB's `security.user` table; auto-generate username + password and email them

The steps are **disassociated** (can be done independently via the Client Overview table action buttons).

---

## Workflow

```
Super Admin
    │
    ├─ Clicks "+ Add Client" button on dashboard
    │        ↓
    │  [Step 1 Modal] Fill client form → POST via genericUpdate mutation
    │        ↓ client row created in service_plus_client.client
    │
    ├─ Clicks "Create Database" in row Actions dropdown (if db_name is null)
    │        ↓
    │  [Confirm Dialog] → POST via createClientDatabase mutation
    │        ↓ new DB service_plus_<code> + security schema provisioned
    │        ↓ db_name column updated in client row
    │
    └─ Clicks "Create Admin User" in row Actions dropdown
             ↓
      [Modal] Enter admin email → POST via genericUpdate mutation
             ↓ security.user row created; username+password generated & emailed
```

---

## Step 1 – Server: Create Client

### File: `service-plus-server/app/graphql/resolvers/mutation.py`
- Implement `resolve_generic_update` properly:
  - Parse the `value` JSON argument (which contains `{ sqlId, buCode, data }`)
  - Route to the correct helper based on `sqlId`
  - Add `resolve_create_client_helper(data)` → inserts row into `service_plus_client.client`
  - Add `resolve_create_admin_user_helper(db_name, data)` → inserts row into `security.user` of `service_plus_<code>` database
  - Add `resolve_modify_admin_user_helper(db_name, data)` → updates `security.user` (enable/disable/delete)

### File: `service-plus-server/app/graphql/schema.graphql`
- Add new mutation:
  ```graphql
  createClientDatabase(clientId: Int!): Generic
  ```

### File: `service-plus-server/app/graphql/resolvers/mutation.py`
- Add `@mutation.field("createClientDatabase")` resolver:
  - Look up client by `clientId` in `service_plus_client.client`
  - Create DB `service_plus_<code>` using the `security` schema template from `service_plus_demo.sql`
  - Update `db_name` column in `service_plus_client.client`

### New File: `service-plus-server/app/helpers/client_helper.py`
- `create_client(data)` → INSERT into `service_plus_client.client`
- `create_client_database(client_id)` → CREATE DATABASE, run security schema DDL, UPDATE db_name
- `create_admin_user(db_name, email)` → generate username/password, INSERT into `security.user`, send email
- `modify_admin_user(db_name, user_id, action)` → UPDATE `security.user` (enable/disable/delete)

### New File: `service-plus-server/app/helpers/db_provisioner.py`
- `provision_security_schema(db_name)` → connects to new DB and runs the DDL for `security` schema (tables, sequences, triggers)

---

## Step 2 – Server: SQL Map

### File: `service-plus-server/app/constants/sql_map.py` (or equivalent)
- Add SQL IDs:
  - `CREATE_CLIENT`
  - `CREATE_ADMIN_USER`
  - `MODIFY_ADMIN_USER`

---

## Step 3 – Client: SQL Map & GraphQL Map

### File: `service-plus-client/src/constants/sql-map.ts`
- Add:
  ```ts
  CREATE_CLIENT: 'CREATE_CLIENT',
  CREATE_ADMIN_USER: 'CREATE_ADMIN_USER',
  MODIFY_ADMIN_USER: 'MODIFY_ADMIN_USER',
  ```

### File: `service-plus-client/src/constants/graphql-map.ts`
- Add:
  ```ts
  createClientDatabase: gql`mutation createClientDatabase($clientId: Int!) { createClientDatabase(clientId: $clientId) }`
  ```

---

## Step 4 – Client: Types

### File: `service-plus-client/src/features/super-admin/types/index.ts`
- Add/update `ClientType` to include all DB fields from SQL schema:
  ```ts
  type ClientType = {
    activeAdminCount: number
    address_line1: string | null
    address_line2: string | null
    city: string | null
    code: string
    country_code: string | null
    created_at: string
    db_name: string | null
    email: string | null
    gstin: string | null
    id: number
    inactiveAdminCount: number
    is_active: boolean
    name: string
    pan: string | null
    phone: string | null
    pincode: string | null
    state: string | null
    updated_at: string
  }
  ```

---

## Step 5 – Client: Add Client Modal (Multi-step form)

### New File: `service-plus-client/src/features/super-admin/components/add-client-modal.tsx`
- Multi-step modal using `react-hook-form` + `zod`:
  - **Step 1 – Client Details**: Form with all fields from `client` table (name*, code*, email, phone, gstin, pan, address fields)
  - Step indicator at top (3 steps)
  - On submit → `genericUpdate` mutation with `CREATE_CLIENT` sqlId
  - On success → refresh dashboard stats → close modal → toast success

---

## Step 6 – Client: Create Database Dialog

### New File: `service-plus-client/src/features/super-admin/components/create-database-dialog.tsx`
- Simple confirmation dialog (AlertDialog)
- Shows: "Create database `service_plus_<code>` for client `<name>`?"
- On confirm → `createClientDatabase` mutation with `clientId`
- On success → refresh → toast success

---

## Step 7 – Client: Create / Modify Admin User Modal

### New File: `service-plus-client/src/features/super-admin/components/admin-user-modal.tsx`
- **Create mode**: only email field required (username + password auto-generated by server)
- **Modify mode**: list of admin users for client; toggle enable/disable or delete
- Uses `genericUpdate` mutation

---

## Step 8 – Client: Update Client Overview Table

### File: `service-plus-client/src/features/super-admin/components/client-overview-table.tsx`
- Replace DropdownMenu items with:
  - **Create Database** (disabled if `client.db_name` is not null; shows lock icon)
  - **Create Admin User**
  - **Modify Admin User**
  - Separator
  - **Disable** (existing)
- Wire "Add Client" button to open `AddClientModal`
- Wire "Create Database" to open `CreateDatabaseDialog`
- Wire "Create Admin User" / "Modify Admin User" to open `AdminUserModal`

---

## Step 9 – Client: Messages

### File: `service-plus-client/src/constants/messages.ts`
- Add keys:
  - `SUCCESS_CLIENT_CREATED`
  - `SUCCESS_DATABASE_CREATED`
  - `SUCCESS_ADMIN_USER_CREATED`
  - `SUCCESS_ADMIN_USER_MODIFIED`
  - `ERROR_CLIENT_CREATE`
  - `ERROR_DATABASE_CREATE`
  - `ERROR_ADMIN_USER_CREATE`
  - `ERROR_ADMIN_USER_MODIFY`

---

## Step 10 – Client: Redux Slice Update

### File: `service-plus-client/src/features/super-admin/store/super-admin-slice.ts`
- Add modal state fields:
  - `isAddClientModalOpen: boolean`
  - `isCreateDbDialogOpen: boolean`
  - `isAdminUserModalOpen: boolean`
  - `selectedClientId: number | null`
  - `adminUserModalMode: 'create' | 'modify' | null`
- Add actions: `openAddClientModal`, `closeAddClientModal`, `openCreateDbDialog`, `closeCreateDbDialog`, `openAdminUserModal`, `closeAdminUserModal`

---

## Verification Plan

### Manual Verification (in browser)
1. Start the server: `cd service-plus-server && uvicorn app.main:app --reload`
2. Start the client: `cd service-plus-client && pnpm run dev`
3. Login as Super Admin → navigate to Dashboard
4. Click "+ Add Client" → verify the multi-step modal opens with Step 1 form
5. Fill all required fields (Name, Code) → click Next → verify client created in DB and appears in table
6. In the table, locate the new client row → Actions dropdown → "Create Database" → confirm → verify DB created and `db_name` column updated in client row; "Create Database" button should now be disabled
7. Actions → "Create Admin User" → enter email → verify admin user created and email sent (check server logs for email content)
8. Actions → "Modify Admin User" → verify list of admins shown; test disable/enable/delete
9. Verify "Create Database" is disabled (greyed + lock icon) for clients that already have `db_name` set
10. Verify all Sonner toast notifications appear correctly for success and error cases
