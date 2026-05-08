# Update Job — Comprehensive Implementation Plan

Source: `plans/tran.md`

---

## Overview of Changes

1. **Transition table overhaul** — replace static transitions with job-type-aware rules from tran.md
2. **Modal always opens** — remarks + date shown for every transition (no silent auto-submit)
3. **Technician mandatory** for Assigned target when none is currently set
4. **Parts grid in modal** — inline add/delete for COMPLETED_OK and IN_PROGRESS targets
5. **No-action statuses** — COMPLETED_OK, RETURN, DELIVERED_OK, DELIVERED_NOT_OK already locked (verify)
6. **New status** — RECEIVED_BACK_FROM_COMPANY (ID 17) wired in on both client and server side

---

## Server Side

### File: `app/graphql/resolvers/mutation_helper.py`  (lines 976–1027)

**Change: accept `transaction_date` and pass it to `performed_at` in `job_transaction`**

```python
# after line 984 (transaction_notes pop):
transaction_date = payload.pop("transaction_date", None)

# inside txn_data build (after line 1012):
if transaction_date:
    txn_data["performed_at"] = transaction_date
```

No other server changes needed. `RECEIVED_BACK_FROM_COMPANY` (ID 17) already exists in the DB.

---

## Client Side

### 1. `src/features/client/components/jobs/update-job/status-transitions.ts`

#### 1a. Extend `TransitionFields` type
```ts
export type TransitionFields = "none" | "R" | "RT" | "RA" | "RE" | "P" | "RAP";
// "P"   = parts grid (+ default remarks/date)
// "RAP" = amount + parts grid (+ default remarks/date)
```

#### 1b. Add RECEIVED_BACK_FROM_COMPANY to `STATUS_FLAGS`
```ts
17: { is_final: false, is_closed: false }, // RECEIVED_BACK_FROM_COMPANY
```

#### 1c. Add to `STATUS_COLORS`
```ts
RECEIVED_BACK_FROM_COMPANY: "bg-sky-600 hover:bg-sky-700 text-white",
```

#### 1d. Replace `TRANSITIONS` map with `getTransitions(statusId, jobTypeCode)` function

The function returns `Transition[]` based on the new rules from tran.md.
Key logic: only `statusId === 1` (RECEIVED) branches on `jobTypeCode`.

```ts
export function getTransitions(statusId: number, jobTypeCode: string): Transition[] {
    switch (statusId) {
        case 1: // RECEIVED
            if (jobTypeCode === "ESTIMATE")
                return [
                    { targetId: 2,  targetCode: "ASSIGNED",  targetName: "Assigned",  fields: "RT" },
                    { targetId: 3,  targetCode: "ESTIMATED", targetName: "Estimated", fields: "RE" },
                ];
            return [
                { targetId: 2, targetCode: "ASSIGNED",    targetName: "Assigned",    fields: "RT" },
                { targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P"  },
            ];
        case 2: // ASSIGNED
            return [
                { targetId: 2, targetCode: "ASSIGNED",    targetName: "Re-Assign",   fields: "RT" },
                { targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P"  },
            ];
        case 3: // ESTIMATED
            return [
                { targetId: 4, targetCode: "ESTIMATE_APPROVED", targetName: "Estimate Approved", fields: "R" },
                { targetId: 5, targetCode: "ESTIMATE_REJECTED", targetName: "Estimate Rejected", fields: "R" },
                { targetId: 6, targetCode: "IN_PROGRESS",       targetName: "In Progress",       fields: "P" },
            ];
        case 4: // ESTIMATE_APPROVED
            return [
                { targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P" },
            ];
        case 5: // ESTIMATE_REJECTED
            return [
                { targetId: 12, targetCode: "RETURN", targetName: "Return", fields: "R" },
            ];
        case 6: // IN_PROGRESS
            return [
                { targetId: 2,  targetCode: "ASSIGNED",       targetName: "Re-Assign",       fields: "RT"  },
                { targetId: 6,  targetCode: "IN_PROGRESS",    targetName: "Re-start",        fields: "P"   },
                { targetId: 7,  targetCode: "PARTS_PENDING",  targetName: "Parts Pending",   fields: "R"   },
                { targetId: 8,  targetCode: "ON_HOLD",        targetName: "On Hold",         fields: "R"   },
                { targetId: 9,  targetCode: "OUTSOURCED",     targetName: "Outsourced",      fields: "R"   },
                { targetId: 10, targetCode: "SENT_TO_COMPANY",targetName: "Sent to Company", fields: "R"   },
                { targetId: 11, targetCode: "COMPLETED_OK",   targetName: "Completed OK",    fields: "RAP" },
                { targetId: 12, targetCode: "RETURN",         targetName: "Return",          fields: "R"   },
                { targetId: 15, targetCode: "CANCELLED",      targetName: "Cancelled",       fields: "R"   },
                { targetId: 16, targetCode: "DISPOSED",       targetName: "Disposed",        fields: "R"   },
            ];
        case 7: // PARTS_PENDING
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P" }];
        case 8: // ON_HOLD
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P" }];
        case 9: // OUTSOURCED
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P" }];
        case 10: // SENT_TO_COMPANY
            return [{ targetId: 17, targetCode: "RECEIVED_BACK_FROM_COMPANY", targetName: "Received Back", fields: "R" }];
        case 15: // CANCELLED
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "Re-open", fields: "P" }];
        case 16: // DISPOSED
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "Re-open", fields: "P" }];
        case 17: // RECEIVED_BACK_FROM_COMPANY
            return [{ targetId: 6, targetCode: "IN_PROGRESS", targetName: "In Progress", fields: "P" }];
        default:
            return [];
    }
}
```

Remove the old `TRANSITIONS` map export. Keep `STATUS_FLAGS` and `STATUS_COLORS` as-is (add ID 17 entries).

---

### 2. `src/features/client/components/jobs/update-job/status-transition-modal.tsx`

#### 2a. Update Props — add `jobId`, `dbName`, `schema`
```ts
type Props = {
    job:         JobSummary;       // add id: number to JobSummary
    transition:  Transition;
    technicians: TechnicianRow[];
    dbName:      string;
    schema:      string;
    onClose:     () => void;
    onSubmit:    (payload: TransitionPayload) => Promise<void>;
};
```

#### 2b. Update `TransitionPayload`
```ts
export type TransitionPayload = {
    targetStatusId:   number;
    technician_id:    number | null;
    amount:           number | null;
    estimate_amount:  number | null;
    remarks:          string;
    transaction_date: string;           // ISO date string "YYYY-MM-DD"
    is_final:         boolean;
    is_closed:        boolean;
    partsData?: {
        newLines:   { part_id: number; quantity: number; remarks: string }[];
        deletedIds: number[];
    };
};
```

#### 2c. Zod schema update
```ts
const schema = z.object({
    technician_id:    z.string().optional(),
    amount:           z.string().optional(),
    estimate_amount:  z.string().optional(),
    remarks:          z.string().optional(),
    transaction_date: z.string().min(1, "Date is required"),
});
```
Default `transaction_date` = today (`new Date().toISOString().slice(0, 10)`).

#### 2d. Parts state (inside component)
```ts
type ExistingPartRow = { id: number; part_id: number; part_code: string; part_name: string; uom: string; quantity: number; remarks: string };
type NewPartRow      = { _key: string; part_id: number | null; part_code: string; part_name: string; uom: string; quantity: number; remarks: string };

const needsParts = fields === "P" || fields === "RAP";
const [existingParts, setExistingParts] = useState<ExistingPartRow[]>([]);
const [newParts,      setNewParts]      = useState<NewPartRow[]>([]);
const [deletedIds,    setDeletedIds]    = useState<number[]>([]);
```

Load on mount (only when `needsParts`):
```ts
useEffect(() => {
    if (!needsParts) return;
    apolloClient.query({
        fetchPolicy: "network-only",
        query: GRAPHQL_MAP.genericQuery,
        variables: { db_name: dbName, schema,
            value: graphQlUtils.buildGenericQueryValue({
                sqlId:   SQL_MAP.GET_JOB_PART_USED_BY_JOB,
                sqlArgs: { p_job_id: job.id },
            }),
        },
    }).then(r => setExistingParts(r.data?.genericQuery ?? []));
}, []);
```

#### 2e. UI — always-visible fields
Remove `fields !== "none"` guard on Remarks. Add Date before Remarks, both always visible:

```tsx
{/* Date — always */}
<div>
    <Label htmlFor="stm-date">Date</Label>
    <Input id="stm-date" type="date" {...form.register("transaction_date")} />
</div>

{/* Remarks — always */}
<div>
    <Label htmlFor="stm-remarks">Remarks</Label>
    <Textarea id="stm-remarks" placeholder="Optional remarks…" {...form.register("remarks")} />
</div>
```

#### 2f. UI — Technician (required for RT)
```tsx
{fields === "RT" && (
    <div>
        <Label>Technician <span className="text-red-500">*</span></Label>
        <Select value={form.watch("technician_id")} onValueChange={v => form.setValue("technician_id", v)}>
            ...
        </Select>
        {form.formState.errors.technician_id && (
            <p className="text-xs text-red-500 mt-1">Technician is required</p>
        )}
    </div>
)}
```
In `handleSubmit`, add guard:
```ts
if (fields === "RT" && !values.technician_id) {
    form.setError("technician_id", { message: "Technician is required" });
    return;
}
```

#### 2g. UI — Amount (RA or RAP)
```tsx
{(fields === "RA" || fields === "RAP") && <AmountInput />}
```

#### 2h. UI — Parts grid (P or RAP)
Compact inline table — shown when `needsParts`. Widen the dialog to `max-w-2xl`.

Table columns: `Part Code | Part Name | UOM | Qty | Remarks | ✕`

**Existing parts rows** (from `existingParts`):
- Display-only part_code, part_name, uom
- Editable qty and remarks
- Delete button → append id to `deletedIds`, remove from `existingParts`

**New part rows** (from `newParts`):
- Editable part_code input; on blur → call `GET_SPARE_PART_BY_CODE` (or existing lookup SQL) to fill part_id, part_name, uom
- Editable qty, remarks
- Delete button → remove from `newParts`

**Add Part button** → appends a blank `NewPartRow` to `newParts`

Reuse part lookup pattern from:
`src/features/client/components/jobs/part-used/new-part-used-form.tsx`
(Check which SQL_MAP key is used for part code lookup there)

#### 2i. Updated `handleSubmit`
```ts
async function handleSubmit(values: FormValues) {
    if (fields === "RT" && !values.technician_id) { ... return; }
    await onSubmit({
        targetStatusId:   transition.targetId,
        technician_id:    values.technician_id ? Number(values.technician_id) : null,
        amount:           values.amount          ? Number(values.amount)          : null,
        estimate_amount:  values.estimate_amount ? Number(values.estimate_amount) : null,
        remarks:          values.remarks ?? "",
        transaction_date: values.transaction_date,
        is_final:         false,
        is_closed:        false,
        partsData: needsParts ? {
            newLines:   newParts.filter(p => p.part_id).map(p => ({
                part_id:  p.part_id!,
                quantity: p.quantity,
                remarks:  p.remarks,
            })),
            deletedIds,
        } : undefined,
    });
}
```

---

### 3. `src/features/client/components/jobs/update-job/update-job-section.tsx`

#### 3a. Import update
```ts
import { getTransitions, STATUS_FLAGS, STATUS_COLORS } from "./status-transitions";
// Remove: TRANSITIONS import
```

#### 3b. Row render — switch to `getTransitions`
```ts
// OLD: const transitions = TRANSITIONS[row.job_status_id] ?? [];
const transitions = getTransitions(row.job_status_id, row.job_type_code);
```

#### 3c. `handleTransitionClick` — always open modal
```ts
function handleTransitionClick(job: OpenJobRow, transition: Transition) {
    setPendingTran({ job, transition });   // remove the "none" shortcut
}
```

#### 3d. `handleSubmitTransition` — add date + parts save
```ts
async function handleSubmitTransition(job, transition, payload) {
    if (!dbName || !schema) return;
    setSubmitting(true);
    try {
        const flags = STATUS_FLAGS[transition.targetId];
        const xData = {
            id:              job.id,
            job_status_id:   transition.targetId,
            technician_id:   payload.technician_id,
            amount:          (transition.fields === "RA" || transition.fields === "RAP") ? payload.amount : job.amount,
            estimate_amount: transition.fields === "RE" ? payload.estimate_amount : job.estimate_amount,
            is_final:        flags?.is_final  ?? false,
            is_closed:       flags?.is_closed ?? false,
        };

        await apolloClient.mutate({
            mutation:  GRAPHQL_MAP.updateJob,
            variables: {
                db_name: dbName, schema,
                value: encodeObj({
                    job_id:               job.id,
                    last_transaction_id:  job.last_transaction_id,
                    performed_by_user_id: currentUser?.id ?? null,
                    transaction_notes:    payload.remarks || "",
                    transaction_date:     payload.transaction_date || null,
                    xData,
                }),
            },
        });

        // Save parts if any
        const pd = payload.partsData;
        if (pd && (pd.newLines.length || pd.deletedIds.length)) {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        tableName:  "job_part_used",
                        deletedIds: pd.deletedIds,
                        xData: pd.newLines.map(l => ({
                            job_id:   job.id,
                            part_id:  l.part_id,
                            quantity: l.quantity,
                            remarks:  l.remarks || null,
                        })),
                    }),
                },
            });
        }

        toast.success(`Job ${job.job_no} → ${transition.targetName}`);
        setPendingTran(null);
        if (branchId) void loadData(branchId, filterStatusId, page);
    } catch {
        toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
    } finally {
        setSubmitting(false);
    }
}
```

#### 3e. Pass new props to `StatusTransitionModal`
```tsx
<StatusTransitionModal
    job={pendingTran.job}
    transition={pendingTran.transition}
    technicians={technicians}
    dbName={dbName ?? ""}
    schema={schema ?? ""}
    onClose={() => setPendingTran(null)}
    onSubmit={payload => handleSubmitTransition(pendingTran.job, pendingTran.transition, payload)}
/>
```

---

## Verification Checklist

- [ ] RECEIVED + Estimate job → only Assigned and Estimated in dropdown
- [ ] RECEIVED + non-Estimate job → only Assigned and In Progress
- [ ] ASSIGNED → Re-Assign and In Progress only
- [ ] IN_PROGRESS → 10 options including Re-start and Re-Assign
- [ ] SENT_TO_COMPANY → only "Received Back" option
- [ ] CANCELLED / DISPOSED → only "Re-open" (In Progress)
- [ ] RECEIVED_BACK_FROM_COMPANY appears in filter strip; only In Progress option
- [ ] Every transition opens modal — including previously silent "none" transitions
- [ ] Date and Remarks present in every modal
- [ ] Technician required for RT transitions — blocked if not selected
- [ ] Parts grid visible for COMPLETED_OK and IN_PROGRESS targets
- [ ] Existing parts pre-loaded in grid when job already has parts
- [ ] Adding part → inserts into job_part_used on save
- [ ] Deleting part → removes from job_part_used on save
- [ ] Transaction date stored correctly in job_transaction.performed_at
- [ ] COMPLETED_OK, RETURN, DELIVERED_OK, DELIVERED_NOT_OK rows → lock icon, no dropdown
- [ ] "All" view → lock icon on every row, no actions
