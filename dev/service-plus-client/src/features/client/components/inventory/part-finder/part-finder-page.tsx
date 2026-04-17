import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, List, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { LocationOptionType } from "@/features/client/types/set-part-location";
import type { PartFinderFiltersType, PartFinderResultType } from "@/features/client/types/part-finder";
import { DEFAULT_FILTERS, getStockStatus } from "@/features/client/types/part-finder";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PartFinderCard } from "./part-finder-card";
import { PartFinderDetailPanel } from "./part-finder-detail-panel";
import { PartFinderFilterBar } from "./part-finder-filter-bar";
import { PartFinderTable } from "./part-finder-table";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "card" | "table";

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyFilters(parts: PartFinderResultType[], filters: PartFinderFiltersType): PartFinderResultType[] {
    return parts.filter(p => {
        const s = filters.search.toLowerCase();
        if (s && !(
            p.part_code.toLowerCase().includes(s) ||
            p.part_name.toLowerCase().includes(s) ||
            (p.part_description?.toLowerCase().includes(s) ?? false)
        )) return false;

        if (filters.categories.length > 0 && !filters.categories.includes(p.category ?? "")) return false;
        if (filters.brands.length     > 0 && !filters.brands.includes(p.brand_name ?? ""))   return false;
        if (filters.models.length     > 0 && !filters.models.includes(p.model ?? ""))         return false;
        if (filters.locations.length  > 0 && !filters.locations.includes(p.primary_location ?? "")) return false;

        if (filters.stockStatus !== "all") {
            const status = getStockStatus(p.qty);
            if (status !== filters.stockStatus) return false;
        }

        return true;
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderPage = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [allParts,     setAllParts]     = useState<PartFinderResultType[]>([]);
    const [locations,    setLocations]    = useState<LocationOptionType[]>([]);
    const [loading,      setLoading]      = useState(false);
    const [filters,      setFilters]      = useState<PartFinderFiltersType>(DEFAULT_FILTERS);
    const [viewMode,     setViewMode]     = useState<ViewMode>("table");
    const [selectedPart, setSelectedPart] = useState<PartFinderResultType | null>(null);

    const loadData = useCallback(async () => {
        if (!dbName || !schema || !currentBranch) return;
        setLoading(true);
        try {
            const [partsRes, locsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<PartFinderResultType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { branch_id: currentBranch.id },
                            sqlId:   SQL_MAP.PART_FINDER_SEARCH,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<LocationOptionType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { branch_id: currentBranch.id },
                            sqlId:   SQL_MAP.GET_ACTIVE_LOCATIONS_BY_BRANCH,
                        }),
                    },
                }),
            ]);
            setAllParts(partsRes.data?.genericQuery ?? []);
            setLocations(locsRes.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_PART_FINDER_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, currentBranch]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered  = useMemo(() => applyFilters(allParts, filters), [allParts, filters]);
    const resultCount = filtered.length;

    function handleSelectPart(part: PartFinderResultType) {
        setSelectedPart(prev => prev?.id === part.id ? null : part);
    }

    function handleClosePanel() {
        setSelectedPart(null);
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

                    <Button
                        className="gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] shadow-sm hover:bg-[var(--cl-surface-3)]"
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        onClick={loadData}
                    >
                        <RefreshCwIcon className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <PartFinderFilterBar
                allParts={allParts}
                filters={filters}
                onFilters={setFilters}
            />

            {/* Results count */}
            {!loading && allParts.length > 0 && (
                <p className="text-xs text-[var(--cl-text-muted)]">
                    Showing <span className="font-semibold text-[var(--cl-text)]">{resultCount}</span>{" "}
                    of <span className="font-semibold text-[var(--cl-text)]">{allParts.length}</span> parts
                    {selectedPart && (
                        <span className="ml-2 text-[var(--cl-accent)]">· 1 selected</span>
                    )}
                </p>
            )}

            {/* Main content: results + detail panel side by side */}
            <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                {/* Results */}
                <div className="min-w-0 flex-1 overflow-auto">
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
                                    parts={filtered}
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
                                    parts={filtered}
                                    selectedId={selectedPart?.id ?? null}
                                    onSelectPart={handleSelectPart}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Detail panel */}
                <PartFinderDetailPanel
                    locations={locations}
                    open={selectedPart !== null}
                    part={selectedPart}
                    onClose={handleClosePanel}
                    onRefresh={loadData}
                />
            </div>
        </motion.div>
    );
};
