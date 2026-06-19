import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
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
import { selectAvailableDivisions, selectDefaultDivisionId, selectEffectiveGstStateCode, selectDefaultGstRate, selectSchema } from "@/store/context-slice";
import type { VendorType } from "@/features/client/types/vendor";
import type { PurchaseInvoiceType, PurchaseLineFormItem, StockTransactionTypeRow } from "@/features/client/types/purchase";
import type { PurchaseInvoiceFormValues } from "./purchase-invoice-schema";
import { getPurchaseInvoiceDefaultValues } from "./purchase-invoice-schema";

import { PartCodeInput } from "../part-code-input";
import { MasterDataDiffModal } from "./master-data-diff-modal";
import { PhysicalInvoiceModal, type PhysicalValues } from "./physical-invoice-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type GenericQueryData<T> = { genericQuery: T[] | null };

export type PurchaseInvoiceHandle = {
    triggerSave: () => void;
};

type Props = {
    branchId:           number | null;
    brandName?:         string;
    editInvoice?:       PurchaseInvoiceType | null;
    isIgst:             boolean;
    isReturn:           boolean;
    onIsIgstChange:     (v: boolean) => void;
    onIsReturnChange:   (v: boolean) => void;
    selectedBrandId:    number | null;
    txnTypes:           StockTransactionTypeRow[];
    vendors:            VendorType[];
    onLinesValidChange: (v: boolean) => void;
    onDupStateChange:   (v: { invoiceExists: boolean; checkingDuplicate: boolean }) => void;
    onSaveSuccess:      () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyLine(brandId: number | null = null): PurchaseLineFormItem {
    return {
        _key:             crypto.randomUUID(),
        part_id:          null,
        brand_id:         brandId,
        part_code:        "",
        part_name:        "",
        uom:              "",
        hsn_code:         "",
        qty:         1,
        unit_price:       0,
        gst_rate:         0,
        cgst_rate:        0,
        sgst_rate:        0,
        igst_rate:        0,
        under_warranty:   false,
        remarks:          "",
        _orig_hsn_code:   null,
        _orig_cost_price: null,
        _orig_gst_rate:   null,
    };
}

function calcLine(l: PurchaseLineFormItem) {
    const aggregate = l.qty * l.unit_price;
    const cgstAmt   = aggregate * l.cgst_rate / 100;
    const sgstAmt   = aggregate * l.sgst_rate / 100;
    const igstAmt   = aggregate * l.igst_rate / 100;
    return { aggregate, cgstAmt, sgstAmt, igstAmt, total: aggregate + cgstAmt + sgstAmt + igstAmt };
}

function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const thClass = "sticky top-0 z-20 text-xs font-extrabold uppercase tracking-widest text-(--cl-text) py-2 px-2 text-left border-b border-(--cl-border) bg-zinc-200/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-[0_1px_0_var(--cl-border)]";
const tdClass = "p-0.5 border-b border-(--cl-border)";
const inputCls = "h-7 border-(--cl-border) bg-white text-sm px-2";

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPurchaseInvoice = forwardRef<PurchaseInvoiceHandle, Props>(
    function NewPurchaseInvoice({
        branchId, brandName, editInvoice, isIgst, isReturn,
        onIsIgstChange, onIsReturnChange, selectedBrandId,
        txnTypes, vendors, onLinesValidChange, onDupStateChange, onSaveSuccess,
    }, ref) {
        const dbName                = useAppSelector(selectDbName);
        const schema                = useAppSelector(selectSchema);
        const defaultGstRate        = useAppSelector(selectDefaultGstRate);
        const effectiveGstStateCode = useAppSelector(selectEffectiveGstStateCode);
        const availableDivisions    = useAppSelector(selectAvailableDivisions);
        const defaultDivisionId     = useAppSelector(selectDefaultDivisionId);

        const form        = useFormContext<PurchaseInvoiceFormValues>();
        const vendorId    = form.watch("vendor_id");
        const divisionId  = form.watch("division_id");

        const isGstRegistered = !!availableDivisions.find(d => d.id === divisionId)?.gstin;
        const invoiceNo   = form.watch("invoice_no");
        const invoiceDate = form.watch("invoice_date");

        const { fields, remove, insert, replace, update } = useFieldArray({
            control: form.control,
            name: "lines",
        });

        // Line items
        const [originalLineIds, setOriginalLineIds] = useState<number[]>([]);
        const physicalValuesRef = useRef<PhysicalValues>({ qty: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

        // Duplicate check
        const [invoiceExists,     setInvoiceExists]     = useState(false);
        const [checkingDuplicate, setCheckingDuplicate] = useState(false);

        // Submission
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
                const top           = el.getBoundingClientRect().top;
                const summaryHeight = summaryRef.current?.getBoundingClientRect().height ?? 0;
                // 14px = clearance from ClientLayout; 8px = gap between table and summary
                setMaxTableHeight(window.innerHeight - top - summaryHeight - 8 - 14);
            }
            recalc();
            window.addEventListener("resize", recalc);
            return () => window.removeEventListener("resize", recalc);
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
                setOriginalLineIds([]);
                setInvoiceExists(false);
                setShowPhysicalCheckModal(false);
                setMasterDiffLines([]);
                return;
            }
            if (!dbName || !schema) return;
            apolloClient.query<GenericQueryData<PurchaseInvoiceType & { lines: import("@/features/client/types/purchase").PurchaseLineType[] }>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_PURCHASE_INVOICE_DETAIL,
                        sqlArgs: { id: editInvoice.id },
                    }),
                },
            }).then(res => {
                const detail = res.data?.genericQuery?.[0];
                if (!detail) return;
                const loadedLines = (detail.lines ?? []).map(l => ({
                    _key:             crypto.randomUUID(),
                    part_id:          l.part_id,
                    brand_id:         selectedBrandId,
                    part_code:        l.part_code,
                    part_name:        l.part_name,
                    uom:              "",
                    hsn_code:         l.hsn_code,
                    qty:         Number(l.qty),
                    unit_price:       Number(l.unit_price),
                    gst_rate:         Number(l.gst_rate),
                    cgst_rate:        l.igst_amount > 0 ? 0 : Number(l.gst_rate) / 2,
                    sgst_rate:        l.igst_amount > 0 ? 0 : Number(l.gst_rate) / 2,
                    igst_rate:        l.igst_amount > 0 ? Number(l.gst_rate) : 0,
                    under_warranty:   Boolean(l.under_warranty),
                    remarks:          l.remarks ?? "",
                    _orig_hsn_code:   l.hsn_code,
                    _orig_cost_price: Number(l.unit_price),
                    _orig_gst_rate:   Number(l.gst_rate),
                }));
                form.reset({
                    vendor_id:    detail.supplier_id,
                    division_id:  (detail as any).division_id ?? defaultDivisionId,
                    invoice_no:   detail.invoice_no,
                    invoice_date: detail.invoice_date,
                    remarks:      detail.remarks ?? "",
                    lines:        loadedLines,
                });
                onIsReturnChange(Boolean(detail.is_return));
                setInvoiceExists(false);
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

        // Report lines validity to section
        const linesValid = useMemo(() => {
            if (fields.length === 0) return false;
            return fields.every(l => {
                if (!l.part_id || l.qty <= 0) return false;
                const isGstApplicable = l.unit_price > 0 || l.gst_rate > 0;
                if (isGstApplicable && !l.hsn_code.trim()) return false;
                return true;
            });
        }, [fields]);

        useEffect(() => {
            onLinesValidChange(linesValid);
        }, [linesValid, onLinesValidChange]);

        // Report dup state to section
        useEffect(() => {
            onDupStateChange({ invoiceExists, checkingDuplicate });
        }, [invoiceExists, checkingDuplicate, onDupStateChange]);

        // Line mutations
        const updateLine = (idx: number, patch: Partial<PurchaseLineFormItem>) => {
            const current = form.getValues(`lines.${idx}`);
            const next = { ...current, ...patch };
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
            update(idx, next);
        };

        // Recalc rates when isIgst changes
        useEffect(() => {
            if (!fields.length) return;
            replace(fields.map(l => isIgst
                ? { ...l, igst_rate: l.gst_rate, cgst_rate: 0, sgst_rate: 0 }
                : { ...l, igst_rate: 0, cgst_rate: l.gst_rate / 2, sgst_rate: l.gst_rate / 2 }
            ));
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [isIgst]);

        const insertLine = (idx: number) => {
            insert(idx + 1, emptyLine(selectedBrandId));
        };

        const removeLine = (idx: number) => {
            if (fields.length > 1) remove(idx);
        };

        // Totals
        const totals = useMemo(() => {
            let qty = 0, aggregate = 0, cgst = 0, sgst = 0, igst = 0;
            for (const l of fields) {
                const c  = calcLine(l);
                qty  += l.qty;
                aggregate += c.aggregate;
                cgst      += c.cgstAmt;
                sgst      += c.sgstAmt;
                igst      += c.igstAmt;
            }
            return { qty, aggregate, cgst, sgst, igst, total_tax: cgst + sgst + igst, total: aggregate + cgst + sgst + igst };
        }, [fields]);

        // executeSave: fires the actual DB mutation
        const executeSave = async (physical: PhysicalValues) => {
            const { vendor_id, invoice_no, invoice_date, remarks } = form.getValues();
            const lines           = form.getValues("lines");
            const purchaseTypeId  = txnTypes.find(t => t.code === "PURCHASE")?.id;
            const returnTypeId    = txnTypes.find(t => t.code === "PURCHASE_RETURN")?.id;
            const warrantyTypeId  = txnTypes.find(t => t.code === "WARRANTY_IN")?.id;
            const hasWarrantyLine = lines.some(l => l.under_warranty);
            if (!purchaseTypeId || (isReturn && !returnTypeId) || (hasWarrantyLine && !isReturn && !warrantyTypeId)
                || !branchId || !dbName || !schema || !vendor_id || !invoice_no.trim() || !invoice_date) {
                toast.error(MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
                return;
            }

            const linePayload = lines.map(line => {
                const c         = calcLine(line);
                const txnTypeId = isReturn ? returnTypeId : (line.under_warranty ? warrantyTypeId : purchaseTypeId);
                const drCr      = isReturn ? "C" : "D";
                return {
                    part_id:          line.part_id,
                    hsn_code:         line.hsn_code,
                    qty:              line.qty,
                    unit_price:       line.unit_price,
                    under_warranty:   line.under_warranty,
                    remarks:          line.remarks.trim() || null,
                    aggregate_amount: c.aggregate,
                    gst_rate:         line.gst_rate,
                    cgst_amount:      c.cgstAmt,
                    sgst_amount:      c.sgstAmt,
                    igst_amount:      c.igstAmt,
                    total_amount:     c.total,
                    xDetails: [
                        {
                            tableName: "stock_transaction",
                            fkeyName:  "purchase_line_id",
                            xData: [{
                                branch_id:                 branchId,
                                part_id:                   line.part_id,
                                qty:                       line.qty,
                                unit_cost:                 (isReturn || line.under_warranty) ? 0 : line.unit_price,
                                dr_cr:                     drCr,
                                transaction_date:          invoice_date,
                                stock_transaction_type_id: txnTypeId,
                            }],
                        },
                        ...(!isReturn && !line.under_warranty ? [{
                            tableName: "spare_part_master",
                            xData: [{
                                id: line.part_id!,
                                ...(line.hsn_code.trim()  && { hsn_code:   line.hsn_code.trim() }),
                                ...(line.unit_price > 0   && { cost_price: line.unit_price }),
                                ...(line.gst_rate   > 0   && { gst_rate:   line.gst_rate }),
                            }],
                        }] : []),
                    ],
                };
            });

            const headerFields = {
                supplier_id:   vendor_id,
                invoice_no:    invoice_no.trim(),
                invoice_date:  invoice_date,
                aggregate_amount: totals.aggregate,
                cgst_amount:   physical.cgst,
                sgst_amount:   physical.sgst,
                igst_amount:   physical.igst,
                total_tax:     isIgst ? physical.igst : (physical.cgst + physical.sgst),
                total_amount:  physical.total,
                brand_id:      selectedBrandId,
                remarks:       remarks?.trim() || null,
                is_return:     isReturn,
            };

            setSubmitting(true);
            try {
                if (editInvoice) {
                    const payload = graphQlUtils.buildGenericUpdateValue({
                        tableName: "purchase_invoice",
                        xData: {
                            id: editInvoice.id,
                            ...headerFields,
                            xDetails: {
                                tableName:  "purchase_invoice_line",
                                fkeyName:   "purchase_invoice_id",
                                deletedIds: originalLineIds,
                                xData:      linePayload,
                            },
                        },
                    });
                    await apolloClient.mutate({
                        mutation:  GRAPHQL_MAP.genericUpdate,
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
                                fkeyName:  "purchase_invoice_id",
                                xData:     linePayload,
                            },
                        },
                    });
                    await apolloClient.mutate({
                        mutation:  GRAPHQL_MAP.genericUpdate,
                        variables: { db_name: dbName, schema, value: payload },
                    });
                    toast.success(MESSAGES.SUCCESS_PURCHASE_CREATED);
                }
                setShowPhysicalCheckModal(false);
                setMasterDiffLines([]);
                form.reset(getPurchaseInvoiceDefaultValues(defaultDivisionId));
                setOriginalLineIds([]);
                setInvoiceExists(false);
                onSaveSuccess();
            } catch {
                toast.error(editInvoice ? MESSAGES.ERROR_PURCHASE_UPDATE_FAILED : MESSAGES.ERROR_PURCHASE_CREATE_FAILED);
            } finally {
                setSubmitting(false);
            }
        };

        // handleConfirmedSubmit: called from physical check modal once user values are validated
        const handleConfirmedSubmit = async (physical: PhysicalValues) => {
            physicalValuesRef.current = physical;
            const lines = form.getValues("lines");
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
            await executeSave(physical);
        };

        // triggerSave: validates then opens physical check modal
        const triggerSave = async () => {
            const { vendor_id, invoice_no, invoice_date } = form.getValues();
            const lines = form.getValues("lines");
            if (!branchId) { toast.error("Branch is not selected globally."); return; }
            if (!vendor_id) { toast.error(MESSAGES.ERROR_PURCHASE_SUPPLIER_REQUIRED); return; }
            if (!invoice_no.trim()) { toast.error(MESSAGES.ERROR_PURCHASE_INVOICE_NO_REQUIRED); return; }
            if (!invoice_date) { toast.error(MESSAGES.ERROR_PURCHASE_DATE_REQUIRED); return; }
            if (lines.length === 0 || lines.some(l => {
                if (!l.part_id || l.qty <= 0) return true;
                const isGstApplicable = l.unit_price > 0 || l.gst_rate > 0;
                if (isGstApplicable && !l.hsn_code.trim()) return true;
                return false;
            })) {
                toast.error(MESSAGES.ERROR_PURCHASE_LINE_FIELDS_REQUIRED);
                return;
            }
            if (invoiceExists) { toast.error(MESSAGES.ERROR_PURCHASE_INVOICE_EXISTS); return; }
            setShowPhysicalCheckModal(true);
        };

        useImperativeHandle(ref, () => ({ triggerSave }));

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex min-h-fit md:min-h-0 md:flex-1 flex-col gap-2 pb-0 md:overflow-hidden"
            >
                {!branchId ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-(--cl-surface-2)/30 rounded-xl border-2 border-dashed border-(--cl-border) text-center">
                        <div className="bg-(--cl-accent)/5 p-5 rounded-full mb-4">
                            <Plus className="h-12 w-12 text-(--cl-accent) opacity-40" />
                        </div>
                        <h3 className="text-lg font-semibold text-(--cl-text) mb-2">No Branch Selected</h3>
                        <p className="text-(--cl-text-muted) max-w-md px-6">
                            Please select a target branch from the global header to start recording a new purchase invoice.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted) px-1 mb-1 flex items-center gap-2">
                            Invoice Details
                            {isReturn && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">Return</span>}
                        </p>
                        <Card className={`border-(--cl-border) shadow-md !overflow-visible bg-(--cl-surface) ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                            <CardContent className="pt-4 !overflow-visible">
                                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-x-2 gap-y-2">
                                    {/* Vendor */}
                                    <SearchableCombobox
                                        className="md:col-span-2 lg:col-span-4"
                                        isError={!vendorId}
                                        label={<span>Supplier <span className="text-red-500 ml-0.5">*</span></span>}
                                        placeholder="Search supplier..."
                                        selectedValue={String(vendorId || "")}
                                        onSelect={v => form.setValue("vendor_id", v?.id ?? 0, { shouldValidate: true })}
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
                                        <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                            Invoice No <span className="text-red-500 ml-0.5">*</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                {...form.register("invoice_no")}
                                                className={`bg-(--cl-surface-2) pr-8 ${(!invoiceNo.trim() || invoiceExists) ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                                placeholder="Invoice #"
                                            />
                                            {checkingDuplicate && (
                                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-(--cl-text-muted)" />
                                            )}
                                        </div>
                                        {invoiceExists && (
                                            <p className="text-xs text-red-500 mt-1.5 font-medium">Already exists</p>
                                        )}
                                    </div>

                                    {/* Invoice Date */}
                                    <div className="space-y-2 md:col-span-1 lg:col-span-2">
                                        <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                            Inv Date <span className="text-red-500 ml-0.5">*</span>
                                        </Label>
                                        <Input
                                            {...form.register("invoice_date")}
                                            className={`bg-(--cl-surface-2) ${!invoiceDate ? "border-red-500 focus:border-red-500 ring-red-500/10" : ""}`}
                                            type="date"
                                        />
                                    </div>

                                    {/* Remarks */}
                                    <div className="space-y-2 md:col-span-3 lg:col-span-2">
                                        <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">Remarks</Label>
                                        <Input
                                            {...form.register("remarks")}
                                            className="bg-(--cl-surface-2)"
                                            placeholder="Optional..."
                                        />
                                    </div>

                                    {/* Division */}
                                    {availableDivisions.length > 0 && (
                                        <div className="space-y-2 md:col-span-3 lg:col-span-2">
                                            <Label className="text-xs font-extrabold text-(--cl-text) uppercase tracking-widest">
                                                Division <span className="text-red-500 ml-0.5">*</span>
                                            </Label>
                                            <select
                                                className={`w-full rounded-md border px-3 py-2 text-sm bg-(--cl-surface-2) text-(--cl-text) focus:outline-none focus:ring-2 focus:ring-(--cl-accent)/30 ${
                                                    !divisionId ? "border-red-500" : "border-(--cl-border)"
                                                }`}
                                                value={divisionId || ""}
                                                onChange={e => form.setValue("division_id", e.target.value ? Number(e.target.value) : 0, { shouldValidate: true })}
                                            >
                                                <option value="">Select division…</option>
                                                {availableDivisions.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Line Items Table */}
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--cl-text-muted) my-2">Line Items</p>
                        <Card className={`border-(--cl-border) shadow-sm flex min-h-0 md:flex-1 flex-col relative bg-(--cl-surface) ${isReturn ? "border-l-4 border-l-red-500" : ""}`}>
                            <div
                                ref={scrollWrapperRef}
                                className="w-full overflow-x-auto overflow-y-auto pb-4"
                                style={maxTableHeight !== undefined ? { maxHeight: maxTableHeight } : undefined}
                            >
                                <table className="min-w-[860px] w-full border-collapse text-sm sticky-header">
                                    <thead>
                                        <tr className="bg-(--cl-surface-2)/50">
                                            <th className={thClass} style={{ width: "2%" }}>#</th>
                                            <th className={thClass} style={{ width: "20%" }}>Part <span className="text-red-500 ml-0.5">*</span></th>
                                            <th className={`${thClass} text-center`} style={{ width: "4%" }} title="Under Warranty"><ShieldOff className="h-3.5 w-3.5 mx-auto" /></th>
                                            <th className={thClass} style={{ width: "8%" }}>HSN</th>
                                            <th className={`${thClass} text-right`} style={{ width: "6%" }}>Qty <span className="text-red-500 ml-0.5">*</span></th>
                                            <th className={`${thClass} text-right`} style={{ width: "8%" }}>Price</th>
                                            <th className={`${thClass} text-right border-l border-(--cl-border)`} style={{ width: "8%" }}>Subtotal</th>
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
                                    <tbody className="bg-(--cl-surface)">
                                        {fields.map((line, idx) => {
                                            const c = calcLine(line);
                                            return (
                                                <tr key={line._key} className="hover:bg-(--cl-surface-2)/30 group transition-colors align-top">
                                                    <td className={`${tdClass} pt-2 pl-4 text-xs font-medium text-(--cl-text-muted)`}>{idx + 1}</td>

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
                                                                if (!code.trim()) {
                                                                    updateLine(idx, { part_code: "", part_id: null, part_name: "", hsn_code: "", unit_price: 0, gst_rate: 0, cgst_rate: 0, sgst_rate: 0, igst_rate: 0 });
                                                                } else {
                                                                    updateLine(idx, { part_code: code });
                                                                }
                                                            }}
                                                            onClear={() => updateLine(idx, { part_code: "", part_id: null, part_name: "", hsn_code: "", unit_price: 0, gst_rate: 0, cgst_rate: 0, sgst_rate: 0, igst_rate: 0 })}
                                                            onSelect={part => {
                                                                const masterGstRate    = Number(part.gst_rate ?? 0);
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
                                                    <td className={`${tdClass} text-center pt-1.5`}>
                                                        <button
                                                            type="button"
                                                            title={line.under_warranty ? "Under Warranty — click to remove" : "Not under warranty — click to mark"}
                                                            onClick={() => {
                                                                const checked = !line.under_warranty;
                                                                updateLine(idx, { under_warranty: checked, ...(checked && { unit_price: 0 }) });
                                                            }}
                                                            className={`mx-auto flex h-6 w-6 items-center justify-center rounded transition-all cursor-pointer ${
                                                                line.under_warranty
                                                                    ? "bg-emerald-600 text-white shadow-sm"
                                                                    : "bg-(--cl-surface-2) text-(--cl-text-muted) hover:bg-emerald-600/20 hover:text-emerald-600"
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
                                                            className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white ${(line.unit_price > 0 || line.gst_rate > 0) && !line.hsn_code.trim() ? "border-red-500 focus:border-red-500 ring-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}`}
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
                                                            className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-medium ${line.under_warranty ? "opacity-50 cursor-not-allowed" : ""}`}
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
                                                    <td className={`${tdClass} text-right pt-2 font-mono tabular-nums text-sm font-medium text-(--cl-text) border-l border-(--cl-border) bg-(--cl-surface-2)/40`}>
                                                        {formatNumber(c.aggregate)}
                                                    </td>

                                                    {/* GST % */}
                                                    <td className={tdClass}>
                                                        <Input
                                                            className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white text-right font-semibold text-(--cl-accent)`}
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
                                                            <td className={`${tdClass} px-2 text-right pt-1.5 font-mono tabular-nums text-sm font-medium text-(--cl-text-muted) bg-(--cl-surface-2)/40`}>
                                                                {formatNumber(c.cgstAmt)}
                                                            </td>
                                                            <td className={`${tdClass} px-2 text-right pt-1.5 font-mono tabular-nums text-sm font-medium text-(--cl-text-muted) bg-(--cl-surface-2)/40`}>
                                                                {formatNumber(c.sgstAmt)}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td className={`${tdClass} px-2 text-right pt-1.5 font-mono tabular-nums text-sm font-medium text-(--cl-text-muted) bg-(--cl-surface-2)/40`} title="IGST Amount">
                                                            {formatNumber(c.igstAmt)}
                                                        </td>
                                                    )}

                                                    {/* Total */}
                                                    <td className={`${tdClass} p-2 text-right font-mono tabular-nums text-sm font-semibold text-(--cl-text) bg-(--cl-surface-2)/40`}>
                                                        {formatNumber(c.total)}
                                                    </td>

                                                    {/* Remarks */}
                                                    <td className={tdClass}>
                                                        <Input
                                                            className={`${inputCls} bg-transparent border-transparent hover:border-(--cl-border) focus:bg-white`}
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
                                <div className="py-12 text-center text-(--cl-text-muted) text-sm italic">
                                    No line items added yet. Click the "+" icon to insert a row.
                                </div>
                            )}
                        </Card>

                        {/* Summary Bar */}
                        <div ref={summaryRef} className={`rounded-lg border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 justify-end ${isReturn ? "border-red-500/30 bg-red-500/5" : "border-(--cl-border) bg-(--cl-surface-2)/40"}`}>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Lines</span>
                                <span className="font-mono font-semibold text-sm text-(--cl-text)">{fields.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Qty</span>
                                <span className="font-mono font-semibold text-sm text-(--cl-text)">{formatNumber(totals.qty)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Subtotal</span>
                                <span className="font-mono font-semibold text-sm text-(--cl-text)">₹{formatNumber(totals.aggregate)}</span>
                            </div>
                            {totals.cgst > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">CGST</span>
                                    <span className="font-mono font-semibold text-sm text-(--cl-text-muted)">₹{formatNumber(totals.cgst)}</span>
                                </div>
                            )}
                            {totals.sgst > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">SGST</span>
                                    <span className="font-mono font-semibold text-sm text-(--cl-text-muted)">₹{formatNumber(totals.sgst)}</span>
                                </div>
                            )}
                            {totals.igst > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">IGST</span>
                                    <span className="font-mono font-semibold text-sm text-(--cl-text-muted)">₹{formatNumber(totals.igst)}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Total Tax</span>
                                <span className="font-mono font-semibold text-sm text-(--cl-text-muted)">₹{formatNumber(totals.total_tax)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 border-l border-(--cl-border) pl-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-(--cl-text-muted)">Total</span>
                                <span className="font-mono font-black text-base text-(--cl-accent)">₹{formatNumber(totals.total)}</span>
                            </div>
                            {editInvoice && (
                                <div className="flex items-center gap-1.5 border-l border-amber-500/30 pl-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Saved</span>
                                    <span className="font-mono font-semibold text-sm text-amber-700">₹{formatNumber(editInvoice.total_amount)}</span>
                                </div>
                            )}
                        </div>

                        {/* Master Data Diff Confirmation Modal */}
                        <MasterDataDiffModal
                            isOpen={masterDiffLines.length > 0}
                            masterDiffLines={masterDiffLines}
                            onClose={() => setMasterDiffLines([])}
                            onConfirm={() => void executeSave(physicalValuesRef.current)}
                            submitting={submitting}
                        />

                        {/* Physical Invoice Verification Modal */}
                        <PhysicalInvoiceModal
                            isOpen={showPhysicalCheckModal}
                            onClose={() => setShowPhysicalCheckModal(false)}
                            onSubmit={physical => void handleConfirmedSubmit(physical)}
                            submitting={submitting}
                            isIgst={isIgst}
                            totals={totals}
                        />
                    </>
                )}
            </motion.div>
        );
    }
);
