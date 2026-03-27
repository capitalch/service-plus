# Plan: Centralized Login Context — BU & Branch Switcher

## Overview

On login, fetch from DB and store in Redux: `db_name`, last-used BU, all available BUs, and last-used branch.
User can switch BU and branch from the header. Current BU and branch are prominently visible on every page.

---

## Recommendation (Best Approach)

1. **DB columns** on `security.user`: add `last_used_bu_id` and `last_used_branch_id` for persistence across sessions.
2. **Login response** enhanced to return `availableBus` (BUs assigned via `user_bu_role`) and `lastUsedBuId` / `lastUsedBranchId`.
3. **Dedicated `contextSlice`** in Redux (separate from `authSlice`) stores: `currentBu`, `currentBranch`, `availableBus`, `availableBranches`.
4. **Branches fetched lazily**: after login (or BU switch), branches for the selected BU are fetched via `genericQuery` with `schema = bu.code`.
5. **Header switcher**: two compact dropdowns in the admin-layout header — one for BU, one for branch.
6. **Persist on switch**: on BU or branch switch, call `genericUpdate` to write back `last_used_bu_id` / `last_used_branch_id` to `security.user`.

---

## Workflow

```
Login
  │
  ├─► server fetches user + user_bu_role → returns availableBus, lastUsedBuId, lastUsedBranchId
  │
  ├─► client: auth-slice stores token + user (including lastUsedBuId, lastUsedBranchId)
  │           context-slice stores availableBus, sets currentBu = lastUsedBuId match (or first)
  │
  └─► client post-login: fetch branches for currentBu via genericQuery(schema=bu.code)
                          context-slice stores availableBranches, sets currentBranch = lastUsedBranchId match (or head office)

Header (every page)
  │
  ├─ BU Switcher dropdown   ─► on select: setCurrentBu, fetch new branches, persist to DB
  └─ Branch Switcher dropdown ─► on select: setCurrentBranch, persist to DB
```

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `service-plus-server/db/migrations/add_last_used_context.sql` | New migration: ALTER TABLE security.user |
| 2 | `service-plus-server/app/db/sql_auth.py` | Add `GET_USER_BUS`, `GET_BU_BRANCHES`; modify `GET_USER_BY_IDENTITY` |
| 3 | `service-plus-server/app/schemas/auth_schema.py` | Add `availableBus`, `lastUsedBuId`, `lastUsedBranchId` to LoginResponse |
| 4 | `service-plus-server/app/routers/auth_router_helper.py` | Fetch user BUs after login; include in response |
| 5 | `service-plus-client/src/features/auth/store/auth-slice.ts` | Add `lastUsedBuId`, `lastUsedBranchId`, `availableBus` to UserInstanceType / login action |
| 6 | `service-plus-client/src/store/context-slice.ts` | New slice: currentBu, currentBranch, availableBus, availableBranches |
| 7 | `service-plus-client/src/store/store.ts` | Register contextReducer |
| 8 | `service-plus-client/src/store/hooks.ts` | (verify hooks export — no change if already correct) |
| 9 | `service-plus-client/src/constants/sql-map.ts` | Add `GET_USER_BUS`, `GET_BU_BRANCHES` |
| 10 | `service-plus-client/src/constants/messages.ts` | Add BU/branch switcher error messages |
| 11 | `service-plus-client/src/features/auth/pages/login-page.tsx` (or login handler) | After login success, dispatch context init |
| 12 | `service-plus-client/src/features/admin/components/bu-branch-switcher.tsx` | New component: BU + branch dropdowns |
| 13 | `service-plus-client/src/features/admin/components/admin-layout.tsx` | Mount BuBranchSwitcher in header |

---

## ~~Step 1 — DB Migration~~ ✅ Done

---

## ~~Step 2 — `sql_auth.py`: SQL Additions~~ ✅ Done

### Modify `GET_USER_BY_IDENTITY`

Add `u.last_used_bu_id` and `u.last_used_branch_id` to the SELECT list, and to the GROUP BY clause.

### Add `GET_BU_BRANCHES`

```python
GET_BU_BRANCHES = """
    SELECT id, code, is_active, is_head_office, name
    FROM branch
    WHERE is_active = true
    ORDER BY is_head_office DESC, name
"""
```

Note: uses unqualified `branch` because `exec_sql` sets `search_path` to the BU schema.

### Add `GET_USER_BUS`

```python
GET_USER_BUS = """
    with "p_user_id" as (values(%(user_id)s::bigint))
    -- with "p_user_id" as (values(1::bigint)) -- Test line
    SELECT b.id, b.code, b.is_active, b.name,
           EXISTS (
               SELECT 1 FROM pg_catalog.pg_namespace n
               WHERE n.nspname = LOWER(b.code)
           ) AS schema_exists
    FROM security.user_bu_role ubr
    JOIN security.bu b ON b.id = ubr.bu_id
    WHERE ubr.user_id = (table "p_user_id")
      AND ubr.is_active = true
      AND b.is_active = true
    ORDER BY b.name
"""
```

---

## ~~Step 3 — `auth_schema.py`: Expand LoginResponse~~ ✅ Done

Add to `LoginResponse`:

```python
available_bus:       list[dict]  = Field(default_factory=list, alias="availableBus")
last_used_branch_id: int | None  = Field(default=None, alias="lastUsedBranchId")
last_used_bu_id:     int | None  = Field(default=None, alias="lastUsedBuId")
```

---

## ~~Step 4 — `auth_router_helper.py`: Fetch User BUs on Login~~ ✅ Done

After the existing user fetch and before building `LoginResponse`, fetch available BUs:

```python
# Fetch available BUs for this user
user_bus_rows = await exec_sql(
    db_name=db_name,
    schema="security",
    sql=SqlAuth.GET_USER_BUS,
    sql_args={"user_id": user_row["id"]},
)
available_bus = [dict(row) for row in (user_bus_rows or [])]

# Build response with new fields
return LoginResponse(
    ...existing fields...,
    availableBus=available_bus,
    lastUsedBuId=user_row.get("last_used_bu_id"),
    lastUsedBranchId=user_row.get("last_used_branch_id"),
)
```

---

## ~~Step 5 — `auth-slice.ts`: Add Context Fields to UserInstanceType~~ ✅ Done

```typescript
type UserInstanceType = {
    accessRights?:      string[] | null | [];
    availableBus?:      BuContextType[];   // NEW
    dbName?:            string | null;
    email:              string;
    fullName?:          string;
    id?:                string;
    lastUsedBranchId?:  number | null;     // NEW
    lastUsedBuId?:      number | null;     // NEW
    mobile?:            string;
    roleName?:          string;
    userType:           'A' | 'B' | 'S';
    username:           string;
};

type BuContextType = {
    code:          string;
    id:            number;
    is_active:     boolean;
    name:          string;
    schema_exists: boolean;
};
```

Add selectors:
```typescript
export const selectAvailableBus     = (state: RootState) => state.auth.user?.availableBus ?? [];
export const selectLastUsedBuId     = (state: RootState) => state.auth.user?.lastUsedBuId ?? null;
export const selectLastUsedBranchId = (state: RootState) => state.auth.user?.lastUsedBranchId ?? null;
```

Also update `LoginResponseType` in `auth-service.ts` to include the new fields.

---

## ~~Step 6 — `context-slice.ts`: New Redux Slice~~ ✅ Done

New file: `service-plus-client/src/store/context-slice.ts`

```typescript
type BranchContextType = {
    code:            string;
    id:              number;
    is_active:       boolean;
    is_head_office:  boolean;
    name:            string;
};

type BuContextType = {
    code:          string;
    id:            number;
    is_active:     boolean;
    name:          string;
    schema_exists: boolean;
};

type ContextStateType = {
    availableBranches: BranchContextType[];
    availableBus:      BuContextType[];
    currentBranch:     BranchContextType | null;
    currentBu:         BuContextType | null;
};

const initialState: ContextStateType = {
    availableBranches: [],
    availableBus:      [],
    currentBranch:     null,
    currentBu:         null,
};
```

Reducers:
- `clearContext` — reset to initial state (on logout)
- `setAvailableBranches(branches)` — set branch list
- `setAvailableBus(buses)` — set BU list
- `setCurrentBranch(branch)` — set active branch
- `setCurrentBu(bu)` — set active BU

Selectors:
- `selectAvailableBranches`
- `selectAvailableBus`
- `selectCurrentBranch`
- `selectCurrentBu`

---

## ~~Step 7 — `store.ts`: Register contextReducer~~ ✅ Done

```typescript
import { contextReducer } from "@/store/context-slice";

export const store = configureStore({
    reducer: {
        admin:   adminReducer,
        auth:    authReducer,
        context: contextReducer,    // ADD
    },
    ...
});
```

Update `RootState` type accordingly.

---

## ~~Step 8 — (verify) `hooks.ts`~~ ✅ No change needed

No change needed if `useAppDispatch` and `useAppSelector` already use `RootState` from the store.

---

## ~~Step 9 — `sql-map.ts`: Add Keys~~ ✅ Done

```typescript
GET_BU_BRANCHES: "GET_BU_BRANCHES",
GET_USER_BUS:    "GET_USER_BUS",
```

---

## ~~Step 10 — `messages.ts`: Add Messages~~ ✅ Done

```typescript
// BU / Branch Switcher
ERROR_BU_SWITCH_FAILED:     'Failed to switch business unit. Please try again.',
ERROR_BRANCH_SWITCH_FAILED: 'Failed to switch branch. Please try again.',
ERROR_BRANCHES_LOAD_FAILED: 'Failed to load branches. Please try again.',
```

---

## ~~Step 11 — Login Handler: Initialize Context After Login~~ ✅ Done

In the login success handler (wherever `setCredentials` is dispatched), also:

```typescript
// After setCredentials dispatch:
dispatch(setAvailableBus(response.availableBus ?? []));

// Resolve currentBu
const lastBu = (response.availableBus ?? []).find(b => b.id === response.lastUsedBuId)
    ?? (response.availableBus ?? [])[0]
    ?? null;
dispatch(setCurrentBu(lastBu));

// lastUsedBranchId stored in user — branches are fetched in BuBranchSwitcher on mount
```

Branches are fetched in the switcher component (Step 12) on mount and on BU change, to keep the login flow non-blocking.

Also dispatch `clearContext()` on logout.

---

## ~~Step 12 — `bu-branch-switcher.tsx`: New Component~~ ✅ Done

New file: `service-plus-client/src/features/admin/components/bu-branch-switcher.tsx`

### Behaviour:
- On mount: if `currentBu` is set, fetch branches for that BU via `genericQuery(db_name, schema=bu.code, GET_BU_BRANCHES)`.
- Display two compact Select dropdowns side by side: **Business Unit** | **Branch**.
- **BU switch**: select new BU → fetch its branches → set first/head-office branch as current → persist both to DB.
- **Branch switch**: select new branch → persist to DB.
- **Persist**: call `genericUpdate` with `tableName: "user"`, `xData: { id: userId, last_used_bu_id, last_used_branch_id }`, `schema: "security"`.

### Layout:
```
[ BU: Main Workshop ▼ ]  [ Branch: Head Office ▼ ]
```
Compact, shown in header between user name and action buttons. If only one BU or one branch, show as plain text badge (no dropdown).

### Key types used:
```typescript
type GenericBranchDataType = { genericQuery: BranchContextType[] | null };
```

---

## ~~Step 13 — `admin-layout.tsx`: Mount Switcher in Header~~ ✅ Done

Add `BuBranchSwitcher` between the left/logo area and the right action buttons:

```tsx
<header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
    {/* Mobile logo */}
    <div className="flex flex-1 items-center justify-center gap-4 lg:justify-start">
        <BuBranchSwitcher />        {/* NEW — centered in header */}
    </div>
    <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-slate-400">{user?.fullName ?? user?.username}</span>
        {/* Switch mode button */}
        {/* Logout button */}
    </div>
</header>
```

---

## Key Design Notes

1. **`last_used_bu_id` / `last_used_branch_id` on `security.user`** is the simplest persistence. No extra table needed. Works within the existing schema.

2. **Branches are per-BU-schema** (`{bu_code}.branch`) — fetched with `schema = bu.code` via genericQuery. This keeps server-side changes minimal (reuse existing genericQuery endpoint).

3. **`contextSlice` is separate from `authSlice`** — auth stores credentials, context stores the working session state. Logout clears both.

4. **Single BU / single branch case**: if `availableBus.length === 1`, show as badge (no dropdown). Same for branches. This avoids unnecessary UI for simple setups.

5. **Admin users ('A')**: they have access to all BUs (or BUs assigned to them). The switcher still works for admin mode using the same `user_bu_role` relationship.

6. **`GET_USER_BY_IDENTITY` already runs on login** — we add `last_used_bu_id` and `last_used_branch_id` to its SELECT. No extra login-time query for these two columns.

7. **`GET_USER_BUS` is a new login-time query** (one extra round-trip on login). Acceptable since login is infrequent.
