# Plan: Bring "Back Calculate" billing logic into conformance with tran.md

## Context

`plans/tran.md` specifies the "Back Calculate" feature for the *Final a Job* billing flow:
the user enters a **Target Amount** and the system adjusts line-item sale prices of
**Parts Used** and **Additional Charges** so the computed Total exactly matches the target,
distributing the required difference proportionally and respecting GST.

This feature is **already implemented** — the allocator lives in
`src/features/client/components/jobs/final-a-job/final-job-form.tsx`
(`computeBackCalc` + helpers `scaleParts`, `scaleCharges`, wired via `applyBackCalc`).
Most of the spec is faithfully implemented. This plan documents the algorithm the spec
requires, identifies **where the current code deviates**, and describes the change needed to
close the one material gap: the missing **iterative floor-and-redistribute** step.

---

## Where the logic lives

| Concern | Location |
|---|---|
| Allocator (`computeBackCalc`, `scaleParts`, `scaleCharges`) | `final-a-job/final-job-form.tsx:30-172` |
| Wiring / warnings (`applyBackCalc`) | `final-a-job/final-job-form.tsx:259-280` |
| Target state, seeding, save/diff dialog | `final-a-job/final-a-job-section.tsx` (`backCalcTarget` 185; seed 422-434; `resyncTarget` 686-691; save 919-937; diff dialog 1021-1037) |
| Near-duplicate container (mirrors seeding/save only) | `job-control/final-job-dialog.tsx` |
| Line-item shape (`sale_pr_gst` = GST-inclusive unit price, all prices are **strings**) | `final-a-job/final-a-job-schema.ts:54-100` |
| Per-line pricing cascade | `final-a-job-helpers.ts:calculateLinePricing` |

**Note:** the allocation algorithm exists **only** in `final-job-form.tsx`, which both containers
share. The algorithm fix below is a single-file change; no mirroring needed.
A *separate* back-calc (`computeBackCalcLines` in
`inventory/sales-entry/sales-invoice-utils.ts`) serves the Sales Invoice feature — **out of scope**.

---

## The spec algorithm (tran.md) vs. current implementation

### 1. Initial delta check — ✅ conforms
Spec: current total = Σ parts sale + Σ charges; if target == current, do nothing.
Code: `computeBackCalc` lines 113-116 (`if (Math.abs(diff) < 0.005) return {}`).

### 2. Situation A — Upward (target > current) — ✅ conforms
Spec: Priority 1 apply the whole increase proportionally across Parts; Priority 2 (fallback,
only when Parts is empty) apply across Additional Charges.
Code: Step 1 (lines 118-134) scales parts; with no cost floor blocking an increase the parts
absorb it fully and it returns. If there are no active parts, Step 2 (138-149) applies to charges.

### 3. Situation B — Downward (target < current)

**Phase 1 — Parts safe decrease, floored at cost, WITH redistribution — ⚠️ DEVIATION (the gap).**
- Spec: decrease parts proportionally; if a part would fall below its Cost Price, **cap it at cost
  and redistribute the remaining reduction proportionally among the parts that have not yet hit
  their floor** — repeat until the reduction is fully placed or all parts are at cost.
- Code: `scaleParts` (66-105) does a **single pass** — proportional target per item, then
  `Math.max(sp, floor)` per item, with the last item taking the balancing residual (also floored).
  A floored item's un-absorbed reduction is **never redistributed** to the remaining parts.
- Effect: when some parts hit cost, `computeBackCalc` (line 131) sees a leftover `remainingDiff`
  and **spills it to Additional Charges (Phase 2) early** — and if no charges exist, to the
  below-cost Phase 3. This can push parts below cost and fire the "below cost" warning in cases
  where redistributing within Parts would have hit the target exactly at the cost floor.
  *Example:* Part A (sale 100, cost 90), Part B (sale 100, cost 10), target parts = 100. Spec caps
  A at 90 and drives B to its 10 floor → 100 achieved, no loss. Current code leaves A=90, B=50
  (=140), spills −40 onward, and can sell below cost.

**Phase 2 — Additional Charges safe decrease, floored at 0, WITH redistribution — ⚠️ PARTIAL DEVIATION.**
- Spec: decrease charges proportionally; cap any charge that would go below 0 at 0 and redistribute
  the remainder among the other charges.
- Code: Step 2 (138-157). `scaleCharges` clamps each row with `Math.max(0, …)` and balances the
  last row, but does **not** redistribute a mid-list zero-floored charge's remainder to the others.
  The aggregate feasibility gate (`if (newChargesAmt >= 0)`, line 145) is correct at the section
  level, but per-item redistribution is missing (same class of bug as Phase 1, lower impact).

**Phase 3 — Parts hard override below cost, total never negative — ✅ conforms.**
- Spec: if charges are exhausted to 0 and target still unmet, drop part sale prices below cost
  proportionally; final total must not be negative.
- Code: Step 3 (159-169) calls `scaleParts(..., allowBelowCost=true)`, which relaxes the floor to
  **0** (not below 0), so the total cannot go negative. Flags `wentBelowCost` → warning.

### GST handling — ✅ conforms
Spec: "respect GST rule while doing adjustments." Both helpers operate on GST-inclusive amounts
(`sale_pr_gst`) and back out `selling_price` via `multiplier = 1 + gst_rate/100`, matching the
`sale_pr_gst = selling_price * (1 + rate/100)` convention in `calculateLinePricing`. Redistribution
must preserve this: allocate on GST-inclusive amounts, then derive `selling_price` per item.

---

## Change required (single deviation to close)

Replace the single-pass, per-item-floor logic in **`scaleParts`** and **`scaleCharges`**
(`final-job-form.tsx:30-105`) with an **iterative floor-and-redistribute** allocation, so Phase 1
fully exhausts Parts (redistributing off floored parts) before Phase 2, and Phase 2 does the same
among charges. `computeBackCalc`'s three-step orchestration (parts → charges → below-cost) stays;
only the per-section allocators change.

**Algorithm for the shared allocator** (apply to both parts and charges; the only differences are
the per-item floor — `cost_price` for parts / `0` for charges — and the `allowBelowCost`/below-0
relaxation):
1. Work in **GST-inclusive amounts**. For each active item compute its current inclusive amount
   `amt_i = sale_pr_gst_i * qty_i` and its inclusive **floor** `floor_i = cost_i * (1+rate_i/100) * qty_i`
   (parts) or `0` (charges). Let `poolTarget` = desired new section total.
2. Proportionally allocate `poolTarget` across the *not-yet-floored* items by their current amount
   share. Any item whose allocation ≤ its floor is **pinned** to its floor and removed from the pool;
   subtract its floor from `poolTarget`.
3. Repeat step 2 with the remaining items and reduced `poolTarget` until no new item pins (fixed
   point) or all items are pinned.
4. If, after all items are pinned at their floors, the section still can't reach `poolTarget`
   (section infeasible), return the all-at-floor result and let `computeBackCalc` carry the residual
   to the next phase — Phase 2 for parts, Phase 3 (below-cost) for the final fallback.
5. Convert each item's final inclusive amount back to `selling_price = incl / qty / multiplier` and
   `sale_pr_gst = incl / qty`, rounding with the existing `.toFixed(2)` convention. Absorb the
   rounding residual into the last non-pinned item (as the current last-item balancing already does)
   so the section total is exact to the paisa.

Keep behavior identical for the common single-item and no-floor-hit cases (proportional split is
unchanged there). The three `return` shapes of `computeBackCalc` and the `wentBelowCost` flag are
unchanged, so `applyBackCalc` and both containers' save/diff logic need no edits.

**Rounding:** reuse the in-file `.toFixed(2)` / `parseFloat` pattern already used throughout these
helpers — no new decimal library (none exists in the repo; `Math.round(x*100)/100` and `.toFixed(2)`
are the established idioms).

---

## Files touched by implementation

- `src/features/client/components/jobs/final-a-job/final-job-form.tsx` — rewrite `scaleParts` and
  `scaleCharges` (lines 30-105) to iterative floor-and-redistribute; no signature change.
  `computeBackCalc` (107-172) and `applyBackCalc` (259-280) unchanged. Delete the superseded
  single-pass bodies outright (no dead code left behind).

No other files require changes. `final-a-job-section.tsx` and `final-job-dialog.tsx` seeding/save/diff
logic is already correct and stays as-is.

---

## Verification

Because line items are React `useState` in `final-a-job-section.tsx` (not global store), verify by
driving the UI plus targeted reasoning on the pure allocator:

1. **Unit-level reasoning / temporary harness** on `computeBackCalc` covering:
   - Target == current → no change.
   - Upward with parts; upward with no parts (charges fallback).
   - Downward where proportional split floors one part → **redistribution keeps other parts absorbing
     until the exact cost floor, target met, `wentBelowCost` false** (the core fix; the A=90/B=10
     example above must reach 100 without going below cost).
   - Downward exhausting all parts to cost → charges reduced (Phase 2), with a mid-list charge
     flooring at 0 redistributing to the others.
   - Downward exhausting charges to 0 → parts below cost (Phase 3), total ≥ 0, `wentBelowCost` true.
   - GST and non-GST divisions: verify `selling_price`/`sale_pr_gst` relationship holds and the
     achieved grand total equals target to the paisa.
2. **End-to-end in the app** (dev server): open *Final a Job* for a job with multiple parts
   and charges, enter a Target Amount, click **Back Calculate**, and confirm the Grand Summary total
   matches the target (Diff ≈ 0), no spurious below-cost warning when a valid within-parts solution
   exists, and Save persists the achieved total.

---

## Decision (confirmed)

Implement the spec: redistribute within Parts before touching Charges (and within Charges before
Phase 3). This is the change described in "Change required" above.
