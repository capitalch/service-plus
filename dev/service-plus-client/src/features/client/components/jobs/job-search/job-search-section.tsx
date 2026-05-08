import { useCallback, useEffect, useRef, useState } from "react";
import {ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    ClipboardList, Loader2, MoreHorizontal, Paperclip, RefreshCw, Search, Trash2, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { JobSearchRow } from "@/features/client/types/job";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { JobDetailView } from "./job-detail-view";
import { TransactionDetailView } from "./transaction-detail-view";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };
type ClosedFilter = null | boolean; // null = All, false = Open, true = Closed
type View = "list" | "job-detail" | "transaction-detail";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const JobSearchSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    // ── List state (preserved across drill-down navigation) ──────────────────
    const [search,        setSearch]        = useState("");
    const [searchQ,       setSearchQ]       = useState("");
    const [closedFilter,  setClosedFilter]  = useState<ClosedFilter>(null);
    const [page,          setPage]          = useState(1);
    const [rows,          setRows]          = useState<JobSearchRow[]>([]);
    const [total,         setTotal]         = useState(0);
    const [loading,       setLoading]       = useState(false);
    const [deleteId,      setDeleteId]      = useState<number | null>(null);
    const [deleting,      setDeleting]      = useState(false);
    const [attachJobId,   setAttachJobId]   = useState<number | null>(null);
    const [attachJobNo,   setAttachJobNo]   = useState<string>("");

    // ── Drill-down state ─────────────────────────────────────────────────────
    const [view,           setView]           = useState<View>("list");
    const [selectedJobId,  setSelectedJobId]  = useState<number | null>(null);
    const [selectedJobNo,  setSelectedJobNo]  = useState<string>("");
    const [selectedTranId, setSelectedTranId] = useState<number | null>(null);

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [maxHeight,     setMaxHeight]     = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 60));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length]);

    const loadData = useCallback(async (
        bId: number, q: string, pg: number, closed: ClosedFilter,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, search: q, show_closed: closed };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobSearchRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_SEARCH_PAGED,
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
                            sqlId: SQL_MAP.GET_JOB_SEARCH_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId) return;
        void loadData(Number(branchId), searchQ, page, closedFilter);
    }, [branchId, searchQ, page, closedFilter, loadData]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleClosedFilterChange = (value: ClosedFilter) => {
        setClosedFilter(value); setPage(1);
    };

    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: encodeObj({ tableName: "job", deletedIds: [deleteId] }) },
            });
            toast.success(MESSAGES.SUCCESS_JOB_DELETED);
            setDeleteId(null);
            if (branchId) void loadData(Number(branchId), searchQ, page, closedFilter);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    // ── Drill-down handlers ───────────────────────────────────────────────────

    const handleSelectJob = (job: JobSearchRow) => {
        setSelectedJobId(job.id);
        setSelectedJobNo(job.job_no);
        setView("job-detail");
    };

    const handleSelectTransaction = (tranId: number) => {
        setSelectedTranId(tranId);
        setView("transaction-detail");
    };

    const handleBackToList = () => {
        setView("list");
        setSelectedJobId(null);
        setSelectedJobNo("");
    };

    const handleBackToJobDetail = () => {
        setView("job-detail");
        setSelectedTranId(null);
    };

    // ── Drill-down routing ────────────────────────────────────────────────────

    if (view === "job-detail" && selectedJobId) {
        return (
            <JobDetailView
                jobId={selectedJobId}
                onBack={handleBackToList}
                onViewTransaction={handleSelectTransaction}
            />
        );
    }

    if (view === "transaction-detail" && selectedTranId && selectedJobId) {
        return (
            <TransactionDetailView
                tranId={selectedTranId}
                jobNo={selectedJobNo}
                onBack={handleBackToJobDetail}
            />
        );
    }

    // ── List view ─────────────────────────────────────────────────────────────

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const closedFilterLabel: Record<string, string> = {
        "null":  "All",
        "false": "Open",
        "true":  "Closed",
    };

    const filterOptions: { value: ClosedFilter; label: string }[] = [
        { value: null,  label: "All"    },
        { value: false, label: "Open"   },
        { value: true,  label: "Closed" },
    ];

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-1">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-[var(--cl-text)] truncate">
                            Job Search
                        </h1>
                        <span className="text-xs text-[var(--cl-text-muted)] whitespace-nowrap">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Toolbar ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                        placeholder="Job no, customer, mobile, product, brand, model or serial…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                </div>

                {/* Closed filter toggle */}
                <div className="flex items-center rounded border border-[var(--cl-border)] overflow-hidden">
                    {filterOptions.map(opt => (
                        <button
                            key={String(opt.value)}
                            disabled={loading}
                            onClick={() => handleClosedFilterChange(opt.value)}
                            className={`px-3 h-8 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer
                                ${closedFilter === opt.value
                                    ? "bg-[var(--cl-accent)] text-white"
                                    : "bg-[var(--cl-surface)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="ml-auto">
                    <Button
                        className="h-8 px-2.5 text-xs"
                        disabled={loading || !branchId}
                        size="sm"
                        variant="outline"
                        onClick={() => { if (branchId) void loadData(Number(branchId), searchQ, page, closedFilter); }}
                    >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* ── Data Grid ──────────────────────────────────────────────────── */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div
                    ref={scrollWrapperRef}
                    className="flex-1 overflow-x-auto overflow-y-auto"
                    style={{ maxHeight: maxHeight > 0 ? maxHeight : undefined }}
                >
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-[var(--cl-surface-2)]">
                                    {["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Amount", "Actions"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No jobs found for the selected filters.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mobile</th>
                                    <th className={`${thClass} w-[10rem]`}>Device Details</th>
                                    <th className={thClass}>Job Type</th>
                                    <th className={thClass}>Status</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((job, idx) => (
                                    <tr
                                        key={job.id}
                                        className={`group cursor-pointer transition-colors hover:bg-[var(--cl-accent)]/5 ${job.batch_no ? "border-l-2 border-l-violet-400 dark:border-l-violet-500" : ""}`}
                                        onClick={() => handleSelectJob(job)}
                                    >
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`}>
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className={tdClass}>{job.job_date}</td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-mono font-medium text-[var(--cl-accent)]">
                                                    {job.job_no}
                                                    {job.is_closed && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                    )}
                                                </div>
                                                {job.batch_no != null && (
                                                    <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 w-fit bg-violet-50 dark:bg-violet-950/40 rounded px-1 py-0.5">Batch #{job.batch_no}</span>
                                                )}
                                                {job.file_count > 0 && (
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 w-fit border-0 transition-colors"
                                                        onClick={e => { e.stopPropagation(); setAttachJobId(job.id); setAttachJobNo(job.job_no); }}
                                                    >
                                                        <Paperclip className="h-2.5 w-2.5" />
                                                        <span>{job.file_count} File{job.file_count !== 1 ? "s" : ""}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className={tdClass}>{job.customer_name ?? "—"}</td>
                                        <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                                        <td className={`${tdClass} text-xs`}>{job.device_details || "—"}</td>
                                        <td className={tdClass}>{job.job_type_name}</td>
                                        <td className={tdClass}>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                                                {job.job_status_name}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-right`}>
                                            {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                        </td>
                                        <td
                                            className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button className="h-8 w-8 p-0 hover:bg-[var(--cl-accent)]/15" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Open menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[140px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600 font-semibold"
                                                            onClick={() => setDeleteId(job.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span>Delete Job</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                    <span className="text-xs text-[var(--cl-text-muted)]">
                        {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`}
                        {closedFilter !== null && (
                            <span className="ml-2 font-semibold text-[var(--cl-accent)]">
                                ({closedFilterLabel[String(closedFilter)]})
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First page" onClick={() => setPage(1)}>
                            <ChevronsLeftIcon className="h-4 w-4" />
                        </Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous page" onClick={() => setPage(p => p - 1)}>
                            <ChevronLeftIcon className="h-4 w-4" />
                        </Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next page" onClick={() => setPage(p => p + 1)}>
                            <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last page" onClick={() => setPage(totalPages)}>
                            <ChevronsRightIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete Confirm Dialog */}
            <Dialog open={deleteId !== null} onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                    <DialogHeader>
                        <DialogTitle>Delete Job</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-[var(--cl-text-muted)]">
                        This will permanently delete the job and all associated records. This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button disabled={deleting} variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                            {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Attach Files Dialog */}
            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                mode="attach"
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                onFilesChanged={() => {
                    if (branchId) void loadData(Number(branchId), searchQ, page, closedFilter);
                }}
            />
        </motion.div>
    );
};
