import { getPeriodsAgoRange, getRange } from "./fiscal";
import type { DateRangeType, PeriodUnitType, RangeKeyType } from "./fiscal";

export type BucketFieldType =
	| "dayBeforeYesterday"
	| "lastMonth"
	| "lastQuarter"
	| "lastWeek"
	| "lastYear"
	| "thisMonth"
	| "thisQuarter"
	| "thisWeek"
	| "thisYear"
	| "threeDaysAgo"
	| "threeMonthsAgo"
	| "threeQuartersAgo"
	| "threeWeeksAgo"
	| "threeYearsAgo"
	| "today"
	| "twoMonthsAgo"
	| "twoQuartersAgo"
	| "twoWeeksAgo"
	| "twoYearsAgo"
	| "yesterday";

export type BucketDefType = {
	field: BucketFieldType;
	group: string;
	header: string;
	range: (today: Date, fyStart: number) => DateRangeType;
};

function byKey(key: RangeKeyType) {
	return (today: Date, fyStart: number) => getRange(key, today, fyStart);
}

function periodsAgo(unit: PeriodUnitType, offset: number) {
	return (today: Date, fyStart: number) => getPeriodsAgoRange(offset, today, fyStart, unit);
}

// Flat name for places with a single header row (PDF, Excel, drill-down title):
// "Today", "This Week", "Week -1".
export function bucketExportHeader(b: Pick<BucketDefType, "group" | "header">): string {
	if (b.header === "Today") return b.header;
	if (b.header === "This") return `This ${b.group}`;
	return `${b.group} ${b.header}`;
}

// The standard column set shared by Event Tracking and every Jobs Summary tab: a Day / Week /
// Month / Quarter / Year group row over Today|This, -1, -2, -3. The -2 and -3 buckets (other
// than -2 days) have no RangeKeyType, so they come from getPeriodsAgoRange instead of getRange.
export const REPORT_BUCKETS: BucketDefType[] = [
	{ field: "today", group: "Day", header: "Today", range: byKey("today") },
	{ field: "yesterday", group: "Day", header: "-1", range: byKey("yesterday") },
	{ field: "dayBeforeYesterday", group: "Day", header: "-2", range: byKey("dayBeforeYesterday") },
	{ field: "threeDaysAgo", group: "Day", header: "-3", range: periodsAgo("day", 3) },
	{ field: "thisWeek", group: "Week", header: "This", range: byKey("thisWeek") },
	{ field: "lastWeek", group: "Week", header: "-1", range: byKey("prevWeek") },
	{ field: "twoWeeksAgo", group: "Week", header: "-2", range: periodsAgo("week", 2) },
	{ field: "threeWeeksAgo", group: "Week", header: "-3", range: periodsAgo("week", 3) },
	{ field: "thisMonth", group: "Month", header: "This", range: byKey("thisMonth") },
	{ field: "lastMonth", group: "Month", header: "-1", range: byKey("lastMonth") },
	{ field: "twoMonthsAgo", group: "Month", header: "-2", range: periodsAgo("month", 2) },
	{ field: "threeMonthsAgo", group: "Month", header: "-3", range: periodsAgo("month", 3) },
	{ field: "thisQuarter", group: "Quarter", header: "This", range: byKey("thisQuarter") },
	{ field: "lastQuarter", group: "Quarter", header: "-1", range: byKey("lastQuarter") },
	{ field: "twoQuartersAgo", group: "Quarter", header: "-2", range: periodsAgo("quarter", 2) },
	{ field: "threeQuartersAgo", group: "Quarter", header: "-3", range: periodsAgo("quarter", 3) },
	{ field: "thisYear", group: "Year", header: "This", range: byKey("ytd") },
	{ field: "lastYear", group: "Year", header: "-1", range: byKey("lastYear") },
	{ field: "twoYearsAgo", group: "Year", header: "-2", range: periodsAgo("year", 2) },
	{ field: "threeYearsAgo", group: "Year", header: "-3", range: periodsAgo("year", 3) },
];
