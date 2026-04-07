import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { selectSchema } from "@/store/context-slice";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseLineFormItem, StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { StateRow } from "./purchase-entry-section";

import { PartCodeInput } from "../part-code-input";
import { PhysicalInvoiceModal } from "./physical-invoice-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

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
    editInvoice?: import("@/features/client/types/purchase").PurchaseInvoiceType | null;
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
    branchId, txnTypes, vendors, states, onSuccess, onStatusChange, isIgst, selectedBrandId, brandName, editInvoice
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

    const dupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            setSupplierStateCode(detail.supplier_state_code);
            setRemarks(detail.remarks ?? "");
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

        return true;
    }, [selectedBrandId, vendorId, invoiceNo, invoiceDate, supplierStateCode, invoiceExists, checkingDuplicate, lines]);

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
        setShowPhysicalCheckModal(false);
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

    // handleConfirmedSubmit: actual DB save called from modal after physical check passes
    const handleConfirmedSubmit = async () => {
        if (!physicalValidation.allValid) {
            toast.error(MESSAGES.ERROR_PURCHASE_PHYSICAL_CHECK_FAILED);
            return;
        }

        const purchaseTypeId = txnTypes.find(t => t.code === "PURCHASE")?.id;
        if (!purchaseTypeId) {
            toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
            return;
        }
        // Inline re-check to satisfy TS narrowing (branchId already checked in handleSubmit)
        if (!branchId || !dbName || !schema || !vendorId || !invoiceNo.trim() || !invoiceDate) {
            toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
            return;
        }

        const linePayload = lines.map(line => {
            const c = calcLine(line);
            return {
                part_id: line.part_id,
                hsn_code: line.hsn_code,
                quantity: line.quantity,
                unit_price: line.unit_price,
                aggregate_amount: c.aggregate,
                gst_rate: line.gst_rate,
                cgst_amount: c.cgstAmt,
                sgst_amount: c.sgstAmt,
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
        });

        const headerFields = {
            supplier_id: vendorId,
            invoice_no: invoiceNo.trim(),
            invoice_date: invoiceDate,
            supplier_state_code: supplierStateCode,
            aggregate_amount: totals.aggregate,
            cgst_amount: physicalCgst || 0,
            sgst_amount: physicalSgst || 0,
            igst_amount: physicalIgst || 0,
            total_tax: isIgst ? (physicalIgst || 0) : ((physicalCgst || 0) + (physicalSgst || 0)),
            total_amount: physicalTotal || 0,
            brand_id: selectedBrandId,
            remarks: remarks.trim() || null,
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
            onSuccess();
        } catch {
            toast.error(editInvoice ? MESSAGES.ERROR_PURCHASE_UPDATE_FAILED : MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
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
                            <div className="space-y-2 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Inv Date <span className="text-red-500 ml-0.5">*</span></Label>
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
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Remarks</Label>
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
                                                        onSelect={part => updateLine(idx, {
                                                            part_id: part.id,
                                                            brand_id: part.brand_id,
                                                            part_code: part.part_code,
                                                            part_name: part.part_name,
                                                            uom: part.uom,
                                                            hsn_code: part.hsn_code ?? "",
                                                            unit_price: Number(part.cost_price ?? 0),
                                                            gst_rate: Number(part.gst_rate ?? 0),
                                                        })}
                                                        onTabToNext={() => hsnInputRefs.current[idx]?.focus()}
                                                    />
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
                                <tfoot className="bg-[var(--cl-surface-2)]/20 font-bold">
                                    <tr className="border-t-2 border-[var(--cl-border)]">
                                        <td className="py-2 px-4 text-xs uppercase tracking-wider text-[var(--cl-text-muted)]" colSpan={3}>computed Amount</td>
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
                                    {editInvoice && (
                                        <tr className="border-t border-[var(--cl-border)] bg-amber-500/5 text-amber-900 border-b">
                                            <td className="py-2 px-4 text-xs uppercase tracking-wider text-amber-700" colSpan={3}>Saved Invoice Values</td>
                                            <td className="py-2 px-2 text-right text-sm font-semibold tabular-nums text-amber-700/50">
                                                —
                                            </td>
                                            <td colSpan={3}></td>
                                            <td className="py-2 px-2 text-right text-sm tabular-nums">
                                                {isIgst ? "—" : formatNumber(editInvoice.cgst_amount)}
                                            </td>
                                            <td className="py-2 px-2 text-right text-sm tabular-nums">
                                                {isIgst ? "—" : formatNumber(editInvoice.sgst_amount)}
                                            </td>
                                            <td className="py-2 px-2 text-right text-sm tabular-nums">
                                                {isIgst ? formatNumber(editInvoice.igst_amount) : "—"}
                                            </td>
                                            <td className="py-2 px-2 text-right text-sm font-bold tabular-nums">
                                                {formatNumber(editInvoice.total_amount)}
                                            </td>
                                            <td className="w-28"></td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                        {lines.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>

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
