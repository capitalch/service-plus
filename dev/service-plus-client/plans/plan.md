# Plan: Error Handling with errorElement (React Router v7)

## Approach

Use React Router's `errorElement` — the idiomatic choice for this stack (React Router v7 + no class components).
It catches render errors, loader errors, and action errors for any route it's attached to.
A single `errorElement` on the root layout route covers the entire app.

---

## Workflow

```
Step 1: Create ErrorPage component
        Uses useRouteError() to read the thrown error
        Displays error info with shadcn + framer-motion
              ↓
Step 2: Create a root layout route in router/index.tsx
        Wrap existing routes under a parent route
        Attach errorElement={<ErrorPage />} to the parent
              ↓
Step 3: Verify — pnpm tsc --noEmit
```

---

## Step 1 — Create `src/pages/error-page.tsx`

- Use `useRouteError()` from `react-router-dom` to get the thrown error
- Derive a user-friendly message:
  - If error is a `Response` (HTTP error from loader/action): use `error.statusText` or `error.status`
  - If error is an `Error`: use `error.message`
  - Fallback: `MESSAGES.ERROR_UNKNOWN`
- UI structure (shadcn + framer-motion fade-in):
  - Centered full-screen layout
  - Icon (AlertCircle from lucide-react)
  - Heading: "Something went wrong"
  - Subtext: derived error message
  - Button: "Go to Login" — navigates to `/login` using `useNavigate`

## Step 2 — Update `src/router/index.tsx`

Add a root layout route with `errorElement`:

```ts
createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorPage />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { index: true, element: <App /> },
    ],
  },
]);
```

This single `errorElement` catches errors from any child route.

## Step 3 — Verify

```bash
pnpm tsc --noEmit
```
