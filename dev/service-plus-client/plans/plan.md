# Plan: Implement tran.md Menu System for Client Mode

## Overview
Replace the current 6-section client mode navigation (Dashboard, Jobs, Customers, Inventory, Reports, Settings)
with the new 6-section menu defined in tran.md (Jobs, Dashboard, Inventory, Reports, Masters, Configurations).
Key changes: remove standalone Customers section (absorbed into Masters > Entities), rename Settings → Configurations,
add new Masters section, and fully rewrite all explorer panel sub-menus.

## Workflow
1. Update route constants → 2. Update Section type + layout path resolver → 3. Update top nav + activity bar →
4. Rewrite explorer panel with all new sub-menus → 5. Add/rename page stubs → 6. Update router config

---

## Step 1 — Update `src/router/routes.ts`
- Remove `customers` key
- Rename `settings` → `configurations`
- Add `masters` key → `/client/masters`

New client routes (sorted):
```ts
client: {
    configurations: '/client/configurations',
    inventory:      '/client/inventory',
    jobs:           '/client/jobs',
    masters:        '/client/masters',
    reports:        '/client/reports',
    root:           '/client',
}
```

---

## Step 2 — Update `client-layout.tsx`
- Change `Section` type:
  ```ts
  export type Section = 'configurations' | 'dashboard' | 'inventory' | 'jobs' | 'masters' | 'reports';
  ```
- Update `sectionFromPath`: replace customers path → masters, settings path → configurations

---

## Step 3 — Update `client-top-nav.tsx`
Replace `NAV_ITEMS` array with new sections in this order (matching tran.md):
Jobs, Dashboard, Inventory, Reports, Masters, Configurations

---

## Step 4 — Update `client-activity-bar.tsx`
Replace `ACTIVITY_ITEMS`:
- Remove Customers (Users icon)
- Replace Settings → Configurations (SlidersHorizontal icon, `/client/configurations`)
- Add Masters (BookOpen icon, `/client/masters`)
- Order: Dashboard, Jobs, Inventory, Reports, Masters, Configurations

---

## Step 5 — Rewrite `client-explorer-panel.tsx`
Full rewrite of all section explorers per tran.md. Sub-sections use collapsible groups.

### DashboardExplorer (Quick Insights)
- Overview
- Job Status
- Revenue
- Technician Performance

### JobsExplorer (Job Lifecycle)
Actions: New Job
Items: Job List / Search, Update Job, Ready for Delivery, Deliver Job, Opening Jobs, Receipts

### InventoryExplorer (Stock + Parts Operations)
Items: Stock Overview, Consumption (Parts Usage), Purchase Entry, Sales Entry, Stock Adjustment,
Stock Transfer, Loan / Issue & Return, Opening Stock, Part Finder

### ReportsExplorer (Read-only Analytics)
Collapsible sub-groups:
- Job Reports: Job Status Report, Job History
- Financial Reports: Revenue Report, Cash Register, Sales Report
- Inventory Reports: Parts Summary, Stock Ledger, Stock Movement
- Performance Reports: Technician Performance, Summary Performance, Detailed Performance

### MastersExplorer — NEW (Configurations / Static Data)
Collapsible sub-groups:
- Organization: Branch, Financial Year, State / Province
- Entities: Customer, Vendor, Technician
- Service Config: Customer Type, Document Type, Job Type, Job Status,
  Job Receive Manner, Job Delivery Manner, Job Receive Condition
- Product & Parts: Brand, Product, Model, Parts, Part Location

### ConfigurationsExplorer (System-level Configuration)
Items: Company Profile, Branch Configuration
Collapsible: Print Templates → Job Slip, Receipt Layouts
Item: Numbering / Auto Series

Update `EXPLORERS` record (remove customers, add masters, rename settings → configurations).
Update `SECTION_LABELS` record similarly.

---

## Step 6 — Add/rename page files in `src/features/client/pages/`
- Create `client-masters-page.tsx` (new stub page using ClientLayout, breadcrumb "Masters")
- Create `client-configurations-page.tsx` (copy of settings page, renamed component + breadcrumb)
- Delete `client-customers-page.tsx`

---

## Step 7 — Update `src/router/index.tsx`
- Remove import of `ClientCustomersPage` and `ClientSettingsPage`
- Add imports: `ClientConfigurationsPage`, `ClientMastersPage`
- Remove `{ path: 'customers' }` child route
- Replace `{ path: 'settings', element: <ClientSettingsPage /> }` with `{ path: 'configurations', element: <ClientConfigurationsPage /> }`
- Add `{ path: 'masters', element: <ClientMastersPage /> }`
