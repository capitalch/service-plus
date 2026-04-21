import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { LineAddDeleteActions } from "../line-add-delete-actions";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
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
import { selectEffectiveGstStateCode, selectDefaultGstRate, selectIsGstRegistered, selectSchema } from "@/store/context-slice";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseLineFormItem, StockTransactionTypeRow } from "@/features/client/types/purchase";

import { PartCodeInput } from "../part-code-input";
import { MasterDataDiffModal } from "./master-data-diff-modal";
import { PhysicalInvoiceModal } from "./physical-invoice-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId: number | null;
    brandName?: string;
    editInvoice?: import("@/features/client/types/purchase").PurchaseInvoiceType | null;
    isIgst: boolean;
    isReturn: boolean;
    onIsIgstChange: (v: boolean) => void;
    onIsReturnChange: (v: boolean) => void;
    onStatusChange: (status: { isSubmitting: boolean; isValid: boolean }) => void;
    onSuccess: () => void;
    selectedBrandId: number | null;
    txnTypes: StockTransactionTypeRow[];
    vendors: VendorType[];
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
        under_warranty: false,
        remarks: "",
        _orig_hsn_code:   null,
        _orig_cost_price: null,
        _orig_gst_rate:   null,
    };
}

function calcLine(l: PurchaseLineFormItem) {
    const aggregate = l.quantity * l.unit_price;
    const cgstAmt = aggregate * l.cgst_rate / 100;
    const sgstAmt = aggregate * l.sgst_rate / 100;
    const igstAmt = aggregate * l.igst_rate / 100;
    return { aggregate, cgstAmt, sgstAmt, igstAmt, total: aggregate + cgstAmt + sgstAmt + igstAmt };
}

function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPurchaseInvoice = forwardRef<NewPurchaseInvoiceHandle, Props>(({
    branchId, brandName, editInvoice, isIgst, isReturn, onIsIgstChange, onIsReturnChange, onStatusChange, onSuccess, selectedBrandId, txnTypes, vendors,
}, ref) => {
    const dbName                = useAppSelector(selectDbName);
    const schema                = useAppSelector(selectSchema);
    const isGstRegistered       = useAppSelector(selectIsGstRegistered);
    const defaultGstRate        = useAppSelector(selectDefaultGstRate);
    const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);

    // Header fields
    const [vendorId, setVendorId] = useState<number>(0);
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [remarks, setRemarks] = useState("");
    const [physicalTotal, setPhysicalTotal] = useState<number>(0);
    const [physicalQty, setPhysicalQty] = useState<number>(0);
    const [physicalCgst, setPhysicalCgst] = useState<number>(0);
    const [physicalSgst, setPhysicalSgst] = useState<number>(0);
    const [physicalIgst, setPhysicalIgst] = useState<number>(0);


    // Line items
    const [lines, setLines] = useState<PurchaseLineFormItem[]>([emptyLine(selectedBrandId)]);

    // Edit mode: original line IDs to delete on update
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Duplicate check
    const [invoiceExists, setInvoiceExists] = useState(false);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    // Physical invoice check modal
    const [showPhysicalCheckModal, setShowPhysicalCheckModal] = useState(false);

    // Master data diff confirmation
    const [masterDiffLines, setMasterDiffLines] = useState<PurchaseLineFormItem[]>([]);

    const dupDebounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const partInputRefs    = useRef<(HTMLInputElement | null)[]>([]);
    const hsnInputRefs     = useRef<(HTMLInputElement | null)[]>([]);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const summaryRef       = useRef<HTMLDivElement>(null);

    const [maxTableHeight, setMaxTableHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        function recalc() {
            const el = scrollWrapperRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top;
            const summaryHeight = summaryRef.current?.getBoundingClientRect().height ?? 0;
            // 14px = clearance from ClientLayout; 8px = gap between table and summary
            setMaxTableHeight(window.innerHeight - top - summaryHeight - 8 - 14);
        }
        recalc();
        window.addEventListener('resize', recalc);
        return () => window.removeEventListener('resize', recalc);
    }, []);

    // Auto-detect IGST on vendor change
    useEffect(() => {
        if (!vendorId || editInvoice) return;
        const vendor = vendors.find(v => v.id === vendorId);
        const vendorStateCode = vendor?.gst_state_code
            ?? (vendor?.gstin && vendor.gstin.length >= 2 ? vendor.gstin.substring(0, 2) : null);
        if (vendorStateCode && effectiveGstStateCode) {
            onIsIgstChange(vendorStateCode !== effectiveGstStateCode);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendorId, vendors, effectiveGstStateCode, editInvoice]);

    // Populate form when editInvoice changes
    useEffect(() => {
        if (!editInvoice) {
            handleReset();
            setOriginalLineIds([]);
            return;
        }
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<import("@/features/client/types/purchase").PurchaseInvoiceType & { lines: import("@/features/client/types/purchase").PurchaseLineType[] }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                    sqlArgs: { id: editInvoice.id },
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            setVendorId(detail.supplier_id);
            setInvoiceNo(detail.invoice_no);
            setInvoiceDate(detail.invoice_date);
            setRemarks(detail.remarks ?? "");
            onIsReturnChange(Boolean(detail.is_return));
            setPhysicalTotal(0);
            setPhysicalQty(0);
            setPhysicalCgst(0);
            setPhysicalSgst(0);
            setPhysicalIgst(0);
            setInvoiceExists(false);
            const loadedLines = (detail.lines ?? []).map(l => ({
                _key: crypto.randomUUID(),
                part_id: l.part_id,
                brand_id: selectedBrandId,
                part_code: l.part_code,
                part_name: l.part_name,
                uom: "",
                hsn_code: l.hsn_code,
                quantity: Number(l.quantity),
                unit_price: Number(l.unit_price),
                gst_rate:  Number(l.gst_rate),
                cgst_rate: l.igst_amount > 0 ? 0 : Number(l.gst_rate) / 2,
                sgst_rate: l.igst_amount > 0 ? 0 : Number(l.gst_rate) / 2,
                igst_rate: l.igst_amount > 0 ? Number(l.gst_rate) : 0,
                under_warranty: Boolean(l.under_warranty),
                remarks: l.remarks ?? "",
                _orig_hsn_code:   l.hsn_code,
                _orig_cost_price: Number(l.unit_price),
                _orig_gst_rate:   Number(l.gst_rate),
            }));
            setLines(loadedLines);
            setOriginalLineIds((detail.lines ?? []).map(l => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_PURCHASE_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editInvoice, dbName, schema]);

    // Duplicate invoice check (debounced 600ms)
    useEffect(() => {
        if (!invoiceNo.trim() || !vendorId || !dbName || !schema) {
            setInvoiceExists(false);
            return;
        }
        // In edit mode: skip check if supplier + invoice_no are unchanged
        if (editInvoice && vendorId === editInvoice.supplier_id && invoiceNo.trim() === editInvoice.invoice_no) {
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
                            sqlId: editInvoice
                                ? SQL_MAP.CHECK_SUPPLIER_INVOICE_EXISTS_EXCLUDE_ID
                                : SQL_MAP.CHECK_SUPPLIER_INVOICE_EXISTS,
                            sqlArgs: editInvoice
                                ? { supplier_id: vendorId, invoice_no: invoiceNo.trim(), id: editInvoice.id }
                                : { supplier_id: vendorId, invoice_no: invoiceNo.trim() },
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
    }, [invoiceNo, vendorId, dbName, schema, editInvoice]);

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
        let quantity = 0, aggregate = 0, cgst = 0, sgst = 0, igst = 0;
        for (const l of lines) {
            const c = calcLine(l);
            quantity += l.quantity;
            aggregate += c.aggregate;
            cgst += c.cgstAmt;
            sgst += c.sgstAmt;
            igst += c.igstAmt;
        }
        return { quantity, aggregate, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: aggregate + cgst + sgst + igst };
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
        const totalPct = 0.2; // 0.2%

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
        // 1. Header Validation: Brand, Supplier, Invoice No, Date
        const headerValid =
            !!selectedBrandId &&
            vendorId > 0 &&
            !!invoiceNo.trim() &&
            !!invoiceDate &&
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

        return true;
    }, [selectedBrandId, vendorId, invoiceNo, invoiceDate, invoiceExists, checkingDuplicate, lines]);

    // Reset
    const handleReset = () => {
        setVendorId(0);
        setInvoiceNo("");
        setInvoiceDate(today());
        setRemarks("");
        onIsReturnChange(false);
        setPhysicalTotal(0);
        setPhysicalQty(0);
        setPhysicalCgst(0);
        setPhysicalSgst(0);
        setPhysicalIgst(0);
        setLines([emptyLine(selectedBrandId)]);
        setInvoiceExists(false);
        setShowPhysicalCheckModal(false);
        setOriginalLineIds([]);
        setCheckingDuplicate(false);
        setMasterDiffLines([]);
    };

    // handleSubmit: validate guards then open physical check modal
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
            toast.error(MESSAGES.ERROR_PURCHASE_LINE_FIELDS_REQUIRED);
            return;
        }
        if (invoiceExists) {
            toast.error(MESSAGES.ERROR_PURCHASE_INVOICE_EXISTS);
            return;
        }
        // Reset physical fields so user cannot copy pre-filled values, then show modal
        setPhysicalQty(0);
        setPhysicalCgst(0);
        setPhysicalSgst(0);
        setPhysicalIgst(0);
        setPhysicalTotal(0);
        setShowPhysicalCheckModal(true);
    };

    // executeSave: fires the actual DB mutation (called directly or after diff confirmation)
    const executeSave = async () => {
        const purchaseTypeId = txnTypes.find(t => t.code === "PURCHASE")?.id;
        const returnTypeId   = txnTypes.find(t => t.code === "PURCHASE_RETURN")?.id;
        const warrantyTypeId = txnTypes.find(t => t.code === "WARRANTY_IN")?.id;
        const hasWarrantyLine = lines.some(l => l.under_warranty);
        if (!purchaseTypeId || (isReturn && !returnTypeId) || (hasWarrantyLine && !isReturn && !warrantyTypeId) || !branchId || !dbName || !schema || !vendorId || !invoiceNo.trim() || !invoiceDate) {
            toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
            return;
        }

        const linePayload = lines.map(line => {
            const c = calcLine(line);
            const txnTypeId = isReturn
                ? returnTypeId
                : (line.under_warranty ? warrantyTypeId : purchaseTypeId);
            const drCr = isReturn ? "C" : "D";
            return {
                part_id: line.part_id,
                hsn_code: line.hsn_code,
                quantity: line.quantity,
                unit_price: line.unit_price,
                under_warranty: line.under_warranty,
                remarks: line.remarks.trim() || null,
                aggregate_amount: c.aggregate,
                gst_rate: line.gst_rate,
                cgst_amount: c.cgstAmt,
                sgst_amount: c.sgstAmt,
                igst_amount: c.igstAmt,
                total_amount: c.total,
                xDetails: [
                    {
                        tableName: "stock_transaction",
                        fkeyName: "purchase_line_id",
                        xData: [{
                            branch_id: branchId,
                            part_id: line.part_id,
                            qty: line.quantity,
                            unit_cost: (isReturn || line.under_warranty) ? 0 : line.unit_price,
                            dr_cr: drCr,
                            transaction_date: invoiceDate,
                            stock_transaction_type_id: txnTypeId,
                        }],
                    },
                    ...(!isReturn && !line.under_warranty ? [{
                        tableName: "spare_part_master",
                        xData: [{
                            id: line.part_id!,
                            ...(line.hsn_code.trim()  && { hsn_code:   line.hsn_code.trim() }),
                            ...(line.unit_price > 0   && { cost_price: line.unit_price }),
                            ...(line.gst_rate > 0     && { gst_rate:   line.gst_rate }),
                        }],
                    }] : []),
                ],
            };
        });

        const headerFields = {
            supplier_id: vendorId,
            invoice_no: invoiceNo.trim(),
            invoice_date: invoiceDate,
            aggregate_amount: totals.aggregate,
            cgst_amount: physicalCgst || 0,
            sgst_amount: physicalSgst || 0,
            igst_amount: physicalIgst || 0,
            total_tax: isIgst ? (physicalIgst || 0) : ((physicalCgst || 0) + (physicalSgst || 0)),
            total_amount: physicalTotal || 0,
            brand_id: selectedBrandId,
            remarks: remarks.trim() || null,
            is_return: isReturn,
        };

        setSubmitting(true);
        try {
            if (editInvoice) {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "purchase_invoice",
                    xData: {
                        id: editInvoice!.id,
                        ...headerFields,
                        xDetails: {
                            tableName: "purchase_invoice_line",
                            fkeyName: "purchase_invoice_id",
                            deletedIds: originalLineIds,
                            xData: linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_PURCHASE_UPDATED);
            } else {
                const payload = graphQlUtils.buildGenericUpdateValue({
                    tableName: "purchase_invoice",
                    xData: {
                        branch_id: branchId,
                        ...headerFields,
                        xDetails: {
                            tableName: "purchase_invoice_line",
                            fkeyName: "purchase_invoice_id",
                            xData: linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_PURCHASE_CREATED);
            }
            setShowPhysicalCheckModal(false);
            setMasterDiffLines([]);
            onSuccess();
        } catch {
            toast.error(editInvoice ? MESSAGES.ERROR_PURCHASE_UPDATE_FAILED : MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    // handleConfirmedSubmit: called from physical check modal; checks for master data conflicts first
    const handleConfirmedSubmit = async () => {
        if (!physicalValidation.allValid) {
            toast.error(MESSAGES.ERROR_PURCHASE_PHYSICAL_CHECK_FAILED);
            return;
        }

        const diffLines = lines.filter(line => {
            if (!line.part_id) return false;
            const hsnConflict   = line._orig_hsn_code   != null && line.hsn_code.trim() !== "" && line.hsn_code.trim() !== line._orig_hsn_code;
            const priceConflict = line._orig_cost_price != null && line.unit_price > 0           && line.unit_price     !== line._orig_cost_price;
            const gstConflict   = line._orig_gst_rate   != null && line.gst_rate  > 0            && line.gst_rate       !== line._orig_gst_rate;
            return hsnConflict || priceConflict || gstConflict;
        });

        if (diffLines.length > 0) {
            setShowPhysicalCheckModal(false);
            setMasterDiffLines(diffLines);
            return;
        }

        await executeSave();
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
            className="flex min-h-fit md:min-h-0 md:flex-1 flex-col gap-2 pb-0 md:overflow-hidden"
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
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1 flex items-center gap-2">
                        Invoice Details
                        {isReturn && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">Return</span>}
                    </p>
                    <Card className={`border-[var(--cl-border)] shadow-md !overflow-visible bg-[var(--cl-surface)] ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                        <CardContent className="pt-4 !overflow-visible">
                            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2">
                            {/* Vendor */}
                            <SearchableCombobox
                                className="md:col-span-2 lg:col-span-4"
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
                            <div className="space-y-2 md:col-span-2 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Invoice No <span className="text-red-500 ml-0.5">*</span></Label>
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
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Inv Date <span className="text-red-500 ml-0.5">*</span></Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                    value={invoiceDate}
                                    onChange={e => setInvoiceDate(e.target.value)}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 md:col-span-6 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Remarks</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional..."
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>
                            </div>{/* end grid */}
                        </CardContent>
                    </Card>
                    {/* table */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] my-2">Line Items</p>
                    <Card className={`border-[var(--cl-border)] shadow-sm flex min-h-0 md:flex-1 flex-col relative bg-[var(--cl-surface)] ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                        <div
                            ref={scrollWrapperRef}
                            className="w-full overflow-x-auto overflow-y-auto pb-4"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
                            <table className="min-w-[860px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "2%" }}>#</th>
                                        <th className={thClass} style={{ width: "20%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-center`} style={{ width: "4%" }} title="Under Warranty"><ShieldOff className="h-3.5 w-3.5 mx-auto" /></th>
                                        <th className={thClass} style={{ width: "8%" }}>HSN</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "8%" }}>Price</th>
                                        <th className={`${thClass} text-right border-l border-[var(--cl-border)]`} style={{ width: "8%" }}>Subtotal</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>GST %</th>
                                        {!isIgst ? (
                                            <>
                                                <th className={`${thClass} text-right`} style={{ width: "7%" }}>CGST</th>
                                                <th className={`${thClass} text-right`} style={{ width: "7%" }}>SGST</th>
                                            </>
                                        ) : (
                                            <th className={`${thClass} text-right`} style={{ width: "14%" }}>IGST</th>
                                        )}
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>Total</th>
                                        <th className={thClass} style={{ width: "8%" }}>Remarks</th>
                                        <th className={`${thClass} text-left`} style={{ width: "4%" }}></th>
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
                                                    <PartCodeInput
                                                        ref={el => { partInputRefs.current[idx] = el; }}
                                                        partCode={line.part_code}
                                                        partId={line.part_id}
                                                        partName={line.part_name}
                                                        brandId={line.brand_id}
                                                        selectedBrandId={selectedBrandId}
                                                        brandName={brandName}
                                                        onChange={code => {
                                                            const patch: Partial<PurchaseLineFormItem> = { part_code: code };
                                                            if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                            updateLine(idx, patch);
                                                        }}
                                                        onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                        onSelect={part => {
                                                            const masterGstRate = Number(part.gst_rate ?? 0);
                                                            const effectiveGstRate = (isGstRegistered && masterGstRate === 0)
                                                                ? defaultGstRate
                                                                : masterGstRate;
                                                            updateLine(idx, {
                                                                part_id:          part.id,
                                                                brand_id:         part.brand_id,
                                                                part_code:        part.part_code,
                                                                part_name:        part.part_name,
                                                                uom:              part.uom,
                                                                hsn_code:         part.hsn_code ?? "",
                                                                unit_price:       Number(part.cost_price ?? 0),
                                                                gst_rate:         effectiveGstRate,
                                                                _orig_hsn_code:   part.hsn_code ?? null,
                                                                _orig_cost_price: part.cost_price ?? null,
                                                                _orig_gst_rate:   part.gst_rate ?? null,
                                                            });
                                                        }}
                                                        onTabToNext={() => hsnInputRefs.current[idx]?.focus()}
                                                    />
                                                </td>

                                                {/* Warranty */}
                                                <td className={`${tdClass} text-center`}>
                                                    <button
                                                        type="button"
                                                        title={line.under_warranty ? "Under Warranty — click to remove" : "Not under warranty — click to mark"}
                                                        onClick={() => {
                                                            const checked = !line.under_warranty;
                                                            updateLine(idx, {
                                                                under_warranty: checked,
                                                                ...(checked && { unit_price: 0 }),
                                                            });
                                                        }}
                                                        className={`mx-auto flex h-6 w-6 items-center justify-center rounded transition-all cursor-pointer ${
                                                            line.under_warranty
                                                                ? "bg-emerald-600 text-white shadow-sm"
                                                                : "bg-[var(--cl-surface-2)] text-[var(--cl-text-muted)] hover:bg-emerald-600/20 hover:text-emerald-600"
                                                        }`}
                                                    >
                                                        {line.under_warranty
                                                            ? <ShieldCheck className="h-3.5 w-3.5" />
                                                            : <ShieldOff className="h-3.5 w-3.5" />}
                                                    </button>
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
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)] text-right font-medium ${line.under_warranty ? "opacity-50 cursor-not-allowed" : ""}`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.unit_price}
                                                        disabled={line.under_warranty}
                                                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* Subtotal (read-only) */}
                                                <td className={`${tdClass} text-right pt-1 font-mono tabular-nums text-sm font-medium text-[var(--cl-text)] border-l border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40`}>
                                                    {formatNumber(c.aggregate)}
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

                                                {!isIgst ? (
                                                    <>
                                                        {/* CGST Amt (read-only) */}
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-sm font-medium text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`}>
                                                            {formatNumber(c.cgstAmt)}
                                                        </td>
                                                        {/* SGST Amt (read-only) */}
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-sm font-medium text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`}>
                                                            {formatNumber(c.sgstAmt)}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-sm font-medium text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`} title="IGST Amount">
                                                        {formatNumber(c.igstAmt)}
                                                    </td>
                                                )}

                                                {/* Total (read-only) */}
                                                <td className={`${tdClass} p-2 text-right font-mono tabular-nums text-sm font-semibold text-[var(--cl-text)] bg-[var(--cl-surface-2)]/40`}>
                                                    {formatNumber(c.total)}
                                                </td>

                                                {/* Remarks */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                        placeholder="Optional..."
                                                        value={line.remarks}
                                                        onChange={e => updateLine(idx, { remarks: e.target.value })}
                                                    />
                                                </td>

                                                {/* Actions */}
                                                <td className={`${tdClass} text-left`}>
                                                    <div className="flex items-center justify-start gap-0.5 px-2">
                                                        <LineAddDeleteActions
                                                            onAdd={() => insertLine(idx)}
                                                            onDelete={() => removeLine(idx)}
                                                            disableDelete={lines.length === 1}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {lines.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>

                    {/* ── Summary Bar ── */}
                    <div ref={summaryRef} className={`rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end ${isReturn ? "border-red-500/30 bg-red-500/5" : "border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40"}`}>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">{lines.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Qty</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">{formatNumber(totals.quantity)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Subtotal</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text)]">₹{formatNumber(totals.aggregate)}</span>
                        </div>
                        {totals.cgst > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">CGST</span>
                                <span className="font-mono font-semibold text-sm text-[var(--cl-text-muted)]">₹{formatNumber(totals.cgst)}</span>
                            </div>
                        )}
                        {totals.sgst > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">SGST</span>
                                <span className="font-mono font-semibold text-sm text-[var(--cl-text-muted)]">₹{formatNumber(totals.sgst)}</span>
                            </div>
                        )}
                        {totals.igst > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">IGST</span>
                                <span className="font-mono font-semibold text-sm text-[var(--cl-text-muted)]">₹{formatNumber(totals.igst)}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Total Tax</span>
                            <span className="font-mono font-semibold text-sm text-[var(--cl-text-muted)]">₹{formatNumber(totals.total_tax)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-[var(--cl-border)] pl-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--cl-text-muted)]">Total</span>
                            <span className="font-mono font-black text-base text-[var(--cl-accent)]">₹{formatNumber(totals.total)}</span>
                        </div>
                        {editInvoice && (
                            <div className="flex items-center gap-1.5 border-l border-amber-500/30 pl-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Saved</span>
                                <span className="font-mono font-semibold text-sm text-amber-700">₹{formatNumber(editInvoice.total_amount)}</span>
                            </div>
                        )}
                    </div>

                    {/* ── Master Data Diff Confirmation Modal ── */}
                    <MasterDataDiffModal
                        isOpen={masterDiffLines.length > 0}
                        masterDiffLines={masterDiffLines}
                        onClose={() => setMasterDiffLines([])}
                        onConfirm={() => executeSave()}
                        submitting={submitting}
                    />

                    {/* ── Physical Invoice Verification Modal ── */}
                    <PhysicalInvoiceModal
                        isOpen={showPhysicalCheckModal}
                        onClose={() => setShowPhysicalCheckModal(false)}
                        onSubmit={handleConfirmedSubmit}
                        submitting={submitting}
                        isIgst={isIgst}
                        physicalValidation={physicalValidation}
                        physicalQty={physicalQty}
                        setPhysicalQty={setPhysicalQty}
                        physicalCgst={physicalCgst}
                        setPhysicalCgst={setPhysicalCgst}
                        physicalSgst={physicalSgst}
                        setPhysicalSgst={setPhysicalSgst}
                        physicalIgst={physicalIgst}
                        setPhysicalIgst={setPhysicalIgst}
                        physicalTotal={physicalTotal}
                        setPhysicalTotal={setPhysicalTotal}
                    />
                </>
            )}
        </motion.div>
    );
});
