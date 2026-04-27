import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { StockBranchTransferType, BranchTransferLineFormItem } from "@/features/client/types/branch-transfer";
import { emptyTransferLine } from "@/features/client/types/branch-transfer";
import type { Branch } from "@/types/db-schema-service";

import { PartCodeInput } from "../part-code-input";
import { LineAddDeleteActions } from "../line-add-delete-actions";
import type { BranchTransferFormValues } from "./branch-transfer-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:           number | null;
    branches:           Branch[];
    brandName?:         string;
    editTransfer?:      StockBranchTransferType | null;
    lines:              BranchTransferLineFormItem[];
    onLinesValidChange: (v: boolean) => void;
    originalLineIds:    number[];
    selectedBrandId:    number | null;
    setLines:           React.Dispatch<React.SetStateAction<BranchTransferLineFormItem[]>>;
    setOriginalLineIds: React.Dispatch<React.SetStateAction<number[]>>;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_5.5rem]";
const hdrCellCls = "text-[11px] font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-3 px-2 flex  border-b border-r border-[var(--cl-border)] last:border-r-0 bg-zinc-200/50 dark:bg-zinc-800/50";
const inputCls = "h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewBranchTransfer({
    branchId, branches, brandName, editTransfer, lines, onLinesValidChange,
    originalLineIds, selectedBrandId, setLines, setOriginalLineIds,
}: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const form = useFormContext<BranchTransferFormValues>();
    const { register, setValue, watch } = form;

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
    }, [lines.length]);

    // Filter destination branches (cannot transfer to self)
    const destinationBranches = branches.filter(b => b.id !== branchId);

    // Populate form on edit
    useEffect(() => {
        if (!editTransfer || !dbName || !schema) return;
        apolloClient.query<GenericQueryData<StockBranchTransferType & { lines: import("@/features/client/types/branch-transfer").StockBranchTransferLineType[] }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:    SQL_MAP.GET_STOCK_BRANCH_TRANSFER_DETAIL,
                    sqlArgs:  { id: editTransfer.id },
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            form.reset({
                transfer_date: detail.transfer_date.slice(0, 10),
                to_branch_id:  String(detail.to_branch_id),
                ref_no:        detail.ref_no ?? "",
                remarks:       detail.remarks ?? "",
            });
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key:      crypto.randomUUID(),
                part_id:   l.part_id,
                brand_id:  selectedBrandId,
                part_code: l.part_code,
                part_name: l.part_name,
                qty:       Number(l.qty),
                remarks:   l.remarks ?? "",
            }));
            setLines(loadedLines);
            setOriginalLineIds((detail.lines ?? []).map(l => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_TRANSFER_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editTransfer, dbName, schema]);

    // Line mutations
    const updateLine = (idx: number, patch: Partial<BranchTransferLineFormItem>) => {
        setLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, ...patch }));
    };

    const insertLine = (idx: number) => {
        setLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyTransferLine(selectedBrandId));
            return next;
        });
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const linesValid = lines.length > 0 && lines.every(l => !!l.part_id && l.qty > 0);

    useEffect(() => {
        onLinesValidChange(linesValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linesValid]);

    const transferDate = watch("transfer_date");
    const toBranchId   = watch("to_branch_id");

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
                        <ArrowRightLeft className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                    <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                        Please select a source branch from the global header to start a branch transfer.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1">
                        Transfer Details
                        {editTransfer && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Edit</span>}
                    </p>

                    {/* Header card */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-md !overflow-visible">
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2">
                                {/* Date */}
                                <div className="space-y-2 md:col-span-1 lg:col-span-3">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                        Date <span className="text-red-500 ml-0.5">*</span>
                                    </Label>
                                    <Input
                                        {...register("transfer_date")}
                                        className={`bg-[var(--cl-surface-2)] ${!transferDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                        type="date"
                                    />
                                </div>

                                {/* Destination Branch */}
                                <div className="space-y-2 md:col-span-3 lg:col-span-3">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                        Destination Branch <span className="text-red-500 ml-0.5">*</span>
                                    </Label>
                                    <Select
                                        value={toBranchId}
                                        onValueChange={v => setValue("to_branch_id", v, { shouldValidate: true })}
                                    >
                                        <SelectTrigger className={`bg-[var(--cl-surface-2)] ${!toBranchId ? "border-red-500" : ""}`}>
                                            <SelectValue placeholder="Select branch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {destinationBranches.map(b => (
                                                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                        placeholder="Optional ..."
                                    />
                                </div>
                            </div>{/* end grid */}
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 my-2">Line Items</p>

                    {/* Lines grid */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm flex flex-col min-h-0 md:flex-1 relative">
                        <div
                            ref={scrollWrapperRef}
                            className="w-full text-sm overflow-x-auto overflow-y-auto custom-scrollbar pb-4"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
                            <div className="min-w-[800px]">

                                {/* Header row */}
                                <div className={`grid ${COLS} sticky top-0 z-20 backdrop-blur-md`}>
                                    <div className={hdrCellCls}>#</div>
                                    <div className={hdrCellCls}>Part <span className="text-red-500 ml-0.5">*</span></div>
                                    <div className={`${hdrCellCls} justify-end px-3`}>Qty <span className="text-red-500 ml-0.5">*</span></div>
                                    <div className={hdrCellCls}>Line Remarks</div>
                                    <div className={hdrCellCls} />
                                </div>

                                {/* Data rows */}
                                {lines.map((line, idx) => (
                                    <div
                                        key={line._key}
                                        className={`grid ${COLS} group transition-colors hover:bg-[var(--cl-surface-2)]/30 border-b border-[var(--cl-border)]`}
                                    >
                                        {/* # */}
                                        <div className="flex items-center justify-center text-[10px] font-bold text-[var(--cl-text-muted)] border-r border-[var(--cl-border)]/30 bg-[var(--cl-surface-2)]/20">
                                            {idx + 1}
                                        </div>

                                        {/* Part */}
                                        <div className="p-1 border-r border-[var(--cl-border)]/30">
                                            <PartCodeInput
                                                ref={el => { partInputRefs.current[idx] = el; }}
                                                brandId={line.brand_id}
                                                brandName={brandName}
                                                partCode={line.part_code}
                                                partId={line.part_id}
                                                partName={line.part_name}
                                                selectedBrandId={selectedBrandId}
                                                onChange={code => {
                                                    const patch: Partial<BranchTransferLineFormItem> = { part_code: code };
                                                    if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                    updateLine(idx, patch);
                                                }}
                                                onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                onSelect={part => {
                                                    updateLine(idx, {
                                                        brand_id:  part.brand_id,
                                                        part_code: part.part_code,
                                                        part_id:   part.id,
                                                        part_name: part.part_name,
                                                    });
                                                }}
                                                onTabToNext={() => qtyInputRefs.current[idx]?.focus()}
                                            />
                                        </div>

                                        {/* Qty */}
                                        <div className="p-1 border-r border-[var(--cl-border)]/30">
                                            <Input
                                                ref={el => { qtyInputRefs.current[idx] = el; }}
                                                className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right px-3 ${line.qty <= 0 ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                min={0}
                                                step="0.01"
                                                type="number"
                                                value={line.qty}
                                                onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                onFocus={e => e.target.select()}
                                            />
                                        </div>

                                        {/* Line Remarks */}
                                        <div className="p-1 border-r border-[var(--cl-border)]/30">
                                            <Input
                                                className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                placeholder="Optional line remark..."
                                                value={line.remarks ?? ""}
                                                onChange={e => updateLine(idx, { remarks: e.target.value })}
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-center gap-0.5 px-2 bg-[var(--cl-surface-2)]/5">
                                            <LineAddDeleteActions
                                                disableDelete={lines.length === 1}
                                                onAdd={() => insertLine(idx)}
                                                onDelete={() => removeLine(idx)}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {lines.length === 0 && (
                                    <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                        No line items added yet. Click the "+" icon to insert a row.
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── Summary Bar ── */}
                    <div ref={summaryRef} className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">{lines.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-[var(--cl-border)] pl-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Total Qty</span>
                            <span className="font-mono font-black text-base text-[var(--cl-accent)]">
                                {lines.reduce((s, l) => s + l.qty, 0)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}
