export const PAGE_SIZE   = 50;
export const DEBOUNCE_MS = 1600;

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
