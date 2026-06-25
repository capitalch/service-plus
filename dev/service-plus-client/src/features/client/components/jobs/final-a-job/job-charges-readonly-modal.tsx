import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtCurrency } from "./final-a-job-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChargesViewPartLine = {
    id: number;
    part_code: string;
    part_name: string;
    qty: number;
    cost_price: number | null;
    selling_price: number | null;
    gst_rate: number | null;
    hsn_code: string | null;
    remarks: string | null;
};

export type ChargesViewChargeLine = {
    id: number;
    charge_name: string;
    ref_no: string | null;
    description: string | null;
    hsn_code: string | null;
    gst_rate: number;
    qty: number;
    cost_price: number;
    selling_price: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    jobNo: string;
    isGst: boolean;
    isWarranty: boolean;
    forceIgst: boolean;
    amount: number | null;
    parts: ChargesViewPartLine[];
    charges: ChargesViewChargeLine[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const thRo = "sticky top-0 z-10 bg-(--cl-surface-2) px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) border-b border-(--cl-border) whitespace-nowrap";
const tdRo = "px-2 py-1.5 text-sm text-(--cl-text) border-b border-(--cl-border)";

function partSaleGst(p: ChargesViewPartLine, isGst: boolean): number {
    const sp = p.selling_price ?? 0;
    const gr = isGst ? (p.gst_rate ?? 0) : 0;
    return sp * (1 + gr / 100);
}

function chargeSaleGst(c: ChargesViewChargeLine, isGst: boolean): number {
    const sp = c.selling_price ?? 0;
    const gr = isGst ? (c.gst_rate ?? 0) : 0;
    return sp * (1 + gr / 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobChargesReadonlyModal({
    open, onClose, jobNo, isGst, isWarranty, forceIgst, amount, parts, charges,
}: Props) {
    if (!open) return null;

    // ── Totals ──────────────────────────────────────────────────────────────
    const partsTotal = parts.reduce((s, p) => s + partSaleGst(p, isGst) * p.qty, 0);
    const partsCostTotal = parts.reduce((s, p) => s + (p.cost_price ?? 0) * p.qty, 0);
    const partsQtyTotal = parts.reduce((s, p) => s + p.qty, 0);
    const partsGstTotal = isGst
        ? parts.reduce((s, p) => s + (p.selling_price ?? 0) * p.qty * (p.gst_rate ?? 0) / 100, 0)
        : 0;
    const partsCgstTotal = forceIgst ? 0 : partsGstTotal / 2;
    const partsSgstTotal = forceIgst ? 0 : partsGstTotal / 2;
    const partsIgstTotal = forceIgst ? partsGstTotal : 0;
    const profitPartsTotal = parts.reduce((s, p) => s + ((p.selling_price ?? 0) - (p.cost_price ?? 0)) * p.qty, 0);

    const chargesTotal = charges.reduce((s, c) => s + chargeSaleGst(c, isGst) * c.qty, 0);
    const chargesCostTotal = charges.reduce((s, c) => s + c.cost_price * c.qty, 0);
    const chargesQtyTotal = charges.reduce((s, c) => s + c.qty, 0);
    const chargesGstTotal = isGst
        ? charges.reduce((s, c) => s + c.selling_price * c.qty * (c.gst_rate ?? 0) / 100, 0)
        : 0;
    const chargesCgstTotal = forceIgst ? 0 : chargesGstTotal / 2;
    const chargesSgstTotal = forceIgst ? 0 : chargesGstTotal / 2;
    const chargesIgstTotal = forceIgst ? chargesGstTotal : 0;
    const profitChargesTotal = charges.reduce((s, c) => s + (c.selling_price - c.cost_price) * c.qty, 0);

    const grandTotal = partsTotal + chargesTotal;
    const effectiveTotal = (amount != null && amount > 0) ? amount : grandTotal;
    const grandQtyTotal = partsQtyTotal + chargesQtyTotal;
    const grandCgstTotal = partsCgstTotal + chargesCgstTotal;
    const grandSgstTotal = partsSgstTotal + chargesSgstTotal;
    const grandIgstTotal = partsIgstTotal + chargesIgstTotal;
    const grandProfitTotal = profitPartsTotal + profitChargesTotal;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-(--cl-border) bg-(--cl-bg) shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-(--cl-border) bg-(--cl-surface) px-5 py-3">
                    <div className="flex items-center gap-3">
                        <h2 className="text-base font-bold text-(--cl-text)">
                            Charges Detail
                        </h2>
                        <span className="font-mono text-sm font-bold text-(--cl-accent)">#{jobNo}</span>
                        {isWarranty && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-950/40 dark:text-red-400">
                                Warranty
                            </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isGst ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                            {isGst ? "GST" : "Non-GST"}
                        </span>
                    </div>
                    <Button
                        className="h-7 w-7 cursor-pointer rounded-full p-0 text-(--cl-text-muted) hover:text-(--cl-text)"
                        size="icon"
                        variant="ghost"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 space-y-5 overflow-y-auto p-5">

                    {/* Parts Used */}
                    <div className="overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface)">
                        <div className="border-b border-(--cl-border) bg-(--cl-surface-2)/60 px-4 py-2.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Parts Used</p>
                        </div>
                        {parts.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-(--cl-text-muted)">No parts recorded.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thRo}>#</th>
                                            <th className={thRo}>Part Code</th>
                                            <th className={`${thRo} w-full`}>Part Name</th>
                                            <th className={thRo}>Remarks</th>
                                            {isGst && !isWarranty && <th className={thRo}>HSN</th>}
                                            {isGst && !isWarranty && <th className={`${thRo} text-right`}>GST%</th>}
                                            <th className={`${thRo} text-right`}>Qty</th>
                                            <th className={`${thRo} text-right`}>Cost</th>
                                            {!isWarranty && <th className={`${thRo} text-right`}>Sale</th>}
                                            {isGst && !isWarranty && <th className={`${thRo} text-right`}>Sale+GST</th>}
                                            <th className={`${thRo} text-right`}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parts.map((p, idx) => {
                                            const gr = p.gst_rate ?? 0;
                                            const sp = p.selling_price ?? 0;
                                            const spg = sp * (1 + (isGst ? gr : 0) / 100);
                                            const amt = isWarranty
                                                ? (p.cost_price ?? 0) * p.qty
                                                : spg * p.qty;
                                            return (
                                                <tr key={p.id} className="hover:bg-(--cl-surface-2)/40 transition-colors">
                                                    <td className={`${tdRo} text-(--cl-text-muted)`}>{idx + 1}</td>
                                                    <td className={`${tdRo} font-mono text-xs font-semibold text-(--cl-accent)`}>{p.part_code}</td>
                                                    <td className={`${tdRo} min-w-[140px]`}>{p.part_name}</td>
                                                    <td className={`${tdRo} text-(--cl-text-muted) text-xs`}>{p.remarks || "—"}</td>
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} font-mono text-xs`}>{p.hsn_code || "—"}</td>
                                                    )}
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>{gr}%</td>
                                                    )}
                                                    <td className={`${tdRo} text-right tabular-nums`}>{fmtCurrency(p.qty)}</td>
                                                    <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(p.cost_price ?? 0)}</td>
                                                    {!isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(sp)}</td>
                                                    )}
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(spg)}</td>
                                                    )}
                                                    <td className={`${tdRo} text-right tabular-nums font-semibold text-(--cl-accent)`}>₹{fmtCurrency(amt)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-(--cl-surface-2)/60">
                                            <td colSpan={100} className="border-t-2 border-(--cl-border) px-2 py-2">
                                                <div className="flex items-center justify-between gap-6">
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        {!isWarranty && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                                                <span className={`tabular-nums text-sm font-semibold ${profitPartsTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                                    {profitPartsTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profitPartsTotal))}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(partsQtyTotal)}</span>
                                                        </div>
                                                        {isGst && !isWarranty && (
                                                            <>
                                                                {forceIgst ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                                                        <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsIgstTotal)}</span>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsCgstTotal)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsSgstTotal)}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Parts Total</span>
                                                        <span className="tabular-nums text-base font-bold text-(--cl-text)">
                                                            ₹{fmtCurrency(isWarranty ? partsCostTotal : partsTotal)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Additional Charges */}
                    <div className="overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface)">
                        <div className="border-b border-(--cl-border) bg-(--cl-surface-2)/60 px-4 py-2.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Additional Charges</p>
                        </div>
                        {charges.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-(--cl-text-muted)">No additional charges recorded.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thRo}>#</th>
                                            <th className={thRo}>Charge Name</th>
                                            <th className={thRo}>Ref No</th>
                                            <th className={`${thRo} w-full`}>Description</th>
                                            {isGst && !isWarranty && <th className={thRo}>HSN</th>}
                                            {isGst && !isWarranty && <th className={`${thRo} text-right`}>GST%</th>}
                                            <th className={`${thRo} text-right`}>Qty</th>
                                            <th className={`${thRo} text-right`}>Cost</th>
                                            {!isWarranty && <th className={`${thRo} text-right`}>Sale</th>}
                                            {isGst && !isWarranty && <th className={`${thRo} text-right`}>Sale+GST</th>}
                                            <th className={`${thRo} text-right`}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {charges.map((c, idx) => {
                                            const gr = c.gst_rate ?? 0;
                                            const sp = c.selling_price ?? 0;
                                            const spg = sp * (1 + (isGst ? gr : 0) / 100);
                                            const amt = isWarranty
                                                ? c.cost_price * c.qty
                                                : spg * c.qty;
                                            return (
                                                <tr key={c.id} className="hover:bg-(--cl-surface-2)/40 transition-colors">
                                                    <td className={`${tdRo} text-(--cl-text-muted)`}>{idx + 1}</td>
                                                    <td className={`${tdRo} font-medium`}>{c.charge_name}</td>
                                                    <td className={`${tdRo} text-xs text-(--cl-text-muted)`}>{c.ref_no || "—"}</td>
                                                    <td className={`${tdRo} min-w-[80px] text-xs text-(--cl-text-muted)`}>{c.description || "—"}</td>
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} font-mono text-xs`}>{c.hsn_code || "—"}</td>
                                                    )}
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>{gr}%</td>
                                                    )}
                                                    <td className={`${tdRo} text-right tabular-nums`}>{fmtCurrency(c.qty)}</td>
                                                    <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(c.cost_price)}</td>
                                                    {!isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(sp)}</td>
                                                    )}
                                                    {isGst && !isWarranty && (
                                                        <td className={`${tdRo} text-right tabular-nums`}>₹{fmtCurrency(spg)}</td>
                                                    )}
                                                    <td className={`${tdRo} text-right tabular-nums font-semibold text-(--cl-accent)`}>₹{fmtCurrency(amt)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-(--cl-surface-2)/60">
                                            <td colSpan={100} className="border-t-2 border-(--cl-border) px-2 py-2">
                                                <div className="flex items-center justify-between gap-6">
                                                    <div className="flex flex-wrap items-center gap-4">
                                                        {!isWarranty && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                                                <span className={`tabular-nums text-sm font-semibold ${profitChargesTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                                    {profitChargesTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profitChargesTotal))}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(chargesQtyTotal)}</span>
                                                        </div>
                                                        {isGst && !isWarranty && (
                                                            <>
                                                                {forceIgst ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                                                        <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesIgstTotal)}</span>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesCgstTotal)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesSgstTotal)}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Charges Total</span>
                                                        <span className="tabular-nums text-base font-bold text-(--cl-text)">
                                                            ₹{fmtCurrency(isWarranty ? chargesCostTotal : chargesTotal)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Grand Summary */}
                    <div className="overflow-hidden rounded-lg border-2 border-(--cl-accent)/30 bg-(--cl-surface)">
                        <div className="flex items-stretch">
                            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3">
                                {!isWarranty && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                        <span className={`tabular-nums text-sm font-semibold ${grandProfitTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                            {grandProfitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(grandProfitTotal))}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(grandQtyTotal)}</span>
                                </div>
                                {isGst && !isWarranty && (
                                    <>
                                        {forceIgst ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                                <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandIgstTotal)}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandCgstTotal)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandSgstTotal)}</span>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Parts</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">
                                        ₹{fmtCurrency(isWarranty ? partsCostTotal : partsTotal)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Charges</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">
                                        ₹{fmtCurrency(isWarranty ? chargesCostTotal : chargesTotal)}
                                    </span>
                                </div>
                            </div>
                            <div className="w-px self-stretch bg-(--cl-border)" />
                            <div className="flex shrink-0 flex-col items-end justify-center gap-1 px-5 py-3">
                                {!isWarranty && grandTotal !== effectiveTotal && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Calculated</span>
                                        <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandTotal)}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide text-(--cl-accent)">
                                        {isWarranty ? "Final Amount" : "Total"}
                                    </span>
                                    <span className="tabular-nums text-xl font-black text-(--cl-text)">
                                        {isWarranty ? "₹0.00" : `₹${fmtCurrency(effectiveTotal)}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
