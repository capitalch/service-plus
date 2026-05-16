# Implementation Plan: Divisions (Repurpose `company_info` as `division`)

## Overview

`company_info` is renamed to `division`. Each row is a division. A branch can have multiple
divisions. All masters, jobs, and inventory are shared. Sale and job invoices are division-specific
with independent numbering series. A division with a GSTIN produces GST invoices; one without
produces non-GST invoices. Jobs carry a `division_id` that drives invoice type and header.

This plan supersedes the earlier `plan-company-id.md` — the `id` column is kept; `company_id` in
invoice tables is updated: `job_invoice` drops `company_id` entirely; `sales_invoice` renames it to `division_id`.

---

## 2. Backward Compatibility

- All new columns are nullable or have defaults → no existing data breaks.
- Existing `company_info` single row becomes `division` id=1 with code='DIV001'.
- Existing jobs get `division_id = 1` via the back-fill UPDATE.
- Existing `job_invoice` rows: `company_id` column dropped; division is resolved via `job.division_id` at query time — no data loss.
- Existing `sales_invoice` rows: `company_id = 1` renamed to `division_id = 1`, `branch_id` dropped, FK updated to `division(id)`.
- Branches with only one division: division selector hidden, auto-selected silently — UI unchanged.
- `document_sequence` rows with `division_id = NULL` continue to work for branch-level sequences.

---

## 3. Edge Cases

| Case | Handling |
|------|----------|
| Job invoice exists, division changed GST↔non-GST | Warn user; require invoice to be voided before allowing change |
| Division deactivated mid-session | Re-fetch `availableDivisions` on nav; show toast; clear `currentDivision` if it was the deactivated one |
| New division created, no document sequence configured | Server falls back to branch-level sequence; UI prompts user to configure division sequences |
| `default_division_id` setting points to inactive division | Fall back to id=1; show warning in app settings |
| `force_gst_on_parts_for_non_gst_invoices` toggled after invoices exist | Affects only new invoices; existing invoices are unchanged |
| Delete division that has jobs/invoices | Block deletion; `CHECK_DIVISION_IN_USE` returns true; show error |
| Single division branch: no selector shown | Auto-select; all flows work exactly as before |
| Multi-division branch: `currentDivision = null` (All view) | Invoice create requires explicit division selection; lists show all divisions |

---

## 4. Implementation Order

| Step | Area | Task |
|------|------|------|
| 1 | QA | Test multi-division branch, GST↔non-GST switch, force_gst_on_parts, single-division auto-select, no-division backward compat |

---

## 5. Verification

1. Client: Division master CRUD — create / edit / delete work; name uniqueness enforced
2. Client: Job creation shows division dropdown; default pre-selected
3. Client: GST division → invoice lines show tax amounts; non-GST → zero tax
4. Client: `force_gst_on_parts_for_non_gst_invoices = true` → part cost pre-filled at ×1.18
5. Client: Changing division on job (before `is_final`) warns if GST status changes
6. Client: Invoice PDF shows division details, not company_info
7. TypeScript: `tsc --noEmit` passes
