# Plan: "Revise Final" Action on Finalized Jobs

## Goal
Add a "Revise Final" dropdown action in the **Finalized Jobs** tab that reopens the finalize form (`FinalJobForm`) for the selected row, allowing the user to edit parts, charges, amounts, and division (subject to existing constraints), then re-save.

---

## Key Observations

- `FinalJobRow` (pending) and `FinalizedJobRow` (finalized) share all fields needed by `handleOpenFinal` and `FinalJobForm`: `id`, `division_id`, `job_type_code`, `job_no`, etc.
- `FinalJobForm` uses only `selectedRow.job_type_code` (to detect warranty jobs).
- The division `<Select>` in `FinalJobForm` is `disabled={selectedJob.is_final}` — for a finalized job `is_final` is `true`, so the division selector stays locked during revision. This is acceptable (division change has GST implications; user can Undo Final if needed).
- `handleSaveFinal` currently only refreshes the **pending** list after save. When revising a finalized job, it must also refresh the **finalized** list.
- `is_posted` jobs must not be revisable (same guard as "Undo Final").

---

## Files to Change — 2 files only

### 1. `src/features/client/components/jobs/final-a-job/finalized-jobs-grid.tsx`

**a. Add `onReviseFinal` to `Props`:**
```ts
onReviseFinal: (row: FinalizedJobRow) => void;
```

**b. Destructure in the component function.**

**c. Add a new `DropdownMenuItem` (place it between "Charges" and the separator before "Undo Final"):**
```tsx
<DropdownMenuItem
    className="gap-2 text-xs text-orange-700 dark:text-orange-400 focus:text-orange-700 dark:focus:text-orange-400"
    disabled={row.is_posted}
    title={row.is_posted ? "Cannot revise a posted job" : undefined}
    onSelect={() => onReviseFinal(row)}
>
    <Pencil className="h-3.5 w-3.5" />
    Revise Final
</DropdownMenuItem>
```
Add `Pencil` to the lucide-react import at the top.

---

### 2. `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx`

**a. Add `handleReviseFinal`** — adapts `FinalizedJobRow` → `FinalJobRow` shape and delegates to `handleOpenFinal`:
```ts
async function handleReviseFinal(row: FinalizedJobRow) {
    const adapted: FinalJobRow = {
        ...row,
        is_closed: false,
        is_final:  true,
    };
    await handleOpenFinal(adapted);
}
```

**b. Refresh finalized list after save** — in `handleSaveFinal`, after `toast.success(...)` add:
```ts
void loadFinalizedData();
```
(alongside the existing `loadData` call — both are harmless to run together)

**c. Wire up the prop** — in the `<FinalizedJobsGrid>` JSX:
```tsx
onReviseFinal={row => void handleReviseFinal(row)}
```

---

## Behaviour After Implementation

| Action | Result |
|---|---|
| Click "Revise Final" on a non-posted job | FinalJobForm opens with all parts/charges loaded (same as finalization flow) |
| Click "Revise Final" on a `is_posted` job | Item is disabled; no action |
| Edit parts/charges/amount and click Save | Job stays `is_final: true`; both pending and finalized lists refresh; user returns to Finalized Jobs tab |
| Click Back without saving | Returns to Finalized Jobs tab unchanged |

---

## Out of Scope
- No new SQL queries or backend changes needed.
- No schema type changes — `FinalJobRow` already covers all needed fields.
- No changes to `FinalJobForm` itself.
