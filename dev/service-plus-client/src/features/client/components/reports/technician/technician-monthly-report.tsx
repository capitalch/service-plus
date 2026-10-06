import { useMemo, useState } from "react";

import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ChartCard } from "../common/chart-card";
import { formatNumber } from "../common/formatters";
import { formatIsoDate, getCurrentFiscalYearBounds } from "../common/fiscal";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";

import { TechnicianCellDialog } from "./technician-cell-dialog";
import { TechnicianProductSummaryDialog } from "./technician-product-summary-dialog";
import type { TechnicianProductSummaryCellType } from "./technician-product-summary-dialog";
import type { TechnicianCellType } from "./technician-cell-dialog";

type RowType = {
	delivered_count: number;
	month_idx: number;
	profit: number;
	technician_id: number;
	technician_name: string;
	total_charges: number;
	/** Only from GET_TECHNICIAN_REPORTS_MONTHLY_FY_WARRANTY (Report 2). */
	warranty_count?: number;
};

/** Report 1: count, profit and charges cover invoiced jobs only. Report 2: every job delivered OK,
 *  with warranty the UNDER_WARRANTY subset of count and profit / charges merged over both sides. */
type CellValueType = { charges: number; count: number; profit: number; warranty: number };

type SideType = "oow" | "warranty";

type TechnicianMonthlyReportPropsType = {
	/** Report 2: count every delivered job and show the OOW / W quantities, each drillable. */
	showWarranty: boolean;
	sqlId: string;
	subtitle: (fyLabel: string) => string;
	title: string;
};

type MonthColumnType = {
	idx: number;
	label: string;
	from: string;
	to: string;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FY_YEAR_OPTIONS_COUNT = 8;

function endOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

const EMPTY_CELL: CellValueType = { charges: 0, count: 0, profit: 0, warranty: 0 };

function addCells(a: CellValueType, b: CellValueType): CellValueType {
	return {
		charges: a.charges + b.charges,
		count: a.count + b.count,
		profit: a.profit + b.profit,
		warranty: a.warranty + b.warranty,
	};
}

/** The technician × month grid shared by Technician Report 1 and Technician Report 2 — same fiscal
 *  year picker, totals and drill-down; showWarranty switches the cell layout and the sql id passed in
 *  must return warranty_count. */
export const TechnicianMonthlyReport = ({ showWarranty, sqlId, subtitle, title }: TechnicianMonthlyReportPropsType) => {
	const { fyStartMonth, isReady } = useFiscalSetting();

	const currentFyBounds = useMemo(() => getCurrentFiscalYearBounds(new Date(), fyStartMonth), [fyStartMonth]);

	const [fyStartYear, setFyStartYear] = useState<number>(() => currentFyBounds.from.getFullYear());

	const yearOptions = useMemo(() => {
		const current = currentFyBounds.from.getFullYear();
		return Array.from({ length: FY_YEAR_OPTIONS_COUNT }, (_, i) => current - i);
	}, [currentFyBounds]);

	const fyBounds = useMemo(() => {
		const from = new Date(fyStartYear, fyStartMonth - 1, 1);
		return { from, label: `FY ${fyStartYear}-${(fyStartYear + 1) % 100}` };
	}, [fyStartYear, fyStartMonth]);

	const months = useMemo<MonthColumnType[]>(() => {
		return Array.from({ length: 12 }, (_, i) => {
			const monthStart = new Date(fyBounds.from.getFullYear(), fyBounds.from.getMonth() + i, 1);
			const monthEnd = endOfMonth(monthStart);
			return {
				from: formatIsoDate(monthStart),
				idx: i,
				label: `${MONTH_ABBR[monthStart.getMonth()]} '${String(monthStart.getFullYear()).slice(2)}`,
				to: formatIsoDate(monthEnd),
			};
		});
	}, [fyBounds]);

	const sqlArgs = useMemo(() => ({ from: formatIsoDate(fyBounds.from) }), [fyBounds]);

	const q = useGenericQuery<RowType>({
		enabled: isReady,
		sqlArgs,
		sqlId,
	});

	// Report 1: a click on the whole cell opens its invoiced job list.
	const [cell, setCell] = useState<TechnicianCellType | null>(null);
	// Report 2: a click on the OOW or W quantity opens that side product-wise (first drill-down),
	// whose rows open the job details (second drill-down). Works on Total cells too.
	const [summaryCell, setSummaryCell] = useState<TechnicianProductSummaryCellType | null>(null);

	function openCell(m: MonthColumnType, technicianId: number, technicianName: string) {
		setCell({ from: m.from, monthLabel: m.label, technicianId, technicianName, to: m.to });
	}

	function openSide(
		side: SideType,
		technician: { id: number; name: string } | null,
		period: { from: string; label: string; to: string },
	) {
		setSummaryCell({
			from: period.from,
			periodLabel: period.label,
			technicianId: technician?.id ?? null,
			technicianName: technician?.name ?? null,
			to: period.to,
			warranty: side,
		});
	}

	const { technicians, grid } = useMemo(() => {
		const grid = new Map<number, Map<number, CellValueType>>();
		const techNames = new Map<number, string>();
		for (const r of q.data) {
			techNames.set(r.technician_id, r.technician_name);
			if (!grid.has(r.technician_id)) grid.set(r.technician_id, new Map());
			grid.get(r.technician_id)?.set(r.month_idx, {
				charges: Number(r.total_charges),
				count: Number(r.delivered_count),
				profit: Number(r.profit),
				warranty: Number(r.warranty_count ?? 0),
			});
		}
		const technicians = Array.from(techNames.entries()).map(([id, name]) => ({ id, name }));
		return { grid, technicians };
	}, [q.data]);

	function cellFor(technicianId: number, monthIdx: number): CellValueType {
		return grid.get(technicianId)?.get(monthIdx) ?? EMPTY_CELL;
	}

	function rowTotal(technicianId: number): CellValueType {
		return months.reduce<CellValueType>((acc, m) => addCells(acc, cellFor(technicianId, m.idx)), EMPTY_CELL);
	}

	function monthTotal(monthIdx: number): CellValueType {
		return technicians.reduce<CellValueType>((acc, t) => addCells(acc, cellFor(t.id, monthIdx)), EMPTY_CELL);
	}

	const grandTotal = technicians.reduce<CellValueType>((acc, t) => addCells(acc, rowTotal(t.id)), EMPTY_CELL);

	// The whole fiscal year, for the Total column and the grand total.
	const fyPeriod = { from: months[0].from, label: fyBounds.label, to: months[11].to };

	function sideHandler(technician: { id: number; name: string } | null, period: typeof fyPeriod) {
		return showWarranty ? (side: SideType) => openSide(side, technician, period) : undefined;
	}

	return (
		<ReportSection>
			<ReportToolbar
				actions={
					<>
						{/* Report 2's colour key sits here, on the title line, so the grid needs no header band. */}
						{showWarranty && <WarrantyKey />}
						<Select value={String(fyStartYear)} onValueChange={(v) => setFyStartYear(Number(v))}>
							<SelectTrigger
								aria-label="Fiscal Year"
								className="h-8 w-32 text-xs"
								id={showWarranty ? "tr2-fy" : "tr1-fy"}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{yearOptions.map((y) => (
									<SelectItem key={y} value={String(y)}>{`FY ${y}-${(y + 1) % 100}`}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</>
				}
				hideRange
				onRefresh={q.refetch}
				subtitle={subtitle(fyBounds.label)}
				title={title}
			/>

			{q.error && <ReportError onRetry={q.refetch} />}

			<ChartCard title="">
				{q.loading ? (
					<ReportLoading lines={6} />
				) : technicians.length === 0 ? (
					<ReportEmpty message="No active technicians with delivered jobs this fiscal year." />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-(--cl-accent)/30 bg-(--cl-accent)/10 text-xs font-bold text-(--cl-accent-text)">
									<th className="px-3 py-2 text-left">Technician</th>
									{months.map((m) => (
										<th key={m.idx} className="px-2 py-2 text-center">
											{m.label}
										</th>
									))}
									<th className="px-3 py-2 text-center">Total</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-(--cl-divider)">
								{technicians.map((t, i) => {
									const total = rowTotal(t.id);
									return (
										<tr key={t.id} className={i % 2 === 1 ? "bg-(--cl-surface-2)/40" : undefined}>
											<td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-(--cl-text)">
												{t.name}
											</td>
											{months.map((m) => {
												const v = cellFor(t.id, m.idx);
												// Report 2 drills from the quantities instead (CellFigures onSideClick).
												const clickable = !showWarranty && v.count > 0;
												return (
													<td
														key={m.idx}
														className={cn(
															"px-2 py-2 text-center align-top",
															clickable &&
																"cursor-pointer hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset",
														)}
														onClick={
															clickable ? () => openCell(m, t.id, t.name) : undefined
														}
													>
														{v.count === 0 && v.warranty === 0 ? (
															<span className="text-(--cl-text-muted)">—</span>
														) : (
															<CellFigures
																onSideClick={sideHandler(t, m)}
																showWarranty={showWarranty}
																value={v}
															/>
														)}
													</td>
												);
											})}
											<td className="bg-(--cl-accent)/5 px-3 py-2 text-center align-top">
												<CellFigures
													onSideClick={sideHandler(t, fyPeriod)}
													showWarranty={showWarranty}
													value={total}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
							<tfoot className="border-t border-(--cl-accent)/30 bg-(--cl-accent)/15 font-bold">
								<tr>
									<td className="px-3 py-2 text-xs font-bold text-(--cl-text)">Total</td>
									{months.map((m) => {
										const v = monthTotal(m.idx);
										return (
											<td key={m.idx} className="px-2 py-2 text-center align-top">
												<CellFigures
													onSideClick={sideHandler(null, m)}
													quiet
													showWarranty={showWarranty}
													value={v}
												/>
											</td>
										);
									})}
									<td className="bg-(--cl-accent)/10 px-3 py-2 text-center align-top">
										<CellFigures
											onSideClick={sideHandler(null, fyPeriod)}
											quiet
											showWarranty={showWarranty}
											value={grandTotal}
										/>
									</td>
								</tr>
							</tfoot>
						</table>
					</div>
				)}
			</ChartCard>

			<TechnicianCellDialog cell={cell} onClose={() => setCell(null)} />
			<TechnicianProductSummaryDialog cell={summaryCell} onClose={() => setSummaryCell(null)} />
		</ReportSection>
	);
};

/** Report 2's colour key, on the toolbar's title line beside the FY picker: a cell's top line is two separate quantities, out of
 *  warranty (blue) then warranty (orange). */
const WarrantyKey = () => (
	<span className="flex items-center gap-3 text-xs font-semibold">
		<span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
			<span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
			Out of warranty
		</span>
		<span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300">
			<span className="h-2.5 w-2.5 rounded-full bg-orange-600 dark:bg-orange-400" />
			Warranty
		</span>
	</span>
);

type CellFiguresPropsType = {
	/** Report 2: makes each non-zero quantity a button opening that side's product-wise drill-down. */
	onSideClick?: (side: SideType) => void;
	quiet?: boolean;
	showWarranty: boolean;
	value: CellValueType;
};

/** One cell's figures: count, profit, (sale) on three lines — Report 1's layout. Report 2
 *  (showWarranty) replaces the count with two separate quantities, out of warranty (blue, count −
 *  warranty) and warranty (orange), named by WarrantyKey in the card header; its profit and (sale)
 *  stay merged over both. `quiet` is the lighter count used on the Total row. */
const CellFigures = ({ onSideClick, quiet = false, showWarranty, value }: CellFiguresPropsType) => {
	const sizeClass = quiet ? "text-xs" : "text-sm font-bold";
	return (
		<div className="flex flex-col items-center gap-1 tabular-nums">
			{showWarranty ? (
				<span className="flex items-baseline gap-1.5 whitespace-nowrap">
					<SideQty
						className={cn("text-blue-600 dark:text-blue-400", sizeClass)}
						onClick={onSideClick ? () => onSideClick("oow") : undefined}
						qty={value.count - value.warranty}
						title={MESSAGES.INFO_TECH_REPORT2_OOW_DRILL_HINT}
					/>
					<SideQty
						className={cn("text-orange-700 dark:text-orange-300", sizeClass)}
						onClick={onSideClick ? () => onSideClick("warranty") : undefined}
						qty={value.warranty}
						title={MESSAGES.INFO_TECH_REPORT2_W_DRILL_HINT}
					/>
				</span>
			) : (
				<span className={cn("text-blue-600 dark:text-blue-400", sizeClass)}>{formatNumber(value.count)}</span>
			)}
			{(!showWarranty || value.count > 0) && (
				<>
					<span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
						{formatNumber(value.profit)}
					</span>
					<span className="text-[11px] font-light text-amber-600 dark:text-amber-400">
						({formatNumber(value.charges)})
					</span>
				</>
			)}
		</div>
	);
};

type SideQtyPropsType = { className: string; onClick?: () => void; qty: number; title: string };

/** One Report 2 quantity. Non-zero with a handler it is a button (underline + ring on hover);
 *  a zero is dimmed and inert. */
const SideQty = ({ className, onClick, qty, title }: SideQtyPropsType) =>
	onClick && qty > 0 ? (
		<button
			className={cn(
				"cursor-pointer rounded px-1 underline-offset-2 hover:underline hover:ring-1 hover:ring-(--cl-accent)",
				className,
			)}
			onClick={onClick}
			title={title}
			type="button"
		>
			{formatNumber(qty)}
		</button>
	) : (
		<span className={cn("px-1", className, qty === 0 && "opacity-40")}>{formatNumber(qty)}</span>
	);
