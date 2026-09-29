import { features } from "@/content/features";
import { plans } from "@/content/pricing";
import { screenshotGroups } from "@/content/screenshots";

export type StatType = {
	label: string;
	suffix?: string;
	value: number;
};

// Every number here is derived from the content files rather than typed in, so the stat bar
// cannot drift out of step with the product. Nothing here is a customer count, a ranking or a
// claimed result — it is a count of what actually ships.
const enterprise = plans.find((plan) => plan.code === "enterprise");

export const stats: StatType[] = [
	{
		label: "Screens in the app, from intake to invoice",
		value: screenshotGroups.reduce((total, group) => total + group.shots.length, 0),
	},
	{
		label: "Feature areas the product covers",
		value: features.length,
	},
	{
		label: "Plans, the first one free forever",
		value: plans.length,
	},
	{
		label: "Business units on a dedicated database",
		value: enterprise?.businessUnits ?? 0,
	},
];
