import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, X, PlusCircle, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";


import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
 
import { AddPartDialog } from "../../add-part-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartRow = {
    id:          number;
    brand_id:    number;
    part_code:   string;
    part_name:   string;
    uom:         string;
    hsn_code:    string | null;
    gst_rate:    number | null;
    cost_price:  number | null;
    brand_name:  string;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:         number | null;
    txnTypes:         StockTransactionTypeRow[];
    vendors:          VendorType[];
    states:           StateRow[];
    onSuccess:        () => void;
    onStatusChange:   (status: { isValid: boolean; isSubmitting: boolean }) => void;
    isIgst:           boolean;
    selectedBrandId:  number | null;
    brandName?:       string;
};

export type NewPurchaseInvoiceHandle = {
    submit:       () => void;
    reset:        () => void;
    isSubmitting: boolean;
    isValid:      boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyLine(brandId: number | null = null): PurchaseLineFormItem {
    return {
        _key:       crypto.randomUUID(),
        part_id:    null,
        brand_id:   brandId,
        part_code:  "",
        part_name:  "",
        uom:        "",
        hsn_code:   "",
        quantity:   1,
        unit_price: 0,
        gst_rate:   0,
        cgst_rate:  0,
        sgst_rate:  0,
        igst_rate:  0,
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

// ─── Internal Components ──────────────────────────────────────────────────────

interface ModernComboboxProps<T> {
    label:          React.ReactNode;
    placeholder:    string;
    selectedValue:  string;
    onSelect:       (item: T | null) => void;
    items:          T[];
    renderItem:     (item: T) => React.ReactNode;
    getFilterKey:   (item: T) => string;
    getDisplayValue: (item: T) => string;
    className?:     string;
    maxLength?:     number;
    getIdentifier?: (item: T) => string;
    isError?:       boolean;
}

function ModernCombobox<T>({ 
    label, placeholder, selectedValue, onSelect, items, renderItem, getFilterKey, getDisplayValue, className, maxLength, getIdentifier, isError
}: ModernComboboxProps<T>) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    
    // When selectedValue changes from outside (e.g. auto-fill), update the search text
    useEffect(() => {
        if (selectedValue) {
            const found = items.find(i => {
                const idVal = getIdentifier ? getIdentifier(i) : getFilterKey(i).split(" ")[0];
                const display = getDisplayValue(i).split(" ")[0];
                return idVal === selectedValue || display === selectedValue;
            });
            if (found) setSearch(getDisplayValue(found));
            else setSearch(selectedValue);
        } else {
            setSearch("");
        }
    }, [selectedValue, items, getDisplayValue, getFilterKey, getIdentifier]);

    const filtered = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter(item => getFilterKey(item).toLowerCase().includes(s));
    }, [items, search, getFilterKey]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                // On close, if search doesn't match selected, reset search to what was selected
                const found = items.find(i => getDisplayValue(i) === search);
                if (!found && selectedValue) {
                    const original = items.find(i => getFilterKey(i).split(" ")[0] === selectedValue);
                    if (original) setSearch(getDisplayValue(original));
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [search, selectedValue, items, getDisplayValue, getFilterKey]);

    return (
        <div className={`space-y-2 relative ${className} ${open ? "z-[110]" : "z-auto"}`} ref={containerRef}>
            <Label className="text-xs font-semibold text-[var(--cl-text-muted)] uppercase tracking-wider">{label}</Label>
            <div className="relative group">
                <Input
                    className={`bg-[var(--cl-surface-2)] pr-8 h-9 transition-all focus:ring-2 focus:ring-[var(--cl-accent)]/20 ${isError ? "border-red-500 focus:border-red-500 ring-red-500/10" : "border-transparent"}`}
                    placeholder={placeholder}
                    value={search}
                    onChange={e => {
                        setSearch(e.target.value);
                        setOpen(true);
                        if (!e.target.value) onSelect(null);
                    }}
                    onFocus={() => setOpen(true)}
                    maxLength={maxLength}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] opacity-50 group-hover:opacity-100 transition-opacity">
                    {search ? <X className="h-4 w-4 cursor-pointer hover:text-red-500" onClick={() => { setSearch(""); onSelect(null); }} /> : <Plus className="h-3 w-3 rotate-45" />}
                </div>

                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-[220px] overflow-y-auto rounded-xl border border-[var(--cl-border)] bg-[var(--cl-surface)] p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5"
                    >
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-[var(--cl-text-muted)] italic text-pretty">
                                No items found for "{search}"
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filtered.map((item, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-[var(--cl-accent)]/10 hover:text-[var(--cl-accent)] focus:bg-[var(--cl-accent)]/10 focus:outline-none"
                                        onClick={() => {
                                            onSelect(item);
                                            setSearch(getDisplayValue(item));
                                            setOpen(false);
                                        }}
                                    >
                                        {renderItem(item)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPurchaseInvoice = forwardRef<NewPurchaseInvoiceHandle, Props>(({
    branchId, txnTypes, vendors, states, onSuccess, onStatusChange, isIgst, selectedBrandId, brandName
}, ref) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [vendorId,           setVendorId]           = useState<number>(0);
    const [invoiceNo,          setInvoiceNo]          = useState("");
    const [invoiceDate,        setInvoiceDate]        = useState(today());
    const [supplierStateCode,  setSupplierStateCode]  = useState("");
    const [remarks,            setRemarks]            = useState("");
    const [physicalTotal,      setPhysicalTotal]      = useState<number>(0);
    const [physicalQty,        setPhysicalQty]        = useState<number>(0);
    const [physicalCgst,       setPhysicalCgst]       = useState<number>(0);
    const [physicalSgst,       setPhysicalSgst]       = useState<number>(0);
    const [physicalIgst,       setPhysicalIgst]       = useState<number>(0);

    // Inline Part Creation
    const [addPartOpen,        setAddPartOpen]        = useState(false);
    const [addPartLineIdx,     setAddPartLineIdx]     = useState<number | null>(null);
    const [prefillPartCode,    setPrefillPartCode]    = useState("");
 
    // Line items
    const [lines, setLines] = useState<PurchaseLineFormItem[]>([emptyLine(selectedBrandId)]);

    // Duplicate check
    const [invoiceExists,      setInvoiceExists]      = useState(false);
    const [checkingDuplicate,  setCheckingDuplicate]  = useState(false);

    // Part search dialog
    const [partPickOpen,   setPartPickOpen]   = useState(false);
    const [partPickLine,   setPartPickLine]   = useState(-1);
    const [partQuery,      setPartQuery]      = useState("");
    const [partResults,    setPartResults]    = useState<PartRow[]>([]);
    const [partLoading,    setPartLoading]    = useState(false);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const dupDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const partDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                            sqlId:   SQL_MAP.CHECK_SUPPLIER_INVOICE_EXISTS,
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

    // Part search (debounced 400ms)
    useEffect(() => {
        if (!dbName || !schema) return;
        if (partDebounceRef.current) clearTimeout(partDebounceRef.current);
        if (!partQuery.trim()) {
            setPartResults([]);
            return;
        }
        partDebounceRef.current = setTimeout(async () => {
            setPartLoading(true);
            try {
                const res = await apolloClient.query<GenericQueryData<PartRow>>({
                    fetchPolicy: "network-only",
                    query: GRAPHQL_MAP.genericQuery,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericQueryValue({
                            sqlId:   SQL_MAP.GET_PARTS_PAGED,
                            sqlArgs: { search: partQuery.trim(), limit: 20, offset: 0 },
                        }),
                    },
                });
                setPartResults(res.data?.genericQuery ?? []);
            } catch {
                // silent
            } finally {
                setPartLoading(false);
            }
        }, 400);
    }, [partQuery, dbName, schema]);

    // Typed search for part code (on blur or enter)
    const handleTypedPartSearch = async (idx: number, code: string, brandId?: number | null) => {
        if (!code.trim() || !dbName || !schema) return;
        
        try {
            const res = await apolloClient.query<GenericQueryData<PartRow>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_PART_BY_CODE,
                        sqlArgs: { code: code.trim(), brand_id: brandId ?? null },
                    }),
                },
            });
            
            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                // Exactly one part found → auto-select
                handlePartSelectForIdx(idx, results[0]);
            } else if (results.length > 1) {
                // Multiple parts → open pick dialog with pre-filled search
                setPartPickLine(idx);
                setPartQuery(code.trim());
                setPartResults(results);
                setPartPickOpen(true);
            } else {
                // No part found → open AddPartDialog
                setAddPartLineIdx(idx);
                setPrefillPartCode(code.trim());
                setAddPartOpen(true);
            }
        } catch {
            // silent
        }
    };

    // Refactored handlePartSelect to accept an index (for auto-population)
    const handlePartSelectForIdx = (idx: number, part: PartRow) => {
        updateLine(idx, {
            part_id:   part.id,
            brand_id:  part.brand_id,
            part_code: part.part_code,
            part_name: part.part_name,
            uom:       part.uom,
            hsn_code:  part.hsn_code ?? "",
            unit_price: Number(part.cost_price ?? 0),
            gst_rate:  Number(part.gst_rate ?? 0),
        });
        setPartPickOpen(false);
        setPartQuery("");
        setPartResults([]);
    };

    // Original handlePartSelect for the generic pick dialog
    const handlePartSelect = (part: PartRow) => {
        handlePartSelectForIdx(partPickLine, part);
    };

    const openPartPick = (idx: number) => {
        setPartPickLine(idx);
        setPartQuery("");
        setPartResults([]);
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
            cgst    += c.cgstAmt;
            sgst    += c.sgstAmt;
            igst    += c.igstAmt;
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
                branch_id:           branchId,
                supplier_id:         vendorId,
                invoice_no:          invoiceNo.trim(),
                invoice_date:        invoiceDate,
                supplier_state_code: supplierStateCode,
                aggregate_amount:    totals.taxable,
                cgst_amount:         totals.cgst,
                sgst_amount:         totals.sgst,
                igst_amount:         totals.igst,
                total_tax:           totals.total_tax,
                total_amount:        totals.total,
                total_physical:      physicalTotal,
                remarks:             remarks.trim() || null,
                xDetails: {
                    tableName: "purchase_invoice_line",
                    fkeyName:  "purchase_invoice_id",
                    xData: lines.map(line => {
                        const c = calcLine(line);
                        return {
                            part_id:        line.part_id,
                            hsn_code:       line.hsn_code,
                            quantity:       line.quantity,
                            unit_price:     line.unit_price,
                            aggregate_amount: c.taxable,
                            cgst_rate:      line.cgst_rate,
                            cgst_amount:    c.cgstAmt,
                            sgst_rate:      line.sgst_rate,
                            sgst_amount:    c.sgstAmt,
                            igst_rate:      line.igst_rate,
                            igst_amount:    c.igstAmt,
                            total_amount:   c.total,
                            xDetails: {
                                tableName: "stock_transaction",
                                fkeyName:  "purchase_line_id",
                                xData: [{
                                    branch_id:                branchId,
                                    part_id:                  line.part_id,
                                    qty:                      line.quantity,
                                    unit_cost:                line.unit_price,
                                    dr_cr:                    "D",
                                    transaction_date:         invoiceDate,
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
                mutation:  GRAPHQL_MAP.genericUpdate,
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
        submit:       () => { void handleSubmit(); },
        reset:        handleReset,
        isSubmitting: submitting,
        isValid:      isFormValid,
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
                    <ModernCombobox
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

                    <ModernCombobox
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
                                <th className={`${thClass} text-right text-xs`} style={{ width: "7%" }}>CGST</th>
                                <th className={`${thClass} text-right text-xs`} style={{ width: "7%" }}>SGST</th>
                                <th className={`${thClass} text-right text-xs`} style={{ width: "7%" }}>IGST</th>
                                <th className={`${thClass} text-right`} style={{ width: "10%" }}>Total</th>
                                <th className={`${thClass} text-center`} style={{ width: "9%" }}>Actions</th>
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
                                                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPartPick(idx)}
                                                            className="rounded-md p-1 bg-[var(--cl-accent)] text-white hover:bg-[var(--cl-accent)]/10 text-[var(--cl-accent)] shadow-sm transition-all focus:ring-2 focus:ring-[var(--cl-accent)]/20 cursor-pointer"
                                                            title="Browse all parts"
                                                        >
                                                            <Search className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <Input
                                                        className={`${inputCls} font-mono w-full pl-10 pr-16 border-transparent hover:border-[var(--cl-border)] focus:border-[var(--cl-accent)] focus:bg-[var(--cl-surface)] transition-all ${line.part_id ? "bg-[var(--cl-accent)]/5 border-[var(--cl-accent)]/20 text-[var(--cl-accent)] font-bold" : "border-red-500 focus:border-red-500 ring-red-500/10 bg-transparent"}`}
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
                                                        }}
                                                        onBlur={() => {
                                                            if (line.part_code.trim()) void handleTypedPartSearch(idx, line.part_code, line.brand_id || selectedBrandId);
                                                        }}
                                                    />
                                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                                        {line.part_code && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    updateLine(idx, { part_code: "", part_id: null, part_name: "" });
                                                                }}
                                                                className="rounded-md p-1 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer"
                                                                title="Clear search"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAddPartLineIdx(idx);
                                                                setPrefillPartCode(line.part_code.trim());
                                                                setAddPartOpen(true);
                                                            }}
                                                            className="rounded-md p-1 bg-emerald-600 text-white hover:bg-emerald-600/10 hover:text-emerald-600 shadow-sm transition-all focus:ring-2 focus:ring-emerald-600/20 cursor-pointer"
                                                            title="Add as new part"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
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
                                        <td className={`${tdClass} p-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums`}>
                                            {isIgst ? "—" : formatNumber(c.cgstAmt)}
                                        </td>

                                        {/* SGST Amt (read-only) */}
                                        <td className={`${tdClass} p-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums`}>
                                            {isIgst ? "—" : formatNumber(c.sgstAmt)}
                                        </td>

                                        {/* IGST Amt (read-only) */}
                                        <td className={`${tdClass} p-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums`}>
                                            {isIgst ? formatNumber(c.igstAmt) : "—"}
                                        </td>

                                        {/* Total (read-only) */}
                                        <td className={`${tdClass} p-2 text-right text-sm font-semibold text-[var(--cl-text)] tabular-nums`}>
                                            {formatNumber(c.total)}
                                        </td>

                                        {/* Actions */}
                                        <td className={`${tdClass} text-center`}>
                                            <div className="flex items-center justify-center gap-0.5 px-2">
                                                <button
                                                    type="button"
                                                    className="cursor-pointer text-[var(--cl-accent)] hover:bg-[var(--cl-accent)]/10 hover:scale-110 active:scale-95 transition-all p-1 rounded-full"
                                                    onClick={() => insertLine(idx)}
                                                    title="Add row below"
                                                >
                                                    <PlusCircle className="h-7 w-7" strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cursor-pointer text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:scale-110 active:scale-95 transition-all p-1 rounded-full disabled:opacity-20 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-transparent"
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
                                <td className="py-2 px-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums">
                                    {isIgst ? "—" : formatNumber(totals.cgst)}
                                </td>
                                <td className="py-2 px-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums">
                                    {isIgst ? "—" : formatNumber(totals.sgst)}
                                </td>
                                <td className="py-2 px-2 text-right text-[11px] text-[var(--cl-text-muted)] opacity-80 tabular-nums">
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
                    if (!open) { setPartPickOpen(false); setPartQuery(""); setPartResults([]); }
                }}
            >
                <DialogContent className="sm:max-w-lg bg-white text-black border-[var(--cl-border)] shadow-2xl opacity-100">
                    <DialogHeader>
                        <DialogTitle>Search Part</DialogTitle>
                    </DialogHeader>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            autoFocus
                            className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9 pr-9"
                            placeholder="Search by part code or name…"
                            value={partQuery}
                            onChange={e => setPartQuery(e.target.value)}
                        />
                        {partQuery && (
                            <button
                                type="button"
                                onClick={() => { setPartQuery(""); setPartResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cl-text-muted)] hover:text-red-500 transition-colors cursor-pointer"
                                title="Clear search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--cl-border)] mt-2">
                        {partLoading ? (
                            <div className="flex h-16 items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-[var(--cl-accent)]" />
                            </div>
                        ) : partResults.length === 0 ? (
                            <div className="flex h-16 items-center justify-center text-sm text-[var(--cl-text-muted)]">
                                {partQuery.trim() ? "No parts found." : "Type to search parts."}
                            </div>
                        ) : (
                            partResults.map(part => (
                                <button
                                    key={part.id}
                                    className="cursor-pointer flex w-full items-start gap-3 border-b border-[var(--cl-border)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--cl-surface-2)] transition-colors"
                                    type="button"
                                    onClick={() => handlePartSelect(part)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-sm font-medium text-[var(--cl-text)]">
                                            {part.part_code}
                                            <span className="ml-2 font-sans font-normal text-[var(--cl-text-muted)] truncate">
                                                {part.part_name}
                                            </span>
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--cl-text-muted)] inline-flex items-center gap-2">
                                            <span className="bg-[var(--cl-surface)] border border-[var(--cl-border)] px-1.5 py-0.5 rounded shadow-sm">UOM: {part.uom}</span>
                                            {part.hsn_code ? <span className="bg-[var(--cl-surface)] border border-[var(--cl-border)] px-1.5 py-0.5 rounded shadow-sm">HSN: {part.hsn_code}</span> : null}
                                            {part.gst_rate != null ? <span className="bg-[var(--cl-surface)] border border-[var(--cl-border)] px-1.5 py-0.5 rounded shadow-sm">GST: {part.gst_rate}%</span> : null}
                                        </p>
                                    </div>
                                    {part.cost_price != null && (
                                        <span className="shrink-0 text-sm font-semibold text-[var(--cl-text)] pt-1">
                                            {formatNumber(part.cost_price)}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            </>
            )}

            <AddPartDialog
                onOpenChange={setAddPartOpen}
                onSuccess={() => {
                    if (addPartLineIdx !== null) {
                        void handleTypedPartSearch(addPartLineIdx, prefillPartCode, selectedBrandId);
                    }
                }}
                open={addPartOpen}
                prefillCode={prefillPartCode}
                defaultBrandId={selectedBrandId}
                brandName={brandName}
            />
        </motion.div>
    );
});
