import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { formatCurrency } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectSchema } from "@/store/context-slice";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseLineFormItem, StockTransactionTypeRow } from "@/features/client/types/purchase";

// ─── Types ────────────────────────────────────────────────────────────────────

type BranchType = { id: number; name: string; code: string };

type PartRow = {
    id:          number;
    part_code:   string;
    part_name:   string;
    uom:         string;
    hsn_code:    string | null;
    gst_rate:    number | null;
    cost_price:  number | null;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branches:         BranchType[];
    open:             boolean;
    selectedBranchId: number | null;
    txnTypes:         StockTransactionTypeRow[];
    vendors:          VendorType[];
    onOpenChange:     (open: boolean) => void;
    onSuccess:        () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyLine(): PurchaseLineFormItem {
    return {
        _key:       crypto.randomUUID(),
        part_id:    null,
        part_code:  "",
        part_name:  "",
        uom:        "",
        hsn_code:   "",
        quantity:   1,
        unit_price: 0,
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

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "text-xs font-semibold uppercase tracking-wide text-[var(--cl-text-muted)] p-2 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]/50";
const tdClass = "p-1 border-b border-[var(--cl-border)]";
const inputCls = "h-8 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm";

// ─── Component ────────────────────────────────────────────────────────────────

export const AddPurchaseInvoiceDialog = ({
    branches, open, selectedBranchId, txnTypes, vendors, onOpenChange, onSuccess,
}: Props) => {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // Header fields
    const [branchId,           setBranchId]           = useState<number>(0);
    const [vendorId,           setVendorId]           = useState<number>(0);
    const [invoiceNo,          setInvoiceNo]          = useState("");
    const [invoiceDate,        setInvoiceDate]        = useState(today());
    const [supplierStateCode,  setSupplierStateCode]  = useState("");
    const [remarks,            setRemarks]            = useState("");

    // Line items
    const [lines, setLines] = useState<PurchaseLineFormItem[]>([emptyLine()]);

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

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setBranchId(selectedBranchId ?? branches[0]?.id ?? 0);
            setVendorId(0);
            setInvoiceNo("");
            setInvoiceDate(today());
            setSupplierStateCode("");
            setRemarks("");
            setLines([emptyLine()]);
            setInvoiceExists(false);
        }
    }, [open, selectedBranchId, branches]);

    // Auto-fill supplier state code from GSTIN when vendor changes
    useEffect(() => {
        if (!vendorId) return;
        const vendor = vendors.find(v => v.id === vendorId);
        if (vendor?.gstin && vendor.gstin.length >= 2) {
            setSupplierStateCode(vendor.gstin.substring(0, 2));
        } else {
            setSupplierStateCode("");
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

    // Select a part from the pick dialog
    const handlePartSelect = (part: PartRow) => {
        const gstRate = Number(part.gst_rate ?? 0);
        const halfRate = gstRate / 2;
        setLines(prev => prev.map((l, i) => i === partPickLine ? {
            ...l,
            part_id:   part.id,
            part_code: part.part_code,
            part_name: part.part_name,
            uom:       part.uom,
            hsn_code:  part.hsn_code ?? "",
            cgst_rate: halfRate,
            sgst_rate: halfRate,
            igst_rate: 0,
        } : l));
        setPartPickOpen(false);
        setPartQuery("");
        setPartResults([]);
    };

    const openPartPick = (idx: number) => {
        setPartPickLine(idx);
        setPartQuery("");
        setPartResults([]);
        setPartPickOpen(true);
    };

    // Line mutations
    const updateLine = (idx: number, patch: Partial<PurchaseLineFormItem>) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
    };

    const addLine = () => setLines(prev => [...prev, emptyLine()]);

    const removeLine = (idx: number) => {
        setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    // Totals
    const totals = useMemo(() => {
        let taxable = 0, cgst = 0, sgst = 0, igst = 0;
        for (const l of lines) {
            const c = calcLine(l);
            taxable += c.taxable;
            cgst    += c.cgstAmt;
            sgst    += c.sgstAmt;
            igst    += c.igstAmt;
        }
        return { taxable, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: taxable + cgst + sgst + igst };
    }, [lines]);

    // Submit
    const handleSubmit = async () => {
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
        if (lines.length === 0 || lines.some(l => !l.part_id || l.quantity <= 0)) {
            toast.error(MESSAGES.ERROR_PURCHASE_LINES_REQUIRED);
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
                taxable_amount:      totals.taxable,
                cgst_amount:         totals.cgst,
                sgst_amount:         totals.sgst,
                igst_amount:         totals.igst,
                total_tax:           totals.total_tax,
                total_amount:        totals.total,
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
                            taxable_amount: c.taxable,
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

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog open={open} onOpenChange={open => { if (!submitting) onOpenChange(open); }}>
                <DialogContent className="sm:max-w-[92vw] max-h-[92vh] overflow-y-auto !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                    <DialogHeader>
                        <DialogTitle>New Purchase Invoice</DialogTitle>
                    </DialogHeader>

                    {/* Header fields */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                        {/* Branch */}
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Branch</Label>
                            <Select
                                value={String(branchId || "")}
                                onValueChange={v => setBranchId(Number(v))}
                            >
                                <SelectTrigger className="h-9 bg-[var(--cl-surface)]">
                                    <SelectValue placeholder="Select branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Vendor */}
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Supplier</Label>
                            <Select
                                value={String(vendorId || "")}
                                onValueChange={v => setVendorId(Number(v))}
                            >
                                <SelectTrigger className="h-9 bg-[var(--cl-surface)]">
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors.filter(v => v.is_active).map(v => (
                                        <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Invoice No */}
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Invoice No</Label>
                            <div className="relative">
                                <Input
                                    className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] pr-8"
                                    placeholder="Supplier invoice number"
                                    value={invoiceNo}
                                    onChange={e => setInvoiceNo(e.target.value)}
                                />
                                {checkingDuplicate && (
                                    <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--cl-text-muted)]" />
                                )}
                            </div>
                            {invoiceExists && (
                                <p className="text-xs text-red-500">Invoice already exists for this supplier.</p>
                            )}
                        </div>

                        {/* Invoice Date */}
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Invoice Date</Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                                type="date"
                                value={invoiceDate}
                                onChange={e => setInvoiceDate(e.target.value)}
                            />
                        </div>

                        {/* Supplier State Code */}
                        <div className="space-y-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Supplier State Code</Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)]"
                                maxLength={2}
                                placeholder="e.g. 29"
                                value={supplierStateCode}
                                onChange={e => setSupplierStateCode(e.target.value.toUpperCase())}
                            />
                        </div>

                        {/* Remarks */}
                        <div className="col-span-2 space-y-1 sm:col-span-1">
                            <Label className="text-xs text-[var(--cl-text-muted)]">Remarks</Label>
                            <Textarea
                                className="h-9 min-h-0 resize-none border-[var(--cl-border)] bg-[var(--cl-surface)] py-1.5 text-sm"
                                placeholder="Optional remarks"
                                rows={1}
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-[var(--cl-text)]">Line Items</p>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addLine}>
                                <Plus className="mr-1 h-3 w-3" />
                                Add Row
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[var(--cl-border)]">
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className={thClass} style={{ width: "4%" }}>#</th>
                                        <th className={thClass} style={{ width: "22%" }}>Part</th>
                                        <th className={thClass} style={{ width: "9%" }}>HSN</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>Qty</th>
                                        <th className={`${thClass} text-right`} style={{ width: "9%" }}>Unit Price</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>CGST%</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>SGST%</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>IGST%</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Taxable</th>
                                        <th className={`${thClass} text-right`} style={{ width: "10%" }}>Total</th>
                                        <th className={thClass} style={{ width: "5%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => {
                                        const c = calcLine(line);
                                        return (
                                            <tr key={line._key} className="hover:bg-[var(--cl-surface-2)]/30">
                                                <td className={`${tdClass} pl-2 text-[var(--cl-text-muted)]`}>{idx + 1}</td>

                                                {/* Part */}
                                                <td className={tdClass}>
                                                    <button
                                                        className="flex w-full items-center gap-1 rounded border border-[var(--cl-border)] bg-[var(--cl-surface)] px-2 py-1.5 text-left text-xs hover:border-[var(--cl-accent)] focus:outline-none"
                                                        type="button"
                                                        onClick={() => openPartPick(idx)}
                                                    >
                                                        <Search className="h-3 w-3 shrink-0 text-[var(--cl-text-muted)]" />
                                                        {line.part_id ? (
                                                            <span className="truncate">
                                                                <span className="font-mono font-medium">{line.part_code}</span>
                                                                {" — "}{line.part_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--cl-text-muted)]">Search part…</span>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* HSN */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={inputCls}
                                                        placeholder="HSN"
                                                        value={line.hsn_code}
                                                        onChange={e => updateLine(idx, { hsn_code: e.target.value })}
                                                    />
                                                </td>

                                                {/* Qty */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} text-right`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.quantity}
                                                        onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                                                    />
                                                </td>

                                                {/* Unit Price */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} text-right`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.unit_price}
                                                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                                                    />
                                                </td>

                                                {/* CGST% */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} text-right`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.cgst_rate}
                                                        onChange={e => updateLine(idx, { cgst_rate: Number(e.target.value) })}
                                                    />
                                                </td>

                                                {/* SGST% */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} text-right`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.sgst_rate}
                                                        onChange={e => updateLine(idx, { sgst_rate: Number(e.target.value) })}
                                                    />
                                                </td>

                                                {/* IGST% */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} text-right`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.igst_rate}
                                                        onChange={e => updateLine(idx, { igst_rate: Number(e.target.value) })}
                                                    />
                                                </td>

                                                {/* Taxable (read-only) */}
                                                <td className="border-b border-[var(--cl-border)] p-1 text-right text-sm text-[var(--cl-text)]">
                                                    {formatCurrency(c.taxable)}
                                                </td>

                                                {/* Total (read-only) */}
                                                <td className="border-b border-[var(--cl-border)] p-1 text-right text-sm font-medium text-[var(--cl-text)]">
                                                    {formatCurrency(c.total)}
                                                </td>

                                                {/* Remove */}
                                                <td className={`${tdClass} text-center`}>
                                                    <button
                                                        className="rounded p-0.5 text-[var(--cl-text-muted)] hover:text-red-500 disabled:opacity-30"
                                                        disabled={lines.length === 1}
                                                        type="button"
                                                        onClick={() => removeLine(idx)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                                {/* Totals footer */}
                                <tfoot>
                                    <tr className="bg-[var(--cl-surface-2)]/50 font-semibold">
                                        <td colSpan={8} className="p-2 text-right text-xs uppercase tracking-wide text-[var(--cl-text-muted)]">
                                            Totals
                                        </td>
                                        <td className="p-2 text-right text-sm">{formatCurrency(totals.taxable)}</td>
                                        <td className="p-2 text-right text-sm text-[var(--cl-accent)]">{formatCurrency(totals.total)}</td>
                                        <td />
                                    </tr>
                                    <tr className="bg-[var(--cl-surface-2)]/30 text-xs text-[var(--cl-text-muted)]">
                                        <td colSpan={8} className="p-1.5 text-right">
                                            Tax breakdown:
                                        </td>
                                        <td colSpan={2} className="p-1.5 text-right">
                                            CGST {formatCurrency(totals.cgst)} · SGST {formatCurrency(totals.sgst)} · IGST {formatCurrency(totals.igst)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            disabled={submitting}
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={submitting || invoiceExists || checkingDuplicate}
                            onClick={() => void handleSubmit()}
                        >
                            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            Save Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Part Pick Dialog */}
            <Dialog
                open={partPickOpen}
                onOpenChange={open => {
                    if (!open) { setPartPickOpen(false); setPartQuery(""); setPartResults([]); }
                }}
            >
                <DialogContent className="sm:max-w-lg !bg-[var(--cl-surface)] text-[var(--cl-text)]">
                    <DialogHeader>
                        <DialogTitle>Search Part</DialogTitle>
                    </DialogHeader>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                        <Input
                            autoFocus
                            className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] pl-9"
                            placeholder="Search by part code or name…"
                            value={partQuery}
                            onChange={e => setPartQuery(e.target.value)}
                        />
                    </div>

                    <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--cl-border)]">
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
                                    className="flex w-full items-start gap-3 border-b border-[var(--cl-border)] px-3 py-2 text-left last:border-0 hover:bg-[var(--cl-surface-2)]"
                                    type="button"
                                    onClick={() => handlePartSelect(part)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-sm font-medium text-[var(--cl-text)]">
                                            {part.part_code}
                                            <span className="ml-2 font-sans font-normal text-[var(--cl-text-muted)]">
                                                {part.part_name}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 text-xs text-[var(--cl-text-muted)]">
                                            UOM: {part.uom}
                                            {part.hsn_code ? ` · HSN: ${part.hsn_code}` : ""}
                                            {part.gst_rate != null ? ` · GST: ${part.gst_rate}%` : ""}
                                        </p>
                                    </div>
                                    {part.cost_price != null && (
                                        <span className="shrink-0 text-xs text-[var(--cl-text-muted)]">
                                            {formatCurrency(part.cost_price)}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
