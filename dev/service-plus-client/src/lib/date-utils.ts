import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

// Bounds for raw <input type="date">. A 4-digit max also makes Chrome cap the year box at
// 4 digits; without it a typo like "12024" is accepted and stored, and psycopg then fails
// to load the row (Python dates stop at year 9999).
export const DATE_INPUT_MAX = "9999-12-31";
export const DATE_INPUT_MIN = "1900-01-01";

/**
 * Optional date fields: an empty value is valid. A non-empty value must be a real
 * calendar date in YYYY-MM-DD form with a year from 1900 to 9999.
 */
export function isValidIsoDate(value: string | null | undefined): boolean {
	if (!value) return true;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number);
	if (y < 1900) return false;
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Today's local date as YYYY-MM-DD (toISOString would give the UTC date). */
export function todayIso(): string {
	const now = new Date();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${m}-${d}`;
}

/** Optional date that can't be in the future (e.g. a product's purchase date). */
export const optionalPastDateSchema = z
	.string()
	.refine(isValidIsoDate, MESSAGES.ERROR_INVALID_DATE)
	.refine((v) => !v || v <= todayIso(), MESSAGES.ERROR_PURCHASE_DATE_FUTURE);
