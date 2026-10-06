import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { JobFinalInfoModal } from "../../jobs/final-a-job/job-final-info-modal";

import { formatNumber } from "../common/formatters";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportTable } from "../common/report-table";
import type { ReportColumnType } from "../common/report-table";
import { SerialNoLine, serialNoText } from "@/features/client/components/shared/device-cell";

/** One clicked cell of Technician Report 3. technicianId / productName are null for the Total
 *  column / Total row (and both for the grand total); the rest repeats the report's filters. */
export type TechnicianProductCellType = {
	from: string;
	mode: "delivered" | "repaired";
	periodLabel: string;
	productName: string | null;
	technicianId: number | null;
	technicianName: string | null;
	to: string;
	warranty: "all" | "oow" | "warranty";
};

type CellJobType = {
	brand_name: string | null;
	customer_name: string;
	division_code: string | null;
	event_date: string;
	id: number;
	is_warranty: boolean;
	job_no: string;
	model_name: string | null;
	product_name: string;
	profit: number;
	revenue: number;
	serial_no: string | null;
	technician_name: string;
	total_cost: number;
};

type Props = {
	cell: TechnicianProductCellType | null;
	onClose: () => void;
};

const WARRANTY_TEXT: Record<TechnicianProductCellType["warranty"], string> = {
	all: "",
	oow: "out of warranty",
	warranty: "under warranty",
};

export const TechnicianProductCellDialog = ({ cell, onClose }: Props) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [rows, setRows] = useState<CellJobType[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [finalInfoJobId, setFinalInfoJobId] = useState<number | null>(null);
	// Rows ticked with the checkbox column, for adding up a hand-picked set of jobs. A row click
	// elsewhere still opens Job Final Info.
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	function toggleSelected(id: number) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	const isRepaired = cell?.mode === "repaired";

	const columns: ReportColumnType<CellJobType>[] = [
		{
			// stopPropagation keeps the tick from also opening Job Final Info via the row click.
			cell: (r) => (
				<span className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
					{/* Larger and higher-contrast than the default checkbox: a thick border on a white box,
					    filled with the accent blue and a white tick once selected. */}
					<Checkbox
						aria-label={`Select job ${r.job_no}`}
						className="size-5 cursor-pointer rounded-[5px] border-2 border-slate-400 bg-white shadow-sm hover:border-(--cl-accent) data-checked:border-(--cl-accent) data-checked:bg-(--cl-accent) dark:border-slate-500 dark:bg-zinc-900 dark:data-checked:bg-(--cl-accent) [&_svg]:size-4 [&_svg]:text-white"
						checked={selectedIds.has(r.id)}
						onCheckedChange={() => toggleSelected(r.id)}
					/>
				</span>
			),
			header: "",
			id: "select",
			width: "40px",
		},
		{
			header: isRepaired ? "Repaired On" : "Delivery Date",
			id: "event_date",
			value: (r) => r.event_date,
			width: "110px",
		},
		{
			cell: (r) => (
				<div className="flex flex-col gap-0.5">
					<span className="font-mono text-xs font-semibold text-(--cl-accent) hover:underline">
						{r.job_no}
					</span>
					{r.division_code && (
						<span className="text-[9px] font-medium tracking-tight text-indigo-600 uppercase dark:text-indigo-400">
							{r.division_code}
						</span>
					)}
				</div>
			),
			header: "Job No",
			id: "job_no",
			value: (r) => r.job_no,
			width: "120px",
		},
		{ header: "Customer", id: "customer", value: (r) => r.customer_name },
		// Only for a Total-column / grand-total cell, where the jobs span technicians.
		...(cell?.technicianId == null
			? [{ header: "Technician", id: "technician", value: (r: CellJobType) => r.technician_name }]
			: []),
		{
			cell: (r) => (
				<div className="flex flex-col">
					<span>{r.product_name}</span>
					<span className="text-[10px] text-(--cl-text-muted)">
						{[r.brand_name, r.model_name].filter(Boolean).join(" • ")}
					</span>
					<SerialNoLine serialNo={r.serial_no} />
				</div>
			),
			header: "Device",
			id: "device",
			value: (r) =>
`${r.product_name} ${r.brand_name ?? ""} ${r.model_name ?? ""} ${serialNoText(r.serial_no)}`.trim(),
		},
		// Always shown, even when the list is one side only, so each job states its type.
		{
			cell: (r) => (
				<span
					className={cn(
						"inline-flex h-4 w-9 items-center justify-center rounded-sm text-[9px] font-bold ring-1 ring-inset",
						r.is_warranty
							? "bg-orange-500/12 text-orange-700 ring-orange-500/30 dark:text-orange-300"
							: "bg-slate-500/12 text-slate-700 ring-slate-500/25 dark:text-slate-200",
					)}
				>
					{r.is_warranty ? "W" : "OOW"}
				</span>
			),
			header: "Type",
			id: "type",
			value: (r) => (r.is_warranty ? "W" : "OOW"),
			width: "70px",
		},
		{
			align: "right",
			cell: (r) => formatNumber(Number(r.total_cost)),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + Number(r.total_cost), 0)),
			header: "Cost",
			id: "total_cost",
			value: (r) => Number(r.total_cost),
			width: "100px",
		},
		{
			align: "right",
			cell: (r) => <span className="text-amber-700 dark:text-amber-400">{formatNumber(Number(r.revenue))}</span>,
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + Number(r.revenue), 0)),
			header: "Revenue",
			id: "revenue",
			value: (r) => Number(r.revenue),
			width: "110px",
		},
		{
			align: "right",
			cell: (r) => (
				<span className="font-bold text-emerald-700 dark:text-emerald-400">
					{formatNumber(Number(r.profit))}
				</span>
			),
			footer: (rs) => formatNumber(rs.reduce((s, r) => s + Number(r.profit), 0)),
			header: "Profit",
			id: "profit",
			value: (r) => Number(r.profit),
			width: "110px",
		},
	];

	useEffect(() => {
		if (!cell || !dbName || !schema) return;
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setSelectedIds(new Set());
		setError(null);

		apolloClient
			.query<{ genericQuery: CellJobType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: {
							from: cell.from,
							mode: cell.mode,
							product_name: cell.productName,
							technician_id: cell.technicianId,
							to: cell.to,
							warranty: cell.warranty,
						},
						sqlId: SQL_MAP.GET_TECHNICIAN_REPORTS_PRODUCT_JOBS,
					}),
				},
			})
			.then((res) => {
				if (cancelled) return;
				setRows(res.data?.genericQuery ?? []);
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

	const technicianText = cell?.technicianName ?? "All technicians";
	const productText = cell?.productName ?? "All products";
	const jobsText = isRepaired ? "Repaired jobs" : "Delivered-OK jobs";
	const warrantyText = cell ? WARRANTY_TEXT[cell.warranty] : "";

	return (
		<>
			<Dialog
				onOpenChange={(v) => {
					if (!v) onClose();
				}}
				open={cell != null}
			>
				{/* Hidden (not unmounted) while the nested Job Final Info modal is open — see
				    TechnicianCellDialog for why the overlay is hidden separately. */}
				<DialogContent
					className={cn("sm:max-w-5xl", finalInfoJobId != null && "invisible")}
					overlayClassName={cn(finalInfoJobId != null && "invisible")}
				>
					<DialogHeader>
						<DialogTitle className="flex flex-wrap items-center gap-2">
							<LayoutGrid className="h-4 w-4 text-green-600" />
							<span>{technicianText}</span>
							<span className="text-(--cl-text-muted)">·</span>
							<span className="text-(--cl-accent-text)">{productText}</span>
						</DialogTitle>
						<DialogDescription>
							{cell ? `${jobsText}${warrantyText ? `, ${warrantyText}` : ""} — ${cell.periodLabel}.` : ""}
						</DialogDescription>
					</DialogHeader>

					<div className="min-w-0">
						{loading && <ReportLoading lines={3} />}
						{!loading && error && <ReportError message={error} />}
						{!loading && !error && rows.length === 0 && (
							<ReportEmpty message={MESSAGES.INFO_REPORTS_NO_DATA} />
						)}
						{!loading && !error && rows.length > 0 && (
							<>
								<SelectionBar
									onClear={() => setSelectedIds(new Set())}
									onSelectAll={() => setSelectedIds(new Set(rows.map((r) => r.id)))}
									rows={rows}
									selectedIds={selectedIds}
								/>
								<ReportTable
									columns={columns}
									maxHeight="60vh"
									rowKey={(r) => r.id}
									rows={rows}
									showFooter
									showRowIndex
									stickyHeader={false}
									onRowClick={(r) => setFinalInfoJobId(r.id)}
									rowClassName={(r) => (selectedIds.has(r.id) ? "bg-(--cl-accent)/10" : undefined)}
								/>
							</>
						)}
					</div>
				</DialogContent>
			</Dialog>

			{finalInfoJobId != null && (
				<JobFinalInfoModal jobId={finalInfoJobId} onClose={() => setFinalInfoJobId(null)} />
			)}
		</>
	);
};

type SelectionBarPropsType = {
	onClear: () => void;
	onSelectAll: () => void;
	rows: CellJobType[];
	selectedIds: Set<number>;
};

/** Above the job list: the job count, or — once rows are ticked — how many, with their cost,
 *  revenue and profit added up, plus Select all / Clear. */
const SelectionBar = ({ onClear, onSelectAll, rows, selectedIds }: SelectionBarPropsType) => {
	const picked = rows.filter((r) => selectedIds.has(r.id));
	const sum = (key: "profit" | "revenue" | "total_cost") => picked.reduce((s, r) => s + Number(r[key]), 0);
	return (
		<div className="mb-2 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
			{picked.length === 0 ? (
				<span className="text-(--cl-text-muted)">
					{rows.length} job(s) — {MESSAGES.INFO_TECH_REPORTS_JOBS_SELECT_HINT}
				</span>
			) : (
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
					<span className="font-semibold text-(--cl-text)">
						{picked.length} of {rows.length} selected
					</span>
					<span className="text-(--cl-text-muted)">
						Cost <span className="font-semibold text-(--cl-text)">{formatNumber(sum("total_cost"))}</span>
					</span>
					<span className="text-(--cl-text-muted)">
						Revenue{" "}
						<span className="font-semibold text-amber-700 dark:text-amber-400">
							{formatNumber(sum("revenue"))}
						</span>
					</span>
					<span className="text-(--cl-text-muted)">
						Profit{" "}
						<span className="font-bold text-emerald-700 dark:text-emerald-400">
							{formatNumber(sum("profit"))}
						</span>
					</span>
				</span>
			)}
			<span className="ml-auto flex items-center gap-1.5">
				{picked.length < rows.length && (
					<Button className="h-7 text-xs" onClick={onSelectAll} size="sm" type="button" variant="outline">
						Select all
					</Button>
				)}
				{picked.length > 0 && (
					<Button className="h-7 text-xs" onClick={onClear} size="sm" type="button" variant="ghost">
						Clear
					</Button>
				)}
			</span>
		</div>
	);
};
