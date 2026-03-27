# Plan: Branch Master Data CRUD

## Requirement
Full CRUD operations for the `branch` table in the client-mode Masters section.
- Add, Edit, Delete branches
- Cannot delete the Head Office branch (only modify it)

---

## Current State (as of revision)

| Item | Status |
|------|--------|
| `auth_schema.py` — `available_bus`, `lastUsedBuId`, `lastUsedBranchId` in LoginResponse | ✅ Done |
| `auth_router_helper.py` — fetches user BUs on login | ✅ Done |
| `auth-service.ts` — `availableBus`, `lastUsedBuId`, `lastUsedBranchId` in type | ✅ Done |
| `auth-slice.ts` — `selectAvailableBus`, `selectLastUsedBuId` selectors | ✅ Done |
| `sql_auth.py` — `GET_USER_BUS`, `GET_BU_BRANCHES` | ✅ Done |
| `sql-map.ts` — `GET_BU_BRANCHES`, `GET_USER_BUS` | ✅ Done |
| `BusinessUnitType` — `seed_exists` field | ✅ Done |
| `GET_USER_BY_IDENTITY` — `bu_code` JOIN | ❌ Not needed (replaced by `availableBus` list) |
| `sql_auth.py` — branch CRUD SQL (`GET_ALL_BRANCHES`, `GET_ALL_STATES`, `CHECK_BRANCH_*`, `CHECK_BRANCH_IN_USE`) | ❌ Pending |
| `auth-slice.ts` — `selectSchema` selector | ❌ Pending |
| `sql-map.ts` — branch CRUD SQL IDs | ❌ Pending |
| `messages.ts` — branch CRUD messages | ❌ Pending |
| `add-branch-dialog.tsx` | ❌ Pending |
| `edit-branch-dialog.tsx` | ❌ Pending |
| `delete-branch-dialog.tsx` | ❌ Pending |
| `client-masters-page.tsx` — full CRUD page | ❌ Pending (placeholder only) |

---

## Design Note: Schema Selection

`selectSchema` reads `state.context.currentBu?.code?.toLowerCase()` from `contextSlice` — the BU selected in the BU/Branch switcher. This ensures the branch list always reflects the BU the user is actively working in.

**Prerequisite:** `contextSlice` (`src/store/context-slice.ts`) must be implemented before this plan is applied. It is defined in the centralized login context plan.

---

## Workflow

```
Business User (client mode)
  └─ Masters > Branch
       ├─ Loads branch list via genericQuery (GET_ALL_BRANCHES)
       │    db_name = selectDbName, schema = selectSchema
       ├─ Add Branch    → AddBranchDialog    → genericUpdate (INSERT)
       ├─ Edit Branch   → EditBranchDialog   → genericUpdate (UPDATE)
       └─ Delete Branch → DeleteBranchDialog → genericUpdate (deletedIds)
                          (blocked for head office or in-use branches)
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `service-plus-server/app/db/sql_auth.py` | Add 7 branch SQL queries |
| 2 | `service-plus-client/src/store/context-slice.ts` | Add `selectSchema` selector |
| 3 | `service-plus-client/src/constants/sql-map.ts` | Add 7 branch SQL IDs |
| 4 | `service-plus-client/src/constants/messages.ts` | Add branch CRUD messages |
| 5 | `service-plus-client/src/features/client/components/add-branch-dialog.tsx` | **New** |
| 6 | `service-plus-client/src/features/client/components/edit-branch-dialog.tsx` | **New** |
| 7 | `service-plus-client/src/features/client/components/delete-branch-dialog.tsx` | **New** |
| 8 | `service-plus-client/src/features/client/pages/client-masters-page.tsx` | Replace placeholder with full CRUD |

---

## Step 1 — `sql_auth.py`: Add Branch SQL

**File:** `service-plus-server/app/db/sql_auth.py`

Add to `SqlAuth` class (alphabetically sorted):

```python
CHECK_BRANCH_CODE_EXISTS = """
    with "p_code" as (values(%(code)s::text))
    -- with "p_code" as (values('hq'::text)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM branch
        WHERE LOWER(code) = LOWER((table "p_code"))
    ) AS exists
"""

CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID = """
    with "p_code" as (values(%(code)s::text)),
         "p_id"   as (values(%(id)s::bigint))
    -- with "p_code" as (values('hq'::text)), "p_id" as (values(1::bigint)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM branch
        WHERE LOWER(code) = LOWER((table "p_code"))
          AND id != (table "p_id")
    ) AS exists
"""

CHECK_BRANCH_IN_USE = """
    with "p_id" as (values(%(id)s::bigint))
    -- with "p_id" as (values(1::bigint)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM technician        WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM document_sequence WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM job               WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM purchase_invoice  WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM sales_invoice     WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM stock_adjustment  WHERE branch_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM stock_transaction WHERE branch_id = (table "p_id")
    ) AS in_use
"""

CHECK_BRANCH_NAME_EXISTS = """
    with "p_name" as (values(%(name)s::text))
    -- with "p_name" as (values('Head Office'::text)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM branch
        WHERE LOWER(name) = LOWER((table "p_name"))
    ) AS exists
"""

CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID = """
    with "p_name" as (values(%(name)s::text)),
         "p_id"   as (values(%(id)s::bigint))
    -- with "p_name" as (values('Head Office'::text)), "p_id" as (values(1::bigint)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM branch
        WHERE LOWER(name) = LOWER((table "p_name"))
          AND id != (table "p_id")
    ) AS exists
"""

GET_ALL_BRANCHES = """
    with "dummy" as (values(1::int))
    -- with "dummy" as (values(1::int)) -- Test line
    SELECT b.id, b.address_line1, b.address_line2,
           b.city, b.code, b.email,
           b.gstin, b.is_active, b.is_head_office,
           b.name, b.phone, b.pincode,
           b.state_id, s.name AS state_name
    FROM branch b
    LEFT JOIN state s ON s.id = b.state_id
    ORDER BY b.is_head_office DESC, b.name
"""

GET_ALL_STATES = """
    with "dummy" as (values(1::int))
    -- with "dummy" as (values(1::int)) -- Test line
    SELECT id, code, name
    FROM state
    WHERE is_active = true
    ORDER BY name
"""
```

Note: all queries use **unqualified** table names — `exec_sql` sets `search_path` to the BU schema at runtime.

---

## Step 2 — `context-slice.ts`: Add `selectSchema`

**File:** `service-plus-client/src/store/context-slice.ts`

Add selector (alphabetically after existing selectors):

```typescript
export const selectSchema = (state: RootState): string | null =>
    state.context.currentBu?.code?.toLowerCase() ?? null;
```

This returns the code of whatever BU the user has currently selected in the BU/Branch switcher. The branch page and dialogs use this as the `schema` argument for all genericQuery / genericUpdate calls.

---

## Step 3 — `sql-map.ts`: Add Branch SQL IDs

**File:** `service-plus-client/src/constants/sql-map.ts`

Add (alphabetically):
```typescript
CHECK_BRANCH_CODE_EXISTS:            "CHECK_BRANCH_CODE_EXISTS",
CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID: "CHECK_BRANCH_CODE_EXISTS_EXCLUDE_ID",
CHECK_BRANCH_IN_USE:                 "CHECK_BRANCH_IN_USE",
CHECK_BRANCH_NAME_EXISTS:            "CHECK_BRANCH_NAME_EXISTS",
CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID: "CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID",
GET_ALL_BRANCHES:                    "GET_ALL_BRANCHES",
GET_ALL_STATES:                      "GET_ALL_STATES",
```

---

## Step 4 — `messages.ts`: Add Branch Messages

**File:** `service-plus-client/src/constants/messages.ts`

Add under a `// Branch CRUD` comment (alphabetically within group):
```typescript
// Branch CRUD
ERROR_BRANCH_CODE_EXISTS:        'This code is already in use.',
ERROR_BRANCH_CODE_EXISTS_EDIT:   'This code is already used by another branch.',
ERROR_BRANCH_CREATE_FAILED:      'Failed to create branch. Please try again.',
ERROR_BRANCH_DELETE_FAILED:      'Failed to delete branch. Please try again.',
ERROR_BRANCH_DELETE_HEAD_OFFICE: 'Head Office branch cannot be deleted.',
ERROR_BRANCH_DELETE_IN_USE:      'This branch cannot be deleted as it is referenced by existing records.',
ERROR_BRANCH_LOAD_FAILED:        'Failed to load branches. Please try again.',
ERROR_BRANCH_NAME_EXISTS:        'This name is already in use.',
ERROR_BRANCH_NAME_EXISTS_EDIT:   'This name is already used by another branch.',
ERROR_BRANCH_UPDATE_FAILED:      'Failed to update branch. Please try again.',
ERROR_STATES_LOAD_FAILED:        'Failed to load states. Please try again.',
SUCCESS_BRANCH_CREATED:          'Branch created successfully.',
SUCCESS_BRANCH_DELETED:          'Branch deleted successfully.',
SUCCESS_BRANCH_UPDATED:          'Branch updated successfully.',
```

---

## Step 5 — `add-branch-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/add-branch-dialog.tsx`

### Props
```typescript
type AddBranchDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Zod Schema
```typescript
const addBranchSchema = z.object({
    address_line1:  z.string().min(3, "Address is required"),
    address_line2:  z.string().optional(),
    city:           z.string().optional(),
    code:           z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/, "Only uppercase letters, numbers and underscores")
                      .transform((v) => v.toUpperCase()),
    email:          z.string().email("Invalid email").or(z.literal("")).optional(),
    gstin:          z.string().regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN").or(z.literal("")).optional(),
    name:           z.string().min(2, "Name must be at least 2 characters"),
    phone:          z.string().optional(),
    pincode:        z.string().min(4, "Pincode is required"),
    state_id:       z.number({ required_error: "State is required" }).positive(),
});
```

### Behaviour
- On open: fetch states via `genericQuery(GET_ALL_STATES, schema)` and store locally.
- Debounced (1200ms) uniqueness checks: `CHECK_BRANCH_CODE_EXISTS`, `CHECK_BRANCH_NAME_EXISTS`.
- **Submit:** `genericUpdate` with:
```typescript
{
    tableName: "branch",
    xData: { address_line1, address_line2, city, code, email, gstin, name, phone, pincode, state_id }
    // no id → INSERT
}
```
- `db_name = selectDbName`, `schema = selectSchema`
- On success: `toast.success(MESSAGES.SUCCESS_BRANCH_CREATED)`, call `onSuccess()`.

---

## Step 6 — `edit-branch-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/edit-branch-dialog.tsx`

### Props
```typescript
type EditBranchDialogPropsType = {
    branch:      BranchType;
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Behaviour
- `code` field shown as **read-only** badge (cannot be changed after creation).
- All other fields editable (same as add). `is_active` is not editable here (handled via Activate/Deactivate actions on the page).
- Uniqueness checks use `CHECK_BRANCH_NAME_EXISTS_EXCLUDE_ID` (excluding current branch id).
- Pre-fills form from `branch` prop on open.
- **Submit:** `genericUpdate` with `xData: { id: branch.id, address_line1, ..., state_id }` → UPDATE.
- On success: `toast.success(MESSAGES.SUCCESS_BRANCH_UPDATED)`.

---

## Step 7 — `delete-branch-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/delete-branch-dialog.tsx`

### Props
```typescript
type DeleteBranchDialogPropsType = {
    branch:      BranchType;
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Behaviour
- On open: call `genericQuery(CHECK_BRANCH_IN_USE, { id: branch.id })`. Show spinner in Delete button while checking.
- **Blocked (show amber warning, Delete disabled) if:**
  1. `branch.is_head_office === true` → show `ERROR_BRANCH_DELETE_HEAD_OFFICE`
  2. `in_use === true` → show `ERROR_BRANCH_DELETE_IN_USE`
- **When not blocked:** user must type branch name to confirm (compare `.toLowerCase()`).
- **Submit:** `genericUpdate` with `{ tableName: "branch", deletedIds: [branch.id], xData: {} }`.
- On success: `toast.success(MESSAGES.SUCCESS_BRANCH_DELETED)`.

---

## Step 8 — `client-masters-page.tsx`: Full Branch CRUD Page

**File:** `service-plus-client/src/features/client/pages/client-masters-page.tsx`

Replace the current placeholder with a full page following `business-units-page.tsx` pattern.

### Local type
```typescript
type BranchType = {
    address_line1:  string;
    address_line2:  string | null;
    city:           string | null;
    code:           string;
    email:          string | null;
    gstin:          string | null;
    id:             number;
    is_active:      boolean;
    is_head_office: boolean;
    name:           string;
    phone:          string | null;
    pincode:        string;
    state_id:       number;
    state_name:     string | null;
};
```

### Data loading
```typescript
genericQuery({
    db_name: dbName,
    schema:  schema,   // from selectSchema
    value:   buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANCHES }),
})
```

### Table columns
`#` | Code | Name | State | City | Phone | Head Office | Status | Actions

### Actions dropdown (per row)
- **Edit** — always enabled → opens `EditBranchDialog`
- **Activate / Deactivate** toggle → `genericUpdate` inline (no dialog)
- **Delete** — opens `DeleteBranchDialog` (dialog handles head-office + in-use guards)

### State variables
```typescript
const [addOpen,       setAddOpen]       = useState(false);
const [deleteBranch,  setDeleteBranch]  = useState<BranchType | null>(null);
const [editBranch,    setEditBranch]    = useState<BranchType | null>(null);
const [loading,       setLoading]       = useState(false);
```

### Selectors used
```typescript
const dbName = useAppSelector(selectDbName);   // from auth-slice
const schema = useAppSelector(selectSchema);   // from context-slice (currentBu.code)
```

Guard: if `schema` is null (no BU assigned), show an info message "No business unit assigned. Please contact your administrator."
