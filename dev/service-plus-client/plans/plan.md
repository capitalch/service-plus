# Plan: Update Job — Job-Type Column & Row Colour Coding

## Overview

Two targeted changes to the Update Job table:

1. **Add "Type" column** — insert `job_type_name` as the third column (after Customer, before Mobile).
2. **Row background colour by job type** — each row gets a light background colour determined by the job's `job_type_code`. The colour is constant regardless of job status.

---

## 1. Backend — `GET_UPDATE_JOBS_PAGED` in `sql_store.py`

Add `jt.code AS job_type_code` to the SELECT list so the client receives the code needed to look up the colour.

```python
GET_UPDATE_JOBS_PAGED = """
    with
        "p_branch_id" as (values(%(branch_id)s::bigint)),
        "p_status_id" as (values(%(status_id)s::smallint)),
        "p_limit"     as (values(%(limit)s::int)),
        "p_offset"    as (values(%(offset)s::int))
    SELECT
        j.id,
        j.job_no,
        j.job_date,
        j.job_status_id,
        j.is_closed,
        j.is_final,
        j.amount,
        j.estimate_amount,
        j.diagnosis,
        j.last_transaction_id,
        j.batch_no,
        cc.full_name   AS customer_name,
        cc.mobile,
        jt.name        AS job_type_name,
        jt.code        AS job_type_code,          -- ADD THIS
        js.name        AS job_status_name,
        js.code        AS job_status_code,
        t.name         AS technician_name,
        TRIM(CONCAT_WS(' ', p.name, b.name, pbm.model_name, j.serial_no)) AS device_details,
        (SELECT COUNT(*) FROM job_image_doc jid WHERE jid.job_id = j.id) AS file_count
    FROM job j
    JOIN customer_contact      cc  ON cc.id  = j.customer_contact_id
    JOIN job_type              jt  ON jt.id  = j.job_type_id
    JOIN job_status            js  ON js.id  = j.job_status_id
    LEFT JOIN technician       t   ON t.id   = j.technician_id
    LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
    LEFT JOIN brand            b   ON b.id   = pbm.brand_id
    LEFT JOIN product          p   ON p.id   = pbm.product_id
    WHERE j.branch_id = (table "p_branch_id")
      AND ((table "p_status_id") IS NULL OR j.job_status_id = (table "p_status_id"))
    ORDER BY j.job_date DESC, j.id DESC
    LIMIT  (table "p_limit")
    OFFSET (table "p_offset")
"""
```

---

## 2. Client — `update-job-section.tsx`

### 2a. `OpenJobRow` type — add `job_type_code`

```ts
export type OpenJobRow = {
    // … existing fields …
    job_type_name:       string;
    job_type_code:       string;   // ADD THIS
    // … rest of fields …
};
```

### 2b. Job-type row colour map

Add a pure constant (no imports needed) near the top of the file, after the existing `tdClass`/`thClass` constants:

```ts
const JOB_TYPE_ROW_COLORS: Record<string, string> = {
    MAKE_READY:     "bg-lime-50   dark:bg-lime-950/20",
    ESTIMATE:       "bg-blue-50   dark:bg-blue-950/20",
    UNDER_WARRANTY: "bg-red-50    dark:bg-red-950/20",
    INSTALLATION:   "bg-yellow-50 dark:bg-yellow-950/20",
    DEMO:           "bg-yellow-50 dark:bg-yellow-950/20",
    MAINTENANCE:    "bg-gray-50   dark:bg-gray-800/20",
    INSPECTION:     "bg-gray-50   dark:bg-gray-800/20",
    AMC_SERVICE:    "bg-gray-50   dark:bg-gray-800/20",
    UPGRADE:        "bg-gray-50   dark:bg-gray-800/20",
    REFURBISH:      "bg-gray-50   dark:bg-gray-800/20",
};
```

Any code not in the map falls back to the default row background (no extra class).

### 2c. Table columns — insert "Type" as third column

**Header row** (change column order):

```
# | Date | Job No | Type | Customer | Mobile | Device | Status | Amount | Actions
```

Current order is: `# | Date | Job No | Customer | Mobile | Device | Type | Status | Amount | Actions`

Move `<th>Type</th>` to position 4 (after Job No, before Customer).

**Data rows** — move the Type `<td>` cell after Job No, before Customer.

### 2d. Apply row background colour

On each `<motion.tr>`, look up the colour from `JOB_TYPE_ROW_COLORS` using `row.job_type_code` and append it to the `className`:

```tsx
const rowBg = JOB_TYPE_ROW_COLORS[row.job_type_code] ?? "";

<motion.tr
    key={row.id}
    className={`group transition-colors hover:bg-[var(--cl-accent)]/10 ${rowBg}`}
    ...
>
```

The `hover:bg-[var(--cl-accent)]/10` on hover overrides the row colour briefly, giving feedback. Remove the old `hover:bg-[var(--cl-accent)]/5` and replace with `/10` for better visibility against the coloured backgrounds.

The sticky Actions `<td>` currently sets `bg-[var(--cl-surface)]` to cover its sticky column. Update it to also carry the row colour so it doesn't flash white on coloured rows:

```tsx
<td className={`${tdClass} sticky right-0 z-10 ${rowBg || "bg-[var(--cl-surface)]"} group-hover:bg-[var(--cl-accent)]/10`}>
```

---

## File Summary

| File | Action | Detail |
|------|--------|--------|
| `service-plus-server/app/db/sql_store.py` | MODIFY | Add `jt.code AS job_type_code` to `GET_UPDATE_JOBS_PAGED` SELECT |
| `src/features/client/components/jobs/update-job/update-job-section.tsx` | MODIFY | Add `job_type_code` to `OpenJobRow`; add `JOB_TYPE_ROW_COLORS` map; reorder columns (Type after Customer); apply row background from map; fix sticky Actions cell background |

---

## Implementation Order

1. `sql_store.py` — add `jt.code AS job_type_code` (one line change)
2. `update-job-section.tsx`:
   a. Add `job_type_code: string` to `OpenJobRow`
   b. Add `JOB_TYPE_ROW_COLORS` constant
   c. Reorder header columns (move Type `<th>` after Customer)
   d. Reorder data cells (move Type `<td>` after Customer)
   e. Apply `rowBg` to `<motion.tr>` and sticky Actions `<td>`
3. Build check

---

## Key Decisions

- **`job_type_code` from SQL, not a join on the client** — the code is already available via the `job_type` JOIN; one extra column is cheaper than a second query.
- **Row colour constant on the client** — same pattern as `STATUS_COLORS`; no round-trip needed, codes are stable enum values from seed data.
- **Colour applies regardless of status** — the row background represents what kind of job it is (structural), while the Status badge represents where it is in the workflow (state). These are orthogonal dimensions.
- **Light colours only** — dark-mode variants use `/20` opacity so they remain subtle and don't compete with the status badge colour.
- **Hover overrides row colour** — `hover:bg-[var(--cl-accent)]/10` ensures a consistent hover cue across all row colours.
