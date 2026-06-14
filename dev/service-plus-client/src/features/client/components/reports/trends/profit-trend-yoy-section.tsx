import { useMemo, useState } from "react";
import {
    CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatInr } from "../_common/formatters";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    month: string;
    profit: number;
};

const WINDOWS = [12, 24, 36];

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const ProfitTrendYoYSection = () => {
    const [monthsBack, setMonthsBack] = useState<number>(24);

    const sqlArgs = useMemo(() => ({ months_back: monthsBack }), [monthsBack]);

    const q = useGenericQuery<RowType>({
        sqlArgs,
        sqlId: SQL_MAP.GET_PROFIT_TREND_YOY,
    });

    const chartData = q.data.map(d => ({
        month:  formatMonthLabel(d.month),
        profit: Number(d.profit),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month",  header: "Month", width: 40 },
                    { align: "right", dataKey: "profit", header: "Profit", width: 40 },
                ],
                fileName: `profit-trend-${monthsBack}m`,
                rows: q.data.map(r => ({
                    month:  formatMonthLabel(r.month),
                    profit: formatInr(Number(r.profit)),
                })),
                title: "Profit Trend (YoY)",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `profit-trend-${monthsBack}m`,
                sheets: [{
                    name: "Profit Trend",
                    rows: q.data.map(r => ({
                        "Month":  formatMonthLabel(r.month),
                        "Profit": Number(r.profit),
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
                subtitle="Trailing monthly profit line"
                title="Profit Trend (YoY)"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Window
                    </Label>
                    <Select onValueChange={v => setMonthsBack(Number(v))} value={String(monthsBack)}>
                        <SelectTrigger className="h-9 w-32">
                            <SelectValue placeholder="24 months" />
                        </SelectTrigger>
                        <SelectContent>
                            {WINDOWS.map(opt => (
                                <SelectItem key={opt} value={String(opt)}>{opt} months</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Monthly profit trend" title="Profit Trend">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={340} width="100%">
                                <LineChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="month" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis axisLine={false} style={{ fontSize: "10px" }} tickFormatter={v => formatInr(Number(v))} tickLine={false} width={64} />
                                    <Tooltip
                                        contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }}
                                        formatter={(value) => [formatInr(Number(value)), "Profit"]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Line dataKey="profit" dot={{ fill: "#10b981", r: 3 }} name="Profit" stroke="#10b981" strokeWidth={2} type="monotone" />
                                </LineChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
