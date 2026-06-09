import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
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
    className?:     string;
    customerId:     number | null;
    customerName:   string;
    customerTypes:  CustomerTypeOption[];
    onChange:       (name: string) => void;
    onClear:        () => void;
    onSelect:       (c: CustomerSearchRow) => void;
    states:         StateOption[];
};

const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerInput({
    className,
    customerId,
    customerName,
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
    const [addOpen, setAddOpen]           = useState(false);
    const [modalOpen, setModalOpen]       = useState(false);

    const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef      = useRef<HTMLInputElement | null>(null);
    const skipBlurRef   = useRef(false);
    const justFocusedRef = useRef(false);

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setResults([]);
            setDropdownOpen(false);
            return;
        }

        debounceRef.current = setTimeout(() => doSearch(q), 1200);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [customerName, dbName, doSearch, schema]);

    function handleAddSuccess() {
        setAddOpen(false);
        toast.success("Customer added. Search to select.");
        if (customerName.trim()) doSearch(customerName.trim());
    }

    function handleSelect(row: CustomerSearchRow) {
        onSelect(row);
        setDropdownOpen(false);
        setResults([]);
    }

    return (
        <>
            <div className={`relative flex flex-col gap-0.5 py-1${className ? ` ${className}` : ""}`}>
                <div className="relative group/cust">
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
                            if (skipBlurRef.current) { skipBlurRef.current = false; return; }
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

                {/* Inline dropdown */}
                {dropdownOpen && results.length > 0 && (
                    <div
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-lg"
                        onMouseDown={e => { e.preventDefault(); skipBlurRef.current = true; }}
                    >
                        {results.map(row => (
                            <button
                                key={row.id}
                                type="button"
                                className="flex w-full flex-col gap-0.5 border-b border-(--cl-border) px-3 py-2 text-left last:border-0 hover:bg-zinc-500/10 transition-colors cursor-pointer"
                                onClick={() => handleSelect(row)}
                            >
                                <span className="text-sm font-medium text-(--cl-text)">
                                    {row.full_name ?? <span className="italic text-(--cl-text-muted)">No name</span>}
                                    <span className="ml-2 font-mono text-xs text-(--cl-text-muted)">{row.mobile}</span>
                                </span>
                                <span className="text-xs text-(--cl-text-muted)">
                                    {[row.customer_type_name, row.state_name].filter(Boolean).join(" · ")}
                                    {row.gstin && <span className="ml-2 font-mono">{row.gstin}</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Search modal */}
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
