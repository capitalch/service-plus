# Plan — One consistent Device column, with serial no as `SN: <value>`

Source: chat requests of 6 Oct 2026. Steps 1–5 implemented 6 Oct 2026; Your Part A (browser check) outstanding. (The previous plan in this file — plan-based sign-up and billing — is in git history, last committed 3 Oct 2026.)

## Goal

Every grid that shows the job's device does it the same way:

- The column header is **Device**, never "Device Details".
- The cell shows the device (product, brand, model) and, when the job has a serial no, a line **`SN: <value>`** under it. When there is no serial no, there is no SN line.
- Serial no is never shown twice, and never in any other style (`S/N:`, `Sl:`, `SN ` without a colon, or appended raw to the end of the device text).

Decisions already made:
- This covers **grids** (tables of jobs, including grids inside drill-down dialogs). Single-job displays — PDFs, quick-info cards, the Job Details modal, and the status / undo / delivery dialogs — keep their current wording. They are listed under "Not in scope" so the boundary is explicit.
- The server's `device_details` text is **not** changed. It also feeds PDFs, WhatsApp messages, quick-info cards and dialogs. Grids strip a trailing serial from it on the client instead (constraint 1).
- The Job Pipeline report cell drill-down has a **Model** column, not a Device column, and is left alone.

## Present context and current design

There are three ways the device reaches a grid today.

**Case A — server text with the serial already appended (`CONCAT_WS(' ', product, brand, model, serial_no)`), shown as one line, header "Device Details".**

| Grid | Query | Returns `serial_no` separately? |
|---|---|---|
| Job Control (`job-control/job-control-section.tsx`) | `GET_JOB_SEARCH_PAGED` (map key `GET_JOB_CONTROL_PAGED`) | No |
| Single Job (`single-job/single-job-section.tsx`) | `GET_JOBS_PAGED` (Opening Jobs uses `GET_OPENING_JOBS_PAGED`) | No |
| Batch Job (`batch-job/batch-job-section.tsx`) | `GET_JOB_BATCHES_WITH_JOBS_PAGED` | Yes |
| Receipts (`receipts/receipts-section.tsx`) | `GET_JOB_PAYMENTS_PAGED` | No |
| Job Pipeline drill-down (`job-pipeline/job-pipeline-status-drilldown.tsx`) | `GET_JOB_PIPELINE_ALL_PAGED` / `GET_JOB_PIPELINE_PAGED` | No |

**Case B — device text plus a separate serial line, but in mixed styles and mixed headers.**

| Grid | Header today | Serial style today |
|---|---|---|
| Pending Jobs (`final-a-job/pending-jobs-grid.tsx`) | Device Details | `S/N: …` |
| Deliverable Jobs (`deliver-job/deliverable-jobs-grid.tsx`) | Device Details | `S/N: …` |
| Delivered Jobs (`deliver-job/delivered-jobs-grid.tsx`) | Device Details | `S/N: …` |
| Batch Warranty (`batch-warranty-transactions/warranty-jobs-grid.tsx`) | Device | `S/N: …` |
| Batch Job view modal grid (`batch-job/batch-job-view-modal.tsx`) | Device Details | serial joined raw onto brand/product/model |
| Technician product drill-down (`reports/technician/technician-product-cell-dialog.tsx`) | Device | `Sl: …` |
| Extended Warranty leads (`custom/extended-warranty/ew-lead-grid.tsx`) | Device | `SN …` (no colon) |

**Case C — no serial at all.**

| Grid | Header today | Query | Returns `serial_no`? |
|---|---|---|---|
| Finalized Jobs (`final-a-job/finalized-jobs-grid.tsx`) | Device Details | `GET_COMPLETED_JOBS_PAGED` | Yes (a code comment wrongly says `device_details` contains it) |
| Customer Connect (`customer-connect/customer-connect-grid.tsx`) | Device Details | `GET_WHATSAPP_ELIGIBLE_JOBS_PAGED` | No |
| WhatsApp Log (`customer-connect/whatsapp-log-grid.tsx`) | Device Details | `GET_WHATSAPP_EVENT_LOG_PAGED` | No |
| Dashboard recent jobs + its job-list dialog (`reports/dashboard/dashboard-recent-jobs.tsx`) | Device | `GET_DASHBOARD_RECENT_JOBS`, `GET_DASHBOARD_JOBS_RECEIVED_LIST`, `GET_DASHBOARD_JOBS_DELIVERED_LIST`, `GET_DASHBOARD_OPEN_JOBS_LIST` | No |
| Jobs summary / combined drill-down (`reports/common/category-range-cell-dialog.tsx`) | Device | `GET_JOBS_RECEIVED_DETAIL`, `GET_JOBS_REPAIRED_OK_DETAIL`, `GET_JOBS_DELIVERED_OK_DETAIL`, `GET_JOB_TRANSACTIONS_DETAIL` | No |
| Event Tracking drill-down (`reports/jobs/event-tracking-cell-dialog.tsx`) | Device | `GET_EVENT_TRACKING_JOBS` | No |
| Technician monthly drill-down (`reports/technician/technician-cell-dialog.tsx`) | Device | `GET_TECHNICIAN_REPORTS_MONTH_JOBS` | No |
| Warranty Jobs report (`reports/warranty/warranty-jobs-section.tsx`) | Device | `GET_WARRANTY_JOBS_LIST_RANGE` | No |
| Delivered Jobs (Detailed) report (`reports/jobs/jobs-delivered-detailed-section.tsx`) | Device | `GET_DELIVERED_JOBS_DETAILED_RANGE` | No |

The report grids (last six rows) build a two-line cell themselves: product on the first line, then brand • model on a small muted line. Their column `value` string drives search and sort. Warranty Jobs and Delivered Jobs (Detailed) also build a plain-text `device` for their Excel/PDF export.

The job grids that use a hand-built `<table>` have the header text **twice**: once in the loading-skeleton header list and once in the real `<th>`.

**Not in scope (single-job displays, unchanged):** `job-details-modal.tsx` (shows `S/N:`), `ew-lead-detail-dialog.tsx` (`SN …`), `undo-transaction-dialog.tsx`, `status-transition-modal.tsx`, `delivery-modal-jobs-table.tsx`, `reprint-delivery-note-modal.tsx`, the quick-info cards, and every PDF.

## New design brief

- One shared Device cell plus text helpers, which strip a trailing serial from server text and add the `SN:` line → Step 1.
- Server queries that lack a separate `serial_no` column get one → Step 2.
- Every job grid uses the shared cell and the header "Device" → Step 3.
- Every report grid uses the shared serial line, and its search, sort and export text uses `SN: <value>` → Step 4.
- Extended Warranty leads grid moves to `SN:` → Step 4.
- Both help files updated → Step 5.

## Key constraints of new design

1. **Case A text already ends with the serial.** Showing an SN line under it would print the serial twice. Changing the server `CONCAT_WS` would also change PDFs, dialogs and quick-info cards. Resolution: the shared helper `stripTrailingSerial(deviceDetails, serialNo)` removes the serial from the end of the text when it is there. This is the same test `deliver-job/deliver-job-pdf.ts` already uses (`device_details.trim().endsWith(serial_no.trim())`). Server text stays untouched.
2. **The helper needs the serial as its own field.** Resolution: Step 2 adds `j.serial_no` to every grid query that lacks it, without touching the existing `device_details` expression.
3. **WhatsApp `device_details` is used in message templates.** Resolution: leave that expression alone; add `j.serial_no` as a separate column only.
4. **`GET_WARRANTY_JOBS_LIST_RANGE` uses GROUP BY.** Resolution: it groups by `j.id` (primary key), so `j.serial_no` is valid. Add it to the GROUP BY list anyway for clarity.
5. **`sqlId` contract.** Resolution: no new ids and no renames. Only columns are added, so `sql-map.ts` does not change.
6. **Empty serial.** `serial_no` can be NULL or `''`. Resolution: helpers trim it and show nothing when it is empty, so there is never a bare `SN:`.
7. **Header appears twice in hand-built tables.** Resolution: rename both the skeleton list entry and the `<th>`, so the header doesn't flip between "Device Details" and "Device" while loading.
8. **Colour rule.** Resolution: the SN line uses the existing muted text colour (`text-(--cl-text-muted)`), never red.

## Steps

### Step 0 — Your Part

Nothing to do before the build. One browser check after Step 4 — see Your Part A.

| Part | Where | When |
|---|---|---|
| A — look over every changed grid in the browser | after Step 4 | once Step 4 is done |

### Step 1 — Shared Device cell and helpers ✅

Needs: none.

- **Explanation:** One place defines how a device and its serial no look in a grid, so every grid matches and the label can be changed once. File exports:
  - `serialNoText(serialNo)` (function): `"SN: <value>"`, or `""` when empty. Used in `value` strings and export rows.
  - `stripTrailingSerial(deviceDetails, serialNo)` (function): returns the device text with a trailing serial removed (constraint 1), or the text unchanged.
  - `SerialNoLine` (component): `SN: <value>` as a muted line (value in mono), or `null` when empty. It takes an optional `className` so report grids (`text-[10px]`) and job grids (`text-xs`) can match their own row size.
  - `DeviceCell` (component, for job grids): takes `deviceDetails` and `serialNo`, and renders the stripped device text (or `—`) with `SerialNoLine` under it in a small flex column — the layout Deliverable Jobs uses today.
- **Path:** `src/features/client/components/shared/device-cell.tsx` (new). No index barrel; importers use explicit named imports.

### Step 2 — Server: return `serial_no` from every grid query that lacks it ✅

Needs: none.

- **Explanation:** Add `j.serial_no` as a separate selected column next to the device columns. Existing `device_details` / product / brand / model columns are not changed.
- **Path:** `../service-plus-server/app/db/sql/sql_jobs.py` — `GET_JOB_PIPELINE_PAGED`, `GET_JOB_PIPELINE_ALL_PAGED`, `GET_JOBS_PAGED`, `GET_OPENING_JOBS_PAGED`, `GET_JOB_SEARCH_PAGED`, `GET_JOB_PAYMENTS_PAGED`, `GET_WHATSAPP_ELIGIBLE_JOBS_PAGED`, `GET_WHATSAPP_EVENT_LOG_PAGED`.
- **Path:** `../service-plus-server/app/db/sql/sql_reports_audit.py` — `GET_DASHBOARD_RECENT_JOBS`, `GET_DASHBOARD_JOBS_RECEIVED_LIST`, `GET_DASHBOARD_JOBS_DELIVERED_LIST`, `GET_DASHBOARD_OPEN_JOBS_LIST`, `GET_JOBS_RECEIVED_DETAIL`, `GET_JOBS_REPAIRED_OK_DETAIL`, `GET_JOBS_DELIVERED_OK_DETAIL`, `GET_JOB_TRANSACTIONS_DETAIL`, `GET_EVENT_TRACKING_JOBS`, `GET_TECHNICIAN_REPORTS_MONTH_JOBS`, `GET_WARRANTY_JOBS_LIST_RANGE` (also its GROUP BY), `GET_DELIVERED_JOBS_DETAILED_RANGE`.
- **Code:** in each, add `j.serial_no,` (or `j.serial_no AS serial_no` where the query aliases columns). Each query is run once, read-only, against the dev database to confirm it still executes and returns the column.

### Step 3 — Job grids: header "Device" and the shared cell ✅

Needs: Step 1; Step 2 for the grids whose query gained `serial_no`.

- **Explanation:** In each grid:
  - rename "Device Details" to "Device" in both the skeleton header list and the `<th>`;
  - add `serial_no: string | null` to the row type where it is missing;
  - replace the device `<td>` content with `<DeviceCell deviceDetails={row.device_details} serialNo={row.serial_no} />`, deleting the old `S/N:` lines;
  - in Finalized Jobs, delete the wrong "already contains serial_no" comment.
- **Path (Case A):** `job-control/job-control-section.tsx`, `single-job/single-job-section.tsx`, `batch-job/batch-job-section.tsx`, `receipts/receipts-section.tsx`, `job-pipeline/job-pipeline-status-drilldown.tsx`.
- **Path (Case B):** `final-a-job/pending-jobs-grid.tsx`, `deliver-job/deliverable-jobs-grid.tsx`, `deliver-job/delivered-jobs-grid.tsx`, `batch-warranty-transactions/warranty-jobs-grid.tsx` (header already "Device"; its search-text array keeps `row.serial_no`), `batch-job/batch-job-view-modal.tsx` (pass the brand/product/model join as `deviceDetails` and `job.serial_no` separately).
- **Path (Case C):** `final-a-job/finalized-jobs-grid.tsx`, `customer-connect/customer-connect-grid.tsx`, `customer-connect/whatsapp-log-grid.tsx`.
- All under `src/features/client/components/jobs/`.
- **Code (typical):** old `<td className={`${tdClass} text-xs`}>{job.device_details || "—"}</td>`; new `<td className={`${tdClass} text-xs`}><DeviceCell deviceDetails={job.device_details} serialNo={job.serial_no} /></td>`.

### Step 4 — Report grids and the Extended Warranty grid ✅

Needs: Step 1, Step 2.

- **Explanation:** In each report component:
  - add `serial_no: string | null` to the row type;
  - add `<SerialNoLine className="text-[10px]" serialNo={r.serial_no} />` as the last line of the Device cell;
  - append `serialNoText(r.serial_no)` to the column `value` string (trimmed);
  - in the two reports with export rows, append ` • SN: <value>` to the export `device` text when a serial exists.
  - In the Technician product drill-down, replace the hand-written `Sl:` block with `SerialNoLine`, and its `value` with `serialNoText`.
  - In the Extended Warranty leads grid, replace `SN {row.serial_no}` with `SerialNoLine`.
- **Path:** `src/features/client/components/reports/dashboard/dashboard-recent-jobs.tsx`
- **Path:** `src/features/client/components/reports/common/category-range-cell-dialog.tsx`
- **Path:** `src/features/client/components/reports/jobs/event-tracking-cell-dialog.tsx`
- **Path:** `src/features/client/components/reports/technician/technician-cell-dialog.tsx`
- **Path:** `src/features/client/components/reports/technician/technician-product-cell-dialog.tsx`
- **Path:** `src/features/client/components/reports/warranty/warranty-jobs-section.tsx` (cell, `value`, export `device`)
- **Path:** `src/features/client/components/reports/jobs/jobs-delivered-detailed-section.tsx` (cell, `value`, export `device`)
- **Path:** `src/features/client/components/custom/extended-warranty/ew-lead-grid.tsx`
- **Code (typical value):** old `` `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""}` ``; new `` `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""} ${serialNoText(r.serial_no)}`.trim() ``.

### 🧑 Your Part A — look over every changed grid

Needs: Step 4.

1. Jobs: Single Job, Opening Jobs, Batch Job (grid and view modal), Job Control, Receipts, Job Pipeline drill-down, Final a Job (Pending and Finalized), Deliver Job (Deliverable and Delivered), Batch Warranty, Customer Connect, WhatsApp Log. Each header reads **Device**; a job with a serial shows `SN: …` under the device exactly once; a job without one shows no SN line.
2. Reports: Dashboard recent jobs and a received/delivered card drill-down, a Jobs summary drill-down, Event Tracking, Technician monthly and product drill-downs, Warranty Jobs, Delivered Jobs (Detailed). Same check.
3. Extended Warranty leads grid shows `SN: …`.
4. Export Warranty Jobs and Delivered Jobs (Detailed) once each and check the Device text.

Done when: every grid above reads "Device", uses `SN:` only, and never shows a serial twice.

### Step 5 — Help files ✅

Needs: Steps 3–4.

- **Explanation:**
  - `help-content.ts` (staff): one short paragraph — grids show the device under the heading "Device", with `SN: <serial no>` beneath it when the job has a serial number. Replace any existing mention of "Device Details" or `S/N:` in grid descriptions.
  - `dev-help-content.ts` (developer): one new article, "Device column and serial no". It covers the `device-cell.tsx` helpers; why `device_details` is left with the serial appended and stripped on the client (other consumers: PDFs, WhatsApp, dialogs); the list of queries that now return `serial_no`; and the rule that new grids use `DeviceCell` / `SerialNoLine` instead of hand-written serial lines. Grep both files for "Device Details" and `S/N` and fix stale mentions.
- **Path:** `src/features/client/components/help/help-content.ts`, `src/features/super-admin/components/help/dev-help-content.ts`.

## Verification

- `prettier --write` on touched client files; `tsc -b --noEmit` passes. Lint is known to be broken in this package, so it is not used.
- A final grep finds no "Device Details" header and no `S/N:` / `Sl:` in any in-scope grid file.
- Each changed server query runs read-only against the dev tenant database and returns `serial_no`.
- Your Part A browser check.
