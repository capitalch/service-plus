import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { DocumentSequenceRow, CustomerSearchRow } from "@/features/client/types/sales";
import type { JobDetailType, JobLookupRow, ModelRow, TechnicianRow } from "@/features/client/types/job";
import { CustomerInput } from "@/features/client/components/inventory/customer-input";
import { JobImageUpload, type StagedFile } from "./job-image-upload";
import { uploadJobFile } from "@/lib/image-service";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AddModelDialog } from "@/features/client/components/masters/model/add-model-dialog";
import { Button } from "@/components/ui/button";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:        number | null;
    docSequence:     DocumentSequenceRow | null;
    jobStatuses:     JobLookupRow[];
    jobTypes:        JobLookupRow[];
    receiveMannners: JobLookupRow[];
    receiveConditions: JobLookupRow[];
    technicians:     TechnicianRow[];
    models:          ModelRow[];
    brands:          BrandOption[];
    products:        ProductOption[];
    customerTypes:   CustomerTypeOption[];
    masterStates:    StateOption[];
    editJob?:        JobDetailType | null;
    onRefreshModels: () => void;
    onSuccess:       () => void;
    onStatusChange:  (status: { isValid: boolean; isSubmitting: boolean }) => void;
};

export type NewSingleJobFormHandle = {
    submit:       () => void;
    reset:        () => void;
    isSubmitting: boolean;
    isValid:      boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function buildJobNo(seq: DocumentSequenceRow): string {
    return `${seq.prefix}${seq.separator}${String(seq.next_number).padStart(seq.padding, "0")}`;
}

const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewSingleJobForm = forwardRef<NewSingleJobFormHandle, Props>(({
    branchId, docSequence, jobStatuses, jobTypes, receiveMannners, receiveConditions, models, brands, products, customerTypes, masterStates, editJob,
    onRefreshModels, onSuccess, onStatusChange,
}, ref) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);

    // Header state
    const [customerId,          setCustomerId]         = useState<number | null>(editJob?.customer_contact_id ?? null);
    const [customerName,        setCustomerName]       = useState(editJob?.customer_name ?? "");
    const [addressSnapshot,     setAddressSnapshot]    = useState(editJob?.address_snapshot ?? "");
    const [jobDate,             setJobDate]            = useState(today());
    const [jobTypeId,           setJobTypeId]          = useState<number | null>(editJob?.job_type_id ?? null);
    const [receiveMannerId,     setReceiveMannerId]    = useState<number | null>(editJob?.job_receive_manner_id ?? null);
    const [receiveConditionId,  setReceiveConditionId] = useState<number | null>(editJob?.job_receive_condition_id ?? null);
    const [jobStatusId,         setJobStatusId]        = useState<number | null>(editJob?.job_status_id ?? null);
    const [modelId,             setModelId]            = useState<number | null>(editJob?.product_brand_model_id ?? null);
    const [serialNo,            setSerialNo]           = useState(editJob?.serial_no ?? "");
    const [quantity,            setQuantity]           = useState(editJob?.quantity ?? 1);
    const [problemReported,     setProblemReported]    = useState(editJob?.problem_reported ?? "");
    const [warrantyCardNo,      setWarrantyCardNo]     = useState(editJob?.warranty_card_no ?? "");
    const [remarks,             setRemarks]            = useState(editJob?.remarks ?? "");

    const [submitting, setSubmitting] = useState(false);
    const [showAddModel, setShowAddModel] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<StagedFile[]>([]);
    const [stagedKey, setStagedKey] = useState(0);

    const isWarranty = jobTypes.find(t => t.id === jobTypeId)?.code === "UNDER_WARRANTY";

    // Set initial job status on first load
    useEffect(() => {
        if (jobStatuses.length > 0 && !editJob) {
            const initial = jobStatuses.find(s => s.is_initial);
            if (initial) setJobStatusId(initial.id);
        }
    }, [jobStatuses, editJob]);

    // Populate form when editing
    useEffect(() => {
        if (!editJob) {
            handleReset();
            return;
        }
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<JobDetailType>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_JOB_DETAIL,
                    sqlArgs: { id: editJob.id },
                }),
            },
        }).then(res => {
            const d = res.data?.genericQuery?.[0];
            if (!d) return;
            setCustomerId(d.customer_contact_id);
            setCustomerName(d.customer_name ?? d.mobile ?? "");
            setAddressSnapshot(d.address_snapshot ?? "");
            setJobDate(d.job_date);
            setJobTypeId(d.job_type_id);
            setReceiveMannerId(d.job_receive_manner_id);
            setReceiveConditionId(d.job_receive_condition_id ?? null);
            setJobStatusId(d.job_status_id);
            setModelId(d.product_brand_model_id ?? null);
            setSerialNo(d.serial_no ?? "");
            setQuantity(d.quantity);
            setProblemReported(d.problem_reported);
            setWarrantyCardNo(d.warranty_card_no ?? "");
            setRemarks(d.remarks ?? "");
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editJob, dbName, schema]);

    const handleReset = () => {
        setPendingAttachments([]);
        setStagedKey((k) => k + 1);
        setCustomerId(null);
        setCustomerName("");
        setAddressSnapshot("");
        setJobDate(today());
        const initial = jobStatuses.find(s => s.is_initial);
        setJobStatusId(initial?.id ?? null);
        setJobTypeId(null);
        setReceiveMannerId(null);
        setReceiveConditionId(null);
        setModelId(null);
        setSerialNo("");
        setQuantity(1);
        setProblemReported("");
        setWarrantyCardNo("");
        setRemarks("");
    };

    const isFormValid = useMemo(() => {
        if (!customerId) return false;
        if (!jobTypeId) return false;
        if (!receiveMannerId) return false;
        if (pendingAttachments.some((f) => !f.about.trim())) return false;
        if (quantity < 1) return false;
        return true;
    }, [customerId, jobTypeId, receiveMannerId, pendingAttachments]);

    const executeSave = async () => {
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_JOB_CREATE_FAILED);
            return;
        }
        setSubmitting(true);
        try {
            if (editJob) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "job",
                    xData: {
                        id:                       editJob.id,
                        customer_contact_id:      customerId,
                        job_date:                 jobDate,
                        job_type_id:              jobTypeId,
                        job_receive_manner_id:    receiveMannerId,
                        job_receive_condition_id: receiveConditionId ?? null,
                        job_status_id:            jobStatusId,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        quantity:                 quantity,
                        problem_reported:         problemReported.trim(),
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
                        address_snapshot:         addressSnapshot.trim() || null,
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_JOB_UPDATED);
            } else {
                const jobNo = docSequence ? buildJobNo(docSequence) : "";
                const sqlObject = {
                    tableName:         "job",
                    doc_sequence_id:   docSequence?.id ?? null,
                    doc_sequence_next: docSequence ? (docSequence.next_number + 1) : null,
                    xData: {
                        branch_id:                branchId,
                        job_no:                   jobNo,
                        job_date:                 jobDate,
                        customer_contact_id:      customerId,
                        job_type_id:              jobTypeId,
                        job_receive_manner_id:    receiveMannerId,
                        job_receive_condition_id: receiveConditionId ?? null,
                        job_status_id:            jobStatusId,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        quantity:                 quantity,
                        problem_reported:         problemReported.trim(),
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
                        performed_by_user_id:     currentUser?.id ?? null,
                        address_snapshot:         addressSnapshot.trim() || null,
                    },
                };
                const encoded = encodeURIComponent(JSON.stringify(sqlObject));
                const result = await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.createSingleJob,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                const newJobId = (result.data as { createSingleJob?: number })?.createSingleJob;
                if (newJobId && pendingAttachments.length > 0) {
                    for (const { file, about } of pendingAttachments) {
                        try {
                            await uploadJobFile(dbName, schema, newJobId, about, file);
                        } catch (err: unknown) {
                            toast.error(`Upload failed for "${about}": ${(err as Error).message}`);
                        }
                    }
                }
                toast.success(MESSAGES.SUCCESS_JOB_CREATED);
            }
            onSuccess();
        } catch {
            toast.error(editJob ? MESSAGES.ERROR_JOB_UPDATE_FAILED : MESSAGES.ERROR_JOB_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!customerId) { toast.error(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED); return; }
        if (!jobTypeId) { toast.error(MESSAGES.ERROR_JOB_TYPE_REQUIRED); return; }
        if (!receiveMannerId) { toast.error(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED); return; }
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

    // const initialStatus = jobStatuses.find(s => s.is_initial);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3 overflow-y-auto"
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--cl-surface-2)]/30 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                    <div className="bg-[var(--cl-accent)]/5 p-5 rounded-full mb-4">
                        <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                    <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                        Please select a branch from the global header to create a new job.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                        Job Details
                    </p>
                    <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                        <CardContent className="pt-2 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible">

                            {/* Row 1: Job No, Date, Customer, Manner */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Job No</Label>
                                <Input
                                    readOnly
                                    className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80"
                                    value={docSequence ? buildJobNo(docSequence) : (editJob?.job_no ?? "—")}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Job Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    value={jobDate}
                                    onChange={e => setJobDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Customer <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <CustomerInput
                                    customerId={customerId}
                                    customerName={customerName}
                                    customerTypes={customerTypes}
                                    states={masterStates}
                                    onChange={name => {
                                        setCustomerName(name);
                                        if (!name.trim()) setCustomerId(null);
                                    }}
                                    onClear={() => { 
                                        setCustomerId(null); 
                                        setCustomerName(""); 
                                        setAddressSnapshot("");
                                    }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.full_name ?? c.mobile);
                                        // Format address snapshot
                                        const parts = [
                                            c.address_line1,
                                            c.address_line2,
                                            c.city,
                                            c.state_name,
                                            c.postal_code
                                        ].filter(Boolean);
                                        setAddressSnapshot(parts.join(", "));
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Receive Manner <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <select
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!receiveMannerId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={receiveMannerId ?? ""}
                                    onChange={e => setReceiveMannerId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">Select…</option>
                                    {receiveMannners.filter(r => r.is_active).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 2: Job Type, Receive Condition, Product / Model, Qty */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Job Type <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <select
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!jobTypeId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={jobTypeId ?? ""}
                                    onChange={e => {
                                        const newId = e.target.value ? Number(e.target.value) : null;
                                        const newCode = jobTypes.find(t => t.id === newId)?.code;
                                        if (newCode !== "UNDER_WARRANTY") setWarrantyCardNo("");
                                        setJobTypeId(newId);
                                    }}
                                >
                                    <option value="">Select…</option>
                                    {jobTypes.filter(j => j.is_active).map(j => (
                                        <option key={j.id} value={j.id}>{j.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Receive Condition</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                    value={receiveConditionId ?? ""}
                                    onChange={e => setReceiveConditionId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">None</option>
                                    {receiveConditions.filter(r => r.is_active).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <SearchableCombobox<ModelRow>
                                            label="Product / Model"
                                            placeholder="Search by brand, product or model…"
                                            items={models.filter(m => m.is_active)}
                                            selectedValue={modelId?.toString() ?? ""}
                                            getDisplayValue={m => `${m.brand_name} — ${m.product_name} — ${m.model_name}`}
                                            getFilterKey={m => `${m.brand_name} ${m.product_name} ${m.model_name}`}
                                            getIdentifier={m => m.id.toString()}
                                            onSelect={m => setModelId(m ? m.id : null)}
                                            renderItem={m => (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold">{m.brand_name}</span>
                                                    <span className="text-xs opacity-70">{m.product_name} — {m.model_name}</span>
                                                </div>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        size="icon"
                                        className="h-9 w-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shrink-0"
                                        title="Add Missing Model"
                                        onClick={() => setShowAddModel(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Qty <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${quantity < 1 ? "border-red-400" : ""}`}
                                    type="number"
                                    min={1}
                                    value={quantity}
                                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                />
                            </div>

                            {/* Row 3: Serial No, Warranty Card No */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Serial No</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                    value={serialNo}
                                    onChange={e => setSerialNo(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Warranty Card No</Label>
                                <Input
                                    disabled={!isWarranty}
                                    className={`bg-[var(--cl-surface-2)] ${!isWarranty ? "opacity-50 cursor-not-allowed" : ""}`}
                                    placeholder={isWarranty ? "Card number…" : "N/A"}
                                    value={warrantyCardNo}
                                    onChange={e => setWarrantyCardNo(e.target.value)}
                                />
                            </div>

                            {/* Problem Reported */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                <Label className={labelCls}>Problem Reported</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none border-[var(--cl-border)]"
                                    placeholder="Describe the problem reported by the customer (optional)…"
                                    value={problemReported}
                                    onChange={e => setProblemReported(e.target.value)}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                <Label className={labelCls}>Remarks</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none"
                                    placeholder="Optional…"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>

                            {/* Attachments */}
                            <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                <Label className={labelCls}>Attachments</Label>
                                {editJob
                                    ? <JobImageUpload jobId={editJob.id} />
                                    : <JobImageUpload key={stagedKey} onPendingChange={setPendingAttachments} />
                                }
                            </div>

                        </CardContent>
                    </Card>

                    {submitting && (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--cl-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                        </div>
                    )}
                </>
            )}

            <AddModelDialog
                brands={brands}
                products={products}
                open={showAddModel}
                onOpenChange={setShowAddModel}
                onSuccess={onRefreshModels}
            />
        </motion.div>
    );
});

NewSingleJobForm.displayName = "NewSingleJobForm";
