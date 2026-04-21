import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Search, ArrowUpDown as ArrowUpDownIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Loader2, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema, selectCurrentBranch } from "@/store/context-slice";
import { formatCurrency } from "@/lib/utils";
import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";

// ─── Types ────────────────────────────────────────────────────────────────────



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

const thClass     = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const thSortClass = `${thClass} cursor-pointer select-none hover:text-[var(--cl-text)] transition-colors`;
const tdClass     = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

const PAGE_SIZE = 50;

// ─── Component ────────────────────────────────────────────────────────────────

export const StockOverviewSection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    // Filter/Sort State
    const [search,         setSearch]         = useState("");
    const [searchQ,        setSearchQ]        = useState("");
    const [brands,         setBrands]         = useState<BrandOption[]>([]);
    const [selectedBrand,  setSelectedBrand]  = useState<string>("0");
    const [page,           setPage]           = useState(1);
    const [total,          setTotal]          = useState(0);
    const [sortCol,        setSortCol]        = useState<string | null>("part_name");
    const [sortDir,        setSortDir]        = useState<"asc" | "desc">("asc");

    // Data State
    const [stockData, setStockData] = useState<StockRow[]>([]);
    const [loading,   setLoading]   = useState(false);

    // 1. Fetch Stock for Branch
    const loadStock = useCallback(async (branchId: number, brandId: number, q: string, pg: number) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branchId, brand_id: brandId, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<StockRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                            sqlId: SQL_MAP.GET_STOCK_OVERVIEW_PAGED,
                        }),
                    },
                }),
                apolloClient.query<{ genericQuery: { total: number }[] }>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: commonArgs,
                            sqlId: SQL_MAP.GET_STOCK_OVERVIEW_COUNT,
                        }),
                    },
                }),
            ]);

            setStockData(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_STOCK_OVERVIEW_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // 2. Fetch brands on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchBrands = async () => {
            try {
                const res = await apolloClient.query<GenericQueryData<BrandOption>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                    },
                });
                setBrands(res.data?.genericQuery ?? []);
            } catch {
                toast.error("Failed to load brands");
            }
        };
        void fetchBrands();
    }, [dbName, schema]);

    // Re-fetch when global branch, brand, searchQ, or page changes
    useEffect(() => {
        if (currentBranch?.id) void loadStock(currentBranch.id, Number(selectedBrand), searchQ, page);
        else { setStockData([]); setTotal(0); }
    }, [currentBranch?.id, selectedBrand, searchQ, page, loadStock]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => setSearchQ(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset page when search changes
    useEffect(() => {
        setPage(1);
    }, [searchQ]);

    // 2. Sort/Search logic
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
    }, [stockData, sortCol, sortDir]);

    // Aggregates
    // const totalItems = displayData.length;
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
                    </div>
                </div>
            </div>

            {/* Toolbar (Search & Brand) */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 sm:w-80 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-10 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9 shadow-sm"
                        placeholder="Search parts by name, code, or category..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="w-56">
                    <BrandSelect
                        brands={brands}
                        disabled={loading}
                        showAllOption={true}
                        value={selectedBrand}
                        onValueChange={setSelectedBrand}
                    />
                </div>
            </div>

            {/* Aggregates (Header info removed from here as it's better in footer or small area) */}
            {/* Keeping it simple here */}

            {/* Data Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-[var(--cl-surface-2)]">
                                    <th className={thClass}>Part Code</th>
                                    <th className={thClass}>Part Name</th>
                                    <th className={thClass}>Category</th>
                                    <th className={thClass}>UOM</th>
                                    <th className={`${thClass} text-right`}>Current Stock</th>
                                    <th className={`${thClass} text-right`}>Unit Cost</th>
                                    <th className={`${thClass} text-right`}>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className={tdClass} style={{ width: "15%" }}><div className="h-4 w-20 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={tdClass} style={{ width: "25%" }}><div className="h-4 w-40 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={tdClass} style={{ width: "15%" }}><div className="h-4 w-24 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={tdClass} style={{ width: "10%" }}><div className="h-4 w-10 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={`${tdClass} text-right`} style={{ width: "12%" }}><div className="ml-auto h-4 w-12 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={`${tdClass} text-right`} style={{ width: "10%" }}><div className="ml-auto h-4 w-16 rounded bg-[var(--cl-border)]" /></td>
                                        <td className={`${tdClass} text-right`} style={{ width: "13%" }}><div className="ml-auto h-4 w-20 rounded bg-[var(--cl-border)]" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : total === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No stock data found.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-30">
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

                {/* Sticky Footer Summary & Pagination */}
                <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-4 py-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4 text-sm text-[var(--cl-text-muted)]">
                        <span className="font-semibold text-[var(--cl-text)]">
                            {total} <span className="font-normal text-[var(--cl-text-muted)] ml-0.5">Records</span>
                        </span>
                        <div className="h-4 w-px bg-[var(--cl-border)]" />
                        <span className="font-semibold text-[var(--cl-text)]">
                            {formatCurrency(totalValue)} <span className="font-normal text-[var(--cl-text-muted)] ml-0.5">Total Value</span>
                        </span>
                    </div>

                    {total > 0 && (
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-xs font-medium text-[var(--cl-text-muted)]">
                                Page <span className="text-[var(--cl-text)]">{page}</span> of {Math.ceil(total / PAGE_SIZE)}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    className="h-8 w-8"
                                    disabled={page === 1 || loading}
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setPage(1)}
                                >
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-8 w-8"
                                    disabled={page === 1 || loading}
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-8 w-8"
                                    disabled={page * PAGE_SIZE >= total || loading}
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-8 w-8"
                                    disabled={page * PAGE_SIZE >= total || loading}
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setPage(Math.ceil(total / PAGE_SIZE))}
                                >
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
