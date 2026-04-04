import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, X, PlusCircle, XCircle, CheckCircle2, Pencil, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseLineFormItem, StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { StateRow } from "./purchase-entry-section";

import { PartDialog } from "../../part-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartRow = {
    id:               number;
    brand_id:         number;
    part_code:        string;
    part_name:        string;
    part_description: string | null;
    category:         string | null;
    model:            string | null;
    uom:              string;
    cost_price:       number | null;
    mrp:              number | null;
    hsn_code:         string | null;
    gst_rate:         number | null;
    is_active:        boolean;
    brand_name:       string;
};

type GenericQueryData<T> = { genericQuery: T[] | null };
type CountRowType = { total: number };

const PART_PICK_PAGE_SIZE = 50;

type Props = {
    branchId: number | null;
    txnTypes: StockTransactionTypeRow[];
    vendors: VendorType[];
    states: StateRow[];
    onSuccess: () => void;
    onStatusChange: (status: { isValid: boolean; isSubmitting: boolean }) => void;
    isIgst: boolean;
    selectedBrandId: number | null;
    brandName?: string;
};

export type NewPurchaseInvoiceHandle = {
    submit: () => void;
    reset: () => void;
    isSubmitting: boolean;
    isValid: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyLine(brandId: number | null = null): PurchaseLineFormItem {
    return {
        _key: crypto.randomUUID(),
        part_id: null,
        brand_id: brandId,
        part_code: "",
        part_name: "",
        uom: "",
        hsn_code: "",
        quantity: 1,
        unit_price: 0,
        gst_rate: 0,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 0,
    };
}

function calcLine(l: PurchaseLineFormItem) {
    const taxable = l.quantity * l.unit_price;
    const cgstAmt = taxable * l.cgst_rate / 100;
    const sgstAmt = taxable * l.sgst_rate / 100;
    const igstAmt = taxable * l.igst_rate / 100;
    return { taxable, cgstAmt, sgstAmt, igstAmt, total: taxable + cgstAmt + sgstAmt + igstAmt };
}

function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-[11px] font-bold uppercase tracking-wider text-[var(--cl-text-muted)] py-1.5 px-2 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)] backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPurchaseInvoice = forwardRef<NewPurchaseInvoiceHandle, Props>(({
    branchId, txnTypes, vendors, states, onSuccess, onStatusChange, isIgst, selectedBrandId, brandName
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [vendorId, setVendorId] = useState<number>(0);
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [supplierStateCode, setSupplierStateCode] = useState("");
    const [remarks, setRemarks] = useState("");
    const [physicalTotal, setPhysicalTotal] = useState<number>(0);
    const [physicalQty, setPhysicalQty] = useState<number>(0);
    const [physicalCgst, setPhysicalCgst] = useState<number>(0);
    const [physicalSgst, setPhysicalSgst] = useState<number>(0);
    const [physicalIgst, setPhysicalIgst] = useState<number>(0);

    // Inline Part Creation
    const [addPartOpen, setAddPartOpen] = useState(false);
    const [addPartLineIdx, setAddPartLineIdx] = useState<number | null>(null);
    const [prefillPartCode, setPrefillPartCode] = useState("");

    // Line items
    const [lines, setLines] = useState<PurchaseLineFormItem[]>([emptyLine(selectedBrandId)]);

    // Duplicate check
    const [invoiceExists, setInvoiceExists] = useState(false);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    // Part search dialog
    const [partPickOpen,     setPartPickOpen]     = useState(false);
    const [partPickLine,     setPartPickLine]     = useState(-1);
    const [partCodeQuery,    setPartCodeQuery]    = useState("");
    const [partKeywordQuery, setPartKeywordQuery] = useState("");
    const [partSearchMode,   setPartSearchMode]   = useState<"code" | "keyword">("code");
    const [partResults,      setPartResults]      = useState<PartRow[]>([]);
    const [partLoading,      setPartLoading]      = useState(false);
    const [partPage,         setPartPage]         = useState(1);
    const [partTotal,        setPartTotal]        = useState(0);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    // Edit Part Dialog
    const [editPartOpen, setEditPartOpen] = useState(false);
    const [editPartData, setEditPartData] = useState<PartRow | null>(null);
    const [editPartLineIdx, setEditPartLineIdx] = useState<number | null>(null);

    const dupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const partDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const hsnInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Auto-fill supplier state code on vendor change
    useEffect(() => {
        if (!vendorId) {
            setSupplierStateCode("");
            return;
        }
        const vendor = vendors.find(v => v.id === vendorId);
        if (vendor?.gstin && vendor.gstin.length >= 2) {
            setSupplierStateCode(vendor.gstin.substring(0, 2));
        }
    }, [vendorId, vendors]);

    // Duplicate invoice check (debounced 600ms)
    useEffect(() => {
        if (!invoiceNo.trim() || !vendorId || !dbName || !schema) {
            setInvoiceExists(false);
            return;
        }
        if (dupDebounceRef.current) clearTimeout(dupDebounceRef.current);
        dupDebounceRef.current = setTimeout(async () => {
            setCheckingDuplicate(true);
            try {
                const res = await apolloClient.query<GenericQueryData<{ exists: boolean }>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId: SQL_MAP.CHECK_SUPPLIER_INVOICE_EXISTS,
                            sqlArgs: { supplier_id: vendorId, invoice_no: invoiceNo.trim() },
                        }),
                    },
                });
                setInvoiceExists(res.data?.genericQuery?.[0]?.exists ?? false);
            } catch {
                // silent — don't block the form on a check failure
            } finally {
                setCheckingDuplicate(false);
            }
        }, 600);
    }, [invoiceNo, vendorId, dbName, schema]);

    // Part search (debounced 1200ms) — runs for whichever input is active
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
                const sqlId      = partSearchMode === "code" ? SQL_MAP.GET_PARTS_BY_CODE_PREFIX       : SQL_MAP.GET_PARTS_BY_KEYWORD;
                const sqlCountId = partSearchMode === "code" ? SQL_MAP.GET_PARTS_BY_CODE_PREFIX_COUNT : SQL_MAP.GET_PARTS_BY_KEYWORD_COUNT;
                const offset     = (partPage - 1) * PART_PICK_PAGE_SIZE;
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

    // Typed search for part code (on blur or enter)
    const handleTypedPartSearch = async (idx: number, code: string, brandId?: number | null, focusQtyOnSuccess = false) => {
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
                        sqlArgs: { code: code.trim(), brand_id: brandId ?? null },
                    }),
                },
            });

            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                // Exactly one part found → auto-select
                handlePartSelectForIdx(idx, results[0]);
                if (focusQtyOnSuccess) {
                    setTimeout(() => hsnInputRefs.current[idx]?.focus(), 50);
                }
            } else if (results.length > 1) {
                // Multiple parts → open pick dialog pre-filled on Option 1
                if (partPickOpen) return;
                setPartPickLine(idx);
                setPartCodeQuery(code.trim());
                setPartKeywordQuery("");
                setPartSearchMode("code");
                setPartResults(results);
                setPartTotal(results.length);
                setPartPage(1);
                setPartPickOpen(true);
                // Validation "fails" to be unique -> return focus
                partInputRefs.current[idx]?.focus();
                partInputRefs.current[idx]?.select();
            } else {
                // No part found → open AddPartDialog
                if (partPickOpen) return;
                setAddPartLineIdx(idx);
                setPrefillPartCode(code.trim());
                setAddPartOpen(true);
                // Validation fails -> return focus
                partInputRefs.current[idx]?.focus();
                partInputRefs.current[idx]?.select();
            }
        } catch {
            partInputRefs.current[idx]?.focus();
            partInputRefs.current[idx]?.select();
        }
    };

    // Refactored handlePartSelect to accept an index (for auto-population)
    const handlePartSelectForIdx = (idx: number, part: PartRow) => {
        updateLine(idx, {
            part_id: part.id,
            brand_id: part.brand_id,
            part_code: part.part_code,
            part_name: part.part_name,
            uom: part.uom,
            hsn_code: part.hsn_code ?? "",
            unit_price: Number(part.cost_price ?? 0),
            gst_rate: Number(part.gst_rate ?? 0),
        });
        setPartPickOpen(false);
        setPartCodeQuery("");
        setPartKeywordQuery("");
        setPartResults([]);
    };

    // Fetch and open EditPartDialog for an existing part in a line
    const handleEditPart = async (idx: number, partCode: string, brandId: number | null) => {
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
                        sqlArgs: { code: partCode.trim(), brand_id: brandId ?? null },
                    }),
                },
            });

            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                setEditPartData(results[0]);
                setEditPartLineIdx(idx);
                setEditPartOpen(true);
            } else {
                toast.error("Could not retrieve part details. Please try searching again.");
            }
        } catch {
            toast.error("An error occurred while fetching part details.");
        }
    };

    // Original handlePartSelect for the generic pick dialog
    const handlePartSelect = (part: PartRow) => {
        handlePartSelectForIdx(partPickLine, part);
    };

    const openPartPick = (idx: number, prefillCode?: string) => {
        if (!selectedBrandId) {
            toast.warning("Please select a brand before searching parts.");
            return;
        }
        setPartPickLine(idx);
        setPartResults([]);
        setPartCodeQuery(prefillCode?.trim() ?? "");
        setPartKeywordQuery("");
        setPartSearchMode("code");
        setPartPickOpen(true);
    };

    // Line mutations
    const updateLine = (idx: number, patch: Partial<PurchaseLineFormItem>) => {
        setLines(prev => prev.map((l, i) => {
            if (i !== idx) return l;
            const next = { ...l, ...patch };
            if ("gst_rate" in patch) {
                if (isIgst) {
                    next.igst_rate = next.gst_rate;
                    next.cgst_rate = 0;
                    next.sgst_rate = 0;
                } else {
                    next.igst_rate = 0;
                    next.cgst_rate = next.gst_rate / 2;
                    next.sgst_rate = next.gst_rate / 2;
                }
            }
            return next;
        }));
    };

    // Effect to update all lines when isIgst changes
    useEffect(() => {
        setLines(prev => prev.map(l => {
            if (isIgst) {
                return { ...l, igst_rate: l.gst_rate, cgst_rate: 0, sgst_rate: 0 };
            } else {
                return { ...l, igst_rate: 0, cgst_rate: l.gst_rate / 2, sgst_rate: l.gst_rate / 2 };
            }
        }));
    }, [isIgst]);

    const insertLine = (idx: number) => {
        setLines(prev => {
            const next = [...prev];
            next.splice(idx + 1, 0, emptyLine(selectedBrandId));
            return next;
        });
    };

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    // Totals
    const totals = useMemo(() => {
        let quantity = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
        for (const l of lines) {
            const c = calcLine(l);
            quantity += l.quantity;
            taxable += c.taxable;
            cgst += c.cgstAmt;
            sgst += c.sgstAmt;
            igst += c.igstAmt;
        }
        return { quantity, taxable, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: taxable + cgst + sgst + igst };
    }, [lines]);

    const physicalValidation = useMemo(() => {
        const check = (p: number, c: number, pct: number, minAbs?: number) => {
            const diff = Math.abs(p - c);
            const threshold = (pct / 100) * c;
            const allowed = minAbs !== undefined ? Math.max(threshold, minAbs) : threshold;
            return { isValid: diff <= allowed + 0.0001, diff }; // small epsilon for float
        };

        const taxPct = 0.02; // 0.02%
        const taxMin = 0.20; // 0.20 paisa/rupee
        const totalPct = 0.1; // 0.1%

        const cgstRes = isIgst ? { isValid: true, diff: 0 } : check(physicalCgst, totals.cgst, taxPct, taxMin);
        const sgstRes = isIgst ? { isValid: true, diff: 0 } : check(physicalSgst, totals.sgst, taxPct, taxMin);
        const igstRes = !isIgst ? { isValid: true, diff: 0 } : check(physicalIgst, totals.igst, taxPct, taxMin);
        const totalRes = check(physicalTotal, totals.total, totalPct);
        const qtyRes = {
            isValid: Math.abs(physicalQty - totals.quantity) < 0.001,
            diff: Math.abs(physicalQty - totals.quantity)
        };

        const allValid = qtyRes.isValid && cgstRes.isValid && sgstRes.isValid && igstRes.isValid && totalRes.isValid;

        return {
            cgst: cgstRes,
            sgst: sgstRes,
            igst: igstRes,
            total: totalRes,
            qty: qtyRes,
            allValid
        };
    }, [isIgst, physicalQty, physicalCgst, physicalSgst, physicalIgst, physicalTotal, totals]);

    const isFormValid = useMemo(() => {
        // 1. Header Validation: Brand, Supplier, Invoice No, Date, State
        const headerValid =
            !!selectedBrandId &&
            vendorId > 0 &&
            !!invoiceNo.trim() &&
            !!invoiceDate &&
            !!supplierStateCode &&
            !invoiceExists &&
            !checkingDuplicate;

        if (!headerValid) return false;

        // 2. Lines Validation: At least one line, each with Part and Qty > 0
        if (lines.length === 0) return false;

        const allLinesValid = lines.every(l => {
            // Basic required fields
            const basicValid = !!l.part_id && l.quantity > 0;
            if (!basicValid) return false;

            // Conditional HSN: mandatory if GST is applicable (taxable item)
            // GST is applicable if unit_price > 0 OR gst_rate > 0
            const isGstApplicable = l.unit_price > 0 || l.gst_rate > 0;
            if (isGstApplicable && !l.hsn_code.trim()) return false;

            return true;
        });

        if (!allLinesValid) return false;

        // 3. Optional: Ensure physical totals match if specified?
        // Let's include physicalValidation if the user has entered some totals
        // Actually, let's keep it strict if physical totals are part of their mandate
        if (!physicalValidation.allValid) return false;

        return true;
    }, [selectedBrandId, vendorId, invoiceNo, invoiceDate, supplierStateCode, invoiceExists, checkingDuplicate, lines, physicalValidation.allValid]);

    // Reset
    const handleReset = () => {
        setVendorId(0);
        setInvoiceNo("");
        setInvoiceDate(today());
        setSupplierStateCode("");
        setRemarks("");
        setPhysicalTotal(0);
        setPhysicalQty(0);
        setPhysicalCgst(0);
        setPhysicalSgst(0);
        setPhysicalIgst(0);
        setLines([emptyLine(selectedBrandId)]);
        setInvoiceExists(false);
    };

    // Submit
    const handleSubmit = async () => {
        if (!branchId) {
            toast.error("Branch is not selected globally.");
            return;
        }
        if (!vendorId) {
            toast.error(MESSAGES.ERROR_PURCHASE_SUPPLIER_REQUIRED);
            return;
        }
        if (!invoiceNo.trim()) {
            toast.error(MESSAGES.ERROR_PURCHASE_INVOICE_NO_REQUIRED);
            return;
        }
        if (!invoiceDate) {
            toast.error(MESSAGES.ERROR_PURCHASE_DATE_REQUIRED);
            return;
        }
        if (lines.length === 0 || lines.some(l => {
            const basicNotReady = !l.part_id || l.quantity <= 0;
            if (basicNotReady) return true;
            const isGstApplicable = l.unit_price > 0 || l.gst_rate > 0;
            if (isGstApplicable && !l.hsn_code.trim()) return true;
            return false;
        })) {
            toast.error("Please fill all mandatory line fields (Part, Qty, and HSN for taxable items).");
            return;
        }
        if (invoiceExists) {
            toast.error(MESSAGES.ERROR_PURCHASE_INVOICE_EXISTS);
            return;
        }

        const purchaseTypeId = txnTypes.find(t => t.code === "PURCHASE")?.id;
        if (!purchaseTypeId) {
            toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
            return;
        }

        const payload = graphQlUtils.buildGenericUpdateValue({
            tableName: "purchase_invoice",
            xData: {
                branch_id: branchId,
                supplier_id: vendorId,
                invoice_no: invoiceNo.trim(),
                invoice_date: invoiceDate,
                supplier_state_code: supplierStateCode,
                aggregate_amount: totals.taxable,
                cgst_amount: totals.cgst,
                sgst_amount: totals.sgst,
                igst_amount: totals.igst,
                total_tax: totals.total_tax,
                total_amount: totals.total,
                total_physical: physicalTotal,
                remarks: remarks.trim() || null,
                xDetails: {
                    tableName: "purchase_invoice_line",
                    fkeyName: "purchase_invoice_id",
                    xData: lines.map(line => {
                        const c = calcLine(line);
                        return {
                            part_id: line.part_id,
                            hsn_code: line.hsn_code,
                            quantity: line.quantity,
                            unit_price: line.unit_price,
                            aggregate_amount: c.taxable,
                            cgst_rate: line.cgst_rate,
                            cgst_amount: c.cgstAmt,
                            sgst_rate: line.sgst_rate,
                            sgst_amount: c.sgstAmt,
                            igst_rate: line.igst_rate,
                            igst_amount: c.igstAmt,
                            total_amount: c.total,
                            xDetails: {
                                tableName: "stock_transaction",
                                fkeyName: "purchase_line_id",
                                xData: [{
                                    branch_id: branchId,
                                    part_id: line.part_id,
                                    qty: line.quantity,
                                    unit_cost: line.unit_price,
                                    dr_cr: "D",
                                    transaction_date: invoiceDate,
                                    stock_transaction_type_id: purchaseTypeId,
                                }],
                            },
                        };
                    }),
                },
            },
        });

        setSubmitting(true);
        try {
            await apolloClient.mutate({
                mutation: GRAPHQL_MAP.genericUpdate,
                variables: { db_name: dbName, schema, value: payload },
            });
            toast.success(MESSAGES.SUCCESS_PURCHASE_CREATED);
            onSuccess();
        } catch {
            toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    // Sync status with parent
    useEffect(() => {
        onStatusChange({ isValid: isFormValid, isSubmitting: submitting });
    }, [isFormValid, submitting, onStatusChange]);

    // Expose actions to parent
    useImperativeHandle(ref, () => ({
        submit: () => { void handleSubmit(); },
        reset: handleReset,
        isSubmitting: submitting,
        isValid: isFormValid,
    }), [handleSubmit, handleReset, submitting, isFormValid]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-2 pb-2"
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--cl-surface-2)]/30 rounded-xl border-2 border-dashed border-[var(--cl-border)] text-center">
                    <div className="bg-[var(--cl-accent)]/5 p-5 rounded-full mb-4">
                        <Plus className="h-12 w-12 text-[var(--cl-accent)] opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--cl-text)] mb-2">No Branch Selected</h3>
                    <p className="text-[var(--cl-text-muted)] max-w-md px-6">
                        Please select a target branch from the global header to start recording a new purchase invoice.
                    </p>
                </div>
            ) : (
                <>
                    {/* Remainder of the form... */}
                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm !overflow-visible">
                        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-x-2 gap-y-2 !overflow-visible">
                            {/* Vendor */}
                            <SearchableCombobox
                                className="lg:col-span-3"
                                isError={!vendorId}
                                label={<span>Supplier <span className="text-red-500 ml-0.5">*</span></span>}
                                placeholder="Search supplier..."
                                selectedValue={String(vendorId || "")}
                                onSelect={v => setVendorId(v?.id ?? 0)}
                                items={vendors.filter(v => v.is_active)}
                                getFilterKey={v => v.name}
                                getDisplayValue={v => v.name}
                                getIdentifier={v => String(v.id)}
                                renderItem={v => (
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{v.name}</span>
                                        {v.city && <span className="text-[10px] opacity-70 uppercase tracking-tight">{v.city} · {v.state_name}</span>}
                                    </div>
                                )}
                            />

                            {/* Invoice No */}
                            <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-semibold text-[var(--cl-text-muted)] uppercase tracking-wider">Invoice No <span className="text-red-500 ml-0.5">*</span></Label>
                                <div className="relative">
                                    <Input
                                        className={`bg-[var(--cl-surface-2)] pr-8 ${(!invoiceNo.trim() || invoiceExists) ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                        placeholder="Invoice #"
                                        value={invoiceNo}
                                        onChange={e => setInvoiceNo(e.target.value)}
                                    />
                                    {checkingDuplicate && (
                                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--cl-text-muted)]" />
                                    )}
                                </div>
                                {invoiceExists && (
                                    <p className="text-xs text-red-500 mt-1.5 font-medium">Already exists</p>
                                )}
                            </div>

                            {/* Invoice Date */}
                            <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-semibold text-[var(--cl-text-muted)] uppercase tracking-wider">Inv Date <span className="text-red-500 ml-0.5">*</span></Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                    value={invoiceDate}
                                    onChange={e => setInvoiceDate(e.target.value)}
                                />
                            </div>

                            <SearchableCombobox
                                className="lg:col-span-2"
                                isError={!supplierStateCode}
                                label={<span>State <span className="text-red-500 ml-0.5">*</span></span>}
                                placeholder="Select state..."
                                selectedValue={supplierStateCode}
                                onSelect={s => setSupplierStateCode(s?.gst_state_code ?? "")}
                                items={states}
                                getFilterKey={s => `${s.gst_state_code} ${s.name}`}
                                getDisplayValue={s => `${s.gst_state_code} — ${s.name}`}
                                renderItem={s => (
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[10px] font-bold text-[var(--cl-accent)]">
                                            {s.gst_state_code}
                                        </span>
                                        <span className="truncate font-medium">{s.name}</span>
                                    </div>
                                )}
                            />

                            {/* Remarks */}
                            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-semibold text-[var(--cl-text-muted)] uppercase tracking-wider">Remarks</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional..."
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-sm flex flex-col min-h-0 relative !overflow-visible">
                        <div className="overflow-x-auto w-full !overflow-visible">
                            <table className="min-w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "3%" }}>#</th>
                                        <th className={thClass} style={{ width: "18%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "8%" }}>HSN (if GST)</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "8%" }}>Price</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Aggregate</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>GST(%)</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>CGST</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>SGST</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>IGST</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Total</th>
                                        <th className={`${thClass} text-left`} style={{ width: "9%" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => {
                                        const c = calcLine(line);
                                        return (
                                            <tr key={line._key} className="hover:bg-[var(--cl-surface-2)]/30 group transition-colors">
                                                <td className={`${tdClass} pl-4 text-xs font-medium text-[var(--cl-text-muted)]`}>{idx + 1}</td>

                                                {/* Part */}
                                                <td className={tdClass}>
                                                    <div className="flex flex-col gap-0.5 px-1.5 py-1">
                                                        <div className="relative group/part">
                                                            <button
                                                                type="button"
                                                                tabIndex={-1}
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => openPartPick(idx, line.part_code || undefined)}
                                                                className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] shadow-sm transition-all focus:ring-2 focus:ring-[var(--cl-accent)]/20 cursor-pointer z-10"
                                                                title="Browse all parts"
                                                            >
                                                                <Search className="h-3.5 w-3.5" />
                                                            </button>
                                                            <Input
                                                                ref={el => { partInputRefs.current[idx] = el; }}
                                                                className={`${inputCls} font-mono w-full pl-9 pr-14 border-transparent hover:border-[var(--cl-border)] focus:border-[var(--cl-accent)] focus:bg-[var(--cl-surface)] transition-all ${line.part_id ? "bg-[var(--cl-accent)]/5 border-[var(--cl-accent)]/20 text-[var(--cl-accent)] font-bold" : "border-red-500 focus:border-red-500 ring-red-500/10 bg-transparent"}`}
                                                                placeholder="Part Code"
                                                                value={line.part_code}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    const patch: Partial<PurchaseLineFormItem> = { part_code: val };
                                                                    if (!val.trim()) {
                                                                        patch.part_id = null;
                                                                        patch.part_name = "";
                                                                    }
                                                                    updateLine(idx, patch);
                                                                }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') void handleTypedPartSearch(idx, line.part_code, line.brand_id || selectedBrandId);
                                                                    if (e.key === 'Tab') {
                                                                        e.preventDefault();
                                                                        void handleTypedPartSearch(idx, line.part_code, line.brand_id || selectedBrandId, true);
                                                                    }
                                                                }}
                                                                onBlur={() => {
                                                                    if (line.part_code.trim()) void handleTypedPartSearch(idx, line.part_code, line.brand_id || selectedBrandId);
                                                                }}
                                                            />
                                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                                {line.part_code && (
                                                                    <button
                                                                        type="button"
                                                                        tabIndex={-1}
                                                                        onClick={() => {
                                                                            updateLine(idx, { part_code: "", part_id: null, part_name: "" });
                                                                        }}
                                                                        className="rounded-md p-1 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer"
                                                                        title="Clear search"
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
                                                                {line.part_id ? (
                                                                    <button
                                                                        type="button"
                                                                        tabIndex={-1}
                                                                        onClick={() => void handleEditPart(idx, line.part_code, line.brand_id || selectedBrandId)}
                                                                        className="rounded-md p-1 bg-amber-500 text-white hover:bg-amber-500/10 hover:text-amber-600 shadow-sm transition-all focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                                                                        title="Edit part details"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        tabIndex={-1}
                                                                        onClick={() => {
                                                                            if (partPickOpen) return;
                                                                            setAddPartLineIdx(idx);
                                                                            setPrefillPartCode(line.part_code.trim());
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
                                                        {line.part_id && line.part_name && (
                                                            <div className="flex items-center px-1 overflow-hidden h-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <span className="truncate text-[10px] font-bold text-[var(--cl-accent)]/70 tracking-tight" title={line.part_name}>{line.part_name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* HSN */}
                                                <td className={tdClass}>
                                                    <Input
                                                        ref={el => { hsnInputRefs.current[idx] = el; }}
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] ${(line.unit_price > 0 || line.gst_rate > 0) && !line.hsn_code.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                        placeholder="HSN"
                                                        value={line.hsn_code}
                                                        onChange={e => updateLine(idx, { hsn_code: e.target.value })}
                                                    />
                                                </td>

                                                {/* Qty */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right ${line.quantity <= 0 ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.quantity}
                                                        onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* Price */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right font-medium`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.unit_price}
                                                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* Aggregate (read-only) */}
                                                <td className={`${tdClass} p-2 text-right text-sm text-[var(--cl-text)]`}>
                                                    {formatNumber(c.taxable)}
                                                </td>

                                                {/* GST(%) */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right font-semibold text-[var(--cl-accent)]`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.gst_rate}
                                                        onChange={e => updateLine(idx, { gst_rate: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* CGST Amt (read-only) */}
                                                <td className={`${tdClass} p-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums`}>
                                                    {isIgst ? "—" : formatNumber(c.cgstAmt)}
                                                </td>

                                                {/* SGST Amt (read-only) */}
                                                <td className={`${tdClass} p-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums`}>
                                                    {isIgst ? "—" : formatNumber(c.sgstAmt)}
                                                </td>

                                                {/* IGST Amt (read-only) */}
                                                <td className={`${tdClass} p-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums`}>
                                                    {isIgst ? formatNumber(c.igstAmt) : "—"}
                                                </td>

                                                {/* Total (read-only) */}
                                                <td className={`${tdClass} p-2 text-right text-sm font-semibold text-[var(--cl-text)] tabular-nums`}>
                                                    {formatNumber(c.total)}
                                                </td>

                                                {/* Actions */}
                                                <td className={`${tdClass} text-left`}>
                                                    <div className="flex items-center justify-start gap-0.5 px-2">
                                                        <button
                                                            type="button"
                                                            className="cursor-pointer text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/10 hover:scale-110 active:scale-95 transition-all p-1.5 rounded-full"
                                                            onClick={() => insertLine(idx)}
                                                            title="Add row below"
                                                        >
                                                            <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:scale-110 active:scale-95 transition-all p-1.5 rounded-full disabled:opacity-20 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-transparent"
                                                            disabled={lines.length === 1}
                                                            onClick={() => removeLine(idx)}
                                                            title="Remove line"
                                                        >
                                                            <XCircle className="h-7 w-7" strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-[var(--cl-surface-2)]/20 font-bold">
                                    <tr className="border-t-2 border-[var(--cl-border)]">
                                        <td className="py-2 px-4 text-xs uppercase tracking-wider text-[var(--cl-text-muted)]" colSpan={3}>Totals</td>
                                        <td className="py-2 px-2 text-right text-sm text-[var(--cl-text)] font-semibold tabular-nums">
                                            {formatNumber(totals.quantity)}
                                        </td>
                                        <td colSpan={3}></td>
                                        <td className="py-2 px-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums">
                                            {isIgst ? "—" : formatNumber(totals.cgst)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums">
                                            {isIgst ? "—" : formatNumber(totals.sgst)}
                                        </td>
                                        <td className="py-2 px-2 text-right text-sm text-[var(--cl-text-muted)] tabular-nums">
                                            {isIgst ? formatNumber(totals.igst) : "—"}
                                        </td>
                                        <td className="py-2 px-2 text-right text-sm text-[var(--cl-accent)] font-bold tabular-nums">
                                            {formatNumber(totals.total)}
                                        </td>
                                        <td className="w-28"></td>
                                    </tr>
                                    <tr className="bg-[var(--cl-accent)]/10 border-y border-[var(--cl-accent)]/20 transition-all">
                                        <td colSpan={3} className="py-3 px-4 text-right align-middle">
                                            <div className="flex items-center justify-end gap-2">
                                                {physicalValidation.allValid ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500 transition-all scale-110" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-400 opacity-60 transition-all translate-x-[-1px]" />
                                                )}
                                                <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${physicalValidation.allValid ? "text-green-600" : "text-red-500"}`}>
                                                    Physical Invoice Check
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-0 border-x border-dashed border-[var(--cl-border)] transition-all">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={physicalQty}
                                                onChange={(e) => setPhysicalQty(Number(e.target.value))}
                                                className={`h-11 w-full text-right px-2 rounded-none border-none tabular-nums transition-all focus:bg-[var(--cl-accent)]/5 focus:ring-0 ${!physicalValidation.qty.isValid ? "bg-red-500/10 text-red-600 font-bold" : "bg-transparent text-[var(--cl-text)]"}`}
                                                placeholder="0"
                                                onFocus={e => {
                                                    const target = e.target;
                                                    setTimeout(() => (target as HTMLInputElement).select(), 0);
                                                }}
                                            />
                                        </td>
                                        <td colSpan={3} className="text-right py-3 px-2 align-middle">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--cl-text-muted)] opacity-40">Entry Column Match</span>
                                        </td>
                                        <td className="p-0 border-x border-dashed border-[var(--cl-border)] transition-all">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={physicalCgst}
                                                onChange={(e) => setPhysicalCgst(Number(e.target.value))}
                                                className={`h-11 w-full text-right px-2 rounded-none border-none tabular-nums transition-all focus:bg-[var(--cl-accent)]/5 focus:ring-0 ${!physicalValidation.cgst.isValid ? "bg-red-500/10 text-red-600 font-bold" : "bg-transparent text-[var(--cl-text)]"}`}
                                                disabled={isIgst}
                                                placeholder="0.00"
                                                onFocus={e => {
                                                    const target = e.target;
                                                    setTimeout(() => (target as HTMLInputElement).select(), 0);
                                                }}
                                            />
                                        </td>
                                        <td className="p-0 border-r border-dashed border-[var(--cl-border)] transition-all">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={physicalSgst}
                                                onChange={(e) => setPhysicalSgst(Number(e.target.value))}
                                                className={`h-11 w-full text-right px-2 rounded-none border-none tabular-nums transition-all focus:bg-[var(--cl-accent)]/5 focus:ring-0 ${!physicalValidation.sgst.isValid ? "bg-red-500/10 text-red-600 font-bold" : "bg-transparent text-[var(--cl-text)]"}`}
                                                disabled={isIgst}
                                                placeholder="0.00"
                                                onFocus={e => {
                                                    const target = e.target;
                                                    setTimeout(() => (target as HTMLInputElement).select(), 0);
                                                }}
                                            />
                                        </td>
                                        <td className="p-0 border-r border-dashed border-[var(--cl-border)] transition-all">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={physicalIgst}
                                                onChange={(e) => setPhysicalIgst(Number(e.target.value))}
                                                className={`h-11 w-full text-right px-2 rounded-none border-none tabular-nums transition-all focus:bg-[var(--cl-accent)]/5 focus:ring-0 ${!physicalValidation.igst.isValid ? "bg-red-500/10 text-red-600 font-bold" : "bg-transparent text-[var(--cl-text)]"}`}
                                                disabled={!isIgst}
                                                placeholder="0.00"
                                                onFocus={e => {
                                                    const target = e.target;
                                                    setTimeout(() => (target as HTMLInputElement).select(), 0);
                                                }}
                                            />
                                        </td>
                                        <td className="p-0 border-r border-dashed border-[var(--cl-border)] transition-all">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={physicalTotal}
                                                onChange={(e) => setPhysicalTotal(Number(e.target.value))}
                                                className={`h-11 w-full text-right px-2 rounded-none border-none tabular-nums font-bold transition-all focus:bg-[var(--cl-accent)]/5 focus:ring-0 ${!physicalValidation.total.isValid ? "bg-red-500/10 text-red-600" : "bg-transparent text-[var(--cl-accent)]"}`}
                                                placeholder="0.00"
                                                onFocus={e => {
                                                    const target = e.target;
                                                    setTimeout(() => (target as HTMLInputElement).select(), 0);
                                                }}
                                            />
                                        </td>
                                        <td className="w-28 border-t border-dashed border-[var(--cl-border)]"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {lines.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>


                    {/* Part Pick Dialog */}
                    <Dialog
                        open={partPickOpen}
                        onOpenChange={open => {
                            if (!open) {
                                setPartPickOpen(false); setPartCodeQuery(""); setPartKeywordQuery(""); setPartResults([]); setPartSearchMode("code"); setPartPage(1); setPartTotal(0);
                                if (partPickLine !== -1) {
                                setTimeout(() => {
                                    partInputRefs.current[partPickLine]?.focus();
                                    partInputRefs.current[partPickLine]?.select();
                                }, 120);
                            }
                        }
                    }}
                >
                    <DialogContent onCloseAutoFocus={(e) => e.preventDefault()} className="sm:max-w-lg bg-white text-black border-[var(--cl-border)] shadow-2xl opacity-100">
                            {/* Header — plain div avoids Radix focus-trap interference */}
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
                                            onClick={() => handlePartSelect(part)}
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
                </>
            )}

            <PartDialog
                mode="add"
                onOpenChange={open => {
                    if (!open) {
                        const lastIdx = addPartLineIdx;
                        setAddPartOpen(false);
                        setAddPartLineIdx(null); // Clear after capture
                        if (lastIdx !== null) {
                            setTimeout(() => {
                                partInputRefs.current[lastIdx]?.focus();
                                partInputRefs.current[lastIdx]?.select();
                            }, 120);
                        }
                    } else {
                        setAddPartOpen(true);
                    }
                }}
                onSuccess={() => {
                    if (addPartLineIdx !== null) {
                        void handleTypedPartSearch(addPartLineIdx, prefillPartCode, selectedBrandId);
                    }
                }}
                open={addPartOpen}
                prefillCode={prefillPartCode}
                defaultBrandId={selectedBrandId ?? 0}
                brandName={brandName ?? ""}
            />

            {editPartData && (
                <PartDialog
                    mode="edit"
                    open={editPartOpen}
                    part={editPartData}
                    defaultBrandId={selectedBrandId ?? 0}
                    brandName={brandName ?? ""}
                    onOpenChange={(o) => {
                        if (!o) {
                            const lastIdx = editPartLineIdx;
                            setEditPartOpen(false);
                            setEditPartData(null);
                            setEditPartLineIdx(null);
                            if (lastIdx !== null) {
                                setTimeout(() => {
                                    partInputRefs.current[lastIdx]?.focus();
                                    partInputRefs.current[lastIdx]?.select();
                                }, 120);
                            }
                        } else {
                            setEditPartOpen(true);
                        }
                    }}
                    onSuccess={() => {
                        if (editPartLineIdx !== null && editPartData) {
                            void handleTypedPartSearch(editPartLineIdx, editPartData.part_code, editPartData.brand_id);
                        }
                        setEditPartOpen(false);
                    }}
                />
            )}
        </motion.div>
    );
});
