import { useCallback, useEffect, useRef, useState } from "react";
import {RotateCcw, Search, Loader2, RefreshCw, X} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

type BranchType = {
    id:   number;
    name: string;
    code: string;
};

type ConsumptionRow = {
    job_no:      string;
    job_date:    string;
    part_code:   string;
    part_name:   string;
    uom:         string;
    quantity:    number;
    branch_name: string;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 1200;

function currentMonthRange() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const last  = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
        from: `${year}-${month}-01`,
        to:   `${year}-${month}-${String(last).padStart(2, "0")}`,
    };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const ConsumptionSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const { from: defaultFrom, to: defaultTo } = currentMonthRange();

    // Filter state
    const [branches,       setBranches]       = useState<BranchType[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [fromDate,       setFromDate]       = useState(defaultFrom);
    const [toDate,         setToDate]         = useState(defaultTo);
    const [search,         setSearch]         = useState("");
    const [searchQ,        setSearchQ]        = useState("");

    // Data state
    const [rows,    setRows]    = useState<ConsumptionRow[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Load branches once
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchBranches = async () => {
            try {
                const res = await apolloClient.query<GenericQueryData<BranchType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANCHES }),
                    },
                });
                const fetched = res.data?.genericQuery ?? [];
                setBranches(fetched);
                if (fetched.length > 0) setSelectedBranch(String(fetched[0].id));
            } catch {
                toast.error(MESSAGES.ERROR_BRANCH_LOAD_FAILED);
            }
        };
        void fetchBranches();
    }, [dbName, schema]);

    // 2. Load consumption (paged)
    const loadData = useCallback(async (
        branchId: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branchId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<ConsumptionRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_CONSUMPTION_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_CONSUMPTION_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Re-fetch when filters or page change
    useEffect(() => {
        if (!selectedBranch) return;
        void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page);
    }, [selectedBranch, fromDate, toDate, searchQ, page, loadData]);

    // Debounce search input
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(value);
        }, DEBOUNCE_MS);
    };

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--cl-accent)]/10">
                        <RotateCcw className="h-5 w-5 text-[var(--cl-accent)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Part Used (Job)</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `${total} record${total !== 1 ? "s" : ""} found`}
                        </p>
                    </div>
                </div>

                {/* Branch selector */}
                <div className="w-56">
                    <Select
                        disabled={branches.length === 0 || loading}
                        value={selectedBranch}
                        onValueChange={handleFilterChange(setSelectedBranch)}
                    >
                        <SelectTrigger className="h-9 bg-[var(--cl-surface)]">
                            <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map((b) => (
                                <SelectItem key={b.id} value={String(b.id)}>
                                    {b.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    className="h-9 w-36 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                    disabled={loading}
                    type="date"
                    value={fromDate}
                    onChange={e => handleFilterChange(setFromDate)(e.target.value)}
                />
                <Input
                    className="h-9 w-36 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                    disabled={loading}
                    type="date"
                    value={toDate}
                    onChange={e => handleFilterChange(setToDate)(e.target.value)}
                />
                <div className="relative flex-1 sm:w-72 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9 shadow-sm"
                        disabled={loading}
                        placeholder="Search by job no, part code, or part name…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--cl-text-muted)] text-[var(--cl-surface)] hover:bg-[var(--cl-text)] focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
                </div>
                <Button
                    className="h-9"
                    disabled={loading || !selectedBranch}
                    size="sm"
                    variant="outline"
                    onClick={() => void loadData(Number(selectedBranch), fromDate, toDate, searchQ, page)}
                >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Refresh
                </Button>
            </div>

            {/* Data Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No consumption records found for the selected filters.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Job Date</th>
                                    <th className={thClass}>Part Code</th>
                                    <th className={thClass}>Part Name</th>
                                    <th className={thClass}>UOM</th>
                                    <th className={`${thClass} text-right`}>Qty Used</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => (
                                    <tr
                                        key={`${row.job_no}-${row.part_code}-${idx}`}
                                        className="transition-colors hover:bg-[var(--cl-surface-2)]/50"
                                    >
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "5%" }}>
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className={`${tdClass} font-mono font-medium`} style={{ width: "15%" }}>
                                            {row.job_no}
                                        </td>
                                        <td className={tdClass} style={{ width: "12%" }}>
                                            {row.job_date}
                                        </td>
                                        <td className={`${tdClass} font-mono`} style={{ width: "13%" }}>
                                            {row.part_code}
                                        </td>
                                        <td className={`${tdClass} font-medium`} style={{ width: "30%" }}>
                                            {row.part_name}
                                        </td>
                                        <td className={tdClass} style={{ width: "8%" }}>
                                            <span className="rounded-md bg-[var(--cl-surface-3)] px-2 py-0.5 text-xs font-semibold">
                                                {row.uom}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-right font-medium`} style={{ width: "10%" }}>
                                            {Number(row.quantity).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            Page {page} of {totalPages} · {total} records
                        </span>
                        <div className="flex gap-1">
                            <Button
                                disabled={page <= 1 || loading}
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => p - 1)}
                            >
                                Prev
                            </Button>
                            <Button
                                disabled={page >= totalPages || loading}
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
