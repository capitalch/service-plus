import { Activity } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SQL_MAP } from "@/constants/sql-map";
import { cn } from "@/lib/utils";

import { formatNumber } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { useGenericQuery } from "../common/use-generic-query";

type OpenJobsByProductRowType = {
	oow_count: number;
	product_name: string;
	total_count: number;
	warranty_count: number;
};

export type OpenJobsDrillDownType = {
	isWarranty: boolean | null;
	label: string;
	productName: string;
};

type Props = {
	/** True while a drill-down dialog opened from this one is showing on top of it. */
	nestedDialogOpen?: boolean;
	onClose: () => void;
	onDrillDown: (drillDown: OpenJobsDrillDownType) => void;
	open: boolean;
};

function drillDownCell(count: number, onClick: () => void, className?: string) {
	return (
		<button
			className={cn(
				"w-full border-0 bg-transparent p-0 text-right align-middle",
				count > 0 && "cursor-pointer rounded hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset",
				className,
			)}
			disabled={count === 0}
			type="button"
			onClick={count > 0 ? onClick : undefined}
		>
			{formatNumber(count)}
		</button>
	);
}

function makeColumns(
	onDrillDown: (drillDown: OpenJobsDrillDownType) => void,
): ReportColumnType<OpenJobsByProductRowType>[] {
	return [
		{ header: "Product", id: "product_name", value: (r) => r.product_name },
		{
			align: "right",
			cell: (r) =>
				drillDownCell(r.warranty_count, () =>
					onDrillDown({
						isWarranty: true,
						label: `${r.product_name} · Warranty`,
						productName: r.product_name,
					}),
				),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + r.warranty_count, 0)),
			header: "W",
			id: "warranty_count",
			value: (r) => r.warranty_count,
			width: "90px",
		},
		{
			align: "right",
			cell: (r) =>
				drillDownCell(r.oow_count, () =>
					onDrillDown({
						isWarranty: false,
						label: `${r.product_name} · Out-of-Warranty`,
						productName: r.product_name,
					}),
				),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + r.oow_count, 0)),
			header: "OOW",
			id: "oow_count",
			value: (r) => r.oow_count,
			width: "90px",
		},
		{
			align: "right",
			cell: (r) =>
				drillDownCell(
					r.total_count,
					() => onDrillDown({ isWarranty: null, label: r.product_name, productName: r.product_name }),
					"font-semibold text-(--cl-text)",
				),
			footer: (rs) => (
				<span className="font-extrabold">{formatNumber(rs.reduce((s, r) => s + r.total_count, 0))}</span>
			),
			header: "Total",
			id: "total_count",
			value: (r) => r.total_count,
			width: "90px",
		},
	];
}

export const OpenJobsByProductDialog = ({ nestedDialogOpen, onClose, onDrillDown, open }: Props) => {
	const { data, error, loading } = useGenericQuery<OpenJobsByProductRowType>({
		enabled: open,
		sqlId: SQL_MAP.GET_DASHBOARD_OPEN_JOBS_BY_PRODUCT,
	});

	return (
		<Dialog
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
			open={open}
		>
			<DialogContent
				className={cn("sm:max-w-lg", nestedDialogOpen && "invisible")}
				overlayClassName={cn(nestedDialogOpen && "invisible")}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Activity className="h-4 w-4 text-(--cl-accent-text)" />
						<span>Open Jobs by Product</span>
					</DialogTitle>
					<DialogDescription>
						Warranty (W) vs Out-of-Warranty (OOW) counts for currently open jobs, by product. Click a count
						to see the jobs behind it.
					</DialogDescription>
				</DialogHeader>

				<div className="min-w-0">
					{loading && <ReportLoading lines={3} />}
					{!loading && error && <ReportError message={error.message} />}
					{!loading && !error && data.length === 0 && <ReportEmpty message="No open jobs." />}
					{!loading && !error && data.length > 0 && (
						<ReportTable
							columns={makeColumns(onDrillDown)}
							maxHeight="60vh"
							rowKey={(r) => r.product_name}
							rows={data}
							showFooter
							showRowIndex
							stickyHeader={false}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
