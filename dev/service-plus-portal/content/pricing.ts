// The single source for plans, prices and limits. Plan cards, the comparison table, the enquiry
// form and the JSON-LD all render from this file — edit a price here and nowhere else.

export type PlanCodeType = "basic" | "enterprise" | "lite" | "standard";

export type PlanType = {
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
		businessUnits: 1,
		code: "lite",
		inventory: false,
		jobsPerMonth: 50,
		monthlyPrice: 0,
		name: "Lite",
		provisioning: "bu",
		setupFee: 0,
		tagline: "For a one-person shop getting started",
		users: "single",
		whatsappPerMonth: 0,
	},
	{
		businessUnits: 1,
		code: "basic",
		inventory: false,
		jobsPerMonth: 100,
		monthlyPrice: 2999,
		name: "Basic",
		provisioning: "bu",
		setupFee: 2000,
		tagline: "Keep customers updated on WhatsApp",
		users: "single",
		whatsappPerMonth: 100,
	},
	{
		businessUnits: 1,
		code: "standard",
		highlighted: true,
		inventory: true,
		jobsPerMonth: 500,
		monthlyPrice: 5999,
		name: "Standard",
		provisioning: "bu",
		setupFee: 2000,
		tagline: "A full team with spare-parts inventory",
		users: "multi",
		whatsappPerMonth: 500,
	},
	{
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

export function businessUnitsLabel(plan: PlanType): string {
	return plan.businessUnits === 1 ? "1 business unit" : `${plan.businessUnits} business units`;
}
