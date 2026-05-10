# Plan: Job Board — Visual Update Job Landing Page

## Goal

Add a new "Job Board" menu item under the Jobs section (alongside the existing "Update Job"). It is self-contained so it can be deleted in its entirety without touching any existing functionality.

---

## Overview of User Flow

1. User clicks **"Job Board"** in the explorer panel.
2. **Landing page** renders: one vertical bar per job status, height proportional to the number of jobs in that status, count shown inside/above the bar, status name below.
3. User clicks a bar → **Status Detail view** slides in.
4. Detail view shows: header with back button + status name + refresh icon, a search bar (debounced, searches job no / customer name / device details), a paginated table of jobs, and a per-row action dropdown.
5. Action dropdown triggers the existing `StatusTransitionModal` to perform a job status transition.
6. After a successful transition, data reloads; user can go back to the landing page via the back button.

---

## New Files to Create

```
src/features/client/components/jobs/job-board/
  job-board-section.tsx        ← root component; owns view state (landing vs detail)
  job-board-landing.tsx        ← bar chart view
  job-board-status-detail.tsx  ← filtered table view for one status
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/constants/sql-map.ts` | Add 3 new SQL ID constants |
| `src/features/client/components/client-explorer-panel.tsx` | Add `<TreeItem label="Job Board" />` to `JobsExplorer` |
| `src/features/client/pages/client-jobs-page.tsx` | Add `case "Job Board"` → `<JobBoardSection />` |
| `src/features/client/types/job.ts` | Add `JobBoardStatusCount` type |
| `service-plus-server/app/db/sql_store.py` | Add 3 new SQL queries |

---

## Step 1 — Server: Add SQL Queries (`sql_store.py`)

Add these three queries inside the `SQL` class in `app/db/sql_store.py`.

### 1a. `GET_JOB_BOARD_STATUS_COUNTS`

Returns per-status job count with status metadata (name + code) so the client can render the bar chart without a separate lookup.

```sql
GET_JOB_BOARD_STATUS_COUNTS = """
    with "p_branch_id" as (values(%(branch_id)s::bigint))
    SELECT
        js.id   AS status_id,
        js.name AS status_name,
        js.code AS status_code,
        COUNT(j.id) AS count
    FROM job_status js
    LEFT JOIN job j
        ON j.job_status_id = js.id
       AND j.branch_id = (table "p_branch_id")
    GROUP BY js.id, js.name, js.code
    ORDER BY js.id
"""
```

### 1b. `GET_JOB_BOARD_COUNT`

Count of jobs for a specific status + optional search term (job no / customer name / device component fields).

```sql
GET_JOB_BOARD_COUNT = """
    with
        "p_branch_id" as (values(%(branch_id)s::bigint)),
        "p_status_id" as (values(%(status_id)s::smallint)),
        "p_search"    as (values(%(search)s::text))
    SELECT COUNT(*) AS total
    FROM job j
    JOIN customer_contact cc ON cc.id = j.customer_contact_id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand   b ON b.id  = pbm.brand_id
    LEFT JOIN product p ON p.id  = pbm.product_id
    WHERE j.branch_id   = (table "p_branch_id")
      AND j.job_status_id = (table "p_status_id")
      AND ((table "p_search") = ''
       OR  j.job_no::text              ILIKE '%%' || (table "p_search") || '%%'
       OR  cc.full_name                ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(b.name, '')        ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(p.name, '')        ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(pbm.model_name,'') ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(j.serial_no, '')   ILIKE '%%' || (table "p_search") || '%%')
"""
```

### 1c. `GET_JOB_BOARD_PAGED`

Full job rows for a specific status + search, with pagination. Returns the same columns as `GET_UPDATE_JOBS_PAGED` so the same `OpenJobRow` type can be reused.

```sql
GET_JOB_BOARD_PAGED = """
    with
        "p_branch_id" as (values(%(branch_id)s::bigint)),
        "p_status_id" as (values(%(status_id)s::smallint)),
        "p_search"    as (values(%(search)s::text)),
        "p_limit"     as (values(%(limit)s::int)),
        "p_offset"    as (values(%(offset)s::int))
    SELECT
        j.id,
        j.job_no,
        j.job_date,
        j.job_status_id,
        j.is_closed,
        j.is_final,
        j.amount,
        j.estimate_amount,
        j.diagnosis,
        j.last_transaction_id,
        j.batch_no,
        cc.full_name   AS customer_name,
        cc.mobile,
        jt.name        AS job_type_name,
        jt.code        AS job_type_code,
        js.name        AS job_status_name,
        js.code        AS job_status_code,
        t.name         AS technician_name,
        TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
        (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id)  AS file_count
    FROM job j
    JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
    JOIN job_type              jt  ON jt.id  = j.job_type_id
    JOIN job_status            js  ON js.id  = j.job_status_id
    LEFT JOIN technician       t   ON t.id   = j.technician_id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand            b   ON b.id   = pbm.brand_id
    LEFT JOIN product          p   ON p.id   = pbm.product_id
    WHERE j.branch_id     = (table "p_branch_id")
      AND j.job_status_id = (table "p_status_id")
      AND ((table "p_search") = ''
       OR  j.job_no::text              ILIKE '%%' || (table "p_search") || '%%'
       OR  cc.full_name                ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(b.name, '')        ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(p.name, '')        ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(pbm.model_name,'') ILIKE '%%' || (table "p_search") || '%%'
       OR  COALESCE(j.serial_no, '')   ILIKE '%%' || (table "p_search") || '%%')
    ORDER BY j.job_date DESC, j.id DESC
    LIMIT  (table "p_limit")
    OFFSET (table "p_offset")
"""
```

---

## Step 2 — Client: Add SQL Map Constants (`sql-map.ts`)

Append to the `SQL_MAP` object (after the existing Update Job entries):

```ts
// Job Board
GET_JOB_BOARD_STATUS_COUNTS: "GET_JOB_BOARD_STATUS_COUNTS",
GET_JOB_BOARD_COUNT:         "GET_JOB_BOARD_COUNT",
GET_JOB_BOARD_PAGED:         "GET_JOB_BOARD_PAGED",
```

---

## Step 3 — Client: Add Type (`types/job.ts`)

Add after the `JobTransactionRow` type:

```ts
export type JobBoardStatusCount = {
    status_id:   number;
    status_name: string;
    status_code: string;
    count:       number;
};
```

The detail table reuses the existing `OpenJobRow` type (imported from `update-job-section.tsx` or promoted to `types/job.ts` — check current import location).

> **Note:** `OpenJobRow` is currently defined locally inside `update-job-section.tsx`. It should either be exported from there or moved to `types/job.ts` so `job-board-status-detail.tsx` can import it. Move it to `types/job.ts` and update the import in `update-job-section.tsx`.

---

## Step 4 — Client: New Components

### 4a. `job-board-section.tsx`

Root component. Holds a `view` state: `"landing"` | `"detail"`.

```
State:
  view: "landing" | "detail"
  selectedStatus: JobBoardStatusCount | null

Renders:
  view === "landing" → <JobBoardLanding onStatusClick={handleStatusClick} />
  view === "detail"  → <JobBoardStatusDetail status={selectedStatus} onBack={() => setView("landing")} />
```

Loads `jobStatuses` (for `StatusTransitionModal` dropdown) and `technicians` here once, passes them down to `JobBoardStatusDetail`.

### 4b. `job-board-landing.tsx`

Props: `onStatusClick: (status: JobBoardStatusCount) => void`

**Data fetching:**
- On mount (and on refresh): fire `GET_JOB_BOARD_STATUS_COUNTS` with `{ branch_id }` via `GRAPHQL_MAP.genericQuery`.
- Store results in `statusCounts: JobBoardStatusCount[]`.

**Bar chart rendering:**
- Derive `maxCount = Math.max(1, ...statusCounts.map(s => s.count))` for normalizing heights.
- Each bar: `heightPct = (count / maxCount) * 100` — render as a `div` with `style={{ height: \`${heightPct}%\` }}` inside a fixed-height column container (e.g., `h-48`).
- Use `STATUS_COLORS[status_code]` (from `status-transitions.ts`) to color each bar — take the first class (background).
- Bar columns are arranged in a horizontal flex row with `items-end`.
- Each column layout (bottom to top):
  ```
  [status label (truncated, rotated or wrapped below)]
  [bar (colored, with count label inside or on top)]
  ```
- Clicking any bar calls `onStatusClick(statusCount)`.
- Bars with `count === 0` are rendered faintly (opacity-30) and are still clickable (for completeness, or can be filtered out — show only statuses with count > 0).
- Show a refresh icon button in the header to re-fetch counts.
- Show a loading spinner while fetching.

**Header layout:**
```
[ Job Board title + total job count ]   [ Refresh icon ]
```

### 4c. `job-board-status-detail.tsx`

Props:
```ts
{
  status:      JobBoardStatusCount;
  technicians: TechnicianRow[];
  onBack:      () => void;
}
```

**State:**
- `searchInput: string` — raw input value
- `searchQ: string` — debounced (300 ms via `useDebounce`) search term passed to queries
- `page: number`
- `rows: OpenJobRow[]`
- `total: number`
- `loading: boolean`
- `pendingTran: { job: OpenJobRow; transition: Transition } | null`
- `submitting: boolean`
- `attachJobId: number | null`, `attachJobNo: string`

**Data fetching (`loadData`):**

Fires `GET_JOB_BOARD_PAGED` and `GET_JOB_BOARD_COUNT` in parallel with:
```ts
{ branch_id: branchId, status_id: status.status_id, search: searchQ, limit: PAGE_SIZE, offset: (page-1)*PAGE_SIZE }
```

Re-fires when `branchId`, `status.status_id`, `searchQ`, or `page` changes.

**Header layout:**
```
[ ← Back ]  [ Status badge: status.status_name ]   [ Refresh icon ]  [ (total count) ]
```

**Search bar:**
- `<input>` bound to `searchInput`, updates `searchQ` after debounce, resets `page` to 1 on search change.
- Placeholder: `"Search by job no, customer, or device…"`

**Table:**
Same columns as `UpdateJobSection`:
`#` | `Date` | `Job No` | `Type` | `Customer` | `Mobile` | `Device` | `Status` | `Amount` | `Actions`

- Action column: `DropdownMenu` with transitions from `getTransitions(row.job_status_id, row.job_type_code)`.
- Read-only statuses (in `NO_ACTION_CODES`) show a `Lock` icon instead.
- On action click → open `StatusTransitionModal`.

**After successful transition:**
- Call `loadData()` to refresh the table.
- The job may no longer appear in this status list (it moved to another status) — that is expected.

**Pagination:**
Same pattern as `UpdateJobSection`: First / Prev / Next / Last buttons + page info text.

**Modals:**
- `StatusTransitionModal` (same props as in `UpdateJobSection`).
- `JobAttachDialog` for file count button clicks.

---

## Step 5 — Client: Add Menu Item (`client-explorer-panel.tsx`)

In `JobsExplorer`, add after the existing `<TreeItem label="Update Job" />` line:

```tsx
<TreeItem icon={BarChart2} label="Job Board" />
```

Import `BarChart2` from `lucide-react`. This puts it in the `Jobs > (no group)` section just below Update Job.

---

## Step 6 — Client: Wire Up Page (`client-jobs-page.tsx`)

In `JobsContent`'s switch statement, add:

```tsx
case "Job Board":
    return <JobBoardSection />;
```

Import `JobBoardSection` from `../components/jobs/job-board/job-board-section`.

---

## Reused Existing Code (no changes needed)

| What | Where |
|------|-------|
| `StatusTransitionModal` | `update-job/status-transition-modal.tsx` |
| `getTransitions`, `STATUS_COLORS`, `STATUS_FLAGS`, `NO_ACTION_CODES` | `update-job/status-transitions.ts` |
| `JobAttachDialog` | `single-job/job-attach-dialog.tsx` |
| `GRAPHQL_MAP.genericQuery` / `GRAPHQL_MAP.updateJob` | `constants/graphql-map.ts` |
| `graphQlUtils.buildGenericQueryValue`, `encodeObj` | `lib/graphql-utils.ts` |
| `useDebounce` | `hooks/use-debounce.ts` |
| `TechnicianRow`, `JobLookupRow` | `types/job.ts` |
| `OpenJobRow` | move from `update-job-section.tsx` → `types/job.ts`, re-export |
| Pagination buttons pattern | copy from `update-job-section.tsx` |
| `JOB_TYPE_ROW_COLORS` | copy from `update-job-section.tsx` (or extract to shared) |

---

## Implementation Order

1. **Server**: Add the 3 SQL queries to `sql_store.py`.
2. **`sql-map.ts`**: Add the 3 new constants.
3. **`types/job.ts`**: Add `JobBoardStatusCount`; export `OpenJobRow` (move it from `update-job-section.tsx`).
4. **`update-job-section.tsx`**: Update `OpenJobRow` import to come from `types/job.ts`.
5. **`job-board-landing.tsx`**: Build bar chart component.
6. **`job-board-status-detail.tsx`**: Build filtered table + search + pagination + modals.
7. **`job-board-section.tsx`**: Wire landing ↔ detail view switching; load technicians once.
8. **`client-explorer-panel.tsx`**: Add the `"Job Board"` `TreeItem`.
9. **`client-jobs-page.tsx`**: Add the `"Job Board"` case.

---

## Key Design Decisions

- **No new routes** — stays within the existing `ClientSelectionContext` pattern (label-based selection), exactly like all other Jobs sub-sections.
- **No new GraphQL resolvers** — all three new SQL queries are served through `GRAPHQL_MAP.genericQuery` (the `genericQuery` resolver already handles arbitrary SQL IDs).
- **`NO_ACTION_CODES` exclusion in bar chart** — statuses like `COMPLETED_OK`, `RETURN`, `DELIVERED_OK`, `DELIVERED_NOT_OK` are displayed in the chart but their action dropdown is locked (same as existing `UpdateJobSection` behavior).
- **Search resets page to 1** — standard pagination reset on filter change.
- **Bar chart scales dynamically** — max bar height is a fixed CSS height (e.g. `h-48` = 192 px); each bar's height is `(count / maxCount) * 100%` of that container.
- **Zero-count bars** — rendered at minimum visible height (e.g. 4 px) with low opacity, so the full status landscape is always visible.
- **`technicians`** are loaded once in `job-board-section.tsx` (parent) and passed down to `job-board-status-detail.tsx` so they aren't re-fetched on each navigation between landing and detail.
