# Plan: Navigation Code Review & Improvements

## Issues Found

### Critical
1. **Super-admin routes have NO auth protection** — Any unauthenticated user can navigate directly to `/super-admin/*` in the browser. Only the root `/` path is guarded by `App.tsx`.
2. **Logout does not clear auth state** — `top-header.tsx` calls `navigate("/")` but never dispatches the `logout` action, leaving the token alive in Redux and `localStorage`.

### Architectural
3. **No `ProtectedRoute` component** — Auth guard is done via `useEffect + useNavigate` inside `App.tsx`. This is an anti-pattern; a declarative route wrapper component is the correct approach with React Router v6+.
4. **No role-based route protection** — Super-admin routes only need an `isAuthenticated` check today, but there is no mechanism to verify the user actually has the `super_admin` role.
5. **Hardcoded route strings everywhere** — Paths like `/super-admin`, `/super-admin/clients` etc. are duplicated in `router/index.tsx` and `sidebar.tsx`. A single `ROUTES` constants file eliminates drift.

### UX / Correctness
6. **Logout navigates to `/` not `/login`** — After logout the user lands on the protected root, which then redirects to `/login`, adding an unnecessary redirect hop.
7. **No 404 catch-all route** — Unknown URLs fall through to React Router's default error, not a branded not-found page.
8. **`App.tsx` renders `<ComponentExample />`** — The protected root component renders a placeholder. It should redirect authenticated users to their landing page (e.g. `/super-admin`).

---

## Workflow

```
Step 1 – Create ROUTES constants file
         ↓
Step 2 – Create ProtectedRoute component (auth + role guard)
         ↓
Step 3 – Refactor router to use ProtectedRoute & ROUTES constants
         ↓
Step 4 – Add 404 catch-all route
         ↓
Step 5 – Fix App.tsx root redirect
         ↓
Step 6 – Fix logout action in top-header.tsx
         ↓
Step 7 – Update sidebar to use ROUTES constants
         ↓
Step 8 – Verify build & manual test
```

---

## Steps

### Step 1 — Create `src/router/routes.ts` (ROUTES constants)

Create a single source-of-truth for all route paths:

```ts
export const ROUTES = {
  home: '/',
  login: '/login',
  superAdmin: {
    root: '/super-admin',
    admins: '/super-admin/admins',
    audit: '/super-admin/audit',
    clients: '/super-admin/clients',
    settings: '/super-admin/settings',
    usage: '/super-admin/usage',
  },
} as const;
```

### Step 2 — Create `src/router/protected-route.tsx`

Create a declarative wrapper that:
- Checks `selectIsAuthenticated` from the auth slice
- Optionally checks `selectCurrentUser` role against a required role
- Renders `<Outlet />` if allowed, otherwise `<Navigate>` to login (preserving `location.state` for post-login redirect)

```tsx
type ProtectedRoutePropsType = {
  allowedRoles?: string[];
};

export const ProtectedRoute = ({ allowedRoles }: ProtectedRoutePropsType) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={ROUTES.login} />;
  }
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={ROUTES.home} />;
  }
  return <Outlet />;
};
```

### Step 3 — Refactor `src/router/index.tsx`

- Import `ROUTES` and `ProtectedRoute`
- Wrap super-admin children under `ProtectedRoute` with `allowedRoles={['super_admin']}`
- Replace all hardcoded path strings with `ROUTES.*` constants
- Keep existing `errorElement` boundaries

Updated structure:
```
/                   (errorElement)
  /                 → ProtectedRoute → App (home redirect)
  /login            → LoginPage

/super-admin        (errorElement)
  /                 → ProtectedRoute (role: super_admin) → SuperAdminDashboard
  /clients          → ProtectedRoute (role: super_admin) → ClientsPage
  /admins           → ...
  /usage            → ...
  /audit            → ...
  /settings         → ...

*                   → NotFoundPage (catch-all)
```

### Step 4 — Create `src/pages/not-found-page.tsx`

A branded 404 page with:
- "Page not found" message from `messages.ts`
- Button linking back to `ROUTES.home`
- Framer Motion fade-in animation

### Step 5 — Fix `src/app.tsx` root redirect

Replace the `useEffect + navigate` pattern with a simple redirect:
- If authenticated → `<Navigate replace to={ROUTES.superAdmin.root} />`
- The `ProtectedRoute` wrapper already handles unauthenticated redirect to login, so `App.tsx` only needs to decide where an authenticated user lands.

### Step 6 — Fix logout in `src/features/super-admin/components/top-header.tsx`

In `handleLogout`:
1. Dispatch `logout()` action from `auth-slice` (clears Redux + localStorage)
2. Navigate to `ROUTES.login` (not `ROUTES.home`)

```ts
const handleLogout = () => {
  dispatch(logout());
  navigate(ROUTES.login);
};
```

### Step 7 — Update `src/features/super-admin/components/sidebar.tsx`

Replace hardcoded href strings in `navItems` with `ROUTES.superAdmin.*` constants:

```ts
const navItems: NavItemType[] = [
  { href: ROUTES.superAdmin.root,     icon: LayoutDashboardIcon, label: 'Dashboard' },
  { href: ROUTES.superAdmin.admins,   icon: ShieldIcon,          label: 'Admins' },
  { href: ROUTES.superAdmin.audit,    icon: ClipboardListIcon,   label: 'Audit Logs' },
  { href: ROUTES.superAdmin.clients,  icon: UsersIcon,           label: 'Clients' },
  { href: ROUTES.superAdmin.settings, icon: SettingsIcon,        label: 'System Settings' },
  { href: ROUTES.superAdmin.usage,    icon: ActivityIcon,        label: 'Usage & Health' },
];
```

### Step 8 — Verify

- Run `pnpm build` — zero TypeScript/import errors
- Navigate to `/super-admin` while logged out → should redirect to `/login`
- Log in → should land on `/super-admin` dashboard
- Logout → should clear token and land on `/login`
- Navigate to `/unknown-path` → should show 404 page
