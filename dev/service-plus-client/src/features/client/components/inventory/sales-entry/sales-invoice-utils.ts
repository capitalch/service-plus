import type { SalesLineFormItem } from "./sales-invoice-schema";
import type { DocumentSequenceRow } from "@/features/client/types/sales";

export function buildInvoiceNo(seq: DocumentSequenceRow): string {
    return `${seq.prefix}${seq.separator}${String(seq.next_number).padStart(seq.padding, "0")}`;
}

export function calcLine(l: SalesLineFormItem, isIgst: boolean) {
    const aggregate = l.qty * l.unit_price;
    const gst       = l.gst_rate;
    const total     = l.qty * l.unit_price * (1 + gst / 100);
    const taxTotal  = total - aggregate;
    const cgstAmt   = isIgst ? 0 : taxTotal / 2;
    const sgstAmt   = isIgst ? 0 : taxTotal / 2;
    const igstAmt   = isIgst ? taxTotal : 0;
    return { aggregate, cgstAmt, sgstAmt, igstAmt, total };
}

export function computeBackCalcLines(
    currentLines: SalesLineFormItem[],
    targetTotal: number,
    isIgst: boolean,
): SalesLineFormItem[] {
    const currentTotal = currentLines.reduce((s, l) => s + calcLine(l, isIgst).total, 0);
    if (currentTotal <= 0 || Math.abs(targetTotal - currentTotal) < 0.005) return currentLines;
    const scaleFactor = targetTotal / currentTotal;
    const scaled = currentLines.map(l => {
        const newUnitPrice = Math.round(l.unit_price * scaleFactor * 100) / 100;
        const c = calcLine({ ...l, unit_price: newUnitPrice }, isIgst);
        return {
            ...l,
            aggregate_amount: c.aggregate,
            cgst_amount:      c.cgstAmt,
            igst_amount:      c.igstAmt,
            sgst_amount:      c.sgstAmt,
            total_amount:     c.total,
            unit_price:       newUnitPrice,
        };
    });

    // Absorb rounding residual into the last line
    const scaledTotal = scaled.reduce((s, l) => s + calcLine(l, isIgst).total, 0);
    const diff = Math.round((targetTotal - scaledTotal) * 100) / 100;
    if (Math.abs(diff) >= 0.005 && Math.abs(diff) <= 0.10) {
        const last = scaled[scaled.length - 1];
        const gstFactor = 1 + last.gst_rate / 100;
        const newUnitPrice = Math.round((last.unit_price + diff / last.qty / gstFactor) * 100) / 100;
        const c = calcLine({ ...last, unit_price: newUnitPrice }, isIgst);
        scaled[scaled.length - 1] = {
            ...last,
            aggregate_amount: c.aggregate,
            cgst_amount:      c.cgstAmt,
            igst_amount:      c.igstAmt,
            sgst_amount:      c.sgstAmt,
            total_amount:     c.total,
            unit_price:       newUnitPrice,
        };
    }

    return scaled;
}
