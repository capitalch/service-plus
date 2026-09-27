// Mirrors service-plus-client src/lib/mobile.ts and src/lib/gstin.ts, so the portal accepts
// exactly what the app accepts.

// 10-digit Indian mobile number (starts 6-9).
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

// 15-character GSTIN: 2-digit state code, 5 letters, 4 digits, 1 letter, 1 entity char, 'Z', checksum.
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Strip non-digits and a leading 91/+91 prefix, keep 10 digits. */
export function normalizeMobile(value: string | null | undefined): string {
	let v = (value ?? "").replace(/\D/g, "");
	if (v.length > 10 && v.startsWith("91")) v = v.slice(2);
	return v.slice(0, 10);
}

export function normalizeGstin(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}
