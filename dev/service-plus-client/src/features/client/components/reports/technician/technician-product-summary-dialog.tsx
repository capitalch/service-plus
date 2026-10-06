import { useEffect, useState } from "react";
import { Package } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { cn } from "@/lib/utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { formatNumber } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";

import { TechnicianProductCellDialog } from "./technician-product-cell-dialog";
import type { TechnicianProductCellType } from "./technician-product-cell-dialog";

/** First drill-down of Technician Report 2: one side (OOW or W) of a cell, a Total column / row cell
 *  or the grand total. technicianId null = all technicians. */
export type TechnicianProductSummaryCellType = {
	from: string;
	periodLabel: string;
	technicianId: number | null;
	technicianName: string | null;
	to: string;
	warranty: "oow" | "warranty";
};

type SplitRowType = {
	oow_count: number;
	oow_profit: number;
	oow_revenue: number;
	product_name: string;
	technician_id: number;
	warranty_count: number;
	warranty_profit: number;
	warranty_revenue: number;
};

type ProductRowType = { product: string; profit: number; qty: number; revenue: number };

type Props = {
	cell: TechnicianProductSummaryCellType | null;
	onClose: () => void;
};

/** Sums one warranty side per product, busiest product first. */
function toProductRows(
	rows: SplitRowType[],
	technicianId: number | null,
	warranty: TechnicianProductSummaryCellType["warranty"],
): ProductRowType[] {
	const byProduct = new Map<string, ProductRowType>();
	for (const r of rows) {
		if (technicianId != null && Number(r.technician_id) !== technicianId) continue;
		const qty = Number(warranty === "warranty" ? r.warranty_count : r.oow_count);
		if (qty === 0) continue;
		const profit = Number(warranty === "warranty" ? r.warranty_profit : r.oow_profit);
		const revenue = Number(warranty === "warranty" ? r.warranty_revenue : r.oow_revenue);
		const existing = byProduct.get(r.product_name);
		if (existing) {
			existing.profit += profit;
			existing.qty += qty;
			existing.revenue += revenue;
		} else {
			byProduct.set(r.product_name, { product: r.product_name, profit, qty, revenue });
		}
	}
	return Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty || a.product.localeCompare(b.product));
}

export const TechnicianProductSummaryDialog = ({ cell, onClose }: Props) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [rows, setRows] = useState<ProductRowType[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [jobsCell, setJobsCell] = useState<TechnicianProductCellType | null>(null);

	const isWarranty = cell?.warranty === "warranty";

	const columns: ReportColumnType<ProductRowType>[] = [
		{
			cell: (r) => <span className="font-medium text-(--cl-accent) hover:underline">{r.product}</span>,
			header: "Product",
			id: "product",
			value: (r) => r.product,
		},
		{
			align: "right",
			cell: (r) => (
				<span
					className={cn(
						"font-bold",
						isWarranty ? "text-orange-700 dark:text-orange-300" : "text-blue-600 dark:text-blue-400",
					)}
				>
					{formatNumber(r.qty)}
				</span>
			),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + r.qty, 0)),
			header: "Qty",
			id: "qty",
			value: (r) => r.qty,
			width: "90px",
		},
		{
			align: "right",
			cell: (r) => (
				<span className="font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(r.profit)}</span>
			),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + r.profit, 0)),
			header: "Profit",
			id: "profit",
			value: (r) => r.profit,
			width: "120px",
		},
		{
			align: "right",
			cell: (r) => <span className="text-amber-600 dark:text-amber-400">{formatNumber(r.revenue)}</span>,
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + r.revenue, 0)),
			header: "Revenue",
			id: "revenue",
			value: (r) => r.revenue,
			width: "120px",
		},
	];

	useEffect(() => {
		if (!cell || !dbName || !schema) return;
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setError(null);

		// Report 3's split query in Delivered mode counts exactly what Report 2 counts (every job
		// delivered OK, active technicians), so its per-product figures add up to the clicked cell.
		apolloClient
			.query<{ genericQuery: SplitRowType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { from: cell.from, mode: "delivered", to: cell.to },
						sqlId: SQL_MAP.GET_TECHNICIAN_REPORTS_PRODUCT_SPLIT,
					}),
				},
			})
			.then((res) => {
				if (cancelled) return;
				setRows(toProductRows(res.data?.genericQuery ?? [], cell.technicianId, cell.warranty));
			})
			.catch((err) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : MESSAGES.ERROR_REPORTS_FETCH_FAILED);
				setRows([]);
			})
			.finally(() => {
				if (cancelled) return;
				setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [cell, dbName, schema]);

	function openJobs(r: ProductRowType) {
		if (!cell) return;
		setJobsCell({
			from: cell.from,
			mode: "delivered",
			periodLabel: cell.periodLabel,
			productName: r.product,
			technicianId: cell.technicianId,
			technicianName: cell.technicianName,
			to: cell.to,
			warranty: cell.warranty,
		});
	}

	return (
		<>
			<Dialog
				onOpenChange={(v) => {
					if (!v) onClose();
				}}
				open={cell != null}
			>
				{/* Hidden (not unmounted) while the job-details dialog is open on top — see
				    TechnicianCellDialog for why the overlay is hidden separately. */}
				<DialogContent
					className={cn("sm:max-w-2xl", jobsCell != null && "invisible")}
					overlayClassName={cn(jobsCell != null && "invisible")}
				>
					<DialogHeader>
						<DialogTitle className="flex flex-wrap items-center gap-2">
							<Package className="h-4 w-4 text-green-600" />
							<span>{cell?.technicianName ?? "All technicians"}</span>
							<span className="text-(--cl-text-muted)">·</span>
							<span
								className={
									isWarranty
										? "text-orange-700 dark:text-orange-300"
										: "text-blue-600 dark:text-blue-400"
								}
							>
								{isWarranty ? "Warranty" : "Out of warranty"}
							</span>
						</DialogTitle>
						<DialogDescription>
							{cell ? `${MESSAGES.INFO_TECH_REPORT2_PRODUCT_DRILL} — ${cell.periodLabel}.` : ""}
						</DialogDescription>
					</DialogHeader>

					<div className="min-w-0">
						{loading && <ReportLoading lines={3} />}
						{!loading && error && <ReportError message={error} />}
						{!loading && !error && rows.length === 0 && (
							<ReportEmpty message={MESSAGES.INFO_REPORTS_NO_DATA} />
						)}
						{!loading && !error && rows.length > 0 && (
							<ReportTable
								columns={columns}
								maxHeight="60vh"
								rowKey={(r) => r.product}
								rows={rows}
								showFooter
								showRowIndex
								stickyHeader={false}
								onRowClick={openJobs}
							/>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<TechnicianProductCellDialog cell={jobsCell} onClose={() => setJobsCell(null)} />
		</>
	);
};
