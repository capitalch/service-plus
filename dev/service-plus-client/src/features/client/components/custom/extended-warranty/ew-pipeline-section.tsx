import { Clock, Inbox } from "lucide-react";

import type { EwDashboardType, EwLeadsFilterType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { KpiCard } from "../../reports/common/kpi-card";
import { EW_COLOR_CLASSES, EW_PIPELINE_GROUPS } from "./ew-state-machine";

/**
 * Layout and tint per group. The five groups make exactly two rows from xl up — New Lead and
 * Message Sent across the first, Interested / In Progress / Closed across the second — over a
 * six-column grid. `cards` is the inner card grid for that box's width and card count, and
 * `tint` is a light wash in the group's own state colour, so the five sections read apart at a
 * glance; the KpiCards inside keep their opaque surface. Literal classes, so Tailwind's
 * scanner sees every one of them.
 */
const GROUP_LAYOUT: Record<string, { cards: string; span: string; tint: string }> = {
	CLOSED: {
		cards: "grid-cols-1 sm:grid-cols-3",
		span: "xl:col-span-3",
		tint: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40",
	},
	IN_PROGRESS: {
		cards: "grid-cols-1 sm:grid-cols-3",
		span: "xl:col-span-2",
		tint: "border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/25",
	},
	INTERESTED: {
		cards: "grid-cols-1",
		span: "xl:col-span-1",
		tint: "border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/25",
	},
	MESSAGE_SENT: {
		cards: "grid-cols-2 sm:grid-cols-4",
		span: "xl:col-span-3",
		tint: "border-indigo-200 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/25",
	},
	NEW_LEAD: {
		cards: "grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6",
		span: "xl:col-span-3",
		tint: "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/25",
	},
};

const FALLBACK_LAYOUT = {
	cards: "grid-cols-2 sm:grid-cols-3",
	span: "xl:col-span-3",
	tint: "border-(--cl-border) bg-(--cl-surface-2)",
};

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
	// Open work spans four groups, so it is a chip rather than a sixth card — a card here would
	// be the only one that double-counts the ones above it. Summed from the four group totals
	// GET_EW_DASHBOARD already returns; there is no is_closed = false count server-side.
	const open =
		Number(data.new_all ?? 0) +
		Number(data.sent_all ?? 0) +
		Number(data.interested ?? 0) +
		Number(data.in_progress_all ?? 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
				{EW_PIPELINE_GROUPS.map((group) => {
					const layout = GROUP_LAYOUT[group.key] ?? FALLBACK_LAYOUT;
					return (
						<div key={group.key} className={cn("rounded-lg border p-3", layout.span, layout.tint)}>
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
							<div className={cn("grid gap-2", layout.cards)}>
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
					);
				})}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{open > 0 && (
					<button
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal-400 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-300"
						type="button"
						onClick={() => onOpen("Open leads", { isClosed: false })}
					>
						<Inbox className="h-3.5 w-3.5" />
						{open} open lead{open === 1 ? "" : "s"}
					</button>
				)}
				{due > 0 && (
					<button
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
						type="button"
						onClick={() => onOpen("Follow-ups due", { followUpDue: true, state: "IN_PROGRESS" })}
					>
						<Clock className="h-3.5 w-3.5" />
						{due} follow-up{due === 1 ? "" : "s"} due
					</button>
				)}
			</div>
		</div>
	);
};
