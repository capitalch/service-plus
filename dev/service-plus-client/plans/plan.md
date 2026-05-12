# Implementation Plan — Additional Charges (C) in Job Status Transition

Reference: `plans/logic-status-change.md`

---

## Overview

Add an **Additional Charges** grid (field-code letter `C`) to the status-transition modal. Charges are stored in the existing `job_additional_charge` table. The block appears on every transition whose target is **IN_PROGRESS (6)** or **COMPLETED_OK (11)**, identified by `fields.includes("C")` in the new field codes `PCT` and `RACPT`.

No DB migration and no server-side resolver changes are needed — the table already exists and `genericUpdate` already handles arbitrary table inserts via `exec_sql_object`.

### `job_additional_charge` table (existing)

```
id            bigint   generated always as identity
job_id        bigint   NOT NULL  FK → job(id) ON DELETE CASCADE
charge_name   text     NOT NULL
ref_no        text     nullable
description   text     nullable
cost_price    numeric(12,2)  NOT NULL  DEFAULT 0  CHECK >= 0
selling_price numeric(12,2)  NOT NULL  DEFAULT 0  CHECK >= 0
created_at    timestamptz    NOT NULL  DEFAULT now()
```

---

## Files to change

| # | File | Change |
|---|------|--------|
| 1 | `status-transitions.ts` | Add `"PCT"` and `"RACPT"` to `TransitionFields`; update all `getTransitions()` rows |
| 2 | `status-transition-modal.tsx` | Add type, state, UI block, and payload field for charges |
| 3 | `job-pipeline-status-detail.tsx` | Switch to `fields.includes()` checks; submit `chargesData` |

---

## Step 1 — `status-transitions.ts`

**`TransitionFields` type** — add the two new codes:

```ts
export type TransitionFields = "none" | "R" | "RT" | "RAT" | "RET" | "PCT" | "RACPT";
```

(`PT` and `RAPT` are removed — they are fully replaced.)

**`getTransitions()`** — change every entry whose `fields` is `"PT"` → `"PCT"` and every `"RAPT"` → `"RACPT"`. Affected rows:

| From status | Target | Old code | New code |
|-------------|--------|----------|----------|
| 1 (other)   | 6      | `PT`     | `PCT`    |
| 1 (other)   | 11     | `RAPT`   | `RACPT`  |
| 2           | 6      | `PT`     | `PCT`    |
| 3           | 6      | `PT`     | `PCT`    |
| 4           | 6      | `PT`     | `PCT`    |
| 6           | 6      | `PT`     | `PCT`    |
| 6           | 11     | `RAPT`   | `RACPT`  |
| 7           | 6      | `PT`     | `PCT`    |
| 8           | 6      | `PT`     | `PCT`    |
| 9           | 6      | `PT`     | `PCT`    |
| 15          | 6      | `PT`     | `PCT`    |
| 16          | 6      | `PT`     | `PCT`    |
| 17          | 6      | `PT`     | `PCT`    |

---

## Step 2 — `status-transition-modal.tsx`

### 2a. New type

```ts
type AdditionalChargeRow = {
    _key:         string;
    charge_name:  string;
    ref_no:       string;
    description:  string;
    cost_price:   number;
    selling_price: number;
};
```

### 2b. Extend `TransitionPayload`

```ts
export type TransitionPayload = {
    // ... existing fields ...
    chargesData?: {
        lines: { charge_name: string; ref_no: string; description: string; cost_price: number; selling_price: number }[];
    };
};
```

### 2c. Derived booleans (replace existing hardcoded checks)

```ts
const needsParts   = fields.includes("P");
const needsCharges = fields.includes("C");
const showPricing  = fields.includes("A") || fields.includes("E");
```

Remove old `needsParts = fields === "PT" || fields === "RAPT"` and `showPricing = fields === "RET" || ...`.

### 2d. New state

```ts
const [newCharges, setNewCharges] = useState<AdditionalChargeRow[]>([]);
```

### 2e. Helper functions

```ts
function addChargeRow() {
    setNewCharges(prev => [...prev, { _key: crypto.randomUUID(), charge_name: "", ref_no: "", description: "", cost_price: 0, selling_price: 0 }]);
}
function removeChargeRow(key: string) {
    setNewCharges(prev => prev.filter(r => r._key !== key));
}
function updateCharge(key: string, field: keyof AdditionalChargeRow, value: string | number) {
    setNewCharges(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
}
```

### 2f. Modal width

Change the `sm:max-w-4xl` condition to also trigger when `needsCharges`:

```ts
const isWide = needsParts || needsCharges;
<DialogContent className={`${isWide ? "sm:max-w-4xl" : "sm:max-w-lg"} ...`}>
```

### 2g. Additional Charges UI block

Add below the Parts Used block, guarded by `{needsCharges && (...)}`:

Columns shown: `#`, Charge Name, Ref No, Description, Cost Price, Selling Price, (delete button).

```tsx
{needsCharges && (
    <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Additional Charges
            </h4>
            <Button className="h-6 px-2 text-xs" size="sm" type="button" onClick={addChargeRow}>
                + Add Charge
            </Button>
        </div>
        <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full border-collapse text-xs">
                <thead>
                    <tr className="sticky top-0 z-10">
                        <th className={`${thCls} w-8 text-center`}>#</th>
                        <th className={thCls}>Charge Name</th>
                        <th className={thCls}>Ref No</th>
                        <th className={thCls}>Description</th>
                        <th className={`${thCls} text-right`}>Cost Price</th>
                        <th className={`${thCls} text-right`}>Selling Price</th>
                        <th className={`${thCls} w-10`}></th>
                    </tr>
                </thead>
                <tbody>
                    {newCharges.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-2 py-3 text-center text-xs text-muted-foreground italic">
                                No charges added. Click &quot;+ Add Charge&quot; to add.
                            </td>
                        </tr>
                    )}
                    {newCharges.map((row, idx) => (
                        <tr key={row._key} className="hover:bg-muted/30">
                            <td className={`${tdCls} text-center text-muted-foreground`}>{idx + 1}</td>
                            <td className={tdCls}>
                                <Input className="h-6 rounded-sm text-xs px-1" placeholder="e.g. Labour charge"
                                    value={row.charge_name}
                                    onChange={e => updateCharge(row._key, "charge_name", e.target.value)} />
                            </td>
                            <td className={tdCls}>
                                <Input className="h-6 w-24 rounded-sm text-xs px-1" placeholder="Ref…"
                                    value={row.ref_no}
                                    onChange={e => updateCharge(row._key, "ref_no", e.target.value)} />
                            </td>
                            <td className={tdCls}>
                                <Input className="h-6 rounded-sm text-xs px-1" placeholder="Description…"
                                    value={row.description}
                                    onChange={e => updateCharge(row._key, "description", e.target.value)} />
                            </td>
                            <td className={tdCls}>
                                <Input className="h-6 w-24 rounded-sm text-xs text-right px-1"
                                    type="number" min={0} step="0.01" placeholder="0.00"
                                    value={row.cost_price === 0 ? "" : row.cost_price}
                                    onChange={e => updateCharge(row._key, "cost_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                            </td>
                            <td className={tdCls}>
                                <Input className="h-6 w-24 rounded-sm text-xs text-right px-1"
                                    type="number" min={0} step="0.01" placeholder="0.00"
                                    value={row.selling_price === 0 ? "" : row.selling_price}
                                    onChange={e => updateCharge(row._key, "selling_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                            </td>
                            <td className={tdCls}>
                                <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                    onClick={() => removeChargeRow(row._key)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
)}
```

### 2h. Include chargesData in submit

In `handleSubmit`, add:

```ts
chargesData: needsCharges
    ? { lines: newCharges.filter(r => r.charge_name.trim()).map(r => ({
          charge_name:  r.charge_name.trim(),
          ref_no:       r.ref_no,
          description:  r.description,
          cost_price:   r.cost_price,
          selling_price: r.selling_price,
      })) }
    : undefined,
```

---

## Step 3 — `job-pipeline-status-detail.tsx`

### 3a. Fix `xData` amount/estimate conditions (line ~151)

Replace:
```ts
amount:          (transition.fields === "RAT" || transition.fields === "RAPT") ? payload.amount : job.amount,
estimate_amount: transition.fields === "RET" ? payload.estimate_amount : job.estimate_amount,
```
With:
```ts
amount:          transition.fields.includes("A") ? payload.amount : job.amount,
estimate_amount: transition.fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
```

### 3b. Add chargesData submit (after the `partsData` block, ~line 191)

```ts
const cd = payload.chargesData;
if (cd && cd.lines.length) {
    await apolloClient.mutate({
        mutation:  GRAPHQL_MAP.genericUpdate,
        variables: {
            db_name: dbName, schema,
            value: encodeObj({
                tableName: "job_additional_charge",
                xData: cd.lines.map(l => ({
                    job_id:        job.id,
                    charge_name:   l.charge_name,
                    ref_no:        l.ref_no || null,
                    description:   l.description || null,
                    cost_price:    l.cost_price,
                    selling_price: l.selling_price,
                })),
            }),
        },
    });
}
```

---

## Execution order

1. Update `status-transitions.ts` (type + all `getTransitions` rows).
2. Update `status-transition-modal.tsx` (type, state, helpers, UI, submit).
3. Update `job-pipeline-status-detail.tsx` (conditions + charges submit).
4. Test: open a transition to IN_PROGRESS or COMPLETED_OK — Additional Charges block must appear below Parts Used. Add a charge, submit, verify row in `job_additional_charge` (columns: `charge_name`, `ref_no`, `description`, `cost_price`, `selling_price`). Test that other transitions (e.g. to RETURN) do not show the block.
