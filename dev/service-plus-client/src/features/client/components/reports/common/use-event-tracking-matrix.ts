import { useMemo } from "react";

import { formatIsoDate, getRange } from "./fiscal";
import type { RangeKeyType } from "./fiscal";
import { useGenericQuery } from "./use-generic-query";

export type EventTrackingRowType = {
    dayBeforeYesterday: number;
    eventName:          string;
    lastMonth:          number;
    lastQuarter:        number;
    lastWeek:           number;
    lastYear:           number;
    thisMonth:          number;
    thisQuarter:        number;
    thisWeek:           number;
    thisYear:           number;
    today:              number;
    yesterday:          number;
};

type EventCountRowType = { count: number; event_name: string };
type BucketFieldType = keyof Omit<EventTrackingRowType, "eventName">;

// Fixed row order — Return/Cancel/Disposed are intentionally not tracked as events
// (see plans/plan.md §2), so they never appear here.
const EVENT_ORDER = ["Received", "Status Change", "Finalize", "Deliver"];

const BUCKETS: { field: BucketFieldType; key: RangeKeyType }[] = [
    { field: "today",              key: "today" },
    { field: "yesterday",          key: "yesterday" },
    { field: "dayBeforeYesterday", key: "dayBeforeYesterday" },
    { field: "thisWeek",           key: "thisWeek" },
    { field: "lastWeek",           key: "prevWeek" },
    { field: "thisMonth",          key: "thisMonth" },
    { field: "lastMonth",          key: "lastMonth" },
    { field: "thisQuarter",        key: "thisQuarter" },
    { field: "lastQuarter",        key: "lastQuarter" },
    { field: "thisYear",           key: "ytd" },
    { field: "lastYear",           key: "lastYear" },
];

export function useEventTrackingMatrix(sqlId: string, fyStartMonth: number, enabled: boolean) {
    const ranges = useMemo(
        () => BUCKETS.map(b => ({ ...b, range: getRange(b.key, new Date(), fyStartMonth) })),
        [fyStartMonth],
    );

    // React hooks can't be called in a loop — same constraint use-range-matrix.ts
    // works around, just 11 buckets here instead of 12.
    const q0  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[0].range.from),  to: formatIsoDate(ranges[0].range.to)  }, sqlId });
    const q1  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[1].range.from),  to: formatIsoDate(ranges[1].range.to)  }, sqlId });
    const q2  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[2].range.from),  to: formatIsoDate(ranges[2].range.to)  }, sqlId });
    const q3  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[3].range.from),  to: formatIsoDate(ranges[3].range.to)  }, sqlId });
    const q4  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[4].range.from),  to: formatIsoDate(ranges[4].range.to)  }, sqlId });
    const q5  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[5].range.from),  to: formatIsoDate(ranges[5].range.to)  }, sqlId });
    const q6  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[6].range.from),  to: formatIsoDate(ranges[6].range.to)  }, sqlId });
    const q7  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[7].range.from),  to: formatIsoDate(ranges[7].range.to)  }, sqlId });
    const q8  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[8].range.from),  to: formatIsoDate(ranges[8].range.to)  }, sqlId });
    const q9  = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[9].range.from),  to: formatIsoDate(ranges[9].range.to)  }, sqlId });
    const q10 = useGenericQuery<EventCountRowType>({ enabled, sqlArgs: { from: formatIsoDate(ranges[10].range.from), to: formatIsoDate(ranges[10].range.to) }, sqlId });

    const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10];

    // Pivot: 11 per-bucket query results (each up to 4 event rows) → 4 event rows,
    // each carrying all 11 bucket counts. Missing event/bucket combos default to 0.
    const rows: EventTrackingRowType[] = EVENT_ORDER.map(eventName => {
        const row = { eventName } as EventTrackingRowType;
        BUCKETS.forEach((bucket, idx) => {
            const match = queries[idx].data.find(r => r.event_name === eventName);
            row[bucket.field] = Number(match?.count ?? 0);
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
