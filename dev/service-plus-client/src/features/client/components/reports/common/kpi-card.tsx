import type { ComponentType } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
	accentClassName?: string;
	/** Extra border classes, e.g. a coloured 2px border (merged over the default border). */
	borderClassName?: string;
	delta?: number | null;
	deltaLabel?: string;
	icon?: ComponentType<{ className?: string }>;
	label: string;
	loading?: boolean;
	onClick?: () => void;
	subValue?: string;
	value: string;
	/** Extra classes for the big number, e.g. a larger size or a colour. */
	valueClassName?: string;
};

export const KpiCard = ({
	accentClassName,
	borderClassName,
	delta,
	deltaLabel,
	icon: Icon,
	label,
	loading = false,
	onClick,
	subValue,
	value,
	valueClassName,
}: Props) => {
	const trendUp = delta != null && delta > 0;
	const trendDn = delta != null && delta < 0;

	return (
		<div
			className={cn(
				"rounded-xl border border-(--cl-border) bg-(--cl-surface-2) p-4 transition-all duration-200",
				onClick &&
					"cursor-pointer hover:bg-(--cl-hover) hover:-translate-y-0.5 hover:border-(--cl-accent)/25 hover:shadow-lg active:scale-[0.98]",
				borderClassName,
			)}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			onClick={onClick}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onClick();
							}
						}
					: undefined
			}
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">{label}</p>
				{Icon && (
					<span className={cn("rounded-lg bg-(--cl-hover) p-1.5 ring-1 ring-(--cl-border)", accentClassName)}>
						<Icon className="h-3.5 w-3.5" />
					</span>
				)}
			</div>
			<div className="mt-2 flex items-end gap-2">
				<span
					className={cn(
						"text-2xl font-semibold tracking-tight text-(--cl-text)",
						valueClassName,
						loading && "opacity-40",
					)}
				>
					{loading ? "…" : value}
				</span>
				{!loading && subValue && <span className="pb-1 text-[11px] text-(--cl-text-muted)">{subValue}</span>}
			</div>
			{!loading && delta != null && (
				<div className="mt-2 flex items-center gap-1 text-[11px]">
					{trendUp && <TrendingUp className="h-3 w-3 text-green-600" />}
					{trendDn && <TrendingDown className="h-3 w-3 text-amber-600" />}
					<span
						className={cn(
							"font-semibold",
							trendUp && "text-emerald-600",
							trendDn && "text-amber-600",
							!trendUp && !trendDn && "text-(--cl-text-muted)",
						)}
					>
						{delta > 0 ? "+" : ""}
						{delta}%
					</span>
					{deltaLabel && <span className="text-(--cl-text-muted)">{deltaLabel}</span>}
				</div>
			)}
		</div>
	);
};
