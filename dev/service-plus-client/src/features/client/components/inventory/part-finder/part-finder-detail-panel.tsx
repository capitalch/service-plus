import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Clock, Hash, MapPin, Package, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { SetPartLocationDialog } from "@/features/client/components/inventory/set-part-location/set-part-location-dialog";
import type { LocationOptionType, PartLocationHistoryType } from "@/features/client/types/set-part-location";
import type { PartFinderResultType, PartFinderStockByLocationType } from "@/features/client/types/part-finder";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import { PartFinderStockChart } from "./part-finder-stock-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = "history" | "overview" | "stock";

type Props = {
    locations:    LocationOptionType[];
    onClose:      () => void;
    onRefresh:    () => void;
    open:         boolean;
    part:         PartFinderResultType | null;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
            <span className="shrink-0 text-[var(--cl-text-muted)]">{label}</span>
            <span className="text-right font-medium text-[var(--cl-text)]">{value ?? "—"}</span>
        </div>
    );
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return (
        <button
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                    ? "bg-[var(--cl-accent)] text-white shadow"
                    : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
            }`}
            type="button"
            onClick={onClick}
        >
            {label}
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderDetailPanel = ({ locations, onClose, onRefresh, open, part }: Props) => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);

    const [tab,           setTab]           = useState<TabType>("overview");
    const [stockByLoc,    setStockByLoc]    = useState<PartFinderStockByLocationType[]>([]);
    const [history,       setHistory]       = useState<PartLocationHistoryType[]>([]);
    const [loadingStock,  setLoadingStock]  = useState(false);
    const [loadingHist,   setLoadingHist]   = useState(false);
    const [locDialogOpen, setLocDialogOpen] = useState(false);

    const loadStockByLoc = useCallback(async () => {
        if (!dbName || !schema || !currentBranch || !part) return;
        setLoadingStock(true);
        try {
            const res = await apolloClient.query<GenericQueryData<PartFinderStockByLocationType>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: currentBranch.id, part_id: part.id },
                        sqlId:   SQL_MAP.PART_FINDER_STOCK_BY_LOCATION,
                    }),
                },
            });
            setStockByLoc(res.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_PART_FINDER_STOCK_BY_LOCATION_FAILED);
        } finally {
            setLoadingStock(false);
        }
    }, [dbName, schema, currentBranch, part]);

    const loadHistory = useCallback(async () => {
        if (!dbName || !schema || !currentBranch || !part) return;
        setLoadingHist(true);
        try {
            const res = await apolloClient.query<GenericQueryData<PartLocationHistoryType>>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { branch_id: currentBranch.id, part_id: part.id },
                        sqlId:   SQL_MAP.GET_PART_LOCATION_HISTORY,
                    }),
                },
            });
            setHistory(res.data?.genericQuery ?? []);
        } catch {
            toast.error(MESSAGES.ERROR_PART_FINDER_HISTORY_LOAD_FAILED);
        } finally {
            setLoadingHist(false);
        }
    }, [dbName, schema, currentBranch, part]);

    // Reset tab and reload data when part changes
    useEffect(() => {
        if (part) {
            setTab("overview");
            setStockByLoc([]);
            setHistory([]);
        }
    }, [part?.id]);

    // Load stock/history when switching tabs
    useEffect(() => {
        if (!part) return;
        if (tab === "stock"   && stockByLoc.length === 0) loadStockByLoc();
        if (tab === "history" && history.length === 0)    loadHistory();
    }, [tab, part]);

    const panelVariants = {
        hidden:  { opacity: 0, x: 40 },
        visible: { opacity: 1, x: 0,  transition: { duration: 0.22, ease: "easeOut" as const } },
        exit:    { opacity: 0, x: 40, transition: { duration: 0.18, ease: "easeIn"  as const } },
    };

    return (
        <AnimatePresence>
            {open && part && (
                <motion.div
                    animate="visible"
                    className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-xl"
                    exit="exit"
                    initial="hidden"
                    variants={panelVariants}
                >
                    {/* Panel header */}
                    <div className="flex items-start justify-between border-b border-[var(--cl-border)] px-4 py-3">
                        <div className="min-w-0">
                            <p className="font-mono text-xs text-[var(--cl-text-muted)]">{part.part_code}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-[var(--cl-text)]">{part.part_name}</p>
                        </div>
                        <button
                            className="ml-2 shrink-0 rounded p-0.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
                            type="button"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-[var(--cl-border)] px-3 py-2">
                        <TabBtn active={tab === "overview"} label="Overview" onClick={() => setTab("overview")} />
                        <TabBtn active={tab === "stock"}    label="Stock"    onClick={() => setTab("stock")}    />
                        <TabBtn active={tab === "history"}  label="History"  onClick={() => setTab("history")}  />
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">

                        {/* ── Overview ── */}
                        {tab === "overview" && (
                            <div className="space-y-4">
                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <Badge className={part.qty <= 0
                                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                                        : part.qty <= 5
                                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"}
                                        variant="outline"
                                    >
                                        {part.qty <= 0 ? "Out of Stock" : part.qty <= 5 ? "Low Stock" : "In Stock"}
                                    </Badge>
                                    <span className={`text-2xl font-bold tabular-nums ${
                                        part.qty <= 0 ? "text-rose-600" : part.qty <= 5 ? "text-amber-600" : "text-emerald-600"
                                    }`}>
                                        {part.qty}
                                    </span>
                                    <span className="text-sm text-[var(--cl-text-muted)]">{part.uom ?? ""}</span>
                                </div>

                                {/* Part identity */}
                                <section>
                                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--cl-accent-text)]">
                                        <Package className="h-3.5 w-3.5" />
                                        Part Identity
                                    </p>
                                    <div className="divide-y divide-[var(--cl-border)] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-3">
                                        <InfoRow label="Part Code"    value={<span className="font-mono">{part.part_code}</span>} />
                                        <InfoRow label="Part Name"    value={part.part_name} />
                                        <InfoRow label="Description"  value={part.part_description} />
                                        <InfoRow label="Brand"        value={part.brand_name} />
                                        <InfoRow label="Category"     value={part.category} />
                                        <InfoRow label="Model"        value={part.model} />
                                        <InfoRow label="UOM"          value={part.uom} />
                                    </div>
                                </section>

                                {/* Pricing & Tax */}
                                <section>
                                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--cl-accent-text)]">
                                        <Tag className="h-3.5 w-3.5" />
                                        Pricing &amp; Tax
                                    </p>
                                    <div className="divide-y divide-[var(--cl-border)] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-3">
                                        <InfoRow label="Cost Price" value={part.cost_price != null ? `₹ ${part.cost_price.toFixed(2)}` : null} />
                                        <InfoRow label="MRP"        value={part.mrp        != null ? `₹ ${part.mrp.toFixed(2)}`        : null} />
                                        <InfoRow label="HSN Code"   value={part.hsn_code} />
                                        <InfoRow label="GST Rate"   value={part.gst_rate   != null ? `${part.gst_rate}%`               : null} />
                                    </div>
                                </section>

                                {/* Location summary */}
                                <section>
                                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--cl-accent-text)]">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Storage
                                    </p>
                                    <div className="divide-y divide-[var(--cl-border)] rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-3">
                                        <InfoRow label="Primary Location"  value={part.primary_location} />
                                        <InfoRow label="Locations"         value={part.location_count > 0 ? `${part.location_count} location${part.location_count !== 1 ? "s" : ""}` : "Unassigned"} />
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* ── Stock & Locations ── */}
                        {tab === "stock" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-[var(--cl-text-muted)]">Total Stock</p>
                                        <p className={`text-2xl font-bold tabular-nums ${
                                            part.qty <= 0 ? "text-rose-600" : part.qty <= 5 ? "text-amber-600" : "text-emerald-600"
                                        }`}>
                                            {part.qty} <span className="text-sm font-normal text-[var(--cl-text-muted)]">{part.uom ?? ""}</span>
                                        </p>
                                    </div>
                                    <Button
                                        className="gap-1.5 bg-teal-600 text-xs text-white hover:bg-teal-700"
                                        size="sm"
                                        onClick={() => setLocDialogOpen(true)}
                                    >
                                        <MapPin className="h-3.5 w-3.5" />
                                        Set Location
                                    </Button>
                                </div>

                                {loadingStock ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="h-8 animate-pulse rounded bg-[var(--cl-surface-3)]" />
                                        ))}
                                    </div>
                                ) : stockByLoc.length === 0 ? (
                                    <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-4 py-6 text-center text-sm text-[var(--cl-text-muted)]">
                                        No location data available
                                    </div>
                                ) : (
                                    <>
                                        {/* Location table */}
                                        <div className="overflow-hidden rounded-lg border border-[var(--cl-border)]">
                                            <table className="w-full text-sm">
                                                <thead className="bg-[var(--cl-surface-3)]">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Location</th>
                                                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)]">Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--cl-border)]">
                                                    {stockByLoc.map(loc => (
                                                        <tr key={loc.location_id} className="hover:bg-[var(--cl-surface-3)]">
                                                            <td className="px-3 py-2 text-[var(--cl-text)]">
                                                                <span className="flex items-center gap-1.5">
                                                                    <MapPin className="h-3 w-3 text-[var(--cl-text-muted)]" />
                                                                    {loc.location_name}
                                                                </span>
                                                            </td>
                                                            <td className={`px-3 py-2 text-right font-bold tabular-nums ${
                                                                loc.qty <= 0 ? "text-rose-600" : loc.qty <= 5 ? "text-amber-600" : "text-emerald-600"
                                                            }`}>
                                                                {loc.qty}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Chart */}
                                        <PartFinderStockChart data={stockByLoc} />
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── History ── */}
                        {tab === "history" && (
                            <div>
                                {loadingHist ? (
                                    <div className="space-y-3">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--cl-surface-3)]" />
                                        ))}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-4 py-10 text-center">
                                        <Clock className="mb-2 h-8 w-8 text-[var(--cl-text-muted)] opacity-40" />
                                        <p className="text-sm text-[var(--cl-text-muted)]">No location history yet</p>
                                    </div>
                                ) : (
                                    <div className="relative space-y-3 pl-5 before:absolute before:left-1.5 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[var(--cl-border)]">
                                        {history.map(h => (
                                            <div key={h.id} className="relative">
                                                <span className="absolute -left-5 mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--cl-accent)] bg-[var(--cl-surface-2)]" />
                                                <div className="rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="flex items-center gap-1 text-xs font-semibold text-[var(--cl-text)]">
                                                            <MapPin className="h-3 w-3" />
                                                            {h.location_name}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-xs text-[var(--cl-text-muted)]">
                                                            <Calendar className="h-3 w-3" />
                                                            {h.transaction_date}
                                                        </span>
                                                    </div>
                                                    {h.ref_no && (
                                                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--cl-text-muted)]">
                                                            <Hash className="h-3 w-3" />
                                                            {h.ref_no}
                                                        </p>
                                                    )}
                                                    {h.remarks && (
                                                        <p className="mt-1 text-xs italic text-[var(--cl-text-muted)]">{h.remarks}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Set Location Dialog */}
            <SetPartLocationDialog
                locations={locations}
                open={locDialogOpen}
                onOpenChange={setLocDialogOpen}
                onSuccess={() => { onRefresh(); loadStockByLoc(); }}
            />
        </AnimatePresence>
    );
};
