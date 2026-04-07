import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PhysicalValidationState = {
    allValid: boolean;
    qty: { isValid: boolean };
    cgst: { isValid: boolean };
    sgst: { isValid: boolean };
    igst: { isValid: boolean };
    total: { isValid: boolean };
};

export type PhysicalInvoiceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    submitting: boolean;
    isIgst: boolean;
    physicalValidation: PhysicalValidationState;
    
    physicalQty: number;
    setPhysicalQty: (val: number) => void;
    physicalCgst: number;
    setPhysicalCgst: (val: number) => void;
    physicalSgst: number;
    setPhysicalSgst: (val: number) => void;
    physicalIgst: number;
    setPhysicalIgst: (val: number) => void;
    physicalTotal: number;
    setPhysicalTotal: (val: number) => void;
};

export function PhysicalInvoiceModal({
    isOpen,
    onClose,
    onSubmit,
    submitting,
    isIgst,
    physicalValidation,
    physicalQty, setPhysicalQty,
    physicalCgst, setPhysicalCgst,
    physicalSgst, setPhysicalSgst,
    physicalIgst, setPhysicalIgst,
    physicalTotal, setPhysicalTotal
}: PhysicalInvoiceModalProps) {
    const [hasValidated, setHasValidated] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setHasValidated(false);
        }
    }, [isOpen]);

    const handleValidateAndSave = () => {
        setHasValidated(true);
        if (physicalValidation.allValid) {
            onSubmit();
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={open => { if (!open && !submitting) onClose(); }}
        >
            <DialogContent className="max-w-lg !bg-white !text-zinc-900 border-zinc-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                        Physical Invoice Verification
                    </DialogTitle>
                </DialogHeader>

                <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                        <strong>Read values directly from your physical invoice.</strong>{" "}
                        Do not copy the figures shown on screen — values must be entered independently to ensure accuracy.
                    </span>
                </div>

                <div className="overflow-hidden rounded-md border border-[var(--cl-border)]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[var(--cl-surface-2)]/60 border-b border-[var(--cl-border)]">
                                <th className="py-2 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Field</th>
                                <th className="py-2 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Your Entry</th>
                                <th className="py-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--cl-border)]">
                            <tr className={hasValidated ? (physicalValidation.qty.isValid ? "bg-green-500/5" : "bg-red-500/5") : ""}>
                                <td className="py-1 px-3 text-xs font-medium text-[var(--cl-text-muted)]">Total Qty</td>
                                <td className="py-1 px-2">
                                    <Input
                                        type="number" step="0.01" placeholder="0"
                                        value={physicalQty || ""}
                                        onChange={e => setPhysicalQty(Number(e.target.value))}
                                        onFocus={e => { const t = e.target; setTimeout(() => (t as HTMLInputElement).select(), 0); }}
                                        className={`h-8 text-right tabular-nums text-sm ${hasValidated && !physicalValidation.qty.isValid ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                                    />
                                </td>
                                <td className="py-1 px-2 text-center">
                                    {!hasValidated ? (
                                        <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                                    ) : physicalValidation.qty.isValid ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                    )}
                                </td>
                            </tr>
                            
                            {!isIgst && (
                                <tr className={hasValidated ? (physicalValidation.cgst.isValid ? "bg-green-500/5" : "bg-red-500/5") : ""}>
                                    <td className="py-1 px-3 text-xs font-medium text-[var(--cl-text-muted)]">CGST</td>
                                    <td className="py-1 px-2">
                                        <Input
                                            type="number" step="0.01" placeholder="0.00"
                                            value={physicalCgst || ""}
                                            onChange={e => {
                                                const val = Number(e.target.value);
                                                setPhysicalCgst(val);
                                                setPhysicalSgst(val);
                                            }}
                                            onFocus={e => { const t = e.target; setTimeout(() => (t as HTMLInputElement).select(), 0); }}
                                            className={`h-8 text-right tabular-nums text-sm ${hasValidated && !physicalValidation.cgst.isValid ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                                        />
                                    </td>
                                    <td className="py-1 px-2 text-center">
                                        {!hasValidated ? (
                                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                                        ) : physicalValidation.cgst.isValid ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            )}
                            
                            {!isIgst && (
                                <tr className={hasValidated ? (physicalValidation.sgst.isValid ? "bg-green-500/5" : "bg-red-500/5") : ""}>
                                    <td className="py-1 px-3 text-xs font-medium text-[var(--cl-text-muted)]">SGST</td>
                                    <td className="py-1 px-2">
                                        <Input
                                            type="number" step="0.01" placeholder="0.00"
                                            value={physicalSgst || ""}
                                            readOnly
                                            tabIndex={-1}
                                            className={`h-8 text-right tabular-nums text-sm bg-zinc-100 opacity-80 cursor-not-allowed ${hasValidated && !physicalValidation.sgst.isValid ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                                        />
                                    </td>
                                    <td className="py-1 px-2 text-center">
                                        {!hasValidated ? (
                                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                                        ) : physicalValidation.sgst.isValid ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            )}
                            
                            {isIgst && (
                                <tr className={hasValidated ? (physicalValidation.igst.isValid ? "bg-green-500/5" : "bg-red-500/5") : ""}>
                                    <td className="py-1 px-3 text-xs font-medium text-[var(--cl-text-muted)]">IGST</td>
                                    <td className="py-1 px-2">
                                        <Input
                                            type="number" step="0.01" placeholder="0.00"
                                            value={physicalIgst || ""}
                                            onChange={e => setPhysicalIgst(Number(e.target.value))}
                                            onFocus={e => { const t = e.target; setTimeout(() => (t as HTMLInputElement).select(), 0); }}
                                            className={`h-8 text-right tabular-nums text-sm ${hasValidated && !physicalValidation.igst.isValid ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                                        />
                                    </td>
                                    <td className="py-1 px-2 text-center">
                                        {!hasValidated ? (
                                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                                        ) : physicalValidation.igst.isValid ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            )}
                            
                            <tr className={`font-semibold ${hasValidated ? (physicalValidation.total.isValid ? "bg-green-500/5" : "bg-red-500/5") : ""}`}>
                                <td className="py-1 px-3 text-xs font-semibold text-[var(--cl-text)]">Total Amount</td>
                                <td className="py-1 px-2">
                                    <Input
                                        type="number" step="0.01" placeholder="0.00"
                                        value={physicalTotal || ""}
                                        onChange={e => setPhysicalTotal(Number(e.target.value))}
                                        onFocus={e => { const t = e.target; setTimeout(() => (t as HTMLInputElement).select(), 0); }}
                                        className={`h-8 text-right tabular-nums text-sm font-semibold ${hasValidated && !physicalValidation.total.isValid ? "border-red-400 bg-red-50 text-red-700" : ""}`}
                                    />
                                </td>
                                <td className="py-1 px-2 text-center">
                                    {!hasValidated ? (
                                        <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                                    ) : physicalValidation.total.isValid ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {hasValidated && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                        physicalValidation.allValid
                            ? "bg-green-500/10 text-green-700 border border-green-500/20"
                            : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                        {physicalValidation.allValid ? (
                            <><CheckCircle2 className="h-4 w-4 text-green-500" /> All checks passed — saving...</>
                        ) : (
                            <><AlertTriangle className="h-4 w-4 text-red-500" /> Validation failed. Please correct the highlighted errors.</>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={submitting}
                        onClick={() => onClose()}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-40"
                        disabled={submitting}
                        onClick={handleValidateAndSave}
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Validate {'&'} Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
