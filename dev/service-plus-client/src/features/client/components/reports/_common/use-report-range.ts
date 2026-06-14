import { useCallback, useMemo, useState } from "react";

import { getRange } from "./fiscal";
import type { DateRangeType, RangeKeyType } from "./fiscal";

type CustomRangeType = { from: Date; to: Date };

type UseReportRangeResultType = {
    customRange: CustomRangeType | null;
    range: DateRangeType;
    rangeKey: RangeKeyType;
    setRange: (key: RangeKeyType, custom?: CustomRangeType) => void;
};

export const useReportRange = (
    fyStartMonth: number,
    defaultKey: RangeKeyType = "thisMonth",
): UseReportRangeResultType => {
    const [rangeKey, setRangeKey]       = useState<RangeKeyType>(defaultKey);
    const [customRange, setCustomRange] = useState<CustomRangeType | null>(null);

    const range = useMemo<DateRangeType>(() => {
        const today = new Date();
        return getRange(rangeKey, today, fyStartMonth, customRange ?? undefined);
    }, [rangeKey, fyStartMonth, customRange]);

    const setRange = useCallback((key: RangeKeyType, custom?: CustomRangeType) => {
        setRangeKey(key);
        setCustomRange(custom ?? null);
    }, []);

    return { customRange, range, rangeKey, setRange };
};
