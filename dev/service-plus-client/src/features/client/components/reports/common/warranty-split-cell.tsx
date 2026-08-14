import { formatInr, formatNumber } from "./formatters";
import type { CategorySplitType } from "./use-category-range-matrix";

type Props = {
    bold?: boolean;
    showProfit?: boolean;
    showRevenue?: boolean;
    showSplit?: boolean;
    split: CategorySplitType;
};

// Orange = Warranty — matches JOB_TYPE_COLORS.UNDER_WARRANTY in job-badges.tsx, the badge
// color already shown for warranty jobs in every job grid (Job Control, Single Job, Job
// Pipeline). Emerald = Out-of-Warranty, for clear contrast against the orange.
// Profit/Revenue follow technician-profit-revenue-section.tsx's own hierarchy: Profit is the
// prominent bold emerald figure — colored text only, no filled pill — and Revenue is plain
// de-emphasized text (there, an unstyled table cell), shown smaller and parenthesized below it.
export function WarrantySplitCell({ bold = false, showProfit = false, showRevenue = false, showSplit = true, split }: Props) {
    const total = split.warranty_count + split.oow_count;
    return (
        <div className="flex w-full flex-col items-end gap-1 text-right">
            <span className={bold ? "font-extrabold text-(--cl-text) tabular-nums" : "font-bold text-(--cl-text) tabular-nums"}>
                {formatNumber(total)}
            </span>
            {showSplit && (
                <span className="inline-flex items-center gap-2 text-[10px] font-normal tabular-nums">
                    <span className="inline-flex items-center gap-1 text-orange-500/70 dark:text-orange-300/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500/70" />
                        {formatNumber(split.warranty_count)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-500/70 dark:text-emerald-400/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                        {formatNumber(split.oow_count)}
                    </span>
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
