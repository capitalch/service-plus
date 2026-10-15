import { Check, Star, X } from "lucide-react";

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
	/** The card's button: select the plan and go on to the enquiry form. */
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
		{ included: plan.whatsappPerMonth !== 0, label: whatsappLabel(plan) },
		{ included: plan.inventory, label: plan.inventory ? "Spare-parts inventory" : "No spare-parts inventory" },
		{ included: true, label: businessUnitsLabel(plan, extraBuMonthlyFee) },
		{ included: true, label: branchesLabel(plan) },
		...(plan.provisioning === "database" ? [{ included: true, label: "Dedicated database" }] : []),
	];
}

export const PlanCard = ({ extraBuMonthlyFee, onSelect, plan, selected }: PlanCardPropsType) => {
	const isFree = plan.monthlyPrice === 0;

	// The whole card is clickable to select the plan and scroll to the form.
	return (
		<article
			aria-current={selected ? "true" : undefined}
			tabIndex={0}
			role="button"
			className={cn(
				"relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-300 outline-none focus-visible:ring-3 focus-visible:ring-primary/40 cursor-pointer",
				selected
					? "border-primary shadow-none ring-1 ring-primary"
					: plan.highlighted
						? "border-2 border-primary/20 p-[23px] shadow-md"
						: "border-border shadow-xs hover:shadow-md",
			)}
			onClick={() => onSelect(plan.code)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(plan.code);
				}
			}}
		>
			{plan.highlighted && (
				<span className="bg-gradient-brand text-white absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm">
					<Star aria-hidden className="size-3 fill-current" />
					Most popular
				</span>
			)}

			{selected && (
				<span className="bg-primary text-primary-foreground absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
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
			{/* Two lines on every card, so the feature lists below start level. */}
			<p className="mt-1 min-h-8 text-xs text-muted-foreground">
				{isFree ? (
					"No setup fee"
				) : (
					<>
						{plan.setupFee > 0 && (
							<span className="block">+ {formatInr(plan.setupFee)} one-time setup</span>
						)}
						<span className="block">{plan.setupFee > 0 ? "Both prices exclude GST" : "Excludes GST"}</span>
					</>
				)}
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
				onClick={(e) => {
					e.stopPropagation();
					onSelect(plan.code);
				}}
				type="button"
				variant={selected ? "secondary" : plan.highlighted ? "default" : "outline"}
			>
				{selected ? "Selected" : isFree ? "Start free" : `Choose ${plan.name}`}
			</Button>
		</article>
	);
};
