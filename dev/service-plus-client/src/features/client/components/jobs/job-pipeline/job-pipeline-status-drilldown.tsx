import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeft, ArrowRightLeft,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    Eye, Loader2, Lock, Package, Paperclip, RefreshCcw, Search, Undo2, X,
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
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema, selectAvailableDivisions } from "@/store/context-slice";
import { isGstDivision } from "@/features/client/types/division";
import { useAppSelector } from "@/store/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import type { JobBoardStatusCount, OpenJobRow, TechnicianRow } from "@/features/client/types/job";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { getTransitions, STATUS_COLORS, STATUS_FLAGS } from "./status-transitions";
import type { Transition } from "./status-transitions";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { StatusTransitionModal } from "./status-transition-modal";
import type { TransitionPayload } from "./status-transition-modal";
import { JobDetailsModal } from "./job-details-modal";
import { JobChargesModal, type ChargesJobSummary } from "./job-charges-modal";
import { UndoTransactionDialog } from "./undo-transaction-dialog";
import { useGridRowRetention } from "../use-grid-row-retention";

type Props = {
    status: JobBoardStatusCount;
    technicians: TechnicianRow[];
    onBack: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

const PAGE_SIZE = 50;

const NO_ACTION_CODES = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);
const NO_UNDO_CODES = new Set(["DELIVERED_OK", "DELIVERED_NOT_OK"]);
const ADD_CHARGES_CODES = new Set(["RECEIVED", "ASSIGNED", "ESTIMATE_APPROVED", "IN_PROGRESS"]);
const NO_CHARGES_JOB_TYPES = new Set(["DEMO", "INSPECTION"]);

function canUndo(row: OpenJobRow): boolean {
    if (NO_UNDO_CODES.has(row.job_status_code)) return false;
    if (row.transaction_count < 1) return false;
    return true;
}

const JOB_TYPE_ROW_COLORS: Record<string, string> = {
    MAKE_READY: "bg-lime-50   dark:bg-lime-950/20",
    ESTIMATE: "bg-blue-50   dark:bg-blue-950/20",
    UNDER_WARRANTY: "bg-orange-50 dark:bg-orange-950/20",
    INSTALLATION: "bg-yellow-50 dark:bg-yellow-950/20",
    DEMO: "bg-yellow-50 dark:bg-yellow-950/20",
    MAINTENANCE: "bg-gray-50   dark:bg-gray-800/20",
    INSPECTION: "bg-gray-50   dark:bg-gray-800/20",
    AMC_SERVICE: "bg-gray-50   dark:bg-gray-800/20",
    UPGRADE: "bg-gray-50   dark:bg-gray-800/20",
    REFURBISH: "bg-gray-50   dark:bg-gray-800/20",
};

// Distinct color per batch (keyed by batch_no) so adjacent batches are visually
// separable instead of sharing one continuous left border — matches Job Control.
const BATCH_COLORS = [
    { border: "border-l-violet-400 dark:border-l-violet-500",   badge: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40" },
    { border: "border-l-amber-400 dark:border-l-amber-500",     badge: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" },
    { border: "border-l-sky-400 dark:border-l-sky-500",         badge: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40" },
    { border: "border-l-teal-400 dark:border-l-teal-500",       badge: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40" },
    { border: "border-l-emerald-400 dark:border-l-emerald-500", badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
    { border: "border-l-fuchsia-400 dark:border-l-fuchsia-500", badge: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/40" },
];

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

export const JobPipelineStatusDrilldown = ({ status, technicians, onBack }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const currentUser   = useAppSelector(selectCurrentUser);
    const divisions     = useAppSelector(selectAvailableDivisions);
    const branchId = currentBranch?.id ?? null;

    const [searchInput, setSearchInput] = useState("");
    const searchQ = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<OpenJobRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [pendingTran, setPendingTran] = useState<{ job: OpenJobRow; transition: Transition } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    const [undoPendingJob, setUndoPendingJob] = useState<OpenJobRow | null>(null);

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [chargesJob, setChargesJob] = useState<ChargesJobSummary | null>(null);

    const { scrollWrapperRef, selectedRowId, setSelectedRowId, armRestore, disarmRestore } = useGridRowRetention(loading);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect = scrollWrapperRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, [scrollWrapperRef]);

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
        const isAll = status.status_id === 0;
        try {
            const baseArgs = { branch_id: branchId, search: searchQ };
            const pagedArgs = isAll
                ? { ...baseArgs, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
                : { ...baseArgs, status_id: status.status_id, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
            const countArgs = isAll
                ? baseArgs
                : { ...baseArgs, status_id: status.status_id };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<OpenJobRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: isAll ? SQL_MAP.GET_JOB_PIPELINE_ALL_PAGED : SQL_MAP.GET_JOB_PIPELINE_PAGED,
                            sqlArgs: pagedArgs,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: isAll ? SQL_MAP.GET_JOB_PIPELINE_ALL_COUNT : SQL_MAP.GET_JOB_PIPELINE_COUNT,
                            sqlArgs: countArgs,
                        }),
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

    // Mutation reloads arm the row/scroll restore; navigation reloads disarm it.
    const refreshGrid = useCallback(() => { armRestore(); void loadData(); }, [armRestore, loadData]);

    useEffect(() => { disarmRestore(); void loadData(); }, [loadData, disarmRestore]);

    async function handleSubmitTransition(job: OpenJobRow, transition: Transition, payload: TransitionPayload) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const flags = STATUS_FLAGS[transition.targetId];
            const xData = {
                id: job.id,
                job_status_id: transition.targetId,
                division_id: payload.division_id,
                technician_id: payload.technician_id,
                amount: job.amount,
                estimate_amount: transition.fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
                is_final: flags?.is_final ?? false,
                is_closed: flags?.is_closed ?? false,
            };
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.updateJob,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({
                        job_id: job.id,
                        last_transaction_id: job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                        remarks: payload.remarks || "",
                        transaction_date: payload.transaction_date || null,
                        xData,
                    }),
                },
            });

            toast.success(`Job ${job.job_no} → ${transition.targetName}`);
            setPendingTran(null);
            refreshGrid();
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
                        job_id: job.id,
                        last_transaction_id: job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                    }),
                },
            });
            toast.success(`Undo successful — Job #${job.job_no} restored to previous status.`);
            setUndoPendingJob(null);
            refreshGrid();
        } catch (err) {
            const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
                ?? "Failed to undo transaction. Please refresh and try again.";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const badgeColorClass = STATUS_COLORS[status.status_code]?.split(" ")[0] ?? "bg-slate-400";

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-(--cl-border) bg-(--cl-surface) py-2 px-4">
                <Button
                    className="h-8 gap-1.5 px-3 font-semibold text-(--cl-accent) border border-(--cl-accent) hover:bg-(--cl-accent) hover:text-white transition-colors"
                    size="sm"
                    variant="outline"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <span className={`inline-flex items-center rounded-sm px-3 py-1 text-sm font-semibold text-white ${badgeColorClass}`}>
                    {status.status_name}
                </span>
                <span className="text-xs text-(--cl-text-muted)">
                    {loading ? "Loading…" : `${total} job${total !== 1 ? "s" : ""}`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {/* Search */}
                    <div className="relative flex items-center">
                        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-(--cl-text-muted)" />
                        <input
                            className="h-8 rounded border border-(--cl-border) bg-(--cl-surface) pl-8 pr-8 text-sm text-(--cl-text) placeholder:text-(--cl-text-muted) focus:outline-none focus:ring-1 focus:ring-(--cl-accent) w-[32rem]"
                            placeholder="Job no, alt job no, customer, mobile, email, city, technician, serial no, device…"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                className="absolute right-2 cursor-pointer text-(--cl-text-muted) hover:text-(--cl-text)"
                                onClick={() => setSearchInput("")}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {/* Refresh */}
                    <Button
                        className="h-8 w-8 text-(--cl-text-muted) hover:text-(--cl-accent)"
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm my-3">
                <div ref={scrollWrapperRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                    {loading ? (
                        <div className="flex h-32 items-center justify-center gap-2 text-sm text-(--cl-text-muted)">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                            {searchInput ? "No jobs match your search." : "No jobs in this status."}
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
                                    <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                {rows.map((row, idx) => {
                                    const transitions = getTransitions(row.job_status_id, row.job_type_code);
                                    const rowBg = JOB_TYPE_ROW_COLORS[row.job_type_code] ?? "";
                                    const isNoAction = NO_ACTION_CODES.has(row.job_status_code);
                                    const rowCanUndo = canUndo(row);
                                    const batchColor   = row.batch_no != null ? BATCH_COLORS[row.batch_no % BATCH_COLORS.length] : null;
                                    const isBatchStart = row.batch_no != null && (idx === 0 || rows[idx - 1].batch_no !== row.batch_no);
                                    const batchClasses = batchColor
                                        ? `border-l-2 ${batchColor.border}${isBatchStart ? " border-t-2 border-t-(--cl-text-muted)/40" : ""}`
                                        : "";
                                    return (
                                        <motion.tr
                                            key={row.id}
                                            animate={{ opacity: 1 }}
                                            className={`group cursor-pointer transition-colors ${
                                                selectedRowId === row.id
                                                    ? "bg-(--cl-accent)/40 hover:bg-(--cl-accent)/45"
                                                    : `hover:bg-(--cl-accent)/10 ${rowBg}`
                                            } ${batchClasses}`}
                                            data-job-id={row.id}
                                            initial={{ opacity: 0 }}
                                            transition={{ delay: idx * 0.015, duration: 0.15 }}
                                            onClick={() => setSelectedRowId(row.id)}
                                        >
                                            <td className={`${tdClass} text-(--cl-text-muted)`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td className={`${tdClass} whitespace-nowrap`}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{row.job_date}</span>
                                                    {row.division_id && (() => {
                                                        const dv = divisions.find(d => d.id === row.division_id);
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
                                                    <div className="font-mono font-semibold text-(--cl-accent)">
                                                        #{row.job_no}
                                                        {row.is_closed && (
                                                            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 rounded px-1 py-0.5">CLOSED</span>
                                                        )}
                                                        {row.is_opening_job && (
                                                            <span className="ml-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40 rounded px-1 py-0.5">OPENING</span>
                                                        )}
                                                    </div>
                                                    {row.alternate_job_no && (
                                                        <span className="font-mono text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 rounded px-1.5 py-0.5 w-fit">Alt: {row.alternate_job_no}</span>
                                                    )}
                                                    {row.purchase_date && (
                                                        <span className="text-[11px] font-semibold text-(--cl-text-muted)">PUR: {row.purchase_date}</span>
                                                    )}
                                                    {row.batch_no != null && (
                                                        <span className={`text-[10px] font-bold w-fit rounded px-1 py-0.5 ${batchColor?.badge}`}>Batch #{row.batch_no}</span>
                                                    )}
                                                    {row.file_count > 0 && (
                                                        <button
                                                            type="button"
                                                            className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer bg-blue-50 dark:bg-blue-950/40 rounded px-1.5 py-0.5 w-fit border-0 transition-colors"
                                                            onClick={e => { e.stopPropagation(); setSelectedRowId(row.id); setAttachJobId(row.id); setAttachJobNo(row.job_no); }}
                                                        >
                                                            <Paperclip className="h-2.5 w-2.5" />
                                                            <span>{row.file_count} File{row.file_count !== 1 ? "s" : ""}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={tdClass}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{row.customer_name}</span>
                                                    {row.customer_gstin && (
                                                        <span className="font-mono text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded px-1.5 py-0.5 w-fit">GSTIN: {row.customer_gstin}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`${tdClass} font-mono text-xs`}>{row.mobile}</td>
                                            <td className={`${tdClass} text-xs`}>{row.device_details ?? "—"}</td>
                                            <td className={tdClass}>
                                                <JobTypeBadge code={row.job_type_code} name={row.job_type_name} />
                                            </td>
                                            <td className={tdClass}>
                                                <div className="flex flex-col items-start gap-1">
                                                    <StatusBadge code={row.job_status_code} name={row.job_status_name} />
                                                    <div className="flex flex-wrap gap-1">
                                                        {row.is_final && !row.is_closed && (
                                                            <span className="text-[10px] font-bold rounded px-1 py-0.5 text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40">FINAL</span>
                                                        )}
                                                        {(() => {
                                                            const gst = isGstDivision(divisions.find(d => d.id === row.division_id) ?? null);
                                                            return (
                                                                <span className={`text-[10px] font-bold rounded px-1 py-0.5 ${gst
                                                                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                                                    : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"}`}>
                                                                    {gst ? "GST" : "Non-GST"}
                                                                </span>
                                                            );
                                                        })()}
                                                        {row.invoice_is_posted != null && (
                                                            <span className={`text-[10px] font-bold rounded px-1 py-0.5 ${row.invoice_is_posted
                                                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                                                : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"}`}>
                                                                {row.invoice_is_posted ? "Invoice: Posted" : "Invoice: Unposted"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`${tdClass} text-right tabular-nums`}>
                                                {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "—"}
                                            </td>
                                            <td
                                                className={`${tdClass} sticky right-0 z-10 ${
                                                    selectedRowId === row.id
                                                        ? "bg-(--cl-accent)/40 group-hover:bg-(--cl-accent)/45"
                                                        : `${rowBg || "bg-(--cl-surface)"} group-hover:bg-(--cl-accent)/10`
                                                }`}
                                                onClick={e => e.stopPropagation()}
                                                onPointerDownCapture={() => setSelectedRowId(row.id)}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        className="h-8 w-8 p-0 text-(--cl-text-muted) hover:text-(--cl-accent) hover:bg-(--cl-accent)/10"
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
                                                            <Lock className="h-3.5 w-3.5 text-(--cl-text-muted) opacity-40" />
                                                        </span>
                                                    ) : (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 text-(--cl-accent) hover:text-white hover:bg-(--cl-accent) rounded-lg transition-colors"
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
                                                                {ADD_CHARGES_CODES.has(row.job_status_code) && !NO_CHARGES_JOB_TYPES.has(row.job_type_code) && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30"
                                                                            onClick={() => setChargesJob({
                                                                                id: row.id,
                                                                                job_no: row.job_no,
                                                                                customer_name: row.customer_name,
                                                                                job_status_name: row.job_status_name,
                                                                                job_status_code: row.job_status_code,
                                                                                job_type_code: row.job_type_code,
                                                                            })}
                                                                        >
                                                                            <Package className="h-3.5 w-3.5 shrink-0" />
                                                                            Parts &amp; Charges
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
                <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                    <span className="text-xs text-(--cl-text-muted)">
                        {total === 0
                            ? "No jobs"
                            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} jobs (Page ${page} of ${totalPages})`}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First" variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {pendingTran && (
                <StatusTransitionModal
                    divisions={divisions}
                    job={pendingTran.job}
                    transition={pendingTran.transition}
                    technicians={technicians}
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
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => setViewJobId(null)}
                    onJobChanged={() => refreshGrid()}
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

            {chargesJob && (
                <JobChargesModal
                    job={chargesJob}
                    dbName={dbName ?? ""}
                    schema={schema ?? ""}
                    onClose={() => setChargesJob(null)}
                    onSaved={() => { setChargesJob(null); refreshGrid(); }}
                />
            )}
        </motion.div>
    );
};
