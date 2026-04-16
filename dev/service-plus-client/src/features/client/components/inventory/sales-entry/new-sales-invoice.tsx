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
import { selectDefaultGstRate, selectEffectiveGstStateCode, selectIsGstRegistered, selectSchema } from "@/store/context-slice";
import type { StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { SalesInvoiceType, SalesLineFormItem, DocumentSequenceRow, CustomerSearchRow } from "@/features/client/types/sales";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";

import { PartCodeInput } from "../part-code-input";
import { CustomerInput } from "../customer-input";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:           number | null;
    txnTypes:           StockTransactionTypeRow[];
    docSequence:        DocumentSequenceRow | null;
    onSuccess:          () => void;
    onStatusChange:     (status: { isValid: boolean; isSubmitting: boolean }) => void;
    isIgst:             boolean;
    setIsIgst:          (v: boolean) => void;
    isReturn:           boolean;
    onIsReturnChange:   (v: boolean) => void;
    selectedBrandId:    number | null;
    brandName?:         string;
    editInvoice?:       SalesInvoiceType | null;
    customerTypes:      CustomerTypeOption[];
    masterStates:       StateOption[];
};

export type NewSalesInvoiceHandle = {
    submit:        () => void;
    reset:         () => void;
    isSubmitting:  boolean;
    isValid:       boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyLine(brandId: number | null = null): SalesLineFormItem {
    return {
        _key:             crypto.randomUUID(),
        part_id:          null,
        brand_id:         brandId,
        part_code:        "",
        part_name:        "",
        uom:              "",
        hsn_code:         "",
        quantity:         1,
        unit_price:       0,
        gst_rate:         0,
        aggregate_amount: 0,
        cgst_amount:      0,
        sgst_amount:      0,
        igst_amount:      0,
        total_amount:     0,
        remarks:          "",
    };
}

function calcLine(l: SalesLineFormItem, isIgst: boolean) {
    const aggregate = l.quantity * l.unit_price;
    const gst       = l.gst_rate;
    const cgstAmt   = isIgst ? 0 : aggregate * (gst / 2) / 100;
    const sgstAmt   = isIgst ? 0 : aggregate * (gst / 2) / 100;
    const igstAmt   = isIgst ? aggregate * gst / 100 : 0;
    return { aggregate, cgstAmt, sgstAmt, igstAmt, total: aggregate + cgstAmt + sgstAmt + igstAmt };
}

function buildInvoiceNo(seq: DocumentSequenceRow): string {
    return `${seq.prefix}${seq.separator}${String(seq.next_number).padStart(seq.padding, "0")}`;
}

function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-[var(--cl-text)] py-2 px-2 text-left border-b border-[var(--cl-border)] bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-[var(--cl-border)]";
const inputCls = "h-7 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewSalesInvoice = forwardRef<NewSalesInvoiceHandle, Props>(({
    branchId, txnTypes, docSequence,
    onSuccess, onStatusChange, isIgst, setIsIgst, isReturn, onIsReturnChange,
    selectedBrandId, brandName, editInvoice,
    customerTypes, masterStates,
}, ref) => {
    const dbName                = useAppSelector(selectDbName);
    const schema                = useAppSelector(selectSchema);
    const isGstRegistered       = useAppSelector(selectIsGstRegistered);
    const defaultGstRate        = useAppSelector(selectDefaultGstRate);
    const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);

    // Header fields
    const [customerId,          setCustomerId]          = useState<number | null>(null);
    const [customerName,        setCustomerName]        = useState("");
    const [customerGstin,       setCustomerGstin]       = useState("");
    const [customerStateCode,   setCustomerStateCode]   = useState("");
    const [invoiceDate,         setInvoiceDate]         = useState(today());
    const [remarks,             setRemarks]             = useState("");

    // Line items
    const [lines, setLines] = useState<SalesLineFormItem[]>([emptyLine(selectedBrandId)]);

    // Edit: original line IDs to delete on update
    const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);

    // Submit
    const [submitting, setSubmitting] = useState(false);

    const partInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const hsnInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

    // Populate form when editInvoice changes
    useEffect(() => {
        if (!editInvoice) {
            handleReset();
            setOriginalLineIds([]);
            return;
        }
        if (!dbName || !schema) return;
        apolloClient.query<GenericQueryData<SalesInvoiceType & { lines: SalesLineFormItem[] }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId: SQL_MAP.GET_SALES_INVOICE_DETAIL,
                    sqlArgs: { id: editInvoice.id },
                }),
            },
        }).then(res => {
            const detail = res.data?.genericQuery?.[0];
            if (!detail) return;
            setCustomerId(detail.customer_contact_id ?? null);
            setCustomerName(detail.customer_name ?? "");
            setCustomerGstin(detail.customer_gstin ?? "");
            setCustomerStateCode(detail.customer_state_code ?? "");
            setInvoiceDate(detail.invoice_date);
            setRemarks(detail.remarks ?? "");
            onIsReturnChange(Boolean(detail.is_return));
            const newIsIgst = !!detail.customer_state_code && !!effectiveGstStateCode
                && detail.customer_state_code !== effectiveGstStateCode;
            setIsIgst(newIsIgst);
            const loadedLines = ((detail as any).lines ?? []).map((l: any) => {
                const igstAmt = Number(l.igst_amount ?? 0);
                const cgstAmt = Number(l.cgst_amount ?? 0);
                return {
                    _key:             crypto.randomUUID(),
                    part_id:          l.part_id,
                    brand_id:         selectedBrandId,
                    part_code:        l.part_code,
                    part_name:        l.part_name,
                    uom:              "",
                    hsn_code:         l.hsn_code ?? "",
                    quantity:         Number(l.quantity),
                    unit_price:       Number(l.unit_price),
                    gst_rate:         Number(l.gst_rate ?? 0),
                    aggregate_amount: Number(l.aggregate_amount ?? l.taxable_amount ?? 0),
                    cgst_amount:      cgstAmt,
                    sgst_amount:      Number(l.sgst_amount ?? 0),
                    igst_amount:      igstAmt,
                    total_amount:     Number(l.total_amount ?? 0),
                    remarks:          l.remarks ?? "",
                } as SalesLineFormItem;
            });
            setLines(loadedLines);
            setOriginalLineIds(((detail as any).lines ?? []).map((l: any) => l.id));
        }).catch(() => toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editInvoice, dbName, schema]);

    // Sync isIgst when customerStateCode changes
    useEffect(() => {
        if (!effectiveGstStateCode || !customerStateCode) return;
        setIsIgst(customerStateCode !== effectiveGstStateCode);
    }, [customerStateCode, effectiveGstStateCode, setIsIgst]);

    // Line mutations
    const updateLine = (idx: number, patch: Partial<SalesLineFormItem>) => {
        setLines(prev => prev.map((l, i) => {
            if (i !== idx) return l;
            const next = { ...l, ...patch };
            const c = calcLine(next, isIgst);
            return {
                ...next,
                aggregate_amount: c.aggregate,
                cgst_amount:      c.cgstAmt,
                sgst_amount:      c.sgstAmt,
                igst_amount:      c.igstAmt,
                total_amount:     c.total,
            };
        }));
    };

    // Recalc amounts when isIgst changes
    useEffect(() => {
        setLines(prev => prev.map(l => {
            const c = calcLine(l, isIgst);
            return {
                ...l,
                aggregate_amount: c.aggregate,
                cgst_amount:      c.cgstAmt,
                sgst_amount:      c.sgstAmt,
                igst_amount:      c.igstAmt,
                total_amount:     c.total,
            };
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
            const c = calcLine(l, isIgst);
            quantity  += l.quantity;
            aggregate += c.aggregate;
            cgst      += c.cgstAmt;
            sgst      += c.sgstAmt;
            igst      += c.igstAmt;
        }
        return { quantity, aggregate, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: aggregate + cgst + sgst + igst };
    }, [lines, isIgst]);

    const isFormValid = useMemo(() => {
        if (!selectedBrandId) return false;
        if (!customerName.trim()) return false;
        if (!customerStateCode) return false;
        if (!invoiceDate) return false;
        if (lines.length === 0) return false;
        return lines.every(l => {
            if (!l.part_id || l.quantity <= 0) return false;
            if ((l.unit_price > 0 || l.gst_rate > 0) && !l.hsn_code.trim()) return false;
            return true;
        });
    }, [selectedBrandId, customerName, customerStateCode, invoiceDate, lines]);

    const handleReset = () => {
        setCustomerId(null);
        setCustomerName("");
        setCustomerGstin("");
        setCustomerStateCode("");
        setInvoiceDate(today());
        setRemarks("");
        onIsReturnChange(false);
        setLines([emptyLine(selectedBrandId)]);
        setOriginalLineIds([]);
    };

    const executeSave = async () => {
        const salesTypeId  = txnTypes.find(t => t.code === "SALES")?.id;
        const returnTypeId = txnTypes.find(t => t.code === "SALE_RETURN")?.id;
        if (isReturn && !returnTypeId) {
            toast.error("Sale Return transaction type not found. Please contact admin.");
            return;
        }
        if (!salesTypeId || !branchId || !dbName || !schema || !customerName.trim() || !invoiceDate) {
            toast.error(MESSAGES.ERROR_SALES_CREATE_FAILED);
            return;
        }

        const txnTypeId = isReturn ? returnTypeId! : salesTypeId;
        const drCr      = isReturn ? "D" : "C";

        const linePayload = lines.map(line => {
            const c = calcLine(line, isIgst);
            return {
                part_id:          line.part_id,
                item_description: line.part_name,
                hsn_code:         line.hsn_code,
                quantity:         line.quantity,
                unit_price:       line.unit_price,
                aggregate_amount: c.aggregate,
                gst_rate:         line.gst_rate,
                cgst_amount:      c.cgstAmt,
                sgst_amount:      c.sgstAmt,
                igst_amount:      c.igstAmt,
                total_amount:     c.total,
                remarks:          line.remarks.trim() || null,
                xDetails: [
                    {
                        tableName: "stock_transaction",
                        fkeyName:  "sales_line_id",
                        xData: [{
                            branch_id:                  branchId,
                            part_id:                    line.part_id,
                            qty:                        line.quantity,
                            unit_cost:                  line.unit_price,
                            dr_cr:                      drCr,
                            transaction_date:           invoiceDate,
                            stock_transaction_type_id:  txnTypeId,
                        }],
                    },
                ],
            };
        });

        const headerFields = {
            customer_contact_id: customerId ?? null,
            customer_name:       customerName.trim(),
            customer_gstin:      customerGstin.trim() || null,
            customer_state_code: customerStateCode,
            invoice_date:        invoiceDate,
            aggregate_amount:    totals.aggregate,
            cgst_amount:         totals.cgst,
            sgst_amount:         totals.sgst,
            igst_amount:         totals.igst,
            total_tax:           totals.total_tax,
            total_amount:        totals.total,
            brand_id:            selectedBrandId,
            remarks:             remarks.trim() || null,
            is_return:           isReturn,
        };

        setSubmitting(true);
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
                            deletedIds: originalLineIds,
                            xData:      linePayload,
                        },
                    },
                });
                await apolloClient.mutate({
                    mutation: GRAPHQL_MAP.genericUpdate,
                    variables: { db_name: dbName, schema, value: payload },
                });
                toast.success(MESSAGES.SUCCESS_SALES_UPDATED);
            } else {
                // New invoice: use dedicated mutation that also increments document_sequence
                const invoiceNo = docSequence ? buildInvoiceNo(docSequence) : "";
                const sqlObject = {
                    tableName: "sales_invoice",
                    doc_sequence_id:   docSequence?.id ?? null,
                    doc_sequence_next: docSequence ? (docSequence.next_number + 1) : null,
                    xData: {
                        branch_id:   branchId,
                        invoice_no:  invoiceNo,
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
                    mutation: GRAPHQL_MAP.createSalesInvoice,
                    variables: { db_name: dbName, schema, value: encoded },
                });
                toast.success(MESSAGES.SUCCESS_SALES_CREATED);
            }
            onSuccess();
        } catch {
            toast.error(editInvoice ? MESSAGES.ERROR_SALES_UPDATE_FAILED : MESSAGES.ERROR_SALES_CREATE_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!branchId) { toast.error("Branch is not selected globally."); return; }
        if (!customerName.trim()) { toast.error(MESSAGES.ERROR_SALES_CUSTOMER_REQUIRED); return; }
        if (!customerStateCode) { toast.error("Customer state is required."); return; }
        if (!invoiceDate) { toast.error(MESSAGES.ERROR_SALES_INVOICE_DATE_REQUIRED); return; }
        if (lines.length === 0 || lines.some(l => {
            if (!l.part_id || l.quantity <= 0) return true;
            if ((l.unit_price > 0 || l.gst_rate > 0) && !l.hsn_code.trim()) return true;
            return false;
        })) {
            toast.error(MESSAGES.ERROR_SALES_LINE_FIELDS_REQUIRED);
            return;
        }
        await executeSave();
    };

    // Sync status with parent
    useEffect(() => {
        onStatusChange({ isValid: isFormValid, isSubmitting: submitting });
    }, [isFormValid, submitting, onStatusChange]);

    useImperativeHandle(ref, () => ({
        submit:      () => { void handleSubmit(); },
        reset:       handleReset,
        isSubmitting: submitting,
        isValid:      isFormValid,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [submitting, isFormValid]);

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
                        Please select a target branch from the global header to start recording a new sales invoice.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1 flex items-center gap-2">
                        Invoice Details
                        {isReturn && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">Return</span>}
                    </p>
                    <Card className={`border-[var(--cl-border)] shadow-md !overflow-visible bg-[var(--cl-surface)] ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2 !overflow-visible">
                            {/* Customer search */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Customer <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <CustomerInput
                                    customerId={customerId}
                                    customerName={customerName}
                                    onChange={name => {
                                        setCustomerName(name);
                                        if (!name.trim()) {
                                            setCustomerId(null);
                                            setCustomerGstin("");
                                            setCustomerStateCode("");
                                        }
                                    }}
                                    onClear={() => {
                                        setCustomerId(null);
                                        setCustomerName("");
                                        setCustomerGstin("");
                                        setCustomerStateCode("");
                                    }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.full_name ?? c.mobile);
                                        setCustomerGstin(c.gstin ?? "");
                                        setCustomerStateCode(c.state_code ?? "");
                                    }}
                                    customerTypes={customerTypes}
                                    states={masterStates}
                                />
                            </div>

                            {/* Customer Name (editable) */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Customer Name <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!customerName.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    placeholder="Walk-in customer or name…"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                />
                            </div>

                            {/* Customer GSTIN */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">GSTIN</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)] font-mono"
                                    placeholder="Optional…"
                                    value={customerGstin}
                                    onChange={e => setCustomerGstin(e.target.value)}
                                />
                            </div>

                            {/* Customer State */}
                            <SearchableCombobox
                                className="md:col-span-1 lg:col-span-2"
                                isError={!customerStateCode}
                                label={<span>State <span className="text-red-500 ml-0.5">*</span></span>}
                                placeholder="Select state..."
                                selectedValue={customerStateCode}
                                onSelect={s => setCustomerStateCode(s?.code ?? "")}
                                items={masterStates}
                                getFilterKey={s => `${s.code} ${s.name}`}
                                getDisplayValue={s => `${s.code} — ${s.name}`}
                                renderItem={s => (
                                    <div className="flex items-center gap-3 w-full">
                                        <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-[var(--cl-accent)]/10 text-[10px] font-bold text-[var(--cl-accent)]">
                                            {s.code}
                                        </span>
                                        <span className="truncate font-medium">{s.name}</span>
                                    </div>
                                )}
                            />

                            {/* Invoice No (read-only) */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Invoice No</Label>
                                <Input
                                    readOnly
                                    className="bg-[var(--cl-surface-2)] font-mono text-[var(--cl-accent)] font-bold cursor-not-allowed opacity-80"
                                    value={docSequence ? buildInvoiceNo(docSequence) : (editInvoice?.invoice_no ?? "—")}
                                />
                            </div>

                            {/* Invoice Date */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">
                                    Inv Date <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-[var(--cl-surface-2)] ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                    value={invoiceDate}
                                    onChange={e => setInvoiceDate(e.target.value)}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-4">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Remarks</Label>
                                <Input
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                />
                            </div>

                        </CardContent>
                    </Card>

                    {/* Line Items Table */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 mb-1 mt-1">
                        Line Items
                    </p>
                    <Card className={`border-[var(--cl-border)] shadow-sm flex flex-col min-h-0 relative bg-[var(--cl-surface)] ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                        <div className="overflow-x-auto w-full pb-4">
                            <table className="min-w-[920px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-[var(--cl-surface-2)]/50">
                                        <th className={thClass} style={{ width: "2%" }}>#</th>
                                        <th className={thClass} style={{ width: "18%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "8%" }}>HSN</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "8%" }}>Price</th>
                                        <th className={`${thClass} text-right border-l border-[var(--cl-border)]`} style={{ width: "10%" }}>Subtotal</th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>GST %</th>
                                        {!isIgst ? (
                                            <>
                                                <th className={`${thClass} text-right`} style={{ width: "7%" }}>CGST</th>
                                                <th className={`${thClass} text-right`} style={{ width: "7%" }}>SGST</th>
                                            </>
                                        ) : (
                                            <th className={`${thClass} text-right`} style={{ width: "14%" }}>IGST</th>
                                        )}
                                        <th className={`${thClass} text-right`} style={{ width: "8%" }}>Total</th>
                                        <th className={thClass} style={{ width: "12%" }}>Remarks</th>
                                        <th className={`${thClass} text-left`}  style={{ width: "5%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--cl-surface)]">
                                    {lines.map((line, idx) => {
                                        const c = calcLine(line, isIgst);
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
                                                            const patch: Partial<SalesLineFormItem> = { part_code: code };
                                                            if (!code.trim()) { patch.part_id = null; patch.part_name = ""; }
                                                            updateLine(idx, patch);
                                                        }}
                                                        onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "" })}
                                                        onSelect={part => {
                                                            const masterGstRate  = Number(part.gst_rate ?? 0);
                                                            const effectiveGstRate = (isGstRegistered && masterGstRate === 0)
                                                                ? defaultGstRate
                                                                : masterGstRate;
                                                            updateLine(idx, {
                                                                part_id:   part.id,
                                                                brand_id:  part.brand_id,
                                                                part_code: part.part_code,
                                                                part_name: part.part_name,
                                                                uom:       part.uom,
                                                                hsn_code:  part.hsn_code ?? "",
                                                                unit_price: Number(part.mrp ?? part.cost_price ?? 0),
                                                                gst_rate:  effectiveGstRate,
                                                            });
                                                        }}
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

                                                {/* Subtotal (read-only) */}
                                                <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-[var(--cl-text-muted)] border-l border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40`}>
                                                    {formatNumber(c.aggregate)}
                                                </td>

                                                {/* GST % */}
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
                                                        {/* CGST Amt */}
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`}>
                                                            {formatNumber(c.cgstAmt)}
                                                        </td>
                                                        {/* SGST Amt */}
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`}>
                                                            {formatNumber(c.sgstAmt)}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`} title="IGST Amount">
                                                        {formatNumber(c.igstAmt)}
                                                    </td>
                                                )}

                                                {/* Total */}
                                                <td className={`${tdClass} px-2 text-right pt-1 font-mono font-semibold tabular-nums text-[var(--cl-text)] bg-[var(--cl-surface-2)]/40`}>
                                                    {formatNumber(c.total)}
                                                </td>

                                                {/* Remarks */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-[var(--cl-border)] focus:bg-[var(--cl-surface)]`}
                                                        placeholder="Remarks"
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

                    {/* Summary bar */}
                    <div className={`rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end ${isReturn ? "border-red-500/30 bg-red-500/5" : "border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40"}`}>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-bold tabular-nums text-sm text-[var(--cl-text)]">{lines.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Qty</span>
                            <span className="font-bold tabular-nums text-sm text-[var(--cl-text)]">{formatNumber(totals.quantity)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Subtotal</span>
                            <span className="font-bold tabular-nums text-sm text-[var(--cl-text)]">₹{formatNumber(totals.aggregate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Tax</span>
                            <span className="font-bold tabular-nums text-sm text-[var(--cl-text)]">₹{formatNumber(totals.total_tax)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pl-4 border-l border-[var(--cl-border)]">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Total</span>
                            <span className="font-black tabular-nums text-base text-[var(--cl-accent)]">₹{formatNumber(totals.total)}</span>
                        </div>
                        {editInvoice && (
                            <div className="flex items-center gap-1.5 pl-4 border-l border-amber-500/30">
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-600">Saved Total</span>
                                <span className="font-bold tabular-nums text-sm text-amber-700">₹{formatNumber(editInvoice.total_amount)}</span>
                            </div>
                        )}
                    </div>

                    {submitting && (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--cl-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
});

NewSalesInvoice.displayName = "NewSalesInvoice";
