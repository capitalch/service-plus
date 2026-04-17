import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId: number | null;
    onSuccess: () => void;
    onStatusChange: (status: { isValid: boolean; isSubmitting: boolean }) => void;
    selectedBrandId: number | null;
    brandName?: string;
    editTransfer?: StockBranchTransferType | null;
    branches: Branch[];
};

export type NewBranchTransferHandle = {
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

const COLS = "grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_5.5rem]";
const hdrCellCls = "text-[11px] font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-3 px-2 flex  border-b border-r border-[var(--cl-border)] last:border-r-0 bg-zinc-200/50 dark:bg-zinc-800/50";
const inputCls = "h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewBranchTransfer = forwardRef<NewBranchTransferHandle, Props>(({
    branchId, onSuccess, onStatusChange, selectedBrandId, brandName, editTransfer, branches,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [transferDate, setTransferDate] = useState(today());
    const [toBranchId,   setToBranchId]   = useState<string>("");
    const [refNo,        setRefNo]        = useState("");
    const [remarks,      setRemarks]      = useState("");

    // Lines
    const [lines, setLines] = useState<BranchTransferLineFormItem[]>([emptyTransferLine(selectedBrandId)]);

    // Edit mode
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const qtyInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

    // Filter destination branches (cannot transfer to self)
    const destinationBranches = branches.filter(b => b.id !== branchId);

    // Populate form on edit
    useEffect(() => {
        if (!editTransfer) {
            handleReset();
            setOriginalLineIds([]);
            return;
        }
        if (!dbName || !schema) return;
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
            setTransferDate(detail.transfer_date.slice(0, 10));
            setToBranchId(String(detail.to_branch_id));
            setRefNo(detail.ref_no ?? "");
            setRemarks(detail.remarks ?? "");
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key:       crypto.randomUUID(),
                part_id:    l.part_id,
                brand_id:   selectedBrandId,
                part_code:  l.part_code,
                part_name:  l.part_name,
                qty:        Number(l.qty),
                remarks:    l.remarks ?? "",
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

    // Validation
    const isFormValid =
        !!transferDate &&
        !!toBranchId &&
        lines.length > 0 &&
        lines.every(l => !!l.part_id && l.qty > 0);

    // Reset
    const handleReset = () => {
        setTransferDate(today());
        setToBranchId("");
        setRefNo("");
        setRemarks("");
        setLines([emptyTransferLine(selectedBrandId)]);
        setOriginalLineIds([]);
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!transferDate) { toast.error(MESSAGES.ERROR_TRANSFER_DATE_REQUIRED); return; }
        if (!toBranchId) { toast.error(MESSAGES.ERROR_TRANSFER_DESTINATION_REQUIRED); return; }
        if (lines.some(l => !l.part_id || l.qty <= 0)) {
            toast.error(MESSAGES.ERROR_TRANSFER_LINE_FIELDS_REQUIRED);
            return;
        }
        await executeSave();
    };

    const executeSave = async () => {
        if (!branchId || !toBranchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_TRANSFER_CREATE_FAILED);
            return;
        }

        setSubmitting(true);
        try {
            // Fetch txn types
            const txnRes = await apolloClient.query<GenericQueryData<{ id: number; code: string }>>({
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }),
                },
            });
            const tTypes = txnRes.data?.genericQuery ?? [];
            const outType = tTypes.find(t => t.code === 'BRANCH_TRANSFER_OUT')?.id;
            const inType  = tTypes.find(t => t.code === 'BRANCH_TRANSFER_IN')?.id;

            if (!outType || !inType) {
                toast.error("Required stock transaction types (BRANCH_TRANSFER_IN/OUT) not found.");
                setSubmitting(false);
                return;
            }

            const linePayload = lines.map(line => ({
                part_id: line.part_id,
                qty:     line.qty,
                remarks: line.remarks?.trim() || null,
                xDetails: [{
                    // Double entry in stock_transaction
                    tableName: "stock_transaction",
                    fkeyName:  "stock_branch_transfer_line_id",
                    xData: [
                        {
                            // Source branch (Credit - OUT)
                            branch_id:                 branchId,
                            part_id:                   line.part_id,
                            qty:                       line.qty,
                            dr_cr:                     "C",
                            transaction_date:          transferDate,
                            stock_transaction_type_id: outType,
                        },
                        {
                            // Destination branch (Debit - IN)
                            branch_id:                 Number(toBranchId),
                            part_id:                   line.part_id,
                            qty:                       line.qty,
                            dr_cr:                     "D",
                            transaction_date:          transferDate,
                            stock_transaction_type_id: inType,
                        }
                    ],
                }],
            }));

            const headerFields = {
                transfer_date:  transferDate,
                from_branch_id: branchId,
                to_branch_id:   Number(toBranchId),
                ref_no:         refNo.trim() || null,
                remarks:        remarks.trim() || null,
            };

            if (editTransfer) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_branch_transfer",
                    xData: {
                        id: editTransfer.id,
                        ...headerFields,
                        xDetails: {
                            tableName:  "stock_branch_transfer_line",
                            fkeyName:   "stock_branch_transfer_id",
                            deletedIds: originalLineIds,
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_TRANSFER_UPDATED);
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "stock_branch_transfer",
                    xData: {
                        ...headerFields,
                        xDetails: {
                            tableName: "stock_branch_transfer_line",
                            fkeyName:  "stock_branch_transfer_id",
                            xData:     linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_TRANSFER_CREATED);
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(editTransfer ? MESSAGES.ERROR_TRANSFER_UPDATE_FAILED : MESSAGES.ERROR_TRANSFER_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    // Sync status with parent
    useEffect(() => {
        onStatusChange({ isValid: isFormValid, isSubmitting: submitting });
    }, [isFormValid, submitting, onStatusChange]);

    // Expose actions to parent
    useImperativeHandle(ref, () => ({
        submit:      () => { void handleSubmit(); },
        reset:       handleReset,
        isSubmitting: submitting,
        isValid:      isFormValid,
    }), [handleSubmit, handleReset, submitting, isFormValid]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-2 pb-2"
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
                                        className={`bg-[var(--cl-surface-2)] ${!transferDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                        type="date"
                                        value={transferDate}
                                        onChange={e => setTransferDate(e.target.value)}
                                    />
                                </div>

                                {/* Destination Branch */}
                                <div className="space-y-2 md:col-span-3 lg:col-span-3">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                        Destination Branch <span className="text-red-500 ml-0.5">*</span>
                                    </Label>
                                    <Select value={toBranchId} onValueChange={setToBranchId}>
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
                                        className="bg-[var(--cl-surface-2)]"
                                        placeholder="Optional reference"
                                        value={refNo}
                                        onChange={e => setRefNo(e.target.value)}
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="space-y-2 md:col-span-6 lg:col-span-3">
                                    <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                        Remarks
                                    </Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)]"
                                        placeholder="Optional ..."
                                        value={remarks}
                                        onChange={e => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>{/* end grid */}
                        </CardContent>
                    </Card>

                    {/* Section label */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 my-2">Line Items</p>

                    {/* Lines grid */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm overflow-hidden">
                        <div className="w-full text-sm overflow-x-auto custom-scrollbar">
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
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end">
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
});

NewBranchTransfer.displayName = "NewBranchTransfer";
