import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Phone, Plus, Search, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";

import { AddCustomerDialog } from "../../masters/customer/add-customer-dialog";
import { CustomerSearchModal } from "./customer-search-modal";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import type { CustomerSearchRow } from "@/features/client/types/sales";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

export type CustomerInputProps = {
    className?:       string;
    customerId:       number | null;
    customerName:     string;
    customerMobile?:  string | null;
    customerAddress?: string | null;
    customerTypes:    CustomerTypeOption[];
    onChange:         (name: string) => void;
    onClear:          () => void;
    onSelect:         (c: CustomerSearchRow) => void;
    states:           StateOption[];
};

const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

const AVATAR_COLORS = [
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-lime-100 text-lime-700",
    "bg-cyan-100 text-cyan-700",
    "bg-orange-100 text-orange-700",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerInput({
    className,
    customerId,
    customerName,
    customerMobile,
    customerAddress,
    customerTypes,
    onChange,
    onClear,
    onSelect,
    states,
}: CustomerInputProps) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [results, setResults]           = useState<CustomerSearchRow[]>([]);
    const [loading, setLoading]           = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownWidth, setDropdownWidth] = useState(0);
    const [addOpen, setAddOpen]           = useState(false);
    const [modalOpen, setModalOpen]       = useState(false);

    const debounceRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef               = useRef<HTMLInputElement | null>(null);
    const anchorRef              = useRef<HTMLDivElement>(null);
    const justFocusedRef         = useRef(false);
    const scrollbarMouseDownRef  = useRef(false);
    const justSelectedRef        = useRef(false);

    const doSearch = useCallback(async (q: string) => {
        if (!dbName || !schema || !q.trim()) return;
        setLoading(true);
        try {
            const res = await apolloClient.query<GenericQueryData<CustomerSearchRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlArgs: { limit: 50, offset: 0, search: q.trim() },
                        sqlId: SQL_MAP.GET_CUSTOMERS_BY_KEYWORD,
                    }),
                },
            });
            const rows = res.data?.genericQuery ?? [];
            setResults(rows);
            if (document.activeElement === inputRef.current) {
                setDropdownOpen(rows.length > 0);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Debounced inline search
    useEffect(() => {
        if (!dbName || !schema) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const q = customerName.trim();
        if (!q) {
            setResults([]);
            setDropdownOpen(false);
            return;
        }

        if (justSelectedRef.current) {
            justSelectedRef.current = false;
            return;
        }

        debounceRef.current = setTimeout(() => doSearch(q), 1200);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [customerName, dbName, doSearch, schema]);

    // Measure anchor width when dropdown opens
    useEffect(() => {
        if (dropdownOpen && anchorRef.current) {
            setDropdownWidth(anchorRef.current.getBoundingClientRect().width);
        }
    }, [dropdownOpen]);

    function handleAddSuccess() {
        setAddOpen(false);
        toast.success("Customer added. Search to select.");
        if (customerName.trim()) doSearch(customerName.trim());
    }

    function handleSelect(row: CustomerSearchRow) {
        justSelectedRef.current = true;
        onSelect(row);
        setDropdownOpen(false);
        setResults([]);
    }

    return (
        <>
            <div className={`flex flex-col gap-0.5 py-1${className ? ` ${className}` : ""}`}>
                <Popover open={dropdownOpen && results.length > 0} onOpenChange={setDropdownOpen}>
                    <PopoverAnchor asChild>
                        <div ref={anchorRef} className="relative group/cust">
                            {/* Search icon — opens modal */}
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => setModalOpen(true)}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-(--cl-accent)/60 text-white hover:bg-(--cl-accent)/85 shadow-sm hover:shadow-md transition-all z-10 cursor-pointer"
                                title="Search customers"
                            >
                                {loading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Search className="h-3.5 w-3.5" />}
                            </button>

                            <Input
                                ref={inputRef}
                                className={`${inputCls} w-full pl-9 pr-14 border-transparent hover:border-(--cl-border) focus:border-(--cl-accent) focus:bg-white transition-all ${customerId ? "bg-(--cl-accent)/5 border-(--cl-accent)/20 text-(--cl-accent) font-bold" : "border-(--cl-border)"}`}
                                placeholder="Customer name or mobile…"
                                value={customerName}
                                onChange={e => onChange(e.target.value)}
                                onFocus={() => {
                                    if (results.length > 0) setDropdownOpen(true);
                                    justFocusedRef.current = true;
                                    setTimeout(() => { justFocusedRef.current = false; }, 200);
                                }}
                                onClick={() => {
                                    if (results.length > 0 && !justFocusedRef.current) {
                                        setDropdownOpen(prev => !prev);
                                    }
                                }}
                                onKeyDown={e => {
                                    if (e.key === "Escape" && dropdownOpen) {
                                        setDropdownOpen(false);
                                        e.stopPropagation();
                                    }
                                }}
                                onBlur={() => {
                                    if (scrollbarMouseDownRef.current) return;
                                    setTimeout(() => setDropdownOpen(false), 150);
                                }}
                            />

                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {customerName && (
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={onClear}
                                        className="rounded-md p-1 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer"
                                        title="Clear"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {customerId ? (
                                    <span title="Customer selected">
                                        <UserCheck className="h-4 w-4 text-emerald-600" />
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => setAddOpen(true)}
                                        className="rounded-md p-1 bg-emerald-500 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                        title="Add new customer"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </PopoverAnchor>

                    <PopoverContent
                        className="p-0 max-h-72 overflow-y-auto"
                        style={{ width: dropdownWidth > 0 ? `${dropdownWidth}px` : "var(--radix-popover-anchor-width)" }}
                        onOpenAutoFocus={e => e.preventDefault()}
                        onMouseDown={e => {
                            const el = e.currentTarget as HTMLElement;
                            const isScrollbar = e.clientX > el.getBoundingClientRect().left + el.clientWidth;
                            if (isScrollbar) {
                                scrollbarMouseDownRef.current = true;
                                document.addEventListener("mouseup", () => { scrollbarMouseDownRef.current = false; }, { once: true });
                            } else {
                                e.preventDefault();
                            }
                        }}
                        onInteractOutside={e => {
                            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
                        }}
                        onEscapeKeyDown={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 flex items-center bg-(--cl-surface)/95 backdrop-blur-sm border-b border-(--cl-border) px-3 py-1 select-none">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-(--cl-text-muted)">
                                {results.length} customer{results.length !== 1 ? "s" : ""} found
                            </span>
                        </div>

                        {results.map(row => {
                            const initial  = (row.full_name ?? row.mobile ?? "?").trim()[0]?.toUpperCase() ?? "?";
                            const colorIdx = initial.charCodeAt(0) % AVATAR_COLORS.length;
                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer hover:bg-blue-50/50"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => handleSelect(row)}
                                >
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_COLORS[colorIdx]}`}>
                                        {initial}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-sm font-medium text-(--cl-text)">
                                                {row.full_name ?? <span className="italic text-(--cl-text-muted)">No name</span>}
                                            </span>
                                            <span className="shrink-0 font-mono text-xs text-(--cl-text-muted)">{row.mobile}</span>
                                        </div>
                                        <div className="mt-0.5 text-xs text-(--cl-text-muted)">
                                            {[row.customer_type_name, row.state_name].filter(Boolean).join(" · ")}
                                            {row.gstin && <span className="ml-2 font-mono">{row.gstin}</span>}
                                        </div>
                                        {row.address_line1 && (
                                            <div className="mt-0.5 truncate text-xs text-(--cl-text-muted)/70">
                                                {row.address_line1}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </PopoverContent>
                </Popover>

                {customerId && (customerMobile || customerAddress) && (
                    <div className="flex items-center gap-2 px-1 py-0.5 text-xs text-(--cl-text-muted)">
                        {customerMobile && (
                            <>
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="font-mono shrink-0">{customerMobile}</span>
                            </>
                        )}
                        {customerAddress && (
                            <span className="truncate">{customerAddress}</span>
                        )}
                    </div>
                )}
            </div>

            <CustomerSearchModal
                open={modalOpen}
                initialSearch={customerName}
                onOpenChange={setModalOpen}
                onSelect={row => { handleSelect(row); }}
            />

            <AddCustomerDialog
                customerTypes={customerTypes}
                open={addOpen}
                states={states}
                onOpenChange={o => setAddOpen(o)}
                onSuccess={handleAddSuccess}
            />
        </>
    );
}
