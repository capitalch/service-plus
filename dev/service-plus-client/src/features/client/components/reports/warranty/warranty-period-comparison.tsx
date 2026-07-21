import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatInr, formatNumber } from "../common/formatters";
import type { WarrantySummaryRowType } from "./warranty-types";

type Props = {
    current: WarrantySummaryRowType | null;
    previous: WarrantySummaryRowType | null;
};

type CompareRowType = {
    current: number;
    label: string;
    previous: number;
    valueClass?: string;
    valueFormat: (n: number) => string;
};

function computeDelta(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return Math.round(((current - previous) / previous) * 100);
}

export const WarrantyPeriodComparison = ({ current, previous }: Props) => {
    const rows: CompareRowType[] = [
        {
            current:     Number(current?.warranty_jobs_count ?? 0),
            label:       "Warranty Jobs",
            previous:    Number(previous?.warranty_jobs_count ?? 0),
            valueFormat: formatNumber,
        },
        {
            current:     Number(current?.parts_qty ?? 0),
            label:       "Parts Qty",
            previous:    Number(previous?.parts_qty ?? 0),
            valueFormat: formatNumber,
        },
        {
            current:     Number(current?.parts_value ?? 0),
            label:       "Parts Value",
            previous:    Number(previous?.parts_value ?? 0),
            valueClass:  "text-(--cl-accent-text)",
            valueFormat: formatInr,
        },
    ];

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">
                This vs Previous Month
            </h3>
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-(--cl-text-muted)">
                        <th className="py-1">Metric</th>
                        <th className="py-1 text-right">This Month</th>
                        <th className="py-1 text-right">Prev Month</th>
                        <th className="py-1 text-right">Δ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-(--cl-divider)">
                    {rows.map(row => {
                        const delta = computeDelta(row.current, row.previous);
                        const up    = delta != null && delta > 0;
                        const down  = delta != null && delta < 0;
                        return (
                            <tr key={row.label}>
                                <td className="py-1.5 text-(--cl-text)">{row.label}</td>
                                <td className={cn("py-1.5 text-right font-semibold text-(--cl-text)", row.valueClass)}>
                                    {row.valueFormat(row.current)}
                                </td>
                                <td className="py-1.5 text-right text-(--cl-text-muted)">
                                    {row.valueFormat(row.previous)}
                                </td>
                                <td className="py-1.5 text-right">
                                    {delta == null ? (
                                        <span className="text-(--cl-text-muted)">—</span>
                                    ) : (
                                        <span className={cn(
                                            "inline-flex items-center gap-0.5 font-bold",
                                            up && "text-emerald-600",
                                            down && "text-amber-600",
                                            !up && !down && "text-(--cl-text-muted)",
                                        )}>
                                            {up && <ArrowUpRight className="h-3 w-3" />}
                                            {down && <ArrowDownRight className="h-3 w-3" />}
                                            {!up && !down && <Minus className="h-3 w-3" />}
                                            {delta > 0 ? "+" : ""}{delta}%
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
