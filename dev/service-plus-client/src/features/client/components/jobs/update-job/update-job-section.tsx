import { useCallback, useEffect, useRef, useState } from "react";
import {
    Briefcase,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Loader2, Lock, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobLookupRow, TechnicianRow } from "@/features/client/types/job";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { TRANSITIONS, STATUS_FLAGS, STATUS_COLORS } from "./status-transitions";
import type { Transition } from "./status-transitions";
import { StatusTransitionModal } from "./status-transition-modal";
import type { TransitionPayload } from "./status-transition-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

export type OpenJobRow = {
    id:                  number;
    job_no:              string;
    job_date:            string;
    job_status_id:       number;
    job_status_code:     string;
    job_status_name:     string;
    is_closed:           boolean;
    is_final:            boolean;
    amount:              number | null;
    estimate_amount:     number | null;
    diagnosis:           string | null;
    last_transaction_id: number | null;
    batch_no:            number | null;
    customer_name:       string;
    mobile:              string;
    job_type_name:       string;
    job_type_code:       string;
    technician_name:     string | null;
    technician_id:       number | null;
    device_details:      string | null;
    file_count:          number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

const NO_ACTION_CODES = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);

const JOB_TYPE_ROW_COLORS: Record<string, string> = {
    MAKE_READY:     "bg-lime-50   dark:bg-lime-950/20",
    ESTIMATE:       "bg-blue-50   dark:bg-blue-950/20",
    UNDER_WARRANTY: "bg-red-50    dark:bg-red-950/20",
    INSTALLATION:   "bg-yellow-50 dark:bg-yellow-950/20",
    DEMO:           "bg-yellow-50 dark:bg-yellow-950/20",
    MAINTENANCE:    "bg-gray-50   dark:bg-gray-800/20",
    INSPECTION:     "bg-gray-50   dark:bg-gray-800/20",
    AMC_SERVICE:    "bg-gray-50   dark:bg-gray-800/20",
    UPGRADE:        "bg-gray-50   dark:bg-gray-800/20",
    REFURBISH:      "bg-gray-50   dark:bg-gray-800/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const UpdateJobSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const branchId      = currentBranch?.id ?? null;

    // ── List state ──────────────────────────────────────────────────────────
    const [filterStatusId, setFilterStatusId] = useState<number | null>(null);
    const [page,           setPage]           = useState(1);
    const [rows,           setRows]           = useState<OpenJobRow[]>([]);
    const [total,          setTotal]          = useState(0);
    const [loading,        setLoading]        = useState(false);
    const [statusCounts,   setStatusCounts]   = useState<Record<number, number>>({});

    // ── Metadata ────────────────────────────────────────────────────────────
    const [jobStatuses, setJobStatuses] = useState<JobLookupRow[]>([]);
    const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
    const [metaLoaded,  setMetaLoaded]  = useState(false);

    // ── Transition modal state ──────────────────────────────────────────────
    const [pendingTran, setPendingTran] = useState<{ job: OpenJobRow; transition: Transition } | null>(null);
    const [submitting,  setSubmitting]  = useState(false);

    // ── File attach state ───────────────────────────────────────────────────
    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    const scrollRef = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length, jobStatuses.length]);

    // Load statuses + technicians once
    useEffect(() => {
        if (!dbName || !schema || !branchId || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<JobLookupRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
            }),
            apolloClient.query<GenericQueryData<TechnicianRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_TECHNICIANS, sqlArgs: { branch_id: branchId } }) },
            }),
        ]).then(([statusRes, techRes]) => {
            setJobStatuses(statusRes.data?.genericQuery ?? []);
            setTechnicians(techRes.data?.genericQuery ?? []);
            setMetaLoaded(true);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED));
    }, [dbName, schema, branchId, metaLoaded]);

    const loadData = useCallback(async (bid: number, statusId: number | null, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const sqlArgs = { branch_id: bid, status_id: statusId };
            const [dataRes, countRes, statusCountsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<OpenJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_UPDATE_JOBS_PAGED,
                            sqlArgs: { ...sqlArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_UPDATE_JOBS_COUNT,
                            sqlArgs,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ job_status_id: number; count: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_UPDATE_JOBS_STATUS_COUNTS,
                            sqlArgs: { branch_id: bid },
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
            const counts: Record<number, number> = {};
            for (const r of statusCountsRes.data?.genericQuery ?? []) {
                counts[r.job_status_id] = Number(r.count);
            }
            setStatusCounts(counts);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId) return;
        void loadData(branchId, filterStatusId, page);
    }, [branchId, filterStatusId, page, loadData]);

    // ── Transition handlers ─────────────────────────────────────────────────

    function handleTransitionClick(job: OpenJobRow, transition: Transition) {
        if (transition.fields === "none") {
            void handleSubmitTransition(job, transition, {
                targetStatusId:  transition.targetId,
                technician_id:   null,
                amount:          null,
                estimate_amount: null,
                remarks:         "",
                is_final:        false,
                is_closed:       false,
            });
        } else {
            setPendingTran({ job, transition });
        }
    }

    async function handleSubmitTransition(
        job:        OpenJobRow,
        transition: Transition,
        payload:    TransitionPayload,
    ) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const flags = STATUS_FLAGS[transition.targetId];
            const xData = {
                id:              job.id,
                job_status_id:   transition.targetId,
                technician_id:   payload.technician_id,
                amount:          transition.fields === "RA" ? payload.amount          : job.amount,
                estimate_amount: transition.fields === "RE" ? payload.estimate_amount : job.estimate_amount,
                is_final:        flags?.is_final  ?? false,
                is_closed:       flags?.is_closed ?? false,
            };
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.updateJob,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        job_id:               job.id,
                        last_transaction_id:  job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                        transaction_notes:    payload.remarks || "",
                        xData,
                    }),
                },
            });
            toast.success(`Job ${job.job_no} → ${transition.targetName}`);
            setPendingTran(null);
            if (branchId) void loadData(branchId, filterStatusId, page);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Update Job</h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Status filter strip */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/30">

                {/* All button — readonly indicator */}
                <span className="relative">
                    <button
                        className={`cursor-pointer rounded font-bold transition-all duration-150 ${
                            filterStatusId === null
                                ? "h-8 px-4 text-sm text-white bg-[var(--cl-accent)] shadow-lg border-2 border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                                : "h-7 px-3 text-sm font-semibold text-[var(--cl-text-muted)] bg-[var(--cl-surface)] border border-[var(--cl-border)] hover:bg-[var(--cl-hover)]"
                        }`}
                        onClick={() => { setFilterStatusId(null); setPage(1); }}
                    >
                        All ({total})
                    </button>
                    <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-600 text-[9px] font-black text-white shadow">
                        R
                    </span>
                </span>

                <div className="h-6 w-px shrink-0 bg-[var(--cl-border)]" />

                {/* Working / actionable statuses */}
                {jobStatuses.filter(s => !NO_ACTION_CODES.has(s.code) && !STATUS_FLAGS[s.id]?.is_final).map(s => {
                    const colorClass = STATUS_COLORS[s.code] ?? "bg-slate-400 hover:bg-slate-500 text-white";
                    const isActive   = filterStatusId === s.id;
                    const cnt        = statusCounts[s.id] ?? 0;
                    return (
                        <button
                            key={s.id}
                            className={`cursor-pointer rounded font-bold transition-all duration-150 ${colorClass} ${
                                isActive
                                    ? "h-8 px-4 text-sm shadow-lg border-2 border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                                    : "h-7 px-4 text-sm font-semibold opacity-80 hover:opacity-100"
                            }`}
                            onClick={() => { setFilterStatusId(s.id); setPage(1); }}
                        >
                            {s.name}
                            <span className="ml-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                {cnt}
                            </span>
                        </button>
                    );
                })}

                {/* Divider + terminal statuses (CANCELLED, DISPOSED) */}
                {jobStatuses.some(s => !NO_ACTION_CODES.has(s.code) && STATUS_FLAGS[s.id]?.is_final) && (
                    <>
                        <div className="h-6 w-px shrink-0 bg-[var(--cl-border)]" />
                        {jobStatuses.filter(s => !NO_ACTION_CODES.has(s.code) && STATUS_FLAGS[s.id]?.is_final).map(s => {
                            const colorClass = STATUS_COLORS[s.code] ?? "bg-slate-400 hover:bg-slate-500 text-white";
                            const isActive   = filterStatusId === s.id;
                            const cnt        = statusCounts[s.id] ?? 0;
                            return (
                                <button
                                    key={s.id}
                                    className={`cursor-pointer rounded font-bold transition-all duration-150 ${colorClass} ${
                                        isActive
                                            ? "h-8 px-4 text-sm shadow-lg border-2 border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                                            : "h-7 px-4 text-sm font-semibold opacity-70 hover:opacity-100"
                                    }`}
                                    onClick={() => { setFilterStatusId(s.id); setPage(1); }}
                                >
                                    {s.name}
                                    <span className="ml-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                        {cnt}
                                    </span>
                                </button>
                            );
                        })}
                    </>
                )}

                {/* Divider + view-only statuses with "R" badge */}
                {jobStatuses.some(s => NO_ACTION_CODES.has(s.code)) && (
                    <>
                        <div className="h-6 w-px shrink-0 bg-[var(--cl-border)]" />
                        {jobStatuses.filter(s => NO_ACTION_CODES.has(s.code)).map(s => {
                            const colorClass = STATUS_COLORS[s.code] ?? "bg-slate-400 hover:bg-slate-500 text-white";
                            const isActive   = filterStatusId === s.id;
                            const cnt        = statusCounts[s.id] ?? 0;
                            return (
                                <span key={s.id} className="relative">
                                    <button
                                        className={`cursor-pointer rounded font-bold transition-all duration-150 ${colorClass} ${
                                            isActive
                                                ? "h-8 px-4 text-sm shadow-lg border-2 border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                                                : "h-7 px-4 text-sm font-semibold opacity-80 hover:opacity-100"
                                        }`}
                                        onClick={() => { setFilterStatusId(s.id); setPage(1); }}
                                    >
                                        {s.name}
                                        <span className="ml-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                            {cnt}
                                        </span>
                                    </button>
                                    <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-600 text-[9px] font-black text-white shadow">
                                        R
                                    </span>
                                </span>
                            );
                        })}
                    </>
                )}

            </div>

            {/* Table */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm my-3">
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                    {loading ? (
                        <div className="flex h-32 items-center justify-center gap-2 text-sm text-[var(--cl-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No jobs found for the selected status.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Type</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mobile</th>
                                    <th className={thClass}>Device</th>
                                    <th className={thClass}>Status</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => {
                                    const badgeColor = STATUS_COLORS[row.job_status_code]?.split(" ")[0] ?? "bg-slate-400";
                                    const transitions = TRANSITIONS[row.job_status_id] ?? [];
                                    const rowBg = JOB_TYPE_ROW_COLORS[row.job_type_code] ?? "";
                                    const isReadOnly = filterStatusId === null || NO_ACTION_CODES.has(row.job_status_code);
                                    return (
                                        <motion.tr
                                            key={row.id}
                                            animate={{ opacity: 1 }}
                                            className={`group transition-colors hover:bg-[var(--cl-accent)]/10 ${rowBg}`}
                                            initial={{ opacity: 0 }}
                                            transition={{ delay: idx * 0.015, duration: 0.15 }}
                                        >
                                            <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td className={tdClass}>{row.job_date}</td>
                                            <td className={tdClass}>
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="font-mono font-semibold text-[var(--cl-accent)]">#{row.job_no}</span>
                                                    {row.is_closed && (
                                                        <span className="rounded px-1 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40">CLOSED</span>
                                                    )}
                                                    {row.batch_no && (
                                                        <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">Batch #{row.batch_no}</span>
                                                    )}
                                                    {row.file_count > 0 && (
                                                        <button
                                                            className="cursor-pointer rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                                                            onClick={e => { e.stopPropagation(); setAttachJobId(row.id); setAttachJobNo(row.job_no); }}
                                                        >
                                                            {row.file_count} file{row.file_count !== 1 ? "s" : ""}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`${tdClass} text-xs`}>{row.job_type_name}</td>
                                            <td className={tdClass}>{row.customer_name}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                            <td className={`${tdClass} max-w-[180px] truncate text-xs`}>{row.device_details ?? "—"}</td>
                                            <td className={tdClass}>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${badgeColor}`}>
                                                    {row.job_status_name}
                                                </span>
                                            </td>
                                            <td className={`${tdClass} text-right tabular-nums`}>
                                                {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                            </td>
                                            <td className={`${tdClass} sticky right-0 z-10 ${rowBg || "bg-[var(--cl-surface)]"} group-hover:bg-[var(--cl-accent)]/10`} onClick={e => e.stopPropagation()}>
                                                {isReadOnly ? (
                                                    <span className="flex h-7 w-7 items-center justify-center">
                                                        <Lock className="h-3.5 w-3.5 text-[var(--cl-text-muted)] opacity-40" />
                                                    </span>
                                                ) : (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                            disabled={submitting}
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-[170px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                        {transitions.length === 0 ? (
                                                            <DropdownMenuItem disabled className="text-xs text-[var(--cl-text-muted)]">
                                                                No transitions available
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            transitions.map(t => (
                                                                <DropdownMenuItem
                                                                    key={`${t.targetId}-${t.targetName}`}
                                                                    className="gap-2 text-xs"
                                                                    onClick={() => handleTransitionClick(row, t)}
                                                                >
                                                                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[t.targetCode]?.split(" ")[0] ?? "bg-slate-400"}`} />
                                                                    → {t.targetName}
                                                                </DropdownMenuItem>
                                                            ))
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                    <span className="text-xs text-[var(--cl-text-muted)]">
                        {total === 0
                            ? "No jobs"
                            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Transition modal */}
            {pendingTran && (
                <StatusTransitionModal
                    job={pendingTran.job}
                    transition={pendingTran.transition}
                    technicians={technicians}
                    onClose={() => setPendingTran(null)}
                    onSubmit={payload => handleSubmitTransition(pendingTran.job, pendingTran.transition, payload)}
                />
            )}

            {/* File attach dialog */}
            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                mode="attach"
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                onFilesChanged={() => { if (branchId) void loadData(branchId, filterStatusId, page); }}
            />
        </motion.div>
    );
};
