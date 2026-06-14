import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatInr, formatNumber } from "../_common/formatters";
import { formatIsoDate, getRange } from "../_common/fiscal";
import type { DateRangeType } from "../_common/fiscal";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportTable } from "../_common/report-table";
import type { ReportColumnType } from "../_common/report-table";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useFiscalSetting } from "../_common/use-fiscal-setting";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    avg_turnaround_days: number;
    delivered_count: number;
    profit: number;
    received_count: number;
    repaired_count: number;
    revenue: number;
    technician_id: number;
    technician_name: string;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { header: "Technician", id: "name", value: r => r.technician_name },
    { align: "right", cell: r => formatNumber(Number(r.received_count)),  footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.received_count), 0)),  header: "Received",   id: "rec",  value: r => Number(r.received_count) },
    { align: "right", cell: r => formatNumber(Number(r.repaired_count)),  footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.repaired_count), 0)),  header: "Repaired",   id: "rep",  value: r => Number(r.repaired_count) },
    { align: "right", cell: r => formatNumber(Number(r.delivered_count)), footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.delivered_count), 0)), header: "Delivered",  id: "del",  value: r => Number(r.delivered_count) },
    { align: "right", cell: r => `${Number(r.avg_turnaround_days).toFixed(1)} d`, header: "Avg Turnaround", id: "tat", value: r => Number(r.avg_turnaround_days) },
    { align: "right", cell: r => formatInr(Number(r.revenue)), footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.revenue), 0)), header: "Revenue", id: "rev", value: r => Number(r.revenue) },
    { align: "right", cell: r => <span className="font-bold text-emerald-600">{formatInr(Number(r.profit))}</span>, footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.profit), 0)), header: "Profit", id: "p", value: r => Number(r.profit) },
];

export const TechnicianScorecardSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const initialRange = useMemo<DateRangeType>(() => getRange("thisMonth", new Date(), fyStartMonth), [fyStartMonth]);
    const [range, setRange] = useState<DateRangeType>(initialRange);

    const rangeArgs = useMemo(() => ({
        from: formatIsoDate(range.from),
        to:   formatIsoDate(range.to),
    }), [range]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs: rangeArgs,
        sqlId:   SQL_MAP.GET_TECHNICIAN_SCORECARD_RANGE,
    });

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "name", header: "Technician" },
                    { align: "right", dataKey: "rec", header: "Received",  width: 22 },
                    { align: "right", dataKey: "rep", header: "Repaired",  width: 22 },
                    { align: "right", dataKey: "del", header: "Delivered", width: 22 },
                    { align: "right", dataKey: "tat", header: "Avg TAT",   width: 22 },
                    { align: "right", dataKey: "rev", header: "Revenue",   width: 28 },
                    { align: "right", dataKey: "p",   header: "Profit",    width: 28 },
                ],
                fileName:    `technician-scorecard_${rangeArgs.from}_${rangeArgs.to}`,
                meta:        [{ label: "Range", value: `${rangeArgs.from} → ${rangeArgs.to}` }],
                orientation: "landscape",
                rows: q.data.map(r => ({
                    del:  formatNumber(Number(r.delivered_count)),
                    name: r.technician_name,
                    p:    formatInr(Number(r.profit)),
                    rec:  formatNumber(Number(r.received_count)),
                    rep:  formatNumber(Number(r.repaired_count)),
                    rev:  formatInr(Number(r.revenue)),
                    tat:  `${Number(r.avg_turnaround_days).toFixed(1)}d`,
                })),
                title: "Technician Scorecard",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `technician-scorecard_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Scorecard",
                    rows: q.data.map(r => ({
                        "Avg TAT":    Number(r.avg_turnaround_days),
                        "Delivered":  Number(r.delivered_count),
                        "Profit":     Number(r.profit),
                        "Received":   Number(r.received_count),
                        "Repaired":   Number(r.repaired_count),
                        "Revenue":    Number(r.revenue),
                        "Technician": r.technician_name,
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
                subtitle="Per-technician KPI matrix"
                title="Technician Scorecard"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Sorted by profit descending" title="Scorecard">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.technician_id}
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
