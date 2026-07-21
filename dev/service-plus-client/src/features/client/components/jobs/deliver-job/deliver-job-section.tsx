import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES }    from "@/constants/messages";
import { SQL_MAP }     from "@/constants/sql-map";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient }   from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectPostDataToAccounts, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";
import { useDeliveredJobActions } from "./use-delivered-job-actions";

import { PAGE_SIZE } from "./deliver-job-helpers";
import { DeliverableJobsGrid, type DeliverableJobRow } from "./deliverable-jobs-grid";
import { DeliveredJobsGrid, type DeliveredJobRow } from "./delivered-jobs-grid";
import { DeliveryModal } from "./delivery-modal";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";
import type { GridRetentionHandle } from "../use-grid-row-retention";

// ── Local types ───────────────────────────────────────────────────────────────

type ActiveTab = "deliverable" | "delivered";

type GenericQueryData<T> = { genericQuery: T[] | null };

type DeliveryMannerRow = { id: number; name: string };

// ── Component ─────────────────────────────────────────────────────────────────

interface DeliverJobSectionProps {
    onBack?: () => void;
    initialTab?: "deliverable" | "delivered";
}

export const DeliverJobSection = ({ onBack, initialTab }: DeliverJobSectionProps = {}) => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const currentUser        = useAppSelector(selectCurrentUser);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const postDataToAccounts = useAppSelector(selectPostDataToAccounts);
    const branchId           = currentBranch?.id ?? null;

    const deliveredActions = useDeliveredJobActions();

    // ── List state ────────────────────────────────────────────────────────────
    const [activeTab,  setActiveTab]  = useState<ActiveTab>(initialTab ?? "deliverable");
    const [search,     setSearch]     = useState("");
    const [searchQ,    setSearchQ]    = useState("");
    const [page,       setPage]       = useState(1);
    const [rows,       setRows]       = useState<DeliverableJobRow[]>([]);
    const [total,      setTotal]      = useState(0);
    const [loading,    setLoading]    = useState(false);

    // ── Delivered jobs tab state ──────────────────────────────────────────────
    const [deliveredRows,    setDeliveredRows]    = useState<DeliveredJobRow[]>([]);
    const [deliveredTotal,   setDeliveredTotal]   = useState(0);
    const [deliveredPage,    setDeliveredPage]    = useState(1);
    const [deliveredSearch,  setDeliveredSearch]  = useState("");
    const [deliveredSearchQ, setDeliveredSearchQ] = useState("");
    const [deliveredLoading, setDeliveredLoading] = useState(false);
    // Kept as a Map (not just a Set<id>) so mobile/delivery_date are still
    // available to validate the selection regardless of pagination.
    const [selectedDeliveredRows, setSelectedDeliveredRows] = useState<Map<number, DeliveredJobRow>>(new Map());

    // ── Meta ──────────────────────────────────────────────────────────────────
    const [deliveryManners,          setDeliveryManners]          = useState<DeliveryMannerRow[]>([]);
    const [showPartsInInvoiceSetting, setShowPartsInInvoiceSetting] = useState<{ show: boolean; text: string; hsn: number; gst_rate: number } | null>(null);
    const [metaLoaded,               setMetaLoaded]               = useState(false);

    // ── Multi-selection + modal state ─────────────────────────────────────────
    const [selectedIds,       setSelectedIds]       = useState<Set<number>>(new Set());
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [modalJobDetails,   setModalJobDetails]   = useState<JobDeliveryFullDetail[]>([]);
    const [loadingModal,      setLoadingModal]      = useState<number | null>(null);

    // ── Misc ──────────────────────────────────────────────────────────────────
    const [attachJobId,  setAttachJobId]  = useState<number | null>(null);
    const [attachJobNo,  setAttachJobNo]  = useState<string>("");
    const [viewJobId,    setViewJobId]    = useState<number | null>(null);

    const debounceRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliveredDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliverableGridRef   = useRef<GridRetentionHandle>(null);
    const deliveredGridRef     = useRef<GridRetentionHandle>(null);

    // ── Load meta once ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<DeliveryMannerRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_MANNERS }) },
            }),
            apolloClient.query<GenericQueryData<{ setting_value: unknown }>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTING_BY_KEY, sqlArgs: { setting_key: "show_parts_in_job_invoice" } }) },
            }),
        ]).then(([mannerRes, showPartsRes]) => {
            setDeliveryManners(mannerRes.data?.genericQuery ?? []);
            const sv = showPartsRes.data?.genericQuery?.[0]?.setting_value;
            if (sv != null && typeof sv === "object")
                setShowPartsInInvoiceSetting(sv as { show: boolean; text: string; hsn: number; gst_rate: number });
            setMetaLoaded(true);
        }).catch(() => toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED));
    }, [dbName, schema, metaLoaded]);

    // ── Load deliverable jobs ─────────────────────────────────────────────────
    const loadData = useCallback(async (bid: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        const commonArgs = { branch_id: bid, search: q };

        const rowsPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_PAGED,
                    sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                }),
            },
        }).then(res => setRows((res.data as GenericQueryData<DeliverableJobRow>).genericQuery ?? []));

        const countPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName, schema,
                value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERABLE_JOBS_COUNT, sqlArgs: commonArgs }),
            },
        }).then(res => setTotal(Number((res.data as GenericQueryData<{ total: number }>).genericQuery?.[0]?.total ?? 0)));

        const results = await Promise.allSettled([rowsPromise, countPromise]);
        if (results.some(r => r.status === "rejected")) toast.error(MESSAGES.ERROR_DELIVERABLE_JOBS_LOAD_FAILED);
        setLoading(false);
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || activeTab !== "deliverable") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData(branchId, searchQ, page).catch(() => {});
    }, [branchId, searchQ, page, loadData, activeTab]);

    // ── Load delivered jobs ───────────────────────────────────────────────────
    const loadDeliveredData = useCallback(async () => {
        if (!branchId || !dbName || !schema) return;
        setDeliveredLoading(true);
        const args = {
            branch_id: branchId,
            search:    deliveredSearchQ,
            limit:     PAGE_SIZE,
            offset:    (deliveredPage - 1) * PAGE_SIZE,
        };

        const countPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERED_JOBS_COUNT, sqlArgs: args }) },
        }).then(res => setDeliveredTotal(Number((res.data as GenericQueryData<{ total: number }>).genericQuery?.[0]?.total ?? 0)));

        const rowsPromise = apolloClient.query({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_DELIVERED_JOBS_PAGED, sqlArgs: args }) },
        }).then(res => setDeliveredRows((res.data as GenericQueryData<DeliveredJobRow>).genericQuery ?? []));

        const results = await Promise.allSettled([countPromise, rowsPromise]);
        if (results.some(r => r.status === "rejected")) toast.error("Failed to load delivered jobs. Please try again.");
        setDeliveredLoading(false);
    }, [branchId, dbName, schema, deliveredSearchQ, deliveredPage]);

    useEffect(() => {
        if (activeTab === "delivered") void loadDeliveredData();
    }, [activeTab, loadDeliveredData]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, SEARCH_DEBOUNCE_MS);
    }

    function handleDeliveredSearchChange(value: string) {
        setDeliveredSearch(value);
        if (deliveredDebounceRef.current) clearTimeout(deliveredDebounceRef.current);
        deliveredDebounceRef.current = setTimeout(() => { setDeliveredPage(1); setDeliveredSearchQ(value); }, SEARCH_DEBOUNCE_MS);
    }

    // ── Selection handlers ────────────────────────────────────────────────────
    function handleSelectionChange(id: number, checked: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }

    function handleSelectAll(checked: boolean) {
        if (checked) {
            setSelectedIds(new Set(rows.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    }

    // Constrains multi-select on the Delivered Jobs tab to jobs for the same
    // customer (by mobile — this grid has no real customer id) and the same
    // delivery date, so they can be combined into one delivery note.
    function handleDeliveredSelectionChange(row: DeliveredJobRow, checked: boolean) {
        setSelectedDeliveredRows(prev => {
            const next = new Map(prev);
            if (!checked) { next.delete(row.id); return next; }
            const reference = next.values().next().value;
            if (reference && (reference.mobile !== row.mobile || reference.delivery_date !== row.delivery_date)) {
                toast.error("Select jobs for the same customer and delivery date to combine into one delivery note.");
                return prev;
            }
            next.set(row.id, row);
            return next;
        });
    }

    // ── Open delivery modal for single job ────────────────────────────────────
    async function handleDeliverSingle(row: DeliverableJobRow) {
        if (selectedIds.size > 0) { void handleOpenDeliveryModal(); return; }
        if (!dbName || !schema) return;
        setLoadingModal(row.id);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                        sqlArgs: { job_ids: [row.id] },
                    }),
                },
            });
            const details = res.data?.genericQuery ?? [];
            if (details.length === 0) { toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED); return; }
            setModalJobDetails(details);
            setShowDeliveryModal(true);
        } catch {
            toast.error(MESSAGES.ERROR_JOB_DELIVERY_DETAIL_FAILED);
        } finally {
            setLoadingModal(null);
        }
    }

    // ── Open delivery modal for multiple selected jobs ─────────────────────────
    async function handleOpenDeliveryModal() {
        if (!dbName || !schema || selectedIds.size === 0) return;
        setLoadingModal(-1);
        try {
            const res = await apolloClient.query<GenericQueryData<JobDeliveryFullDetail>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DELIVERABLE_JOBS_DETAIL_MULTI,
                        sqlArgs: { job_ids: [...selectedIds] },
                    }),
                },
            });
            const details = res.data?.genericQuery ?? [];
            if (details.length === 0) { toast.error("No job details found. Please try again."); return; }
            setModalJobDetails(details);
            setShowDeliveryModal(true);
        } catch {
            toast.error("Failed to load job details. Please try again.");
        } finally {
            setLoadingModal(null);
        }
    }

    // ── After delivery ────────────────────────────────────────────────────────
    function handleDeliverySaved() {
        setShowDeliveryModal(false);
        setModalJobDetails([]);
        setSelectedIds(new Set());
        deliverableGridRef.current?.armRestore();
        if (branchId) void loadData(branchId, searchQ, page);
        void loadDeliveredData();
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                {onBack && (
                    <Button
                        className="h-8 gap-1.5 px-3 font-semibold text-(--cl-accent) border border-(--cl-accent) hover:bg-(--cl-accent) hover:text-white transition-colors shrink-0"
                        size="sm"
                        variant="outline"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                )}
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-(--cl-text)">Deliver Job</h1>
                        <span className="text-xs text-(--cl-text-muted)">
                            {activeTab === "deliverable"
                                ? (loading ? "Loading…" : `(${total})`)
                                : (deliveredLoading ? "Loading…" : `(${deliveredTotal})`)}
                        </span>
                    </div>
                </div>

                <div className="flex-1" />

                {loadingModal && (
                    <Loader2 className="h-4 w-4 animate-spin text-(--cl-accent)" />
                )}

                <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-(--cl-border) bg-(--cl-surface-2) p-1 shadow-md mr-44">
                    <button
                        className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer ${activeTab === "deliverable"
                                ? "bg-emerald-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                                : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-emerald-600 hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("deliverable")}
                    >
                        Deliver Job
                    </button>
                    <button
                        className={`h-9 gap-2 px-4 text-sm transition-transform duration-200 rounded-lg border-0 cursor-pointer ${activeTab === "delivered"
                                ? "bg-sky-600 text-white font-bold shadow-lg scale-105 hover:brightness-110"
                                : "bg-transparent text-(--cl-text-muted) hover:text-white hover:bg-sky-600 hover:scale-105 font-semibold"
                            }`}
                        onClick={() => setActiveTab("delivered")}
                    >
                        Delivered Jobs
                    </button>
                </div>
            </div>

            {/* Deliverable tab */}
            {activeTab === "deliverable" && (
                <DeliverableJobsGrid
                    ref={deliverableGridRef}
                    rows={rows}
                    loading={loading}
                    total={total}
                    page={page}
                    search={search}
                    branchId={branchId}
                    availableDivisions={availableDivisions}
                    loadingDetail={loadingModal}
                    selectedIds={selectedIds}
                    setPage={setPage}
                    onSearch={handleSearchChange}
                    onRefresh={() => { if (branchId) void loadData(branchId, searchQ, page); }}
                    onViewJob={id => setViewJobId(id)}
                    onDeliver={handleDeliverSingle}
                    onOpenAttach={(id, jobNo) => { setAttachJobId(id); setAttachJobNo(jobNo); }}
                    onSelectionChange={handleSelectionChange}
                    onSelectAll={handleSelectAll}
                    onDeliverSelected={() => void handleOpenDeliveryModal()}
                />
            )}

            {/* Delivered Jobs tab */}
            {activeTab === "delivered" && (
                <DeliveredJobsGrid
                    ref={deliveredGridRef}
                    rows={deliveredRows}
                    loading={deliveredLoading}
                    total={deliveredTotal}
                    page={deliveredPage}
                    search={deliveredSearch}
                    branchId={branchId}
                    availableDivisions={availableDivisions}
                    setPage={setDeliveredPage}
                    postDataToAccounts={postDataToAccounts}
                    onSearch={handleDeliveredSearchChange}
                    onRefresh={() => void loadDeliveredData()}
                    onViewJob={id => setViewJobId(id)}
                    onOpenAttach={(id, jobNo) => { setAttachJobId(id); setAttachJobNo(jobNo); }}
                    onPrintInvoiceReceipts={row => void deliveredActions.handleInvoiceReceipts(row)}
                    onDeliveryNote={row => void deliveredActions.handleDeliveryNote(row)}
                    onUndoDelivery={row => {
                        if (row.invoice_is_posted) {
                            toast.error(`Cannot undo delivery — invoice ${row.invoice_no ? `#${row.invoice_no}` : ""} is already posted to accounts.`);
                            return;
                        }
                        deliveredActions.handleUndoDelivery(row);
                    }}
                    selectedIds={new Set(selectedDeliveredRows.keys())}
                    onSelectionChange={handleDeliveredSelectionChange}
                    onPrintCombinedNote={() => {
                        void deliveredActions.handleCombinedDeliveryNote(Array.from(selectedDeliveredRows.values()));
                        setSelectedDeliveredRows(new Map());
                    }}
                />
            )}

            {attachJobId !== null && (
                <JobAttachDialog
                    jobId={attachJobId}
                    jobNo={attachJobNo}
                    onClose={() => { setAttachJobId(null); setAttachJobNo(""); }}
                    onFilesChanged={count => {
                        setRows(prev => prev.map(r => r.id === attachJobId ? { ...r, file_count: count } : r));
                    }}
                />
            )}

            {viewJobId !== null && (
                <JobDetailsModal
                    jobId={viewJobId}
                    onClose={() => setViewJobId(null)}
                />
            )}

            {deliveredActions.renderModals(() => {
                deliveredGridRef.current?.armRestore();
                void loadDeliveredData();
                if (branchId) void loadData(branchId, searchQ, page);
            })}

            {showDeliveryModal && modalJobDetails.length > 0 && (
                <DeliveryModal
                    jobs={modalJobDetails}
                    branchId={branchId}
                    branchName={currentBranch?.name ?? null}
                    deliveryManners={deliveryManners}
                    availableDivisions={availableDivisions}
                    currentUser={currentUser}
                    dbName={dbName}
                    schema={schema}
                    showPartsInInvoiceSetting={showPartsInInvoiceSetting}
                    onClose={() => { setShowDeliveryModal(false); setModalJobDetails([]); }}
                    onDelivered={handleDeliverySaved}
                />
            )}
        </motion.div>
    );
};
