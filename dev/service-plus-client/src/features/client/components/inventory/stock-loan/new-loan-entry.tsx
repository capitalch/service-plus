import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";

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
import type { StockLoanType, LoanLineFormItem } from "@/features/client/types/stock-loan";
import { PartCodeInput } from "../part-code-input";
import { LineAddDeleteActions } from "../line-add-delete-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    branchId: number | null;
    txnTypes: StockTransactionTypeRow[];
    selectedBrandId: number | null;
    brandName?: string;
    onSuccess: () => void;
    onStatusChange: (status: { isValid: boolean; isSubmitting: boolean }) => void;
    editLoan?: StockLoanType | null;
};

export type NewLoanEntryHandle = {
    submit: () => void;
    reset: () => void;
    isSubmitting: boolean;
    isValid: boolean;
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
    branchId,
    txnTypes,
    selectedBrandId,
    brandName,
    onSuccess,
    onStatusChange,
    editLoan
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hData, setHData] = useState({
        loan_date: today(),
        loan_to: "",
        ref_no: "",
        remarks: ""
    });
    const [lines, setLines] = useState<LoanLineFormItem[]>([{
        part_id: 0,
        qty: 1,
        dr_cr: "D",
        remarks: ""
    }]);

    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);
    const isEdit = !!editLoan;

    // Initialize Edit Mode
    useEffect(() => {
        if (editLoan) {
            setHData({
                loan_date: editLoan.loan_date.slice(0, 10),
                loan_to: editLoan.loan_to,
                ref_no: editLoan.ref_no || "",
                remarks: editLoan.remarks || ""
            });
            if (editLoan.lines) {
                setOriginalLineIds(editLoan.lines.map(l => l.id));
                setLines(editLoan.lines.map(l => ({
                    part_id: l.part_id,
                    qty: Number(l.qty),
                    dr_cr: l.dr_cr,
                    remarks: l.remarks || "",
                    part: {
                        id: l.part_id,
                        part_code: l.part_code || "",
                        part_name: l.part_name || "",
                        brand_id: selectedBrandId || 0
                    } as any
                })));
            }
        } else {
            reset();
        }
    }, [editLoan]);

    const reset = () => {
        setHData({
            loan_date: today(),
            loan_to: "",
            ref_no: "",
            remarks: ""
        });
        setLines([{
            part_id: 0,
            qty: 1,
            dr_cr: "D",
            remarks: ""
        }]);
        setOriginalLineIds([]);
    };

    const updateHeader = (fields: Partial<typeof hData>) => {
        setHData(prev => ({ ...prev, ...fields }));
    };

    const updateLine = (idx: number, fields: Partial<LoanLineFormItem>) => {
        const next = [...lines];
        next[idx] = { ...next[idx], ...fields };
        setLines(next);
    };

    const addLine = () => {
        setLines([...lines, { part_id: 0, qty: 1, dr_cr: "D", remarks: "" }]);
    };

    const removeLine = (idx: number) => {
        if (lines.length > 1) {
            setLines(lines.filter((_, i) => i !== idx));
        }
    };

    const isValid = !!(
        branchId &&
        hData.loan_date &&
        hData.loan_to.trim() &&
        lines.length > 0 &&
        lines.every(l => l.part_id > 0 && l.qty > 0)
    );

    useEffect(() => {
        onStatusChange({ isValid, isSubmitting });
    }, [isValid, isSubmitting, onStatusChange]);

    const submit = async () => {
        if (!isValid || isSubmitting || !dbName || !schema || !branchId) return;

        try {
            setIsSubmitting(true);

            // Find transaction types for LOAN_IN (D) and LOAN_OUT (C)
            const inType  = txnTypes.find(t => t.code === 'LOAN_IN')?.id;
            const outType = txnTypes.find(t => t.code === 'LOAN_OUT')?.id;

            if (!inType || !outType) {
                toast.error("Required stock transaction types (LOAN_IN/OUT) not found.");
                return;
            }

            const linePayload = lines.map(line => ({
                part_id: line.part_id,
                dr_cr:   line.dr_cr,
                qty:     line.qty,
                remarks: line.remarks?.trim() || null,
                xDetails: [{
                    tableName: "stock_transaction",
                    fkeyName:  "stock_loan_line_id",
                    xData: [{
                        branch_id:                 branchId,
                        part_id:                   line.part_id,
                        qty:                       line.qty,
                        dr_cr:                     line.dr_cr,
                        transaction_date:          hData.loan_date,
                        stock_transaction_type_id: line.dr_cr === 'D' ? inType : outType,
                    }],
                }],
            }));

            const headerFields = {
                loan_date: hData.loan_date,
                loan_to:   hData.loan_to.trim(),
                ref_no:    hData.ref_no.trim() || null,
                remarks:   hData.remarks.trim() || null,
            };

            const payloadValue = graphQlUtils.buildGenericUpdateValue({
                tableName: "stock_loan",
                xData: {
                    ...(isEdit ? { id: editLoan.id } : { branch_id: branchId }),
                    ...headerFields,
                    xDetails: {
                        tableName:  "stock_loan_line",
                        fkeyName:   "stock_loan_id",
                        deletedIds: originalLineIds,
                        xData:      linePayload,
                    },
                },
            });

            const result = await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema: schema,
                    value: payloadValue
                }
            });

            if (result.data?.genericUpdate) {
                toast.success(isEdit ? MESSAGES.SUCCESS_LOAN_UPDATED : MESSAGES.SUCCESS_LOAN_CREATED);
                onSuccess();
                if (!isEdit) reset();
            }
        } catch (error: any) {
            console.error("Loan Entry Error:", error);
            toast.error(error.message || MESSAGES.ERROR_LOAN_CREATE_FAILED);
        } finally {
            setIsSubmitting(false);
        }
    };

    useImperativeHandle(ref, () => ({
        submit,
        reset,
        isSubmitting,
        isValid
    }));

    return (
        <div className="space-y-4">
            <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-xl">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                Loan Date <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="date"
                                className={inputCls}
                                value={hData.loan_date}
                                onChange={(e) => updateHeader({ loan_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                Loan To / Technician <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                className={inputCls}
                                placeholder="Technician name or agency..."
                                value={hData.loan_to}
                                onChange={(e) => updateHeader({ loan_to: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                Reference No
                            </Label>
                            <Input
                                className={inputCls}
                                placeholder="Manual Ref #..."
                                value={hData.ref_no}
                                onChange={(e) => updateHeader({ ref_no: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]">
                                Remarks
                            </Label>
                            <Input
                                className={inputCls}
                                placeholder="General remarks..."
                                value={hData.remarks}
                                onChange={(e) => updateHeader({ remarks: e.target.value })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-lg overflow-hidden">
                <div className="max-h-[400px] overflow-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-zinc-100/80 dark:bg-zinc-900/40">
                                <th className={`${thClass} w-12 text-center`}>#</th>
                                <th className={`${thClass} min-w-[300px]`}>Part Description</th>
                                <th className={`${thClass} w-32`}>Type</th>
                                <th className={`${thClass} w-32 text-right`}>Quantity</th>
                                <th className={`${thClass}`}>Line Remarks</th>
                                <th className={`${thClass} w-16 text-center`}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.map((line, idx) => (
                                <tr key={idx} className="group hover:bg-zinc-500/5 transition-colors">
                                    <td className={`${tdClass} text-center text-xs text-[var(--cl-text-muted)]`}>
                                        {idx + 1}
                                    </td>
                                    <td className={tdClass}>
                                        <PartCodeInput
                                            partCode={line.part?.part_code || ""}
                                            partId={line.part_id || null}
                                            partName={line.part?.part_name || ""}
                                            brandId={line.part?.brand_id || selectedBrandId}
                                            selectedBrandId={selectedBrandId}
                                            brandName={brandName}
                                            onChange={(code) => updateLine(idx, { part: { ...line.part, part_code: code } as any })}
                                            onClear={() => updateLine(idx, { part_id: 0, part: undefined })}
                                            onSelect={(p) => updateLine(idx, { 
                                                part_id: p.id,
                                                part: p as any
                                            })}
                                            className="border-none bg-transparent focus-visible:ring-0 h-8 font-sans"
                                        />
                                    </td>
                                    <td className={tdClass}>
                                        <select
                                            className={`${inputCls} w-full border-none bg-transparent focus:ring-0 cursor-pointer`}
                                            value={line.dr_cr}
                                            onChange={(e) => updateLine(idx, { dr_cr: e.target.value as "D" | "C" })}
                                        >
                                            <option value="D">Loan Given (OUT)</option>
                                            <option value="C">Loan Received (IN)</option>
                                        </select>
                                    </td>
                                    <td className={tdClass}>
                                        <Input
                                            type="number"
                                            className="h-8 border-none bg-transparent text-right focus-visible:ring-0 font-mono"
                                            value={line.qty}
                                            min={1}
                                            onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                                        />
                                    </td>
                                    <td className={tdClass}>
                                        <Input
                                            className="h-8 border-none bg-transparent focus-visible:ring-0"
                                            placeholder="..."
                                            value={line.remarks}
                                            onChange={(e) => updateLine(idx, { remarks: e.target.value })}
                                        />
                                    </td>
                                    <td className={`${tdClass} text-center`}>
                                        <LineAddDeleteActions
                                            onAdd={addLine}
                                            onDelete={() => removeLine(idx)}
                                            disableDelete={lines.length <= 1}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

NewLoanEntry.displayName = "NewLoanEntry";
