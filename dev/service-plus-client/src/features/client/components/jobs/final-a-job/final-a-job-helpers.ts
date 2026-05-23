import type { EditablePartLine } from "./final-a-job-schema";

export const PAGE_SIZE  = 50;
export const DEBOUNCE_MS = 1600;

export const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) px-1.5 py-1.5 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
export const tdClass = "px-1.5 py-1 text-sm text-(--cl-text) border-b border-(--cl-border)";

export function fmtCurrency(n: number): string {
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calculateLinePricing(
    line: EditablePartLine,
    patch: Partial<Pick<EditablePartLine, "selling_price" | "gst_rate" | "cost_price">>,
    isGst: boolean,
): Partial<EditablePartLine> {
    const sp      = parseFloat(patch.selling_price ?? line.selling_price) || 0;
    const gstRate = isGst ? (parseFloat(patch.gst_rate ?? line.gst_rate) || 0) : 0;
    return { ...patch, gst_rate: String(gstRate), sale_pr_gst: (sp * (1 + gstRate / 100)).toFixed(2) };
}
