import { useEffect, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

import type { CustomerSearchRow, DocumentSequenceRow } from "@/features/client/types/sales";
import type { JobBatchDetailRow, JobLookupRow, ModelRow } from "@/features/client/types/job";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

import { type BatchJobFormValues, getInitialBatchJobRow } from "./batch-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    branchId:          number | null;
    docSequence:       DocumentSequenceRow | null;
    jobTypes:          JobLookupRow[];
    receiveMannners:   JobLookupRow[];
    receiveConditions: JobLookupRow[];
    models:            ModelRow[];
    brands:            BrandOption[];
    products:          ProductOption[];
    customerTypes:     CustomerTypeOption[];
    masterStates:      StateOption[];
    editBatchNo?:      number | null;
    editRows?:         JobBatchDetailRow[];
    onRefreshModels:   () => void;
    form:              ReturnType<typeof useFormContext<BatchJobFormValues>>;
    setPendingFiles:   React.Dispatch<React.SetStateAction<Record<string, StagedFile[]>>>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────



const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewBatchJobForm({
    branchId, docSequence, jobTypes, receiveMannners, receiveConditions,
    models, brands, products, customerTypes, masterStates,
    editBatchNo, editRows,
    onRefreshModels, form, setPendingFiles,
}: Props) {

    const [showAddModel, setShowAddModel] = useState(false);

    const { control, formState: { isSubmitting }, setValue, watch, register } = useFormContext<BatchJobFormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: "rows",
    });

    const jobTypeId  = watch("job_type_id");
    const isWarranty = jobTypes.find(t => t.id === jobTypeId)?.code === "UNDER_WARRANTY";

    useEffect(() => {
        if (editBatchNo && editRows && editRows.length > 0) {
            const first = editRows[0];
            form.reset({
                batch_date:        first.job_date,
                customer_id:       first.customer_contact_id,
                customer_name:     first.customer_name ?? first.mobile,
                job_type_id:       first.job_type_id,
                receive_manner_id: first.job_receive_manner_id,
                rows: editRows.map(r => ({
                    id:                       r.id,
                    localId:                  crypto.randomUUID(),
                    job_no:                   r.job_no,
                    product_brand_model_id:   r.product_brand_model_id ?? null,
                    serial_no:                r.serial_no ?? "",
                    problem_reported:        r.problem_reported ?? "",
                    warranty_card_no:        r.warranty_card_no ?? "",
                    job_receive_condition_id: r.job_receive_condition_id ?? null,
                    remarks:                  r.remarks ?? "",
                    quantity:                 r.quantity ?? 1,
                    isDeletable:              r.transaction_count <= 1,
                })),
            });
        } else if (!editBatchNo && fields.length === 0) {
            append(getInitialBatchJobRow(docSequence, 0));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editBatchNo, editRows]);

    const handleAddRow = () => {
        const currentLength = fields.length;
        append(getInitialBatchJobRow(docSequence, currentLength));
    };

    const handleRemoveRow = (index: number) => {
        if (fields.length > 1) {
            const row = fields[index];
            remove(index);
            setPendingFiles(prev => { const n = { ...prev }; if (row?.localId) delete n[row.localId]; return n; });
        }
    };


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
                        <Input readOnly className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80" value={editBatchNo ? `#${editBatchNo}` : "Auto"} />
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-3 xl:col-span-3">
                        <Label className={labelCls}>Batch Date</Label>
                        <Input type="date" className="bg-[var(--cl-surface-2)]" {...form.register("batch_date")} />
                    </div>

                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Customer <span className="text-red-500">*</span></Label>
                        <CustomerInput
                            customerId={watch("customer_id") ?? null}
                            customerName={watch("customer_name") ?? ""}
                            customerTypes={customerTypes}
                            states={masterStates}
                            onChange={name => { setValue("customer_name", name, { shouldValidate: false }); if (!name.trim()) setValue("customer_id", undefined as unknown as number, { shouldValidate: true }); }}
                            onClear={() => { setValue("customer_id", undefined as unknown as number, { shouldValidate: true }); setValue("customer_name", "", { shouldValidate: false }); }}
                            onSelect={(c: CustomerSearchRow) => { setValue("customer_id", c.id, { shouldValidate: true }); setValue("customer_name", c.full_name ?? c.mobile, { shouldValidate: false }); }}
                        />
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Job Type <span className="text-red-500">*</span></Label>
                        <select
                            className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch("job_type_id") ? "border-red-400" : "border-[var(--cl-border)]"}`}
                            value={watch("job_type_id") ?? ""}
                            onChange={e => {
                                const newId = e.target.value ? Number(e.target.value) : (undefined as unknown as number);
                                const code  = jobTypes.find(t => t.id === newId)?.code;
                                if (code !== "UNDER_WARRANTY") {
                                    fields.forEach((_, idx) => setValue(`rows.${idx}.warranty_card_no`, ""));
                                }
                                setValue("job_type_id", newId, { shouldValidate: true });
                            }}
                        >
                            <option value="">Select…</option>
                            {jobTypes.filter(j => j.is_active).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-3 lg:col-span-6 xl:col-span-6">
                        <Label className={labelCls}>Receive Manner <span className="text-red-500">*</span></Label>
                        <select
                            className={`w-full h-9 rounded-md border text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch("receive_manner_id") ? "border-red-400" : "border-[var(--cl-border)]"}`}
                            value={watch("receive_manner_id") ?? ""}
                            onChange={e => setValue("receive_manner_id", e.target.value ? Number(e.target.value) : (undefined as unknown as number), { shouldValidate: true })}
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
                    {fields.map((field, idx) => (
                        <motion.div
                            key={field.id}
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
                                        <span className="font-mono text-xs text-[var(--cl-accent)] font-bold">{watch(`rows.${idx}.job_no`)}</span>
                                    </div>
                                    {fields.length > 1 && watch(`rows.${idx}.isDeletable`) && (
                                        <Button
                                            type="button" size="icon" variant="ghost"
                                            className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => handleRemoveRow(idx)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <CardContent className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 items-center">
                                    <div className="md:col-span-6 lg:col-span-9">
                                        <Label className={labelCls}>Product / Model <span className="text-red-500">*</span></Label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <SearchableCombobox<ModelRow>
                                                    label=""
                                                    placeholder="Search brand, product or model…"
                                                    items={models.filter(m => m.is_active)}
                                                    selectedValue={watch(`rows.${idx}.product_brand_model_id`)?.toString() ?? ""}
                                                    getDisplayValue={m => `${m.brand_name} — ${m.product_name} — ${m.model_name}`}
                                                    getFilterKey={m => `${m.brand_name} ${m.product_name} ${m.model_name}`}
                                                    getIdentifier={m => m.id.toString()}
                                                    onSelect={m => setValue(`rows.${idx}.product_brand_model_id`, m ? m.id : null)}
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
                                            type="number" min={1}
                                            className={`bg-[var(--cl-surface-2)] ${(watch(`rows.${idx}.quantity`) ?? 0) < 1 ? "border-red-400" : ""}`}
                                            {...register(`rows.${idx}.quantity`, { valueAsNumber: true })}
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-4">
                                        <Label className={labelCls}>Serial No</Label>
                                        <Input className="bg-[var(--cl-surface-2)]" placeholder="Optional…" {...register(`rows.${idx}.serial_no`)} />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-4">
                                        <Label className={labelCls}>Receive Condition</Label>
                                        <select
                                            className="w-full h-9 rounded-md border border-[var(--cl-border)] text-sm px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                            {...register(`rows.${idx}.job_receive_condition_id`, { valueAsNumber: true })}
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
                                            className="bg-[var(--cl-surface-2)]" disabled={!isWarranty}
                                            placeholder={isWarranty ? "Card number…" : "N/A"}
                                            {...register(`rows.${idx}.warranty_card_no`)}
                                        />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                        <Label className={labelCls}>Problem Reported</Label>
                                        <Textarea rows={2} className="bg-[var(--cl-surface-2)] resize-none" placeholder="Describe the problem…" {...register(`rows.${idx}.problem_reported`)} />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-6 lg:col-span-6">
                                        <Label className={labelCls}>Remarks</Label>
                                        <Textarea rows={2} className="bg-[var(--cl-surface-2)] resize-none" placeholder="Optional remarks…" {...register(`rows.${idx}.remarks`)} />
                                    </div>

                                    <div className="space-y-1.5 md:col-span-12 lg:col-span-12">
                                        <Label className={labelCls}>Attachments</Label>
                                        <div className="bg-[var(--cl-surface-2)]/30 rounded-lg p-2 border border-dashed border-[var(--cl-border)]">
                                            {watch(`rows.${idx}.id`)
                                                ? <JobImageUpload jobId={watch(`rows.${idx}.id`)!} />
                                                : <JobImageUpload onPendingChange={files => setPendingFiles(prev => ({ ...prev, [field.localId]: files }))} />
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
                    onClick={handleAddRow}
                >
                    <Plus className="h-4 w-4" />
                    Add Another Job
                </Button>
                <span className="text-xs text-[var(--cl-text-muted)]">
                    {fields.length} job{fields.length !== 1 ? "s" : ""} in this batch
                </span>
                {isSubmitting && (
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
    )
;
}
