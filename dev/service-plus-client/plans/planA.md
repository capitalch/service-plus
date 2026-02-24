# Plan: Router & Navigation Code Improvements

## Workflow

```
Step 1 – Add NOT_FOUND and SUCCESS_LOGOUT to messages.ts
         ↓
Step 2 – Create src/router/routes.ts (ROUTES constants)
         ↓
Step 3 – Create src/router/protected-route.tsx (auth + role guard)
         ↓
Step 4 – Create src/pages/not-found-page.tsx (404 page)
         ↓
Step 5 – Refactor src/router/index.tsx (use ProtectedRoute + ROUTES + 404)
         ↓
Step 6 – Refactor src/app.tsx (remove local auth guard, simple redirect)
         ↓
Step 7 – Fix src/store/slices/auth-slice.ts (localStorage key bug on logout)
         ↓
Step 8 – Fix src/features/super-admin/components/top-header.tsx (dispatch logout + navigate to /login)
         ↓
Step 9 – Update src/features/super-admin/components/sidebar.tsx (use ROUTES constants)
         ↓
Step 10 – Verify with pnpm build + manual flow tests
```

---

## Issues to Fix

### Critical
1. **Super-admin routes have NO auth protection** — Any unauthenticated user can navigate directly to `/super-admin/*`. Only `/` is guarded (inside `App.tsx` via `useEffect`).
2. **`logout` reducer has a wrong localStorage key** — `setCredentials` saves token under `accessToken` but `logout` removes `authToken`. Token is never cleared from storage.
3. **Logout does not dispatch `logout()` action** — `top-header.tsx` calls only `navigate("/")`, leaving token and user alive in Redux and `localStorage`.

### Architectural
4. **No `ProtectedRoute` component** — Auth guard lives as `useEffect + useNavigate` inside `App.tsx`. A declarative route wrapper is the standard React Router v6+ pattern.
5. **No role-based route protection** — No mechanism verifies the user has `userType === 'S'` before serving super-admin pages.
6. **No ROUTES constants** — Hardcoded path strings (`/super-admin`, `/super-admin/clients`, etc.) are scattered across `router/index.tsx` and `sidebar.tsx`, creating drift risk.

### UX / Correctness
7. **Logout navigates to `/` not `/login`** — Causes an extra unnecessary redirect hop before landing on login.
8. **No 404 catch-all route** — Unknown URLs fall through to React Router's default error UI.
9. **`App.tsx` renders `<ComponentExample />`** — Placeholder instead of redirecting authenticated users to their correct dashboard.

---

## Steps

### Step 1 — Update `src/constants/messages.ts`
Add two new keys needed by new components:
```ts
NOT_FOUND: 'The page you are looking for does not exist.',
SUCCESS_LOGOUT: 'You have been logged out successfully.',
```

---

### Step 2 — Create `src/router/routes.ts`
Single source of truth for all route paths. Import and use `ROUTES.*` everywhere instead of hardcoded strings.

```ts
export const ROUTES = {
  home: '/',
  login: '/login',
  superAdmin: {
    admins: '/super-admin/admins',
    audit: '/super-admin/audit',
    clients: '/super-admin/clients',
    root: '/super-admin',
    settings: '/super-admin/settings',
    usage: '/super-admin/usage',
  },
} as const;
```

---

### Step 3 — Create `src/router/protected-route.tsx`
Declarative route guard using arrow function component:
- Reads `selectIsAuthenticated` from Redux — if `false`, redirects to `ROUTES.login`, preserving the attempted `location` in `state.from` for post-login redirect.
- If `allowedRoles` prop is provided, reads `selectCurrentUser` and checks `user.userType` against the array. If not matching, redirects to `ROUTES.home`.
- Returns `<Outlet />` when all checks pass.

```tsx
type ProtectedRoutePropsType = {
  allowedRoles?: string[];
};

export const ProtectedRoute = ({ allowedRoles }: ProtectedRoutePropsType) => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();
  const user = useAppSelector(selectCurrentUser);

  if (!isAuthenticated)
    return <Navigate replace state={{ from: location }} to={ROUTES.login} />;

  if (allowedRoles && user && !allowedRoles.includes(user.userType))
    return <Navigate replace to={ROUTES.home} />;

  return <Outlet />;
};
```

---

### Step 4 — Create `src/pages/not-found-page.tsx`
Branded 404 page:
- Framer Motion fade-in animation.
- Large `404` display text, heading, and a description from `MESSAGES.NOT_FOUND`.
- Shadcn `Button` that navigates to `ROUTES.home`.

---

### Step 5 — Refactor `src/router/index.tsx`
Restructure the router to use `ProtectedRoute`, `ROUTES` constants, and add the 404 catch-all:

```
/                       (errorElement: ErrorPage)
  /                     → ProtectedRoute → App
  /login                → LoginPage

/super-admin            (errorElement: ErrorPage)
  /super-admin          → ProtectedRoute (allowedRoles: ['S']) → SuperAdminDashboard
  /super-admin/admins   → ProtectedRoute (allowedRoles: ['S']) → AdminsPage
  /super-admin/audit    → ProtectedRoute (allowedRoles: ['S']) → AuditLogsPage
  /super-admin/clients  → ProtectedRoute (allowedRoles: ['S']) → ClientsPage
  /super-admin/settings → ProtectedRoute (allowedRoles: ['S']) → SystemSettingsPage
  /super-admin/usage    → ProtectedRoute (allowedRoles: ['S']) → UsageHealthPage

*                       → NotFoundPage
```

The `ProtectedRoute` wraps the entire `/super-admin` children block as a layout route.

---

### Step 6 — Refactor `src/app.tsx`
Remove the `useEffect + navigate` auth guard (it is now handled by `ProtectedRoute`). Since this component is only reachable when authenticated, replace the body with a smart redirect:
- If `user.userType === 'S'` → `<Navigate replace to={ROUTES.superAdmin.root} />`
- Otherwise → render the normal home dashboard

---

### Step 7 — Fix `src/store/slices/auth-slice.ts`
The `logout` reducer removes `authToken` but the key stored by `setCredentials` is `accessToken`. Fix:
```ts
// Before (bug):
localStorage.removeItem('authToken');

// After (fix):
localStorage.removeItem('accessToken');
```

---

### Step 8 — Fix `src/features/super-admin/components/top-header.tsx`
Correct the `handleLogout` function:
1. Import `useAppDispatch` and `logout` action from auth-slice.
2. Dispatch `logout()` to clear Redux state and localStorage.
3. Navigate to `ROUTES.login` (not `ROUTES.home`).
4. Show `toast.success(MESSAGES.SUCCESS_LOGOUT)` instead of `toast.info("Logging out...")`.

```ts
const handleLogout = () => {
  dispatch(logout());
  navigate(ROUTES.login);
  toast.success(MESSAGES.SUCCESS_LOGOUT);
};
```

---

### Step 9 — Update `src/features/super-admin/components/sidebar.tsx`
Replace all hardcoded `href` strings in `navItems` with `ROUTES.superAdmin.*` constants:

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

---

### Step 10 — Verify
- Run `pnpm build` — zero TypeScript or import errors.
- Navigate to `/super-admin` while logged out → redirects to `/login`.
- Log in as Super Admin → lands on `/super-admin` dashboard.
- Log in as regular user → lands on `/` (home).
- Logout → clears Redux/localStorage, navigates to `/login`.
- Navigate to `/unknown-path` → shows branded 404 page.
- Refresh on `/super-admin/clients` while logged out → redirects to `/login`.
