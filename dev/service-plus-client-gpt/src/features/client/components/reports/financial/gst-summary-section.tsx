import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
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
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

type RowType = {
    aggregate: number;
    cgst: number;
    igst: number;
    month: string;
    sgst: number;
    total_gst: number;
};

function formatMonthLabel(yyyyMm: string): string {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m] = yyyyMm.split("-");
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return yyyyMm;
    return `${months[idx]} ${y}`;
}

const COLUMNS: ReportColumnType<RowType>[] = [
    { cell: r => formatMonthLabel(r.month), header: "Month", id: "month", value: r => r.month, width: "150px" },
    { align: "right", cell: r => formatInr(Number(r.aggregate)), footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.aggregate), 0)), header: "Aggregate", id: "agg", value: r => Number(r.aggregate) },
    { align: "right", cell: r => formatInr(Number(r.cgst)),      footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.cgst), 0)),      header: "CGST",      id: "cgst", value: r => Number(r.cgst) },
    { align: "right", cell: r => formatInr(Number(r.sgst)),      footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.sgst), 0)),      header: "SGST",      id: "sgst", value: r => Number(r.sgst) },
    { align: "right", cell: r => formatInr(Number(r.igst)),      footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.igst), 0)),      header: "IGST",      id: "igst", value: r => Number(r.igst) },
    { align: "right", cell: r => <span className="font-bold text-(--cl-accent-text)">{formatInr(Number(r.total_gst))}</span>, footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.total_gst), 0)), header: "Total GST", id: "tot", value: r => Number(r.total_gst) },
];

export const GstSummarySection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(() => getRange("ytd", new Date(), fyStartMonth), [fyStartMonth]);
    const [range, setRange] = useState<DateRangeType>(initialRange);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_GST_SUMMARY_RANGE,
    });

    const totalCgst = q.data.reduce((s, r) => s + Number(r.cgst), 0);
    const totalSgst = q.data.reduce((s, r) => s + Number(r.sgst), 0);
    const totalIgst = q.data.reduce((s, r) => s + Number(r.igst), 0);
    const totalGst  = q.data.reduce((s, r) => s + Number(r.total_gst), 0);

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "month", header: "Month", width: 36 },
                    { align: "right", dataKey: "agg",  header: "Aggregate", width: 30 },
                    { align: "right", dataKey: "cgst", header: "CGST",      width: 24 },
                    { align: "right", dataKey: "sgst", header: "SGST",      width: 24 },
                    { align: "right", dataKey: "igst", header: "IGST",      width: 24 },
                    { align: "right", dataKey: "tot",  header: "Total GST", width: 30 },
                ],
                fileName:    `gst-summary_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "portrait",
                rows: q.data.map(r => ({
                    agg:   formatInr(Number(r.aggregate)),
                    cgst:  formatInr(Number(r.cgst)),
                    igst:  formatInr(Number(r.igst)),
                    month: formatMonthLabel(r.month),
                    sgst:  formatInr(Number(r.sgst)),
                    tot:   formatInr(Number(r.total_gst)),
                })),
                title: "GST Summary",
                totalsRow: {
                    agg:   formatInr(q.data.reduce((s, r) => s + Number(r.aggregate), 0)),
                    cgst:  formatInr(totalCgst),
                    igst:  formatInr(totalIgst),
                    month: "TOTAL",
                    sgst:  formatInr(totalSgst),
                    tot:   formatInr(totalGst),
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `gst-summary_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "GST Summary",
                    rows: q.data.map(r => ({
                        "Aggregate": Number(r.aggregate),
                        "CGST":      Number(r.cgst),
                        "IGST":      Number(r.igst),
                        "Month":     formatMonthLabel(r.month),
                        "SGST":      Number(r.sgst),
                        "Total GST": Number(r.total_gst),
                    })),
                }],
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
                onRefresh={q.refetch}
                onSetRange={(key, custom) => setRange(getRange(key, new Date(), fyStartMonth, custom))}
                range={range}
                subtitle="CGST + SGST + IGST aggregated by month"
                title="GST Summary"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <KpiGrid columns={4}>
                <KpiCard label="CGST"      loading={q.loading} value={formatInr(totalCgst)} />
                <KpiCard label="SGST"      loading={q.loading} value={formatInr(totalSgst)} />
                <KpiCard label="IGST"      loading={q.loading} value={formatInr(totalIgst)} />
                <KpiCard label="Total GST" loading={q.loading} value={formatInr(totalGst)} accentClassName="text-emerald-500" />
            </KpiGrid>

            <ChartCard description="Monthly tax breakdown" title="Monthly GST">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.month}
                                rows={q.data}
                                showFooter
                                stickyHeader={false}
                            />
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
