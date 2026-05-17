import { useEffect, useState, useCallback, useRef } from "react";
import {
    ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon,
    Loader2, Paperclip, Eye, Printer, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchJobQuickInfoRow } from "@/features/client/types/job";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema, selectCurrentBranch, selectAvailableDivisions } from "@/store/context-slice";

type Props = {
    onAttach?: (jobs: { jobId: number; jobNo: string }[]) => void;
    onAttachJob?: (jobId: number, jobNo: string) => void;
    onEdit?: (batchNo: number) => void;
    onView?: (batchNo: number) => void;
    onPrint?: (batchNo: number) => void;
    refreshTrigger?: number;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

export function BatchJobQuickInfoCard({ onAttachJob, onEdit, onView, onPrint, refreshTrigger }: Props) {
    const dbName    = useAppSelector(selectDbName);
    const schema    = useAppSelector(selectSchema);
    const branch    = useAppSelector(selectCurrentBranch);
    const divisions = useAppSelector(selectAvailableDivisions);
    const branchId  = branch?.id ?? null;

    const [rows, setRows] = useState<BatchJobQuickInfoRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [navLoading, setNavLoading] = useState(false);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);

    const isAtLatest = offset === 0;
    const isAtOldest = offset >= total - 1;
    const isReady = dbName && schema && branchId;

    const fetchBatch = useCallback(async (off: number, nav = false) => {
        if (!dbName || !schema || !branchId) return;
        if (nav) setNavLoading(true); else setLoading(true);
        try {
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<BatchJobQuickInfoRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_BATCH_QUICK_INFO,
                            sqlArgs: { branch_id: branchId, offset: off },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOB_BATCH_QUICK_INFO_COUNT,
                            sqlArgs: { branch_id: branchId },
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
            setOffset(off);
        } catch {
            setRows([]);
        } finally {
            if (nav) setNavLoading(false); else setLoading(false);
        }
    }, [dbName, schema, branchId]);

    const fetchBatchRef = useRef(fetchBatch);
    useEffect(() => { fetchBatchRef.current = fetchBatch; }, [fetchBatch]);

    const offsetRef = useRef(offset);
    useEffect(() => { offsetRef.current = offset; }, [offset]);

    useEffect(() => { void fetchBatch(0); }, [fetchBatch]);

    useEffect(() => {
        if (refreshTrigger === 0) return;
        void fetchBatchRef.current(0);
    }, [refreshTrigger]);

    if (loading || !isReady) {
        return (
            <div className="w-full rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-3 flex items-center gap-2 text-xs text-[var(--cl-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading last batch…
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="w-full rounded-xl border border-dashed border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-6 text-center text-xs text-[var(--cl-text-muted)]">
                No batch jobs created yet.
            </div>
        );
    }

    const batchNo = rows[0].batch_no;
    const batchDate = rows[0].batch_date;
    const customerName = rows[0].customer_name;

    return (
        <div className="w-full rounded-xl border border-[var(--cl-border)] bg-gradient-to-r from-[var(--cl-surface-2)] to-[var(--cl-surface)] shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 gap-3">
                {/* Left: batch info */}
                <div className="flex-1 min-w-0 w-full">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono text-sm font-bold text-[var(--cl-text)] tracking-tight">
                            Batch #{batchNo}
                        </span>
                        {isAtLatest && (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/30">
                                Latest
                            </span>
                        )}
                        {isAtOldest && !isAtLatest && (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/30">
                                Oldest
                            </span>
                        )}
                        {!isAtLatest && !isAtOldest && (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/30">
                                Position {offset + 1}
                            </span>
                        )}
                        <span className="text-xs text-[var(--cl-text-muted)] font-medium tabular-nums">{batchDate || "—"}</span>
                        {rows[0]?.division_id && (() => {
                            const dv = divisions.find(d => d.id === rows[0].division_id);
                            return dv ? (
                                <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 rounded px-1 py-0.5">
                                    {dv.code}
                                </span>
                            ) : null;
                        })()}
                        <span className="text-xs text-[var(--cl-text-muted)]">•</span>
                        <span className="text-xs font-medium text-[var(--cl-text)] truncate">{customerName || "—"}</span>

                    </div>

                    {/* Job lines */}
                    <div className="flex flex-col gap-1">
                        {rows.map(row => (
                            <div key={row.job_id} className="flex items-center gap-2 text-xs min-w-0">
                                <span className="font-mono font-semibold text-[var(--cl-accent)] shrink-0 w-24 truncate">
                                    {row.job_no}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--cl-accent)]/10 text-[var(--cl-accent)] shrink-0">
                                    {row.job_type_name}
                                </span>
                                <span className="text-[var(--cl-text)] truncate flex-1">
                                    {row.device_details || "—"}
                                </span>
                                {row.serial_no && (
                                    <>
                                        <span className="text-[var(--cl-text-muted)] shrink-0">·</span>
                                        <span className="text-[var(--cl-text-muted)] font-mono shrink-0">{row.serial_no}</span>
                                    </>
                                )}
                                {(row.file_count ?? 0) > 0 ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-2 py-1 rounded-full border border-violet-200 dark:border-violet-800/30 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:border-violet-400 dark:hover:border-violet-700 transition-colors cursor-pointer shrink-0"
                                        onClick={() => onAttachJob?.(row.job_id, row.job_no)}
                                    >
                                        <Paperclip className="h-3 w-3" />
                                        <span>{row.file_count} File{row.file_count !== 1 ? "s" : ""}</span>
                                    </button>
                                ) : (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] font-medium bg-teal-500 hover:bg-teal-600 text-white shrink-0"
                                        onClick={() => onAttachJob?.(row.job_id, row.job_no)}
                                    >
                                        <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                                        Attach
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: actions + navigation */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => onEdit?.(batchNo)}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                            onClick={() => onView?.(batchNo)}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white"
                            onClick={() => onPrint?.(batchNo)}
                        >
                            <Printer className="h-3.5 w-3.5 mr-1.5" />
                            Print
                        </Button>
                        {/* <Button
                            type="button" size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-violet-500 hover:bg-violet-600 text-white"
                            onClick={() => onAttach?.(rows.map(r => ({ jobId: r.job_id, jobNo: r.job_no })))}
                        >
                            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                            Attach Files
                        </Button> */}
                    </div>

                    <div className="h-6 w-px bg-[var(--cl-border)] shrink-0" />

                    <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <NavButton
                            icon={<ChevronsLeftIcon className="h-4 w-4" />}
                            title="Oldest batch"
                            disabled={isAtOldest || navLoading}
                            onClick={() => void fetchBatch(total - 1, true)}
                        />
                        <NavButton
                            icon={<ChevronLeftIcon className="h-4 w-4" />}
                            title="Older batch"
                            disabled={isAtOldest || navLoading}
                            onClick={() => void fetchBatch(offset + 1, true)}
                        />
                        <NavButton
                            icon={<ChevronRightIcon className="h-4 w-4" />}
                            title="Newer batch"
                            disabled={isAtLatest || navLoading}
                            onClick={() => void fetchBatch(offset - 1, true)}
                        />
                        <NavButton
                            icon={<ChevronsRightIcon className="h-4 w-4" />}
                            title="Latest batch"
                            disabled={isAtLatest || navLoading}
                            onClick={() => void fetchBatch(0, true)}
                        />
                        {navLoading && <Loader2 className="h-4 w-4 animate-spin text-[var(--cl-accent)] ml-0.5 shrink-0" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

type NavButtonProps = {
    icon: React.ReactNode;
    title: string;
    disabled: boolean;
    onClick: () => void;
};

function NavButton({ icon, title, disabled, onClick }: NavButtonProps) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-transparent text-[var(--cl-text-muted)] hover:bg-[var(--cl-accent)] hover:text-white hover:border-[var(--cl-accent)]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--cl-text-muted)] disabled:hover:border-transparent shrink-0 cursor-pointer"
        >
            {icon}
        </button>
    );
}
