import { useMemo } from "react";

import { formatIsoDate, formatRangeLabel, formatShortDate } from "./fiscal";
import type { DateRangeType } from "./fiscal";
import { REPORT_BUCKETS, bucketExportHeader } from "./report-buckets";
import type { BucketFieldType } from "./report-buckets";
import { useGenericQuery } from "./use-generic-query";

export type CategorySplitType = {
	oow_count: number;
	profit_amount: number;
	revenue_amount: number;
	warranty_count: number;
};

export type CategoryBucketFieldType = BucketFieldType;

export type CategoryBucketRangeType = { from: string; to: string };

export type CategoryRangeRowType = { category: string } & Record<CategoryBucketFieldType, CategorySplitType>;

type CategoryCountRowType = {
	category_name: string;
	oow_count: number;
	profit_amount?: number;
	revenue_amount?: number;
	total_count: number;
	warranty_count: number;
};

const ZERO_SPLIT: CategorySplitType = { oow_count: 0, profit_amount: 0, revenue_amount: 0, warranty_count: 0 };

export const CATEGORY_BUCKET_COLUMNS: {
	field: CategoryBucketFieldType;
	group: string;
	header: string;
	label: string;
}[] = REPORT_BUCKETS.map((b) => ({ field: b.field, group: b.group, header: b.header, label: bucketExportHeader(b) }));

export function useCategoryRangeMatrix(sqlId: string, fyStartMonth: number, enabled: boolean, rowOrder?: string[]) {
	const ranges = useMemo<{ field: CategoryBucketFieldType; range: DateRangeType }[]>(
		() => REPORT_BUCKETS.map((b) => ({ field: b.field, range: b.range(new Date(), fyStartMonth) })),
		[fyStartMonth],
	);

	// React hooks can't be called in a loop — same constraint use-event-tracking-matrix.ts
	// works around: one query per bucket, 20 of them, in REPORT_BUCKETS order.
	const q0 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[0].range.from), to: formatIsoDate(ranges[0].range.to) },
		sqlId,
	});
	const q1 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[1].range.from), to: formatIsoDate(ranges[1].range.to) },
		sqlId,
	});
	const q2 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[2].range.from), to: formatIsoDate(ranges[2].range.to) },
		sqlId,
	});
	const q3 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[3].range.from), to: formatIsoDate(ranges[3].range.to) },
		sqlId,
	});
	const q4 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[4].range.from), to: formatIsoDate(ranges[4].range.to) },
		sqlId,
	});
	const q5 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[5].range.from), to: formatIsoDate(ranges[5].range.to) },
		sqlId,
	});
	const q6 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[6].range.from), to: formatIsoDate(ranges[6].range.to) },
		sqlId,
	});
	const q7 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[7].range.from), to: formatIsoDate(ranges[7].range.to) },
		sqlId,
	});
	const q8 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[8].range.from), to: formatIsoDate(ranges[8].range.to) },
		sqlId,
	});
	const q9 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[9].range.from), to: formatIsoDate(ranges[9].range.to) },
		sqlId,
	});
	const q10 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) },
		sqlId,
	});
	const q11 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[11].range.from), to: formatIsoDate(ranges[11].range.to) },
		sqlId,
	});

	const q12 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[12].range.from), to: formatIsoDate(ranges[12].range.to) },
		sqlId,
	});
	const q13 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[13].range.from), to: formatIsoDate(ranges[13].range.to) },
		sqlId,
	});
	const q14 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[14].range.from), to: formatIsoDate(ranges[14].range.to) },
		sqlId,
	});
	const q15 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[15].range.from), to: formatIsoDate(ranges[15].range.to) },
		sqlId,
	});
	const q16 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[16].range.from), to: formatIsoDate(ranges[16].range.to) },
		sqlId,
	});
	const q17 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[17].range.from), to: formatIsoDate(ranges[17].range.to) },
		sqlId,
	});
	const q18 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[18].range.from), to: formatIsoDate(ranges[18].range.to) },
		sqlId,
	});
	const q19 = useGenericQuery<CategoryCountRowType>({
		enabled,
		sqlArgs: { from: formatIsoDate(ranges[19].range.from), to: formatIsoDate(ranges[19].range.to) },
		sqlId,
	});

	const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19];

	// Row axis is dynamic (product categories are tenant-managed, not a fixed enum) —
	// derived from the union of category names seen across all 20 bucket results. Sorted
	// alphabetically by default, or per `rowOrder` when the caller has a fixed, meaningfully
	// ordered enum instead (e.g. job_status.display_order) — either way, a category with
	// zero jobs in every bucket never appears as a row.
	const categorySet = new Set<string>();
	queries.forEach((q) =>
		q.data.forEach((r) => {
			if (r.category_name) categorySet.add(r.category_name);
		}),
	);
	const categories = rowOrder ? rowOrder.filter((name) => categorySet.has(name)) : Array.from(categorySet).sort();

	const rows: CategoryRangeRowType[] = categories.map((category) => {
		const row = { category } as CategoryRangeRowType;
		REPORT_BUCKETS.forEach((bucket, idx) => {
			const match = queries[idx].data.find((r) => r.category_name === category);
			row[bucket.field] = match
				? {
						oow_count: Number(match.oow_count ?? 0),
						profit_amount: Number(match.profit_amount ?? 0),
						revenue_amount: Number(match.revenue_amount ?? 0),
						warranty_count: Number(match.warranty_count ?? 0),
					}
				: ZERO_SPLIT;
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
	) as Record<CategoryBucketFieldType, CategoryBucketRangeType>;

	// Header tooltips: the exact dates behind each column, one date for a single day.
	const bucketTitles = Object.fromEntries(
		ranges.map((r) => [
			r.field,
			formatIsoDate(r.range.from) === formatIsoDate(r.range.to)
				? formatShortDate(r.range.from)
				: formatRangeLabel(r.range.from, r.range.to),
		]),
	) as Record<CategoryBucketFieldType, string>;

	return { bucketRanges, bucketTitles, error, loading, refetch, rows };
}
