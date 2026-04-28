import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { SingleJobFormValues } from "./single-job-schema";
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
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { CustomerSearchRow } from "@/features/client/types/sales";
import type { JobDetailType, JobListRow, JobLookupRow, ModelRow, TechnicianRow } from "@/features/client/types/job";
import { CustomerInput } from "@/features/client/components/inventory/customer-input";

import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AddModelDialog } from "@/features/client/components/masters/model/add-model-dialog";
import { Button } from "@/components/ui/button";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import { SingleJobQuickInfoCard } from "./single-job-quick-info-card";
import { Eye, Printer, Paperclip, FileText } from "lucide-react";

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
    editJob?:          JobDetailType | null;
    onRefreshModels:   () => void;
    onViewJob?:        (job: JobListRow) => void;
    onPrintPdf?:       (job: JobListRow) => void;
    onAttachFiles?:    (jobNo: string, jobId: number) => void;
};

const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewSingleJobForm({
    branchId, jobStatuses, jobTypes, receiveMannners, receiveConditions, models, brands, products, customerTypes, masterStates, editJob,
    onRefreshModels, onViewJob, onPrintPdf, onAttachFiles,
}: Props) {
    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const [showAddModel,       setShowAddModel]       = useState(false);
    const form = useFormContext<SingleJobFormValues>();
    const { formState: { errors, isSubmitting }, setValue, watch } = form;
    const jobTypeId  = watch("job_type_id");
    const isWarranty = jobTypes.find(t => t.id === jobTypeId)?.code === "UNDER_WARRANTY";

    // Set initial job status on first load
    useEffect(() => {
        if (jobStatuses.length > 0 && !editJob) {
            const initial = jobStatuses.find(s => s.is_initial);
            if (initial) setValue("job_status_id", initial.id, { shouldValidate: false });
        }
    }, [jobStatuses, editJob]); // eslint-disable-line react-hooks/exhaustive-deps

    // Populate form when editing
    useEffect(() => {
        if (!editJob) {
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
                    sqlId:    SQL_MAP.GET_JOB_DETAIL,
                    sqlArgs:  { id: editJob.id },
                }),
            },
        }).then(res => {
            const d = res.data?.genericQuery?.[0];
            if (!d) return;
            form.reset({
                customer_id:          d.customer_contact_id ?? (undefined as unknown as number),
                customer_name:        d.customer_name ?? d.mobile ?? "",
                address_snapshot:     d.address_snapshot ?? "",
                job_date:             d.job_date,
                job_type_id:          d.job_type_id ?? (undefined as unknown as number),
                receive_manner_id:    d.job_receive_manner_id ?? (undefined as unknown as number),
                receive_condition_id: d.job_receive_condition_id ?? null,
                job_status_id:        d.job_status_id ?? null,
                model_id:             d.product_brand_model_id ?? null,
                serial_no:            d.serial_no ?? "",
                quantity:             d.quantity,
                problem_reported:     d.problem_reported,
                warranty_card_no:     d.warranty_card_no ?? "",
                remarks:              d.remarks ?? "",
            });
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editJob, dbName, schema]);

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
                    <div className="flex items-start gap-3 flex-col md:flex-row">
                        <div className="flex items-start gap-3 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] pt-2">
                                Job Details
                            </p>

                            {/* Quick Info Card - Last Job (right of label) */}
                            <SingleJobQuickInfoCard
                                onView={onViewJob}
                                onPrint={onPrintPdf}
                                onAttach={onAttachFiles}
                            />
                        </div>

                        <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible flex-1">
                            <CardContent className="pt-2 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-3 gap-y-3 !overflow-visible">

                            {/* Row 1: Job No, Date, Customer, Manner */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Job No</Label>
                                <Input
                                    readOnly
                                    className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80"
                                    value={editJob?.job_no ?? "AUTO"}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Job Date</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    type="date"
                                    {...form.register("job_date")}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Customer <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <CustomerInput
                                    customerId={watch("customer_id") ?? null}
                                    customerName={watch("customer_name") ?? ""}
                                    customerTypes={customerTypes}
                                    states={masterStates}
                                    onChange={name => {
                                        setValue("customer_name", name, { shouldValidate: false });
                                        if (!name.trim()) setValue("customer_id", undefined as unknown as number, { shouldValidate: true });
                                    }}
                                    onClear={() => {
                                        setValue("customer_id",      undefined as unknown as number, { shouldValidate: true });
                                        setValue("customer_name",    "", { shouldValidate: false });
                                        setValue("address_snapshot", "", { shouldValidate: false });
                                    }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setValue("customer_id",   c.id,                          { shouldValidate: true });
                                        setValue("customer_name", c.full_name ?? c.mobile,        { shouldValidate: false });
                                        const parts = [c.address_line1, c.address_line2, c.city, c.state_name, c.postal_code].filter(Boolean);
                                        setValue("address_snapshot", parts.join(", "),            { shouldValidate: false });
                                    }}
                                />
                                {errors.customer_id && <p className="mt-1 text-xs text-red-500">{errors.customer_id.message}</p>}
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>
                                    Receive Manner <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <select
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch("receive_manner_id") ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={watch("receive_manner_id") ?? ""}
                                    onChange={e => setValue("receive_manner_id", e.target.value ? Number(e.target.value) : (undefined as unknown as number), { shouldValidate: true })}
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
                                    className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch("job_type_id") ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                    value={watch("job_type_id") ?? ""}
                                    onChange={e => {
                                        const newId   = e.target.value ? Number(e.target.value) : (undefined as unknown as number);
                                        const newCode = jobTypes.find(t => t.id === newId)?.code;
                                        if (newCode !== "UNDER_WARRANTY") setValue("warranty_card_no", "", { shouldValidate: false });
                                        setValue("job_type_id", newId, { shouldValidate: true });
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
                                    value={watch("receive_condition_id") ?? ""}
                                    onChange={e => setValue("receive_condition_id", e.target.value ? Number(e.target.value) : undefined, { shouldValidate: false })}
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
                                            selectedValue={watch("model_id")?.toString() ?? ""}
                                            getDisplayValue={m => `${m.brand_name} — ${m.product_name} — ${m.model_name}`}
                                            getFilterKey={m => `${m.brand_name} ${m.product_name} ${m.model_name}`}
                                            getIdentifier={m => m.id.toString()}
                                            onSelect={m => setValue("model_id", m ? m.id : null, { shouldValidate: false })}
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
                                    className={`bg-[var(--cl-surface-2)] ${errors.quantity ? "border-red-400" : ""}`}
                                    type="number"
                                    min={1}
                                    {...form.register("quantity", { valueAsNumber: true })}
                                />
                            </div>

                            {/* Row 3: Serial No, Warranty Card No */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Serial No</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                    {...form.register("serial_no")}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-3">
                                <Label className={labelCls}>Warranty Card No</Label>
                                <Input
                                    disabled={!isWarranty}
                                    className={`bg-[var(--cl-surface-2)] ${!isWarranty ? "opacity-50 cursor-not-allowed" : ""}`}
                                    placeholder={isWarranty ? "Card number…" : "N/A"}
                                    {...form.register("warranty_card_no")}
                                />
                            </div>

                            {/* Problem Reported */}
                            <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                <Label className={labelCls}>Problem Reported</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none border-[var(--cl-border)]"
                                    placeholder="Describe the problem reported by the customer (optional)…"
                                    {...form.register("problem_reported")}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                <Label className={labelCls}>Remarks</Label>
                                <Textarea
                                    rows={3}
                                    className="bg-[var(--cl-surface-2)] resize-none"
                                    placeholder="Optional…"
                                    {...form.register("remarks")}
                                />
                            </div>


</CardContent>
                        </Card>
                    </div>

                    {isSubmitting && (
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
}
