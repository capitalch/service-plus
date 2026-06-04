# Plan: Job Accounts Posting Feature

## Context
"Accounts Posting" means marking invoices and money receipts as posted to an external accounts package. A new **Accounts Posting** menu item is added to the Jobs sidebar. It has two outer tabs (Posting / Posted) each containing three inner tabs (Purchase Invoices / Sales Invoices / Money Receipts). Each inner tab is a searchable paginated grid. Records can be marked as posted (or unposted) via a row-level action.

Tables involved:
| Data | Table | `is_posted` |
|---|---|---|
| Purchase Invoices | `purchase_invoice` | ✓ added |
| Sales Invoices | `job_invoice` | ✓ exists |
| Money Receipts | `job_payment` | ✓ exists |

---

## Step 1 — Server SQL Queries (`sql_store.py`)

Add 6 new queries following the existing CTE pattern. All accept `is_posted` as a boolean parameter.

### `GET_JOB_INVOICES_FOR_POSTING_PAGED`
Joins `job_invoice → job → customer_contact`, filters by `is_posted`. SELECT: `ji.id, ji.job_id, j.job_no, j.job_date, cc.full_name AS customer_name, cc.mobile, ji.invoice_no, ji.invoice_date, ji.amount, ji.cgst_amount, ji.sgst_amount, ji.igst_amount, ji.is_posted`.

### `GET_JOB_INVOICES_FOR_POSTING_COUNT`
Same joins/filters, returns `COUNT(*) AS total`.

### `GET_PURCHASE_INVOICES_FOR_POSTING_PAGED`
Based on existing `GET_PURCHASE_INVOICES_PAGED` + add `AND pi.is_posted = (table "p_is_posted")` filter. Include `pi.is_posted` in SELECT.

### `GET_PURCHASE_INVOICES_FOR_POSTING_COUNT`
Count variant.

### `GET_JOB_PAYMENTS_FOR_POSTING_PAGED`
Based on existing `GET_JOB_PAYMENTS_PAGED` + add `AND jp.is_posted = (table "p_is_posted")` filter. Add `jp.receipt_no` to SELECT (missing from existing query).

### `GET_JOB_PAYMENTS_FOR_POSTING_COUNT`
Count variant.

All queries share the same parameter pattern:
```sql
with
    "p_branch_id" as (values(%(branch_id)s::bigint)),
    "p_is_posted"  as (values(%(is_posted)s::boolean)),
    "p_search"     as (values(%(search)s::text)),
    "p_limit"      as (values(%(limit)s::int)),
    "p_offset"     as (values(%(offset)s::int))
```

---

## Step 2 — Client SQL Map (`sql-map.ts`)

Add 6 new IDs to `SQL_MAP`:
```ts
GET_JOB_INVOICES_FOR_POSTING_PAGED:       "GET_JOB_INVOICES_FOR_POSTING_PAGED",
GET_JOB_INVOICES_FOR_POSTING_COUNT:       "GET_JOB_INVOICES_FOR_POSTING_COUNT",
GET_PURCHASE_INVOICES_FOR_POSTING_PAGED:  "GET_PURCHASE_INVOICES_FOR_POSTING_PAGED",
GET_PURCHASE_INVOICES_FOR_POSTING_COUNT:  "GET_PURCHASE_INVOICES_FOR_POSTING_COUNT",
GET_JOB_PAYMENTS_FOR_POSTING_PAGED:       "GET_JOB_PAYMENTS_FOR_POSTING_PAGED",
GET_JOB_PAYMENTS_FOR_POSTING_COUNT:       "GET_JOB_PAYMENTS_FOR_POSTING_COUNT",
```

---

## Step 3 — New Files

Folder: `src/features/client/components/jobs/accounts-posting/`

### `accounts-posting-schema.ts`
TypeScript row types:
```ts
export type PurchaseInvoicePostingRow = {
    id: number; branch_id: number; invoice_no: string; invoice_date: string;
    supplier_name: string; total_amount: number; is_posted: boolean;
};
export type JobInvoicePostingRow = {
    id: number; job_id: number; job_no: string; job_date: string;
    customer_name: string; mobile: string; invoice_no: string;
    invoice_date: string; amount: number; is_posted: boolean;
};
export type JobPaymentPostingRow = {
    id: number; job_id: number; job_no: string; receipt_no: string | null;
    customer_name: string; payment_date: string; payment_mode: string;
    amount: number; is_posted: boolean;
};
```

### `purchase-invoices-grid.tsx`
Props: `{ isPosted: boolean }`. Follows exact pattern of `single-job-section.tsx`:
- `PAGE_SIZE = 50`, `DEBOUNCE_MS = 1600`
- State: `search`, `searchQ`, `page`, `loading`, `total`, `rows`
- `loadData(branchId, q, pg, isPosted)` — `Promise.all([PAGED, COUNT])` using `GET_PURCHASE_INVOICES_FOR_POSTING_PAGED/COUNT`
- `useEffect` on `[branchId, searchQ, page, isPosted]`
- Columns: `#`, `Invoice No`, `Date`, `Supplier`, `Total Amount`, actions
- Action dropdown: "Post" (if `!isPosted`) / "Unpost" (if `isPosted`) — generic update `{ tableName: "purchase_invoice", xData: { id, is_posted: !isPosted } }`

### `sales-invoices-grid.tsx`
Same pattern, uses `GET_JOB_INVOICES_FOR_POSTING_PAGED/COUNT`.
Columns: `#`, `Invoice No`, `Date`, `Job No`, `Customer`, `Mobile`, `Amount`, actions.

### `money-receipts-grid.tsx`
Same pattern, uses `GET_JOB_PAYMENTS_FOR_POSTING_PAGED/COUNT`.
Columns: `#`, `Receipt No`, `Date`, `Job No`, `Customer`, `Mode`, `Amount`, actions.

### `accounts-posting-section.tsx`
Main section component. Component name: `AccountsPostingSection`. Uses `TabBtn` inline component (same as `part-finder-detail-panel.tsx`).

Structure:
```
AccountsPostingSection
├── Header (title "Accounts Posting")
├── Outer tab bar: ["Posting", "Posted"]
│   └── Inner tab bar: ["Purchase Invoices", "Sales Invoices", "Money Receipts"]
│       └── Active grid component (isPosted = outerTab === "posted")
```

State: `outerTab: "posting" | "posted"`, `innerTab: "purchase" | "sales" | "receipts"`.

The `isPosted` boolean passed to each grid is `outerTab === "posted"`.

---

## Step 4 — Navigation

### `client-explorer-panel.tsx`
In `JobsExplorer()`, add after `<TreeItem ... label="Deliver Job" />`:
```tsx
<TreeItem icon={BookCheck} label="Accounts Posting" />
```
Import `BookCheck` from lucide-react.

### `client-jobs-page.tsx`
Add import:
```ts
import { AccountsPostingSection } from "../components/jobs/accounts-posting/accounts-posting-section";
```
Add case in switch:
```ts
case "Accounts Posting":
    return <AccountsPostingSection />;
```

---

## File Summary

| Action | File |
|---|---|
| Modify | `sql_store.py` — 6 new queries |
| Modify | `src/constants/sql-map.ts` — 6 new IDs |
| Create | `src/features/client/components/jobs/accounts-posting/accounts-posting-schema.ts` |
| Create | `src/features/client/components/jobs/accounts-posting/purchase-invoices-grid.tsx` |
| Create | `src/features/client/components/jobs/accounts-posting/sales-invoices-grid.tsx` |
| Create | `src/features/client/components/jobs/accounts-posting/money-receipts-grid.tsx` |
| Create | `src/features/client/components/jobs/accounts-posting/accounts-posting-section.tsx` |
| Modify | `src/features/client/components/client-explorer-panel.tsx` |
| Modify | `src/features/client/pages/client-jobs-page.tsx` |

---

## Verification
1. New "Accounts Posting" menu item appears in Jobs sidebar between "Deliver Job" and "Opening Jobs"
2. Clicking it shows the outer Posting/Posted tabs
3. Each outer tab has three inner tabs (Purchase Invoices / Sales Invoices / Money Receipts)
4. Each grid loads correct data, search + pagination work
5. "Post" action marks a record `is_posted = true`; it disappears from Posting tab and appears in Posted tab
6. "Unpost" action on Posted tab reverses the above
