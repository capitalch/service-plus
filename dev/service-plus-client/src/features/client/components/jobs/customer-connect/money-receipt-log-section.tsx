import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/shared/refresh-button";
import { Input } from "@/components/ui/input";
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
import { MoneyReceiptLogGrid } from "./money-receipt-log-grid";
import { PAGE_SIZE } from "./customer-connect-helpers";
import type { MoneyReceiptLogRow } from "./customer-connect-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

// Read-only log tab — Money Receipt (plans/plan.md, Step 5). Same
// toolbar/pagination/skeleton chrome as whatsapp-log-section.tsx, no
// `eventKey` prop (this tab only ever shows JOB_MONEY_RECEIPT), and its own
// paged/count SQL since JOB_MONEY_RECEIPT's array shape needs a lateral
// join whatsapp-log-section.tsx's flat-object query doesn't. No selection,
// no send, no live subscription — same "refresh is the only way this data
// updates" precedent whatsapp-log-section.tsx already established.
//
// No header of its own — the active tab button already identifies which
// log this is, and the count is surfaced by the parent
// (customer-connect-section.tsx) next to the shared "Customer Connect"
// title via `onCountChange`, same one-subtitle-line-total pattern the other
// three tabs already share.
type Props = {
    emptyMessage:  string;
    onCountChange: (total: number) => void;
};

export function MoneyReceiptLogSection({ emptyMessage, onCountChange }: Props) {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const [rows,    setRows]    = useState<MoneyReceiptLogRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);
    const [search,  setSearch]  = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [viewJobId, setViewJobId] = useState<number | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadData = useCallback(async (branch: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branch, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<MoneyReceiptLogRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_MONEY_RECEIPT_WHATSAPP_LOG_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_JOB_MONEY_RECEIPT_WHATSAPP_LOG_COUNT, sqlArgs: commonArgs }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            const newTotal = countRes.data?.genericQuery?.[0]?.total ?? 0;
            setTotal(newTotal);
            onCountChange(newTotal);
        } catch {
            toast.error(MESSAGES.ERROR_WHATSAPP_JOBS_LOAD_FAILED);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, onCountChange]);

    useEffect(() => {
        if (branchId) void loadData(branchId, searchQ, page);
    }, [branchId, searchQ, page, loadData]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, SEARCH_DEBOUNCE_MS);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {/* Toolbar — search + refresh only, no send controls */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <Input
                        className="h-8 border-(--cl-border) bg-white pl-8 pr-8 text-xs"
                        placeholder="Job no, receipt no, customer, mobile…"
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
                    <RefreshButton disabled={!branchId} loading={loading} onClick={() => { if (branchId) void loadData(branchId, searchQ, page); }} />
            </div>

            <MoneyReceiptLogGrid
                rows={rows}
                loading={loading}
                total={total}
                page={page}
                setPage={setPage}
                emptyMessage={emptyMessage}
                onViewJob={id => setViewJobId(id)}
            />

            {viewJobId !== null && (
                <JobDetailsModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
            )}
        </div>
    );
}
