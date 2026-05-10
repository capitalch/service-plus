# Plan: Apply logic-status-change.md to code

## Summary of changes

Three files need updating to match the revised logic documented in `logic-status-change.md`:

1. `status-transitions.ts` — type rename, STATUS_FLAGS corrections, transition map updates
2. `status-transition-modal.tsx` — field condition checks
3. `job-pipeline-status-detail.tsx` — xData field conditions

---

## File 1 — `status-transitions.ts`

### 1a. Rename `TransitionFields` type values

```ts
// Before
export type TransitionFields = "none" | "R" | "RT" | "RA" | "RE" | "P" | "RAP";

// After
export type TransitionFields = "none" | "R" | "RT" | "RAT" | "RET" | "PT" | "RAPT";
```

### 1b. Fix `STATUS_FLAGS`

| Status id | Current              | Change to            |
|-----------|----------------------|----------------------|
| 11 COMPLETED_OK     | `(false, false)` | `is_final: true,  is_closed: false` |
| 12 RETURN           | `(false, false)` | `is_final: true,  is_closed: false` |
| 13 DELIVERED_OK     | `(false, false)` | `is_final: false, is_closed: true`  |
| 14 DELIVERED_NOT_OK | `(false, false)` | `is_final: false, is_closed: true`  |
| 15 CANCELLED        | `(true,  true)`  | `is_final: true,  is_closed: false` |
| 16 DISPOSED         | `(true,  true)`  | no change                           |

### 1c. Update `getTransitions` — rename field codes and add new targets

| Case | Change |
|------|--------|
| 1 RECEIVED (ESTIMATE) | `"RE"` → `"RET"` |
| 1 RECEIVED (other)    | `"P"` → `"PT"`, `"RAP"` → `"RAPT"`, add `{ targetId: 3, targetCode: "ESTIMATED", targetName: "Estimated", fields: "RET" }` |
| 2 ASSIGNED            | `"P"` → `"PT"` |
| 3 ESTIMATED           | `"P"` → `"PT"` |
| 4 ESTIMATE_APPROVED   | `"P"` → `"PT"` |
| 6 IN_PROGRESS         | `"P"` (Re-start) → `"PT"`, `"RAP"` → `"RAPT"`, add `{ targetId: 3, targetCode: "ESTIMATED", targetName: "Estimated", fields: "RET" }` |
| 7 PARTS_PENDING       | `"P"` → `"PT"` |
| 8 ON_HOLD             | `"P"` → `"PT"` |
| 9 OUTSOURCED          | `"P"` → `"PT"` |
| 15 CANCELLED          | `"P"` → `"PT"` |
| 16 DISPOSED           | `"P"` → `"PT"` |
| 17 RECEIVED_BACK      | `"P"` → `"PT"` |

---

## File 2 — `status-transition-modal.tsx`

### Line 100 — `needsParts`
```ts
// Before
const needsParts = fields === "P" || fields === "RAP";

// After
const needsParts = fields === "PT" || fields === "RAPT";
```

### Line 196 — Technician validation in `handleSubmit`
```ts
// Before
if (fields === "RT" && !values.technician_id) {

// After
if (fields.includes("T") && !values.technician_id) {
```

### Line 249 — Technician field render
```tsx
// Before
{fields === "RT" && (

// After
{fields.includes("T") && (
```

### Line 274 — Estimate amount field render
```tsx
// Before
{fields === "RE" && (

// After
{fields === "RET" && (
```

### Line 292 — Amount field render
```tsx
// Before
{(fields === "RA" || fields === "RAP") && (

// After
{(fields === "RAT" || fields === "RAPT") && (
```

---

## File 3 — `job-pipeline-status-detail.tsx`

### Lines 150–151 — `xData` field conditions in `handleSubmitTransition`
```ts
// Before
amount:          (transition.fields === "RA" || transition.fields === "RAP") ? payload.amount : job.amount,
estimate_amount: transition.fields === "RE" ? payload.estimate_amount : job.estimate_amount,

// After
amount:          (transition.fields === "RAT" || transition.fields === "RAPT") ? payload.amount : job.amount,
estimate_amount: transition.fields === "RET" ? payload.estimate_amount : job.estimate_amount,
```

---

## Implementation order

1. `status-transitions.ts` — type, STATUS_FLAGS, getTransitions
2. `status-transition-modal.tsx` — all five condition changes
3. `job-pipeline-status-detail.tsx` — two condition changes
4. `tsc --noEmit` — verify zero errors
