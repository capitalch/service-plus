import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	branchesLabel,
	businessUnitsLabel,
	formatInr,
	jobsLabel,
	type PlanCodeType,
	type PlanType,
	usersLabel,
	whatsappLabel,
} from "@/content/pricing";
import { cn } from "@/lib/utils";

type PlanCardPropsType = {
	extraBuMonthlyFee: number;
	onSelect: (code: PlanCodeType) => void;
	plan: PlanType;
	/** Set once this card has been chosen, so the grid shows what the form below is set to. */
	selected?: boolean;
};

type LineType = {
	included: boolean;
	label: string;
};

function planLines(plan: PlanType, extraBuMonthlyFee: number): LineType[] {
	return [
		{ included: true, label: usersLabel(plan) },
		{ included: true, label: jobsLabel(plan) },
		{ included: true, label: "GST & non-GST billing" },
		{ included: plan.whatsappPerMonth > 0, label: whatsappLabel(plan) },
		{ included: plan.inventory, label: plan.inventory ? "Spare-parts inventory" : "No spare-parts inventory" },
		{ included: true, label: businessUnitsLabel(plan, extraBuMonthlyFee) },
		{ included: true, label: branchesLabel(plan) },
		...(plan.provisioning === "database" ? [{ included: true, label: "Dedicated database" }] : []),
	];
}

export const PlanCard = ({ extraBuMonthlyFee, onSelect, plan, selected }: PlanCardPropsType) => {
	const isFree = plan.monthlyPrice === 0;

	return (
		<article
			aria-current={selected ? "true" : undefined}
			className={cn(
				"relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-xs transition-all duration-300",
				// A chosen plan needs to be obvious: previously the click only scrolled the page and
				// the form's own select was the single source of truth.
				selected
					? "border-primary ring-primary/20 ring-4"
					: plan.highlighted
						? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
						: "border-border hover:-translate-y-0.5 hover:shadow-md",
			)}
		>
			{plan.highlighted && (
				<Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2" variant="brand">
					Most popular
				</Badge>
			)}

			{selected && (
				<span className="bg-primary text-primary-foreground absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
					<Check aria-hidden className="size-3" />
					Selected
				</span>
			)}

			<h3 className="text-lg font-semibold">{plan.name}</h3>
			<p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>

			<p className="mt-5 flex items-baseline gap-1">
				<span className="text-4xl font-extrabold tracking-tight">
					{isFree ? "Free" : formatInr(plan.monthlyPrice)}
				</span>
				{!isFree && <span className="text-sm text-muted-foreground">/ month</span>}
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{plan.setupFee > 0 ? `+ ${formatInr(plan.setupFee)} one-time setup` : "No setup fee"}
			</p>

			<ul className="mt-6 flex-1 space-y-2.5 text-sm">
				{planLines(plan, extraBuMonthlyFee).map((line) => (
					<li
						className={cn("flex items-start gap-2", !line.included && "text-muted-foreground")}
						key={line.label}
					>
						{line.included ? (
							<Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
						) : (
							<X aria-hidden className="text-muted-foreground/70 mt-0.5 size-4 shrink-0" />
						)}
						{line.label}
					</li>
				))}
			</ul>

			<Button
				aria-pressed={selected}
				className="mt-6 w-full"
				onClick={() => onSelect(plan.code)}
				type="button"
				variant={selected ? "secondary" : plan.highlighted ? "default" : "outline"}
			>
				{selected ? "Selected" : isFree ? "Start free" : `Choose ${plan.name}`}
			</Button>
		</article>
	);
};
