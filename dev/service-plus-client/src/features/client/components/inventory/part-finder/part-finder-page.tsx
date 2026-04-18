import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutGrid, List, RefreshCwIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { LocationOptionType } from "@/features/client/types/set-part-location";
import type { FilterOptionsType, PartFinderFiltersType, PartFinderResultType } from "@/features/client/types/part-finder";
import { DEFAULT_FILTERS } from "@/features/client/types/part-finder";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PartFinderCard } from "./part-finder-card";
import { PartFinderDetailPanel } from "./part-finder-detail-panel";
import { PartFinderFilterBar } from "./part-finder-filter-bar";
import { PartFinderTable } from "./part-finder-table";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "card" | "table";

type GenericQueryData<T> = { genericQuery: T[] | null };

type DistinctValueType = { value: string };

const EMPTY_OPTIONS: FilterOptionsType = { categories: [], models: [] };

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderPage = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [parts,         setParts]         = useState<PartFinderResultType[]>([]);
    const [total,         setTotal]         = useState(0);
    const [page,          setPage]          = useState(1);
    const [locations,     setLocations]     = useState<LocationOptionType[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptionsType>(EMPTY_OPTIONS);
    const [loading,       setLoading]       = useState(false);
    const [hasSearched,   setHasSearched]   = useState(false);
    const [filters,       setFilters]       = useState<PartFinderFiltersType>(DEFAULT_FILTERS);
    const [viewMode,      setViewMode]      = useState<ViewMode>("table");
    const [selectedPart,  setSelectedPart]  = useState<PartFinderResultType | null>(null);

    // ── Load filter dropdown options (deferred on mount) ─────────────────────
    const loadFilterOptions = useCallback(async () => {
        if (!dbName || !schema || !currentBranch) return;
        try {
            const [catsRes, modelsRes, locsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<DistinctValueType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.PART_FINDER_DISTINCT_CATEGORIES, sqlArgs: {} }) },
                }),
                apolloClient.query<GenericQueryData<DistinctValueType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.PART_FINDER_DISTINCT_MODELS, sqlArgs: {} }) },
                }),
                apolloClient.query<GenericQueryData<LocationOptionType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: { db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ACTIVE_LOCATIONS_BY_BRANCH, sqlArgs: { branch_id: currentBranch.id } }) },
                }),
            ]);
            setLocations(locsRes.data?.genericQuery ?? []);
            setFilterOptions({
                categories: (catsRes.data?.genericQuery   ?? []).map(r => r.value),
                models:     (modelsRes.data?.genericQuery ?? []).map(r => r.value),
            });
        } catch {
            // non-critical; filter dropdowns stay empty
        }
    }, [dbName, schema, currentBranch]);

    useEffect(() => {
        setTimeout(() => void loadFilterOptions(), 0);
    }, [loadFilterOptions]);

    // ── Load paged data ───────────────────────────────────────────────────────
    const loadData = useCallback(async (f: PartFinderFiltersType, pg: number, withCount: boolean) => {
        if (!dbName || !schema || !currentBranch) return;
        setLoading(true);
        try {
            const sqlArgs = {
                branch_id:    currentBranch.id,
                search:       f.search,
                category:     f.categories[0] ?? "",
                brand:        "",
                model:        f.models[0]     ?? "",
                location:     "",
                stock_status: "all",
            };
            const pagedQuery = apolloClient.query<GenericQueryData<PartFinderResultType>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.PART_FINDER_PAGED,
                        sqlArgs: { ...sqlArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                    }) },
            });
            if (withCount) {
                const [dataRes, countRes] = await Promise.all([
                    pagedQuery,
                    apolloClient.query<GenericQueryData<{ total: number }>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: { db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId:   SQL_MAP.PART_FINDER_COUNT,
                                sqlArgs,
                            }) },
                    }),
                ]);
                setParts(dataRes.data?.genericQuery ?? []);
                setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
            } else {
                const dataRes = await pagedQuery;
                setParts(dataRes.data?.genericQuery ?? []);
            }
        } catch {
            toast.error(MESSAGES.ERROR_PART_FINDER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, currentBranch]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    function handleSearch(f: PartFinderFiltersType) {
        setHasSearched(true);
        setFilters(f);
        setPage(1);
        setSelectedPart(null);
        void loadData(f, 1, true);
    }

    function handleReset() {
        setHasSearched(false);
        setFilters(DEFAULT_FILTERS);
        setPage(1);
        setParts([]);
        setTotal(0);
        setSelectedPart(null);
    }

    function handlePagePrev() {
        const pg = page - 1;
        setPage(pg);
        void loadData(filters, pg, false);
    }

    function handlePageNext() {
        const pg = page + 1;
        setPage(pg);
        void loadData(filters, pg, false);
    }

    function handleRefresh() {
        if (!hasSearched) return;
        void loadData(filters, page, true);
        void loadFilterOptions();
    }

    function handleSelectPart(part: PartFinderResultType) {
        setSelectedPart(prev => prev?.id === part.id ? null : part);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-[var(--cl-text)]">Part Finder</h1>
                    <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                        Search and locate parts across your inventory
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex items-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] p-0.5">
                        <button
                            className={`rounded-md p-1.5 transition-colors ${
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
                            className={`rounded-md p-1.5 transition-colors ${
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

                    {hasSearched && (
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
            </div>

            {/* Filter bar */}
            <PartFinderFilterBar
                filterOptions={filterOptions}
                onReset={handleReset}
                onSearch={handleSearch}
            />

            {/* Results area */}
            {!hasSearched ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--cl-border)] bg-[var(--cl-surface-2)]">
                    <div className="text-center">
                        <SearchIcon className="mx-auto mb-3 h-10 w-10 text-[var(--cl-text-muted)] opacity-30" />
                        <p className="text-sm font-semibold text-[var(--cl-text)]">Enter search criteria</p>
                        <p className="mt-1 text-xs text-[var(--cl-text-muted)]">
                            Type a part code, name, or description and press Enter or click Search
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Results count */}
                    {!loading && total > 0 && (
                        <p className="text-xs text-[var(--cl-text-muted)]">
                            Showing{" "}
                            <span className="font-semibold text-[var(--cl-text)]">
                                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                            </span>{" "}
                            of <span className="font-semibold text-[var(--cl-text)]">{total}</span> parts
                            {selectedPart && (
                                <span className="ml-2 text-[var(--cl-accent)]">· 1 selected</span>
                            )}
                        </p>
                    )}

                    {/* Main content: results + detail panel side by side */}
                    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                        {/* Results */}
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

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-end gap-2 border-t border-[var(--cl-border)] pt-3">
                                    <span className="text-xs text-[var(--cl-text-muted)]">
                                        Page {page} of {totalPages} · {total} parts
                                    </span>
                                    <Button
                                        disabled={page <= 1 || loading}
                                        size="sm"
                                        variant="outline"
                                        onClick={handlePagePrev}
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        Prev
                                    </Button>
                                    <Button
                                        disabled={page >= totalPages || loading}
                                        size="sm"
                                        variant="outline"
                                        onClick={handlePageNext}
                                    >
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Detail panel — always visible */}
                        <PartFinderDetailPanel
                            locations={locations}
                            part={selectedPart}
                            onClose={() => setSelectedPart(null)}
                            onRefresh={() => void loadData(filters, page, true)}
                        />
                    </div>
                </>
            )}
        </motion.div>
    );
};
