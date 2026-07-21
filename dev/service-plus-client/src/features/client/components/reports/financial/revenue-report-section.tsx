import { useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr, formatNumber } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
import { KpiCard } from "../common/kpi-card";
import { KpiGrid } from "../common/kpi-grid";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

type SummaryRowType = {
    gst_total: number;
    job_invoice_count: number;
    job_invoice_total: number;
    sales_invoice_count: number;
    sales_invoice_total: number;
};

type MonthlyRowType = {
    month: string;
    revenue: number;
};

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const RevenueReportSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(() => getRange("ytd", new Date(), fyStartMonth), [fyStartMonth]);
    const [range, setRange] = useState<DateRangeType>(initialRange);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const summaryQ = useGenericQuery<SummaryRowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_REVENUE_RANGE,
    });

    const monthlyQ = useGenericQuery<MonthlyRowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_REVENUE_BY_MONTH_RANGE,
    });

    const summary = summaryQ.data?.[0] ?? null;
    const totalRevenue = Number(summary?.job_invoice_total ?? 0) + Number(summary?.sales_invoice_total ?? 0);

    const chartData = monthlyQ.data.map(d => ({
        month:   formatMonthLabel(d.month),
        revenue: Number(d.revenue),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "metric", header: "Metric", width: 70 },
                    { align: "right", dataKey: "value", header: "Value", width: 40 },
                ],
                fileName:    `revenue-report_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "portrait",
                rows: [
                    { metric: "Job Invoice Revenue",   value: formatInr(Number(summary?.job_invoice_total ?? 0)) },
                    { metric: "Sales Invoice Revenue", value: formatInr(Number(summary?.sales_invoice_total ?? 0)) },
                    { metric: "Total Revenue",         value: formatInr(totalRevenue) },
                    { metric: "Total GST",             value: formatInr(Number(summary?.gst_total ?? 0)) },
                    { metric: "# Job Invoices",        value: formatNumber(Number(summary?.job_invoice_count ?? 0)) },
                    { metric: "# Sales Invoices",      value: formatNumber(Number(summary?.sales_invoice_count ?? 0)) },
                ],
                title:    "Revenue Report",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `revenue-report_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [
                    {
                        name: "Summary",
                        rows: [
                            { Metric: "Range",                Value: `${rangeArgs.from} → ${rangeArgs.to}` },
                            { Metric: "Job Invoice Revenue",  Value: Number(summary?.job_invoice_total ?? 0) },
                            { Metric: "Sales Invoice Revenue", Value: Number(summary?.sales_invoice_total ?? 0) },
                            { Metric: "Total Revenue",        Value: totalRevenue },
                            { Metric: "Total GST",            Value: Number(summary?.gst_total ?? 0) },
                        ],
                    },
                    {
                        name: "Monthly Revenue",
                        rows: monthlyQ.data.map(r => ({
                            "Month":   formatMonthLabel(r.month),
                            "Revenue": Number(r.revenue),
                        })),
                    },
                ],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={() => { summaryQ.refetch(); monthlyQ.refetch(); }}
                onSetRange={(key, custom) => setRange(getRange(key, new Date(), fyStartMonth, custom))}
                range={range}
                subtitle="Job + Sales invoices combined with GST breakdown"
                title="Revenue Report"
            />

            {(summaryQ.error || monthlyQ.error) && (
                <ReportError onRetry={() => { summaryQ.refetch(); monthlyQ.refetch(); }} />
            )}

            <KpiGrid columns={4}>
                <KpiCard label="Total Revenue"   loading={summaryQ.loading} value={formatInr(totalRevenue)} accentClassName="text-emerald-500" />
                <KpiCard label="Job Invoices"    loading={summaryQ.loading} value={formatInr(Number(summary?.job_invoice_total ?? 0))} subValue={`${summary?.job_invoice_count ?? 0} invoices`} />
                <KpiCard label="Sales Invoices"  loading={summaryQ.loading} value={formatInr(Number(summary?.sales_invoice_total ?? 0))} subValue={`${summary?.sales_invoice_count ?? 0} invoices`} />
                <KpiCard label="Total GST"       loading={summaryQ.loading} value={formatInr(Number(summary?.gst_total ?? 0))} />
            </KpiGrid>

            <ChartCard description="Monthly revenue (job + sales invoices)" title="Monthly Revenue">
                {monthlyQ.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={320} width="100%">
                                <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="month" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis axisLine={false} style={{ fontSize: "10px" }} tickFormatter={v => formatInr(Number(v))} tickLine={false} width={64} />
                                    <Tooltip
                                        contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }}
                                        cursor={{ fill: "var(--cl-hover)" }}
                                        formatter={(value) => [formatInr(Number(value)), "Revenue"]}
                                    />
                                    <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
