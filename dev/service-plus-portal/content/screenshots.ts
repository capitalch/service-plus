export type ScreenshotType = {
	alt: string;
	caption: string;
	src: string;
};

export type ScreenshotGroupType = {
	id: string;
	label: string;
	shots: ScreenshotType[];
};

function shot(file: string, caption: string): ScreenshotType {
	return { alt: `Service+ ${caption} screen`, caption, src: `/images/screens/${file}.jpg` };
}

// Looks up a shot by its filename (no extension) across every group, for content that
// references a screenshot by name rather than owning its own copy (e.g. content/features.ts).
export function findScreenshot(file: string): ScreenshotType | undefined {
	const target = `/images/screens/${file}.jpg`;
	return screenshotGroups.flatMap((group) => group.shots).find((candidate) => candidate.src === target);
}

export const screenshotGroups: ScreenshotGroupType[] = [
	{
		id: "jobs",
		label: "Jobs",
		shots: [
			shot("job-control", "Job control"),
			shot("new-job", "New job intake"),
			shot("deliver-job", "Deliver a job"),
			shot("receipts", "Receipts"),
			shot("customer-connect", "Customer WhatsApp updates"),
			shot("batch-warranty-jobs", "Batch warranty intake"),
			shot("part-used-job", "Parts used on a job"),
			shot("accounts-posting", "Accounts posting"),
			shot("job-pipeline", "Job pipeline"),
		],
	},
	{
		id: "inventory",
		label: "Inventory",
		shots: [
			shot("inventory", "Stock overview"),
			shot("purchase-entry", "Purchase entry"),
			shot("part-finder", "Part finder"),
			shot("stock-adjustment", "Stock adjustment"),
			shot("branch-transfer", "Branch stock transfer"),
			shot("vendor-supplier", "Vendors & suppliers"),
			shot("products", "Product categories"),
			shot("brands", "Brands"),
		],
	},
	{
		id: "reports",
		label: "Reports",
		shots: [
			shot("dashboard", "Operations dashboard"),
			shot("revenue-report", "Revenue report"),
			shot("profit-summary", "Profit summary"),
			shot("job-pipeline-report", "Job pipeline and aging"),
			shot("job-status-trend", "Job status trend"),
			shot("event-tracking", "Event tracking"),
			shot("job-transaction-ledger", "Job transaction ledger"),
			shot("jobs-summary", "Jobs summary"),
			shot("delivered-jobs-detailed", "Delivered jobs, detailed"),
			shot("technician-scorecard", "Technician scorecard"),
			shot("technician-profit-report", "Technician profit report"),
			shot("technician-profit-revenue", "Technician profit & revenue"),
			shot("cash-register", "Cash register"),
			shot("gst-summary", "GST summary"),
		],
	},
	{
		id: "warranty",
		label: "Warranty",
		shots: [
			shot("warranty-jobs", "Warranty jobs"),
			shot("warranty-parts", "Warranty parts consumed"),
			shot("warranty-trend", "Warranty trend"),
			shot("extended-warranty", "Extended warranty leads"),
			shot("extended-warranty-leads", "Extended warranty pipeline"),
		],
	},
	{
		id: "setup",
		label: "Setup",
		shots: [
			shot("branch-switcher", "Switching branches"),
			shot("customers", "Customer master"),
			shot("technicians", "Technician master"),
			shot("numbering-auto-series", "Document numbering"),
			shot("whatsapp-notifications", "WhatsApp notification settings"),
			shot("post-unpost", "Post to accounts"),
		],
	},
];
