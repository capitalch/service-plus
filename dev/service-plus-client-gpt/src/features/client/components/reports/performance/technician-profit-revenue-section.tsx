import { useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatInr } from "../common/formatters";
import { formatIsoDate, getRange } from "../common/fiscal";
import type { DateRangeType } from "../common/fiscal";
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
    cost: number;
    profit: number;
    revenue: number;
    technician_id: number;
    technician_name: string;
};

const COLUMNS: ReportColumnType<RowType>[] = [
    { header: "Technician", id: "name", value: r => r.technician_name },
    { align: "right", cell: r => formatInr(Number(r.revenue)), footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.revenue), 0)), header: "Revenue", id: "rev",  value: r => Number(r.revenue) },
    { align: "right", cell: r => formatInr(Number(r.cost)),    footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.cost), 0)),    header: "Cost",    id: "cost", value: r => Number(r.cost) },
    { align: "right", cell: r => <span className="font-bold text-emerald-600">{formatInr(Number(r.profit))}</span>, footer: rs => formatInr(rs.reduce((s, r) => s + Number(r.profit), 0)), header: "Profit", id: "p", value: r => Number(r.profit) },
];

export const TechnicianProfitRevenueSection = () => {
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
        sqlId:   SQL_MAP.GET_PROFIT_BY_TECHNICIAN_RANGE,
    });

    const chartData = q.data.map(r => ({
        name:    r.technician_name,
        profit:  Number(r.profit),
        revenue: Number(r.revenue),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "name", header: "Technician" },
                    { align: "right", dataKey: "rev",  header: "Revenue", width: 30 },
                    { align: "right", dataKey: "cost", header: "Cost",    width: 30 },
                    { align: "right", dataKey: "p",    header: "Profit",  width: 30 },
                ],
                fileName:    `tech-profit-revenue_${rangeArgs.from}_${rangeArgs.to}`,
                rows: q.data.map(r => ({
                    cost: formatInr(Number(r.cost)),
                    name: r.technician_name,
                    p:    formatInr(Number(r.profit)),
                    rev:  formatInr(Number(r.revenue)),
                })),
                title: "Technician Profit & Revenue",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: `tech-profit-revenue_${rangeArgs.from}_${rangeArgs.to}`,
                sheets: [{
                    name: "Profit & Revenue",
                    rows: q.data.map(r => ({
                        "Cost":       Number(r.cost),
                        "Profit":     Number(r.profit),
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
                subtitle="Per-technician revenue, cost and profit"
                title="Technician Profit & Revenue"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard description="Revenue per technician" title="Revenue">
                    {q.loading
                        ? <ReportLoading lines={3} />
                        : chartData.length === 0
                            ? <ReportEmpty />
                            : (
                                <ResponsiveContainer height={Math.max(chartData.length * 28, 240)} width="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ bottom: 0, left: 0, right: 16, top: 8 }}>
                                        <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" />
                                        <XAxis axisLine={false} style={{ fontSize: "10px" }} tickFormatter={v => formatInr(Number(v))} tickLine={false} type="number" />
                                        <YAxis axisLine={false} dataKey="name" style={{ fontSize: "10px" }} tickLine={false} type="category" width={120} />
                                        <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} formatter={(v) => [formatInr(Number(v)), "Revenue"]} />
                                        <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )
                    }
                </ChartCard>
                <ChartCard description="Profit per technician" title="Profit">
                    {q.loading
                        ? <ReportLoading lines={3} />
                        : chartData.length === 0
                            ? <ReportEmpty />
                            : (
                                <ResponsiveContainer height={Math.max(chartData.length * 28, 240)} width="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ bottom: 0, left: 0, right: 16, top: 8 }}>
                                        <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" />
                                        <XAxis axisLine={false} style={{ fontSize: "10px" }} tickFormatter={v => formatInr(Number(v))} tickLine={false} type="number" />
                                        <YAxis axisLine={false} dataKey="name" style={{ fontSize: "10px" }} tickLine={false} type="category" width={120} />
                                        <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} formatter={(v) => [formatInr(Number(v)), "Profit"]} />
                                        <Bar dataKey="profit" fill="#10b981" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )
                    }
                </ChartCard>
            </div>

            <ChartCard description="Per-technician details" title="Details">
                {q.loading
                    ? <ReportLoading lines={3} />
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
