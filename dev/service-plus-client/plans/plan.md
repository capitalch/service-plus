# Plan: Modify "Final for Delivery" Feature

## Overview

Rebuild the "Final for Delivery" section so it:
- Shows only `COMPLETED_OK` jobs (no date filters)
- Has a rich search identical to Job Search / Job Pipeline
- Grid rows with a **View** icon (job details modal) and a **Final** button (opens Final sub-view)
- Final sub-view: editable parts-used + additional-charges, GST/Non-GST FAB, warranty lock, saves `is_final = true`

---

## Server-side Changes

### 1. `GET_FINAL_JOBS_PAGED` SQL

**Current behaviour:** filters by date range + division + some status (likely not `COMPLETED_OK`).

**Changes required:**
- Remove `from_date` and `to_date` parameters entirely.
- Add hard filter: `j.job_status_id = (SELECT id FROM {schema}.job_status WHERE code = 'COMPLETED_OK')` (or use a passed-in status code constant on the server — whichever pattern the server uses).
- Expand the `search` ILIKE to cover: `job_no`, `alternate_job_no`, `customer_name`, `mobile`, `email`, `city`, `technician_name`, `serial_no`, and device string (`product_name || ' ' || brand_name || ' ' || model_name`).
- Return the same columns as `GET_JOB_SEARCH_PAGED` plus `is_final`, so the client can reuse `JobSearchRow`-compatible typing. Required additions to the SELECT:
  - `jt.code AS job_type_code`
  - `COALESCE(p.name || ' / ' || b.name || ' / ' || m.name, '') AS device_details`
  - `j.serial_no`
  - `j.batch_no`
  - `j.is_closed`
  - `j.is_final`
  - `j.division_id`
  - `COUNT(jid.id) AS file_count` (left-join `job_image_doc`)
  - `j.alternate_job_no`

**Signature after change:**
```
GET_FINAL_JOBS_PAGED(branch_id, division_id, search, limit, offset)
```

### 2. `GET_FINAL_JOBS_COUNT` SQL

Same changes as `GET_FINAL_JOBS_PAGED` (remove dates, add `COMPLETED_OK` filter, expand search), but SELECT only `COUNT(*) AS total`.

**Signature after change:**
```
GET_FINAL_JOBS_COUNT(branch_id, division_id, search)
```

### 3. No new SQL queries needed

All other data fetching reuses existing SQL IDs already mapped on the client:
- `GET_JOB_DETAIL` — job detail for the View modal and Final tab header
- `GET_JOB_PART_USED_BY_JOB` — existing parts for the editable table
- `GET_JOB_ADDITIONAL_CHARGES_BY_JOB` — existing charges for the editable table
- `GET_JOB_PARTS_FOR_INVOICE` — auto-populate parts from stock (already used in current FinalForDelivery)

### 4. Save Final — `genericUpdate` payload

No new mutation needed. Use `GRAPHQL_MAP.genericUpdate` with a compound `xDetails` payload:

```
{
  tableName: "job",
  xData: { id: <job_id>, is_final: true },
  xDetails: [
    {
      tableName:  "job_part_used",
      fkeyName:   "job_id",
      deletedIds: [...ids of removed rows],
      xData:      [...upsert rows: { id? (if existing), job_id, part_id, branch_id, quantity, remarks }]
    },
    {
      tableName:  "job_additional_charge",
      fkeyName:   "job_id",
      deletedIds: [...ids of removed rows],
      xData:      [...upsert rows: { id? (if existing), job_id, charge_name, ref_no, description, cost_price, selling_price }]
    }
  ]
}
```

If `job_part_used` requires a `stock_transaction_type_id` or `branch_id` on insert (check DB schema — `requiredForInsert: ['id', 'job_id', 'charge_name']` for charges; for `job_part_used` look up the schema), include those. The existing `part-used-section.tsx` already handles this pattern — mirror it.

---

## Client-side Changes

### File: `final-for-delivery-section.tsx`

#### 1. Remove date filter state and UI
- Delete: `fromDate`, `toDate`, `setFromDate`, `setToDate` state.
- Delete: `currentFinancialYearRange()` import/call.
- Remove date inputs from the toolbar entirely.
- Remove `from_date` / `to_date` from `loadData` args and `commonArgs`.

#### 2. Expand `FinalJobRow` type
Replace the current lean `FinalJobRow` with a type that mirrors `JobSearchRow` (add `job_type_code`, `device_details`, `serial_no`, `batch_no`, `is_closed`, `is_final`, `file_count`, `alternate_job_no`). This is what the new SQL will return.

```ts
type FinalJobRow = {
    id:               number;
    job_no:           string;
    alternate_job_no: string | null;
    job_date:         string;
    job_type_name:    string;
    job_type_code:    string;
    customer_name:    string;
    mobile:           string;
    device_details:   string | null;
    serial_no:        string | null;
    batch_no:         number | null;
    amount:           number | null;
    is_closed:        boolean;
    is_final:         boolean;
    technician_name:  string | null;
    division_id:      number | null;
    file_count:       number;
};
```

#### 3. Expand search placeholder
Change placeholder from `"Job no, alt job no, customer or mobile…"` to:
`"Job no, alt job no, customer, mobile, email, city, technician, serial no, device…"`

#### 4. Rebuild the data grid (list view)

Replace current simple grid with Job-Search-style grid:

| # | Date | Job No | Customer | Mobile | Device Details | Job Type | Amount | Actions |
|---|------|--------|----------|--------|---------------|----------|--------|---------|

- **Date cell**: same as Job Search — date on top, division code badge below (sky color) if `row.division_id`.
- **Job No cell**: job_no in accent mono + `CLOSED` badge if `is_closed` + alt job no sub-line + batch badge if `batch_no` + file-count button if `file_count > 0`.
- **Status column**: removed — all rows are COMPLETED_OK, no need to show it.
- **Actions cell** (sticky right): two buttons:
  - Eye icon (`Eye` from lucide) — opens `JobDetailsModal` for the job. Same pattern as `job-search-section.tsx` using `viewJobId` state.
  - `Flag` or `CheckSquare` icon button labelled **"Final"** — sets `finalJobRow` state and switches to `subView = "final"`.

#### 5. Add `SubView` states
```ts
type SubView = "list" | "final";
```
Remove the `"invoice"` subview entirely (that whole invoice creation flow is removed from this feature — it was the old purpose; the new purpose is just finalising parts/charges and setting `is_final`).

Clean up all invoice-related state: `docSequence`, `jobDocSeq`, `allStates`, `finalStatusId`, `existingInvoice`, `lines`, `isIgst`, `totals`, `executeSave` invoice logic, meta-loading useEffect for document sequences and states.

#### 6. Final sub-view — new component (or inline)

Render when `subView === "final" && selectedJob !== null`.

**Header bar** (same style as current invoice header):
- Back button → `setSubView("list")`
- Job no + customer name
- GST / Non-GST FAB (floating badge on the right):
  - Derive: `const division = availableDivisions.find(d => d.id === selectedJob.division_id) ?? null`
  - `isGstDivision(division)` → show green `"GST"` badge
  - else → show gray `"NON-GST"` badge
- Save button (disabled for warranty, disabled while submitting)

**Body — Job Summary card** (same as current invoice view's Job Summary card):
- Job No, Job Date, Customer, Mobile, Technician, Status, Amount, Problem Reported

**Body — Parts Used section**:

Load `GET_JOB_PART_USED_BY_JOB` on sub-view open. Store as `existingParts: ExistingPartRow[]` and `partLines: EditablePartLine[]` (same shape as used in `part-used-section.tsx`).

```ts
type ExistingPartRow = {
    id:        number;
    part_id:   number;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string | null;
};
type EditablePartLine = {
    _key:      string;
    id?:       number;       // present for existing rows
    part_id:   number | null;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string;
};
```

Editable table columns: Part Code, Part Name, UOM, Qty, Remarks, Delete.
- Part Code / Part Name: use `PartCodeInput` or a simple searchable combobox (mirror `new-part-used-form.tsx`).
- "Add line" button below table.
- **Entire section is read-only when `isWarranty`** (`selectedJob.job_type_code === "UNDER_WARRANTY"`): inputs disabled, add/delete buttons hidden, banner "Warranty job — charges cannot be modified."

**Body — Additional Charges section**:

Load `GET_JOB_ADDITIONAL_CHARGES_BY_JOB` on sub-view open. Store as `chargeLines: EditableChargeLine[]`.

```ts
type EditableChargeLine = {
    _key:          string;
    id?:           number;
    charge_name:   string;
    ref_no:        string;
    description:   string;
    cost_price:    string;    // string for input binding
    selling_price: string;
};
```

Editable table columns: Charge Name*, Ref No, Description, Cost Price, Selling Price*, Delete.
- "Add line" button below table.
- **Same warranty lock** — all inputs disabled, buttons hidden.

**Save logic** (`handleSaveFinal`):
1. Guard: if `isWarranty` return immediately (button should already be disabled).
2. Build `deletedPartIds` = IDs from `existingParts` that are no longer in `partLines`.
3. Build part upsert rows: map `partLines` → `{ id? (existing), job_id, part_id, branch_id: currentBranch.id, quantity, remarks }`.
4. Build `deletedChargeIds` = IDs from `existingCharges` that are no longer in `chargeLines`.
5. Build charge upsert rows: map `chargeLines` → `{ id?, job_id, charge_name, ref_no, description, cost_price, selling_price }`.
6. Call `genericUpdate` with compound payload (see Server-side §4).
7. On success: toast, call `loadData(...)`, `setSubView("list")`.

**`loadFinalData` function** (called when Final sub-view opens):
```ts
async function loadFinalData(row: FinalJobRow) {
    // parallel fetch: GET_JOB_DETAIL + GET_JOB_PART_USED_BY_JOB + GET_JOB_ADDITIONAL_CHARGES_BY_JOB
    setLoadingDetail(true);
    try {
        const [jobRes, partsRes, chargesRes] = await Promise.all([...]);
        setSelectedJob(jobRes...);
        setExistingParts(partsRes...);
        setPartLines(partsRes... mapped to EditablePartLine);
        setExistingCharges(chargesRes...);
        setChargeLines(chargesRes... mapped to EditableChargeLine);
        setSubView("final");
    } finally {
        setLoadingDetail(false);
    }
}
```

#### 7. Meta loading simplification

The meta `useEffect` currently loads document sequences, all states, and job statuses. After the rebuild:
- Remove document sequences loading (no invoice creation).
- Remove all-states loading (no supply state selection).
- Remove job statuses / `finalStatusId` (no longer needed — we set `is_final` directly, not via status change).
- The meta `useEffect` can be removed entirely if nothing else needs it.

#### 8. Imports cleanup
- Remove: `Switch`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `Label`, `Wand2`, `Save`, `Plus`, `Trash2` (if not reused in new table).
- Add: `Eye`, `Flag` (or `CheckSquare`) from lucide.
- Remove imports for `finalForDeliverySchema`, `getFinalForDeliveryDefaultValues`, `FinalForDeliveryFormValues` — delete or repurpose `final-for-delivery-schema.ts`.
- Remove imports for `JobInvoiceFormLine`, `JobInvoiceLineType`, `JobInvoiceType` from job-invoice types.
- Keep: `JobDetailsModal` import (add it — currently not imported in this file).

---

## New / Modified Files Summary

| File | Change |
|------|--------|
| `final-for-delivery-section.tsx` | Major rewrite: remove date filters, invoice flow; add new grid, Final sub-view |
| `final-for-delivery-schema.ts` | Remove invoice-related schemas; add `EditablePartLine`, `EditableChargeLine` types |
| `plans/plan.md` | This file |
| Server: `GET_FINAL_JOBS_PAGED` SQL | Remove dates, add COMPLETED_OK filter, expand search, add columns |
| Server: `GET_FINAL_JOBS_COUNT` SQL | Same filter/search changes, SELECT COUNT only |

---

## UI / UX Notes

- **GST FAB**: position as a small pill badge in the Final sub-view header bar, right-aligned. `"GST"` in `bg-green-100 text-green-700`, `"NON-GST"` in `bg-slate-100 text-slate-600`.
- **Warranty banner**: show a yellow info bar inside the Final tab body (below job summary, above Parts Used) when `isWarranty`:  
  `"This is a warranty job. Parts used and additional charges cannot be modified."`
- **Save button label**: `"Save & Mark Final"`. Disabled when `isWarranty` or submitting.
- **View icon button**: ghost icon button with `Eye` icon, tooltip `"View Job Details"`. Clicking it opens `JobDetailsModal` (the same modal already used in Job Search and Job Pipeline).
- **Final button**: small outlined button with `Flag` icon labelled `"Final"`. Changes to a spinner while `loadingDetail`.
- **Pagination and search debounce**: keep as-is (PAGE_SIZE=50, DEBOUNCE_MS=1600).
- **Division badge in Date cell**: same sky-colored code badge as Job Search.

---

## Implementation Order

1. Server: update `GET_FINAL_JOBS_PAGED` and `GET_FINAL_JOBS_COUNT` SQL.
2. Client: update `FinalJobRow` type.
3. Client: remove date state/UI, update `loadData` signature.
4. Client: rebuild list-view grid (Job-Search style + two action buttons).
5. Client: implement `loadFinalData` + Final sub-view (job summary + editable parts + editable charges + GST FAB + warranty guard).
6. Client: implement `handleSaveFinal` with `genericUpdate` compound payload.
7. Client: wire up `JobDetailsModal` for the eye icon.
8. Client: clean up schema file and unused imports.
