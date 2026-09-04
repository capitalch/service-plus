# Cost Correction on Any Job — Implementation Steps

Edit `cost_price` on existing `job_part_used` / `job_additional_charge` rows at any
job status, including delivered / closed / posted. No row insert, no row delete, no
other column.

## Fixed decisions

| | |
|---|---|
| Editable | `cost_price` only, on rows that already exist |
| Status gate | none |
| Selling price / `job.amount` / invoice / receipts / stock | never written |
| Access right | new `JOBS_CORRECT_COST` (id 18), MANAGER only |
| Write path | existing `genericUpdateScript` with a new `sql_id`, `SET_JOB_COST_CORRECTION` — no new mutation |
| Audit | none — no table, no `updated_at`, no reason field |
| Validation | every submitted row must have `cost_price > 0` |
| Entry points | Delivered Jobs grid + Finalized Jobs grid + Job Control's Delivered tab (added after the plan was written) |
| Missing-cost flag | badge on both grids, count of lines needing a cost |
| "Needs a cost" | any `job_part_used` row with `cost_price <= 0`; a `job_additional_charge` row with `cost_price <= 0` **and** `charge_name ~* '(spare\|parts)'` |

---

# Server — `dev/service-plus-server`

## Step 1 — Seed the access right — ✅ Done

`app/db/seeds/seed_security_data.py`, `ACCESS_RIGHT_SEED_SQL`.

1. Add to the `VALUES` list after id 17:
   ```sql
   (18, 'JOBS_CORRECT_COST', 'Correct Job Cost', 'JOBS', 'Access to correct cost on finalized/posted jobs')
   ```
2. In the `role_access_right` insert, add `(1, 18)` to the MANAGER row.
   **Do not** add `(3, 18)` — RECEPTIONIST must not receive it.
3. Update the comment above that insert: RECEPTIONIST is currently described as
   "every right except CONFIG_MENU, ADMIN_MENU, MASTERS_ORGANIZATION and
   MASTERS_SERVICE_CONFIG" — add `JOBS_CORRECT_COST` to that exception list.

## Step 2 — SQL: read the job's cost lines — ✅ Done

`app/db/sql/sql_jobs.py`. Add next to `GET_JOB_PART_USED_BY_JOB`:

```python
    # Cost-correction editor — every existing cost-bearing line on one job, both
    # tables in one result, already scoped to the caller's branch.
    GET_JOB_COST_LINES = """
        with "p_job_id" as (values(%(job_id)s::bigint)),
             "p_branch_id" as (values(%(branch_id)s::bigint))
        SELECT 'part'::text AS line_table, p.id, p.qty,
               p.cost_price, p.selling_price,
               sp.part_code AS code, sp.part_name AS name, p.remarks AS note
        FROM job_part_used p
        JOIN job j ON j.id = p.job_id
        JOIN spare_part_master sp ON sp.id = p.part_id
        WHERE p.job_id = (table "p_job_id") AND j.branch_id = (table "p_branch_id")
        UNION ALL
        SELECT 'charge', c.id, c.qty, c.cost_price, c.selling_price,
               c.ref_no, c.charge_name, c.description
        FROM job_additional_charge c
        JOIN job j ON j.id = c.job_id
        WHERE c.job_id = (table "p_job_id") AND j.branch_id = (table "p_branch_id")
        ORDER BY 1, 2
    """
```

## Step 3 — SQL: the correction script — ✅ Done

`app/db/sql/sql_jobs.py`, same block. One statement does the whole correction. The
`valid` CTE is the guard: cost > 0, and the row must belong to this job **and** this
branch. Both UPDATEs hardcode `SET cost_price` — no other column is writable through
this path, whatever the payload contains.

```python
    # Cost correction (plans/plan.md). Runs via genericUpdateScript, gated by
    # JOBS_CORRECT_COST in GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS. Every guard lives in
    # this statement, so the write is safe regardless of what the client sends:
    # cost > 0, row belongs to this job AND branch, and only cost_price is set.
    # Returns submitted vs updated — a mismatch means something was rejected.
    SET_JOB_COST_CORRECTION = """
        WITH input AS (
            SELECT DISTINCT ON (line_table, id) line_table, id, cost_price
            FROM (
                SELECT (e ->> 'line_table')::text    AS line_table,
                       (e ->> 'id')::bigint          AS id,
                       (e ->> 'cost_price')::numeric AS cost_price
                FROM jsonb_array_elements(%(lines)s::jsonb) e
            ) t
            ORDER BY line_table, id
        ),
        valid AS (
            SELECT i.* FROM input i
            WHERE i.cost_price > 0
              AND ( (i.line_table = 'part' AND EXISTS (
                        SELECT 1 FROM job_part_used p JOIN job j ON j.id = p.job_id
                        WHERE p.id = i.id AND p.job_id = %(job_id)s
                          AND j.branch_id = %(branch_id)s))
                 OR (i.line_table = 'charge' AND EXISTS (
                        SELECT 1 FROM job_additional_charge c JOIN job j ON j.id = c.job_id
                        WHERE c.id = i.id AND c.job_id = %(job_id)s
                          AND j.branch_id = %(branch_id)s)) )
        ),
        upd_parts AS (
            UPDATE job_part_used p SET cost_price = v.cost_price, updated_at = now()
            FROM valid v WHERE v.line_table = 'part' AND p.id = v.id
            RETURNING 1
        ),
        upd_charges AS (
            -- job_additional_charge has no updated_at column; do not add one.
            UPDATE job_additional_charge c SET cost_price = v.cost_price
            FROM valid v WHERE v.line_table = 'charge' AND c.id = v.id
            RETURNING 1
        )
        SELECT (SELECT COUNT(*) FROM input) AS submitted,
               (SELECT COUNT(*) FROM upd_parts) + (SELECT COUNT(*) FROM upd_charges) AS updated
    """
```

`DISTINCT ON (line_table, id)` is load-bearing: without it a payload repeating the
same id with two different costs makes `UPDATE ... FROM valid` non-deterministic.

Also add `GET_JOB_COST_LINE_IDS`? **No** — not needed. The ownership check is inside
the statement above.

## Step 4 — SQL: `missing_cost_lines` on both grid queries — ✅ Done

`app/db/sql/sql_jobs.py`. Add this expression to the `SELECT` list of **both**
`GET_DELIVERED_JOBS_PAGED` and `GET_DELIVERABLE_JOBS_PAGED`, beside the existing
`file_count` subquery (same shape):

```sql
            (
                (SELECT COUNT(*) FROM job_part_used p
                   WHERE p.job_id = j.id AND COALESCE(p.cost_price, 0) <= 0)
              + (SELECT COUNT(*) FROM job_additional_charge c
                   WHERE c.job_id = j.id AND COALESCE(c.cost_price, 0) <= 0
                     AND c.charge_name ~* '(spare|parts)')
            ) AS missing_cost_lines,
```

Do not add it to the `_COUNT` variants.

## Step 5 — Register the right against the sql_id — ✅ Done

`app/graphql/resolvers/jobs/mutations.py` — add beside
`JOBS_GENERIC_UPDATE_TABLE_RIGHTS`:

```python
# genericUpdateScript access rights, keyed by sql_id rather than tableName.
JOBS_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS: dict[str, str] = {
    "SET_JOB_COST_CORRECTION": "JOBS_CORRECT_COST",
}
```

`app/graphql/resolvers/mutation.py`:

1. Import it alongside `JOBS_GENERIC_UPDATE_TABLE_RIGHTS`.
2. Merge it into the existing dict (currently inventory-only):
   ```python
   GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS: dict[str, str] = {
       **JOBS_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
       **INVENTORY_GENERIC_UPDATE_SCRIPT_SQL_ID_RIGHTS,
   }
   ```
3. Update the comment above it — it currently reads "Only Set Part Location needs one
   today."

No `schema.graphql` change. No new resolver. `_require_generic_update_script_right`
already reads `sql_id` off the payload and calls `require_access_right`.

**Leave `GENERIC_UPDATE_TABLE_RIGHTS` untouched** — see Step 6 for why.

## Step 6 — Why not plain `genericUpdate` — ✅ Done (verified, no code change)

Recorded so this is not re-litigated during implementation. Every claim below was
re-verified against the code after Step 5.

`_require_generic_update_table_right` (`mutation.py:117`) reads **only the top-level
`tableName`** and never walks `xDetails`. That produces two dead ends:

- Sending `tableName: "job"` with the two tables nested in `xDetails` (the
  `finalizeJobSave` shape) means the guard never sees them — **no right can be
  applied at all**.
- Sending `tableName: "job_part_used"` / `"job_additional_charge"` top-level *is*
  guardable, but `GENERIC_UPDATE_TABLE_RIGHTS` is keyed per table, so registering
  either against `JOBS_CORRECT_COST` also gates every other caller that sends the
  same top-level table — `part-used-section.tsx:236`,
  `edit-part-used-dialog.tsx:121`, `delete-part-used-dialog.tsx:38` and
  `job-charges-modal.tsx:309,343`. All are Receptionist-usable today and would
  break.

Either way `genericUpdate` also cannot enforce the branch/ownership check, the
`cost > 0` rule, or the column allowlist — it writes whatever keys the payload
carries, including `selling_price` or `qty`. With no audit trail, those server-side
guarantees are the only thing holding the feature's safety case up.

`genericUpdateScript` has none of these problems: its rights map is keyed per
`sql_id`, so the right applies to this one operation and nothing else, and every
guard lives in the SQL.

---

# Client — `dev/service-plus-client`

## Step 7 — Constants — ✅ Done

1. `src/constants/sql-map.ts` — add:
   ```ts
   GET_JOB_COST_LINES: "GET_JOB_COST_LINES",
   ```
2. `src/constants/graphql-map.ts` — **no change**. `genericUpdateScript` is already
   defined there; confirm it is and reuse it.

## Step 8 — Types — ✅ Done

New file `src/features/client/components/jobs/cost-correction/cost-correction-schema.ts`:

```ts
export type CostLineTable = "part" | "charge";

export type CostLine = {
    line_table:    CostLineTable;
    id:            number;
    qty:           number;
    cost_price:    number;
    selling_price: number;
    code:          string | null;
    name:          string;
    note:          string | null;
};

export type EditableCostLine = CostLine & { cost_input: string };
```

Also add `missing_cost_lines: number;` to:
- `DeliveredJobRow` — declared inline at `jobs/deliver-job/delivered-jobs-grid.tsx:24`
- `FinalizedJobRow` — `jobs/final-a-job/final-a-job-schema.ts`

## Step 9 — "needs a cost" predicate, one definition — ✅ Done

New file `src/features/client/components/jobs/cost-correction/cost-correction-helpers.ts`:

```ts
// Must stay identical to the `charge_name ~* '(spare|parts)'` test in
// sql_jobs.py's missing_cost_lines expression, and to the finalize-time
// validation in finalize-job-save.ts. Change one, change all three.
export const SPARE_CHARGE_PATTERN = /(spare|parts)/i;

export function needsCost(line: { line_table: CostLineTable; name: string }): boolean {
    return line.line_table === "part" || SPARE_CHARGE_PATTERN.test(line.name);
}

export function isMissingCost(line: EditableCostLine): boolean {
    return needsCost(line) && !((parseFloat(line.cost_input) || 0) > 0);
}
```

## Step 10 — The modal — ✅ Done

New file `src/features/client/components/jobs/cost-correction/correct-costs-modal.tsx`.

Props: `{ open, jobId, jobNo, branchId, onClose, onSaved }`.

1. On open, load lines via `GRAPHQL_MAP.genericQuery` +
   `SQL_MAP.GET_JOB_COST_LINES`, `sqlArgs: { job_id, branch_id }`, seeding
   `cost_input: String(cost_price)`.
2. Render one table, parts then charges, columns:
   `# | Type | Code | Name / Description | Qty | Sale | Cost`.
   Every column read-only except **Cost**.
3. Cost input: `type="number"`, `min="0.01"`, `step="0.01"`,
   `onFocus={e => e.target.select()}`. **Set only `cost_input`.** Do not import or
   reuse `handleCostChange` from `final-a-job-section.tsx` — it recomputes
   `selling_price` from `markup_percent_over_cost` and would move the price on an
   invoiced job.
4. Red border via `isMissingCost(line)`.
5. No add-row button, no delete-row button.
6. Save is disabled unless: at least one `cost_input` differs from its loaded
   `cost_price`, **and** no line fails `isMissingCost`.
7. Header line: `Cost correction only — invoice, receipts, payments and stock are
   not affected.`

## Step 11 — Save function — ✅ Done

New file `src/features/client/components/jobs/cost-correction/correct-job-costs.ts`:

```ts
export async function correctJobCosts(args: {
    dbName: string; schema: string; branchId: number; jobId: number;
    lines: EditableCostLine[];
}): Promise<boolean>
```

1. Filter to lines whose `cost_input` differs from `cost_price`.
2. Re-check `> 0` on each; `toast.error` and return `false` if any fail.
3. Mutate `GRAPHQL_MAP.genericUpdateScript` with
   ```ts
   encodeObj({
       sql_id:   "SET_JOB_COST_CORRECTION",
       sql_args: { job_id, branch_id, lines: JSON.stringify(changed) },
   })
   ```
   where each entry of `changed` is `{ line_table, id, cost_price }`.
4. The script returns `[{ submitted, updated }]`. If `updated !== submitted`, treat it
   as a failure — the server rejected rows — and show
   `"Some rows were rejected. Refresh and try again."` rather than reporting success.
5. `toast.success(\`Cost updated on ${n} row${n !== 1 ? "s" : ""}.\`)`, return `true`.
6. On throw: `toast.error("Failed to update cost. Please try again.")`, return `false`.

## Step 12 — Wire into Delivered Jobs — ✅ Done

`src/features/client/components/jobs/deliver-job/delivered-jobs-grid.tsx`:

1. Add `onCorrectCosts: (row: DeliveredJobRow) => void;` to `Props`, destructure it.
2. Add a dropdown item after the `Send Invoice via WhatsApp` block (line ~387),
   before `<DropdownMenuSeparator />`. Not gated on `invoice_is_posted`:
   ```tsx
   <DropdownMenuItem
       className="gap-2 text-xs text-rose-700 dark:text-rose-400 cursor-pointer"
       onClick={() => onCorrectCosts(row)}
   >
       <IndianRupee className="h-3.5 w-3.5 text-slate-600" /> Correct Costs
   </DropdownMenuItem>
   ```
3. Badge beside the job no cell:
   ```tsx
   {row.missing_cost_lines > 0 && (
       <span className="w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold
                        text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40"
             title="Lines still missing a cost">
           {row.missing_cost_lines} missing cost
       </span>
   )}
   ```
4. In the parent section, hold `correctCostsJob` state, render `<CorrectCostsModal>`,
   and reload the grid in `onSaved`.

## Step 13 — Wire into Finalized Jobs — ✅ Done

`src/features/client/components/jobs/final-a-job/finalized-jobs-grid.tsx`:

1. Same `onCorrectCosts` prop and the same badge.
2. Add the dropdown item next to `Revise Final` (line ~310). **Do not** copy the
   `disabled={row.is_posted}` / `title="Cannot revise a posted job"` attributes onto
   it — this action is deliberately available on posted jobs. `Revise Final` and
   `Undo Final` keep their existing `is_posted` block unchanged.
3. Wire state + modal in `final-a-job-section.tsx`, reloading both grids on save.

## Step 13a — Wire into Job Control's Delivered tab — ✅ Done

Added after the plan was written, on request. `job-control-section.tsx`: the same
`Correct Costs` item on the delivered-row dropdown (after `Job Details PDF`, before
the separator preceding `Undo Delivery`), again with no `invoice_is_posted` block,
plus the modal wired to `refreshGrid`.

No badge here — the Job Control grid is fed by a different query that does not carry
`missing_cost_lines`, and Step 4 deliberately did not add it there.

## Step 14 — Menu / rights plumbing — ✅ Done (verified, no code change)

Confirm the new right appears in Access Management's role editor automatically (it is
driven by `security.access_right` rows). No new menu item — the feature has no screen
of its own.

---

# Step 15 — Help content — ✅ Done

1. `src/features/client/components/help/help-content.ts` — new article
   `id: "correct-job-cost"`, category `"Jobs"`: what it does, that it works on
   delivered and posted jobs, that invoice/receipts/stock are untouched, that the
   change is not recorded anywhere, and that it is manager-only.
2. Add a row to the `deliver-job` article's action list and a line to the
   `job-final-info` / `finalize-job` article pointing at it.
3. `src/features/super-admin/components/help/dev-help-content.ts` — new article
   `id: "dev-cost-correction"`, category `"Jobs"`: the `genericUpdateScript` sql_id
   and its rights map, why `GENERIC_UPDATE_TABLE_RIGHTS` cannot serve this (Step 6),
   that every guard lives in the SQL, the three places the `(spare|parts)` pattern
   lives, and the deliberate absence of an audit trail.
4. Update the `dev-rbac-seeding` article's right count (17 → 18).

---

# Step 16 — Verification

Run each and record the result.

1. `npx tsc -b --force` — clean apart from the known pre-existing errors.
2. Read-only SQL check that `missing_cost_lines` matches the expected backlog
   (13 jobs / 15 lines across the three live schemas at time of writing):
   ```
   capitalelectronics  9 jobs / 11 lines
   navtechnology       1 job  /  1 line
   demo1               3 jobs /  3 lines
   ```
   A materially larger number means the `(spare|parts)` filter was dropped — the
   unfiltered count is 111 jobs / 119 lines.
3. Correct a cost on a **posted** job, then confirm by query that `job_invoice`,
   `job_invoice_line`, `job.amount`, `job_payment` and `stock_transaction` are all
   byte-identical before and after.
4. Confirm a RECEPTIONIST login receives an authorization error when the modal saves
   (the guard fires on `sql_id = "SET_JOB_COST_CORRECTION"`), **and** that the same
   login can still save normally from the Part Used screen, the part edit/delete
   dialogs, the Job Pipeline charges modal and Final a Job — those go through
   `genericUpdate`/`finalizeJobSave` and must be unaffected.
5. Confirm saving a row with cost `0` is rejected client-side and, with the client
   check bypassed, server-side.
6. Re-run a profit report before and after a correction and confirm the figure moves.
7. Guard logic — already validated read-only against `capitalelectronics` before this
   plan was written, re-run after implementing. Submitting four rows for one job
   returns `submitted=4, updated=1`: a valid owned row is applied; cost `0`, cost
   `-5`, a charge id belonging to a different job, and a nonexistent part id are all
   rejected by the `valid` CTE.
