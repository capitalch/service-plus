import { useMemo, useState } from "react";
import {
    Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useGenericQuery } from "../common/use-generic-query";

type RowType = {
    jobs_count: number;
    month: string;
    status_code: string;
    status_name: string;
};

const MONTH_OPTIONS = [3, 6, 12, 24];

const PALETTE = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#84cc16", "#a855f7", "#6366f1", "#14b8a6", "#fb923c", "#0ea5e9", "#22c55e", "#d946ef", "#facc15"];

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const JobStatusTrendSection = () => {
    const [monthsBack, setMonthsBack] = useState<number>(6);

    const sqlArgs = useMemo(() => ({ months_back: monthsBack }), [monthsBack]);

    const q = useGenericQuery<RowType>({
        sqlArgs,
        sqlId: SQL_MAP.GET_JOB_STATUS_TREND_MONTHLY,
    });

    const { chartData, statusKeys } = useMemo(() => {
        const months = new Map<string, Record<string, number | string>>();
        const statuses = new Set<string>();
        for (const r of q.data) {
            statuses.add(r.status_name);
            const m = months.get(r.month) ?? { month: formatMonthLabel(r.month) };
            m[r.status_name] = (Number(m[r.status_name] ?? 0)) + Number(r.jobs_count);
            months.set(r.month, m);
        }
        return {
            chartData:  Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v),
            statusKeys: Array.from(statuses),
        };
    }, [q.data]);

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month",       header: "Month",       width: 30 },
                    { dataKey: "status_name", header: "Status",      width: 60 },
                    { align: "right", dataKey: "jobs_count", header: "Count", width: 30 },
                ],
                fileName:    `job-status-trend_${monthsBack}m`,
                orientation: "portrait",
                rows: q.data.map(r => ({
                    jobs_count:  Number(r.jobs_count),
                    month:       formatMonthLabel(r.month),
                    status_name: r.status_name,
                })),
                title: "Job Status Trend",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `job-status-trend_${monthsBack}m`,
                sheets: [{
                    name: "Status Trend",
                    rows: q.data.map(r => ({
                        "Count":  Number(r.jobs_count),
                        "Month":  formatMonthLabel(r.month),
                        "Status": r.status_name,
                    })),
                }],
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    return (
        <ReportSection>
            <ReportToolbar
                hideRange
                onExportExcel={handleXlsxExport}
                onExportPdf={handlePdfExport}
                onPrint={() => window.print()}
                onRefresh={q.refetch}
                subtitle="Stacked status mix across recent months"
                title="Job Status Trend"
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

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Stacked area — job counts per status per month" title="Status Mix">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={340} width="100%">
                                <AreaChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="month" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} style={{ fontSize: "10px" }} tickLine={false} width={32} />
                                    <Tooltip
                                        contentStyle={{
                                            background:   "var(--cl-surface-2)",
                                            border:       "1px solid var(--cl-border)",
                                            borderRadius: "6px",
                                            fontSize:     "12px",
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                                    {statusKeys.map((status, idx) => (
                                        <Area
                                            dataKey={status}
                                            fill={PALETTE[idx % PALETTE.length]}
                                            key={status}
                                            stackId="1"
                                            stroke={PALETTE[idx % PALETTE.length]}
                                            type="monotone"
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
