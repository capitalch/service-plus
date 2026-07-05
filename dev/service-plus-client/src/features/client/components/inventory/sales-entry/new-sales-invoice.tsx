import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Loader2, Plus, Radius } from "lucide-react";
import { LineAddDeleteActions } from "../line-add-delete-actions";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils, type GenericQueryData } from "@/lib/graphql-utils";
import { useAppSelector } from "@/store/hooks";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { selectAvailableDivisions, selectDefaultDivisionId, selectDefaultGstRate, selectEffectiveGstStateCode, selectMarkupPercentOverCost, selectSchema } from "@/store/context-slice";
import { isGstDivision } from "@/features/client/types/division";
import type { SalesInvoiceType, CustomerSearchRow } from "@/features/client/types/sales";
import type { CustomerTypeOption, StateOption } from "@/features/client/types/customer";
import { type SalesInvoiceFormValues, getInitialSalesLine } from "./sales-invoice-schema";
import type { SalesLineFormItem } from "./sales-invoice-schema";
import { calcLine, computeBackCalcLines } from "./sales-invoice-utils";

import { PartCodeInput } from "../part-code-input";
import { CustomerInput } from "@/features/client/components/shared/customer-select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    backCalcTarget:       string;
    branchId:             number | null;
    isIgst:               boolean;
    setBackCalcTarget:    (v: string) => void;
    setIsIgst:            (v: boolean) => void;
    isReturn:             boolean;
    onIsReturnChange:     (v: boolean) => void;
    onLinesValidChange:   (v: boolean) => void;
    onDivisionChange:     (divisionId: number) => void;
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

function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── GstPriceCell ─────────────────────────────────────────────────────────────
// Two rules:
//   • Price changes → gst price updates (derived, no back-calc)
//   • GST Price typed → back-calculates unit_price; gst price stays as typed
//
// skipSync: set true before committing so the effect triggered by the
// resulting unit_price change skips the sync once, preserving what the
// user typed. All other external unit_price changes (Price input,
// back-calculate button) sync normally because skipSync is false.

function GstPriceCell({
    unitPrice, gstRate, inputCls, tdClass, onCommit,
}: {
    unitPrice: number;
    gstRate:   number;
    inputCls:  string;
    tdClass:   string;
    onCommit:  (newUnitPrice: number) => void;
}) {
    const displayVal        = unitPrice * (1 + gstRate / 100);
    const [local, setLocal] = useState(displayVal.toFixed(2));
    const skipSync          = useRef(false);

    useEffect(() => {
        if (skipSync.current) { skipSync.current = false; return; }
        setLocal(displayVal.toFixed(2));
    }, [displayVal]);

    return (
        <td className={tdClass}>
            <Input
                className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-medium text-(--cl-accent)`}
                min={0}
                step="0.01"
                type="number"
                value={local}
                onChange={e => setLocal(e.target.value)}
                onFocus={e => e.target.select()}
                onBlur={() => {
                    const gstPriceVal = Number(local);
                    if (!isNaN(gstPriceVal) && gstPriceVal > 0) {
                        const divisor = 1 + gstRate / 100;
                        skipSync.current = true;
                        onCommit(Math.round((divisor > 0 ? gstPriceVal / divisor : gstPriceVal) * 100) / 100);
                    } else {
                        setLocal(displayVal.toFixed(2)); // revert invalid input
                    }
                }}
            />
        </td>
    );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-(--cl-text) py-2 px-2 text-left border-b border-(--cl-border) bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-(--cl-border)";
const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export function NewSalesInvoice({
    backCalcTarget, setBackCalcTarget,
    branchId,
    isIgst, setIsIgst, isReturn, onIsReturnChange,
    onLinesValidChange, onDivisionChange,
    selectedBrandId, brandName, editInvoice,
    customerTypes, masterStates,
    customerId, setCustomerId,
    customerName, setCustomerName,
    customerGstin, setCustomerGstin,
    customerStateCode, setCustomerStateCode,
}: Props) {
    const dbName                    = useAppSelector(selectDbName);
    const schema                    = useAppSelector(selectSchema);
    const defaultGstRate            = useAppSelector(selectDefaultGstRate);
    const markupPct                 = useAppSelector(selectMarkupPercentOverCost);
    const effectiveGstStateCode     = useAppSelector(selectEffectiveGstStateCode);
    const availableDivisions        = useAppSelector(selectAvailableDivisions);
    const defaultDivisionId         = useAppSelector(selectDefaultDivisionId);

    const form = useFormContext<SalesInvoiceFormValues>();
    const { register, setValue, formState: { isSubmitting } } = form;

    const divisionId       = form.watch("division_id");
    const selectedDivision = availableDivisions.find(d => d.id === divisionId) ?? null;
    const isGstMode        = isGstDivision(selectedDivision);
    const divisionGstStateCode = selectedDivision?.gst_state_code ?? effectiveGstStateCode;

    const { fields, remove, insert } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const lines = useWatch({ control: form.control, name: "lines" }) ?? [];

    // Report line validity to the parent (which gates the Save button). Computed here
    // from the reliably-watched `lines`, since the parent's own form.watch("lines")
    // does not pick up per-line setValue updates across the useFieldArray boundary.
    const linesValid = useMemo(() => {
        if (lines.length === 0) return false;
        return lines.every(l => {
            if (!l.part_id || l.qty <= 0) return false;
            if (isGstMode && (l.unit_price > 0 || l.gst_rate > 0) && !l.hsn_code.trim()) return false;
            return true;
        });
    }, [lines, isGstMode]);

    useEffect(() => { onLinesValidChange(linesValid); }, [linesValid, onLinesValidChange]);

    const partInputRefs    = useRef<(HTMLInputElement | null)[]>([]);
    const hsnInputRefs     = useRef<(HTMLInputElement | null)[]>([]);
    const scrollWrapperRef = useRef<HTMLDivElement>(null);
    const summaryRef       = useRef<HTMLDivElement>(null);

    const [customerAddress, setCustomerAddress]  = useState<string>("");
    const [customerMobile, setCustomerMobile]    = useState<string>("");
    const [maxTableHeight, setMaxTableHeight]    = useState<number | undefined>(undefined);

    useEffect(() => {
        function recalc() {
            // Only cap the table height on md+ (desktop), where the form fills a
            // fixed-height area and only the table scrolls internally. Below md the
            // whole form scrolls (see the outer container's overflow-y-auto), so the
            // table must render at its natural height — no maxHeight.
            const isDesktop = window.matchMedia("(min-width: 768px)").matches;
            if (!isDesktop) { setMaxTableHeight(undefined); return; }
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
            const editDivisionId = (detail as any).division_id ?? defaultDivisionId;
            const editDivisionGstStateCode = availableDivisions.find(d => d.id === editDivisionId)?.gst_state_code
                ?? effectiveGstStateCode;
            const newIsIgst = !!detail.customer_state_code && !!editDivisionGstStateCode
                && detail.customer_state_code !== editDivisionGstStateCode;
            setIsIgst(newIsIgst);
            const loadedLines = ((detail as any).lines ?? []).map((l: any) => ({
                _key:             crypto.randomUUID(),
                part_id:          l.part_id,
                brand_id:         selectedBrandId,
                part_code:        l.part_code,
                part_name:        l.part_name,
                uom:              "",
                hsn_code:         l.hsn_code ?? "",
                qty:         Number(l.qty),
                unit_price:       Number(l.unit_price),
                cost_price:       Number(l.cost_price ?? 0),
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
                division_id:  (detail as any).division_id ?? defaultDivisionId,
                invoice_date: detail.invoice_date,
                remarks:      detail.remarks ?? "",
                lines:        loadedLines,
                originalLineIds: originalIds,
            });
            setBackCalcTarget(String(detail.total_amount ?? ""));
        }).catch(() => toast.error(MESSAGES.ERROR_SALES_LOAD_FAILED));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editInvoice, dbName, schema]);

    // Sync isIgst when customerStateCode or division changes
    useEffect(() => {
        if (!divisionGstStateCode || !customerStateCode) return;
        setIsIgst(customerStateCode !== divisionGstStateCode);
    }, [customerStateCode, divisionGstStateCode, setIsIgst]);

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
        let qty = 0, aggregate = 0, cgst = 0, sgst = 0, igst = 0, profit = 0;
        for (const l of lines) {
            const c    = calcLine(l, isIgst);
            qty  += l.qty;
            aggregate += c.aggregate;
            cgst      += c.cgstAmt;
            sgst      += c.sgstAmt;
            igst      += c.igstAmt;
            profit    += (l.unit_price - (l.cost_price ?? 0)) * l.qty;
        }
        return { qty, aggregate, cgst, sgst, igst, profit, total: aggregate + cgst + sgst + igst };
    }, [lines, isIgst]);

    // Always keep target in sync with calculated total when lines change
    useEffect(() => {
        setBackCalcTarget(totals.total > 0 ? String(Math.round(totals.total * 100) / 100) : "");
    }, [totals.total, setBackCalcTarget]);

    const invoiceDate = form.watch("invoice_date");

    const backCalcNum = parseFloat(backCalcTarget);
    const hasTarget   = backCalcTarget !== "" && !isNaN(backCalcNum) && backCalcNum > 0;

    const applyBackCalcTarget = (target: number) => {
        const scaledLines = computeBackCalcLines(form.getValues("lines") ?? [], target, isIgst);
        form.setValue("lines", scaledLines);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex min-h-0 flex-1 flex-col gap-2 pb-0 overflow-y-auto md:overflow-hidden"
        >
            {!branchId ? (
                <div className="flex flex-col items-center justify-center py-20 bg-(--cl-surface-2)/30 rounded-xl border-2 border-dashed border-(--cl-border) text-center">
                    <div className="bg-(--cl-accent)/5 p-5 rounded-full mb-4">
                        <Plus className="h-12 w-12 text-(--cl-accent) opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-(--cl-text) mb-2">No Branch Selected</h3>
                    <p className="text-(--cl-text-muted) max-w-md px-6">
                        Please select a target branch from the global header to start recording a new sales invoice.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted) px-1 mb-1 flex items-center gap-2">
                        Invoice Details
                        {isReturn && <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">Return</span>}
                    </p>
                    <Card className={`border-(--cl-border) shadow-md !overflow-visible bg-(--cl-surface) ${isReturn ? "border-l-4 border-l-orange-500" : ""}`}>
                        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2 !overflow-visible">
                            {/* Customer search */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                    Customer <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <CustomerInput
                                    customerId={customerId}
                                    customerName={customerName}
                                    customerMobile={customerMobile}
                                    customerAddress={customerAddress}
                                    onChange={name => {
                                        setCustomerName(name);
                                        if (!name.trim()) {
                                            setCustomerId(null);
                                            setCustomerGstin("");
                                            setCustomerStateCode("");
                                            setCustomerMobile("");
                                            setCustomerAddress("");
                                        }
                                    }}
                                    onClear={() => {
                                        setCustomerId(null);
                                        setCustomerName("");
                                        setCustomerGstin("");
                                        setCustomerStateCode("");
                                        setCustomerMobile("");
                                        setCustomerAddress("");
                                    }}
                                    onSelect={(c: CustomerSearchRow) => {
                                        setCustomerId(c.id);
                                        setCustomerName(c.full_name ?? c.mobile);
                                        setCustomerGstin(c.gstin ?? "");
                                        setCustomerStateCode(c.state_code ?? "");
                                        setCustomerMobile(c.mobile ?? "");
                                        setCustomerAddress(c.address_line1 ?? "");
                                    }}
                                    customerTypes={customerTypes}
                                    states={masterStates}
                                />
                            </div>

                            {/* Customer Name (editable) */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                    Customer Name <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    className={`bg-(--cl-surface-2) ${!customerName.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    placeholder="Walk-in customer or name…"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                />
                            </div>

                            {/* Customer GSTIN */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">GSTIN</Label>
                                <Input
                                    className="bg-(--cl-surface-2) font-mono"
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
                                        <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-(--cl-accent)/10 text-[10px] font-bold text-(--cl-accent)">
                                            {s.code}
                                        </span>
                                        <span className="truncate font-medium">{s.name}</span>
                                    </div>
                                )}
                            />

                            {/* Invoice No (read-only) */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">Invoice No</Label>
                                <Input
                                    readOnly
                                    className="bg-(--cl-surface-2) font-mono text-(--cl-accent) font-bold cursor-not-allowed opacity-80"
                                    value={editInvoice ? editInvoice.invoice_no : "Auto-generated on save"}
                                />
                            </div>

                            {/* Invoice Date */}
                            <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                    Inv Date <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    {...register("invoice_date")}
                                    className={`bg-(--cl-surface-2) ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                    type="date"
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 md:col-span-2 lg:col-span-2">
                                <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">Remarks</Label>
                                <Input
                                    {...register("remarks")}
                                    className="bg-(--cl-surface-2)"
                                    placeholder="Optional…"
                                />
                            </div>

                            {/* Division */}
                            {availableDivisions.length > 0 && (
                                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                                    <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                        Division <span className="text-red-500 ml-0.5">*</span>
                                    </Label>
                                    <select
                                        disabled={!!editInvoice}
                                        className={`w-full rounded-md border px-3 py-2 text-sm bg-(--cl-surface-2) text-(--cl-text) focus:outline-none focus:ring-2 focus:ring-(--cl-accent)/30 ${
                                            editInvoice ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                        } ${!divisionId ? "border-red-500" : "border-(--cl-border)"}`}
                                        value={divisionId || ""}
                                        onChange={e => onDivisionChange(e.target.value ? Number(e.target.value) : 0)}
                                    >
                                        <option value="">Select division…</option>
                                        {availableDivisions.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Line Items Table */}
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted) px-1 my-2">
                        Line Items
                    </p>
                    <Card className={`border-(--cl-border) shadow-sm relative bg-(--cl-surface) flex min-h-[45vh] md:min-h-0 md:flex-1 flex-col ${isReturn ? "border-l-4 border-l-orange-500" : ""}`}>
                        <div
                            ref={scrollWrapperRef}
                            className="w-full overflow-x-auto overflow-y-auto pb-4 min-h-[43vh] md:min-h-0"
                            style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                        >
                            <table className="min-w-[920px] w-full border-collapse text-sm sticky-header">
                                <thead>
                                    <tr className="bg-(--cl-surface-2)/50">
                                        <th className={thClass} style={{ width: "2%" }}>#</th>
                                        <th className={thClass} style={{ width: "16%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={thClass} style={{ width: "7%" }}>HSN</th>
                                        <th className={`${thClass} text-right`} style={{ width: "5%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                        <th className={`${thClass} text-right`} style={{ width: "7%" }}>Price</th>
                                        <th className={`${thClass} text-right border-l border-(--cl-border)`} style={{ width: "8%" }}>Aggregate</th>
                                        <th className={`${thClass} text-right`} style={{ width: "6%" }}>GST %</th>
                                        {!isIgst ? (
                                            <>
                                                <th className={`${thClass} text-right`} style={{ width: "6%" }}>CGST</th>
                                                <th className={`${thClass} text-right`} style={{ width: "6%" }}>SGST</th>
                                            </>
                                        ) : (
                                            <th className={`${thClass} text-right`} style={{ width: "12%" }}>IGST</th>
                                        )}
                                        {isGstMode && (
                                            <th className={`${thClass} text-right`} style={{ width: "8%" }}>GST Price</th>
                                        )}
                                        <th className={`${thClass} text-right`} style={{ width: "8%" }}>Total</th>
                                        <th className={thClass} style={{ width: "11%" }}>Remarks</th>
                                        <th className={`${thClass} text-left`}  style={{ width: "5%" }}></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-(--cl-surface)">
                                    {fields.map((field, idx) => {
                                        const line = lines[idx];
                                        if (!line) return null;
                                        const c = calcLine(line, isIgst);
                                        return (
                                            <tr key={field.id} className="hover:bg-(--cl-surface-2)/30 group transition-colors">
                                                <td className={`${tdClass} pl-4 text-xs font-medium text-(--cl-text-muted)`}>{idx + 1}</td>

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
                                                            const effectiveGstRate = isGstMode
                                                                ? (masterGstRate === 0 ? defaultGstRate : masterGstRate)
                                                                : 0;
                                                            const baseCostPrice  = Number(part.cost_price ?? 0);
                                                            const gstRateForCalc = masterGstRate > 0 ? masterGstRate : (Number(defaultGstRate) || 0);

                                                            let computedCostPrice: number;
                                                            let unitPrice: number;

                                                            if (isGstMode) {
                                                                computedCostPrice = baseCostPrice;
                                                                // MRP is GST-inclusive; the Price field holds the pre-GST
                                                                // (taxable) price, so back the tax out of MRP to derive it.
                                                                const mrpExGst = Number(part.mrp) > 0
                                                                    ? Math.round((Number(part.mrp) / (1 + gstRateForCalc / 100)) * 100) / 100
                                                                    : 0;
                                                                const markupPrice = Math.round(baseCostPrice * (1 + markupPct / 100) * 100) / 100;
                                                                unitPrice = mrpExGst || Number(part.selling_price) || markupPrice;
                                                            } else {
                                                                computedCostPrice = Math.round(baseCostPrice * (1 + gstRateForCalc / 100) * 100) / 100;
                                                                const sellingWithGst = Number(part.selling_price) > 0
                                                                    ? Math.round(Number(part.selling_price) * (1 + gstRateForCalc / 100) * 100) / 100
                                                                    : 0;
                                                                const markupPrice = Math.round(computedCostPrice * (1 + markupPct / 100) * 100) / 100;
                                                                unitPrice = Number(part.mrp) || sellingWithGst || markupPrice;
                                                            }

                                                            updateLine(idx, {
                                                                part_id:    part.id,
                                                                brand_id:   part.brand_id,
                                                                part_code:  part.part_code,
                                                                part_name:  part.part_name,
                                                                uom:        part.uom,
                                                                hsn_code:   part.hsn_code ?? "",
                                                                unit_price: unitPrice,
                                                                cost_price: computedCostPrice,
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
                                                        disabled={!isGstMode}
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white ${!isGstMode ? "opacity-50 cursor-not-allowed" : ""} ${isGstMode && (line.unit_price > 0 || line.gst_rate > 0) && !line.hsn_code.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                        placeholder="HSN"
                                                        value={line.hsn_code}
                                                        onChange={e => updateLine(idx, { hsn_code: e.target.value })}
                                                    />
                                                </td>

                                                {/* Qty */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right ${line.qty <= 0 ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.qty}
                                                        onChange={e => updateLine(idx, { qty: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* Price */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-medium`}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={line.unit_price}
                                                        onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {/* Aggregate (read-only) */}
                                                <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-(--cl-text-muted) border-l border-(--cl-border) bg-(--cl-surface-2)/40`}>
                                                    {formatNumber(c.aggregate)}
                                                </td>

                                                {/* GST % */}
                                                <td className={tdClass}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-semibold text-(--cl-accent) ${!isGstMode ? "opacity-50 cursor-not-allowed" : ""}`}
                                                        disabled={!isGstMode}
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={isGstMode ? line.gst_rate : 0}
                                                        onChange={e => updateLine(idx, { gst_rate: Number(e.target.value) })}
                                                        onFocus={e => e.target.select()}
                                                    />
                                                </td>

                                                {!isIgst ? (
                                                    <>
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-(--cl-text-muted) bg-(--cl-surface-2)/40`}>
                                                            {formatNumber(c.cgstAmt)}
                                                        </td>
                                                        <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-(--cl-text-muted) bg-(--cl-surface-2)/40`}>
                                                            {formatNumber(c.sgstAmt)}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className={`${tdClass} px-2 text-right pt-1 font-mono tabular-nums text-(--cl-text-muted) bg-(--cl-surface-2)/40`} title="IGST Amount">
                                                        {formatNumber(c.igstAmt)}
                                                    </td>
                                                )}

                                                {isGstMode && (
                                                    <GstPriceCell
                                                        gstRate={line.gst_rate}
                                                        inputCls={inputCls}
                                                        tdClass={tdClass}
                                                        unitPrice={line.unit_price}
                                                        onCommit={newUnitPrice => updateLine(idx, { unit_price: newUnitPrice })}
                                                    />
                                                )}

                                                {/* Total */}
                                                <td className={`${tdClass} px-2 text-right pt-1 font-mono font-semibold tabular-nums text-(--cl-text) bg-(--cl-surface-2)/40`}>
                                                    {formatNumber(c.total)}
                                                </td>

                                                {/* Remarks */}
                                                <td className={`${tdClass} relative`}>
                                                    <Input
                                                        className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white`}
                                                        placeholder="Remarks"
                                                        value={line.remarks}
                                                        onChange={e => updateLine(idx, { remarks: e.target.value })}
                                                    />
                                                    {(() => {
                                                        const profit = (line.unit_price - (line.cost_price ?? 0)) * line.qty;
                                                        return (
                                                            <span
                                                                title="Line profit"
                                                                className={`pointer-events-none absolute bottom-0.5 right-1 flex items-center gap-0.5 rounded px-1 text-[9px] font-bold leading-none tabular-nums ${
                                                                    profit < 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"
                                                                }`}
                                                            >
                                                                <span className="opacity-60">P</span>
                                                                {formatNumber(profit)}
                                                            </span>
                                                        );
                                                    })()}
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
                                <tfoot>
                                    <tr className="bg-(--cl-surface-2)/60">
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-semibold text-(--cl-text)">
                                            {formatNumber(totals.qty)}
                                        </td>
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-semibold text-(--cl-text)">
                                            ₹{formatNumber(totals.aggregate)}
                                        </td>
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                        {!isIgst ? (
                                            <>
                                                <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-semibold text-(--cl-text)">
                                                    ₹{formatNumber(totals.cgst)}
                                                </td>
                                                <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-semibold text-(--cl-text)">
                                                    ₹{formatNumber(totals.sgst)}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-semibold text-(--cl-text)">
                                                ₹{formatNumber(totals.igst)}
                                            </td>
                                        )}
                                        {isGstMode && <td className="p-0.5 border-t border-(--cl-border)" />}
                                        <td className="p-0.5 border-t border-(--cl-border) text-right px-2 font-mono tabular-nums text-xs font-bold text-(--cl-accent)">
                                            ₹{formatNumber(totals.total)}
                                        </td>
                                        <td className="p-0.5 border-t border-(--cl-border) text-right px-1" title="Total profit">
                                            <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-bold leading-none tabular-nums ${
                                                totals.profit < 0 ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"
                                            }`}>
                                                <span className="opacity-60">P</span>
                                                ₹{formatNumber(totals.profit)}
                                            </span>
                                        </td>
                                        <td className="p-0.5 border-t border-(--cl-border)" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {fields.length === 0 && (
                            <div className="py-12 text-center text-(--cl-text-muted) text-sm italic">
                                No line items added yet. Click the "+" icon to insert a row.
                            </div>
                        )}
                    </Card>

                    {/* Summary bar */}
                    <div ref={summaryRef} style={{ alignSelf: "flex-end", width: "fit-content" }} className={`rounded-lg border px-4 py-2.5 flex items-center gap-x-4 ${isReturn ? "border-orange-500/30 bg-orange-500/5" : "border-(--cl-border) bg-(--cl-surface-2)/40"}`}>
                        {/* Target Amount + Back Calculate — left side */}
                        <div className="flex items-center gap-2">
                            <Input
                                className="h-7 w-36 text-right text-sm font-bold border-(--cl-border) bg-white"
                                min="0"
                                step="0.01"
                                type="number"
                                placeholder="Target Amount…"
                                value={backCalcTarget}
                                onChange={e => setBackCalcTarget(e.target.value)}
                                onFocus={e => e.target.select()}
                            />
                            <Button
                                className="h-7 cursor-pointer text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={!hasTarget}
                                size="sm"
                                type="button"
                                onClick={() => applyBackCalcTarget(backCalcNum)}
                            >
                                Back Calculate
                            </Button>
                            {backCalcTarget && (
                                <Button
                                    className="h-7 text-xs"
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => setBackCalcTarget("")}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>

                        {/* Totals — right side */}
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap justify-end">
                            {(() => {
                                const displayTotal = hasTarget ? backCalcNum : totals.total;
                                const diff         = hasTarget ? Math.round((backCalcNum - totals.total) * 100) / 100 : 0;
                                const hasDiff      = Math.abs(diff) >= 0.005;
                                return (
                                    <>
                                        {hasTarget && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-(--cl-text-muted)">Calculated</span>
                                                <span className="font-bold tabular-nums text-sm text-(--cl-text)">₹{formatNumber(totals.total)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-600">Diff</span>
                                            <span className={`font-bold tabular-nums text-sm ${hasDiff ? "text-amber-700" : "text-emerald-600"}`}>
                                                {diff > 0 ? "+" : ""}{formatNumber(diff)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 pl-4 border-l border-(--cl-border)">
                                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-(--cl-text-muted)">Total</span>
                                            <span className="font-black tabular-nums text-base text-(--cl-accent)">₹{formatNumber(displayTotal)}</span>
                                            <button
                                                className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-(--cl-surface-2) border border-(--cl-border) text-(--cl-text-muted) hover:bg-(--cl-accent) hover:text-white hover:border-(--cl-accent) cursor-pointer transition-all shadow-sm"
                                                title="Round off to nearest rupee"
                                                type="button"
                                                onClick={() => {
                                                    const rounded = Math.round(displayTotal);
                                                    setBackCalcTarget(String(rounded));
                                                    applyBackCalcTarget(rounded);
                                                }}
                                            >
                                                <Radius className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {isSubmitting && (
                        <div className="flex items-center justify-center gap-2 py-2 text-sm text-(--cl-text-muted)">
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
}
