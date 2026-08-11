import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { PAGE_SIZE, getCompletionState, groupRowsByCustomer, isRowSelectable, type GroupableJobRow } from "./customer-connect-helpers";
import type { CustomerConnectJobRow, CustomerGroup } from "./customer-connect-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

export function CustomerConnectSection() {
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

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

            // Every eligible row starts checked; a row already messaged starts
            // unchecked — a resend must be a deliberate click (plan §5e).
            if (!selectAllMatchingActive) {
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    for (const row of newRows) {
                        if (isRowSelectable(row) && (getCompletionState(row)?.success_count ?? 0) === 0) {
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
            const sendResults = await sendWhatsappCompletion(dbName, schema, branchId, jobIds);
            setSendGroups(null);
            setResults(sendResults);
            const anyFailed = sendResults.some(r => r.status === "FAILED");
            if (sendResults.length === 0) {
                toast.error(MESSAGES.ERROR_WHATSAPP_SEND_FAILED);
            } else if (anyFailed) {
                toast.warning(MESSAGES.WARN_WHATSAPP_PARTIAL_SEND);
            } else {
                toast.success(MESSAGES.SUCCESS_WHATSAPP_SENT);
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
            {/* Header */}
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                    <WhatsAppIcon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-(--cl-text)">Customer Connect</h2>
                <span className="text-xs text-(--cl-text-muted)">{total} eligible job{total !== 1 ? "s" : ""}</span>
            </div>

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
                <Button className="h-8 px-2.5 text-xs" disabled={loading || !branchId} size="sm" variant="outline" onClick={() => { if (branchId) void loadData(branchId, searchQ, page); }}>
                    <RefreshCw className="mr-1.5 h-3 w-3 text-blue-600" /> Refresh
                </Button>
                <div className="ml-auto">
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
        </motion.div>
    );
}
