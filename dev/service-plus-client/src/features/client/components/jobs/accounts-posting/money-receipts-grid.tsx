import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, RefreshCw, Search, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobPaymentPostingRow } from "./accounts-posting-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

function fmtAmt(n: number) {
    return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
    isPosted:          boolean;
    selectedIds:       Set<number>;
    onSelectionChange: (newSet: Set<number>) => void;
    onRowsLoaded:      (ids: number[]) => void;
    onTotalChange:     (total: number) => void;
};

export function MoneyReceiptsGrid({ isPosted, selectedIds, onSelectionChange, onRowsLoaded, onTotalChange }: Props) {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id;

    const [search,  setSearch]  = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);
    const [total,   setTotal]   = useState(0);
    const [rows,    setRows]    = useState<JobPaymentPostingRow[]>([]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const loadData = useCallback(async (bId: number, q: string, pg: number, posted: boolean) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const args = { branch_id: bId, is_posted: posted, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobPaymentPostingRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_PAYMENTS_FOR_POSTING_PAGED,
                            sqlArgs: { ...args, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_PAYMENTS_FOR_POSTING_COUNT,
                            sqlArgs: args,
                        }),
                    },
                }),
            ]);
            const loaded = dataRes.data?.genericQuery ?? [];
            const count = countRes.data?.genericQuery?.[0]?.total ?? 0;
            setRows(loaded);
            setTotal(count);
            onRowsLoaded(loaded.map(r => r.id));
            onTotalChange(count);
        } catch {
            toast.error("Failed to load money receipts.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, onRowsLoaded, onTotalChange]);

    useEffect(() => {
        if (branchId) void loadData(branchId, searchQ, page, isPosted);
    }, [branchId, searchQ, page, isPosted, loadData]);

    const handleTogglePosted = async (row: JobPaymentPostingRow) => {
        if (!dbName || !schema) return;
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName, schema,
                    value: encodeObj({ tableName: "job_payment", xData: { id: row.id, is_posted: !row.is_posted } }),
                },
            });
            toast.success(row.is_posted ? "Receipt unposted." : "Receipt posted.");
            if (branchId) void loadData(branchId, searchQ, page, isPosted);
        } catch {
            toast.error("Failed to update posting status.");
        }
    };

    const toggleRow = (id: number) => {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        onSelectionChange(next);
    };

    const allPageSelected  = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const somePageSelected = rows.some(r => selectedIds.has(r.id));

    const toggleAllPage = () => {
        const next = new Set(selectedIds);
        if (allPageSelected) {
            rows.forEach(r => next.delete(r.id));
        } else {
            rows.forEach(r => next.add(r.id));
        }
        onSelectionChange(next);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <motion.div animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Search bar */}
            <div className="flex flex-wrap items-center gap-2 py-2 bg-(--cl-surface-2)/30">
                <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                    <Input
                        className="h-8 border-(--cl-border) bg-(--cl-surface) pl-8 text-xs"
                        placeholder="Receipt no, job no, customer, mode"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface)" type="button" onClick={() => handleSearchChange("")}>
                            <X className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => { if (branchId) void loadData(branchId, searchQ, page, isPosted); }}>
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border)">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <tbody>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 8 }).map((__, j) => (
                                            <td key={j} className={tdClass}><div className="h-4 w-20 rounded bg-(--cl-border)" /></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                            No money receipts found.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={thClass}>
                                        <input
                                            type="checkbox"
                                            className="cursor-pointer accent-(--cl-accent)"
                                            checked={allPageSelected}
                                            ref={el => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
                                            onChange={toggleAllPage}
                                        />
                                    </th>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Receipt No</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Mode</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    {isPosted && <th className={thClass}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        className={`group transition-colors hover:bg-(--cl-accent)/5 ${selectedIds.has(row.id) ? "bg-(--cl-accent)/10" : ""}`}
                                    >
                                        <td className={tdClass}>
                                            <input
                                                type="checkbox"
                                                className="cursor-pointer accent-(--cl-accent)"
                                                checked={selectedIds.has(row.id)}
                                                onChange={() => toggleRow(row.id)}
                                            />
                                        </td>
                                        <td className={tdClass}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className={`${tdClass} font-medium`}>{row.receipt_no ?? "—"}</td>
                                        <td className={tdClass}>{row.payment_date}</td>
                                        <td className={tdClass}>{row.job_no}</td>
                                        <td className={tdClass}>{row.customer_name ?? "—"}</td>
                                        <td className={tdClass}>{row.payment_mode}</td>
                                        <td className={`${tdClass} text-right`}>{fmtAmt(row.amount)}</td>
                                        {isPosted && (
                                            <td className={`${tdClass} sticky right-0 bg-(--cl-surface) group-hover:bg-(--cl-surface-2)`}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button className="h-7 w-7 p-0" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => void handleTogglePosted(row)}>
                                                            <Undo2 className="mr-2 h-4 w-4" />Unpost
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                <span className="text-xs text-(--cl-text-muted)">
                    {total === 0 ? "No records" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} (Page ${page} of ${totalPages})`}
                </span>
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</Button>
                    <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>‹</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>›</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</Button>
                </div>
            </div>
        </motion.div>
    );
}
