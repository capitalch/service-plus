/**
 * Centralized debounce timings.
 * SEARCH_DEBOUNCE_MS - grid/list search inputs and lookup queries.
 * FIELD_VALIDATION_DEBOUNCE_MS - inline field uniqueness/format validation (code, name, email, etc).
 * IDLE_LOGOUT_MS - client mode signs the user out after this long without any input.
 * IDLE_WARNING_MS - how long before the idle logout the warning toast appears.
 * IDLE_CHECK_INTERVAL_MS - how often the idle clock is compared with the last activity.
 */

export const SEARCH_DEBOUNCE_MS = 1600;
export const FIELD_VALIDATION_DEBOUNCE_MS = 1600;
export const IDLE_CHECK_INTERVAL_MS = 30 * 1000;
export const IDLE_LOGOUT_MS = 3 * 60 * 60 * 1000;
export const IDLE_WARNING_MS = 5 * 60 * 1000;
