import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";

import { ChartCard } from "../common/chart-card";
import { formatNumber } from "../common/formatters";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { ReportToolbar } from "../common/report-toolbar";
import { exportReportPdf } from "../common/pdf-export";
import { exportReportXlsx } from "../common/xlsx-export";
import type { EventTrackingRowType } from "../common/use-event-tracking-matrix";
import { useEventTrackingMatrix } from "../common/use-event-tracking-matrix";
import { useFiscalSetting } from "../common/use-fiscal-setting";

const TITLE = "Event Tracking";
const DESCRIPTION = "Job lifecycle event counts across standard fiscal date ranges.";

type BucketColumnDefType = { field: keyof Omit<EventTrackingRowType, "eventName">; header: string };

const BUCKET_COLUMNS: BucketColumnDefType[] = [
    { field: "today",              header: "Today" },
    { field: "yesterday",          header: "Yesterday" },
    { field: "dayBeforeYesterday", header: "Day Before" },
    { field: "thisWeek",           header: "This Week" },
    { field: "lastWeek",           header: "Last Week" },
    { field: "thisMonth",          header: "This Month" },
    { field: "lastMonth",          header: "Last Month" },
    { field: "thisQuarter",        header: "This Quarter" },
    { field: "lastQuarter",        header: "Last Quarter" },
    { field: "thisYear",           header: "This Year" },
    { field: "lastYear",           header: "Last Year" },
];

export const EventTrackingSection = () => {
    const { fyStartMonth, isReady } = useFiscalSetting();

    const matrix = useEventTrackingMatrix(SQL_MAP.GET_EVENT_TRACKING_COUNTS, fyStartMonth, isReady);

    const columns: ReportColumnType<EventTrackingRowType>[] = [
        {
            header: "Event",
            id:     "eventName",
            value:  r => r.eventName,
            width:  "160px",
        },
        ...BUCKET_COLUMNS.map<ReportColumnType<EventTrackingRowType>>(b => ({
            align:  "right",
            cell:   r => formatNumber(r[b.field]),
            footer: rows => formatNumber(rows.reduce((s, r) => s + r[b.field], 0)),
            header: b.header,
            id:     b.field,
            value:  r => r[b.field],
        })),
    ];

    function handlePdfExport() {
        try {
            exportReportPdf({
                columns: [
                    { dataKey: "eventName", header: "Event", width: 32 },
                    ...BUCKET_COLUMNS.map(b => ({ align: "right" as const, dataKey: b.field, header: b.header, width: 18 })),
                ],
                fileName:    "event-tracking",
                meta:        [{ label: "Generated for", value: TITLE }],
                orientation: "landscape",
                rows: matrix.rows.map(r => {
                    const row: Record<string, number | string> = { eventName: r.eventName };
                    BUCKET_COLUMNS.forEach(b => { row[b.field] = formatNumber(r[b.field]); });
                    return row;
                }),
                title: TITLE,
                totalsRow: (() => {
                    const row: Record<string, number | string> = { eventName: "TOTAL" };
                    BUCKET_COLUMNS.forEach(b => { row[b.field] = formatNumber(matrix.rows.reduce((s, r) => s + r[b.field], 0)); });
                    return row;
                })(),
            });
            toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
        } catch { toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED); }
    }

    function handleXlsxExport() {
        try {
            exportReportXlsx({
                fileName: "event-tracking",
                sheets: [{
                    name: TITLE.slice(0, 28),
                    rows: matrix.rows.map(r => {
                        const row: Record<string, number | string> = { Event: r.eventName };
                        BUCKET_COLUMNS.forEach(b => { row[b.header] = r[b.field]; });
                        return row;
                    }),
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
                subtitle={DESCRIPTION}
                title={TITLE}
            />

            {matrix.error && <ReportError onRetry={matrix.refetch} />}

            <ChartCard description="Received, Status Change, Finalize, and Deliver — Return/Cancel/Disposed are not tracked" title={TITLE}>
                {matrix.loading
                    ? <ReportLoading lines={4} />
                    : (
                        <ReportTable
                            columns={columns}
                            rowKey={r => r.eventName}
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
