import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft, ArrowRightLeft, CheckSquare,
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    ClipboardList, Eye, FileDown, Lock, MoreVertical, Package, Paperclip, Printer, RefreshCw, Search, Truck, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema, selectAvailableDivisions } from "@/store/context-slice";
import type { JobLookupRow, JobControlRow, TechnicianRow } from "@/features/client/types/job";
import { isGstDivision } from "@/features/client/types/division";
import { getTransitions, STATUS_COLORS, STATUS_FLAGS } from "../job-pipeline/status-transitions";
import type { Transition } from "../job-pipeline/status-transitions";
import { JobTypeBadge, StatusBadge } from "../job-badges";
import { StatusTransitionModal } from "../job-pipeline/status-transition-modal";
import type { TransitionPayload } from "../job-pipeline/status-transition-modal";
import { UndoTransactionDialog } from "../job-pipeline/undo-transaction-dialog";
import { JobChargesModal } from "../job-pipeline/job-charges-modal";
import type { ChargesJobSummary } from "../job-pipeline/job-charges-modal";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { JobPdfModal } from "./job-pdf-modal";
import { FinalJobDialog } from "./final-job-dialog";
import { FinalAJobSection } from "../final-a-job/final-a-job-section";
import { DeliverJobSection } from "../deliver-job/deliver-job-section";
import { DeliveryModal } from "../deliver-job/delivery-modal";
import { useDeliveredJobActions } from "../deliver-job/use-delivered-job-actions";
import type { JobDeliveryFullDetail } from "../deliver-job/deliver-job-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };
type ClosedFilter = null | boolean;
type JobFilter =
    | { group: "closed"; value: ClosedFilter }
    | { group: "status"; id: number | null };
type DeliveryMannerRow = { id: number; name: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const NO_ACTION_CODES     = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);
const NO_UNDO_CODES       = new Set(["DELIVERED_OK", "DELIVERED_NOT_OK"]);
const ADD_CHARGES_CODES   = new Set(["RECEIVED", "ASSIGNED", "ESTIMATE_APPROVED", "IN_PROGRESS"]);
const NO_CHARGES_JOB_TYPES = new Set(["DEMO", "INSPECTION"]);

function canUndo(row: JobControlRow): boolean {
    if (NO_UNDO_CODES.has(row.job_status_code)) return false;
    if (row.transaction_count < 1) return false;
    return true;
}

// Distinct color per batch (keyed by batch_no) so adjacent batches are visually
// separable instead of sharing one continuous left border.
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

// ─── Component ────────────────────────────────────────────────────────────────

export const JobControlSection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const divisions    = useAppSelector(selectAvailableDivisions);
    const currentUser  = useAppSelector(selectCurrentUser);
    const branchId     = globalBranch?.id ?? null;

    const [subView,     setSubView]     = useState<"list" | "undoFinal" | "undoDelivery">("list");
    const [search,      setSearch]      = useState("");
    const [searchQ,     setSearchQ]     = useState("");
    const [filter,      setFilter]      = useState<JobFilter>({ group: "closed", value: false });
    const [jobStatuses, setJobStatuses] = useState<JobLookupRow[]>([]);
    const [page,           setPage]           = useState(1);
    const [rows,           setRows]           = useState<JobControlRow[]>([]);
    const [total,          setTotal]          = useState(0);
    const [loading,        setLoading]        = useState(false);

    const [technicians,    setTechnicians]    = useState<TechnicianRow[]>([]);
    const [pendingTran,    setPendingTran]    = useState<{ job: JobControlRow; transition: Transition } | null>(null);
    const [submitting,     setSubmitting]     = useState(false);
    const [undoPendingJob, setUndoPendingJob] = useState<JobControlRow | null>(null);
    const [chargesJob,     setChargesJob]     = useState<ChargesJobSummary | null>(null);

    const [undoFinalPendingJob, setUndoFinalPendingJob] = useState<JobControlRow | null>(null);
    const [undoFinalSubmitting, setUndoFinalSubmitting] = useState(false);

    const [attachJobId, setAttachJobId] = useState<number | null>(null);
    const [attachJobNo, setAttachJobNo] = useState<string>("");

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [pdfJobId,  setPdfJobId]  = useState<number | null>(null);

    const [finalJobId, setFinalJobId] = useState<number | null>(null);

    const [deliveryManners,           setDeliveryManners]           = useState<DeliveryMannerRow[]>([]);
    const [showPartsInInvoiceSetting, setShowPartsInInvoiceSetting] = useState<{ show: boolean; text: string; hsn: number; gst_rate: number } | null>(null);
    const [deliveryJobDetails,        setDeliveryJobDetails]        = useState<JobDeliveryFullDetail[]>([]);
    const [showDeliveryModal,         setShowDeliveryModal]         = useState(false);
    const [loadingDelivery,           setLoadingDelivery]           = useState<number | null>(null);

    const deliveredActions = useDeliveredJobActions();

    const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef<number | null>(null);
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

    // Restore scroll position after a post-mutation refresh.
    useEffect(() => {
        if (pendingScrollRef.current === null) return;
        const target = pendingScrollRef.current;
        pendingScrollRef.current = null;
        requestAnimationFrame(() => {
            if (scrollWrapperRef.current) scrollWrapperRef.current.scrollTop = target;
        });
    }, [rows]);

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
                apolloClient.query<GenericQueryData<JobControlRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_CONTROL_PAGED,
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
                            sqlId: SQL_MAP.GET_JOB_CONTROL_COUNT,
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

    const refreshGrid = useCallback(() => {
        if (!branchId) return;
        pendingScrollRef.current = scrollWrapperRef.current?.scrollTop ?? null;
        void loadData(Number(branchId), searchQ, page, filter);
    }, [branchId, loadData, searchQ, page, filter]);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const gq = <T,>(sqlId: string, sqlArgs?: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        void gq<JobLookupRow>(SQL_MAP.GET_JOB_STATUSES).then(res => setJobStatuses(res.data?.genericQuery ?? []));
        void gq<TechnicianRow>(SQL_MAP.GET_ALL_TECHNICIANS, { branch_id: branchId }).then(res => setTechnicians(res.data?.genericQuery ?? []));
        void gq<DeliveryMannerRow>(SQL_MAP.GET_JOB_DELIVERY_MANNERS).then(res => setDeliveryManners(res.data?.genericQuery ?? []));
        void gq<{ setting_value: unknown }>(SQL_MAP.GET_APP_SETTING_BY_KEY, { setting_key: "show_parts_in_job_invoice" })
            .then(res => {
                const sv = res.data?.genericQuery?.[0]?.setting_value;
                if (sv != null && typeof sv === "object") setShowPartsInInvoiceSetting(sv as { show: boolean; text: string; hsn: number; gst_rate: number });
            });
    }, [dbName, schema, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    async function handleSubmitTransition(job: JobControlRow, transition: Transition, payload: TransitionPayload) {
        if (!dbName || !schema) return;
        setSubmitting(true);
        try {
            const flags = STATUS_FLAGS[transition.targetId];
            const xData = {
                id:             job.id,
                job_status_id:  transition.targetId,
                division_id:    payload.division_id,
                technician_id:  payload.technician_id,
                amount:         job.amount,
                estimate_amount: transition.fields.includes("E") ? payload.estimate_amount : job.estimate_amount,
                is_final:       flags?.is_final  ?? false,
                is_closed:      flags?.is_closed ?? false,
            };
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.updateJob,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({
                        job_id:               job.id,
                        last_transaction_id:  job.last_transaction_id,
                        performed_by_user_id: currentUser?.id ?? null,
                        remarks:              payload.remarks || "",
                        transaction_date:     payload.transaction_date || null,
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

    async function handleUndoConfirm(job: JobControlRow) {
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
            refreshGrid();
        } catch (err) {
            const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
                ?? "Failed to undo transaction. Please refresh and try again.";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleUndoFinalConfirm(job: JobControlRow) {
        if (!dbName || !schema) return;
        setUndoFinalSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({ tableName: "job", xData: { id: job.id, is_final: false } }),
                },
            });
            toast.success(`Job #${job.job_no} moved back to pending.`);
            refreshGrid();
        } catch {
            toast.error("Failed to undo final. Please try again.");
        } finally {
            setUndoFinalSubmitting(false);
            setUndoFinalPendingJob(null);
        }
    }

    async function handleOpenDelivery(jobId: number) {
        if (!dbName || !schema) return;
        setLoadingDelivery(jobId);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                        sqlArgs: { job_ids: [jobId] },
                    }),
                },
            });
            const details = res.data?.genericQuery ?? [];
            if (details.length === 0) { toast.error("Failed to load job delivery details."); return; }
            setDeliveryJobDetails(details);
            setShowDeliveryModal(true);
        } catch {
            toast.error("Failed to load job delivery details.");
        } finally {
            setLoadingDelivery(null);
        }
    }

    // ── List view ─────────────────────────────────────────────────────────────

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const closedFilterLabel: Record<string, string> = {
        "null":  "All",
        "false": "Open",
        "true":  "Delivered",
    };

    const filterOptions: { value: ClosedFilter; label: string }[] = [
        { value: false, label: "Open"      },
        { value: true,  label: "Delivered" },
        { value: null,  label: "All"       },
    ];

    if (subView === "undoFinal") {
        return <FinalAJobSection onBack={() => setSubView("list")} initialTab="finalized" />;
    }

    if (subView === "undoDelivery") {
        return <DeliverJobSection onBack={() => setSubView("list")} initialTab="delivered" />;
    }

    if (finalJobId !== null) {
        return (
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                <FinalJobDialog
                    jobId={finalJobId}
                    onClose={() => setFinalJobId(null)}
                    onFinalized={() => {
                        setFinalJobId(null);
                        if (branchId) void loadData(Number(branchId), searchQ, page, filter);
                    }}
                />
            </motion.div>
        );
    }

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
                        <span className="text-sm font-bold text-(--cl-text)">Job Control</span>
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
                                className={`px-3 h-8 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer
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
                            className="flex items-center gap-1 px-3 h-8 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer bg-(--cl-surface) text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent)"
                            onClick={() => { setFilter({ group: "status", id: null }); setPage(1); }}
                        >
                            Status
                            <ChevronRightIcon className="h-3 w-3" />
                        </button>
                    </div>
                    <Button
                        className="ml-auto h-8 gap-1.5 px-3 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-400 dark:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 shrink-0"
                        size="sm"
                        variant="outline"
                        onClick={() => setSubView("undoFinal")}
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                        Undo Final
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-semibold text-sky-600 dark:text-sky-400 border border-sky-400 dark:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 shrink-0"
                        size="sm"
                        variant="outline"
                        onClick={() => setSubView("undoDelivery")}
                    >
                        <Truck className="h-3.5 w-3.5" />
                        Undo Delivery
                    </Button>
                    <Button
                        className="h-8 px-2.5 text-xs shrink-0"
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
                                {rows.map((job, idx) => {
                                    const batchColor   = job.batch_no != null ? BATCH_COLORS[job.batch_no % BATCH_COLORS.length] : null;
                                    const isBatchStart = job.batch_no != null && (idx === 0 || rows[idx - 1].batch_no !== job.batch_no);
                                    const batchClasses = batchColor
                                        ? `border-l-2 ${batchColor.border}${isBatchStart ? " border-t-2 border-t-(--cl-text-muted)/40" : ""}`
                                        : "";
                                    return (
                                    <tr
                                        key={job.id}
                                        className={`group cursor-pointer transition-colors hover:bg-(--cl-accent)/5 ${batchClasses}`}
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
                                                    <span className={`text-[11px] font-bold w-fit rounded px-1 py-0.5 ${batchColor?.badge}`}>Batch #{job.batch_no}</span>
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
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <span>{job.customer_name ?? "—"}</span>
                                                {job.customer_gstin && (
                                                    <span className="font-mono text-[10px] text-(--cl-text-muted)">GSTIN: {job.customer_gstin}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`${tdClass} font-mono text-xs`}>{job.mobile}</td>
                                        <td className={`${tdClass} text-xs`}>{job.device_details || "—"}</td>
                                        <td className={tdClass}>
                                            <JobTypeBadge code={job.job_type_code} name={job.job_type_name} />
                                        </td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col items-start gap-1">
                                                <StatusBadge code={job.job_status_code} name={job.job_status_name} />
                                                <div className="flex flex-wrap gap-1">
                                                    {job.is_final && !job.is_closed && (
                                                        <span className="text-[11px] font-bold rounded px-1 py-0.5 text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40">FINAL</span>
                                                    )}
                                                    {(() => {
                                                        const gst = isGstDivision(divisions.find(d => d.id === job.division_id) ?? null);
                                                        return (
                                                            <span className={`text-[11px] font-bold rounded px-1 py-0.5 ${gst
                                                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                                                : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"}`}>
                                                                {gst ? "GST" : "Non-GST"}
                                                            </span>
                                                        );
                                                    })()}
                                                    {job.invoice_is_posted != null && (
                                                        <span className={`text-[11px] font-bold rounded px-1 py-0.5 ${job.invoice_is_posted
                                                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                                                            : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"}`}>
                                                            {job.invoice_is_posted ? "Invoice: Posted" : "Invoice: Unposted"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`${tdClass} text-right`}>
                                            {job.amount != null ? `₹${Number(job.amount).toFixed(2)}` : "—"}
                                        </td>
                                        <td
                                            className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2) hidden md:table-cell`}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {(() => {
                                                const isDelivered = job.job_status_code === "DELIVERED_OK" || job.job_status_code === "DELIVERED_NOT_OK";
                                                if (isDelivered) {
                                                    return (
                                                        <div className="flex items-center justify-center">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        className="h-8 w-8 p-0 text-(--cl-text-muted) hover:text-(--cl-accent) hover:bg-(--cl-accent)/10"
                                                                        size="icon"
                                                                        title="Actions"
                                                                        variant="ghost"
                                                                    >
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="min-w-[200px] bg-white dark:bg-zinc-950 border-(--cl-border) shadow-lg rounded-lg p-1">
                                                                    <DropdownMenuItem
                                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                                                        onClick={() => setViewJobId(job.id)}
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5 shrink-0" /> View
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                                                        onClick={() => void deliveredActions.handleDeliveryNote(job)}
                                                                    >
                                                                        <Truck className="h-3.5 w-3.5 shrink-0" /> Delivery Note
                                                                    </DropdownMenuItem>
                                                                    {job.invoice_is_posted !== null && (
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                                                            onClick={() => void deliveredActions.handleInvoiceReceipts(job)}
                                                                        >
                                                                            <Printer className="h-3.5 w-3.5 shrink-0" /> Invoice + Receipts
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem
                                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                                        onClick={() => setPdfJobId(job.id)}
                                                                    >
                                                                        <FileDown className="h-3.5 w-3.5 shrink-0" /> Print / Save as PDF
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                    <DropdownMenuItem
                                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        disabled={job.invoice_is_posted === true}
                                                                        title={job.invoice_is_posted === true ? "Cannot undo: invoice is already posted" : undefined}
                                                                        onClick={() => deliveredActions.handleUndoDelivery(job)}
                                                                    >
                                                                        <Undo2 className="h-3.5 w-3.5 shrink-0" /> Undo Delivery
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    );
                                                }
                                                return (
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

                                                {/* Transaction dropdown */}
                                                {(() => {
                                                    const transitions    = getTransitions(job.job_status_id, job.job_type_code);
                                                    const isNoAction     = NO_ACTION_CODES.has(job.job_status_code);
                                                    const rowCanUndo     = canUndo(job);
                                                    const showCharges    = ADD_CHARGES_CODES.has(job.job_status_code) && !NO_CHARGES_JOB_TYPES.has(job.job_type_code);
                                                    const showFinalJob   = job.job_status_code === "COMPLETED_OK" && !job.is_final;
                                                    const showUndoFinal  = job.job_status_code === "COMPLETED_OK" && job.is_final;
                                                    const showDeliverJob = job.is_final && !job.is_closed;
                                                    const hasAnyAction   = !isNoAction || rowCanUndo || showCharges || showFinalJob || showUndoFinal || showDeliverJob;
                                                    if (!hasAnyAction) {
                                                        return (
                                                            <span className="flex h-8 w-8 items-center justify-center">
                                                                <Lock className="h-3.5 w-3.5 text-(--cl-text-muted) opacity-40" />
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 text-(--cl-accent) hover:text-white hover:bg-(--cl-accent) rounded-lg transition-colors"
                                                                    disabled={submitting || loadingDelivery === job.id}
                                                                    size="icon"
                                                                    title="Status actions"
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
                                                                        ) : transitions.map(t => {
                                                                            const dotBg = STATUS_COLORS[t.targetCode]?.trim().split(/\s+/)[0] ?? "bg-slate-400";
                                                                            return (
                                                                                <DropdownMenuItem
                                                                                    key={`${t.targetId}-${t.targetName}`}
                                                                                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:bg-zinc-50 dark:focus:bg-zinc-900"
                                                                                    onClick={() => setPendingTran({ job, transition: t })}
                                                                                >
                                                                                    <span className={`h-3 w-3 shrink-0 rounded-full ${dotBg} shadow-sm`} />
                                                                                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">{t.targetName}</span>
                                                                                    <span className="text-zinc-300 dark:text-zinc-600">›</span>
                                                                                </DropdownMenuItem>
                                                                            );
                                                                        })}
                                                                    </>
                                                                )}
                                                                {rowCanUndo && (
                                                                    <>
                                                                        {!isNoAction && <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />}
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                                                                            onClick={() => setUndoPendingJob(job)}
                                                                        >
                                                                            <Undo2 className="h-3.5 w-3.5 shrink-0" />
                                                                            Undo Last Transaction
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {showCharges && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-violet-600 focus:text-violet-700 focus:bg-violet-50 dark:focus:bg-violet-950/30"
                                                                            onClick={() => setChargesJob({
                                                                                id:              job.id,
                                                                                job_no:          job.job_no,
                                                                                customer_name:   job.customer_name ?? "",
                                                                                job_status_name: job.job_status_name,
                                                                                job_status_code: job.job_status_code,
                                                                                job_type_code:   job.job_type_code,
                                                                            })}
                                                                        >
                                                                            <Package className="h-3.5 w-3.5 shrink-0" />
                                                                            Parts &amp; Charges
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {showFinalJob && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/30"
                                                                            onClick={() => setFinalJobId(job.id)}
                                                                        >
                                                                            <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                                                                            Final the Job
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {showUndoFinal && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            disabled={job.invoice_is_posted === true}
                                                                            title={job.invoice_is_posted === true ? "Cannot undo a posted job" : undefined}
                                                                            onClick={() => setUndoFinalPendingJob(job)}
                                                                        >
                                                                            <Undo2 className="h-3.5 w-3.5 shrink-0" />
                                                                            Undo Final
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                {showDeliverJob && (
                                                                    <>
                                                                        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800 mx-1" />
                                                                        <DropdownMenuItem
                                                                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer text-blue-700 focus:text-blue-700 focus:bg-blue-50 dark:focus:bg-blue-950/30"
                                                                            onClick={() => void handleOpenDelivery(job.id)}
                                                                        >
                                                                            <Truck className="h-3.5 w-3.5 shrink-0" />
                                                                            Deliver Job
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    );
                                                })()}

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
                                                );
                                            })()}
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
                onFilesChanged={() => { refreshGrid(); }}
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

            {/* Status transition modal */}
            {pendingTran && (
                <StatusTransitionModal
                    divisions={divisions}
                    job={{
                        id:                         pendingTran.job.id,
                        job_no:                     pendingTran.job.job_no,
                        customer_name:              pendingTran.job.customer_name ?? "",
                        job_status_name:            pendingTran.job.job_status_name,
                        division_id:                pendingTran.job.division_id ?? null,
                        technician_id:              pendingTran.job.technician_id,
                        job_receive_manner_name:    null,
                        device_details:             pendingTran.job.device_details,
                        job_receive_condition_name: null,
                    }}
                    transition={pendingTran.transition}
                    technicians={technicians}
                    onClose={() => setPendingTran(null)}
                    onSubmit={payload => handleSubmitTransition(pendingTran.job, pendingTran.transition, payload)}
                />
            )}

            {/* Undo transaction dialog */}
            {undoPendingJob && (
                <UndoTransactionDialog
                    job={{
                        job_no:                  undoPendingJob.job_no,
                        customer_name:           undoPendingJob.customer_name,
                        job_receive_manner_name: null,
                        device_details:          undoPendingJob.device_details,
                        job_status_name:         undoPendingJob.job_status_name,
                    }}
                    submitting={submitting}
                    onConfirm={() => void handleUndoConfirm(undoPendingJob)}
                    onClose={() => setUndoPendingJob(null)}
                />
            )}

            {/* Parts & Charges modal */}
            {chargesJob && (
                <JobChargesModal
                    job={chargesJob}
                    dbName={dbName ?? ""}
                    schema={schema ?? ""}
                    onClose={() => setChargesJob(null)}
                    onSaved={() => {
                        setChargesJob(null);
                        refreshGrid();
                    }}
                />
            )}

            {/* Undo Final confirmation */}
            <AlertDialog open={!!undoFinalPendingJob} onOpenChange={open => { if (!open) setUndoFinalPendingJob(null); }}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Undo Final?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Job #{undoFinalPendingJob?.job_no} will be moved back to pending. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={undoFinalSubmitting}
                            onClick={() => { if (undoFinalPendingJob) void handleUndoFinalConfirm(undoFinalPendingJob); }}
                        >
                            Undo Final
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delivery modal */}
            {showDeliveryModal && deliveryJobDetails.length > 0 && (
                <DeliveryModal
                    jobs={deliveryJobDetails}
                    branchId={branchId}
                    branchName={globalBranch?.name ?? null}
                    deliveryManners={deliveryManners}
                    availableDivisions={divisions}
                    currentUser={currentUser}
                    dbName={dbName}
                    schema={schema}
                    showPartsInInvoiceSetting={showPartsInInvoiceSetting}
                    onClose={() => { setShowDeliveryModal(false); setDeliveryJobDetails([]); }}
                    onDelivered={() => {
                        setShowDeliveryModal(false);
                        setDeliveryJobDetails([]);
                        refreshGrid();
                    }}
                />
            )}

            {deliveredActions.renderModals(() => refreshGrid())}
        </motion.div>
    );
};
