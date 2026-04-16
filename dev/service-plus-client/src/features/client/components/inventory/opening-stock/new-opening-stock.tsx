import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { OpeningStockLineFormItemType, OpeningStockType } from "@/features/client/types/stock-opening-balance";
import { emptyOpeningStockLine } from "@/features/client/types/stock-opening-balance";

import { LineAddDeleteActions } from "../line-add-delete-actions";
import { PartCodeInput } from "../part-code-input";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    branchId:        number | null;
    brandName?:      string;
    editEntry?:      OpeningStockType | null;
    onStatusChange:  (status: { isSubmitting: boolean; isValid: boolean }) => void;
    onSuccess:       () => void;
    selectedBrandId: number | null;
    txnTypes:        StockTransactionTypeRow[];
};

export type NewOpeningStockHandle = {
    isSubmitting: boolean;
    isValid:      boolean;
    reset:        () => void;
    submit:       () => void;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NewOpeningStock = forwardRef<NewOpeningStockHandle, Props>(({
    branchId, brandName, editEntry, onStatusChange, onSuccess, selectedBrandId, txnTypes,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [entryDate, setEntryDate] = useState(today());
    const [refNo,     setRefNo]     = useState("");
    const [remarks,   setRemarks]   = useState("");

    // Lines
    const [lines, setLines] = useState<OpeningStockLineFormItemType[]>([emptyOpeningStockLine(selectedBrandId)]);

    // Edit tracking
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Submit state
    const [submitting, setSubmitting] = useState(false);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

    // Populate form when editing
    useEffect(() => {
        if (!editEntry) {
            handleReset();
            return;
        }
        setEntryDate(editEntry.entry_date);
        setRefNo(editEntry.ref_no ?? "");
        setRemarks(editEntry.remarks ?? "");
        const loaded = (editEntry.lines ?? []).map(l => ({
            _key:      crypto.randomUUID(),
            brand_id:  selectedBrandId,
            part_code: l.part_code,
            part_id:   l.part_id,
            part_name: l.part_name,
            qty:       Number(l.qty),
            remarks:   l.remarks ?? "",
            unit_cost: Number(l.unit_cost ?? 0),
        }));
        setLines(loaded.length > 0 ? loaded : [emptyOpeningStockLine(selectedBrandId)]);
        setOriginalLineIds((editEntry.lines ?? []).map(l => l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editEntry]);

    // Validation
    const isFormValid =
        !!entryDate &&
        lines.length > 0 &&
        lines.every(l => !!l.part_id && l.qty > 0);

    // Reset
    const handleReset = () => {
        setEntryDate(today());
        setRefNo("");
        setRemarks("");
        setLines([emptyOpeningStockLine(selectedBrandId)]);
        setOriginalLineIds([]);
    };

    // Line mutations
    const insertLine = (idx: number) => {
        setLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyOpeningStockLine(selectedBrandId));
            return next;
        });
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const updateLine = (idx: number, patch: Partial<OpeningStockLineFormItemType>) => {
        setLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, ...patch }));
    };

    // Save
    const handleSubmit = async () => {
        if (!branchId)     { toast.error("Branch is not selected globally."); return; }
        if (!entryDate)    { toast.error(MESSAGES.ERROR_OPENING_STOCK_DATE_REQUIRED); return; }
        if (lines.some(l => !l.part_id || l.qty <= 0)) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_LINE_FIELDS_REQUIRED);
            return;
        }
        await executeSave();
    };

    const executeSave = async () => {
        const openingBalTypeId = txnTypes.find(t => t.code === "OPENING_BALANCE")?.id;
        if (!openingBalTypeId) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_TXN_TYPE_MISSING);
            return;
        }
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_OPENING_STOCK_CREATE_FAILED);
            return;
        }

        const linePayload = lines.map(line => ({
            part_id:   line.part_id,
            qty:       line.qty,
            remarks:   line.remarks.trim() || null,
            unit_cost: line.unit_cost > 0 ? line.unit_cost : null,
            xDetails: [{
                fkeyName:  "stock_opening_balance_line_id",
                tableName: "stock_transaction",
                xData: [{
                    branch_id:                 branchId,
                    dr_cr:                     "D",
                    part_id:                   line.part_id,
                    qty:                       line.qty,
                    stock_transaction_type_id: openingBalTypeId,
                    transaction_date:          entryDate,
                }],
            }],
        }));

        const headerFields = {
            entry_date: entryDate,
            ref_no:     refNo.trim() || null,
            remarks:    remarks.trim() || null,
        };

        setSubmitting(true);
        try {
            if (editEntry) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_opening_balance",
                    xData: {
                        id: editEntry.id,
                        ...headerFields,
                        xDetails: {
                            deletedIds: originalLineIds,
                            fkeyName:   "stock_opening_balance_id",
                            tableName:  "stock_opening_balance_line",
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_STOCK_UPDATED);
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_opening_balance",
                    xData: {
                        branch_id: branchId,
                        ...headerFields,
                        xDetails: {
                            fkeyName:  "stock_opening_balance_id",
                            tableName: "stock_opening_balance_line",
                            xData:     linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_STOCK_CREATED);
            }
            onSuccess();
        } catch {
            toast.error(editEntry ? MESSAGES.ERROR_OPENING_STOCK_UPDATE_FAILED : MESSAGES.ERROR_OPENING_STOCK_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    // Sync status with parent
    useEffect(() => {
        onStatusChange({ isSubmitting: submitting, isValid: isFormValid });
    }, [isFormValid, submitting, onStatusChange]);

    // Expose to parent
    useImperativeHandle(ref, () => ({
        isSubmitting: submitting,
        isValid:      isFormValid,
        reset:        handleReset,
        submit:       () => { void handleSubmit(); },
    }), [handleSubmit, handleReset, submitting, isFormValid]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 pb-2"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-[var(--cl-border)] bg-[var(--cl-surface-2)]/30 text-center">
                    <div className="mb-4 rounded-full bg-[var(--cl-accent)]/5 p-5">
                        <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-[var(--cl-text)]">No Branch Selected</h3>
                    <p className="max-w-md px-6 text-[var(--cl-text-muted)]">
                        Please select a branch from the global header to enter opening stock.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section label */}
                    <p className="mb-1 flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                        Entry Details
                        {editEntry && <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-600">Edit</span>}
                    </p>

                    {/* Header card */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] !overflow-visible shadow-md">
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 gap-x-2 gap-y-2 md:grid-cols-6 lg:grid-cols-12">
                                {/* Date */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                        Entry Date <span className="ml-0.5 text-red-500">*</span>
                                    </Label>
                                    <Input
                                        className={`bg-[var(--cl-surface-2)] ${!entryDate ? "border-red-500 ring-red-500/10 focus:border-red-500" : ""}`}
                                        type="date"
                                        value={entryDate}
                                        onChange={e => setEntryDate(e.target.value)}
                                    />
                                </div>

                                {/* Ref No */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                        Ref No
                                    </Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)]"
                                        placeholder="Optional reference"
                                        value={refNo}
                                        onChange={e => setRefNo(e.target.value)}
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="space-y-2 md:col-span-6 lg:col-span-7">
                                    <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                        Remarks
                                    </Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)]"
                                        placeholder="Optional..."
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">Line Items</p>

                    {/* Lines table */}
                    <Card className="relative flex min-h-0 flex-col border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="w-full overflow-x-auto pb-4">
                            <table className="min-w-[720px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "28%" }}>Part <span className="ml-0.5 text-red-500">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty <span className="ml-0.5 text-red-500">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "12%" }}>Unit Cost</th>
                                        <th className={thClass} style={{ width: "35%" }}>Line Remarks</th>
                                        <th className={`${thClass} text-left`} style={{ width: "12%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => (
                                        <tr key={line._key} className="group transition-colors hover:bg-[var(--cl-surface-2)]/30">
                                            <td className={`${tdClass} pl-4 text-xs font-medium text-[var(--cl-text-muted)]`}>{idx + 1}</td>

                                            {/* Part */}
                                            <td className={tdClass}>
                                                <PartCodeInput
                                                    ref={el => { partInputRefs.current[idx] = el; }}
                                                    brandId={line.brand_id}
                                                    brandName={brandName}
                                                    partCode={line.part_code}
                                                    partId={line.part_id}
                                                    partName={line.part_name}
                                                    selectedBrandId={selectedBrandId}
                                                    onChange={code => {
                                                        const patch: Partial<OpeningStockLineFormItemType> = { part_code: code };
                                                        if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                        updateLine(idx, patch);
                                                    }}
                                                    onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                    onSelect={part => updateLine(idx, {
                                                        brand_id:  part.brand_id,
                                                        part_code: part.part_code,
                                                        part_id:   part.id,
                                                        part_name: part.part_name,
                                                    })}
                                                    onTabToNext={() => qtyInputRefs.current[idx]?.focus()}
                                                />
                                            </td>

                                            {/* Qty */}
                                            <td className={tdClass}>
                                                <Input
                                                    ref={el => { qtyInputRefs.current[idx] = el; }}
                                                    className={`${inputCls} border-transparent bg-transparent text-right hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] ${line.qty <= 0 ? "border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)] focus:border-red-500" : ""}`}
                                                    min={0}
                                                    step="0.001"
                                                    type="number"
                                                    value={line.qty}
                                                    onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>

                                            {/* Unit Cost */}
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} border-transparent bg-transparent text-right hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                    min={0}
                                                    step="0.01"
                                                    type="number"
                                                    value={line.unit_cost}
                                                    onChange={e => updateLine(idx, { unit_cost: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>

                                            {/* Line Remarks */}
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} border-transparent bg-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                    placeholder="Optional..."
                                                    value={line.remarks}
                                                    onChange={e => updateLine(idx, { remarks: e.target.value })}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className={`${tdClass} text-left`}>
                                                <div className="flex items-center justify-start gap-0.5 px-2">
                                                    <LineAddDeleteActions
                                                        disableDelete={lines.length === 1}
                                                        onAdd={() => insertLine(idx)}
                                                        onDelete={() => removeLine(idx)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Summary bar */}
                    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-mono text-sm font-semibold text-[var(--cl-text)]">{lines.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Qty</span>
                            <span className="font-mono text-sm font-semibold text-[var(--cl-text)]">
                                {lines.reduce((s, l) => s + l.qty, 0).toFixed(3)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-[var(--cl-border)] pl-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Total Value</span>
                            <span className="font-mono text-base font-black text-[var(--cl-accent)]">
                                {lines.reduce((s, l) => s + l.qty * l.unit_cost, 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
});

NewOpeningStock.displayName = "NewOpeningStock";
