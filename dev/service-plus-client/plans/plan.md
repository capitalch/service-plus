# Batch-Process Warranty Jobs (Job Control)

Status: **proposal only, not implemented**.

## 0. Problem statement

Today every job transaction — a status change, "Final a Job", "Deliver a
Job" — is applied to exactly one job at a time. For a customer with several
warranty jobs sitting at the same pipeline stage (e.g. five jobs all
`COMPLETED_OK`, no parts used, ready to finalize and deliver), the operator
must repeat the same clicks job by job.

This plan adds a **Job Control sub-flow** that lets an operator:
1. Pick a customer (existing widget).
2. See that customer's open, zero-parts, warranty jobs in one list.
3. Multi-select jobs via checkboxes.
4. Pick one service engineer (technician) for the batch.
5. Pick one or more transactions via checkboxes — "Completed OK", "Final a
   Job", "Deliver a Job", "Send to Company", "Received from Company" —
   constrained so only workflow-legal combinations can be checked.
6. Run the batch and see a per-job, per-transaction result summary.

**Eligibility scope is deliberately narrow**: only `UNDER_WARRANTY` jobs with
**zero parts used**. This is what keeps "Final a Job" batchable without a
parts/charges editing UI — warranty jobs already force `amount = 0`,
`selling_price = 0`, `gst_rate = 0` on finalize, so with no parts there is
nothing left for a human to price or approve.

## 1. Current-state findings (verified against source, not guessed)

### 1.1 Customer picker — reuse as-is
`CustomerInput` in
`src/features/client/components/shared/customer-select/customer-select.tsx`
is a fully controlled component (parent owns `customerId`/`customerName`)
already used identically in `new-single-job-form.tsx`, `new-sales-invoice.tsx`,
`opening-job-form.tsx`, and `new-batch-job-form.tsx`. Its `onSelect(c:
CustomerSearchRow)` callback hands back `c.id` — that's the `customer_id` to
drive the jobs query. No changes needed to this component.

### 1.2 Job status model
`src/features/client/components/jobs/job-pipeline/status-transitions.ts`:
- `STATUS_FLAGS: Record<number, {is_final, is_closed}>` for all 17 statuses
  (RECEIVED=1 … RECEIVED_BACK_FROM_COMPANY=17).
- `getTransitions(statusId, jobTypeCode): Transition[]` — legal next
  statuses, each with `fields: "none"|"R"|"RT"|"RET"` (R = remarks+date
  always required, T = technician required, E = estimate amount required).
- Relevant edges: `IN_PROGRESS(6) → SENT_TO_COMPANY(10)` fields `"R"`;
  `SENT_TO_COMPANY(10) → RECEIVED_BACK_FROM_COMPANY(17)` fields `"R"`;
  `RECEIVED_BACK_FROM_COMPANY(17) → IN_PROGRESS(6)` fields `"RT"`; and from
  most pre-completion statuses (`RECEIVED`, `IN_PROGRESS`, etc.)
  `→ COMPLETED_OK(11)` fields `"RT"` (technician required — this is where
  the batch's technician picker plugs in).
- "Final a Job" and "Deliver a Job" are **not** entries in this transition
  table — they're separate flag flips:
  `showFinalJob = job_status_code === "COMPLETED_OK" && !is_final`,
  `showDeliverJob = is_final && !is_closed`
  (both confirmed at `job-control-section.tsx:881-884`).

### 1.3 Single-job transaction implementations (mutations to reuse verbatim)
- **Completed OK / Send to Company / Received from Company** — all the same
  generic mechanism: pick a `Transition` from `getTransitions()`, collect
  Date/Remarks (+Technician if `fields` includes `T`) via
  `StatusTransitionModal`, submit through
  `JobControlSection.handleSubmitTransition` (`job-control-section.tsx:300-337`)
  → `GRAPHQL_MAP.updateJob` with:
  ```
  { job_id, last_transaction_id, performed_by_user_id, remarks, transaction_date,
    xData: { id, job_status_id, division_id, technician_id, amount, estimate_amount,
             is_final, is_closed } }
  ```
  `is_final`/`is_closed` come from `STATUS_FLAGS[targetId]`. Trivially loopable
  per job.
- **Final a Job** — `final-job-dialog.tsx` / `final-job-form.tsx`, but the
  simpler reference for the warranty/zero-parts case is
  `final-a-job-section.tsx:936-967`: for `job_type_code === "UNDER_WARRANTY"`
  the form already forces `selling_price = 0`, `gst_rate = 0`, and
  `amount = 0`, and skips GST/HSN validation. Submitted via
  `GRAPHQL_MAP.genericUpdate`:
  ```
  { tableName: "job",
    xData: { id, is_final: true, is_igst, division_id, amount: 0,
             to_show_parts_in_job_invoice, to_set_updated_at: true,
             xDetails: [{ tableName: "job_additional_charge", fkeyName: "job_id", xData: [] }] } }
  ```
  followed by `saveCustomerGstin(...)`. With zero parts there's no
  `job_part_used` xDetails block needed at all.
- **Deliver a Job** — `delivery-modal.tsx`, which is **already a multi-job
  batch precedent**: accepts `jobs: JobDeliveryFullDetail[]` (plural, with an
  `isSingleJob` branch for UI), applies one shared Delivery
  Manner/Date/Remarks form to all jobs, and loops:
  ```ts
  for (const job of jobDetails) {
      await apolloClient.mutate({ mutation: GRAPHQL_MAP.deliverJob, variables: {
          job_id, last_transaction_id, performed_by_user_id, delivered_status_id,
          delivery_date, delivery_manner_name, remarks,
          payment: { payment_date, payment_mode: "Cash", amount: 0 } } });
  }
  ```
  (`delivery-modal.tsx:376-423`), then `saveCustomerGstin` per job. This
  confirms the **non-atomic, client-side-looped-mutation pattern is this
  repo's established convention**, not an oversight — the new batch feature
  should follow it, not invent a new atomic server-side batch mutation.

### 1.4 Checkbox multi-select precedent (the template to clone)
`src/features/client/components/jobs/deliver-job/deliverable-jobs-grid.tsx`:
- `selectedIds: Set<number>` prop, `allChecked`/`someChecked` derived booleans
  (lines 97-98).
- Header checkbox with indeterminate state (lines 190-197):
  ```tsx
  <input type="checkbox" checked={allChecked}
      ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
      onChange={e => onSelectAll(e.target.checked)} />
  ```
- Per-row checkbox (lines 228-235), toolbar button that appears once
  `selectedIds.size > 0`: "Deliver Selected (N)" (lines 138-150).
- This is the **immediate-intent model**: select jobs, click one button,
  act on the whole selection right away — matches this feature's flow
  ("select jobs, select transactions, go") better than the alternative
  precedent below.

A second precedent exists but is a worse fit: the Post-Unpost grids
(`accounts-admin/post-unpost/*.tsx`) use a **staged-Map model**
(`Map<id, pendingValue>`, per-row toggle, separate "Save (N)" flush button) —
suited to "toggle a boolean per row, commit later," not to "select a set of
jobs and apply a transaction now." Not used here.

### 1.5 Technician (service engineer) picker
No dedicated reusable widget exists. Every screen fetches
`TechnicianRow[]` via `SQL_MAP.GET_ALL_TECHNICIANS` (scoped by `branch_id`)
and renders a plain shadcn `<Select>` inline, e.g.
`status-transition-modal.tsx:259-271`:
```tsx
<Select value={form.watch("technician_id")} onValueChange={v => form.setValue("technician_id", v)}>
    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
    <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
</Select>
```
`TechnicianRow = { id, branch_id, code, name, is_active, branch_name }`
(`src/features/client/types/job.ts:98-105`). Reuse this idiom directly.

### 1.6 "Warranty job" and "no parts used"
No boolean flag for warranty — it's `job_type_code === "UNDER_WARRANTY"` on
the job's joined type fields. "No parts used" is not exposed anywhere today
(no `parts_count`/`has_parts` field on any existing job row type) — it's
only derivable per job via `SQL_MAP.GET_JOB_PART_USED_BY_JOB` and checking
`length === 0`. For a list-level filter this needs a server-side count (see
§2).

### 1.7 No "jobs for a customer" query exists
Neither client nor server has a `customer_id`-scoped job list query today.
Closest precedents are keyword-search based, not id-scoped:
- `SQL_MAP.GET_JOB_CONTROL_PAGED` (→ server `GET_JOB_SEARCH_PAGED`): args
  `{branch_id, search, show_closed, status_id}` — no `customer_id`, row type
  `JobControlRow` has no `customer_id` or parts-count field either.
- `SQL_MAP.GET_JOBS_FOR_RECEIPT_LOOKUP`: free-text job/customer/mobile
  search, not id-scoped.

"Closed" is defined server-side (`sql_store.py:3664-3666`) as
`job_status.code IN ('DELIVERED_OK','DELIVERED_NOT_OK','DISPOSED') OR
job.is_closed`. `STATUS_FLAGS` mirrors this client-side.

### 1.8 Navigation / access-rights conventions
- Single route `/client/jobs` → `client-jobs-page.tsx`, which switches on a
  `selected` string (from `useClientSelection()`) to render one
  `*-section.tsx` per tab. No new router entry is ever needed for a new tab.
- Left nav: `JobsExplorer()` in
  `src/features/client/components/layout/client-explorer-panel.tsx:165-214`.
  Confirmed full body — icons imported from `lucide-react`
  (`PlusCircle, ClipboardList, BarChart3, FileText, Truck, BookCheck,
  RotateCcw, Receipt, Package`), gating pattern:
  ```tsx
  const canDeliverJob = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_DELIVER_JOB);
  <TreeItem icon={Truck} label="Deliver Job" disabled={!canDeliverJob}
      title={!canDeliverJob ? "Your role does not have access to Deliver Job" : undefined} />
  ```
- `ACCESS_RIGHTS` (`src/features/auth/utils/access-rights.ts:3-19`) currently
  has `JOBS_RECEIPTS, JOBS_OPENING_JOBS, JOBS_ACCOUNTS_POSTING,
  JOBS_DELIVER_JOB` (naming convention: `JOBS_<SCREAMING_SNAKE_ACTION>`).
  Note "Final a Job" and "Job Control" themselves are **ungated** — but this
  new feature is bulk-mutating multiple jobs at once (higher blast radius
  than any single-job action), so it should get its own new right rather
  than going ungated or reusing an existing one.
  `hasAccessRight` always returns `true` for admin user types (`S`/`A`).

## 2. What's missing — designed here

### 2.1 Backend contract (cross-repo dependency — blocks Phase 2)
The server lives in a **sibling repo**, `service-plus-server`
(`app/db/sql_store.py`), not in this working directory. This is a
**dependency to hand off**, not something to implement in this repo.

New `SQL_MAP` entry: **`GET_WARRANTY_JOBS_BY_CUSTOMER`**
- **Args**: `{ customer_contact_id: number, branch_id: number }`
- **Filter** (all server-side):
  - `job.customer_contact_id = :customer_contact_id`
  - `job.branch_id = :branch_id`
  - `job_type.code = 'UNDER_WARRANTY'`
  - `job.is_closed = false`
  - `job_status.code NOT IN ('DELIVERED_OK','DELIVERED_NOT_OK','DISPOSED')`
    (redundant with `is_closed = false` given `STATUS_FLAGS`, kept explicit
    for defense-in-depth in case the two ever drift)
  - `parts_count = 0`, computed via
    `(SELECT COUNT(*) FROM job_part_used WHERE job_id = job.id)` — the same
    subquery idiom already used for `file_count` in `GET_JOB_SEARCH_PAGED`.
- **Return columns** (superset of `JobControlRow`):
  ```
  id, job_no, alternate_job_no, job_date, device_details, serial_no,
  job_status_id, job_status_code, job_status_name,
  job_type_id, job_type_code, job_type_name,
  technician_id, technician_name,
  division_id, amount, estimate_amount,
  last_transaction_id, is_final, is_closed,
  customer_contact_id, customer_name, customer_gstin, mobile,
  parts_count
  ```
- No pagination — one customer's open-warranty backlog is small; return all
  rows ordered by `job_date`.
- New client type `WarrantyBatchJobRow` in `src/features/client/types/job.ts`
  mirroring the above (reuse `TechnicianRow` unchanged).

**This blocks Phase 2 below and must be coordinated with whoever owns
`service-plus-server` before that phase starts.**

### 2.2 New feature folder
`src/features/client/components/jobs/batch-warranty-transactions/`:

| File | Purpose |
|---|---|
| `batch-warranty-section.tsx` | Section shell: owns `CustomerInput`, loads jobs on select, composes the grid + pickers + submit button + results modal. |
| `warranty-jobs-grid.tsx` | Hand-rolled `<table>` cloned from `deliverable-jobs-grid.tsx`'s checkbox/select-all pattern, driven by `GET_WARRANTY_JOBS_BY_CUSTOMER`. |
| `technician-picker.tsx` | Thin wrapper around the existing inline `<Select>` idiom, fetched via `GET_ALL_TECHNICIANS`. |
| `transaction-picker.tsx` | New checkbox UI for the 5 transaction kinds, driven by `transaction-eligibility.ts`. |
| `transaction-eligibility.ts` | Pure logic module (no JSX) — see §2.3. Unit-testable in isolation. |
| `batch-execute.ts` | Pure orchestration module — loops mutations, returns results — see §2.4. |
| `batch-results-modal.tsx` | Per-job × per-transaction success/skip/fail summary table. |

No new route. Wired into the existing `/client/jobs` + `selected`-switch
pattern (§2.5).

### 2.3 Transaction eligibility / ordering engine
```ts
type TransactionKind =
  | "COMPLETED_OK" | "SEND_TO_COMPANY" | "RECEIVE_FROM_COMPANY"
  | "FINAL" | "DELIVER";
```

**Fixed pipeline** (restricted to these 5 kinds):
```
… → IN_PROGRESS(6) ──┬────────────────────────→ COMPLETED_OK(11) → [Final] → Deliver (13/14)
                      └→ SENT_TO_COMPANY(10) → RECEIVED_BACK_FROM_COMPANY(17) → back to IN_PROGRESS(6)
```

**(a) Which checkboxes are enabled** — `getEligibleKinds(jobs): Set<TransactionKind>`.
A kind is enabled only if legal for **every** selected job (intersection,
not union):

| Job's current state | Legal kind(s) |
|---|---|
| Status has a `getTransitions()` edge to `COMPLETED_OK` (i.e. not already completed/closed/mid-vendor-cycle) | `COMPLETED_OK` |
| Status === `IN_PROGRESS` | also `SEND_TO_COMPANY` |
| Status === `SENT_TO_COMPANY` | `RECEIVE_FROM_COMPANY` only |
| Status === `COMPLETED_OK` && `!is_final` | `FINAL` |
| `is_final` && `!is_closed` | `DELIVER` |

If the intersection for a kind is empty given the current selection, render
that checkbox disabled with a tooltip: *"Not applicable to one or more
selected jobs."*

**(b) Mutually-exclusive groups.** `SEND_TO_COMPANY`/`RECEIVE_FROM_COMPANY`
form one group; `COMPLETED_OK`/`FINAL`/`DELIVER` form the other. Checking a
box in one group clears/disables the other group (single `checkedGroup:
"vendor-cycle" | "completion" | null` state, not two independent sets).

*Justification*: a job that's `SENT_TO_COMPANY` must pass back through
`IN_PROGRESS` — which is not one of the 5 named kinds — before it can reach
`COMPLETED_OK`. The two groups can therefore never legally chain for the
same job in a single pass, so keeping them UI-exclusive removes an entire
class of operator error (accidentally completing a job still with the
vendor) without needing per-row transaction toggles. A customer with jobs
in both states needs two separate batch runs — an acceptable, explicit
constraint, worth a small inline note under the picker.

**(c) Per-job ordering** — `getApplicableOrderedKinds(job, checkedKinds): TransactionKind[]`.
Fixed order `COMPLETED_OK → FINAL → DELIVER` (independently
`SEND_TO_COMPANY → RECEIVE_FROM_COMPANY`). Recomputed **live** per job
during execution against that job's current in-memory status (updated
after each successful step), not precomputed once — so a job that becomes
`COMPLETED_OK` mid-run can still pick up `FINAL`/`DELIVER` in the same pass
if those were checked.

### 2.4 Execution + results reporting
```ts
type ExecResult = {
  jobId: number; jobNo: string; kind: TransactionKind;
  status: "success" | "skipped" | "failed"; message?: string;
};

async function executeBatch(
  jobs: WarrantyBatchJobRow[], checkedKinds: Set<TransactionKind>,
  technicianId: number | null, remarks: string, transactionDate: string,
): Promise<ExecResult[]>
```

Sequential `for` loop over jobs (matches the repo's established non-atomic
convention, §1.3/1.4 — no new atomic batch mutation invented). Per job:
1. Recompute `getApplicableOrderedKinds(job, checkedKinds)` against the
   job's current in-memory status.
2. For each applicable kind, in order, call the **exact existing mutation**:
   - `COMPLETED_OK` → `GRAPHQL_MAP.updateJob` (technician_id injected —
     required, this transition's `fields` includes `T`).
   - `SEND_TO_COMPANY` / `RECEIVE_FROM_COMPANY` → `GRAPHQL_MAP.updateJob`
     (no technician needed, `fields` is `"R"`).
   - `FINAL` → `GRAPHQL_MAP.genericUpdate` with `amount: 0`, empty
     `xDetails` (no parts), then `saveCustomerGstin` only if the customer
     has no GSTIN on file yet (skip otherwise — no GSTIN input in this UI).
   - `DELIVER` → `GRAPHQL_MAP.deliverJob` with `payment.amount: 0` and a
     default `delivery_manner_name` (flagged as a UX decision — see §3).
   - On mutation failure: record `{status:"failed", message}` and **stop
     that job's chain**, but continue to the next job.
   - If a checked kind isn't applicable to this job (e.g. already past
     `COMPLETED_OK`): record `{status:"skipped", message:"Already at or
     past this stage"}`.

`batch-results-modal.tsx`: a plain `<table>` — Job No / Customer /
Transaction / Result / Message, color-coded (green/success, gray/skipped,
red/failed), same visual idiom as `StatusBadge`/`JobTypeBadge`. Footer: "N
succeeded, M skipped, K failed" + "Done" (closes modal, clears selection,
reloads the jobs grid so a retry of the failed subset is easy). **Always
shown**, even on 100% success — partial failure across N jobs × M
transactions must never be silent.

### 2.5 Navigation wiring
- `src/features/auth/utils/access-rights.ts`: add
  `JOBS_BATCH_WARRANTY_TRANSACTIONS: 'JOBS_BATCH_WARRANTY_TRANSACTIONS'`
  to `ACCESS_RIGHTS` (new right — this is a bulk-mutating capability with
  higher blast radius than any existing single-job action, so it gets its
  own gate rather than reusing `JOBS_DELIVER_JOB` or going ungated).
- `src/features/client/components/layout/client-explorer-panel.tsx`, inside
  `JobsExplorer()`:
  ```tsx
  const canBatchWarranty = hasAccessRight(currentUser, ACCESS_RIGHTS.JOBS_BATCH_WARRANTY_TRANSACTIONS);
  ...
  <TreeItem
      icon={Layers}
      label="Batch Warranty Jobs"
      disabled={!canBatchWarranty}
      title={!canBatchWarranty ? "Your role does not have access to Batch Warranty Jobs" : undefined}
  />
  ```
  (placed next to the existing `<TreeItem icon={ClipboardList} label="Job Control" />`).
- `src/features/client/pages/client-jobs-page.tsx`:
  ```tsx
  import { BatchWarrantySection } from "../components/jobs/batch-warranty-transactions/batch-warranty-section";
  ...
  case "Batch Warranty Jobs":
      return <BatchWarrantySection />;
  ```
- No new router entry — same `/client/jobs` route, same `selected`-string
  switch as every other tab.

## 3. Edge cases to handle explicitly

| Edge case | Handling |
|---|---|
| Customer has zero eligible jobs | Empty-state message in the grid: "No open, zero-parts warranty jobs for this customer." (same idiom as `deliverable-jobs-grid.tsx:182-185`). |
| A job's parts count changes between load and submit (race) | Documented as a known, low-probability risk; surfaces as a `failed` row if the server-side mutation errors on unexpected parts. Optionally re-run the list query immediately before executing and drop any job whose `parts_count` is now `> 0`, with a toast warning. |
| Mixed-division selected jobs | No shared Division selector in this batch UI — each job keeps its own `division_id` at execution time. Unlike `StatusTransitionModal`'s single-job `canPickDivision` field (which exists to let one job's division be corrected at transition time), batch mode must not let the user change division. Document as by-design, not an oversight. |
| Technician requirement scoping | Enforce "Technician required" only when the checked-kind set includes `COMPLETED_OK` — the only kind whose `fields` includes `T`. A Send/Receive-to-company-only batch must not force a technician pick. |
| Warranty Final's forced zero-amount | No user input needed for `FINAL` at all — no parts/charges editor, no target-amount field; `amount: 0` is hardcoded in `batch-execute.ts`, matching `final-a-job-section.tsx:936`. |
| Customer GSTIN | Skip `saveCustomerGstin` entirely when the customer already has a GSTIN on file — no GSTIN input widget in this batch UI. |
| Delivery manner default | `DELIVER` needs a `delivery_manner_name`; this batch UI has no per-manner picker. **Flagged as an open UX decision**: either default to a single configured "standard" manner, or add one shared `<Select>` (populated via the existing `GET_JOB_DELIVERY_MANNERS` fetch already used in `deliver-job-section.tsx:98-101`) that appears only when `DELIVER` is checked. Not resolved in this plan — needs a product call before Phase 4. |
| Partial failure across N×M | Never silent — `batch-results-modal.tsx` always renders, including all-success and all-skipped cases. |

## 4. Suggested phased delivery order

0. **Backend query (blocking, cross-repo).** `service-plus-server` adds
   `GET_WARRANTY_JOBS_BY_CUSTOMER` per the §2.1 contract. Can run in
   parallel with Phase 1.
1. **Folder scaffold + nav wiring.** New folder, new access right,
   `batch-warranty-section.tsx` shell rendering just `CustomerInput` — gets
   the tab visible and access-gated end to end with no data dependency yet.
2. **Jobs grid.** `warranty-jobs-grid.tsx` wired to the new query once
   Phase 0 lands; checkbox multi-select, no actions yet.
3. **Pickers.** `transaction-eligibility.ts` (+ unit tests) +
   `transaction-picker.tsx` + `technician-picker.tsx`.
4. **Execution.** `batch-execute.ts` + `batch-results-modal.tsx` — wire the
   "Process Selected" button end to end. Resolve the delivery-manner
   decision (§3) before this phase closes.
5. **Hardening.** Parts-count race re-check, empty/error states, manual QA
   against real warranty jobs at every pipeline position (fresh, mid-vendor,
   completed-not-final, finalized-not-delivered).

## 5. Critical files

- `src/features/client/components/jobs/deliver-job/deliverable-jobs-grid.tsx` — checkbox-grid pattern to clone
- `src/features/client/components/jobs/deliver-job/delivery-modal.tsx` — multi-job batch precedent + `deliverJob` payload
- `src/features/client/components/jobs/job-pipeline/status-transitions.ts` — `getTransitions`/`STATUS_FLAGS`
- `src/features/client/components/jobs/job-control/job-control-section.tsx` — `updateJob` payload shape, Final/Deliver gating logic
- `src/features/client/components/jobs/final-a-job/final-a-job-section.tsx` — warranty zero-amount Final payload
- `src/features/client/components/layout/client-explorer-panel.tsx`, `src/features/client/pages/client-jobs-page.tsx` — nav wiring
- `src/features/client/types/job.ts`, `src/features/auth/utils/access-rights.ts` — types + new access right
- `src/features/client/components/shared/customer-select/customer-select.tsx` — `CustomerInput`, reused as-is
