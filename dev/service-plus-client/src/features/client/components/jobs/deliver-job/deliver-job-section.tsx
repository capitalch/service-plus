import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES }    from "@/constants/messages";
import { SQL_MAP }     from "@/constants/sql-map";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient }   from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectAvailableDivisions, selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { JobAttachDialog } from "../single-job/job-attach-dialog";
import { JobDetailsModal } from "../job-pipeline/job-details-modal";

import { PAGE_SIZE, DEBOUNCE_MS } from "./deliver-job-helpers";
import { DeliverableJobsGrid, type DeliverableJobRow } from "./deliverable-jobs-grid";
import { DeliveredJobsGrid, type DeliveredJobRow } from "./delivered-jobs-grid";
import { DeliveryModal } from "./delivery-modal";
import type { JobDeliveryFullDetail } from "./deliver-job-schema";

// ── Local types ───────────────────────────────────────────────────────────────

type ActiveTab = "deliverable" | "delivered";

type GenericQueryData<T> = { genericQuery: T[] | null };

type DeliveryMannerRow = { id: number; name: string };
type JobStatusRow      = { id: number; code: string; name: string };

// ── Component ─────────────────────────────────────────────────────────────────

export const DeliverJobSection = () => {
    const dbName             = useAppSelector(selectDbName);
    const schema             = useAppSelector(selectSchema);
    const currentBranch      = useAppSelector(selectCurrentBranch);
    const currentUser        = useAppSelector(selectCurrentUser);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const branchId           = currentBranch?.id ?? null;

    // ── List state ────────────────────────────────────────────────────────────
    const [activeTab,  setActiveTab]  = useState<ActiveTab>("deliverable");
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

    // ── Meta ──────────────────────────────────────────────────────────────────
    const [deliveryManners,   setDeliveryManners]   = useState<DeliveryMannerRow[]>([]);
    const [deliveredStatusId, setDeliveredStatusId] = useState<number | null>(null);
    const [metaLoaded,        setMetaLoaded]        = useState(false);

    // ── Multi-selection + modal state ─────────────────────────────────────────
    const [selectedIds,       setSelectedIds]       = useState<Set<number>>(new Set());
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [modalJobDetails,   setModalJobDetails]   = useState<JobDeliveryFullDetail[]>([]);
    const [loadingModal,      setLoadingModal]      = useState(false);

    // ── Misc ──────────────────────────────────────────────────────────────────
    const [attachJobId,  setAttachJobId]  = useState<number | null>(null);
    const [attachJobNo,  setAttachJobNo]  = useState<string>("");
    const [viewJobId,    setViewJobId]    = useState<number | null>(null);

    const debounceRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
    const deliveredDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Load meta once ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!dbName || !schema || metaLoaded) return;
        Promise.all([
            apolloClient.query<GenericQueryData<DeliveryMannerRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_DELIVERY_MANNERS }) },
            }),
            apolloClient.query<GenericQueryData<JobStatusRow>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_STATUSES }) },
            }),
        ]).then(([mannerRes, statusRes]) => {
            setDeliveryManners(mannerRes.data?.genericQuery ?? []);
            const delivered = (statusRes.data?.genericQuery ?? []).find(s => s.code === "DELIVERED");
            setDeliveredStatusId(delivered?.id ?? null);
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
        console.log("rows", rows);
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
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    function handleDeliveredSearchChange(value: string) {
        setDeliveredSearch(value);
        if (deliveredDebounceRef.current) clearTimeout(deliveredDebounceRef.current);
        deliveredDebounceRef.current = setTimeout(() => { setDeliveredPage(1); setDeliveredSearchQ(value); }, DEBOUNCE_MS);
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

    // ── Open delivery modal for single job ────────────────────────────────────
    async function handleDeliverSingle(row: DeliverableJobRow) {
        if (selectedIds.size > 0) { void handleOpenDeliveryModal(); return; }
        if (!dbName || !schema) return;
        setLoadingModal(true);
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
            setLoadingModal(false);
        }
    }

    // ── Open delivery modal for multiple selected jobs ─────────────────────────
    async function handleOpenDeliveryModal() {
        if (!dbName || !schema || selectedIds.size === 0) return;
        setLoadingModal(true);
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
            setLoadingModal(false);
        }
    }

    // ── After delivery ────────────────────────────────────────────────────────
    function handleDeliverySaved() {
        setShowDeliveryModal(false);
        setModalJobDetails([]);
        setSelectedIds(new Set());
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
                    rows={deliveredRows}
                    loading={deliveredLoading}
                    total={deliveredTotal}
                    page={deliveredPage}
                    search={deliveredSearch}
                    branchId={branchId}
                    availableDivisions={availableDivisions}
                    setPage={setDeliveredPage}
                    onSearch={handleDeliveredSearchChange}
                    onRefresh={() => void loadDeliveredData()}
                    onViewJob={id => setViewJobId(id)}
                    onOpenAttach={(id, jobNo) => { setAttachJobId(id); setAttachJobNo(jobNo); }}
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

            {showDeliveryModal && modalJobDetails.length > 0 && (
                <DeliveryModal
                    jobs={modalJobDetails}
                    branchId={branchId}
                    deliveryManners={deliveryManners}
                    availableDivisions={availableDivisions}
                    deliveredStatusId={deliveredStatusId}
                    currentUser={currentUser}
                    dbName={dbName}
                    schema={schema}
                    onClose={() => { setShowDeliveryModal(false); setModalJobDetails([]); }}
                    onDelivered={handleDeliverySaved}
                />
            )}
        </motion.div>
    );
};
