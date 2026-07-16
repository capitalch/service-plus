import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SEARCH_DEBOUNCE_MS } from "@/constants/timing";
import {CheckCircle2, Eye, FileDown, FileSpreadsheet, FileText, Loader2,
    MoreHorizontal, Pencil, RefreshCw, RotateCcw, Save, Search, Trash2, XCircle, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, X} from "lucide-react";
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
import { LocaleDateInput } from "@/components/ui/locale-date-input";
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
import { encodeObj, graphQlUtils, type GenericQueryData } from "@/lib/graphql-utils";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { formatCurrency, currentFinancialYearRange } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectCurrentBranch, selectSchema, selectCurrentDivision, selectDefaultDivisionId, selectAvailableDivisions, selectPostDataToAccounts } from "@/store/context-slice";
import { isGstDivision } from "@/features/client/types/division";
import type { BrandOption } from "@/features/client/types/model";
import { BrandSelect } from "@/features/client/components/inventory/brand-select";
import type { SalesInvoiceType, SalesLineType, DocumentSequenceRow } from "@/features/client/types/sales";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import { salesInvoiceSchema, getSalesInvoiceDefaultValues, getInitialSalesLine } from "./sales-invoice-schema";
import type { SalesInvoiceFormValues } from "./sales-invoice-schema";
import { calcLine } from "./sales-invoice-utils";

import { NewSalesInvoice } from "./new-sales-invoice";
import { ViewSalesInvoiceDialog } from "./view-sales-invoice-dialog";
import { SalesInvoicePdfPreviewDialog } from "./sales-invoice-pdf-preview-dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE   = 50;

const thClass = "sticky top-0 z-20 text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) p-3 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "p-3 text-sm text-(--cl-text) border-b border-(--cl-border)";

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesEntrySection = () => {
    const dbName           = useAppSelector(selectDbName);
    const schema           = useAppSelector(selectSchema);
    const globalBranch     = useAppSelector(selectCurrentBranch);
    const branchId         = globalBranch?.id ?? null;
    const currentDivision  = useAppSelector(selectCurrentDivision);
    const postDataToAccounts = useAppSelector(selectPostDataToAccounts);
    const availableDivisions = useAppSelector(selectAvailableDivisions);
    const defaultDivisionId  = useAppSelector(selectDefaultDivisionId);
    const companyName      = currentDivision?.name || globalBranch?.name || "Service Plus";

    const { from: defaultFrom, to: defaultTo } = currentFinancialYearRange();

    // Filter state
    const [txnTypes,      setTxnTypes]      = useState<StockTransactionTypeRow[]>([]);
    const [fromDate,      setFromDate]      = useState(defaultFrom);
    const [toDate,        setToDate]        = useState(defaultTo);
    const [search,        setSearch]        = useState("");
    const [searchQ,       setSearchQ]       = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");
    // View-mode division filter. null = All Divisions (the default).
    const [viewDivisionId, setViewDivisionId] = useState<number | null>(null);

    // Mode
    const [mode,          setMode]          = useState<ViewMode>("new");
    const [brands,        setBrands]        = useState<BrandOption[]>([]);
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeOption[]>([]);
    const [masterStates,  setMasterStates]  = useState<StateOption[]>([]);
    const [docSequences,  setDocSequences]  = useState<DocumentSequenceRow[]>([]);

    // Data
    const [invoices,     setInvoices]     = useState<SalesInvoiceType[]>([]);
    const [total,        setTotal]        = useState(0);
    const [grandTotals,  setGrandTotals]  = useState({ aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    const [page,     setPage]     = useState(1);
    const [loading,  setLoading]  = useState(false);

    // Dialog
    const [diffAlertMsg,      setDiffAlertMsg]      = useState<string | null>(null);
    const [viewInvoice,       setViewInvoice]       = useState<SalesInvoiceType | null>(null);
    const [pdfPreviewInvoice, setPdfPreviewInvoice] = useState<SalesInvoiceType | null>(null);
    const [deleteId,          setDeleteId]          = useState<number | null>(null);
    const [deleting,          setDeleting]          = useState(false);
    const [excelLoadingId,    setExcelLoadingId]    = useState<number | null>(null);

    // Edit
    const [editInvoice, setEditInvoice] = useState<SalesInvoiceType | null>(null);
    const [isIgst,      setIsIgst]      = useState(false);
    const [isReturn,    setIsReturn]    = useState(false);

    // Lifted form state
    const [backCalcTargetRaw, setBackCalcTargetRaw] = useState("");
    // True only once Apply (or Round Off) has actually redistributed the
    // line items to match the current backCalcTarget value. Any change to the
    // target (typing, clearing, auto-sync) resets this to false, so a target that
    // was merely typed but never applied is never mistaken for the real total.
    const [backCalcApplied,   setBackCalcApplied]    = useState(false);
    // Stable identities: this is a dependency of an effect in NewSalesInvoice,
    // so a function recreated every render would re-trigger that effect on
    // every keystroke (even ones unrelated to the target field), clobbering
    // whatever the user just typed.
    const setBackCalcTarget = useCallback((v: string) => {
        setBackCalcTargetRaw(v);
        setBackCalcApplied(false);
    }, []);
    const backCalcTarget = backCalcTargetRaw;
    const markBackCalcApplied = useCallback(() => setBackCalcApplied(true), []);
    const [customerId,        setCustomerId]        = useState<number | null>(null);
    const [customerName,      setCustomerName]      = useState("");
    const [customerGstin,     setCustomerGstin]     = useState("");
    const [customerStateCode, setCustomerStateCode] = useState("");

    const selectedBrandId = selectedBrand ? Number(selectedBrand) : null;

    const form = useForm<SalesInvoiceFormValues>({
        defaultValues: {
            ...getSalesInvoiceDefaultValues(defaultDivisionId),
            lines: [getInitialSalesLine(selectedBrandId)],
        },
        mode:          "onChange",
        resolver:      zodResolver(salesInvoiceSchema) as any,
    });

    const selectedDivisionId = form.watch("division_id");
    const isGstMode = isGstDivision(availableDivisions.find(d => d.id === selectedDivisionId) ?? null);

    // When viewing All Divisions, the invoice number is tagged with its division code.
    const showDivisionCode = viewDivisionId == null && availableDivisions.length > 0;
    const divisionCodeById = (id: number | null) =>
        availableDivisions.find(d => d.id === id)?.code ?? null;

    // Line validity is reported up from NewSalesInvoice, which watches the field array
    // reliably (the parent's own form.watch("lines") misses nested per-line updates).
    const [linesValid, setLinesValid] = useState(false);

    const canSave = !!customerName.trim() && !!customerStateCode && !!selectedBrand && linesValid && isValidGstin(customerGstin);

    const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);

    const [maxHeight, setMaxHeight] = useState<number>(0);

    const recalc = useCallback(() => {
        if (scrollWrapperRef.current) {
            const rect            = scrollWrapperRef.current.getBoundingClientRect();
            const availableHeight = window.innerHeight - rect.top - 60;
            setMaxHeight(Math.max(200, availableHeight));
        }
    }, []);

    useEffect(() => {
        if (mode === "view") {
            const timer = setTimeout(recalc, 100);
            window.addEventListener("resize", recalc);
            return () => {
                clearTimeout(timer);
                window.removeEventListener("resize", recalc);
            };
        }
    }, [mode, recalc, invoices.length]);

    // Derive active docSequence for SINV
    const sinvSequence = docSequences.find(
        ds => ds.document_type_code === "SALES_INVOICE" && ds.id != null
    ) ?? null;

    // Load meta on mount
    useEffect(() => {
        if (!dbName || !schema) return;
        const fetchMeta = async () => {
            try {
                const [txnRes, brandRes, custTypeRes, masterStateRes] = await Promise.all([
                    apolloClient.query<GenericQueryData<StockTransactionTypeRow>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_STOCK_TRANSACTION_TYPES }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<BrandOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<CustomerTypeOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_CUSTOMER_TYPES }),
                        },
                    }),
                    apolloClient.query<GenericQueryData<StateOption>>({
                        fetchPolicy: "network-only",
                        query: GRAPHQL_MAP.genericQuery,
                        variables: {
                            db_name: dbName, schema,
                            value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_STATES }),
                        },
                    }),
                ]);
                setTxnTypes(txnRes.data?.genericQuery ?? []);
                const brandList = brandRes.data?.genericQuery ?? [];
                setBrands(brandList);
                if (brandList.length === 1) setSelectedBrand(String(brandList[0].id));
                setCustomerTypes(custTypeRes.data?.genericQuery ?? []);
                setMasterStates((masterStateRes.data?.genericQuery ?? []).map(s => ({
                    id:   s.id,
                    code: (s as any).gst_state_code ?? s.code,
                    name: s.name,
                })));
            } catch {
                toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED);
            }
        };
        void fetchMeta();
    }, [dbName, schema]);

    // Load doc sequences — division-level when currentDivision is set, otherwise branch-level
    useEffect(() => {
        if (!dbName || !schema || !branchId) return;
        const fetchSeqs = currentDivision?.id
            ? apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES_BY_DIVISION,
                        sqlArgs: { branch_id: branchId, division_id: currentDivision.id },
                    }),
                },
            })
            : apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES,
                        sqlArgs: { branch_id: branchId },
                    }),
                },
            });
        fetchSeqs.then(res => {
            setDocSequences(res.data?.genericQuery ?? []);
        }).catch(() => {});
    }, [dbName, schema, branchId, currentDivision?.id]);

    // Load invoices (paged)
    const loadData = useCallback(async (
        bId: number, from: string, to: string, q: string, pg: number, divisionId: number | null = null,
    ) => {
        if (!dbName || !schema) return;
        setLoading(true);
        try {
            const commonArgs = { branch_id: bId, division_id: divisionId, from_date: from, to_date: to, search: q };
            const [dataRes, countRes, totalsRes] = await Promise.all([
                apolloClient.query<GenericQueryData<SalesInvoiceType>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_SALES_INVOICES_PAGED,
                            sqlArgs: { ...commonArgs, limit: PAGE_SIZE, offset: (pg - 1) * PAGE_SIZE },
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ total: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_SALES_INVOICES_COUNT,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
                apolloClient.query<GenericQueryData<{ aggregate_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_SALES_INVOICES_TOTALS,
                            sqlArgs: commonArgs,
                        }),
                    },
                }),
            ]);
            setInvoices(dataRes.data?.genericQuery ?? []);
            setTotal(countRes.data?.genericQuery?.[0]?.total ?? 0);
            const gt = totalsRes.data?.genericQuery?.[0];
            setGrandTotals({
                aggregate: Number(gt?.aggregate_amount ?? 0),
                cgst:      Number(gt?.cgst_amount      ?? 0),
                sgst:      Number(gt?.sgst_amount      ?? 0),
                igst:      Number(gt?.igst_amount      ?? 0),
                total:     Number(gt?.total_amount     ?? 0),
            });
        } catch {
            toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED);
        } finally {
            setLoading(false);
        }
    }, [dbName, schema]);

    useEffect(() => {
        if (!branchId || mode !== "view") return;
        void loadData(Number(branchId), fromDate, toDate, searchQ, page, viewDivisionId);
    }, [branchId, fromDate, toDate, searchQ, page, loadData, mode, viewDivisionId]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            setSearchQ(value);
        }, SEARCH_DEBOUNCE_MS);
    };

    const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    };

    const handleReset = () => {
        form.reset({
            ...getSalesInvoiceDefaultValues(defaultDivisionId),
            lines: [getInitialSalesLine(selectedBrandId)],
        });
        setBackCalcTarget("");
        setCustomerId(null);
        setCustomerName("");
        setCustomerGstin("");
        setCustomerStateCode("");
        setIsIgst(false);
        setIsReturn(false);
        setEditInvoice(null);
        setLinesValid(false);
    };

    // Changing the division wipes the whole entry (customer, lines, tax mode,
    // back-calc target) and starts fresh under the newly selected division.
    const handleDivisionChange = (newDivisionId: number) => {
        form.reset({
            ...getSalesInvoiceDefaultValues(newDivisionId),
            lines: [getInitialSalesLine(selectedBrandId)],
        });
        setBackCalcTarget("");
        setCustomerId(null);
        setCustomerName("");
        setCustomerGstin("");
        setCustomerStateCode("");
        setIsIgst(false);
        setIsReturn(false);
        setLinesValid(false);
    };

    const executeSave = async (values: SalesInvoiceFormValues) => {
        if (!customerName.trim()) {
            toast.error(MESSAGES.ERROR_SALES_CUSTOMER_REQUIRED);
            return;
        }
        if (!customerStateCode) {
            toast.error("Customer state is required.");
            return;
        }
        if (!isValidGstin(customerGstin)) {
            toast.error("Enter a valid 15-character GSTIN, or clear the field.");
            return;
        }

        const salesTypeId  = txnTypes.find(t => t.code === "SALES")?.id;
        const returnTypeId = txnTypes.find(t => t.code === "SALE_RETURN")?.id;
        if (isReturn && !returnTypeId) {
            toast.error("Sale Return transaction type not found. Please contact admin.");
            return;
        }
        if (!salesTypeId || !branchId || !dbName || !schema) {
            toast.error(MESSAGES.ERROR_SALES_CREATE_FAILED);
            return;
        }

        const formLines = form.getValues("lines") ?? [];
        const formOriginalLineIds = form.getValues("originalLineIds") ?? [];
        const txnTypeId = isReturn ? returnTypeId! : salesTypeId;
        const drCr      = isReturn ? "D" : "C";

        // Compute totals
        let aggTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
        for (const l of formLines) {
            const c = calcLine(l, isIgst);
            aggTotal  += c.aggregate;
            cgstTotal += c.cgstAmt;
            sgstTotal += c.sgstAmt;
            igstTotal += c.igstAmt;
        }
        const totalTax    = cgstTotal + sgstTotal + igstTotal;
        const calcTotal   = aggTotal + totalTax;
        const backCalcNum = parseFloat(backCalcTarget);
        const hasTarget   = backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0;
        // A target that was typed but never actually applied via Apply doesn't
        // affect the line items, so saving it as the invoice amount would
        // desync the header total from the sum of the saved lines. Ignore it.
        const grandTotal  = (hasTarget && backCalcApplied) ? backCalcNum : calcTotal;

        const diff = Math.abs(grandTotal - calcTotal);
        if (diff > 0.5) {
            setDiffAlertMsg(
                `Invoice total (₹${grandTotal.toFixed(2)}) differs from the calculated line total (₹${calcTotal.toFixed(2)}) by ₹${diff.toFixed(2)}. Maximum allowed difference is ₹0.50. Please adjust the target amount or click Apply.`
            );
            return;
        }

        const linePayload = formLines.map(line => {
            const c = calcLine(line, isIgst);
            return {
                cgst_amount:      c.cgstAmt,
                cost_price:       line.cost_price,
                gst_rate:         line.gst_rate,
                hsn_code:         line.hsn_code,
                igst_amount:      c.igstAmt,
                item_description: line.part_name,
                amount:           c.total,
                part_id:          line.part_id,
                price:            line.unit_price,
                qty:              line.qty,
                remarks:          line.remarks.trim() || null,
                sgst_amount:      c.sgstAmt,
                xDetails: [
                    {
                        tableName: "stock_transaction",
                        fkeyName:  "sales_line_id",
                        xData: [{
                            branch_id:                 branchId,
                            part_id:                   line.part_id,
                            qty:                       line.qty,
                            unit_cost:                 line.unit_price,
                            dr_cr:                     drCr,
                            transaction_date:          values.invoice_date,
                            stock_transaction_type_id: txnTypeId,
                        }],
                    },
                ],
            };
        });

        const headerFields = {
            aggregate:           aggTotal,
            amount:              grandTotal,
            brand_id:            selectedBrandId,
            cgst_amount:         cgstTotal,
            customer_contact_id: customerId ?? null,
            customer_gstin:      normalizeGstin(customerGstin) || null,
            customer_name:       customerName.trim(),
            customer_state_code: customerStateCode,
            division_id:         values.division_id,
            igst_amount:         igstTotal,
            invoice_date:        values.invoice_date,
            is_return:           isReturn,
            remarks:             values.remarks?.trim() || null,
            sgst_amount:         sgstTotal,
        };

        try {
            if (editInvoice) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "sales_invoice",
                    xData: {
                        id: editInvoice.id,
                        ...headerFields,
                        xDetails: {
                            tableName:  "sales_invoice_line",
                            fkeyName:   "sales_invoice_id",
                            deletedIds: formOriginalLineIds,
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_SALES_UPDATED);
                handleReset();
                setMode("view");
                if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, 1, viewDivisionId);
            } else {
                if (!sinvSequence || !sinvSequence.prefix.trim()) {
                    toast.error(MESSAGES.ERROR_DOC_SEQ_SINV_NOT_CONFIGURED);
                    return;
                }
                const sqlObject = {
                    tableName:   "sales_invoice",
                    branch_id:   branchId,
                    division_id: values.division_id,
                    xData: {
                        ...headerFields,
                        xDetails: {
                            tableName: "sales_invoice_line",
                            fkeyName:  "sales_invoice_id",
                            xData:     linePayload,
                        },
                    },
                };
                const encoded = encodeURIComponent(JSON.stringify(sqlObject));
                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.createSalesInvoice,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                toast.success(MESSAGES.SUCCESS_SALES_CREATED);
                handleReset();
                // Refresh doc sequence after create
                if (dbName && schema && branchId) {
                    const refreshQuery = currentDivision?.id
                        ? apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: {
                                db_name: dbName, schema,
                                value: graphQlUtils.buildGenericQueryValue({
                                    sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES_BY_DIVISION,
                                    sqlArgs: { branch_id: branchId, division_id: currentDivision.id },
                                }),
                            },
                        })
                        : apolloClient.query<GenericQueryData<DocumentSequenceRow>>({
                            fetchPolicy: "network-only",
                            query: GRAPHQL_MAP.genericQuery,
                            variables: {
                                db_name: dbName, schema,
                                value: graphQlUtils.buildGenericQueryValue({
                                    sqlId:   SQL_MAP.GET_DOCUMENT_SEQUENCES,
                                    sqlArgs: { branch_id: branchId },
                                }),
                            },
                        });
                    refreshQuery.then(res => setDocSequences(res.data?.genericQuery ?? [])).catch(() => {});
                }
            }
        } catch {
            toast.error(editInvoice ? MESSAGES.ERROR_SALES_UPDATE_FAILED : MESSAGES.ERROR_SALES_CREATE_FAILED);
        }
    };

    // Delete — uses genericUpdate with deletedIds (cascade handles lines + stock_transactions)
    const handleDelete = async () => {
        if (!deleteId || !dbName || !schema) return;
        setDeleting(true);
        try {
            const payload = encodeObj({ tableName: "sales_invoice", deletedIds: [deleteId] });
            await apolloClient.mutate({
                mutation:  GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_SALES_DELETED);
            setDeleteId(null);
            if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page, viewDivisionId);
        } catch {
            toast.error(MESSAGES.ERROR_SALES_DELETE_FAILED);
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadExcel = async (inv: SalesInvoiceType) => {
        if (!dbName || !schema) return;
        setExcelLoadingId(inv.id);
        try {
            const res = await apolloClient.query<GenericQueryData<SalesInvoiceType & { lines: SalesLineType[] }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName, schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_SALES_INVOICE_DETAIL,
                        sqlArgs: { id: inv.id },
                    }),
                },
            });
            const detail = res.data?.genericQuery?.[0];
            if (!detail) { toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED); return; }
            const invLines = detail.lines ?? [];
            const sheetData = [
                ["Invoice No",   detail.invoice_no],
                ["Date",         detail.invoice_date],
                ["Customer",     detail.customer_name],
                ["GSTIN",        detail.customer_gstin ?? ""],
                ["Aggregate",    Number(detail.aggregate_amount)],
                ["CGST",         Number(detail.cgst_amount)],
                ["SGST",         Number(detail.sgst_amount)],
                ["IGST",         Number(detail.igst_amount)],
                ["Total Tax",    Number(detail.total_tax)],
                ["Total",        Number(detail.total_amount)],
                [],
                ["#", "Part Code", "Part Name", "HSN", "Qty", "Unit Price", "GST%", "CGST", "SGST", "IGST", "Total"],
                ...invLines.map((l, i) => [
                    i + 1, l.part_code, l.part_name, l.hsn_code,
                    Number(l.qty), Number(l.unit_price), Number(l.gst_rate),
                    Number(l.cgst_amount), Number(l.sgst_amount), Number(l.igst_amount),
                    Number(l.total_amount),
                ]),
            ];
            const ws = utils.aoa_to_sheet(sheetData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Invoice");
            const slug = (detail.customer_name ?? "customer").slice(0, 10).replace(/\s+/g, "-");
            writeFile(wb, `sales-invoice-${slug}-${detail.invoice_no}.xlsx`);
        } catch {
            toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED);
        } finally {
            setExcelLoadingId(null);
        }
    };

    const handleDownloadAllExcel = () => {
        if (invoices.length === 0) { toast.warning("No data to export"); return; }
        const branchName   = globalBranch?.name || "All Branches";
        const dateRangeStr = `Date: ${fromDate} to ${toDate}`;
        const totals = invoices.reduce((acc, inv) => {
            acc.aggregate += Number(inv.aggregate_amount);
            acc.cgst      += Number(inv.cgst_amount);
            acc.sgst      += Number(inv.sgst_amount);
            acc.igst      += Number(inv.igst_amount);
            acc.total     += Number(inv.total_amount);
            return acc;
        }, { aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
        const sheetData = [
            [companyName],
            [`Branch: ${branchName}`, dateRangeStr],
            [],
            ["Date", "Invoice No", "Customer", "Aggregate", "CGST", "SGST", "IGST", "Total"],
            ...invoices.map(inv => [
                inv.invoice_date, inv.invoice_no, inv.customer_name,
                Number(inv.aggregate_amount), Number(inv.cgst_amount),
                Number(inv.sgst_amount), Number(inv.igst_amount), Number(inv.total_amount),
            ]),
            ["", "", "Total:", totals.aggregate, totals.cgst, totals.sgst, totals.igst, totals.total],
        ];
        const ws = utils.aoa_to_sheet(sheetData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Sales Invoices");
        const branchStr = branchName.replace(/[^a-zA-Z0-9-]/g, "-");
        writeFile(wb, `Sales-invoices-${branchStr}-${fromDate}-${toDate}.xlsx`);
    };

    const handleDownloadAllPdf = () => {
        if (invoices.length === 0) { toast.warning("No data to export"); return; }
        const doc          = new jsPDF();
        const branchName   = globalBranch?.name || "All Branches";
        const dateRangeStr = `Date: ${fromDate} to ${toDate}`;
        doc.setFontSize(16);
        doc.text(companyName, 14, 15);
        doc.setFontSize(11);
        doc.text(`Branch: ${branchName}`, 14, 22);
        doc.text(dateRangeStr, 14, 28);
        const totals = invoices.reduce((acc, inv) => {
            acc.aggregate += Number(inv.aggregate_amount);
            acc.cgst      += Number(inv.cgst_amount);
            acc.sgst      += Number(inv.sgst_amount);
            acc.igst      += Number(inv.igst_amount);
            acc.total     += Number(inv.total_amount);
            return acc;
        }, { aggregate: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
        autoTable(doc, {
            startY: 32,
            head: [["Date", "Invoice No", "Customer", "Aggregate", "CGST", "SGST", "IGST", "Total"]],
            body: invoices.map(inv => [
                inv.invoice_date, inv.invoice_no, inv.customer_name,
                Number(inv.aggregate_amount).toFixed(2),
                Number(inv.cgst_amount).toFixed(2),
                Number(inv.sgst_amount).toFixed(2),
                Number(inv.igst_amount).toFixed(2),
                Number(inv.total_amount).toFixed(2),
            ]),
            foot: [["", "", "Total:",
                totals.aggregate.toFixed(2), totals.cgst.toFixed(2),
                totals.sgst.toFixed(2), totals.igst.toFixed(2), totals.total.toFixed(2),
            ]],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        });
        const branchStr = branchName.replace(/[^a-zA-Z0-9-]/g, "-");
        doc.save(`Sales-invoices-${branchStr}-${fromDate}-${toDate}.pdf`);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));


    return (
        <motion.div
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-(--cl-border) bg-(--cl-surface) px-4 py-1">
                {/* Title */}
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-(--cl-accent)">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex items-baseline gap-2 overflow-hidden">
                        <h1 className="text-lg font-bold text-(--cl-text) truncate">
                            Sales Entry
                            {mode === "new" && !editInvoice && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— New</span>}
                            {mode === "new" &&  editInvoice && <span className="ml-2 text-sm font-medium text-amber-500 whitespace-nowrap">— Edit</span>}
                            {mode === "view" && <span className="ml-2 text-sm font-medium text-(--cl-text-muted) whitespace-nowrap">— View</span>}
                        </h1>
                        {mode === "new" && (
                            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-sm border shadow-sm animate-in fade-in zoom-in duration-500 delay-150 ml-4 ${
                                isGstMode ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"
                            }`}>
                                {isGstMode
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    : <XCircle className="h-3.5 w-3.5 text-amber-600" />
                                }
                                <span className={`text-[10.5px] font-bold uppercase tracking-tighter ${isGstMode ? "text-emerald-700" : "text-amber-700"}`}>
                                    {isGstMode ? "GST" : "Non-GST"}
                                </span>
                            </div>
                        )}
                        {mode === "view" && (
                            <span className="text-xs text-(--cl-text-muted) whitespace-nowrap">
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
                    onNewClick={() => { handleReset(); setMode("new"); }}
                    onViewClick={() => { handleReset(); setMode("view"); if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page, viewDivisionId); }}
                />

                {/* Brand */}
                <div className={mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}>
                    <BrandSelect
                        brands={brands}
                        value={selectedBrand}
                        onValueChange={setSelectedBrand}
                        disabled={brands.length === 0 || loading}
                        highlightEmpty={mode === "new" && !selectedBrand}
                    />
                </div>

                {/* IGST — invisible in view mode */}
                <label className={`flex items-center gap-1.5 cursor-pointer select-none px-3 py-1.5 rounded-lg border-2 font-black text-[12px] uppercase tracking-[0.1em] transition-all shadow-sm ${
                    mode !== "new"
                        ? "hidden md:flex md:invisible pointer-events-none"
                        : isIgst
                        ? "bg-blue-400 text-white border-blue-600 shadow-blue-500/20"
                        : "bg-(--cl-surface-2) border-(--cl-border) text-(--cl-text-muted)"
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
                        mode !== "new"
                            ? "hidden md:flex md:invisible pointer-events-none"
                            : isReturn
                            ? "bg-orange-500 text-white border-orange-700 shadow-orange-500/20"
                            : "bg-(--cl-surface-2) border-(--cl-border) text-(--cl-text-muted)"
                    }`}
                >
                    <RotateCcw className="h-3 w-3" />
                    Return
                </button>

                {/* Reset · Save — invisible in view mode */}
                <div className={`flex items-center gap-2 ${mode !== "new" ? "hidden md:flex md:invisible pointer-events-none" : ""}`}>
                    <Button
                        className="h-8 gap-1.5 px-3 text-xs font-extrabold uppercase tracking-widest text-(--cl-text)"
                        disabled={form.formState.isSubmitting}
                        variant="ghost"
                        onClick={handleReset}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${form.formState.isSubmitting ? "animate-spin" : ""}`} />
                        Reset
                    </Button>
                    <Button
                        className="h-8 gap-1.5 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-extrabold uppercase tracking-widest transition-all disabled:opacity-30 disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={!canSave || form.formState.isSubmitting}
                        onClick={form.handleSubmit(executeSave)}
                    >
                        {form.formState.isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Invoice
                    </Button>
                </div>
            </div>

            {mode === "new" ? (
                <FormProvider {...form}>
                    <NewSalesInvoice
                        backCalcTarget={backCalcTarget}
                        backCalcApplied={backCalcApplied}
                        setBackCalcTarget={setBackCalcTarget}
                        onBackCalcApplied={markBackCalcApplied}
                        branchId={branchId}
                        isIgst={isIgst}
                        setIsIgst={setIsIgst}
                        isReturn={isReturn}
                        onIsReturnChange={setIsReturn}
                        onLinesValidChange={setLinesValid}
                        onDivisionChange={handleDivisionChange}
                        selectedBrandId={selectedBrandId}
                        brandName={brands.find(b => String(b.id) === selectedBrand)?.name}
                        editInvoice={editInvoice}
                        customerTypes={customerTypes}
                        masterStates={masterStates}
                        customerId={customerId}
                        setCustomerId={setCustomerId}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        customerGstin={customerGstin}
                        setCustomerGstin={setCustomerGstin}
                        customerStateCode={customerStateCode}
                        setCustomerStateCode={setCustomerStateCode}
                    />
                </FormProvider>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-(--cl-surface-2)/30">
                        <div className="flex items-center gap-1">
                            <LocaleDateInput
                                className="w-36"
                                disabled={loading}
                                value={fromDate}
                                onChange={handleFilterChange(setFromDate)}
                            />
                            <span className="text-(--cl-text-muted) text-xs">—</span>
                            <LocaleDateInput
                                className="w-36"
                                disabled={loading}
                                value={toDate}
                                onChange={handleFilterChange(setToDate)}
                            />
                        </div>
                        {availableDivisions.length > 0 && (
                            <select
                                className="h-8 cursor-pointer rounded-md border border-(--cl-border) bg-(--cl-surface) px-2 text-xs text-(--cl-text) focus:outline-none focus:ring-2 focus:ring-(--cl-accent)/30"
                                disabled={loading}
                                value={viewDivisionId ?? ""}
                                onChange={e => { setViewDivisionId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
                            >
                                <option value="">All Divisions</option>
                                {availableDivisions.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        )}
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--cl-text-muted)" />
                            <Input
                                className="h-8 border-(--cl-border) bg-(--cl-surface) pl-8 text-xs"
                                placeholder="Invoice or Customer…"
                                value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                            {search && (
                                <button
                                    className="absolute right-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-(--cl-text-muted) text-(--cl-surface) hover:bg-(--cl-text) focus:outline-none"
                                    type="button"
                                    onClick={() => handleSearchChange("")}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            )}
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
                                onClick={() => { if (branchId) void loadData(Number(branchId), fromDate, toDate, searchQ, page, viewDivisionId); }}
                            >
                                <RefreshCw className="mr-1.5 h-3 w-3" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-(--cl-border) bg-(--cl-surface) shadow-sm">
                        <div
                            ref={scrollWrapperRef}
                            className="flex-1 overflow-x-auto overflow-y-auto"
                            style={{ maxHeight: mode === "view" ? maxHeight : undefined }}
                        >
                            {loading ? (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-30">
                                        <tr className="bg-(--cl-surface-2)">
                                            <th className={thClass} style={{ width: "5%" }}>#</th>
                                            <th className={thClass} style={{ width: "10%" }}>Date</th>
                                            <th className={thClass} style={{ width: "14%" }}>Invoice No</th>
                                            <th className={thClass} style={{ width: "26%" }}>Customer</th>
                                            <th className={`${thClass} text-right`} style={{ width: "10%" }}>Aggregate</th>
                                            <th className={`${thClass} text-right`} style={{ width: "8%" }}>CGST</th>
                                            <th className={`${thClass} text-right`} style={{ width: "8%" }}>SGST</th>
                                            <th className={`${thClass} text-right`} style={{ width: "8%" }}>IGST</th>
                                            <th className={`${thClass} text-right`} style={{ width: "12%" }}>Total</th>
                                            <th className={`${thClass} text-center`} style={{ width: "11%" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: 15 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className={tdClass}><div className="h-4 w-4 rounded bg-(--cl-border)" /></td>
                                                <td className={tdClass}><div className="h-4 w-16 rounded bg-(--cl-border)" /></td>
                                                <td className={tdClass}><div className="h-4 w-24 rounded bg-(--cl-border)" /></td>
                                                <td className={tdClass}><div className="h-4 w-40 rounded bg-(--cl-border)" /></td>
                                                <td className={`${tdClass} text-right`}><div className="ml-auto h-4 w-16 rounded bg-(--cl-border)" /></td>
                                                <td className={`${tdClass} text-right`}><div className="ml-auto h-4 w-12 rounded bg-(--cl-border)" /></td>
                                                <td className={`${tdClass} text-right`}><div className="ml-auto h-4 w-12 rounded bg-(--cl-border)" /></td>
                                                <td className={`${tdClass} text-right`}><div className="ml-auto h-4 w-12 rounded bg-(--cl-border)" /></td>
                                                <td className={`${tdClass} text-right`}><div className="ml-auto h-4 w-20 rounded bg-(--cl-border)" /></td>
                                                <td className={tdClass}><div className="mx-auto h-4 w-8 rounded bg-(--cl-border)" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : invoices.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                                    No sales invoices found for the selected filters.
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr>
                                            <th className={thClass}>#</th>
                                            <th className={thClass}>Date</th>
                                            <th className={thClass}>Invoice No</th>
                                            <th className={thClass}>Customer</th>
                                            <th className={`${thClass} text-right`}>Aggregate</th>
                                            <th className={`${thClass} text-right`}>CGST</th>
                                            <th className={`${thClass} text-right`}>SGST</th>
                                            <th className={`${thClass} text-right`}>IGST</th>
                                            <th className={`${thClass} text-right`}>Total</th>
                                            <th className={`${thClass} sticky right-0 z-20 !bg-(--cl-surface-2)`}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--cl-border) bg-(--cl-surface)">
                                        {invoices.map((inv, idx) => (
                                            <tr key={inv.id} className="group transition-colors hover:bg-(--cl-accent)/5">
                                                <td className={`${tdClass} text-(--cl-text-muted)`} style={{ width: "5%" }}>
                                                    {(page - 1) * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className={tdClass} style={{ width: "10%" }}>{inv.invoice_date}</td>
                                                <td className={`${tdClass} font-mono font-medium`} style={{ width: "14%" }}>
                                                    {inv.invoice_no}
                                                    {inv.is_return && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-950/40 rounded px-1 py-0.5">RTN</span>
                                                    )}
                                                    {(postDataToAccounts || (showDivisionCode && divisionCodeById(inv.division_id))) && (
                                                        <div className="mt-0.5 flex items-center gap-1.5">
                                                            {postDataToAccounts && (
                                                                <span className={`text-[10px] font-semibold ${inv.is_posted ? "text-emerald-600" : "text-amber-600"}`}>
                                                                    {inv.is_posted ? "Posted" : "Not Posted"}
                                                                </span>
                                                            )}
                                                            {showDivisionCode && divisionCodeById(inv.division_id) && (
                                                                <span
                                                                    className="rounded bg-(--cl-accent)/10 px-1 py-0.5 text-[10px] font-bold text-(--cl-accent)"
                                                                    title={inv.division_name ?? undefined}
                                                                >
                                                                    {divisionCodeById(inv.division_id)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={tdClass} style={{ width: "26%" }}>{inv.customer_name}</td>
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
                                                <td className={`${tdClass} text-right font-medium text-(--cl-accent)`} style={{ width: "12%" }}>
                                                    {formatCurrency(inv.total_amount)}
                                                </td>
                                                <td className={`${tdClass} sticky right-0 z-10 bg-(--cl-surface) group-hover:bg-(--cl-surface-2)`} style={{ width: "11%" }}>
                                                    <div className="flex items-center justify-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    className="h-8 w-8 p-0 hover:bg-(--cl-accent)/15 transition-all duration-200"
                                                                    variant="ghost"
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Open menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-[160px] bg-white dark:bg-zinc-950 border-(--cl-border) shadow-[0_10px_30px_rgba(0,0,0,0.2)] z-50">
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-sky-500/20 focus:text-sky-400"
                                                                    onClick={() => setViewInvoice(inv)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    <span>View Details</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-sky-500/20 focus:text-sky-400"
                                                                    onClick={() => setPdfPreviewInvoice(inv)}
                                                                >
                                                                    <FileDown className="h-4 w-4" />
                                                                    <span>Invoice PDF</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="flex items-center gap-2 cursor-pointer focus:bg-emerald-500/20 focus:text-emerald-500"
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
                                                                    className={`flex items-center gap-2 cursor-pointer ${inv.is_posted ? "text-(--cl-text-muted) opacity-50 cursor-not-allowed" : "text-amber-500 focus:bg-amber-500/10 focus:text-amber-600"}`}
                                                                    onClick={() => {
                                                                        if (inv.is_posted) {
                                                                            toast.error("Posted invoices cannot be edited.");
                                                                            return;
                                                                        }
                                                                        setSelectedBrand(String(inv.brand_id ?? "")); setEditInvoice(inv); setMode("new");
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    <span>Edit Invoice</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className={`flex items-center gap-2 cursor-pointer font-semibold ${inv.is_posted ? "text-(--cl-text-muted) opacity-50 cursor-not-allowed" : "text-red-500 focus:bg-red-500/10 focus:text-red-600"}`}
                                                                    onClick={() => {
                                                                        if (inv.is_posted) {
                                                                            toast.error("Posted invoices cannot be deleted.");
                                                                            return;
                                                                        }
                                                                        setDeleteId(inv.id);
                                                                    }}
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
                                    <tfoot className="sticky bottom-0 z-10 bg-(--cl-surface-2) shadow-[0_-1px_0_var(--cl-border)] border-t border-t-(--cl-border)">
                                        <tr>
                                            <td className={tdClass} colSpan={4}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-(--cl-text-muted)">{total} invoices</span>
                                                    <span className="font-bold text-(--cl-text)">Total:</span>
                                                </div>
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-(--cl-text)`}>
                                                {formatCurrency(grandTotals.aggregate)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-(--cl-text)`}>
                                                {formatCurrency(grandTotals.cgst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-(--cl-text)`}>
                                                {formatCurrency(grandTotals.sgst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-(--cl-text)`}>
                                                {formatCurrency(grandTotals.igst)}
                                            </td>
                                            <td className={`${tdClass} text-right font-bold text-(--cl-accent) text-[13px]`}>
                                                {formatCurrency(grandTotals.total)}
                                            </td>
                                            <td className={`${tdClass} !bg-(--cl-surface-2)`}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-(--cl-border) px-4 py-2">
                            <span className="text-xs text-(--cl-text-muted)">
                                {total === 0 ? "No invoices" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} invoices (Page ${page} of ${totalPages})`}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    className="h-7 w-7"
                                    disabled={page <= 1 || loading}
                                    size="icon"
                                    title="First page"
                                    variant="ghost"
                                    onClick={() => setPage(1)}
                                >
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page <= 1 || loading}
                                    size="icon"
                                    title="Previous page"
                                    variant="ghost"
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page >= totalPages || loading}
                                    size="icon"
                                    title="Next page"
                                    variant="ghost"
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    className="h-7 w-7"
                                    disabled={page >= totalPages || loading}
                                    size="icon"
                                    title="Last page"
                                    variant="ghost"
                                    onClick={() => setPage(totalPages)}
                                >
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* View Dialog */}
                    <ViewSalesInvoiceDialog
                        invoice={viewInvoice}
                        open={viewInvoice !== null}
                        onOpenChange={open => { if (!open) setViewInvoice(null); }}
                        onShowPdf={inv => setPdfPreviewInvoice(inv)}
                    />

                    {/* PDF Preview Dialog */}
                    <SalesInvoicePdfPreviewDialog
                        division={pdfPreviewInvoice ? (availableDivisions.find(d => d.id === pdfPreviewInvoice.division_id) ?? currentDivision) : null}
                        invoice={pdfPreviewInvoice}
                        open={pdfPreviewInvoice !== null}
                        onOpenChange={open => { if (!open) setPdfPreviewInvoice(null); }}
                    />

                    {/* Delete Confirm Dialog */}
                    <Dialog
                        open={deleteId !== null}
                        onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}
                    >
                        <DialogContent aria-describedby={undefined} className="sm:max-w-sm !bg-white text-(--cl-text)">
                            <DialogHeader>
                                <DialogTitle>Delete Sales Invoice</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-(--cl-text-muted)">
                                This will permanently delete the invoice and all associated stock transactions.
                                This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button disabled={deleting} variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                                <Button disabled={deleting} variant="destructive" onClick={() => void handleDelete()}>
                                    {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
            {/* Diff Alert Dialog — outside mode ternary so it works in new/edit mode */}
            <Dialog open={diffAlertMsg !== null} onOpenChange={open => { if (!open) setDiffAlertMsg(null); }}>
                <DialogContent aria-describedby={undefined} className="sm:max-w-md !bg-white text-(--cl-text)">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600">Amount Difference Too Large</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-(--cl-text) leading-relaxed">{diffAlertMsg}</p>
                    <DialogFooter>
                        <Button className="cursor-pointer" onClick={() => setDiffAlertMsg(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};
