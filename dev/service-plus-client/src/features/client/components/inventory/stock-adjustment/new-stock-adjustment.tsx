import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { StockAdjustmentLineFormItem, StockAdjustmentType } from "@/features/client/types/stock-adjustment";
import { emptyAdjustmentLine } from "@/features/client/types/stock-adjustment";

import { PartCodeInput } from "../part-code-input";
import { LineAddDeleteActions } from "../line-add-delete-actions";
import type { StockAdjFormValues } from "./stock-adjustment-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:           number | null;
    brandName?:         string;
    editAdjustment?:    StockAdjustmentType | null;
    lines:              StockAdjustmentLineFormItem[];
    onLinesValidChange: (v: boolean) => void;
    originalLineIds:    number[];
    selectedBrandId:    number | null;
    setLines:           React.Dispatch<React.SetStateAction<StockAdjustmentLineFormItem[]>>;
    setOriginalLineIds: React.Dispatch<React.SetStateAction<number[]>>;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewStockAdjustment({
    branchId, brandName, editAdjustment, lines, onLinesValidChange,
    originalLineIds, selectedBrandId, setLines, setOriginalLineIds,
}: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useFormContext<StockAdjFormValues>();
    const { register, watch } = form;

    const partInputRefs    = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs     = useRef<(HTMLInputElement | null)[]>([]);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const summaryRef       = useRef<HTMLDivElement>(null);

    const [maxTableHeight, setMaxTableHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        function recalc() {
            const el = scrollWrapperRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top;
            const summaryHeight = summaryRef.current?.getBoundingClientRect().height ?? 0;
            setMaxTableHeight(window.innerHeight - top - summaryHeight - 8 - 14);
        }
        recalc();
        window.addEventListener("resize", recalc);
        return () => window.removeEventListener("resize", recalc);
    }, []);

    // Populate form on edit
    useEffect(() => {
        if (!editAdjustment || !dbName || !schema) return;
        apolloClient.query<GenericQueryData<StockAdjustmentType & { lines: import("@/features/client/types/stock-adjustment").StockAdjustmentLineType[] }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:    SQL_MAP.GET_STOCK_ADJUSTMENT_DETAIL,
                    sqlArgs:  { id: editAdjustment.id },
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            form.reset({
                adjustment_date:   detail.adjustment_date,
                adjustment_reason: detail.adjustment_reason,
                ref_no:            detail.ref_no ?? "",
                remarks:           detail.remarks ?? "",
            });
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key:      crypto.randomUUID(),
                part_id:   l.part_id,
                brand_id:  selectedBrandId,
                part_code: l.part_code,
                part_name: l.part_name,
                dr_cr:     l.dr_cr as "D" | "C",
                qty:       Number(l.qty),
                remarks:   l.remarks ?? "",
            }));
            setLines(loadedLines);
            setOriginalLineIds((detail.lines ?? []).map(l => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_ADJUSTMENT_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editAdjustment, dbName, schema]);

    // Line mutations
    const updateLine = (idx: number, patch: Partial<StockAdjustmentLineFormItem>) => {
        setLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, ...patch }));
    };

    const insertLine = (idx: number) => {
        setLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyAdjustmentLine(selectedBrandId));
            return next;
        });
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const linesValid =
        lines.length > 0 &&
        lines.every(l => !!l.part_id && l.qty > 0 && (l.dr_cr === "D" || l.dr_cr === "C"));

    useEffect(() => {
        onLinesValidChange(linesValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linesValid]);

    const adjustmentDate   = watch("adjustment_date");
    const adjustmentReason = watch("adjustment_reason");

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex min-h-fit md:min-h-0 md:flex-1 flex-col gap-2 pb-0 md:overflow-hidden"
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--cl-surface-2)]/30 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                    <div className="bg-[var(--cl-accent)]/5 p-5 rounded-full mb-4">
                        <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                    <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                        Please select a target branch from the global header to start recording a stock adjustment.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1 flex items-center gap-2">
                        Adjustment Details
                        {editAdjustment && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Edit</span>}
                    </p>

                    {/* Header card */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-md !overflow-visible">
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2">
                            {/* Date */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Date <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    {...register("adjustment_date")}
                                    className={`bg-[var(--cl-surface-2)] ${!adjustmentDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                />
                            </div>

                            {/* Reason */}
                            <div className="space-y-2 md:col-span-3 lg:col-span-4">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Reason <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    {...register("adjustment_reason")}
                                    className={`bg-[var(--cl-surface-2)] ${!adjustmentReason?.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    placeholder="e.g. Physical count correction"
                                />
                            </div>

                            {/* Ref No */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Ref No
                                </Label>
                                <Input
                                    {...register("ref_no")}
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional reference"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 md:col-span-6 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Remarks
                                </Label>
                                <Input
                                    {...register("remarks")}
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional..."
                                />
                            </div>
                            </div>{/* end grid */}
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 my-2">Line Items</p>

                    {/* Lines table */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm flex flex-col min-h-0 md:flex-1 relative">
                        <div
                            ref={scrollWrapperRef}
                            className="w-full overflow-x-auto overflow-y-auto pb-4"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
                            <table className="min-w-[700px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "25%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "12%" }}>IN / OUT <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "35%" }}>Line Remarks</th>
                                        <th className={`${thClass} text-left`} style={{ width: "15%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => (
                                        <tr key={line._key} className="hover:bg-[var(--cl-surface-2)]/30 group transition-colors">
                                            <td className={`${tdClass} pl-4 text-xs font-medium text-[var(--cl-text-muted)]`}>{idx + 1}</td>

                                            {/* Part */}
                                            <td className={tdClass}>
                                                <PartCodeInput
                                                    ref={el => { partInputRefs.current[idx] = el; }}
                                                    partCode={line.part_code}
                                                    partId={line.part_id}
                                                    partName={line.part_name}
                                                    brandId={line.brand_id}
                                                    selectedBrandId={selectedBrandId}
                                                    brandName={brandName}
                                                    onChange={code => {
                                                        const patch: Partial<StockAdjustmentLineFormItem> = { part_code: code };
                                                        if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                        updateLine(idx, patch);
                                                    }}
                                                    onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                    onSelect={part => {
                                                        updateLine(idx, {
                                                            part_id:   part.id,
                                                            brand_id:  part.brand_id,
                                                            part_code: part.part_code,
                                                            part_name: part.part_name,
                                                        });
                                                    }}
                                                    onTabToNext={() => qtyInputRefs.current[idx]?.focus()}
                                                />
                                            </td>

                                            {/* IN / OUT */}
                                            <td className={tdClass}>
                                                <div className="flex gap-1 px-1.5 py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateLine(idx, { dr_cr: "D" })}
                                                        className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-all cursor-pointer ${
                                                            line.dr_cr === "D"
                                                                ? "bg-emerald-600 text-white shadow"
                                                                : "bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] hover:bg-emerald-600/20"
                                                        }`}
                                                    >
                                                        IN
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateLine(idx, { dr_cr: "C" })}
                                                        className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-all cursor-pointer ${
                                                            line.dr_cr === "C"
                                                                ? "bg-red-500 text-white shadow"
                                                                : "bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] hover:bg-red-500/20"
                                                        }`}
                                                    >
                                                        OUT
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Qty */}
                                            <td className={tdClass}>
                                                <Input
                                                    ref={el => { qtyInputRefs.current[idx] = el; }}
                                                    className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right ${line.qty <= 0 ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                    min={0}
                                                    step="0.01"
                                                    type="number"
                                                    value={line.qty}
                                                    onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>

                                            {/* Line Remarks */}
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                    placeholder="Optional..."
                                                    value={line.remarks ?? ""}
                                                    onChange={e => updateLine(idx, { remarks: e.target.value })}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className={`${tdClass} text-left`}>
                                                <div className="flex items-center justify-start gap-0.5 px-2">
                                                    <LineAddDeleteActions
                                                        onAdd={() => insertLine(idx)}
                                                        onDelete={() => removeLine(idx)}
                                                        disableDelete={lines.length === 1}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {lines.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>

                    {/* ── Summary Bar ── */}
                    <div ref={summaryRef} className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">{lines.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">IN</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">
                                {lines.filter(l => l.dr_cr === "D").reduce((s, l) => s + l.qty, 0)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">OUT</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">
                                {lines.filter(l => l.dr_cr === "C").reduce((s, l) => s + l.qty, 0)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-[var(--cl-border)] pl-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Net</span>
                            <span className="font-mono font-black text-base text-[var(--cl-accent)]">
                                {lines.filter(l => l.dr_cr === "D").reduce((s, l) => s + l.qty, 0) -
                                 lines.filter(l => l.dr_cr === "C").reduce((s, l) => s + l.qty, 0)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}
