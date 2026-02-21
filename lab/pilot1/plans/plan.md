# Plan: Dummy Pages for All Sidebar Menu Items

## Reference
- Instructions: `plans/tran.md`
- Existing sidebar: `src/features/super-admin/components/sidebar.tsx`
- Existing router: `src/router/index.tsx`

---

## Workflow

```
Rename Sidebar → SuperAdminSidebar (export rename)
        ↓
Update SuperAdminLayout to use renamed component
        ↓
Create shared DummyPage template component
        ↓
Create 5 dummy pages (Clients, Admins, Usage & Health, Audit Logs, System Settings)
        ↓
Register all 6 routes in the router
        ↓
Verify active state works across all routes
        ↓
Type check & build verify
```

---

## Step 1 — Rename Sidebar export to SuperAdminSidebar

Update `src/features/super-admin/components/sidebar.tsx`:

- Rename the exported component from `Sidebar` to `SuperAdminSidebar`
- Keep the `navItems` config array as-is (already declared at module level — satisfies "menu items stored in a config array")
- Active state is determined via `useLocation().pathname === item.href` — this is React Router state (satisfies "active state handled via React state")
- No logic changes needed, only the export name changes

---

## Step 2 — Update SuperAdminLayout import

Update `src/features/super-admin/components/super-admin-layout.tsx`:

- Change `import { Sidebar }` → `import { SuperAdminSidebar }`
- Change JSX usage `<Sidebar .../>` → `<SuperAdminSidebar .../>`

---

## Step 3 — Create shared DummyPage template

Create `src/features/super-admin/components/dummy-page.tsx`:

- Accepts props: `description`, `icon` (lucide React element type), `title`
- Renders a centered placeholder card with:
  - Large icon (muted color)
  - Page title (heading)
  - Short description text
  - A muted "Coming Soon" badge
- Wrapped in `SuperAdminLayout`
- Framer-motion fade-in + slight upward slide on mount
- Reused by all 5 dummy pages

Props type:
```ts
type DummyPagePropsType = {
  description: string;
  icon: React.ElementType;
  title: string;
};
```

---

## Step 4 — Create 5 dummy pages

Each page is a thin wrapper that renders `<DummyPage>` with its own title, icon, and description. All placed in `src/features/super-admin/pages/`.

| File | Route | Title | Icon |
|------|-------|-------|------|
| `clients-page.tsx` | `/super-admin/clients` | Clients | `UsersIcon` |
| `admins-page.tsx` | `/super-admin/admins` | Admins | `ShieldIcon` |
| `usage-health-page.tsx` | `/super-admin/usage` | Usage & Health | `ActivityIcon` |
| `audit-logs-page.tsx` | `/super-admin/audit` | Audit Logs | `ClipboardListIcon` |
| `system-settings-page.tsx` | `/super-admin/settings` | System Settings | `SettingsIcon` |

Each file exports a single arrow-function component, e.g.:
```tsx
export const ClientsPage = () => (
  <DummyPage
    description="Manage all client accounts, status, and assigned administrators."
    icon={UsersIcon}
    title="Clients"
  />
);
```

---

## Step 5 — Register all routes in the router

Update `src/router/index.tsx` to add 5 new routes alongside the existing `/super-admin` route:

```
/super-admin          → SuperAdminDashboard  (existing)
/super-admin/admins   → AdminsPage
/super-admin/audit    → AuditLogsPage
/super-admin/clients  → ClientsPage
/super-admin/settings → SystemSettingsPage
/super-admin/usage    → UsageHealthPage
```

Routes sorted alphabetically within the super-admin group.

---

## Step 6 — Type check & build verify

- Run `pnpm tsc --noEmit` — zero errors
- Run `pnpm build` — successful build
- Manually verify: clicking each sidebar item highlights it as active and renders the correct page
