import { useMemo } from "react";

import { formatIsoDate, getRange } from "./fiscal";
import type { DateRangeType, RangeKeyType } from "./fiscal";
import { useGenericQuery } from "./use-generic-query";

export type CategorySplitType = {
    oow_count:      number;
    profit_amount:  number;
    revenue_amount: number;
    warranty_count: number;
};

export type CategoryBucketFieldType =
    "today" | "yesterday" | "thisWeek" | "prevWeek" | "thisMonth" | "lastMonth"
    | "q1" | "q2" | "q3" | "q4" | "ytd" | "lastYear";

export type CategoryRangeRowType = { category: string } & Record<CategoryBucketFieldType, CategorySplitType>;

type CategoryCountRowType = {
    category_name:   string;
    oow_count:       number;
    profit_amount?:  number;
    revenue_amount?: number;
    total_count:     number;
    warranty_count:  number;
};

const ZERO_SPLIT: CategorySplitType = { oow_count: 0, profit_amount: 0, revenue_amount: 0, warranty_count: 0 };

const BUCKETS: { key: RangeKeyType; label: string }[] = [
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisWeek",  label: "This Week" },
    { key: "prevWeek",  label: "Previous Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "q1",        label: "Q1" },
    { key: "q2",        label: "Q2" },
    { key: "q3",        label: "Q3" },
    { key: "q4",        label: "Q4" },
    { key: "ytd",       label: "Year-to-Date" },
    { key: "lastYear",  label: "Last Year" },
];

export const CATEGORY_BUCKET_COLUMNS: { field: CategoryBucketFieldType; label: string }[] =
    BUCKETS.map(b => ({ field: b.key as CategoryBucketFieldType, label: b.label }));

export function useCategoryRangeMatrix(sqlId: string, fyStartMonth: number, enabled: boolean, rowOrder?: string[]) {
    const ranges = useMemo<{ key: RangeKeyType; label: string; range: DateRangeType }[]>(
        () => BUCKETS.map(b => ({ ...b, range: getRange(b.key, new Date(), fyStartMonth) })),
        [fyStartMonth],
    );

    // React hooks can't be called in a loop — same constraint use-event-tracking-matrix.ts
    // works around, 12 buckets here to match the original row set of this report.
    const q0  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[0].range.from),  to: formatIsoDate(ranges[0].range.to)  }, sqlId });
    const q1  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[1].range.from),  to: formatIsoDate(ranges[1].range.to)  }, sqlId });
    const q2  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[2].range.from),  to: formatIsoDate(ranges[2].range.to)  }, sqlId });
    const q3  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[3].range.from),  to: formatIsoDate(ranges[3].range.to)  }, sqlId });
    const q4  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[4].range.from),  to: formatIsoDate(ranges[4].range.to)  }, sqlId });
    const q5  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[5].range.from),  to: formatIsoDate(ranges[5].range.to)  }, sqlId });
    const q6  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[6].range.from),  to: formatIsoDate(ranges[6].range.to)  }, sqlId });
    const q7  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[7].range.from),  to: formatIsoDate(ranges[7].range.to)  }, sqlId });
    const q8  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[8].range.from),  to: formatIsoDate(ranges[8].range.to)  }, sqlId });
    const q9  = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[9].range.from),  to: formatIsoDate(ranges[9].range.to)  }, sqlId });
    const q10 = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) }, sqlId });
    const q11 = useGenericQuery<CategoryCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[11].range.from), to: formatIsoDate(ranges[11].range.to) }, sqlId });

    const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11];

    // Row axis is dynamic (product categories are tenant-managed, not a fixed enum) —
    // derived from the union of category names seen across all 12 bucket results. Sorted
    // alphabetically by default, or per `rowOrder` when the caller has a fixed, meaningfully
    // ordered enum instead (e.g. job_status.display_order) — either way, a category with
    // zero jobs in every bucket never appears as a row.
    const categorySet = new Set<string>();
    queries.forEach(q => q.data.forEach(r => { if (r.category_name) categorySet.add(r.category_name); }));
    const categories = rowOrder
        ? rowOrder.filter(name => categorySet.has(name))
        : Array.from(categorySet).sort();

    const rows: CategoryRangeRowType[] = categories.map(category => {
        const row = { category } as CategoryRangeRowType;
        BUCKETS.forEach((bucket, idx) => {
            const match = queries[idx].data.find(r => r.category_name === category);
            row[bucket.key as CategoryBucketFieldType] = match
                ? {
                    oow_count:      Number(match.oow_count ?? 0),
                    profit_amount:  Number(match.profit_amount ?? 0),
                    revenue_amount: Number(match.revenue_amount ?? 0),
                    warranty_count: Number(match.warranty_count ?? 0),
                }
                : ZERO_SPLIT;
        });
        return row;
    });

    const loading = queries.some(q => q.loading);
    const error   = queries.find(q => q.error)?.error ?? null;

    function refetch() {
        queries.forEach(q => q.refetch());
    }

    return { error, loading, refetch, rows };
}
