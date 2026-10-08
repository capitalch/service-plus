import { useMemo } from "react";

import { formatIsoDate, formatRangeLabel, formatShortDate } from "./fiscal";
import { REPORT_BUCKETS as BUCKETS } from "./report-buckets";
import type { BucketFieldType } from "./report-buckets";
import { useGenericQuery } from "./use-generic-query";

export type EventTrackingRowType = {
	dayBeforeYesterday: number;
	eventName: string;
	lastMonth: number;
	lastQuarter: number;
	lastWeek: number;
	lastYear: number;
	thisMonth: number;
	thisQuarter: number;
	thisWeek: number;
	thisYear: number;
	threeDaysAgo: number;
	threeMonthsAgo: number;
	threeQuartersAgo: number;
	threeWeeksAgo: number;
	threeYearsAgo: number;
	today: number;
	twoMonthsAgo: number;
	twoQuartersAgo: number;
	twoWeeksAgo: number;
	twoYearsAgo: number;
	yesterday: number;
};

type EventCountRowType = { count: number; event_name: string };
export type BucketRangeType = { from: string; to: string };

// Fixed row order — Return/Cancel/Disposed are intentionally not tracked as events
// (see plans/plan.md §2), so they never appear here.
const EVENT_ORDER = ["Received", "Status Change", "Finalize", "Deliver"];

export function useEventTrackingMatrix(sqlId: string, fyStartMonth: number, enabled: boolean) {
	const ranges = useMemo(
		() => BUCKETS.map((b) => ({ field: b.field, range: b.range(new Date(), fyStartMonth) })),
		[fyStartMonth],
	);

	// React hooks can't be called in a loop — same constraint use-range-matrix.ts
	// works around, 20 buckets here instead of 12.
	const q0 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[0].range.from), to: formatIsoDate(ranges[0].range.to) },
		sqlId,
	});
	const q1 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[1].range.from), to: formatIsoDate(ranges[1].range.to) },
		sqlId,
	});
	const q2 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[2].range.from), to: formatIsoDate(ranges[2].range.to) },
		sqlId,
	});
	const q3 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[3].range.from), to: formatIsoDate(ranges[3].range.to) },
		sqlId,
	});
	const q4 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[4].range.from), to: formatIsoDate(ranges[4].range.to) },
		sqlId,
	});
	const q5 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[5].range.from), to: formatIsoDate(ranges[5].range.to) },
		sqlId,
	});
	const q6 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[6].range.from), to: formatIsoDate(ranges[6].range.to) },
		sqlId,
	});
	const q7 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[7].range.from), to: formatIsoDate(ranges[7].range.to) },
		sqlId,
	});
	const q8 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[8].range.from), to: formatIsoDate(ranges[8].range.to) },
		sqlId,
	});
	const q9 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[9].range.from), to: formatIsoDate(ranges[9].range.to) },
		sqlId,
	});
	const q10 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) },
		sqlId,
	});
	const q11 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[11].range.from), to: formatIsoDate(ranges[11].range.to) },
		sqlId,
	});
	const q12 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[12].range.from), to: formatIsoDate(ranges[12].range.to) },
		sqlId,
	});
	const q13 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[13].range.from), to: formatIsoDate(ranges[13].range.to) },
		sqlId,
	});
	const q14 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[14].range.from), to: formatIsoDate(ranges[14].range.to) },
		sqlId,
	});
	const q15 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[15].range.from), to: formatIsoDate(ranges[15].range.to) },
		sqlId,
	});
	const q16 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[16].range.from), to: formatIsoDate(ranges[16].range.to) },
		sqlId,
	});
	const q17 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[17].range.from), to: formatIsoDate(ranges[17].range.to) },
		sqlId,
	});
	const q18 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[18].range.from), to: formatIsoDate(ranges[18].range.to) },
		sqlId,
	});
	const q19 = useGenericQuery<EventCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[19].range.from), to: formatIsoDate(ranges[19].range.to) },
		sqlId,
	});

	const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19];

	// Pivot: 20 per-bucket query results (each up to 4 event rows) → 4 event rows,
	// each carrying all 20 bucket counts. Missing event/bucket combos default to 0.
	const rows: EventTrackingRowType[] = EVENT_ORDER.map((eventName) => {
		const row = { eventName } as EventTrackingRowType;
		BUCKETS.forEach((bucket, idx) => {
			const match = queries[idx].data.find((r) => r.event_name === eventName);
			row[bucket.field] = Number(match?.count ?? 0);
		});
		return row;
	});

	const loading = queries.some((q) => q.loading);
	const error = queries.find((q) => q.error)?.error ?? null;

	function refetch() {
		queries.forEach((q) => q.refetch());
	}

	// Per-bucket date bounds, keyed by field — lets a drill-down dialog re-query
	// the exact same range a clicked cell's count came from.
	const bucketRanges = Object.fromEntries(
		ranges.map((r) => [r.field, { from: formatIsoDate(r.range.from), to: formatIsoDate(r.range.to) }]),
	) as Record<BucketFieldType, BucketRangeType>;

	// Header tooltips: the exact dates behind each column, one date for a single day.
	const bucketTitles = Object.fromEntries(
		ranges.map((r) => [
			r.field,
			formatIsoDate(r.range.from) === formatIsoDate(r.range.to)
				? formatShortDate(r.range.from)
				: formatRangeLabel(r.range.from, r.range.to),
		]),
	) as Record<BucketFieldType, string>;

	return { bucketRanges, bucketTitles, error, loading, refetch, rows };
}
