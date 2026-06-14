import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { ChartCard } from "../_common/chart-card";
import { formatNumber } from "../_common/formatters";
import { ReportEmpty } from "../_common/report-empty";
import { ReportError } from "../_common/report-error";
import { ReportLoading } from "../_common/report-loading";
import { ReportSection } from "../_common/report-section";
import { ReportToolbar } from "../_common/report-toolbar";
import { exportReportPdf } from "../_common/pdf-export";
import { exportReportXlsx } from "../_common/xlsx-export";
import { useGenericQuery } from "../_common/use-generic-query";

type RowType = {
    bucket_0: number;
    bucket_1_3: number;
    bucket_4_7: number;
    bucket_8_15: number;
    bucket_16_30: number;
    bucket_over_30: number;
    status_code: string;
    status_name: string;
    total_count: number;
};

const BUCKET_HEADERS = [
    { key: "bucket_0",       label: "<24h" },
    { key: "bucket_1_3",     label: "1-3d" },
    { key: "bucket_4_7",     label: "4-7d" },
    { key: "bucket_8_15",    label: "8-15d" },
    { key: "bucket_16_30",   label: "16-30d" },
    { key: "bucket_over_30", label: ">30d" },
] as const;

function heatColor(value: number, max: number): string {
    if (value === 0 || max === 0) return "bg-(--cl-surface-3) text-(--cl-text-muted)";
    const r = value / max;
    if (r > 0.66) return "bg-amber-500/80 text-white font-bold";
    if (r > 0.33) return "bg-amber-300/50 text-(--cl-text)";
    return "bg-(--cl-accent)/15 text-(--cl-text)";
}

export const JobPipelineAgingSection = () => {
    const q = useGenericQuery<RowType>({
        sqlId: SQL_MAP.GET_JOB_PIPELINE_BY_STATUS_AGE,
    });

    const max = Math.max(0, ...q.data.flatMap(r => [
        Number(r.bucket_0), Number(r.bucket_1_3), Number(r.bucket_4_7),
        Number(r.bucket_8_15), Number(r.bucket_16_30), Number(r.bucket_over_30),
    ]));

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "status", header: "Status", width: 50 },
                    ...BUCKET_HEADERS.map(b => ({ align: "right" as const, dataKey: b.key, header: b.label, width: 22 })),
                    { align: "right" as const, dataKey: "total", header: "Total", width: 22 },
                ],
                fileName:    "job-pipeline-aging",
                orientation: "landscape",
                rows: q.data.map(r => ({
                    bucket_0:       formatNumber(Number(r.bucket_0)),
                    bucket_16_30:   formatNumber(Number(r.bucket_16_30)),
                    bucket_1_3:     formatNumber(Number(r.bucket_1_3)),
                    bucket_4_7:     formatNumber(Number(r.bucket_4_7)),
                    bucket_8_15:    formatNumber(Number(r.bucket_8_15)),
                    bucket_over_30: formatNumber(Number(r.bucket_over_30)),
                    status:         r.status_name,
                    total:          formatNumber(Number(r.total_count)),
                })),
                subtitle: "Open jobs by status × age bucket",
                title:    "Job Pipeline / Aging",
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "job-pipeline-aging",
                sheets: [{
                    name: "Pipeline Aging",
                    rows: q.data.map(r => ({
                        "1-3d":   Number(r.bucket_1_3),
                        "16-30d": Number(r.bucket_16_30),
                        "4-7d":   Number(r.bucket_4_7),
                        "8-15d":  Number(r.bucket_8_15),
                        "<24h":   Number(r.bucket_0),
                        ">30d":   Number(r.bucket_over_30),
                        "Status": r.status_name,
                        "Total":  Number(r.total_count),
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
                subtitle="Open jobs across statuses and age buckets — heatmap intensity by count"
                title="Job Pipeline / Aging"
            />

            {q.error && <ReportError onRetry={q.refetch} />}

            <ChartCard description="Click a cell to drill (coming soon)" title="Pipeline Heatmap">
                {q.loading
                    ? <ReportLoading lines={4} />
                    : q.data.length === 0
                        ? <ReportEmpty message="No open jobs." />
                        : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-(--cl-border) text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                                            <th className="px-3 py-2 text-left">Status</th>
                                            {BUCKET_HEADERS.map(b => (
                                                <th key={b.key} className="px-3 py-2 text-center">{b.label}</th>
                                            ))}
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-divider)">
                                        {q.data.map(row => (
                                            <tr key={row.status_code}>
                                                <td className="px-3 py-2 text-(--cl-text)">{row.status_name}</td>
                                                {BUCKET_HEADERS.map(b => {
                                                    const v = Number(row[b.key as keyof RowType] ?? 0);
                                                    return (
                                                        <td key={b.key} className={cn("px-3 py-2 text-center", heatColor(v, max))}>
                                                            {v}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-2 text-right font-bold text-(--cl-accent-text)">
                                                    {formatNumber(Number(row.total_count))}
                                                </td>
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
