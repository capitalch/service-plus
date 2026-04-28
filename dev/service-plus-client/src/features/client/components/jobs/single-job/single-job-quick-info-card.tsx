import { useEffect, useState } from "react";
import { Eye, Printer, Paperclip, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
            <Card className="border-[var(--cl-accent)]/30 shadow-md bg-gradient-to-br from-[var(--cl-surface)] to-[var(--cl-accent)]/5 !overflow-visible">
                <CardContent className="p-2 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--cl-text-muted)]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!job) {
        return null;
    }

    return (
        <Card className="border-[var(--cl-accent)]/30 shadow-md bg-gradient-to-br from-[var(--cl-surface)] to-[var(--cl-accent)]/5 !overflow-visible">
            <CardContent className="p-2 flex items-center gap-3">
                <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--cl-accent)]">Last Job</span>
                    <div className="font-mono text-sm font-bold text-[var(--cl-text)]">{job.job_no}</div>
                </div>
                <div className="min-w-0 flex-1 max-w-[120px]">
                    <div className="text-xs text-[var(--cl-text-muted)] truncate">{job.device_details || "—"}</div>
                    <div className="text-xs text-[var(--cl-text-muted)] truncate">{job.customer_name || "—"}</div>
                </div>
                {job.file_count > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 px-2 py-0.5 rounded-full shrink-0">
                        <FileText className="h-3 w-3" />
                        {job.file_count}
                    </span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        className="flex items-center justify-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                        onClick={() => onView?.(job)}
                    >
                        <Eye className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
                        onClick={() => onPrint?.(job)}
                    >
                        <Printer className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        className="flex items-center justify-center gap-1 h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-md hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors"
                        onClick={() => onAttach?.(job.job_no, job.id)}
                    >
                        <Paperclip className="h-3 w-3" />
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}