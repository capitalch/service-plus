"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { SalesEnquiryForm } from "@/components/pricing/sales-enquiry-form";
import { MESSAGES } from "@/constants/messages";
import { formatInr, plans, type PlanCodeType } from "@/content/pricing";
import { cn } from "@/lib/utils";

// /contact has no pricing table above it, so the plan the enquiry API requires is picked here as a
// row of chips. A visitor who has not decided leaves it on Standard and can say so in the message.
// One component owns the state so the chips and the form's own plan select stay in sync.
export const ContactEnquiryForm = () => {
	const [plan, setPlan] = useState<PlanCodeType>("standard");

	return (
		<div>
			<p className="text-sm font-semibold">{MESSAGES.contactPlanQuestion}</p>
			<p className="text-muted-foreground mt-1 text-sm">{MESSAGES.contactPlanHint}</p>

			<div className="mt-4 flex flex-wrap gap-2">
				{plans.map((option) => {
					const selected = option.code === plan;
					return (
						<button
							aria-pressed={selected}
							className={cn(
								"rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
								selected
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
							key={option.code}
							onClick={() => setPlan(option.code)}
							type="button"
						>
							{selected && <Check aria-hidden className="mr-1 inline size-3.5" />}
							{option.name}
							<span className="text-muted-foreground ml-1.5 text-xs">
								{option.monthlyPrice === 0 ? "Free" : `${formatInr(option.monthlyPrice)}/mo`}
							</span>
						</button>
					);
				})}
			</div>

			<div className="relative mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
				<SalesEnquiryForm selectedPlan={plan} />
			</div>
		</div>
	);
};
