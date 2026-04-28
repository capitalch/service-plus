import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
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
import type { SalesInvoiceType, DocumentSequenceRow, CustomerSearchRow } from "@/features/client/types/sales";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import { type SalesInvoiceFormValues, getInitialSalesLine } from "./sales-invoice-schema";
import type { SalesLineFormItem } from "./sales-invoice-schema";

import { PartCodeInput } from "../part-code-input";
import { CustomerInput } from "../customer-input";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

type Props = {
    branchId:             number | null;
    docSequence:          DocumentSequenceRow | null;
    isIgst:               boolean;
    setIsIgst:            (v: boolean) => void;
    isReturn:             boolean;
    onIsReturnChange:     (v: boolean) => void;
    selectedBrandId:      number | null;
    brandName?:           string;
    editInvoice?:         SalesInvoiceType | null;
    customerTypes:        CustomerTypeOption[];
    masterStates:         StateOption[];
    customerId:           number | null;
    setCustomerId:        (v: number | null) => void;
    customerName:         string;
    setCustomerName:      (v: string) => void;
    customerGstin:        string;
    setCustomerGstin:     (v: string) => void;
    customerStateCode:    string;
    setCustomerStateCode: (v: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLine(l: z.infer<typeof import("./sales-invoice-schema").salesLineSchema>, isIgst: boolean) {
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

export function NewSalesInvoice({
    branchId, docSequence,
    isIgst, setIsIgst, isReturn, onIsReturnChange,
    selectedBrandId, brandName, editInvoice,
    customerTypes, masterStates,
    customerId, setCustomerId,
    customerName, setCustomerName,
    customerGstin, setCustomerGstin,
    customerStateCode, setCustomerStateCode,
}: Props) {
    const dbName                = useAppSelector(selectDbName);
    const schema                = useAppSelector(selectSchema);
    const isGstRegistered       = useAppSelector(selectIsGstRegistered);
    const defaultGstRate        = useAppSelector(selectDefaultGstRate);
    const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);

    const form = useFormContext<SalesInvoiceFormValues>();
    const { register, setValue, formState: { isSubmitting } } = form;

    const { fields, remove, insert } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const lines = form.watch("lines") ?? [];

    const partInputRefs    = useRef<(HTMLInputElement | null)[]>([]);
    const hsnInputRefs     = useRef<(HTMLInputElement | null)[]>([]);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const summaryRef       = useRef<HTMLDivElement>(null);

    const [maxTableHeight, setMaxTableHeight] = useState<number | undefined>(undefined);

    useEffect(() => {
        function recalc() {
            const el = scrollWrapperRef.current;
            if (!el) return;
            const top           = el.getBoundingClientRect().top;
            const summaryHeight = summaryRef.current?.getBoundingClientRect().height ?? 0;
            // 14px = clearance from ClientLayout; 8px = gap between table and summary
            setMaxTableHeight(window.innerHeight - top - summaryHeight - 8 - 14);
        }
        recalc();
        window.addEventListener("resize", recalc);
        return () => window.removeEventListener("resize", recalc);
    }, []);

    // Populate form when editInvoice changes
    useEffect(() => {
        if (!editInvoice || !dbName || !schema) return;
        apolloClient.query<GenericQueryData<SalesInvoiceType & { lines: SalesLineFormItem[] }>>({
            fetchPolicy: "network-only",
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_SALES_INVOICE_DETAIL,
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
            onIsReturnChange(Boolean(detail.is_return));
            const newIsIgst = !!detail.customer_state_code && !!effectiveGstStateCode
                && detail.customer_state_code !== effectiveGstStateCode;
            setIsIgst(newIsIgst);
            const loadedLines = ((detail as any).lines ?? []).map((l: any) => ({
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
                cgst_amount:      Number(l.cgst_amount ?? 0),
                sgst_amount:      Number(l.sgst_amount ?? 0),
                igst_amount:      Number(l.igst_amount ?? 0),
                total_amount:     Number(l.total_amount ?? 0),
                remarks:          l.remarks ?? "",
            } as SalesLineFormItem));
            const originalIds = ((detail as any).lines ?? []).map((l: any) => l.id);
            form.reset({
                invoice_date: detail.invoice_date,
                remarks: detail.remarks ?? "",
                lines: loadedLines,
                originalLineIds: originalIds,
            });
        }).catch(() => toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editInvoice, dbName, schema]);

    // Sync isIgst when customerStateCode changes
    useEffect(() => {
        if (!effectiveGstStateCode || !customerStateCode) return;
        setIsIgst(customerStateCode !== effectiveGstStateCode);
    }, [customerStateCode, effectiveGstStateCode, setIsIgst]);

    // Recalc amounts when isIgst changes
    useEffect(() => {
        const currentLines = form.getValues("lines") ?? [];
        const recalculated = currentLines.map(l => {
            const c = calcLine(l, isIgst);
            return {
                ...l,
                aggregate_amount: c.aggregate,
                cgst_amount:      c.cgstAmt,
                sgst_amount:      c.sgstAmt,
                igst_amount:      c.igstAmt,
                total_amount:     c.total,
            };
        });
        form.setValue("lines", recalculated);
    }, [isIgst]);

    const insertLine = (idx: number) => {
        insert(idx + 1, getInitialSalesLine(selectedBrandId));
    };

    const removeLine = (idx: number) => {
        const currentLines = form.getValues("lines") ?? [];
        if (currentLines.length > 1) {
            remove(idx);
        }
    };

    const updateLine = (idx: number, patch: Partial<SalesLineFormItem>) => {
        const currentLine = lines[idx];
        if (!currentLine) return;
        const next = { ...currentLine, ...patch };
        const c = calcLine(next, isIgst);
        setValue(`lines.${idx}`, {
            ...next,
            aggregate_amount: c.aggregate,
            cgst_amount: c.cgstAmt,
            sgst_amount: c.sgstAmt,
            igst_amount: c.igstAmt,
            total_amount: c.total,
        });
    };

    // Totals
    const totals = useMemo(() => {
        let quantity = 0, aggregate = 0, cgst = 0, sgst = 0, igst = 0;
        for (const l of lines) {
            const c    = calcLine(l, isIgst);
            quantity  += l.quantity;
            aggregate += c.aggregate;
            cgst      += c.cgstAmt;
            sgst      += c.sgstAmt;
            igst      += c.igstAmt;
        }
        return { quantity, aggregate, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: aggregate + cgst + sgst + igst };
    }, [lines, isIgst]);

    const invoiceDate = form.watch("invoice_date");

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
                                    {...register("invoice_date")}
                                    className={`bg-[var(--cl-surface-2)] ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-4">
                                <Label className="text-xs font-extrabold text-[var(--cl-text)] uppercase tracking-widest">Remarks</Label>
                                <Input
                                    {...register("remarks")}
                                    className="bg-[var(--cl-surface-2)]"
                                    placeholder="Optional…"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items Table */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--cl-text-muted)] px-1 my-2">
                        Line Items
                    </p>
                    <Card className={`border-[var(--cl-border)] shadow-sm relative bg-[var(--cl-surface)] flex min-h-0 md:flex-1 flex-col ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                        <div
                            ref={scrollWrapperRef}
                            className="w-full overflow-x-auto overflow-y-auto pb-4"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
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
                                    {fields.map((field, idx) => {
                                        const line = lines[idx];
                                        if (!line) return null;
                                        const c = calcLine(line, isIgst);
                                        return (
                                            <tr key={field.id} className="hover:bg-[var(--cl-surface-2)]/30 group transition-colors">
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
                                                            const masterGstRate    = Number(part.gst_rate ?? 0);
                                                            const effectiveGstRate = (isGstRegistered && masterGstRate === 0)
                                                                ? defaultGstRate
                                                                : masterGstRate;
                                                            updateLine(idx, {
                                                                part_id:    part.id,
                                                                brand_id:   part.brand_id,
                                                                part_code:  part.part_code,
                                                                part_name:  part.part_name,
                                                                uom:        part.uom,
                                                                hsn_code:   part.hsn_code ?? "",
                                                                unit_price: Number(part.mrp ?? part.cost_price ?? 0),
                                                                gst_rate:   effectiveGstRate,
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
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-[var(--cl-text-muted)] bg-[var(--cl-surface-2)]/40`}>
                                                            {formatNumber(c.cgstAmt)}
                                                        </td>
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
                                                            disableDelete={fields.length === 1}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {fields.length === 0 && (
                            <div className="py-12 text-center text-[var(--cl-text-muted)] text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>

                    {/* Summary bar */}
                    <div ref={summaryRef} className={`rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end ${isReturn ? "border-red-500/30 bg-red-500/5" : "border-[var(--cl-border)] bg-[var(--cl-surface-2)]/40"}`}>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--cl-text-muted)]">Lines</span>
                            <span className="font-bold tabular-nums text-sm text-[var(--cl-text)]">{fields.length}</span>
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

                    {isSubmitting && (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--cl-text-muted)]">
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
}
