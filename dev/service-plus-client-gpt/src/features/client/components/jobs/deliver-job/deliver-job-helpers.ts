export const PAGE_SIZE   = 50;

export const PAYMENT_MODES = [
    "Cash", "Card", "UPI", "Cheque", "Online Transfer", "Other",
] as const;

export const thClass =
    "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide " +
    "text-(--cl-text-muted) px-2 py-2 text-left border-b " +
    "border-(--cl-border) bg-(--cl-surface-2)";

export const tdClass =
    "px-2 py-1.5 text-sm text-(--cl-text) border-b border-(--cl-border)";

export function fmtCurrency(n: number | null | undefined): string {
    if (n == null) return "—";
    return `₹${Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ── Invoice eligibility ───────────────────────────────────────────────────────

// Jobs that skip invoice generation:
//   - UNDER_WARRANTY job type  (job_type_code)
//   - RETURN or CANCELLED job status (job_status_code)
//   - Any status that is not DELIVERED_OK or DELIVERED_NOT_OK (job must be delivered first)
export function isJobInvoiceable(jobTypeCode: string, jobStatusCode: string): boolean {
    if (jobTypeCode === "UNDER_WARRANTY") return false;
    if (jobStatusCode === "RETURN" || jobStatusCode === "CANCELLED") return false;
    if (jobStatusCode !== "DELIVERED_OK" && jobStatusCode !== "DELIVERED_NOT_OK") return false;
    return true;
}
