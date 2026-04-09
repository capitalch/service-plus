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

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewLoanEntry = forwardRef<NewLoanEntryHandle, Props>(({
    branchId, brandName, editLoan, onStatusChange, onSuccess, selectedBrandId, txnTypes,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [loanDate, setLoanDate] = useState(today());
    const [loanTo,   setLoanTo]   = useState("");
    const [refNo,    setRefNo]    = useState("");
    const [remarks,  setRemarks]  = useState("");

    // Lines
    const [lines, setLines] = useState<LoanLineFormItem[]>([emptyLoanLine(selectedBrandId)]);

    // Edit mode
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

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
                    sqlId:   SQL_MAP.GET_STOCK_LOAN_DETAIL,
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            setLoanDate(detail.loan_date.slice(0, 10));
            setLoanTo(detail.loan_to);
            setRefNo(detail.ref_no ?? "");
            setRemarks(detail.remarks ?? "");
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key:      crypto.randomUUID(),
                brand_id:  selectedBrandId,
                dr_cr:     l.dr_cr as "D" | "C",
                part_code: l.part_code,
                part_id:   l.part_id,
                part_name: l.part_name,
                qty:       Number(l.qty),
                remarks:   l.remarks ?? "",
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
        !!loanTo.trim() &&
        lines.length > 0 &&
        lines.every(l => !!l.part_id && l.qty > 0 && (l.dr_cr === "D" || l.dr_cr === "C"));

    // Reset
    const handleReset = () => {
        setLoanDate(today());
        setLoanTo("");
        setRefNo("");
        setRemarks("");
        setLines([emptyLoanLine(selectedBrandId)]);
        setOriginalLineIds([]);
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!loanDate)       { toast.error(MESSAGES.ERROR_LOAN_DATE_REQUIRED); return; }
        if (!loanTo.trim())  { toast.error(MESSAGES.ERROR_LOAN_TO_REQUIRED); return; }
        if (lines.some(l => !l.part_id || l.qty <= 0 || (l.dr_cr !== "D" && l.dr_cr !== "C"))) {
            toast.error(MESSAGES.ERROR_LOAN_LINE_FIELDS_REQUIRED);
            return;
        }
        await executeSave();
    };

    const executeSave = async () => {
        const loanInTypeId  = txnTypes.find(t => t.code === "LOAN_IN")?.id;
        const loanOutTypeId = txnTypes.find(t => t.code === "LOAN_OUT")?.id;
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_LOAN_CREATE_FAILED);
            return;
        }

        const linePayload = lines.map(line => ({
            dr_cr:   line.dr_cr,
            part_id: line.part_id,
            qty:     line.qty,
            remarks: line.remarks?.trim() || null,
            xDetails: [{
                fkeyName:  "stock_loan_line_id",
                tableName: "stock_transaction",
                xData: [{
                    branch_id:                 branchId,
                    dr_cr:                     line.dr_cr,
                    part_id:                   line.part_id,
                    qty:                       line.qty,
                    stock_transaction_type_id: line.dr_cr === "D" ? loanInTypeId : loanOutTypeId,
                    transaction_date:          loanDate,
                }],
            }],
        }));

        const headerFields = {
            loan_date: loanDate,
            loan_to:   loanTo.trim(),
            ref_no:    refNo.trim() || null,
            remarks:   remarks.trim() || null,
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
                            fkeyName:   "stock_loan_id",
                            tableName:  "stock_loan_line",
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
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
                            fkeyName:  "stock_loan_id",
                            tableName: "stock_loan_line",
                            xData:     linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
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
        isValid:      isFormValid,
        reset:        handleReset,
        submit:       () => { void handleSubmit(); },
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
                    {/* Header card */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm !overflow-visible">
                        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-2 gap-y-2 !overflow-visible">
                            {/* Date */}
                            <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Loan Date <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!loanDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                    value={loanDate}
                                    onChange={e => setLoanDate(e.target.value)}
                                />
                            </div>

                            {/* Loan To */}
                            <div className="space-y-2 lg:col-span-4">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Loan To / Technician <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!loanTo.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    placeholder="Technician / Agency name"
                                    value={loanTo}
                                    onChange={e => setLoanTo(e.target.value)}
                                />
                            </div>

                            {/* Ref No */}
                            <div className="space-y-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
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
                            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Remarks
                                </Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional..."
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lines table */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm flex flex-col min-h-0 relative">
                        <div className="overflow-x-auto w-full pb-4">
                            <table className="min-w-[700px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "25%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "12%" }}>IN / OUT <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "35%" }}>Line Remarks</th>
                                        <th className={`${thClass} text-left`} style={{ width: "15%" }}>Actions</th>
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
                        {lines.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>
                </>
            )}
        </motion.div>
    );
});

NewLoanEntry.displayName = "NewLoanEntry";
