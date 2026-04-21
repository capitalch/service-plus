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
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

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
    customerTypes:   CustomerTypeOption[];
    masterStates:    StateOption[];
    editJob?:        JobDetailType | null;
    onSuccess:       () => void;
    onStatusChange:  (status: { isValid: boolean; isSubmitting: boolean }) => void;
};

export type NewJobFormHandle = {
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

export const NewJobForm = forwardRef<NewJobFormHandle, Props>(({
    branchId, docSequence, jobStatuses, jobTypes, receiveMannners, receiveConditions,
    technicians, models, customerTypes, masterStates, editJob, onSuccess, onStatusChange,
}, ref) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);

    // Header state
    const [customerId,          setCustomerId]         = useState<number | null>(null);
    const [customerName,        setCustomerName]       = useState("");
    const [jobDate,             setJobDate]            = useState(today());
    const [jobTypeId,           setJobTypeId]          = useState<number | null>(null);
    const [receiveMannerId,     setReceiveMannerId]    = useState<number | null>(null);
    const [receiveConditionId,  setReceiveConditionId] = useState<number | null>(null);
    const [jobStatusId,         setJobStatusId]        = useState<number | null>(null);
    const [technicianId,        setTechnicianId]       = useState<number | null>(null);
    const [modelId,             setModelId]            = useState<number | null>(null);
    const [serialNo,            setSerialNo]           = useState("");
    const [problemReported,     setProblemReported]    = useState("");
    const [deliveryDate,        setDeliveryDate]       = useState("");
    const [isWarranty,          setIsWarranty]         = useState(false);
    const [warrantyCardNo,      setWarrantyCardNo]     = useState("");
    const [remarks,             setRemarks]            = useState("");

    const [submitting, setSubmitting] = useState(false);

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
            setJobDate(d.job_date);
            setJobTypeId(d.job_type_id);
            setReceiveMannerId(d.job_receive_manner_id);
            setReceiveConditionId(d.job_receive_condition_id ?? null);
            setJobStatusId(d.job_status_id);
            setTechnicianId(d.technician_id ?? null);
            setModelId(d.product_brand_model_id ?? null);
            setSerialNo(d.serial_no ?? "");
            setProblemReported(d.problem_reported);
            setDeliveryDate(d.delivery_date ?? "");
            setIsWarranty(d.is_warranty);
            setWarrantyCardNo(d.warranty_card_no ?? "");
            setRemarks(d.remarks ?? "");
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editJob, dbName, schema]);

    const handleReset = () => {
        setCustomerId(null);
        setCustomerName("");
        setJobDate(today());
        const initial = jobStatuses.find(s => s.is_initial);
        setJobStatusId(initial?.id ?? null);
        setJobTypeId(null);
        setReceiveMannerId(null);
        setReceiveConditionId(null);
        setTechnicianId(null);
        setModelId(null);
        setSerialNo("");
        setProblemReported("");
        setDeliveryDate("");
        setIsWarranty(false);
        setWarrantyCardNo("");
        setRemarks("");
    };

    const isFormValid = useMemo(() => {
        if (!customerId) return false;
        if (!jobTypeId) return false;
        if (!receiveMannerId) return false;
        if (!problemReported.trim()) return false;
        return true;
    }, [customerId, jobTypeId, receiveMannerId, problemReported]);

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
                        technician_id:            technicianId ?? null,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        problem_reported:         problemReported.trim(),
                        delivery_date:            deliveryDate || null,
                        is_warranty:              isWarranty,
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
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
                        technician_id:            technicianId ?? null,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        problem_reported:         problemReported.trim(),
                        delivery_date:            deliveryDate || null,
                        is_warranty:              isWarranty,
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
                        performed_by_user_id:     currentUser?.id ?? null,
                    },
                };
                const encoded = encodeURIComponent(JSON.stringify(sqlObject));
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.createJob,
                    variables: { db_name: dbName, schema, value: encoded },
                });
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
        if (!problemReported.trim()) { toast.error(MESSAGES.ERROR_JOB_PROBLEM_REQUIRED); return; }
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

    const initialStatus = jobStatuses.find(s => s.is_initial);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3 pb-2 overflow-y-auto"
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
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1">
                        Job Details
                    </p>
                    <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible">

                            {/* Customer */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-4">
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
                                    onClear={() => { setCustomerId(null); setCustomerName(""); }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.full_name ?? c.mobile);
                                    }}
                                />
                            </div>

                            {/* Job Date */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                                <Label className={labelCls}>Job Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    value={jobDate}
                                    onChange={e => setJobDate(e.target.value)}
                                />
                            </div>

                            {/* Job No (read-only) */}
                            <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                                <Label className={labelCls}>Job No</Label>
                                <Input
                                    readOnly
                                    className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80"
                                    value={docSequence ? buildJobNo(docSequence) : (editJob?.job_no ?? "—")}
                                />
                            </div>

                            {/* Job Type */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                                <Label className={labelCls}>
                                    Job Type <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <select
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!jobTypeId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={jobTypeId ?? ""}
                                    onChange={e => setJobTypeId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">Select…</option>
                                    {jobTypes.filter(j => j.is_active).map(j => (
                                        <option key={j.id} value={j.id}>{j.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Receive Manner */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
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

                            {/* Receive Condition */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
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

                            {/* Status (read-only for new, editable for edit) */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                                <Label className={labelCls}>Status</Label>
                                {editJob ? (
                                    <select
                                        className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                        value={jobStatusId ?? ""}
                                        onChange={e => setJobStatusId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">Select…</option>
                                        {jobStatuses.filter(s => s.is_active).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="flex h-9 items-center rounded-md border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/60 px-2 text-sm font-semibold text-[var(--cl-accent)] cursor-not-allowed">
                                        {initialStatus?.name ?? "—"}
                                    </div>
                                )}
                            </div>

                            {/* Technician */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                                <Label className={labelCls}>Technician</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                    value={technicianId ?? ""}
                                    onChange={e => setTechnicianId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">None</option>
                                    {technicians.filter(t => t.is_active).map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Product / Model */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                                <Label className={labelCls}>Product / Model</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                    value={modelId ?? ""}
                                    onChange={e => setModelId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">None</option>
                                    {models.filter(m => m.is_active).map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.brand_name} — {m.product_name} — {m.model_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Serial No */}
                            <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                                <Label className={labelCls}>Serial No</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                    value={serialNo}
                                    onChange={e => setSerialNo(e.target.value)}
                                />
                            </div>

                            {/* Delivery Date */}
                            <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                                <Label className={labelCls}>Delivery Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                />
                            </div>

                            {/* Warranty */}
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                                <Label className={labelCls}>Warranty</Label>
                                <div className="flex items-center gap-2 h-9">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-[var(--cl-accent)] cursor-pointer"
                                            checked={isWarranty}
                                            onChange={e => { setIsWarranty(e.target.checked); if (!e.target.checked) setWarrantyCardNo(""); }}
                                        />
                                        <span className="text-sm text-[var(--cl-text)]">Under Warranty</span>
                                    </label>
                                </div>
                            </div>

                            {/* Warranty Card No */}
                            {isWarranty && (
                                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                                    <Label className={labelCls}>Warranty Card No</Label>
                                    <Input
                                        className="bg-[var(--cl-surface-2)]"
                                        placeholder="Card number…"
                                        value={warrantyCardNo}
                                        onChange={e => setWarrantyCardNo(e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Problem Reported */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-12">
                                <Label className={labelCls}>
                                    Problem Reported <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Textarea
                                    rows={3}
                                    className={`bg-[var(--cl-surface-2)] resize-none ${!problemReported.trim() ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    placeholder="Describe the problem reported by the customer…"
                                    value={problemReported}
                                    onChange={e => setProblemReported(e.target.value)}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-12">
                                <Label className={labelCls}>Remarks</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none"
                                    placeholder="Optional…"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
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
        </motion.div>
    );
});

NewJobForm.displayName = "NewJobForm";
