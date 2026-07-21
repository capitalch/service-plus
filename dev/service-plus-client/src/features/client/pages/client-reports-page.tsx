import { Suspense, lazy } from "react";
import type { ComponentType } from "react";

import { ClientLayout, useClientSelection } from "../components/layout/client-layout";
import { ReportEmpty } from "../components/reports/common/report-empty";
import { ReportLoading } from "../components/reports/common/report-loading";

const DashboardSection                       = lazy(() => import("../components/reports/dashboard/dashboard-section").then(m => ({ default: m.DashboardSection })));

const JobIntakeSummarySection                = lazy(() => import("../components/reports/jobs/job-intake-summary-section").then(m => ({ default: m.JobIntakeSummarySection })));
const JobPipelineAgingSection                = lazy(() => import("../components/reports/jobs/job-pipeline-aging-section").then(m => ({ default: m.JobPipelineAgingSection })));
const JobsRepairedSection                    = lazy(() => import("../components/reports/jobs/jobs-repaired-section").then(m => ({ default: m.JobsRepairedSection })));
const JobsDeliveredSection                   = lazy(() => import("../components/reports/jobs/jobs-delivered-section").then(m => ({ default: m.JobsDeliveredSection })));
const JobsDeliveredDetailedSection           = lazy(() => import("../components/reports/jobs/jobs-delivered-detailed-section").then(m => ({ default: m.JobsDeliveredDetailedSection })));
const JobStatusTrendSection                  = lazy(() => import("../components/reports/jobs/job-status-trend-section").then(m => ({ default: m.JobStatusTrendSection })));
const JobTransactionLedgerSection            = lazy(() => import("../components/reports/jobs/job-transaction-ledger-section").then(m => ({ default: m.JobTransactionLedgerSection })));

const WarrantyRepairsPartsValueSection       = lazy(() => import("../components/reports/warranty/warranty-repairs-parts-value-section").then(m => ({ default: m.WarrantyRepairsPartsValueSection })));
const WarrantyPartsConsumptionDetailSection  = lazy(() => import("../components/reports/warranty/warranty-parts-consumption-detail-section").then(m => ({ default: m.WarrantyPartsConsumptionDetailSection })));
const WarrantyTrendSection                   = lazy(() => import("../components/reports/warranty/warranty-trend-section").then(m => ({ default: m.WarrantyTrendSection })));

const CashRegisterSection                    = lazy(() => import("../components/reports/financial/cash-register-section").then(m => ({ default: m.CashRegisterSection })));
const GstSummarySection                      = lazy(() => import("../components/reports/financial/gst-summary-section").then(m => ({ default: m.GstSummarySection })));
const ProfitSummarySection                   = lazy(() => import("../components/reports/financial/profit-summary-section").then(m => ({ default: m.ProfitSummarySection })));
const RevenueReportSection                   = lazy(() => import("../components/reports/financial/revenue-report-section").then(m => ({ default: m.RevenueReportSection })));
const SalesReportSection                     = lazy(() => import("../components/reports/financial/sales-report-section").then(m => ({ default: m.SalesReportSection })));

const TechnicianProductivityHeatmapSection   = lazy(() => import("../components/reports/performance/technician-productivity-heatmap-section").then(m => ({ default: m.TechnicianProductivityHeatmapSection })));
const TechnicianProfitRevenueSection         = lazy(() => import("../components/reports/performance/technician-profit-revenue-section").then(m => ({ default: m.TechnicianProfitRevenueSection })));
const TechnicianRepairedDeliveredSection     = lazy(() => import("../components/reports/performance/technician-repaired-delivered-section").then(m => ({ default: m.TechnicianRepairedDeliveredSection })));
const TechnicianScorecardSection             = lazy(() => import("../components/reports/performance/technician-scorecard-section").then(m => ({ default: m.TechnicianScorecardSection })));

const PartsConsumptionDetailedSection        = lazy(() => import("../components/reports/inventory/parts-consumption-detailed-section").then(m => ({ default: m.PartsConsumptionDetailedSection })));
const PartsReorderSuggestionsSection         = lazy(() => import("../components/reports/inventory/parts-reorder-suggestions-section").then(m => ({ default: m.PartsReorderSuggestionsSection })));
const SlowMoversSection                      = lazy(() => import("../components/reports/inventory/slow-movers-section").then(m => ({ default: m.SlowMoversSection })));
const SparePartsAgingSection                 = lazy(() => import("../components/reports/inventory/spare-parts-aging-section").then(m => ({ default: m.SparePartsAgingSection })));
const SparePartsLedgerSection                = lazy(() => import("../components/reports/inventory/spare-parts-ledger-section").then(m => ({ default: m.SparePartsLedgerSection })));
const StockLedgerSection                     = lazy(() => import("../components/reports/inventory/stock-ledger-section").then(m => ({ default: m.StockLedgerSection })));
const StockMovementSummarySection            = lazy(() => import("../components/reports/inventory/stock-movement-summary-section").then(m => ({ default: m.StockMovementSummarySection })));

const JobsReceivedMonthlySection             = lazy(() => import("../components/reports/trends/jobs-received-monthly-section").then(m => ({ default: m.JobsReceivedMonthlySection })));
const JobsReceivedTrailingSection            = lazy(() => import("../components/reports/trends/jobs-received-trailing-section").then(m => ({ default: m.JobsReceivedTrailingSection })));
const JobsReceivedYearwiseSection            = lazy(() => import("../components/reports/trends/jobs-received-yearwise-section").then(m => ({ default: m.JobsReceivedYearwiseSection })));
const ProfitTrendYoYSection                  = lazy(() => import("../components/reports/trends/profit-trend-yoy-section").then(m => ({ default: m.ProfitTrendYoYSection })));
const RepairDeliverFunnelSection             = lazy(() => import("../components/reports/trends/repair-deliver-funnel-section").then(m => ({ default: m.RepairDeliverFunnelSection })));

const REPORT_SECTIONS: Record<string, ComponentType> = {
    "Cash Register":                         CashRegisterSection,
    "Dashboard":                             DashboardSection,
    "Delivered Jobs — Detailed":             JobsDeliveredDetailedSection,
    "GST Summary":                           GstSummarySection,
    "Job Intake Summary":                    JobIntakeSummarySection,
    "Job Pipeline / Aging":                  JobPipelineAgingSection,
    "Job Status Trend":                      JobStatusTrendSection,
    "Job Transaction Ledger":                JobTransactionLedgerSection,
    "Jobs Delivered (OK)":                   JobsDeliveredSection,
    "Jobs Received — 12/24/36-month":        JobsReceivedTrailingSection,
    "Jobs Received — Monthly":               JobsReceivedMonthlySection,
    "Jobs Received — Year-wise":             JobsReceivedYearwiseSection,
    "Jobs Repaired (OK)":                    JobsRepairedSection,
    "Parts Consumption — Detailed":          PartsConsumptionDetailedSection,
    "Parts Reorder Suggestions":             PartsReorderSuggestionsSection,
    "Profit Summary":                        ProfitSummarySection,
    "Profit Trend (YoY)":                    ProfitTrendYoYSection,
    "Repair vs Deliver Funnel":              RepairDeliverFunnelSection,
    "Revenue Report":                        RevenueReportSection,
    "Sales Report":                          SalesReportSection,
    "Slow Movers (Aged > 1 year)":           SlowMoversSection,
    "Spare Parts Aging":                     SparePartsAgingSection,
    "Spare Parts Ledger (Op/Dr/Cr/Cl)":      SparePartsLedgerSection,
    "Stock Ledger":                          StockLedgerSection,
    "Stock Movement Summary":                StockMovementSummarySection,
    "Technician Productivity Heatmap":       TechnicianProductivityHeatmapSection,
    "Technician Profit & Revenue":           TechnicianProfitRevenueSection,
    "Technician Repaired vs Delivered":      TechnicianRepairedDeliveredSection,
    "Technician Scorecard":                  TechnicianScorecardSection,
    "Warranty Parts Consumption Detail":     WarrantyPartsConsumptionDetailSection,
    "Warranty Repairs & Parts Value":        WarrantyRepairsPartsValueSection,
    "Warranty Trend (6-month)":              WarrantyTrendSection,
};

function ComingSoon({ label }: { label: string }) {
    return (
        <ReportEmpty
            className="flex-1"
            message={`${label} — coming soon.`}
        />
    );
}

function ReportsContent() {
    const { selected } = useClientSelection();
    const Section = REPORT_SECTIONS[selected];

    if (!Section) return <ComingSoon label={selected || "Reports"} />;

    return (
        <Suspense fallback={<ReportLoading />}>
            <Section />
        </Suspense>
    );
}

export const ClientReportsPage = () => (
    <ClientLayout>
        <ReportsContent />
    </ClientLayout>
);
