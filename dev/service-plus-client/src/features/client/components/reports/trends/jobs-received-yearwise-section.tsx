import { useMemo, useState } from "react";
import {
    Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
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
    fy_year: number;
    oow_count: number;
    total_count: number;
    warranty_count: number;
};

const YEAR_OPTIONS = [1, 2, 3, 4, 5];

export const JobsReceivedYearwiseSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const [yearsBack, setYearsBack] = useState<number>(3);

    const sqlArgs = useMemo(() => ({
        fy_start_month: fyStartMonth,
        years_back:     yearsBack,
    }), [fyStartMonth, yearsBack]);

    const q = useGenericQuery<RowType>({
        enabled: isReady,
        sqlArgs,
        sqlId:   SQL_MAP.GET_JOBS_RECEIVED_BY_YEAR,
    });

    const chartData = q.data.map(r => ({
        fy:       `FY ${r.fy_year}-${(Number(r.fy_year) + 1) % 100}`,
        oow:      Number(r.oow_count),
        warranty: Number(r.warranty_count),
    }));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "fy", header: "Fiscal Year", width: 40 },
                    { align: "right", dataKey: "warranty", header: "Warranty", width: 30 },
                    { align: "right", dataKey: "oow",      header: "OOW",      width: 30 },
                    { align: "right", dataKey: "total",    header: "Total",    width: 30 },
                ],
                fileName: "jobs-received-yearwise",
                rows: q.data.map(r => ({
                    fy:       `FY ${r.fy_year}-${(Number(r.fy_year) + 1) % 100}`,
                    oow:      formatNumber(Number(r.oow_count)),
                    total:    formatNumber(Number(r.total_count)),
                    warranty: formatNumber(Number(r.warranty_count)),
                })),
                title: "Jobs Received — Year-wise",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "jobs-received-yearwise",
                sheets: [{
                    name: "Year-wise",
                    rows: q.data.map(r => ({
                        "Fiscal Year":     `FY ${r.fy_year}-${(Number(r.fy_year) + 1) % 100}`,
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
                subtitle="Job intake aggregated by fiscal year"
                title="Jobs Received — Year-wise"
            >
                <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        Years back
                    </Label>
                    <Select onValueChange={v => setYearsBack(Number(v))} value={String(yearsBack)}>
                        <SelectTrigger className="h-9 w-32">
                            <SelectValue placeholder="3 years" />
                        </SelectTrigger>
                        <SelectContent>
                            {YEAR_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={String(opt)}>{opt} year(s)</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportToolbar>

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Stacked bars by fiscal year" title="Year-wise Intake">
                {q.loading
                    ? <ReportLoading lines={3} />
                    : chartData.length === 0
                        ? <ReportEmpty />
                        : (
                            <ResponsiveContainer height={320} width="100%">
                                <BarChart data={chartData} margin={{ bottom: 0, left: 0, right: 12, top: 8 }}>
                                    <CartesianGrid stroke="var(--cl-divider)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="fy" style={{ fontSize: "10px" }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} style={{ fontSize: "10px" }} tickLine={false} width={48} />
                                    <Tooltip contentStyle={{ background: "var(--cl-surface-2)", border: "1px solid var(--cl-border)", borderRadius: "6px", fontSize: "12px" }} cursor={{ fill: "var(--cl-hover)" }} />
                                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                                    <Bar dataKey="warranty" fill="#10b981" name="Warranty" stackId="a" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="oow"      fill="#3b82f6" name="Out of Warranty" stackId="a" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
