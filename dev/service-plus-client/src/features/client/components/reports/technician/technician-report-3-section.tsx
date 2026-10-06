import { IndianRupee, TrendingUp, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { FIELD_VALIDATION_DEBOUNCE_MS } from "@/constants/timing";
import { cn } from "@/lib/utils";

import { ChartCard } from "../common/chart-card";
import { formatIsoDate, formatRangeLabel, getPeriodsAgoRange } from "../common/fiscal";
import type { DateRangeType, PeriodUnitType } from "../common/fiscal";
import { formatNumber } from "../common/formatters";
import { exportReportPdf } from "../common/pdf-export";
import { ReportEmpty } from "../common/report-empty";
import { ReportError } from "../common/report-error";
import { ReportLoading } from "../common/report-loading";
import { ReportSection } from "../common/report-section";
import { ReportToolbar } from "../common/report-toolbar";
import { useFiscalSetting } from "../common/use-fiscal-setting";
import { useGenericQuery } from "../common/use-generic-query";
import { useSyncedHorizontalScroll } from "../common/use-synced-horizontal-scroll";
import { exportReportXlsx } from "../common/xlsx-export";

import { TechnicianProductCellDialog } from "./technician-product-cell-dialog";
import type { TechnicianProductCellType } from "./technician-product-cell-dialog";

type RowType = {
	oow_count: number;
	oow_profit: number;
	oow_revenue: number;
	product_name: string;
	technician_id: number;
	technician_name: string;
	warranty_count: number;
	warranty_profit: number;
	warranty_revenue: number;
};

type SplitType = { count: number; profit: number; revenue: number };

type CellValueType = { oow: SplitType; warranty: SplitType };

type ExportRowType = Record<string, number | string>;

type JobModeType = "delivered" | "repaired";

type PeriodGroupType = { count: number; label: string; unit: PeriodUnitType };

type WarrantyFilterType = "all" | "oow" | "warranty";

const CUSTOM_KEY = "custom";

const DEFAULT_KEY = "month-0";

// The Jobs switch: which jobs the grid counts. Each mode matches the Jobs Summary tab of the same
// name — see GET_TECHNICIAN_REPORTS_PRODUCT_SPLIT.
const JOB_MODES: { caption: string; label: string; mode: JobModeType }[] = [
	{ caption: "Completed OK", label: "Repaired", mode: "repaired" },
	{ caption: "Delivered OK", label: "Delivered", mode: "delivered" },
];

const ALL_TECHNICIANS = "all";

// The Warranty switch. "all" shows OOW, W and Σ lines; the others keep just that line.
const WARRANTY_FILTERS: { caption: string; filter: WarrantyFilterType; label: string }[] = [
	{ caption: "Both", filter: "all", label: "All" },
	{ caption: "Under warranty", filter: "warranty", label: "W" },
	{ caption: "Out of warranty", filter: "oow", label: "OOW" },
];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// One segmented button group per unit: "This", "-1", "-2"… Quarters and years are fiscal
// (getPeriodsAgoRange), offset 0 being the period containing today.
const PERIOD_GROUPS: PeriodGroupType[] = [
	{ count: 4, label: "Month", unit: "month" },
	{ count: 4, label: "Quarter", unit: "quarter" },
	{ count: 4, label: "Year", unit: "year" },
];

const EMPTY_SPLIT: SplitType = { count: 0, profit: 0, revenue: 0 };

const EMPTY_CELL: CellValueType = { oow: EMPTY_SPLIT, warranty: EMPTY_SPLIT };

// Export columns after Technician / Product: qty, profit and revenue for OOW, W and Total. With the
// Warranty switch on W or OOW, only that scope's three columns are exported (see exportColumns).
const EXPORT_FIGURE_COLUMNS: { header: string; key: string; scope: WarrantyFilterType | "total" }[] = [
	{ header: "OOW Qty", key: "oowCount", scope: "oow" },
	{ header: "OOW Profit", key: "oowProfit", scope: "oow" },
	{ header: "OOW Revenue", key: "oowRevenue", scope: "oow" },
	{ header: "W Qty", key: "warrantyCount", scope: "warranty" },
	{ header: "W Profit", key: "warrantyProfit", scope: "warranty" },
	{ header: "W Revenue", key: "warrantyRevenue", scope: "warranty" },
	{ header: "Total Qty", key: "totalCount", scope: "total" },
	{ header: "Total Profit", key: "totalProfit", scope: "total" },
	{ header: "Total Revenue", key: "totalRevenue", scope: "total" },
];

const EXPORT_ALL_PRODUCTS = "All products";

// Fixed widths shared by every cell, so label / qty / profit / revenue line up down each column.
const SPLIT_GRID = "grid grid-cols-[2.5rem_2.25rem_4.5rem_4.75rem] items-center gap-x-2";

// Hover ring on a cell that opens the drill-down — the same look as Report 1 and Jobs Summary.
const DRILL_CELL_CLASS = "cursor-pointer hover:ring-2 hover:ring-(--cl-accent) hover:ring-inset";

// The same columns without the OOW / W / Σ tag, used when the Warranty switch is on W or OOW: each
// cell then has a single line, and the side it shows is named once by the pill in the card header.
const SPLIT_GRID_PLAIN = "grid grid-cols-[2.25rem_4.5rem_4.75rem] items-center gap-x-2";

function addCells(a: CellValueType, b: CellValueType): CellValueType {
	return { oow: addSplits(a.oow, b.oow), warranty: addSplits(a.warranty, b.warranty) };
}

function addSplits(a: SplitType, b: SplitType): SplitType {
	return { count: a.count + b.count, profit: a.profit + b.profit, revenue: a.revenue + b.revenue };
}

// Applies the Warranty switch to one cell: the side switched off becomes zero, so totals, the
// summary and the exports all follow it without further checks.
function applyWarrantyFilter(value: CellValueType, filter: WarrantyFilterType): CellValueType {
	if (filter === "warranty") return { oow: EMPTY_SPLIT, warranty: value.warranty };
	if (filter === "oow") return { oow: value.oow, warranty: EMPTY_SPLIT };
	return value;
}

function cellTotal(value: CellValueType): SplitType {
	return addSplits(value.oow, value.warranty);
}

// The caption under a period button: the month, the quarter's months, or the fiscal year.
// One export row's figures. Excel gets plain numbers (2 dp); the PDF gets display strings.
function exportFigures(value: CellValueType, asText: boolean): ExportRowType {
	const total = cellTotal(value);
	const fmt = (n: number) => (asText ? formatNumber(n) : Math.round(n * 100) / 100);
	return {
		oowCount: value.oow.count,
		oowProfit: fmt(value.oow.profit),
		oowRevenue: fmt(value.oow.revenue),
		totalCount: total.count,
		totalProfit: fmt(total.profit),
		totalRevenue: fmt(total.revenue),
		warrantyCount: value.warranty.count,
		warrantyProfit: fmt(value.warranty.profit),
		warrantyRevenue: fmt(value.warranty.revenue),
	};
}

function exportColumns(filter: WarrantyFilterType): { header: string; key: string }[] {
	return EXPORT_FIGURE_COLUMNS.filter((c) => (filter === "all" ? true : c.scope === filter)).map(
		({ header, key }) => ({ header, key }),
	);
}

function formatPeriodCaption(range: DateRangeType, unit: PeriodUnitType): string {
	const yy = String(range.from.getFullYear()).slice(2);
	if (unit === "month") return `${MONTH_ABBR[range.from.getMonth()]} '${yy}`;
	if (unit === "quarter") return `${MONTH_ABBR[range.from.getMonth()]}–${MONTH_ABBR[range.to.getMonth()]}`;
	return `FY ${yy}-${String(range.from.getFullYear() + 1).slice(2)}`;
}

function getCustomError(fromStr: string, toStr: string): string | null {
	const from = new Date(`${fromStr}T00:00:00`);
	const to = new Date(`${toStr}T00:00:00`);
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
		return MESSAGES.ERROR_REPORTS_CUSTOM_RANGE_INVALID;
	}
	return null;
}

function periodKey(unit: PeriodUnitType, offset: number): string {
	return `${unit}-${offset}`;
}

function splitCaption(oow: number, warranty: number): string {
	return `OOW ${formatNumber(oow)} · W ${formatNumber(warranty)}`;
}

export const TechnicianReport3Section = () => {
	const { fyStartMonth, isReady } = useFiscalSetting();

	const [jobMode, setJobMode] = useState<JobModeType>("delivered");
	const [technicianFilter, setTechnicianFilter] = useState<string>(ALL_TECHNICIANS);
	const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilterType>("all");
	const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_KEY);
	// The period button in force before Custom was switched on, restored when it is switched off.
	const [lastPresetKey, setLastPresetKey] = useState<string>(DEFAULT_KEY);
	// The editable date range: draft is what the two date fields show while being edited; appliedCustom
	// is the range the grid actually uses, updated from a valid draft after a typing pause.
	const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
	const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);

	const presetRanges = useMemo(() => {
		const today = new Date();
		const ranges = new Map<string, DateRangeType>();
		for (const g of PERIOD_GROUPS) {
			for (let offset = 0; offset < g.count; offset++) {
				ranges.set(periodKey(g.unit, offset), getPeriodsAgoRange(offset, today, fyStartMonth, g.unit));
			}
		}
		return ranges;
	}, [fyStartMonth]);

	const range = useMemo(() => {
		if (selectedKey === CUSTOM_KEY && appliedCustom) {
			return {
				from: new Date(`${appliedCustom.from}T00:00:00`),
				to: new Date(`${appliedCustom.to}T00:00:00`),
			};
		}
		const preset = presetRanges.get(selectedKey) ?? getPeriodsAgoRange(0, new Date(), fyStartMonth, "month");
		return { from: preset.from, to: preset.to };
	}, [appliedCustom, fyStartMonth, presetRanges, selectedKey]);

	const isCustom = selectedKey === CUSTOM_KEY;
	const customError = isCustom && draft ? getCustomError(draft.from, draft.to) : null;
	// The date fields show the draft while editing, otherwise the chosen period's own dates.
	const shownRange = isCustom && draft ? draft : { from: formatIsoDate(range.from), to: formatIsoDate(range.to) };

	// Applies a valid draft after a pause, so typing a year digit by digit does not fire a query for
	// every half-typed date.
	useEffect(() => {
		if (!isCustom || !draft || getCustomError(draft.from, draft.to)) return;
		if (appliedCustom && appliedCustom.from === draft.from && appliedCustom.to === draft.to) return;
		const timer = setTimeout(() => setAppliedCustom(draft), FIELD_VALIDATION_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [appliedCustom, draft, isCustom]);

	const sqlArgs = useMemo(
		() => ({ from: formatIsoDate(range.from), mode: jobMode, to: formatIsoDate(range.to) }),
		[jobMode, range],
	);

	const q = useGenericQuery<RowType>({
		enabled: isReady,
		sqlArgs,
		sqlId: SQL_MAP.GET_TECHNICIAN_REPORTS_PRODUCT_SPLIT,
	});

	const hScroll = useSyncedHorizontalScroll([q.data, q.loading]);

	// Every technician in the period's data, unfiltered — the Technician dropdown's options.
	const technicianOptions = useMemo(() => {
		const names = new Map<number, string>();
		for (const r of q.data) names.set(r.technician_id, r.technician_name);
		return Array.from(names.entries()).map(([id, name]) => ({ id, name }));
	}, [q.data]);

	// A technician picked earlier may have no jobs in a newly chosen period: fall back to All.
	const effectiveTechnician = technicianOptions.some((t) => String(t.id) === technicianFilter)
		? technicianFilter
		: ALL_TECHNICIANS;
	const isFiltered = effectiveTechnician !== ALL_TECHNICIANS || warrantyFilter !== "all";

	const { grid, products, technicians } = useMemo(() => {
		const grid = new Map<number, Map<string, CellValueType>>();
		const productSet = new Set<string>();
		const techNames = new Map<number, string>();
		for (const r of q.data) {
			if (effectiveTechnician !== ALL_TECHNICIANS && String(r.technician_id) !== effectiveTechnician) continue;
			const value = applyWarrantyFilter(
				{
					oow: {
						count: Number(r.oow_count),
						profit: Number(r.oow_profit),
						revenue: Number(r.oow_revenue),
					},
					warranty: {
						count: Number(r.warranty_count),
						profit: Number(r.warranty_profit),
						revenue: Number(r.warranty_revenue),
					},
				},
				warrantyFilter,
			);
			// Rows left empty by the Warranty switch are dropped, so products and technicians with
			// nothing to show leave the grid.
			if (cellTotal(value).count === 0) continue;
			techNames.set(r.technician_id, r.technician_name);
			productSet.add(r.product_name);
			if (!grid.has(r.technician_id)) grid.set(r.technician_id, new Map());
			grid.get(r.technician_id)?.set(r.product_name, value);
		}
		const products = Array.from(productSet).sort((a, b) => a.localeCompare(b));
		const technicians = Array.from(techNames.entries()).map(([id, name]) => ({ id, name }));
		return { grid, products, technicians };
	}, [effectiveTechnician, q.data, warrantyFilter]);

	function cellFor(technicianId: number, product: string): CellValueType {
		return grid.get(technicianId)?.get(product) ?? EMPTY_CELL;
	}

	// The date fields are editable only with the Custom switch on; edits apply after a pause.
	function handleRangeEdit(field: "from" | "to", value: string) {
		if (!isCustom || !draft) return;
		setDraft({ ...draft, [field]: value });
	}

	// Custom on: start from the dates on screen and deselect the period buttons. Off: go back to the
	// period button that was in force before.
	function handleCustomSwitch(on: boolean) {
		if (on) {
			setDraft(shownRange);
			setAppliedCustom(shownRange);
			setSelectedKey(CUSTOM_KEY);
			return;
		}
		setSelectedKey(lastPresetKey);
	}

	function handlePresetSelect(key: string) {
		setLastPresetKey(key);
		setSelectedKey(key);
	}

	function productTotal(product: string): CellValueType {
		return technicians.reduce<CellValueType>((acc, t) => addCells(acc, cellFor(t.id, product)), EMPTY_CELL);
	}

	function technicianTotal(technicianId: number): CellValueType {
		return products.reduce<CellValueType>((acc, p) => addCells(acc, cellFor(technicianId, p)), EMPTY_CELL);
	}

	const grandTotal = technicians.reduce<CellValueType>((acc, t) => addCells(acc, technicianTotal(t.id)), EMPTY_CELL);
	const grand = cellTotal(grandTotal);

	const exportJobsLabel = jobMode === "repaired" ? "Repaired" : "Delivered";
	const exportTechnicianLabel = technicianOptions.find((t) => String(t.id) === effectiveTechnician)?.name ?? "All";
	const exportWarrantyLabel = WARRANTY_FILTERS.find((w) => w.filter === warrantyFilter)?.caption ?? "Both";
	const exportFileName = [
		"technician-report-3",
		jobMode,
		warrantyFilter === "all" ? "" : warrantyFilter,
		effectiveTechnician === ALL_TECHNICIANS ? "" : exportTechnicianLabel,
		sqlArgs.from,
		sqlArgs.to,
	]
		.filter(Boolean)
		.join("_");
	const figureColumns = exportColumns(warrantyFilter);

	// Flat export layout: one row per technician × product that has jobs, then that technician's
	// "All products" subtotal. The on-screen pivot (products across) is too wide for a page.
	function buildDetailRows(asText: boolean): ExportRowType[] {
		const rows: ExportRowType[] = [];
		for (const t of technicians) {
			for (const p of products) {
				const value = cellFor(t.id, p);
				if (cellTotal(value).count === 0) continue;
				rows.push({ product: p, technician: t.name, ...exportFigures(value, asText) });
			}
			rows.push({
				product: EXPORT_ALL_PRODUCTS,
				technician: t.name,
				...exportFigures(technicianTotal(t.id), asText),
			});
		}
		return rows;
	}

	function handlePdfExport() {
		try {
			exportReportPdf({
				// Landscape A4 has 273 mm between the 12 mm margins: 38 + 37 for the text columns, the rest
				// shared by the figure columns (9 × 22, or 3 × 66 when the Warranty switch is on W / OOW).
				// Widths must add up to exactly 273 — autotable logs a warning if they fall short too.
				columns: [
					{ dataKey: "technician", header: "Technician", width: 38 },
					{ dataKey: "product", header: "Product", width: 37 },
					...figureColumns.map((c) => ({
						align: "right" as const,
						dataKey: c.key,
						header: c.header,
						width: 198 / figureColumns.length,
					})),
				],
				fileName: exportFileName,
				meta: [
					{ label: "Jobs", value: exportJobsLabel },
					{ label: "Warranty", value: exportWarrantyLabel },
					{ label: "Technician", value: exportTechnicianLabel },
					{ label: "Period", value: formatRangeLabel(range.from, range.to) },
				],
				orientation: "landscape",
				rows: buildDetailRows(true),
				title: "Technician Report 3",
				totalsRow: { product: EXPORT_ALL_PRODUCTS, technician: "Total", ...exportFigures(grandTotal, true) },
			});
			toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
		} catch {
			toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
		}
	}

	function handleXlsxExport() {
		try {
			exportReportXlsx({
				fileName: exportFileName,
				sheets: [
					{
						columns: [
							{ header: "Technician", key: "technician" },
							{ header: "Product", key: "product" },
							...figureColumns,
						],
						name: `${exportJobsLabel} by Technician`,
						rows: [
							...buildDetailRows(false),
							{ product: EXPORT_ALL_PRODUCTS, technician: "Total", ...exportFigures(grandTotal, false) },
						],
					},
					{
						columns: [{ header: "Product", key: "product" }, ...figureColumns],
						name: `${exportJobsLabel} by Product`,
						rows: [
							...products.map((p) => ({ product: p, ...exportFigures(productTotal(p), false) })),
							{ product: "Total", ...exportFigures(grandTotal, false) },
						],
					},
				],
			});
			toast.success(MESSAGES.SUCCESS_REPORTS_EXPORTED);
		} catch {
			toast.error(MESSAGES.ERROR_REPORTS_EXPORT_FAILED);
		}
	}

	const canExport = !q.loading && technicians.length > 0;

	const [drillCell, setDrillCell] = useState<TechnicianProductCellType | null>(null);

	// Opens the drill-down for one cell. A null technician (Total row, grand total) still means the
	// filtered technician when the Technician filter is set, so the job list matches the figure.
	function openDrill(technicianId: number | null, productName: string | null, value: CellValueType) {
		if (cellTotal(value).count === 0) return;
		const filteredId = effectiveTechnician === ALL_TECHNICIANS ? null : Number(effectiveTechnician);
		const id = technicianId ?? filteredId;
		setDrillCell({
			from: sqlArgs.from,
			mode: jobMode,
			periodLabel: formatRangeLabel(range.from, range.to),
			productName,
			technicianId: id,
			technicianName: id == null ? null : (technicianOptions.find((t) => t.id === id)?.name ?? null),
			to: sqlArgs.to,
			warranty: warrantyFilter,
		});
	}

	function drillProps(technicianId: number | null, productName: string | null, value: CellValueType) {
		const clickable = cellTotal(value).count > 0;
		return {
			className: clickable ? DRILL_CELL_CLASS : undefined,
			onClick: clickable ? () => openDrill(technicianId, productName, value) : undefined,
		};
	}

	return (
		<ReportSection>
			<ReportToolbar
				hideRange
				onExportExcel={canExport ? handleXlsxExport : undefined}
				onExportPdf={canExport ? handlePdfExport : undefined}
				onRefresh={q.refetch}
				subtitle={
					jobMode === "repaired"
						? MESSAGES.INFO_TECH_REPORT3_SUBTITLE_REPAIRED
						: MESSAGES.INFO_TECH_REPORT3_SUBTITLE_DELIVERED
				}
				title="Technician Report 3"
			>
				<div className="flex w-full flex-col gap-2.5">
					{/* Row 1: Jobs, then the period — Month, Quarter, Year, Custom — with the resolved date range on the right. */}
					<div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
						<PeriodGroup label="Jobs">
							{JOB_MODES.map((m) => (
								<PeriodButton
									key={m.mode}
									caption={m.caption}
									isActive={jobMode === m.mode}
									label={m.label}
									onClick={() => setJobMode(m.mode)}
								/>
							))}
						</PeriodGroup>
						{PERIOD_GROUPS.map((g) => (
							<PeriodGroup key={g.unit} label={g.label}>
								{Array.from({ length: g.count }, (_, offset) => {
									const key = periodKey(g.unit, offset);
									const preset = presetRanges.get(key);
									return (
										<PeriodButton
											key={key}
											caption={preset ? formatPeriodCaption(preset, g.unit) : ""}
											isActive={selectedKey === key}
											label={offset === 0 ? "This" : `-${offset}`}
											onClick={() => handlePresetSelect(key)}
											title={preset ? formatRangeLabel(preset.from, preset.to) : undefined}
										/>
									);
								})}
							</PeriodGroup>
						))}
						{/* The Custom group: the date range, with an on/off switch beside its label. Off, the range
						    just shows the chosen period's dates (read-only); on, it is editable and is the
						    period, and the buttons deselect. A period button switches it back off. */}
						<div className="ml-auto flex flex-col gap-1">
							{/* The on/off switch sits on the label line, right of "Custom". */}
							<span className="flex items-center gap-2">
								<span className="text-[10px] font-bold tracking-wider text-(--cl-text-muted) uppercase">
									Custom
								</span>
								{/* Full size, a darker track when off and the accent with a soft ring when on, so it
								    reads clearly as a control next to the small caption. */}
								<Switch
									aria-label="Custom date range"
									checked={isCustom}
									className="cursor-pointer shadow-sm data-checked:bg-(--cl-accent) data-checked:ring-2 data-checked:ring-(--cl-accent)/30 data-unchecked:bg-slate-400 dark:data-unchecked:bg-slate-500"
									onCheckedChange={handleCustomSwitch}
								/>
								<span
									className={cn(
										"text-[10px] font-bold uppercase",
										isCustom ? "text-(--cl-accent)" : "text-(--cl-text-muted)",
									)}
								>
									{isCustom ? "On" : "Off"}
								</span>
							</span>
							<div
								className={cn(
									"flex h-[2.65rem] items-center gap-1 rounded-md border bg-(--cl-surface) px-2 text-xs font-medium text-(--cl-text)",
									isCustom
										? "border-(--cl-accent) ring-1 ring-(--cl-accent)/40"
										: "border-(--cl-border)",
								)}
							>
								<RangeDateInput
									disabled={!isCustom}
									onChange={(v) => handleRangeEdit("from", v)}
									value={shownRange.from}
								/>
								<span className="text-(--cl-text-muted)">–</span>
								<RangeDateInput
									disabled={!isCustom}
									onChange={(v) => handleRangeEdit("to", v)}
									value={shownRange.to}
								/>
							</div>
						</div>
					</div>

					{customError && <p className="-mt-1 text-right text-xs font-medium text-red-600">{customError}</p>}

					{/* Row 2: Warranty and Technician filters, with the summary of what is selected on the right. */}
					<div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
						<PeriodGroup label="Warranty">
							{WARRANTY_FILTERS.map((w) => (
								<PeriodButton
									key={w.filter}
									caption={w.caption}
									isActive={warrantyFilter === w.filter}
									label={w.label}
									onClick={() => setWarrantyFilter(w.filter)}
								/>
							))}
						</PeriodGroup>
						<div className="flex flex-col gap-1">
							<Label
								className="text-[10px] font-bold tracking-wider text-(--cl-text-muted) uppercase"
								htmlFor="tr3-technician"
							>
								Technician
							</Label>
							<Select onValueChange={setTechnicianFilter} value={effectiveTechnician}>
								<SelectTrigger
									aria-label="Technician"
									className="h-[2.65rem] w-48 bg-(--cl-surface) text-xs"
									id="tr3-technician"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_TECHNICIANS}>All technicians</SelectItem>
									{technicianOptions.map((t) => (
										<SelectItem key={t.id} value={String(t.id)}>
											{t.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{/* Summary for the chosen period and filters, inline instead of cards — saves grid height. */}
						<div className="ml-auto flex min-h-[2.65rem] flex-wrap items-center gap-x-4 gap-y-1 self-end rounded-md border border-(--cl-border) bg-(--cl-surface) px-3 py-1.5 text-xs">
							<SummaryItem
								icon={Wrench}
								label={jobMode === "repaired" ? "Jobs Repaired" : "Jobs Delivered"}
								loading={q.loading}
								oow={grandTotal.oow.count}
								value={grand.count}
								showSplit={warrantyFilter === "all"}
								valueClass="text-(--cl-text)"
								warranty={grandTotal.warranty.count}
							/>
							<SummaryItem
								icon={IndianRupee}
								label="Revenue"
								loading={q.loading}
								oow={grandTotal.oow.revenue}
								value={grand.revenue}
								showSplit={warrantyFilter === "all"}
								valueClass="text-amber-700 dark:text-amber-400"
								warranty={grandTotal.warranty.revenue}
							/>
							<SummaryItem
								icon={TrendingUp}
								label="Profit"
								loading={q.loading}
								oow={grandTotal.oow.profit}
								value={grand.profit}
								showSplit={warrantyFilter === "all"}
								valueClass="text-emerald-700 dark:text-emerald-400"
								warranty={grandTotal.warranty.profit}
							/>
						</div>
					</div>
				</div>
			</ReportToolbar>

			{q.error && <ReportError onRetry={q.refetch} />}

			<ChartCard
				actions={warrantyFilter === "all" ? <Legend /> : <FilterPill filter={warrantyFilter} />}
				bodyClassName="flex min-h-0 flex-col"
				className="min-h-[calc(75vh+10.25rem)] flex-1"
				description={
					warrantyFilter === "all"
						? MESSAGES.INFO_TECH_REPORT3_LEGEND
						: MESSAGES.INFO_TECH_REPORT3_LEGEND_FILTERED
				}
				title="Technician × Product"
			>
				{q.loading ? (
					<ReportLoading lines={6} />
				) : technicians.length === 0 ? (
					<ReportEmpty
						message={
							isFiltered && q.data.length > 0
								? MESSAGES.INFO_TECH_REPORT3_EMPTY_FILTERED
								: jobMode === "repaired"
									? MESSAGES.INFO_TECH_REPORT3_EMPTY_REPAIRED
									: MESSAGES.INFO_TECH_REPORT3_EMPTY_DELIVERED
						}
					/>
				) : (
					<>
						{/* Top scrollbar, in step with the grid's own — reachable without scrolling down. */}
						{hScroll.isOverflowing && (
							<div
								ref={hScroll.topRef}
								aria-hidden
								className="mb-1 shrink-0 overflow-x-auto overflow-y-hidden"
								onScroll={hScroll.onTopScroll}
							>
								<div className="h-px" style={{ width: hScroll.contentWidth }} />
							</div>
						)}
						<div
							ref={hScroll.mainRef}
							className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)"
							onScroll={hScroll.onMainScroll}
						>
							<table className="w-full border-separate border-spacing-0 text-xs">
								<thead>
									<tr>
										<th className="sticky top-0 left-0 z-30 border-r border-b border-(--cl-border) bg-(--cl-surface) px-3 py-2 text-left font-bold text-(--cl-accent-text)">
											Technician
										</th>
										{products.map((p) => (
											<th
												key={p}
												className="sticky top-0 z-20 border-b border-(--cl-border) bg-(--cl-surface) px-3 py-2 text-left"
											>
												<HeaderLabel
													count={cellTotal(productTotal(p)).count}
													filter={warrantyFilter}
													name={p}
												/>
											</th>
										))}
										<th className="sticky top-0 right-0 z-30 border-b border-l border-(--cl-border) bg-(--cl-surface) px-3 py-2 text-left">
											<HeaderLabel count={grand.count} filter={warrantyFilter} name="Total" />
										</th>
									</tr>
								</thead>
								<tbody>
									{technicians.map((t) => {
										const total = technicianTotal(t.id);
										return (
											<tr key={t.id} className="group">
												<td className="sticky left-0 z-10 border-r border-b border-(--cl-divider) bg-(--cl-surface-2) px-3 py-2 align-top whitespace-nowrap group-hover:bg-(--cl-hover)">
													<span className="block text-xs font-bold text-(--cl-text)">
														{t.name}
													</span>
													<span className="block text-[10px] text-(--cl-text-muted)">
														{formatNumber(cellTotal(total).count)} jobs
													</span>
												</td>
												{products.map((p) => {
													const value = cellFor(t.id, p);
													const drill = drillProps(t.id, p, value);
													return (
														<td
															key={p}
															className={cn(
																"border-b border-(--cl-divider) px-3 py-2 align-top group-hover:bg-(--cl-hover)",
																drill.className,
															)}
															onClick={drill.onClick}
														>
															<SplitCell filter={warrantyFilter} value={value} />
														</td>
													);
												})}
												<td
													className={cn(
														"sticky right-0 z-10 border-b border-l border-(--cl-border) bg-(--cl-surface) px-3 py-2 align-top group-hover:bg-(--cl-hover)",
														drillProps(t.id, null, total).className,
													)}
													onClick={drillProps(t.id, null, total).onClick}
												>
													<SplitCell filter={warrantyFilter} value={total} />
												</td>
											</tr>
										);
									})}
								</tbody>
								<tfoot>
									<tr>
										<td className="sticky bottom-0 left-0 z-30 border-t-2 border-r border-(--cl-border) bg-(--cl-surface) px-3 py-2 align-top text-xs font-bold text-(--cl-text)">
											Total
										</td>
										{products.map((p) => {
											const value = productTotal(p);
											const drill = drillProps(null, p, value);
											return (
												<td
													key={p}
													className={cn(
														"sticky bottom-0 z-20 border-t-2 border-(--cl-border) bg-(--cl-surface) px-3 py-2 align-top",
														drill.className,
													)}
													onClick={drill.onClick}
												>
													<SplitCell filter={warrantyFilter} value={value} />
												</td>
											);
										})}
										<td
											className={cn(
												"sticky right-0 bottom-0 z-30 border-t-2 border-l border-(--cl-border) bg-(--cl-surface) px-3 py-2 align-top",
												drillProps(null, null, grandTotal).className,
											)}
											onClick={drillProps(null, null, grandTotal).onClick}
										>
											<SplitCell filter={warrantyFilter} value={grandTotal} />
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</>
				)}
			</ChartCard>

			<TechnicianProductCellDialog cell={drillCell} onClose={() => setDrillCell(null)} />
		</ReportSection>
	);
};

/** Column header: product (or Total) with its job count, then Qty / Profit / Revenue captions laid
 *  on the same grid as the cells below (SPLIT_GRID, or SPLIT_GRID_PLAIN when filtered), so each
 *  figure sits under its own heading. */
const HeaderLabel = ({ count, filter, name }: { count: number; filter: WarrantyFilterType; name: string }) => (
	<>
		<span className="flex items-baseline justify-between gap-2 whitespace-nowrap">
			<span className="font-bold text-(--cl-accent-text)">{name}</span>
			<span className="text-[10px] font-medium text-(--cl-text-muted) tabular-nums">
				{formatNumber(count)} jobs
			</span>
		</span>
		<span
			className={cn(
				filter === "all" ? SPLIT_GRID : SPLIT_GRID_PLAIN,
				"mt-1.5 border-t border-(--cl-border) px-1 pt-1 text-[9px] font-semibold tracking-wider text-(--cl-text-muted) uppercase",
			)}
		>
			{filter === "all" && <span />}
			<span className="text-right">Qty</span>
			<span className="text-right">Profit</span>
			<span className="text-right">Revenue</span>
		</span>
	</>
);

/** Key for the line badges shown in the grid card's header. */
const Legend = () => (
	<div className="hidden items-center gap-3 text-[11px] text-(--cl-text-muted) sm:flex">
		<span className="flex items-center gap-1.5">
			<LineBadge label="OOW" tone="oow" />
			Out of warranty
		</span>
		<span className="flex items-center gap-1.5">
			<LineBadge label="W" tone="warranty" />
			Warranty
		</span>
	</div>
);

/** Shown in the grid card's header in place of the Legend when the Warranty switch is on W or OOW:
 *  names, once, the only side every cell is showing. */
const FilterPill = ({ filter }: { filter: WarrantyFilterType }) => (
	<span
		className={cn(
			"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
			LINE_TONE_CLASS[filter === "warranty" ? "warranty" : "oow"],
		)}
	>
		<span className="font-bold tracking-wide">{filter === "warranty" ? "W" : "OOW"}</span>
		<span className="font-medium">{filter === "warranty" ? "Under warranty" : "Out of warranty"}</span>
	</span>
);

type LineToneType = "oow" | "total" | "warranty";

const LINE_TONE_CLASS: Record<LineToneType, string> = {
	oow: "bg-slate-500/12 text-slate-700 ring-slate-500/25 dark:text-slate-200",
	total: "bg-(--cl-accent)/15 text-(--cl-accent-text) ring-(--cl-accent)/30",
	warranty: "bg-orange-500/12 text-orange-700 ring-orange-500/30 dark:text-orange-300",
};

/** Small fixed-width tag naming a cell line: OOW, W or Σ (total). */
const LineBadge = ({ label, tone }: { label: string; tone: LineToneType }) => (
	<span
		className={cn(
			"inline-flex h-4 w-9 items-center justify-center rounded-sm text-[9px] leading-none font-bold tracking-wide ring-1 ring-inset",
			LINE_TONE_CLASS[tone],
		)}
	>
		{label}
	</span>
);

/** One date field inside the editable range chip: the app's LocaleDateInput (always dd / mm / yyyy,
 *  whatever the browser language; emits ISO), made borderless so the chip is the only frame. */
type RangeDateInputPropsType = { disabled: boolean; onChange: (v: string) => void; value: string };

const RangeDateInput = ({ disabled, onChange, value }: RangeDateInputPropsType) => (
	<LocaleDateInput
		// opacity-100 overrides LocaleDateInput's disabled fade: with Custom off the dates stay fully
		// readable — they are the chosen period's — just not editable.
		className={cn("h-7 w-[8.4rem] border-0 bg-transparent opacity-100", !disabled && "hover:bg-(--cl-hover)")}
		disabled={disabled}
		onChange={onChange}
		value={value}
	/>
);

type PeriodButtonPropsType = {
	caption: string;
	isActive: boolean;
	label: string;
	onClick: () => void;
	title?: string;
};

/** One segment of a period group: "This" / "-1"… with the actual period it means underneath. */
const PeriodButton = ({ caption, isActive, label, onClick, title }: PeriodButtonPropsType) => (
	<button
		aria-pressed={isActive}
		className={cn(
			"flex min-w-14 cursor-pointer flex-col items-center rounded-md px-2.5 py-1 leading-tight transition-colors",
			isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-(--cl-text) hover:bg-(--cl-hover)",
		)}
		onClick={onClick}
		title={title}
		type="button"
	>
		<span className="text-xs font-semibold">{label}</span>
		<span className={cn("text-[10px]", isActive ? "opacity-85" : "text-(--cl-text-muted)")}>{caption}</span>
	</button>
);

/** A labelled, segmented strip of period buttons. */
const PeriodGroup = ({ children, label }: { children: ReactNode; label: string }) => (
	<div className="flex flex-col gap-1">
		<span className="text-[10px] font-bold tracking-wider text-(--cl-text-muted) uppercase">{label}</span>
		<div className="inline-flex gap-0.5 rounded-lg border border-(--cl-border) bg-(--cl-surface) p-0.5">
			{children}
		</div>
	</div>
);

type SummaryItemPropsType = {
	icon: LucideIcon;
	label: string;
	loading: boolean;
	oow: number;
	showSplit: boolean;
	value: number;
	valueClass: string;
	warranty: number;
};

/** One figure of the inline period summary: icon, label, bold total, then its OOW / W split (left
 *  out when the Warranty switch already narrows the report to one side). */
const SummaryItem = ({
	icon: Icon,
	label,
	loading,
	oow,
	showSplit,
	value,
	valueClass,
	warranty,
}: SummaryItemPropsType) => (
	<span className="flex items-baseline gap-1.5 whitespace-nowrap">
		<Icon className="h-3.5 w-3.5 self-center text-(--cl-text-muted)" />
		<span className="text-(--cl-text-muted)">{label}</span>
		<span className={cn("text-sm font-bold tabular-nums", valueClass, loading && "opacity-40")}>
			{loading ? "…" : formatNumber(value)}
		</span>
		{!loading && showSplit && (
			<span className="text-[11px] text-(--cl-text-muted) tabular-nums">({splitCaption(oow, warranty)})</span>
		)}
	</span>
);

/** OOW and W lines, then a Total line under a hairline — each Qty · Profit · Revenue on the fixed
 *  SPLIT_GRID, one size and weight throughout, so figures line up under the column captions. A line
 *  with no jobs collapses to a dash. With the Warranty switch on W or OOW only that line is shown,
 *  since the total would repeat it. */
const SplitCell = ({ filter, value }: { filter: WarrantyFilterType; value: CellValueType }) => {
	const total = cellTotal(value);
	if (total.count === 0) {
		return <div className="py-2 text-center text-(--cl-text-muted)">—</div>;
	}
	return (
		<div className="flex flex-col text-xs leading-5 tabular-nums antialiased">
			{filter === "all" ? (
				<>
					<SplitLine label="OOW" split={value.oow} tone="oow" />
					<SplitLine label="W" split={value.warranty} tone="warranty" />
					<SplitLine label="Σ" split={total} tone="total" />
				</>
			) : (
				<SplitLine split={filter === "warranty" ? value.warranty : value.oow} tone={filter} />
			)}
		</div>
	);
};

/** One figure line. Without a label (Warranty switch on W / OOW) it drops the tag column and uses
 *  SPLIT_GRID_PLAIN, matching the narrowed HeaderLabel captions. */
type SplitLinePropsType = { label?: string; split: SplitType; tone: LineToneType };

const SplitLine = ({ label, split, tone }: SplitLinePropsType) => {
	const isTotal = tone === "total";
	return (
		<div
			className={cn(
				label ? SPLIT_GRID : SPLIT_GRID_PLAIN,
				"px-1",
				isTotal && "mt-0.5 border-t border-(--cl-border) pt-0.5",
			)}
		>
			{label && <LineBadge label={label} tone={tone} />}
			{split.count === 0 ? (
				<span className="col-span-3 text-right text-(--cl-text-muted)">—</span>
			) : (
				<>
					<span className={cn("text-right text-(--cl-text)", isTotal ? "font-bold" : "font-medium")}>
						{formatNumber(split.count)}
					</span>
					<span
						className={cn(
							"text-right text-emerald-700 dark:text-emerald-400",
							isTotal ? "font-bold" : "font-medium",
						)}
					>
						{formatNumber(split.profit)}
					</span>
					<span
						className={cn(
							"text-right text-amber-700 dark:text-amber-400",
							isTotal ? "font-bold" : "font-medium",
						)}
					>
						{formatNumber(split.revenue)}
					</span>
				</>
			)}
		</div>
	);
};
