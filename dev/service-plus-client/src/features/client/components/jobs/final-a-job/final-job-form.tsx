import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
    AlertTriangle, ArrowLeft, CheckCheck, CheckCircle2,
    Edit2, Eye, Loader2, Plus, RefreshCw, Trash2, XCircle,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ─── Back-calculate helpers (only used in this view) ─────────────────────────

function scaleCharges(
    allCharges: EditableChargeLine[],
    active: EditableChargeLine[],
    curTotal: number,
    newTotal: number,
    isGst: boolean,
): EditableChargeLine[] {
    const rowAmounts = active.map(c => {
        const sp = (parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1);
        const gst = isGst ? sp * (parseFloat(c.gst_rate) || 0) / 100 : 0;
        return curTotal > 0 ? Math.max(0, (sp + gst) * newTotal / curTotal) : newTotal / active.length;
    });
    const sumHead = rowAmounts.slice(0, -1).reduce((s, v) => s + v, 0);
    rowAmounts[rowAmounts.length - 1] = Math.max(0, newTotal - sumHead);

    const patch = new Map<string, Pick<EditableChargeLine, "selling_price" | "sale_pr_gst">>();
    let runningTotal = 0;
    active.forEach((c, i) => {
        const qty = parseFloat(c.qty) || 1;
        const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
        const multiplier = 1 + gstRate / 100;
        if (i < active.length - 1) {
            const spg = rowAmounts[i] / qty;
            const sp = parseFloat((gstRate > 0 ? spg / multiplier : spg).toFixed(2));
            const saleGst = parseFloat((sp * multiplier).toFixed(2));
            runningTotal += saleGst * qty;
            patch.set(c._key, { selling_price: sp.toFixed(2), sale_pr_gst: saleGst.toFixed(2) });
        } else {
            const saleGstPerUnit = parseFloat(((newTotal - runningTotal) / qty).toFixed(2));
            const sp = parseFloat((gstRate > 0 ? saleGstPerUnit / multiplier : saleGstPerUnit).toFixed(2));
            patch.set(c._key, { selling_price: sp.toFixed(2), sale_pr_gst: saleGstPerUnit.toFixed(2) });
        }
    });
    return allCharges.map(c => { const p = patch.get(c._key); return p ? { ...c, ...p } : c; });
}

function scaleParts(
    allParts: EditablePartLine[],
    active: EditablePartLine[],
    curTotal: number,
    newTotal: number,
): EditablePartLine[] {
    if (curTotal <= 0) return allParts;
    const rowAmounts = active.map(l =>
        Math.max(0, (parseFloat(l.sale_pr_gst) || 0) * l.qty * newTotal / curTotal)
    );
    const sumHead = rowAmounts.slice(0, -1).reduce((s, v) => s + v, 0);
    rowAmounts[rowAmounts.length - 1] = Math.max(0, newTotal - sumHead);

    const patch = new Map<string, Pick<EditablePartLine, "selling_price" | "sale_pr_gst">>();
    let runningTotal = 0;
    active.forEach((l, i) => {
        const gstRate = parseFloat(l.gst_rate) || 0;
        const multiplier = 1 + gstRate / 100;
        const costPrice = parseFloat(l.cost_price) || 0;
        if (i < active.length - 1) {
            const spg = rowAmounts[i] / l.qty;
            const sp = gstRate > 0 ? spg / multiplier : spg;
            const finalSp = parseFloat(Math.max(sp, costPrice).toFixed(2));
            const saleGst = parseFloat((finalSp * multiplier).toFixed(2));
            runningTotal += saleGst * l.qty;
            patch.set(l._key, { selling_price: finalSp.toFixed(2), sale_pr_gst: saleGst.toFixed(2) });
        } else {
            const saleGstPerUnit = parseFloat(((newTotal - runningTotal) / l.qty).toFixed(2));
            const sp = gstRate > 0 ? saleGstPerUnit / multiplier : saleGstPerUnit;
            const finalSp = parseFloat(Math.max(sp, costPrice).toFixed(2));
            patch.set(l._key, { selling_price: finalSp.toFixed(2), sale_pr_gst: saleGstPerUnit.toFixed(2) });
        }
    });
    return allParts.map(l => { const p = patch.get(l._key); return p ? { ...l, ...p } : l; });
}

function computeBackCalc(
    target: number,
    partLines: EditablePartLine[],
    chargeLines: EditableChargeLine[],
    isGst: boolean,
): { newPartLines?: EditablePartLine[]; newChargeLines?: EditableChargeLine[] } {
    const partsTotal = partLines.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
    const chargesTotal = chargeLines.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
    const diff = target - partsTotal - chargesTotal;
    if (Math.abs(diff) < 0.005) return {};

    const activeParts = partLines.filter(l => l.part_id !== null);
    let newPartLines: EditablePartLine[] | undefined;
    let remainingDiff = diff;

    if (activeParts.length > 0) {
        const curPartsAmt = activeParts.reduce((s, l) => s + (parseFloat(l.sale_pr_gst) || 0) * l.qty, 0);
        if (curPartsAmt > 0) {
            newPartLines = scaleParts(partLines, activeParts, curPartsAmt, curPartsAmt + diff);
            const actualNewPartsTotal = newPartLines.reduce((s, l) => {
                if (l.part_id === null) return s;
                return s + (parseFloat(l.sale_pr_gst) || 0) * l.qty;
            }, 0);
            remainingDiff = target - actualNewPartsTotal - chargesTotal;
            if (Math.abs(remainingDiff) < 0.005) return { newPartLines };
        }
    }

    const activeCharges = chargeLines.filter(c => c.charge_name.trim() !== "");
    if (activeCharges.length === 0) return { newPartLines };

    const curChargesAmt = activeCharges.reduce((s, c) => s + (parseFloat(c.sale_pr_gst) || 0) * (parseFloat(c.qty) || 1), 0);
    const newChargesAmt = curChargesAmt + remainingDiff;

    if (newChargesAmt >= 0) {
        return {
            newPartLines,
            newChargeLines: scaleCharges(chargeLines, activeCharges, curChargesAmt, newChargesAmt, isGst),
        };
    }
    return {
        newPartLines,
        newChargeLines: chargeLines.map(c =>
            c.charge_name.trim() ? { ...c, selling_price: "0", sale_pr_gst: "0" } : c),
    };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type FinalJobFormProps = {
    selectedJob: JobDetailType;
    selectedRow: FinalJobRow;
    isEditMode: boolean;
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
    defaultHsnForSparePart: string;
    defaultHsnForServiceCharge: string;
    viewJobId: number | null;

    setForceIgst: (v: boolean) => void;
    setBackCalcTarget: (v: string) => void;
    setChargeLines: Dispatch<SetStateAction<EditableChargeLine[]>>;
    setPartLines: Dispatch<SetStateAction<EditablePartLine[]>>;
    setViewJobId: (id: number | null) => void;

    onBack: () => void;
    onSave: () => Promise<void>;
    onRefresh: () => Promise<void>;
    onAddPart: () => void;
    onRemovePart: (key: string, id?: number) => void;
    onUpdatePart: (key: string, patch: Partial<EditablePartLine>) => void;
    onPartSelect: (key: string, part: PartRow) => void;
    onAddCharge: () => void;
    onRemoveCharge: (key: string, id?: number) => void;
    onUpdateCharge: (key: string, field: keyof EditableChargeLine, value: string) => void;
    onPatchCharge: (key: string, patch: Partial<EditableChargeLine>) => void;
    onDivisionChange: (id: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalJobForm({
    selectedJob, selectedRow, isEditMode, submitting, loadingDetail,
    selectedDivisionId, isGst, availableDivisions, brands, additionalChargeOptions,
    partLines, chargeLines, deletedPartIds, forceIgst, backCalcTarget,
    defaultHsnForServiceCharge, viewJobId,
    setForceIgst, setBackCalcTarget, setChargeLines, setPartLines, setViewJobId,
    onBack, onSave, onRefresh, onAddPart, onRemovePart, onUpdatePart, onPartSelect,
    onAddCharge, onRemoveCharge, onUpdateCharge, onPatchCharge, onDivisionChange,
}: FinalJobFormProps) {
    const isWarranty = selectedRow.job_type_code === "UNDER_WARRANTY";

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

    useEffect(() => {
        if (isEditMode) {
            setBackCalcTarget(grandTotal > 0 ? grandTotal.toFixed(2) : "");
        }
    }, [grandTotal, isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps
    const grandQtyTotal = partsQtyTotal + chargesQtyTotal;
    const grandCgstTotal = partsCgstTotal + chargesCgstTotal;
    const grandSgstTotal = partsSgstTotal + chargesSgstTotal;
    const grandIgstTotal = partsIgstTotal + chargesIgstTotal;

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
                            title="Refresh"
                            variant="ghost"
                            onClick={() => void onRefresh()}
                        >
                            {loadingDetail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                    <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm ${isGst ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                        {isGst
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            : <XCircle className="h-3.5 w-3.5 text-red-600" />
                        }
                        <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGst ? "text-emerald-700" : "text-red-700"}`}>
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
                        {isEditMode ? "Save Changes" : "Save & Mark Final"}
                    </Button>
                </div>
                {isEditMode && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shrink-0 mx-0 mt-2">
                        <Edit2 className="h-4 w-4 shrink-0" />
                        Edit mode — changes will update parts, charges, and the invoice.
                    </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-5 py-4">

                    {/* Warranty banner */}
                    {isWarranty && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            This is a warranty job — parts used and additional charges cannot be modified.
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
                                ["Customer", selectedJob.customer_name ?? "—"],
                                ["Mobile", selectedJob.mobile],
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
                        </div>
                    </div>

                    {/* Parts Used */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-(--cl-border) bg-(--cl-surface-2)/60 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Parts Used</p>
                            {isGst && (
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={forceIgst}
                                        className="h-3.5 w-3.5 accent-(--cl-accent) cursor-pointer"
                                        onChange={e => setForceIgst(e.target.checked)}
                                    />
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Force IGST</span>
                                </label>
                            )}
                        </div>
                        {!isWarranty && partLines.length === 0 && (
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
                                    const aggregate = (parseFloat(line.selling_price) || 0) * line.qty;
                                    const gstRate = parseFloat(line.gst_rate) || 0;
                                    const amount = aggregate * (1 + gstRate / 100);
                                    const profit = ((parseFloat(line.selling_price) || 0) - (parseFloat(line.cost_price) || 0)) * line.qty;
                                    return (
                                        <div key={line._key} className="px-1 py-3 space-y-2.5 bg-(--cl-surface) hover:bg-(--cl-surface-2)/50 transition-colors">
                                            {/* Identity row */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="w-5 shrink-0 text-center text-xs font-semibold text-(--cl-text-muted)">{idx + 1}</span>
                                                <div className="w-36 shrink-0">
                                                    {isWarranty ? (
                                                        <span className="text-xs text-(--cl-text-muted)">{brands.find(b => b.id === line.brand_id)?.name ?? "—"}</span>
                                                    ) : (
                                                        <Select
                                                            value={line.brand_id ? String(line.brand_id) : ""}
                                                            onValueChange={v => onUpdatePart(line._key, { brand_id: Number(v), part_id: null, part_code: "", part_name: "" })}
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
                                                    )}
                                                </div>
                                                <div className="w-56 shrink-0">
                                                    {isWarranty ? (
                                                        <span className="font-mono text-xs font-semibold text-(--cl-accent)">{line.part_code || "—"}</span>
                                                    ) : (
                                                        <PartCodeInput
                                                            brandId={line.brand_id}
                                                            partCode={line.part_code}
                                                            partId={line.part_id}
                                                            partName={line.part_name}
                                                            selectedBrandId={line.brand_id}
                                                            brandName={brands.find(b => b.id === line.brand_id)?.name}
                                                            showName={false}
                                                            onChange={code => {
                                                                if (!code.trim()) onUpdatePart(line._key, { part_code: "", part_id: null, part_name: "" });
                                                                else onUpdatePart(line._key, { part_code: code });
                                                            }}
                                                            onClear={() => onUpdatePart(line._key, { part_code: "", part_id: null, part_name: "" })}
                                                            onSelect={part => onPartSelect(line._key, part)}
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-[140px] flex-1">
                                                    <Input
                                                        className="h-7 border-(--cl-border) bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Part name"
                                                        value={line.part_name}
                                                        onChange={e => onUpdatePart(line._key, { part_name: e.target.value })}
                                                    />
                                                </div>
                                                {isGst && (
                                                    <div className="relative w-28 shrink-0">
                                                        <span className="absolute -top-3 left-0 text-[10px] text-(--cl-text-muted) leading-none pointer-events-none">HSN</span>
                                                        <Input
                                                            className={`h-7 font-mono border-(--cl-border) bg-white text-xs ${!isWarranty && !line.hsn_code.trim() ? "border-red-400 focus:border-red-500" : ""}`}
                                                            disabled={isWarranty}
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
                                                        disabled={isWarranty}
                                                        placeholder="Remarks…"
                                                        value={line.remarks}
                                                        onChange={e => onUpdatePart(line._key, { remarks: e.target.value })}
                                                    />
                                                </div>
                                                {!isWarranty && (
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
                                                )}
                                            </div>
                                            {/* Pricing row */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-(--cl-text-muted)">Profit</span>
                                                    <span className={`tabular-nums text-sm font-semibold ${profit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                        {profit < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profit))}
                                                    </span>
                                                </div>
                                                <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                                                    {isGst && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">GST%</span>
                                                            <Input
                                                                className="h-6 w-14 border-(--cl-border) bg-white text-xs text-right"
                                                                disabled={isWarranty}
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
                                                            disabled={isWarranty}
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
                                                            disabled={isWarranty}
                                                            min="0" step="0.01" type="number"
                                                            value={line.cost_price}
                                                            onChange={e => onUpdatePart(line._key, { cost_price: e.target.value })}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">Sale</span>
                                                        <Input
                                                            className="h-6 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                            disabled={isWarranty}
                                                            min="0" step="0.01" type="number"
                                                            value={line.selling_price}
                                                            onChange={e => onUpdatePart(line._key, calculateLinePricing(line, { selling_price: e.target.value }, isGst))}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                    {isGst && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted) whitespace-nowrap">+GST</span>
                                                            <Input
                                                                className="h-6 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                disabled={isWarranty}
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
                                                    <div className="flex items-center gap-1 rounded bg-(--cl-surface-2) px-2 py-0.5">
                                                        <span className="text-[10px] text-(--cl-text-muted)">Amt</span>
                                                        <span className="tabular-nums text-sm text-(--cl-text)">₹{fmtCurrency(amount)}</span>
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
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                        <span className={`tabular-nums text-sm font-semibold ${profitTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                            {profitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(profitTotal))}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                        <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(partsQtyTotal)}</span>
                                    </div>
                                    {isGst && (
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
                                    <span className="tabular-nums text-base font-bold text-(--cl-text)">₹{fmtCurrency(partsTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Additional Charges */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-(--cl-border) bg-(--cl-surface-2)/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-(--cl-text-muted)">Additional Charges</p>
                        </div>
                        {!isWarranty && chargeLines.length === 0 && (
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
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Charge Name <span className="text-red-500">*</span></th>
                                            <th className={thClass}>Ref No</th>
                                            <th className={`${thClass} w-full min-w-[80px]`}>Description</th>
                                            {isGst && <th className={thClass}>HSN <span className="text-red-500">*</span></th>}
                                            {isGst && <th className={`${thClass} text-right`}>GST%</th>}
                                            <th className={`${thClass} text-right`}>Qty</th>
                                            <th className={`${thClass} text-right`}>Cost</th>
                                            <th className={`${thClass} text-right`}>Sale <span className="text-red-500">*</span></th>
                                            {isGst && <th className={`${thClass} text-right`}>Sale+GST</th>}
                                            <th className={`${thClass} text-right w-32`}>Amount</th>
                                            {!isWarranty && <th className={thClass}></th>}
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
                                                        disabled={isWarranty}
                                                        onChange={name => onUpdateCharge(c._key, "charge_name", name)}
                                                        onSelect={(name, hsnCode) => onPatchCharge(c._key, { charge_name: name, hsn_code: hsnCode || defaultHsnForServiceCharge })}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 w-20 border-(--cl-border) bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Ref no"
                                                        value={c.ref_no}
                                                        onChange={e => onUpdateCharge(c._key, "ref_no", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdClass}>
                                                    <Input
                                                        className="h-7 min-w-[80px] border-(--cl-border) bg-white text-xs"
                                                        disabled={isWarranty}
                                                        placeholder="Description"
                                                        value={c.description}
                                                        onChange={e => onUpdateCharge(c._key, "description", e.target.value)}
                                                    />
                                                </td>
                                                {isGst && (
                                                    <td className={tdClass}>
                                                        <div className="relative">
                                                            <Input
                                                                className={`h-7 w-24 font-mono border-(--cl-border) bg-white text-xs ${!isWarranty && !c.hsn_code.trim() ? "border-red-400 focus:border-red-500" : ""}`}
                                                                disabled={isWarranty}
                                                                maxLength={8}
                                                                placeholder="HSN"
                                                                value={c.hsn_code}
                                                                onChange={e => onUpdateCharge(c._key, "hsn_code", e.target.value.replace(/\D/g, "").slice(0, 8))}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                {isGst && (
                                                    <td className={`${tdClass} text-right`}>
                                                        <Input
                                                            className="h-7 w-16 border-(--cl-border) bg-white text-xs text-right"
                                                            disabled={isWarranty}
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
                                                        disabled={isWarranty}
                                                        min="0.01" step="0.01" type="number"
                                                        value={c.qty}
                                                        onChange={e => {
                                                            const qty = e.target.value;
                                                            onUpdateCharge(c._key, "qty", qty);
                                                        }}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>
                                                <td className={`${tdClass} text-right`}>
                                                    <Input
                                                        className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                        disabled={isWarranty}
                                                        min="0" step="0.01" type="number"
                                                        value={c.cost_price}
                                                        onChange={e => onUpdateCharge(c._key, "cost_price", e.target.value)}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>
                                                <td className={`${tdClass} text-right`}>
                                                    <div className="flex justify-end">
                                                        <Input
                                                            className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                            disabled={isWarranty}
                                                            min="0" step="0.01" type="number"
                                                            value={c.selling_price}
                                                            onChange={e => {
                                                                const sp = e.target.value;
                                                                const gstRate = isGst ? (parseFloat(c.gst_rate) || 0) : 0;
                                                                setChargeLines(prev => prev.map(cl => cl._key === c._key
                                                                    ? { ...cl, selling_price: sp, sale_pr_gst: ((parseFloat(sp) || 0) * (1 + gstRate / 100)).toFixed(2) }
                                                                    : cl));
                                                            }}
                                                            onFocus={e => e.target.select()}
                                                        />
                                                    </div>
                                                </td>
                                                {isGst && (
                                                    <td className={`${tdClass} text-right`}>
                                                        <div className="flex justify-end">
                                                            <Input
                                                                className="h-7 w-24 border-(--cl-border) bg-white text-xs text-right"
                                                                disabled={isWarranty}
                                                                min="0" step="0.01" type="number"
                                                                value={c.sale_pr_gst}
                                                                onChange={e => {
                                                                    const spg = e.target.value;
                                                                    const gstRate = parseFloat(c.gst_rate) || 0;
                                                                    setChargeLines(prev => prev.map(cl => cl._key === c._key
                                                                        ? { ...cl, sale_pr_gst: spg, selling_price: ((parseFloat(spg) || 0) / (1 + gstRate / 100)).toFixed(2) }
                                                                        : cl));
                                                                }}
                                                                onFocus={e => e.target.select()}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={`${tdClass} text-right tabular-nums text-sm text-(--cl-accent) w-32`}>
                                                    ₹{fmtCurrency((parseFloat(c.sale_pr_gst) || parseFloat(c.selling_price) || 0) * (parseFloat(c.qty) || 1))}
                                                </td>
                                                {!isWarranty && (
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
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-(--cl-surface-2)/60">
                                            <td colSpan={100} className="px-2 py-1 border-t-2 border-(--cl-border)">
                                                <div className="flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                                            <span className={`tabular-nums text-sm font-semibold ${chargesProfitTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                                                {chargesProfitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(chargesProfitTotal))}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                                            <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(chargesQtyTotal)}</span>
                                                        </div>
                                                        {isGst && (
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
                                                        <span className="tabular-nums text-base font-bold text-(--cl-text)">₹{fmtCurrency(chargesAmountTotal)}</span>
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
                    <div className="rounded-lg border-2 border-(--cl-accent)/30 bg-(--cl-surface) overflow-hidden">
                        <div className="flex items-stretch">
                            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Profit</span>
                                    <span className={`tabular-nums text-sm font-semibold ${grandProfitTotal < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                        {grandProfitTotal < 0 ? "-" : ""}₹{fmtCurrency(Math.abs(grandProfitTotal))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Qty</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">{fmtCurrency(grandQtyTotal)}</span>
                                </div>
                                {isGst && (
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
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(partsTotal)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-(--cl-text-muted)">Charges</span>
                                    <span className="tabular-nums text-sm font-semibold text-(--cl-text)">₹{fmtCurrency(chargesSaleTotal)}</span>
                                </div>
                            </div>
                            <div className="w-px self-stretch bg-(--cl-border)" />
                            {(() => {
                                const backCalcNum = parseFloat(backCalcTarget);
                                const isTallied = backCalcTarget !== "" && !isNaN(backCalcNum) && Math.abs(grandTotal - backCalcNum) < 0.005;
                                return (
                                    <div className="flex shrink-0 flex-col justify-center gap-2 px-4 py-3">
                                        <div className="flex items-center justify-between gap-4">
                                            {!isWarranty && isTallied ? (
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
                                                    <span className="text-xs font-bold uppercase tracking-wide text-(--cl-accent)">Total</span>
                                                    <span className="tabular-nums text-md font-bold">
                                                        {(() => {
                                                            const effectiveTotal = (backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0)
                                                                ? backCalcNum
                                                                : (selectedJob.amount != null && Number(selectedJob.amount) > 0)
                                                                    ? Number(selectedJob.amount)
                                                                    : grandTotal;
                                                            return `₹${fmtCurrency(effectiveTotal)}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {!isWarranty && (
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    className="h-7 shrink-0 text-xs"
                                                    disabled={!backCalcTarget}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setBackCalcTarget("")}
                                                >
                                                    Clear
                                                </Button>
                                                <Button
                                                    className="h-8 shrink-0 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                                                    disabled={!backCalcTarget || isNaN(backCalcNum) || backCalcNum < 0}
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => {
                                                        const result = computeBackCalc(backCalcNum, partLines, chargeLines, isGst);
                                                        if (result.newPartLines) setPartLines(result.newPartLines);
                                                        if (result.newChargeLines) setChargeLines(result.newChargeLines);
                                                    }}
                                                >
                                                    Back Calculate
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
                                        )}
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
