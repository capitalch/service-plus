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

### 2.2 GraphQL Mutations (`app/graphql/resolvers/mutation_helper.py`)

**Division CRUD:**
- `resolve_insert_division(branch_id, code, name, address_line1, ...)` → INSERT, return new id
- `resolve_update_division(id, code, name, ...)` → UPDATE
- `resolve_delete_division(id)` → DELETE after `CHECK_DIVISION_IN_USE` guard

**Invoice generation changes:**

When creating a sale or job invoice, if `division_id` is provided:
1. Look up `document_sequence` WHERE `document_type_id = X AND branch_id = Y AND division_id = Z`.
2. If no row exists, auto-create one by copying the branch-level defaults (prefix, padding, separator) with `next_number = 1`.
3. Increment `next_number` on that division-specific row.
4. Stamp `division_id` on the invoice record.

If `division_id` is NULL (branch has no divisions), fall back to existing branch-level sequence logic unchanged.

**Document sequence config:**
- Extend `get_document_sequences` resolver to accept optional `division_id`.
- Extend `update_document_sequence` to handle division-scoped rows.

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
| 2 | Server | Add SQL query strings for all new query IDs |
| 3 | Server | Add division CRUD mutation helpers |
| 4 | Server | Extend invoice generation to accept and use `division_id` |
| 5 | Server | Extend document-sequence resolvers for division scope |
| 6 | Client | `division.ts` type file + SQL_MAP entries |
| 7 | Client | Extend context-slice with division state + load on branch change |
| 8 | Client | Division master CRUD components |
| 9 | Client | Division selector in app shell |
| 10 | Client | Document-sequence config — division tab |
| 11 | Client | Invoice forms — division selector + pass division_id |
| 12 | Client | Invoice lists — division filter + division column |
| 13 | QA | Test multi-division branch, single-division auto-select, no-division backward compat |

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
