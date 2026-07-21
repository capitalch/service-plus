import type { ComponentType } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
    accentClassName?: string;
    delta?: number | null;
    deltaLabel?: string;
    icon?: ComponentType<{ className?: string }>;
    label: string;
    loading?: boolean;
    subValue?: string;
    value: string;
};

export const KpiCard = ({
    accentClassName,
    delta,
    deltaLabel,
    icon: Icon,
    label,
    loading = false,
    subValue,
    value,
}: Props) => {
    const trendUp = delta != null && delta > 0;
    const trendDn = delta != null && delta < 0;

    return (
        <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">
                    {label}
                </p>
                {Icon && (
                    <span className={cn("rounded-md bg-(--cl-hover) p-1.5", accentClassName)}>
                        <Icon className="h-3.5 w-3.5" />
                    </span>
                )}
            </div>
            <div className="mt-2 flex items-end gap-2">
                <span className={cn("text-2xl font-light text-(--cl-text)", loading && "opacity-40")}>
                    {loading ? "…" : value}
                </span>
                {!loading && subValue && (
                    <span className="pb-1 text-[11px] text-(--cl-text-muted)">{subValue}</span>
                )}
            </div>
            {!loading && delta != null && (
                <div className="mt-2 flex items-center gap-1 text-[11px]">
                    {trendUp && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                    {trendDn && <TrendingDown className="h-3 w-3 text-amber-500" />}
                    <span className={cn(
                        "font-semibold",
                        trendUp && "text-emerald-600",
                        trendDn && "text-amber-600",
                        !trendUp && !trendDn && "text-(--cl-text-muted)",
                    )}>
                        {delta > 0 ? "+" : ""}{delta}%
                    </span>
                    {deltaLabel && (
                        <span className="text-(--cl-text-muted)">{deltaLabel}</span>
                    )}
                </div>
            )}
        </div>
    );
};
