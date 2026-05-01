import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, Eye, Printer, Paperclip, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobListRow } from "@/features/client/types/job";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema, selectCurrentBranch } from "@/store/context-slice";

type QuickInfoCardProps = {
    onView?: (job: JobListRow) => void;
    onPrint?: (job: JobListRow) => void;
    onAttach?: (jobNo: string, jobId: number) => void;
    refreshTrigger?: number;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

const JOB_COMMON_ARGS = { search: "", from_date: "2000-01-01", to_date: "3000-12-31", limit: 1 };

export function SingleJobQuickInfoCard({ onView, onPrint, onAttach, refreshTrigger }: QuickInfoCardProps) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const branch = useAppSelector(selectCurrentBranch);
    const branchId = branch?.id ?? null;

    const [currentJob, setCurrentJob] = useState<JobListRow | null>(null);
    const [latestJobId, setLatestJobId] = useState<number | null>(null);
    const [currentOffset, setCurrentOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const [navLoading, setNavLoading] = useState(false);
    const [canGoOlder, setCanGoOlder] = useState(false);

    const isLatestJob = currentJob !== null && currentJob.id === latestJobId;
    const isAtLatest = currentOffset === 0;
    const isAtOldest = !canGoOlder;

    const fetchJob = useCallback(async (offset: number, isNavigation = false) => {
        if (!dbName || !schema || !branchId) return null;
        if (isNavigation) setNavLoading(true);
        else setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<JobListRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_JOBS_PAGED,
                        sqlArgs: { branch_id: branchId, ...JOB_COMMON_ARGS, offset },
                    }),
                },
            });
            return res.data?.genericQuery?.[0] ?? null;
        } catch {
            return null;
        } finally {
            if (isNavigation) setNavLoading(false);
            else setLoading(false);
        }
    }, [dbName, schema, branchId]);

    const fetchLatest = useCallback(async () => {
        if (!dbName || !schema || !branchId) return;
        setLoading(true);
        try {
            const [jobRes, olderRes] = await Promise.all([
                apolloClient.query<GenericQueryData<JobListRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOBS_PAGED,
                            sqlArgs: { branch_id: branchId, ...JOB_COMMON_ARGS, offset: 0 },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<JobListRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOBS_PAGED,
                            sqlArgs: { branch_id: branchId, ...JOB_COMMON_ARGS, offset: 1 },
                        }),
                    },
                }),
            ]);
            const job = jobRes.data?.genericQuery?.[0] ?? null;
            setCurrentJob(job);
            setLatestJobId(job?.id ?? null);
            setCurrentOffset(0);
            setCanGoOlder(!!olderRes.data?.genericQuery?.[0]);
        } catch {
            setCurrentJob(null);
            setCanGoOlder(false);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, branchId]);

    const fetchJobRef = useRef(fetchJob);
    useEffect(() => {
        fetchJobRef.current = fetchJob;
    }, [fetchJob]);

    const fetchLatestRef = useRef(fetchLatest);
    useEffect(() => {
        fetchLatestRef.current = fetchLatest;
    }, [fetchLatest]);

    const currentOffsetRef = useRef(currentOffset);
    useEffect(() => {
        currentOffsetRef.current = currentOffset;
    }, [currentOffset]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchLatest();
    }, [fetchLatest]);

    useEffect(() => {
        if (refreshTrigger === 0) return;
        if (currentOffsetRef.current === 0) {
            void fetchLatestRef.current();
        } else {
            const offset = currentOffsetRef.current;
            void fetchJobRef.current(offset, false).then(job => {
                if (job) setCurrentJob(job);
            });
        }
    }, [refreshTrigger]);

    const navigateLater = async () => {
        if (isAtLatest || navLoading) return;
        const newOffset = currentOffset - 1;
        const job = await fetchJob(newOffset, true);
        if (job) {
            setCurrentJob(job);
            setCurrentOffset(newOffset);
            if (newOffset === 0) {
                setLatestJobId(job.id);
                const hasOlder = await fetchJob(1, false);
                setCanGoOlder(!!hasOlder);
            }
        }
    };

    const navigateOlder = async () => {
        if (!canGoOlder || navLoading) return;
        const newOffset = currentOffset + 1;
        const job = await fetchJob(newOffset, true);
        if (job) {
            setCurrentJob(job);
            setCurrentOffset(newOffset);
            setCanGoOlder(true);
            const furtherOlder = await fetchJob(newOffset + 1, false);
            setCanGoOlder(!!furtherOlder);
        } else {
            setCanGoOlder(false);
        }
    };

    const navigateToLatest = async () => {
        if (navLoading || isAtLatest) return;
        const job = await fetchJob(0, true);
        setCurrentJob(job);
        setLatestJobId(job?.id ?? null);
        setCurrentOffset(0);
        if (job) {
            const hasOlder = await fetchJob(1, false);
            setCanGoOlder(!!hasOlder);
        } else {
            setCanGoOlder(false);
        }
    };

    const navigateToOldest = async () => {
        if (navLoading || isAtOldest) return;
        let offset = currentOffset + 20;
        let lastJob: JobListRow | null = null;
        while (true) {
            const result = await fetchJob(offset, true);
            if (!result) break;
            lastJob = result;
            offset += 20;
        }
        if (lastJob) {
            setCurrentJob(lastJob);
            setCurrentOffset(offset - 20);
            setCanGoOlder(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-3 flex items-center gap-2 text-xs text-[var(--cl-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading last job…
            </div>
        );
    }

    if (!currentJob) {
        return null;
    }

    return (
        <div className="w-full rounded-xl border border-[var(--cl-border)] bg-gradient-to-r from-[var(--cl-surface-2)] to-[var(--cl-surface)] shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 gap-3">
                {/* Left: job info — two rows */}
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                    {/* Row 1: Job number + date + file badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold text-[var(--cl-text)] tracking-tight">
                            {currentJob.job_no}
                        </span>
                        {isLatestJob ? (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/30">
                                Latest
                            </span>
                        ) : isAtOldest ? (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/30">
                                Oldest
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/30">
                                Position {currentOffset + 1}
                            </span>
                        )}
                        <span className="text-xs text-[var(--cl-text-muted)] font-medium tabular-nums">
                            {currentJob.job_date || "—"}
                        </span>
                        {currentJob.file_count > 0 && (
                            <button
                                type="button"
                                title="View attachments"
                                onClick={() => onAttach?.(currentJob.job_no, currentJob.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/30 hover:bg-teal-100 dark:hover:bg-teal-900/40 hover:border-teal-400 dark:hover:border-teal-700 transition-colors cursor-pointer"
                            >
                                <FileText className="h-3 w-3" />
                                {currentJob.file_count} {currentJob.file_count === 1 ? "file" : "files"}
                            </button>
                        )}
                    </div>
                    {/* Row 2: Device details • Customer */}
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                        <span className="text-xs font-medium text-[var(--cl-text)] truncate">
                            {currentJob.device_details || "—"}
                        </span>
                        <span className="text-[10px] text-[var(--cl-text-muted)] shrink-0">•</span>
                        <span className="text-xs text-[var(--cl-text-muted)] truncate">
                            {currentJob.customer_name || "—"}
                        </span>
                    </div>
                </div>

                {/* Right: navigator + actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)]">
                        <NavButton
                            icon={<ChevronsLeftIcon className="h-3.5 w-3.5" />}
                            title="Go to oldest job"
                            disabled={isAtOldest || navLoading}
                            onClick={navigateToOldest}
                        />
                        <NavButton
                            icon={<ChevronLeftIcon className="h-3.5 w-3.5" />}
                            title="Older job"
                            disabled={isAtOldest || navLoading}
                            onClick={navigateOlder}
                        />
                        <NavButton
                            icon={<ChevronRightIcon className="h-3.5 w-3.5" />}
                            title="Later job"
                            disabled={isAtLatest || navLoading}
                            onClick={navigateLater}
                        />
                        <NavButton
                            icon={<ChevronsRightIcon className="h-3.5 w-3.5" />}
                            title="Go to latest job"
                            disabled={isAtLatest || navLoading}
                            onClick={navigateToLatest}
                        />
                        {navLoading && <Loader2 className="h-3 w-3 animate-spin text-[var(--cl-text-muted)] ml-0.5 shrink-0" />}
                    </div>

                    <div className="h-6 w-px bg-[var(--cl-border)] shrink-0" />

                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                            onClick={() => onView?.(currentJob)}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white"
                            onClick={() => onPrint?.(currentJob)}
                        >
                            <Printer className="h-3.5 w-3.5 mr-1.5" />
                            Print
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-violet-500 hover:bg-violet-600 text-white"
                            onClick={() => onAttach?.(currentJob.job_no, currentJob.id)}
                        >
                            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                            Attach
                        </Button>
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
            className="flex items-center justify-center h-7 w-7 rounded-md border border-transparent text-[var(--cl-text-muted)] hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] hover:border-[var(--cl-accent)]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--cl-text-muted)] disabled:hover:border-transparent shrink-0 cursor-pointer"
        >
            {icon}
        </button>
    );
}
