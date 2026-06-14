# Plan: Reporting & Dashboard System (Client → Reports)

This plan covers the full Reporting & Dashboard module for the **client** feature (`src/features/client`). It is derived **exhaustively** from `plans/tran.md` and the current code in `src/features/client/pages/client-reports-page.tsx`, `src/features/client/components/client-explorer-panel.tsx`, the schema in `src/types/db-schema-service.ts`, and the conventions in `claude.md`.

The user is to be presented with a **modern KPI-driven dashboard**, **grouped report explorer**, **rich chart visualizations** (recharts), **drilldown transaction reports**, and **PDF export** of every report. All ranges are derived from `app_setting.fiscal_year_start_month_num` to compute quarters.

---

## 1. Scope, Goals & Non-Goals

### Goals
- One **Operations Dashboard** (default landing on Reports section) with KPI cards, charts, recent activity, alerts.
- A **set of grouped reports** under: Job Reports, Financial Reports, Inventory Reports, Performance Reports, Parts Ordering Suggestions.
- Every "ranged" report supports a **canonical Range Picker** (Today, Yesterday, This Week, Previous Week, This Month, Last Month, Q1, Q2, Q3, Q4, Year-to-Date, Last Year, Custom).
- Each report has **PDF print/export**, **CSV/Excel export** (xlsx already in deps), **column filters**, **sort**, **search**, and **responsive design**.
- **Quarters** are computed using `app_setting.fiscal_year_start_month_num` (default 4 = April). Q1 = months [fyStart, fyStart+1, fyStart+2], Q2 next 3, etc.
- **Warranty vs Out-of-Warranty** distinction is computed from `job.warranty_card_no` IS NOT NULL → warranty; ELSE out-of-warranty.
- **Profit** = `(job_invoice_line.amount + job_additional_charge.selling_price*qty) − (job_part_used.cost_price*qty + job_additional_charge.cost_price*qty)`.
- **Spare-parts ordering suggestion**: weighted moving average of last 6 months consumption (weights `[6,5,4,3,2,1]` for months M-1..M-6), suggested order qty = `max(0, ceil(weightedMonthlyConsumption) − stockOnHand)`.

### Non-Goals (for this iteration)
- New billing/accounting modules. We only **read** from existing tables.
- Server-side scheduled reports / email.
- Multi-tenant ACL changes (existing auth gating is reused).
- Real-time subscriptions for dashboard (use polling refetch with manual Refresh button).

---

## 2. Information Architecture (Explorer Tree)

Update `ReportsExplorer` in `src/features/client/components/client-explorer-panel.tsx`. Final grouped tree:

```
Reports
├─ Dashboard                          (Operations Overview)
│
├─ Job Reports
│  ├─ Job Intake Summary              (Received, with W / OOW splits, all ranges)
│  ├─ Jobs Repaired (OK)              (status = repaired-ok)
│  ├─ Jobs Delivered (OK)             (status = delivered-ok)
│  ├─ Delivered Jobs — Detailed       (line-level invoice + parts + profit)
│  ├─ Job Transaction Ledger          (complete job_transaction log, date desc)
│  ├─ Job Pipeline / Aging            (open jobs by status × age buckets)
│  └─ Job Status Trend                (status mix month over month)
│
├─ Warranty Reports                   ⭐ Special
│  ├─ Warranty Repairs & Parts Value  (in-warranty jobs + parts consumed + parts ₹ value, This/Prev Month + Custom)
│  ├─ Warranty Parts Consumption Detail (line-level part-by-part for the range)
│  └─ Warranty Trend (6-month)        (monthly trend of warranty repairs, parts qty, parts value)
│
├─ Financial Reports
│  ├─ Profit Summary                  (range-wise profit, W vs OOW split)
│  ├─ Revenue Report                  (job_invoice + sales_invoice combined)
│  ├─ Cash Register                   (job_payment + receipts, daily)
│  ├─ Sales Report                    (sales_invoice line-level)
│  └─ GST Summary                     (CGST/SGST/IGST per range)
│
├─ Performance Reports
│  ├─ Technician Scorecard            (per-technician KPI matrix)
│  ├─ Technician Repaired vs Delivered (chart)
│  ├─ Technician Profit & Revenue     (chart + table)
│  └─ Technician Productivity Heatmap (jobs per day per tech)
│
├─ Inventory Reports
│  ├─ Spare Parts Ledger (Op/Dr/Cr/Cl)   (fiscal-year-wise; uses stock_snapshot + stock_transaction)
│  ├─ Spare Parts Aging                 (FIFO age buckets <30, 30-90, 90-180, 180-365, >365)
│  ├─ Slow Movers (Aged > 1 year)       (specific filter shortcut into Aging)
│  ├─ Parts Consumption — Detailed      (weekly / monthly / yearly / all, consumed_date desc)
│  ├─ Stock Ledger                      (stock_transaction with running balance)
│  ├─ Stock Movement Summary            (in/out by transaction type)
│  └─ Parts Reorder Suggestions         (weighted 6-month MA + present stock)
│
└─ Trends (Charts)
   ├─ Jobs Received — Monthly (this year)
   ├─ Jobs Received — Year-wise (last 4 years)
   ├─ Jobs Received — 12/24/36-month trailing
   ├─ Repair vs Deliver Funnel
   └─ Profit Trend (YoY)
```

Two new TreeItem groups are added: `Trends` and `Parts Ordering`. Existing `Performance Reports` is extended.

---

## 3. Architecture & Folder Structure

All new code lives under:

```
src/features/client/components/reports/
   _common/
      range-picker.tsx                 # Canonical date-range UI (Today, ..., Custom)
      report-toolbar.tsx               # Range, Branch/Division, Search, Refresh, PDF, Excel
      report-empty.tsx
      report-error.tsx
      report-loading.tsx
      kpi-card.tsx
      kpi-grid.tsx
      report-table.tsx                 # shadcn table wrapper w/ sort + sticky header
      chart-card.tsx                   # shadcn Card + ResponsiveContainer
      pdf-export.ts                    # generic jspdf-autotable wrapper
      xlsx-export.ts                   # generic xlsx wrapper
      fiscal.ts                        # qtr/range derivation from fiscal_year_start_month_num
      use-fiscal-setting.ts            # reads app_setting → exposes fyStartMonth, financialYears
      use-report-range.ts              # range state + custom range
      report-section.tsx               # Layout shell used by every report page
      messages.ts                      # local re-export of @/constants/messages keys
   dashboard/
      dashboard-section.tsx
      dashboard-kpis.tsx
      dashboard-monthly-chart.tsx
      dashboard-warranty-split.tsx
      dashboard-recent-jobs.tsx
      dashboard-alerts.tsx             # overdue, low-stock, aged parts
   jobs/
      job-intake-summary-section.tsx
      jobs-repaired-section.tsx
      jobs-delivered-section.tsx
      jobs-delivered-detailed-section.tsx
      job-transaction-ledger-section.tsx
      job-pipeline-aging-section.tsx
      job-status-trend-section.tsx
   warranty/
      warranty-repairs-parts-value-section.tsx
      warranty-parts-consumption-detail-section.tsx
      warranty-trend-section.tsx
      warranty-job-detail-dialog.tsx       # drilldown: parts used inside a single warranty job
   financial/
      profit-summary-section.tsx
      revenue-report-section.tsx
      cash-register-section.tsx
      sales-report-section.tsx
      gst-summary-section.tsx
   performance/
      technician-scorecard-section.tsx
      technician-repaired-delivered-section.tsx
      technician-profit-revenue-section.tsx
      technician-productivity-heatmap-section.tsx
   inventory/
      spare-parts-ledger-section.tsx
      spare-parts-aging-section.tsx
      parts-consumption-detailed-section.tsx
      stock-ledger-section.tsx
      stock-movement-summary-section.tsx
      parts-reorder-suggestions-section.tsx
   trends/
      jobs-received-monthly-section.tsx
      jobs-received-yearwise-section.tsx
      jobs-received-trailing-section.tsx
      repair-deliver-funnel-section.tsx
      profit-trend-yoy-section.tsx
```

Types live under `src/features/client/types/reports/*.ts` (one type file per major report family), each name ends with `Type` (per `claude.md`).

---

## 4. Range Picker & Fiscal Math

`src/features/client/components/reports/_common/fiscal.ts` exports:

```ts
type RangeKeyType =
  'today' | 'yesterday' | 'thisWeek' | 'prevWeek'
  | 'thisMonth' | 'lastMonth'
  | 'q1' | 'q2' | 'q3' | 'q4'
  | 'ytd' | 'lastYear'
  | 'custom';

type DateRangeType = { from: Date; to: Date; key: RangeKeyType; label: string };

function getFiscalStartMonth(): number;                              // from app_setting (1-12)
function getRange(key: RangeKeyType, today: Date, fyStart: number,
                  custom?: { from: Date; to: Date }): DateRangeType;
function getCurrentFiscalYearBounds(today: Date, fyStart: number): DateRangeType;
function getPreviousFiscalYearBounds(today: Date, fyStart: number): DateRangeType;
function getFiscalQuarterBounds(q: 1|2|3|4, today: Date, fyStart: number): DateRangeType;
function monthList(fyStart: number): { idx: number; label: string }[];   // for monthwise chart x-axis
```

Important rules:
- **Quarters are fiscal quarters**: Q1 = `[fyStart, fyStart+1, fyStart+2]` etc., aligned to current FY.
- "This Week" uses **Monday-start** week (or locale; default Monday) and ends on Sunday.
- "YTD" = `[FY start of current FY, today]`.
- "Last Year" = entire previous FY.

`use-fiscal-setting.ts` queries `GET_APP_SETTING_BY_KEY` with `{ setting_key: 'fiscal_year_start_month_num' }` (already defined in `SQL_MAP`). It also calls `GET_ALL_FINANCIAL_YEARS` to populate FY dropdowns for fiscal-year-wise reports.

`use-report-range.ts` exposes:
```ts
type UseReportRangeType = {
  range: DateRangeType;
  setRange: (key: RangeKeyType, custom?: { from: Date; to: Date }) => void;
};
```

---

## 5. Shared Components

### 5.1 `report-toolbar.tsx`
shadcn `Card` header containing:
- Range picker (`Select` + popover with `Calendar` for Custom)
- Optional Division selector (defaults to current)
- Optional Branch selector (multi-select chip)
- Search input (debounced 1200ms)
- Buttons: Refresh, Export PDF, Export Excel, Print
- Title + subtitle slot, status pill ("Live" / "As of HH:mm")

### 5.2 `kpi-card.tsx` & `kpi-grid.tsx`
- Variants: `default`, `success`, `warning`, `accent` (no red unless error)
- Shows: label, value, optional delta `(+12% vs prev)`, sparkline (recharts `LineChart` small), trend icon
- `kpi-grid` is `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4`

### 5.3 `report-table.tsx`
- shadcn `Table` + sticky header
- Column config: `{ id, header, accessor, align, sortable, format }`
- Built-in row total/footer row support
- Virtualization optional — initial impl uses pagination (50 rows)
- Empty / loading / error built-ins

### 5.4 `chart-card.tsx`
- shadcn Card wrapping `ResponsiveContainer`
- Toggle chart type (Bar / Line / Area / Pie) where meaningful
- Legend, hover tooltip, axis formatters
- Color tokens use `--cl-accent`, `--cl-accent-text`, semantic non-red palette

### 5.5 `pdf-export.ts`
Generic exporter built on the existing `jspdf` + `jspdf-autotable` already used by `purchase-invoice-pdf-gen.ts` and `job-sheet-pdf.ts`. Signature:

```ts
function exportReportPdf(opts: {
  title: string;
  subtitle?: string;
  meta: { label: string; value: string }[];     // range, division, generated_at
  columns: { header: string; dataKey: string; width?: number; align?: 'left'|'right'|'center' }[];
  rows: Record<string, string | number>[];
  totalsRow?: Record<string, string | number>;
  orientation?: 'portrait' | 'landscape';
  footerNote?: string;
}): void;
```

Renders header (division name/logo from `currentDivision`), table via `autoTable`, totals row in bold, page numbers in footer.

### 5.6 `xlsx-export.ts`
Wraps `xlsx`'s `utils.json_to_sheet`, `book_append_sheet`, `writeFile`. Supports multi-sheet (e.g., summary + detail).

---

## 6. Data Access Pattern

All queries go through `genericQuery`/`genericUpdate` per `claude.md`. The plan introduces **new SQL keys** (added to `service-plus-server/app/db/sql_bu.py` AND `src/constants/sql-map.ts`):

### 6.1 New SQL keys (server)
Group: **Dashboard / Jobs Aggregates**
- `GET_JOBS_RECEIVED_RANGE_SPLIT`           — params `{from, to}` → `{warranty_count, oow_count}`
- `GET_JOBS_REPAIRED_OK_RANGE_SPLIT`        — uses `job.is_final = true` + repaired-ok status
- `GET_JOBS_DELIVERED_OK_RANGE_SPLIT`       — uses delivered-ok status
- `GET_JOBS_RECEIVED_BY_MONTH`              — params `{from, to}` → `{month, warranty_count, oow_count}`
- `GET_JOBS_RECEIVED_BY_YEAR`               — params `{years_back}` → `{fy_label, warranty_count, oow_count}`
- `GET_JOB_PIPELINE_BY_STATUS_AGE`          — open jobs grouped by status × age bucket
- `GET_JOB_STATUS_TREND_MONTHLY`            — `{month, status_id, count}`
- `GET_RECENT_JOBS`                         — last 10 jobs with status, technician, customer
- `GET_OVERDUE_JOBS`                        — open jobs older than X days

Group: **Profit / Revenue**
- `GET_PROFIT_RANGE`                        — `{from,to}` → `{warranty_profit, oow_profit, total_profit, total_revenue, total_cost}`
- `GET_REVENUE_RANGE`                       — `{from,to}` → `{job_invoice_total, sales_invoice_total, gst_total}`
- `GET_PROFIT_BY_TECHNICIAN`                — `{from,to}` → list per technician
- `GET_TECH_REPAIRED_DELIVERED_RANGE`       — list per technician with split
- `GET_GST_SUMMARY_RANGE`                   — `{from,to}` → CGST/SGST/IGST aggregates
- `GET_CASH_REGISTER_RANGE`                 — `{from,to}` → daily receipts list
- `GET_SALES_REPORT_RANGE`                  — `{from,to}` → sales invoice line list

Group: **Job detailed transaction**
- `GET_DELIVERED_JOBS_DETAILED_RANGE`       — line-level: job + customer + invoice + parts + charges + profit
- `GET_JOB_TRANSACTION_LEDGER_RANGE`        — `job_transaction` joined to `job_status` + `technician` + `user`

Group: **Warranty (special)**
- `GET_WARRANTY_REPAIRS_SUMMARY_RANGE`      — `{from,to}` → `{warranty_jobs_count, repaired_count, delivered_count, parts_qty, parts_value, distinct_parts_count}`. **Warranty** is determined by `job.warranty_card_no IS NOT NULL`. Parts value uses `job_part_used.cost_price * qty` (cost-of-warranty, no revenue is billed on warranty repairs). Joins: `job` ⨝ `job_part_used` ⨝ `spare_part_master`.
- `GET_WARRANTY_REPAIRS_LIST_RANGE`         — `{from,to}` → list of warranty jobs with `{job_no, job_date, customer_name, model, technician, status, parts_qty, parts_value}`.
- `GET_WARRANTY_PARTS_CONSUMPTION_RANGE`    — `{from,to}` → line-level rows `{consumed_date, job_no, part_code, part_name, brand, qty, cost_price, line_value, technician}` for parts consumed in warranty jobs, sorted by `consumed_date desc`.
- `GET_WARRANTY_PARTS_BY_PART_RANGE`        — `{from,to}` → per-part roll-up `{part_code, part_name, brand, total_qty, total_value, jobs_count}` (powers top-parts chart).
- `GET_WARRANTY_TREND_MONTHLY`              — `{months_back}` (default 6) → monthly `{month, warranty_jobs, parts_qty, parts_value}`.
- `GET_WARRANTY_JOB_PARTS_DETAIL`           — `{job_id}` → parts consumed inside a specific warranty job (powers drilldown dialog).

Group: **Inventory / Parts**
- `GET_PARTS_OPENING_FY`                    — `{fy_id}` → per-part opening qty + value
- `GET_PARTS_DR_CR_FY`                      — `{fy_id}` → per-part debits + credits in qty + value
- `GET_PARTS_CLOSING_FY`                    — `{fy_id}` → per-part closing qty + value
- `GET_PARTS_AGING`                         — present stock with FIFO age buckets
- `GET_PARTS_AGING_OVER_YEAR`               — subset of above, age > 365 days
- `GET_PARTS_CONSUMPTION_RANGE`             — `{from,to}` → transactions where consumed (job_part_used + sales)
- `GET_STOCK_LEDGER_RANGE`                  — `{from,to,part_id?}` → `stock_transaction` rows + running balance
- `GET_STOCK_MOVEMENT_SUMMARY_RANGE`        — `{from,to}` → totals per `stock_transaction_type`
- `GET_PARTS_CONSUMPTION_MONTHLY_LAST_6`    — per part, per month qty consumed (M-1..M-6)
- `GET_PARTS_CURRENT_STOCK`                 — present stock on hand (sum over `stock_balance`)

> Server work is logged in this plan but executed in the server repo (see `Workflow → Server Side`). Each query must follow the existing pattern in `sql_bu.py` (parameterized SQL string keyed by id, executed by `psycopg_driver`).

### 6.2 Client side
Add SQL_MAP keys in `src/constants/sql-map.ts` mirroring the names above. Add nothing to `GRAPHQL_MAP` — all calls go through existing `genericQuery` with `{ db_name, schema, value: buildGenericQueryValue({ sqlId, sqlArgs }) }` (the helper already used in `client-layout.tsx:128`).

Sample hook (one per report):
```ts
const useJobsReceivedRangeSplit = (range: DateRangeType) => {
   const dbName = useAppSelector(selectDbName);
   const schema = useAppSelector(selectSchema);
   return useQuery(GRAPHQL_MAP.genericQuery, {
      fetchPolicy: 'network-only',
      variables: {
         db_name: dbName, schema,
         value: graphQlUtils.buildGenericQueryValue({
            sqlId:   SQL_MAP.GET_JOBS_RECEIVED_RANGE_SPLIT,
            sqlArgs: { from: range.from.toISOString(), to: range.to.toISOString() },
         }),
      },
   });
};
```

All hooks live next to their consuming section, named `use-*.ts` (kebab) using arrow-function components per project rules.

---

## 7. Routing & Selection Wiring

`ReportsContent` in `client-reports-page.tsx` switches on `useClientSelection().selected`. We replace the current `if (selected === 'Dashboard')` / fallback `ComingSoon` block with a **lookup table**:

```ts
const REPORT_SECTIONS: Record<string, ComponentType> = {
   'Dashboard':                       DashboardSection,
   'Job Intake Summary':              JobIntakeSummarySection,
   'Jobs Repaired (OK)':              JobsRepairedSection,
   'Jobs Delivered (OK)':             JobsDeliveredSection,
   'Delivered Jobs — Detailed':       JobsDeliveredDetailedSection,
   'Job Transaction Ledger':          JobTransactionLedgerSection,
   'Job Pipeline / Aging':            JobPipelineAgingSection,
   'Job Status Trend':                JobStatusTrendSection,
   'Warranty Repairs & Parts Value':  WarrantyRepairsPartsValueSection,
   'Warranty Parts Consumption Detail': WarrantyPartsConsumptionDetailSection,
   'Warranty Trend (6-month)':        WarrantyTrendSection,
   'Profit Summary':                  ProfitSummarySection,
   'Revenue Report':                  RevenueReportSection,
   'Cash Register':                   CashRegisterSection,
   'Sales Report':                    SalesReportSection,
   'GST Summary':                     GstSummarySection,
   'Technician Scorecard':            TechnicianScorecardSection,
   'Technician Repaired vs Delivered':TechnicianRepairedDeliveredSection,
   'Technician Profit & Revenue':     TechnicianProfitRevenueSection,
   'Technician Productivity Heatmap': TechnicianProductivityHeatmapSection,
   'Spare Parts Ledger (Op/Dr/Cr/Cl)':SparePartsLedgerSection,
   'Spare Parts Aging':               SparePartsAgingSection,
   'Slow Movers (Aged > 1 year)':     SparePartsAgingSection,             // pre-filter
   'Parts Consumption — Detailed':    PartsConsumptionDetailedSection,
   'Stock Ledger':                    StockLedgerSection,
   'Stock Movement Summary':          StockMovementSummarySection,
   'Parts Reorder Suggestions':       PartsReorderSuggestionsSection,
   'Jobs Received — Monthly':         JobsReceivedMonthlySection,
   'Jobs Received — Year-wise':       JobsReceivedYearwiseSection,
   'Jobs Received — 12/24/36-month':  JobsReceivedTrailingSection,
   'Repair vs Deliver Funnel':        RepairDeliverFunnelSection,
   'Profit Trend (YoY)':              ProfitTrendYoYSection,
};
```

A new `Section` is rendered with its own `ReportToolbar` so range/branch state is owned per section.

Existing labels in `ReportsExplorer` are renamed/added to match — see Step 2 of execution.

No router change required (the page already mounts at `/client/reports`).

---

## 8. Operations Dashboard (Default Landing)

### 8.1 KPI Cards (top row, 4 cards on xl, 2 on md, 1 on sm)
1. **Jobs Received Today** — warranty + OOW split, delta vs yesterday.
2. **Jobs Delivered Today** — delivered-ok count, delta vs yesterday.
3. **Revenue Today (₹)** — sum of `job_invoice.amount` + `sales_invoice.amount` invoice_date = today.
4. **Profit Today (₹)** — derived (see formula §1).

Second row (4 more):
5. **Open Jobs** — count where `is_closed = false`.
6. **Overdue Jobs** — open jobs older than 7 days (config: app_setting later).
7. **Low-Stock Parts** — parts with `stock_balance.qty < reorder_level` (no field today → use reorder suggestion as proxy).
8. **Aged Parts** — count of parts aged > 1 year.

### 8.2 Charts row
- **Monthly Job Intake (this FY)** — stacked Bar (Warranty / OOW) per month.
- **Profit Trend (last 12 months)** — Line.
- **Status Mix (this month)** — Donut/Pie of jobs by `job_status`.
- **Top 5 Technicians by Profit (this month)** — Horizontal Bar.

### 8.3 Lists row
- **Recent Repair Queue** — exactly the current table, fed live from `GET_RECENT_JOBS`.
- **Alerts panel** — overdue jobs + low-stock parts + aged parts (top 5 each, links to detail).

### 8.4 Range scope
Dashboard top-bar has a global range that drives all KPIs & charts. Default = `Today` for KPIs, `This FY` for charts.

---

## 9. Individual Reports — Specification Matrix

### 9.1 Jobs Received — Job Intake Summary
- Columns: **Range Bucket** | **Warranty** | **Out of Warranty** | **Total**
- Buckets row: Today, Yesterday, This Week, Prev Week, This Month, Last Month, Q1..Q4, YTD, Last Year
- Side chart: bar chart for the active row's range (or month-wise for "YTD").
- Drilldown: clicking a row opens `JobIntakeRangeDetailDialog` with the underlying job list.

### 9.2 Jobs Repaired (OK) — same matrix as 9.1 using `job_status='REPAIRED_OK'` (or `is_final && delivery_date IS NULL`).

### 9.3 Jobs Delivered (OK) — same matrix using `job_status='DELIVERED_OK'` and `job.delivery_date IS NOT NULL`.

### 9.4 Delivered Jobs — Detailed (per range)
- Columns: **Job No** | **Date Delivered** | **Customer** | **Model** | **Technician** | **Warranty?** | **Parts Cost** | **Charges Cost** | **Selling Total** | **Profit** | **GST**
- Sort by `delivery_date desc`.
- Footer totals row.
- PDF landscape.

### 9.5 Job Transaction Ledger
- Columns: **Date** | **Job No** | **Status** | **Technician** | **Amount** | **Performed By** | **Remarks**
- Sort by `transaction_date desc` (per tran.md "datewise decr sorted").
- Range filter + Job No search.

### 9.6 Job Pipeline / Aging
- Cross-tab: **Status** × age buckets `<24h, 1-3d, 3-7d, 7-15d, 15-30d, >30d`.
- Cells are counts. Clicking opens job list dialog.
- Visual heatmap coloring (orange scale for older — no red).

### 9.7 Job Status Trend
- Stacked area chart, x-axis = month (last 12), stacks = statuses.

### 9.7a Warranty Repairs & Parts Value (⭐ Special)

**Purpose.** Single-pane view of the cost-of-warranty: how many in-warranty jobs are being serviced and how much spare-parts value is being consumed against them. Per `tran.md`, the named ranges are **This Month**, **Previous Month**, and **Custom** — these are surfaced as primary tabs; the standard Range Picker is still available (Today / Yesterday / Week / FY / quarters / YTD) for power users.

**Definition of "in-warranty".** A job is in-warranty when `job.warranty_card_no IS NOT NULL` (matches the existing rule in §1). No revenue is billed against these jobs; only cost-of-parts is tracked.

**Toolbar (left → right):**
- Range tabs: `This Month` (default), `Previous Month`, `Custom` (opens date-range Popover with Calendar).
- Standard Range Picker (collapsible "More ranges" link).
- Branch / Division filter.
- Brand filter (chips, multi-select).
- Technician filter.
- Refresh, Export PDF, Export Excel, Print.

**Header KPI strip (4 cards via `kpi-grid`):**
1. **Warranty Jobs**       — count of distinct in-warranty jobs touched in range (from `GET_WARRANTY_REPAIRS_SUMMARY_RANGE.warranty_jobs_count`). Delta vs prior period of same length.
2. **Parts Consumed (Qty)**— `parts_qty` total. Delta vs prior period.
3. **Parts Value (₹)**     — `parts_value` total, formatted INR. Delta vs prior period, colored success/warning (no red unless above an alert threshold from `app_setting` later).
4. **Distinct Parts**      — `distinct_parts_count`. Tooltip: "How varied is the parts usage."

**Body (two-column on `lg+`, stacked on smaller):**

- **Left column — Warranty Jobs list** (`report-table`)
  Source: `GET_WARRANTY_REPAIRS_LIST_RANGE`.
  Columns:
  | Job No | Job Date | Customer | Model | Technician | Status | Parts Qty | Parts Value (₹) |
  Sort default `job_date desc`. Footer totals row sums Qty + Value.
  Row click → opens `WarrantyJobDetailDialog` showing parts consumed inside that single job (sourced from `GET_WARRANTY_JOB_PARTS_DETAIL`).

- **Right column — Top Parts by Value** (`chart-card`)
  Source: `GET_WARRANTY_PARTS_BY_PART_RANGE` truncated to top 10.
  Horizontal Bar chart (recharts). Hover tooltip shows qty, value, jobs_count.

**Below — Parts Consumption breakdown table** (`report-table`)
Source: `GET_WARRANTY_PARTS_BY_PART_RANGE` (full list).
Columns:
| Part Code | Part Name | Brand | Total Qty | Total Value (₹) | # Jobs |
Sort by `Total Value desc`. Footer totals row. Brand filter from toolbar narrows this list and the chart in tandem.

**Side panel — Period Comparison (always visible)**
Two-cell mini-card showing:
- **This Month** → jobs, qty, value.
- **Previous Month** → jobs, qty, value, with delta arrows.
This is computed via two parallel queries (`This Month` + `Previous Month` ranges) so the comparison is consistent regardless of which tab is currently active.

**PDF export.**
Landscape A4. Sections in order: KPI strip, Warranty Jobs list (autoTable), Parts Consumption breakdown (autoTable), Period Comparison block. Top Parts chart is rasterized into the PDF via the SVG → canvas pipeline in §10.

**Excel export.**
Multi-sheet workbook:
- `Summary` — KPIs + period comparison.
- `Warranty Jobs` — list table.
- `Parts Consumption` — breakdown table.

### 9.7b Warranty Parts Consumption Detail (⭐ Special)
Line-level companion to 9.7a — every individual `job_part_used` row that hit an in-warranty job in the range.

Toolbar identical to 9.7a (range tabs This Month / Previous Month / Custom + standard ranges + Branch + Brand + Technician + Part search).

Table (`report-table`):
| Consumed Date | Job No | Part Code | Part Name | Brand | Qty | Cost Price | Line Value (₹) | Technician |

Sort default `consumed_date desc` (per `tran.md` convention). Footer totals for Qty + Line Value. Click on Job No drills to `WarrantyJobDetailDialog`.

PDF: landscape, autoTable with totals row.

### 9.7c Warranty Trend (6-month chart) (⭐ Special)
Source: `GET_WARRANTY_TREND_MONTHLY` (default `months_back = 6`; selector allows 3 / 6 / 12 / 24).

Chart: combo (Bar = Parts Value ₹ on left axis, Line = Warranty Jobs count on right axis). Optional toggle to switch to Parts Qty.

Below the chart, a small data table mirrors the chart values. PDF export rasterizes chart + autoTable for the data table.

### 9.8 Profit Summary
- Same range matrix as Jobs Received but cells are profit ₹.
- W vs OOW split, total column.
- Side bar chart per bucket.

### 9.9 Revenue Report
- Cards: total invoice value, GST collected, # invoices.
- Table: invoice list with filters.
- Charts: monthly revenue.

### 9.10 Cash Register
- Daily receipts from `job_payment` + sales (cash payments only).
- Group by day, then by payment_mode.

### 9.11 Sales Report
- `sales_invoice_line` flattened with brand + customer.
- Range, brand, customer filters.

### 9.12 GST Summary
- CGST / SGST / IGST per period (monthly within range), plus totals.

### 9.13 Technician Scorecard
- One row per technician. Columns: **Tech** | **Received** | **Repaired OK** | **Delivered OK** | **Avg Turnaround (days)** | **Revenue ₹** | **Profit ₹**
- W vs OOW sub-columns under Received / Repaired / Delivered (toggleable).
- Highlight top performer per column.

### 9.14 Technician Repaired vs Delivered (chart)
- Grouped bar: per technician, Repaired (orange) and Delivered (accent blue).

### 9.15 Technician Profit & Revenue
- Two charts side-by-side: Bar (Profit per tech), Bar (Revenue per tech).
- Table with totals.

### 9.16 Technician Productivity Heatmap
- X = days in range, Y = technician, value = #jobs touched. Color scale accent.

### 9.17 Spare Parts Ledger (Op / Dr / Cr / Cl) — FY-wise
- FY dropdown (defaults to current FY).
- Columns: **Part Code** | **Part Name** | **Brand** | **Op Qty** | **Op Value** | **Dr Qty** | **Dr Value** | **Cr Qty** | **Cr Value** | **Cl Qty** | **Cl Value**
- Use `stock_snapshot` for opening of period start, sum `stock_transaction` (dr/cr) inside FY, derive closing.
- Total row.

### 9.18 Spare Parts Aging
- Compute age via FIFO purchase lines remaining on hand. Approach:
  1. For each part, list `purchase_invoice_line` rows ordered by `invoice_date asc`.
  2. Consume from earliest as `stock_transaction` debits accumulate.
  3. Remaining qty per lot → age = today − invoice_date.
- Buckets: `0-30, 31-90, 91-180, 181-365, >365`.
- Slow Movers report opens this section with bucket = `>365` preset.

### 9.19 Parts Consumption — Detailed
- Tabs: **Weekly | Monthly | Yearly | All**.
- Columns: **Consumed Date** | **Part Code** | **Part Name** | **Qty** | **Source (Job/Sales)** | **Ref No** | **Branch** | **Remarks**
- Sort by `transaction_date desc` (per tran.md).

### 9.20 Stock Ledger
- Per-part running balance ledger.
- Columns: **Date** | **Txn Type** | **Ref** | **Dr Qty** | **Cr Qty** | **Balance** | **Unit Cost** | **Remarks**

### 9.21 Stock Movement Summary
- Range. Group by `stock_transaction_type`. Sum dr + cr.
- Bar chart.

### 9.22 Parts Reorder Suggestions
- Algorithm (client-side over server returns):
  1. Fetch `GET_PARTS_CONSUMPTION_MONTHLY_LAST_6` returning `{ part_id, month_offset, qty }` for offsets 1..6.
  2. Compute weighted mean `W = sum(qty_i * w_i) / sum(w_i)`, weights `[6,5,4,3,2,1]` for offsets `[1,2,3,4,5,6]` so most recent gets highest weight (matches tran.md).
  3. Fetch current stock via `GET_PARTS_CURRENT_STOCK` per part.
  4. `suggestedOrderQty = max(0, ceil(W) − stockOnHand)`.
  5. If `W = 0 && stockOnHand > 0` → flag as "Dead stock candidate" (informational).
- Columns: **Part Code** | **Part Name** | **Brand** | **Stock On Hand** | **M-1 Qty** | **M-2** | ... | **M-6** | **Weighted Monthly Demand** | **Suggested Order Qty** | **Action**
- Filter: brand, category, "Order > 0 only".
- Bulk action: export as draft PO (CSV) - phase 2.

### 9.23 Trends section reports
All five are pure chart pages with a range/year selector. Each also offers a data table beneath the chart and PDF export of both.

---

## 10. PDF Export Details

`pdf-export.ts` produces consistent PDFs:
- Page header: division name (left), report title (center), generated_at + page (right).
- Subheader band: Range, Branch (if multi), Filters.
- `autoTable` body with zebra striping (gray, no red).
- Totals row in bold with top border.
- For chart-only reports, render the recharts SVG to canvas (`html2canvas` is **not** in deps — instead use `recharts`' `getSnapshotBeforeUpdate` + `<svg>` → `jsPDF.addSvgAsImage` via `jspdf` SVG handling; if that proves brittle, render an offscreen `<canvas>` from the SVG with `XMLSerializer` + `Image.onload` + `ctx.drawImage`, then `doc.addImage(...)`).
- File name: `<report-title>_<range>_<YYYY-MM-DD>.pdf`.

A `<PrintButton>` shadcn dropdown offers `PDF`, `Excel`, `CSV`, `Print` (browser).

---

## 11. Performance, Errors, Loading

- All sections use `report-loading.tsx` (skeleton matching layout) on Apollo `loading`.
- All sections show `report-error.tsx` on Apollo `error` with retry button — error message text via `@/constants/messages.ts` keys (new keys added: `reports.fetchFailed`, `reports.noData`, `reports.exportFailed`, `reports.printingPdf`, etc.).
- Heavy reports (ledger, aging) limit to first 500 rows in UI, with "Export Full" PDF/Excel button doing a separate large fetch.
- Debounced search at 1200ms (project default per `claude.md`).

---

## 12. Responsive & Accessibility

- All KPI / chart grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` patterns.
- Tables fall back to a card list on `<sm` (per existing pattern in `client-explorer-panel.tsx`).
- Range picker collapses to bottom sheet on mobile.
- Charts use `ResponsiveContainer` with min-height 280.
- Color tokens reference existing `--cl-*` theme; no red except errors.
- All buttons have `aria-label`.

---

## 13. Messages (centralized)

Add to `src/constants/messages.ts`:
```ts
reportsFetchFailed:        'Unable to load report. Please retry.',
reportsNoData:             'No data for the selected range.',
reportsExportFailed:       'Failed to export the report.',
reportsExportSuccess:      'Report exported.',
reportsPdfPreparing:       'Preparing PDF...',
reportsConfirmLargeExport: 'This export is large, continue?',
reportsCustomRangeInvalid: 'From date must be on or before To date.',
reportsRangeRequired:      'Please select a date range.',
```

All other UI strings ≤ 2 words remain inline.

---

## 14. Step-by-Step Execution

### **Step 1 — Server-side SQL keys** (`service-plus-server/app/db/sql_bu.py`)
Add all SQL constants listed in §6.1. Each is a parameterized SQL string keyed by id, surfaced through the existing `genericQuery` resolver. Add unit-tested SQL for: jobs received range split, repaired/delivered, monthly intake, profit ranges, technician aggregates, stock ledger, parts aging, parts consumption monthly last 6, current stock, GST summary, cash register, sales report range, recent jobs, overdue jobs.

### **Step 2 — Update Explorer**
Edit `src/features/client/components/client-explorer-panel.tsx` → `ReportsExplorer`:
- Replace existing items with the IA in §2.
- Add groups: **Job Reports**, **Financial Reports**, **Performance Reports**, **Inventory Reports**, **Trends**.
- Reuse `TreeItem` with appropriate `lucide-react` icons.
- Keep `Dashboard` at top, ungrouped.

### **Step 3 — SQL_MAP additions**
Edit `src/constants/sql-map.ts` to add every new SQL id in §6.1 (TypeScript constants), keep them sorted alphabetically within their group (per `claude.md`).

### **Step 4 — Shared `_common`**
Create the files under `src/features/client/components/reports/_common/`:
- `fiscal.ts`, `use-fiscal-setting.ts`, `use-report-range.ts`
- `range-picker.tsx`, `report-toolbar.tsx`, `report-section.tsx`
- `kpi-card.tsx`, `kpi-grid.tsx`
- `report-table.tsx`, `chart-card.tsx`
- `report-empty.tsx`, `report-error.tsx`, `report-loading.tsx`
- `pdf-export.ts`, `xlsx-export.ts`
Use shadcn primitives (Card, Button, Select, Calendar, Popover, Table, Tabs, Tooltip) + framer-motion fade-in.

### **Step 5 — Reports page wiring**
Rewrite `src/features/client/pages/client-reports-page.tsx`:
- Replace inline `DashboardOverview` + `ComingSoon` with the `REPORT_SECTIONS` lookup of §7.
- Default to `DashboardSection`.
- Wrap children in `ClientLayout` (unchanged).

### **Step 6 — Dashboard module** (`reports/dashboard/`)
Implement KPIs, monthly chart, warranty split, recent jobs, alerts as per §8.

### **Step 7 — Job Reports**
Implement seven sections under `reports/jobs/`. Each uses `report-toolbar` + matrix/table + chart panel + drilldown dialog where listed.

### **Step 7a — Warranty Reports (⭐ Special)**
Implement three sections under `reports/warranty/`:
- `warranty-repairs-parts-value-section.tsx` (§9.7a) — KPI strip, jobs list, top-parts chart, breakdown table, period comparison panel, all wired to the new SQL keys in §6.1 "Warranty (special)".
- `warranty-parts-consumption-detail-section.tsx` (§9.7b).
- `warranty-trend-section.tsx` (§9.7c).
- `warranty-job-detail-dialog.tsx` — drilldown invoked from rows in 9.7a/9.7b, fed by `GET_WARRANTY_JOB_PARTS_DETAIL`.

Range tabs (`This Month` / `Previous Month` / `Custom`) are implemented as a thin wrapper on top of `useReportRange`, preselecting the appropriate `RangeKeyType` and surfacing a `Custom` Popover with shadcn `Calendar`. Period-comparison panel issues two parallel `genericQuery` calls (current + previous month) regardless of the active tab.

### **Step 8 — Financial Reports**
Implement five sections under `reports/financial/`.

### **Step 9 — Performance Reports**
Implement four sections under `reports/performance/`. Technician Scorecard table + three chart-led pages.

### **Step 10 — Inventory Reports**
Implement six sections under `reports/inventory/` including the Reorder Suggestions algorithm (§9.22) and FIFO aging (§9.18).

### **Step 11 — Trends module**
Implement five chart-led sections under `reports/trends/`.

### **Step 12 — PDF / Excel exporters**
Wire the toolbar dropdown to `pdf-export.ts` and `xlsx-export.ts`. Validate for: table reports (autoTable), chart-only reports (SVG → image), large datasets (background fetch + progress toast).

### **Step 13 — Messages**
Add new keys to `src/constants/messages.ts` (§13). Wire all toasts via `sonner`.

### **Step 14 — Types**
Add type files under `src/features/client/types/reports/` per report family. All ending in `Type` (per `claude.md`).

### **Step 15 — Responsive QA**
- iPhone SE, iPad, 1280px, 1920px viewports.
- Ensure explorer + toolbar + table + chart stack correctly.
- Verify color tokens in light/dark themes.

### **Step 16 — Performance pass**
- Memoize `useMemo` for computed aggregates (especially Reorder Suggestions weighting).
- Add `React.lazy` for each section so initial Reports route doesn't ship the entire bundle.

### **Step 17 — Manual verification** (Verify workflow)
Run `pnpm start`, click through each report, verify:
- Range buckets show correct numbers vs raw DB.
- Quarter math respects `fiscal_year_start_month_num`.
- W vs OOW split sums equal totals.
- Profit formula matches a spot-checked job manually.
- Aging buckets sum to total stock-on-hand.
- Reorder suggestion = `max(0, ceil(W) − stockOnHand)`.
- PDFs render cleanly portrait + landscape.

### **Step 18 — Cleanup**
- Remove old hard-coded `STATS` / `JOBS` arrays in `client-reports-page.tsx` once `DashboardSection` is live.
- Delete `ComingSoon` once all sections exist.
- Lint pass (`pnpm lint`) + format (`pnpm format`).

---

## 15. Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Reporting & Dashboard Workflow                      │
└─────────────────────────────────────────────────────────────────────────────┘

User opens /client/reports
        │
        ▼
ClientLayout mounts → fetches GET_APP_SETTINGS (default_gst_rate, fiscal_year_start_month_num, …)
        │
        ▼
ClientExplorerPanel → ReportsExplorer renders groups (Dashboard, Job Reports, Financial, …)
        │
        ▼
User clicks "Dashboard"  ──►  REPORT_SECTIONS['Dashboard'] = <DashboardSection/>
                                       │
                                       ├─► useFiscalSetting() reads fyStartMonth → builds quarters
                                       ├─► useReportRange('today')
                                       ├─► dashboardKPIs hook → GET_JOBS_RECEIVED_RANGE_SPLIT, …
                                       ├─► dashboardCharts hooks → GET_JOBS_RECEIVED_BY_MONTH, …
                                       └─► dashboardLists hooks → GET_RECENT_JOBS, GET_OVERDUE_JOBS, …

User switches to a report (e.g. "Spare Parts Aging")
        │
        ▼
REPORT_SECTIONS['Spare Parts Aging'] = <SparePartsAgingSection/>
        │
        ├─► Toolbar: range, branch, brand, "Aged > 1 year" toggle
        ├─► Apollo genericQuery(GET_PARTS_AGING, {as_of, branch_id?, brand_id?})
        ├─► report-table renders rows + footer totals
        └─► Export menu → pdf-export / xlsx-export

For Reorder Suggestions:
        │
        ├─► Apollo genericQuery(GET_PARTS_CONSUMPTION_MONTHLY_LAST_6)
        ├─► Apollo genericQuery(GET_PARTS_CURRENT_STOCK)
        ├─► Client merges into weighted-average view (weights [6,5,4,3,2,1])
        ├─► report-table with computed Suggested Qty
        └─► Export menu → pdf-export

Every report:
        Toolbar Range Change ──► refetch hooks (network-only)
        Toolbar Export PDF   ──► pdf-export.ts → jspdf-autotable
        Toolbar Export Excel ──► xlsx-export.ts → xlsx
        Toolbar Print        ──► window.print() with print stylesheet
```

---

## 16. Risk Register & Mitigations

| Risk | Mitigation |
|------|------------|
| Server-side SQL not yet in place | Each section is gated by Apollo loading/error states; mock SQL ids can return empty arrays so client work proceeds in parallel. |
| FIFO aging is expensive over large lot history | Server precomputes via window functions; client only consumes; cap to current FY. |
| Profit double-counting if invoices and parts overlap | Calculation uses `job_invoice_line + job_additional_charge.selling_price*qty` for revenue and `job_part_used.cost_price*qty + job_additional_charge.cost_price*qty` for cost — invoice lines are the single source of revenue, parts_used is cost only. |
| Quarters across FY rollover ambiguous | `getFiscalQuarterBounds` always resolves to current FY's quarter; "Last Year" picks prior FY's full year. |
| PDF SVG export from recharts brittle | Fall back to canvas rasterization using XMLSerializer pipeline. |
| Bundle size growth from recharts everywhere | `React.lazy` per section. |

---

## 17. Acceptance Criteria (from tran.md, mapped)

- [x] Warranty + OOW received counts for all named ranges → §9.1
- [x] Same for Repaired OK → §9.2
- [x] Same for Delivered OK → §9.3
- [x] Profits for same ranges → §9.8
- [x] Technician-wise W + OOW repaired, delivered, profit, revenue → §9.13–9.15
- [x] Job delivered OK detailed transaction report for same ranges → §9.4
- [x] Complete Job transaction report date-desc → §9.5
- [x] Spare parts opening / debits / credits / closing / value FY-wise → §9.17
- [x] Spare parts aging + aged > 1 year → §9.18
- [x] Spare parts detailed consumption weekly / monthly / yearly / all desc by consumed date → §9.19
- [x] Dynamic ordering suggestions with weighted last-6-month consumption + present stock → §9.22
- [x] PDF printing of all reports → §10 + Step 12
- [x] Use `fiscal_year_start_month_num` for quarters → §4
- [x] Monthwise graphs this year / last year / last 2 / last 3 years + year-wise graph → §9.23 (Trends)
- [x] Industry-pattern grouping, dashboards, overviews, chart-based reports → §2 + §8
- [x] **Special warranty report**: in-warranty job repairs + spare parts consumed + spare parts value for This Month / Previous Month / Custom → §2 (Warranty Reports group), §6.1 "Warranty (special)" SQL keys, §9.7a / §9.7b / §9.7c, and Step 7a
