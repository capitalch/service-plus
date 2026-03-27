# Plan: Financial Year CRUD

## Overview

Full CRUD for the `financial_year` table under **Masters > Organization > Financial Year** in client mode.

---

## Key Design Facts

| Fact | Detail |
|------|--------|
| `id` | The fiscal start year itself (e.g. `2024`) — integer, user-supplied, **not auto-generated** |
| `start_date` | Date — auto-filled to Apr 1 of the year, editable |
| `end_date` | Date — auto-filled to Mar 31 of the following year, editable |
| `is_active` | Does not exist — no activate/deactivate |
| FK references | None — no other table has a FK pointing at `financial_year` |
| Seed data | Years 2022–2047 pre-populated (Indian FY convention) |
| `isIdInsert` | Must pass `isIdInsert: true` in genericUpdate for INSERT (explicit id) |
| Delete guard | No FK check needed; confirm by typing the year number |

---

## Workflow

```
Masters > Financial Year
  │
  ├─ Load list via genericQuery (GET_ALL_FINANCIAL_YEARS, ORDER BY id DESC)
  │
  ├─ Add Financial Year
  │     User enters Year (integer) → start/end auto-filled → editable
  │     Validate: id unique (CHECK_FY_ID_EXISTS)
  │              date range no overlap (CHECK_FY_DATE_OVERLAP)
  │     Submit: genericUpdate (isIdInsert: true)
  │
  ├─ Edit Financial Year
  │     Year (id) is read-only
  │     Dates editable; validate no overlap (CHECK_FY_DATE_OVERLAP_EXCLUDE_ID)
  │     Submit: genericUpdate (UPDATE via id)
  │
  └─ Delete Financial Year
        Type the year to confirm (e.g. "2024")
        Submit: genericUpdate (deletedIds: [id])
```

**Masters page refactor:** `client-masters-page.tsx` currently renders the Branch section unconditionally. It needs to become a content switcher driven by `selected` from `useClientSelection()`. Branch content is extracted to `branch-section.tsx`; Financial Year content goes in `financial-year-section.tsx`.

---

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `service-plus-server/app/db/sql_auth.py` | Add 4 FY SQL queries |
| 2 | `service-plus-client/src/constants/sql-map.ts` | Add 4 FY SQL keys |
| 3 | `service-plus-client/src/constants/messages.ts` | Add FY messages |
| 4 | `service-plus-client/src/features/client/types/financial-year.ts` | **New** type |
| 5 | `service-plus-client/src/features/client/components/add-financial-year-dialog.tsx` | **New** |
| 6 | `service-plus-client/src/features/client/components/edit-financial-year-dialog.tsx` | **New** |
| 7 | `service-plus-client/src/features/client/components/delete-financial-year-dialog.tsx` | **New** |
| 8 | `service-plus-client/src/features/client/components/branch-section.tsx` | **New** — extract branch content from masters page |
| 9 | `service-plus-client/src/features/client/components/financial-year-section.tsx` | **New** — FY table + dialogs |
| 10 | `service-plus-client/src/features/client/pages/client-masters-page.tsx` | Refactor to content switcher |

---

## Step 1 — `sql_auth.py`: Add FY SQL

**File:** `service-plus-server/app/db/sql_auth.py`

Add to `SqlAuth` class (alphabetically sorted — all `CHECK_F*` before `CHECK_R*`, `GET_ALL_F*` between existing `GET_ALL_*`):

```python
CHECK_FY_DATE_OVERLAP = """
    with
        "p_start" as (values(%(start_date)s::date)),
        "p_end"   as (values(%(end_date)s::date))
    -- with
    --     "p_start" as (values('2024-04-01'::date)), -- Test line
    --     "p_end"   as (values('2025-03-31'::date))  -- Test line
    SELECT EXISTS (
        SELECT 1 FROM financial_year
        WHERE start_date < (table "p_end")
          AND end_date   > (table "p_start")
    ) AS overlaps
"""

CHECK_FY_DATE_OVERLAP_EXCLUDE_ID = """
    with
        "p_start" as (values(%(start_date)s::date)),
        "p_end"   as (values(%(end_date)s::date)),
        "p_id"    as (values(%(id)s::int))
    -- with
    --     "p_start" as (values('2024-04-01'::date)), -- Test line
    --     "p_end"   as (values('2025-03-31'::date)), -- Test line
    --     "p_id"    as (values(2024::int))            -- Test line
    SELECT EXISTS (
        SELECT 1 FROM financial_year
        WHERE start_date < (table "p_end")
          AND end_date   > (table "p_start")
          AND id        <> (table "p_id")
    ) AS overlaps
"""

CHECK_FY_ID_EXISTS = """
    with "p_id" as (values(%(id)s::int))
    -- with "p_id" as (values(2024::int)) -- Test line
    SELECT EXISTS (
        SELECT 1 FROM financial_year
        WHERE id = (table "p_id")
    ) AS exists
"""

GET_ALL_FINANCIAL_YEARS = """
    with "dummy" as (values(1::int))
    -- with "dummy" as (values(1::int)) -- Test line
    SELECT id, end_date, start_date
    FROM financial_year
    ORDER BY id DESC
"""
```

Note: uses unqualified table name — `exec_sql` sets `search_path` to the BU schema.

---

## Step 2 — `sql-map.ts`: Add FY SQL Keys

**File:** `service-plus-client/src/constants/sql-map.ts`

Add (alphabetically — `CHECK_F*` before `CHECK_R*`, `GET_ALL_F*` between existing GET_ALL entries):

```typescript
CHECK_FY_DATE_OVERLAP:            "CHECK_FY_DATE_OVERLAP",
CHECK_FY_DATE_OVERLAP_EXCLUDE_ID: "CHECK_FY_DATE_OVERLAP_EXCLUDE_ID",
CHECK_FY_ID_EXISTS:               "CHECK_FY_ID_EXISTS",
GET_ALL_FINANCIAL_YEARS:          "GET_ALL_FINANCIAL_YEARS",
```

---

## Step 3 — `messages.ts`: Add FY Messages

**File:** `service-plus-client/src/constants/messages.ts`

Add under a `// Financial Year CRUD` comment:

```typescript
// Financial Year CRUD
ERROR_FY_CREATE_FAILED:    'Failed to create financial year. Please try again.',
ERROR_FY_DATE_OVERLAP:     'Date range overlaps with an existing financial year.',
ERROR_FY_DELETE_FAILED:    'Failed to delete financial year. Please try again.',
ERROR_FY_ID_EXISTS:        'A financial year with this year already exists.',
ERROR_FY_LOAD_FAILED:      'Failed to load financial years. Please try again.',
ERROR_FY_UPDATE_FAILED:    'Failed to update financial year. Please try again.',
SUCCESS_FY_CREATED:        'Financial year created successfully.',
SUCCESS_FY_DELETED:        'Financial year deleted successfully.',
SUCCESS_FY_UPDATED:        'Financial year updated successfully.',
```

---

## Step 4 — `types/financial-year.ts`: New Type

**File:** `service-plus-client/src/features/client/types/financial-year.ts`

```typescript
export type FinancialYearType = {
    end_date:   string;   // ISO date string from DB
    id:         number;   // the fiscal start year (e.g. 2024)
    start_date: string;   // ISO date string from DB
};
```

---

## Step 5 — `add-financial-year-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/add-financial-year-dialog.tsx`

### Props
```typescript
type AddFinancialYearDialogPropsType = {
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Zod schema
```typescript
const addFySchema = z.object({
    end_date:   z.string().min(1, "End date is required"),
    id:         z.coerce.number()
                  .int("Year must be a whole number")
                  .min(2000, "Year must be 2000 or later")
                  .max(2100, "Year must be 2100 or earlier"),
    start_date: z.string().min(1, "Start date is required"),
}).refine((d) => d.start_date < d.end_date, {
    message: "Start date must be before end date",
    path: ["end_date"],
});
```

### Behaviour
- **Year field:** integer input. On blur (1200ms debounce):
  - Auto-fill `start_date` to `{year}-04-01`
  - Auto-fill `end_date` to `{year+1}-03-31`
  - Run `CHECK_FY_ID_EXISTS` uniqueness check
- **Dates:** `<Input type="date">` — pre-filled by year, fully editable.
- **Date overlap:** when both dates are present and valid, run `CHECK_FY_DATE_OVERLAP` (1200ms debounce on end_date change).
- **Submit:** `genericUpdate` with:
```typescript
{
    tableName: "financial_year",
    isIdInsert: true,
    xData: { id, start_date, end_date }
}
```
- Uses `db_name = selectDbName`, `schema = selectSchema`.

### Form layout
```
[ Year (e.g. 2025) * ]
[ Start Date * ]  [ End Date * ]
```

---

## Step 6 — `edit-financial-year-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/edit-financial-year-dialog.tsx`

### Props
```typescript
type EditFinancialYearDialogPropsType = {
    fy:          FinancialYearType;
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Behaviour
- **Year (id):** read-only badge — cannot be changed.
- **Dates:** pre-filled from `fy` prop, fully editable.
- **Validation:** `start_date < end_date`. Date overlap check via `CHECK_FY_DATE_OVERLAP_EXCLUDE_ID` (excluding current `fy.id`), debounced on end_date change.
- **Submit:** `genericUpdate` with `xData: { id: fy.id, start_date, end_date }` → UPDATE.

---

## Step 7 — `delete-financial-year-dialog.tsx`: New Component

**File:** `service-plus-client/src/features/client/components/delete-financial-year-dialog.tsx`

### Props
```typescript
type DeleteFinancialYearDialogPropsType = {
    fy:          FinancialYearType;
    onOpenChange: (open: boolean) => void;
    onSuccess:   () => void;
    open:        boolean;
};
```

### Behaviour
- No in-use check needed (no FK references to `financial_year`).
- User must type the year number (e.g. `2024`) to confirm. Compare as string: `confirmValue === String(fy.id)`.
- **Submit:** `genericUpdate` with `{ tableName: "financial_year", deletedIds: [fy.id], xData: {} }`.

---

## Step 8 — `branch-section.tsx`: Extract Branch Content

**File:** `service-plus-client/src/features/client/components/branch-section.tsx`

Move all branch-related JSX, state, and handlers from the current `client-masters-page.tsx` into this standalone component. It takes no props (reads `dbName`/`schema` from selectors directly). The component renders the full branch table + Add/Edit/Delete dialogs exactly as the current masters page does.

---

## Step 9 — `financial-year-section.tsx`: New FY Section

**File:** `service-plus-client/src/features/client/components/financial-year-section.tsx`

### Behaviour
Same pattern as `branch-section.tsx`. Renders the FY table + Add/Edit/Delete dialogs.

### Table columns
`#` | Year | Start Date | End Date | Actions

### Actions dropdown (per row)
- **Edit** → `EditFinancialYearDialog`
- **Delete** → `DeleteFinancialYearDialog`
(No activate/deactivate — no `is_active` field)

### Date formatting
Display dates as `DD MMM YYYY` (e.g. `01 Apr 2024`) using a helper:
```typescript
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}
```

### No-schema guard
Same as branch section: if `schema` is null, show "No business unit assigned" message.

---

## Step 10 — `client-masters-page.tsx`: Content Switcher

**File:** `service-plus-client/src/features/client/pages/client-masters-page.tsx`

Replace current content with a switcher based on `selected` from `useClientSelection()`:

```tsx
export const ClientMastersPage = () => {
    const { selected } = useClientSelection();

    return (
        <ClientLayout>
            {selected === "Branch"         && <BranchSection />}
            {selected === "Financial Year" && <FinancialYearSection />}
            {selected !== "Branch" && selected !== "Financial Year" && (
                <ComingSoonPlaceholder label={selected} />
            )}
        </ClientLayout>
    );
};
```

`ComingSoonPlaceholder` is a small inline component showing the selected label with "Coming soon." text — reuses the existing placeholder style.

---

## Key Design Notes

1. **`isIdInsert: true`** in `genericUpdate` forces an INSERT with an explicit `id` value instead of relying on a sequence. This is required because `financial_year.id` is the year itself, not auto-generated.

2. **Date auto-fill:** When the user types a year, auto-fill `start_date = {year}-04-01` and `end_date = {year+1}-03-31` (Indian FY convention). This reduces manual entry for the common case.

3. **Overlap check:** Unlike other uniqueness checks, `CHECK_FY_DATE_OVERLAP` runs against a date range, not a single value. It is debounced on the end_date field (since both start and end must be present for the check to be meaningful).

4. **No in-use FK guard:** The `financial_year` table has no incoming FK references in the BU schema. Jobs are associated with a FY by date logic, not by FK column. Therefore no `CHECK_FY_IN_USE` is needed.

5. **Masters page as switcher:** The current `client-masters-page.tsx` hardcodes branch content. Extracting to `branch-section.tsx` keeps the branch code unchanged while enabling Financial Year (and future masters) to plug in cleanly.
