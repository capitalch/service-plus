# Wire up the notification bell (client top nav + super-admin header)

## Context

Both bell icons in the app are dead UI:

- `src/features/client/components/client-top-nav.tsx:115-120` — a plain `<div>` (not even a button) with a hardcoded badge "3" and no click handler.
- `src/features/super-admin/components/top-header.tsx:73-80` — a `<Button>` with a `hasNotification` boolean hardcoded to `true` via `useState`, no click handler, no dropdown.

There is **no notification domain concept anywhere** in the codebase — no DB table, no GraphQL type/resolver, no client store (confirmed via full-text search of client `src/` and server `app/`). Building a real backend-backed notification inbox (persisted, per-user, mark-as-read) would be a large new subsystem.

Instead, per user decision, the bell becomes an **aggregator of signals the app already computes** — existing cheap queries/fields get pulled into a dropdown, each item deep-linking to the page that has the full detail. No new backend work is required; this is a client-only change that composes existing GraphQL queries.

## What each bell will show

**Client top nav** (`client-top-nav.tsx`) — reuses:
1. **Jobs overdue** — `kpis.jobs_overdue` from `SQL_MAP.GET_DASHBOARD_KPIS` (already used in `dashboard-section.tsx:58-61`). This field is independent of the `from`/`to` args (SQL filters on `CURRENT_DATE - INTERVAL '7 days'`, see `sql_store.py:5181-5207`), so any dummy date range works — call with today's date like `dashboard-section.tsx`'s `todayArgs`.
2. **Unposted documents** — sum of `money_receipts + purchase_invoices + sales_invoices + job_invoices` across divisions from `SQL_MAP.GET_UNPOSTED_COUNTS_BY_DIVISION` (already used in `accounts-posting-section.tsx:73-94`, needs `branch_id` arg from `selectCurrentBranch`).
3. **Low-stock parts** — no existing count query is wired to the client today. Call `SQL_MAP.PART_FINDER_PAGED` with `{ stock_status: "low_stock", limit: 1 }` and read the `total` column (a `COUNT(*) OVER()` window value already returned by that query, per Part Finder's paging pattern) — no backend change needed. (Do not use the currently-unused `PART_FINDER_COUNT` id unless it's confirmed to accept a `stock_status` filter server-side; `PART_FINDER_PAGED limit:1` is the safe, already-proven path.)

Each item links to: Reports → Dashboard (overdue jobs), Admin → Post/Unpost (unposted docs), Inventory → Part Finder filtered to low stock.

**Super-admin top header** (`top-header.tsx`) — reuses:
1. **Failed logins** — `auditLogStats.outcomeCounts.failure` via `GRAPHQL_MAP.auditLogStats` (already used in `audit-logs-page.tsx:219-224`, needs `from_date`/`to_date` — pass today's date for "today's failed logins").
2. **Orphan databases** — `superAdminClientsData.orphanDatabaseCount` via `GRAPHQL_MAP.superAdminClientsData` (already fetched via `useQuery` in `clients-page.tsx:151-156`, field defined at `clients-page.tsx:82`).

Each item links to: Audit Logs page (failed logins), Clients page → Orphan DBs dialog (orphan databases).

## Implementation

### 1. Shared dropdown UI component
Add `src/components/shared/notifications/notification-bell.tsx` (new folder, following the existing `src/components/shared/help/` convention) exporting a generic `NotificationBell` that takes a list of `{ id, icon, label, count, href/onClick }` items and renders:
- The bell button with a badge showing the total count (hidden/no dot when 0).
- A click-toggled popover/dropdown panel (reuse existing dropdown primitives from `src/components/ui/dropdown-menu.tsx`, already used in `top-header.tsx`) listing each non-zero item, each row navigating via `react-router-dom`'s `useNavigate` (client app) or plain internal nav (super-admin) when clicked.
- Empty state "Nothing needs your attention" when all counts are 0.

Keep it presentational — it takes already-fetched counts as props; no data fetching inside.

### 2. Client-side data hook
Add `src/features/client/components/use-notifications-summary.ts` (or colocate in `client-layout.tsx`) that calls the three signals above using the existing `useGenericQuery` hook (`src/features/client/components/reports/_common/use-generic-query.ts`) pattern — three parallel `useGenericQuery` calls, combined into one summary object `{ jobsOverdue, unpostedDocs, lowStockParts }`. Wire it into `ClientTopNav` (`client-top-nav.tsx`), replacing the current static `<div>` (lines 115-120) with `<NotificationBell items={...} />`.

Note: `useGenericQuery`'s `GET_UNPOSTED_COUNTS_BY_DIVISION` call needs `selectCurrentBranch` — check it's already imported where needed (it's used in `accounts-posting-section.tsx`); import similarly in the new hook.

### 3. Super-admin data wiring
In `top-header.tsx`, replace the `hasNotification` boolean (line 45) and static `BellIcon` block (lines 73-80) with two `useQuery` calls (Apollo, matching `clients-page.tsx`'s pattern) for `GRAPHQL_MAP.auditLogStats` (today's date range) and `GRAPHQL_MAP.superAdminClientsData` (likely already fetched a level up in `super-admin-layout.tsx` or `clients-page.tsx` — check for lifting this query to a shared context/parent so `TopHeader` doesn't duplicate the fetch if `clientStats` is already available on the current page; if not already accessible, add a direct `useQuery` in `TopHeader` since Apollo's cache will dedupe identical queries anyway). Pass combined items into the shared `NotificationBell`.

### 4. Navigation on click
Use existing `ROUTES` constants (`@/router/routes`) for target paths — same pattern `client-top-nav.tsx` already uses for `NavLink to={...}`. For super-admin, check `src/router/routes.ts` for the audit-logs and clients page paths.

## Verification
- Run the client dev server, log in as a client user: confirm the bell shows a badge count matching the dashboard's "Jobs Overdue" KPI and Post/Unpost's unposted totals, and that low-stock count matches Part Finder's low-stock filtered result count.
- Log in as super admin: confirm the bell badge matches `auditLogStats.outcomeCounts.failure` for today and `superAdminClientsData.orphanDatabaseCount` shown on the Clients page.
- Test the zero-signal case (no overdue jobs, no unposted docs, no low stock) shows the empty state, not a 0 badge.
- Click each dropdown row and confirm it navigates to the correct page.
