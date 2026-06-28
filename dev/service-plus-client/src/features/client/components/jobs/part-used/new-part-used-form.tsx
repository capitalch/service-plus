import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobLookupCombobox, partUsedJobRestrictionReason } from "@/features/client/components/jobs/receipts/job-lookup-combobox";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema, selectDefaultGstRate, selectDefaultHsnForSparePart } from "@/store/context-slice";
import type { JobLookupForReceiptType } from "@/features/client/types/receipt";
import type { BrandOption } from "@/features/client/types/model";
import { PartCodeInput } from "../../inventory/part-code-input";
import { LineAddDeleteActions } from "../../inventory/line-add-delete-actions";

import { type PartUsedFormValues, type ExistingLine, getInitialPartUsedLine } from "./part-used-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const applyMarkup = (cost: number, pct: number) =>
    Math.round(cost * (1 + pct / 100) * 100) / 100;

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-(--cl-text) py-2 px-2 text-left border-b border-(--cl-border) bg-zinc-200/60 dark:bg-zinc-800/60";
const tdClass = "p-0.5 border-b border-(--cl-border)";
const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

function PriceInput({ value, className, onChange, disabled }: {
    value:    number;
    onChange: (v: number) => void;
    className?: string;
    disabled?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const [raw,     setRaw]     = useState("");
    return (
        <Input
            className={className}
            disabled={disabled}
            inputMode="decimal"
            type="text"
            value={editing && !disabled ? raw : value.toFixed(2)}
            onChange={e => setRaw(e.target.value)}
            onFocus={e => {
                if (disabled) return;
                setEditing(true);
                setRaw(value === 0 ? "" : String(value));
                setTimeout(() => e.target.select(), 0);
            }}
            onBlur={() => {
                if (disabled) return;
                const n = Math.max(0, parseFloat(raw) || 0);
                onChange(n);
                setEditing(false);
            }}
        />
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
    onJobSelect: (job: JobLookupForReceiptType | null) => void;
    form:        ReturnType<typeof useFormContext<PartUsedFormValues>>;
};

export function NewPartUsedForm({
    onJobSelect, form,
}: Props) {
    const dbName    = useAppSelector(selectDbName);
    const schema    = useAppSelector(selectSchema);
    const branchId  = useAppSelector(selectCurrentBranch)?.id ?? null;
    const defaultGstRate          = useAppSelector(selectDefaultGstRate);
    const defaultHsnForSparePart  = useAppSelector(selectDefaultHsnForSparePart);

    const { control, register, setValue, watch } = useFormContext<PartUsedFormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: "newLines",
    });

    const [selectedJob,    setSelectedJob]    = useState<JobLookupForReceiptType | null>(null);
    const isWarranty = selectedJob?.job_type_code === "UNDER_WARRANTY";
    const [jobTouched,     setJobTouched]     = useState(false);
    const [brands,         setBrands]         = useState<BrandOption[]>([]);
    const [existingLines,  setExistingLines]  = useState<ExistingLine[]>([]);
    const [loadingExist,   setLoadingExist]   = useState(false);
    const [markupPct,      setMarkupPct]      = useState(0);

    // Summary calculations
    const rawLines = watch("newLines");
    const formLines = useMemo(() => rawLines ?? [], [rawLines]);
    const newLinesCount = useMemo(() => formLines.filter(l => l.part_id).length, [formLines]);

    const watchDeletedIds = watch("deletedIds") ?? [];


    // Fetch Metadata
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchBrands = async () => {
            try {
                const res = await apolloClient.query<GenericQueryData<BrandOption>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName,
                        schema,
                        value:   graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                    },
                });
                setBrands(res.data?.genericQuery ?? []);
            } catch { /* silent */ }
        };
        void fetchBrands();
        apolloClient
            .query<GenericQueryData<{ setting_value: unknown }>>({
                fetchPolicy: "cache-first",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value:   graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_APP_SETTING_BY_KEY,
                        sqlArgs: { setting_key: "markup_percent_over_cost" },
                    }),
                },
            })
            .then(res => {
                const raw = res.data?.genericQuery?.[0]?.setting_value;
                setMarkupPct(raw != null ? Number(raw) : 0);
            })
            .catch(() => setMarkupPct(0));
    }, [dbName, schema]);

    const loadExistingLines = useCallback(async (jobId: number) => {
        if (!dbName || !schema) return;
        setLoadingExist(true);
        try {
            const res = await apolloClient.query<GenericQueryData<ExistingLine>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_JOB_PART_USED_BY_JOB,
                        sqlArgs: { job_id: jobId },
                    }),
                },
            });
            setExistingLines(res.data?.genericQuery ?? []);
        } catch { toast.error(MESSAGES.ERROR_PART_USED_LOAD_FAILED); }
        finally { setLoadingExist(false); }
    }, [dbName, schema]);

    const handleJobSelect = (job: JobLookupForReceiptType | null) => {
        setJobTouched(true);
        setSelectedJob(job);
        onJobSelect(job);
        setExistingLines([]);
        form.setValue("deletedIds", []);
        if (job) {
            form.setValue("job_id", job.id);
            void loadExistingLines(job.id);
        } else {
            form.setValue("job_id", 0);
        }
    };

    // Line mutations using useFieldArray
    const handleAddLine = () => {
        append(getInitialPartUsedLine());
    };

    const handleRemoveLine = (idx: number) => {
        if (fields.length > 1) {
            remove(idx);
        } else {
            // If it's the last line, just clear it
            setValue(`newLines.${idx}.part_id`, null);
            setValue(`newLines.${idx}.brand_id`, null);
            setValue(`newLines.${idx}.part_code`, "");
            setValue(`newLines.${idx}.part_name`, "");
            setValue(`newLines.${idx}.uom`, "");
            setValue(`newLines.${idx}.qty`, 1);
            setValue(`newLines.${idx}.remarks`, "");
        }
    };

    const markExistingDeleted = (id: number) => {
        const currentIds = form.getValues("deletedIds") ?? [];
        form.setValue("deletedIds", [...currentIds, id]);
        setExistingLines(prev => prev.filter(l => l.id !== id));
    };


    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-(--cl-border) text-center">
                    <p className="text-sm font-semibold text-(--cl-text)">No Branch Selected</p>
                    <p className="mt-1 text-xs text-(--cl-text-muted)">Select a branch from the global header to continue.</p>
                </div>
            ) : (
                <>
                    {/* Job Selection */}
                    <div className={`rounded-lg border bg-(--cl-surface) p-4 shadow-sm transition-colors ${jobTouched && !selectedJob ? "border-red-400 dark:border-red-500" : "border-(--cl-border)"}`}>
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted)">
                            Job Selection <span className="text-red-500">*</span>
                        </p>
                        <JobLookupCombobox
                            getRestrictionReason={partUsedJobRestrictionReason}
                            value={selectedJob?.id ?? null}
                            onChange={(_id, job) => handleJobSelect(job)}
                        />
                        {jobTouched && !selectedJob && (
                            <p className="mt-1.5 text-xs text-red-500 font-medium">A valid job must be selected to save parts.</p>
                        )}

                        {selectedJob && (
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-(--cl-border) bg-(--cl-surface-2)/50 px-4 py-2 text-sm">
                                <span><span className="text-xs font-bold uppercase text-(--cl-text-muted)">Job No </span><span className="font-mono font-semibold">{selectedJob.job_no}</span></span>
                                <span><span className="text-xs font-bold uppercase text-(--cl-text-muted)">Date </span>{selectedJob.job_date}</span>
                                <span><span className="text-xs font-bold uppercase text-(--cl-text-muted)">Customer </span>{selectedJob.customer_name}</span>
                                <span><span className="text-xs font-bold uppercase text-(--cl-text-muted)">Status </span><span className="text-(--cl-accent)">{selectedJob.job_status_name}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Existing parts */}
                    {selectedJob && (
                        <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                            <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted)">Existing Parts for this Job</p>
                            {loadingExist ? (
                                <div className="flex h-16 items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-(--cl-accent)" />
                                </div>
                            ) : existingLines.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-(--cl-text-muted) italic">No parts logged yet for this job.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse text-sm">
                                        <thead>
                                            <tr>
                                                <th className={thClass}>#</th>
                                                <th className={thClass}>Part Code</th>
                                                <th className={thClass}>Part Name</th>
                                                <th className={`${thClass} text-right`}>Qty</th>
                                                <th className={thClass}>Remarks</th>
                                                <th className={thClass}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {existingLines.map((line, idx) => (
                                                <tr key={line.id} className="hover:bg-(--cl-surface-2)/40">
                                                    <td className={`${tdClass} px-2 text-xs text-(--cl-text-muted)`}>{idx + 1}</td>
                                                    <td className={`${tdClass} px-2 font-mono font-medium`}>{line.part_code}</td>
                                                    <td className={`${tdClass} px-2`}>{line.part_name}</td>
                                                    <td className={`${tdClass} px-2 text-right font-medium`}>{Number(line.qty).toFixed(2)}</td>
                                                    <td className={`${tdClass} px-2 text-xs text-(--cl-text-muted) italic`}>{line.remarks || "—"}</td>
                                                    <td className={`${tdClass} px-2`}>
                                                        <Button
                                                            className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10"
                                                            size="icon"
                                                            title="Remove this line"
                                                            variant="ghost"
                                                            onClick={() => markExistingDeleted(line.id)}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* New parts */}
                    <div className="rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted)">Add New Parts</p>
                        </div>
                        <div className="overflow-x-auto pb-2">
                            <table className="min-w-[960px] w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "11%" }}>Brand <span className="text-red-500">*</span></th>
                                        <th className={thClass} style={{ width: "20%" }}>Part Code <span className="text-red-500">*</span></th>
                                        <th className={thClass} style={{ width: "16%" }}>Part Name</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>Qty <span className="text-red-500">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "9%" }}>Cost</th>
                                        <th className={`${thClass} text-right`} style={{ width: "9%" }}>Selling</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>GST %</th>
                                        <th className={thClass} style={{ width: "9%" }}>HSN</th>
                                        <th className={thClass} style={{ width: "13%" }}>Remarks</th>
                                        <th className={thClass} style={{ width: "7%" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field, idx) => {
                                        const line = watch(`newLines.${idx}`);
                                        return (
                                        <tr key={field.id} className="hover:bg-(--cl-surface-2)/30">
                                            <td className={`${tdClass} pl-3 text-xs text-(--cl-text-muted)`}>{idx + 1}</td>
                                            <td className={tdClass}>
                                                <Select
                                                    value={line?.brand_id ? String(line.brand_id) : ""}
                                                    onValueChange={v => {
                                                        setValue(`newLines.${idx}.brand_id`, Number(v));
                                                        setValue(`newLines.${idx}.part_code`, "");
                                                        setValue(`newLines.${idx}.part_id`, null);
                                                        setValue(`newLines.${idx}.part_name`, "");
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 text-xs bg-transparent border-(--cl-border)">
                                                        <SelectValue placeholder="Select Brand" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {brands.map(b => (
                                                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className={tdClass}>
                                                <PartCodeInput
                                                    brandId={line?.brand_id}
                                                    partCode={line?.part_code ?? ""}
                                                    partId={line?.part_id ?? null}
                                                    partName={line?.part_name ?? ""}
                                                    selectedBrandId={line?.brand_id ?? null}
                                                    showName={false}
                                                    brandName={brands.find(b => b.id === line?.brand_id)?.name}
                                                    onChange={code => {
                                                        if (!code.trim()) {
                                                            setValue(`newLines.${idx}.part_code`, "");
                                                            setValue(`newLines.${idx}.part_id`, null);
                                                            setValue(`newLines.${idx}.part_name`, "");
                                                        } else {
                                                            setValue(`newLines.${idx}.part_code`, code);
                                                        }
                                                    }}
                                                    onClear={() => {
                                                        setValue(`newLines.${idx}.part_code`, "");
                                                        setValue(`newLines.${idx}.part_id`, null);
                                                        setValue(`newLines.${idx}.part_name`, "");
                                                    }}
                                                    onSelect={part => {
                                                        const cost = part.cost_price ?? 0;
                                                        const effectiveGstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : (Number(defaultGstRate) || 0);
                                                        const effectiveHsnCode = (part.hsn_code ?? "").trim() || (defaultHsnForSparePart ?? "");
                                                        const effectiveSellingPrice = isWarranty ? 0 : (markupPct > 0 ? applyMarkup(cost, markupPct) : (part.selling_price ?? 0));
                                                        setValue(`newLines.${idx}.part_id`, part.id);
                                                        setValue(`newLines.${idx}.part_code`, part.part_code);
                                                        setValue(`newLines.${idx}.part_name`, part.part_name);
                                                        setValue(`newLines.${idx}.uom`, part.uom);
                                                        setValue(`newLines.${idx}.brand_id`, part.brand_id);
                                                        setValue(`newLines.${idx}.cost_price`, cost);
                                                        setValue(`newLines.${idx}.selling_price`, effectiveSellingPrice);
                                                        setValue(`newLines.${idx}.gst_rate`, effectiveGstRate);
                                                        setValue(`newLines.${idx}.hsn_code`, effectiveHsnCode);
                                                    }}
                                                />
                                            </td>
                                            <td className={`${tdClass} px-2 text-sm text-(--cl-text-muted)`}>{line?.part_name}</td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} text-right ${(line?.qty ?? 0) <= 0 ? "border-red-500" : ""}`}
                                                    min={0.01}
                                                    step="0.01"
                                                    type="number"
                                                    {...register(`newLines.${idx}.qty`, { valueAsNumber: true })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <PriceInput
                                                    className={`${inputCls} text-right`}
                                                    value={line?.cost_price ?? 0}
                                                    onChange={cost => {
                                                        setValue(`newLines.${idx}.cost_price`, cost, { shouldValidate: true });
                                                        if (isWarranty) setValue(`newLines.${idx}.selling_price`, 0);
                                                        else if (markupPct > 0) setValue(`newLines.${idx}.selling_price`, applyMarkup(cost, markupPct));
                                                    }}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <PriceInput
                                                    className={`${inputCls} text-right`}
                                                    disabled={isWarranty}
                                                    value={isWarranty ? 0 : (line?.selling_price ?? 0)}
                                                    onChange={v => setValue(`newLines.${idx}.selling_price`, v)}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <PriceInput
                                                    className={`${inputCls} text-right`}
                                                    value={line?.gst_rate ?? 0}
                                                    onChange={v => setValue(`newLines.${idx}.gst_rate`, v)}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={inputCls}
                                                    placeholder="HSN…"
                                                    {...register(`newLines.${idx}.hsn_code`)}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={inputCls}
                                                    placeholder="Remarks…"
                                                    {...register(`newLines.${idx}.remarks`)}
                                                />
                                            </td>
                                            <td className={`${tdClass} px-1`}>
                                                <div className="flex items-center justify-start gap-0.5">
                                                    <LineAddDeleteActions
                                                        onAdd={handleAddLine}
                                                        onDelete={() => handleRemoveLine(idx)}
                                                        disableDelete={false}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );})}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center gap-4 rounded-lg border border-(--cl-border) bg-(--cl-surface-2)/40 px-4 py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-black uppercase tracking-widest text-(--cl-text-muted)">New Lines</span>
                            <span className="font-mono font-semibold text-(--cl-text)">{newLinesCount}</span>
                        </div>
                        {watchDeletedIds.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-black uppercase tracking-widest text-red-500">Removed</span>
                                <span className="font-mono font-semibold text-red-500">{watchDeletedIds.length}</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </motion.div>
    );
}
