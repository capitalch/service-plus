import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PhysicalValues = {
    qty:   number;
    cgst:  number;
    sgst:  number;
    igst:  number;
    total: number;
};

type PhysicalTotals = {
    qty: number;
    cgst:     number;
    sgst:     number;
    igst:     number;
    total:    number;
};

export type PhysicalInvoiceModalProps = {
    isOpen:     boolean;
    onClose:    () => void;
    onSubmit:   (values: PhysicalValues) => void;
    submitting: boolean;
    isIgst:     boolean;
    totals:     PhysicalTotals;
};

export function PhysicalInvoiceModal({
    isOpen,
    onClose,
    onSubmit,
    submitting,
    isIgst,
    totals,
}: PhysicalInvoiceModalProps) {
    const { watch, setValue, setError, clearErrors, handleSubmit, reset, formState: { errors, isSubmitted } } =
        useForm<PhysicalValues>({ defaultValues: { qty: 0, cgst: 0, sgst: 0, igst: 0, total: 0 } });

    useEffect(() => {
        if (isOpen) reset({ qty: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    }, [isOpen, reset]);

    const values = watch();
    const allValid = isSubmitted && Object.keys(errors).length === 0;

    const validateAndSubmit = handleSubmit((vals) => {
        const check = (p: number, c: number, pct: number, minAbs?: number) => {
            const diff    = Math.abs(p - c);
            const allowed = minAbs !== undefined ? Math.max((pct / 100) * c, minAbs) : (pct / 100) * c;
            return diff <= allowed + 0.0001;
        };
        const taxPct = 0.02, taxMin = 0.20, totalPct = 0.2;
        let ok = true;

        if (Math.abs(vals.qty - totals.qty) >= 0.001) { setError("qty",   { type: "manual" }); ok = false; }
        if (!isIgst && !check(vals.cgst, totals.cgst, taxPct, taxMin)) { setError("cgst",  { type: "manual" }); ok = false; }
        if (!isIgst && !check(vals.sgst, totals.sgst, taxPct, taxMin)) { setError("sgst",  { type: "manual" }); ok = false; }
        if (isIgst  && !check(vals.igst, totals.igst, taxPct, taxMin)) { setError("igst",  { type: "manual" }); ok = false; }
        if (!check(vals.total, totals.total, totalPct))                 { setError("total", { type: "manual" }); ok = false; }

        if (ok) onSubmit(vals);
    });

    const statusIcon = (field: keyof PhysicalValues) => {
        if (!isSubmitted) return <span className="text-(--cl-text-muted) text-xs">—</span>;
        return errors[field]
            ? <XCircle className="h-4 w-4 text-red-500 mx-auto" />
            : <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />;
    };

    const rowCls   = (field: keyof PhysicalValues) =>
        isSubmitted ? (errors[field] ? "bg-red-500/5" : "bg-green-500/5") : "";
    const inputCls = (field: keyof PhysicalValues, extra = "") =>
        `h-8 text-right tabular-nums text-sm ${extra} ${isSubmitted && errors[field] ? "border-red-400 bg-red-50 text-red-700" : ""}`;

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open && !submitting) onClose(); }}>
            <DialogContent aria-describedby={undefined} className="max-w-lg !bg-white !text-zinc-900 border-zinc-200">
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

                <div className="overflow-hidden rounded-md border border-(--cl-border)">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-(--cl-surface-2)/60 border-b border-(--cl-border)">
                                <th className="py-2 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Field</th>
                                <th className="py-2 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Your Entry</th>
                                <th className="py-2 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-(--cl-text-muted)">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--cl-border)">
                            {/* Qty */}
                            <tr className={rowCls("qty")}>
                                <td className="py-1 px-3 text-xs font-medium text-(--cl-text-muted)">Total Qty</td>
                                <td className="py-1 px-2">
                                    <Input type="number" step="0.01" placeholder="0"
                                        value={values.qty || ""}
                                        className={inputCls("qty")}
                                        onFocus={e => setTimeout(() => e.target.select(), 0)}
                                        onChange={e => { clearErrors("qty"); setValue("qty", e.target.value === "" ? 0 : Number(e.target.value)); }} />
                                </td>
                                <td className="py-1 px-2 text-center">{statusIcon("qty")}</td>
                            </tr>

                            {/* CGST */}
                            {!isIgst && (
                                <tr className={rowCls("cgst")}>
                                    <td className="py-1 px-3 text-xs font-medium text-(--cl-text-muted)">CGST</td>
                                    <td className="py-1 px-2">
                                        <Input type="number" step="0.01" placeholder="0.00"
                                            value={values.cgst || ""}
                                            className={inputCls("cgst")}
                                            onFocus={e => setTimeout(() => e.target.select(), 0)}
                                            onChange={e => {
                                                const val = e.target.value === "" ? 0 : Number(e.target.value);
                                                clearErrors("cgst");
                                                clearErrors("sgst");
                                                setValue("cgst", val);
                                                setValue("sgst", val);
                                            }} />
                                    </td>
                                    <td className="py-1 px-2 text-center">{statusIcon("cgst")}</td>
                                </tr>
                            )}

                            {/* SGST (read-only, mirrors CGST) */}
                            {!isIgst && (
                                <tr className={rowCls("sgst")}>
                                    <td className="py-1 px-3 text-xs font-medium text-(--cl-text-muted)">SGST</td>
                                    <td className="py-1 px-2">
                                        <Input type="number" step="0.01" placeholder="0.00"
                                            value={values.sgst || ""}
                                            readOnly tabIndex={-1}
                                            className={inputCls("sgst", "bg-zinc-100 opacity-80 cursor-not-allowed")} />
                                    </td>
                                    <td className="py-1 px-2 text-center">{statusIcon("sgst")}</td>
                                </tr>
                            )}

                            {/* IGST */}
                            {isIgst && (
                                <tr className={rowCls("igst")}>
                                    <td className="py-1 px-3 text-xs font-medium text-(--cl-text-muted)">IGST</td>
                                    <td className="py-1 px-2">
                                        <Input type="number" step="0.01" placeholder="0.00"
                                            value={values.igst || ""}
                                            className={inputCls("igst")}
                                            onFocus={e => setTimeout(() => e.target.select(), 0)}
                                            onChange={e => { clearErrors("igst"); setValue("igst", e.target.value === "" ? 0 : Number(e.target.value)); }} />
                                    </td>
                                    <td className="py-1 px-2 text-center">{statusIcon("igst")}</td>
                                </tr>
                            )}

                            {/* Invoice amount */}
                            <tr className={`font-semibold ${rowCls("total")}`}>
                                <td className="py-1 px-3 text-xs font-semibold text-(--cl-text)">Invoice amount</td>
                                <td className="py-1 px-2">
                                    <Input type="number" step="0.01" placeholder="0.00"
                                        value={values.total || ""}
                                        className={inputCls("total", "font-semibold")}
                                        onFocus={e => setTimeout(() => e.target.select(), 0)}
                                        onChange={e => { clearErrors("total"); setValue("total", e.target.value === "" ? 0 : Number(e.target.value)); }} />
                                </td>
                                <td className="py-1 px-2 text-center">{statusIcon("total")}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {isSubmitted && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                        allValid
                            ? "bg-green-500/10 text-green-700 border border-green-500/20"
                            : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                        {allValid ? (
                            <><CheckCircle2 className="h-4 w-4 text-green-500" /> All checks passed — saving...</>
                        ) : (
                            <><AlertTriangle className="h-4 w-4 text-red-500" /> Validation failed. Please correct the highlighted errors.</>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" disabled={submitting} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-40"
                        disabled={submitting}
                        onClick={() => void validateAndSubmit()}
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Validate {'&'} Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
