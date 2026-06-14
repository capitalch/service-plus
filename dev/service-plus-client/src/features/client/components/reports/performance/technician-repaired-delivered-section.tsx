import { useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
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
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useFiscalSetting } from "../_common/use-fiscal-setting";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    delivered_count: number;
    repaired_count: number;
    technician_id: number;
    technician_name: string;
};

export const TechnicianRepairedDeliveredSection = () => {
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
        sqlId:   SQL_MAP.GET_TECH_REPAIRED_DELIVERED_RANGE,
    });

    const chartData = q.data.map(r => ({
        delivered: Number(r.delivered_count),
        name:      r.technician_name,
        repaired:  Number(r.repaired_count),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "name", header: "Technician" },
                    { align: "right", dataKey: "rep", header: "Repaired",  width: 30 },
                    { align: "right", dataKey: "del", header: "Delivered", width: 30 },
                ],
                fileName:    `tech-repaired-delivered_${rangeArgs.from}_${rangeArgs.to}`,
                rows: q.data.map(r => ({
                    del:  formatNumber(Number(r.delivered_count)),
                    name: r.technician_name,
                    rep:  formatNumber(Number(r.repaired_count)),
                })),
                title: "Technician Repaired vs Delivered",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `tech-repaired-delivered_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Repaired vs Delivered",
                    rows: q.data.map(r => ({
                        "Delivered":  Number(r.delivered_count),
                        "Repaired":   Number(r.repaired_count),
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
                subtitle="Side-by-side bars per technician"
                title="Technician Repaired vs Delivered"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Grouped bars per technician" title="Repaired vs Delivered">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={Math.max(chartData.length * 32, 280)} width="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ bottom: 0, left: 0, right: 16, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" />
                                    <XAxis axisLine={false} style={{ fontSize: "10px" }} tickLine={false} type="number" />
                                    <YAxis axisLine={false} dataKey="name" style={{ fontSize: "10px" }} tickLine={false} type="category" width={140} />
                                    <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar dataKey="repaired"  fill="#f59e0b" name="Repaired"  radius={[0, 3, 3, 0]} />
                                    <Bar dataKey="delivered" fill="#10b981" name="Delivered" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
