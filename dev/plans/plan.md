# Plan: Execute tran.md — Company Profile Load on App Start

## Requirement (from tran.md)
- Load company profile when application loads
- Show company name in same line as breadcrumb on right side
- If gstin is not empty → isGstRegistered = true
- If gstin is empty → isGstRegistered = false
- Set isGstRegistered flag in Redux context

---

## Workflow

```
App loads (ClientLayout mounts)
    │
    ▼
useEffect fires when dbName + schema are available
    │
    ▼
Fetch company_info via genericQuery (SQL: GET_COMPANY_INFO)
    │
    ├─► dispatch setCompanyName(row.company_name)
    └─► dispatch setIsGstRegistered(!!row.gstin)
    │
    ▼
Breadcrumb bar renders:
  [ displayTitle ]               [ CompanyName ]
  (left side)                    (right side)
```

---

## Step 1 — Add `companyName` to context-slice (`src/store/context-slice.ts`)

- Add `companyName: string | null` to `ContextStateType`
- Set initial value to `null`
- Add `setCompanyName` reducer: `state.companyName = action.payload`
- Export `setCompanyName` action
- Add `selectCompanyName` selector: `state.context.companyName`

---

## Step 2 — Fetch company profile on app load (`src/features/client/components/client-layout.tsx`)

- Import `useAppDispatch`, `useAppSelector` from `@/store/hooks`
- Import `selectDbName` from `@/features/auth/store/auth-slice`
- Import `selectSchema`, `setIsGstRegistered`, `setCompanyName`, `selectCompanyName` from `@/store/context-slice`
- Import `apolloClient`, `GRAPHQL_MAP`, `SQL_MAP`, `graphQlUtils`
- Inside `ClientLayout`, add:
  ```ts
  const dispatch    = useAppDispatch();
  const dbName      = useAppSelector(selectDbName);
  const schema      = useAppSelector(selectSchema);
  const companyName = useAppSelector(selectCompanyName);
  ```
- Add a `useEffect` (deps: `[dbName, schema]`) that:
  - Guards: if `!dbName || !schema` return early
  - Calls `apolloClient.query` with `GRAPHQL_MAP.genericQuery`, variables `{ db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_COMPANY_INFO }) }`, `fetchPolicy: 'network-only'`
  - On success, if rows.length > 0:
    - `dispatch(setCompanyName(rows[0].company_name))`
    - `dispatch(setIsGstRegistered(!!rows[0].gstin))`
  - On error: silently ignore (company name stays null)

---

## Step 3 — Show company name in breadcrumb (`client-layout.tsx`)

- Locate the breadcrumb `<div className="mb-3 sm:mb-4">` block in the `<main>` render
- Change it to a `flex justify-between items-center` container:
  ```tsx
  <div className="mb-3 flex items-center justify-between sm:mb-4">
      <p className="text-xs font-semibold text-[var(--cl-accent-text)]">
          {displayTitle}
      </p>
      {companyName && (
          <p className="text-xs font-semibold text-[var(--cl-text-muted)]">
              {companyName}
          </p>
      )}
  </div>
  ```

---

## Files to Change

| File | Change |
|------|--------|
| `src/store/context-slice.ts` | Add `companyName`, `setCompanyName`, `selectCompanyName` |
| `src/features/client/components/client-layout.tsx` | Fetch company profile on load; show companyName in breadcrumb |

No new files required.
