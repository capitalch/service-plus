import { Check, X } from "lucide-react";

import { formatInr, plans, type PlanType } from "@/content/pricing";
import { cn } from "@/lib/utils";

type RowType = {
	label: string;
	value: (plan: PlanType) => boolean | string;
};

const rows: RowType[] = [
	{ label: "Monthly price", value: (p) => (p.monthlyPrice === 0 ? "Free" : formatInr(p.monthlyPrice)) },
	{ label: "One-time setup", value: (p) => (p.setupFee === 0 ? "—" : formatInr(p.setupFee)) },
	{ label: "Users", value: (p) => (p.users === "single" ? "1" : "Multiple") },
	{ label: "Logins / devices", value: () => "Unlimited" },
	{ label: "Jobs / month", value: (p) => (p.jobsPerMonth === null ? "Unlimited" : String(p.jobsPerMonth)) },
	{
		label: "WhatsApp messages / month",
		value: (p) => (p.whatsappPerMonth === 0 ? false : p.whatsappPerMonth.toLocaleString("en-IN")),
	},
	{ label: "Spare-parts inventory", value: (p) => p.inventory },
	{ label: "Business units", value: (p) => String(p.businessUnits) },
	{ label: "Branches", value: () => "Unlimited" },
	{ label: "Dedicated database", value: (p) => p.provisioning === "database" },
	{ label: "GST & non-GST billing", value: () => true },
	{ label: "Reports & analytics", value: () => true },
];

const Cell = ({ value }: { value: boolean | string }) => {
	if (value === true) return <Check aria-label="Included" className="mx-auto size-4 text-success" />;
	if (value === false) return <X aria-label="Not included" className="mx-auto size-4 text-muted-foreground/70" />;
	return <span>{value}</span>;
};

export const PlanComparisonTable = () => {
	return (
		<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
			<table className="w-full min-w-[40rem] text-sm">
				<caption className="sr-only">Plan comparison</caption>
				<thead>
					<tr className="border-b border-border bg-muted/50">
						<th className="sticky left-0 bg-muted px-4 py-3 text-left font-semibold" scope="col">
							Feature
						</th>
						{plans.map((plan) => (
							<th
								className={cn(
									"px-4 py-3 text-center font-semibold",
									plan.highlighted && "text-primary",
								)}
								key={plan.code}
								scope="col"
							>
								{plan.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr className="border-b border-border last:border-b-0" key={row.label}>
							<th className="sticky left-0 bg-card px-4 py-3 text-left font-medium" scope="row">
								{row.label}
							</th>
							{plans.map((plan) => (
								<td className="px-4 py-3 text-center" key={plan.code}>
									<Cell value={row.value(plan)} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
