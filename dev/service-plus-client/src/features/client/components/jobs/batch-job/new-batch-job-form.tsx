import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AddModelDialog } from "@/features/client/components/masters/model/add-model-dialog";
import { CustomerInput } from "@/features/client/components/inventory/customer-input";
import { JobImageUpload, type StagedFile } from "@/features/client/components/jobs/single-job/job-image-upload";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { apolloClient } from "@/lib/apollo-client";
import { uploadJobFile } from "@/lib/image-service";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { DocumentSequenceRow, CustomerSearchRow } from "@/features/client/types/sales";
import type { BatchJobRow, JobBatchDetailRow, JobLookupRow, ModelRow } from "@/features/client/types/job";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    branchId:         number | null;
    docSequence:      DocumentSequenceRow | null;
    jobStatuses:      JobLookupRow[];
    jobTypes:         JobLookupRow[];
    receiveMannners:  JobLookupRow[];
    receiveConditions: JobLookupRow[];
    models:           ModelRow[];
    brands:           BrandOption[];
    products:         ProductOption[];
    customerTypes:    CustomerTypeOption[];
    masterStates:     StateOption[];
    editBatchNo?:     number | null;
    editRows?:        JobBatchDetailRow[];
    onRefreshModels:  () => void;
    onSuccess:        () => void;
    onStatusChange:   (s: { isValid: boolean; isSubmitting: boolean }) => void;
};

export type NewBatchJobFormHandle = {
    submit:       () => void;
    reset:        () => void;
    isSubmitting: boolean;
    isValid:      boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function buildJobNo(seq: DocumentSequenceRow, offset = 0): string {
    return `${seq.prefix}${seq.separator}${String(seq.next_number + offset).padStart(seq.padding, "0")}`;
}

function blankRow(seq: DocumentSequenceRow | null, offset: number): BatchJobRow {
    return {
        localId:                  crypto.randomUUID(),
        job_no:                   seq ? buildJobNo(seq, offset) : "",
        product_brand_model_id:   null,
        serial_no:                "",
        problem_reported:         "",
        warranty_card_no:         "",
        job_receive_condition_id: null,
        remarks:                  "",
        quantity:                 1,
        isDeletable:              true,
    };
}

const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";


// ─── Component ────────────────────────────────────────────────────────────────

export const NewBatchJobForm = forwardRef<NewBatchJobFormHandle, Props>(({
    branchId, docSequence, jobStatuses, jobTypes, receiveMannners, receiveConditions,
    models, brands, products, customerTypes, masterStates,
    editBatchNo, editRows,
    onRefreshModels, onSuccess, onStatusChange,
}, ref) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);

    // Shared fields
    const [batchDate,          setBatchDate]         = useState(today());
    const [customerId,         setCustomerId]        = useState<number | null>(null);
    const [customerName,       setCustomerName]      = useState("");
    const [jobTypeId,          setJobTypeId]         = useState<number | null>(null);
    const [receiveMannerId,    setReceiveMannerId]   = useState<number | null>(null);

    // Job rows
    const [rows,         setRows]         = useState<BatchJobRow[]>([]);
    const [pendingFiles, setPendingFiles] = useState<Record<string, StagedFile[]>>({});


    // UI state
    const [submitting,    setSubmitting]    = useState(false);
    const [showAddModel,  setShowAddModel]  = useState(false);
    const [seqOffset,     setSeqOffset]     = useState(0);

    const isWarranty = jobTypes.find(t => t.id === jobTypeId)?.code === "UNDER_WARRANTY";

    // Initialise / reset rows
    const handleReset = () => {
        setBatchDate(today());
        setCustomerId(null);
        setCustomerName("");
        setJobTypeId(null);
        setReceiveMannerId(null);
        setSeqOffset(0);
        setPendingFiles({});
        // setExpandedRow(null);
        setRows([blankRow(docSequence, 0)]);
    };

    // On mount / seq change — set initial row
    useEffect(() => {
        if (editBatchNo && editRows && editRows.length > 0) {
            const first = editRows[0];
            setBatchDate(first.job_date);
            setCustomerId(first.customer_contact_id);
            setCustomerName(first.customer_name ?? first.mobile);
            setJobTypeId(first.job_type_id);
            setReceiveMannerId(first.job_receive_manner_id);
            setRows(editRows.map(r => ({
                localId:                  crypto.randomUUID(),
                id:                       r.id,
                job_no:                   r.job_no,
                product_brand_model_id:   r.product_brand_model_id ?? null,
                serial_no:                r.serial_no ?? "",
                problem_reported:         r.problem_reported ?? "",
                warranty_card_no:         r.warranty_card_no ?? "",
                job_receive_condition_id: r.job_receive_condition_id ?? null,
                remarks:                  r.remarks ?? "",
                quantity:                 r.quantity ?? 1,
                isDeletable:              r.transaction_count <= 1,
            })));
        } else {
            handleReset();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editBatchNo, editRows, docSequence]);

    const addRow = () => {
        const nextOffset = seqOffset + 1;
        setSeqOffset(nextOffset);
        setRows(prev => [...prev, blankRow(docSequence, nextOffset)]);
    };

    const removeRow = (localId: string) => {
        setRows(prev => prev.filter(r => r.localId !== localId));
        setPendingFiles(prev => { const n = { ...prev }; delete n[localId]; return n; });
    };

    const updateRow = (localId: string, patch: Partial<BatchJobRow>) => {
        setRows(prev => prev.map(r => r.localId === localId ? { ...r, ...patch } : r));
    };

    const isFormValid = useMemo(() => {
        if (!customerId || !jobTypeId || !receiveMannerId) return false;
        if (rows.length === 0) return false;
        if (rows.some(r => !r.product_brand_model_id || r.quantity < 1)) return false;
        return true;
    }, [customerId, jobTypeId, receiveMannerId, rows]);

    const initialStatus = jobStatuses.find(s => s.is_initial);

    const executeSave = async () => {
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_JOB_CREATE_FAILED);
            return;
        }
        setSubmitting(true);
        try {
            if (editBatchNo) {
                const originalIds = new Set((editRows ?? []).map(r => r.id));
                const currentIds  = new Set(rows.filter(r => r.id).map(r => r.id!));
                const deletedJobIds = [...originalIds].filter(id => !currentIds.has(id));
                const addedJobs    = rows.filter(r => !r.id).map(r => ({
                    job_no: r.job_no, product_brand_model_id: r.product_brand_model_id,
                    serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                    warranty_card_no: r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                    quantity: r.quantity,
                }));
                const updatedJobs = rows.filter(r => r.id).map(r => ({
                    id: r.id!, product_brand_model_id: r.product_brand_model_id,
                    serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                    warranty_card_no: r.warranty_card_no || null,
                    job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                    quantity: r.quantity,
                }));

                const payload = encodeURIComponent(JSON.stringify({
                    batch_no: editBatchNo,
                    sharedData: {
                        branch_id: branchId, batch_date: batchDate,
                        customer_contact_id: customerId, job_type_id: jobTypeId,
                        job_receive_manner_id: receiveMannerId,
                        performed_by_user_id: currentUser?.id ?? null,
                    },
                    addedJobs, updatedJobs, deletedJobIds,
                    job_doc_sequence_id:   addedJobs.length > 0 ? (docSequence?.id ?? null) : null,
                    job_doc_sequence_next: addedJobs.length > 0 ? (docSequence ? docSequence.next_number + addedJobs.length : null) : null,
                }));

                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.updateJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });

                for (const row of addedJobs) {
                    const files = pendingFiles[row.job_no] ?? [];
                    for (const { file, about } of files) {
                        // job_id for newly added jobs comes from server — skip image for now
                        // images for new rows in edit mode can be added after save via view
                        void file; void about;
                    }
                }
                toast.success(`Batch #${editBatchNo} updated`);
            } else {
                const payload = encodeURIComponent(JSON.stringify({
                    sharedData: {
                        branch_id: branchId, batch_date: batchDate,
                        customer_contact_id: customerId, job_type_id: jobTypeId,
                        job_receive_manner_id: receiveMannerId,
                        job_status_id: initialStatus?.id ?? null,
                        performed_by_user_id: currentUser?.id ?? null,
                        job_doc_sequence_id:   docSequence?.id ?? null,
                        job_doc_sequence_next: docSequence ? docSequence.next_number + rows.length : null,
                    },
                    jobs: rows.map(r => ({
                        job_no: r.job_no, product_brand_model_id: r.product_brand_model_id,
                        serial_no: r.serial_no || null, problem_reported: r.problem_reported,
                        warranty_card_no: r.warranty_card_no || null,
                        job_receive_condition_id: r.job_receive_condition_id, remarks: r.remarks || null,
                        quantity: r.quantity,
                    })),
                }));

                const result = await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.createJobBatch,
                    variables: { db_name: dbName, schema, value: payload },
                });
                const data = result.data as { createJobBatch?: { batch_no: number; job_ids: number[] } };
                const batchNo  = data?.createJobBatch?.batch_no;
                const jobIds   = data?.createJobBatch?.job_ids ?? [];

                await Promise.all(
                    rows.map(async (row, idx) => {
                        const jobId = jobIds[idx];
                        if (!jobId) return;
                        for (const { file, about } of (pendingFiles[row.localId] ?? [])) {
                            try {
                                await uploadJobFile(dbName, schema, jobId, about, file);
                            } catch (err: unknown) {
                                toast.error(`Upload failed for "${about}": ${(err as Error).message}`);
                            }
                        }
                    })
                );

                toast.success(`Batch #${batchNo} created with ${rows.length} job${rows.length !== 1 ? "s" : ""}`);
            }
            onSuccess();
        } catch {
            toast.error(editBatchNo ? "Failed to update batch" : MESSAGES.ERROR_JOB_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!branchId)       { toast.error("Branch is not selected globally."); return; }
        if (!customerId)     { toast.error(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED); return; }
        if (!jobTypeId)      { toast.error(MESSAGES.ERROR_JOB_TYPE_REQUIRED); return; }
        if (!receiveMannerId){ toast.error(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED); return; }
        await executeSave();
    };

    useEffect(() => {
        onStatusChange({ isValid: isFormValid, isSubmitting: submitting });
    }, [isFormValid, submitting, onStatusChange]);

    useImperativeHandle(ref, () => ({
        submit:       () => { void handleSubmit(); },
        reset:        handleReset,
        isSubmitting: submitting,
        isValid:      isFormValid,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [submitting, isFormValid]);

    if (!branchId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--cl-surface-2)]/30 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                <div className="bg-[var(--cl-accent)]/5 p-5 rounded-full mb-4">
                    <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                    Please select a branch from the global header to create a batch job.
                </p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
        >
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                Batch Details
            </p>

            {/* Shared header card */}
            <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                <CardContent className="pt-2 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible items-center">

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-3 xl:col-span-3">
                        <Label className={labelCls}>Batch No</Label>
                        <Input
                            readOnly
                            className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80"
                            value={editBatchNo ? `#${editBatchNo}` : "Auto"}
                        />
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-3 xl:col-span-3">
                        <Label className={labelCls}>Batch Date</Label>
                        <Input
                            type="date"
                            className="bg-[var(--cl-surface-2)]"
                            value={batchDate}
                            onChange={e => setBatchDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Customer <span className="text-red-500">*</span></Label>
                        <CustomerInput
                            customerId={customerId}
                            customerName={customerName}
                            customerTypes={customerTypes}
                            states={masterStates}
                            onChange={name => { setCustomerName(name); if (!name.trim()) setCustomerId(null); }}
                            onClear={() => { setCustomerId(null); setCustomerName(""); }}
                            onSelect={(c: CustomerSearchRow) => { setCustomerId(c.id); setCustomerName(c.full_name ?? c.mobile); }}
                        />
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Job Type <span className="text-red-500">*</span></Label>
                        <select
                            className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!jobTypeId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                            value={jobTypeId ?? ""}
                            onChange={e => {
                                const newId = e.target.value ? Number(e.target.value) : null;
                                const code  = jobTypes.find(t => t.id === newId)?.code;
                                if (code !== "UNDER_WARRANTY") setRows(prev => prev.map(r => ({ ...r, warranty_card_no: "" })));
                                setJobTypeId(newId);
                            }}
                        >
                            <option value="">Select…</option>
                            {jobTypes.filter(j => j.is_active).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Receive Manner <span className="text-red-500">*</span></Label>
                        <select
                            className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!receiveMannerId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                            value={receiveMannerId ?? ""}
                            onChange={e => setReceiveMannerId(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">Select…</option>
                            {receiveMannners.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Job rows table */}
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                Jobs in Batch
            </p>
            <div className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                    {rows.map((row, idx) => (
                        <motion.div
                            key={row.localId}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] overflow-hidden hover:shadow-lg transition-shadow border-l-4 border-l-[var(--cl-accent)]">
                                {/* Card Header */}
                                <div className="flex items-center justify-between bg-[var(--cl-surface-2)]/50 px-3 pb-2 border-b border-[var(--cl-border)]">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase bg-[var(--cl-accent)] text-white px-2 py-0.5 rounded-full">
                                            Job #{idx + 1}
                                        </span>
                                        <span className="font-mono text-xs text-[var(--cl-accent)] font-bold">
                                            {row.job_no}
                                        </span>
                                    </div>
                                    {rows.length > 1 && row.isDeletable && (
                                        <Button
                                            type="button" size="icon" variant="ghost"
                                            className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => removeRow(row.localId)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <CardContent className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 items-center">
                                    {/* Row 1: Product / Model and Qty */}
                                    <div className="md:col-span-6 lg:col-span-9">
                                        <Label className={labelCls}>Product / Model <span className="text-red-500">*</span></Label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <SearchableCombobox<ModelRow>
                                                    label=""
                                                    placeholder="Search brand, product or model…"
                                                    items={models.filter(m => m.is_active)}
                                                    selectedValue={row.product_brand_model_id?.toString() ?? ""}
                                                    getDisplayValue={m => `${m.brand_name} — ${m.product_name} — ${m.model_name}`}
                                                    getFilterKey={m => `${m.brand_name} ${m.product_name} ${m.model_name}`}
                                                    getIdentifier={m => m.id.toString()}
                                                    onSelect={m => updateRow(row.localId, { product_brand_model_id: m ? m.id : null })}
                                                    renderItem={m => (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-semibold">{m.brand_name}</span>
                                                            <span className="text-xs opacity-70">{m.product_name} — {m.model_name}</span>
                                                        </div>
                                                    )}
                                                />
                                            </div>
                                            <Button
                                                type="button" size="icon"
                                                className="h-9 w-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                title="Add Missing Model"
                                                onClick={() => setShowAddModel(true)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-3">
                                        <Label className={labelCls}>Qty <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            className={`bg-[var(--cl-surface-2)] ${row.quantity < 1 ? "border-red-400" : ""}`}
                                            value={row.quantity}
                                            onChange={e => updateRow(row.localId, { quantity: Math.max(1, Number(e.target.value)) })}
                                        />
                                    </div>

                                    {/* Row 2: Serial No, Condition, Warranty */}
                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-4">
                                        <Label className={labelCls}>Serial No</Label>
                                        <Input
                                            className="bg-[var(--cl-surface-2)]"
                                            placeholder="Optional…"
                                            value={row.serial_no}
                                            onChange={e => updateRow(row.localId, { serial_no: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-4">
                                        <Label className={labelCls}>Receive Condition</Label>
                                        <select
                                            className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                            value={row.job_receive_condition_id ?? ""}
                                            onChange={e => updateRow(row.localId, { job_receive_condition_id: e.target.value ? Number(e.target.value) : null })}
                                        >
                                            <option value="">None</option>
                                            {receiveConditions.filter(c => c.is_active).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-4">
                                        <Label className={labelCls}>Warranty Card No</Label>
                                        <Input
                                            className="bg-[var(--cl-surface-2)]"
                                            disabled={!isWarranty}
                                            placeholder={isWarranty ? "Card number…" : "N/A"}
                                            value={row.warranty_card_no}
                                            onChange={e => updateRow(row.localId, { warranty_card_no: e.target.value })}
                                        />
                                    </div>

                                    {/* Row 3: Problem & Remarks */}
                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                        <Label className={labelCls}>Problem Reported</Label>
                                        <Textarea
                                            rows={2}
                                            className="bg-[var(--cl-surface-2)] resize-none"
                                            placeholder="Describe the problem…"
                                            value={row.problem_reported}
                                            onChange={e => updateRow(row.localId, { problem_reported: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                        <Label className={labelCls}>Remarks</Label>
                                        <Textarea
                                            rows={2}
                                            className="bg-[var(--cl-surface-2)] resize-none"
                                            placeholder="Optional remarks…"
                                            value={row.remarks}
                                            onChange={e => updateRow(row.localId, { remarks: e.target.value })}
                                        />
                                    </div>

                                    {/* Row 4: Attachments */}
                                    <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                        <Label className={labelCls}>Attachments</Label>
                                        <div className="bg-[var(--cl-surface-2)]/30 rounded-lg p-2 border border-dashed border-[var(--cl-border)]">
                                            {row.id
                                                ? <JobImageUpload jobId={row.id} />
                                                : <JobImageUpload
                                                    onPendingChange={files => setPendingFiles(prev => ({ ...prev, [row.localId]: files }))}
                                                  />
                                            }
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3">
                <Button
                    type="button" variant="outline" size="default"
                    className="gap-2 text-sm font-semibold border-2 border-dashed border-[var(--cl-accent)]/30 text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/5 hover:border-[var(--cl-accent)]"
                    onClick={addRow}
                >
                    <Plus className="h-4 w-4" />
                    Add Another Job
                </Button>
                <span className="text-xs text-[var(--cl-text-muted)]">
                    {rows.length} job{rows.length !== 1 ? "s" : ""} in this batch
                </span>
                {submitting && (
                    <span className="flex items-center gap-1.5 text-xs text-[var(--cl-text-muted)] ml-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </span>
                )}
            </div>

            <AddModelDialog
                brands={brands} products={products}
                open={showAddModel}
                onOpenChange={setShowAddModel}
                onSuccess={onRefreshModels}
            />
        </motion.div>
    );
});

NewBatchJobForm.displayName = "NewBatchJobForm";
