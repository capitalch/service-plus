# Set Part Location — Implementation Plan

## Feature Summary

Allow users to bulk-assign storage locations to multiple parts in one dialog. Each save:
- Updates `stock_balance.location_id` for every submitted part
- Inserts one audit row per part into `stock_location_change`
- Both operations are atomic across all parts — the entire batch succeeds or the entire batch rolls back

---

## Database Schema (existing — no changes needed)

### `stock_balance`
| Column | Type | Notes |
|--------|------|-------|
| part_id | bigint | PK component, FK → spare_part_master |
| branch_id | bigint | PK component, FK → branch |
| qty | numeric(12,3) | Current stock quantity |
| location_id | bigint | **NULLABLE** FK → stock_location_master (target field) |
| updated_at | timestamptz | Auto-updated |

> Composite PK `(part_id, branch_id)` — no `id` column. Cannot use standard `genericUpdate`. Must use `genericUpdateScript` with a custom SQL query.

### `stock_location_change` (audit trail)
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | Auto-generated identity |
| part_id | bigint | FK → spare_part_master |
| branch_id | bigint | FK → branch |
| to_location_id | bigint | FK → stock_location_master |
| transaction_date | date | NOT NULL |
| ref_no | text | Optional |
| remarks | text | Optional |
| created_at | timestamptz | AUTO |

### `stock_location_master`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint | PK |
| branch_id | bigint | FK → branch |
| name | text | Location name |
| is_active | boolean | DEFAULT true |

---

## Workflow

```
Section loads
  └─ Query: GET_STOCK_BALANCE_WITH_LOCATION (current branch)
       └─ Shows reference table: part_code | part_name | uom | qty | current location (or "—")
  └─ Query: GET_ACTIVE_LOCATIONS_BY_BRANCH (current branch)
       └─ Stored in state — passed to dialog

User clicks "Set Locations" button (top of section)
  └─ Dialog opens with:
       ┌─ Shared header ────────────────────────────────────────────────────────┐
       │  Apply to All: [location dropdown]  → copies selected location to     │
       │                                       every row that has no location   │
       │  Date: [date input, default today]                                     │
       │  Ref No: [text, optional]                                              │
       │  Remarks: [text, optional]                                             │
       └────────────────────────────────────────────────────────────────────────┘
       ┌─ Lines table ──────────────────────────────────────────────────────────┐
       │  Part Code [input]  | Part Name (auto-filled) | Location [dropdown] | ✕│
       │  Part Code [input]  | Part Name (auto-filled) | Location [dropdown] | ✕│
       │  [+ Add Row]                                                           │
       └────────────────────────────────────────────────────────────────────────┘

       Part code validation (debounced, per row):
         → GET_PART_IN_STOCK_BY_CODE (branch_id + part_code)
         → On match:  fills part_id, part_name; clears error
         → On miss:   shows "Part not found in stock for this branch"
         → Duplicate part code in same dialog → "Part already added"

       On submit — single genericUpdateScript call → SET_PART_LOCATIONS
         Atomic data-modifying CTE:
           UNNEST parallel arrays (part_ids[], location_ids[])
           INSERT N rows into stock_location_change
           UPDATE N rows in stock_balance

       On success: toast + close dialog + reload section
```

---

## Step 1 — Backend: `sql_store.py` (5 new queries)

### `GET_STOCK_BALANCE_WITH_LOCATION`
```sql
with "p_branch_id" as (values(%(branch_id)s::bigint))
-- with "p_branch_id" as (values(1::bigint)) -- Test line
SELECT
    sb.part_id,
    p.part_code,
    p.part_name,
    p.uom,
    sb.qty,
    sb.location_id,
    lm.name AS location_name
FROM stock_balance sb
JOIN spare_part_master p           ON p.id  = sb.part_id
LEFT JOIN stock_location_master lm ON lm.id = sb.location_id
WHERE sb.branch_id = (table "p_branch_id")
ORDER BY p.part_code
```

### `GET_ACTIVE_LOCATIONS_BY_BRANCH`
```sql
with "p_branch_id" as (values(%(branch_id)s::bigint))
-- with "p_branch_id" as (values(1::bigint)) -- Test line
SELECT id, name AS location
FROM stock_location_master
WHERE branch_id = (table "p_branch_id")
  AND is_active = true
ORDER BY name
```

### `GET_PART_IN_STOCK_BY_CODE`
Validates a typed part code against `stock_balance` for the current branch.
Returns the part row if valid, empty if not in stock.
```sql
with
    "p_branch_id" as (values(%(branch_id)s::bigint)),
    "p_part_code" as (values(%(part_code)s::text))
-- with
--     "p_branch_id" as (values(1::bigint)),       -- Test line
--     "p_part_code" as (values('ABC-001'::text))  -- Test line
SELECT
    p.id        AS part_id,
    p.part_code,
    p.part_name,
    p.uom,
    sb.qty,
    sb.location_id,
    lm.name     AS location_name
FROM spare_part_master p
JOIN stock_balance sb              ON sb.part_id   = p.id
                                  AND sb.branch_id = (table "p_branch_id")
LEFT JOIN stock_location_master lm ON lm.id        = sb.location_id
WHERE LOWER(p.part_code) = LOWER((table "p_part_code"))
```

### `GET_PART_LOCATION_HISTORY`
```sql
with
    "p_part_id"   as (values(%(part_id)s::bigint)),
    "p_branch_id" as (values(%(branch_id)s::bigint))
-- with "p_part_id" as (values(1::bigint)), "p_branch_id" as (values(1::bigint)) -- Test line
SELECT
    slc.id,
    slc.transaction_date,
    slc.ref_no,
    slc.remarks,
    lm.name AS location_name
FROM stock_location_change slc
JOIN stock_location_master lm ON lm.id = slc.to_location_id
WHERE slc.part_id   = (table "p_part_id")
  AND slc.branch_id = (table "p_branch_id")
ORDER BY slc.transaction_date DESC, slc.created_at DESC
LIMIT 20
```

### `SET_PART_LOCATIONS`
Accepts **parallel arrays** `part_ids[]` and `location_ids[]` (same length, matched by index).
Uses `UNNEST` to expand the arrays, then a **data-modifying CTE** to atomically INSERT N audit rows
and UPDATE N stock_balance rows in a single statement.

```sql
with
    "p_branch_id" as (values(%(branch_id)s::bigint)),
    "p_date"      as (values(%(transaction_date)s::date)),
    "p_ref_no"    as (values(%(ref_no)s::text)),
    "p_remarks"   as (values(%(remarks)s::text)),
-- with
--     "p_branch_id" as (values(1::bigint)),             -- Test line
--     "p_date"      as (values('2026-04-17'::date)),    -- Test line
--     "p_ref_no"    as (values(''::text)),              -- Test line
--     "p_remarks"   as (values(''::text)),              -- Test line
    "p_pairs" AS (
        SELECT
            UNNEST(%(part_ids)s::bigint[])     AS part_id,
            UNNEST(%(location_ids)s::bigint[]) AS location_id
    ),
    insert_history AS (
        INSERT INTO stock_location_change
            (part_id, branch_id, to_location_id, transaction_date, ref_no, remarks)
        SELECT
            p.part_id,
            (table "p_branch_id"),
            p.location_id,
            (table "p_date"),
            NULLIF((table "p_ref_no"),  ''),
            NULLIF((table "p_remarks"), '')
        FROM "p_pairs" p
        RETURNING id
    )
UPDATE stock_balance sb
SET    location_id = pairs.location_id,
       updated_at  = now()
FROM   "p_pairs" pairs
WHERE  sb.part_id   = pairs.part_id
  AND  sb.branch_id = (table "p_branch_id")
```

> Works for N = 1 (single part) or N > 1 (bulk). If any row fails FK validation, the entire
> batch rolls back. `NULLIF(..., '')` converts empty strings to NULL for optional fields.

---

## Step 2 — Client: `sql-map.ts` (5 new entries)

```typescript
// Set Part Location
GET_STOCK_BALANCE_WITH_LOCATION:   "GET_STOCK_BALANCE_WITH_LOCATION",
GET_ACTIVE_LOCATIONS_BY_BRANCH:    "GET_ACTIVE_LOCATIONS_BY_BRANCH",
GET_PART_IN_STOCK_BY_CODE:         "GET_PART_IN_STOCK_BY_CODE",
GET_PART_LOCATION_HISTORY:         "GET_PART_LOCATION_HISTORY",
SET_PART_LOCATIONS:                "SET_PART_LOCATIONS",
```

---

## Step 3 — Client: `messages.ts` (4 new entries)

```typescript
SUCCESS_SET_PART_LOCATIONS:              'Part location(s) set successfully.',
ERROR_SET_PART_LOCATIONS_FAILED:         'Failed to set part locations. Please try again.',
ERROR_SET_PART_LOCATIONS_LOAD_FAILED:    'Failed to load stock data. Please try again.',
ERROR_SET_PART_LOCATION_PART_NOT_FOUND:  'Part not found in stock for this branch.',
```

---

## Step 4 — Client: TypeScript types

New file: `src/features/client/types/set-part-location.ts`

```typescript
export type StockBalanceWithLocationType = {
    part_id:       number;
    part_code:     string;
    part_name:     string;
    uom:           string | null;
    qty:           number;
    location_id:   number | null;
    location_name: string | null;
};

export type LocationOptionType = {
    id:       number;
    location: string;
};

export type PartLocationHistoryType = {
    id:               number;
    transaction_date: string;
    location_name:    string;
    ref_no:           string | null;
    remarks:          string | null;
};

// One row in the dialog's line table
export type SetLocationLineType = {
    _key:          string;          // crypto.randomUUID() — React key
    part_code:     string;          // user-typed
    part_id:       number | null;   // filled after validation
    part_name:     string;          // filled after validation
    location_id:   number | null;   // user-selected
    validating:    boolean;         // debounce spinner
    error:         string | null;   // validation error message
};
```

---

## Step 5 — Client: `set-part-location-dialog.tsx`

### Props
```typescript
type SetPartLocationDialogPropsType = {
    locations:   LocationOptionType[];
    open:        boolean;
    onOpenChange:(open: boolean) => void;
    onSuccess:   () => void;
};
```
> No `part` prop — dialog is opened from section level, not from a row.

### Shared header state (not in react-hook-form — managed with useState)
```
transaction_date  string   default: today (YYYY-MM-DD)
ref_no            string   default: ""
remarks           string   default: ""
applyToAll        number   0 (sentinel = "not set")
```

### Lines state
```typescript
const [lines, setLines] = useState<SetLocationLineType[]>([emptyLine()])
```

### "Apply to All" behaviour
- Standalone `<Select>` (not a form field) at top of dialog
- On change → set `location_id` on **all** lines (overwriting existing selections too, so user can bulk-change)
- Stays independent of per-row selects

### Part code validation (per row, debounced 800 ms)
```
on part_code change →
  mark row: validating = true, part_id = null, part_name = "", error = null
  after debounce →
    check for duplicate within lines → error "Part already added"
    else → GET_PART_IN_STOCK_BY_CODE(branch_id, part_code)
      found    → fill part_id, part_name; validating = false; error = null
      not found→ error = MESSAGES.ERROR_SET_PART_LOCATION_PART_NOT_FOUND
```

### Per-row location select
- Dropdown of active locations (same `locations` prop as section)
- Independent per row — user can mix locations across rows

### Submit guard
Save button disabled while:
- Any row is `validating`
- Any row has `error !== null`
- Any row has `part_id === null`
- Any row has `location_id === null`
- `transaction_date` is empty

### Submit
```typescript
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdateScript,
    variables: {
        db_name: dbName, schema,
        value: graphQlUtils.buildGenericUpdateValue({
            sql_id:   SQL_MAP.SET_PART_LOCATIONS,
            sql_args: {
                branch_id:        currentBranch.id,
                part_ids:         lines.map(l => l.part_id),
                location_ids:     lines.map(l => l.location_id),
                transaction_date: transactionDate,
                ref_no:           refNo   || "",
                remarks:          remarks || "",
            },
        }),
    },
});
```

### Reset on close
- All lines → `[emptyLine()]`
- Header fields reset to defaults
- `applyToAll` reset to 0

---

## Step 6 — Client: `set-part-location-section.tsx`

### State
```
parts:     StockBalanceWithLocationType[]   loaded from GET_STOCK_BALANCE_WITH_LOCATION
locations: LocationOptionType[]             loaded from GET_ACTIVE_LOCATIONS_BY_BRANCH
loading:   boolean
search:    string                           filters part_code | part_name
dialogOpen:boolean                          drives dialog open state
```

### Load
`Promise.all` of both queries on mount and when `currentBranch` changes (same pattern as other sections).

### Table columns
`#` | `Part Code` | `Part Name` | `UOM` | `Qty` | `Current Location` | (no actions column)

### Header buttons
- `Refresh` — reloads data
- `Set Locations` — sets `dialogOpen = true` (opens the dialog)

### Empty states
- No active locations for branch → amber info banner:
  _"No active locations found. Add locations under Masters > Part Location before using this feature."_
  (also disables the "Set Locations" button)
- No stock → _"No stock found for this branch."_

---

## Step 7 — Client: `client-inventory-page.tsx`

```typescript
import { SetPartLocationSection } from "../components/inventory/set-part-location/set-part-location-section";

case "Set Part Location":
    return <SetPartLocationSection />;
```

---

## Files to Create / Modify (Phase 1 — DONE)

| File | Action |
|------|--------|
| `service-plus-server/app/db/sql_store.py` | Add 5 SQL queries ✅ |
| `service-plus-client/src/constants/sql-map.ts` | Add 5 SQL IDs ✅ |
| `service-plus-client/src/constants/messages.ts` | Add 4 messages ✅ |
| `service-plus-client/src/features/client/types/set-part-location.ts` | **NEW** ✅ |
| `service-plus-client/src/features/client/components/inventory/set-part-location/set-part-location-section.tsx` | **NEW** ✅ |
| `service-plus-client/src/features/client/components/inventory/set-part-location/set-part-location-dialog.tsx` | **NEW** ✅ |
| `service-plus-client/src/features/client/pages/client-inventory-page.tsx` | Add case ✅ |

---

## Phase 2 — Row Selection + Set Location for Selected

### Feature summary
The section table gains row-level checkboxes. When one or more rows are selected, a
**"Set Location for Selected (N)"** button appears. Clicking it opens a focused dialog
(`set-location-for-selected-dialog.tsx`) where the user picks a **single location** that
is applied to all selected parts at once.

Reuses the existing `SET_PART_LOCATIONS` SQL — no backend changes needed.
All selected parts get the same `location_id`, so `location_ids[]` is the same value repeated N times.

---

### Step A — `set-part-location-section.tsx` changes

**New state:**
```
selectedIds: Set<number>    set of selected part_ids
```

**Checkbox column** added as the first column (`w-8`, centered):
- Header cell: `<Checkbox>` — checked when `selectedIds.size === displayParts.length > 0`,
  indeterminate when some but not all are selected, unchecked when none.
  On change: select all `displayParts` or deselect all.
- Body cell: `<Checkbox>` per row. On change: toggle `part.part_id` in `selectedIds`.

**Reset selection** when search changes or data reloads (call `setSelectedIds(new Set())`).

**Header buttons** (updated):
```
[Refresh]   [Set Location for Selected (N)]  [Set Locations]
```
- "Set Location for Selected (N)" — only visible when `selectedIds.size > 0`; disabled when `noLocations`.
  Opens `selectedDialogOpen`.
- "Set Locations" — unchanged (opens the existing type-in dialog).

**New dialog state:**
```
selectedDialogOpen: boolean
```

**New dialog mount** (alongside the existing one):
```tsx
<SetLocationForSelectedDialog
    locations={locations}
    open={selectedDialogOpen}
    parts={parts.filter(p => selectedIds.has(p.part_id))}
    onOpenChange={setSelectedDialogOpen}
    onSuccess={() => { setSelectedIds(new Set()); loadData(); }}
/>
```

---

### Step B — New file: `set-location-for-selected-dialog.tsx`

**Props:**
```typescript
type Props = {
    locations:   LocationOptionType[];
    open:        boolean;
    parts:       StockBalanceWithLocationType[];   // already-resolved selected rows
    onOpenChange:(open: boolean) => void;
    onSuccess:   () => void;
};
```

**State (all `useState`, no react-hook-form):**
```
locationId: number   0 = not set
txnDate:    string   today
refNo:      string   ""
remarks:    string   ""
submitting: boolean  false
```

**Layout:**
```
┌─ Dialog ─────────────────────────────────────────────────────┐
│ Title: "Set Location for Selected Parts"                      │
│                                                               │
│ Selected parts (N):                                           │
│  ┌─ compact read-only table ───────────────────────────────┐  │
│  │  Part Code  │  Part Name  │  Current Location           │  │
│  │  ...        │  ...        │  ...                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Location *   [dropdown — required]                           │
│  Date *        [date — default today]                         │
│  Ref No        [text — optional]                              │
│  Remarks       [text — optional]                              │
│                                                               │
│                              [Cancel]  [Save]                 │
└───────────────────────────────────────────────────────────────┘
```

**Submit guard:** Save disabled while `locationId === 0 || !txnDate || submitting`.

**Submit:**
```typescript
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdateScript,
    variables: {
        db_name: dbName, schema,
        value: graphQlUtils.buildGenericUpdateValue({
            sql_id:   SQL_MAP.SET_PART_LOCATIONS,
            sql_args: {
                branch_id:        currentBranch.id,
                part_ids:         parts.map(p => p.part_id),
                location_ids:     parts.map(() => locationId),   // same location for all
                transaction_date: txnDate,
                ref_no:           refNo   || "",
                remarks:          remarks || "",
            },
        }),
    },
});
```

**Reset on close:** all state back to defaults.

---

## Files to Create / Modify (Phase 2)

| File | Action |
|------|--------|
| `set-part-location-section.tsx` | Add checkbox column, `selectedIds` state, "Set Location for Selected" button, `selectedDialogOpen` state, mount new dialog |
| `set-location-for-selected-dialog.tsx` | **NEW** — focused single-location dialog for pre-selected parts |

---

## Implementation Order (Phase 2)

1. `set-location-for-selected-dialog.tsx` — new component
2. `set-part-location-section.tsx` — add selection + new button + mount dialog
