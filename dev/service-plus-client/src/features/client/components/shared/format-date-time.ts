// Display formats for dates and timestamps in client screens (Extended Warranty, internal notes).

/** '13 Sep 2026'; '' for null. */
export function formatDate(value: string | null): string {
	const date = toDate(value);
	return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

/** '13 Sep 2026, 6:30 pm'; '' for null. */
export function formatDateTime(value: string | null): string {
	const date = toDate(value);
	return date
		? date.toLocaleString("en-IN", {
				day: "2-digit",
				hour: "numeric",
				minute: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "";
}

/** Date-only ISO strings are read as local dates, so '2026-09-13' never shifts a day. */
function toDate(value: string | null): Date | null {
	if (!value) return null;
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	const date = dateOnly ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]) : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}
