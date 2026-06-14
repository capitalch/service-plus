import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";

import { ChartCard } from "./chart-card";
import { formatInr, formatNumber } from "./formatters";
import { ReportError } from "./report-error";
import { ReportLoading } from "./report-loading";
import { ReportSection } from "./report-section";
import { ReportTable } from "./report-table";
import type { ReportColumnType } from "./report-table";
import { ReportToolbar } from "./report-toolbar";
import { exportReportPdf } from "./pdf-export";
import { exportReportXlsx } from "./xlsx-export";
import type { RangeBucketRowType } from "./use-range-matrix";
import { useFiscalSetting } from "./use-fiscal-setting";
import { useRangeMatrix } from "./use-range-matrix";

type Props = {
    description: string;
    fileSlug: string;
    sqlId: string;
    title: string;
    valueIsCurrency?: boolean;
};

export const RangeMatrixSection = ({ description, fileSlug, sqlId, title, valueIsCurrency = false }: Props) => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const matrix = useRangeMatrix(sqlId, fyStartMonth, isReady);

    const fmt = valueIsCurrency ? formatInr : formatNumber;

    const columns: ReportColumnType<RangeBucketRowType>[] = [
        {
            header: "Range",
            id:     "bucket",
            value:  r => r.bucket,
            width:  "180px",
        },
        {
            align:  "right",
            cell:   r => fmt(r.warranty_count),
            footer: rows => fmt(rows.reduce((s, r) => s + r.warranty_count, 0)),
            header: "Warranty",
            id:     "warranty",
            value:  r => r.warranty_count,
        },
        {
            align:  "right",
            cell:   r => fmt(r.oow_count),
            footer: rows => fmt(rows.reduce((s, r) => s + r.oow_count, 0)),
            header: "Out of Warranty",
            id:     "oow",
            value:  r => r.oow_count,
        },
        {
            align:  "right",
            cell:   r => <span className="font-bold text-(--cl-accent-text)">{fmt(r.total_count)}</span>,
            footer: rows => fmt(rows.reduce((s, r) => s + r.total_count, 0)),
            header: "Total",
            id:     "total",
            value:  r => r.total_count,
        },
    ];

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "bucket",   header: "Range",         width: 50 },
                    { align: "right", dataKey: "warranty", header: "Warranty", width: 40 },
                    { align: "right", dataKey: "oow",      header: "OOW",      width: 40 },
                    { align: "right", dataKey: "total",    header: "Total",    width: 40 },
                ],
                fileName:    fileSlug,
                meta:        [{ label: "Generated for", value: title }],
                orientation: "portrait",
                rows: matrix.rows.map(r => ({
                    bucket:   r.bucket,
                    oow:      fmt(r.oow_count),
                    total:    fmt(r.total_count),
                    warranty: fmt(r.warranty_count),
                })),
                title,
                totalsRow: {
                    bucket:   "TOTAL",
                    oow:      fmt(matrix.rows.reduce((s, r) => s + r.oow_count, 0)),
                    total:    fmt(matrix.rows.reduce((s, r) => s + r.total_count, 0)),
                    warranty: fmt(matrix.rows.reduce((s, r) => s + r.warranty_count, 0)),
                },
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: fileSlug,
                sheets: [{
                    name: title.slice(0, 28),
                    rows: matrix.rows.map(r => ({
                        "Out of Warranty": r.oow_count,
                        "Range":           r.bucket,
                        "Total":           r.total_count,
                        "Warranty":        r.warranty_count,
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
                onRefresh={matrix.refetch}
                subtitle={description}
                title={title}
            />

            {matrix.error && <ReportError onRetry={matrix.refetch} />}

            <ChartCard description="Standard date buckets — warranty vs out-of-warranty" title={title}>
                {matrix.loading
                    ? <ReportLoading lines={4} />
                    : (
                        <ReportTable
                            columns={columns}
                            rowKey={r => r.key}
                            rows={matrix.rows}
                            showFooter
                            stickyHeader={false}
                        />
                    )
                }
            </ChartCard>
        </ReportSection>
    );
};
