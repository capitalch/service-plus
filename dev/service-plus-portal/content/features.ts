import {
	BarChart3,
	Building2,
	MessageCircle,
	Package,
	ReceiptIndianRupee,
	ShieldCheck,
	UserCog,
	Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeatureType = {
	description: string;
	icon: LucideIcon;
	title: string;
};

export type BenefitType = {
	label: string;
	value: string;
};

export const features: FeatureType[] = [
	{
		description:
			"Single and batch job intake, technician assignment, a live job pipeline, finalisation and delivery with printed job sheets.",
		icon: Wrench,
		title: "Job management",
	},
	{
		description:
			"Purchases, stock by branch, part usage on jobs, a part finder and stock reports. Always know what is on the shelf.",
		icon: Package,
		title: "Spare-parts inventory",
	},
	{
		description:
			"Send job received, ready and delivered updates to customers on WhatsApp, straight from the job card.",
		icon: MessageCircle,
		title: "WhatsApp updates",
	},
	{
		description:
			"GST and non-GST invoices, receipts, a cash register and a GST summary your accountant can use as is.",
		icon: ReceiptIndianRupee,
		title: "GST invoicing",
	},
	{
		description:
			"Operations dashboard, revenue, profit, job aging, technician scorecards and warranty trends, all exportable.",
		icon: BarChart3,
		title: "Reports & analytics",
	},
	{
		description: "Run several branches and business units from one login, each with its own numbering and stock.",
		icon: Building2,
		title: "Branches & business units",
	},
	{
		description:
			"Track warranty and out-of-warranty jobs separately, with batch warranty intake for brand service centres.",
		icon: ShieldCheck,
		title: "Warranty jobs",
	},
	{
		description: "Managers, receptionists and technicians each see only what their role allows.",
		icon: UserCog,
		title: "Role-based access",
	},
];

export const benefits: BenefitType[] = [
	{ label: "Cloud based, nothing to install", value: "100%" },
	{ label: "Job statuses tracked end to end", value: "Live" },
	{ label: "Works on desktop, tablet and phone", value: "Any device" },
	{ label: "Made for Indian workshops, GST ready", value: "GST" },
];
