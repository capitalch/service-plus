import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Search, ArrowUpDown as ArrowUpDownIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type BranchType = {
    id: number;
    name: string;
    code: string;
};

type StockRow = {
    part_id:       number;
    part_code:     string;
    part_name:     string;
    category:      string | null;
    uom:           string;
    cost_price:    number | null;
    current_stock: number;
};

type GenericQueryData<T> = {
    genericQuery: T[] | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const thClass     = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-[var(--cl-text)] transition-colors`;
const tdClass     = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const StockOverviewSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Filter/Sort State
    const [branches,       setBranches]       = useState<BranchType[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [search,         setSearch]         = useState("");
    const [sortCol,        setSortCol]        = useState<string | null>("part_name");
    const [sortDir,        setSortDir]        = useState<"asc" | "desc">("asc");

    // Data State
    const [stockData, setStockData] = useState<StockRow[]>([]);
    const [loading,   setLoading]   = useState(false);

    // 1. Fetch Branches
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
                if (fetched.length > 0) {
                    setSelectedBranch(String(fetched[0].id));
                }
            } catch {
                toast.error(MESSAGES.ERROR_BRANCH_LOAD_FAILED);
            }
        };
        void fetchBranches();
    }, [dbName, schema]);

    // 2. Fetch Stock for Branch
    const loadStock = useCallback(async (branchId: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<StockRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: branchId },
                        sqlId: SQL_MAP.GET_STOCK_OVERVIEW,
                    }),
                },
            });
            setStockData(res.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_STOCK_OVERVIEW_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Re-fetch when branch changes
    useEffect(() => {
        if (selectedBranch) void loadStock(Number(selectedBranch));
    }, [selectedBranch, loadStock]);

    // 3. Sort/Search logic
    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortCol !== col) return <ArrowUpDownIcon className="ml-1 inline h-3 w-3 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUpIcon   className="ml-1 inline h-3 w-3" />
            : <ArrowDownIcon className="ml-1 inline h-3 w-3" />;
    };

    const displayData = useMemo(() => {
        let rows = stockData;
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.part_code.toLowerCase().includes(q) ||
                r.part_name.toLowerCase().includes(q) ||
                (r.category?.toLowerCase().includes(q) ?? false)
            );
        }
        if (sortCol) {
            rows = [...rows].sort((a, b) => {
                const av = (a as Record<string, unknown>)[sortCol];
                const bv = (b as Record<string, unknown>)[sortCol];
                if (av == null) return 1;
                if (bv == null) return -1;
                const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
                return sortDir === "asc" ? cmp : -cmp;
            });
        }
        return rows;
    }, [stockData, search, sortCol, sortDir]);

    // Aggregates
    const totalItems = displayData.length;
    const totalValue = displayData.reduce((acc, row) => acc + (row.current_stock * (row.cost_price || 0)), 0);

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
                        <Package className="h-5 w-5 text-[var(--cl-accent)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Stock Overview</h1>
                        <p className="mt-1 flex items-center gap-3 text-sm text-[var(--cl-text-muted)]">
                            <span>{totalItems} parts found</span>
                            <span className="h-1 w-1 rounded-full bg-[var(--cl-border)]" />
                            <span>Value: {formatCurrency(totalValue)}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-56">
                        <Select
                            disabled={branches.length === 0 || loading}
                            value={selectedBranch}
                            onValueChange={setSelectedBranch}
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
            </div>

            {/* Toolbar (Search) */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-80 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-10 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9 shadow-sm"
                        placeholder="Search parts by name, code, or category..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                        </div>
                    ) : displayData.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No stock data found for this branch.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thSortClass} onClick={() => handleSort("part_code")}>
                                        Part Code <SortIcon col="part_code" />
                                    </th>
                                    <th className={thSortClass} onClick={() => handleSort("part_name")}>
                                        Part Name <SortIcon col="part_name" />
                                    </th>
                                    <th className={thSortClass} onClick={() => handleSort("category")}>
                                        Category <SortIcon col="category" />
                                    </th>
                                    <th className={thClass}>UOM</th>
                                    <th className={`${thSortClass} text-right`} onClick={() => handleSort("current_stock")}>
                                        Current Stock <SortIcon col="current_stock" />
                                    </th>
                                    <th className={`${thSortClass} text-right`} onClick={() => handleSort("cost_price")}>
                                        Unit Cost <SortIcon col="cost_price" />
                                    </th>
                                    <th className={`${thClass} text-right`}>Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {displayData.map((row) => (
                                    <tr key={row.part_id} className="transition-colors hover:bg-[var(--cl-surface-2)]/50">
                                        <td className={`${tdClass} font-mono font-medium`} style={{ width: "15%" }}>
                                            {row.part_code}
                                        </td>
                                        <td className={`${tdClass} font-medium`} style={{ width: "25%" }}>
                                            {row.part_name}
                                        </td>
                                        <td className={tdClass} style={{ width: "15%" }}>
                                            {row.category || <span className="text-opacity-50">—</span>}
                                        </td>
                                        <td className={tdClass} style={{ width: "10%" }}>
                                            <span className="rounded-md bg-[var(--cl-surface-3)] px-2 py-0.5 text-xs font-semibold">
                                                {row.uom}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-right font-medium`} style={{ width: "12%" }}>
                                            <span className={row.current_stock < 0 ? "text-red-500" : row.current_stock === 0 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}>
                                                {row.current_stock.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-right`} style={{ width: "10%" }}>
                                            {row.cost_price != null ? formatCurrency(row.cost_price) : "—"}
                                        </td>
                                        <td className={`${tdClass} text-right font-medium`} style={{ width: "13%" }}>
                                            {formatCurrency(row.current_stock * (row.cost_price || 0))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
