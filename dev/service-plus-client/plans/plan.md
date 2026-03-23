# Plan: Client Mode UI — Business User & Admin User

## Context
Replace the current placeholder `client-dashboard-page.tsx` with a full VSCode-style console UI
matching `src/features/temp/client-mode-ui.html`. Serves both:
- **Admin users (type A in client mode)** — full access, can switch back to Admin Mode
- **Business users (type B)** — access filtered by `user.accessRights[]`

---

## Complete Menu System

### Top Navigation (fixed h-12 header, horizontal tabs)
| Tab | Material Icon | Route |
|-----|--------------|-------|
| Dashboard | `dashboard` | `/client` |
| Jobs | `build` | `/client/jobs` |
| Customers | `group` | `/client/customers` |
| Inventory | `inventory_2` | `/client/inventory` |
| Reports | `analytics` | `/client/reports` |
| Settings | `settings` | `/client/settings` |

### Activity Bar (fixed w-16 left strip, icon-only)
- Mirrors the 6 top-nav tabs with icon buttons
- Active tab: left border `border-[#007acc]` + filled icon + `bg-[#131313]`
- Bottom section: account icon, help icon
- Admin-only: "Switch to Admin Mode" button (dispatches `setSessionMode('admin')`)

### Explorer Panel (fixed w-64 secondary sidebar, context-sensitive)

**Dashboard:**
- Active Jobs tree (recent 5 jobs, each links to `/client/jobs/:id`)
- Recent Customers tree (recent 3 customers)
- Quick Actions: New Job, New Customer, Create Invoice

**Jobs:**
- New Job (action button)
- Job Queue subtree: Open, In Progress, Awaiting Parts, Ready for Pickup, Critical
- Closed Today (count badge)

**Customers:**
- New Customer (action button)
- Customer Types (submenu)
- Search Customers

**Inventory:**
- Parts Master
- Brands
- Suppliers
- Purchase Invoices
- Sales Invoices
- Stock Transactions
- Stock Adjustments

**Reports:**
- Job Status Report
- Cash Register
- Performance Report
- Sales Report
- Operational Report

**Settings:**
- Company Info
- Branch Setup
- Technicians
- Products & Models
- Document Sequences
- Job Receive Conditions

### Status Bar (fixed h-6 bottom, bg `#007acc`)
- Left: green dot + "Connected", branch name
- Center: "ServicePlus v2.1.0"
- Right: last sync time, UTF-8, current date

---

## Role Differences
| Feature | Admin (A in client mode) | Business User (B) |
|---------|--------------------------|-------------------|
| Layout | Same VSCode shell | Same VSCode shell |
| Menu tabs | All 6 visible | All 6 visible |
| Explorer items | All visible | Filtered by `accessRights[]` |
| Switch to Admin Mode | Shown (activity bar bottom) | Hidden |

---

## Files to Create

### `src/features/client/components/`
1. **`client-layout.tsx`** — Shell: composes top-nav + activity-bar + explorer-panel + `<main>` + status-bar. Tracks `activeSection` from current route via `useLocation()`.
2. **`client-top-nav.tsx`** — Fixed h-12 header: logo, tab nav links, search input, notifications bell with badge, user name + role chip.
3. **`client-activity-bar.tsx`** — Fixed w-16 strip: 6 icon buttons (NavLink), account/help at bottom, admin-only switch button.
4. **`client-explorer-panel.tsx`** — Fixed w-64 sidebar: renders tree content per `activeSection` prop.
5. **`client-status-bar.tsx`** — Fixed h-6 bottom bar.

### `src/features/client/pages/` (placeholder pages, all wrapped in `ClientLayout`)
6. **`client-jobs-page.tsx`**
7. **`client-customers-page.tsx`**
8. **`client-inventory-page.tsx`**
9. **`client-reports-page.tsx`**
10. **`client-settings-page.tsx`**

---

## Files to Modify

### `src/features/client/pages/client-dashboard-page.tsx`
Replace placeholder with real dashboard:
- 4 stats cards: Active Jobs, Pending Pickup, Revenue Today, Total Customers
- Recent Repair Queue table: Job ID, Device & Issue, Customer, Status, Technician, Due Date
- Wrap everything in `<ClientLayout>`

### `src/router/routes.ts`
Add client routes:
```ts
client: {
    root:      '/client',
    jobs:      '/client/jobs',
    customers: '/client/customers',
    inventory: '/client/inventory',
    reports:   '/client/reports',
    settings:  '/client/settings',
}
```

### `src/app.tsx`
Add `<ProtectedRoute requiredSessionMode="client">` wrappers for all `/client/*` paths.

### `tailwind.config.ts`
Extend with Material Design dark palette from `client-mode-ui.html` (lines 17–64):
`surface`, `primary`, `primary-container`, `surface-container`, `surface-container-high`, `on-surface`, `on-surface-variant`, `outline`, `outline-variant`, etc.

---

## Active Section State
- `ClientLayout` derives `activeSection` from `useLocation()` pathname
- Passed as props to `ClientTopNav`, `ClientActivityBar`, `ClientExplorerPanel`
- No extra state management needed (route is the source of truth)

---

## Verification
1. Login as type A → switch to client mode → VSCode-style layout renders with dark theme
2. Login as type B → same layout, no "Switch to Admin Mode" button visible
3. Click each top-nav tab → explorer panel updates to correct contextual content
4. Navigate to `/client/jobs`, `/client/customers`, etc. → correct page loads
5. Status bar shows connection indicator + current date
6. Activity bar icon highlights match the active route
