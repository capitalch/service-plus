import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Pencil, RefreshCw, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { partUsedFormSchema, type PartUsedFormValues, type ConsumptionRow, getPartUsedDefaultValues } from "./part-used-schema";
import type { JobLookupForReceiptType } from "@/features/client/types/receipt";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";

import { NewPartUsedForm } from "./new-part-used-form";
import { EditPartUsedDialog } from "./edit-part-used-dialog";
import { DeletePartUsedDialog } from "./delete-part-used-dialog";
import { JobDetailsModal } from "@/features/client/components/jobs/job-pipeline/job-details-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

// ─── Component ────────────────────────────────────────────────────────────────

export const PartUsedSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const form = useForm<PartUsedFormValues>({
        defaultValues: getPartUsedDefaultValues(),
        mode: "onChange",
        resolver: zodResolver(partUsedFormSchema) as any,
    });

    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);

    // View filters
    const [search,  setSearch]  = useState("");
    const [searchQ, setSearchQ] = useState("");

    // View data
    const [rows,    setRows]    = useState<ConsumptionRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Delete / Edit / View
    const [deleteRow, setDeleteRow] = useState<ConsumptionRow | null>(null);
    const [editRow,   setEditRow]   = useState<ConsumptionRow | null>(null);
    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [markupPct, setMarkupPct] = useState(0);

    // Form
    const [resetKey,    setResetKey]   = useState(0);
    const [selectedJob, setSelectedJob] = useState<JobLookupForReceiptType | null>(null);

    const formNewLines   = form.watch("newLines");
    const formDeletedIds = form.watch("deletedIds");
    const linesValid     = (formNewLines?.some(l => l.part_id && (l.qty ?? 0) > 0) ?? false)
                        || (formDeletedIds?.length ?? 0) > 0;

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 60));
        }
    }, []);

    useEffect(() => {
        if (mode === "view") {
            const timer = setTimeout(recalc, 100);
            window.addEventListener("resize", recalc);
            return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
        }
    }, [mode, recalc, rows.length]);

    // Load metadata once
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const txnRes = await apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }) },
                });
                setTxnTypes(txnRes.data?.genericQuery ?? []);
            } catch { toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED); }
        };
        void fetchMeta();
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

    // Load view data
    const loadData = useCallback(async (
        branchIdNum: number, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branchIdNum, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<ConsumptionRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch { toast.error(MESSAGES.ERROR_CONSUMPTION_LOAD_FAILED); }
        finally { setLoading(false); }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || mode !== "view") return;
        void loadData(branchId, searchQ, page);
    }, [branchId, searchQ, page, loadData, mode]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleReset = () => {
        form.reset(getPartUsedDefaultValues());
        setSelectedJob(null);
        setResetKey(k => k + 1);
    };

    const executeSave = async (values: PartUsedFormValues) => {
        if (!branchId || !dbName || !schema || !selectedJob) return;

        const consumeTypeId = txnTypes.find(t => t.code === "CONSUMPTION")?.id;
        if (!consumeTypeId) {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
            return;
        }

        const newLines = values.newLines ?? [];
        const deletedIds = values.deletedIds ?? [];
        const validNewLines = newLines.filter(l => l.part_id && l.qty > 0);

        const xData = validNewLines.map(line => ({
            job_id:        values.job_id,
            part_id:       line.part_id,
            qty:           line.qty,
            cost_price:    line.cost_price ?? 0,
            selling_price: line.selling_price ?? 0,
            gst_rate:      line.gst_rate ?? 0,
            hsn_code:      line.hsn_code?.trim() || null,
            remarks:       line.remarks?.trim() || null,
            xDetails: {
                tableName: "stock_transaction",
                fkeyName:  "job_part_used_id",
                xData: {
                    branch_id:                 branchId,
                    part_id:                   line.part_id,
                    qty:                       line.qty,
                    dr_cr:                     "C",
                    transaction_date:          selectedJob.job_date,
                    stock_transaction_type_id: consumeTypeId,
                    remarks:                   line.remarks?.trim() || null,
                },
            },
        }));

        const payload = graphQlUtils.buildGenericUpdateValue({
            tableName:  "job_part_used",
            deletedIds: deletedIds.length > 0 ? deletedIds : undefined,
            xData:      xData,
        });

        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_PART_USED_SAVED);
            handleReset();
        } catch {
            toast.error(MESSAGES.ERROR_PART_USED_SAVE_FAILED);
        }
    };


    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const groupedRows = useMemo(() => {
        let groupIdx = -1;
        let prevJobNo = "";
        return rows.map(row => {
            const isFirstInGroup = row.job_no !== prevJobNo;
            if (isFirstInGroup) { groupIdx++; prevJobNo = row.job_no; }
            return { ...row, isFirstInGroup, groupIdx };
        });
    }, [rows]);

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <RotateCcw className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-(--cl-text)">
                            Part Used (Job)
                            {mode === "new" && <span className="ml-2 text-sm font-medium text-(--cl-text-muted)">— New</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-(--cl-text-muted)">— View</span>}
                        </h1>
                        {mode === "view" && (
                            <span className="text-xs text-(--cl-text-muted)">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1" />

                <ViewModeToggle
                    isEditing={false}
                    mode={mode}
                    onNewClick={() => { handleReset(); setMode("new"); }}
                    onViewClick={() => {
                        handleReset();
                        setMode("view");
                        if (branchId) void loadData(branchId, searchQ, page);
                    }}
                />

                    <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                        <Button
                            className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-(--cl-text)"
                            disabled={form.formState.isSubmitting}
                            variant="ghost"
                            onClick={handleReset}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${form.formState.isSubmitting ? "animate-spin" : ""}`} />
                            Reset
                        </Button>
                        <Button
                            className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                            disabled={!selectedJob || !linesValid || form.formState.isSubmitting}
                            onClick={form.handleSubmit(executeSave)}
                        >
                            {form.formState.isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save
                        </Button>
                    </div>


            </div>

            {mode === "new" ? (
                <div className="flex-1 overflow-y-auto">
                    <FormProvider {...form}>
                        <NewPartUsedForm
                            key={resetKey}
                            onJobSelect={setSelectedJob}
                            form={form}
                        />
                    </FormProvider>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-(--cl-surface-2)/30">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                            <Input className="h-8 border-(--cl-border) bg-white pl-8 text-xs" placeholder="Job no, part code or part name…" value={search} onChange={e => handleSearchChange(e.target.value)} />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1" />
                        <Button className="h-8 px-2.5 text-xs" disabled={loading || !branchId} size="sm" variant="outline" onClick={() => { if (branchId) void loadData(branchId, searchQ, page); }}>
                            <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                        </Button>
                    </div>

                    {/* Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm mx-4">
                        <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead><tr>{["Date","Job","Part Code","Part Name","UOM","Qty","Remarks","Actions"].map(h => <th key={h} className={thClass}>{h}</th>)}</tr></thead>
                                    <tbody>{Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                        ))}</tr>
                                    ))}</tbody>
                                </table>
                            ) : rows.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                                    No consumption records found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Job</th>
                                            {["Part Code","Part Name","UOM"].map(h => <th key={h} className={thClass}>{h}</th>)}
                                            <th className={`${thClass} text-right`}>Qty Used</th>
                                            <th className={thClass}>Remarks</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-(--cl-surface)">
                                        {groupedRows.map((row, idx) => {
                                            const isEven = row.groupIdx % 2 === 0;
                                            const groupBg = isEven ? "bg-(--cl-surface)" : "bg-(--cl-accent)/[0.04]";
                                            const groupBgHover = isEven ? "hover:bg-(--cl-accent)/5" : "hover:bg-(--cl-accent)/10";
                                            const stickyBg = isEven ? "bg-(--cl-surface)" : "bg-[color-mix(in_srgb,var(--cl-accent)_4%,var(--cl-surface))]";
                                            const stickyBgHover = isEven ? "group-hover:bg-(--cl-surface-2)" : "group-hover:bg-(--cl-accent)/10";
                                            const topBorder = row.isFirstInGroup && idx > 0 ? "border-t-2 border-t-(--cl-border)" : "";
                                            const createdDate = row.created_at ? row.created_at.slice(0, 10) : "";
                                            const createdTime = row.created_at ? row.created_at.slice(11, 16) : "";
                                            return (
                                                <tr key={row.id} className={`group transition-colors ${groupBg} ${groupBgHover} ${topBorder}`}>
                                                    {/* Col 1: created_at */}
                                                    <td className={`${tdClass} whitespace-nowrap`}>
                                                        <span className="font-medium text-(--cl-text)">{createdDate}</span>
                                                        {createdTime && <span className="ml-1.5 text-xs text-(--cl-text-muted)">{createdTime}</span>}
                                                    </td>
                                                    {/* Col 2: Job info — shown only on first row of each group */}
                                                    <td className={`${tdClass} min-w-[180px]`}>
                                                        {row.isFirstInGroup ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-mono font-bold text-(--cl-accent)">{row.job_no}</span>
                                                                <span className="text-xs font-medium text-(--cl-text)">{row.job_type_name}</span>
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400">{row.job_status_name}</span>
                                                                    {row.is_final && <span className="text-[10px] font-semibold px-1.5 py-px rounded bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">Final</span>}
                                                                    {row.is_closed && <span className="text-[10px] font-semibold px-1.5 py-px rounded bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Closed</span>}
                                                                </div>
                                                                <span className="text-xs text-(--cl-text-muted)">{row.job_date}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="pl-2 text-(--cl-text-muted)/40 select-none text-xs">╰</span>
                                                        )}
                                                    </td>
                                                    <td className={`${tdClass} font-mono`}>{row.part_code}</td>
                                                    <td className={`${tdClass} font-medium`}>{row.part_name}</td>
                                                    <td className={tdClass}>
                                                        <span className="rounded bg-(--cl-surface-3) px-2 py-0.5 text-xs font-semibold">{row.uom}</span>
                                                    </td>
                                                    <td className={`${tdClass} text-right font-medium`}>{Number(row.qty).toFixed(2)}</td>
                                                    <td className={`${tdClass} text-xs text-(--cl-text-muted) italic`}>{row.remarks || "—"}</td>
                                                    <td className={`${tdClass} sticky right-0 z-10 ${stickyBg} ${stickyBgHover}`}>
                                                        <div className="flex items-center gap-0.5">
                                                            <Button
                                                                className={`h-7 w-7 p-0 text-sky-500 hover:bg-sky-500/10 ${!row.isFirstInGroup ? "invisible" : ""}`}
                                                                size="icon"
                                                                title="View Job"
                                                                variant="ghost"
                                                                onClick={() => setViewJobId(row.job_id)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                className="h-7 w-7 p-0 text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                disabled={row.is_closed || row.is_final}
                                                                size="icon"
                                                                title={row.is_closed || row.is_final ? "Cannot edit — job is closed/finalised" : "Edit"}
                                                                variant="ghost"
                                                                onClick={() => setEditRow(row)}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                disabled={row.is_closed || row.is_final}
                                                                size="icon"
                                                                title={row.is_closed || row.is_final ? "Cannot delete — job is closed/finalised" : "Delete"}
                                                                variant="ghost"
                                                                onClick={() => setDeleteRow(row)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                            <span className="text-xs text-(--cl-text-muted)">
                                {total === 0 ? "No parts used" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} parts used (Page ${page} of ${totalPages})`}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First"    onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                                <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>

                    {/* Job details modal */}
                    {viewJobId !== null && (
                        <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
                    )}

                    <EditPartUsedDialog
                        row={editRow}
                        markupPct={markupPct}
                        onClose={() => setEditRow(null)}
                        onSaved={() => { setEditRow(null); if (branchId) void loadData(branchId, searchQ, page); }}
                    />

                    <DeletePartUsedDialog
                        row={deleteRow}
                        onClose={() => setDeleteRow(null)}
                        onDeleted={() => { setDeleteRow(null); if (branchId) void loadData(branchId, searchQ, page); }}
                    />
                </>
            )}
        </motion.div>
    );
};
