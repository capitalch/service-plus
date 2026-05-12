# Implementation Plan: Undo Last Transaction

Sources: `plans/tran.md`, `plans/plan-undo-last-tran.md`

---

## Overview

Add an **"Undo Last Transaction"** action (styled in red) to every job's action dropdown in the Update Job screen. This deletes the most recent `job_transaction` row and restores the job to its prior state. The action is available for all status filters except "All", including currently read-only statuses (COMPLETED_OK, RETURN). It is blocked for:
- Jobs in RECEIVED status with only one transaction (the initial creation transaction)
- Jobs in DELIVERED_OK or DELIVERED_NOT_OK status (delivered jobs cannot be undone)

---

## Files to Modify

| File | Change |
|------|--------|
| `service-plus-server/app/graphql/schema.graphql` | Add `undoJobTransaction` mutation |
| `service-plus-server/app/graphql/resolvers/mutation_helper.py` | Add `resolve_undo_job_transaction_helper` |
| `service-plus-server/app/graphql/resolvers/mutation.py` | Register `resolve_undo_job_transaction` |
| `service-plus-server/app/db/sql_store.py` | Add `transaction_count` to `GET_UPDATE_JOBS_PAGED` |
| `src/constants/graphql-map.ts` | Add `undoJobTransaction` mutation |
| `src/features/client/types/job.ts` | Add `transaction_count` to `OpenJobRow` (move it here from `update-job-section.tsx`) |
| `src/features/client/components/jobs/update-job/update-job-section.tsx` | Import `OpenJobRow` from types; add undo state, dropdown changes, `handleUndoConfirm`, undo dialog |

---

## Step 1 — Server: GraphQL Schema (`schema.graphql`)

Add one new mutation:

```graphql
undoJobTransaction(db_name: String!, schema: String, value: String!): Generic
```

---

## Step 2 — Server: Mutation Helper (`mutation_helper.py`)

Add `resolve_undo_job_transaction_helper`:

```python
async def resolve_undo_job_transaction_helper(
    db_name: str, schema: str = "public", value: str = ""
) -> Any:
    payload = _decode_value(value, "undoJobTransaction")
    job_id            = payload["job_id"]
    last_txn_id       = payload["last_transaction_id"]
    performed_by      = payload.get("performed_by_user_id")

    db_name_arg  = db_name or None
    schema_name  = schema or "public"

    async with get_db_connection(db_name_arg) as conn:
        async with conn.cursor() as cur:
            await cur.execute("SET search_path TO %s", (schema_name,))

            # 1. Fetch last transaction; confirm it matches job.last_transaction_id
            await cur.execute(
                """
                SELECT t.id, t.previous_transaction_id,
                       t.status_id, t.technician_id, t.amount
                FROM   job_transaction t
                JOIN   job j ON j.id = t.job_id
                WHERE  t.job_id = %s
                  AND  t.id     = %s
                  AND  j.last_transaction_id = %s
                """,
                (job_id, last_txn_id, last_txn_id),
            )
            last_txn = await cur.fetchone()
            if not last_txn:
                raise ValidationException("Transaction no longer current — page may be stale.")

            prev_txn_id = last_txn["previous_transaction_id"]
            if prev_txn_id is None:
                raise ValidationException("Cannot undo the initial transaction.")

            # 2. Fetch previous transaction to restore job state
            await cur.execute(
                """
                SELECT t.status_id, t.technician_id, t.amount,
                       s.is_final, s.is_closed
                FROM   job_transaction t
                JOIN   job_status s ON s.id = t.status_id
                WHERE  t.id = %s
                """,
                (prev_txn_id,),
            )
            prev_txn = await cur.fetchone()
            if not prev_txn:
                raise ValidationException("Previous transaction not found.")

            # 3. Delete the last transaction
            await cur.execute(
                "DELETE FROM job_transaction WHERE id = %s", (last_txn_id,)
            )

            # 4. Restore job to previous state
            await cur.execute(
                """
                UPDATE job
                SET    job_status_id        = %s,
                       technician_id        = %s,
                       amount               = %s,
                       is_final             = %s,
                       is_closed            = %s,
                       last_transaction_id  = %s
                WHERE  id = %s
                """,
                (
                    prev_txn["status_id"],
                    prev_txn["technician_id"],
                    prev_txn["amount"],
                    prev_txn["is_final"],
                    prev_txn["is_closed"],
                    prev_txn_id,
                    job_id,
                ),
            )
            await conn.commit()

    return {"job_id": job_id, "restored_transaction_id": prev_txn_id}
```

---

## Step 3 — Server: Mutation Resolver (`mutation.py`)

Register the new resolver after `deliverJob`:

```python
from app.graphql.resolvers.mutation_helper import resolve_undo_job_transaction_helper

@mutation.field("undoJobTransaction")
async def resolve_undo_job_transaction(_, info, db_name="", schema="public", value="") -> Any:
    try:
        return await resolve_undo_job_transaction_helper(db_name, schema, value)
    except ValidationException:
        raise
    except Exception as e:
        logger.error("Error undoing job transaction: %s", e, exc_info=True)
        raise GraphQLException(
            message=AppMessages.OPERATION_FAILED, extensions={"details": str(e)}
        )
```

---

## Step 4 — Server: SQL (`sql_store.py`)

Add `transaction_count` to the SELECT list of `GET_UPDATE_JOBS_PAGED`:

```sql
(SELECT COUNT(*) FROM job_transaction WHERE job_id = j.id) AS transaction_count
```

---

## Step 5 — Client: GraphQL Map (`graphql-map.ts`)

Add the new mutation:

```ts
undoJobTransaction: gql`
    mutation undoJobTransaction($db_name: String!, $schema: String, $value: String!) {
        undoJobTransaction(db_name: $db_name, schema: $schema, value: $value)
    }
`,
```

---

## Step 6 — Client: Types (`types/job.ts`)

Move `OpenJobRow` here from `update-job-section.tsx` and add `transaction_count`:

```ts
export type OpenJobRow = {
    // ... existing fields ...
    transaction_count: number;
};
```

---

## Step 7 — Client: Update Job Section (`update-job-section.tsx`)

### 7a. Update `OpenJobRow` import

Remove local `OpenJobRow` definition; import from `types/job.ts`.

### 7b. Undo state

```ts
const [undoPendingJob, setUndoPendingJob] = useState<OpenJobRow | null>(null);
```

### 7c. Helper — should show Undo

```ts
const NO_UNDO_CODES = new Set(["DELIVERED_OK", "DELIVERED_NOT_OK"]);

function canUndo(row: OpenJobRow): boolean {
    if (NO_UNDO_CODES.has(row.job_status_code)) return false;
    if (row.transaction_count <= 1) return false; // only the initial transaction, nothing to restore to
    return true;
}
```

### 7d. Change `isReadOnly` to `isAllView` / `isNoAction`

Old logic locked rows for `filterStatusId === null || NO_ACTION_CODES.has(row.job_status_code)`.

New logic: only lock when `filterStatusId === null` (All view). Read-only status rows still show the dropdown — but only the Undo item.

```ts
const isAllView  = filterStatusId === null;
const isNoAction = NO_ACTION_CODES.has(row.job_status_code);
```

- `isAllView` → show lock icon (no dropdown)
- `isNoAction && !isAllView && canUndo(row)` → show dropdown with **only** Undo item
- `isNoAction && !isAllView && !canUndo(row)` → show lock icon (delivered jobs, no actions possible)
- `!isNoAction && !isAllView` → show dropdown with transitions + separator + Undo item (Undo hidden if `!canUndo(row)`)

### 7e. Revised Actions cell render

```tsx
{isAllView ? (
    <span className="flex h-8 w-8 items-center justify-center">
        <Lock className="h-3.5 w-3.5 text-[var(--cl-text-muted)] opacity-40" />
    </span>
) : (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button className="h-8 w-8 p-0 ..." disabled={submitting} size="icon" variant="ghost">
                <MoreHorizontal className="h-5 w-5" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[210px] ...">
            {!isNoAction && transitions.length === 0 && (
                <DropdownMenuItem disabled className="text-sm text-[var(--cl-text-muted)] py-2.5">
                    No transitions available
                </DropdownMenuItem>
            )}
            {!isNoAction && transitions.map(t => (
                <DropdownMenuItem
                    key={`${t.targetId}-${t.targetName}`}
                    className="gap-2.5 text-sm font-medium py-2.5 cursor-pointer"
                    onClick={() => handleTransitionClick(row, t)}
                >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[t.targetCode]?.split(" ")[0] ?? "bg-slate-400"}`} />
                    → {t.targetName}
                </DropdownMenuItem>
            ))}

            {!isNoAction && canUndo(row) && (
                <DropdownMenuSeparator />
            )}
            {canUndo(row) && (
                <DropdownMenuItem
                    className="gap-2 text-sm font-medium py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => setUndoPendingJob(row)}
                >
                    <Undo2 className="h-3.5 w-3.5 shrink-0" />
                    Undo Last Transaction
                </DropdownMenuItem>
            )}
        </DropdownMenuContent>
    </DropdownMenu>
)}
```

Import `DropdownMenuSeparator` from shadcn and `Undo2` from lucide-react.

### 7f. `handleUndoConfirm`

```ts
async function handleUndoConfirm(job: OpenJobRow) {
    if (!dbName || !schema) return;
    setSubmitting(true);
    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.undoJobTransaction,
            variables: {
                db_name: dbName, schema,
                value: encodeObj({
                    job_id:               job.id,
                    last_transaction_id:  job.last_transaction_id,
                    performed_by_user_id: currentUser?.id ?? null,
                }),
            },
        });
        toast.success(`Undo successful — Job ${job.job_no} restored to previous status.`);
        setUndoPendingJob(null);
        if (branchId) void loadData(branchId, filterStatusId, page);
    } catch {
        toast.error("Failed to undo transaction. Please refresh and try again.");
    } finally {
        setSubmitting(false);
    }
}
```

### 7g. Undo confirmation dialog (inline in render)

```tsx
{undoPendingJob && (
    <Dialog open onOpenChange={open => { if (!open) setUndoPendingJob(null); }}>
        <DialogContent className="max-w-sm bg-white dark:bg-zinc-950 border-[var(--cl-border)]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Undo Last Transaction
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-[var(--cl-text)]">
                <p>
                    This will <span className="font-bold text-red-600">permanently delete</span> the
                    last transaction for Job{" "}
                    <span className="font-mono font-semibold text-[var(--cl-accent)]">#{undoPendingJob.job_no}</span>{" "}
                    and restore it to its previous status.
                </p>
                <p className="text-xs text-[var(--cl-text-muted)]">
                    Current status:{" "}
                    <span className="font-semibold">{undoPendingJob.job_status_name}</span>
                </p>
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                    This action cannot be undone.
                </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--cl-border)]">
                <Button
                    className="h-8 px-4 text-xs"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setUndoPendingJob(null)}
                >
                    Cancel
                </Button>
                <Button
                    className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                    disabled={submitting}
                    onClick={() => void handleUndoConfirm(undoPendingJob)}
                >
                    {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Yes, Undo
                </Button>
            </div>
        </DialogContent>
    </Dialog>
)}
```

Import `AlertTriangle` from lucide-react.

---

## Implementation Order

1. **Server** — `schema.graphql`: add `undoJobTransaction` mutation
2. **Server** — `mutation_helper.py`: add `resolve_undo_job_transaction_helper`
3. **Server** — `mutation.py`: register resolver
4. **Server** — `sql_store.py`: add `transaction_count` to `GET_UPDATE_JOBS_PAGED`
5. **`graphql-map.ts`**: add `undoJobTransaction` mutation
6. **`types/job.ts`**: move `OpenJobRow` here, add `transaction_count`
7. **`update-job-section.tsx`**: update import; add undo state, `canUndo`, revised dropdown, `handleUndoConfirm`, undo dialog

---

## Verification Checklist

- [ ] RECEIVED job with 1 transaction → "Undo Last Transaction" not visible in dropdown
- [ ] RECEIVED job with 2+ transactions → "Undo Last Transaction" visible
- [ ] ASSIGNED / IN_PROGRESS / etc. → Undo visible below a separator, below normal transitions
- [ ] COMPLETED_OK / RETURN → dropdown shows ONLY Undo (no transitions)
- [ ] DELIVERED_OK / DELIVERED_NOT_OK → lock icon, no dropdown (Undo not available for delivered jobs)
- [ ] "All" filter selected → lock icon, no dropdown at all
- [ ] Clicking Undo opens red warning dialog with correct job number and status
- [ ] Confirming Undo calls `undoJobTransaction`, restores job to previous status and reloads list
- [ ] Server blocks undo when `last_transaction_id` has changed since page loaded (stale data guard)
- [ ] Server blocks undo when `previous_transaction_id` is null (initial transaction)
- [ ] Toast success / error shown correctly
