# Lock a Charge Row Against Apply (Back-Calculation) — Implementation Steps

Add a **Lock** column to Additional Charges on the finalize form. A locked row's
price is fixed: Apply (Target Amount) never reprices it, in either direction, at
any step. Everything else about back-calculation stays exactly as it is today.

The lock is **session-scoped UI state — never written to the database.** It lives
as long as the job is open in the finalize form, does its job at Apply time, and
is forgotten when the form is closed. Nothing else in the app knows it existed.

## Feasibility — yes, and it is a small change

Three things in the existing code make this cheap rather than invasive:

1. **Apply already has the concept of "counts toward the total but is never
   repriced."** A part typed in without selecting from the master
   (`part_id === null`) and a charge with a blank name are both filtered out of
   the `active*` lists in `computeBackCalc` (`final-job-form.tsx:169-170`), yet
   still count in `total()`. A locked charge is the same shape — one more
   predicate on the same filter.
2. **`scaleCharges` already separates "all rows" from "rows to move"** — its
   signature is `(allCharges, active, newTotal, isGst)` and it patches only the
   keys present in `active` (`final-job-form.tsx:47-91`). Excluding locked rows
   from `active` needs no change inside that function at all.
3. **Nothing persists, so there is no schema work.** The whole feature is a field
   on an existing in-memory type, a two-line filter change, and a column of
   checkboxes.

## Fixed decisions

| | |
|---|---|
| Scope | Additional Charges only — Parts Used get no Lock column |
| Storage | **None.** In-memory only, on `EditableChargeLine` |
| Lifetime | One editing session. Lost on Back, refresh, Revise Final, Undo Final → re-finalize |
| Effect of lock | The row is excluded from **every** Apply step, including the Labour/Service last-resort step |
| Locked rows and the total | Still counted in `total()` — locking changes what Apply *moves*, never what it *measures* |
| Manual editing | A locked row's Sale price stays hand-editable. Lock blocks Apply, not typing |
| Reset / division change | Locks survive both, for free — see Step 6 |
| Warranty jobs | Lock column hidden — selling prices are hidden and the amount is always ₹0, so Apply is moot |
| Parts | Unchanged. The cost-price floor remains the only thing protecting a part |
| Server | **No change of any kind** — no DDL, no SQL, no resolver, no rights, no `schema.graphql` |

## Why the lock is not persisted

Recorded so this is not re-litigated during implementation. A persisted lock was
planned first (a `job_additional_charge.is_locked` column) and deliberately
dropped.

- **The durable need is already met.** `isLastResortCharge`
  (`final-job-form.tsx:43`) permanently holds Labour and Service Charge back until
  every other lever is exhausted. "We never discount labour" is a standing policy
  the code already enforces, with no user action and no storage.
- **What is left is inherently in-session.** The lock covers ad-hoc, per-negotiation
  cases — "on this job I promised the customer this diagnostic fee stays at ₹500."
  You set a target, protect what you agreed, click Apply, save. The lock's work is
  finished at Apply time.
- **Persisting it creates stale-state surprise.** A checkbox ticked three weeks ago
  would silently constrain today's Apply on a job someone else is revising.
  Re-ticking two boxes is cheap; discovering an invisible constraint is not.
- **The cost was real.** This repo has no migration framework, so the column meant
  three code locations plus a **manual `ALTER TABLE` per already-provisioned
  tenant**, and defensive `?? false` fallbacks on every load site while that
  rollout was in flight.

The one thing persistence would have bought — locks surviving a revise — is
covered by Step 5's hint instead.

---

# Client — `dev/service-plus-client` (server untouched)

## Step 1 — The line type

`src/features/client/components/jobs/final-a-job/final-a-job-schema.ts`:

1. `EditableChargeLine` (line 74) — add:
   ```ts
   // UI-only, never persisted: excludes this row from Apply (back-calculation).
   // Deliberately absent from the DB and from chargeUpsertRows — see plans/plan.md.
   is_locked: boolean;
   ```
   Note it is a real boolean, not the `string` every other editable field uses:
   those are strings because they are bound to text inputs mid-typing, which does
   not apply here.
2. `emptyChargeLine` (line 88) — seed `is_locked: false`.

`EditablePartLine` is **not** touched.

**Keep this as a field on the line rather than a separate `Set<string>` of locked
`_key`s.** It then flows through the existing `patchChargeLine`, reset and
division-change helpers for free (Step 6), and it cannot reach the database
anyway — see Step 3.

## Step 2 — Seed it on load

Two load sites, both mechanical — add `is_locked: false` to the mapped object:

| File | What |
|---|---|
| `final-a-job-section.tsx:410` | `setChargeLines(charges.map(...))` |
| `job-control/final-job-dialog.tsx:266` | The **second** finalize surface, easy to miss |

Always `false`: a freshly opened job starts with nothing locked, by design.

`final-job-dialog.tsx` reuses `FinalJobForm` (line 502), so Steps 4 and 5 cover
both surfaces at once — only this load mapping is separate.

## Step 3 — Confirm it cannot leak to the database

No code change. Verify and leave a comment if helpful:
`chargeUpsertRows` (`finalize-job-save.ts:114-126`) builds each row as an
**explicit field allowlist**, not a spread of the line object. `is_locked` is
therefore structurally incapable of reaching `genericUpdate` — which matters,
because `genericUpdate` writes whatever keys the payload carries and the column
does not exist.

If that mapping is ever refactored into a spread, this feature breaks the save.
Worth a one-line comment there saying so.

## Step 4 — Exclude locked rows from Apply

`src/features/client/components/jobs/final-a-job/final-job-form.tsx`,
`computeBackCalc` (line 156). Two edits, and only two:

1. Line 170 — locked rows leave the active set entirely, which removes them from
   step 2 (other charges) and step 4 (Labour/Service) in one stroke:
   ```ts
   const activeCharges = chargeLines.filter(c => c.charge_name.trim() !== "" && !c.is_locked);
   ```
2. Line 204 — step 2's zero-out fallback walks `curCharges()` (the full list), not
   `active`, so it needs the predicate repeated or it will zero a locked row:
   ```ts
   newChargeLines = curCharges().map(c =>
       (c.charge_name.trim() && !isLastResortCharge(c) && !c.is_locked)
           ? { ...c, selling_price: "0", sale_pr_gst: "0" } : c);
   ```

`total()` is deliberately **not** changed — locked rows keep counting toward the
job total, so the target still means the same thing.

`scaleCharges`, `scaleParts`, `allocateFloored`, `pickResidualKey` and
`snapInclToWholeRupee` all stay untouched.

## Step 5 — The Lock column

`final-job-form.tsx`, the Additional Charges table (header at line 803, body at
line 818).

1. Header cell after `Amount`, before the trailing actions column, hidden on
   warranty jobs:
   ```tsx
   {!isWarranty && <th className={`${thClass} w-16 text-center`}>Lock</th>}
   ```
2. Body cell — a checkbox calling `onPatchCharge`, **not** `onUpdateCharge`:
   `updateChargeLine(key, field, value: string)`
   (`final-a-job-section.tsx:763`) is typed for string fields only, whereas
   `patchChargeLine` (line 769) takes a `Partial<EditableChargeLine>` and already
   accepts a boolean.
   ```tsx
   {!isWarranty && (
       <td className={`${tdClass} text-center`}>
           <Checkbox
               checked={c.is_locked}
               disabled={!c.charge_name.trim()}
               title={c.is_locked
                   ? "Price is locked — Apply will not change it"
                   : "Lock this price against Apply"}
               onCheckedChange={v => onPatchCharge(c._key, { is_locked: v === true })}
           />
       </td>
   )}
   ```
3. Give a locked row a quiet visual cue on the Sale cell (an amber ring or muted
   background) so it is obvious at a glance why Apply skipped it. Do **not**
   disable the Sale input — see Fixed decisions.
4. **The one risk of not persisting**, mitigated here: a job reopened to revise
   starts fully unlocked, and clicking Apply will move a charge the user protected
   last time, with nothing to warn them. The column starting visibly unchecked is
   the primary cue; add a short inline hint near the Target Amount field when an
   already-finalized job is reopened with a target set, saying locks are not
   carried over between sessions. A hint, not a toast — it should not need
   dismissing.

Check the column count on any `colSpan` used by the table's empty/footer rows.

## Step 6 — Deliberately out of scope (record so it is not "fixed" later)

- **Reset Prices** (`final-a-job-section.tsx:798`) and **division / GST change**
  (`final-a-job-section.tsx:615`) both rebuild charges with
  `prev.map(c => ({ ...c, … }))`, rewriting only `gst_rate`, `hsn_code` and
  `sale_pr_gst`. Unlisted fields are preserved, so **locks survive both with no
  work**. Do not add lock handling to either.
- **Job Pipeline's charges modal** (`job-charges-modal.tsx:343`) has no Apply, so
  it needs no Lock column and no change at all.
- **Parts** get no lock. The cost-price floor is their protection.
- **No persistence, and therefore no audit, no history, and no cross-user
  visibility.** Two people editing the same job see independent locks.

## Step 7 — Tell the user when locks blocked the target

`applyBackCalc` (`final-job-form.tsx:325`) already has both failure paths; only
the copy needs to acknowledge locks, since "not achievable" is now a thing the
user can cause deliberately and undo:

1. The below-cost warning (line 334) — `…after Additional Charges were reduced to
   zero.` becomes `…after unlocked Additional Charges were reduced to zero.
   Unlock a charge to give Apply more room.`
2. The not-achievable toast (line 353) — append `Unlock a charge, or adjust the
   target.` when `chargeLines.some(c => c.is_locked)`.

The save-time hard block in `finalize-job-save.ts:198` still applies: if a user
locks so much that the target becomes unreachable, **Save & Mark Final stays
blocked** until they unlock something, change the target, or clear the Target
Amount field. That is existing behaviour, not a regression — but it is the most
likely support question this feature generates, so it belongs in the help article.

---

# Step 8 — Help content

1. `src/features/client/components/help/help-content.ts`, the `finalize-job`
   article's "Apply (Target Amount)" section — this was corrected recently to
   describe the real four-step order, so extend it rather than rewriting:
   - A "Locking a charge" heading: what the checkbox does, that a locked row still
     counts toward the total, and that locking is the way to protect a figure you
     negotiated with the customer.
   - State plainly that **locks are not saved with the job** — they last only while
     the job is open, and reopening it to revise starts with everything unlocked.
   - Note that locking too much can make a target unreachable, and that Save & Mark
     Final stays blocked until a charge is unlocked or the target is cleared.
   - Three FAQs: "I locked a charge and Apply says the target isn't achievable",
     "Does locking stop me editing the price by hand?" (no), and "I reopened the
     job and my locks are gone" (expected — and Labour / Service Charge are
     protected permanently anyway, without locking).
2. `src/features/super-admin/components/help/dev-help-content.ts` — a short note on
   the two `computeBackCalc` edit points from Step 4, so the next person changing
   Apply keeps locked rows excluded from both; that `is_locked` is UI-only and
   must never be added to `chargeUpsertRows`; and the reasoning in
   "Why the lock is not persisted" above.

---

# Step 9 — Verification

1. `npx tsc -b --force` and `vite build` — both clean.
2. Lock one charge, set a target **below** the current total, Apply → parts fall
   to cost and unlocked charges fall toward ₹0 while the locked row's Sale is
   byte-identical before and after.
3. Same with a target **above** the current total → the increase lands on parts
   and unlocked charges only.
4. Lock the **Labour** charge specifically and drive the target low enough to
   reach step 4 → parts go below cost (with the warning) and Labour still does
   not move.
5. Lock **every** charge and set an unreachable target → the not-achievable toast
   fires, and Save & Mark Final is blocked with the existing diff dialog.
6. With a row locked, click **Reset Prices**, then change the **division** → the
   lock is still ticked both times (Step 6).
7. Save & Mark Final, then re-open the job → every row is unlocked, and the saved
   prices are exactly what Apply produced. Confirm nothing errors on save: the
   payload must not carry `is_locked` (Step 3).
8. Repeat 2 and 7 through Job Control's finalize dialog (`final-job-dialog.tsx`)
   to confirm the second surface behaves identically.
9. Confirm Job Pipeline's charges modal still saves a charge normally.
