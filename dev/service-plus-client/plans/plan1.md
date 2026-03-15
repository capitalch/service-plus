# Plan: Show Active and Inactive BUs in Client Cards

## Context

`GET_BU_USER_STATS` SQL already returns `active_bu` and `inactive_bu` counts. The server helper reads these rows but only extracts admin user stats. The counts need to flow through the server response → client type → client card UI.

---

## Workflow

```
GET_BU_USER_STATS SQL  (already has active_bu / inactive_bu)
        ↓
query_helper.py        extract activeBuCount + inactiveBuCount per client
        ↓
clients_data dict      include activeBuCount, inactiveBuCount fields
        ↓
ClientType (TS)        add activeBuCount, inactiveBuCount fields
        ↓
clients-page.tsx       render BU counts in the client card meta row
```

---

## Steps

### Step 1 — Server: extract BU counts in `query_helper.py`

**File:** `service-plus-server/app/graphql/resolvers/query_helper.py`

In the per-client loop, the `bu_rows` result is already fetched via `GET_BU_USER_STATS`.
Currently only `active_admin_users` / `inactive_admin_users` are read from it.

Add two more variables:
```python
active_bu   = r.get("active_bu",   0)
inactive_bu = r.get("inactive_bu", 0)
```

Then include them in the `clients_data.append({...})` dict:
```python
"activeBuCount":   active_bu,
"inactiveBuCount": inactive_bu,
```

Also initialise them before the `if db_name_val:` block:
```python
active_bu   = 0
inactive_bu = 0
```

### Step 2 — Client: update `ClientType`

**File:** `service-plus-client/src/features/super-admin/types/index.ts`

Add two fields to `ClientType` (sorted alphabetically):
```typescript
activeBuCount: number;
inactiveBuCount: number;
```

### Step 3 — Client: render BU counts in `clients-page.tsx`

**File:** `service-plus-client/src/features/super-admin/pages/clients-page.tsx`

In the **Row 2 meta chips** area of the client card (after the admin count chip), add a BU count chip using the same pattern as the admin chip:

```tsx
<span className="inline-flex items-center gap-1 text-[11px]">
    <BuildingIcon className="h-3 w-3 text-slate-400" />
    <span className="font-medium text-emerald-600">{client.activeBuCount}</span>
    <span className="text-slate-400">active</span>
    {client.inactiveBuCount > 0 && (
        <>
            <span className="text-slate-300">&middot;</span>
            <span className="font-medium text-red-500">{client.inactiveBuCount}</span>
            <span className="text-slate-400">inactive</span>
        </>
    )}
    <span className="text-slate-400">BUs</span>
</span>
```

Import `BuildingIcon` from `lucide-react`.

---

## Files to Modify

| File | Change |
|------|--------|
| `service-plus-server/app/graphql/resolvers/query_helper.py` | Extract `active_bu` / `inactive_bu` and include in response |
| `service-plus-client/src/features/super-admin/types/index.ts` | Add `activeBuCount`, `inactiveBuCount` to `ClientType` |
| `service-plus-client/src/features/super-admin/pages/clients-page.tsx` | Render BU count chip in client card meta row |
