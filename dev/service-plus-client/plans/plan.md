# Plan: Execute tran.md Instructions

## Workflow

```
Validate Naming Conventions
         ↓
Document Integration Strategy
         ↓
Move super-admin-v2 UI files → super-admin folder
         ↓
Update internal path references (sidebar hrefs)
         ↓
Update router (imports + route paths)
         ↓
Update login page button path
         ↓
Delete super-admin-v2 folder
```

---

## Naming Convention Validation (super-admin-v2)

| Convention | Rule | Status |
|---|---|---|
| Folder name | kebab-case | ✓ (`super-admin-v2` → will become `super-admin`) |
| File names | kebab-case | ✓ (`super-admin-dashboard.tsx`, `clients-page.tsx`, etc.) |
| Component exports | Arrow functions, PascalCase | ✓ |
| Type names | Appended with `Type` | ✓ (`ClientType`, `AdminUserType`, `StatsType`, etc.) |
| Props types | Appended with `Type` | ✓ (`SidebarPropsType`, `TopHeaderPropsType`, etc.) |
| Redux slice | Named export, `*Reducer` convention | ✓ (`superAdminReducer`) |
| Selectors | `select*` prefix | ✓ (`selectClients`, `selectStats`, etc.) |
| Sorted properties | Arrays/objects sorted | ✓ |
| shadcn components | Used throughout | ✓ |
| framer-motion | Used for transitions | ✓ |
| Sonner notifications | Used for toasts | ✓ |

**Result:** The `super-admin-v2` code follows project conventions well. No convention violations found.

---

## Integration Strategy

The `super-admin` feature is structured as a single self-contained feature module:

```
src/features/super-admin/
  ├── components/           ← UI components (from super-admin-v2)
  │     ├── client-overview-table.tsx
  │     ├── sidebar.tsx
  │     ├── stats-cards.tsx
  │     ├── super-admin-layout.tsx
  │     └── top-header.tsx
  ├── pages/                ← Route-level pages (from super-admin-v2)
  │     ├── admins-page.tsx
  │     ├── audit-logs-page.tsx
  │     ├── clients-page.tsx
  │     ├── system-settings-page.tsx
  │     └── usage-health-page.tsx
  ├── dummy-data.ts         ← Already exists
  ├── super-admin-dashboard.tsx  ← Entry point (from super-admin-v2)
  ├── super-admin-slice.ts  ← Already exists
  └── types.ts              ← Already exists
```

The router registers `/super-admin` as a top-level route with nested child routes. The store already has `superAdminReducer` registered. The login page will keep a direct test link pointing to `/super-admin`.

---

## Steps

### Step 1 — Move UI files from `super-admin-v2` into `super-admin`

Move the following files (git mv to preserve history):
- `src/features/super-admin-v2/super-admin-dashboard.tsx` → `src/features/super-admin/super-admin-dashboard.tsx`
- `src/features/super-admin-v2/components/client-overview-table.tsx` → `src/features/super-admin/components/client-overview-table.tsx`
- `src/features/super-admin-v2/components/sidebar.tsx` → `src/features/super-admin/components/sidebar.tsx`
- `src/features/super-admin-v2/components/stats-cards.tsx` → `src/features/super-admin/components/stats-cards.tsx`
- `src/features/super-admin-v2/components/super-admin-layout.tsx` → `src/features/super-admin/components/super-admin-layout.tsx`
- `src/features/super-admin-v2/components/top-header.tsx` → `src/features/super-admin/components/top-header.tsx`
- `src/features/super-admin-v2/pages/admins-page.tsx` → `src/features/super-admin/pages/admins-page.tsx`
- `src/features/super-admin-v2/pages/audit-logs-page.tsx` → `src/features/super-admin/pages/audit-logs-page.tsx`
- `src/features/super-admin-v2/pages/clients-page.tsx` → `src/features/super-admin/pages/clients-page.tsx`
- `src/features/super-admin-v2/pages/system-settings-page.tsx` → `src/features/super-admin/pages/system-settings-page.tsx`
- `src/features/super-admin-v2/pages/usage-health-page.tsx` → `src/features/super-admin/pages/usage-health-page.tsx`

### Step 2 — Update internal route hrefs in `sidebar.tsx`

In `src/features/super-admin/components/sidebar.tsx`, update `navItems` hrefs:
- `/super-admin-v2` → `/super-admin`
- `/super-admin-v2/clients` → `/super-admin/clients`
- `/super-admin-v2/admins` → `/super-admin/admins`
- `/super-admin-v2/usage` → `/super-admin/usage`
- `/super-admin-v2/audit` → `/super-admin/audit`
- `/super-admin-v2/settings` → `/super-admin/settings`

### Step 3 — Update `src/router/index.tsx`

- Update all imports from `@/features/super-admin-v2/...` → `@/features/super-admin/...`
- Rename the router path `/super-admin-v2` → `/super-admin`
- Update the JSDoc comment to reflect the new path

### Step 4 — Update `src/pages/login-page.tsx`

- Update the `navigate('/super-admin-v2')` call → `navigate('/super-admin')`

### Step 5 — Delete `super-admin-v2` folder

Remove `src/features/super-admin-v2/` entirely (all files moved in Step 1).

### Step 6 — Verify

- Run `pnpm build` or `pnpm dev` to confirm no broken imports
- Verify that navigating to `/super-admin` loads the dashboard
- Verify the login page test button routes correctly
