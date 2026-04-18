import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, FilterX, SearchIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FilterOptionsType, PartFinderFiltersType } from "@/features/client/types/part-finder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    filterOptions: FilterOptionsType;
    onSearch:      (f: PartFinderFiltersType) => void;
    onReset:       () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PartFinderFilterBar = ({ filterOptions, onSearch, onReset }: Props) => {
    const { categories, models } = filterOptions;

    const [open,        setOpen]       = useState(true);
    const [search,      setSearch]     = useState("");
    const [category,    setCategory]   = useState("__all__");
    const [model,       setModel]      = useState("__all__");
    const [searchError, setSearchError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function buildFilters(overrides?: Partial<{ search: string; category: string; model: string }>): PartFinderFiltersType {
        const s = overrides?.search   ?? search;
        const c = overrides?.category ?? category;
        const m = overrides?.model    ?? model;
        return {
            search:     s,
            categories: c !== "__all__" ? [c] : [],
            models:     m !== "__all__" ? [m] : [],
        };
    }

    function handleSubmit() {
        if (!search.trim()) {
            setSearchError(true);
            inputRef.current?.focus();
            return;
        }
        onSearch(buildFilters());
    }

    function handleReset() {
        setSearch("");
        setCategory("__all__");
        setModel("__all__");
        setSearchError(false);
        onReset();
        inputRef.current?.focus();
    }

    // Dropdowns only update local state; search text is still required to submit
    function handleCategoryChange(v: string) {
        setCategory(v);
        if (search.trim()) onSearch(buildFilters({ category: v }));
    }

    function handleModelChange(v: string) {
        setModel(v);
        if (search.trim()) onSearch(buildFilters({ model: v }));
    }

    const activeCount = [
        search,
        category !== "__all__" ? category : "",
        model    !== "__all__" ? model    : "",
    ].filter(Boolean).length;

    return (
        <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface-2)] shadow-sm">
            {/* Bar toggle header */}
            <button
                className="flex w-full items-center justify-between px-4 py-3"
                type="button"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--cl-text)]">Search &amp; Filters</span>
                    {activeCount > 0 && (
                        <Badge className="border-[var(--cl-accent)] bg-[var(--cl-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--cl-accent)]" variant="outline">
                            {activeCount} active
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {activeCount > 0 && (
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

                                {/* Text search — Enter key submits */}
                                <div className="relative min-w-[220px] flex-1">
                                    <SearchIcon className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${searchError ? "text-rose-500" : "text-[var(--cl-text-muted)]"}`} />
                                    <Input
                                        ref={inputRef}
                                        className={`h-8 pl-8 pr-7 text-sm ${searchError ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                                        placeholder="Search code, name, description… (Enter to search)"
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); if (searchError) setSearchError(false); }}
                                        onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
                                    />
                                    {search && (
                                        <button
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]"
                                            type="button"
                                            onClick={() => setSearch("")}
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Category — submits on selection */}
                                {categories.length > 0 && (
                                    <Select value={category} onValueChange={handleCategoryChange}>
                                        <SelectTrigger className="h-8 w-40 text-xs">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Categories</SelectItem>
                                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Model — submits on selection */}
                                {models.length > 0 && (
                                    <Select value={model} onValueChange={handleModelChange}>
                                        <SelectTrigger className="h-8 w-40 text-xs">
                                            <SelectValue placeholder="Model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All Models</SelectItem>
                                            {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}

                                {/* Search button */}
                                <Button
                                    className="h-8 gap-1.5 bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent)]/90"
                                    size="sm"
                                    onClick={handleSubmit}
                                >
                                    <SearchIcon className="h-3.5 w-3.5" />
                                    Search
                                </Button>

                                {activeCount > 0 && (
                                    <Button
                                        className="h-8 gap-1.5 border border-[var(--cl-border)] bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)]"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleReset}
                                    >
                                        <FilterX className="h-3.5 w-3.5" />
                                        Reset
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
