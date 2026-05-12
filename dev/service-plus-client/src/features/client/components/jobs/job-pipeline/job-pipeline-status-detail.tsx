import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft, ArrowRightLeft,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Lock, RefreshCcw, Search, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import type { JobBoardStatusCount, OpenJobRow, TechnicianRow } from "@/features/client/types/job";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { getTransitions, STATUS_COLORS, STATUS_FLAGS } from "./status-transitions";
import type { Transition } from "./status-transitions";
import { StatusTransitionModal } from "./status-transition-modal";
import type { TransitionPayload } from "./status-transition-modal";
import { JobPipelineDetailModal } from "./job-pipeline-detail-modal";
import { UndoTransactionDialog } from "./undo-transaction-dialog";

type Props = {
    status:      JobBoardStatusCount;
    technicians: TechnicianRow[];
    onBack:      () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

const PAGE_SIZE = 50;

const NO_ACTION_CODES  = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);
const NO_UNDO_CODES    = new Set(["DELIVERED_OK", "DELIVERED_NOT_OK"]);

function canUndo(row: OpenJobRow): boolean {
    if (NO_UNDO_CODES.has(row.job_status_code)) return false;
    if (row.transaction_count <= 1) return false;
    return true;
}

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

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

export const JobPipelineStatusDetail = ({ status, technicians, onBack }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const branchId      = currentBranch?.id ?? null;

    const [searchInput, setSearchInput] = useState("");
    const searchQ                       = useDebounce(searchInput, 300);
    const [page,        setPage]        = useState(1);
    const [rows,        setRows]        = useState<OpenJobRow[]>([]);
    const [total,       setTotal]       = useState(0);
    const [loading,     setLoading]     = useState(false);

    const [pendingTran, setPendingTran] = useState<{ job: OpenJobRow; transition: Transition } | null>(null);
    const [submitting,  setSubmitting]  = useState(false);

    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    const [undoPendingJob, setUndoPendingJob] = useState<OpenJobRow | null>(null);

    const [viewJobId, setViewJobId] = useState<number | null>(null);

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
    }, [recalc, rows.length]);

    // Reset page when search changes
    useEffect(() => { setPage(1); }, [searchQ]);

    const loadData = useCallback(async () => {
        if (!dbName || !schema || !branchId) return;
        setLoading(true);
        try {
            const sqlArgs = {
                branch_id: branchId,
                status_id: status.status_id,
                search:    searchQ,
            };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<OpenJobRow>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_JOB_PIPELINE_PAGED,
                            sqlArgs: { ...sqlArgs, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_PIPELINE_COUNT, sqlArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.total ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_JOB_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, branchId, status.status_id, searchQ, page]);

    useEffect(() => { void loadData(); }, [loadData]);

    async function handleSubmitTransition(job: OpenJobRow, transition: Transition, payload: TransitionPayload) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const flags = STATUS_FLAGS[transition.targetId];
            const xData = {
                id:              job.id,
                job_status_id:   transition.targetId,
                technician_id:   payload.technician_id,
                amount:          transition.fields.includes("A") ? payload.amount : job.amount,
                estimate_amount: transition.fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
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
                        transaction_date:     payload.transaction_date || null,
                        xData,
                    }),
                },
            });

            const pd = payload.partsData;
            if (pd && (pd.newLines.length || pd.deletedIds.length)) {
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            tableName:  "job_part_used",
                            deletedIds: pd.deletedIds,
                            xData: pd.newLines.map(l => ({
                                job_id:     job.id,
                                part_id:    l.part_id,
                                quantity:   l.quantity,
                                cost_price: l.cost_price,
                                sale_price: l.sale_price,
                                remarks:    l.remarks || null,
                            })),
                        }),
                    },
                });
            }

            const cd = payload.chargesData;
            if (cd && cd.lines.length) {
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName, schema,
                        value: encodeObj({
                            tableName: "job_additional_charge",
                            xData: cd.lines.map(l => ({
                                job_id:        job.id,
                                charge_name:   l.charge_name,
                                ref_no:        l.ref_no || null,
                                description:   l.description || null,
                                cost_price:    l.cost_price,
                                selling_price: l.selling_price,
                            })),
                        }),
                    },
                });
            }

            toast.success(`Job ${job.job_no} → ${transition.targetName}`);
            setPendingTran(null);
            void loadData();
        } catch {
            toast.error(MESSAGES.ERROR_JOB_UPDATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUndoConfirm(job: OpenJobRow) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.undoJobTransaction,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        job_id:               job.id,
                        last_transaction_id:  job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                    }),
                },
            });
            toast.success(`Undo successful — Job #${job.job_no} restored to previous status.`);
            setUndoPendingJob(null);
            void loadData();
        } catch {
            toast.error("Failed to undo transaction. Please refresh and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const badgeColorClass  = STATUS_COLORS[status.status_code]?.split(" ")[0] ?? "bg-slate-400";

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-2 px-4">
                <Button
                    className="h-8 gap-1.5 text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                    size="sm"
                    variant="ghost"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <span className={`inline-flex items-center rounded-sm px-3 py-1 text-sm font-semibold text-white ${badgeColorClass}`}>
                    {status.status_name}
                </span>
                <span className="text-xs text-[var(--cl-text-muted)]">
                    {loading ? "Loading…" : `${total} job${total !== 1 ? "s" : ""}`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {/* Search */}
                    <div className="relative flex items-center">
                        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--cl-text-muted)]" />
                        <input
                            className="h-8 rounded border border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 pr-8 text-sm text-[var(--cl-text)] placeholder:text-[var(--cl-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--cl-accent)] w-56"
                            placeholder="Search job no, customer, device…"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                className="absolute right-2 cursor-pointer text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                onClick={() => setSearchInput("")}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {/* Refresh */}
                    <Button
                        className="h-8 w-8 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                        disabled={loading}
                        size="icon"
                        title="Refresh"
                        variant="ghost"
                        onClick={() => void loadData()}
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
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
                            {searchInput ? "No jobs match your search." : "No jobs in this status."}
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
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => {
                                    const transitions  = getTransitions(row.job_status_id, row.job_type_code);
                                    const rowBg        = JOB_TYPE_ROW_COLORS[row.job_type_code] ?? "";
                                    const isNoAction   = NO_ACTION_CODES.has(row.job_status_code);
                                    const rowCanUndo   = canUndo(row);
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
                                            <td className={`${tdClass} text-right tabular-nums`}>
                                                {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                            </td>
                                            <td className={`${tdClass} sticky right-0 z-10 ${rowBg || "bg-[var(--cl-surface)]"} group-hover:bg-[var(--cl-accent)]/10`} onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        className="h-8 w-8 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/10"
                                                        size="icon"
                                                        title="View job details"
                                                        variant="ghost"
                                                        onClick={e => { e.stopPropagation(); setViewJobId(row.id); }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {/* No-action + no undo → lock icon */}
                                                    {isNoAction && !rowCanUndo ? (
                                                        <span className="flex h-7 w-7 items-center justify-center">
                                                            <Lock className="h-3.5 w-3.5 text-[var(--cl-text-muted)] opacity-40" />
                                                        </span>
                                                    ) : (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 text-[var(--cl-accent)] hover:text-white hover:bg-[var(--cl-accent)] rounded-lg transition-colors"
                                                                    disabled={submitting}
                                                                    size="icon"
                                                                    title="Actions"
                                                                    variant="ghost"
                                                                >
                                                                    <ArrowRightLeft className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="min-w-[220px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-1 z-50">
                                                                {!isNoAction && (
                                                                    <>
                                                                        <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                                                                            Move job to
                                                                        </DropdownMenuLabel>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        {transitions.length === 0 ? (
                                                                            <DropdownMenuItem disabled className="rounded-lg text-sm text-zinc-400 py-2.5 px-3 italic">
                                                                                No transitions available
                                                                            </DropdownMenuItem>
                                                                        ) : (
                                                                            transitions.map(t => {
                                                                                const dotBg = STATUS_COLORS[t.targetCode]?.trim().split(/\s+/)[0] ?? "bg-slate-400";
                                                                                return (
                                                                                    <DropdownMenuItem
                                                                                        key={`${t.targetId}-${t.targetName}`}
                                                                                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:bg-zinc-50 dark:focus:bg-zinc-900"
                                                                                        onClick={() => setPendingTran({ job: row, transition: t })}
                                                                                    >
                                                                                        <span className={`h-3 w-3 shrink-0 rounded-full ${dotBg} shadow-sm`} />
                                                                                        <span className="flex-1 text-zinc-700 dark:text-zinc-300">{t.targetName}</span>
                                                                                        <span className="text-zinc-300 dark:text-zinc-600">›</span>
                                                                                    </DropdownMenuItem>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </>
                                                                )}
                                                                {rowCanUndo && (
                                                                    <>
                                                                        {!isNoAction && <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />}
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                                                                            onClick={() => setUndoPendingJob(row)}
                                                                        >
                                                                            <Undo2 className="h-3.5 w-3.5 shrink-0" />
                                                                            Undo Last Transaction
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
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

            {pendingTran && (
                <StatusTransitionModal
                    job={pendingTran.job}
                    transition={pendingTran.transition}
                    technicians={technicians}
                    dbName={dbName ?? ""}
                    schema={schema ?? ""}
                    onClose={() => setPendingTran(null)}
                    onSubmit={payload => handleSubmitTransition(pendingTran.job, pendingTran.transition, payload)}
                />
            )}

            <JobAttachDialog
                jobId={attachJobId}
                jobNo={attachJobNo}
                onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                onFilesChanged={() => void loadData()}
            />

            {viewJobId !== null && (
                <JobPipelineDetailModal
                    jobId={viewJobId}
                    onClose={() => setViewJobId(null)}
                />
            )}

            {undoPendingJob && (
                <UndoTransactionDialog
                    job={undoPendingJob}
                    submitting={submitting}
                    onConfirm={() => void handleUndoConfirm(undoPendingJob)}
                    onClose={() => setUndoPendingJob(null)}
                />
            )}
        </motion.div>
    );
};
