import { useMemo, useState } from "react";
import { Boxes, Layers, Package, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr, formatNumber } from "../common/formatters";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { formatDateShort } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";
import { WarrantyJobDetailDialog } from "./warranty-job-detail-dialog";
import { WarrantyPeriodComparison } from "./warranty-period-comparison";
import { WarrantyRangeTabs } from "./warranty-range-tabs";
import { WarrantyTopPartsChart } from "./warranty-top-parts-chart";
import type {
    WarrantyJobRowType, WarrantyPartRollupType, WarrantySummaryRowType,
} from "./warranty-types";

const JOB_COLUMNS: ReportColumnType<WarrantyJobRowType>[] = [
    {
        cell:   r => <span className="font-mono text-(--cl-accent-text)">{r.job_no}</span>,
        header: "Job No",
        id:     "job_no",
        value:  r => r.job_no,
        width:  "110px",
    },
    {
        cell:   r => formatDateShort(r.delivery_date ?? r.job_date),
        header: "Date",
        id:     "date",
        value:  r => r.delivery_date ?? r.job_date,
        width:  "110px",
    },
    {
        header: "Customer",
        id:     "customer",
        value:  r => r.customer_name,
    },
    {
        cell:   r => (
            <div className="flex flex-col">
                <span>{r.product_name ?? "—"}</span>
                <span className="text-[10px] text-(--cl-text-muted)">
                    {[r.brand_name, r.model_name].filter(Boolean).join(" • ")}
                </span>
            </div>
        ),
        header: "Device",
        id:     "device",
        value:  r => `${r.product_name ?? ""} ${r.brand_name ?? ""} ${r.model_name ?? ""}`,
    },
    {
        cell:   r => r.technician_name ?? "—",
        header: "Technician",
        id:     "tech",
        value:  r => r.technician_name ?? "",
        width:  "130px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.parts_qty), 0)),
        header: "Parts Qty",
        id:     "qty",
        value:  r => Number(r.parts_qty),
        width:  "90px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.parts_value)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.parts_value), 0)),
        header: "Parts Value ₹",
        id:     "value",
        value:  r => Number(r.parts_value),
        width:  "130px",
    },
];

const PART_COLUMNS: ReportColumnType<WarrantyPartRollupType>[] = [
    {
        header: "Part Code",
        id:     "code",
        value:  r => r.part_code,
        width:  "120px",
    },
    {
        header: "Part Name",
        id:     "name",
        value:  r => r.part_name,
    },
    {
        header: "Brand",
        id:     "brand",
        value:  r => r.brand_name ?? "—",
        width:  "120px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.total_qty), 0)),
        header: "Qty",
        id:     "qty",
        value:  r => Number(r.total_qty),
        width:  "80px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.total_value)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.total_value), 0)),
        header: "Value ₹",
        id:     "value",
        value:  r => Number(r.total_value),
        width:  "130px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.jobs_count), 0)),
        header: "# Jobs",
        id:     "jobs",
        value:  r => Number(r.jobs_count),
        width:  "80px",
    },
];

export const WarrantyRepairsPartsValueSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(
        () => getRange("thisMonth", new Date(), fyStartMonth),
        [fyStartMonth],
    );
    const [range, setRange] = useState<DateRangeType>(initialRange);
    const [activeJob, setActiveJob] = useState<{ id: number; jobNo: string } | null>(null);

    const thisMonthRange = useMemo(() => getRange("thisMonth", new Date(), fyStartMonth), [fyStartMonth]);
    const lastMonthRange = useMemo(() => getRange("lastMonth", new Date(), fyStartMonth), [fyStartMonth]);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const thisMonthArgs = useMemo(() => ({
        from: formatIsoDate(thisMonthRange.from),
        to:   formatIsoDate(thisMonthRange.to),
    }), [thisMonthRange]);

    const lastMonthArgs = useMemo(() => ({
        from: formatIsoDate(lastMonthRange.from),
        to:   formatIsoDate(lastMonthRange.to),
    }), [lastMonthRange]);

    const summaryQ = useGenericQuery<WarrantySummaryRowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_REPAIRS_SUMMARY_RANGE,
    });

    const jobsQ = useGenericQuery<WarrantyJobRowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_REPAIRS_LIST_RANGE,
    });

    const partsQ = useGenericQuery<WarrantyPartRollupType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_PARTS_BY_PART_RANGE,
    });

    const thisMonthSummaryQ = useGenericQuery<WarrantySummaryRowType>({
        enabled: isReady,
        sqlArgs: thisMonthArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_REPAIRS_SUMMARY_RANGE,
    });

    const lastMonthSummaryQ = useGenericQuery<WarrantySummaryRowType>({
        enabled: isReady,
        sqlArgs: lastMonthArgs,
        sqlId:   SQL_MAP.GET_WARRANTY_REPAIRS_SUMMARY_RANGE,
    });

    const summary  = summaryQ.data?.[0] ?? null;
    const loading  = summaryQ.loading || jobsQ.loading || partsQ.loading;
    const anyError = summaryQ.error || jobsQ.error || partsQ.error;

    function handleRefresh() {
        summaryQ.refetch();
        jobsQ.refetch();
        partsQ.refetch();
        thisMonthSummaryQ.refetch();
        lastMonthSummaryQ.refetch();
    }

    function handlePdfExport() {
        try {
            const rangeLabel = `${rangeArgs.from} → ${rangeArgs.to}`;
            exportReportPdf({
                columns: [
                    { dataKey: "job_no",        header: "Job No",     width: 22 },
                    { dataKey: "date",          header: "Date",       width: 22 },
                    { dataKey: "customer_name", header: "Customer" },
                    { dataKey: "device",        header: "Device" },
                    { dataKey: "technician",    header: "Technician", width: 28 },
                    { align: "right", dataKey: "qty",   header: "Qty",   width: 16 },
                    { align: "right", dataKey: "value", header: "Value ₹", width: 24 },
                ],
                fileName:    `warranty-repairs_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [
                    { label: "Range", value: rangeLabel },
                    { label: "Warranty Jobs",  value: formatNumber(summary?.warranty_jobs_count ?? 0) },
                    { label: "Parts Qty",      value: formatNumber(summary?.parts_qty ?? 0) },
                    { label: "Parts Value",    value: formatInr(summary?.parts_value ?? 0) },
                ],
                orientation: "landscape",
                rows: jobsQ.data.map(r => ({
                    customer_name: r.customer_name,
                    date:          formatDateShort(r.delivery_date ?? r.job_date),
                    device:        [r.product_name, r.brand_name, r.model_name].filter(Boolean).join(" • "),
                    job_no:        r.job_no,
                    qty:           formatNumber(Number(r.parts_qty)),
                    technician:    r.technician_name ?? "",
                    value:         formatInr(Number(r.parts_value)),
                })),
                subtitle:    "In-warranty job repairs · parts consumed · parts value",
                title:       "Warranty Repairs & Parts Value",
                totalsRow:   {
                    customer_name: "",
                    date:          "",
                    device:        "",
                    job_no:        "TOTAL",
                    qty:           formatNumber(jobsQ.data.reduce((s, r) => s + Number(r.parts_qty), 0)),
                    technician:    "",
                    value:         formatInr(jobsQ.data.reduce((s, r) => s + Number(r.parts_value), 0)),
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    function handleXlsxExport() {
        try {
            const rangeLabel = `${rangeArgs.from} → ${rangeArgs.to}`;
            exportReportXlsx({
                fileName: `warranty-repairs_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [
                    {
                        name: "Summary",
                        rows: [
                            { Metric: "Range",          Value: rangeLabel },
                            { Metric: "Warranty Jobs",  Value: summary?.warranty_jobs_count ?? 0 },
                            { Metric: "Repaired",       Value: summary?.repaired_count ?? 0 },
                            { Metric: "Delivered",      Value: summary?.delivered_count ?? 0 },
                            { Metric: "Parts Qty",      Value: summary?.parts_qty ?? 0 },
                            { Metric: "Parts Value",    Value: Number(summary?.parts_value ?? 0) },
                            { Metric: "Distinct Parts", Value: summary?.distinct_parts_count ?? 0 },
                        ],
                    },
                    {
                        name: "Warranty Jobs",
                        rows: jobsQ.data.map(r => ({
                            "Brand":      r.brand_name ?? "",
                            "Customer":   r.customer_name,
                            "Date":       formatDateShort(r.delivery_date ?? r.job_date),
                            "Job No":     r.job_no,
                            "Model":      r.model_name ?? "",
                            "Parts Qty":  Number(r.parts_qty),
                            "Parts Value": Number(r.parts_value),
                            "Product":    r.product_name ?? "",
                            "Status":     r.status_name,
                            "Technician": r.technician_name ?? "",
                        })),
                    },
                    {
                        name: "Parts Consumption",
                        rows: partsQ.data.map(r => ({
                            "Brand":     r.brand_name ?? "",
                            "Jobs":      Number(r.jobs_count),
                            "Part Code": r.part_code,
                            "Part Name": r.part_name,
                            "Qty":       Number(r.total_qty),
                            "Value":     Number(r.total_value),
                        })),
                    },
                ],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    return (
        <ReportSection>
            <ReportToolbar
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={handleRefresh}
                subtitle="In-warranty job repairs, parts consumed and parts value — by month or custom range"
                title="Warranty Repairs & Parts Value"
            >
                <WarrantyRangeTabs
                    fyStartMonth={fyStartMonth}
                    onChange={setRange}
                    range={range}
                />
            </ReportToolbar>

            {anyError && <ReportError onRetry={handleRefresh} />}

            <KpiGrid columns={4}>
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={ShieldCheck}
                    label="Warranty Jobs"
                    loading={loading}
                    subValue={summary ? `Repaired ${summary.repaired_count} · Delivered ${summary.delivered_count}` : undefined}
                    value={formatNumber(summary?.warranty_jobs_count ?? 0)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={Boxes}
                    label="Parts Consumed (Qty)"
                    loading={loading}
                    value={formatNumber(summary?.parts_qty ?? 0)}
                />
                <KpiCard
                    accentClassName="text-emerald-500"
                    icon={Package}
                    label="Parts Value"
                    loading={loading}
                    value={formatInr(summary?.parts_value ?? 0)}
                />
                <KpiCard
                    accentClassName="text-(--cl-accent-text)"
                    icon={Layers}
                    label="Distinct Parts"
                    loading={loading}
                    value={formatNumber(summary?.distinct_parts_count ?? 0)}
                />
            </KpiGrid>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ChartCard
                    className="lg:col-span-2"
                    description="Click a row to see parts consumed inside that job"
                    title="In-Warranty Jobs"
                >
                    {jobsQ.loading
                        ? <ReportLoading lines={4} />
                        : jobsQ.data.length === 0
                            ? <ReportEmpty message={MESSAGES.INFO_WARRANTY_NO_JOBS_IN_RANGE} />
                            : (
                                <ReportTable
                                    columns={JOB_COLUMNS}
                                    onRowClick={r => setActiveJob({ id: r.id, jobNo: r.job_no })}
                                    rowKey={r => r.id}
                                    rows={jobsQ.data}
                                    showFooter
                                    stickyHeader={false}
                                />
                            )
                    }
                </ChartCard>
                <div className="flex flex-col gap-4">
                    <ChartCard description="Top spare parts driving warranty cost" title="Top Parts by Value">
                        {partsQ.loading
                            ? <ReportLoading lines={3} />
                            : partsQ.data.length === 0
                                ? <ReportEmpty />
                                : <WarrantyTopPartsChart data={partsQ.data} limit={10} />
                        }
                    </ChartCard>
                    <WarrantyPeriodComparison
                        current={thisMonthSummaryQ.data?.[0] ?? null}
                        previous={lastMonthSummaryQ.data?.[0] ?? null}
                    />
                </div>
            </div>

            <ChartCard description="Per-part roll-up across all in-warranty jobs in range" title="Parts Consumption — Breakdown">
                {partsQ.loading
                    ? <ReportLoading lines={4} />
                    : partsQ.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={PART_COLUMNS}
                                rowKey={r => r.part_id}
                                rows={partsQ.data}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>

            <WarrantyJobDetailDialog
                jobId={activeJob?.id ?? null}
                jobNo={activeJob?.jobNo ?? null}
                onClose={() => setActiveJob(null)}
            />
        </ReportSection>
    );
};
