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

import { AddCustomerDialog } from "../masters/customer/add-customer-dialog";
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

const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

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

    const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef     = useRef<HTMLInputElement | null>(null);
    const skipBlurRef  = useRef(false);

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
            setDropdownOpen(rows.length > 0);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Debounced search
    useEffect(() => {
        if (!dbName || !schema) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const q = customerName.trim();
        if (!q) {
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
        // Re-run search directly so same query string still fires
        if (customerName.trim()) doSearch(customerName.trim());
    }

    function handleSelect(row: CustomerSearchRow) {
        onSelect(row);
        setDropdownOpen(false);
        setResults([]);
    }

    return (
        <>
            <div className={`relative flex flex-col gap-0.5 px-1.5 py-1${className ? ` ${className}` : ""}`}>
                <div className="relative group/cust">
                    <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={e => { e.preventDefault(); skipBlurRef.current = true; }}
                        onClick={() => inputRef.current?.focus()}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] shadow-sm transition-all z-10"
                        title="Search customers"
                    >
                        {loading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Search className="h-3.5 w-3.5" />}
                    </button>

                    <Input
                        ref={inputRef}
                        className={`${inputCls} w-full pl-9 pr-14 border-transparent hover:border-[var(--cl-border)] focus:border-[var(--cl-accent)] focus:bg-[var(--cl-surface)] transition-all ${customerId ? "bg-[var(--cl-accent)]/5 border-[var(--cl-accent)]/20 text-[var(--cl-accent)] font-bold" : "border-[var(--cl-border)]"}`}
                        placeholder="Customer name or mobile…"
                        value={customerName}
                        onChange={e => onChange(e.target.value)}
                        onFocus={() => { if (results.length > 0) setDropdownOpen(true); }}
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
                            <span title="Customer selected"><UserCheck className="h-4 w-4 text-emerald-600" /></span>
                        ) : (
                            <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => setAddOpen(true)}
                                className="rounded-md p-1 bg-emerald-600 text-white hover:bg-emerald-600/10 hover:text-emerald-600 shadow-sm transition-all cursor-pointer"
                                title="Add new customer"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Dropdown */}
                {dropdownOpen && results.length > 0 && (
                    <div
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-lg"
                        onMouseDown={e => { e.preventDefault(); skipBlurRef.current = true; }}
                    >
                        {results.map(row => (
                            <button
                                key={row.id}
                                type="button"
                                className="flex w-full flex-col gap-0.5 border-b border-[var(--cl-border)] px-3 py-2 text-left last:border-0 hover:bg-zinc-500/10 transition-colors cursor-pointer"
                                onClick={() => handleSelect(row)}
                            >
                                <span className="text-sm font-medium text-[var(--cl-text)]">
                                    {row.full_name ?? <span className="italic text-[var(--cl-text-muted)]">No name</span>}
                                    <span className="ml-2 font-mono text-xs text-[var(--cl-text-muted)]">{row.mobile}</span>
                                </span>
                                <span className="text-xs text-[var(--cl-text-muted)]">
                                    {[row.customer_type_name, row.state_name].filter(Boolean).join(" · ")}
                                    {row.gstin && <span className="ml-2 font-mono">{row.gstin}</span>}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

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
