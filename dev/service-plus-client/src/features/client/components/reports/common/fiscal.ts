export type RangeKeyType =
    | "custom"
    | "lastMonth"
    | "lastYear"
    | "prevWeek"
    | "q1"
    | "q2"
    | "q3"
    | "q4"
    | "thisMonth"
    | "thisWeek"
    | "today"
    | "yesterday"
    | "ytd";

export type DateRangeType = {
    from: Date;
    key: RangeKeyType;
    label: string;
    to: Date;
};

const MONTH_LABELS: string[] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const RANGE_LABELS: Record<RangeKeyType, string> = {
    custom:    "Custom",
    lastMonth: "Last Month",
    lastYear:  "Last Year",
    prevWeek:  "Previous Week",
    q1:        "Q1",
    q2:        "Q2",
    q3:        "Q3",
    q4:        "Q4",
    thisMonth: "This Month",
    thisWeek:  "This Week",
    today:     "Today",
    yesterday: "Yesterday",
    ytd:       "Year-to-Date",
};

function clampMonth(monthIndex: number): number {
    const m = ((monthIndex % 12) + 12) % 12;
    return m;
}

function endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function endOfMonth(year: number, monthIndex: number): Date {
    return endOfDay(new Date(year, monthIndex + 1, 0));
}

export function formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

export function formatRangeLabel(from: Date, to: Date): string {
    return `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

function formatShortDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

export function getCurrentFiscalYearBounds(today: Date, fyStart: number): DateRangeType {
    const month = today.getMonth();
    const fyStartIdx = clampMonth(fyStart - 1);
    const startYear  = month >= fyStartIdx ? today.getFullYear() : today.getFullYear() - 1;
    const from = startOfDay(new Date(startYear, fyStartIdx, 1));
    const to   = endOfMonth(startYear + 1, clampMonth(fyStartIdx - 1));
    return { from, key: "ytd", label: `FY ${startYear}-${(startYear + 1) % 100}`, to };
}

function getFiscalQuarterBounds(q: 1 | 2 | 3 | 4, today: Date, fyStart: number): DateRangeType {
    const fy = getCurrentFiscalYearBounds(today, fyStart);
    const fyStartIdx = clampMonth(fyStart - 1);
    const startMonthIdx = clampMonth(fyStartIdx + (q - 1) * 3);
    const startYear     = fy.from.getFullYear() + (fyStartIdx + (q - 1) * 3 >= 12 ? 1 : 0);
    const from = startOfDay(new Date(startYear, startMonthIdx, 1));
    const to   = endOfMonth(startYear, clampMonth(startMonthIdx + 2));
    return { from, key: (`q${q}` as RangeKeyType), label: `Q${q}`, to };
}

function getPreviousFiscalYearBounds(today: Date, fyStart: number): DateRangeType {
    const current = getCurrentFiscalYearBounds(today, fyStart);
    const prevFromYear = current.from.getFullYear() - 1;
    const fyStartIdx   = clampMonth(fyStart - 1);
    const from = startOfDay(new Date(prevFromYear, fyStartIdx, 1));
    const to   = endOfMonth(prevFromYear + 1, clampMonth(fyStartIdx - 1));
    return { from, key: "lastYear", label: `FY ${prevFromYear}-${(prevFromYear + 1) % 100}`, to };
}

export function getRange(
    key: RangeKeyType,
    today: Date,
    fyStart: number,
    custom?: { from: Date; to: Date },
): DateRangeType {
    const dayMs = 86_400_000;
    if (key === "custom" && custom) {
        return { from: startOfDay(custom.from), key, label: formatRangeLabel(custom.from, custom.to), to: endOfDay(custom.to) };
    }
    switch (key) {
        case "today":     return { from: startOfDay(today), key, label: RANGE_LABELS.today,     to: endOfDay(today) };
        case "yesterday": {
            const y = new Date(today.getTime() - dayMs);
            return { from: startOfDay(y), key, label: RANGE_LABELS.yesterday, to: endOfDay(y) };
        }
        case "thisWeek": {
            const start = startOfWeek(today);
            const end   = new Date(start.getTime() + 6 * dayMs);
            return { from: start, key, label: RANGE_LABELS.thisWeek, to: endOfDay(end) };
        }
        case "prevWeek": {
            const thisStart = startOfWeek(today);
            const prevStart = new Date(thisStart.getTime() - 7 * dayMs);
            const prevEnd   = new Date(prevStart.getTime() + 6 * dayMs);
            return { from: prevStart, key, label: RANGE_LABELS.prevWeek, to: endOfDay(prevEnd) };
        }
        case "thisMonth": {
            const from = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
            const to   = endOfMonth(today.getFullYear(), today.getMonth());
            return { from, key, label: RANGE_LABELS.thisMonth, to };
        }
        case "lastMonth": {
            const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const from = startOfDay(d);
            const to   = endOfMonth(d.getFullYear(), d.getMonth());
            return { from, key, label: RANGE_LABELS.lastMonth, to };
        }
        case "q1": return getFiscalQuarterBounds(1, today, fyStart);
        case "q2": return getFiscalQuarterBounds(2, today, fyStart);
        case "q3": return getFiscalQuarterBounds(3, today, fyStart);
        case "q4": return getFiscalQuarterBounds(4, today, fyStart);
        case "ytd": {
            const fy = getCurrentFiscalYearBounds(today, fyStart);
            return { from: fy.from, key, label: RANGE_LABELS.ytd, to: endOfDay(today) };
        }
        case "lastYear": return getPreviousFiscalYearBounds(today, fyStart);
        case "custom":   return { from: startOfDay(today), key, label: RANGE_LABELS.custom, to: endOfDay(today) };
    }
}

export function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function startOfWeek(d: Date): Date {
    // Monday-start week (ISO).
    const x = startOfDay(d);
    const dow = x.getDay();
    const diff = (dow + 6) % 7;
    x.setDate(x.getDate() - diff);
    return x;
}
