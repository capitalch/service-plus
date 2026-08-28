import { useMemo } from "react";
import {
    Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatNumber } from "../common/formatters";
import { formatIsoDate, getCurrentFiscalYearBounds } from "../common/fiscal";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

type RowType = {
    month: string;
    oow_count: number;
    total_count: number;
    warranty_count: number;
};

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} '${y.slice(-2)}`;
}

export const JobsReceivedMonthlySection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const range = useMemo(() => getCurrentFiscalYearBounds(new Date(), fyStartMonth), [fyStartMonth]);
    const sqlArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs,
        sqlId:   SQL_MAP.GET_JOBS_RECEIVED_BY_MONTH,
    });

    const chartData = q.data.map(d => ({
        month:    formatMonthLabel(d.month),
        oow:      Number(d.oow_count),
        warranty: Number(d.warranty_count),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month", header: "Month", width: 40 },
                    { align: "right", dataKey: "warranty", header: "Warranty", width: 30 },
                    { align: "right", dataKey: "oow",      header: "OOW",      width: 30 },
                    { align: "right", dataKey: "total",    header: "Total",    width: 30 },
                ],
                fileName: "jobs-received-monthly",
                rows: q.data.map(r => ({
                    month:    formatMonthLabel(r.month),
                    oow:      formatNumber(Number(r.oow_count)),
                    total:    formatNumber(Number(r.total_count)),
                    warranty: formatNumber(Number(r.warranty_count)),
                })),
                title: "Jobs Received — Monthly",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "jobs-received-monthly",
                sheets: [{
                    name: "Monthly Intake",
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
                subtitle={`Stacked monthly intake — current fiscal year`}
                title="Jobs Received — Monthly"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Warranty vs Out-of-Warranty" title="Monthly Intake">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={340} width="100%">
                                <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="month" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} style={{ fontSize: "10px" }} tickLine={false} width={32} />
                                    <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar dataKey="warranty" fill="#10b981" name="Warranty" radius={[3, 3, 0, 0]} stackId="a" />
                                    <Bar dataKey="oow"      fill="#3b82f6" name="Out of Warranty" radius={[3, 3, 0, 0]} stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
