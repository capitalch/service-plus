import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { SalesInvoicePostUnpostRow, PostUnpostStats } from "./post-unpost-schema";

type GenericQueryData<T> = { genericQuery: T[] | null };

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1600;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

function fmtAmt(n: number) {
    return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
    pendingChanges: Map<number, boolean>;
    onChangeToggle: (id: number, currentDbValue: boolean) => void;
    onStatsLoaded:  (stats: PostUnpostStats) => void;
    onRowsLoaded:   (ids: number[]) => void;
    refreshTrigger: number;
};

export function SalesInvoicesPostUnpostGrid({ pendingChanges, onChangeToggle, onStatsLoaded, onRowsLoaded, refreshTrigger }: Props) {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id;

    const [search,  setSearch]  = useState("");
    const [searchQ, setSearchQ] = useState("");
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);
    const [total,   setTotal]   = useState(0);
    const [rows,    setRows]    = useState<SalesInvoicePostUnpostRow[]>([]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    };

    const loadData = useCallback(async (bId: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const args = { branch_id: bId, search: q };
            const [dataRes, countRes, statsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<SalesInvoicePostUnpostRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_SALES_INVOICES_POST_UNPOST_PAGED, sqlArgs: { ...args, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE } }) },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_SALES_INVOICES_POST_UNPOST_COUNT, sqlArgs: args }) },
                }),
                apolloClient.query<GenericQueryData<PostUnpostStats>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_SALES_INVOICES_POST_UNPOST_STATS, sqlArgs: args }) },
                }),
            ]);
            const loaded = dataRes.data?.genericQuery ?? [];
            const count  = countRes.data?.genericQuery?.[0]?.total ?? 0;
            const stats  = statsRes.data?.genericQuery?.[0];
            setRows(loaded);
            setTotal(count);
            onRowsLoaded(loaded.map(r => r.id));
            if (stats) onStatsLoaded(stats);
        } catch {
            toast.error("Failed to load sales invoices.");
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, onRowsLoaded, onStatsLoaded]);

    useEffect(() => {
        if (branchId) void loadData(branchId, searchQ, page);
    }, [branchId, searchQ, page, refreshTrigger, loadData]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 py-2">
                <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                    <Input className="h-8 border-(--cl-border) bg-(--cl-surface) pl-8 text-xs" placeholder="Invoice no, customer" value={search} onChange={e => handleSearchChange(e.target.value)} />
                    {search && (
                        <button className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface)" type="button" onClick={() => handleSearchChange("")}>
                            <X className="h-2.5 w-2.5" />
                        </button>
                    )}
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => { if (branchId) void loadData(branchId, searchQ, page); }}>
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border)">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {loading ? (
                        <table className="min-w-full border-collapse"><tbody>{Array.from({ length: 8 }).map((_, i) => (<tr key={i} className="animate-pulse">{Array.from({ length: 8 }).map((__, j) => (<td key={j} className={tdClass}><div className="h-4 w-20 rounded bg-(--cl-border)" /></td>))}</tr>))}</tbody></table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">No sales invoices found.</div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Invoice No</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Division</th>
                                    <th className={thClass}>GST Type</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={thClass}>Posted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const pending   = pendingChanges.has(row.id);
                                    const displayed = pending ? pendingChanges.get(row.id)! : row.is_posted;
                                    return (
                                        <tr key={row.id} className={`transition-colors hover:bg-(--cl-accent)/5 ${pending ? "bg-amber-50 dark:bg-amber-900/10" : ""}`}>
                                            <td className={tdClass}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td className={`${tdClass} font-medium`}>{row.invoice_no}</td>
                                            <td className={tdClass}>{row.invoice_date}</td>
                                            <td className={tdClass}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{row.customer_name}</span>
                                                    {row.customer_gstin && (
                                                        <span className="font-mono text-[10px] text-(--cl-text-muted)">GSTIN: {row.customer_gstin}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={tdClass}>{row.division_name}</td>
                                            <td className={tdClass}>
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${row.gst_type === 'GST' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{row.gst_type}</span>
                                            </td>
                                            <td className={`${tdClass} text-right`}>{fmtAmt(row.total_amount)}</td>
                                            <td className={tdClass}>
                                                <input type="checkbox" className="cursor-pointer accent-(--cl-accent)" checked={displayed} onChange={() => onChangeToggle(row.id, row.is_posted)} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                <span className="text-xs text-(--cl-text-muted)">{total === 0 ? "No records" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} (Page ${page} of ${totalPages})`}</span>
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</Button>
                    <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>‹</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>›</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</Button>
                </div>
            </div>
        </div>
    );
}
