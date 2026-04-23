import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobLookupForReceiptType } from "@/features/client/types/receipt";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

type JobLookupComboboxPropsType = {
    disabled?: boolean;
    onChange:  (jobId: number | null, job: JobLookupForReceiptType | null) => void;
    value:     number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1200;

// ─── Component ────────────────────────────────────────────────────────────────

export const JobLookupCombobox = ({ disabled = false, onChange, value }: JobLookupComboboxPropsType) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchId      = currentBranch?.id ?? null;

    const [open,         setOpen]         = useState(false);
    const [search,       setSearch]       = useState("");
    const [results,      setResults]      = useState<JobLookupForReceiptType[]>([]);
    const [loading,      setLoading]      = useState(false);
    const [selectedJob,  setSelectedJob]  = useState<JobLookupForReceiptType | null>(null);

    const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef  = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Clear selected job when value is reset to null externally
    useEffect(() => {
        if (value === null) {
            setSelectedJob(null);
            setSearch("");
            setResults([]);
        }
    }, [value]);

    function fetchJobs(q: string) {
        if (!dbName || !schema || !branchId) return;
        setLoading(true);
        apolloClient
            .query<GenericQueryDataType<JobLookupForReceiptType>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: branchId, limit: 20, search: q },
                        sqlId:   SQL_MAP.GET_JOBS_FOR_RECEIPT_LOOKUP,
                    }),
                },
            })
            .then(res => setResults(res.data?.genericQuery ?? []))
            .catch(() => toast.error(MESSAGES.ERROR_RECEIPT_LOAD_FAILED))
            .finally(() => setLoading(false));
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const q = e.target.value;
        setSearch(q);
        setOpen(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchJobs(q), DEBOUNCE_MS);
    }

    function handleSelect(job: JobLookupForReceiptType) {
        setSelectedJob(job);
        setOpen(false);
        setSearch("");
        setResults([]);
        onChange(job.id, job);
    }

    function handleClear() {
        setSelectedJob(null);
        setSearch("");
        setResults([]);
        onChange(null, null);
    }

    return (
        <div ref={containerRef} className="relative w-full">
            {selectedJob ? (
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2.5">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-primary text-sm">
                                #{selectedJob.job_no}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">
                                {selectedJob.customer_name}
                            </span>
                            {selectedJob.mobile && (
                                <span className="text-xs text-muted-foreground">{selectedJob.mobile}</span>
                            )}
                            {selectedJob.is_closed && (
                                <Badge className="h-4 text-[10px] px-1" variant="secondary">Closed</Badge>
                            )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            Date: {selectedJob.job_date} · Amount: ₹{Number(selectedJob.amount).toFixed(2)}
                        </div>
                    </div>
                    {!disabled && (
                        <Button
                            className="h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-red-500"
                            size="icon"
                            type="button"
                            variant="ghost"
                            onClick={handleClear}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <Input
                        className="h-9 pr-8 text-sm"
                        disabled={disabled}
                        placeholder="Search by job no, customer name or mobile…"
                        value={search}
                        onChange={handleInputChange}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4" />}
                    </span>
                </div>
            )}

            {open && !selectedJob && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {loading ? (
                        <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Searching…
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                            {search.length >= 1 ? "No jobs found." : "Type to search jobs…"}
                        </div>
                    ) : (
                        results.map(job => (
                            <button
                                key={job.id}
                                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                                type="button"
                                onClick={() => handleSelect(job)}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-semibold text-primary text-sm">#{job.job_no}</span>
                                        <span className="text-sm font-medium text-foreground truncate">{job.customer_name}</span>
                                        {job.mobile && <span className="text-xs text-muted-foreground">{job.mobile}</span>}
                                        {job.is_closed && (
                                            <Badge className="h-4 text-[10px] px-1" variant="secondary">Closed</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {job.job_date} · ₹{Number(job.amount).toFixed(2)}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
