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

export const screenshotGroups: ScreenshotGroupType[] = [
	{
		id: "jobs",
		label: "Jobs",
		shots: [
			shot("job-control", "Job control"),
			shot("new-job", "New job intake"),
			shot("deliver-job", "Deliver a job"),
			shot("receipts", "Receipts"),
		],
	},
	{
		id: "inventory",
		label: "Inventory",
		shots: [
			shot("inventory", "Stock overview"),
			shot("purchase-entry", "Purchase entry"),
			shot("part-finder", "Part finder"),
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
			shot("warranty-trend", "Warranty trend"),
		],
	},
	{
		id: "team",
		label: "Team & accounts",
		shots: [
			shot("technician-scorecard", "Technician scorecard"),
			shot("technician-profit-report", "Technician profit report"),
			shot("cash-register", "Cash register"),
			shot("gst-summary", "GST summary"),
			shot("branches", "Branches"),
		],
	},
];
