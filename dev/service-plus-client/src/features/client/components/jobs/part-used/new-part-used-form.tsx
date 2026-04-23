import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
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
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { BrandOption } from "@/features/client/types/model";
import { PartCodeInput } from "../../inventory/part-code-input";
import { LineAddDeleteActions } from "../../inventory/line-add-delete-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type JobSearchRow = {
    id:              number;
    job_no:          string;
    job_date:        string;
    branch_id:       number;
    is_closed:       boolean;
    customer_name:   string;
    mobile:          string;
    job_status_name: string;
};

type ExistingLine = {
    id:        number;
    part_id:   number;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string | null;
};

type NewLine = {
    _key:      string;
    brand_id:  number | null;
    part_id:   number | null;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string;
};

export type NewPartUsedFormHandle = { submit: () => void; reset: () => void };

type Props = {
    branchId:       number | null;
    txnTypes:       StockTransactionTypeRow[];
    onSuccess:      () => void;
    onStatusChange: (s: { isValid: boolean; isSubmitting: boolean }) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyLine(): NewLine {
    return {
        _key:      crypto.randomUUID(),
        brand_id:  null,
        part_id:   null,
        part_code: "",
        part_name: "",
        uom:       "",
        quantity:  1,
        remarks:   "",
    };
}

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPartUsedForm = forwardRef<NewPartUsedFormHandle, Props>(({
    branchId, txnTypes, onSuccess, onStatusChange,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [selectedJob,    setSelectedJob]    = useState<JobSearchRow | null>(null);
    const [jobQuery,       setJobQuery]       = useState("");
    const [jobOptions,     setJobOptions]     = useState<JobSearchRow[]>([]);
    const [brands,         setBrands]         = useState<BrandOption[]>([]);
    const [jobSearching,   setJobSearching]   = useState(false);
    const [existingLines,  setExistingLines]  = useState<ExistingLine[]>([]);
    const [deletedIds,     setDeletedIds]     = useState<number[]>([]);
    const [newLines,       setNewLines]       = useState<NewLine[]>([emptyLine()]);
    const [loadingExist,   setLoadingExist]   = useState(false);
    const [submitting,     setSubmitting]     = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setDeletedIds([]);
        setExistingLines([]);
        setNewLines([emptyLine()]);
        if (job) void loadExistingLines(job.id);
    };

    const updateNewLine = (idx: number, patch: Partial<NewLine>) => {
        setNewLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
    };

    const insertNewLine = (idx: number) => {
        setNewLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyLine());
            return next;
        });
    };

    const removeNewLine = (idx: number) => {
        setNewLines(prev => prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== idx));
    };

    const markExistingDeleted = (id: number) => {
        setDeletedIds(prev => [...prev, id]);
        setExistingLines(prev => prev.filter(l => l.id !== id));
    };

    const isValid = (
        !!selectedJob &&
        (newLines.some(l => l.part_id && l.quantity > 0) || deletedIds.length > 0)
    );

    const handleSubmit = async () => {
        if (!selectedJob || !branchId || !dbName || !schema) return;
        if (!isValid) {
            toast.error(!selectedJob ? MESSAGES.ERROR_PART_USED_JOB_REQUIRED : MESSAGES.ERROR_PART_USED_LINES_REQUIRED);
            return;
        }

        const consumeTypeId = txnTypes.find(t => t.code === "JOB_CONSUME")?.id;
        if (!consumeTypeId) {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
            return;
        }

        const validNewLines = newLines.filter(l => l.part_id && l.quantity > 0);

        const xData = validNewLines.map(line => ({
            job_id:   selectedJob.id,
            part_id:  line.part_id,
            quantity: line.quantity,
            remarks:  line.remarks.trim() || null,
            xDetails: {
                tableName: "stock_transaction",
                fkeyName:  "job_part_used_id",
                xData: {
                    branch_id:                 branchId,
                    part_id:                   line.part_id,
                    quantity:                  line.quantity,
                    dr_cr:                     "C",
                    transaction_date:          selectedJob.job_date,
                    stock_transaction_type_id: consumeTypeId,
                    remarks:                   line.remarks.trim() || null,
                },
            },
        }));

        const payload = graphQlUtils.buildGenericUpdateValue({
            tableName:  "job_part_used",
            deletedIds: deletedIds.length > 0 ? deletedIds : undefined,
            xData:      xData,
        });

        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_SAVED);
            onSuccess();
        } catch {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setSelectedJob(null);
        setJobQuery("");
        setJobOptions([]);
        setExistingLines([]);
        setDeletedIds([]);
        setNewLines([emptyLine()]);
    };

    useEffect(() => {
        onStatusChange({ isValid, isSubmitting: submitting });
    }, [isValid, submitting, onStatusChange]);

    useImperativeHandle(ref, () => ({
        submit: () => { void handleSubmit(); },
        reset:  handleReset,
    }));

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
                                    {newLines.map((line, idx) => (
                                        <tr key={line._key} className="hover:bg-[var(--cl-surface-2)]/30">
                                            <td className={`${tdClass} pl-3 text-xs text-[var(--cl-text-muted)]`}>{idx + 1}</td>
                                            <td className={tdClass}>
                                                <Select
                                                    value={line.brand_id ? String(line.brand_id) : ""}
                                                    onValueChange={v => updateNewLine(idx, { brand_id: Number(v), part_code: "", part_id: null, part_name: "" })}
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
                                                    brandId={line.brand_id}
                                                    partCode={line.part_code}
                                                    partId={line.part_id}
                                                    partName={line.part_name}
                                                    selectedBrandId={line.brand_id}
                                                    brandName={brands.find(b => b.id === line.brand_id)?.name}
                                                    onChange={code => {
                                                        const patch: Partial<NewLine> = { part_code: code };
                                                        if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                        updateNewLine(idx, patch);
                                                    }}
                                                    onClear={() => updateNewLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                    onSelect={part => updateNewLine(idx, {
                                                        part_id:   part.id,
                                                        part_code: part.part_code,
                                                        part_name: part.part_name,
                                                        uom:       part.uom,
                                                        brand_id:  part.brand_id,
                                                    })}
                                                />
                                            </td>
                                            <td className={`${tdClass} px-2 text-sm text-[var(--cl-text-muted)]`}>{line.part_name}</td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={`${inputCls} text-right ${line.quantity <= 0 ? "border-red-500" : ""}`}
                                                    min={0.01}
                                                    step="0.01"
                                                    type="number"
                                                    value={line.quantity}
                                                    onChange={e => updateNewLine(idx, { quantity: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>
                                            <td className={tdClass}>
                                                <Input
                                                    className={inputCls}
                                                    placeholder="Remarks…"
                                                    value={line.remarks}
                                                    onChange={e => updateNewLine(idx, { remarks: e.target.value })}
                                                />
                                            </td>
                                            <td className={`${tdClass} px-1`}>
                                                <div className="flex items-center justify-start gap-0.5">
                                                    <LineAddDeleteActions
                                                        onAdd={() => insertNewLine(idx)}
                                                        onDelete={() => removeNewLine(idx)}
                                                        disableDelete={false}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="flex items-center gap-4 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40 px-4 py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-black uppercase tracking-widest text-[var(--cl-text-muted)]">New Lines</span>
                            <span className="font-mono font-semibold text-[var(--cl-text)]">{newLines.filter(l => l.part_id).length}</span>
                        </div>
                        {deletedIds.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="font-black uppercase tracking-widest text-red-500">Removed</span>
                                <span className="font-mono font-semibold text-red-500">{deletedIds.length}</span>
                            </div>
                        )}
                        {submitting && <Loader2 className="ml-auto h-4 w-4 animate-spin text-[var(--cl-accent)]" />}
                    </div>
                </>
            )}
        </motion.div>
    );
});

NewPartUsedForm.displayName = "NewPartUsedForm";
