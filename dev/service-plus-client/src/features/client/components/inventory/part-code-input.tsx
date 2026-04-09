import { forwardRef, useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

import { PartDialog } from "../masters/parts/part-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartRow = {
    id: number;
    brand_id: number;
    part_code: string;
    part_name: string;
    part_description: string | null;
    category: string | null;
    model: string | null;
    uom: string;
    cost_price: number | null;
    mrp: number | null;
    hsn_code: string | null;
    gst_rate: number | null;
    is_active: boolean;
    brand_name: string;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type CountRowType = { total: number };

const PART_PICK_PAGE_SIZE = 50;

export type PartCodeInputProps = {
    partCode: string;
    partId: number | null;
    partName: string;
    brandId: number | null;
    selectedBrandId: number | null;
    brandName?: string;
    onChange: (code: string) => void;
    onClear: () => void;
    onSelect: (part: PartRow) => void;
    onTabToNext?: () => void;
    className?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── Component ────────────────────────────────────────────────────────────────

const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

export const PartCodeInput = forwardRef<HTMLInputElement, PartCodeInputProps>(({
    partCode,
    partId,
    partName,
    brandId,
    selectedBrandId,
    brandName,
    onChange,
    onClear,
    onSelect,
    onTabToNext,
    className,
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Part search dialog
    const [partPickOpen, setPartPickOpen] = useState(false);
    const [partCodeQuery, setPartCodeQuery] = useState("");
    const [partKeywordQuery, setPartKeywordQuery] = useState("");
    const [partSearchMode, setPartSearchMode] = useState<"code" | "keyword">("code");
    const [partResults, setPartResults] = useState<PartRow[]>([]);
    const [partLoading, setPartLoading] = useState(false);
    const [partPage, setPartPage] = useState(1);
    const [partTotal, setPartTotal] = useState(0);

    // Inline Part Creation
    const [addPartOpen, setAddPartOpen] = useState(false);
    const [prefillPartCode, setPrefillPartCode] = useState("");

    // Edit Part Dialog
    const [editPartOpen, setEditPartOpen] = useState(false);
    const [editPartData, setEditPartData] = useState<PartRow | null>(null);

    const partDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const skipBlurRef = useRef(false);

    // Part search (debounced 1200ms)
    useEffect(() => {
        if (!dbName || !schema || !partPickOpen) return;
        if (partDebounceRef.current) clearTimeout(partDebounceRef.current);
        const activeQuery = partSearchMode === "code" ? partCodeQuery : partKeywordQuery;
        if (!activeQuery.trim()) {
            setPartResults([]);
            setPartTotal(0);
            return;
        }
        partDebounceRef.current = setTimeout(async () => {
            setPartLoading(true);
            try {
                const sqlId = partSearchMode === "code" ? SQL_MAP.GET_PARTS_BY_CODE_PREFIX : SQL_MAP.GET_PARTS_BY_KEYWORD;
                const sqlCountId = partSearchMode === "code" ? SQL_MAP.GET_PARTS_BY_CODE_PREFIX_COUNT : SQL_MAP.GET_PARTS_BY_KEYWORD_COUNT;
                const offset = (partPage - 1) * PART_PICK_PAGE_SIZE;
                const [dataRes, countRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<PartRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId,
                                sqlArgs: { search: activeQuery.trim(), limit: PART_PICK_PAGE_SIZE, offset },
                            }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<CountRowType>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({
                                sqlId: sqlCountId,
                                sqlArgs: { search: activeQuery.trim() },
                            }),
                        },
                    }),
                ]);
                setPartResults(dataRes.data?.genericQuery ?? []);
                setPartTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
            } catch {
                // silent
            } finally {
                setPartLoading(false);
            }
        }, 1200);
    }, [partCodeQuery, partKeywordQuery, partSearchMode, partPickOpen, partPage, dbName, schema]);

    const focusInput = () => {
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 120);
    };

    const handlePartChosen = (part: PartRow) => {
        onSelect(part);
        setPartPickOpen(false);
        setPartCodeQuery("");
        setPartKeywordQuery("");
        setPartResults([]);
    };

    const handleTypedPartSearch = async (code: string, focusNext = false) => {
        if (!code.trim() || !dbName || !schema) return;

        try {
            const res = await apolloClient.query<GenericQueryData<PartRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_PART_BY_CODE,
                        sqlArgs: { code: code.trim(), brand_id: brandId ?? selectedBrandId ?? null },
                    }),
                },
            });

            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                handlePartChosen(results[0]);
                if (focusNext) {
                    setTimeout(() => onTabToNext?.(), 50);
                }
            } else if (results.length > 1) {
                if (partPickOpen) return;
                setPartCodeQuery(code.trim());
                setPartKeywordQuery("");
                setPartSearchMode("code");
                setPartResults(results);
                setPartTotal(results.length);
                setPartPage(1);
                setPartPickOpen(true);
                focusInput();
            } else {
                if (partPickOpen) return;
                setPrefillPartCode(code.trim());
                setAddPartOpen(true);
                focusInput();
            }
        } catch {
            focusInput();
        }
    };

    const handleEditPart = async () => {
        if (!partCode.trim() || !dbName || !schema) return;

        try {
            const res = await apolloClient.query<GenericQueryData<PartRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId: SQL_MAP.GET_PART_BY_CODE,
                        sqlArgs: { code: partCode.trim(), brand_id: brandId ?? selectedBrandId ?? null },
                    }),
                },
            });

            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                setEditPartData(results[0]);
                setEditPartOpen(true);
            } else {
                toast.error("Could not retrieve part details. Please try searching again.");
            }
        } catch {
            toast.error("An error occurred while fetching part details.");
        }
    };

    const openPartPick = () => {
        if (!selectedBrandId) {
            toast.warning("Please select a brand before searching parts.");
            return;
        }
        setPartResults([]);
        setPartCodeQuery(partCode?.trim() ?? "");
        setPartKeywordQuery("");
        setPartSearchMode("code");
        setPartPickOpen(true);
    };

    return (
        <>
            <div className={`flex flex-col gap-0.5 px-1.5 py-1${className ? ` ${className}` : ""}`}>
                <div className="relative group/part">
                    <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={e => { e.preventDefault(); skipBlurRef.current = true; }}
                        onClick={openPartPick}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] shadow-sm transition-all focus:ring-2 focus:ring-[var(--cl-accent)]/20 cursor-pointer z-10"
                        title="Browse all parts"
                    >
                        <Search className="h-3.5 w-3.5" />
                    </button>
                    <Input
                        ref={el => {
                            inputRef.current = el;
                            if (typeof ref === "function") ref(el);
                            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
                        }}
                        className={`${inputCls} font-mono w-full pl-9 pr-14 border-transparent hover:border-[var(--cl-border)] focus:border-[var(--cl-accent)] focus:bg-[var(--cl-surface)] transition-all ${partId ? "bg-[var(--cl-accent)]/5 border-[var(--cl-accent)]/20 text-[var(--cl-accent)] font-bold" : "border-red-500 focus:border-red-500 ring-red-500/10 bg-transparent"}`}
                        placeholder="Part Code"
                        value={partCode}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') void handleTypedPartSearch(partCode);
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                void handleTypedPartSearch(partCode, true);
                            }
                        }}
                        onBlur={() => {
                            if (skipBlurRef.current) { skipBlurRef.current = false; return; }
                            if (partCode.trim()) void handleTypedPartSearch(partCode);
                        }}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {partCode && (
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={onClear}
                                className="rounded-md p-1 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer"
                                title="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        {partId ? (
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => void handleEditPart()}
                                className="rounded-md p-1 bg-amber-500 text-white hover:bg-amber-500/10 hover:text-amber-600 shadow-sm transition-all focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                                title="Edit part details"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    if (partPickOpen) return;
                                    setPrefillPartCode(partCode.trim());
                                    setAddPartOpen(true);
                                }}
                                className="rounded-md p-1 bg-emerald-600 text-white hover:bg-emerald-600/10 hover:text-emerald-600 shadow-sm transition-all focus:ring-2 focus:ring-emerald-600/20 cursor-pointer"
                                title="Add as new part"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                {partId && partName && (
                    <div className="flex items-center px-1 overflow-hidden h-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="truncate text-[10px] font-bold text-[var(--cl-accent)]/70 tracking-tight" title={partName}>{partName}</span>
                    </div>
                )}
            </div>

            {/* Part Pick Dialog */}
            <Dialog
                open={partPickOpen}
                onOpenChange={open => {
                    if (!open) {
                        setPartPickOpen(false);
                        setPartCodeQuery("");
                        setPartKeywordQuery("");
                        setPartResults([]);
                        setPartSearchMode("code");
                        setPartPage(1);
                        setPartTotal(0);
                        focusInput();
                    }
                }}
            >
                <DialogContent
                    aria-describedby={undefined}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    className="sm:max-w-lg bg-white text-black border-[var(--cl-border)] shadow-2xl opacity-100"
                >
                    <div className="pr-6 pb-3 border-b border-slate-200">
                        <DialogTitle className="text-base font-semibold text-slate-900">Search Part</DialogTitle>
                    </div>

                    {/* Option 1 — Part code starts with */}
                    <div className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors ${partSearchMode === "code" ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"}`}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                            Option 1 · Part code starts with
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <Input
                                autoFocus
                                className="h-9 border-slate-200 bg-white text-slate-800 pl-9 pr-9 font-mono"
                                placeholder="Type a part code prefix…"
                                value={partCodeQuery}
                                onChange={e => { setPartCodeQuery(e.target.value); setPartPage(1); }}
                                onFocus={() => { if (partSearchMode !== "code") { setPartSearchMode("code"); setPartResults([]); setPartPage(1); setPartTotal(0); } }}
                            />
                            {partCodeQuery && (
                                <button type="button" onClick={() => { setPartCodeQuery(""); setPartResults([]); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Option 2 — Keyword in name / description / model / category */}
                    <div className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors ${partSearchMode === "keyword" ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"}`}>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                            Option 2 · Name / Description / Model / Category
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <Input
                                className="h-9 border-slate-200 bg-white text-slate-800 pl-9 pr-9"
                                placeholder="Type a keyword…"
                                value={partKeywordQuery}
                                onChange={e => { setPartKeywordQuery(e.target.value); setPartPage(1); }}
                                onFocus={() => { if (partSearchMode !== "keyword") { setPartSearchMode("keyword"); setPartResults([]); setPartPage(1); setPartTotal(0); } }}
                            />
                            {partKeywordQuery && (
                                <button type="button" onClick={() => { setPartKeywordQuery(""); setPartResults([]); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results count */}
                    {!partLoading && partTotal > 0 && (
                        <p className="text-xs text-slate-500 text-right pr-1">
                            {partTotal} record{partTotal !== 1 ? "s" : ""} found
                            {Math.ceil(partTotal / PART_PICK_PAGE_SIZE) > 1 && ` · Page ${partPage} of ${Math.ceil(partTotal / PART_PICK_PAGE_SIZE)}`}
                        </p>
                    )}

                    <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                        {partLoading ? (
                            <div className="flex h-16 items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-[var(--cl-accent)]" />
                            </div>
                        ) : partResults.length === 0 ? (
                            <div className="flex h-16 items-center justify-center text-sm text-slate-400">
                                {(partSearchMode === "code" ? partCodeQuery : partKeywordQuery).trim()
                                    ? "No parts found."
                                    : partSearchMode === "code"
                                        ? "Type a part code prefix to search."
                                        : "Type a keyword to search by name / description / model / category."}
                            </div>
                        ) : (
                            partResults.map(part => (
                                <button
                                    key={part.id}
                                    className="cursor-pointer flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 transition-colors"
                                    type="button"
                                    onClick={() => handlePartChosen(part)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-sm font-medium text-slate-900">
                                            {part.part_code}
                                            <span className="ml-2 font-sans font-normal text-slate-600">{part.part_name}</span>
                                        </p>
                                        {part.part_description && (
                                            <p className="mt-0.5 text-xs text-slate-500 truncate">{part.part_description}</p>
                                        )}
                                        {(part.category || part.model) && (
                                            <p className="mt-0.5 text-xs text-slate-400 truncate">
                                                {[part.category, part.model].filter(Boolean).join(" · ")}
                                            </p>
                                        )}
                                        <p className="mt-1 text-xs inline-flex flex-wrap items-center gap-1.5">
                                            {part.hsn_code ? <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">HSN: {part.hsn_code}</span> : null}
                                            {part.gst_rate != null ? <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">GST: {part.gst_rate}%</span> : null}
                                            {part.cost_price != null ? <span className="bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-blue-700">Cost: {formatNumber(part.cost_price)}</span> : null}
                                            {part.mrp != null ? <span className="bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-amber-700">MRP: {formatNumber(part.mrp)}</span> : null}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Pagination controls */}
                    {(() => {
                        const totalPages = Math.ceil(partTotal / PART_PICK_PAGE_SIZE);
                        if (totalPages <= 1) return null;
                        return (
                            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                                <p className="text-xs text-slate-400">Page {partPage} of {totalPages}</p>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        disabled={partPage <= 1 || partLoading} onClick={() => setPartPage(1)}>
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        disabled={partPage <= 1 || partLoading} onClick={() => setPartPage(p => p - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        disabled={partPage >= totalPages || partLoading} onClick={() => setPartPage(p => p + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                        disabled={partPage >= totalPages || partLoading} onClick={() => setPartPage(totalPages)}>
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Add Part Dialog */}
            <PartDialog
                mode="add"
                open={addPartOpen}
                onOpenChange={open => {
                    if (!open) {
                        setAddPartOpen(false);
                        focusInput();
                    } else {
                        setAddPartOpen(true);
                    }
                }}
                onSuccess={() => {
                    void handleTypedPartSearch(prefillPartCode);
                }}
                prefillCode={prefillPartCode}
                defaultBrandId={selectedBrandId ?? 0}
                brandName={brandName ?? ""}
            />

            {/* Edit Part Dialog */}
            {editPartData && (
                <PartDialog
                    mode="edit"
                    open={editPartOpen}
                    part={editPartData}
                    defaultBrandId={selectedBrandId ?? 0}
                    brandName={brandName ?? ""}
                    onOpenChange={o => {
                        if (!o) {
                            setEditPartOpen(false);
                            setEditPartData(null);
                            focusInput();
                        } else {
                            setEditPartOpen(true);
                        }
                    }}
                    onSuccess={() => {
                        if (editPartData) {
                            void handleTypedPartSearch(editPartData.part_code);
                        }
                        setEditPartOpen(false);
                    }}
                />
            )}
        </>
    );
});

PartCodeInput.displayName = "PartCodeInput";
