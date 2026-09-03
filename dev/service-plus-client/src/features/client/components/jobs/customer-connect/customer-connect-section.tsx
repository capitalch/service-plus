import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/shared/refresh-button";
import { Input } from "@/components/ui/input";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { sendWhatsappCompletion, type WhatsappCompletionResult } from "../send-whatsapp-completion";
import { CustomerConnectGrid } from "./customer-connect-grid";
import { SendMessagesModal } from "./send-messages-modal";
import { SendResultsDialog } from "./send-results-dialog";
import { WhatsappLogSection } from "./whatsapp-log-section";
import { MoneyReceiptLogSection } from "./money-receipt-log-section";
import { PAGE_SIZE, getCompletionState, groupRowsByCustomer, hasAnyPriorAttempt, isRowSelectable, type GroupableJobRow } from "./customer-connect-helpers";
import type { CustomerConnectJobRow, CustomerGroup, WhatsappCompletionState } from "./customer-connect-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

type WhatsappDeliveryStatusEvent = {
    db_name: string;
    job_id:  number;
    status:  string;
    error:   string | null;
};

// Live delivery outcome after a dispatch, via the whatsappDeliveryStatus subscription
// — Meta settles DELIVERED/FAILED asynchronously through the webhook, and the webhook
// publishes over the same PubSub the accountsPosting flow already uses for progress
// (chosen over polling once we realized the subscription infra was already in place).
// The timeout below is a safety net only — real updates arrive event-driven, not on
// this cadence.
const DELIVERY_TRACKING_TIMEOUT_MS = 2 * 60 * 1_000;

type DispatchBanner = {
    stage:           "dispatched" | "settled";
    dispatchedCount: number;
    customerCount:   number;
    deliveredCount:  number;
    pendingCount:    number;
    failedCount:     number;
};

type ActiveTab = "completion" | "intake" | "delivery" | "moneyReceipt";

export function CustomerConnectSection() {
    const [activeTab, setActiveTab] = useState<ActiveTab>("completion");
    // Job Intake / Job Delivery / Money Receipt own their row/loading state
    // internally (whatsapp-log-section.tsx / money-receipt-log-section.tsx)
    // — only the count is lifted up here, so it can sit next to "Customer
    // Connect" in one shared subtitle line instead of each tab rendering its
    // own separate title/count row.
    const [intakeTotal,       setIntakeTotal]       = useState(0);
    const [deliveryTotal,     setDeliveryTotal]     = useState(0);
    const [moneyReceiptTotal, setMoneyReceiptTotal] = useState(0);

    const dbName      = useAppSelector(selectDbName);
    const schema      = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId    = globalBranch?.id ?? null;

    const [rows,    setRows]    = useState<CustomerConnectJobRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);
    const [search,  setSearch]  = useState("");
    const [searchQ, setSearchQ] = useState("");

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [selectAllMatchingActive, setSelectAllMatchingActive] = useState(false);
    const [selectAllMatchingLoading, setSelectAllMatchingLoading] = useState(false);

    const [viewJobId, setViewJobId] = useState<number | null>(null);
    const [sendGroups, setSendGroups] = useState<CustomerGroup[] | null>(null);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<WhatsappCompletionResult[] | null>(null);

    const [banner, setBanner] = useState<DispatchBanner | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliverySubRef = useRef<{ unsubscribe: () => void } | null>(null);
    const deliveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trackingJobIdsRef = useRef<Set<number>>(new Set());
    const outcomesRef = useRef<Map<number, "DELIVERED" | "FAILED">>(new Map());

    // ── Load a page ─────────────────────────────────────────────────────────
    const loadData = useCallback(async (branch: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branch, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<CustomerConnectJobRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_WHATSAPP_ELIGIBLE_JOBS_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_WHATSAPP_ELIGIBLE_JOBS_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            const newRows = dataRes.data?.genericQuery ?? [];
            setRows(newRows);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);

            // Every eligible row starts checked; a row with any prior attempt —
            // success or failure — starts unchecked. A resend must be a deliberate
            // click.
            if (!selectAllMatchingActive) {
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    for (const row of newRows) {
                        if (isRowSelectable(row) && !hasAnyPriorAttempt(row)) {
                            next.add(row.id);
                        }
                    }
                    return next;
                });
            }
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_JOBS_LOAD_FAILED);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, selectAllMatchingActive]);

    useEffect(() => {
        if (branchId) void loadData(branchId, searchQ, page);
    }, [branchId, searchQ, page, loadData]);

    // Stop *banner* tracking only (safety-net timeout + bookkeeping) — the underlying
    // subscription below stays alive for the component's whole lifetime; this just
    // stops rolling per-dispatch counts into the banner. Called on early completion
    // (every dispatched job settled), banner dismiss, or a fresh dispatch superseding
    // an in-flight one.
    const stopBannerTracking = useCallback(() => {
        if (deliveryTimeoutRef.current) { clearTimeout(deliveryTimeoutRef.current); deliveryTimeoutRef.current = null; }
        trackingJobIdsRef.current = new Set();
        outcomesRef.current = new Map();
    }, []);

    useEffect(() => stopBannerTracking, [stopBannerTracking]);

    // Arm banner tracking for one dispatch's job_ids — a 2-minute safety net only for
    // the banner's rolling counts, not for whether the grid keeps updating (see the
    // subscription effect below, which has no such limit).
    const startBannerTracking = useCallback((jobIds: number[]) => {
        stopBannerTracking();
        trackingJobIdsRef.current = new Set(jobIds);
        deliveryTimeoutRef.current = setTimeout(stopBannerTracking, DELIVERY_TRACKING_TIMEOUT_MS);
    }, [stopBannerTracking]);

    // Persistent, db_name-scoped subscription to live per-job delivery outcomes —
    // held open for the whole time this screen is mounted, not just for a couple of
    // minutes after a dispatch. READ in particular can arrive long after send (it
    // depends on the customer actually opening the message), so a subscription that
    // only lived for the 2-minute banner window meant Read/Delivered updates were
    // effectively only ever visible after a manual refresh. Every event: patches the
    // matching grid row in place (a no-op if that job_id isn't on the current page)
    // and unchecks the row's checkbox live, so "a try was made / an outcome arrived"
    // reflects immediately without needing a refresh either. Banner-count bookkeeping
    // (below) is separately scoped to just the most recent dispatch's job_ids.
    useEffect(() => {
        if (!dbName) return;
        const sub = apolloClient
            .subscribe<{ whatsappDeliveryStatus: WhatsappDeliveryStatusEvent | null }>({
                query: GRAPHQL_MAP.whatsappDeliveryStatus,
                variables: { db_name: dbName },
            })
            .subscribe({
                next: ({ data }) => {
                    const ev = data?.whatsappDeliveryStatus;
                    if (!ev) return;

                    setRows(prev => prev.map(row => {
                        if (row.id !== ev.job_id) return row;
                        const prevState = getCompletionState(row);
                        // Mirrors SET_JOB_WHATSAPP_OUTCOME's own increment rule server-side:
                        // success_count bumps only on the exact transition into DELIVERED
                        // (not on a later READ), fail_count only on FAILED. Safe to mirror
                        // client-side because the webhook only ever publishes an event when
                        // that DB increment actually applied — a duplicate/out-of-order
                        // callback is dropped server-side before publishing, so this can't
                        // double-count.
                        const nextState: WhatsappCompletionState = {
                            attempt_count: prevState?.attempt_count ?? 0,
                            success_count: (prevState?.success_count ?? 0) + (ev.status === "DELIVERED" ? 1 : 0),
                            fail_count:    (prevState?.fail_count ?? 0) + (ev.status === "FAILED" ? 1 : 0),
                            last_wamid:    prevState?.last_wamid ?? null,
                            last_sent_at:  prevState?.last_sent_at ?? null,
                            last_status:   ev.status as WhatsappCompletionState["last_status"],
                            last_error:    ev.error,
                        };
                        return {
                            ...row,
                            whatsapp_notifications: { ...row.whatsapp_notifications, JOB_COMPLETION: nextState },
                        };
                    }));
                    setSelectedIds(prev => {
                        if (!prev.has(ev.job_id)) return prev;
                        const next = new Set(prev);
                        next.delete(ev.job_id);
                        return next;
                    });

                    if (!trackingJobIdsRef.current.has(ev.job_id)) return;
                    if (ev.status === "DELIVERED" || ev.status === "READ") {
                        outcomesRef.current.set(ev.job_id, "DELIVERED");
                    } else if (ev.status === "FAILED") {
                        outcomesRef.current.set(ev.job_id, "FAILED");
                    }

                    const total = trackingJobIdsRef.current.size;
                    const deliveredCount = [...outcomesRef.current.values()].filter(s => s === "DELIVERED").length;
                    const failedCount = [...outcomesRef.current.values()].filter(s => s === "FAILED").length;
                    const settledCount = deliveredCount + failedCount;

                    setBanner(prev => prev && {
                        ...prev,
                        stage: settledCount > 0 ? "settled" : prev.stage,
                        deliveredCount,
                        pendingCount: total - settledCount,
                        failedCount,
                    });

                    if (settledCount >= total) stopBannerTracking();
                },
                // Live updates are best-effort — the dispatch result (toast + results
                // dialog) is already authoritative for "did the send go out", and a
                // manual Refresh always falls back to the real DB state.
                error: () => { /* no-op */ },
            });
        deliverySubRef.current = sub;
        return () => { sub.unsubscribe(); deliverySubRef.current = null; };
    }, [dbName, stopBannerTracking]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, SEARCH_DEBOUNCE_MS);
    }

    // ── Selection ────────────────────────────────────────────────────────────
    function handleSelectionChange(id: number, checked: boolean) {
        setSelectAllMatchingActive(false);
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }

    function handleSelectAllOnPage(checked: boolean) {
        setSelectAllMatchingActive(false);
        setSelectedIds(prev => {
            const next = new Set(prev);
            for (const row of rows) {
                if (!isRowSelectable(row)) continue;
                if (checked) next.add(row.id); else next.delete(row.id);
            }
            return next;
        });
    }

    async function handleSelectAllMatching() {
        if (!dbName || !schema || !branchId) return;
        setSelectAllMatchingLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<{ id: number }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_WHATSAPP_ELIGIBLE_JOB_IDS,
                        sqlArgs: { branch_id: branchId, search: searchQ },
                    }),
                },
            });
            const ids = (res.data?.genericQuery ?? []).map(r => r.id);
            setSelectedIds(new Set(ids));
            setSelectAllMatchingActive(true);
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_JOBS_LOAD_FAILED);
        } finally {
            setSelectAllMatchingLoading(false);
        }
    }

    function handleClearSelection() {
        setSelectedIds(new Set());
        setSelectAllMatchingActive(false);
    }

    // ── Send flow ────────────────────────────────────────────────────────────
    async function handleOpenSendModal() {
        if (!dbName || !schema || !branchId || selectedIds.size === 0) return;
        setLoadingGroups(true);
        try {
            const res = await apolloClient.query<GenericQueryData<Omit<GroupableJobRow, "id"> & { job_id: number }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_JOBS_FOR_WHATSAPP_COMPLETION,
                        sqlArgs: { branch_id: branchId, job_ids: [...selectedIds] },
                    }),
                },
            });
            const detailRows = res.data?.genericQuery ?? [];
            const groups = groupRowsByCustomer(detailRows.map(r => ({ ...r, id: r.job_id })));
            if (groups.length === 0) {
                toast.error(MESSAGES.INFO_WHATSAPP_NO_ELIGIBLE_JOBS);
                return;
            }
            setSendGroups(groups);
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_JOBS_LOAD_FAILED);
        } finally {
            setLoadingGroups(false);
        }
    }

    async function handleConfirmSend(groups: CustomerGroup[]) {
        if (!dbName || !schema || !branchId) return;
        setSending(true);
        try {
            const jobIds = groups.flatMap(g => g.job_ids);
            const { results: sendResults, disabled } = await sendWhatsappCompletion(dbName, schema, branchId, jobIds);
            setSendGroups(null);
            setResults(sendResults);
            const anyFailed = sendResults.some(r => r.status === "FAILED");
            if (disabled) {
                toast.warning(MESSAGES.WARN_WHATSAPP_EVENT_DISABLED);
            } else if (sendResults.length === 0) {
                toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            } else {
                // Toast is the immediate dispatch acknowledgment (still auto-dismissing —
                // that's fine for "did the click work"); the permanent banner below tracks
                // what happens next, which a toast can't since delivery settles async.
                toast[anyFailed ? "warning" : "success"](
                    anyFailed ? MESSAGES.WARN_WHATSAPP_PARTIAL_SEND : MESSAGES.SUCCESS_WHATSAPP_SENT
                );
                const dispatchedCount = sendResults.reduce((sum, r) => sum + r.job_ids.length, 0);
                const customerCount = new Set(sendResults.map(r => r.customer_name)).size;
                setBanner({
                    stage: "dispatched",
                    dispatchedCount,
                    customerCount,
                    deliveredCount: 0,
                    pendingCount: dispatchedCount,
                    failedCount: 0,
                });
                startBannerTracking(jobIds);
            }
            handleClearSelection();
            if (branchId) void loadData(branchId, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
        } finally {
            setSending(false);
        }
    }

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header — stacks on mobile (title, then centered tabs); on sm:
                up, a 4-column grid keeps the tab group visually centered
                regardless of how wide the title/subtitle on the left is. */}
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <WhatsAppIcon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-(--cl-text) whitespace-nowrap">Customer Connect</h2>
                    <span className="text-xs text-(--cl-text-muted) whitespace-nowrap">
                        {activeTab === "completion" && `${total} eligible job${total !== 1 ? "s" : ""}`}
                        {activeTab === "intake" && `${intakeTotal} logged message${intakeTotal !== 1 ? "s" : ""}`}
                        {activeTab === "delivery" && `${deliveryTotal} logged message${deliveryTotal !== 1 ? "s" : ""}`}
                        {activeTab === "moneyReceipt" && `${moneyReceiptTotal} logged message${moneyReceiptTotal !== 1 ? "s" : ""}`}
                    </span>
                </div>

                <div className="grid grid-cols-4 gap-2.5 rounded-xl border-2 border-(--cl-border) bg-(--cl-surface-2) p-1 shadow-md sm:mx-auto sm:flex sm:w-auto">
                    {/* Job Completion is the only tab that actually sends —
                        the WhatsApp icon marks it as the "live" action tab
                        even when it's not the one currently active, so it
                        never reads as just another identical log tab. */}
                    <button
                        className={`h-9 gap-1.5 px-2 sm:px-4 text-xs sm:text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer inline-flex items-center justify-center ${activeTab === "completion"
                                ? "bg-emerald-600 text-white font-bold shadow-lg sm:scale-105 hover:brightness-110"
                                : "bg-transparent text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-800 hover:text-white hover:bg-emerald-600 hover:ring-emerald-600 sm:hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("completion")}
                    >
                        <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                        Job Completion
                    </button>
                    <button
                        className={`h-9 px-2 sm:px-4 text-xs sm:text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer ${activeTab === "intake"
                                ? "bg-sky-600 text-white font-bold shadow-lg sm:scale-105 hover:brightness-110"
                                : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-sky-600 sm:hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("intake")}
                    >
                        Job Intake
                    </button>
                    <button
                        className={`h-9 px-2 sm:px-4 text-xs sm:text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer ${activeTab === "delivery"
                                ? "bg-violet-600 text-white font-bold shadow-lg sm:scale-105 hover:brightness-110"
                                : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-violet-600 sm:hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("delivery")}
                    >
                        Job Delivery
                    </button>
                    <button
                        className={`h-9 px-2 sm:px-4 text-xs sm:text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer ${activeTab === "moneyReceipt"
                                ? "bg-amber-600 text-white font-bold shadow-lg sm:scale-105 hover:brightness-110"
                                : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-amber-600 sm:hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("moneyReceipt")}
                    >
                        Money Receipt
                    </button>
                </div>
            </div>

            {/* Job Intake — read-only log, no send controls */}
            {activeTab === "intake" && (
                <WhatsappLogSection
                    eventKey="JOB_CREATION"
                    emptyMessage="No Job Intake messages have been sent yet."
                    onCountChange={setIntakeTotal}
                />
            )}

            {/* Job Delivery — read-only log, no send controls */}
            {activeTab === "delivery" && (
                <WhatsappLogSection
                    eventKey="JOB_DELIVERY"
                    emptyMessage="No Job Delivery messages have been sent yet."
                    onCountChange={setDeliveryTotal}
                />
            )}

            {/* Money Receipt — read-only log, no send controls */}
            {activeTab === "moneyReceipt" && (
                <MoneyReceiptLogSection
                    emptyMessage="No Money Receipt messages have been sent yet."
                    onCountChange={setMoneyReceiptTotal}
                />
            )}

            {/* Job Completion — the only tab that actually sends; unchanged below */}
            {activeTab === "completion" && (
            <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <Input
                        className="h-8 border-(--cl-border) bg-white pl-8 pr-8 text-xs"
                        placeholder="Job no, customer, mobile…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                            type="button"
                            onClick={() => handleSearchChange("")}
                        >
                            <X className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <RefreshButton disabled={!branchId} loading={loading} onClick={() => { if (branchId) void loadData(branchId, searchQ, page); }} />
                    <Button
                        className="h-9 gap-2 px-4 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={selectedIds.size === 0 || loadingGroups || !branchId}
                        title={selectedIds.size === 0 ? "Select at least one job first" : undefined}
                        onClick={() => void handleOpenSendModal()}
                    >
                        {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />}
                        Send Messages {selectedIds.size > 0 ? `(${selectedIds.size} job${selectedIds.size !== 1 ? "s" : ""})` : ""}
                    </Button>
                </div>
            </div>

            {banner && (
                <Alert className="relative pr-10" variant={banner.failedCount > 0 ? "warning" : "default"}>
                    <AlertTitle className="mb-0">
                        {banner.stage === "dispatched"
                            ? `${banner.dispatchedCount} dispatched to ${banner.customerCount} customer${banner.customerCount !== 1 ? "s" : ""}. Awaiting delivery confirmation…`
                            : `${banner.deliveredCount} delivered · ${banner.pendingCount} pending · ${banner.failedCount} failed`}
                    </AlertTitle>
                    <button
                        aria-label="Dismiss"
                        className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded text-(--cl-text-muted) hover:bg-(--cl-border)/50 hover:text-(--cl-text)"
                        type="button"
                        onClick={() => { setBanner(null); stopBannerTracking(); }}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </Alert>
            )}

            <CustomerConnectGrid
                rows={rows}
                loading={loading}
                total={total}
                page={page}
                setPage={setPage}
                selectedIds={selectedIds}
                selectAllMatchingActive={selectAllMatchingActive}
                selectAllMatchingLoading={selectAllMatchingLoading}
                onSelectionChange={handleSelectionChange}
                onSelectAllOnPage={handleSelectAllOnPage}
                onSelectAllMatching={() => void handleSelectAllMatching()}
                onClearSelection={handleClearSelection}
                onViewJob={id => setViewJobId(id)}
            />

            {viewJobId !== null && (
                <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
            )}

            <SendMessagesModal
                isOpen={sendGroups !== null}
                groups={sendGroups ?? []}
                sending={sending}
                onClose={() => setSendGroups(null)}
                onConfirm={groups => void handleConfirmSend(groups)}
            />

            <SendResultsDialog
                isOpen={results !== null}
                results={results ?? []}
                onClose={() => setResults(null)}
            />
            </>
            )}
        </motion.div>
    );
}
