# Implementation Plan: Divisions (Repurpose `company_info` as `division`)

## Overview

`company_info` is renamed to `division`. Each row is a division. A branch can have multiple
divisions. All masters, jobs, and inventory are shared. Sale and job invoices are division-specific
with independent numbering series. A division with a GSTIN produces GST invoices; one without
produces non-GST invoices. Jobs carry a `division_id` that drives invoice type and header.

This plan supersedes the earlier `plan-company-id.md` — the `id` column is kept; `company_id` in
invoice tables is updated: `job_invoice` drops `company_id` entirely; `sales_invoice` renames it to `division_id`.

---

## 1. Database Schema Changes

### 1.1 Rename and Extend `company_info` → `division`

```sql
-- Step 1: Rename table
ALTER TABLE demo1.company_info RENAME TO division;

-- Step 2: Rename company_name → name
ALTER TABLE demo1.division RENAME COLUMN company_name TO name;

-- Step 3: Add new columns
ALTER TABLE demo1.division
    ADD COLUMN branch_id bigint;          -- set existing row to real branch id next

-- Step 4: Populate for the existing singleton row
UPDATE demo1.division
SET branch_id = (SELECT id FROM demo1.branch LIMIT 1)
WHERE id = 1;

-- Step 5: Enforce NOT NULL and constraints
ALTER TABLE demo1.division
    ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE demo1.division
    ADD CONSTRAINT division_branch_fk FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT,
    ADD CONSTRAINT division_name_branch_uidx UNIQUE (branch_id, name);

-- Step 6: Rename the primary key constraint
ALTER TABLE demo1.division RENAME CONSTRAINT company_info_pkey TO division_pkey;

-- Step 7: Rename the state FK
ALTER TABLE demo1.division RENAME CONSTRAINT company_info_state_fk TO division_state_fk;
```

**Resulting `division` columns:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Identity, kept from company_info |
| `branch_id` | bigint NOT NULL | FK → branch(id) |
| `name` | text NOT NULL | Renamed from company_name; unique within branch |
| `address_line1` | text NOT NULL | Unchanged |
| `address_line2` | text | Unchanged |
| `city` | text | Unchanged |
| `state_id` | integer NOT NULL | FK → state(id) |
| `country` | text | Unchanged |
| `pincode` | text | Unchanged |
| `phone` | text | Unchanged |
| `email` | text | Unchanged |
| `gstin` | text | Drives GST vs non-GST invoice |
| `is_active` | boolean | Unchanged |
| `created_at` / `updated_at` | timestamptz | Unchanged |

---

### 1.2 Add `division_id` to `job` Table

```sql
ALTER TABLE demo1.job
    ADD COLUMN division_id bigint REFERENCES demo1.division(id) ON DELETE RESTRICT;

-- Back-fill existing jobs to division 1
UPDATE demo1.job SET division_id = 1;

ALTER TABLE demo1.job ALTER COLUMN division_id SET NOT NULL;

CREATE INDEX idx_job_division ON demo1.job USING btree (division_id);
```

---

### 1.3 Update Invoice Tables

**`job_invoice`** — `division_id` is redundant here because `job_invoice.job_id → job.division_id`
gives the division. Drop `company_id` entirely and enforce invoice number uniqueness per the
`document_sequence` layer (which already prevents duplicates before insert).

```sql
ALTER TABLE demo1.job_invoice DROP CONSTRAINT job_invoice_company_fk;
ALTER TABLE demo1.job_invoice DROP CONSTRAINT job_invoice_company_no_uidx;
ALTER TABLE demo1.job_invoice DROP COLUMN company_id;
ALTER TABLE demo1.job_invoice
    ADD CONSTRAINT job_invoice_invoice_no_uidx UNIQUE (invoice_no);
```

**`sales_invoice`** — has no `job_id`, so `division_id` must be stored directly.
`branch_id` is redundant since `division_id → division.branch_id`; drop it.

```sql
ALTER TABLE demo1.sales_invoice DROP CONSTRAINT sales_invoice_company_fk;
ALTER TABLE demo1.sales_invoice DROP CONSTRAINT sales_invoice_company_no_uidx;
ALTER TABLE demo1.sales_invoice DROP CONSTRAINT sales_invoice_branch_fk;
ALTER TABLE demo1.sales_invoice RENAME COLUMN company_id TO division_id;
ALTER TABLE demo1.sales_invoice DROP COLUMN branch_id;
ALTER TABLE demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_division_fk     FOREIGN KEY (division_id) REFERENCES demo1.division(id) ON DELETE RESTRICT,
    ADD CONSTRAINT sales_invoice_division_no_uidx UNIQUE (division_id, invoice_no);
```

---

### 1.4 Update `document_sequence` for Per-Division Series

```sql
ALTER TABLE demo1.document_sequence
    ADD COLUMN division_id bigint REFERENCES demo1.division(id) ON DELETE RESTRICT;

-- Replace branch-level unique constraint with division-aware one
ALTER TABLE demo1.document_sequence DROP CONSTRAINT document_sequence_unique;

CREATE UNIQUE INDEX document_sequence_unique
    ON demo1.document_sequence (document_type_id, branch_id, COALESCE(division_id, 0));
```

- `division_id IS NULL` → branch-level sequence (all existing rows; non-invoice document types)
- `division_id IS NOT NULL` → division-specific sequence (sale invoice, job invoice per division)

---

### 1.5 Add New `app_setting` Rows

```sql
INSERT INTO demo1.app_setting (id, setting_key, setting_value, description, is_editable) VALUES
    (4, 'default_division_id',                    '1',     'Default division selected when creating a new job', true),
    (5, 'force_gst_on_parts_for_non_gst_invoices','false', 'For non-GST invoices, apply 18% GST implicitly on part cost price; service/labor tax = 0', true)
ON CONFLICT (id) DO NOTHING;
```

---

## 2. Server Changes — `sql_store.py`

File: `dev/service-plus-server/app/db/sql_store.py`

### 2.1 Replace `company_info` queries with `division` queries

**Remove / rename:**
- `CHECK_COMPANY_INFO_EXISTS` → `CHECK_DIVISION_EXISTS`
- `GET_COMPANY_INFO` → `GET_DIVISION_BY_ID` (parameterised) + `GET_DIVISIONS_BY_BRANCH`

**New queries to add:**

```python
GET_DIVISIONS_BY_BRANCH = """
    with "p_branch_id" as (values(%(branch_id)s::bigint))
    SELECT d.id, d.branch_id, d.name, d.address_line1, d.address_line2,
           d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
           d.gstin, d.is_active,
           s.gst_state_code
    FROM division d
    LEFT JOIN state s ON s.id = d.state_id
    WHERE d.branch_id = (table "p_branch_id")
    ORDER BY d.name
"""

GET_ACTIVE_DIVISIONS_BY_BRANCH = """
    with "p_branch_id" as (values(%(branch_id)s::bigint))
    SELECT d.id, d.branch_id, d.name, d.address_line1, d.address_line2,
           d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
           d.gstin,
           s.gst_state_code, s.id AS state_id
    FROM division d
    LEFT JOIN state s ON s.id = d.state_id
    WHERE d.branch_id = (table "p_branch_id") AND d.is_active = true
    ORDER BY d.name
"""

GET_DIVISION_BY_ID = """
    with "p_id" as (values(%(id)s::bigint))
    SELECT d.id, d.branch_id, d.name, d.address_line1, d.address_line2,
           d.city, d.state_id, d.country, d.pincode, d.phone, d.email,
           d.gstin, d.is_active, s.gst_state_code
    FROM division d
    LEFT JOIN state s ON s.id = d.state_id
    WHERE d.id = (table "p_id")
"""

CHECK_DIVISION_NAME_EXISTS = """
    with "p_branch_id" as (values(%(branch_id)s::bigint)),
         "p_name"      as (values(%(name)s::text))
    SELECT EXISTS(
        SELECT 1 FROM division
        WHERE branch_id = (table "p_branch_id")
          AND UPPER(name) = UPPER((table "p_name"))
    ) AS exists
"""

CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID = """
    with "p_branch_id" as (values(%(branch_id)s::bigint)),
         "p_name"      as (values(%(name)s::text)),
         "p_id"        as (values(%(id)s::bigint))
    SELECT EXISTS(
        SELECT 1 FROM division
        WHERE branch_id = (table "p_branch_id")
          AND UPPER(name) = UPPER((table "p_name"))
          AND id <> (table "p_id")
    ) AS exists
"""

CHECK_DIVISION_IN_USE = """
    with "p_id" as (values(%(id)s::bigint))
    SELECT EXISTS(
        SELECT 1 FROM job_invoice ji JOIN job j ON j.id = ji.job_id WHERE j.division_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM sales_invoice WHERE division_id = (table "p_id")
        UNION ALL
        SELECT 1 FROM job WHERE division_id = (table "p_id")
    ) AS in_use
"""

GET_DOCUMENT_SEQUENCES_BY_DIVISION = """
    with "p_branch_id"   as (values(%(branch_id)s::bigint)),
         "p_division_id" as (values(%(division_id)s::bigint))
    SELECT ds.id, ds.document_type_id, ds.branch_id, ds.division_id,
           ds.prefix, ds.next_number, ds.padding, ds.separator,
           dt.code AS doc_type_code, dt.name AS doc_type_name
    FROM document_sequence ds
    JOIN document_type dt ON dt.id = ds.document_type_id
    WHERE ds.branch_id   = (table "p_branch_id")
      AND ds.division_id = (table "p_division_id")
    ORDER BY dt.display_order
"""
```

### 2.2 Update invoice queries

- `GET_JOB_INVOICE_BY_JOB` (line ~3785): remove `ji.company_id` from SELECT (division derived via `job_id → job.division_id`)
- `CHECK_BRANCH_IN_USE` (line ~178): change `SELECT 1 FROM sales_invoice WHERE branch_id = p_id` → JOIN through division: `FROM sales_invoice si JOIN division d ON d.id = si.division_id WHERE d.branch_id = p_id`
- `GET_SALES_INVOICES_COUNT` (line ~2149): replace `WHERE si.branch_id = p_branch_id` → `JOIN division d ON d.id = si.division_id WHERE d.branch_id = p_branch_id`; remove `company_id`, rename to `division_id`
- `GET_SALES_INVOICES_PAGED` (line ~2164): same filter change; remove `si.branch_id` from SELECT; rename `si.company_id` → `si.division_id`
- `GET_SALES_INVOICE_DETAIL` (line ~2200): remove `si.branch_id` from SELECT; rename `si.company_id` → `si.division_id`

### 2.3 No new mutation resolvers needed

All division CRUD uses `genericUpdate` (INSERT/UPDATE via `exec_sql_object`).
Division-specific document sequences are set up via `genericUpdate` on `document_sequence` rows.
For `sales_invoice` creation, client passes `division_id` in `xData`; the server stores it as-is.
For `job_invoice` creation, no `division_id` is needed in the payload — the division is implicit via `job_id → job.division_id`.

---

## 3. Server Changes — `sql_bu.py`

File: `dev/service-plus-server/app/db/sql_bu.py`

Update `CREATE TABLE company_info` → `CREATE TABLE division` with all new columns.
Update `CREATE TABLE job` to include `division_id bigint NOT NULL`.
Update `CREATE TABLE job_invoice`: drop `company_id`, add `UNIQUE (invoice_no)`.
Update `CREATE TABLE sales_invoice`: rename `company_id` → `division_id`, drop `branch_id`, update FK and unique constraint.
Update all constraint names from `company_*` → `division_*`.
Add `CREATE TABLE document_sequence` with new `division_id` column.
Add new seed rows for `app_setting` (ids 4 and 5).

---

## 4. Client Changes

### 4.1 `sql-map.ts` — `src/constants/sql-map.ts`

Add:
```ts
GET_DIVISIONS_BY_BRANCH:               "GET_DIVISIONS_BY_BRANCH",
GET_ACTIVE_DIVISIONS_BY_BRANCH:        "GET_ACTIVE_DIVISIONS_BY_BRANCH",
GET_DIVISION_BY_ID:                    "GET_DIVISION_BY_ID",
CHECK_DIVISION_NAME_EXISTS:            "CHECK_DIVISION_NAME_EXISTS",
CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID: "CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID",
CHECK_DIVISION_IN_USE:                 "CHECK_DIVISION_IN_USE",
GET_DOCUMENT_SEQUENCES_BY_DIVISION:    "GET_DOCUMENT_SEQUENCES_BY_DIVISION",
```

Remove: `GET_COMPANY_INFO`, `CHECK_COMPANY_INFO_EXISTS`

---

### 4.2 New Type File — `src/features/client/types/division.ts`

```ts
export type DivisionType = {
    id:            number;
    branch_id:     number;
    name:          string;
    address_line1: string;
    address_line2: string | null;
    city:          string | null;
    state_id:      number;
    country:       string | null;
    pincode:       string | null;
    phone:         string | null;
    email:         string | null;
    gstin:         string | null;
    gst_state_code: string | null;
    is_active:     boolean;
};

// Minimal type for context and invoice header
export type DivisionContextType = Pick<DivisionType,
    'id' | 'name' | 'address_line1' | 'address_line2' |
    'city' | 'state_id' | 'country' | 'pincode' | 'phone' | 'email' |
    'gstin' | 'gst_state_code'
>;

// True when division has a GSTIN → produce GST invoice
export const isGstDivision = (d: DivisionContextType | null) => !!d?.gstin;
```

---

### 4.3 Update `db-schema-service.ts` — `src/types/db-schema-service.ts`

- Rename `CompanyInfo` / `CompanyInfoInput` → `Division` / `DivisionInput`
- Add `branch_id` to the interface
- Remove `company_name` → `name`
- Remove `company_info` metadata entry → replace with `division`
- In `JobInvoice` / `SalesInvoice` interfaces: rename `company_id` → `division_id`
- In `JobInvoice`: remove `company_id` entirely (no `division_id` needed — derive via job)
- In `SalesInvoice`: rename `company_id` → `division_id`; remove `branch_id`; update FK entry to `division_id → division(id)`; remove `branch_id` FK entry
- Add `division_id` to `Job` interface

---

### 4.4 Context Slice — `src/store/context-slice.ts`

Extend state:
```ts
availableDivisions:  DivisionContextType[];
currentDivision:     DivisionContextType | null;
defaultDivisionId:   number;                    // from app_setting key 'default_division_id'
forceGstOnPartsForNonGst: boolean;              // from app_setting key 'force_gst_on_parts_for_non_gst_invoices'
```

**Loading logic** (triggered when `currentBranch` changes):
1. Query `GET_ACTIVE_DIVISIONS_BY_BRANCH` for the branch.
2. Query `app_setting` for `default_division_id` and `force_gst_on_parts_for_non_gst_invoices`.
3. Auto-select: if `availableDivisions.length === 1`, set `currentDivision` to it.
4. If `default_division_id` setting matches a division in the list, auto-select that.
5. If `availableDivisions.length === 0`, set `currentDivision = null` (backward-compatible).

Add actions: `setAvailableDivisions`, `setCurrentDivision`.
Add selectors: `selectAvailableDivisions`, `selectCurrentDivision`, `selectIsGstMode`.

---

### 4.5 Division Master CRUD — `src/features/client/components/masters/division/`

Follow the same CRUD pattern as `masters/branch/`. Files:

| File | Purpose |
|------|---------|
| `division-schema.ts` | Zod schema + `DivisionFormValues` |
| `division-section.tsx` | Paginated list with Add / Edit / Delete |
| `add-division-dialog.tsx` | Create form; debounced code uniqueness check |
| `edit-division-dialog.tsx` | Edit form pre-populated via `GET_DIVISION_BY_ID` |
| `delete-division-dialog.tsx` | Confirm dialog; blocks if `CHECK_DIVISION_IN_USE` returns true |

**Form fields:** Name, Address Line 1, Address Line 2, City, State (dropdown), Country,
Pincode, Phone, Email, GSTIN, Is Active.

**Navigation:** Replace "Company Profile" in the Configurations menu with "Divisions".

**Mutation:** Use `genericUpdate` with `{ tableName: "division", xData: { ...fields } }`.
For inserts include `branch_id` from context; `id` drives INSERT vs UPDATE as before.

---

### 4.6 Division Selector in App Shell

Add a Division selector pill in the header/sidebar adjacent to the Branch selector.

- Hidden when `availableDivisions.length <= 1` (single division auto-selected silently).
- Visible when `availableDivisions.length > 1`.
- An "All Divisions" option sets `currentDivision = null` (for cross-division reporting views).
- Dispatches `setCurrentDivision` on selection.

---

### 4.7 Document Sequence Configuration

File: `src/features/client/components/configurations/document-sequence/document-sequence-section.tsx`

- Add a Division tab at the top (visible only when `availableDivisions.length > 0`); each tab labelled by division `name`.
- When a division tab is active, fetch `GET_DOCUMENT_SEQUENCES_BY_DIVISION` with that `division_id`.
- Only sale-invoice and job-invoice document types appear in the division tab.
- When saving, pass `division_id` in the `xData` via `genericUpdate`.
- When a new division is created, the system auto-creates its document sequence rows on first
  invoice (server resolves via the division's `document_sequence` row; client pre-configures if desired).

---

### 4.8 Job Creation / Edit — Division Selection and GST Impact

Files: `single-job-section.tsx`, `batch-job-section.tsx`, and related forms.

**Division field:**
- On job create form, show a Division dropdown.
- Default: `defaultDivisionId` from context (from app_setting), or division_id = 1.
- If only one division exists, pre-select silently without showing the dropdown.
- Send `division_id` in the job `xData` on create.

**Changing division on an existing job (before `is_final = true`):**
- Allow editing `division_id` via `genericUpdate` on the `job` table.
- If the division's GST status changes (GST ↔ non-GST):
  - Check if a job_invoice exists for this job.
  - If yes: warn user "Invoice must be regenerated due to GST status change." Block or void invoice.
  - If no invoice yet: proceed silently.

**Division on job view / job sheet:**
- Display division name, address, and GSTIN in the job sheet header (replacing company info).
- Fetch division data using `GET_DIVISION_BY_ID` with `job.division_id`.

---

### 4.9 GST Calculation Logic

Located in invoice creation helpers (Ready-for-Delivery, Sales Invoice form).

**Rule 1 — Is it a GST invoice?**
```ts
const isGst = !!currentDivision?.gstin;
```

**Rule 2 — GST on parts for non-GST invoices:**
```ts
const forceGstOnParts = !isGst && appSettings.forceGstOnPartsForNonGst;
```

**Part line cost_price pre-fill (when `forceGstOnParts = true`):**
```ts
suggestedCostPrice = storedCostPrice * 1.18;  // user can override
taxRate = 0;                                   // no GST line on invoice
```

**Service / Labor tax rate for non-GST:**
```ts
taxRate = isGst ? defaultGstRate : 0;
```

**Summary table:**

| Scenario | Parts tax rate | Service/labor tax rate | Parts cost pre-fill |
|----------|---------------|----------------------|---------------------|
| GST division | per-item rate | default GST rate | stored cost_price |
| Non-GST, `forceGstOnParts = false` | 0 | 0 | stored cost_price |
| Non-GST, `forceGstOnParts = true` | 0 | 0 | `cost_price × 1.18` (editable) |

---

### 4.10 Ready-for-Delivery — Job Invoice Creation

File: `src/features/client/components/jobs/ready-for-delivery/ready-for-delivery-section.tsx`

- Remove `company_id` from the job_invoice payload entirely — `division_id` is not needed since the server derives it from `job_id → job.division_id`.
- Fetch division data for the job's `division_id` (from `job` row) to apply GST rules and render PDF header.
- Apply GST calculation per §4.9.
- Use division-specific document sequence for invoice numbering.
- Invoice PDF header: show division name, address, and GSTIN.

---

### 4.11 Sales Invoice Creation

File: `src/features/client/components/inventory/sales-invoice/`

- Add `division_id` to the invoice payload (from `currentDivision.id` or from a dropdown if
  `currentDivision` is null and multiple divisions exist).
- Remove `branch_id` from the payload — no longer a column on `sales_invoice`.
- Replace `company_id` → `division_id` throughout.
- Apply GST rules per §4.9.
- Use division-specific document sequence.
- Invoice PDF header: show division details.

---

### 4.12 Invoice Lists and Filters

- **Job invoice list:** filter by division by joining `job_invoice → job` on `job.division_id`; add Division column (from `job.division_id`) when `currentDivision` is null.
- **Sales invoice list:** filter by `si.division_id`; add Division column when `currentDivision` is null.
- Update server SQL queries accordingly.

---

### 4.13 Job Invoice / Sales Invoice PDF

- **Job invoice PDF**: division is fetched via `job_id → job.division_id → division`; render name, address, and GSTIN in the header.
- **Sales invoice PDF**: division is read from `sales_invoice.division_id → division`; render name, address, and GSTIN in the header.
- `CompanyInfoType` used in `job-sheet-pdf.ts` and `job-detail-pdf.ts` → replace with `DivisionContextType`.

---

## 5. Backward Compatibility

- All new columns are nullable or have defaults → no existing data breaks.
- Existing `company_info` single row becomes `division` id=1 with code='DIV001'.
- Existing jobs get `division_id = 1` via the back-fill UPDATE.
- Existing `job_invoice` rows: `company_id` column dropped; division is resolved via `job.division_id` at query time — no data loss.
- Existing `sales_invoice` rows: `company_id = 1` renamed to `division_id = 1`, `branch_id` dropped, FK updated to `division(id)`.
- Branches with only one division: division selector hidden, auto-selected silently — UI unchanged.
- `document_sequence` rows with `division_id = NULL` continue to work for branch-level sequences.

---

## 6. Edge Cases

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

## 7. Implementation Order

| Step | Area | Task |
|------|------|------|
| 1 | DB | Run migration SQL (§1.1–1.5): rename table, add columns, update FKs, add app_settings |
| 2 | Server | Update `sql_store.py`: rename company_info queries, add division queries, rename `company_id` in invoice SELECTs |
| 3 | Server | Update `sql_bu.py` to match new schema for backup/restore |
| 4 | Client | Add `division.ts` type file and `sql-map.ts` entries |
| 5 | Client | Update `db-schema-service.ts`: rename types, rename `company_id` → `division_id` |
| 6 | Client | Extend context-slice with division state + load on branch change |
| 7 | Client | Division master CRUD components (replaces Company Profile) |
| 8 | Client | Division selector in app shell |
| 9 | Client | Job form: division dropdown, back-fill default, change-division guard |
| 10 | Client | Document sequence config: division tab |
| 11 | Client | GST calculation logic (§4.9) in invoice helpers |
| 12 | Client | Ready-for-Delivery: use `division_id`, apply GST rules, update PDF header |
| 13 | Client | Sales invoice: use `division_id`, apply GST rules, update PDF header |
| 14 | Client | Invoice list filters and Division column |
| 15 | QA | Test multi-division branch, GST↔non-GST switch, force_gst_on_parts, single-division auto-select, no-division backward compat |

---

## 8. Verification

1. DB: `\d division` shows all columns; existing row has `code='DIV001'`, `branch_id` set
2. DB: `job.division_id` column exists; existing jobs have `division_id=1`
3. DB: `job_invoice` has no `company_id`/`division_id`; `sales_invoice.division_id` exists with correct FK
4. DB: `document_sequence` has `division_id` column; old rows unaffected
5. Server: `GET_ACTIVE_DIVISIONS_BY_BRANCH` returns divisions for a branch
6. Client: Division master CRUD — create / edit / delete work; code uniqueness enforced
7. Client: Job creation shows division dropdown; default pre-selected
8. Client: GST division → invoice lines show tax amounts; non-GST → zero tax
9. Client: `force_gst_on_parts_for_non_gst_invoices = true` → part cost pre-filled at ×1.18
10. Client: Changing division on job (before `is_final`) warns if GST status changes
11. Client: Invoice PDF shows division details, not company_info
12. TypeScript: `tsc --noEmit` passes
