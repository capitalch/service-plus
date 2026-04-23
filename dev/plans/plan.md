# Plan: Jobs > Receipts (Payments Received Against a Job)

## Overview
Implement a **Receipts** sub-feature under the **Jobs** menu. Receipts represent payments received against a job. Data is stored in the `job_payment` table in the service database.

---

## Workflow

```
User navigates to Jobs > Receipts tab
  → Section loads paginated list of all job payments (date range + search filter)
  → User clicks "New Receipt" → Form dialog opens
    → User searches for a job (by job_no or customer name)
    → Selects payment date, payment mode, amount, reference_no, remarks
    → Submits → genericUpdate INSERT into job_payment
  → User clicks Edit icon on a row → Form pre-populated → Update via genericUpdate
  → User clicks Delete icon → Confirmation dialog → Delete via genericUpdate
  → Totals/summary shown at bottom of list
```

---

## Step 1: Understand the `job_payment` Table

**Table:** `demo1.job_payment`
- `id` — PK (GENERATED ALWAYS AS IDENTITY)
- `job_id` — FK → `job.id`
- `payment_date` — DATE
- `payment_mode` — TEXT (e.g., Cash, Card, UPI, Bank Transfer)
- `amount` — NUMERIC (constraint: amount > 0)
- `reference_no` — TEXT (nullable)
- `remarks` — TEXT (nullable)
- `created_at`, `updated_at` — TIMESTAMP

**Payment Mode Values (hardcoded list):** Cash, Card, UPI, Bank Transfer, Cheque, Others

---

## Step 2: Add SQL Queries to `sql_store.py`

**File:** `service-plus-server/app/db/sql_store.py`

Add the following SQL query constants and register them in the SQL_QUERIES dictionary:

### `GET_JOB_PAYMENTS_COUNT`
```sql
WITH args AS (SELECT ($1::jsonb->>'branch_id')::int AS branch_id,
                     ($1::jsonb->>'from_date')::date AS from_date,
                     ($1::jsonb->>'to_date')::date AS to_date,
                     ($1::jsonb->>'search') AS search)
SELECT COUNT(*) AS count
FROM {schema}.job_payment jp
JOIN {schema}.job j ON j.id = jp.job_id
LEFT JOIN {schema}.customer_contact cc ON cc.id = j.customer_contact_id
WHERE j.branch_id = (SELECT branch_id FROM args)
  AND jp.payment_date BETWEEN (SELECT from_date FROM args) AND (SELECT to_date FROM args)
  AND (
      (SELECT search FROM args) IS NULL OR (SELECT search FROM args) = ''
      OR j.job_no::text ILIKE '%' || (SELECT search FROM args) || '%'
      OR cc.name ILIKE '%' || (SELECT search FROM args) || '%'
      OR jp.payment_mode ILIKE '%' || (SELECT search FROM args) || '%'
      OR jp.reference_no ILIKE '%' || (SELECT search FROM args) || '%'
  )
```

### `GET_JOB_PAYMENTS_PAGED`
```sql
WITH args AS (SELECT ($1::jsonb->>'branch_id')::int AS branch_id,
                     ($1::jsonb->>'from_date')::date AS from_date,
                     ($1::jsonb->>'to_date')::date AS to_date,
                     ($1::jsonb->>'search') AS search,
                     ($1::jsonb->>'limit')::int AS lim,
                     ($1::jsonb->>'offset')::int AS off)
SELECT jp.id, jp.job_id, j.job_no, cc.name AS customer_name, cc.mobile,
       jp.payment_date, jp.payment_mode, jp.amount, jp.reference_no, jp.remarks,
       jp.created_at, jp.updated_at
FROM {schema}.job_payment jp
JOIN {schema}.job j ON j.id = jp.job_id
LEFT JOIN {schema}.customer_contact cc ON cc.id = j.customer_contact_id
WHERE j.branch_id = (SELECT branch_id FROM args)
  AND jp.payment_date BETWEEN (SELECT from_date FROM args) AND (SELECT to_date FROM args)
  AND (
      (SELECT search FROM args) IS NULL OR (SELECT search FROM args) = ''
      OR j.job_no::text ILIKE '%' || (SELECT search FROM args) || '%'
      OR cc.name ILIKE '%' || (SELECT search FROM args) || '%'
      OR jp.payment_mode ILIKE '%' || (SELECT search FROM args) || '%'
      OR jp.reference_no ILIKE '%' || (SELECT search FROM args) || '%'
  )
ORDER BY jp.payment_date DESC, jp.id DESC
LIMIT (SELECT lim FROM args) OFFSET (SELECT off FROM args)
```

### `GET_JOB_PAYMENTS_BY_JOB`
```sql
WITH args AS (SELECT ($1::jsonb->>'job_id')::int AS job_id)
SELECT jp.id, jp.job_id, jp.payment_date, jp.payment_mode, jp.amount,
       jp.reference_no, jp.remarks, jp.created_at, jp.updated_at
FROM {schema}.job_payment jp
WHERE jp.job_id = (SELECT job_id FROM args)
ORDER BY jp.payment_date DESC, jp.id DESC
```

### `GET_JOBS_FOR_RECEIPT_LOOKUP`
```sql
WITH args AS (SELECT ($1::jsonb->>'branch_id')::int AS branch_id,
                     ($1::jsonb->>'search') AS search)
SELECT j.id, j.job_no, cc.name AS customer_name, cc.mobile,
       j.job_date, j.amount, j.is_closed
FROM {schema}.job j
LEFT JOIN {schema}.customer_contact cc ON cc.id = j.customer_contact_id
WHERE j.branch_id = (SELECT branch_id FROM args)
  AND j.is_active = true
  AND (
      (SELECT search FROM args) IS NULL OR (SELECT search FROM args) = ''
      OR j.job_no::text ILIKE '%' || (SELECT search FROM args) || '%'
      OR cc.name ILIKE '%' || (SELECT search FROM args) || '%'
      OR cc.mobile ILIKE '%' || (SELECT search FROM args) || '%'
  )
ORDER BY j.job_date DESC, j.id DESC
LIMIT 20
```

---

## Step 3: Register SQL Keys in `sql-map.ts`

**File:** `src/constants/sql-map.ts`

Add the following entries (sorted alphabetically within the existing map):
```typescript
GET_JOB_PAYMENTS_BY_JOB: 'GET_JOB_PAYMENTS_BY_JOB',
GET_JOB_PAYMENTS_COUNT: 'GET_JOB_PAYMENTS_COUNT',
GET_JOB_PAYMENTS_PAGED: 'GET_JOB_PAYMENTS_PAGED',
GET_JOBS_FOR_RECEIPT_LOOKUP: 'GET_JOBS_FOR_RECEIPT_LOOKUP',
```

---

## Step 4: Add Messages to `messages.ts`

**File:** `src/constants/messages.ts`

Add (sorted alphabetically within receipt group):
```typescript
ERROR_RECEIPT_AMOUNT_REQUIRED: 'Amount must be greater than zero',
ERROR_RECEIPT_CREATE_FAILED: 'Failed to create receipt',
ERROR_RECEIPT_DELETE_FAILED: 'Failed to delete receipt',
ERROR_RECEIPT_JOB_REQUIRED: 'Please select a job',
ERROR_RECEIPT_LOAD_FAILED: 'Failed to load receipts',
ERROR_RECEIPT_PAYMENT_DATE_REQUIRED: 'Payment date is required',
ERROR_RECEIPT_PAYMENT_MODE_REQUIRED: 'Payment mode is required',
ERROR_RECEIPT_UPDATE_FAILED: 'Failed to update receipt',
SUCCESS_RECEIPT_CREATED: 'Receipt created successfully',
SUCCESS_RECEIPT_DELETED: 'Receipt deleted successfully',
SUCCESS_RECEIPT_UPDATED: 'Receipt updated successfully',
```

---

## Step 5: Create TypeScript Types for Receipts

**File:** `src/features/client/types/receipt.ts` (new file)

```typescript
export type JobLookupForReceiptType = {
  amount: number
  customer_name: string
  id: number
  is_closed: boolean
  job_date: string
  job_no: number
  mobile: string
}

export type JobReceiptDetailType = {
  amount: number
  id: number | null
  job_id: number | null
  payment_date: string
  payment_mode: string
  reference_no: string
  remarks: string
}

export type JobReceiptListRowType = {
  amount: number
  created_at: string
  customer_name: string
  id: number
  job_id: number
  job_no: number
  mobile: string
  payment_date: string
  payment_mode: string
  reference_no: string | null
  remarks: string | null
  updated_at: string
}

export type ReceiptFormValuesType = {
  amount: number | string
  job_id: number | null
  payment_date: string
  payment_mode: string
  reference_no: string
  remarks: string
}
```

---

## Step 6: Create Receipts Components

### 6a. Job Lookup Combobox (sub-component for job search in form)

**File:** `src/features/client/components/jobs/receipts/job-lookup-combobox.tsx`

- Debounced search input (1200ms) to search jobs by job_no, customer name, or mobile
- Shows dropdown list of matched jobs: job_no, customer_name, mobile, job_date, amount, is_closed badge
- On job selection: stores `job_id`, displays selected job summary in a card
- Uses `GET_JOBS_FOR_RECEIPT_LOOKUP` via `apolloClient.query` + `genericQuery`
- Props: `disabled`, `onChange(jobId: number | null)`, `value: number | null`
- Arrow function component

### 6b. New Receipt Form

**File:** `src/features/client/components/jobs/receipts/new-receipt-form.tsx`

**Fields (react-hook-form + zod validation):**

| Field | Control | Validation |
|-------|---------|------------|
| job_id | JobLookupCombobox | Required — show `ERROR_RECEIPT_JOB_REQUIRED` |
| payment_date | Date input | Required — show `ERROR_RECEIPT_PAYMENT_DATE_REQUIRED` |
| payment_mode | Select (shadcn) | Required — options: Cash, Card, UPI, Bank Transfer, Cheque, Others |
| amount | Number input | Required, > 0 — show `ERROR_RECEIPT_AMOUNT_REQUIRED` |
| reference_no | Text input | Optional |
| remarks | Textarea | Optional |

- Mandatory fields marked with red `*`
- Validation triggers immediately on field change (mode: 'onChange')
- Submit disabled when form is invalid
- Exposes `resetForm()` and `submitForm()` via `useImperativeHandle` ref
- On submit: calls `genericUpdate` mutation with `tableName: 'job_payment'`, xData
  - Insert: xData without `id`
  - Update: xData includes `id`
- Shows `SUCCESS_RECEIPT_CREATED` / `SUCCESS_RECEIPT_UPDATED` via Sonner on success
- Shows error message via Sonner on failure

### 6c. Receipts Section (main section)

**File:** `src/features/client/components/jobs/receipts/receipts-section.tsx`

**Layout:**
```
[Header Row]
  Title: "Receipts"
  From Date | To Date | Search | "New Receipt" button

[Data Table]
  Columns: # | Job No | Customer | Mobile | Date | Mode | Amount | Ref No | Actions(edit/delete)

[Pagination]

[Footer Summary Row]
  "Total: ₹ {sum of amounts on current page}"
```

**Behavior:**
- On mount: load `from_date` = start of current financial year, `to_date` = today
- Fetch count + paged data using `GET_JOB_PAYMENTS_COUNT` and `GET_JOB_PAYMENTS_PAGED`
- Pagination: 50 records per page
- Search: debounced 1200ms, resets to page 1
- Date change: resets to page 1, reloads
- "New Receipt" button → opens shadcn `Dialog` with `NewReceiptForm`
- Edit (pencil icon) per row → opens same dialog, pre-populates `selectedReceipt`
- Delete (trash icon) per row → opens shadcn `AlertDialog` for confirmation → `genericUpdate` with `deletedIds: [id]`, `tableName: 'job_payment'`
- Framer-motion `AnimatePresence` + fade-in for table rows
- Handles loading/error states

**State (local React state):**
- `currentPage: number`
- `fromDate: string`, `toDate: string`
- `isDeleteDialogOpen: boolean`
- `isDialogOpen: boolean`
- `receiptToDelete: number | null`
- `receipts: JobReceiptListRowType[]`
- `searchText: string`
- `selectedReceipt: JobReceiptDetailType | null`
- `totalCount: number`

---

## Step 7: Update `client-jobs-page.tsx`

**File:** `src/features/client/pages/client-jobs-page.tsx`

- Add a new tab value: `'receipts'`
- Add tab trigger label: **"Receipts"**
- Import `ReceiptsSection` from `../components/jobs/receipts/receipts-section`
- Render `<ReceiptsSection />` in the corresponding `TabsContent`
- Maintain alphabetical import ordering

---

## Step 8: Verify DB Trigger for `updated_at`

**File:** `service-plus-server/db/service-plus-demo.sql`

Verify the `set_updated_at` trigger exists on `job_payment`. If missing, add:
```sql
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON {schema}.job_payment
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Step 9: Testing Checklist

- [ ] List loads with correct date range defaulting to current financial year
- [ ] Search filters on job_no, customer name, payment_mode, reference_no
- [ ] Pagination works (50 per page)
- [ ] New receipt: job lookup search with 1200ms debounce works
- [ ] New receipt: validation fires immediately on field change
- [ ] New receipt: submit button disabled on invalid form
- [ ] New receipt: created successfully, Sonner success toast shown
- [ ] Edit receipt: form pre-populates correctly
- [ ] Edit receipt: updated successfully, Sonner success toast shown
- [ ] Delete receipt: confirmation dialog shown, deleted with Sonner toast
- [ ] Total amount displayed correctly in footer
- [ ] Responsive layout on mobile/tablet/desktop
- [ ] Amount constraint > 0 enforced at client level
- [ ] Red asterisk on mandatory fields
- [ ] Red color only used for errors and mandatory markers
- [ ] No red color on control CSS (borders, backgrounds)

---

## File Structure After Implementation

```
src/features/client/
├── components/
│   └── jobs/
│       ├── receipts/                           ← NEW
│       │   ├── job-lookup-combobox.tsx         ← NEW
│       │   ├── new-receipt-form.tsx            ← NEW
│       │   └── receipts-section.tsx            ← NEW
│       ├── batch-job/
│       ├── opening-job/
│       ├── part-used/
│       └── single-job/
├── pages/
│   └── client-jobs-page.tsx                   ← MODIFIED (add Receipts tab)
└── types/
    ├── receipt.ts                              ← NEW
    └── job.ts                                 (existing)

src/constants/
├── messages.ts                                ← MODIFIED (add receipt messages)
└── sql-map.ts                                 ← MODIFIED (add 4 SQL IDs)

service-plus-server/app/db/
└── sql_store.py                               ← MODIFIED (add 4 SQL queries)
```
