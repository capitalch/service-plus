import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnAlignType = "center" | "left" | "right";

export type ReportColumnType<T> = {
	align?: ColumnAlignType;
	cell?: (row: T) => ReactNode;
	footer?: (rows: T[]) => ReactNode;
	/** Next-door columns with the same group share one merged cell in an extra
	 * header row above the normal one. Only drawn when some column sets it. */
	group?: string;
	header: string;
	/** Native hover tooltip on the column header. */
	headerTitle?: string;
	id: string;
	sortable?: boolean;
	sortValue?: (row: T) => number | string;
	value?: (row: T) => number | string;
	width?: string;
};

type Props<T> = {
	/** Full grid: a border between every column, and row lines in the border colour. */
	cellBorders?: boolean;
	className?: string;
	columns: ReportColumnType<T>[];
	emptyMessage?: string;
	/** Caps the table's own height (e.g. "60vh") and makes it scroll both axes as
	 * one container, so the horizontal scrollbar stays pinned at the bottom of the
	 * visible area instead of the bottom of the full (taller) table content —
	 * matters when this table sits inside an already height-constrained parent
	 * like a dialog, where a second nested scroll container hides it below the fold. */
	maxHeight?: string;
	onRowClick?: (row: T) => void;
	rowClassName?: (row: T) => string | undefined;
	rowKey: (row: T) => string | number;
	rows: T[];
	showFooter?: boolean;
	showRowIndex?: boolean;
	stickyHeader?: boolean;
};

const ALIGN_CLASS: Record<ColumnAlignType, string> = {
	center: "text-center",
	left: "text-left",
	right: "text-right",
};

export function ReportTable<T>({
	cellBorders = false,
	className,
	columns,
	emptyMessage = "No data.",
	maxHeight,
	onRowClick,
	rowClassName,
	rowKey,
	rows,
	showFooter = false,
	showRowIndex = false,
	stickyHeader = true,
}: Props<T>) {
	const [sortId, setSortId] = useState<string | null>(null);
	const [sortAsc, setSortAsc] = useState<boolean>(true);

	const sortedRows = useMemo<T[]>(() => {
		if (!sortId) return rows;
		const col = columns.find((c) => c.id === sortId);
		if (!col) return rows;
		const acc = col.sortValue ?? col.value;
		if (!acc) return rows;
		const sorted = [...rows].sort((a, b) => {
			const va = acc(a);
			const vb = acc(b);
			if (typeof va === "number" && typeof vb === "number") {
				return sortAsc ? va - vb : vb - va;
			}
			const sa = String(va ?? "");
			const sb = String(vb ?? "");
			return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
		});
		return sorted;
	}, [rows, sortId, sortAsc, columns]);

	// Runs of next-door columns sharing a group, for the merged top header row.
	const groupSpans = useMemo<{ group?: string; id: string; span: number }[] | null>(() => {
		if (!columns.some((c) => c.group)) return null;
		const spans: { group?: string; id: string; span: number }[] = [];
		columns.forEach((col) => {
			const last = spans[spans.length - 1];
			if (last && col.group && last.group === col.group) {
				last.span += 1;
				return;
			}
			spans.push({ group: col.group, id: col.id, span: 1 });
		});
		return spans;
	}, [columns]);

	// First column of each group gets a left border in both header rows.
	const groupStartIds = new Set(groupSpans?.filter((s) => s.group).map((s) => s.id) ?? []);

	// Vertical line after every cell but the last (the wrapper already draws the outer edge).
	const cellBorderClass = cellBorders && "border-r border-(--cl-border) last:border-r-0";

	function toggleSort(id: string) {
		if (sortId === id) {
			setSortAsc((s) => !s);
			return;
		}
		setSortId(id);
		setSortAsc(true);
	}

	return (
		<div
			className={cn("overflow-auto rounded-lg border border-(--cl-border) bg-(--cl-surface-2)", className)}
			style={maxHeight ? { maxHeight } : undefined}
		>
			<Table className="text-xs">
				<TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-(--cl-surface-3)")}>
					{groupSpans && (
						<TableRow className="border-b border-(--cl-border)">
							{showRowIndex && <TableHead className={cn("px-3 py-2", cellBorderClass)} />}
							{groupSpans.map((s) => (
								<TableHead
									key={s.id}
									className={cn(
										"px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)",
										s.group && "border-l border-(--cl-border)",
										cellBorderClass,
									)}
									colSpan={s.span}
								>
									{s.group ?? ""}
								</TableHead>
							))}
						</TableRow>
					)}
					<TableRow className="border-b border-(--cl-border)">
						{showRowIndex && (
							<TableHead
								className={cn(
									"px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)",
									cellBorderClass,
								)}
								style={{ width: "40px" }}
							>
								#
							</TableHead>
						)}
						{columns.map((col) => {
							const sortable = col.sortable !== false && (col.sortValue || col.value);
							return (
								<TableHead
									key={col.id}
									className={cn(
										"px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)",
										ALIGN_CLASS[col.align ?? "left"],
										groupStartIds.has(col.id) && "border-l border-(--cl-border)",
										cellBorderClass,
										sortable && "cursor-pointer select-none hover:text-(--cl-text)",
									)}
									onClick={sortable ? () => toggleSort(col.id) : undefined}
									style={col.width ? { width: col.width } : undefined}
									title={col.headerTitle}
								>
									<span className="inline-flex items-center gap-1">
										{col.header}
										{sortable &&
											sortId === col.id &&
											(sortAsc ? (
												<ChevronUp className="h-3 w-3 text-muted-foreground" />
											) : (
												<ChevronDown className="h-3 w-3 text-muted-foreground" />
											))}
									</span>
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody className={cn("divide-y divide-(--cl-divider)", cellBorders && "divide-(--cl-border)")}>
					{sortedRows.length === 0 && (
						<TableRow>
							<TableCell
								className="px-3 py-8 text-center text-xs text-(--cl-text-muted)"
								colSpan={showRowIndex ? columns.length + 1 : columns.length}
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
					{sortedRows.map((row, index) => (
						<TableRow
							key={rowKey(row)}
							className={cn(
								"border-b border-(--cl-divider)",
								cellBorders && "border-(--cl-border)",
								onRowClick && "cursor-pointer transition-colors hover:bg-(--cl-hover)",
								rowClassName?.(row),
							)}
							onClick={onRowClick ? () => onRowClick(row) : undefined}
						>
							{showRowIndex && (
								<TableCell className={cn("px-3 py-2 text-(--cl-text-muted)", cellBorderClass)}>
									{index + 1}
								</TableCell>
							)}
							{columns.map((col) => (
								<TableCell
									key={col.id}
									className={cn(
										"px-3 py-2 text-(--cl-text)",
										ALIGN_CLASS[col.align ?? "left"],
										cellBorderClass,
									)}
								>
									{col.cell ? col.cell(row) : (col.value?.(row) ?? "")}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
				{showFooter && sortedRows.length > 0 && (
					<TableFooter className="bg-(--cl-surface-3)">
						<TableRow>
							{showRowIndex && (
								<TableCell className={cn("border-t border-(--cl-border) px-3 py-2", cellBorderClass)} />
							)}
							{columns.map((col) => (
								<TableCell
									key={col.id}
									className={cn(
										"border-t border-(--cl-border) px-3 py-2 text-xs font-bold text-(--cl-text)",
										ALIGN_CLASS[col.align ?? "left"],
										cellBorderClass,
									)}
								>
									{col.footer ? col.footer(sortedRows) : ""}
								</TableCell>
							))}
						</TableRow>
					</TableFooter>
				)}
			</Table>
		</div>
	);
}
