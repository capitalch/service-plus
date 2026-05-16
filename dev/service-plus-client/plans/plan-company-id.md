# Plan: Remove `id` from `company_info` and `company_id` from Invoice Tables

## Context

The `company_info` table will always have exactly one row (singleton). Its `id` column (always `1`) has no semantic value. It is currently used as a foreign key in `job_invoice.company_id` and `sales_invoice.company_id` — which are equally redundant since there is only ever one company. The goal is to remove these redundant columns cleanly across DB, server, and client.

The generic server upsert (`exec_sql_object` → `get_sql` in `psycopg_driver.py`) decides INSERT vs UPDATE based on presence of `id` in the payload, and generates `UPDATE ... WHERE id = %s`. Removing `id` from `company_info` means this path cannot be used. Instead, a `UPSERT_COMPANY_INFO` query in `sql_store.py` will be executed via the existing `genericUpdateScript` mutation — no new resolver or mutation needed.

---

## Answer: Is `id` needed?

**No.** `company_info.id` (and `job_invoice.company_id` / `sales_invoice.company_id`) are all redundant. All three can be removed.

---

## Current State

- `company_info.id` is the PRIMARY KEY, always value `1`
- `job_invoice.company_id smallint NOT NULL` → FK to `company_info(id)`, part of UNIQUE `(company_id, invoice_no)`
- `sales_invoice.company_id bigint NOT NULL` → FK to `company_info(id)`, part of UNIQUE `(company_id, invoice_no)`
- Client `company-profile-section.tsx` already hardcodes fallback `xData.id = existingId ?? 1`
- Client `ready-for-delivery-section.tsx` sends `company_id: companyInfo?.id ?? null` when creating a job invoice

---

## Changes Required

### 1. Database Schema

Both `service_plus_demo.sql` (at `/home/sushant/projects/service-plus/db/service_plus_demo.sql`) and `sql_bu.py` define the schema and must be updated consistently.

#### Migration SQL Script

Run against the `demo1` schema (or set `search_path` appropriately):

```sql
-- ── 1. Drop FK constraints that reference company_info(id) ────────────────
ALTER TABLE ONLY demo1.job_invoice
    DROP CONSTRAINT IF EXISTS job_invoice_company_fk;

ALTER TABLE ONLY demo1.sales_invoice
    DROP CONSTRAINT IF EXISTS sales_invoice_company_fk;

-- ── 2. Drop composite unique constraints that include company_id ──────────
ALTER TABLE ONLY demo1.job_invoice
    DROP CONSTRAINT IF EXISTS job_invoice_company_no_uidx;

ALTER TABLE ONLY demo1.sales_invoice
    DROP CONSTRAINT IF EXISTS sales_invoice_company_no_uidx;

-- ── 3. Drop company_id columns from invoice tables ────────────────────────
ALTER TABLE ONLY demo1.job_invoice
    DROP COLUMN IF EXISTS company_id;

ALTER TABLE ONLY demo1.sales_invoice
    DROP COLUMN IF EXISTS company_id;

-- ── 4. Add invoice_no unique constraint (replaces the old composite one) ──
ALTER TABLE ONLY demo1.job_invoice
    ADD CONSTRAINT job_invoice_invoice_no_uidx UNIQUE (invoice_no);

ALTER TABLE ONLY demo1.sales_invoice
    ADD CONSTRAINT sales_invoice_invoice_no_uidx UNIQUE (invoice_no);

-- ── 5. Drop primary key from company_info ─────────────────────────────────
ALTER TABLE ONLY demo1.company_info
    DROP CONSTRAINT IF EXISTS company_info_pkey;

-- ── 6. Drop id column from company_info ──────────────────────────────────
ALTER TABLE ONLY demo1.company_info
    DROP COLUMN IF EXISTS id;

-- ── 7. Add singleton_guard to company_info ────────────────────────────────
--    DEFAULT true means the existing row is populated automatically.
--    The UNIQUE + CHECK guarantee exactly one row forever.
ALTER TABLE ONLY demo1.company_info
    ADD COLUMN singleton_guard boolean DEFAULT true NOT NULL;

ALTER TABLE ONLY demo1.company_info
    ADD CONSTRAINT company_info_singleton_uidx UNIQUE (singleton_guard);

ALTER TABLE ONLY demo1.company_info
    ADD CONSTRAINT company_info_singleton_chk CHECK (singleton_guard = true);
```

#### What each step does

| Step | Action | Why first |
|------|--------|-----------|
| 1 | Drop FKs on invoice tables | FKs reference `company_info(id)` — must go before touching `company_info` |
| 2 | Drop composite unique indexes | Include `company_id` column — must go before dropping the column |
| 3 | Drop `company_id` columns | Now safe; all constraints referencing them are gone |
| 4 | Add `UNIQUE (invoice_no)` | Restores the uniqueness guarantee without `company_id` |
| 5 | Drop `company_info_pkey` | Primary key on `id` — must go before dropping the column |
| 6 | Drop `id` column | Now safe; PK and all FK references are gone |
| 7 | Add `singleton_guard` | New upsert target; `DEFAULT true` auto-fills the existing row |

---

### 2. Server — `sql_store.py`

File: `dev/service-plus-server/app/db/sql_store.py`

**`GET_COMPANY_INFO`** (line ~594):
```python
# Before
GET_COMPANY_INFO = """
    SELECT ci.id, ci.company_name, ci.address_line1, ci.address_line2,
           ci.city, ci.state_id, ci.country, ci.pincode, ci.phone, ci.email,
           ci.gstin, ci.is_active, s.gst_state_code
    FROM company_info ci
    LEFT JOIN state s ON s.id = ci.state_id
    ORDER BY ci.id
    LIMIT 1
"""

# After
GET_COMPANY_INFO = """
    SELECT ci.company_name, ci.address_line1, ci.address_line2,
           ci.city, ci.state_id, ci.country, ci.pincode, ci.phone, ci.email,
           ci.gstin, ci.is_active, s.gst_state_code
    FROM company_info ci
    LEFT JOIN state s ON s.id = ci.state_id
    LIMIT 1
"""
```

**New `UPSERT_COMPANY_INFO`** query (add near GET_COMPANY_INFO):
```python
UPSERT_COMPANY_INFO = """
    INSERT INTO company_info
        (company_name, address_line1, address_line2, city, state_id,
         country, pincode, phone, email, gstin, is_active, singleton_guard)
    VALUES
        (%(company_name)s, %(address_line1)s, %(address_line2)s, %(city)s, %(state_id)s,
         %(country)s, %(pincode)s, %(phone)s, %(email)s, %(gstin)s, %(is_active)s, true)
    ON CONFLICT (singleton_guard) DO UPDATE SET
        company_name   = EXCLUDED.company_name,
        address_line1  = EXCLUDED.address_line1,
        address_line2  = EXCLUDED.address_line2,
        city           = EXCLUDED.city,
        state_id       = EXCLUDED.state_id,
        country        = EXCLUDED.country,
        pincode        = EXCLUDED.pincode,
        phone          = EXCLUDED.phone,
        email          = EXCLUDED.email,
        gstin          = EXCLUDED.gstin,
        is_active      = EXCLUDED.is_active,
        updated_at     = now()
"""
```

**`GET_JOB_INVOICE_BY_JOB`** (line ~3785): Remove `ji.company_id` from SELECT.

**`GET_SALES_INVOICES_PAGED` / `GET_SALES_INVOICE_DETAIL`** (lines ~2164, ~2200): Remove `si.company_id` from SELECTs if present.

---

### 3. Server — No new mutation needed

`genericUpdateScript` already handles this. It looks up any `SqlStore` attribute by name (`sql_id`) and executes it via `exec_sql` with named args (`sql_args`). Adding `UPSERT_COMPANY_INFO` to `sql_store.py` is sufficient — no changes to `mutation_helper.py` or the GraphQL schema.

Flow:
```
client  →  genericUpdateScript(sql_id="UPSERT_COMPANY_INFO", sql_args={...})
server  →  resolve_generic_update_script_helper
           → getattr(SqlStore, "UPSERT_COMPANY_INFO")
           → exec_sql(db_name, schema, sql, sql_args)
           → ON CONFLICT (singleton_guard) DO UPDATE …
```

---

### 4. Server — `sql_bu.py`

File: `dev/service-plus-server/app/db/sql_bu.py`

Update `CREATE TABLE company_info` (line ~64):
- Remove `id` column
- Add `singleton_guard boolean DEFAULT true NOT NULL`

Update `CREATE TABLE job_invoice` (line ~223):
- Remove `company_id smallint NOT NULL`

Update `CREATE TABLE sales_invoice` (line ~453):
- Remove `company_id bigint NOT NULL`

Update constraints section:
- Remove `company_info_pkey PRIMARY KEY (id)` → add `company_info_singleton UNIQUE (singleton_guard)` + `CHECK (singleton_guard = true)`
- Remove `job_invoice_company_no_uidx UNIQUE (company_id, invoice_no)` → add `UNIQUE (invoice_no)`
- Remove `sales_invoice_company_no_uidx UNIQUE (company_id, invoice_no)` → add `UNIQUE (invoice_no)`
- Remove `job_invoice_company_fk` FK
- Remove `sales_invoice_company_fk` FK

---

### 5. Client — Type Definitions

File: `src/types/db-schema-service.ts`

**`CompanyInfo` interface**: Remove `id: number`

**`CompanyInfoInput` interface**: Remove `id?: number | null`

**`company_info` metadata object**:
- Remove `'id'` from `columns` array
- Remove `'id'` from `requiredForInsert` array
- Remove `primaryKey: 'id'`

**`JobInvoice` interface**: Remove `company_id: number`

**`JobInvoiceInput` interface**: Remove `company_id?: number | null`

**`job_invoice` metadata object**:
- Remove `'company_id'` from `columns` and `requiredForInsert`
- Remove `company_id` from `foreignKeys`

**`SalesInvoice` interface**: Remove `company_id: number`

**`SalesInvoiceInput` interface**: Remove `company_id?: number | null`

**`sales_invoice` metadata object**:
- Remove `'company_id'` from `columns` and `requiredForInsert`
- Remove `company_id` from `foreignKeys`

---

### 6. Client — `sql-map.ts`

File: `src/constants/sql-map.ts`

Add one constant next to the existing company entries (line ~143):
```ts
UPSERT_COMPANY_INFO: "UPSERT_COMPANY_INFO",
```

---

### 7. Client — Company Profile Section

File: `src/features/client/components/configurations/company-profile/company-profile-section.tsx`

**a) Remove `existingId` state** — replace with a plain boolean `hasExistingData`:
```ts
// Before
const [existingId, setExistingId] = useState<number | null>(null);

// After
const [hasExistingData, setHasExistingData] = useState(false);
```

**b) On load** — replace `setExistingId(row.id)` with `setHasExistingData(true)`:
```ts
// Before (line ~139)
if (rows.length > 0) {
    const row = rows[0];
    setExistingId(row.id);
    form.reset({ ... });
}

// After
if (rows.length > 0) {
    const row = rows[0];
    setHasExistingData(true);
    form.reset({ ... });   // same fields, no row.id reference
}
```

**c) Replace the mutation call** — switch from `genericUpdate` (id-based) to `genericUpdateScript`:
```ts
// Before
xData.id = existingId ?? 1;
if (existingId === null) {
    xData.isIdInsert = true;
}
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdate,
    variables: {
        db_name: dbName,
        schema,
        value: graphQlUtils.buildGenericUpdateValue({
            tableName: "company_info",
            xData,
        }),
    },
});
if (existingId === null) setExistingId(1);

// After
await apolloClient.mutate({
    mutation: GRAPHQL_MAP.genericUpdateScript,
    variables: {
        db_name: dbName,
        schema,
        value: encodeObj({
            sql_id:   SQL_MAP.UPSERT_COMPANY_INFO,
            sql_args: xData,          // plain fields, no id/isIdInsert
        }),
    },
});
if (!hasExistingData) setHasExistingData(true);
```

**d) UI label** — replace `existingId` with `hasExistingData`:
```ts
// Before (line ~233)
{existingId ? "Update your company details" : "Set up your company profile"}

// After
{hasExistingData ? "Update your company details" : "Set up your company profile"}
```

Note: check whether `encodeObj` is already imported in this file; if not, use `graphQlUtils.buildGenericUpdateScriptValue` or the same `encodeURIComponent(JSON.stringify(...))` pattern used elsewhere.

---

### 8. Client — Ready-for-Delivery Section

File: `src/features/client/components/jobs/ready-for-delivery/ready-for-delivery-section.tsx`

- Line 424: Remove `company_id: companyInfo?.id ?? null` from the job_invoice creation payload
- `companyInfo` is still fetched for other fields (gstin, gst_state_code) — only the `id` usage is removed

---

### 9. Client — Job Invoice Type

File: `src/features/client/types/job-invoice.ts`

- Line 4: Remove `company_id: number` from the type definition

---

## File Summary

| File | What Changes |
|------|-------------|
| `/home/sushant/projects/service-plus/db/service_plus_demo.sql` | Schema: remove `id` from company_info, remove `company_id` from invoice tables, update constraints |
| `dev/service-plus-server/app/db/sql_bu.py` | Same schema changes as above (backup/restore script) |
| `dev/service-plus-server/app/db/sql_store.py` | Update GET_COMPANY_INFO, add UPSERT_COMPANY_INFO, update invoice SELECTs |
| `src/constants/sql-map.ts` | Add `UPSERT_COMPANY_INFO` constant |
| `src/types/db-schema-service.ts` | Remove `id` from CompanyInfo, remove `company_id` from invoice types |
| `src/features/client/components/configurations/company-profile/company-profile-section.tsx` | Swap `genericUpdate`+`existingId` → `genericUpdateScript`+`hasExistingData` |
| `src/features/client/components/jobs/ready-for-delivery/ready-for-delivery-section.tsx` | Remove `company_id` from invoice creation payload |
| `src/features/client/types/job-invoice.ts` | Remove `company_id` field |

---

## Verification

1. Apply DB migration; confirm `company_info` has `singleton_guard` and no `id`; invoice tables have no `company_id`
2. Server: `GET_COMPANY_INFO` returns data without `id`
3. Server: `UPSERT_COMPANY_INFO` — test first-time setup (INSERT path) and update (ON CONFLICT UPDATE path)
4. Client: Company Profile page — both first save and subsequent updates work correctly
5. Client: Ready-for-Delivery — job invoice creation succeeds without `company_id` in payload
6. Client: Job invoice list loads; no `company_id` in returned rows
7. TypeScript build: `tsc --noEmit` passes with no errors
