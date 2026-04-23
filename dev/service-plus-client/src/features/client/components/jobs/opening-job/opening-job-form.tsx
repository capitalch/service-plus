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
import type { CustomerSearchRow } from "@/features/client/types/sales";
import type { JobDetailType, JobLookupRow, ModelRow, TechnicianRow } from "@/features/client/types/job";
import { CustomerInput } from "@/features/client/components/inventory/customer-input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AddModelDialog } from "@/features/client/components/masters/model/add-model-dialog";
import { Button } from "@/components/ui/button";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:          number | null;
    jobStatuses:       JobLookupRow[];
    jobTypes:          JobLookupRow[];
    receiveMannners:   JobLookupRow[];
    receiveConditions: JobLookupRow[];
    technicians:       TechnicianRow[];
    models:            ModelRow[];
    brands:            BrandOption[];
    products:          ProductOption[];
    customerTypes:     CustomerTypeOption[];
    masterStates:      StateOption[];
    editJob:           JobDetailType | null;
    onRefreshModels:   () => void;
    onSuccess:         () => void;
    onStatusChange:    (status: { isValid: boolean; isSubmitting: boolean }) => void;
};

export type OpeningJobFormHandle = {
    submit:       () => void;
    reset:        () => void;
    isSubmitting: boolean;
    isValid:      boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function normalizeJobNo(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (trimmed.toLowerCase().startsWith("z-")) return `Z-${trimmed.slice(2)}`;
    return `Z-${trimmed}`;
}

const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";

// ─── Component ────────────────────────────────────────────────────────────────

export const OpeningJobForm = forwardRef<OpeningJobFormHandle, Props>(({
    branchId, jobStatuses, jobTypes, receiveMannners, receiveConditions, technicians, models, brands, products,
    customerTypes, masterStates, editJob, onRefreshModels, onSuccess, onStatusChange,
}, ref) => {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const currentUser = useAppSelector(selectCurrentUser);

    // Job Details
    const [jobNo,               setJobNo]               = useState(editJob?.job_no ?? "");
    const [customerId,          setCustomerId]          = useState<number | null>(editJob?.customer_contact_id ?? null);
    const [customerName,        setCustomerName]        = useState(editJob?.customer_name ?? "");
    const [mobile,              setMobile]              = useState(editJob?.mobile ?? "");
    const [jobDate,             setJobDate]             = useState(today());
    const [jobTypeId,           setJobTypeId]           = useState<number | null>(editJob?.job_type_id ?? null);
    const [receiveMannerId,     setReceiveMannerId]     = useState<number | null>(editJob?.job_receive_manner_id ?? null);
    const [receiveConditionId,  setReceiveConditionId]  = useState<number | null>(editJob?.job_receive_condition_id ?? null);
    const [modelId,             setModelId]             = useState<number | null>(editJob?.product_brand_model_id ?? null);
    const [serialNo,            setSerialNo]            = useState(editJob?.serial_no ?? "");
    const [problemReported,     setProblemReported]     = useState(editJob?.problem_reported ?? "");
    const [warrantyCardNo,      setWarrantyCardNo]      = useState(editJob?.warranty_card_no ?? "");
    const [quantity,            setQuantity]            = useState(editJob?.quantity ?? 1);

    // Progress / Completion
    const [jobStatusId,         setJobStatusId]         = useState<number | null>(editJob?.job_status_id ?? null);
    const [technicianId,        setTechnicianId]        = useState<number | null>(editJob?.technician_id ?? null);
    const [diagnosis,           setDiagnosis]           = useState(editJob?.diagnosis ?? "");
    const [workDone,            setWorkDone]            = useState(editJob?.work_done ?? "");
    const [amount,              setAmount]              = useState<string>(editJob?.amount != null ? String(editJob.amount) : "");
    const [deliveryDate,        setDeliveryDate]        = useState(editJob?.delivery_date ?? "");
    const [isClosed,            setIsClosed]            = useState(editJob?.is_closed ?? false);
    const [isFinal,             setIsFinal]             = useState((editJob as JobDetailType & { is_final?: boolean })?.is_final ?? false);
    const [remarks,             setRemarks]             = useState(editJob?.remarks ?? "");

    const [submitting,     setSubmitting]     = useState(false);
    const [showAddModel,   setShowAddModel]   = useState(false);

    const isWarranty = jobTypes.find(t => t.id === jobTypeId)?.code === "UNDER_WARRANTY";

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
            const d = res.data?.genericQuery?.[0] as (JobDetailType & { is_final?: boolean }) | undefined;
            if (!d) return;
            setJobNo(d.job_no);
            setCustomerId(d.customer_contact_id);
            setCustomerName(d.customer_name ?? d.mobile ?? "");
            setMobile(d.mobile ?? "");
            setJobDate(d.job_date);
            setJobTypeId(d.job_type_id);
            setReceiveMannerId(d.job_receive_manner_id);
            setReceiveConditionId(d.job_receive_condition_id ?? null);
            setModelId(d.product_brand_model_id ?? null);
            setSerialNo(d.serial_no ?? "");
            setQuantity(d.quantity);
            setProblemReported(d.problem_reported);
            setWarrantyCardNo(d.warranty_card_no ?? "");
            setJobStatusId(d.job_status_id);
            setTechnicianId(d.technician_id ?? null);
            setDiagnosis(d.diagnosis ?? "");
            setWorkDone(d.work_done ?? "");
            setAmount(d.amount != null ? String(d.amount) : "");
            setDeliveryDate(d.delivery_date ?? "");
            setIsClosed(d.is_closed);
            setIsFinal(d.is_final ?? false);
            setRemarks(d.remarks ?? "");
        }).catch(() => toast.error(MESSAGES.ERROR_OPENING_JOB_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editJob, dbName, schema]);

    const handleReset = () => {
        setJobNo("");
        setCustomerId(null);
        setCustomerName("");
        setMobile("");
        setJobDate(today());
        setJobTypeId(null);
        setReceiveMannerId(null);
        setReceiveConditionId(null);
        setModelId(null);
        setSerialNo("");
        setQuantity(1);
        setProblemReported("");
        setWarrantyCardNo("");
        setJobStatusId(null);
        setTechnicianId(null);
        setDiagnosis("");
        setWorkDone("");
        setAmount("");
        setDeliveryDate("");
        setIsClosed(false);
        setIsFinal(false);
        setRemarks("");
    };

    const isFormValid = useMemo(() => {
        if (!jobNo.trim()) return false;
        if (!customerId) return false;
        if (!jobTypeId) return false;
        if (!receiveMannerId) return false;
        if (!problemReported.trim()) return false;
        if (!jobStatusId) return false;
        return true;
    }, [jobNo, customerId, jobTypeId, receiveMannerId, problemReported, jobStatusId]);

    const executeSave = async () => {
        if (!branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_OPENING_JOB_CREATE_FAILED);
            return;
        }
        setSubmitting(true);
        const normalizedJobNo = normalizeJobNo(jobNo);
        try {
            if (editJob) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "job",
                    xData: {
                        id:                       editJob.id,
                        job_no:                   normalizedJobNo,
                        job_date:                 jobDate,
                        customer_contact_id:      customerId,
                        job_type_id:              jobTypeId,
                        job_receive_manner_id:    receiveMannerId,
                        job_receive_condition_id: receiveConditionId ?? null,
                        job_status_id:            jobStatusId,
                        technician_id:            technicianId ?? null,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        quantity:                 quantity,
                        problem_reported:         problemReported.trim(),
                        diagnosis:                diagnosis.trim() || null,
                        work_done:                workDone.trim() || null,
                        amount:                   amount !== "" ? Number(amount) : null,
                        delivery_date:            deliveryDate || null,
                        is_closed:                isClosed,
                        is_final:                 isFinal,
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_JOB_UPDATED);
            } else {
                const sqlObject = {
                    tableName:         "job",
                    doc_sequence_id:   null,
                    doc_sequence_next: null,
                    xData: {
                        branch_id:                branchId,
                        job_no:                   normalizedJobNo,
                        job_date:                 jobDate,
                        customer_contact_id:      customerId,
                        job_type_id:              jobTypeId,
                        job_receive_manner_id:    receiveMannerId,
                        job_receive_condition_id: receiveConditionId ?? null,
                        job_status_id:            jobStatusId,
                        technician_id:            technicianId ?? null,
                        product_brand_model_id:   modelId ?? null,
                        serial_no:                serialNo.trim() || null,
                        quantity:                 quantity,
                        problem_reported:         problemReported.trim(),
                        diagnosis:                diagnosis.trim() || null,
                        work_done:                workDone.trim() || null,
                        amount:                   amount !== "" ? Number(amount) : null,
                        delivery_date:            deliveryDate || null,
                        is_closed:                isClosed,
                        is_final:                 isFinal,
                        is_warranty:              isWarranty,
                        warranty_card_no:         warrantyCardNo.trim() || null,
                        remarks:                  remarks.trim() || null,
                        performed_by_user_id:     currentUser?.id ?? null,
                    },
                };
                const encoded = encodeURIComponent(JSON.stringify(sqlObject));
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.createSingleJob,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                toast.success(MESSAGES.SUCCESS_OPENING_JOB_CREATED);
            }
            onSuccess();
        } catch {
            toast.error(editJob ? MESSAGES.ERROR_OPENING_JOB_CREATE_FAILED : MESSAGES.ERROR_OPENING_JOB_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!jobNo.trim()) { toast.error(MESSAGES.ERROR_OPENING_JOB_NO_REQUIRED); return; }
        if (!customerId)   { toast.error(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED); return; }
        if (!jobTypeId)    { toast.error(MESSAGES.ERROR_JOB_TYPE_REQUIRED); return; }
        if (!receiveMannerId) { toast.error(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED); return; }
        if (!problemReported.trim()) { toast.error(MESSAGES.ERROR_JOB_PROBLEM_REQUIRED); return; }
        if (!jobStatusId)  { toast.error("Please select a job status."); return; }
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

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 overflow-y-auto"
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
                        Please select a branch from the global header to create an opening job.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Job Details ─────────────────────────────────────────── */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                        Job Details
                    </p>
                    <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                        <CardContent className="pt-2 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible">

                            {/* Job No */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>
                                    Job No <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] font-mono ${!jobNo.trim() ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    placeholder="e.g. 001 or Z-001"
                                    value={jobNo}
                                    onChange={e => setJobNo(e.target.value)}
                                />
                            </div>

                            {/* Job Date */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Job Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    value={jobDate}
                                    onChange={e => setJobDate(e.target.value)}
                                />
                            </div>

                            {/* Customer */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
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
                                        if (!name.trim()) { setCustomerId(null); setMobile(""); }
                                    }}
                                    onClear={() => { setCustomerId(null); setCustomerName(""); setMobile(""); }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.full_name ?? c.mobile);
                                        setMobile(c.mobile ?? "");
                                    }}
                                />
                            </div>

                            {/* Mobile (read-only) */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Mobile</Label>
                                <Input
                                    readOnly
                                    className="bg-[var(--cl-surface-2)] font-mono opacity-70 cursor-not-allowed"
                                    placeholder="—"
                                    value={mobile}
                                />
                            </div>

                            {/* Job Type */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
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

                            {/* Receive Manner */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
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
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
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

                            {/* Product / Model */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
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
                                        className="h-9 w-9 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shrink-0"
                                        size="icon"
                                        title="Add Missing Model"
                                        type="button"
                                        onClick={() => setShowAddModel(true)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Serial No */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Serial No</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                    value={serialNo}
                                    onChange={e => setSerialNo(e.target.value)}
                                />
                            </div>

                            {/* Warranty toggle */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
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

                            {/* Qty */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Qty</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    min={1}
                                    type="number"
                                    value={quantity}
                                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                                />
                            </div>

                        </CardContent>
                    </Card>

                    {/* ── Status / Progress ───────────────────────────────────── */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                        Status / Progress
                    </p>
                    <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                        <CardContent className="pt-2 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible">

                            {/* Job Status */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>
                                    Job Status <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <select
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!jobStatusId ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={jobStatusId ?? ""}
                                    onChange={e => setJobStatusId(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">Select…</option>
                                    {jobStatuses.filter(s => s.is_active).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Technician */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
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

                            {/* Amount */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Amount</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    min={0}
                                    placeholder="Optional…"
                                    step="0.01"
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                />
                            </div>

                            {/* Delivery Date */}
                            <div className="space-y-1.5 md:col-span-3 lg:col-span-3">
                                <Label className={labelCls}>Delivery Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                />
                            </div>

                            {/* Diagnosis */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                <Label className={labelCls}>Diagnosis</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none border-[var(--cl-border)]"
                                    placeholder="Optional…"
                                    value={diagnosis}
                                    onChange={e => setDiagnosis(e.target.value)}
                                />
                            </div>

                            {/* Work Done */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                <Label className={labelCls}>Work Done</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none border-[var(--cl-border)]"
                                    placeholder="Optional…"
                                    value={workDone}
                                    onChange={e => setWorkDone(e.target.value)}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                <Label className={labelCls}>Remarks</Label>
                                <Textarea
                                    rows={2}
                                    className="bg-[var(--cl-surface-2)] resize-none border-[var(--cl-border)]"
                                    placeholder="Optional…"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>

                            {/* Toggles: Is Closed / Is Final */}
                            <div className="flex flex-wrap items-center gap-6 md:col-span-12 lg:col-span-12">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        checked={isClosed}
                                        className="h-4 w-4 accent-[var(--cl-accent)]"
                                        type="checkbox"
                                        onChange={e => setIsClosed(e.target.checked)}
                                    />
                                    <span className={labelCls}>Is Closed</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        checked={isFinal}
                                        className="h-4 w-4 accent-[var(--cl-accent)]"
                                        type="checkbox"
                                        onChange={e => setIsFinal(e.target.checked)}
                                    />
                                    <span className={labelCls}>Is Final</span>
                                </label>
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
                open={showAddModel}
                products={products}
                onOpenChange={setShowAddModel}
                onSuccess={onRefreshModels}
            />
        </motion.div>
    );
});

OpeningJobForm.displayName = "OpeningJobForm";
