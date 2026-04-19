import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    LayoutGrid,
    List,
    RefreshCwIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { BrandOption } from "@/features/client/types/model";
import type { LocationOptionType } from "@/features/client/types/set-part-location";
import type { PartFinderResultType } from "@/features/client/types/part-finder";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PartFinderCard } from "./part-finder-card";
import { PartFinderDetailPanel } from "./part-finder-detail-panel";
import { PartFinderTable } from "./part-finder-table";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1200;
const PAGE_SIZE   = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

type StockFilter = "all" | "in_stock";
type ViewMode    = "card" | "table";

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderPage = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [brands,        setBrands]        = useState<BrandOption[]>([]);
    const [brandsLoading, setBrandsLoading] = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [locations,     setLocations]     = useState<LocationOptionType[]>([]);
    const [page,          setPage]          = useState(1);
    const [parts,         setParts]         = useState<PartFinderResultType[]>([]);
    const [search,        setSearch]        = useState("");
    const [searchQ,       setSearchQ]       = useState("");
    const [selectedBrand, setSelectedBrand] = useState<BrandOption | null>(null);
    const [selectedPart,  setSelectedPart]  = useState<PartFinderResultType | null>(null);
    const [stockFilter,   setStockFilter]   = useState<StockFilter>("all");
    const [total,         setTotal]         = useState(0);
    const [viewMode,      setViewMode]      = useState<ViewMode>("table");

    const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from        = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to          = Math.min(page * PAGE_SIZE, total);

    // ── Load brands ───────────────────────────────────────────────────────────
    const loadBrands = useCallback(async () => {
        if (!dbName || !schema) return;
        setBrandsLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<BrandOption>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
            });
            const list = res.data?.genericQuery ?? [];
            setBrands(list);
            if (list.length === 1) setSelectedBrand(list[0]);
        } catch {
            // non-critical
        } finally {
            setBrandsLoading(false);
        }
    }, [dbName, schema]);

    // ── Load locations ────────────────────────────────────────────────────────
    const loadLocations = useCallback(async () => {
        if (!dbName || !schema || !currentBranch) return;
        try {
            const res = await apolloClient.query<GenericQueryData<LocationOptionType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ACTIVE_LOCATIONS_BY_BRANCH, sqlArgs: { branch_id: currentBranch.id } }) },
            });
            setLocations(res.data?.genericQuery ?? []);
        } catch {
            // non-critical
        }
    }, [currentBranch, dbName, schema]);

    useEffect(() => {
        searchInputRef.current?.focus();
        setTimeout(() => { void loadBrands(); void loadLocations(); }, 0);
    }, [loadBrands, loadLocations]);

    // ── Load paged data (single query — COUNT(*) OVER() in SQL) ──────────────
    const loadData = useCallback(async (q: string, pg: number, brandName: string, status: string) => {
        if (!dbName || !schema || !currentBranch) return;
        setLoading(true);
        try {
            const sqlArgs = {
                brand:        brandName,
                branch_id:    currentBranch.id,
                limit:        PAGE_SIZE,
                location:     "",
                offset:       (pg - 1) * PAGE_SIZE,
                search:       q,
                stock_status: status,
            };
            const res = await apolloClient.query<GenericQueryData<PartFinderResultType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({ sqlArgs, sqlId: SQL_MAP.PART_FINDER_PAGED }) },
            });
            const rows = res.data?.genericQuery ?? [];
            setParts(rows);
            setTotal(rows[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_PART_FINDER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [currentBranch, dbName, schema]);

    // ── Debounce: update searchQ 1200ms after user stops typing ──────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(search);
        }, DEBOUNCE_MS);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    // ── Fire query when searchQ, page, brand or stock filter changes ──────────
    useEffect(() => {
        if (!searchQ.trim()) {
            setParts([]);
            setTotal(0);
            setSelectedPart(null);
            return;
        }
        void loadData(searchQ, page, selectedBrand?.name ?? "", stockFilter);
    }, [loadData, page, searchQ, selectedBrand, stockFilter]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    function handleBrandChange(brandId: string) {
        const brand = brandId === "__all__" ? null : (brands.find(b => String(b.id) === brandId) ?? null);
        if (brand?.id === selectedBrand?.id) return;
        setPage(1);
        setSelectedPart(null);
        setSelectedBrand(brand);
    }

    function handleClearSearch() {
        setSearch("");
        setSearchQ("");
        setPage(1);
        setParts([]);
        setTotal(0);
        setSelectedPart(null);
    }

    function handleRefresh() {
        if (!searchQ.trim()) return;
        void loadData(searchQ, page, selectedBrand?.name ?? "", stockFilter);
        void loadLocations();
    }

    function handleSelectPart(part: PartFinderResultType) {
        setSelectedPart(prev => prev?.id === part.id ? null : part);
    }

    function handleStockFilterChange(status: StockFilter) {
        if (status === stockFilter) return;
        setPage(1);
        setSelectedPart(null);
        setStockFilter(status);
    }

    if (!schema) {
        return (
            <div className="flex items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-2)] p-20">
                <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--cl-text)]">No Business Unit</p>
                    <p className="mt-2 text-xs text-[var(--cl-text-muted)]">
                        No business unit is assigned. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-[var(--cl-text)]">Part Finder</h1>
                <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                    Search and locate parts across your inventory
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">

                {/* Brand selector */}
                <Select
                    disabled={brandsLoading || brands.length === 0}
                    value={selectedBrand ? String(selectedBrand.id) : "__all__"}
                    onValueChange={handleBrandChange}
                >
                    <SelectTrigger className="h-8 w-44 text-sm">
                        <SelectValue placeholder={brandsLoading ? "Loading…" : "All Brands"} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All Brands</SelectItem>
                        {brands.map(b => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Search input with stock filter toggle inside */}
                <div className="flex h-8 min-w-[260px] flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring">
                    <SearchIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cl-text-muted)]" />
                    <input
                        ref={searchInputRef}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cl-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                        placeholder="Search code, name, description, category, model…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="flex shrink-0 items-center rounded border border-[var(--cl-border)] bg-[var(--cl-surface-3)] p-0.5">
                        <button
                            className={`rounded px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                                stockFilter === "all"
                                    ? "bg-[var(--cl-accent)] text-white shadow"
                                    : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                            }`}
                            type="button"
                            onClick={() => handleStockFilterChange("all")}
                        >
                            All
                        </button>
                        <button
                            className={`rounded px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                                stockFilter === "in_stock"
                                    ? "bg-[var(--cl-accent)] text-white shadow"
                                    : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                            }`}
                            type="button"
                            onClick={() => handleStockFilterChange("in_stock")}
                        >
                            In Stock
                        </button>
                    </div>
                    {search && (
                        <button
                            aria-label="Clear search"
                            className="shrink-0 cursor-pointer text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                            type="button"
                            onClick={handleClearSearch}
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Record range */}
                {!loading && total > 0 && (
                    <p className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                        {from}–{to} of {total}
                        {selectedPart && <span className="ml-2 text-[var(--cl-accent)]">· 1 selected</span>}
                    </p>
                )}

                {/* View toggle */}
                <div className="flex items-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] p-0.5">
                    <button
                        className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                            viewMode === "table"
                                ? "bg-[var(--cl-accent)] text-white shadow"
                                : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                        }`}
                        title="Table view"
                        type="button"
                        onClick={() => setViewMode("table")}
                    >
                        <List className="h-4 w-4" />
                    </button>
                    <button
                        className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                            viewMode === "card"
                                ? "bg-[var(--cl-accent)] text-white shadow"
                                : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                        }`}
                        title="Card view"
                        type="button"
                        onClick={() => setViewMode("card")}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                </div>

                {searchQ && (
                    <Button
                        className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        onClick={handleRefresh}
                    >
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                )}
            </div>

            {/* Results area */}
            {!searchQ ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--cl-border)] bg-[var(--cl-surface-2)]">
                    <div className="text-center">
                        <SearchIcon className="mx-auto mb-3 h-10 w-10 text-[var(--cl-text-muted)] opacity-30" />
                        <p className="text-sm font-semibold text-[var(--cl-text)]">Start typing to search</p>
                        <p className="mt-1 text-xs text-[var(--cl-text-muted)]">
                            Search by part code, name, description, category, or model
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                    {/* Results + pagination */}
                    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto">
                        <AnimatePresence mode="wait">
                            {viewMode === "table" ? (
                                <motion.div
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    initial={{ opacity: 0 }}
                                    key="table"
                                    transition={{ duration: 0.15 }}
                                >
                                    <PartFinderTable
                                        loading={loading}
                                        parts={parts}
                                        selectedId={selectedPart?.id ?? null}
                                        onSelectPart={handleSelectPart}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    initial={{ opacity: 0 }}
                                    key="card"
                                    transition={{ duration: 0.15 }}
                                >
                                    <PartFinderCard
                                        loading={loading}
                                        parts={parts}
                                        selectedId={selectedPart?.id ?? null}
                                        onSelectPart={handleSelectPart}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Pagination — First / Prev / Next / Last */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-[var(--cl-border)] pt-3">
                                <p className="text-xs text-[var(--cl-text-muted)]">
                                    Page {page} of {totalPages} · {total} parts
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button
                                        className="h-7 w-7"
                                        disabled={page <= 1 || loading}
                                        size="icon"
                                        title="First page"
                                        variant="ghost"
                                        onClick={() => setPage(1)}
                                    >
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="h-7 w-7"
                                        disabled={page <= 1 || loading}
                                        size="icon"
                                        title="Previous page"
                                        variant="ghost"
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="h-7 w-7"
                                        disabled={page >= totalPages || loading}
                                        size="icon"
                                        title="Next page"
                                        variant="ghost"
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        className="h-7 w-7"
                                        disabled={page >= totalPages || loading}
                                        size="icon"
                                        title="Last page"
                                        variant="ghost"
                                        onClick={() => setPage(totalPages)}
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detail panel */}
                    <PartFinderDetailPanel
                        locations={locations}
                        part={selectedPart}
                        onClose={() => setSelectedPart(null)}
                        onRefresh={() => void loadData(searchQ, page, selectedBrand?.name ?? "", stockFilter)}
                    />
                </div>
            )}
        </motion.div>
    );
};
