# Implementation Plan: Divisions in Branch

## Overview

A **Division** is a sub-entity within a Branch. One branch can have multiple divisions, each
with its own identity (name, address, GSTIN, PAN, phone, email) and independent invoice
numbering series for sale and service invoices. All divisions within a branch share the same
masters (products, parts, customers, vendors, technicians), jobs/job sheets, inventory, and
document series other than sale/service invoices.

---

## 1. Database Schema Changes

### 1.1 New `division` Table

```sql
CREATE TABLE {schema}.division (
    id            bigserial PRIMARY KEY,
    branch_id     bigint NOT NULL REFERENCES {schema}.branch(id),
    code          text NOT NULL,
    name          text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city          text,
    state_id      integer NOT NULL REFERENCES {schema}.state(id),
    pincode       text NOT NULL,
    phone         text,
    email         text,
    gstin         text,
    pan_no        text,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT division_code_branch_unique UNIQUE (branch_id, code),
    CONSTRAINT division_name_branch_unique UNIQUE (branch_id, name)
);
```

### 1.2 Modify `document_sequence` Table

Add a nullable `division_id` to allow each division to have its own invoice series.

```sql
ALTER TABLE {schema}.document_sequence
    ADD COLUMN division_id bigint REFERENCES {schema}.division(id);

-- Replace old unique constraint
ALTER TABLE {schema}.document_sequence
    DROP CONSTRAINT document_sequence_unique;

CREATE UNIQUE INDEX document_sequence_unique
    ON {schema}.document_sequence (document_type_id, branch_id, COALESCE(division_id, 0));
```

- `division_id IS NULL`  → branch-level sequence (existing rows, all non-invoice document types)
- `division_id IS NOT NULL` → division-specific sequence (sale invoice, job invoice)

### 1.3 Modify Invoice Tables

Stamp which division issued the invoice:

```sql
ALTER TABLE {schema}.sales_invoice
    ADD COLUMN division_id bigint REFERENCES {schema}.division(id);

ALTER TABLE {schema}.job_invoice
    ADD COLUMN division_id bigint REFERENCES {schema}.division(id);
```

`NULL` on existing rows means no division; fully backward-compatible.

### 1.4 Fix Invoice Unique Constraints

Both invoice tables currently enforce `UNIQUE (company_id, invoice_no)`. With divisions each
having their own series, two divisions can legitimately produce `INV-001` — the old constraint
would reject the second. Replace with a division-aware index on both tables:

```sql
ALTER TABLE {schema}.sales_invoice DROP CONSTRAINT sales_invoice_company_no_uidx;
ALTER TABLE {schema}.job_invoice   DROP CONSTRAINT job_invoice_company_no_uidx;

CREATE UNIQUE INDEX sales_invoice_company_no_uidx
    ON {schema}.sales_invoice (company_id, COALESCE(division_id, 0), invoice_no);

CREATE UNIQUE INDEX job_invoice_company_no_uidx
    ON {schema}.job_invoice   (company_id, COALESCE(division_id, 0), invoice_no);
```

Rows with `division_id IS NULL` continue to enforce uniqueness per company as before.

### 1.5 `company_info` — No Structural Change

`company_info` remains a single-row table and is unchanged. It continues to serve:
- Company name displayed in the app header (`context-slice.companyName`).
- The `company_id` FK on invoices (used for scoping the unique constraint above).
- The Company Profile configuration screen.
- Purchase invoice PDFs (buyer identity = company).

The only behavioural change is in **invoice PDF generation** (client-side): when a sale or
job invoice has `division_id` set, the PDF header renders the division's name, address, and
GSTIN instead of the company_info details. When `division_id` is null the existing output is
unchanged.

---

## 2. Server-Side Changes (`service-plus-server`)

### 2.1 SQL Store (`app/db/sql_store.py`)

Add the following new SQL query IDs:

| Query ID | Purpose |
|---|---|
| `GET_DIVISIONS_BY_BRANCH` | All divisions for a branch (ordered by code) |
| `GET_ACTIVE_DIVISIONS_BY_BRANCH` | Active-only list used for context loading and selectors |
| `GET_DIVISION_BY_ID` | Single division fetch for edit pre-population |
| `CHECK_DIVISION_CODE_EXISTS` | Uniqueness check on create |
| `CHECK_DIVISION_CODE_EXISTS_EXCLUDE_ID` | Uniqueness check on edit |
| `CHECK_DIVISION_NAME_EXISTS` | Uniqueness check on create |
| `CHECK_DIVISION_NAME_EXISTS_EXCLUDE_ID` | Uniqueness check on edit |
| `CHECK_DIVISION_IN_USE` | Pre-delete check — blocks delete if any invoice references this division |
| `GET_DOCUMENT_SEQUENCES_BY_DIVISION` | Sequences scoped to a specific `division_id` |

### 2.2 No New Mutations Required

All division operations use existing generic mutations — no new Python helpers needed.

**Division insert / update** — use `genericUpdate` with `{ tableName: "division", xData: { ... } }`.
The same dynamic INSERT/UPDATE path (`exec_sql_object` → `process_data`) used by branch, technician, and other masters handles this without any server changes.

**Division delete** — two-step, client-driven:
1. Client calls `genericQuery` with `CHECK_DIVISION_IN_USE`; if rows returned, show error and stop.
2. Client calls `genericUpdateScript` with `DELETE_DIVISION_BY_ID` SQL. No guard logic needed server-side.

**Invoice generation** — existing `createSalesInvoice` and `createJobInvoice` mutations are unchanged. They already accept `doc_sequence_id` and `doc_sequence_next` from the client and atomically increment whichever sequence row the client resolves. For division invoices the client simply:
1. Queries `GET_DOCUMENT_SEQUENCES_BY_DIVISION` to obtain the division-specific sequence row.
2. Includes `division_id` as a field in the invoice `xData` (new nullable column, handled automatically).
3. Passes `doc_sequence_id` / `doc_sequence_next` from that row — same as today.

**Document sequence config** — `genericUpdate` already handles updating any `document_sequence` row by `id`; no resolver changes needed.

---

## 3. Client-Side Changes (`service-plus-client`)

### 3.1 New Type File — `src/features/client/types/division.ts`

```typescript
export type DivisionType = {
    id:            number;
    branch_id:     number;
    code:          string;
    name:          string;
    address_line1: string;
    address_line2: string | null;
    city:          string | null;
    state_id:      number;
    state_name:    string | null;
    pincode:       string;
    phone:         string | null;
    email:         string | null;
    gstin:         string | null;
    pan_no:        string | null;
    is_active:     boolean;
};

export type DivisionContextType = Pick<DivisionType,
    'id' | 'code' | 'name' | 'gstin' | 'pan_no' | 'address_line1' |
    'address_line2' | 'city' | 'state_id' | 'pincode' | 'phone' | 'email'
> & { state_name: string | null };
```

### 3.2 SQL_MAP Constants — `src/constants/sql-map.ts`

Add entries for all new server-side query IDs listed in §2.1.

### 3.3 Context Slice — `src/store/context-slice.ts`

Extend `ContextStateType`:

```typescript
availableDivisions: DivisionContextType[];
currentDivision:    DivisionContextType | null;
```

Add actions `setAvailableDivisions` and `setCurrentDivision`.
Add selectors `selectAvailableDivisions` and `selectCurrentDivision`.

**Loading logic:** Whenever `currentBranch` changes, dispatch a query for
`GET_ACTIVE_DIVISIONS_BY_BRANCH`. If the branch has exactly one division, auto-select it.
If zero divisions, set `currentDivision = null` (existing behavior, no UI change).

### 3.4 Division Master UI — `src/features/client/components/masters/division/`

Follow the same CRUD pattern used in `masters/branch/`:

| File | Purpose |
|---|---|
| `division.ts` | Zod schema + `DivisionFormValues` type |
| `division-section.tsx` | Paginated list with search, Add / Edit / Delete actions |
| `add-division-dialog.tsx` | Create form with async code & name uniqueness checks |
| `edit-division-dialog.tsx` | Edit form (pre-populated via `GET_DIVISION_BY_ID`) |
| `delete-division-dialog.tsx` | Confirmation dialog; blocks with error if division is in use |

**Form fields:**
- Code (required, unique within branch — debounced uniqueness check)
- Name (required, unique within branch — debounced uniqueness check)
- Address Line 1 (required), Address Line 2, City, State (dropdown), Pincode (required)
- Phone, Email
- GSTIN, PAN No
- Is Active (toggle)

**Add a navigation entry** to the Masters sidebar/menu pointing to Division list, visible only when the current branch has or can have divisions.

### 3.5 Division Selector in App Shell

Add a division switcher pill in the app header/sidebar, adjacent to the branch selector.

- Visible only when `availableDivisions.length > 1`.
- Dispatches `setCurrentDivision` on selection.
- An "All Divisions" option sets `currentDivision = null` for reporting/cross-division views.
- If `availableDivisions.length === 1`, auto-select that division silently (no UI shown).
- If `availableDivisions.length === 0`, selector is hidden entirely (existing branches work unchanged).

### 3.6 Document Sequence Configuration

File: `src/features/client/components/configurations/document-sequence/document-sequence-section.tsx`

- Add a Division tab/toggle at the top of the configuration panel (only shown when
  `availableDivisions.length > 0`).
- When a division is selected in the tab, fetch `GET_DOCUMENT_SEQUENCES_BY_DIVISION` with
  that `division_id` and display its sequences.
- Only sale-invoice and job-invoice document types appear in the division tab; all other
  document types (purchase, stock, etc.) remain in the branch tab and are division-agnostic.
- Save uses the existing `update_document_sequence` mutation extended to accept `division_id`.

### 3.7 Invoice Forms — Sales & Job Invoices

For both `sales-invoice` and `job-invoice` create/edit forms:

**Division selection:**
- If `currentDivision` is non-null, pre-populate `division_id` silently and do not show a selector.
- If `currentDivision` is null and `availableDivisions.length > 1`, render a required Division
  dropdown at the top of the form.
- If `availableDivisions.length === 0`, omit `division_id` entirely (NULL in mutation).

**Invoice header / printout:**
- When `division_id` is set, display division name, address, GSTIN, and PAN on the invoice
  header instead of branch details.

**Invoice numbering:**
- The server auto-resolves the correct sequence (division-specific or branch-level) based on
  `division_id`. No client change needed beyond passing `division_id`.

### 3.8 Invoice List / Filter

For both sales-invoice and job-invoice list pages:

- When `currentDivision` is non-null, automatically apply `division_id` filter to the query.
- When `currentDivision` is null (All Divisions view), show all invoices with an optional
  Division column in the grid displaying the division name.
- Update the corresponding SQL queries on the server to support the optional `division_id` filter.

---

## 4. Backward Compatibility

- All new `division_id` columns are nullable → no existing data breaks.
- Branches without divisions have `availableDivisions = []` and `currentDivision = null`.
  All UI elements that depend on divisions are hidden; all flows work exactly as today.
- The `COALESCE(division_id, 0)` technique in the document_sequence unique index preserves
  the existing branch-level rows.
- Invoice generation without `division_id` follows the original branch-level sequence path.

---

## 5. Implementation Order

| Step | Area | Task |
|---|---|---|
| 1 | DB | Create `division` table, alter `document_sequence`, alter invoice tables |
| 2 | Server | Add SQL query strings for all new query IDs (sql_store.py only) |
| 3 | Client | `division.ts` type file + SQL_MAP entries |
| 4 | Client | Extend context-slice with division state + load on branch change |
| 5 | Client | Division master CRUD components |
| 6 | Client | Division selector in app shell |
| 7 | Client | Document-sequence config — division tab |
| 8 | Client | Invoice forms — division selector + pass division_id |
| 9 | Client | Invoice lists — division filter + division column |
| 10 | QA | Test multi-division branch, single-division auto-select, no-division backward compat |

---

## 6. Edge Cases to Handle

- **Delete branch with divisions** — block delete if any division exists; user must deactivate
  or reassign divisions first.
- **Division deactivated mid-session** — if `currentDivision` is deactivated by another user,
  refresh `availableDivisions` and clear `currentDivision`; show a toast.
- **Cross-division invoice lookup** — receipt and job lookup comboboxes should search across
  all divisions; display division name as a secondary label in results.
- **Division-scoped sequence gap on first invoice** — if no division-specific sequence row
  exists, the server auto-creates it (see §2.2); the client does not need to pre-configure it.
- **Reporting** — All reports that aggregate by branch still work. Add optional division
  breakdown where the report groups or filters by `division_id`.
