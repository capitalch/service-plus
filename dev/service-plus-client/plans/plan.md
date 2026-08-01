# Modify: Inventory > Opening Stock — One Instance Per Branch

**Source:** plans/tran.md

## Problem

`stock_opening_balance` has a DB-level `UNIQUE (branch_id)` constraint (see
`stock_opening_balance_branch_id_key`, `service-plus-server/app/db/schema_dumps/service_plus_service.sql`).
This is correct: a branch can only ever have **one** opening-stock header row,
which holds many line items (parts) underneath it via `stock_opening_balance_line`.

The current UX (`opening-stock-section.tsx`) doesn't know this. It offers a
"New" tab that lets the user create a fresh entry for the current branch at
any time, with no check for whether one already exists. The first save for a
branch succeeds; every subsequent "New" save for that same branch fails at the
database with a raw `UniqueViolation`, surfaced to the user as a generic
"Operation failed" — this is the exact error already seen in practice.

The "View" tab (a paginated, searchable grid filtered by `branch_id`) is a
relic of treating this as a one-to-many-per-branch feature. Since only one row
can ever match a given `branch_id`, that grid can never show more than one
result — pagination and search are dead weight for this feature.

**Good news:** the fix is entirely client-side. No SQL or schema changes are
needed:
- `GET_OPENING_STOCK_PAGED` (`app/db/sql/sql_inventory.py`), called with
  `{branch_id, search: "", limit: 1, offset: 0}`, already returns 0-or-1 rows
  for a branch — exactly what's needed to detect an existing entry.
- `GET_OPENING_STOCK_DETAIL` (by `id`) already returns the full header + lines,
  and `new-opening-stock.tsx` already has a working `editEntry` code path that
  fetches this and populates the form, tracking `originalLineIds` for
  line-level diffing on save.
- `executeSave`'s insert-vs-update branch (on whether `editEntry` is set) is
  already correct and needs no logic changes.

So this plan is a UI rewire: always resolve "does this branch have an entry"
first, then render one form (blank or pre-populated) instead of two toggled
modes.

## Target Behavior

- Opening the Opening Stock screen for a branch that already has an entry
  shows that entry directly — pre-loaded with its lines — ready to add more
  parts, edit/remove existing lines, edit header fields, and save (update).
- Opening it for a branch with no entry yet shows a blank form to create the
  first one.
- No separate View tab, grid, pagination, or search — the screen is always
  the single form.
- Deleting the branch's entry remains possible, via one button instead of a
  per-row grid action.

## Steps

**Step 1 — Detect the existing entry for the current branch on load**
- In `opening-stock-section.tsx`, remove the `mode: "new" | "view"` state.
- Add `existingEntry: OpeningStockListItem | null` and `entryLoading: boolean`.
- On mount and whenever `branchId` changes, query `GET_OPENING_STOCK_PAGED`
  with `{ branch_id: branchId, search: "", limit: 1, offset: 0 }` and set
  `existingEntry` to the single row returned, or `null`.
- Drop the list-oriented state entirely: `entries`, `total`, `page`, `search`,
  `searchQ`, `PAGE_SIZE`, and the `GET_OPENING_STOCK_COUNT` call (count is
  meaningless once there's no list to paginate).

**Step 2 — Merge "New" and "View" into one always-rendered form**
- Remove the `ViewModeToggle` import/usage from this file only (it's shared by
  9+ other sections — purchase entry, stock adjustment, branch transfer, loan
  entry, sales entry, batch/single/opening job, part-used — do not touch the
  shared component itself).
- Always render `<NewOpeningStock>` passing `editEntry={existingEntry}`.
  `new-opening-stock.tsx`'s existing populate-on-`editEntry` effect needs no
  changes — it already fetches `GET_OPENING_STOCK_DETAIL` and resets the form
  with real lines when `editEntry` is set, and starts blank when it isn't.
- Header title: keep the existing "— New" / "— Edit" badge styling, but drive
  it off `existingEntry` instead of `mode`/`editEntry`-from-grid-click.

**Step 3 — First-time creation must not need a second reload**
- After a successful **insert** (no `existingEntry` yet), immediately treat
  the newly created row as the current entry (e.g. set `existingEntry` from
  the mutation result, or re-run the Step 1 existence query) so that adding
  more parts right after creation goes through the **update** path, not a
  second insert of the same branch.

**Step 4 — Replace the grid's delete action with a single header button**
- Remove the per-row dropdown-menu delete (only reachable from the grid,
  which is being removed).
- Add one "Delete" button in the header, visible only when `existingEntry` is
  set, opening the same confirm `Dialog` already implemented and calling the
  existing `handleDelete` (by `existingEntry.id`).
- On successful delete, reset `existingEntry` to `null` so the screen reverts
  to the blank create-first-entry form.

**Step 5 — Remove now-dead code**
- Delete: pagination state/UI, search input + debounce timer, the results
  `<table>` grid markup, loading-skeleton grid markup, `ViewModeToggle`
  import, `mode` state, and the `recalc`/`scrollWrapperRef` height logic that
  was sized for the grid (the form's own height logic in
  `new-opening-stock.tsx` is unaffected).
- Leave `GET_OPENING_STOCK_COUNT`/`GET_OPENING_STOCK_PAGED`/`GET_OPENING_STOCK_DETAIL`
  defined server-side and in `SQL_MAP` — only this component's *use* of the
  count query goes away.

**Step 6 — Messages**
- Add one new key to `constants/messages.ts`, e.g.
  `INFO_OPENING_STOCK_EXISTING_ENTRY: 'This branch already has an opening stock entry — add more parts below.'`,
  shown as an inline hint under the header when `existingEntry` is set.
- All existing error/success message keys (`ERROR_OPENING_STOCK_*`,
  `SUCCESS_OPENING_STOCK_*`) are reused as-is.

**Step 7 — Responsive check**
- Confirm the always-visible single-form layout stays responsive at mobile
  widths (per claude.md's "Always make responsive design" rule) — the grid's
  removal simplifies this; `new-opening-stock.tsx`'s existing mobile handling
  is unaffected.

**Step 8 — Manual verification**
- Branch with no entry → blank form → save → screen now shows it as the
  existing entry (edit mode), no reload needed.
- Branch with an existing entry → screen loads directly into the populated
  edit form.
- Add a new line to an existing entry, save → goes through the update path,
  no `UniqueViolation`.
- Delete the entry for a branch → screen reverts to the blank form.
- Switch the global branch selector between a branch with an entry and one
  without → screen updates correctly, no stale `existingEntry` from the
  previous branch.

## Workflow

```
mount / branchId changes
        │
        ▼
query GET_OPENING_STOCK_PAGED
{branch_id, search:"", limit:1, offset:0}
        │
        ▼
   entry found? ──── no ───► render blank form (create mode)
        │                            │
       yes                        user fills header + adds lines
        │                            │
        ▼                          Save ──► genericUpdate INSERT
fetch GET_OPENING_STOCK_DETAIL(id)             │
        │                                      ▼
        ▼                          treat new row as existingEntry
render populated form (edit mode)              │
        │                                      │
        ▼                                      │
user adds/edits/removes lines,  ◄───────────────┘
edits header fields
        │
        ▼
      Save ──► genericUpdate UPDATE (existing path, unchanged)
        │
        ▼
  optional: Delete button ──► genericUpdate delete ──► existingEntry = null
                                                            │
                                                            ▼
                                                  back to blank form
```

## Out of Scope / Notes

- No server-side or SQL changes required.
- No DB schema changes — the `branch_id` unique constraint is correct and
  stays as-is.
- `stock_opening_balance.brand_id` remains a required header field. This plan
  does not address whether a single "brand" per branch's opening-balance
  header still makes conceptual sense now that lines can reference parts of
  different brands — that's a separate, schema-level question, not part of
  this UX fix.
- `ViewModeToggle` itself is not modified or removed — only its usage inside
  `opening-stock-section.tsx` is dropped.
