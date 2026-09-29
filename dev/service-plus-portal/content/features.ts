import {
	BarChart3,
	Building2,
	Gauge,
	Lock,
	MessageCircle,
	Package,
	ReceiptIndianRupee,
	ShieldCheck,
	TrendingUp,
	UserCog,
	Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeatureType = {
	/** Slug used as the section id on /features, so the home cards can deep-link to one feature. */
	anchor: string;
	description: string;
	detail: string;
	highlights: string[];
	icon: LucideIcon;
	screenshotFiles: string[];
	title: string;
};

export type OwnerBenefitType = {
	description: string;
	icon: LucideIcon;
	title: string;
};

export const features: FeatureType[] = [
	{
		description:
			"Single and batch job intake, technician assignment, a live job pipeline, finalisation and delivery with printed job sheets.",
		detail: "Every repair starts as a job card: device details, reported problem, estimate and technician, all captured in one intake screen. A live pipeline shows where each job stands, from received to delivered, and a printed job sheet goes out at intake and at delivery.",
		highlights: [
			"Single and batch (bulk) job intake",
			"Live job pipeline with status at a glance",
			"Technician assignment and reassignment",
			"Printed job sheets at intake and delivery",
		],
		icon: Wrench,
		screenshotFiles: ["job-control", "new-job", "deliver-job"],
		anchor: "job-management",
		title: "Job management",
	},
	{
		description:
			"Purchases, stock by branch, part usage on jobs, a part finder and stock reports. Always know what is on the shelf.",
		detail: "Record purchases, track stock branch by branch, and consume parts straight against a job so stock and job cost stay in sync automatically. A part finder saves the receptionist a call to the technician just to check what's on the shelf.",
		highlights: [
			"Purchase entry with supplier and batch tracking",
			"Stock by branch, not just one combined number",
			"Part usage posts straight from the job card",
			"Part finder for quick stock lookups",
		],
		icon: Package,
		screenshotFiles: ["inventory", "purchase-entry", "part-finder"],
		anchor: "spare-parts-inventory",
		title: "Spare-parts inventory",
	},
	{
		description:
			"Send job received, ready and delivered updates to customers on WhatsApp, straight from the job card.",
		detail: "Customers get a WhatsApp message the moment a job is received, ready for pickup, or delivered, with no separate app for them to install. Messages send straight from the job card, so the front desk never has to leave the screen they're already on.",
		highlights: [
			"Automatic received / ready / delivered messages",
			"Sent straight from the job card, no extra steps",
			"No app for the customer to install",
			"Usage counted against your plan's monthly quota",
		],
		icon: MessageCircle,
		screenshotFiles: ["whatsapp-notifications", "customer-connect"],
		anchor: "whatsapp-updates",
		title: "WhatsApp updates",
	},
	{
		description:
			"GST and non-GST invoices, receipts, a cash register and a GST summary your accountant can use as is.",
		detail: "Raise GST or non-GST invoices and receipts straight from a completed job, keep a running cash register, and hand your accountant a GST summary they can use as is, with no reformatting.",
		highlights: [
			"GST and non-GST invoices from a job in one click",
			"Receipts and a running cash register",
			"A GST summary report built for your accountant",
		],
		icon: ReceiptIndianRupee,
		screenshotFiles: ["gst-summary"],
		anchor: "gst-invoicing",
		title: "GST invoicing",
	},
	{
		description:
			"Operations dashboard, revenue, profit, job aging, technician scorecards and warranty trends, all exportable.",
		detail: "An operations dashboard gives owners the day's numbers at a glance; revenue, profit, job-aging and warranty-trend reports go deeper, and a technician scorecard shows who's carrying the workload. Every report exports for your own records.",
		highlights: [
			"Operations dashboard for a daily overview",
			"Revenue, profit and job-aging reports",
			"Technician scorecards",
			"Every report exports",
		],
		icon: BarChart3,
		screenshotFiles: ["dashboard", "revenue-report", "profit-summary"],
		anchor: "reports-analytics",
		title: "Reports & analytics",
	},
	{
		description: "Run several branches and business units from one login, each with its own numbering and stock.",
		detail: "One login covers every branch and business unit you run, and each keeps its own job numbering, stock and reports, so branches never see or affect each other's numbers.",
		highlights: [
			"One login across every branch and business unit",
			"Independent job numbering and stock per unit",
			"Switch between units without logging out",
		],
		icon: Building2,
		screenshotFiles: ["branch-switcher", "branch-transfer"],
		anchor: "branches-business-units",
		title: "Branches & business units",
	},
	{
		description:
			"Track warranty and out-of-warranty jobs separately, with batch warranty intake for brand service centres.",
		detail: "Warranty and out-of-warranty jobs are tracked separately from intake through billing, and a batch warranty-intake flow lets an authorised service centre register several warranty jobs from one brand in a single pass.",
		highlights: [
			"Warranty jobs tracked separately from paid jobs",
			"Batch intake for brand service centres",
			"A dedicated warranty trend report",
		],
		icon: ShieldCheck,
		screenshotFiles: ["warranty-jobs", "warranty-parts", "warranty-trend"],
		anchor: "warranty-jobs",
		title: "Warranty jobs",
	},
	{
		description: "Managers, receptionists and technicians each see only what their role allows.",
		detail: "Managers, receptionists and technicians each get a role-scoped view of the app, so a technician sees the jobs assigned to them rather than the shop's finances, and a receptionist can't touch settings a manager controls.",
		highlights: [
			"Manager, receptionist and technician roles",
			"Each role sees only what it needs",
			"Access rights are set per business unit",
		],
		icon: UserCog,
		screenshotFiles: [],
		anchor: "role-based-access",
		title: "Role-based access",
	},
];

export const ownerBenefits: OwnerBenefitType[] = [
	{
		description:
			"Every part used against a job is logged and costed against that job, so shrinkage shows up immediately instead of hiding in the numbers.",
		icon: Lock,
		title: "Minimise spare-parts pilferage",
	},
	{
		description:
			"Technician scorecards show who repaired what, how fast and how profitably, so you know your team's output at a glance, not at guesswork.",
		icon: Gauge,
		title: "See technician output clearly",
	},
	{
		description:
			"Real-time revenue and profit reports mean decisions about pricing, staffing and stock get made on facts, not a monthly estimate.",
		icon: TrendingUp,
		title: "Know your revenue and profit",
	},
	{
		description:
			"Purchases, usage and stock levels stay in sync automatically, so you always know what's on the shelf and what needs reordering.",
		icon: Package,
		title: "Control your inventory",
	},
];
