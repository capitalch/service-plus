import { DatabaseBackup, Headset, IndianRupee, ShieldCheck, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// How onboarding actually works, and facts we can stand behind from the product and pricing
// content. Nothing here claims a customer count, a ranking or a result we cannot prove.

export type OnboardingStepType = {
	description: string;
	icon: LucideIcon;
	title: string;
};

export const onboardingSteps: OnboardingStepType[] = [
	{
		description:
			"Tell us how big the workshop is, what you repair today and what software you are on. We call you back within one business day.",
		icon: IndianRupee,
		title: "You send an enquiry",
	},
	{
		description:
			"We create your business unit and set up job numbering, GST details and roles. Send us your parts list and customer list and we import them for you.",
		icon: DatabaseBackup,
		title: "We set up your account",
	},
	{
		description:
			"Managers, reception and technicians each get their own login with only the screens they need, plus a short walkthrough on the phone or at your shop.",
		icon: UserCog,
		title: "We train your team",
	},
	{
		description:
			"Start on the free Lite plan, or pay the one-time setup fee and go live. We stay on call for as long as you run Service+.",
		icon: Headset,
		title: "You take jobs",
	},
];

export type TrustPointType = {
	description: string;
	icon: LucideIcon;
	label: string;
};

export const trustPoints: TrustPointType[] = [
	{
		description: "Runs in the cloud with daily backups. No server to buy, no installing, no updating.",
		icon: DatabaseBackup,
		label: "Cloud, backed up daily",
	},
	{
		description: "A technician sees their jobs, not your finances. A receptionist cannot change settings.",
		icon: UserCog,
		label: "Role-based access",
	},
	{
		description: "Raise GST or non-GST invoices, receipts and a summary your accountant can use as is.",
		icon: ShieldCheck,
		label: "GST ready",
	},
	{
		description:
			"Unlimited branches and up to 5 business units on Enterprise, on a dedicated database.",
		icon: IndianRupee,
		label: "Scales with you",
	},
];
