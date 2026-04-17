import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import type { LocationOptionType, StockBalanceWithLocationType } from "@/features/client/types/set-part-location";
import { SetLocationForSelectedDialog } from "./set-location-for-selected-dialog";
import { SetPartLocationDialog } from "./set-part-location-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]";

// ─── Row animation ────────────────────────────────────────────────────────────

const rowVariants = {
    hidden:  { opacity: 0, y: 6 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.03, duration: 0.2, ease: "easeOut" as const },
    }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SetPartLocationSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [parts,              setParts]              = useState<StockBalanceWithLocationType[]>([]);
    const [locations,          setLocations]          = useState<LocationOptionType[]>([]);
    const [loading,            setLoading]            = useState(false);
    const [search,             setSearch]             = useState("");
    const [selectedIds,        setSelectedIds]        = useState<Set<number>>(new Set());
    const [dialogOpen,         setDialogOpen]         = useState(false);
    const [selectedDialogOpen, setSelectedDialogOpen] = useState(false);

    const loadData = useCallback(async () => {
        if (!dbName || !schema || !currentBranch) return;
        setLoading(true);
        setSelectedIds(new Set());
        try {
            const [partsRes, locsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<StockBalanceWithLocationType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { branch_id: currentBranch.id },
                            sqlId:   SQL_MAP.GET_STOCK_BALANCE_WITH_LOCATION,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<LocationOptionType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { branch_id: currentBranch.id },
                            sqlId:   SQL_MAP.GET_ACTIVE_LOCATIONS_BY_BRANCH,
                        }),
                    },
                }),
            ]);
            setParts(partsRes.data?.genericQuery ?? []);
            setLocations(locsRes.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_SET_PART_LOCATIONS_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema, currentBranch]);

    useEffect(() => { loadData(); }, [loadData]);

const displayParts = useMemo(() => {
        if (!search.trim()) return parts;
        const q = search.toLowerCase();
        return parts.filter(p =>
            p.part_code.toLowerCase().includes(q) ||
            p.part_name.toLowerCase().includes(q) ||
            (p.location_name?.toLowerCase().includes(q) ?? false)
        );
    }, [parts, search]);

    // Selection helpers
    const allSelected   = displayParts.length > 0 && displayParts.every(p => selectedIds.has(p.part_id));
    const someSelected  = displayParts.some(p => selectedIds.has(p.part_id));
    const selectedCount = [...selectedIds].filter(id => parts.some(p => p.part_id === id)).length;

    function toggleSelectAll() {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayParts.map(p => p.part_id)));
        }
    }

    function toggleRow(partId: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(partId)) next.delete(partId);
            else next.add(partId);
            return next;
        });
    }

    const selectedParts = parts.filter(p => selectedIds.has(p.part_id));
    const noLocations   = locations.length === 0;

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
        <>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex min-h-0 flex-1 flex-col gap-4"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--cl-text)]">Set Part Location</h1>
                        <p className="mt-1 text-sm text-[var(--cl-text-muted)]">
                            Assign storage locations to parts in stock for this branch.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                        {selectedCount > 0 && (
                            <Button
                                className="bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                                disabled={noLocations}
                                size="sm"
                                onClick={() => setSelectedDialogOpen(true)}
                            >
                                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                                Set Location for Selected ({selectedCount})
                            </Button>
                        )}
                        <Button
                            className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                            disabled={noLocations || loading}
                            size="sm"
                            onClick={() => setDialogOpen(true)}
                        >
                            <MapPin className="mr-1.5 h-3.5 w-3.5" />
                            Set Locations
                        </Button>
                    </div>
                </div>

                {/* No-locations warning */}
                {!loading && noLocations && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                        No active locations found for this branch. Add locations under{" "}
                        <span className="font-semibold">Masters &gt; Part Location</span> before using this feature.
                    </div>
                )}

                {/* Search + count */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            className="h-8 pl-8 pr-8 text-sm"
                            disabled={loading}
                            placeholder="Search part code, name or location…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-[var(--cl-text-muted)] hover:text-[var(--cl-text)] focus:outline-none"
                                type="button"
                                onClick={() => setSearch("")}
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {!loading && parts.length > 0 && (
                        <div className="flex shrink-0 items-center gap-2">
                            <p className="text-xs text-[var(--cl-text-muted)]">
                                {displayParts.length} of {parts.length}
                            </p>
                            {selectedCount > 0 && (
                                <Badge className="border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300" variant="outline">
                                    {selectedCount} selected
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* Table */}
                {loading && parts.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--cl-surface-2)]" />
                        ))}
                    </div>
                ) : parts.length === 0 ? (
                    <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-6 py-12 text-center text-sm text-[var(--cl-text-muted)]">
                        No stock found for this branch.
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
                        <div className="overflow-x-auto overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="sticky top-0 z-10 bg-[var(--cl-surface-3)] hover:bg-[var(--cl-surface-3)]">
                                        <TableHead className="w-10 text-center">
                                            <Checkbox
                                                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                                className="border-[var(--cl-text-muted)] bg-[var(--cl-input-bg)] cursor-pointer"
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className={`w-8 text-center ${thClass}`}>#</TableHead>
                                        <TableHead className={thClass}>Part Code</TableHead>
                                        <TableHead className={thClass}>Part Details</TableHead>
                                        <TableHead className={thClass}>UOM</TableHead>
                                        <TableHead className={`${thClass} text-right`}>Qty</TableHead>
                                        <TableHead className={thClass}>Current Location</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayParts.length === 0 ? (
                                        <tr>
                                            <td colSpan={99} className="px-6 py-10 text-center text-sm text-[var(--cl-text-muted)]">
                                                No results match &ldquo;{search}&rdquo;.
                                            </td>
                                        </tr>
                                    ) : (
                                        displayParts.map((part, idx) => {
                                            const isSelected = selectedIds.has(part.part_id);
                                            return (
                                                <motion.tr
                                                    animate="visible"
                                                    className={`border-b border-[var(--cl-border)] transition-colors last:border-b-0 hover:bg-[var(--cl-surface-3)] ${isSelected ? "bg-sky-50/60 dark:bg-sky-950/20" : ""}`}
                                                    custom={idx}
                                                    initial="hidden"
                                                    key={part.part_id}
                                                    variants={rowVariants}
                                                >
                                                    <TableCell className="text-center">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            className="border-[var(--cl-text-muted)] bg-[var(--cl-input-bg)] cursor-pointer"
                                                            onCheckedChange={() => toggleRow(part.part_id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs text-[var(--cl-text-muted)]">{idx + 1}</TableCell>
                                                    <TableCell className="font-mono text-sm font-medium text-[var(--cl-text)]">{part.part_code}</TableCell>
                                                    <TableCell className="text-sm text-[var(--cl-text)]">
                                                        {[part.part_name, part.part_description, part.category, part.model]
                                                            .map(v => v?.trim())
                                                            .filter(Boolean)
                                                            .join(" · ")}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-[var(--cl-text-muted)]">{part.uom ?? "—"}</TableCell>
                                                    <TableCell className="text-right text-sm tabular-nums text-[var(--cl-text)]">{part.qty}</TableCell>
                                                    <TableCell>
                                                        {part.location_name ? (
                                                            <Badge
                                                                className="border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50"
                                                                variant="outline"
                                                            >
                                                                <MapPin className="mr-1 h-2.5 w-2.5" />
                                                                {part.location_name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-[var(--cl-text-muted)]">—</span>
                                                        )}
                                                    </TableCell>
                                                </motion.tr>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </motion.div>

            <SetPartLocationDialog
                locations={locations}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={loadData}
            />

            <SetLocationForSelectedDialog
                locations={locations}
                open={selectedDialogOpen}
                parts={selectedParts}
                onOpenChange={setSelectedDialogOpen}
                onSuccess={() => { setSelectedIds(new Set()); loadData(); }}
            />
        </>
    );
};
