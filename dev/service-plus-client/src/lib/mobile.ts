// Canonical 10-digit Indian mobile number pattern (starts 6-9).
export const MOBILE_REGEX = /^[6-9]\d{9}$/;

/**
 * Strip non-digits and a leading 91/+91 country-code prefix, keep 10 digits.
 * Uses `length > 10` (not `=== 12`) so it also normalizes correctly while a
 * field is being typed character-by-character and re-written on every
 * keystroke — an exact 12-digit match would never be reachable mid-typing
 * since the field gets capped at 10 digits before the prefix is fully entered.
 */
export function normalizeMobile(value: string | null | undefined): string {
    let v = (value ?? "").replace(/\D/g, "");
    if (v.length > 10 && v.startsWith("91")) v = v.slice(2);
    return v.slice(0, 10);
}

/**
 * Mobile is optional in some forms, so an empty value is valid. A non-empty
 * value must match the normalized 10-digit pattern.
 */
export function isValidMobile(value: string | null | undefined): boolean {
    const v = normalizeMobile(value);
    return v === "" || MOBILE_REGEX.test(v);
}
