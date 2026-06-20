# Plan: Admin → Post / Unpost

## Overview

Add a new **Admin** top-level menu item to the client nav containing a **Post / Unpost** submenu.  
The feature lets users view all 4 transaction types (Money Receipts, Purchase Invoices, Sales Invoices, Job Invoices), see their posted status as an editable checkbox, and batch-save changes.

Key differences from the existing `accounts-posting-section`:
- Shows **all** records (posted + unposted) — no outer Posting/Posted tab split
- Shows **division name** and **GST / NON-GST** type per row
- Shows a **count summary** (posted / unposted / total) per tab
- Changes are **batched**: user toggles multiple rows then presses **Save**

---

## 1. Routes & Navigation

### 1a. `src/router/routes.ts`
Add `admin: '/client/admin'` to `ROUTES.client`.

### 1b. `src/features/client/components/client-layout.tsx`
- Add `'admin'` to the `Section` union type.
- Add `sectionFromPath` branch: `if (pathname.startsWith('/client/admin')) return 'admin'`
- Add entries for `'admin'` in `SECTION_LABELS`, `SECTION_DEFAULTS` (`'Post / Unpost'`), `SECTION_DEFAULT_GROUPS` (`''`).

### 1c. `src/features/client/components/client-top-nav.tsx`
Add to `NAV_ITEMS`:
```ts
{ label: 'Admin', section: 'admin', to: ROUTES.client.admin }
```

### 1d. `src/features/client/components/client-explorer-panel.tsx`
Add `AdminExplorer` component (mirrors existing explorers):
```tsx
function AdminExplorer() {
  return (
    <section>
      <TreeItem icon={BookCheck} label="Post / Unpost" />
    </section>
  )
}
```
Register it in the `EXPLORERS` map under `'admin'`.

### 1e. `src/router/index.tsx`
Add route: `<Route path="/client/admin" element={<AdminSection />} />`  
(protected, inside the `ClientLayout` wrapper like other client routes).

---

## 2. Server — SQL (sql_store.py)

Four sets of new SQL constants, one set per transaction type.  
All queries omit the `is_posted` filter (return all records) and add `division_name` + `gst_type`.

### Pattern for each type

**Stats query** (returns one row: posted / unposted / total counts):
```sql
SELECT
    COUNT(*) FILTER (WHERE <table>.is_posted = true)  AS posted,
    COUNT(*) FILTER (WHERE <table>.is_posted = false) AS unposted,
    COUNT(*)                                           AS total
FROM ...
WHERE branch_id = %(branch_id)s
  AND search filter
```

**Count query** (total rows matching search, for pagination):
```sql
SELECT COUNT(*) AS total FROM ... WHERE branch_id = ... AND search ...
```

**Paged query** (columns: id, date fields, key names, division_name, gst_type, is_posted):
```sql
SELECT
    ...,
    d.name AS division_name,
    CASE WHEN d.gstin IS NOT NULL AND d.gstin <> '' THEN 'GST' ELSE 'NON-GST' END AS gst_type,
    <table>.is_posted
FROM ...
JOIN division d ON d.id = <fk_to_division>
WHERE branch_id = ... AND search ...
ORDER BY date DESC, id DESC
LIMIT ... OFFSET ...
```

### New SQL constant names

| Type | Stats | Count | Paged |
|---|---|---|---|
| Money Receipts (`job_payment`) | `GET_JOB_PAYMENTS_POST_UNPOST_STATS` | `GET_JOB_PAYMENTS_POST_UNPOST_COUNT` | `GET_JOB_PAYMENTS_POST_UNPOST_PAGED` |
| Purchase Invoice | `GET_PURCHASE_INVOICES_POST_UNPOST_STATS` | `GET_PURCHASE_INVOICES_POST_UNPOST_COUNT` | `GET_PURCHASE_INVOICES_POST_UNPOST_PAGED` |
| Sales Invoice | `GET_SALES_INVOICES_POST_UNPOST_STATS` | `GET_SALES_INVOICES_POST_UNPOST_COUNT` | `GET_SALES_INVOICES_POST_UNPOST_PAGED` |
| Job Invoice | `GET_JOB_INVOICES_POST_UNPOST_STATS` | `GET_JOB_INVOICES_POST_UNPOST_COUNT` | `GET_JOB_INVOICES_POST_UNPOST_PAGED` |

### Division join path per type
- **`job_payment`**: `job_payment → job (job_id) → division (division_id)`
- **`purchase_invoice`**: `purchase_invoice.division_id → division`
- **`sales_invoice`**: `sales_invoice.division_id → division` (already joined in existing queries)
- **`job_invoice`**: `job_invoice → job (job_id) → division (division_id)`

### SQL_MAP client constants (`src/constants/sql-map.ts`)
Add the 12 new SQL IDs (mirroring the existing pattern).

---

## 3. Server — GraphQL / Mutation (no changes)

Toggling `is_posted` uses the existing `genericUpdate` mutation (already used by the accounts-posting grids). No new server mutations needed.

---

## 4. Client — New Components

### Directory: `src/features/client/components/admin/`

#### 4a. `admin-section.tsx`
Top-level page component rendered by the `/client/admin` route.  
Reads `selected` from `ClientSelectionContext` and renders the appropriate sub-panel.  
Initially only renders `<PostUnpostSection />` when selected label is `'Post / Unpost'`.

#### 4b. `post-unpost/post-unpost-section.tsx`
Main container. Holds:
- Inner tab state: `'receipts' | 'purchase' | 'sales' | 'job'`
- Per-tab pending-changes map: `Map<number, boolean>` (id → new `is_posted`)
- Per-tab stats: `{ posted: number; unposted: number; total: number } | null`
- **Save** button: iterates the pending-changes map, fires one `genericUpdate` per changed row, clears the map on success, refreshes stats and grid
- Tab bar with count badges (total record count)
- Renders one grid component per tab (all mounted, hidden via CSS when inactive — same pattern as existing `accounts-posting-section`)

#### 4c. `post-unpost/money-receipts-post-unpost-grid.tsx`
Columns: `#`, Receipt No, Date, Customer, Mode, Amount, Division, GST Type, Is Posted (checkbox)

#### 4d. `post-unpost/purchase-invoices-post-unpost-grid.tsx`
Columns: `#`, Invoice No, Date, Supplier, Amount, Division, GST Type, Is Posted (checkbox)

#### 4e. `post-unpost/sales-invoices-post-unpost-grid.tsx`
Columns: `#`, Invoice No, Date, Customer, Amount, Division, GST Type, Is Posted (checkbox)

#### 4f. `post-unpost/job-invoices-post-unpost-grid.tsx`
Columns: `#`, Invoice No, Job No, Date, Customer, Amount, Division, GST Type, Is Posted (checkbox)

#### 4g. `post-unpost/post-unpost-schema.ts`
TypeScript row types for all 4 grids (with `division_name: string` and `gst_type: 'GST' | 'NON-GST'`).

### Grid props interface (common pattern)
```ts
type GridProps = {
    branchId:        number;
    pendingChanges:  Map<number, boolean>;
    onChangeToggle:  (id: number, currentDbValue: boolean) => void;
    onStatsLoaded:   (stats: { posted: number; unposted: number; total: number }) => void;
    onRowsLoaded:    (ids: number[]) => void;
    refreshTrigger:  number;   // increment to force reload after Save
}
```

### Stats bar (inside post-unpost-section.tsx)
Rendered above the tab bar for the active tab:
```
Posted: 42   Unposted: 8   Total: 50
```
Values come from the stats query, refreshed on load and after every Save.

### Save button behaviour
1. Collect all `(id, is_posted)` pairs from `pendingChanges` for the active tab
2. `Promise.all` of `genericUpdate` mutations with `{ tableName, xData: { id, is_posted } }`
3. Table names: `job_payment`, `purchase_invoice`, `sales_invoice`, `job_invoice`
4. On success: clear pending map, increment `refreshTrigger`, show toast
5. Disabled when pending map is empty or saving is in progress

---

## 5. Files to Create / Modify

### New files
```
src/features/client/components/admin/admin-section.tsx
src/features/client/components/admin/post-unpost/post-unpost-section.tsx
src/features/client/components/admin/post-unpost/post-unpost-schema.ts
src/features/client/components/admin/post-unpost/money-receipts-post-unpost-grid.tsx
src/features/client/components/admin/post-unpost/purchase-invoices-post-unpost-grid.tsx
src/features/client/components/admin/post-unpost/sales-invoices-post-unpost-grid.tsx
src/features/client/components/admin/post-unpost/job-invoices-post-unpost-grid.tsx
```

### Modified files (client)
```
src/router/routes.ts                                          (+1 route constant)
src/router/index.tsx                                          (+1 protected route)
src/features/client/components/client-layout.tsx              (+admin section metadata)
src/features/client/components/client-top-nav.tsx             (+Admin nav item)
src/features/client/components/client-explorer-panel.tsx      (+AdminExplorer)
src/constants/sql-map.ts                                      (+12 SQL IDs)
```

### Modified files (server)
```
app/db/sql_store.py    (+12 SQL constants across the 4 transaction types)
```

---

## 6. Implementation Order

1. SQL constants in `sql_store.py` (server) — test each query independently
2. `sql-map.ts` — add the 12 client-side SQL ID constants
3. Routes + nav (routes.ts, router/index.tsx, client-layout.tsx, client-top-nav.tsx, client-explorer-panel.tsx)
4. `post-unpost-schema.ts` — TypeScript types
5. Four grid components
6. `post-unpost-section.tsx` — tabs, stats bar, Save button
7. `admin-section.tsx` — top-level page wrapper
