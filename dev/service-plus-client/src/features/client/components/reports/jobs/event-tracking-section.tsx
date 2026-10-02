import { useState } from "react";
import { toast } from "sonner";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

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
import { EventTrackingCellDialog } from "./event-tracking-cell-dialog";
import type { EventTrackingCellType } from "./event-tracking-cell-dialog";

const TITLE = "Event Tracking";
const DESCRIPTION = "Job lifecycle event counts across standard fiscal date ranges.";

type BucketColumnDefType = { field: keyof Omit<EventTrackingRowType, "eventName">; group: string; header: string };

// Grid shows a Day / Week / Month / Quarter / Year group row over these short headers.
const BUCKET_COLUMNS: BucketColumnDefType[] = [
	{ field: "today", group: "Day", header: "Today" },
	{ field: "yesterday", group: "Day", header: "-1" },
	{ field: "dayBeforeYesterday", group: "Day", header: "-2" },
	{ field: "threeDaysAgo", group: "Day", header: "-3" },
	{ field: "thisWeek", group: "Week", header: "This" },
	{ field: "lastWeek", group: "Week", header: "-1" },
	{ field: "twoWeeksAgo", group: "Week", header: "-2" },
	{ field: "threeWeeksAgo", group: "Week", header: "-3" },
	{ field: "thisMonth", group: "Month", header: "This" },
	{ field: "lastMonth", group: "Month", header: "-1" },
	{ field: "twoMonthsAgo", group: "Month", header: "-2" },
	{ field: "threeMonthsAgo", group: "Month", header: "-3" },
	{ field: "thisQuarter", group: "Quarter", header: "This" },
	{ field: "lastQuarter", group: "Quarter", header: "-1" },
	{ field: "twoQuartersAgo", group: "Quarter", header: "-2" },
	{ field: "threeQuartersAgo", group: "Quarter", header: "-3" },
	{ field: "thisYear", group: "Year", header: "This" },
	{ field: "lastYear", group: "Year", header: "-1" },
	{ field: "twoYearsAgo", group: "Year", header: "-2" },
	{ field: "threeYearsAgo", group: "Year", header: "-3" },
];

// Flat name for places with a single header row (PDF, Excel, drill-down title):
// "Today", "This Week", "Week -1".
function exportHeader(b: BucketColumnDefType): string {
	if (b.header === "Today") return b.header;
	if (b.header === "This") return `This ${b.group}`;
	return `${b.group} ${b.header}`;
}

export const EventTrackingSection = () => {
	const { fyStartMonth, isReady } = useFiscalSetting();

	const matrix = useEventTrackingMatrix(SQL_MAP.GET_EVENT_TRACKING_COUNTS, fyStartMonth, isReady);

	const [cell, setCell] = useState<EventTrackingCellType | null>(null);

	const columns: ReportColumnType<EventTrackingRowType>[] = [
		{
			header: "Event",
			id: "eventName",
			value: (r) => r.eventName,
			width: "160px",
		},
		...BUCKET_COLUMNS.map<ReportColumnType<EventTrackingRowType>>((b) => ({
			align: "right",
			cell: (r) => {
				const count = r[b.field];
				if (count === 0) return formatNumber(count);
				const range = matrix.bucketRanges[b.field];
				return (
					<button
						className={cn(
							"cursor-pointer font-semibold text-(--cl-accent-text) hover:underline",
							!range && "pointer-events-none",
						)}
						disabled={!range}
						type="button"
						onClick={() =>
							range &&
							setCell({
								bucketLabel: exportHeader(b),
								eventName: r.eventName,
								from: range.from,
								to: range.to,
							})
						}
					>
						{formatNumber(count)}
					</button>
				);
			},
			footer: (rows) => formatNumber(rows.reduce((s, r) => s + r[b.field], 0)),
			group: b.group,
			header: b.header,
			headerTitle: matrix.bucketTitles[b.field],
			id: b.field,
			value: (r) => r[b.field],
		})),
	];

	function handlePdfExport() {
		try {
			exportReportPdf({
				columns: [
					{ dataKey: "eventName", header: "Event", width: 30 },
					...BUCKET_COLUMNS.map((b) => ({
						align: "right" as const,
						dataKey: b.field,
						header: exportHeader(b),
						// 20 buckets × 12 + 30 = 270 mm, inside A4 landscape's 273 mm print width.
						width: 12,
					})),
				],
				fileName: "event-tracking",
				meta: [{ label: "Generated for", value: TITLE }],
				orientation: "landscape",
				rows: matrix.rows.map((r) => {
					const row: Record<string, number | string> = { eventName: r.eventName };
					BUCKET_COLUMNS.forEach((b) => {
						row[b.field] = formatNumber(r[b.field]);
					});
					return row;
				}),
				title: TITLE,
				totalsRow: (() => {
					const row: Record<string, number | string> = { eventName: "TOTAL" };
					BUCKET_COLUMNS.forEach((b) => {
						row[b.field] = formatNumber(matrix.rows.reduce((s, r) => s + r[b.field], 0));
					});
					return row;
				})(),
			});
			toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
		} catch {
			toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
		}
	}

	function handleXlsxExport() {
		try {
			exportReportXlsx({
				fileName: "event-tracking",
				sheets: [
					{
						name: TITLE.slice(0, 28),
						rows: matrix.rows.map((r) => {
							const row: Record<string, number | string> = { Event: r.eventName };
							BUCKET_COLUMNS.forEach((b) => {
								row[exportHeader(b)] = r[b.field];
							});
							return row;
						}),
					},
				],
			});
			toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
		} catch {
			toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
		}
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

			<ChartCard description="Received, Status Change, Finalize, and Deliver — Return/Cancel/Disposed are not tracked. Click a count to view its jobs.">
				{matrix.loading ? (
					<ReportLoading lines={4} />
				) : (
					<ReportTable
						cellBorders
						columns={columns}
						rowKey={(r) => r.eventName}
						rows={matrix.rows}
						showFooter
						stickyHeader={false}
					/>
				)}
			</ChartCard>

			<EventTrackingCellDialog cell={cell} onClose={() => setCell(null)} />
		</ReportSection>
	);
};
