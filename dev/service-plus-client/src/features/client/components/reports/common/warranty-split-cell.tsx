import { cn } from "@/lib/utils";

import { formatInr, formatNumber } from "./formatters";
import type { CategorySplitType } from "./use-category-range-matrix";

type Props = {
	bold?: boolean;
	showProfit?: boolean;
	showRevenue?: boolean;
	showSplit?: boolean;
	split: CategorySplitType;
};

// Same look as Technician Report 2 (technician-monthly-report.tsx CellFigures): Out-of-Warranty in
// blue on the left, Warranty in orange on its right, no dots, small bold figures. Both are named
// by the legend above the grid.
// Profit/Revenue follow technician-profit-revenue-section.tsx's own hierarchy: Profit is the
// prominent bold emerald figure — colored text only, no filled pill — and Revenue is plain
// de-emphasized text (there, an unstyled table cell), shown smaller and parenthesized below it.
export function WarrantySplitCell({
	bold = false,
	showProfit = false,
	showRevenue = false,
	showSplit = true,
	split,
}: Props) {
	const total = split.warranty_count + split.oow_count;
	return (
		<div className="flex w-full flex-col items-end gap-1 text-right">
			<span
				className={
					bold ? "font-extrabold text-(--cl-text) tabular-nums" : "font-bold text-(--cl-text) tabular-nums"
				}
			>
				{formatNumber(total)}
			</span>
			{showSplit && (
				<span
					className={cn(
						"inline-flex items-baseline gap-2 text-xs font-bold whitespace-nowrap tabular-nums",
						total === 0 && "invisible",
					)}
				>
					<span className="text-blue-600 dark:text-blue-400">{formatNumber(split.oow_count)}</span>
					<span className="text-orange-700 dark:text-orange-300">{formatNumber(split.warranty_count)}</span>
				</span>
			)}
			{showProfit && (
				<span className="text-xs font-extrabold text-emerald-600 tabular-nums dark:text-emerald-400">
					{formatInr(split.profit_amount)}
				</span>
			)}
			{showRevenue && (
				<span className="text-[10px] font-normal text-(--cl-text-muted) tabular-nums">
					({formatInr(split.revenue_amount)})
				</span>
			)}
		</div>
	);
}
