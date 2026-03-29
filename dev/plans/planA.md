# Plan: Import of Spare Parts Master from Excel/CSV

## Overview
Add a multi-step import wizard to the Parts Master section. This enables users to upload an Excel/CSV file, map its columns to the `spare_part_master` database fields, preview the mappings, validate the data to identify any invalid rows (which can be safely skipped), import the valid rows using `genericUpdate`, and view the result summary. 

Per the project guidelines, all SQL queries related to "client mode" (including parts master) will be added to `sql_app.py`.

---

## Workflow

```
User clicks "Import" (in PartsSection toolbar)
        │
        ▼
Step 1: Upload Excel/CSV file
  ─ Client renders a file drop-zone
  ─ File is parsed client-side using SheetJS (xlsx)
  ─ Extracted: raw headers + array-of-rows
        │
        ▼
Step 2: Column Mapping
  ─ User maps each source column → target field of spare_part_master
  ─ Required target fields: brand_id (or brand_name), part_code, part_name, uom
  ─ Auto-detect common exact matches for column names
        │
        ▼
Step 3: Preview
  ─ Show first N rows (e.g. 20) as a table with mapped field names
  ─ Basic client-side checks highlighted (e.g. missing required fields, invalid numbers)
        │
        ▼
Step 4: Validation (New step before Import)
  ─ The app does a pre-flight validation check against the database:
    1. Resolve text `brand_name` to actual `brand_id` using the current brand list.
    2. Check `part_code` duplicates using `CHECK_PART_CODE_EXISTS` generically in bulk.
  ─ Provide a summary of how many rows are Valid, Skippable (Duplicates/Missing fields), and Errors.
  ─ User can view the exact invalid data in a datatable. By proceeding, they accept that only the explicit "Valid" rows will be imported, bypassing the invalid/duplicate ones.
        │
        ▼
Step 5: Import Data
  ─ For each valid row, call genericUpdate mutation with INSERT on spare_part_master
  ─ Run in batches (e.g. 50 at a time) with a progress bar
  ─ Collect success/fail feedback for individual rows
        │
        ▼
Step 6: Show Result
  ─ Show summary: X imported successfully
  ─ Option to Close or Download error/skip report as CSV
  ─ On close, reload the parent parts list
```

---

## Execution Steps

### Step 1 — Install SheetJS (xlsx) library
**File:** `service-plus-client/package.json`
- Run `pnpm add xlsx` in `service-plus-client/` to enable client-side parsing of Excel/CSV without uploading the file to the server.

### Step 2 — Verify/Create SQL Constants in `sql_app.py`
**File:** `service-plus-server/app/db/sql_app.py`
- Move or define the `CHECK_PART_CODE_EXISTS` query in `sql_app.py` if not already present, ensuring adherence to the guideline that client mode sql scripts reside here.
- It should look like:
```python
    CHECK_PART_CODE_EXISTS = """
        SELECT EXISTS (
            SELECT 1 FROM {schema}.spare_part_master
            WHERE brand_id = %(brand_id)s
              AND part_code = %(part_code)s
        ) AS exists
    """
```

### Step 3 — Add SQL_MAP entry (client)
**File:** `service-plus-client/src/constants/sql-map.ts`
- Ensure `CHECK_PART_CODE_EXISTS` is properly mapped:
```ts
    CHECK_PART_CODE_EXISTS: "CHECK_PART_CODE_EXISTS",
```

### Step 4 — Define Import Types
**File:** `service-plus-client/src/features/client/types/import-parts.ts` [NEW]
- Define `MappedField`, `ParsedPart` (with validation status fields like `isValid` and `errors`), and `ImportResult`.

### Step 5 — Create the Import Components
**File:** `service-plus-client/src/features/client/components/import-parts-dialog.tsx` [NEW]
- Create the 6-step multi-step wizard UI using `Dialog` component.
- **Validation Step**: Build the specific UI for Step 4 that iterates over rows, queries `CHECK_PART_CODE_EXISTS` via `apolloClient` per brand/part, and groups rows by "Valid" vs "Invalid/Duplicate".

### Step 6 — Modify the Parts Section UI
**File:** `service-plus-client/src/features/client/components/parts-section.tsx` [MODIFY]
- Add an `UploadIcon` action button to the toolbar for "Import".
- Manage state to open the `<ImportPartsDialog>`.
- Pass down loaded `brands` to `ImportPartsDialog` so it can resolve brand names natively on the client.

### Step 7 — Final Testing
- Use a sample `.csv` / `.xlsx` to trigger the wizard.
- Specifically test the new Step 4 (Validation) to ensure it successfully detects an existing part code and accurately presents the user with the skip/ignore flow before Step 5 begins.
