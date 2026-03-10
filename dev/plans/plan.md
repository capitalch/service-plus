# Plan: Merge Admins Screen into Clients Screen

## Objective
Eliminate the separate Admins page. Fold all admin-user management (view, add, edit, activate, deactivate) directly into the Clients page via a per-client expandable accordion. Each client row becomes collapsible to reveal its admin sub-table.

---

## Workflow

```
ClientsPage (accordion layout)
  ├─> Stat cards: Total Clients, Active, Inactive | Total Admins, Active, Inactive | Orphan DBs
  ├─> Search bar (filters across client name/code and admin name/email)
  └─> Per-client accordion card
        ├─> Header: avatar, name, code, status badge, DB status, admin count, [Add Admin] btn, [...] dropdown
        │     Dropdown: View | Edit | Initialize | Attach DB | Detach DB | ─── | Activate/Deactivate | ─── | Delete
        └─> Body (expanded): Admin sub-table
              Columns: #, Full Name, Email, Mobile, Status, Actions
              Row actions dropdown: Edit | ─── | Activate / Deactivate

Data source: single server query "superAdminCombinedData"
  Returns: stats + orphan DBs + clients[] each with full client fields + admins[]

Navigation: Remove "Admins" sidebar entry and /super-admin/admins route
```

---

## Steps

### Step 1 — Server: Extend `resolve_super_admin_clients_data_helper` in `query_helper.py`
**File:** `service-plus-server/app/graphql/resolvers/query_helper.py`

Inside the per-client loop, after the `db_name_valid` check where `GET_BU_USER_STATS` is already called, add a fetch of admin users using `GET_ADMIN_USERS`. Append the resulting `admins` list to each client dict:

```python
admins = []
if db_name_valid:
    admin_rows = await exec_sql(
        db_name=db_name_val, schema="security",
        sql=SqlAuth.GET_ADMIN_USERS,
    )
    for a in admin_rows:
        admins.append({
            "created_at": a["created_at"].isoformat() if a.get("created_at") else None,
            "email":      a.get("email"),
            "full_name":  a.get("full_name"),
            "id":         a.get("id"),
            "is_active":  a.get("is_active"),
            "mobile":     a.get("mobile"),
            "updated_at": a["updated_at"].isoformat() if a.get("updated_at") else None,
            "username":   a.get("username"),
        })
```

Also add aggregated admin stat totals to the top-level return dict:
```python
"totalAdmins":    total_admin_users_across_all_clients,
"activeAdmins":   active_admin_users_across_all_clients,
"inactiveAdmins": inactive_admin_users_across_all_clients,
```

(These are already available from `GET_BU_USER_STATS` per client — accumulate them across the loop.)

---

### Step 2 — Client: Extend `ClientType` in `types/index.ts`
**File:** `service-plus-client/src/features/super-admin/types/index.ts`

Add `admins` field to `ClientType`:
```ts
admins: ClientAdminType[];
```

Also add three global admin stat fields to the `ClientsPageStatsType` used in `clients-page.tsx`:
```ts
activeAdmins: number;
inactiveAdmins: number;
totalAdmins: number;
```

---

### Step 3 — Client: Rewrite `clients-page.tsx`
**File:** `service-plus-client/src/features/super-admin/pages/clients-page.tsx`

**Layout change:** Replace the flat `<Table>` with a per-client accordion card list (same pattern as current `admins-page.tsx`), plus retain stat cards and search.

**Stat cards (5 cards in 2 rows or a single responsive row):**
- Row 1 (3 cards): Total Clients | Active Clients | Inactive Clients
- Row 2 (3 cards): Total Admins | Active Admins | Inactive Admins
- Orphan Databases card (separate, with View button — unchanged)

**Search bar:** filters across `client.name`, `client.code`, `admin.full_name`, `admin.email`.

**Per-client accordion card:**
- Header (always visible, clickable to expand/collapse):
  - Client avatar (first letter, color by active/inactive)
  - Name (bold), code (mono, muted), status badge, DB status icon (CheckCircle2/XCircle)
  - Admin count pill: `{activeAdminCount} active / {inactiveAdminCount} inactive`
  - `[Add Admin]` button — disabled if `!db_name_valid || !client.is_active`
  - `[Initialize]` button — same disabled logic as before
  - `[⋮]` dropdown: View | Edit | Add Admin | Attach DB | Detach DB | separator | Activate/Deactivate | separator (if inactive) | Delete
  - Chevron icon (right / down)

- Body (collapsible):
  - If no DB / DB invalid: amber info note "Database not initialized."
  - If `admins.length === 0`: muted note "No admin users yet."
  - Otherwise: compact admin sub-table:
    - Columns: `#`, Full Name, Email, Mobile, Status, Actions
    - Row actions dropdown: Edit | separator | Activate / Deactivate

**State additions:**
```ts
const [activateAdmin, setActivateAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
const [deactivateAdmin, setDeactivateAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
const [editAdmin, setEditAdmin] = useState<{ admin: ClientAdminType; client: ClientType } | null>(null);
const [expanded, setExpanded] = useState<Record<number, boolean>>({});
```

**Handler additions:**
```ts
const handleActivateAdmin  = (admin: ClientAdminType, client: ClientType) => setActivateAdmin({ admin, client });
const handleDeactivateAdmin = (admin: ClientAdminType, client: ClientType) => setDeactivateAdmin({ admin, client });
const handleEditAdmin       = (admin: ClientAdminType, client: ClientType) => setEditAdmin({ admin, client });
function toggleExpanded(clientId: number) { setExpanded((p) => ({ ...p, [clientId]: !p[clientId] })); }
```

**Dialog additions** (alongside existing dialogs):
```tsx
{editAdmin && (
    <EditAdminDialog
        admin={editAdmin.admin}
        clientName={editAdmin.client.name}
        dbName={editAdmin.client.db_name!}
        open={!!editAdmin}
        onOpenChange={(open) => { if (!open) setEditAdmin(null); }}
        onSuccess={handleRefetch}
    />
)}
{activateAdmin && (
    <ActivateAdminDialog
        admin={activateAdmin.admin}
        clientName={activateAdmin.client.name}
        dbName={activateAdmin.client.db_name!}
        open={!!activateAdmin}
        onOpenChange={(open) => { if (!open) setActivateAdmin(null); }}
        onSuccess={handleRefetch}
    />
)}
{deactivateAdmin && (
    <DeactivateAdminDialog
        admin={deactivateAdmin.admin}
        clientName={deactivateAdmin.client.name}
        dbName={deactivateAdmin.client.db_name!}
        open={!!deactivateAdmin}
        onOpenChange={(open) => { if (!open) setDeactivateAdmin(null); }}
        onSuccess={handleRefetch}
    />
)}
```

**Sorting/display list:** Keep existing sort logic (name / created_at). Apply search filter across client name, code, and admin name/email.

---

### Step 4 — Client: Remove Admins nav entry from sidebar
**File:** `service-plus-client/src/features/super-admin/components/sidebar.tsx`

Remove the line:
```ts
{ href: ROUTES.superAdmin.admins, icon: ShieldIcon, label: "Admins" },
```

---

### Step 5 — Client: Remove Admins route from router
**File:** `service-plus-client/src/router/index.tsx`

Remove the `admins` route entry:
```tsx
{ element: <AdminsPage />, path: 'admins' },
```
Remove the `AdminsPage` import.

---

### Step 6 — Client: Remove `admins-page.tsx`
**File:** `service-plus-client/src/features/super-admin/pages/admins-page.tsx`

Delete the file — all its functionality now lives in `clients-page.tsx`.

---

### Step 7 — Client: Remove unused `ROUTES.superAdmin.admins` entry
**File:** `service-plus-client/src/router/routes.ts`

Remove `admins: '/super-admin/admins'` from the routes object.

---

## File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `service-plus-server/app/graphql/resolvers/query_helper.py` | Extend `resolve_super_admin_clients_data_helper` to add `admins[]` per client + global admin stat totals |
| 2 | `service-plus-client/src/features/super-admin/types/index.ts` | Add `admins: ClientAdminType[]` to `ClientType` |
| 3 | `service-plus-client/src/features/super-admin/pages/clients-page.tsx` | Full rewrite — accordion layout, admin sub-table, all dialogs merged |
| 4 | `service-plus-client/src/features/super-admin/components/sidebar.tsx` | Remove Admins nav item |
| 5 | `service-plus-client/src/router/index.tsx` | Remove Admins route + import |
| 6 | `service-plus-client/src/features/super-admin/pages/admins-page.tsx` | **Delete** |
| 7 | `service-plus-client/src/router/routes.ts` | Remove `admins` route constant |

## No New Files
All admin dialogs (`activate-admin-dialog`, `deactivate-admin-dialog`, `edit-admin-dialog`) were created in the previous patch and are reused as-is.

No GraphQL schema change — `superAdminClientsData` query signature is unchanged; only the returned payload grows to include `admins[]` per client and three global admin stat fields.
