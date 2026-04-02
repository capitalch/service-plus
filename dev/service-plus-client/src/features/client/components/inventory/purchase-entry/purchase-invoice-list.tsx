import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, FileText, Loader2, RefreshCw, Search, Trash2, Pencil, Printer } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { formatCurrency } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { PurchaseInvoiceType } from "@/features/client/types/purchase";
import { ViewPurchaseInvoiceDialog } from "./view-purchase-invoice-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId: number | null;
    onEdit: (invoice: PurchaseInvoiceType) => void;
    onPrint: (invoice: PurchaseInvoiceType) => void;
    centerHeader?: React.ReactNode;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 600;

function currentMonthRange() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const last  = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
        from: `${year}-${month}-01`,
        to:   `${year}-${month}-${String(last).padStart(2, "0")}`,
    };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const PurchaseInvoiceList = ({
    branchId,
    onEdit,
    onPrint,
    centerHeader
}: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const { from: defaultFrom, to: defaultTo } = currentMonthRange();

    // Filter state
    const [fromDate,       setFromDate]       = useState(defaultFrom);
    const [toDate,         setToDate]         = useState(defaultTo);
    const [search,         setSearch]         = useState("");
    const [searchQ,        setSearchQ]        = useState("");

    // Data state
    const [invoices, setInvoices] = useState<PurchaseInvoiceType[]>([]);
    const [total,    setTotal]    = useState(0);
    const [page,     setPage]     = useState(1);
    const [loading,  setLoading]  = useState(false);

    // Dialog state
    const [viewInvoice,  setViewInvoice]  = useState<PurchaseInvoiceType | null>(null);
    const [deleteId,     setDeleteId]     = useState<number | null>(null);
    const [deleting,     setDeleting]     = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load invoices (paged)
    const loadData = useCallback(async (
        branchId: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: branchId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryData<PurchaseInvoiceType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PURCHASE_INVOICES_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
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
                            sqlId:   SQL_MAP.GET_PURCHASE_INVOICES_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setInvoices(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
        } catch {
            toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    // Re-fetch when filters or page change
    useEffect(() => {
        if (!branchId) return;
        void loadData(branchId, fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData]);

    // Debounce search input
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(value);
        }, DEBOUNCE_MS);
    };

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    };

    // Delete
    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema || !branchId) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdateScript,
                variables: {
                    db_name: dbName,
                    schema,
                    value: encodeObj({ sql_id: SQL_MAP.DELETE_PURCHASE_INVOICE, sql_args: { id: deleteId } }),
                },
            });
            toast.success(MESSAGES.SUCCESS_PURCHASE_DELETED);
            setDeleteId(null);
            void loadData(branchId, fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_PURCHASE_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex min-h-0 flex-1 flex-col gap-4"
        >
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="shrink-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--cl-accent)]/10">
                        <FileText className="h-5 w-5 text-[var(--cl-accent)]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[var(--cl-text)]">Recent Invoices</h2>
                        <p className="mt-0.5 text-sm text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `${total} invoice${total !== 1 ? "s" : ""} found`}
                        </p>
                    </div>
                </div>

                {centerHeader && (
                    <div className="flex justify-start md:justify-center flex-1">
                        {centerHeader}
                    </div>
                )}

                <div className="shrink-0 flex items-center gap-2">
                    <Button
                        className="bg-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/90 text-white shadow-sm"
                        disabled={loading || !branchId}
                        onClick={() => { if(branchId) void loadData(branchId, fromDate, toDate, searchQ, page); }}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-1">
                <Input
                    className="h-9 w-36 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                    disabled={loading}
                    type="date"
                    value={fromDate}
                    onChange={e => handleFilterChange(setFromDate)(e.target.value)}
                />
                <Input
                    className="h-9 w-36 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                    disabled={loading}
                    type="date"
                    value={toDate}
                    onChange={e => handleFilterChange(setToDate)(e.target.value)}
                />
                <div className="relative flex-1 sm:w-72 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9 shadow-sm"
                        disabled={loading}
                        placeholder="Search by invoice no or supplier…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm">
                <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
                    {loading ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--cl-accent)]" />
                        </div>
                    ) : !branchId ? (
                        <div className="flex h-40 flex-col items-center justify-center text-sm text-[var(--cl-text-muted)] p-8 text-center">
                            <div className="bg-[var(--cl-accent)]/5 p-4 rounded-full mb-4">
                                <FileText className="h-10 w-10 text-[var(--cl-accent)] opacity-40" />
                            </div>
                            <h3 className="text-base font-semibold text-[var(--cl-text)] mb-1">No Branch Selected</h3>
                            <p className="max-w-[280px]">Please select a branch from the global header to view and manage purchase invoices.</p>
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="flex h-32 flex-col items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            <FileText className="mb-2 h-8 w-8 opacity-20" />
                            <p>No purchase invoices found for the selected filters.</p>
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Invoice No</th>
                                    <th className={thClass}>Supplier</th>
                                    <th className={`${thClass} text-right`}>Taxable</th>
                                    <th className={`${thClass} text-right`}>Tax</th>
                                    <th className={`${thClass} text-right`}>Total</th>
                                    <th className={thClass}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {invoices.map((inv, idx) => (
                                    <tr key={inv.id} className="transition-colors hover:bg-[var(--cl-surface-2)]/50 group">
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "5%" }}>
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className={tdClass} style={{ width: "10%" }}>
                                            {inv.invoice_date}
                                        </td>
                                        <td className={`${tdClass} font-mono font-medium`} style={{ width: "15%" }}>
                                            {inv.invoice_no}
                                        </td>
                                        <td className={tdClass} style={{ width: "25%" }}>
                                            {inv.supplier_name}
                                        </td>
                                        <td className={`${tdClass} text-right`} style={{ width: "12%" }}>
                                            {formatCurrency(inv.aggregate_amount)}
                                        </td>
                                        <td className={`${tdClass} text-right`} style={{ width: "10%" }}>
                                            {formatCurrency(inv.total_tax)}
                                        </td>
                                        <td className={`${tdClass} text-right font-medium text-[var(--cl-accent)]`} style={{ width: "12%" }}>
                                            {formatCurrency(inv.total_amount)}
                                        </td>
                                        <td className={tdClass} style={{ width: "11%" }}>
                                            <div className="flex gap-1.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                                <Button
                                                    className="h-7 w-7 p-0"
                                                    size="sm"
                                                    variant="ghost"
                                                    title="View"
                                                    onClick={() => setViewInvoice(inv)}
                                                >
                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button
                                                    className="h-7 w-7 p-0"
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Edit"
                                                    onClick={() => onEdit(inv)}
                                                >
                                                    <Pencil className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                                </Button>
                                                <Button
                                                    className="h-7 w-7 p-0"
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Print Preview"
                                                    onClick={() => onPrint(inv)}
                                                >
                                                    <Printer className="h-4 w-4 text-[var(--cl-text-muted)]" />
                                                </Button>
                                                <Button
                                                    className="h-7 w-7 p-0 hover:bg-red-50"
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Delete"
                                                    onClick={() => setDeleteId(inv.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
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
                    <div className="flex items-center justify-between border-t border-[var(--cl-border)] bg-[var(--cl-surface-2)]/30 px-4 py-2">
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            Page <span className="font-semibold text-[var(--cl-text)]">{page}</span> of {totalPages}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                disabled={page <= 1 || loading}
                                size="sm"
                                variant="outline"
                                className="h-7 px-3 text-xs"
                                onClick={() => setPage(p => p - 1)}
                            >
                                Prev
                            </Button>
                            <Button
                                disabled={page >= totalPages || loading}
                                size="sm"
                                variant="outline"
                                className="h-7 px-3 text-xs"
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Dialog */}
            <ViewPurchaseInvoiceDialog
                invoice={viewInvoice}
                open={viewInvoice !== null}
                onOpenChange={open => { if (!open) setViewInvoice(null); }}
            />

            {/* Delete Confirm Dialog */}
            <Dialog
                open={deleteId !== null}
                onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}
            >
                <DialogContent className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                    <DialogHeader>
                        <DialogTitle>Delete Purchase Invoice</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-[var(--cl-text-muted)]">
                        This will permanently delete the invoice and all associated stock transactions.
                        This action cannot be undone.
                    </p>
                    <DialogFooter className="mt-4">
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
        </motion.div>
    );
};
