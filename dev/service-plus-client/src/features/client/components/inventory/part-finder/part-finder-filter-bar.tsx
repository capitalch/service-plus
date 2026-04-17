import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, FilterX, SearchIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import type { PartFinderFiltersType, PartFinderResultType, StockStatusType } from "@/features/client/types/part-finder";
import { DEFAULT_FILTERS } from "@/features/client/types/part-finder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    allParts:   PartFinderResultType[];
    filters:    PartFinderFiltersType;
    onFilters:  (f: PartFinderFiltersType) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function activeCount(f: PartFinderFiltersType): number {
    let n = 0;
    if (f.search)               n++;
    if (f.brands.length > 0)    n++;
    if (f.categories.length > 0) n++;
    if (f.locations.length > 0) n++;
    if (f.models.length > 0)    n++;
    if (f.stockStatus !== "all") n++;
    return n;
}

// ─── Stock status button ──────────────────────────────────────────────────────

type StatusBtnProps = {
    active:  boolean;
    label:   string;
    onClick: () => void;
    value:   StockStatusType;
};

function StatusBtn({ active, label, onClick, value }: StatusBtnProps) {
    const colorMap: Record<StockStatusType, string> = {
        all:          active ? "bg-[var(--cl-accent)] text-white shadow"  : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]",
        in_stock:     active ? "bg-emerald-600 text-white shadow"         : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]",
        low_stock:    active ? "bg-amber-500 text-white shadow"           : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]",
        out_of_stock: active ? "bg-rose-600 text-white shadow"            : "text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]",
    };
    return (
        <button
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${colorMap[value]}`}
            type="button"
            onClick={onClick}
        >
            {label}
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderFilterBar = ({ allParts, filters, onFilters }: Props) => {
    const { brands, categories, locations, models } = useMemo(() => {
        const bd = new Set<string>();
        const ct = new Set<string>();
        const md = new Set<string>();
        const lc = new Set<string>();
        allParts.forEach(p => {
            if (p.brand_name) bd.add(p.brand_name);
            if (p.category) ct.add(p.category);
            if (p.model) md.add(p.model);
            if (p.primary_location) lc.add(p.primary_location);
        });
        return {
            brands: Array.from(bd).sort(),
            categories: Array.from(ct).sort(),
            models: Array.from(md).sort(),
            locations: Array.from(lc).sort(),
        };
    }, [allParts]);

    const [open, setOpen]         = useState(true);
    const [localSearch, setLocal] = useState(filters.search);
    const debouncedSearch         = useDebounce(localSearch, 1200);
    const prevDebounced           = useRef(debouncedSearch);

    // Push debounced search up to parent (which resets page to 1)
    useEffect(() => {
        if (debouncedSearch !== prevDebounced.current) {
            prevDebounced.current = debouncedSearch;
            onFilters({ ...filters, search: debouncedSearch });
        }
    }, [debouncedSearch, filters, onFilters]);

    const count = activeCount(filters);

    function handleReset() {
        setLocal("");
        onFilters(DEFAULT_FILTERS);
    }

    function setStatus(s: StockStatusType) {
        onFilters({ ...filters, stockStatus: s });
    }

    function setSingle(field: keyof Pick<PartFinderFiltersType, "brands" | "categories" | "locations" | "models">, value: string) {
        const arr = value === "__all__" ? [] : [value];
        onFilters({ ...filters, [field]: arr });
    }

    function selectedOne(field: keyof Pick<PartFinderFiltersType, "brands" | "categories" | "locations" | "models">): string {
        const arr = filters[field];
        return arr.length > 0 ? arr[0] : "__all__";
    }

    return (
        <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
            {/* Bar toggle header */}
            <button
                className="flex w-full items-center justify-between px-4 py-3"
                type="button"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--cl-text)]">Filters</span>
                    {count > 0 && (
                        <Badge className="border-[var(--cl-accent)] bg-[var(--cl-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--cl-accent)]" variant="outline">
                            {count} active
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {count > 0 && (
                        <button
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
                            type="button"
                            onClick={e => { e.stopPropagation(); handleReset(); }}
                        >
                            <FilterX className="h-3 w-3" />
                            Reset
                        </button>
                    )}
                    {open
                        ? <ChevronUp   className="h-4 w-4 text-[var(--cl-text-muted)]" />
                        : <ChevronDown className="h-4 w-4 text-[var(--cl-text-muted)]" />}
                </div>
            </button>

            {/* Collapsible filter content */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        animate={{ height: "auto", opacity: 1 }}
                        className="overflow-hidden"
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                        <div className="border-t border-[var(--cl-border)] px-4 pb-4 pt-3">
                            <div className="flex flex-wrap gap-3">

                                {/* Text search */}
                                <div className="relative min-w-[220px] flex-1">
                                    <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                                    <Input
                                        className="h-8 pl-8 pr-7 text-sm"
                                        placeholder="Search code, name, description…"
                                        value={localSearch}
                                        onChange={e => setLocal(e.target.value)}
                                    />
                                    {localSearch && (
                                        <button
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                            type="button"
                                            onClick={() => setLocal("")}
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Category */}
                                {categories.length > 0 && (
                                    <Select value={selectedOne("categories")} onValueChange={v => setSingle("categories", v)}>
                                        <SelectTrigger className="h-8 w-40 text-xs">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Categories</SelectItem>
                                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Brand */}
                                {brands.length > 0 && (
                                    <Select value={selectedOne("brands")} onValueChange={v => setSingle("brands", v)}>
                                        <SelectTrigger className="h-8 w-36 text-xs">
                                            <SelectValue placeholder="Brand" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Brands</SelectItem>
                                            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Model */}
                                {models.length > 0 && (
                                    <Select value={selectedOne("models")} onValueChange={v => setSingle("models", v)}>
                                        <SelectTrigger className="h-8 w-40 text-xs">
                                            <SelectValue placeholder="Model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Models</SelectItem>
                                            {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Location */}
                                {locations.length > 0 && (
                                    <Select value={selectedOne("locations")} onValueChange={v => setSingle("locations", v)}>
                                        <SelectTrigger className="h-8 w-40 text-xs">
                                            <SelectValue placeholder="Location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Locations</SelectItem>
                                            {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Stock status toggle */}
                                <div className="flex items-center gap-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface-3)] px-1 py-1">
                                    <StatusBtn active={filters.stockStatus === "all"}          label="All"          onClick={() => setStatus("all")}          value="all" />
                                    <StatusBtn active={filters.stockStatus === "in_stock"}     label="In Stock"     onClick={() => setStatus("in_stock")}     value="in_stock" />
                                    <StatusBtn active={filters.stockStatus === "low_stock"}    label="Low Stock"    onClick={() => setStatus("low_stock")}    value="low_stock" />
                                    <StatusBtn active={filters.stockStatus === "out_of_stock"} label="Out of Stock" onClick={() => setStatus("out_of_stock")} value="out_of_stock" />
                                </div>

                                {count > 0 && (
                                    <Button
                                        className="h-8 gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleReset}
                                    >
                                        <FilterX className="h-3.5 w-3.5" />
                                        Reset All
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
