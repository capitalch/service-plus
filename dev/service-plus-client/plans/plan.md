# Implementation Plan — Job Cost/Sale Price, Parts & Charges, and Job Final Strategy

Comparison of `tran.md` strategy against the current codebase, with a full task list.

---

## Strategy Summary (from tran.md)

1. **Parts & Charges modal** — no GST display, but silently persist `gst_rate` and `hsn_code` from the part/charge master when saving.
2. **Finalization** — GST fields visible only for GST divisions; pricing recalculates on every edit and on division change; `force_gst_on_parts_for_non_gst_invoices` adjusts cost+sale for non-GST; back-calc supported.
3. **Edit block** — finalized (`is_final=true`) jobs must not show an Edit button in Actions menus.
4. **Deliver** — invoice generated as GST or non-GST based on the job's assigned division.

---

## Status by Strategy Point

### 1. Parts & Charges Modal (`job-charges-modal.tsx`)

| Requirement | Status | Notes |
|---|---|---|
| Part selector with cost from master | ✅ Done | `handlePartSelect` populates cost & selling_price |
| Sale price = cost + markup (or from master) | ✅ Done | `applyMarkup` helper |
| No GST calculations / fields in the UI | ✅ Done | Modal has no GST columns |
| On save — persist `gst_rate` in `job_part_used` | ❌ **Missing** | Save payload omits `gst_rate`; uses part's `gst_rate` from `PartRow` or default |
| On save — persist `hsn_code` in `job_part_used` | ❌ **Missing** | Save payload omits `hsn_code`; data available in `PartRow.hsn_code` |
| On save — persist `gst_rate` in `job_additional_charge` | ❌ **Missing** | Save payload for charges omits `gst_rate` |
| On save — persist `hsn_code` in `job_additional_charge` | ❌ **Missing** | Save payload for charges omits `hsn_code` |
| Load default GST rate + default HSN settings | ❌ **Missing** | Modal fetches `markup_percent_over_cost` but not `default_gst_rate` or `default_hsn_for_spare_part` / `default_hsn_for_service_charge` |
| User can manually alter cost/sale and save | ✅ Done | Both fields are editable inputs |

**Root cause**: `handleSave` in `job-charges-modal.tsx` lines 267-314 builds `xData` without `gst_rate` or `hsn_code`. The `PartRow` type already carries both fields (from `part-code-input.tsx`), they just aren't forwarded into the schema or save payload.

---

### 2. Finalization (`final-a-job-section.tsx` + `final-job-form.tsx`)

| Requirement | Status | Notes |
|---|---|---|
| HSN, GST%, force IGST, +GST fields shown only for GST division | ✅ Done | All gated on `isGst` flag |
| Non-GST division hides GST fields | ✅ Done | |
| GST: `sale_pr_gst = selling_price * (1 + gst_rate/100)`, Amt = +GST × qty | ✅ Done | `calculateLinePricing` + `sale_pr_gst` field |
| Non-GST + `force_gst_on_parts_for_non_gst_invoices`: cost += GST, sale = adjusted cost + markup | ✅ Done | `computePartPricesOnSelect` lines 162–168 |
| Non-GST (no force): prices unchanged, Amt = sale × qty | ✅ Done | |
| Recalculate on every editable field change | ✅ Done | `FinalJobForm` calls `calculateLinePricing` on each input |
| Recalculate when division changes (GST ↔ non-GST) | ✅ Done | `handleDivisionChange` lines 687–773 |
| Target amount = `job.amount` or computed total | ✅ Done | `backCalcTarget` state |
| Back-calculate: backward from target amount | ✅ Done | Back-calc logic in `FinalJobForm` |

**No gaps** in the finalization section.

---

### 3. Edit Block for Finalized Jobs

| Requirement | Status | Notes |
|---|---|---|
| `is_final=true` jobs: no Edit button in Actions (single-job section) | ❌ **Missing** | `single-job-section.tsx` line ~724 shows Edit unconditionally; `JobSearchRow` has no `is_final` field |
| `is_final=true` jobs: no Edit button in Actions (opening-job section) | ❌ **Missing** | `opening-job-section.tsx` line ~607 same issue |
| Part-used section disables add/edit/delete for finalized jobs | ✅ Done | `part-used-section.tsx` lines 440-452 |
| Receipts section blocks new receipt for finalized job | ✅ Done | `receipts-section.tsx` line 58 |
| `new-single-job-form.tsx` disables one field for `is_final` | ⚠️ Partial | Only `is_final` checkbox disabled (line 185), other fields still editable |

**Root cause**: `JobSearchRow` type (`job.ts` line 1-21) does not include `is_final`. The SQL query that populates the single-job list (`GET_SINGLE_JOBS_PAGED` or equivalent) likely doesn't return that column. Adding `is_final` to `JobSearchRow` and the underlying SQL + conditionally disabling/hiding the Edit menu item is needed in both sections.

---

### 4. Deliver Job — GST / Non-GST Invoice

| Requirement | Status | Notes |
|---|---|---|
| Delivery generates GST invoice for GST division | ✅ Done | `buildInvoiceLines` + `isGstDivision` check |
| Delivery generates non-GST invoice for non-GST division | ✅ Done | GST amounts zero when `!isGst` |
| Document sequence validation before invoice creation | ✅ In progress | Uncommitted diff adds `svcSeq` check in `handleCreateInvoices`; also `MONEY_RECEIPT` check |

---

### 5. Currently In-Progress Uncommitted Changes (not part of tran.md but adjacent)

- `messages.ts`: Added `ERROR_DOC_SEQ_*` constants for better error messages.
- `delivery-modal.tsx`: Loads division-specific document sequences; validates SERVICE_INVOICE and MONEY_RECEIPT sequences before creating invoices/receipts.
- `opening-job-section.tsx`: Loads `GET_BRANCH_ONLY_DOCUMENT_SEQUENCES`; validates `JOB_SHEET` sequence before creating a new job.
- `single-job-section.tsx`: Same document-sequence loading.
- `sales-entry-section.tsx`: Validates SINV sequence before creating a sales invoice.

These are correct and complementary to the strategy — commit them before starting the tran.md gaps.

---

## Full Task Plan

### Task 0 — Commit in-progress document sequence validation work
**Scope**: Commit the 5 already-modified files as a clean standalone changeset.
- Files: `messages.ts`, `delivery-modal.tsx`, `opening-job-section.tsx`, `single-job-section.tsx`, `sales-entry-section.tsx`

---

### Task 1 — Persist `gst_rate` + `hsn_code` in Parts & Charges modal
**File**: `src/features/client/components/jobs/job-pipeline/job-charges-modal.tsx`

**Step 1.1** — Load two additional app settings on mount:
- `default_gst_rate_for_spare_part` (same key used in `final-a-job-section.tsx` via `selectDefaultGstRate`)
- `default_hsn_for_spare_part` (same key via `selectDefaultHsnForSparePart`)
- `default_hsn_for_service_charge` (same key via `selectDefaultHsnForServiceCharge`)

Add these to the `Promise.all` in the `useEffect` loader (alongside the existing `markup_percent_over_cost` fetch).

**Step 1.2** — Extend the Zod schema and `PartItem` type to carry `gst_rate` and `hsn_code`:
```ts
const partRowSchema = z.object({
    ...existing fields...
    gst_rate: z.number().nullable(),
    hsn_code: z.string(),
});
```

**Step 1.3** — In `handlePartSelect`, populate `gst_rate` and `hsn_code` from `PartRow`:
```ts
setValue(`parts.${index}.gst_rate`,  part.gst_rate ?? defaultGstRate);
setValue(`parts.${index}.hsn_code`,  part.hsn_code?.trim() || defaultHsnForSparePart);
```

**Step 1.4** — In `handleSave`, include `gst_rate` and `hsn_code` in both new-insert and edited-update payloads for `job_part_used`:
```ts
// new parts
{ job_id, part_id, qty, cost_price, selling_price, remarks, gst_rate, hsn_code }
// edited parts
{ id, qty, cost_price, selling_price, remarks }
// Note: do NOT overwrite gst_rate/hsn_code on edit to preserve any changes made during finalization
```
Only include `gst_rate` and `hsn_code` on **new** inserts. Updates should not clobber values already refined during finalization.

**Step 1.5** — Extend the `chargeRowSchema` and `ChargeItem` to carry `gst_rate` and `hsn_code`:
- For new charges: use `0` for `gst_rate` and `""` for `hsn_code` (these are set properly at finalization time).
- The `charge_master` rows already carry `gst_rate`/`hsn_code` — when user selects a charge from `ChargeNameCombobox`, populate them from `chargeOptions`.

**Step 1.6** — In `handleSave` for charges, include `gst_rate` and `hsn_code` in new-insert payloads for `job_additional_charge`.

---

### Task 2 — Block Edit action for finalized jobs in single-job and opening-job sections

**Step 2.1** — Add `is_final` to `JobSearchRow` type (`src/features/client/types/job.ts`):
```ts
export type JobSearchRow = {
    ...
    is_final: boolean;  // add this
};
```

**Step 2.2** — Verify that the SQL queries `GET_SINGLE_JOBS_PAGED` and `GET_OPENING_JOBS_PAGED` (in `sql_store.py`) return the `is_final` column from the `job` table. If not, add `j.is_final` to the SELECT list in both queries.

**Step 2.3** — In `single-job-section.tsx`, update the Edit Job dropdown item (~line 723) to disable/hide when `job.is_final`:
```tsx
<DropdownMenuItem
    disabled={!!job.is_final}
    title={job.is_final ? "Job is finalized — edit not allowed" : undefined}
    onClick={...}
>
    <Pencil className="h-4 w-4" />
    <span>Edit Job</span>
</DropdownMenuItem>
```

**Step 2.4** — Apply the same change to `opening-job-section.tsx` (~line 607).

**Step 2.5 (optional review)** — `new-single-job-form.tsx` line 185 disables the `is_final` checkbox when editing a finalized job. Confirm whether ALL form fields should be locked when `editJob.is_final` is true. If the intent is "no editing at all", gate the entire form on `editJob?.is_final` rather than individual fields.

---

### Task 3 — Wire `ChargeNameCombobox` to populate `gst_rate` / `hsn_code` on charge selection
**File**: `src/features/client/components/jobs/job-pipeline/job-charges-modal.tsx` + `final-a-job/charge-name-combobox.tsx`

The `ChargeNameCombobox` currently only fires `onSelect(name)`. If the combobox is supposed to also supply `gst_rate` and `hsn_code` from the charge master when a predefined charge is selected, extend the callback signature:
```ts
onSelect: (name: string, charge?: AdditionalChargeMasterRow) => void
```
Then in the modal's charge select handler, apply `charge.gst_rate` and `charge.hsn_code` to the row.

This also applies inside `FinalJobForm` / `final-a-job-section.tsx` where charge lines are managed during finalization.

---

### Task 4 — Verify DB columns exist (server-side confirmation)
Check `service_plus_client.sql` to confirm:
- `job_part_used` table has `gst_rate` and `hsn_code` columns (the `GET_JOB_PART_USED_BY_JOB` SQL already selects them, so they exist — confirmed).
- `job_additional_charge` table has `gst_rate`, `hsn_code`, `qty` columns (already in the SELECT of `GET_JOB_ADDITIONAL_CHARGES_BY_JOB` — confirmed).
- No migration needed.

---

### Task 5 — Regression testing checklist

After implementing the above:

1. **Parts & Charges modal — new part added**:
   - Select a part; verify `gst_rate` and `hsn_code` from master are stored in `job_part_used` (inspect via DB or re-open the Final a Job form).
   - Select a part with no `hsn_code`/`gst_rate` in master; verify defaults are used.

2. **Parts & Charges modal — save then open Final a Job**:
   - Verify that the `hsn_code` and `gst_rate` pre-populate correctly in the finalization form without requiring manual entry.

3. **Finalization GST division**:
   - Confirm HSN, GST%, force IGST, +GST columns are visible.
   - Change a selling price; verify +GST recalculates.
   - Switch from GST to non-GST division; verify price recalculation.

4. **Finalization non-GST, force_gst=true**:
   - Confirm cost price is inflated by GST, sale price = adjusted cost + markup.

5. **Edit block — single-job section**:
   - Find a finalized job (`is_final=true`) in the job list.
   - Open Actions; confirm Edit Job is disabled.
   - Confirm View Job and Print PDF still work.

6. **Edit block — opening-job section**:
   - Same as above.

7. **Delivery invoice**:
   - GST division job → invoice shows GST amounts.
   - Non-GST division job → invoice shows zero GST.

---

## Summary of Gaps vs. Done

| Area | Done | Gaps to Fix |
|---|---|---|
| Parts & Charges UI (cost/sale/markup, no GST display) | ✅ | — |
| Parts & Charges save — gst_rate + hsn_code on insert | ❌ | Task 1 |
| Charge save — gst_rate + hsn_code on insert | ❌ | Task 1 |
| Finalization pricing logic (GST/non-GST/force_gst/back-calc) | ✅ | — |
| Division change recalculation | ✅ | — |
| Edit block for finalized jobs | ❌ | Task 2 |
| ChargeNameCombobox GST data propagation | ❌ | Task 3 |
| Deliver generates correct GST/non-GST invoice | ✅ | — |
| Document sequence validation (in progress) | 🔄 In progress | Task 0 (commit) |
