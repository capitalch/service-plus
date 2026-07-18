import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
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
import type { OpeningStockListItem, OpeningStockType } from "@/features/client/types/stock-opening-balance";

import { LineAddDeleteActions } from "../line-add-delete-actions";
import { PartCodeInput } from "../part-code-input";
import { getInitialOpeningStockLine, type OpeningStockFormValues, type OpeningStockLineFormValues } from "./opening-stock-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:           number | null;
    brandName?:         string;
    editEntry?:         OpeningStockListItem | null;
    onLinesValidChange: (v: boolean) => void;
    selectedBrandId:    number | null;
    setOriginalLineIds: React.Dispatch<React.SetStateAction<number[]>>;
    form:              ReturnType<typeof useFormContext<OpeningStockFormValues>>;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-(--cl-text) py-2 px-2 text-left border-b border-(--cl-border) bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-(--cl-border) align-top";
const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewOpeningStock({
    branchId, brandName, editEntry, onLinesValidChange,
    selectedBrandId, setOriginalLineIds, form,
}: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const { control, register, setValue, getValues, trigger } = useFormContext<OpeningStockFormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: "lines",
    });

    const updateLine = (idx: number, patch: Partial<OpeningStockLineFormValues>) => {
        const current = getValues(`lines.${idx}`);
        setValue(`lines.${idx}`, { ...current, ...patch }, { shouldValidate: true, shouldDirty: true });
        void trigger();
    };

    // Summary calculations
    const formLines = useWatch({ control, name: "lines" }) ?? [];
    const totalQty = useMemo(() => formLines.reduce((s, l) => s + (l.qty ?? 0), 0), [formLines]);
    const totalValue = useMemo(() => formLines.reduce((s, l) => s + ((l.qty ?? 0) * (l.unit_cost ?? 0)), 0), [formLines]);

    useEffect(() => {
        onLinesValidChange(fields.length > 0 && formLines.every(l => !!l.part_id && (l.qty ?? 0) > 0));
    }, [fields.length, formLines, onLinesValidChange]);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const summaryRef       = useRef<HTMLDivElement>(null);
    const [maxTableHeight, setMaxTableHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        function recalc() {
            if (window.innerWidth < 768) {
                setMaxTableHeight(undefined);
                return;
            }
            const el = scrollWrapperRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top;
            const summaryHeight = summaryRef.current?.getBoundingClientRect().height ?? 0;
            setMaxTableHeight(window.innerHeight - top - summaryHeight - 8 - 14);
        }
        recalc();
        window.addEventListener("resize", recalc);
        return () => window.removeEventListener("resize", recalc);
    }, [fields.length]);

    // Populate form when editing
    useEffect(() => {
        if (!editEntry || !dbName || !schema) return;
        apolloClient.query<GenericQueryData<OpeningStockType>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { id: editEntry.id },
                    sqlId:   SQL_MAP.GET_OPENING_STOCK_DETAIL,
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            const loaded = (detail.lines ?? []).map(l => ({
                _key:      crypto.randomUUID(),
                brand_id:  selectedBrandId,
                part_code: l.part_code,
                part_id:   l.part_id,
                part_name: l.part_name,
                qty:       Number(l.qty),
                remarks:   l.remarks ?? "",
                unit_cost: Number(l.unit_cost ?? 0),
            }));
            form.reset({
                entry_date: detail.entry_date.slice(0, 10),
                ref_no:     detail.ref_no ?? "",
                remarks:    detail.remarks ?? "",
                lines:     loaded.length > 0 ? loaded : [getInitialOpeningStockLine(selectedBrandId)],
            });
            void form.trigger();
            setOriginalLineIds((detail.lines ?? []).map(l => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_OPENING_STOCK_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editEntry, dbName, schema]);

    // Line mutations
    const handleAddLine = () => {
        append(getInitialOpeningStockLine(selectedBrandId));
    };

    const handleRemoveLine = (idx: number) => {
        if (fields.length > 1) remove(idx);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-fit md:min-h-0 md:flex-1 flex-col gap-2 pb-0 md:overflow-hidden"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-(--cl-border) bg-(--cl-surface-2)/30 text-center">
                    <div className="mb-4 rounded-full bg-(--cl-accent)/5 p-5">
                        <Plus className="h-12 w-12 text-(--cl-accent) opacity-40" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-(--cl-text)">No Branch Selected</h3>
                    <p className="max-w-md px-6 text-(--cl-text-muted)">
                        Please select a branch from the global header to enter opening stock.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section label */}
                    <p className="mb-1 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted)">
                        Entry Details
                        {editEntry && <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-600">Edit</span>}
                    </p>

                    {/* Header card */}
                    <Card className="border-(--cl-border) bg-(--cl-surface) !overflow-visible shadow-md">
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 gap-x-2 gap-y-2 md:grid-cols-6 lg:grid-cols-12">
                                {/* Date */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-(--cl-text)">
                                        Entry Date <span className="ml-0.5 text-red-500">*</span>
                                    </Label>
                                    <Input
                                        {...register("entry_date")}
                                        className={`bg-(--cl-surface-2) ${!form.watch("entry_date") ? "border-red-500 ring-red-500/10 focus:border-red-500" : ""}`}
                                        type="date"
                                    />
                                </div>

                                {/* Ref No */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-(--cl-text)">
                                        Ref No
                                    </Label>
                                    <Input
                                        {...register("ref_no")}
                                        className="bg-(--cl-surface-2)"
                                        placeholder="Optional reference"
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="space-y-2 md:col-span-6 lg:col-span-7">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-(--cl-text)">
                                        Remarks
                                    </Label>
                                    <Input
                                        {...register("remarks")}
                                        className="bg-(--cl-surface-2)"
                                        placeholder="Optional..."
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted) my-2">Line Items</p>

                    {/* Lines table */}
                    <Card className="relative flex min-h-0 flex-col border-(--cl-border) bg-(--cl-surface) shadow-sm md:flex-1">
                        <div
                            ref={scrollWrapperRef}
                            className="w-full overflow-x-auto overflow-y-auto custom-scrollbar pb-4"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
                            <table className="min-w-[720px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-(--cl-surface-2)/50">
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "28%" }}>Part <span className="ml-0.5 text-red-500">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty <span className="ml-0.5 text-red-500">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "12%" }}>Unit Cost</th>
                                        <th className={thClass} style={{ width: "35%" }}>Line Remarks</th>
                                        <th className={`${thClass} text-left`} style={{ width: "12%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-(--cl-surface)">
                                    {fields.map((field, idx) => {
                                        const line = formLines[idx];
                                        return (
                                        <tr key={field.id} className="group transition-colors hover:bg-(--cl-surface-2)/30">
                                            <td className={`${tdClass} pl-4 pt-1 text-xs font-medium text-(--cl-text-muted)`}>{idx + 1}</td>

                                            {/* Part */}
                                            <td className={tdClass}>
                                                <PartCodeInput
                                                    ref={el => { partInputRefs.current[idx] = el; }}
                                                    brandId={line?.brand_id}
                                                    brandName={brandName}
                                                    partCode={line?.part_code ?? ""}
                                                    partId={line?.part_id ?? null}
                                                    partName={line?.part_name ?? ""}
                                                    selectedBrandId={selectedBrandId}
                                                    onChange={code => {
                                                        const patch: Partial<OpeningStockLineFormValues> = { part_code: code };
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

                                            {/* Qty */}
                                            <td className={tdClass}>
                                                <Input
                                                    ref={el => { qtyInputRefs.current[idx] = el; }}
                                                    className={`${inputCls} mt-1 border-transparent bg-transparent text-right hover:border-(--cl-border) focus:bg-white ${(line?.qty ?? 0) <= 0 ? "border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] focus:border-red-500" : ""}`}
                                                    min={0}
                                                    step="0.001"
                                                    type="number"
                                                    value={line?.qty ?? 0}
                                                    onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>

                                            {/* Unit Cost */}
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} mt-1 border-transparent bg-transparent text-right hover:border-(--cl-border) focus:bg-white`}
                                                    min={0}
                                                    step="0.01"
                                                    type="number"
                                                    value={line?.unit_cost ?? 0}
                                                    onChange={e => updateLine(idx, { unit_cost: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>

                                            {/* Line Remarks */}
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} mt-1 border-transparent bg-transparent hover:border-(--cl-border) focus:bg-white`}
                                                    placeholder="Optional..."
                                                    value={line?.remarks ?? ""}
                                                    onChange={e => updateLine(idx, { remarks: e.target.value })}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className={`${tdClass} text-left`}>
                                                <div className="flex items-center justify-start gap-0.5 px-2">
                                                    <LineAddDeleteActions
                                                        disableDelete={fields.length === 1}
                                                        onAdd={handleAddLine}
                                                        onDelete={() => handleRemoveLine(idx)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );})}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Summary bar */}
                    <div ref={summaryRef} className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-lg border border-(--cl-border) bg-(--cl-surface-2)/40 px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Lines</span>
                            <span className="font-mono text-sm font-semibold text-(--cl-text)">{fields.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Qty</span>
                            <span className="font-mono text-sm font-semibold text-(--cl-text)">
                                {totalQty.toFixed(3)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-(--cl-border) pl-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Total Value</span>
                            <span className="font-mono text-base font-black text-(--cl-accent)">
                                {totalValue.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}
