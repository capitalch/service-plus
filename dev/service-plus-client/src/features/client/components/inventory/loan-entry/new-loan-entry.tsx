import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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

import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { LoanLineFormItem, StockLoanWithLines } from "@/features/client/types/stock-loan";
import { emptyLoanLine } from "@/features/client/types/stock-loan";
import { LineAddDeleteActions } from "../line-add-delete-actions";
import { PartCodeInput } from "../part-code-input";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId: number | null;
    brandName?: string;
    editLoan?: StockLoanWithLines | null;
    onStatusChange: (status: { isSubmitting: boolean; isValid: boolean }) => void;
    onSuccess: () => void;
    selectedBrandId: number | null;
    txnTypes: StockTransactionTypeRow[];
};

export type NewLoanEntryHandle = {
    isSubmitting: boolean;
    isValid: boolean;
    reset: () => void;
    submit: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const COLS = "grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,2fr)_6.5rem_5rem_minmax(0,2fr)_5.5rem]";
const hdrCellCls = "text-[11px] font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-3 px-2 flex items-center justify-center border-b border-r border-[var(--cl-border)] last:border-r-0 bg-zinc-200/50 dark:bg-zinc-800/50";
const inputCls = "h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewLoanEntry = forwardRef<NewLoanEntryHandle, Props>(({
    branchId, brandName, editLoan, onStatusChange, onSuccess, selectedBrandId, txnTypes,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [loanDate, setLoanDate] = useState(today());
    const [refNo, setRefNo] = useState("");
    const [remarks, setRemarks] = useState("");

    // Lines
    const [lines, setLines] = useState<LoanLineFormItem[]>([emptyLoanLine(selectedBrandId)]);

    // Edit mode
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Populate form on edit
    useEffect(() => {
        if (!editLoan) {
            handleReset();
            setOriginalLineIds([]);
            return;
        }
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<StockLoanWithLines>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlArgs: { id: editLoan.id },
                    sqlId: SQL_MAP.GET_STOCK_LOAN_DETAIL,
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            setLoanDate(detail.loan_date.slice(0, 10));
            setRefNo(detail.ref_no ?? "");
            setRemarks(detail.remarks ?? "");
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key: crypto.randomUUID(),
                brand_id: selectedBrandId,
                dr_cr: l.dr_cr as "D" | "C",
                loan_to: l.loan_to ?? "",
                part_code: l.part_code,
                part_id: l.part_id,
                part_name: l.part_name,
                qty: Number(l.qty),
                remarks: l.remarks ?? "",
            }));
            setLines(loadedLines);
            setOriginalLineIds((detail.lines ?? []).map(l => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_LOAN_LOAD_FAILED));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editLoan, dbName, schema]);

    // Line mutations
    const insertLine = (idx: number) => {
        setLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyLoanLine(selectedBrandId));
            return next;
        });
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const updateLine = (idx: number, patch: Partial<LoanLineFormItem>) => {
        setLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, ...patch }));
    };

    // Validation
    const isFormValid =
        !!loanDate &&
        lines.length > 0 &&
        lines.every(l => !!l.part_id && l.qty > 0 && !!l.loan_to.trim() && (l.dr_cr === "D" || l.dr_cr === "C"));

    // Reset
    const handleReset = () => {
        setLoanDate(today());
        setRefNo("");
        setRemarks("");
        setLines([emptyLoanLine(selectedBrandId)]);
        setOriginalLineIds([]);
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!loanDate) { toast.error(MESSAGES.ERROR_LOAN_DATE_REQUIRED); return; }
        if (lines.some(l => !l.part_id || l.qty <= 0 || !l.loan_to.trim() || (l.dr_cr !== "D" && l.dr_cr !== "C"))) {
            toast.error(MESSAGES.ERROR_LOAN_LINE_FIELDS_REQUIRED);
            return;
        }
        await executeSave();
    };

    const executeSave = async () => {
        const loanInTypeId = txnTypes.find(t => t.code === "LOAN_IN")?.id;
        const loanOutTypeId = txnTypes.find(t => t.code === "LOAN_OUT")?.id;
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_LOAN_CREATE_FAILED);
            return;
        }

        const linePayload = lines.map(line => ({
            dr_cr: line.dr_cr,
            loan_to: line.loan_to.trim(),
            part_id: line.part_id,
            qty: line.qty,
            remarks: line.remarks?.trim() || null,
            xDetails: [{
                fkeyName: "stock_loan_line_id",
                tableName: "stock_transaction",
                xData: [{
                    branch_id: branchId,
                    dr_cr: line.dr_cr,
                    part_id: line.part_id,
                    qty: line.qty,
                    stock_transaction_type_id: line.dr_cr === "D" ? loanInTypeId : loanOutTypeId,
                    transaction_date: loanDate,
                }],
            }],
        }));

        const headerFields = {
            loan_date: loanDate,
            ref_no: refNo.trim() || null,
            remarks: remarks.trim() || null,
        };

        setSubmitting(true);
        try {
            if (editLoan) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_loan",
                    xData: {
                        id: editLoan.id,
                        ...headerFields,
                        xDetails: {
                            deletedIds: originalLineIds,
                            fkeyName: "stock_loan_id",
                            tableName: "stock_loan_line",
                            xData: linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_LOAN_UPDATED);
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_loan",
                    xData: {
                        branch_id: branchId,
                        ...headerFields,
                        xDetails: {
                            fkeyName: "stock_loan_id",
                            tableName: "stock_loan_line",
                            xData: linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_LOAN_CREATED);
            }
            onSuccess();
        } catch {
            toast.error(editLoan ? MESSAGES.ERROR_LOAN_UPDATE_FAILED : MESSAGES.ERROR_LOAN_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    // Sync status with parent
    useEffect(() => {
        onStatusChange({ isSubmitting: submitting, isValid: isFormValid });
    }, [isFormValid, submitting, onStatusChange]);

    // Expose actions to parent
    useImperativeHandle(ref, () => ({
        isSubmitting: submitting,
        isValid: isFormValid,
        reset: handleReset,
        submit: () => { void handleSubmit(); },
    }), [handleSubmit, handleReset, submitting, isFormValid]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2 pb-2"
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--cl-surface-2)]/30 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                    <div className="bg-[var(--cl-accent)]/5 p-5 rounded-full mb-4">
                        <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                    <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                        Please select a target branch from the global header to start recording a loan entry.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1 flex items-center justify-center gap-2">
                        Loan Details
                        {editLoan && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Edit</span>}
                    </p>

                    {/* Header card */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-md !overflow-visible">
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2">
                                {/* Date */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-4 text-center">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest block">
                                        Loan Date <span className="text-red-500 ml-0.5">*</span>
                                    </Label>
                                    <Input
                                        className={`bg-[var(--cl-surface-2)] text-center ${!loanDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                        type="date"
                                        value={loanDate}
                                        onChange={e => setLoanDate(e.target.value)}
                                    />
                                </div>

                                {/* Ref No */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-4 text-center">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest block">
                                        Ref No
                                    </Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)] text-center"
                                        placeholder="Optional reference"
                                        value={refNo}
                                        onChange={e => setRefNo(e.target.value)}
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="space-y-2 md:col-span-2 lg:col-span-4 text-center">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest block">
                                        Remarks
                                    </Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)] text-center"
                                        placeholder="Optional..."
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>{/* end grid */}
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] text-center mb-1">Line Items</p>

                    {/* Lines grid */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm overflow-hidden">
                        <div className="w-full text-sm overflow-x-auto custom-scrollbar">
                            <div className="min-w-[800px]">

                                {/* Header row */}
                                <div className={`grid ${COLS} sticky top-0 z-20 backdrop-blur-md`}>
                                    <div className={hdrCellCls}>#</div>
                                    <div className={hdrCellCls}>Part <span className="text-red-500 ml-0.5">*</span></div>
                                    <div className={hdrCellCls}>Loan To <span className="text-red-500 ml-0.5">*</span></div>
                                    <div className={hdrCellCls}>IN / OUT <span className="text-red-500 ml-0.5">*</span></div>
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
                                                    const patch: Partial<LoanLineFormItem> = { part_code: code };
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

                                        {/* Loan To */}
                                        <div className="p-1 border-r border-[var(--cl-border)]/30">
                                            <Input
                                                className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] ${!line.loan_to.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                                placeholder="Technician / Agency"
                                                value={line.loan_to}
                                                onChange={e => updateLine(idx, { loan_to: e.target.value })}
                                            />
                                        </div>

                                        {/* IN / OUT */}
                                        <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-r border-[var(--cl-border)]/30">
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
                                                placeholder="Optional..."
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
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end">
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
});

NewLoanEntry.displayName = "NewLoanEntry";
