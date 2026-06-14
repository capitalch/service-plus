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

import { ChartCard } from "../_common/chart-card";
import { formatNumber } from "../_common/formatters";
import { formatIsoDate, startOfDay } from "../_common/fiscal";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useFiscalSetting } from "../_common/use-fiscal-setting";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    month: string;
    oow_count: number;
    total_count: number;
    warranty_count: number;
};

const TRAILING_OPTIONS = [12, 24, 36];

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const JobsReceivedTrailingSection = () => {
    const { isReady } = useFiscalSetting();

    const [months, setMonths] = useState<number>(12);

    const sqlArgs = useMemo(() => {
        const today = new Date();
        const start = startOfDay(new Date(today.getFullYear(), today.getMonth() - (months - 1), 1));
        return { from: formatIsoDate(start), to: formatIsoDate(today) };
    }, [months]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs,
        sqlId:   SQL_MAP.GET_JOBS_RECEIVED_BY_MONTH,
    });

    const chartData = q.data.map(d => ({
        month:    formatMonthLabel(d.month),
        oow:      Number(d.oow_count),
        total:    Number(d.total_count),
        warranty: Number(d.warranty_count),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month", header: "Month", width: 30 },
                    { align: "right", dataKey: "warranty", header: "Warranty", width: 28 },
                    { align: "right", dataKey: "oow",      header: "OOW",      width: 28 },
                    { align: "right", dataKey: "total",    header: "Total",    width: 28 },
                ],
                fileName: `jobs-received-trailing-${months}m`,
                rows: q.data.map(r => ({
                    month:    formatMonthLabel(r.month),
                    oow:      formatNumber(Number(r.oow_count)),
                    total:    formatNumber(Number(r.total_count)),
                    warranty: formatNumber(Number(r.warranty_count)),
                })),
                title: `Jobs Received — Trailing ${months} months`,
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `jobs-received-trailing-${months}m`,
                sheets: [{
                    name: "Trailing",
                    rows: q.data.map(r => ({
                        "Month":           formatMonthLabel(r.month),
                        "Out of Warranty": Number(r.oow_count),
                        "Total":           Number(r.total_count),
                        "Warranty":        Number(r.warranty_count),
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
                subtitle="Trailing window — 12, 24 or 36 months"
                title={`Jobs Received — ${months}-month`}
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Window
                    </Label>
                    <Select onValueChange={v => setMonths(Number(v))} value={String(months)}>
                        <SelectTrigger className="h-9 w-32">
                            <SelectValue placeholder="12 months" />
                        </SelectTrigger>
                        <SelectContent>
                            {TRAILING_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={String(opt)}>{opt} months</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Trailing intake area chart" title="Trailing Intake">
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
                                    <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Area dataKey="warranty" fill="#10b981" name="Warranty" stackId="a" stroke="#10b981" type="monotone" />
                                    <Area dataKey="oow"      fill="#3b82f6" name="Out of Warranty" stackId="a" stroke="#3b82f6" type="monotone" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
