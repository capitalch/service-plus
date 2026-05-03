import { useEffect, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { AddModelDialog } from "@/features/client/components/masters/model/add-model-dialog";
import { CustomerInput } from "@/features/client/components/inventory/customer-input";

import type { CustomerSearchRow } from "@/features/client/types/sales";
import type { JobBatchDetailRow, JobLookupRow, ModelRow } from "@/features/client/types/job";
import type { BrandOption, ProductOption } from "@/features/client/types/model";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

import { type BatchJobFormValues, getInitialBatchJobRow } from "./batch-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    branchId:          number | null;
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
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const labelCls = "text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewBatchJobForm({
    branchId, jobTypes, receiveMannners, receiveConditions,
    models, brands, products, customerTypes, masterStates,
    editBatchNo, editRows,
    onRefreshModels, form,
}: Props) {

    const [showAddModel, setShowAddModel] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const { control, formState: { isSubmitting }, setValue, watch, register } = useFormContext<BatchJobFormValues>();

    const { fields, append, remove } = useFieldArray({ control, name: "rows" });

    useEffect(() => {
        if (editBatchNo && editRows && editRows.length > 0) {
            const first = editRows[0];
            form.reset({
                batch_date:        first.job_date,
                customer_id:       first.customer_contact_id,
                customer_name:     first.customer_name ?? first.mobile,
                receive_manner_id: first.job_receive_manner_id,
                rows: editRows.map(r => ({
                    id:                       r.id,
                    localId:                  crypto.randomUUID(),
                    job_type_id:              r.job_type_id,
                    product_brand_model_id:   r.product_brand_model_id ?? null,
                    serial_no:                r.serial_no ?? "",
                    problem_reported:         r.problem_reported ?? "",
                    warranty_card_no:         r.warranty_card_no ?? "",
                    job_receive_condition_id: r.job_receive_condition_id ?? null,
                    remarks:                  r.remarks ?? "",
                    quantity:                 r.quantity ?? 1,
                    isDeletable:              r.transaction_count <= 1,
                })),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editBatchNo, editRows]);

    const toggleExpand = (localId: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(localId)) next.delete(localId); else next.add(localId);
            return next;
        });
    };

    const handleAddRow = () => append(getInitialBatchJobRow());

    const handleRemoveRow = (index: number) => {
        if (fields.length > 2) {
            remove(index);
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

            {/* Shared header card — single compact row */}
            <Card className="border-[var(--cl-border)] shadow-md bg-[var(--cl-surface)] !overflow-visible">
                <CardContent className="py-2 px-3 flex flex-wrap lg:flex-nowrap items-end gap-2 !overflow-visible">

                    <div className="space-y-0.5 shrink-0">
                        <Label className={labelCls}>Batch No</Label>
                        <Input readOnly className="h-8 w-20 bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80 text-xs" value={editBatchNo ? `#${editBatchNo}` : "Auto"} />
                    </div>

                    <div className="space-y-0.5 shrink-0">
                        <Label className={labelCls}>Date</Label>
                        <Input type="date" className="h-8 w-36 bg-[var(--cl-surface-2)] text-xs" {...form.register("batch_date")} />
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-[180px]">
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

                    <div className="space-y-0.5 shrink-0 w-44">
                        <Label className={labelCls}>Receive Manner <span className="text-red-500">*</span></Label>
                        <select
                            className={`w-full h-8 rounded-md border text-xs px-2 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch("receive_manner_id") ? "border-red-400" : "border-[var(--cl-border)]"}`}
                            value={watch("receive_manner_id") ?? ""}
                            onChange={e => setValue("receive_manner_id", e.target.value ? Number(e.target.value) : (undefined as unknown as number), { shouldValidate: true })}
                        >
                            <option value="">Select…</option>
                            {receiveMannners.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Job rows */}
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">
                    Jobs in Batch
                </p>
                {fields.length < 2 && (
                    <span className="text-xs text-red-500 font-medium">Minimum 2 jobs required</span>
                )}
            </div>

            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[32px_1fr_130px_100px_100px_60px_40px_32px] gap-x-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)]">
                <span>#</span>
                <span>Product / Model</span>
                <span>Job Type</span>
                <span>Serial No</span>
                <span>Condition</span>
                <span>Qty</span>
                <span></span>
                <span></span>
            </div>

            <div className="flex flex-col gap-1.5">
                <AnimatePresence initial={false}>
                    {fields.map((field, idx) => {
                        const isExpanded = expandedRows.has(field.localId);
                        return (
                            <motion.div
                                key={field.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.15 }}
                            >
                                <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] border-l-4 border-l-[var(--cl-accent)] overflow-visible">
                                    {/* Compact single-line row */}
                                    <div className="grid grid-cols-[32px_1fr] md:grid-cols-[32px_1fr_130px_100px_100px_60px_40px_32px] gap-x-2 items-center px-3 py-2">
                                        {/* Index badge */}
                                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--cl-accent)]/10 text-[var(--cl-accent)] text-[10px] font-bold shrink-0">
                                            {idx + 1}
                                        </span>

                                        {/* Model combobox */}
                                        <div className="flex items-center gap-1 min-w-0">
                                            <div className="flex-1 min-w-0">
                                                <SearchableCombobox<ModelRow>
                                                    label=""
                                                    placeholder="Brand / Product / Model…"
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
                                                className="h-7 w-7 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                title="Add Missing Model"
                                                onClick={() => setShowAddModel(true)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        {/* Job Type */}
                                        <select
                                            className={`h-8 w-full rounded-md border text-xs px-1.5 bg-[var(--cl-surface-2)] text-[var(--cl-text)] hidden md:block ${!watch(`rows.${idx}.job_type_id`) ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                            value={watch(`rows.${idx}.job_type_id`) ?? ""}
                                            onChange={e => {
                                                const newId = e.target.value ? Number(e.target.value) : (undefined as unknown as number);
                                                const code  = jobTypes.find(t => t.id === newId)?.code;
                                                if (code !== "UNDER_WARRANTY") setValue(`rows.${idx}.warranty_card_no`, "");
                                                setValue(`rows.${idx}.job_type_id`, newId, { shouldValidate: true });
                                            }}
                                        >
                                            <option value="">Type…</option>
                                            {jobTypes.filter(j => j.is_active).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                        </select>

                                        {/* Serial No */}
                                        <Input
                                            className="h-8 text-xs bg-[var(--cl-surface-2)] hidden md:block"
                                            placeholder="Serial…"
                                            {...register(`rows.${idx}.serial_no`)}
                                        />

                                        {/* Receive Condition */}
                                        <select
                                            className="h-8 w-full rounded-md border border-[var(--cl-border)] text-xs px-1.5 bg-[var(--cl-surface-2)] text-[var(--cl-text)] hidden md:block"
                                            {...register(`rows.${idx}.job_receive_condition_id`, { valueAsNumber: true })}
                                        >
                                            <option value="">Condition…</option>
                                            {receiveConditions.filter(c => c.is_active).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>

                                        {/* Qty */}
                                        <Input
                                            type="number" min={1}
                                            className={`h-8 text-xs bg-[var(--cl-surface-2)] hidden md:block ${(watch(`rows.${idx}.quantity`) ?? 0) < 1 ? "border-red-400" : ""}`}
                                            {...register(`rows.${idx}.quantity`, { valueAsNumber: true })}
                                        />

                                        {/* Expand toggle */}
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(field.localId)}
                                            className="flex items-center justify-center h-7 w-7 rounded text-[var(--cl-text-muted)] hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] transition-colors"
                                            title={isExpanded ? "Collapse" : "Expand"}
                                        >
                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                        </button>

                                        {/* Delete */}
                                        {fields.length > 2 && watch(`rows.${idx}.isDeletable`) ? (
                                            <Button
                                                type="button" size="icon" variant="ghost"
                                                className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-600"
                                                onClick={() => handleRemoveRow(idx)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        ) : (
                                            <div className="h-7 w-7" />
                                        )}
                                    </div>

                                    {/* Expanded area — extra fields + mobile-visible fields */}
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-3 pb-3 pt-1 border-t border-[var(--cl-border)]/50">
                                                    {/* Mobile-only fields (hidden in compact row on md+) */}
                                                    <div className="space-y-1 md:hidden">
                                                        <Label className={labelCls}>Job Type <span className="text-red-500">*</span></Label>
                                                        <select
                                                            className={`w-full h-8 rounded-md border text-xs px-1.5 bg-[var(--cl-surface-2)] text-[var(--cl-text)] ${!watch(`rows.${idx}.job_type_id`) ? "border-red-400" : "border-[var(--cl-border)]"}`}
                                                            value={watch(`rows.${idx}.job_type_id`) ?? ""}
                                                            onChange={e => {
                                                                const newId = e.target.value ? Number(e.target.value) : (undefined as unknown as number);
                                                                const code  = jobTypes.find(t => t.id === newId)?.code;
                                                                if (code !== "UNDER_WARRANTY") setValue(`rows.${idx}.warranty_card_no`, "");
                                                                setValue(`rows.${idx}.job_type_id`, newId, { shouldValidate: true });
                                                            }}
                                                        >
                                                            <option value="">Select…</option>
                                                            {jobTypes.filter(j => j.is_active).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1 md:hidden">
                                                        <Label className={labelCls}>Serial No</Label>
                                                        <Input className="h-8 text-xs bg-[var(--cl-surface-2)]" placeholder="Optional…" {...register(`rows.${idx}.serial_no`)} />
                                                    </div>
                                                    <div className="space-y-1 md:hidden">
                                                        <Label className={labelCls}>Receive Condition</Label>
                                                        <select
                                                            className="w-full h-8 rounded-md border border-[var(--cl-border)] text-xs px-1.5 bg-[var(--cl-surface-2)] text-[var(--cl-text)]"
                                                            {...register(`rows.${idx}.job_receive_condition_id`, { valueAsNumber: true })}
                                                        >
                                                            <option value="">None</option>
                                                            {receiveConditions.filter(c => c.is_active).map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1 md:hidden">
                                                        <Label className={labelCls}>Qty</Label>
                                                        <Input
                                                            type="number" min={1}
                                                            className="h-8 text-xs bg-[var(--cl-surface-2)]"
                                                            {...register(`rows.${idx}.quantity`, { valueAsNumber: true })}
                                                        />
                                                    </div>

                                                    {/* Always expanded fields */}
                                                    <div className="space-y-1 sm:col-span-2">
                                                        <Label className={labelCls}>Problem Reported</Label>
                                                        <Textarea rows={2} className="bg-[var(--cl-surface-2)] resize-none text-xs" placeholder="Describe the problem…" {...register(`rows.${idx}.problem_reported`)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Remarks</Label>
                                                        <Input className="h-8 text-xs bg-[var(--cl-surface-2)]" placeholder="Optional…" {...register(`rows.${idx}.remarks`)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Warranty Card No</Label>
                                                        {(() => {
                                                            const rowIsWarranty = jobTypes.find(t => t.id === watch(`rows.${idx}.job_type_id`))?.code === "UNDER_WARRANTY";
                                                            return (
                                                                <Input
                                                                    className="h-8 text-xs bg-[var(--cl-surface-2)]"
                                                                    disabled={!rowIsWarranty}
                                                                    placeholder={rowIsWarranty ? "Card number…" : "N/A"}
                                                                    {...register(`rows.${idx}.warranty_card_no`)}
                                                                />
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 pt-1">
                <Button
                    type="button" variant="outline" size="default"
                    className="gap-2 text-sm font-semibold border-2 border-dashed border-[var(--cl-accent)]/30 text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/5 hover:border-[var(--cl-accent)]"
                    onClick={handleAddRow}
                >
                    <Plus className="h-4 w-4" />
                    Add Job
                </Button>
                <span className="text-xs text-[var(--cl-text-muted)]">
                    {fields.length} job{fields.length !== 1 ? "s" : ""} in this batch
                    {fields.length < 2 && <span className="text-red-500 ml-1.5">· min. 2 required</span>}
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
    );
}
