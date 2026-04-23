# Plan: Part Used (Job) Feature — Full CRUD

## Context
The current `ConsumptionSection` component (wired to "Part Used (Job)") is a **read-only list** showing parts consumption from `job_part_used`. This plan replaces it with a full CRUD section that lets technicians record which spare parts were used on a repair job.

### DB Relationship
- `job_part_used` — one row per part per job: `{job_id, part_id, quantity}`
- `stock_transaction` — FK `job_part_used_id` with **`ON DELETE CASCADE`**, so deleting a `job_part_used` row automatically removes the corresponding `stock_transaction` row and triggers `trg_stock_balance_delete` to update `stock_balance`
- Transaction type code for job consumption: **`JOB_CONSUME`**, `dr_cr = 'C'` (stock debit out)

---

## Architecture

Two-file section following the purchase/sales invoice pattern:

| File | Purpose |
|------|---------|
| `part-used-section.tsx` | Section container: mode toggle, header, view list, delete confirmation |
| `new-part-used-form.tsx` | forwardRef form: job search + existing lines (deleteable) + new lines to add |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/components/jobs/part-used-section.tsx` | Section container |
| `src/features/client/components/jobs/new-part-used-form.tsx` | Job-select + line-item form |

---

## Files to Modify

### Backend
1. **`app/db/sql_store.py`**
   - Add `GET_JOBS_BY_KEYWORD` — for job combobox search (returns id, job_no, job_date, customer_name, mobile, job_status_name, branch_id)
   - Add `GET_JOB_PART_USED_BY_JOB` — existing lines for selected job (id, part_id, part_code, part_name, uom, quantity)
   - Modify `GET_PARTS_CONSUMPTION` — add `jpu.id` to SELECT (needed for delete action in view mode)

> **No new mutation needed.** `genericUpdate` (via `process_details`) already handles `deletedIds` + `xData` list + nested `xDetails` with FK propagation — all within one connection/transaction.

### Frontend
2. **`src/constants/sql-map.ts`**
   - Add `GET_JOBS_BY_KEYWORD`, `GET_JOB_PART_USED_BY_JOB`

3. **`src/constants/graphql-map.ts`**
   - No changes needed — use existing `GRAPHQL_MAP.genericUpdate` for both save and delete

4. **`src/constants/messages.ts`**
   - Add:
     ```
     ERROR_PART_USED_JOB_REQUIRED:    'Please select a job.'
     ERROR_PART_USED_LINES_REQUIRED:  'Add at least one part line.'
     ERROR_PART_USED_LOAD_FAILED:     'Failed to load parts used. Please try again.'
     ERROR_PART_USED_SAVE_FAILED:     'Failed to save parts used. Please try again.'
     ERROR_PART_USED_DELETE_FAILED:   'Failed to delete part usage record. Please try again.'
     SUCCESS_PART_USED_SAVED:         'Parts usage saved successfully.'
     SUCCESS_PART_USED_DELETED:       'Part usage record deleted.'
     ```

5. **`src/features/client/pages/client-jobs-page.tsx`**
   - Replace `ConsumptionSection` import with `PartUsedSection`
   - Change `case "Part Used (Job)": return <PartUsedSection />;`

---

## Implementation Details

### SQL: `GET_JOBS_BY_KEYWORD`
```sql
-- Parameters: search (text), branch_id (bigint), limit (int)
SELECT j.id, j.job_no, j.job_date, j.branch_id, j.is_closed,
       cc.full_name AS customer_name, cc.mobile,
       js.name AS job_status_name
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_status        js ON js.id = j.job_status_id
WHERE j.branch_id = %(branch_id)s
  AND (%(search)s = ''
   OR LOWER(j.job_no)     LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.mobile)    LIKE '%' || LOWER(%(search)s) || '%'
   OR LOWER(cc.full_name) LIKE '%' || LOWER(%(search)s) || '%')
ORDER BY j.job_date DESC, j.job_no
LIMIT %(limit)s
```

### SQL: `GET_JOB_PART_USED_BY_JOB`
```sql
-- Parameters: job_id (bigint)
SELECT jpu.id, jpu.part_id, jpu.quantity,
       sp.part_code, sp.part_name, sp.uom
FROM job_part_used jpu
JOIN spare_part_master sp ON sp.id = jpu.part_id
WHERE jpu.job_id = %(job_id)s
ORDER BY jpu.id
```

### `genericUpdate` Save Payload

Built on the frontend and passed to `GRAPHQL_MAP.genericUpdate`. `stock_transaction_type_id` is resolved from the already-loaded `txnTypes` array (find the entry with `code === 'JOB_CONSUME'`).

```typescript
{
  tableName: "job_part_used",
  deletedIds: number[],          // existing jpu ids to remove (cascade-deletes stock_transaction)
  xData: newLines.map(line => ({
    job_id:   number,
    part_id:  line.part_id,
    quantity: line.quantity,
    xDetails: {
      tableName: "stock_transaction",
      fkeyName:  "job_part_used_id",   // driver passes the new jpu.id here automatically
      xData: {
        branch_id:                  number,
        part_id:                    line.part_id,
        quantity:                   line.quantity,
        dr_cr:                      "C",
        transaction_date:           job_date,   // ISO date string
        stock_transaction_type_id:  consumeTypeId,
      }
    }
  }))
}
```

`process_details` runs this atomically (one connection): deletes first, then inserts each `job_part_used` row and immediately inserts its `stock_transaction` child with the returned FK.

### `new-part-used-form.tsx` Layout

```
─── Job Selection ──────────────────────────────────────────────────
  Job [SearchableCombobox — search by job_no / customer / mobile]
  
─── Job Summary (visible after job selected) ───────────────────────
  Job No  |  Date  |  Customer  |  Status  (read-only row)

─── Existing Parts for this Job ────────────────────────────────────
  (loaded from GET_JOB_PART_USED_BY_JOB on job select)
  # | Part Code | Part Name | UOM | Qty | [× Delete]
  (empty state: "No parts logged yet for this job.")

─── Add New Parts ──────────────────────────────────────────────────
  Line rows (same PartCodeInput pattern as purchase invoice):
  # | Part Code* | Part Name | UOM | Qty* | [× Remove]
  [+ Add Part] button
```

**Handle** (`forwardRef + useImperativeHandle`):
```typescript
export type NewPartUsedFormHandle = { submit: () => void; reset: () => void };
```

**Props**:
```typescript
type Props = {
    branchId:       number | null;
    txnTypes:       StockTransactionTypeRow[];
    onSuccess:      () => void;
    onStatusChange: (s: { isValid: boolean; isSubmitting: boolean }) => void;
};
```

**Validation**: job selected, at least one new line OR at least one deleted line (i.e. there is a change to save).

**Job combobox**: When user types 2+ chars, debounced call to `GET_JOBS_BY_KEYWORD` (limit 20). On selection, load `GET_JOB_PART_USED_BY_JOB` to populate existing lines.

**Save payload** → `GRAPHQL_MAP.genericUpdate`

### `part-used-section.tsx` Structure

```typescript
// Mode
const [mode, setMode] = useState<ViewMode>("new");

// Metadata
const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);

// View mode state (mirrors existing ConsumptionSection)
const [branches, setBranches] = useState<BranchType[]>([]);
const [selectedBranch, setSelectedBranch] = useState("");
const [fromDate, toDate, search, page] = ...  // same filters

// Ref
const formRef = useRef<NewPartUsedFormHandle>(null);
```

**View mode** (replaces ConsumptionSection):
- Same columns as before: `#, Job No, Job Date, Part Code, Part Name, UOM, Qty Used`
- Add `Actions` column with Delete button per row (calls `DELETE job_part_used WHERE id = jpu.id`)
- Requires `jpu.id` in `GET_PARTS_CONSUMPTION` (already added in sql_store.py change above)

**Delete flow** in view mode:
- Click Delete → confirmation dialog → call `genericUpdate` with `{tableName: "job_part_used", deletedIds: [id]}`
- `stock_transaction` cascades, `stock_balance` updated by trigger

---

## Existing Utilities to Reuse

| Utility | Notes |
|---------|-------|
| `PartCodeInput` | Part code search/autocomplete (same as purchase entry) |
| `GET_STOCK_TRANSACTION_TYPES` | Load to find `JOB_CONSUME` type id |
| `GET_PARTS_CONSUMPTION` / `GET_PARTS_CONSUMPTION_COUNT` | View list (add `jpu.id` to query) |
| `GET_ALL_BRANCHES` | Branch selector in view mode |
| `GRAPHQL_MAP.genericUpdate` | Both new-form save and view-mode delete |
| `ViewModeToggle` | Mode switch header |
| Pagination + skeleton | Clone from job-section.tsx |
| `selectCurrentBranch` | Default branch for job search |

---

## Verification Steps

1. `npm run dev` — start dev server
2. Navigate to **Jobs > Part Used (Job)**
3. **New form**:
   - Search for a job → job summary populates; existing parts (if any) show in read-only table
   - Add 2–3 part lines (use PartCodeInput to search by code)
   - Validate: Save disabled until job selected + at least one line
   - Save → toast success; switches to view mode
4. **DB check**: `job_part_used` rows inserted; `stock_transaction` rows with `dr_cr='C'` and `job_part_used_id` FK; `stock_balance` decremented
5. **View mode**:
   - Consumption list shows; date filter, branch selector, search, pagination all work
   - Delete a row → confirmation dialog → row removed; `stock_balance` restored by trigger
6. **Re-open job in new form**: Select same job → deleted line gone; remaining lines shown
7. **No parts edge case**: Save with no new lines and no deleted lines → Save button disabled
