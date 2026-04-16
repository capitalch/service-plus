import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, MoreHorizontal, Pencil, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";

import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { StockLoanType } from "@/features/client/types/stock-loan";
import { NewLoanEntry } from "./new-loan-entry";
import type { NewLoanEntryHandle } from "./new-loan-entry";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

// ViewMode is imported from view-mode-toggle

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 600;

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const LoanEntrySection = () => {
    const dbName       = useAppSelector(selectDbName);
    const schema       = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId     = globalBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // Filter state
    const [fromDate,      setFromDate]      = useState(defaultFrom);
    const [toDate,        setToDate]        = useState(defaultTo);
    const [search,        setSearch]        = useState("");
    const [searchQ,       setSearchQ]       = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");

    // Mode
    const [mode, setMode] = useState<ViewMode>("new");

    // Metadata
    const [brands,   setBrands]   = useState<BrandOption[]>([]);
    const [txnTypes, setTxnTypes] = useState<StockTransactionTypeRow[]>([]);

    // Data
    const [loans,   setLoans]   = useState<StockLoanType[]>([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(false);

    // Dialog state
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Edit state
    const [editLoan, setEditLoan] = useState<StockLoanType | null>(null);

    // Form coordination
    const newLoanRef               = useRef<NewLoanEntryHandle>(null);
    const [newFormValid, setNewFormValid] = useState(false);
    const [submitting,   setSubmitting]   = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load brands and txnTypes on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [brandRes, txnRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }),
                        },
                    }),
                ]);
                const brandList = brandRes.data?.genericQuery ?? [];
                setBrands(brandList);
                if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
                setTxnTypes(txnRes.data?.genericQuery ?? []);
            } catch {
                toast.error(MESSAGES.ERROR_LOAN_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // Load loans (paged)
    const loadData = useCallback(async (
        bId: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, from_date: from, search: q, to_date: to };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<StockLoanType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                            sqlId:   SQL_MAP.GET_STOCK_LOANS_PAGED,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: commonArgs,
                            sqlId:   SQL_MAP.GET_STOCK_LOANS_COUNT,
                        }),
                    },
                }),
            ]);
            setLoans(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_LOAN_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Re-fetch when filters or branch change
    useEffect(() => {
        if (mode !== "view" || !branchId) return;
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, mode, loadData]);

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(value);
        }, DEBOUNCE_MS);
    };

    // Delete
    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema || !branchId) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [deleteId],
                        tableName:  "stock_loan",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_LOAN_DELETED);
            setDeleteId(null);
            void loadData(Number(branchId), fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_LOAN_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:overflow-y-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                {/* Title */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-[var(--cl-text)] truncate">
                            Loan Entry
                            {mode === "new" && !editLoan && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                            {mode === "new" &&  editLoan && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === "view" && (
                            <span className="text-xs text-[var(--cl-text-muted)] whitespace-nowrap">
                                {loading ? "Loading…" : `(${total})`}
                            </span>
                        )}
                    </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Mode Toggle */}
                <ViewModeToggle
                    mode={mode}
                    isEditing={!!editLoan}
                    onNewClick={() => { setEditLoan(null); setMode("new"); }}
                    onViewClick={() => { setMode("view"); if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}
                />

                {/* Brand */}
                <BrandSelect
                    brands={brands}
                    value={selectedBrand}
                    onValueChange={setSelectedBrand}
                    disabled={brands.length === 0 || loading}
                    highlightEmpty={mode === "new" && !selectedBrand}
                />

                {/* Reset · Save — invisible in view mode */}
                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        disabled={submitting}
                        variant="ghost"
                        onClick={() => { setEditLoan(null); newLoanRef.current?.reset(); }}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${submitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!newFormValid || submitting}
                        onClick={() => newLoanRef.current?.submit()}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <NewLoanEntry
                    ref={newLoanRef}
                    branchId={branchId}
                    brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                    editLoan={editLoan as any}
                    selectedBrandId={selectedBrand ? Number(selectedBrand) : null}
                    txnTypes={txnTypes}
                    onStatusChange={status => {
                        setNewFormValid(status.isValid);
                        setSubmitting(status.isSubmitting);
                    }}
                    onSuccess={() => {
                        if (editLoan) {
                            setEditLoan(null);
                            setMode("view");
                            if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1);
                        } else {
                            newLoanRef.current?.reset();
                        }
                    }}
                />
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--cl-surface-2)]/30">
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                disabled={loading}
                                type="date"
                                value={fromDate}
                                onChange={e => handleFilterChange(setFromDate)(e.target.value)}
                            />
                            <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                            <Input
                                className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                                disabled={loading}
                                type="date"
                                value={toDate}
                                onChange={e => handleFilterChange(setToDate)(e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                            <Input
                                className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                                disabled={loading}
                                placeholder="Loan To, Ref #…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                className="h-8 px-2.5 text-xs"
                                disabled={loading || !branchId}
                                size="sm"
                                variant="outline"
                                onClick={() => { if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page); }}
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                        <div className="flex-1 overflow-x-auto overflow-y-auto">
                            {loading ? (
                                <div className="flex h-32 items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                                </div>
                            ) : loans.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                    No loan entries found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Ref #</th>
                                            <th className={thClass}>Remarks</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {loans.map((loan, idx) => (
                                            <tr key={loan.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5 dark:hover:bg-white/[0.03]">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "5%" }}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={tdClass} style={{ width: "15%" }}>
                                                    {loan.loan_date}
                                                </td>
                                                <td className={`${tdClass} font-mono`} style={{ width: "20%" }}>
                                                    {loan.ref_no ?? "—"}
                                                </td>
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "28%" }}>
                                                    {loan.remarks ?? "—"}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`} style={{ width: "10%" }}>
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 hover:bg-[var(--cl-accent)]/15 dark:hover:bg-[var(--cl-accent)]/20 transition-all duration-200"
                                                                    variant="ghost"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[160px] bg-white dark:bg-zinc-950 border-[var(--cl-border)] shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600"
                                                                    onClick={() => { setEditLoan(loan); setMode("new"); }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600 font-semibold"
                                                                    onClick={() => setDeleteId(loan.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Delete</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2">
                                <span className="text-xs text-[var(--cl-text-muted)]">
                                    Page {page} of {totalPages} · {total} records
                                </span>
                                <div className="flex gap-1">
                                    <Button
                                        disabled={page <= 1 || loading}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        Prev
                                    </Button>
                                    <Button
                                        disabled={page >= totalPages || loading}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Delete Confirm Dialog */}
                    <Dialog
                        open={deleteId !== null}
                        onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}
                    >
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                            <DialogHeader>
                                <DialogTitle>Delete Loan Entry</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                This will permanently delete the loan entry and all associated stock transactions.
                                This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button
                                    disabled={deleting}
                                    variant="outline"
                                    onClick={() => setDeleteId(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={deleting}
                                    variant="destructive"
                                    onClick={() => void handleDelete()}
                                >
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </motion.div>
    );
};
