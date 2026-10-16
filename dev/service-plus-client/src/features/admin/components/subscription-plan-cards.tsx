import { useState } from "react";
import { motion } from "framer-motion";
import { BuildingIcon, CrownIcon, InboxIcon, LayersIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { inr } from "@/components/shared/billing/billing-dates";
import type { BuSubscriptionType } from "@/components/shared/billing/billing-types";
import { MESSAGES } from "@/constants/messages";
import { cn } from "@/lib/utils";

export type SubscriptionPlanFilterType = "all" | "basic" | "lite" | "standard";

type SubscriptionPlanCardsPropsType = {
	onSelect: (filter: SubscriptionPlanFilterType) => void;
	rows: BuSubscriptionType[];
	selected: SubscriptionPlanFilterType;
};

type CardDefType = {
	accent: string;
	filter: SubscriptionPlanFilterType;
	icon: React.ElementType;
	iconBg: string;
	label: string;
	/** Background, border and ring while this card is the selected filter. */
	selectedClass: string;
};

const CARDS: CardDefType[] = [
	{
		accent: "text-slate-700",
		filter: "all",
		icon: LayersIcon,
		iconBg: "bg-slate-100",
		label: "All",
		selectedClass: "border-slate-400 bg-slate-100 ring-2 ring-slate-300",
	},
	{
		accent: "text-sky-600",
		filter: "lite",
		icon: SparklesIcon,
		iconBg: "bg-sky-100",
		label: "Lite",
		selectedClass: "border-sky-300 bg-sky-50 ring-2 ring-sky-200",
	},
	{
		accent: "text-indigo-600",
		filter: "basic",
		icon: BuildingIcon,
		iconBg: "bg-indigo-100",
		label: "Basic",
		selectedClass: "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200",
	},
	{
		accent: "text-violet-600",
		filter: "standard",
		icon: CrownIcon,
		iconBg: "bg-violet-100",
		label: "Standard",
		selectedClass: "border-violet-300 bg-violet-50 ring-2 ring-violet-200",
	},
];

/** The business units a card stands for: every row for All, else those on that plan. */
export function filterSubscriptions(
	rows: BuSubscriptionType[],
	filter: SubscriptionPlanFilterType,
): BuSubscriptionType[] {
	return filter === "all" ? rows : rows.filter((row) => row.plan_code === filter);
}

/** Admin → Subscriptions: one clickable card per plan (and All) with its business-unit count, the
 * monthly fees billed and how many are view-only. Clicking a card filters the grid below; a card
 * with no business units opens a short dialog instead and keeps the current selection. */
export const SubscriptionPlanCards = ({ onSelect, rows, selected }: SubscriptionPlanCardsPropsType) => {
	const [emptyAlertOpen, setEmptyAlertOpen] = useState(false);

	function handleClick(filter: SubscriptionPlanFilterType, count: number) {
		if (count === 0) {
			setEmptyAlertOpen(true);
			return;
		}
		onSelect(filter);
	}

	return (
		<>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{CARDS.map((card) => {
					const cardRows = filterSubscriptions(rows, card.filter);
					const monthly = cardRows.reduce(
						(sum, row) => sum + (row.billing_required ? (row.monthly_fee_paise ?? 0) : 0),
						0,
					);
					const viewOnly = cardRows.filter((row) => row.status === "read_only").length;
					const isSelected = selected === card.filter;
					const Icon = card.icon;

					return (
						<motion.button
							animate={{ opacity: 1, y: 0 }}
							aria-pressed={isSelected}
							className={cn(
								"rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
								isSelected && card.selectedClass,
							)}
							initial={{ opacity: 0, y: 12 }}
							key={card.filter}
							transition={{ duration: 0.25 }}
							type="button"
							onClick={() => handleClick(card.filter, cardRows.length)}
						>
							<div className="mb-3 flex items-center gap-2.5">
								<span
									className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
								>
									<Icon className={`h-4 w-4 ${card.accent}`} />
								</span>
								<span className="text-sm font-semibold text-slate-700">{card.label}</span>
							</div>
							<p className={`text-3xl font-bold ${card.accent}`}>{cardRows.length}</p>
							<p className="mt-0.5 text-xs text-slate-400">Business units</p>
							<div className="mt-3 flex flex-col gap-1 text-xs">
								<div className="flex items-center justify-between">
									<span className="text-slate-500">Monthly fees</span>
									<span className="font-semibold text-slate-700">{inr(monthly)}</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-slate-500">View-only</span>
									<span
										className={cn("font-semibold", viewOnly ? "text-amber-600" : "text-slate-400")}
									>
										{viewOnly}
									</span>
								</div>
							</div>
						</motion.button>
					);
				})}
			</div>

			<Dialog open={emptyAlertOpen} onOpenChange={setEmptyAlertOpen}>
				<DialogContent className="sm:max-w-xs text-center" showCloseButton={false}>
					<DialogHeader className="items-center">
						<span className="mb-1 inline-flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-500">
							<InboxIcon className="size-6" />
						</span>
						<DialogTitle>No business units</DialogTitle>
						<DialogDescription>{MESSAGES.INFO_SUBSCRIPTIONS_PLAN_EMPTY}</DialogDescription>
					</DialogHeader>
					<DialogFooter className="sm:justify-center">
						<Button onClick={() => setEmptyAlertOpen(false)}>OK</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};
