import { useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../_common/chart-card";
import { formatNumber } from "../_common/formatters";
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
    dr_cr: string;
    total_lines: number;
    total_qty: number;
    txn_type_code: string;
    txn_type_name: string;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { header: "Type", id: "type", value: r => r.txn_type_name },
    { header: "Dr/Cr", id: "drcr", value: r => r.dr_cr === "D" ? "Debit" : "Credit", width: "100px" },
    { align: "right", footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_qty), 0)), header: "Total Qty", id: "q", value: r => Number(r.total_qty), width: "120px" },
    { align: "right", footer: rs => formatNumber(rs.reduce((s, r) => s + Number(r.total_lines), 0)), header: "Lines", id: "l", value: r => Number(r.total_lines), width: "100px" },
];

export const StockMovementSummarySection = () => {
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
        sqlId:   SQL_MAP.GET_STOCK_MOVEMENT_SUMMARY_RANGE,
    });

    const chartData = q.data.map(r => ({
        name: r.txn_type_name,
        qty:  Number(r.total_qty),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "name",  header: "Type" },
                    { dataKey: "drcr",  header: "Dr/Cr", width: 28 },
                    { align: "right", dataKey: "qty",   header: "Qty",   width: 24 },
                    { align: "right", dataKey: "lines", header: "Lines", width: 24 },
                ],
                fileName: `stock-movement_${rangeArgs.from}_${rangeArgs.to}`,
                rows: q.data.map(r => ({
                    drcr:  r.dr_cr === "D" ? "Debit" : "Credit",
                    lines: formatNumber(Number(r.total_lines)),
                    name:  r.txn_type_name,
                    qty:   formatNumber(Number(r.total_qty)),
                })),
                title: "Stock Movement Summary",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `stock-movement_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Movement",
                    rows: q.data.map(r => ({
                        "Dr/Cr":     r.dr_cr === "D" ? "Debit" : "Credit",
                        "Lines":     Number(r.total_lines),
                        "Total Qty": Number(r.total_qty),
                        "Type":      r.txn_type_name,
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
                subtitle="Aggregated quantity per transaction type within range"
                title="Stock Movement Summary"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Quantity per transaction type" title="Movement by Type">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={300} width="100%">
                                <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 16, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="name" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} style={{ fontSize: "10px" }} tickLine={false} width={48} />
                                    <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} />
                                    <Bar dataKey="qty" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>

            <ChartCard description="Underlying values" title="Details">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <ReportTable
                                columns={COLUMNS}
                                rowKey={r => r.txn_type_code}
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
