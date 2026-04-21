# Plan: New Job Feature (Jobs > New Job)

## Context
The Jobs menu already has menu items defined in `client-explorer-panel.tsx` and a `client-jobs-page.tsx`, but every item except "Part Used (Job)" shows a "Coming Soon" placeholder. This plan implements **"New Job"** — a two-mode UI (new form / view list) following the exact pattern of `sales-entry`.

A Job involves:
- Header fields: customer, branch, job type, receive manner, job status, technician (optional), product/model, serial no, problem reported, warranty info, delivery date
- No line items at creation time (parts added later via "Part Used (Job)")
- An initial `job_transaction` row inserted atomically with the job (audit trail)
- A `job_no` auto-generated from `document_sequence` (same pattern as sales invoice)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/client/types/job.ts` | TypeScript types: `JobListRow`, `JobFormHeaderState`, `JobDetailType` |
| `src/features/client/components/jobs/job-section.tsx` | Section container: mode toggle, header buttons, paginated view list |
| `src/features/client/components/jobs/new-job-form.tsx` | Form with `forwardRef` + imperative handle pattern |

---

## Files to Modify

### Frontend
1. **`src/features/client/pages/client-jobs-page.tsx`**
   - Add `case "New Job": return <JobSection />;` to the `JobsContent` switch

2. **`src/constants/sql-map.ts`**
   - Add: `GET_JOBS_COUNT`, `GET_JOBS_PAGED`, `GET_JOB_DETAIL`

3. **`src/constants/graphql-map.ts`**
   - Add: `createJob` mutation (mirrors `createSalesInvoice`)

### Backend
4. **`app/db/sql_store.py`** (`service-plus-server`)
   - Add `GET_JOBS_COUNT` — filtered count (branch, date range, search)
   - Add `GET_JOBS_PAGED` — paged list with joins to customer_contact, job_type, job_status, technician
   - Add `GET_JOB_DETAIL` — full job record by id (for edit mode)

5. **`app/graphql/schema.graphql`**
   - Add `createJob(db_name: String!, schema: String, value: String!): Generic`

6. **`app/graphql/resolvers/mutation_helper.py`**
   - Add `resolve_create_job_helper` — inserts job + initial `job_transaction` + increments doc_sequence atomically (cloned from `resolve_create_sales_invoice_helper`)

7. **`app/graphql/resolvers/mutation.py`**
   - Add `@mutation.field("createJob")` resolver calling `resolve_create_job_helper`

---

## Implementation Details

### `src/features/client/types/job.ts`
```typescript
export type JobListRow = {
    id: number;
    job_no: string;
    job_date: string;
    customer_name: string;
    mobile: string;
    job_type_name: string;
    job_status_name: string;
    technician_name: string | null;
    amount: number | null;
    is_closed: boolean;
};

export type JobFormHeaderState = {
    jobDate: string;
    customerId: number | null;
    customerName: string;
    customerMobile: string;
    jobTypeId: number | null;
    jobReceiveMannerId: number | null;
    jobReceiveConditionId: number | null;
    jobStatusId: number | null;       // auto-set to initial status
    technicianId: number | null;
    productBrandModelId: number | null;
    serialNo: string;
    problemReported: string;          // required
    deliveryDate: string;
    isWarranty: boolean;
    warrantyCardNo: string;
    remarks: string;
};
```

### `job-section.tsx` (mirrors `sales-entry-section.tsx`)
- `mode: "new" | "view"` state
- **New mode header**: `ViewModeToggle`, Save (disabled until valid), Reset buttons
- **View mode header**: date-range filter, search input, Refresh; pagination 50/page
- View list columns: Job No, Date, Customer, Mobile, Job Type, Status, Technician, Amount, Actions (Edit, Delete)
- Delete confirmation dialog
- Metadata loaded on mount via `Promise.all`: `GET_JOB_TYPES`, `GET_JOB_STATUSES`, `GET_JOB_RECEIVE_MANNERS`, `GET_JOB_RECEIVE_CONDITIONS`, `GET_ALL_TECHNICIANS`, `GET_DOCUMENT_SEQUENCES`
- `newJobRef = useRef<NewJobFormHandle>(null)` pattern for parent-triggered submit

### `new-job-form.tsx` (mirrors `new-sales-invoice.tsx`)
- `forwardRef + useImperativeHandle` exposing `submit()` and `reset()`
- **Customer field**: combobox search via `GET_CUSTOMERS_BY_KEYWORD` (same as sales invoice)
- **Job Type**: required dropdown from metadata
- **Receive Manner**: required dropdown from metadata
- **Receive Condition**: optional dropdown
- **Initial Status**: auto-set to status where `is_initial = true`; shown as read-only label
- **Technician**: optional dropdown
- **Product/Brand/Model**: optional dropdown via `GET_ALL_MODELS`
- **Serial No**, **Problem Reported** (required textarea), **Delivery Date**, **Warranty** toggle + card no, **Remarks**
- Required fields: customer, job_type, receive_manner, problem_reported
- Save path: new → `GRAPHQL_MAP.createJob`; edit → `GRAPHQL_MAP.genericUpdate` (update `job` table)

### Backend SQL queries (`sql_store.py`)
```sql
-- GET_JOBS_COUNT
SELECT COUNT(*)
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
WHERE j.branch_id = %(branch_id)s
  AND j.job_date BETWEEN %(from_date)s AND %(to_date)s
  AND (%(search)s = ''
   OR LOWER(j.job_no)   LIKE '%%' || LOWER(%(search)s) || '%%'
   OR LOWER(cc.mobile)  LIKE '%%' || LOWER(%(search)s) || '%%'
   OR LOWER(cc.full_name) LIKE '%%' || LOWER(%(search)s) || '%%')

-- GET_JOBS_PAGED
SELECT j.id, j.job_no, j.job_date,
       cc.full_name AS customer_name, cc.mobile,
       jt.name AS job_type_name, js.name AS job_status_name,
       t.name AS technician_name, j.amount, j.is_closed
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_type jt           ON jt.id = j.job_type_id
JOIN job_status js         ON js.id = j.job_status_id
LEFT JOIN technician t     ON t.id  = j.technician_id
WHERE j.branch_id = ... AND j.job_date BETWEEN ...
ORDER BY j.job_date DESC, j.job_no
LIMIT %(limit)s OFFSET %(offset)s

-- GET_JOB_DETAIL
SELECT j.*, cc.full_name AS customer_name, cc.mobile,
       jt.name AS job_type_name, js.name AS job_status_name,
       pbm.model_name, b.name AS brand_name, t.name AS technician_name
FROM job j
JOIN customer_contact cc ON cc.id = j.customer_contact_id
JOIN job_type jt           ON jt.id = j.job_type_id
JOIN job_status js         ON js.id = j.job_status_id
LEFT JOIN product_brand_model pbm ON pbm.id = j.product_brand_model_id
LEFT JOIN brand b                 ON b.id = pbm.brand_id
LEFT JOIN technician t            ON t.id = j.technician_id
WHERE j.id = %(id)s
```

### `createJob` mutation helper
```python
async def resolve_create_job_helper(db_name, schema, value):
    payload = decode_and_parse(value)
    doc_sequence_id   = payload.pop("doc_sequence_id", None)
    doc_sequence_next = payload.pop("doc_sequence_next", None)
    performed_by      = payload["xData"].pop("performed_by_user_id", None)
    initial_status_id = payload["xData"].get("job_status_id")

    # 1. Insert job
    job_id = await exec_sql_object(db_name, schema, payload)

    # 2. Insert initial job_transaction
    txn_object = {
        "tableName": "job_transaction",
        "xData": {
            "job_id": job_id,
            "status_id": initial_status_id,
            "performed_by_user_id": performed_by,
        },
    }
    await exec_sql_object(db_name, schema, txn_object)

    # 3. Increment document_sequence
    if doc_sequence_id and doc_sequence_next:
        seq_object = {"tableName": "document_sequence",
                      "xData": {"id": doc_sequence_id, "next_number": doc_sequence_next}}
        await exec_sql_object(db_name, schema, seq_object)

    return job_id
```

### Frontend payload (from `new-job-form.tsx`)
```typescript
const sqlObject = {
    tableName: "job",
    doc_sequence_id:   docSequence?.id ?? null,
    doc_sequence_next: docSequence ? docSequence.next_number + 1 : null,
    xData: {
        branch_id, job_no, job_date, customer_contact_id,
        job_type_id, job_receive_manner_id, job_status_id,
        job_receive_condition_id, product_brand_model_id,
        serial_no, problem_reported, delivery_date,
        is_warranty, warranty_card_no, remarks,
        technician_id,
        performed_by_user_id: userId,   // stripped server-side
    },
};
```

---

## Existing Utilities to Reuse

| Utility | Location |
|---------|----------|
| `ViewModeToggle` | `src/features/client/components/inventory/view-mode-toggle.tsx` |
| `GET_CUSTOMERS_BY_KEYWORD` | `SQL_MAP` — customer combobox |
| `GET_DOCUMENT_SEQUENCES` | `SQL_MAP` — job_no auto-numbering |
| `buildInvoiceNo` pattern | `new-sales-invoice.tsx:397` — clone for `buildJobNo` |
| `GRAPHQL_MAP.genericUpdate` | Edit mode (update job header) |
| `encodeURIComponent(JSON.stringify(...))` | Same save pattern as sales invoice |
| `useClientSelection`, `useSelector` for `branchId/dbName/schema` | Same hooks as all entry sections |
| Pagination button JSX | Clone from `sales-entry-section.tsx` |

---

## Verification Steps

1. `npm run dev` — start dev server
2. Navigate to **Jobs > New Job**
3. **New mode**: form loads with all dropdowns populated from metadata
4. Fill customer (mobile search), job type, receive manner, problem reported → Save
   - Job created with auto job_no; toast success; switches to view mode
5. **View mode**: list loads; date filter, search, pagination work
6. **Edit**: click edit → form pre-filled; save updates correctly
7. **Delete**: confirm dialog → job deleted
8. Verify in DB: `job_transaction` row exists for newly created job
