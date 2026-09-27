import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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
	onSelect: (code: PlanCodeType) => void;
	plan: PlanType;
};

type LineType = {
	included: boolean;
	label: string;
};

function planLines(plan: PlanType): LineType[] {
	return [
		{ included: true, label: usersLabel(plan) },
		{ included: true, label: jobsLabel(plan) },
		{ included: plan.whatsappPerMonth > 0, label: whatsappLabel(plan) },
		{ included: plan.inventory, label: plan.inventory ? "Spare-parts inventory" : "No spare-parts inventory" },
		{ included: true, label: businessUnitsLabel(plan) },
		...(plan.provisioning === "database" ? [{ included: true, label: "Dedicated database" }] : []),
	];
}

export const PlanCard = ({ onSelect, plan }: PlanCardPropsType) => {
	const isFree = plan.monthlyPrice === 0;

	return (
		<article
			className={cn(
				"relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-xs",
				plan.highlighted ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border",
			)}
		>
			{plan.highlighted && (
				<Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2" variant="brand">
					Most popular
				</Badge>
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
				{planLines(plan).map((line) => (
					<li
						className={cn("flex items-start gap-2", !line.included && "text-muted-foreground")}
						key={line.label}
					>
						{line.included ? (
							<Check className="mt-0.5 size-4 shrink-0 text-success" />
						) : (
							<X className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
						)}
						{line.label}
					</li>
				))}
			</ul>

			<Button
				className="mt-6 w-full"
				onClick={() => onSelect(plan.code)}
				type="button"
				variant={plan.highlighted ? "default" : "outline"}
			>
				{isFree ? "Start free" : `Choose ${plan.name}`}
			</Button>
		</article>
	);
};
