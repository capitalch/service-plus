import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobBoardStatusCount } from "@/features/client/types/job";
import { STATUS_COLORS } from "./status-transitions";

type Props = {
    onStatusClick: (status: JobBoardStatusCount) => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

const NO_ACTION_CODES = new Set(["COMPLETED_OK", "RETURN", "DELIVERED_OK", "DELIVERED_NOT_OK"]);

export const JobPipelineLanding = ({ onStatusClick }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchId      = currentBranch?.id ?? null;

    const [statusCounts, setStatusCounts] = useState<JobBoardStatusCount[]>([]);
    const [loading,      setLoading]      = useState(false);

    const loadCounts = useCallback(async () => {
        if (!dbName || !schema || !branchId) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobBoardStatusCount>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_JOB_PIPELINE_STATUS_COUNTS,
                        sqlArgs: { branch_id: branchId },
                    }),
                },
            });
            setStatusCounts(res.data?.genericQuery ?? []);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, branchId]);

    useEffect(() => { void loadCounts(); }, [loadCounts]);

    const totalJobs  = statusCounts.reduce((s, r) => s + Number(r.count), 0);
    const maxCount   = Math.max(1, ...statusCounts.map(r => Number(r.count)));
    const actionable = statusCounts.filter(s => !NO_ACTION_CODES.has(s.status_code));
    const readOnly   = statusCounts.filter(s =>  NO_ACTION_CODES.has(s.status_code));

    function renderRows(rows: JobBoardStatusCount[], startIdx: number) {
        return rows.map((s, i) => {
            const idx        = startIdx + i;
            const count      = Number(s.count);
            const isZero     = count === 0;
            const widthPct   = isZero ? 0 : Math.max(1, Math.round((count / maxCount) * 100));
            const colorParts = (STATUS_COLORS[s.status_code] ?? "bg-slate-400 hover:bg-slate-500 text-white").trim().split(/\s+/).filter(Boolean);
            const colorClass = colorParts[0] ?? "bg-slate-400";
            const textClass  = colorParts.find(p => p.startsWith("text-")) ?? "text-white";

            return (
                <motion.button
                    key={s.status_id}
                    animate={{ opacity: 1 }}
                    className={`group flex w-full items-center gap-3 rounded px-3 py-2 text-left focus:outline-none transition-colors duration-150 ${isZero ? "opacity-40 cursor-not-allowed" : "cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--cl-accent)] hover:bg-[var(--cl-hover)]"}`}
                    initial={{ opacity: 0 }}
                    title={`${s.status_name}: ${count} job${count !== 1 ? "s" : ""}`}
                    transition={{ delay: idx * 0.04, duration: 0.2 }}
                    onClick={() => { if (!isZero) onStatusClick(s); }}
                >
                    <span className="w-44 shrink-0 truncate text-sm font-semibold text-[var(--cl-text)]" title={s.status_name}>
                        {s.status_name}
                    </span>

                    <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-zinc-700 bg-zinc-200 rounded px-1.5 py-0.5">
                        {count}
                    </span>

                    <div className="relative flex h-7 flex-1 overflow-hidden rounded bg-[var(--cl-surface-2)]">
                        <motion.div
                            animate={{ width: `${widthPct}%` }}
                            className={`flex h-full items-center justify-end rounded pr-2 ${colorClass} ${isZero ? "opacity-20" : "opacity-80 group-hover:opacity-100"} transition-opacity duration-150`}
                            initial={{ width: "0%" }}
                            transition={{ delay: idx * 0.04, duration: 0.45, ease: "easeOut" }}
                        >
                            {widthPct >= 15 && (
                                <span className={`text-xs font-bold tabular-nums ${textClass}`}>{count}</span>
                            )}
                        </motion.div>
                    </div>

                    <span className={`w-10 shrink-0 text-right text-sm font-bold tabular-nums ${isZero ? "text-[var(--cl-text-muted)]" : "text-[var(--cl-text)]"}`}>
                        {count}
                    </span>
                </motion.button>
            );
        });
    }

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--cl-border)] bg-[var(--cl-surface)] py-2 px-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">Job Pipeline</h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `${totalJobs} total jobs`}
                        </span>
                    </div>
                </div>
                <Button
                    className="h-8 w-8 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                    disabled={loading}
                    size="icon"
                    title="Refresh"
                    variant="ghost"
                    onClick={() => void loadCounts()}
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {/* Bar list */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4">
                {loading && statusCounts.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-[var(--cl-text-muted)]">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {/* All bar */}
                        <motion.button
                            animate={{ opacity: 1 }}
                            className="group flex w-full items-center gap-3 rounded px-3 py-2 text-left focus:outline-none transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--cl-accent)] hover:bg-[var(--cl-hover)]"
                            initial={{ opacity: 0 }}
                            title={`All: ${totalJobs} job${totalJobs !== 1 ? "s" : ""}`}
                            transition={{ delay: 0, duration: 0.2 }}
                            onClick={() => onStatusClick({ status_id: 0, status_code: "ALL", status_name: "All", count: totalJobs })}
                        >
                            <span className="w-44 shrink-0 truncate text-sm font-semibold text-[var(--cl-text)]">All</span>
                            <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--cl-accent)] bg-[var(--cl-accent)]/10 rounded px-1.5 py-0.5">
                                {totalJobs}
                            </span>
                            <div className="relative flex h-7 flex-1 overflow-hidden rounded bg-[var(--cl-surface-2)]">
                                <div className="flex h-full w-full items-center justify-end rounded pr-2 bg-[var(--cl-accent)] opacity-70 group-hover:opacity-90 transition-opacity duration-150">
                                    <span className="text-xs font-bold tabular-nums text-white">{totalJobs}</span>
                                </div>
                            </div>
                            <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-[var(--cl-text)]">{totalJobs}</span>
                        </motion.button>

                        <hr className="my-2 border-dashed border-[var(--cl-border)]" />

                        {renderRows(actionable, 1)}
                        {readOnly.length > 0 && (
                            <>
                                <hr className="my-3 border-dashed border-[var(--cl-border)]" />
                                {renderRows(readOnly, actionable.length + 2)}
                            </>
                        )}
                    </div>
                )}

                {!loading && statusCounts.length > 0 && (
                    <p className="mt-6 text-center text-xs text-[var(--cl-text-muted)]">
                        Click a bar to view jobs
                    </p>
                )}
            </div>
        </motion.div>
    );
};
