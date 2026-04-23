import { useCallback, useEffect, useRef, useState } from "react";
import {
    ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon,
    DollarSign, Loader2, Pencil, RefreshCw, Save, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { currentFinancialYearRange } from "@/lib/utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobReceiptDetailType, JobReceiptListRowType } from "@/features/client/types/receipt";
import { NewReceiptForm, type NewReceiptFormHandleType } from "./new-receipt-form";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryDataType<T> = { genericQuery: T[] | null };

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1200;
const PAGE_SIZE   = 50;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
    return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function modeBadgeClass(mode: string) {
    switch (mode) {
        case "Cash":         return "bg-emerald-500/10 text-emerald-600";
        case "Card":         return "bg-blue-500/10 text-blue-600";
        case "UPI":          return "bg-purple-500/10 text-purple-600";
        case "Bank Transfer":return "bg-amber-500/10 text-amber-700";
        case "Cheque":       return "bg-slate-500/10 text-slate-600";
        default:             return "bg-[var(--cl-surface-3)] text-[var(--cl-text-muted)]";
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReceiptsSection = () => {
    const dbName        = useAppSelector(selectDbName);
    const schema        = useAppSelector(selectSchema);
    const currentBranch = useAppSelector(selectCurrentBranch);
    const branchId      = currentBranch?.id ?? null;

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    const [fromDate,    setFromDate]    = useState(defaultFrom);
    const [toDate,      setToDate]      = useState(defaultTo);
    const [search,      setSearch]      = useState("");
    const [searchQ,     setSearchQ]     = useState("");
    const [page,        setPage]        = useState(1);
    const [rows,        setRows]        = useState<JobReceiptListRowType[]>([]);
    const [total,       setTotal]       = useState(0);
    const [loading,     setLoading]     = useState(false);

    // Dialog (new / edit)
    const [isDialogOpen,    setIsDialogOpen]    = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<JobReceiptDetailType | null>(null);
    const [formValid,       setFormValid]       = useState(false);
    const [formSubmitting,  setFormSubmitting]  = useState(false);

    // Delete dialog
    const [deleteRow,  setDeleteRow]  = useState<JobReceiptListRowType | null>(null);
    const [deleting,   setDeleting]   = useState(false);

    const formRef      = useRef<NewReceiptFormHandleType>(null);
    const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef    = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState(0);

    const recalc = useCallback(() => {
        if (scrollRef.current) {
            const rect = scrollRef.current.getBoundingClientRect();
            setMaxHeight(Math.max(200, window.innerHeight - rect.top - 80));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(recalc, 100);
        window.addEventListener("resize", recalc);
        return () => { clearTimeout(timer); window.removeEventListener("resize", recalc); };
    }, [recalc, rows.length]);

    const loadData = useCallback(async (
        bid: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bid, from_date: from, search: q, to_date: to };
            const [dataRes, countRes] = await Promise.all([
                apolloClient.query<GenericQueryDataType<JobReceiptListRowType>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                            sqlId:   SQL_MAP.GET_JOB_PAYMENTS_PAGED,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryDataType<{ count: number }>>({
                    fetchPolicy: "network-only",
                    query:       GRAPHQL_MAP.genericQuery,
                    variables:   {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlArgs: commonArgs,
                            sqlId:   SQL_MAP.GET_JOB_PAYMENTS_COUNT,
                        }),
                    },
                }),
            ]);
            setRows(dataRes.data?.genericQuery ?? []);
            setTotal(Number(countRes.data?.genericQuery?.[0]?.count ?? 0));
        } catch {
            toast.error(MESSAGES.ERROR_RECEIPT_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId) return;
        void loadData(branchId, fromDate, toDate, searchQ, page);
    }, [branchId, fromDate, toDate, searchQ, page, loadData]);

    function handleSearchChange(value: string) {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setPage(1); setSearchQ(value); }, DEBOUNCE_MS);
    }

    function handleNewReceipt() {
        setSelectedReceipt(null);
        setFormValid(false);
        setIsDialogOpen(true);
    }

    function handleEditReceipt(row: JobReceiptListRowType) {
        setSelectedReceipt({
            amount:       Number(row.amount),
            id:           row.id,
            job_id:       row.job_id,
            payment_date: row.payment_date,
            payment_mode: row.payment_mode,
            reference_no: row.reference_no ?? "",
            remarks:      row.remarks ?? "",
        });
        setFormValid(false);
        setIsDialogOpen(true);
    }

    function handleDialogSuccess() {
        setIsDialogOpen(false);
        if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page);
    }

    async function handleDelete() {
        if (!deleteRow || !dbName || !schema) return;
        setDeleting(true);
        try {
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericUpdateValue({
                        deletedIds: [deleteRow.id],
                        tableName:  "job_payment",
                        xData:      {},
                    }),
                },
            });
            toast.success(MESSAGES.SUCCESS_RECEIPT_DELETED);
            setDeleteRow(null);
            if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_RECEIPT_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    }

    const totalPages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const pageTotal    = rows.reduce((acc, r) => acc + Number(r.amount), 0);

    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--cl-border)] bg-[var(--cl-surface)] px-4 py-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[var(--cl-accent)]">
                        <DollarSign className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-lg font-bold text-[var(--cl-text)]">
                            Receipts
                        </h1>
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            {loading ? "Loading…" : `(${total})`}
                        </span>
                    </div>
                </div>
                <div className="flex-1" />
                <Button
                    className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest"
                    onClick={handleNewReceipt}
                >
                    + New Receipt
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-1 bg-[var(--cl-surface-2)]/30">
                <div className="flex items-center gap-1">
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={fromDate}
                        onChange={e => { setFromDate(e.target.value); setPage(1); }}
                    />
                    <span className="text-[var(--cl-text-muted)] text-xs">—</span>
                    <Input
                        className="h-8 w-32 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs"
                        disabled={loading}
                        type="date"
                        value={toDate}
                        onChange={e => { setToDate(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                    <Input
                        className="h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-8 text-xs"
                        disabled={loading}
                        placeholder="Job no, customer, mode, ref no…"
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                    />
                </div>
                <Button
                    className="h-8 px-2.5 text-xs"
                    disabled={loading || !branchId}
                    size="sm"
                    variant="outline"
                    onClick={() => { if (branchId) void loadData(branchId, fromDate, toDate, searchQ, page); }}
                >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                </Button>
            </div>

            {/* Grid */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm mx-4">
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto" style={{ maxHeight: maxHeight || undefined }}>
                    {loading ? (
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {["#","Job No","Customer","Date","Mode","Amount","Ref No","Actions"].map(h => (
                                        <th key={h} className={thClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 8 }).map((__, j) => (
                                            <td key={j} className={tdClass}>
                                                <div className="h-4 w-16 rounded bg-[var(--cl-border)]" />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : rows.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                            No receipts found for the selected filters.
                        </div>
                    ) : (
                        <table className="min-w-full border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr>
                                    <th className={thClass}>#</th>
                                    <th className={thClass}>Job No</th>
                                    <th className={thClass}>Customer</th>
                                    <th className={thClass}>Date</th>
                                    <th className={thClass}>Mode</th>
                                    <th className={`${thClass} text-right`}>Amount</th>
                                    <th className={thClass}>Ref No</th>
                                    <th className={`${thClass} sticky right-0 z-20 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                {rows.map((row, idx) => (
                                    <motion.tr
                                        key={row.id}
                                        animate={{ opacity: 1 }}
                                        className="group transition-colors hover:bg-[var(--cl-accent)]/5"
                                        initial={{ opacity: 0 }}
                                        transition={{ delay: idx * 0.02, duration: 0.15 }}
                                    >
                                        <td className={`${tdClass} text-[var(--cl-text-muted)]`}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className={`${tdClass} font-mono font-semibold text-[var(--cl-accent)]`}>#{row.job_no}</td>
                                        <td className={tdClass}>
                                            <div className="font-medium">{row.customer_name}</div>
                                            {row.mobile && <div className="text-xs text-[var(--cl-text-muted)]">{row.mobile}</div>}
                                        </td>
                                        <td className={tdClass}>{row.payment_date}</td>
                                        <td className={tdClass}>
                                            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${modeBadgeClass(row.payment_mode)}`}>
                                                {row.payment_mode}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-right font-semibold tabular-nums`}>
                                            {formatAmount(row.amount)}
                                        </td>
                                        <td className={`${tdClass} text-xs text-[var(--cl-text-muted)]`}>{row.reference_no || "—"}</td>
                                        <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`}>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    className="h-7 w-7 p-0 text-[var(--cl-text-muted)] hover:text-[var(--cl-accent)]"
                                                    size="icon"
                                                    title="Edit"
                                                    variant="ghost"
                                                    onClick={() => handleEditReceipt(row)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                                                    size="icon"
                                                    title="Delete"
                                                    variant="ghost"
                                                    onClick={() => setDeleteRow(row)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination + Total */}
                <div className="flex items-center justify-between border-t border-[var(--cl-border)] px-4 py-2 flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-[var(--cl-text-muted)]">
                            Page {page} of {totalPages} · {total} records
                        </span>
                        {rows.length > 0 && (
                            <span className="text-xs font-semibold text-[var(--cl-text)]">
                                Page total: {formatAmount(pageTotal)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="First"    variant="ghost" onClick={() => setPage(1)}><ChevronsLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page <= 1 || loading} size="icon" title="Previous" variant="ghost" onClick={() => setPage(p => p - 1)}><ChevronLeftIcon  className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Next" variant="ghost" onClick={() => setPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></Button>
                        <Button className="h-7 w-7" disabled={page >= totalPages || loading} size="icon" title="Last" variant="ghost" onClick={() => setPage(totalPages)}><ChevronsRightIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {/* New / Edit Dialog */}
            <Dialog
                open={isDialogOpen}
                onOpenChange={open => { if (!open && !formSubmitting) setIsDialogOpen(false); }}
            >
                <DialogContent
                    aria-describedby={undefined}
                    className="sm:max-w-lg"
                >
                    <DialogHeader>
                        <DialogTitle>
                            {selectedReceipt?.id ? "Edit Receipt" : "New Receipt"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto py-1 px-1">
                        <NewReceiptForm
                            ref={formRef}
                            initial={selectedReceipt}
                            onStatusChange={s => { setFormValid(s.isValid); setFormSubmitting(s.isSubmitting); }}
                            onSuccess={handleDialogSuccess}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={formSubmitting}
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                            disabled={!formValid || formSubmitting}
                            onClick={() => formRef.current?.submit()}
                        >
                            {formSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteRow !== null} onOpenChange={open => { if (!open && !deleting) setDeleteRow(null); }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Receipt</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-[var(--cl-text-muted)]">
                        Delete payment of{" "}
                        <span className="font-semibold text-[var(--cl-text)]">{deleteRow ? formatAmount(deleteRow.amount) : ""}</span>
                        {" "}via{" "}
                        <span className="font-semibold text-[var(--cl-text)]">{deleteRow?.payment_mode}</span>
                        {" "}for job{" "}
                        <span className="font-mono font-semibold text-[var(--cl-accent)]">#{deleteRow?.job_no}</span>?
                        This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button disabled={deleting} variant="outline" onClick={() => setDeleteRow(null)}>Cancel</Button>
                        <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                            {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};
