import { useState, type Dispatch, type SetStateAction } from "react";
import {
    AlertTriangle, ArrowLeft, CheckCheck, CheckCircle2,
    Eye, Loader2, Plus, Radius, RefreshCw, RotateCcw, Trash2, XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MESSAGES } from "@/constants/messages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JobDetailType } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import { PartCodeInput, type PartRow } from "../../inventory/part-code-input";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import {
    type FinalJobRow,
    type EditablePartLine,
    type EditableChargeLine,
    type AdditionalChargeMasterRow,
} from "./final-a-job-schema";
import { fmtCurrency, thClass, tdClass, calculateLinePricing } from "./final-a-job-helpers";
import { ChargeNameCombobox } from "./charge-name-combobox";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { allocateFloored, pickResidualKey, type FloorAllocItem } from "@/lib/back-calc";

// ─── Apply-target helpers (only used in this view) ───────────────────────────

function scaleCharges(
    allCharges: EditableChargeLine[],
    active: EditableChargeLine[],
    newTotal: number,
    isGst: boolean,
): EditableChargeLine[] {
    const items: FloorAllocItem[] = active.map(c => {
        const sp = (parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1);
        const gst = isGst ? sp * (parseFloat(c.gst_rate) || 0) / 100 : 0;
        return { key: c._key, curIncl: sp + gst, floorIncl: 0 };
    });
    const finalIncl = allocateFloored(items, newTotal);
    const pinned = new Set(items.filter(i => finalIncl.get(i.key) === i.floorIncl).map(i => i.key));
    const residualKey = pickResidualKey(active.map(x => x._key), pinned);

    const patch = new Map<string, Pick<EditableChargeLine, "selling_price" | "sale_pr_gst">>();
    let runningTotal = 0;
    active.forEach(c => {
        if (c._key === residualKey) return;
        const qty = parseFloat(c.qty) || 1;
        const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        const spg = (finalIncl.get(c._key) ?? 0) / qty;
        const sp = parseFloat((gstRate > 0 ? spg / multiplier : spg).toFixed(2));
        const saleGst = parseFloat((sp * multiplier).toFixed(2));
        runningTotal += saleGst * qty;
        patch.set(c._key, { selling_price: sp.toFixed(2), sale_pr_gst: saleGst.toFixed(2) });
    });
    const residual = active.find(c => c._key === residualKey)!;
    {
        const qty = parseFloat(residual.qty) || 1;
        const gstRate = isGst ? (parseFloat(residual.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        const saleGstPerUnit = parseFloat((Math.max(0, newTotal - runningTotal) / qty).toFixed(2));
        const sp = parseFloat((gstRate > 0 ? saleGstPerUnit / multiplier : saleGstPerUnit).toFixed(2));
        patch.set(residual._key, { selling_price: sp.toFixed(2), sale_pr_gst: saleGstPerUnit.toFixed(2) });
    }
    return allCharges.map(c => { const p = patch.get(c._key); return p ? { ...c, ...p } : c; });
}

function scaleParts(
    allParts: EditablePartLine[],
    active: EditablePartLine[],
    curTotal: number,
    newTotal: number,
    isGst: boolean,
    allowBelowCost = false,
): EditablePartLine[] {
    if (curTotal <= 0) return allParts;

    const items: FloorAllocItem[] = active.map(l => {
        const gstRate = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        // Selling price is normally floored at cost price (never sell at a loss);
        // callers that have exhausted every other option (charges at zero) can
        // pass allowBelowCost to relax the floor down to ₹0 instead.
        const floorSp = allowBelowCost ? 0 : (parseFloat(l.cost_price) || 0);
        return {
            key: l._key,
            curIncl: (parseFloat(l.sale_pr_gst) || 0) * l.qty,
            floorIncl: floorSp * multiplier * l.qty,
        };
    });
    const finalIncl = allocateFloored(items, newTotal);
    const pinned = new Set(items.filter(i => finalIncl.get(i.key) === i.floorIncl).map(i => i.key));
    const residualKey = pickResidualKey(active.map(x => x._key), pinned);

    const patch = new Map<string, Pick<EditablePartLine, "selling_price" | "sale_pr_gst">>();
    let runningTotal = 0;
    active.forEach(l => {
        if (l._key === residualKey) return;
        const gstRate = isGst ? (parseFloat(l.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        const floor = allowBelowCost ? 0 : (parseFloat(l.cost_price) || 0);
        const spg = (finalIncl.get(l._key) ?? 0) / l.qty;
        const sp = gstRate > 0 ? spg / multiplier : spg;
        const finalSp = parseFloat(Math.max(sp, floor).toFixed(2));
        const saleGst = parseFloat((finalSp * multiplier).toFixed(2));
        runningTotal += saleGst * l.qty;
        patch.set(l._key, { selling_price: finalSp.toFixed(2), sale_pr_gst: saleGst.toFixed(2) });
    });
    const residual = active.find(l => l._key === residualKey)!;
    {
        const gstRate = isGst ? (parseFloat(residual.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        const floor = allowBelowCost ? 0 : (parseFloat(residual.cost_price) || 0);
        const saleGstPerUnit = (newTotal - runningTotal) / residual.qty;
        const sp = gstRate > 0 ? saleGstPerUnit / multiplier : saleGstPerUnit;
        // Round sale_pr_gst (the GST-inclusive amount summed into the saved job
        // total) from the exact residual target FIRST, so it lands on the target
        // to the cent whenever the cost floor allows it; selling_price is then
        // back-derived from that rounded amount, absorbing any sub-paisa
        // remainder instead of it being dropped from sale_pr_gst. When the floor
        // binds, fall back to pinning selling_price at cost and re-deriving
        // sale_pr_gst from the clamped price, same as before — this preserves the
        // existing guarantee that sale_pr_gst never goes negative on an
        // infeasible target.
        const saleGst = sp < floor
            ? parseFloat((floor * multiplier).toFixed(2))
            : parseFloat(saleGstPerUnit.toFixed(2));
        const finalSp = parseFloat(Math.max(saleGst / multiplier, floor).toFixed(2));
        patch.set(residual._key, { selling_price: finalSp.toFixed(2), sale_pr_gst: saleGst.toFixed(2) });
    }
    return allParts.map(l => { const p = patch.get(l._key); return p ? { ...l, ...p } : l; });
}

function computeBackCalc(
    target: number,
    partLines: EditablePartLine[],
    chargeLines: EditableChargeLine[],
    isGst: boolean,
): { newPartLines?: EditablePartLine[]; newChargeLines?: EditableChargeLine[]; wentBelowCost?: boolean } {
    const partsTotal = partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
    const chargesTotal = chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
    const diff = target - partsTotal - chargesTotal;
    if (Math.abs(diff) < 0.005) return {};

    // Step 1: scale part selling prices toward the target, floored at cost price.
    const activeParts = partLines.filter(l => l.part_id !== null);
    let newPartLines: EditablePartLine[] | undefined;
    let remainingDiff = diff;

    if (activeParts.length > 0) {
        const curPartsAmt = activeParts.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
        if (curPartsAmt > 0) {
            newPartLines = scaleParts(partLines, activeParts, curPartsAmt, curPartsAmt + diff, isGst);
            const actualNewPartsTotal = newPartLines.reduce((s, l) => {
                if (l.part_id === null) return s;
                return s + (parseFloat(l.sale_pr_gst) || 0) * l.qty;
            }, 0);
            remainingDiff = target - actualNewPartsTotal - chargesTotal;
            if (Math.abs(remainingDiff) < 0.005) return { newPartLines };
        }
    }

    // Step 2: parts are at cost and the target still isn't reached — absorb the
    // remainder in Additional Charges, down to zero.
    const activeCharges = chargeLines.filter(c => c.charge_name.trim() !== "");
    let newChargeLines: EditableChargeLine[] | undefined;

    if (activeCharges.length > 0) {
        const curChargesAmt = activeCharges.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
        const newChargesAmt = curChargesAmt + remainingDiff;

        if (newChargesAmt >= 0) {
            return {
                newPartLines,
                newChargeLines: scaleCharges(chargeLines, activeCharges, newChargesAmt, isGst),
            };
        }

        // Charges alone can't absorb the rest either — zero them out and carry
        // whatever's left onto parts in step 3 below.
        newChargeLines = chargeLines.map(c =>
            c.charge_name.trim() ? { ...c, selling_price: "0", sale_pr_gst: "0" } : c);
        remainingDiff = newChargesAmt; // still negative: amount left to cut from parts
    }

    // Step 3: parts at cost and charges at zero still don't reach the target —
    // last resort, let part selling prices drop below cost price (at a loss).
    if (Math.abs(remainingDiff) >= 0.005 && activeParts.length > 0) {
        const basisPartLines = newPartLines ?? partLines;
        const basisActiveParts = basisPartLines.filter(l => l.part_id !== null);
        const curAmt = basisActiveParts.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
        if (curAmt > 0) {
            newPartLines = scaleParts(basisPartLines, basisActiveParts, curAmt, curAmt + remainingDiff, isGst, true);
            return { newPartLines, newChargeLines, wentBelowCost: true };
        }
    }

    return { newPartLines, newChargeLines };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type FinalJobFormProps = {
    selectedJob: JobDetailType;
    selectedRow: FinalJobRow;
    receivedTotal: number;
    submitting: boolean;
    loadingDetail: boolean;
    selectedDivisionId: number | null;
    division: DivisionContextType | null;
    isGst: boolean;
    availableDivisions: DivisionContextType[];
    brands: BrandOption[];
    additionalChargeOptions: AdditionalChargeMasterRow[];
    partLines: EditablePartLine[];
    chargeLines: EditableChargeLine[];
    deletedPartIds: number[];
    forceIgst: boolean;
    backCalcTarget: string;
    showPartsInInvoice: boolean;
    gstin: string;
    defaultHsnForSparePart: string;
    defaultHsnForServiceCharge: string;
    viewJobId: number | null;

    setForceIgst: (v: boolean) => void;
    setGstin: (v: string) => void;
    setBackCalcTarget: (v: string) => void;
    setShowPartsInInvoice: (v: boolean) => void;
    setChargeLines: Dispatch<SetStateAction<EditableChargeLine[]>>;
    setPartLines: Dispatch<SetStateAction<EditablePartLine[]>>;
    setViewJobId: (id: number | null) => void;

    onBack: () => void;
    onSave: () => Promise<void>;
    onRefresh: () => Promise<void>;
    onReset: () => void;
    onAddPart: () => void;
    onRemovePart: (key: string, id?: number) => void;
    onUpdatePart: (key: string, patch: Partial<EditablePartLine>) => void;
    onCostChange: (key: string, value: string) => void;
    onPartSelect: (key: string, part: PartRow) => void;
    onAddCharge: () => void;
    onRemoveCharge: (key: string, id?: number) => void;
    onUpdateCharge: (key: string, field: keyof EditableChargeLine, value: string) => void;
    onPatchCharge: (key: string, patch: Partial<EditableChargeLine>) => void;
    onDivisionChange: (id: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalJobForm({
    selectedJob, selectedRow, receivedTotal, submitting, loadingDetail,
    selectedDivisionId, isGst, availableDivisions, brands, additionalChargeOptions,
    partLines, chargeLines, deletedPartIds, forceIgst, backCalcTarget, showPartsInInvoice, gstin,
    defaultHsnForServiceCharge, viewJobId,
    setForceIgst, setGstin, setBackCalcTarget, setShowPartsInInvoice, setChargeLines, setPartLines, setViewJobId,
    onBack, onSave, onRefresh, onReset, onAddPart, onRemovePart, onUpdatePart, onCostChange, onPartSelect,
    onAddCharge, onRemoveCharge, onUpdateCharge, onPatchCharge, onDivisionChange,
}: FinalJobFormProps) {
    const isWarranty = selectedRow.job_type_code === "UNDER_WARRANTY";

    // Persistent (non-toast) warning surfaced when applyBackCalc had to sell parts
    // below cost — stays visible inline until the next successful apply/reset.
    const [belowCostWarning, setBelowCostWarning] = useState<string | null>(null);

    const partsTotal = partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
    const profitTotal = partLines.reduce((s, l) => s + ((parseFloat(l.selling_price) || 0) - (parseFloat(l.cost_price) || 0)) * l.qty, 0);
    const partsQtyTotal = partLines.reduce((s, l) => s + l.qty, 0);
    const partsGstTotal = isGst ? partLines.reduce((s, l) => { const agg = (parseFloat(l.selling_price) || 0) * l.qty; return s + agg * (parseFloat(l.gst_rate) || 0) / 100; }, 0) : 0;
    const partsCgstTotal = forceIgst ? 0 : partsGstTotal / 2;
    const partsSgstTotal = forceIgst ? 0 : partsGstTotal / 2;
    const partsIgstTotal = forceIgst ? partsGstTotal : 0;
    const chargesSaleTotal = chargeLines.reduce((s, c) => s + (parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1), 0);
    const chargesGstTotal = isGst ? chargeLines.reduce((s, c) => { const sp = (parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1); return s + sp * (parseFloat(c.gst_rate) || 0) / 100; }, 0) : 0;
    const chargesAmountTotal = chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
    const chargesCgstTotal = forceIgst ? 0 : chargesGstTotal / 2;
    const chargesSgstTotal = forceIgst ? 0 : chargesGstTotal / 2;
    const chargesIgstTotal = forceIgst ? chargesGstTotal : 0;
    const chargesProfitTotal = chargeLines.reduce((s, c) => s + ((parseFloat(c.selling_price) || 0) - (parseFloat(c.cost_price) || 0)) * (parseFloat(c.qty) || 1), 0);
    const chargesQtyTotal = chargeLines.reduce((s, c) => s + (parseFloat(c.qty) || 1), 0);
    const grandTotal = partsTotal + chargesAmountTotal;
    const grandProfitTotal = profitTotal + chargesProfitTotal;

    // Applies the target amount. Allocation order: part prices down to cost,
    // then Additional Charges down to zero, then — only as a last resort — part
    // prices below cost (at a loss, flagged with a warning). Also warns
    // immediately if the target still isn't fully achievable, rather than only
    // surfacing this via the small "Diff" figure below.
    function applyBackCalc(target: number) {
        const result = computeBackCalc(target, partLines, chargeLines, isGst);
        const finalPartLines = result.newPartLines ?? partLines;
        const finalChargeLines = result.newChargeLines ?? chargeLines;
        if (result.newPartLines) setPartLines(result.newPartLines);
        if (result.newChargeLines) setChargeLines(result.newChargeLines);

        if (result.wentBelowCost) {
            setBelowCostWarning(
                `Target of ₹${target.toFixed(2)} required selling one or more parts below their cost price, after Additional Charges were reduced to zero. Please review the part prices before saving.`
            );
            return;
        }
        setBelowCostWarning(null);

        const achievedTotal = finalPartLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0)
            + finalChargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
        if (Math.abs(achievedTotal - target) >= 0.005) {
            toast.warning(
                `Target of ₹${target.toFixed(2)} isn't fully achievable with the current parts and charges. Achieved ₹${achievedTotal.toFixed(2)} instead.`
            );
        }
    }

    // backCalcTarget is seeded from job.amount on edit-open in final-a-job-section.tsx;
    // do not override it here with the computed grandTotal.
    const grandQtyTotal = partsQtyTotal + chargesQtyTotal;
    const grandCgstTotal = partsCgstTotal + chargesCgstTotal;
    const grandSgstTotal = partsSgstTotal + chargesSgstTotal;
    const grandIgstTotal = partsIgstTotal + chargesIgstTotal;

    // Amount this job will be finalised at — mirrors the total shown in the
    // Grand Summary (back-calc target, else existing job amount, else computed).
    const parsedTarget = parseFloat(backCalcTarget);
    const finalAmount = isWarranty ? 0
        : (backCalcTarget !== "" && !isNaN(parsedTarget) && parsedTarget > 0)
            ? parsedTarget
            : (selectedJob.amount != null && Number(selectedJob.amount) > 0)
                ? Number(selectedJob.amount)
                : grandTotal;
    const excessReceived     = Math.max(0, receivedTotal - finalAmount);
    const showExcessReceived = excessReceived > 0.005;

    return (
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--cl-border) bg-(--cl-surface) py-2">
                    <Button
                        className="h-8 gap-1.5 font-semibold text-(--cl-accent) border border-(--cl-accent) hover:bg-(--cl-accent) hover:text-white transition-colors"
                        disabled={submitting}
                        size="sm"
                        variant="outline"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-(--cl-accent) text-sm">#{selectedJob.job_no}</span>
                        <span className="text-sm font-medium text-(--cl-text)">{selectedJob.customer_name}</span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 leading-none">
                            <span className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">Division</span>
                            <Select
                                value={selectedDivisionId ? String(selectedDivisionId) : ""}
                                onValueChange={v => onDivisionChange(Number(v))}
                                disabled={selectedJob.is_final}
                            >
                                <SelectTrigger className="h-7 w-40 text-xs">
                                    <SelectValue placeholder="Select division" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDivisions.map(d => (
                                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="h-7 w-7 p-0 text-(--cl-text-muted) hover:text-(--cl-accent)"
                            disabled={loadingDetail || submitting}
                            size="icon"
                            title="Refresh from DB"
                            variant="ghost"
                            onClick={() => void onRefresh()}
                        >
                            {loadingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                            className="h-7 gap-1 px-2 text-xs text-amber-700 border border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/30"
                            disabled={submitting}
                            size="sm"
                            title="Reset all prices from master data — keeps all rows"
                            variant="outline"
                            onClick={() => { onReset(); setBelowCostWarning(null); }}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </Button>
                    </div>
                    <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm ${isGst ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                        {isGst
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            : <XCircle className="h-3.5 w-3.5 text-amber-600" />
                        }
                        <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGst ? "text-emerald-700" : "text-amber-700"}`}>
                            {isGst ? "GST" : "Non-GST"}
                        </span>
                    </div>
                    <Button
                        className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider disabled:opacity-40"
                        disabled={submitting}
                        onClick={() => void onSave()}
                    >
                        {submitting
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <CheckCheck className="h-3.5 w-3.5" />
                        }
                        Save &amp; Mark Final
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-5 py-4">

                    {/* Warranty banner */}
                    {isWarranty && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            Warranty job — only cost prices are recorded; selling prices and final amount are ₹0.
                        </div>
                    )}

                    {/* Excess payment banner — receipts already exceed the final amount */}
                    {showExcessReceived && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Payments already received (<strong>₹{fmtCurrency(receivedTotal)}</strong>) exceed this job&apos;s final amount (<strong>₹{fmtCurrency(finalAmount)}</strong>) by <strong>₹{fmtCurrency(excessReceived)}</strong>. {MESSAGES.WARN_EXCESS_PAYMENT_ACCOUNTING}
                            </span>
                        </div>
                    )}

                    {/* Job Summary */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-4 py-4">
                        <div className="mb-3 flex items-center gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-(--cl-text-muted)">Job Summary</p>
                            <button
                                type="button"
                                className="flex items-center gap-1 text-[10px] font-medium text-(--cl-accent) hover:underline cursor-pointer"
                                onClick={() => setViewJobId(selectedJob.id)}
                            >
                                <Eye className="h-3 w-3" />
                                View Details
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {([
                                ["Job No", selectedJob.alternate_job_no ? `${selectedJob.job_no} · Alt: ${selectedJob.alternate_job_no}` : selectedJob.job_no],
                                ["Job Date", selectedJob.job_date],
                                ["Customer", `${selectedJob.customer_name ?? "—"}${selectedJob.mobile ? ` · ${selectedJob.mobile}` : ""}`],
                                ["Technician", selectedJob.technician_name ?? "—"],
                                ["Job Type", selectedJob.job_type_name],
                                ["Status", selectedJob.job_status_name],
                                ["Amount / Estimate", `${selectedJob.amount != null ? `₹${Number(selectedJob.amount).toFixed(2)}` : "—"}  ·  Est: ${selectedJob.estimate_amount != null ? `₹${Number(selectedJob.estimate_amount).toFixed(2)}` : "—"}`],
                            ] as [string, string][]).map(([lbl, val]) => (
                                <div key={lbl}>
                                    <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">{lbl}</p>
                                    <p className="text-sm font-medium text-(--cl-text)">{val}</p>
                                </div>
                            ))}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-(--cl-text-muted)">GSTIN</p>
                                <Input
                                    className={`mt-0.5 h-7 bg-white text-xs font-mono uppercase ${gstin && !isValidGstin(gstin) ? "border-red-400" : "border-(--cl-border)"}`}
                                    placeholder="15-character GSTIN (optional)"
                                    maxLength={15}
                                    value={gstin}
                                    onChange={e => setGstin(normalizeGstin(e.target.value))}
                                />
                                {gstin && !isValidGstin(gstin) && (
                                    <p className="mt-0.5 text-[10px] text-red-500">Enter a valid 15-character GSTIN</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Parts Used */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-(--cl-border) bg-(--cl-surface-2)/60 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Parts Used</p>
                            <div className="flex items-center gap-5">
                                {isGst && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={forceIgst}
                                            className="h-4 w-4 accent-(--cl-accent) cursor-pointer"
                                            onChange={e => setForceIgst(e.target.checked)}
                                        />
                                        <span className="text-xs font-semibold text-(--cl-text-muted)">Force IGST</span>
                                    </label>
                                )}
                                {!isWarranty && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showPartsInInvoice}
                                            className="h-4 w-4 accent-(--cl-accent) cursor-pointer"
                                            onChange={e => setShowPartsInInvoice(e.target.checked)}
                                        />
                                        <span className="text-xs font-semibold text-(--cl-text-muted)">Show part / charge details in invoice</span>
                                    </label>
                                )}
                            </div>
                        </div>
                        {partLines.length === 0 && (
                            <div className="flex items-center justify-center py-6">
                                <Button
                                    className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                    size="sm"
                                    variant="outline"
                                    onClick={onAddPart}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Part
                                </Button>
                            </div>
                        )}
                        {partLines.length > 0 && (
                            <div className="flex flex-col gap-1 bg-white">
                                {partLines.map((line, idx) => {
                                    const costAmt = (parseFloat(line.cost_price) || 0) * line.qty;
                                    // sale_pr_gst already encodes GST (or not) per the job's division
                                    const saleAmt = isWarranty ? 0 : (parseFloat(line.sale_pr_gst) || 0) * line.qty;
                                    const profit = ((parseFloat(line.selling_price) || 0) - (parseFloat(line.cost_price) || 0)) * line.qty;
                                    return (
                                        <div key={line._key} className="px-1 py-3 space-y-2.5 bg-(--cl-surface) hover:bg-(--cl-surface-2)/50 transition-colors">
                                            {/* Identity row */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="w-5 shrink-0 text-center text-xs font-semibold text-(--cl-text-muted)">{idx + 1}</span>
                                                <div className="w-36 shrink-0">
                                                    <Select
                                                        value={line.brand_id ? String(line.brand_id) : ""}
                                                        onValueChange={v => onUpdatePart(line._key, { brand_id: Number(v), part_id: null, part_code: "", part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0" })}
                                                    >
                                                        <SelectTrigger className="h-7 text-xs bg-transparent border-(--cl-border)">
                                                            <SelectValue placeholder="Brand" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {brands.map(b => (
                                                                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="w-56 shrink-0">
                                                    <PartCodeInput
                                                        brandId={line.brand_id}
                                                        partCode={line.part_code}
                                                        partId={line.part_id}
                                                        partName={line.part_name}
                                                        selectedBrandId={line.brand_id}
                                                        brandName={brands.find(b => b.id === line.brand_id)?.name}
                                                        showName={false}
                                                        onChange={code => {
                                                            if (!code.trim()) onUpdatePart(line._key, { part_code: "", part_id: null, part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0" });
                                                            else onUpdatePart(line._key, { part_code: code });
                                                        }}
                                                        onClear={() => onUpdatePart(line._key, { part_code: "", part_id: null, part_name: "", cost_price: "0", selling_price: "0", sale_pr_gst: "0" })}
                                                        onSelect={part => onPartSelect(line._key, part)}
                                                    />
                                                </div>
                                                <div className="min-w-[140px] flex-1">
                                                    <Input
                                                        className="h-7 border-(--cl-border) bg-white text-xs"
                                                        placeholder="Part name"
                                                        value={line.part_name}
                                                        onChange={e => onUpdatePart(line._key, { part_name: e.target.value })}
                                                    />
                                                </div>
                                                {isGst && !isWarranty && (
                                                    <div className="relative w-28 shrink-0">
                                                        <span className="absolute -top-3 left-0 text-[10px] text-(--cl-text-muted) leading-none pointer-events-none">HSN</span>
                                                        <Input
                                                            className={`h-7 font-mono border-(--cl-border) bg-white text-xs ${!line.hsn_code.trim() ? "border-red-400 focus:border-red-500" : ""}`}
                                                            maxLength={8}
                                                            placeholder="HSN"
                                                            value={line.hsn_code}
                                                            onChange={e => onUpdatePart(line._key, { hsn_code: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                                                        />
                                                    </div>
                                                )}
                                                <div className="min-w-[120px] flex-1">
                                                    <Input
                                                        className="h-7 border-(--cl-border) bg-white text-xs"
                                                        placeholder="Remarks…"
                                                        value={line.remarks}
                                                        onChange={e => onUpdatePart(line._key, { remarks: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                    <Button
                                                        className="h-8 w-8 p-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                        size="icon"
                                                        title="Add row"
                                                        onClick={onAddPart}
                                                    >
                                                        <Plus className="h-4.5 w-4.5" />
                                                    </Button>
                                                    <Button
                                                        className="h-6 w-6 p-0 text-(--cl-text-muted) hover:text-red-500 hover:bg-red-500/10"
                                                        size="icon"
                                                        title="Remove part"
                                                        variant="ghost"
                                                        onClick={() => onRemovePart(line._key, line.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Pricing row */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
                                                {!isWarranty && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-(--cl-text-muted)">Profit</span>
                                                        <span className={`tabular-nums text-sm font-semibold ${profit < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                            {profit < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profit))}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                                                    {isGst && !isWarranty && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">GST%</span>
                                                            <Input
                                                                className="h-6 w-14 border-(--cl-border) bg-white text-xs text-right"
                                                                min="0" step="0.01" type="number"
                                                                value={line.gst_rate}
                                                                onChange={e => onUpdatePart(line._key, calculateLinePricing(line, { gst_rate: e.target.value }, isGst))}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">Qty</span>
                                                        <Input
                                                            className={`h-6 w-16 border-(--cl-border) bg-white text-xs text-right ${line.qty <= 0 ? "border-red-500" : ""}`}
                                                            min={0.01} step="0.01" type="number"
                                                            value={line.qty}
                                                            onChange={e => onUpdatePart(line._key, { qty: parseFloat(e.target.value) || 0 })}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">Cost</span>
                                                        <Input
                                                            className="h-6 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                            min="0" step="0.01" type="number"
                                                            value={line.cost_price}
                                                            onChange={e => onCostChange(line._key, e.target.value)}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                    {!isWarranty && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">Sale</span>
                                                            <Input
                                                                className="h-6 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                min="0" step="0.01" type="number"
                                                                value={line.selling_price}
                                                                onChange={e => onUpdatePart(line._key, calculateLinePricing(line, { selling_price: e.target.value }, isGst))}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    )}
                                                    {isGst && !isWarranty && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">+GST</span>
                                                            <Input
                                                                className="h-6 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                min="0" step="0.01" type="number"
                                                                value={line.sale_pr_gst}
                                                                onChange={e => {
                                                                    const spgst = e.target.value;
                                                                    const gr = parseFloat(line.gst_rate) || 0;
                                                                    onUpdatePart(line._key, { sale_pr_gst: spgst, selling_price: ((parseFloat(spgst) || 0) / (1 + gr / 100)).toFixed(2) });
                                                                }}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-1 rounded bg-(--cl-surface-2) px-2 py-0.5 w-36 shrink-0 overflow-hidden">
                                                        <span className="text-[10px] text-(--cl-text-muted) shrink-0">Amt</span>
                                                        <span className="tabular-nums text-sm text-(--cl-text) truncate text-right">₹{fmtCurrency(isWarranty ? costAmt : saleAmt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {deletedPartIds.length > 0 && (
                            <p className="px-4 py-2 text-xs text-red-500">
                                {deletedPartIds.length} part{deletedPartIds.length !== 1 ? "s" : ""} marked for removal.
                            </p>
                        )}
                        {partLines.length > 0 && (
                            <div className="flex items-center justify-between gap-6 px-2 py-2.5 border-t-2 border-(--cl-border) bg-(--cl-surface-2)/60">
                                <div className="flex items-center gap-4">
                                    {!isWarranty && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                            <span className={`tabular-nums text-sm font-semibold ${profitTotal < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                {profitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profitTotal))}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                        <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(partsQtyTotal)}</span>
                                    </div>
                                    {isGst && !isWarranty && (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                                <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsCgstTotal)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                                <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsSgstTotal)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                                <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsIgstTotal)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Parts Total</span>
                                    <span className="tabular-nums text-base font-bold text-(--cl-text)">
                                        ₹{fmtCurrency(isWarranty
                                            ? partLines.reduce((s, l) => s + (parseFloat(l.cost_price) || 0) * l.qty, 0)
                                            : partsTotal)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Additional Charges */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-(--cl-border) bg-(--cl-surface-2)/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Additional Charges</p>
                        </div>
                        {chargeLines.length === 0 && (
                            <div className="flex items-center justify-center py-6">
                                <Button
                                    className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                    size="sm"
                                    variant="outline"
                                    onClick={onAddCharge}
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Charge
                                </Button>
                            </div>
                        )}
                        {chargeLines.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm table-fixed">
                                    <thead>
                                        <tr>
                                            <th className={`${thClass} w-8`}>#</th>
                                            <th className={thClass}>Charge Name <span className="text-red-500">*</span></th>
                                            <th className={`${thClass} w-24`}>Ref No</th>
                                            <th className={thClass}>Description</th>
                                            {isGst && !isWarranty && <th className={`${thClass} w-28`}>HSN <span className="text-red-500">*</span></th>}
                                            {isGst && !isWarranty && <th className={`${thClass} w-20 text-right`}>GST%</th>}
                                            <th className={`${thClass} w-20 text-right`}>Qty</th>
                                            <th className={`${thClass} w-28 text-right`}>Cost</th>
                                            {!isWarranty && <th className={`${thClass} w-28 text-right`}>Sale <span className="text-red-500">*</span></th>}
                                            {isGst && !isWarranty && <th className={`${thClass} w-28 text-right`}>Sale+GST</th>}
                                            <th className={`${thClass} w-32 text-right whitespace-nowrap`}>Amount</th>
                                            <th className={`${thClass} w-20`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chargeLines.map((c, idx) => (
                                            <tr key={c._key} className="group">
                                                <td className={`${tdClass} text-(--cl-text-muted)`}>{idx + 1}</td>
                                                <td className={tdClass}>
                                                    <ChargeNameCombobox
                                                        value={c.charge_name}
                                                        options={additionalChargeOptions}
                                                        onChange={name => onUpdateCharge(c._key, "charge_name", name)}
                                                        onSelect={(name, hsnCode) => onPatchCharge(c._key, { charge_name: name, hsn_code: hsnCode || defaultHsnForServiceCharge })}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-20 border-(--cl-border) bg-white text-xs"
                                                        placeholder="Ref no"
                                                        value={c.ref_no}
                                                        onChange={e => onUpdateCharge(c._key, "ref_no", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 min-w-[80px] border-(--cl-border) bg-white text-xs"
                                                        placeholder="Description"
                                                        value={c.description}
                                                        onChange={e => onUpdateCharge(c._key, "description", e.target.value)}
                                                    />
                                                </td>
                                                {isGst && !isWarranty && (
                                                    <td className={tdClass}>
                                                        <div className="relative">
                                                            <Input
                                                                className={`h-7 w-24 font-mono border-(--cl-border) bg-white text-xs ${!c.hsn_code.trim() ? "border-red-400 focus:border-red-500" : ""}`}
                                                                maxLength={8}
                                                                placeholder="HSN"
                                                                value={c.hsn_code}
                                                                onChange={e => onUpdateCharge(c._key, "hsn_code", e.target.value.replace(/\D/g, "").slice(0, 8))}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                {isGst && !isWarranty && (
                                                    <td className={`${tdClass} text-right`}>
                                                        <Input
                                                            className="h-7 w-16 border-(--cl-border) bg-white text-xs text-right"
                                                            min="0" step="0.01" type="number"
                                                            value={c.gst_rate}
                                                            onChange={e => {
                                                                const gr = e.target.value;
                                                                const sp = parseFloat(c.selling_price) || 0;
                                                                onPatchCharge(c._key, { gst_rate: gr, sale_pr_gst: (sp * (1 + (parseFloat(gr) || 0) / 100)).toFixed(2) });
                                                            }}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </td>
                                                )}
                                                <td className={`${tdClass} text-right`}>
                                                    <Input
                                                        className="h-7 w-16 border-(--cl-border) bg-white text-xs text-right"
                                                        min="0.01" step="0.01" type="number"
                                                        value={c.qty}
                                                        onChange={e => onUpdateCharge(c._key, "qty", e.target.value)}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>
                                                <td className={`${tdClass} text-right`}>
                                                    <Input
                                                        className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                        min="0" step="0.01" type="number"
                                                        value={c.cost_price}
                                                        onChange={e => onUpdateCharge(c._key, "cost_price", e.target.value)}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>
                                                {!isWarranty && (
                                                    <td className={`${tdClass} text-right`}>
                                                        <div className="flex justify-end">
                                                            <Input
                                                                className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                min="0" step="0.01" type="number"
                                                                value={c.selling_price}
                                                                onChange={e => {
                                                                    const sp = e.target.value;
                                                                    const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
                                                                    onPatchCharge(c._key, { selling_price: sp, sale_pr_gst: ((parseFloat(sp) || 0) * (1 + gstRate / 100)).toFixed(2) });
                                                                }}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                {isGst && !isWarranty && (
                                                    <td className={`${tdClass} text-right`}>
                                                        <div className="flex justify-end">
                                                            <Input
                                                                className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                min="0" step="0.01" type="number"
                                                                value={c.sale_pr_gst}
                                                                onChange={e => {
                                                                    const spg = e.target.value;
                                                                    const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
                                                                    onPatchCharge(c._key, { sale_pr_gst: spg, selling_price: ((parseFloat(spg) || 0) / (1 + gstRate / 100)).toFixed(2) });
                                                                }}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={`${tdClass} text-right tabular-nums text-sm text-(--cl-accent) w-32 whitespace-nowrap`}>
                                                    ₹{fmtCurrency(isWarranty
                                                        ? (parseFloat(c.cost_price) || 0) * (parseFloat(c.qty) || 1)
                                                        : (parseFloat(c.sale_pr_gst) || parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1))}
                                                </td>
                                                <td className={`${tdClass} px-1 align-middle`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            className="h-8 w-8 p-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                            size="icon"
                                                            title="Add row"
                                                            onClick={onAddCharge}
                                                        >
                                                            <Plus className="h-4.5 w-4.5" />
                                                        </Button>
                                                        <Button
                                                            className="h-6 w-6 p-0 text-(--cl-text-muted) hover:text-red-500 hover:bg-red-500/10"
                                                            size="icon"
                                                            title="Remove charge"
                                                            variant="ghost"
                                                            onClick={() => onRemoveCharge(c._key, c.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-(--cl-surface-2)/60">
                                            <td colSpan={100} className="px-2 py-1 border-t-2 border-(--cl-border)">
                                                <div className="flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        {!isWarranty && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                                                <span className={`tabular-nums text-sm font-semibold ${chargesProfitTotal < 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                                    {chargesProfitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(chargesProfitTotal))}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(chargesQtyTotal)}</span>
                                                        </div>
                                                        {isGst && !isWarranty && (
                                                            <>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesCgstTotal)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesSgstTotal)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesIgstTotal)}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Charges Total</span>
                                                        <span className="tabular-nums text-base font-bold text-(--cl-text)">
                                                            ₹{fmtCurrency(isWarranty
                                                                ? chargeLines.reduce((s, c) => s + (parseFloat(c.cost_price) || 0) * (parseFloat(c.qty) || 1), 0)
                                                                : chargesAmountTotal)}
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

                    {/* Below-cost banner — back-calc target required selling parts at a loss */}
                    {belowCostWarning && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{belowCostWarning}</span>
                        </div>
                    )}

                    {/* Grand Summary */}
                    <div className="rounded-lg border-2 border-(--cl-accent)/30 bg-(--cl-surface) overflow-hidden">
                        <div className="flex items-stretch">
                            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3">
                                {!isWarranty && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                        <span className={`tabular-nums text-sm font-semibold ${grandProfitTotal < 0 ? "text-amber-600" : "text-emerald-600"}`}>
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
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">CGST</span>
                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandCgstTotal)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">SGST</span>
                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandSgstTotal)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">IGST</span>
                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandIgstTotal)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Parts</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">
                                        ₹{fmtCurrency(isWarranty
                                            ? partLines.reduce((s, l) => s + (parseFloat(l.cost_price) || 0) * l.qty, 0)
                                            : partsTotal)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Charges</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">
                                        ₹{fmtCurrency(isWarranty
                                            ? chargeLines.reduce((s, c) => s + (parseFloat(c.cost_price) || 0) * (parseFloat(c.qty) || 1), 0)
                                            : chargesSaleTotal)}
                                    </span>
                                </div>
                            </div>
                            <div className="w-px self-stretch bg-(--cl-border)" />
                            {isWarranty ? (
                                <div className="flex shrink-0 flex-col justify-center px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold uppercase tracking-wide text-(--cl-accent)">Final Amount</span>
                                        <span className="tabular-nums text-md font-bold">₹0.00</span>
                                    </div>
                                </div>
                            ) : (() => {
                                const backCalcNum = parseFloat(backCalcTarget);
                                const effectiveTotal = (backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0)
                                    ? backCalcNum
                                    : (selectedJob.amount != null && Number(selectedJob.amount) > 0)
                                        ? Number(selectedJob.amount)
                                        : grandTotal;
                                const diff = Math.round((effectiveTotal - grandTotal) * 100) / 100;
                                const hasDiff = Math.abs(diff) >= 0.005;
                                const isTallied = !hasDiff;
                                return (
                                    <div className="flex shrink-0 flex-col justify-center gap-2 px-4 py-3">
                                        <div className="flex items-center justify-between gap-4">
                                            {isTallied ? (
                                                <div className="flex items-center gap-1 text-emerald-600">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    <span className="text-xs font-semibold">Tallied</span>
                                                </div>
                                            ) : <div />}
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium uppercase tracking-wide text-(--cl-text-muted)">Calculated</span>
                                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(grandTotal)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-amber-600">Diff</span>
                                                    <span className={`tabular-nums text-sm font-semibold ${hasDiff ? "text-amber-700" : "text-emerald-600"}`}>
                                                        {diff > 0 ? "+" : ""}{fmtCurrency(diff)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold uppercase tracking-wide text-(--cl-accent)">Total</span>
                                                    <span className="tabular-nums text-md font-bold">₹{fmtCurrency(effectiveTotal)}</span>
                                                    <button
                                                        className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-(--cl-surface-2) border border-(--cl-border) text-(--cl-text-muted) hover:bg-(--cl-accent) hover:text-white hover:border-(--cl-accent) cursor-pointer transition-all shadow-sm"
                                                        title="Round off to nearest rupee"
                                                        type="button"
                                                        onClick={() => {
                                                            const rounded = Math.round(effectiveTotal);
                                                            setBackCalcTarget(String(rounded));
                                                            applyBackCalc(rounded);
                                                        }}
                                                    >
                                                        <Radius className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                className="h-7 shrink-0 text-xs"
                                                disabled={!backCalcTarget}
                                                size="sm"
                                                variant="outline"
                                                onClick={() => { setBackCalcTarget(""); setBelowCostWarning(null); }}
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                className="h-8 shrink-0 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                                                disabled={!backCalcTarget || isNaN(backCalcNum) || backCalcNum < 0}
                                                size="sm"
                                                variant="default"
                                                onClick={() => applyBackCalc(backCalcNum)}
                                            >
                                                Apply
                                            </Button>
                                            <Input
                                                className="h-8 w-36 text-right text-base font-bold border-(--cl-border) bg-white"
                                                min="0" step="0.01" type="number"
                                                placeholder="Target amount"
                                                value={backCalcTarget}
                                                onChange={e => setBackCalcTarget(e.target.value)}
                                                onFocus={e => e.target.select()}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                </div>
            </motion.div>

            {viewJobId !== null && (
                <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
            )}
        </>
    );
}
