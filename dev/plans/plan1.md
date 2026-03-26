# Plan: Branch Master Data CRUD

## Requirement
Full CRUD operations for the `branch` table in the client-mode Masters section.
- Add, Edit, Delete branches
- Cannot delete the Head Office branch (only modify it)

---

## Workflow

```
Business User (client mode)
  └─ Masters > Branch
       ├─ Loads branch list via genericQuery (GET_ALL_BRANCHES)
       ├─ Add Branch   → AddBranchDialog   → genericUpdate (INSERT)
       ├─ Edit Branch  → EditBranchDialog  → genericUpdate (UPDATE)
       └─ Delete Branch → DeleteBranchDialog → genericUpdate (deletedIds)
                          (disabled for head office)
```

All queries use:
- `db_name`: service database name (e.g. `service_plus_demo`) — from `selectDbName`
- `schema`:  BU schema name (e.g. `demo1`) — from new `selectSchema` (= lowercase of user's `buCode`)

The `buCode` is not currently in the login response. It will be added by joining `security.bu` in `GET_USER_BY_IDENTITY` and returning `MIN(b.code) AS bu_code` (lowercase of the user's primary BU).

---

## Step 1 — Server: Update `GET_USER_BY_IDENTITY` in `sql_auth.py`

**File:** `service-plus-server/app/db/sql_auth.py`

Add `LEFT JOIN security.bu b ON b.id = ubr.bu_id` and select `MIN(b.code) AS bu_code` in the existing `GET_USER_BY_IDENTITY` query so that the login response can include the user's BU schema name.

Updated SELECT:
```sql
MIN(b.code) AS bu_code,
```
Added JOIN (after the existing `user_bu_role` join):
```sql
LEFT JOIN security.bu b ON b.id = ubr.bu_id
```
The GROUP BY clause stays unchanged.

---

## Step 2 — Server: Add branch-related SQL queries to `sql_auth.py`

**File:** `service-plus-server/app/db/sql_auth.py`

Add the following class attributes to `SqlAuth`. All branch/state queries run against the BU schema (search_path is set by `exec_sql`), so no schema prefix is needed in the SQL.

```
GET_ALL_BRANCHES
    SELECT b.id, b.code, b.name, b.phone, b.email,
           b.address_line1, b.address_line2,
           b.state_id, s.name AS state_name,
           b.city, b.pincode, b.gstin,
           b.is_active, b.is_head_office
    FROM branch b
    LEFT JOIN state s ON s.id = b.state_id
    ORDER BY b.name

GET_ALL_STATES
    SELECT id, code, name
    FROM state
    WHERE is_active = true
    ORDER BY name

CHECK_BRANCH_CODE_EXISTS
    EXISTS check on branch.code (case-insensitive)

CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID
    Same but excluding a given branch id (for edit uniqueness check)

CHECK_BRANCH_NAME_EXISTS
    EXISTS check on branch.name (case-insensitive)

CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID
    Same but excluding a given branch id

CHECK_BRANCH_IN_USE
    Returns true if the branch id is referenced in any related table:
    ```sql
    SELECT EXISTS (
        SELECT 1 FROM technician        WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM document_sequence WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM job               WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM purchase_invoice  WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM sales_invoice     WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM stock_adjustment  WHERE branch_id = %(id)s
        UNION ALL
        SELECT 1 FROM stock_transaction WHERE branch_id = %(id)s
    ) AS in_use
    ```
```

---

## Step 3 — Server: Add `bu_code` to login response

**File:** `service-plus-server/app/schemas/auth_schema.py`

Add field to `LoginResponse`:
```python
bu_code: str | None = Field(default=None, alias="buCode", description="User's primary BU schema code")
```

**File:** `service-plus-server/app/routers/auth_router_helper.py`

In `login_helper`, pass the new field in the `LoginResponse(...)` call:
```python
bu_code=user.get("bu_code"),
```
(For super admin and admin users, `bu_code` will be `None`.)

---

## Step 4 — Client: Update auth types

**File:** `service-plus-client/src/features/auth/services/auth-service.ts`

Add `buCode` to both `LoginResponseType` and `UserInstanceType`:
```typescript
buCode?: string | null;
```

---

## Step 5 — Client: Add `selectSchema` selector to `auth-slice.ts`

**File:** `service-plus-client/src/features/auth/store/auth-slice.ts`

Add selector:
```typescript
export const selectSchema = (state: { auth: AuthState }) =>
    state.auth.user?.buCode?.toLowerCase() ?? null;
```

---

## Step 6 — Client: Add branch SQL IDs to `sql-map.ts`

**File:** `service-plus-client/src/constants/sql-map.ts`

Add:
```typescript
CHECK_BRANCH_CODE_EXISTS: "CHECK_BRANCH_CODE_EXISTS",
CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID: "CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID",
CHECK_BRANCH_NAME_EXISTS: "CHECK_BRANCH_NAME_EXISTS",
CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID: "CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID",
CHECK_BRANCH_IN_USE: "CHECK_BRANCH_IN_USE",
GET_ALL_BRANCHES: "GET_ALL_BRANCHES",
GET_ALL_STATES: "GET_ALL_STATES",
```

---

## Step 7 — Client: Add branch messages to `messages.ts`

**File:** `service-plus-client/src/constants/messages.ts`

Add to `MESSAGES`:
```typescript
// Branch CRUD
ERROR_BRANCH_CODE_EXISTS:            'This code is already in use.',
ERROR_BRANCH_CODE_EXISTS_EDIT:       'This code is already used by another branch.',
ERROR_BRANCH_NAME_EXISTS:            'This name is already in use.',
ERROR_BRANCH_NAME_EXISTS_EDIT:       'This name is already used by another branch.',
ERROR_BRANCH_CREATE_FAILED:          'Failed to create branch. Please try again.',
ERROR_BRANCH_UPDATE_FAILED:          'Failed to update branch. Please try again.',
ERROR_BRANCH_DELETE_FAILED:          'Failed to delete branch. Please try again.',
ERROR_BRANCH_LOAD_FAILED:            'Failed to load branches. Please try again.',
ERROR_STATES_LOAD_FAILED:            'Failed to load states. Please try again.',
ERROR_BRANCH_DELETE_HEAD_OFFICE:     'Head Office branch cannot be deleted.',
ERROR_BRANCH_DELETE_IN_USE:          'This branch cannot be deleted as it is referenced by existing records.',
SUCCESS_BRANCH_CREATED:              'Branch created successfully.',
SUCCESS_BRANCH_UPDATED:              'Branch updated successfully.',
SUCCESS_BRANCH_DELETED:              'Branch deleted successfully.',
```

---

## Step 8 — Client: Create `add-branch-dialog.tsx`

**File:** `service-plus-client/src/features/client/components/add-branch-dialog.tsx`

Pattern: follows `create-business-unit-dialog.tsx` / `edit-business-unit-dialog.tsx` from admin.

**Zod schema fields:**
| Field | Required | Validation |
|-------|----------|------------|
| code | Yes | `^[A-Z0-9_]+$`, 2–20 chars, auto-uppercased, unique check |
| name | Yes | min 2 chars, unique check |
| address_line1 | Yes | min 3 chars |
| state_id | Yes | number > 0 |
| pincode | Yes | min 4 chars |
| phone | No | optional |
| email | No | valid email or empty |
| city | No | optional |
| address_line2 | No | optional |
| gstin | No | GSTIN regex or empty |

**State dropdown:** Pre-fetched via `genericQuery` (GET_ALL_STATES) on dialog open. Rendered as `<Select>` component.

**Uniqueness checks:** Debounced (1200ms) for `code` and `name` using `genericQuery` with `CHECK_BRANCH_CODE_EXISTS` / `CHECK_BRANCH_NAME_EXISTS`.

**Submit:** `genericUpdate` with:
```typescript
{
    tableName: "branch",
    xData: { code, name, address_line1, address_line2, state_id, city, pincode, phone, email, gstin }
    // no id → triggers INSERT
}
```

---

## Step 9 — Client: Create `edit-branch-dialog.tsx`

**File:** `service-plus-client/src/features/client/components/edit-branch-dialog.tsx`

Pattern: follows `edit-business-unit-dialog.tsx`.

- `code` field shown as read-only
- All other fields editable (same as add, plus `is_active` checkbox)
- Uniqueness checks use `CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID` (with current branch id)
- **Submit:** `genericUpdate` with `xData: { id: branch.id, ...fields }` → triggers UPDATE

---

## Step 10 — Client: Create `delete-branch-dialog.tsx`

**File:** `service-plus-client/src/features/client/components/delete-branch-dialog.tsx`

Pattern: follows `delete-business-unit-dialog.tsx`.

- Shows branch name in confirmation
- User must type branch name to confirm
- **On dialog open:** immediately call `genericQuery` with `CHECK_BRANCH_IN_USE` (passing `{ id: branch.id }`). While loading show spinner on confirm button.
- **Disable + warning** in either of these cases (checked in order):
  1. `branch.is_head_office === true` → "Head Office branch cannot be deleted."
  2. `CHECK_BRANCH_IN_USE` returns `in_use: true` → "This branch cannot be deleted as it is referenced by existing records."
- **Submit (only when not blocked):** `genericUpdate` with `{ tableName: "branch", deletedIds: [branch.id], xData: {} }`

---

## Step 11 — Client: Replace `client-masters-page.tsx` with full Branch CRUD page

**File:** `service-plus-client/src/features/client/pages/client-masters-page.tsx`

Pattern: follows `business-units-page.tsx`.

**Table columns:**
`#` | Code | Name | State | City | Phone | Status | Head Office | Actions

**Actions dropdown (per row):**
- Edit (always available)
- Activate / Deactivate toggle
- Delete (disabled with tooltip if `is_head_office = true`; in-use check runs inside the dialog on open)

**Data loading:** `genericQuery` with `GET_ALL_BRANCHES`, `db_name: dbName`, `schema: schema` (from `selectSchema`).

**Dialog state:**
```typescript
const [addOpen, setAddOpen]       = useState(false);
const [editBranch, setEditBranch] = useState<BranchType | null>(null);
const [deleteBranch, setDeleteBranch] = useState<BranchType | null>(null);
```

**Local type:**
```typescript
type BranchType = {
    id: number; code: string; name: string;
    phone: string | null; email: string | null;
    address_line1: string; address_line2: string | null;
    state_id: number; state_name: string | null;
    city: string | null; pincode: string; gstin: string | null;
    is_active: boolean; is_head_office: boolean;
};
```

---

## Files Changed Summary

| # | File | Change |
|---|------|--------|
| 1 | `service-plus-server/app/db/sql_auth.py` | Update GET_USER_BY_IDENTITY; add 7 new SQL queries (incl. CHECK_BRANCH_IN_USE) |
| 2 | `service-plus-server/app/schemas/auth_schema.py` | Add `bu_code` to LoginResponse |
| 3 | `service-plus-server/app/routers/auth_router_helper.py` | Pass `bu_code` in login response |
| 4 | `service-plus-client/src/features/auth/services/auth-service.ts` | Add `buCode` to types |
| 5 | `service-plus-client/src/features/auth/store/auth-slice.ts` | Add `selectSchema` selector |
| 6 | `service-plus-client/src/constants/sql-map.ts` | Add 7 branch SQL IDs (incl. CHECK_BRANCH_IN_USE) |
| 7 | `service-plus-client/src/constants/messages.ts` | Add branch CRUD messages |
| 8 | `service-plus-client/src/features/client/components/add-branch-dialog.tsx` | **New** |
| 9 | `service-plus-client/src/features/client/components/edit-branch-dialog.tsx` | **New** |
| 10 | `service-plus-client/src/features/client/components/delete-branch-dialog.tsx` | **New** |
| 11 | `service-plus-client/src/features/client/pages/client-masters-page.tsx` | Replace placeholder with full CRUD page |
