import { useMemo } from "react";

import { formatIsoDate, getRange } from "./fiscal";
import type { DateRangeType, RangeKeyType } from "./fiscal";
import { useGenericQuery } from "./use-generic-query";

export type RangeBucketRowType = {
    bucket: string;
    key: RangeKeyType;
    label: string;
    oow_count: number;
    range: DateRangeType;
    total_count: number;
    warranty_count: number;
};

type SplitRowType = {
    oow_count: number;
    total_count: number;
    warranty_count: number;
};

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

export function useRangeMatrix(sqlId: string, fyStartMonth: number, enabled: boolean) {
    const ranges = useMemo(
        () => BUCKETS.map(b => ({ ...b, range: getRange(b.key, new Date(), fyStartMonth) })),
        [fyStartMonth],
    );

    const q0  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[0].range.from),  to: formatIsoDate(ranges[0].range.to)  }, sqlId });
    const q1  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[1].range.from),  to: formatIsoDate(ranges[1].range.to)  }, sqlId });
    const q2  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[2].range.from),  to: formatIsoDate(ranges[2].range.to)  }, sqlId });
    const q3  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[3].range.from),  to: formatIsoDate(ranges[3].range.to)  }, sqlId });
    const q4  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[4].range.from),  to: formatIsoDate(ranges[4].range.to)  }, sqlId });
    const q5  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[5].range.from),  to: formatIsoDate(ranges[5].range.to)  }, sqlId });
    const q6  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[6].range.from),  to: formatIsoDate(ranges[6].range.to)  }, sqlId });
    const q7  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[7].range.from),  to: formatIsoDate(ranges[7].range.to)  }, sqlId });
    const q8  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[8].range.from),  to: formatIsoDate(ranges[8].range.to)  }, sqlId });
    const q9  = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[9].range.from),  to: formatIsoDate(ranges[9].range.to)  }, sqlId });
    const q10 = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) }, sqlId });
    const q11 = useGenericQuery<SplitRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[11].range.from), to: formatIsoDate(ranges[11].range.to) }, sqlId });

    const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11];

    const rows: RangeBucketRowType[] = ranges.map((b, idx) => {
        const r = queries[idx].data?.[0];
        return {
            bucket:         b.label,
            key:            b.key,
            label:          b.label,
            oow_count:      Number(r?.oow_count ?? 0),
            range:          b.range,
            total_count:    Number(r?.total_count ?? 0),
            warranty_count: Number(r?.warranty_count ?? 0),
        };
    });

    const loading = queries.some(q => q.loading);
    const error   = queries.find(q => q.error)?.error ?? null;

    function refetch() {
        queries.forEach(q => q.refetch());
    }

    return { error, loading, refetch, rows };
}
