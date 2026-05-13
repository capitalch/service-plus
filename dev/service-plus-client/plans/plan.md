# Plan: Simplify Job Pipeline — Remove Parts, Charges & Amount from Transitions

Source: `plans/tran.md`

---

## Goal

Remove Parts Used (P), Additional Charges (C), and Amount (A) from the Job Pipeline status-transition modal entirely. No standalone replacement sections are needed — parts and charges are not required for any job transaction at this time. Keep Estimate (E) in the pipeline.

---

## Current State

The `StatusTransitionModal` (opened from `JobPipelineStatusDetail`) currently includes:

- **P** — Parts Used: inline table to add/edit/delete parts consumed ← **remove**
- **C** — Additional Charges: inline table to add charge lines ← **remove**
- **A** — Amount: final job amount (set on COMPLETED_OK transition) ← **remove**
- **E** — Estimate amount (set on ESTIMATED transition) ← **keep**
- **T** — Technician assignment ← **keep**
- **R** — Remarks ← **keep**

Current `TransitionFields` type: `"none" | "R" | "RT" | "RAT" | "RET" | "PCT" | "RACPT"`

The `PCT` field combination appears on IN_PROGRESS transitions (Parts + Charges + Technician).  
The `RACPT` field combination appears on COMPLETED_OK transitions (Remarks + Amount + Charges + Parts + Technician).

---

## What Changes

### 1. `status-transitions.ts`

Remove `P`, `C`, and `A` from `TransitionFields`. Simplify to:

**New `TransitionFields` type:**
```ts
export type TransitionFields = "none" | "R" | "RT" | "RET";
```

**Field mapping changes in `getTransitions()`:**

| Transition | Old fields | New fields |
|---|---|---|
| → IN_PROGRESS | `PCT` | `RT` |
| → COMPLETED_OK | `RACPT` | `RT` |
| → ESTIMATED | `RET` | `RET` (unchanged) |
| → ASSIGNED / Re-Assign | `RT` | `RT` (unchanged) |
| → others (`R`) | `R` | `R` (unchanged) |

---

### 2. `status-transition-modal.tsx`

**Remove:**
- Types: `AdditionalChargeRow`, `ExistingPartRow`, `NewPartRow`
- From `TransitionPayload` type: `partsData` and `chargesData` fields; `amount` field
- State: `existingParts`, `newParts`, `deletedIds`, `brands`, `selectedBrandId`, `newCharges`
- Handler functions: `handleNewPartSelect`, `handleNewPartClear`, `resetParts`, `addNewPartRow`, `removeNewPartRow`, `deleteExistingPart`, `updateExistingPart`, `updateNewPart`, `addChargeRow`, `removeChargeRow`, `updateCharge`
- Both `useEffect` hooks that load existing parts and brands
- JSX: "Parts Used" section block
- JSX: "Additional Charges" section block
- JSX: "Amount" field from the Pricing section (keep Estimate only; if E is the only field shown, the Pricing section label can be renamed or left as-is)
- `needsParts` and `needsCharges` derived flags
- Import of `PartCodeInput`
- `isWide` logic — dialog is now always `sm:max-w-lg`

**Update:**
- `form schema` (`z.object`): remove `amount` field
- `handleSubmit`: remove `amount`, `partsData`, `chargesData` from payload
- `showPricing` condition: `fields.includes("E")` only (no longer checks `A`)

**Keep:**
- `estimate_amount` field (E flag — ESTIMATED transition)
- Technician, Date, Remarks fields

---

### 3. `job-pipeline-status-detail.tsx`

In `handleSubmitTransition`:
- Remove the `amount` property from `xData` (or pass `job.amount` unchanged — keep the existing value, don't overwrite)
- Remove the `pd` block — `apolloClient.mutate` for `job_part_used`
- Remove the `cd` block — `apolloClient.mutate` for `job_additional_charge`

Only the single `updateJob` mutation remains.

---

## Files to Modify

| File | Change |
|---|---|
| `src/features/client/components/jobs/job-pipeline/status-transitions.ts` | Remove P/C/A from `TransitionFields`; update all `PCT` → `RT` and `RACPT` → `RT` |
| `src/features/client/components/jobs/job-pipeline/status-transition-modal.tsx` | Remove parts, charges, and amount UI, state, and payload fields |
| `src/features/client/components/jobs/job-pipeline/job-pipeline-status-detail.tsx` | Remove `job_part_used` and `job_additional_charge` mutation calls; preserve existing `amount` on job |

## No New Files

No new sections or SQL queries are needed.

---

## Implementation Order

1. `status-transitions.ts` — simplify field codes
2. `status-transition-modal.tsx` — strip P, C, A out
3. `job-pipeline-status-detail.tsx` — remove P/C mutation calls

---

## No Server-Side Changes Required

All removed functionality (parts/charges mutations) used the existing `genericUpdate` mutation. Nothing is being added. No new SQL queries, no schema changes.

---

## Out of Scope

- `PartUsedSection` — no changes
- `JobPipelineDetailModal` — no changes
- `UndoTransactionDialog` — no changes
- `client-jobs-page.tsx` — no changes
