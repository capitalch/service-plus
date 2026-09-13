import { Clock } from "lucide-react";

import type { EwDashboardType, EwLeadsFilterType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { KpiCard } from "../../reports/common/kpi-card";
import { EW_COLOR_CLASSES, EW_PIPELINE_GROUPS } from "./ew-state-machine";

type Props = {
	data: EwDashboardType;
	onOpen: (title: string, filter: EwLeadsFilterType) => void;
};

/**
 * Lead Pipeline — the brief's grouped counter cards (EW_PIPELINE_GROUPS). Every card opens a
 * drill-down with its filter; the "follow-ups due" chip opens the due In Progress leads.
 */
export const EwPipelineSection = ({ data, onOpen }: Props) => {
	const due = Number(data.follow_ups_due ?? 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				{EW_PIPELINE_GROUPS.map((group) => (
					<div key={group.key} className="rounded-lg border border-(--cl-border) p-3">
						<div className="mb-2 flex items-baseline justify-between gap-2">
							<h3 className="text-xs font-bold uppercase tracking-widest text-(--cl-text)">
								{group.label}
							</h3>
							{group.totalKey && (
								<span className="text-xs text-(--cl-text-muted)">
									{Number(data[group.totalKey] ?? 0)} total
								</span>
							)}
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
							{group.cards.map((card) => {
								const colors = EW_COLOR_CLASSES[card.color];
								return (
									<KpiCard
										key={card.label}
										borderClassName={cn("border-2", colors.border)}
										label={card.label}
										onClick={() =>
											onOpen(
												group.cards.length === 1
													? card.label
													: `${group.label} · ${card.label}`,
												card.filter,
											)
										}
										value={String(Number(data[card.countKey] ?? 0))}
										valueClassName={cn("text-3xl font-bold", colors.text)}
									/>
								);
							})}
						</div>
					</div>
				))}
			</div>

			{due > 0 && (
				<button
					className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
					type="button"
					onClick={() => onOpen("Follow-ups due", { followUpDue: true, state: "IN_PROGRESS" })}
				>
					<Clock className="h-3.5 w-3.5" />
					{due} follow-up{due === 1 ? "" : "s"} due
				</button>
			)}
		</div>
	);
};
