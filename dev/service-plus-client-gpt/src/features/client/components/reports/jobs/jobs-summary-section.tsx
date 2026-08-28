import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SQL_MAP } from "@/constants/sql-map";

import { CategoryRangeMatrixSection } from "../common/category-range-matrix-section";
import { JobsCombinedChartSection } from "./jobs-combined-chart-section";
import { JobsCombinedSection } from "./jobs-combined-section";

// job_status is a small, seeded, tenant-consistent enum (not tenant-managed like product
// categories), so rows are ordered by its display_order instead of alphabetically — mirrors
// the workflow order jobs actually move through, matching seed_bu_data.py's app_setting seed.
const TRANSACTION_STATUS_ORDER = [
    "Received", "Assigned", "In Progress", "Estimated", "Estimate Approved", "Estimate Rejected",
    "Parts Pending", "Sent to Company", "Received Back From Company", "Return", "Completed OK",
    "Outsourced", "Cancelled", "Disposed", "Delivered OK", "Delivered Not OK", "On Hold",
];

export const JobsSummarySection = () => (
    <Tabs className="flex h-full min-h-0 flex-1 flex-col" defaultValue="received">
        <TabsList className="w-fit shrink-0 flex-wrap">
            <TabsTrigger value="received">Jobs Received</TabsTrigger>
            <TabsTrigger value="repaired">Jobs Repaired (OK)</TabsTrigger>
            <TabsTrigger value="delivered">Jobs Delivered (OK)</TabsTrigger>
            <TabsTrigger value="combined">Combined</TabsTrigger>
            <TabsTrigger value="combined-chart">Combined Chart</TabsTrigger>
            <TabsTrigger value="transactions">Job Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
            <CategoryRangeMatrixSection
                description="Jobs received across all standard date buckets, split warranty vs out-of-warranty. Click a cell to view its jobs."
                drillDownSqlId={SQL_MAP.GET_JOBS_RECEIVED_DETAIL}
                fileSlug="jobs-received"
                sqlId={SQL_MAP.GET_JOBS_RECEIVED_BY_CATEGORY_RANGE_SPLIT}
                title="Jobs Received"
            />
        </TabsContent>

        <TabsContent value="repaired">
            <CategoryRangeMatrixSection
                description="Jobs marked Completed OK or Delivered OK in each date bucket. Click a cell to view its jobs."
                drillDownSqlId={SQL_MAP.GET_JOBS_REPAIRED_OK_DETAIL}
                fileSlug="jobs-repaired-ok"
                sqlId={SQL_MAP.GET_JOBS_REPAIRED_OK_BY_CATEGORY_RANGE_SPLIT}
                title="Jobs Repaired (OK)"
            />
        </TabsContent>

        <TabsContent value="delivered">
            <CategoryRangeMatrixSection
                description="Jobs Delivered OK in each date bucket. Click a cell to view its jobs."
                drillDownSqlId={SQL_MAP.GET_JOBS_DELIVERED_OK_DETAIL}
                fileSlug="jobs-delivered-ok"
                showFinancialsInDrillDown
                showFinancialToggles
                sqlId={SQL_MAP.GET_JOBS_DELIVERED_OK_BY_CATEGORY_RANGE_SPLIT}
                title="Jobs Delivered (OK)"
            />
        </TabsContent>

        <TabsContent value="combined">
            <JobsCombinedSection />
        </TabsContent>

        <TabsContent value="combined-chart">
            <JobsCombinedChartSection />
        </TabsContent>

        <TabsContent value="transactions">
            <CategoryRangeMatrixSection
                description="Job status changes across all standard date buckets, split warranty vs out-of-warranty. Click a cell to view its jobs."
                drillDownSqlId={SQL_MAP.GET_JOB_TRANSACTIONS_DETAIL}
                fileSlug="job-transactions"
                matrixDescription="Transaction type vs. standard date buckets. Ranges overlap (e.g. Today is included in This Week, Q1, and YTD), so the Total row sums each bucket down its column (across transaction types), not across buckets. A transaction type with no transactions in any bucket is not listed."
                rowLabel="Transaction Type"
                rowOrder={TRANSACTION_STATUS_ORDER}
                sqlId={SQL_MAP.GET_JOB_TRANSACTIONS_BY_STATUS_RANGE_SPLIT}
                title="Job Transactions"
            />
        </TabsContent>
    </Tabs>
);
