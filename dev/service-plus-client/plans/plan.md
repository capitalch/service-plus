# Plan: Job Search — Inline Status Transactions (tran.md)

## Goal

Add an `ArrowRightLeft` (two-arrow) transaction icon to every row in Job Search. Clicking it opens a dropdown of available status transitions for that job — identical to the pipeline drilldown behaviour — and executes the transition inline, then refreshes the grid. No navigation to another page.

---

## 1. Server — `app/db/sql_store.py`

**Query: `GET_JOB_SEARCH_PAGED`** (line 3593)

Add the following columns to the `SELECT` list:

```sql
jt.code         AS job_type_code,
j.last_transaction_id,
j.technician_id,
j.estimate_amount,
j.is_final,
(SELECT COUNT(*) FROM job_transaction jtr WHERE jtr.job_id = j.id) AS transaction_count
```

No other changes to WHERE/ORDER/LIMIT. The `GET_JOB_SEARCH_COUNT` query is unchanged.

---

## 2. Client type — `src/features/client/types/job.ts`

**`JobSearchRow`** — add/fix the following fields:

```ts
export type JobSearchRow = {
    // existing …
    job_status_id:   number;           // was optional — make required
    job_status_code: string;           // was optional — make required
    // new fields
    job_type_code:         string;
    last_transaction_id:   number | null;
    technician_id:         number | null;
    estimate_amount:       number | null;
    transaction_count:     number;     // was already typed but not returned by SQL — now it will be
    is_final:              boolean;    // was already typed but not returned by SQL — now it will be
};
```

---

## 3. Client — `src/features/client/components/jobs/job-search/job-search-section.tsx`

### 3a. New imports

```ts
// lucide-react — add to existing import
ArrowRightLeft, Lock, Package, Undo2

// lib
import { encodeObj } from "@/lib/graphql-utils";   // already imported as graphQlUtils; add encodeObj

// store
import { selectCurrentUser } from "@/features/auth/store/auth-slice";

// ui
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// pipeline helpers — all already exist in the codebase
import { getTransitions, STATUS_FLAGS, STATUS_COLORS } from "../job-pipeline/status-transitions";
import type { Transition } from "../job-pipeline/status-transitions";
import { StatusTransitionModal } from "../job-pipeline/status-transition-modal";
import type { TransitionPayload } from "../job-pipeline/status-transition-modal";
import { UndoTransactionDialog } from "../job-pipeline/undo-transaction-dialog";
import { JobChargesModal } from "../job-pipeline/job-charges-modal";
import type { ChargesJobSummary } from "../job-pipeline/job-charges-modal";
```

`STATUS_COLORS` is already imported for the status badge; extend the import, don't duplicate.

### 3b. New selector

```ts
const currentUser = useAppSelector(selectCurrentUser);
```

### 3c. New constants (copy verbatim from `job-pipeline-status-drilldown.tsx`)

```ts
const NO_ACTION_CODES  = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);
const NO_UNDO_CODES    = new Set(["DELIVERED_OK", "DELIVERED_NOT_OK"]);
const ADD_CHARGES_CODES = new Set(["RECEIVED", "ASSIGNED", "ESTIMATE_APPROVED", "IN_PROGRESS"]);
const NO_CHARGES_JOB_TYPES = new Set(["DEMO", "INSPECTION", "UNDER_WARRANTY"]);

function canUndo(row: JobSearchRow): boolean {
    if (NO_UNDO_CODES.has(row.job_status_code)) return false;
    if (row.transaction_count < 1) return false;
    return true;
}
```

Place these at module level (outside the component), alongside the existing `PAGE_SIZE` / `DEBOUNCE_MS` constants.

### 3d. New state variables

Add inside the component alongside existing state:

```ts
const [pendingTran,    setPendingTran]    = useState<{ job: JobSearchRow; transition: Transition } | null>(null);
const [submitting,     setSubmitting]     = useState(false);
const [undoPendingJob, setUndoPendingJob] = useState<JobSearchRow | null>(null);
const [chargesJob,     setChargesJob]     = useState<ChargesJobSummary | null>(null);
```

### 3e. New handler: `handleSubmitTransition`

Copy the implementation from `job-pipeline-status-drilldown.tsx` with one type change (`OpenJobRow` → `JobSearchRow`):

```ts
async function handleSubmitTransition(job: JobSearchRow, transition: Transition, payload: TransitionPayload) {
    if (!dbName || !schema) return;
    setSubmitting(true);
    try {
        const flags = STATUS_FLAGS[transition.targetId];
        const xData = {
            id: job.id,
            job_status_id:   transition.targetId,
            division_id:     payload.division_id,
            technician_id:   payload.technician_id,
            amount:          job.amount,
            estimate_amount: transition.fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
            is_final:        flags?.is_final  ?? false,
            is_closed:       flags?.is_closed ?? false,
        };
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.updateJob,
            variables: {
                db_name: dbName, schema,
                value: encodeObj({
                    job_id:                  job.id,
                    last_transaction_id:     job.last_transaction_id,
                    performed_by_user_id:    currentUser?.id ?? null,
                    remarks:                 payload.remarks || "",
                    transaction_date:        payload.transaction_date || null,
                    xData,
                }),
            },
        });
        toast.success(`Job ${job.job_no} → ${transition.targetName}`);
        setPendingTran(null);
        if (branchId) void loadData(Number(branchId), searchQ, page, filter);
    } catch {
        toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
    } finally {
        setSubmitting(false);
    }
}
```

### 3f. New handler: `handleUndoConfirm`

Copy from `job-pipeline-status-drilldown.tsx` with type change:

```ts
async function handleUndoConfirm(job: JobSearchRow) {
    if (!dbName || !schema) return;
    setSubmitting(true);
    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.undoJobTransaction,
            variables: {
                db_name: dbName, schema,
                value: encodeObj({
                    job_id:                  job.id,
                    last_transaction_id:     job.last_transaction_id,
                    performed_by_user_id:    currentUser?.id ?? null,
                }),
            },
        });
        toast.success(`Undo successful — Job #${job.job_no} restored to previous status.`);
        setUndoPendingJob(null);
        if (branchId) void loadData(Number(branchId), searchQ, page, filter);
    } catch (err) {
        const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
            ?? "Failed to undo transaction. Please refresh and try again.";
        toast.error(msg);
    } finally {
        setSubmitting(false);
    }
}
```

### 3g. Actions column — add transaction button

In the `<td>` for actions (currently has Eye + FileDown), add the `ArrowRightLeft` dropdown **between Eye and FileDown**:

```tsx
{/* Transaction dropdown */}
{(() => {
    const transitions  = getTransitions(job.job_status_id, job.job_type_code);
    const isNoAction   = NO_ACTION_CODES.has(job.job_status_code);
    const rowCanUndo   = canUndo(job);
    const showCharges  = ADD_CHARGES_CODES.has(job.job_status_code)
                      && !NO_CHARGES_JOB_TYPES.has(job.job_type_code);

    if (isNoAction && !rowCanUndo) {
        return (
            <span className="flex h-8 w-8 items-center justify-center">
                <Lock className="h-3.5 w-3.5 text-(--cl-text-muted) opacity-40" />
            </span>
        );
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    className="h-8 w-8 p-0 text-(--cl-accent) hover:text-white hover:bg-(--cl-accent) rounded-lg transition-colors"
                    disabled={submitting}
                    size="icon"
                    title="Status actions"
                    variant="ghost"
                >
                    <ArrowRightLeft className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-1 z-50">
                {!isNoAction && (
                    <>
                        <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            Move job to
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                        {transitions.length === 0 ? (
                            <DropdownMenuItem disabled className="rounded-lg text-sm text-zinc-400 py-2.5 px-3 italic">
                                No transitions available
                            </DropdownMenuItem>
                        ) : transitions.map(t => {
                            const dotBg = STATUS_COLORS[t.targetCode]?.trim().split(/\s+/)[0] ?? "bg-slate-400";
                            return (
                                <DropdownMenuItem
                                    key={`${t.targetId}-${t.targetName}`}
                                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:bg-zinc-50 dark:focus:bg-zinc-900"
                                    onClick={() => setPendingTran({ job, transition: t })}
                                >
                                    <span className={`h-3 w-3 shrink-0 rounded-full ${dotBg} shadow-sm`} />
                                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">{t.targetName}</span>
                                    <span className="text-zinc-300 dark:text-zinc-600">›</span>
                                </DropdownMenuItem>
                            );
                        })}
                    </>
                )}
                {rowCanUndo && (
                    <>
                        {!isNoAction && <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />}
                        <DropdownMenuItem
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                            onClick={() => setUndoPendingJob(job)}
                        >
                            <Undo2 className="h-3.5 w-3.5 shrink-0" />
                            Undo Last Transaction
                        </DropdownMenuItem>
                    </>
                )}
                {showCharges && (
                    <>
                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                        <DropdownMenuItem
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30"
                            onClick={() => setChargesJob({
                                id:              job.id,
                                job_no:          job.job_no,
                                customer_name:   job.customer_name ?? "",
                                job_status_name: job.job_status_name,
                                job_status_code: job.job_status_code,
                            })}
                        >
                            <Package className="h-3.5 w-3.5 shrink-0" />
                            Parts &amp; Charges
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
})()}
```

The actions cell should also have `onClick={e => e.stopPropagation()}` to prevent the row's `onClick={() => setViewJobId(job.id)}` from firing when clicking the dropdown.

### 3h. New modals at the end of the render tree

Add after the existing `<JobPdfModal>` and `<JobDetailsModal>` closing tags:

```tsx
{pendingTran && (
    <StatusTransitionModal
        divisions={divisions}
        job={{
            id:                          pendingTran.job.id,
            job_no:                      pendingTran.job.job_no,
            customer_name:               pendingTran.job.customer_name ?? "",
            job_status_name:             pendingTran.job.job_status_name,
            division_id:                 pendingTran.job.division_id ?? null,
            technician_id:               pendingTran.job.technician_id,
            job_receive_manner_name:     null,
            device_details:              pendingTran.job.device_details,
            job_receive_condition_name:  null,
        }}
        transition={pendingTran.transition}
        technicians={[]}              // technicians list — load separately if needed, or pass [] initially
        onClose={() => setPendingTran(null)}
        onSubmit={payload => handleSubmitTransition(pendingTran.job, pendingTran.transition, payload)}
    />
)}

{undoPendingJob && (
    <UndoTransactionDialog
        job={{
            job_no:                  undoPendingJob.job_no,
            customer_name:           undoPendingJob.customer_name,
            job_receive_manner_name: null,
            device_details:          undoPendingJob.device_details,
            job_status_name:         undoPendingJob.job_status_name,
        }}
        submitting={submitting}
        onConfirm={() => void handleUndoConfirm(undoPendingJob)}
        onClose={() => setUndoPendingJob(null)}
    />
)}

{chargesJob && (
    <JobChargesModal
        job={chargesJob}
        dbName={dbName ?? ""}
        schema={schema ?? ""}
        onClose={() => setChargesJob(null)}
        onSaved={() => {
            setChargesJob(null);
            if (branchId) void loadData(Number(branchId), searchQ, page, filter);
        }}
    />
)}
```

---

## 4. Technicians — load for `StatusTransitionModal`

`StatusTransitionModal` accepts a `technicians` prop to populate the technician selector.
The drilldown loads them via a prop from its parent. In `job-search-section.tsx` there is no technician list yet.

**Option A (recommended):** Load technicians once on mount, alongside `jobStatuses`:

```ts
const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);

// in the existing useEffect that loads jobStatuses, add:
apolloClient.query<GenericQueryData<TechnicianRow>>({
    fetchPolicy: "network-only",
    query: GRAPHQL_MAP.genericQuery,
    variables: {
        db_name: dbName, schema,
        value: graphQlUtils.buildGenericQueryValue({
            sqlId: SQL_MAP.GET_TECHNICIANS_BY_BRANCH,
            sqlArgs: { branch_id: branchId },
        }),
    },
}).then(res => setTechnicians(res.data?.genericQuery ?? []));
```

Then pass `technicians={technicians}` to `StatusTransitionModal`.

**Check:** Verify `SQL_MAP.GET_TECHNICIANS_BY_BRANCH` exists; it is already used in `job-pipeline-section.tsx` for the same purpose.

---

## 5. Files changed

| File | Change |
|---|---|
| `app/db/sql_store.py` | Add 6 columns to `GET_JOB_SEARCH_PAGED` SELECT |
| `src/features/client/types/job.ts` | Extend `JobSearchRow` with 4 new fields; make 2 optional fields required |
| `src/features/client/components/jobs/job-search/job-search-section.tsx` | All state, imports, constants, handlers, actions column, modals |

No changes to `status-transitions.ts`, `status-transition-modal.tsx`, `undo-transaction-dialog.tsx`, or `job-charges-modal.tsx`.

---

## 6. Verification

1. Open Job Search → an `ArrowRightLeft` icon appears in the Actions column for open jobs; a `Lock` icon for terminal-state jobs (DELIVERED_OK, DELIVERED_NOT_OK, COMPLETED_OK, RETURN) with no undo available.
2. Click the icon on a job in `RECEIVED` status → dropdown shows eligible target statuses (e.g., ASSIGNED, IN_PROGRESS). Click one → `StatusTransitionModal` opens → fill & confirm → row refreshes to new status.
3. Click the icon on a job with `transaction_count > 0` → "Undo Last Transaction" appears at bottom of dropdown. Confirm → row refreshes.
4. Click the icon on a job in `IN_PROGRESS` with a chargeable job type → "Parts & Charges" item appears → opens `JobChargesModal`.
5. Terminal-state job (DELIVERED_OK) with `transaction_count = 0` → Lock icon, no dropdown.
6. Row click still opens `JobDetailsModal` (stopPropagation on actions cell verified).
