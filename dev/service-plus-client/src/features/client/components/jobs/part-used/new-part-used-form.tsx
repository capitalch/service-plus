import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { BrandOption } from "@/features/client/types/model";
import { PartCodeInput } from "../../inventory/part-code-input";
import { LineAddDeleteActions } from "../../inventory/line-add-delete-actions";

import { type PartUsedFormValues, type JobSearchRow, type ExistingLine, getInitialPartUsedLine } from "./part-used-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────


const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
    branchId:           number | null;
    onLinesValidChange: (isValid: boolean) => void;
    onJobSelect:        (job: JobSearchRow | null) => void;
    form:               ReturnType<typeof useFormContext<PartUsedFormValues>>;
};

export function NewPartUsedForm({
    branchId, onLinesValidChange, onJobSelect, form,
}: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const { control, register, setValue, watch } = useFormContext<PartUsedFormValues>();

    const { fields, append, remove } = useFieldArray({
        control,
        name: "newLines",
    });

    const [selectedJob,    setSelectedJob]    = useState<JobSearchRow | null>(null);
    const [jobQuery,       setJobQuery]       = useState("");
    const [jobOptions,     setJobOptions]     = useState<JobSearchRow[]>([]);
    const [brands,         setBrands]         = useState<BrandOption[]>([]);
    const [jobSearching,   setJobSearching]   = useState(false);
    const [existingLines,  setExistingLines]  = useState<ExistingLine[]>([]);
    const [loadingExist,   setLoadingExist]   = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Summary calculations
    const rawLines = watch("newLines");
    const formLines = useMemo(() => rawLines ?? [], [rawLines]);
    const newLinesCount = useMemo(() => formLines.filter(l => l.part_id).length, [formLines]);

    const watchDeletedIds = watch("deletedIds") ?? [];

    useEffect(() => {
        const linesValid = formLines.some(l => l.part_id && (l.quantity ?? 0) > 0) || watchDeletedIds.length > 0;
        onLinesValidChange(linesValid);
    }, [formLines, watchDeletedIds.length, onLinesValidChange]);

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
    }, [dbName, schema]);

    // Debounced job search
    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        if (jobQuery.length < 2) { setJobOptions([]); return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setJobSearching(true);
            try {
                const res = await apolloClient.query<GenericQueryData<JobSearchRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_JOBS_BY_KEYWORD,
                            sqlArgs: { search: jobQuery.trim(), branch_id: branchId, limit: 20 },
                        }),
                    },
                });
                setJobOptions(res.data?.genericQuery ?? []);
            } catch { /* silent */ } finally { setJobSearching(false); }
        }, 600);
    }, [jobQuery, branchId, dbName, schema]);

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

    const handleJobSelect = (job: JobSearchRow | null) => {
        setSelectedJob(job);
        onJobSelect(job);
        setExistingLines([]);
        form.reset({ ...form.getValues(), newLines: [getInitialPartUsedLine()], deletedIds: [] });
        if (job) {
            form.setValue("job_id", job.id, { shouldValidate: true });
            void loadExistingLines(job.id);
        } else {
            form.setValue("job_id", 0, { shouldValidate: true });
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
            setValue(`newLines.${idx}.quantity`, 1);
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
            className="flex flex-col gap-4 p-4"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                    <p className="text-sm font-semibold text-[var(--cl-text)]">No Branch Selected</p>
                    <p className="mt-1 text-xs text-[var(--cl-text-muted)]">Select a branch from the global header to continue.</p>
                </div>
            ) : (
                <>
                    {/* Job Selection */}
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] p-4 shadow-sm">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">Job Selection</p>
                        <SearchableCombobox
                            className="max-w-sm"
                            isError={!selectedJob}
                            isLoading={jobSearching}
                            label={<span>Job <span className="text-red-500 ml-0.5">*</span></span>}
                            placeholder="Search by job no, customer or mobile…"
                            selectedValue={selectedJob ? String(selectedJob.id) : ""}
                            items={jobOptions}
                            getFilterKey={j => j.job_no}
                            getDisplayValue={j => `${j.job_no} — ${j.customer_name}`}
                            getIdentifier={j => String(j.id)}
                            onInputChange={setJobQuery}
                            onSelect={j => handleJobSelect(j ?? null)}
                            renderItem={j => (
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-mono font-semibold">{j.job_no}</span>
                                    <span className="text-xs text-[var(--cl-text-muted)]">{j.customer_name} · {j.mobile} · {j.job_date}</span>
                                    <span className="text-xs text-[var(--cl-accent)]">{j.job_status_name}</span>
                                </div>
                            )}
                        />

                        {selectedJob && (
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50 px-4 py-2 text-sm">
                                <span><span className="text-xs font-bold uppercase text-[var(--cl-text-muted)]">Job No </span><span className="font-mono font-semibold">{selectedJob.job_no}</span></span>
                                <span><span className="text-xs font-bold uppercase text-[var(--cl-text-muted)]">Date </span>{selectedJob.job_date}</span>
                                <span><span className="text-xs font-bold uppercase text-[var(--cl-text-muted)]">Customer </span>{selectedJob.customer_name}</span>
                                <span><span className="text-xs font-bold uppercase text-[var(--cl-text-muted)]">Status </span><span className="text-[var(--cl-accent)]">{selectedJob.job_status_name}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Existing parts */}
                    {selectedJob && (
                        <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                            <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">Existing Parts for this Job</p>
                            {loadingExist ? (
                                <div className="flex h-16 items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin text-[var(--cl-accent)]" />
                                </div>
                            ) : existingLines.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-[var(--cl-text-muted)] italic">No parts logged yet for this job.</p>
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
                                                <tr key={line.id} className="hover:bg-[var(--cl-surface-2)]/40">
                                                    <td className={`${tdClass} px-2 text-xs text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                                    <td className={`${tdClass} px-2 font-mono font-medium`}>{line.part_code}</td>
                                                    <td className={`${tdClass} px-2`}>{line.part_name}</td>
                                                    <td className={`${tdClass} px-2 text-right font-medium`}>{Number(line.quantity).toFixed(2)}</td>
                                                    <td className={`${tdClass} px-2 text-xs text-[var(--cl-text-muted)] italic`}>{line.remarks || "—"}</td>
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
                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)]">Add New Parts</p>
                        </div>
                        <div className="overflow-x-auto pb-2">
                            <table className="min-w-[520px] w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className={thClass} style={{ width: "4%" }}>#</th>
                                        <th className={thClass} style={{ width: "16%" }}>Brand <span className="text-red-500">*</span></th>
                                        <th className={thClass} style={{ width: "22%" }}>Part Code <span className="text-red-500">*</span></th>
                                        <th className={thClass} style={{ width: "22%" }}>Part Name</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Qty <span className="text-red-500">*</span></th>
                                        <th className={thClass} style={{ width: "16%" }}>Remarks</th>
                                        <th className={thClass} style={{ width: "10%" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field, idx) => {
                                        const line = watch(`newLines.${idx}`);
                                        return (
                                        <tr key={field.id} className="hover:bg-[var(--cl-surface-2)]/30">
                                            <td className={`${tdClass} pl-3 text-xs text-[var(--cl-text-muted)]`}>{idx + 1}</td>
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
                                                    <SelectTrigger className="h-7 text-xs bg-transparent border-[var(--cl-border)]">
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
                                                        setValue(`newLines.${idx}.part_id`, part.id);
                                                        setValue(`newLines.${idx}.part_code`, part.part_code);
                                                        setValue(`newLines.${idx}.part_name`, part.part_name);
                                                        setValue(`newLines.${idx}.uom`, part.uom);
                                                        setValue(`newLines.${idx}.brand_id`, part.brand_id);
                                                    }}
                                                />
                                            </td>
                                            <td className={`${tdClass} px-2 text-sm text-[var(--cl-text-muted)]`}>{line?.part_name}</td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} text-right ${(line?.quantity ?? 0) <= 0 ? "border-red-500" : ""}`}
                                                    min={0.01}
                                                    step="0.01"
                                                    type="number"
                                                    {...register(`newLines.${idx}.quantity`, { valueAsNumber: true })}
                                                    onFocus={e => e.target.select()}
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
                    <div className="flex items-center gap-4 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-black uppercase tracking-widest text-[var(--cl-text-muted)]">New Lines</span>
                            <span className="font-mono font-semibold text-[var(--cl-text)]">{newLinesCount}</span>
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
