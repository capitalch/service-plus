import { useMemo, useState } from "react";
import {
    Bar, CartesianGrid, ComposedChart, Legend, Line,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr, formatNumber } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useGenericQuery } from "../common/use-generic-query";
import type { WarrantyTrendRowType } from "./warranty-types";

const MONTH_OPTIONS = [3, 6, 12, 24];

const TABLE_COLUMNS: ReportColumnType<WarrantyTrendRowType>[] = [
    {
        header: "Month",
        id:     "month",
        value:  r => r.month,
        width:  "120px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.warranty_jobs), 0)),
        header: "Warranty Jobs",
        id:     "jobs",
        value:  r => Number(r.warranty_jobs),
        width:  "130px",
    },
    {
        align:  "right",
        footer: rows => formatNumber(rows.reduce((s, r) => s + Number(r.parts_qty), 0)),
        header: "Parts Qty",
        id:     "qty",
        value:  r => Number(r.parts_qty),
        width:  "110px",
    },
    {
        align:  "right",
        cell:   r => formatInr(Number(r.parts_value)),
        footer: rows => formatInr(rows.reduce((s, r) => s + Number(r.parts_value), 0)),
        header: "Parts Value ₹",
        id:     "value",
        value:  r => Number(r.parts_value),
        width:  "150px",
    },
];

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const WarrantyTrendSection = () => {
    const [monthsBack, setMonthsBack] = useState<number>(6);

    const sqlArgs = useMemo(() => ({ months_back: monthsBack }), [monthsBack]);

    const trendQ = useGenericQuery<WarrantyTrendRowType>({
        sqlArgs,
        sqlId: SQL_MAP.GET_WARRANTY_TREND_MONTHLY,
    });

    const chartData = useMemo(
        () => trendQ.data.map(d => ({
            jobs:   Number(d.warranty_jobs),
            month:  formatMonthLabel(d.month),
            qty:    Number(d.parts_qty),
            value:  Number(d.parts_value),
        })),
        [trendQ.data],
    );

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month", header: "Month",         width: 30 },
                    { align: "right", dataKey: "jobs",  header: "Warranty Jobs", width: 35 },
                    { align: "right", dataKey: "qty",   header: "Parts Qty",     width: 30 },
                    { align: "right", dataKey: "value", header: "Parts Value",   width: 40 },
                ],
                fileName:    `warranty-trend_${monthsBack}m`,
                meta:        [{ label: "Range", value: `Last ${monthsBack} months` }],
                orientation: "portrait",
                rows: trendQ.data.map(r => ({
                    jobs:  formatNumber(Number(r.warranty_jobs)),
                    month: formatMonthLabel(r.month),
                    qty:   formatNumber(Number(r.parts_qty)),
                    value: formatInr(Number(r.parts_value)),
                })),
                subtitle:    "Warranty repairs and spare parts value over time",
                title:       "Warranty Trend",
                totalsRow:   {
                    jobs:  formatNumber(trendQ.data.reduce((s, r) => s + Number(r.warranty_jobs), 0)),
                    month: "TOTAL",
                    qty:   formatNumber(trendQ.data.reduce((s, r) => s + Number(r.parts_qty), 0)),
                    value: formatInr(trendQ.data.reduce((s, r) => s + Number(r.parts_value), 0)),
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `warranty-trend_${monthsBack}m`,
                sheets: [{
                    name: "Warranty Trend",
                    rows: trendQ.data.map(r => ({
                        "Month":         formatMonthLabel(r.month),
                        "Parts Qty":     Number(r.parts_qty),
                        "Parts Value":   Number(r.parts_value),
                        "Warranty Jobs": Number(r.warranty_jobs),
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch {
            toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
        }
    }

    return (
        <ReportSection>
            <ReportToolbar
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={trendQ.refetch}
                subtitle="Monthly trend of in-warranty jobs and parts value"
                title="Warranty Trend"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Months
                    </Label>
                    <Select onValueChange={v => setMonthsBack(Number(v))} value={String(monthsBack)}>
                        <SelectTrigger className="h-9 w-32">
                            <SelectValue placeholder="6 months" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={String(opt)}>{opt} months</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {trendQ.error && <ReportError onRetry={trendQ.refetch} />}

            <ChartCard
                description={`Parts value (bars) vs warranty job count (line) — last ${monthsBack} months`}
                title="Warranty Trend Chart"
            >
                {trendQ.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={320} width="100%">
                                <ComposedChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        axisLine={false}
                                        dataKey="month"
                                        style={{ fontSize: "10px" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        style={{ fontSize: "10px" }}
                                        tickFormatter={v => formatInr(Number(v))}
                                        tickLine={false}
                                        width={64}
                                        yAxisId="left"
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        axisLine={false}
                                        orientation="right"
                                        style={{ fontSize: "10px" }}
                                        tickLine={false}
                                        width={32}
                                        yAxisId="right"
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background:   "var(--cl-surface-2)",
                                            border:       "1px solid var(--cl-border)",
                                            borderRadius: "6px",
                                            fontSize:     "12px",
                                        }}
                                        cursor={{ fill: "var(--cl-hover)" }}
                                        formatter={(value, name) => {
                                            const num = Number(value);
                                            if (name === "Parts Value") return [formatInr(num), String(name)];
                                            return [String(value), String(name)];
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar
                                        dataKey="value"
                                        fill="#10b981"
                                        name="Parts Value"
                                        radius={[3, 3, 0, 0]}
                                        yAxisId="left"
                                    />
                                    <Line
                                        dataKey="jobs"
                                        dot={{ fill: "#3b82f6", r: 4 }}
                                        name="Warranty Jobs"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        type="monotone"
                                        yAxisId="right"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>

            <ChartCard description="Underlying values for the chart above" title="Data Table">
                {trendQ.loading
                    ? <ReportLoading lines={3} />
                    : trendQ.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={TABLE_COLUMNS}
                                rowKey={r => r.month}
                                rows={trendQ.data.map(r => ({ ...r, month: formatMonthLabel(r.month) }))}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
