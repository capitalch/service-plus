import { useEffect, useState } from "react";
import { Eye, Printer, Paperclip, FileText, Loader2 } from "lucide-react";
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
};

type GenericQueryData<T> = { genericQuery: T[] | null };

export function SingleJobQuickInfoCard({ onView, onPrint, onAttach }: QuickInfoCardProps) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const branch = useAppSelector(selectCurrentBranch);
    const branchId = branch?.id ?? null;
    const [job, setJob] = useState<JobListRow | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!dbName || !schema || !branchId) return;

        const fetchLatestJob = async () => {
            setLoading(true);
            try {
                const res = await apolloClient.query<GenericQueryData<JobListRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.GET_JOBS_PAGED,
                            sqlArgs: { branch_id: branchId, search: "", from_date: "2000-01-01", to_date: "3000-12-31", limit: 1, offset: 0 },
                        }),
                    },
                });
                setJob(res.data?.genericQuery?.[0] ?? null);
            } catch {
                setJob(null);
            } finally {
                setLoading(false);
            }
        };

        void fetchLatestJob();
    }, [dbName, schema, branchId]);

    if (loading) {
        return (
            <div className="w-full rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-3 flex items-center gap-2 text-xs text-[var(--cl-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading last job…
            </div>
        );
    }

    if (!job) {
        return null;
    }

    return (
        <div className="w-full rounded-xl border border-[var(--cl-border)] bg-gradient-to-r from-[var(--cl-surface-2)] to-[var(--cl-surface)] shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between px-4 py-2.5 gap-3">
                {/* Left: label + job info */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--cl-accent)] mb-0.5">Last Job</span>
                        <span className="font-mono text-sm font-bold text-[var(--cl-text)]">{job.job_no}</span>
                    </div>
                    <div className="h-8 w-px bg-[var(--cl-border)] shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-medium text-[var(--cl-text)] truncate max-w-[220px]">{job.device_details || "—"}</span>
                        <span className="text-[11px] text-[var(--cl-text-muted)] truncate max-w-[220px]">{job.customer_name || "—"}</span>
                    </div>
                    {job.file_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800/30 shrink-0">
                            <FileText className="h-3 w-3" />
                            {job.file_count}
                        </span>
                    )}
                </div>
                {/* Right: action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                        type="button"
                        size="sm"
                        className="h-7 px-3 text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => onView?.(job)}
                    >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="h-7 px-3 text-[11px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white"
                        onClick={() => onPrint?.(job)}
                    >
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                        Print
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="h-7 px-3 text-[11px] font-semibold bg-violet-500 hover:bg-violet-600 text-white"
                        onClick={() => onAttach?.(job.job_no, job.id)}
                    >
                        <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                        Attach
                    </Button>
                </div>
            </div>
        </div>
    );
}