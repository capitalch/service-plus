import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, FileDown, FileSpreadsheet, FileText, Loader2, MoreHorizontal, Pencil, RefreshCw, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { ViewModeToggle, type ViewMode } from "@/features/client/components/inventory/view-mode-toggle";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj, graphQlUtils } from "@/lib/graphql-utils";
import { formatCurrency, currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectIsGstRegistered, selectSchema, selectCompanyName } from "@/store/context-slice";
import type { BranchType } from "@/features/client/components/masters/branch/branch";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseInvoiceType, PurchaseLineType, StockTransactionTypeRow } from "@/features/client/types/purchase";
import { ViewPurchaseInvoiceDialog } from "./view-purchase-invoice-dialog";
import { PurchaseInvoicePdfPreviewDialog } from "./purchase-invoice-pdf-preview-dialog";
import { NewPurchaseInvoice, type NewPurchaseInvoiceHandle } from "./new-purchase-invoice";
import { Save } from "lucide-react";
import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";

// ViewMode is imported from view-mode-toggle

type GenericQueryData<T> = { genericQuery: T[] | null };

type DetailRow = PurchaseInvoiceType & { lines: PurchaseLineType[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;
const DEBOUNCE_MS = 600;



// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-3 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
const tdClass = "p-3 text-sm text-[var(--cl-text)] border-b border-[var(--cl-border)]";

// ─── Component ────────────────────────────────────────────────────────────────

export const PurchaseEntrySection = () => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);
    const globalBranch = useAppSelector(selectCurrentBranch);
    const branchId = globalBranch?.id ?? null;
    const isGstRegistered = useAppSelector(selectIsGstRegistered);
    const companyName = useAppSelector(selectCompanyName) || "Service Plus";

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // Filter state
    const [branches,       setBranches]       = useState<BranchType[]>([]);
    const [vendors,        setVendors]        = useState<VendorType[]>([]);
    const [txnTypes,       setTxnTypes]       = useState<StockTransactionTypeRow[]>([]);
    const [fromDate,       setFromDate]       = useState(defaultFrom);
    const [toDate,         setToDate]         = useState(defaultTo);
    const [search,         setSearch]         = useState("");
    const [searchQ,        setSearchQ]        = useState("");
    const [selectedBrand,  setSelectedBrand]  = useState("");
 
    // New states for mode-based UI
    const [mode,           setMode]           = useState<ViewMode>("new");
    const [brands,         setBrands]         = useState<BrandOption[]>([]);

    // Data state
    const [invoices, setInvoices] = useState<PurchaseInvoiceType[]>([]);
    const [total,    setTotal]    = useState(0);
    const [page,     setPage]     = useState(1);
    const [loading,  setLoading]  = useState(false);

    // Dialog state
    const [viewInvoice,       setViewInvoice]       = useState<PurchaseInvoiceType | null>(null);
    const [pdfPreviewInvoice, setPdfPreviewInvoice] = useState<PurchaseInvoiceType | null>(null);
    const [deleteId,          setDeleteId]          = useState<number | null>(null);
    const [deleting,     setDeleting]     = useState(false);

    // Excel download state
    const [excelLoadingId, setExcelLoadingId] = useState<number | null>(null);

    // Edit state
    const [editInvoice,  setEditInvoice]  = useState<PurchaseInvoiceType | null>(null);
    const [isIgst,       setIsIgst]       = useState(false);
    const [isReturn,     setIsReturn]     = useState(false);

    // Form coordination
    const newPurchaseRef = useRef<NewPurchaseInvoiceHandle>(null);
    const [newFormValid, setNewFormValid] = useState(false);
    const [submitting,   setSubmitting]   = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Load vendors, txnTypes, states, brands on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [branchRes, vendorRes, txnRes, brandRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<BranchType>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANCHES }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<VendorType>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_VENDORS }),
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
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName,
                            schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                        },
                    }),
                ]);
                setBranches(branchRes.data?.genericQuery ?? []);
                setVendors(vendorRes.data?.genericQuery ?? []);
                setTxnTypes(txnRes.data?.genericQuery ?? []);
                const brandList = brandRes.data?.genericQuery ?? [];
                setBrands(brandList);
                if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
            } catch {
                toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // 2. Load invoices (paged)
    const loadData = useCallback(async (
        bId: number, from: string, to: string, q: string, pg: number,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, from_date: from, to_date: to, search: q };
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

    // Re-fetch when filters or global branch change
    useEffect(() => {
        if (!branchId) return;
        void loadData(Number(branchId), fromDate, toDate, searchQ, page);
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

    // 3. Delete
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
            void loadData(Number(branchId), fromDate, toDate, searchQ, page);
        } catch {
            toast.error(MESSAGES.ERROR_PURCHASE_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadExcel = async (inv: PurchaseInvoiceType) => {
        if (!dbName || !schema) return;
        setExcelLoadingId(inv.id);
        try {
            const res = await apolloClient.query<GenericQueryData<DetailRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                        sqlArgs: { id: inv.id },
                    }),
                },
            });
            const detail = res.data?.genericQuery?.[0];
            if (!detail) { toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED); return; }
            const lines = detail.lines ?? [];

            const sheetData = [
                ["Invoice No",  detail.invoice_no],
                ["Date",        detail.invoice_date],
                ["Supplier",    detail.supplier_name],
                ["Aggregate",   Number(detail.aggregate_amount)],
                ["CGST",        Number(detail.cgst_amount)],
                ["SGST",        Number(detail.sgst_amount)],
                ["IGST",        Number(detail.igst_amount)],
                ["Total Tax",   Number(detail.total_tax)],
                ["Total",       Number(detail.total_amount)],
                [],
                ["#", "Part Code", "Part Name", "HSN", "Qty", "Unit Price", "GST%", "CGST", "SGST", "IGST", "Total"],
                ...lines.map((l, i) => [
                    i + 1, l.part_code, l.part_name, l.hsn_code,
                    Number(l.quantity), Number(l.unit_price), Number(l.gst_rate),
                    Number(l.cgst_amount), Number(l.sgst_amount), Number(l.igst_amount),
                    Number(l.total_amount),
                ]),
            ];

            const ws = utils.aoa_to_sheet(sheetData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Invoice");
            const supplierSlug = detail.supplier_name.slice(0, 10).replace(/\s+/g, "-");
            writeFile(wb, `purchase-invoice-${supplierSlug}-${detail.invoice_no}.xlsx`);
        } catch {
            toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED);
        } finally {
            setExcelLoadingId(null);
        }
    };

    const handleDownloadAllExcel = () => {
        if (invoices.length === 0) {
            toast.warning("No data to export");
            return;
        }

        const branchName = globalBranch?.name || "All Branches";
        const dateRangeStr = `Date: ${fromDate} to ${toDate}`;

        const totals = invoices.reduce((acc, inv) => {
            acc.aggregate += Number(inv.aggregate_amount);
            acc.cgst += Number(inv.cgst_amount);
            acc.sgst += Number(inv.sgst_amount);
            acc.igst += Number(inv.igst_amount);
            acc.total += Number(inv.total_amount);
            return acc;
        }, { aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

        const sheetData = [
            [companyName],
            [`Branch: ${branchName}`, dateRangeStr],
            [],
            ["Date", "Invoice No", "Supplier", "Aggregate", "CGST", "SGST", "IGST", "Total"],
            ...invoices.map(inv => [
                inv.invoice_date, inv.invoice_no, inv.supplier_name, 
                Number(inv.aggregate_amount), 
                Number(inv.cgst_amount), 
                Number(inv.sgst_amount), 
                Number(inv.igst_amount), 
                Number(inv.total_amount)
            ]),
            ["", "", "Total:", totals.aggregate, totals.cgst, totals.sgst, totals.igst, totals.total]
        ];
        const ws = utils.aoa_to_sheet(sheetData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Purchase Invoices");

        const supplierNameStr = searchQ ? searchQ.replace(/[^a-zA-Z0-9-]/g, '-') : 'All-Suppliers';
        const branchStr = branchName.replace(/[^a-zA-Z0-9-]/g, '-');
        writeFile(wb, `Purchase-invoices-${supplierNameStr}-${branchStr}-${fromDate}-${toDate}.xlsx`);
    };

    const handleDownloadAllPdf = () => {
        if (invoices.length === 0) {
            toast.warning("No data to export");
            return;
        }

        const doc = new jsPDF();
        
        const branchName = globalBranch?.name || "All Branches";
        const dateRangeStr = `Date: ${fromDate} to ${toDate}`;

        doc.setFontSize(16);
        doc.text(companyName, 14, 15);
        
        doc.setFontSize(11);
        doc.text(`Branch: ${branchName}`, 14, 22);
        doc.text(dateRangeStr, 14, 28);
        
        const totals = invoices.reduce((acc, inv) => {
            acc.aggregate += Number(inv.aggregate_amount);
            acc.cgst += Number(inv.cgst_amount);
            acc.sgst += Number(inv.sgst_amount);
            acc.igst += Number(inv.igst_amount);
            acc.total += Number(inv.total_amount);
            return acc;
        }, { aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
        
        autoTable(doc, {
            startY: 32,
            head: [['Date', 'Invoice No', 'Supplier', 'Aggregate', 'CGST', 'SGST', 'IGST', 'Total']],
            body: invoices.map(inv => [
                inv.invoice_date, 
                inv.invoice_no, 
                inv.supplier_name, 
                Number(inv.aggregate_amount).toFixed(2),
                Number(inv.cgst_amount).toFixed(2),
                Number(inv.sgst_amount).toFixed(2),
                Number(inv.igst_amount).toFixed(2),
                Number(inv.total_amount).toFixed(2)
            ]),
            foot: [[
                "", "", "Total:", 
                totals.aggregate.toFixed(2), 
                totals.cgst.toFixed(2), 
                totals.sgst.toFixed(2), 
                totals.igst.toFixed(2), 
                totals.total.toFixed(2)
            ]],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
        });
        
        const supplierNameStr = searchQ ? searchQ.replace(/[^a-zA-Z0-9-]/g, '-') : 'All-Suppliers';
        const branchStr = branchName.replace(/[^a-zA-Z0-9-]/g, '-');
        doc.save(`Purchase-invoices-${supplierNameStr}-${branchStr}-${fromDate}-${toDate}.pdf`);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Auto-detect IGST mode from edit invoice
    useEffect(() => {
        setIsIgst(editInvoice ? Number(editInvoice.igst_amount) > 0 : false);
    }, [editInvoice]);

    const gridTotals = invoices.reduce((acc, inv) => {
        acc.aggregate += Number(inv.aggregate_amount) || 0;
        acc.cgst += Number(inv.cgst_amount) || 0;
        acc.sgst += Number(inv.sgst_amount) || 0;
        acc.igst += Number(inv.igst_amount) || 0;
        acc.total += Number(inv.total_amount) || 0;
        return acc;
    }, { aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

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
                            Purchase Entry
                            {mode === 'new' && !editInvoice && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— New</span>}
                            {mode === 'new' &&  editInvoice && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {mode === 'view' && <span className="ml-2 text-sm font-medium text-[var(--cl-text-muted)] whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === 'new' && (
                            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm animate-in fade-in zoom-in duration-500 delay-150 ml-4 ${
                                isGstRegistered
                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                    : 'bg-red-500/10 border-red-500/20'
                            }`}>
                                {isGstRegistered ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                                )}
                                <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${
                                    isGstRegistered ? 'text-emerald-700' : 'text-red-700'
                                }`}>
                                    {isGstRegistered ? 'GST' : 'No-GST'}
                                </span>
                            </div>
                        )}
                        {mode === 'view' && (
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
                    isEditing={!!editInvoice}
                    disableNew={!!editInvoice}
                    onNewClick={() => { setEditInvoice(null); setIsReturn(false); setMode("new"); }}
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

                {/* IGST — invisible in view mode */}
                <label className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-lg border-2 font-black text-[12px] uppercase tracking-[0.1em] transition-all shadow-sm ${
                    mode !== 'new'
                        ? 'hidden md:flex md:invisible pointer-events-none'
                        : isIgst
                        ? 'bg-blue-400 text-white border-blue-600 shadow-blue-500/20'
                        : 'bg-[var(--cl-surface-2)] border-[var(--cl-border)] text-[var(--cl-text-muted)]'
                }`}>
                    <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-white cursor-pointer"
                        checked={isIgst}
                        onChange={e => setIsIgst(e.target.checked)}
                    />
                    IGST
                </label>

                {/* Return — invisible in view mode */}
                <button
                    type="button"
                    disabled={!!editInvoice && !editInvoice.is_return}
                    onClick={() => setIsReturn(r => !r)}
                    className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-lg border-2 font-black text-[12px] uppercase tracking-[0.1em] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                        mode !== 'new'
                            ? 'hidden md:flex md:invisible pointer-events-none'
                            : isReturn
                            ? 'bg-red-500 text-white border-red-700 shadow-red-500/20'
                            : 'bg-[var(--cl-surface-2)] border-[var(--cl-border)] text-[var(--cl-text-muted)]'
                    }`}
                >
                    <RotateCcw className="h-3 w-3" />
                    Return
                </button>

                {/* Reset · Save — invisible in view mode */}
                <div className={`flex items-center gap-2 ${mode !== 'new' ? 'hidden md:flex md:invisible pointer-events-none' : ''}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)]"
                        variant="ghost"
                        onClick={() => { setEditInvoice(null); newPurchaseRef.current?.reset(); }}
                        disabled={submitting}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${submitting ? 'animate-spin' : ''}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        onClick={() => newPurchaseRef.current?.submit()}
                        disabled={!newFormValid || submitting}
                    >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Invoice
                    </Button>
                </div>
            </div>

            {mode === 'new' ? (
                    <NewPurchaseInvoice
                        ref={newPurchaseRef}
                        branchId={branchId}
                        txnTypes={txnTypes}
                        vendors={vendors}
                        onSuccess={() => {
                            if (editInvoice) {
                                setEditInvoice(null);
                                setMode('view');
                                if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1);
                            } else {
                                newPurchaseRef.current?.reset();
                            }
                        }}
                        onStatusChange={(status) => {
                            setNewFormValid(status.isValid);
                            setSubmitting(status.isSubmitting);
                        }}
                        isIgst={isIgst}
                        isReturn={isReturn}
                        onIsIgstChange={setIsIgst}
                        onIsReturnChange={setIsReturn}
                        selectedBrandId={selectedBrand ? Number(selectedBrand) : null}
                        brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                        editInvoice={editInvoice}
                    />
            ) : (
                <>
                    {/* Toolbar - Compacted */}
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
                                placeholder="Invoice or Supplier…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                className="h-8 gap-1.5 px-3 text-xs font-semibold text-sky-600 bg-sky-500/10 hover:bg-sky-500/20 active:bg-sky-500/30 transition-all border border-sky-500/20 shadow-sm rounded-lg"
                                variant="ghost"
                                onClick={handleDownloadAllPdf}
                                disabled={invoices.length === 0}
                            >
                                <FileDown className="h-4 w-4" />
                                Save as PDF
                            </Button>
                            <Button
                                className="h-8 gap-1.5 px-3 text-xs font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-all border border-emerald-500/20 shadow-sm rounded-lg"
                                variant="ghost"
                                onClick={handleDownloadAllExcel}
                                disabled={invoices.length === 0}
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                Export Excel
                            </Button>
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
                            ) : invoices.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                    No purchase invoices found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Invoice No</th>
                                            <th className={thClass}>Supplier</th>
                                            <th className={`${thClass} text-right`}>Aggregate</th>
                                            <th className={`${thClass} text-right`}>CGST</th>
                                            <th className={`${thClass} text-right`}>SGST</th>
                                            <th className={`${thClass} text-right`}>IGST</th>
                                            <th className={`${thClass} text-right`}>Total</th>
                                            <th className={`${thClass} sticky top-0 right-0 z-30 !bg-[var(--cl-surface-2)]`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--cl-border)] bg-[var(--cl-surface)]">
                                        {invoices.map((inv, idx) => (
                                            <tr key={inv.id} className="group transition-colors hover:bg-[var(--cl-accent)]/5 dark:hover:bg-white/[0.03]">
                                                <td className={`${tdClass} text-[var(--cl-text-muted)]`} style={{ width: "5%" }}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={tdClass} style={{ width: "10%" }}>
                                                    {inv.invoice_date}
                                                </td>
                                                <td className={`${tdClass} font-mono font-medium`} style={{ width: "15%" }}>
                                                    {inv.invoice_no}
                                                    {inv.is_return && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950/40 rounded px-1 py-0.5">
                                                            RTN
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={tdClass} style={{ width: "25%" }}>
                                                    {inv.supplier_name}
                                                </td>
                                                <td className={`${tdClass} text-right`} style={{ width: "10%" }}>
                                                    {formatCurrency(inv.aggregate_amount)}
                                                </td>
                                                <td className={`${tdClass} text-right`} style={{ width: "8%" }}>
                                                    {formatCurrency(inv.cgst_amount)}
                                                </td>
                                                <td className={`${tdClass} text-right`} style={{ width: "8%" }}>
                                                    {formatCurrency(inv.sgst_amount)}
                                                </td>
                                                <td className={`${tdClass} text-right`} style={{ width: "8%" }}>
                                                    {formatCurrency(inv.igst_amount)}
                                                </td>
                                                <td className={`${tdClass} text-right font-medium text-[var(--cl-accent)]`} style={{ width: "12%" }}>
                                                    {formatCurrency(inv.total_amount)}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-[var(--cl-surface)] group-hover:bg-[var(--cl-surface-2)]`} style={{ width: "11%" }}>
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
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-sky-500/20 focus:text-sky-400 dark:focus:bg-sky-400/20 dark:focus:text-sky-300"
                                                                    onClick={() => setViewInvoice(inv)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    <span>View Details</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-sky-500/20 focus:text-sky-400 dark:focus:bg-sky-400/20 dark:focus:text-sky-300"
                                                                    onClick={() => setPdfPreviewInvoice(inv)}
                                                                >
                                                                    <FileDown className="h-4 w-4" />
                                                                    <span>Show PDF</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-emerald-500/20 focus:text-emerald-500 dark:focus:bg-emerald-400/20 dark:focus:text-emerald-300"
                                                                    disabled={excelLoadingId === inv.id}
                                                                    onClick={() => void handleDownloadExcel(inv)}
                                                                >
                                                                    {excelLoadingId === inv.id
                                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                        : <FileSpreadsheet className="h-4 w-4" />
                                                                    }
                                                                    <span>Download Excel</span>
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-amber-500 focus:bg-amber-500/10 focus:text-amber-600"
                                                                    onClick={() => { setEditInvoice(inv); setMode('new'); }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit Invoice</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600 font-semibold"
                                                                    onClick={() => setDeleteId(inv.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>Delete Invoice</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="sticky bottom-0 z-10 bg-[var(--cl-surface-2)] shadow-[0_-1px_0_var(--cl-border)] border-t border-t-[var(--cl-border)]">
                                        <tr>
                                            <td className={tdClass} colSpan={4}>
                                                <div className="text-right font-bold text-[var(--cl-text)]">Total:</div>
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-[var(--cl-text)]`}>
                                                {formatCurrency(gridTotals.aggregate)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-[var(--cl-text)]`}>
                                                {formatCurrency(gridTotals.cgst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-[var(--cl-text)]`}>
                                                {formatCurrency(gridTotals.sgst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-[var(--cl-text)]`}>
                                                {formatCurrency(gridTotals.igst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-[var(--cl-accent)] text-[13px]`}>
                                                {formatCurrency(gridTotals.total)}
                                            </td>
                                            <td className={`${tdClass} !bg-[var(--cl-surface-2)]`}></td>
                                        </tr>
                                    </tfoot>
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

                    {/* View Dialog */}
                    <ViewPurchaseInvoiceDialog
                        invoice={viewInvoice}
                        open={viewInvoice !== null}
                        onOpenChange={open => { if (!open) setViewInvoice(null); }}
                        onShowPdf={inv => setPdfPreviewInvoice(inv)}
                    />

                    {/* PDF Preview Dialog */}
                    <PurchaseInvoicePdfPreviewDialog
                        branch={pdfPreviewInvoice ? (branches.find(b => b.id === pdfPreviewInvoice.branch_id) ?? null) : null}
                        invoice={pdfPreviewInvoice}
                        open={pdfPreviewInvoice !== null}
                        onOpenChange={open => { if (!open) setPdfPreviewInvoice(null); }}
                        vendor={pdfPreviewInvoice ? (vendors.find(v => v.id === pdfPreviewInvoice.supplier_id) ?? null) : null}
                    />

                    {/* Delete Confirm Dialog */}
                    <Dialog
                        open={deleteId !== null}
                        onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}
                    >
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                            <DialogHeader>
                                <DialogTitle>Delete Purchase Invoice</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-[var(--cl-text-muted)]">
                                This will permanently delete the invoice and all associated stock transactions.
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
