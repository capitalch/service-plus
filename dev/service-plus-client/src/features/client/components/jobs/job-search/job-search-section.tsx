import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    ClipboardList, Eye, FileDown, Paperclip, RefreshCw, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema, selectAvailableDivisions } from "@/store/context-slice";
import type { JobLookupRow, JobSearchRow } from "@/features/client/types/job";
import { STATUS_COLORS } from "../job-pipeline/status-transitions";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { JobPdfModal } from "./job-pdf-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };
type ClosedFilter = null | boolean;
type JobFilter =
    | { group: "closed"; value: ClosedFilter }
    | { group: "status"; id: number | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

// ─── Component ────────────────────────────────────────────────────────────────

export const JobSearchSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const divisions    = useAppSelector(selectAvailableDivisions);
    const branchId     = globalBranch?.id ?? null;

    const [search,      setSearch]      = useState("");
    const [searchQ,     setSearchQ]     = useState("");
    const [filter,      setFilter]      = useState<JobFilter>({ group: "closed", value: null });
    const [jobStatuses, setJobStatuses] = useState<JobLookupRow[]>([]);
    const [page,           setPage]           = useState(1);
    const [rows,           setRows]           = useState<JobSearchRow[]>([]);
    const [total,          setTotal]          = useState(0);
    const [loading,        setLoading]        = useState(false);

    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [pdfJobId,  setPdfJobId]  = useState<number | null>(null);

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            const floor = Math.round(window.innerHeight * 0.55);
            setMaxHeight(Math.max(floor, window.innerHeight - rect.top - 60));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length]);

    const loadData = useCallback(async (
        bId: number, q: string, pg: number, f: JobFilter,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const show_closed = f.group === "closed" ? f.value : null;
            const status_id   = f.group === "status"  ? f.id   : null;
            const commonArgs  = { branch_id: bId, search: q, show_closed, status_id };
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
        if (!dbName || !schema) return;
        void apolloClient.query<GenericQueryData<JobLookupRow>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }),
            },
        }).then(res => setJobStatuses(res.data?.genericQuery ?? []));
    }, [dbName, schema]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!branchId) return;
        void loadData(Number(branchId), searchQ, page, filter);
    }, [branchId, searchQ, page, filter, loadData]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const handleClosedFilterChange = (value: ClosedFilter) => {
        setFilter({ group: "closed", value }); setPage(1);
    };

    const handleStatusFilterChange = (id: number | null) => {
        setFilter({ group: "status", id }); setPage(1);
    };

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
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto md:overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Control bar (header + toolbar merged) ──────────────────────── */}
            {filter.group === "status" ? (
                <div className="overflow-x-auto border-b border-(--cl-border) bg-(--cl-surface) lg:overflow-x-visible">
                    <div className="flex min-w-max items-center gap-2 px-3 py-1.5 lg:min-w-0 lg:flex-wrap">
                        <Button
                            className="h-8 gap-1.5 px-3 font-semibold text-(--cl-accent) border border-(--cl-accent) hover:bg-(--cl-accent) hover:text-white transition-colors shrink-0"
                            size="sm"
                            variant="outline"
                            onClick={() => { setFilter({ group: "closed", value: null }); setPage(1); }}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <div className="h-4 w-px shrink-0 bg-(--cl-border)" />
                        <div className="relative w-56 shrink-0">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                            <Input
                                className="h-8 border-(--cl-border) bg-(--cl-surface) pl-7 pr-7 text-xs"
                                placeholder="Search…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                            {search && (
                                <button
                                    className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                        <button
                            disabled={loading}
                            className={`shrink-0 px-3 h-7 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer border
                                ${filter.id === null
                                    ? "bg-(--cl-accent) text-white border-(--cl-accent)"
                                    : "bg-(--cl-surface) text-(--cl-text-muted) border-(--cl-border) hover:bg-(--cl-hover) hover:text-(--cl-text)"
                                }`}
                            onClick={() => handleStatusFilterChange(null)}
                        >
                            All Statuses
                        </button>
                        {jobStatuses.filter(s => s.is_active).map(s => {
                            const colorParts = (STATUS_COLORS[s.code] ?? "bg-slate-400 text-white").trim().split(/\s+/).filter(Boolean);
                            const colorCls   = colorParts.filter(c => !c.startsWith("hover:")).join(" ");
                            const isActive   = filter.id === s.id;
                            return (
                                <button
                                    key={s.id}
                                    disabled={loading}
                                    className={`shrink-0 px-3 h-7 rounded-full text-xs font-semibold transition-all disabled:opacity-30 cursor-pointer ${colorCls} ${isActive ? "opacity-100 ring-2 ring-offset-1 ring-white/70 shadow-md" : "opacity-50 hover:opacity-80"}`}
                                    onClick={() => handleStatusFilterChange(s.id)}
                                >
                                    {s.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Main page: icon + title + count + search + filter tabs + refresh — all in one bar */
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-(--cl-border) bg-(--cl-surface) px-3 py-1.5">
                    <div className="flex shrink-0 items-center gap-1.5">
                        <ClipboardList className="h-4 w-4 shrink-0 text-(--cl-accent)" />
                        <span className="text-sm font-bold text-(--cl-text)">Job Search</span>
                        <span className="text-xs text-(--cl-text-muted)">{loading ? "…" : `(${total})`}</span>
                    </div>
                    <div className="relative w-48 shrink-0 md:w-64">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                        <Input
                            className="h-8 border-(--cl-border) bg-(--cl-surface) pl-8 text-xs"
                            placeholder="Job no, customer, mobile, product, brand, model or serial…"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                        />
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
                    <div className="flex items-center rounded border border-(--cl-border) overflow-hidden shrink-0">
                        {filterOptions.map(opt => (
                            <button
                                key={String(opt.value)}
                                disabled={loading}
                                className={`px-3 h-8 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer
                                    ${filter.value === opt.value
                                        ? "bg-(--cl-accent) text-white"
                                        : "bg-(--cl-surface) text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)"
                                    }`}
                                onClick={() => handleClosedFilterChange(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                        <div className="w-px self-stretch bg-(--cl-border)" />
                        <button
                            disabled={loading}
                            className="flex items-center gap-1 px-3 h-8 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer bg-(--cl-surface) text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent)"
                            onClick={() => { setFilter({ group: "status", id: null }); setPage(1); }}
                        >
                            Status
                            <ChevronRightIcon className="h-3 w-3" />
                        </button>
                    </div>
                    <Button
                        className="ml-auto h-8 px-2.5 text-xs shrink-0"
                        disabled={loading || !branchId}
                        size="sm"
                        variant="outline"
                        onClick={() => { if (branchId) void loadData(Number(branchId), searchQ, page, filter); }}
                    >
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                        Refresh
                    </Button>
                </div>
            )}

            {/* ── Data Grid ──────────────────────────────────────────────────── */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                <div
                    ref={scrollWrapperRef}
                    className="flex-1 overflow-x-auto overflow-y-auto"
                    style={{ maxHeight: maxHeight > 0 ? maxHeight : undefined }}
                >
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-(--cl-surface-2)">
                                    {["#", "Date", "Job No", "Customer", "Mobile", "Device Details", "Job Type", "Status", "Amount", "Actions"].map(h => (
                                        <th key={h} className={`${thClass} ${h === "Actions" ? "hidden md:table-cell" : ""}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
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
                                    <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2) hidden md:table-cell`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                {rows.map((job, idx) => (
                                    <tr
                                        key={job.id}
                                        className={`group cursor-pointer transition-colors hover:bg-(--cl-accent)/5 ${job.batch_no ? "border-l-2 border-l-violet-400 dark:border-l-violet-500" : ""}`}
                                        onClick={() => setViewJobId(job.id)}
                                    >
                                        <td className={`${tdClass} text-(--cl-text-muted)`}>
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className={`${tdClass} whitespace-nowrap`}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{job.job_date}</span>
                                                {job.division_id && (() => {
                                                    const dv = divisions.find(d => d.id === job.division_id);
                                                    return dv ? (
                                                        <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded px-1 py-0.5 w-fit">
                                                            {dv.code}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="font-mono font-medium text-(--cl-accent)">
                                                    {job.job_no}
                                                    {job.is_closed && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                    )}
                                                </div>
                                                {job.alternate_job_no && (
                                                    <span className="text-[10px] text-(--cl-text-muted)">Alt: {job.alternate_job_no}</span>
                                                )}
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
                                            {(() => {
                                                const cp = (STATUS_COLORS[job.job_status_code ?? ""] ?? "bg-slate-400 text-white").trim().split(/\s+/).filter(Boolean);
                                                const cls = cp.filter(c => !c.startsWith("hover:")).join(" ");
                                                return (
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                                                        {job.job_status_name}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className={`${tdClass} text-right`}>
                                            {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                        </td>
                                        <td
                                            className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2) hidden md:table-cell`}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                {/* View details */}
                                                <Button
                                                    className="h-8 w-8 p-0 text-(--cl-text-muted) hover:text-(--cl-accent) hover:bg-(--cl-accent)/10"
                                                    size="icon"
                                                    title="View job details"
                                                    variant="ghost"
                                                    onClick={() => setViewJobId(job.id)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {/* PDF / Print */}
                                                <Button
                                                    className="h-8 w-8 p-0 text-(--cl-text-muted) hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                    size="icon"
                                                    title="Print / Save as PDF"
                                                    variant="ghost"
                                                    onClick={() => setPdfJobId(job.id)}
                                                >
                                                    <FileDown className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                    <span className="text-xs text-(--cl-text-muted)">
                        {total === 0 ? "No jobs" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`}
                        {filter.group === "closed" && filter.value !== null && (
                            <span className="ml-2 font-semibold text-(--cl-accent)">
                                ({closedFilterLabel[String(filter.value)]})
                            </span>
                        )}
                        {filter.group === "status" && filter.id !== null && (
                            <span className="ml-2 font-semibold text-(--cl-accent)">
                                · {jobStatuses.find(s => s.id === filter.id)?.name ?? ""}
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="First page"    onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" variant="ghost" title="Previous page" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Next page"     onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" variant="ghost" title="Last page"     onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Attach Files Dialog */}
            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                mode="attach"
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                onFilesChanged={() => {
                    if (branchId) void loadData(Number(branchId), searchQ, page, filter);
                }}
            />

            {/* Job Details Modal */}
            {viewJobId !== null && (
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => setViewJobId(null)}
                />
            )}

            {/* PDF / Print Modal */}
            {pdfJobId !== null && (
                <JobPdfModal
                    jobId={pdfJobId}
                    onClose={() => setPdfJobId(null)}
                />
            )}
        </motion.div>
    );
};
