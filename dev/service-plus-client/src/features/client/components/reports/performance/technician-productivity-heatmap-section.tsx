import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { ChartCard } from "../_common/chart-card";
import { formatDateShort } from "../_common/formatters";
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
    day: string;
    jobs_touched: number;
    technician_id: number;
    technician_name: string;
};

function heatColor(value: number, max: number): string {
    if (value === 0 || max === 0) return "bg-(--cl-surface-3) text-(--cl-text-muted)";
    const r = value / max;
    if (r > 0.66) return "bg-emerald-500/80 text-white font-bold";
    if (r > 0.33) return "bg-emerald-300/60 text-(--cl-text)";
    return "bg-(--cl-accent)/15 text-(--cl-text)";
}

export const TechnicianProductivityHeatmapSection = () => {
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
        sqlId:   SQL_MAP.GET_TECH_PRODUCTIVITY_HEATMAP_RANGE,
    });

    const { days, max, techMap } = useMemo(() => {
        const techMap = new Map<string, Map<string, number>>();
        const daySet = new Set<string>();
        let max = 0;
        for (const r of q.data) {
            daySet.add(r.day);
            if (!techMap.has(r.technician_name)) techMap.set(r.technician_name, new Map());
            techMap.get(r.technician_name)?.set(r.day, Number(r.jobs_touched));
            if (Number(r.jobs_touched) > max) max = Number(r.jobs_touched);
        }
        return { days: Array.from(daySet).sort(), max, techMap };
    }, [q.data]);

    function handlePdfExport() {
        try {
            const rows = Array.from(techMap.entries()).map(([name, dayMap]) => ({
                name,
                ...Object.fromEntries(days.map(d => [d, dayMap.get(d) ?? 0])),
            }));
            exportReportPdf({
                columns: [
                    { dataKey: "name", header: "Technician", width: 50 },
                    ...days.map(d => ({ align: "right" as const, dataKey: d, header: formatDateShort(d), width: 22 })),
                ],
                fileName:    `tech-productivity_${rangeArgs.from}_${rangeArgs.to}`,
                orientation: "landscape",
                rows,
                title: "Technician Productivity",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            const rows = Array.from(techMap.entries()).map(([name, dayMap]) => {
                const row: Record<string, number | string> = { Technician: name };
                for (const d of days) row[d] = dayMap.get(d) ?? 0;
                return row;
            });
            exportReportXlsx({
                fileName: `tech-productivity_${rangeArgs.from}_${rangeArgs.to}`,
                sheets:   [{ name: "Productivity", rows }],
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
                subtitle="Heatmap of jobs touched per day per technician"
                title="Technician Productivity Heatmap"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Color intensity = jobs touched" title="Heatmap">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty />
                        : (
                            <div className="overflow-x-auto">
                                <table className="text-xs">
                                    <thead>
                                        <tr className="border-b border-(--cl-border) text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                                            <th className="px-3 py-2 text-left">Technician</th>
                                            {days.map(d => (
                                                <th key={d} className="px-1 py-2 text-center" style={{ minWidth: 36 }}>{d.slice(8)}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-divider)">
                                        {Array.from(techMap.entries()).map(([name, dayMap]) => (
                                            <tr key={name}>
                                                <td className="px-3 py-2 text-(--cl-text)">{name}</td>
                                                {days.map(d => {
                                                    const v = dayMap.get(d) ?? 0;
                                                    return (
                                                        <td key={d} className={cn("px-1 py-2 text-center", heatColor(v, max))} style={{ minWidth: 36 }}>
                                                            {v || ""}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                }
            </ChartCard>
        </ReportSection>
    );
};
