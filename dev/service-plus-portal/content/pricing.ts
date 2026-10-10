// Plans and limits. The prices here are the fallback: lib/plan-prices.ts replaces them in the
// browser with the live list from the server's .env (GET /api/public/plan-prices), so they are
// shown first and kept if that call fails. The JSON-LD and the pre-built HTML always use these —
// update them at the next release after a price change.

export type PlanCodeType = "basic" | "enterprise" | "lite" | "standard";

export type PlanType = {
	/** null = unlimited. Lite, Basic and Standard are limited to the head office branch only. */
	branches: number | null;
	businessUnits: number;
	code: PlanCodeType;
	/** Marked "Most popular" on its card. */
	highlighted?: boolean;
	inventory: boolean;
	/** null = unlimited. */
	jobsPerMonth: number | null;
	/** 0 = free. INR. */
	monthlyPrice: number;
	name: string;
	/** Enterprise gets its own database; the rest get a business unit in a shared one. */
	provisioning: "bu" | "database";
	/** One-time, INR. */
	setupFee: number;
	tagline: string;
	users: "multi" | "single";
	/** 0 = not included. */
	whatsappPerMonth: number;
};

export const plans: PlanType[] = [
	{
		branches: 1,
		businessUnits: 1,
		code: "lite",
		inventory: true,
		jobsPerMonth: 100,
		monthlyPrice: 0,
		name: "Lite",
		provisioning: "bu",
		setupFee: 0,
		tagline: "For a one-person shop getting started",
		users: "single",
		whatsappPerMonth: 20,
	},
	{
		branches: 1,
		businessUnits: 1,
		code: "basic",
		inventory: true,
		jobsPerMonth: 200,
		monthlyPrice: 2999,
		name: "Basic",
		provisioning: "bu",
		setupFee: 2000,
		tagline: "A WhatsApp update on every job",
		users: "single",
		whatsappPerMonth: 200,
	},
	{
		branches: 1,
		businessUnits: 1,
		code: "standard",
		highlighted: true,
		inventory: true,
		jobsPerMonth: 500,
		monthlyPrice: 5999,
		name: "Standard",
		provisioning: "bu",
		setupFee: 2000,
		tagline: "A full team, each with their own login",
		users: "multi",
		whatsappPerMonth: 500,
	},
	{
		branches: null,
		businessUnits: 5,
		code: "enterprise",
		inventory: true,
		jobsPerMonth: null,
		monthlyPrice: 10999,
		name: "Enterprise",
		provisioning: "database",
		setupFee: 5000,
		tagline: "Multiple business units on a dedicated database",
		users: "multi",
		whatsappPerMonth: 2000,
	},
];

/** Monthly fee for each Enterprise business unit beyond the included five. INR. Fallback. */
export const extraBuMonthlyFee = 3000;

export const planCodes = plans.map((plan) => plan.code) as [PlanCodeType, ...PlanCodeType[]];

export function findPlan(code: string | null | undefined): PlanType | undefined {
	return plans.find((plan) => plan.code === code);
}

export function formatInr(amount: number): string {
	return `₹${amount.toLocaleString("en-IN")}`;
}

export function jobsLabel(plan: PlanType): string {
	return plan.jobsPerMonth === null ? "Unlimited jobs" : `${plan.jobsPerMonth} jobs / month`;
}

export function usersLabel(plan: PlanType): string {
	return plan.users === "single" ? "1 user, log in from any device" : "Multiple users";
}

export function whatsappLabel(plan: PlanType): string {
	return plan.whatsappPerMonth === 0
		? "No WhatsApp messaging"
		: `${plan.whatsappPerMonth.toLocaleString("en-IN")} WhatsApp messages / month`;
}

export function branchesLabel(plan: PlanType): string {
	return plan.branches === null ? "Unlimited branches" : "1 branch (head office only)";
}

export function businessUnitsLabel(plan: PlanType, extraFee: number = extraBuMonthlyFee): string {
	return plan.businessUnits === 1
		? "1 business unit"
		: `${plan.businessUnits} business units, more at ${formatInr(extraFee)} / month each`;
}
