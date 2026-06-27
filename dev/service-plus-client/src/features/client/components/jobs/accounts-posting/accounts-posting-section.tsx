import { useCallback, useEffect, useState } from "react";
import {
    Banknote, BookCheck, CheckCircle2, FileText, Loader2,
    RefreshCw, ShoppingCart, UploadCloud, Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

type DivisionRow = {
    division_id: number;
    division_code: string;
    division_name: string;
    money_receipts: number;
    purchase_invoices: number;
    sales_invoices: number;
    job_invoices: number;
};

type GenericQueryData = { genericQuery: DivisionRow[] | null };

// Columns shown per division. `posted` marks the two types actually pushed to Trace Plus.
const TYPE_COLUMNS: { key: keyof DivisionRow; label: string; icon: typeof FileText; tint: string; posted: boolean }[] = [
    { key: "money_receipts",    label: "Money Receipts",    icon: Banknote,     tint: "text-emerald-600", posted: true  },
    { key: "purchase_invoices", label: "Purchase Invoices", icon: ShoppingCart, tint: "text-sky-600",     posted: true  },
    { key: "sales_invoices",    label: "Sales Invoices",    icon: FileText,     tint: "text-violet-600",  posted: false },
    { key: "job_invoices",      label: "Job Invoices",      icon: Wrench,       tint: "text-amber-600",   posted: true  },
];

type PostProgress = { total: number; posted: number; failed: number; currentRef?: string | null; currentDivision?: string | null };

const num = (v: unknown) => Number(v ?? 0);

export function AccountsPostingSection() {
    const dbName   = useAppSelector(selectDbName);
    const schema   = useAppSelector(selectSchema);
    const branch   = useAppSelector(selectCurrentBranch);
    const branchId = branch?.id;

    const [divisions, setDivisions]         = useState<DivisionRow[]>([]);
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [isPosting, setIsPosting]         = useState(false);
    const [progress, setProgress]           = useState<PostProgress | null>(null);

    const loadCounts = useCallback(async (bId: number) => {
        if (!dbName || !schema) return;
        setLoadingCounts(true);
        try {
            const result = await apolloClient.query<GenericQueryData>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_UNPOSTED_COUNTS_BY_DIVISION,
                        sqlArgs: { branch_id: bId },
                    }),
                },
            });
            setDivisions(result.data?.genericQuery ?? []);
        } catch {
            toast.error("Failed to load unposted records.");
        } finally {
            setLoadingCounts(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (branchId) void loadCounts(branchId);
    }, [branchId, loadCounts]);

    // Only money receipts + purchase invoices are posted to Trace Plus.
    const postableTotal = divisions.reduce((s, d) => s + num(d.money_receipts) + num(d.purchase_invoices) + num(d.job_invoices), 0);
    const grandTotal    = divisions.reduce(
        (s, d) => s + num(d.money_receipts) + num(d.purchase_invoices) + num(d.sales_invoices) + num(d.job_invoices),
        0,
    );
    const hasPostable = postableTotal > 0;

    const handlePostDataToTracePlus = async () => {
        if (!branchId) { toast.error("No branch selected."); return; }
        if (!dbName || !schema) return;
        setIsPosting(true);
        // Seed the bar from the counts we already display, so it renders correctly
        // even before the first progress event arrives over the websocket.
        setProgress({ total: postableTotal, posted: 0, failed: 0 });

        // Subscribe to live per-record progress (branch-scoped) before firing the mutation.
        const sub = apolloClient
            .subscribe<{ accountsPostingProgress: (PostProgress & { done?: boolean }) | null }>({
                query: GRAPHQL_MAP.accountsPostingProgress,
                variables: { db_name: dbName, branchId: String(branchId) },
            })
            .subscribe({
                next: ({ data }) => {
                    const ev = data?.accountsPostingProgress;
                    if (ev) setProgress({
                        total: ev.total, posted: ev.posted, failed: ev.failed,
                        currentRef: ev.currentRef, currentDivision: ev.currentDivision,
                    });
                },
                error: () => { /* progress is best-effort; the mutation result is authoritative */ },
            });

        try {
            const result = await apolloClient.mutate<{ accountsPosting: { error?: string } | null }>({
                mutation: GRAPHQL_MAP.accountsPosting,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({ branchId }),
                },
            });
            const data = result.data?.accountsPosting;
            if (data?.error) {
                toast.error(data.error);
            } else {
                toast.success("Data posted to Trace Plus successfully.");
                void loadCounts(branchId);
            }
        } catch {
            toast.error("Failed to post data to Trace Plus.");
        } finally {
            sub.unsubscribe();
            setIsPosting(false);
            setProgress(null);
        }
    };

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                    <BookCheck className="h-4 w-4" />
                </div>
                <h1 className="text-lg font-bold text-(--cl-text)">Accounts Posting</h1>
                <button
                    disabled={loadingCounts || !branchId}
                    onClick={() => { if (branchId) void loadCounts(branchId); }}
                    className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-(--cl-border) px-3 py-1.5 text-sm font-medium text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingCounts ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* Body */}
            <div className="mx-auto w-full max-w-5xl px-6 py-8">
                {loadingCounts ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-(--cl-text-muted)" />
                    </div>
                ) : !branchId ? (
                    <p className="py-12 text-center text-sm text-(--cl-text-muted)">Select a branch to view unposted records.</p>
                ) : divisions.length === 0 ? (
                    <p className="py-12 text-center text-sm text-(--cl-text-muted)">No active divisions found for this branch.</p>
                ) : (
                    <div className="space-y-5">
                        {/* Division breakdown */}
                        <div className="overflow-hidden rounded-xl border border-(--cl-border) bg-(--cl-surface)">
                            <div className="flex items-baseline justify-between border-b border-(--cl-border) px-4 py-3">
                                <h2 className="text-sm font-semibold text-(--cl-text)">Unposted records by division</h2>
                                <span className="text-xs text-(--cl-text-muted)">{divisions.length} division{divisions.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wide text-(--cl-text-muted)">
                                            <th className="px-4 py-2.5 text-left font-medium">Division</th>
                                            {TYPE_COLUMNS.map(col => {
                                                const Icon = col.icon;
                                                return (
                                                    <th key={col.key} className={`px-3 py-2.5 text-right font-medium ${col.posted ? "bg-(--cl-accent)/5" : ""}`}>
                                                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                            <Icon className={`h-3.5 w-3.5 ${col.tint}`} />
                                                            {col.label}
                                                        </span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {divisions.map(d => (
                                            <tr key={d.division_id} className="border-t border-(--cl-border) transition-colors hover:bg-(--cl-surface-2)">
                                                <td className="px-4 py-2.5">
                                                    <span className="font-medium text-(--cl-text)">{d.division_name}</span>
                                                    <span className="ml-1.5 text-xs text-(--cl-text-muted)">{d.division_code}</span>
                                                </td>
                                                {TYPE_COLUMNS.map(col => {
                                                    const v = num(d[col.key]);
                                                    return (
                                                        <td key={col.key} className={`px-3 py-2.5 text-right tabular-nums ${col.posted ? "bg-(--cl-accent)/5" : ""} ${v > 0 ? "font-semibold text-(--cl-text)" : "text-(--cl-text-muted)"}`}>
                                                            {v}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-(--cl-border) font-semibold">
                                            <td className="px-4 py-2.5 text-(--cl-text)">Total</td>
                                            {TYPE_COLUMNS.map(col => (
                                                <td key={col.key} className={`px-3 py-2.5 text-right tabular-nums text-(--cl-text) ${col.posted ? "bg-(--cl-accent)/5" : ""}`}>
                                                    {divisions.reduce((s, d) => s + num(d[col.key]), 0)}
                                                </td>
                                            ))}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <p className="text-center text-xs text-(--cl-text-muted)">
                            Highlighted columns (Money Receipts, Purchase Invoices, Job Invoices) are posted to Trace Plus.
                        </p>

                        {/* Action area */}
                        <div className="flex flex-col items-center gap-3 pt-2">
                            {isPosting && progress ? (() => {
                                const processed = progress.posted + progress.failed;
                                const percent = progress.total > 0 ? Math.min(100, Math.round((processed / progress.total) * 100)) : 100;
                                return (
                                    <div className="w-full max-w-xs">
                                        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-(--cl-text-muted)">
                                            <span className="truncate">
                                                {processed} of {progress.total}
                                                {progress.currentDivision ? ` · ${progress.currentDivision}` : ""}
                                            </span>
                                            <span>{percent}%</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-(--cl-surface-2)">
                                            <div className="h-full rounded-full bg-(--cl-accent) transition-all duration-300" style={{ width: `${percent}%` }} />
                                        </div>
                                        {progress.failed > 0 && (
                                            <p className="mt-1.5 text-center text-xs font-medium text-red-600">{progress.failed} failed</p>
                                        )}
                                    </div>
                                );
                            })() : (
                                <p className="text-sm">
                                    {grandTotal === 0
                                        ? <span className="flex items-center gap-1.5 font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Everything is posted</span>
                                        : <span className="text-(--cl-text-muted)"><span className="font-bold text-(--cl-text)">{postableTotal}</span> record{postableTotal !== 1 ? "s" : ""} ready to post</span>}
                                </p>
                            )}

                            <button
                                disabled={isPosting || !hasPostable}
                                onClick={() => void handlePostDataToTracePlus()}
                                className="flex w-full max-w-xs cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-(--cl-accent) px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPosting
                                    ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Posting…</span></>
                                    : <><UploadCloud className="h-5 w-5" /><span>Post data to Trace Plus</span></>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
