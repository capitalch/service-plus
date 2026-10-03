// Date helpers for the billing screens' previews (plans/plan.md Step 14). The server decides
// every stored date; these only show what it will most likely store.

/** YYYY-MM-DD of today in the browser's timezone. */
export function todayIso(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parse(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** `iso` moved forward by calendar months, clamped to the month's last day (as the server). */
export function addMonths(iso: string, months: number): string {
	const start = parse(iso);
	const index = start.getUTCMonth() + months;
	const year = start.getUTCFullYear() + Math.floor(index / 12);
	const month = index % 12;
	const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return format(new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), last))));
}

/** The paid-through date after paying `months` months: counted from the later of the current
 * paid-through and yesterday (mirrors app.core.billing.extend_paid_through). */
export function previewPaidThrough(paidThrough: string | null, months: number): string {
	const yesterday = format(new Date(parse(todayIso()).getTime() - 86400000));
	const start = paidThrough && paidThrough > yesterday ? paidThrough : yesterday;
	return addMonths(start, months);
}

/** True when a date is more than 60 months after today (the prepaid cap). */
export function beyondPrepaidCap(iso: string): boolean {
	return iso > addMonths(todayIso(), 60);
}

/** "2 years" for whole years, else "5 months". */
export function periodText(months: number): string {
	if (months % 12 === 0) {
		const years = months / 12;
		return years === 1 ? "1 year" : `${years} years`;
	}
	return months === 1 ? "1 month" : `${months} months`;
}

export function displayDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	const d = parse(iso.slice(0, 10));
	return Number.isNaN(d.getTime())
		? iso
		: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" });
}

export function inr(paise: number | null | undefined): string {
	return `₹${((paise ?? 0) / 100).toLocaleString("en-IN")}`;
}
