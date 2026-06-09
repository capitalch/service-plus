import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mail, MapPin, MessageSquare, Phone, Search, Tag, Users, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { CustomerSearchRow } from "@/features/client/types/sales";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

export type CustomerSearchModalProps = {
    open:          boolean;
    initialSearch: string;
    onOpenChange:  (open: boolean) => void;
    onSelect:      (c: CustomerSearchRow) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1600;
const MIN_CHARS   = 2;

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerSearchModal({ open, initialSearch, onOpenChange, onSelect }: CustomerSearchModalProps) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [search,  setSearch]  = useState("");
    const [results, setResults] = useState<CustomerSearchRow[]>([]);
    const [loading, setLoading] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef    = useRef<HTMLInputElement | null>(null);

    // Seed search box with whatever was typed in the main input
    useEffect(() => {
        if (!open) return;
        setSearch(initialSearch);
        setResults([]);
        setLoading(false);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (initialSearch.trim().length >= MIN_CHARS) {
            debounceRef.current = setTimeout(() => doSearch(initialSearch.trim()), DEBOUNCE_MS);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialSearch]);

    const doSearch = useCallback(async (q: string) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<CustomerSearchRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { limit: 50, offset: 0, search: q },
                        sqlId:   SQL_MAP.GET_CUSTOMERS_BY_KEYWORD,
                    }),
                },
            });
            setResults(res.data?.genericQuery ?? []);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    function handleSearchChange(val: string) {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (val.trim().length < MIN_CHARS) {
            setResults([]);
            return;
        }
        debounceRef.current = setTimeout(() => doSearch(val.trim()), DEBOUNCE_MS);
    }

    function handleReset() {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearch("");
        setResults([]);
        inputRef.current?.focus();
    }

    function handleSelect(row: CustomerSearchRow) {
        onSelect(row);
        onOpenChange(false);
    }

    const q             = search.trim();
    const showIdleHint  = q.length === 0 && !loading;
    const showMinHint   = q.length > 0 && q.length < MIN_CHARS;
    const showSearching = loading && results.length === 0;
    const showEmpty     = !loading && q.length >= MIN_CHARS && results.length === 0;
    const hasResults    = results.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* showCloseButton=false — we render our own at the modal top-right */}
            <DialogContent
                showCloseButton={false}
                className="max-w-2xl max-h-[90vh] gap-0 p-0 overflow-hidden shadow-2xl flex flex-col"
            >

                {/* ── Close button — top-right corner of the whole modal ─────── */}
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute top-3 right-3 z-20 rounded-md p-1.5 text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title="Close"
                >
                    <X className="h-4 w-4" />
                </button>

                {/* ── Accent header ─────────────────────────────────────────── */}
                <DialogHeader
                    className="relative shrink-0 px-5 pt-4 pb-4 overflow-hidden"
                    style={{ background: 'var(--cl-accent, #007acc)' }}
                >
                    {/* Decorative circles */}
                    <span className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
                    <span className="pointer-events-none absolute top-3 right-10 h-9 w-9 rounded-full bg-white/10" />

                    <div className="relative flex items-center gap-3 pr-8">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
                            <Users className="h-4.5 w-4.5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-base font-bold text-white tracking-wide leading-none">
                                Customer Search
                            </DialogTitle>
                            <p className="mt-0.5 text-[11px] text-white/70">
                                Search by name, mobile, GSTIN or address
                            </p>
                        </div>

                    </div>
                </DialogHeader>

                {/* ── Search bar ────────────────────────────────────────────── */}
                <div className="px-4 py-3 border-b border-(--cl-border) bg-zinc-50">
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                            {loading
                                ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--cl-accent, #007acc)' }} />
                                : <Search className="h-4 w-4 text-zinc-400" />}
                        </span>

                        <Input
                            ref={inputRef}
                            autoFocus
                            className="pl-9 pr-9 h-10 text-sm rounded-lg border-zinc-200 focus:border-sky-500 bg-white shadow-sm"
                            placeholder={`Search by name, mobile, GSTIN… (min. ${MIN_CHARS} chars)`}
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                        />

                        {search && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                                title="Reset search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Result count hint */}
                    {hasResults && !loading && (
                        <p className="mt-2 pl-1 text-xs font-medium text-zinc-500">
                            {results.length} customer{results.length !== 1 ? "s" : ""} found
                            <span className="ml-1 font-normal text-zinc-400">· click a row to select</span>
                        </p>
                    )}
                </div>

                {/* ── Results ───────────────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 min-h-[200px]">

                    {/* Idle */}
                    {showIdleHint && (
                        <div className="flex flex-col items-center gap-3 py-14">
                            <div className="rounded-full bg-zinc-100 p-4">
                                <Users className="h-6 w-6 text-zinc-400" />
                            </div>
                            <p className="text-sm font-medium text-zinc-500">Find a customer</p>
                            <p className="text-xs text-zinc-400">Type a name, mobile number, or GSTIN</p>
                        </div>
                    )}

                    {/* Too few chars */}
                    {showMinHint && (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <Search className="h-5 w-5 text-zinc-300" />
                            <p className="text-sm text-zinc-500">
                                Enter at least <span className="font-semibold">{MIN_CHARS}</span> characters to search
                            </p>
                        </div>
                    )}

                    {/* Loading */}
                    {showSearching && (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--cl-accent, #007acc)' }} />
                            <p className="text-sm text-zinc-500">Searching…</p>
                        </div>
                    )}

                    {/* No results */}
                    {showEmpty && (
                        <div className="flex flex-col items-center gap-3 py-14">
                            <div className="rounded-full bg-zinc-100 p-4">
                                <Search className="h-6 w-6 text-zinc-300" />
                            </div>
                            <p className="text-sm font-medium text-zinc-500">No customers found</p>
                            <p className="text-xs text-zinc-400">
                                No match for &quot;{search}&quot; — try different keywords
                            </p>
                        </div>
                    )}

                    {/* Result rows */}
                    {results.map(row => (
                        <button
                            key={row.id}
                            type="button"
                            className="group relative w-full text-left px-5 py-3.5 border-b border-(--cl-border) last:border-0 hover:bg-sky-50 transition-colors cursor-pointer"
                            onClick={() => handleSelect(row)}
                        >
                            {/* Hover accent strip */}
                            <span className="absolute left-0 inset-y-0 w-[3px] scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r" style={{ background: 'var(--cl-accent, #007acc)' }} />

                            {/* Line 1: name + type badge */}
                            <div className="flex items-start justify-between gap-3 mb-1">
                                <span className="font-semibold text-sm text-(--cl-text) leading-snug">
                                    {row.full_name ?? (
                                        <span className="italic text-zinc-400 font-normal">No name</span>
                                    )}
                                </span>
                                {row.customer_type_name && (
                                    <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'rgba(0,122,204,0.1)', color: 'var(--cl-accent, #007acc)', border: '1px solid rgba(0,122,204,0.2)' }}>
                                        {row.customer_type_name}
                                    </span>
                                )}
                            </div>

                            {/* Line 2: mobile · alt mobile · email · gstin · state */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span className="font-mono">{row.mobile}</span>
                                </span>
                                {row.alternate_mobile && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 shrink-0 text-zinc-300" />
                                        <span className="font-mono">{row.alternate_mobile}</span>
                                    </span>
                                )}
                                {row.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        <span>{row.email}</span>
                                    </span>
                                )}
                                {row.gstin && (
                                    <span className="flex items-center gap-1">
                                        <Tag className="h-3 w-3 shrink-0" />
                                        <span className="font-mono">{row.gstin}</span>
                                    </span>
                                )}
                                {row.state_name && (
                                    <span className="text-zinc-400">{row.state_name}</span>
                                )}
                            </div>

                            {/* Line 3: address + landmark */}
                            {(row.address_line1 || row.address_line2 || row.landmark || row.city || row.postal_code) && (
                                <p className="mt-1 flex items-start gap-1 text-xs text-zinc-400 truncate">
                                    <MapPin className="mt-px h-3 w-3 shrink-0" />
                                    {[row.address_line1, row.address_line2, row.landmark, row.city, row.postal_code]
                                        .filter(Boolean)
                                        .join(", ")}
                                </p>
                            )}

                            {/* Line 4: remarks */}
                            {row.remarks && (
                                <p className="mt-1 flex items-start gap-1 text-xs text-zinc-400 truncate">
                                    <MessageSquare className="mt-px h-3 w-3 shrink-0" />
                                    {row.remarks}
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
