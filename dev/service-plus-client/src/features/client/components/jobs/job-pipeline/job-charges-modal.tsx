import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Package, Plus, ReceiptText, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { PartCodeInput, type PartRow } from "@/features/client/components/inventory/part-code-input";
import type { BrandOption } from "@/features/client/types/model";
import { ChargeNameCombobox } from "../final-a-job/charge-name-combobox";
import type { AdditionalChargeMasterRow } from "../final-a-job/final-a-job-schema";
import { STATUS_COLORS } from "./status-transitions";
import { useAppSelector } from "@/store/hooks";
import { selectDefaultGstRate, selectDefaultHsnForSparePart, selectDefaultHsnForServiceCharge } from "@/store/context-slice";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChargesJobSummary = {
    id:              number;
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    job_status_code: string;
};

type Props = {
    job:     ChargesJobSummary;
    dbName:  string;
    schema:  string;
    onClose: () => void;
    onSaved: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Schema ───────────────────────────────────────────────────────────────────

const partRowSchema = z.object({
    id:            z.number().nullable(),
    part_id:       z.number().nullable(),
    part_code:     z.string(),
    part_name:     z.string(),
    uom:           z.string(),
    qty:           z.number(),
    cost_price:    z.number().nullable(),
    selling_price: z.number().nullable(),
    remarks:       z.string(),
    gst_rate:      z.number().nullable(),
    hsn_code:      z.string().nullable(),
});

const chargeRowSchema = z.object({
    id:            z.number().nullable(),
    charge_name:   z.string(),
    ref_no:        z.string(),
    description:   z.string(),
    cost_price:    z.number(),
    selling_price: z.number(),
    gst_rate:      z.number(),
    hsn_code:      z.string().nullable(),
});

const formSchema = z.object({
    parts:   z.array(partRowSchema),
    charges: z.array(chargeRowSchema),
});

type FormValues  = z.infer<typeof formSchema>;
type PartItem    = FormValues["parts"][number];
type ChargeItem  = FormValues["charges"][number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newPartRow(): PartItem {
    return { id: null, part_id: null, part_code: "", part_name: "", uom: "", qty: 1, cost_price: null, selling_price: null, remarks: "", gst_rate: null, hsn_code: null };
}

function newChargeRow(): ChargeItem {
    return { id: null, charge_name: "", ref_no: "", description: "", cost_price: 0, selling_price: 0, gst_rate: 0, hsn_code: null };
}

function applyMarkup(costPrice: number | null, markupPct: number): number | null {
    if (costPrice == null) return null;
    return Math.round(costPrice * (1 + markupPct / 100) * 100) / 100;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const JobChargesModal = ({ job, dbName, schema, onClose, onSaved }: Props) => {
    const defaultGstRate           = useAppSelector(selectDefaultGstRate);
    const defaultHsnForSparePart   = useAppSelector(selectDefaultHsnForSparePart);
    const defaultHsnForServiceCharge = useAppSelector(selectDefaultHsnForServiceCharge);

    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [markupPct, setMarkupPct] = useState(0);
    const [brands,                setBrands]                = useState<BrandOption[]>([]);
    const [selectedBrandId,       setSelectedBrandId]       = useState<number | null>(null);
    const [chargeOptions,         setChargeOptions]         = useState<AdditionalChargeMasterRow[]>([]);

    const deletedPartIdsRef   = useRef<number[]>([]);
    const deletedChargeIdsRef = useRef<number[]>([]);
    const originalPartsRef    = useRef<PartItem[]>([]);
    const originalChargesRef  = useRef<ChargeItem[]>([]);

    const { control, setValue, watch, reset, getValues } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { parts: [], charges: [] },
    });

    const { fields: partFields,   insert: insertPart,   remove: removePart   } = useFieldArray({ control, name: "parts" });
    const { fields: chargeFields, insert: insertCharge, remove: removeCharge } = useFieldArray({ control, name: "charges" });

    const watchedParts   = watch("parts");
    const watchedCharges = watch("charges");

    // ── Load ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const gq = <T,>(sqlId: string, sqlArgs: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        void Promise.all([
            gq<PartItem>(SQL_MAP.GET_JOB_PART_USED_BY_JOB, { job_id: job.id }),
            gq<ChargeItem>(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: job.id }),
            gq<BrandOption>(SQL_MAP.GET_ALL_BRANDS, {}),
            gq<{ setting_value: unknown }>(SQL_MAP.GET_APP_SETTING_BY_KEY, { setting_key: "markup_percent_over_cost" }),
            gq<AdditionalChargeMasterRow>(SQL_MAP.GET_ALL_ADDITIONAL_CHARGES, {}),
        ]).then(([partsRes, chargesRes, brandsRes, markupRes, chargeOptRes]) => {
            const parts   = partsRes.data?.genericQuery   ?? [];
            const charges = chargesRes.data?.genericQuery ?? [];
            originalPartsRef.current   = parts;
            originalChargesRef.current = charges;
            reset({ parts, charges });
            setBrands(brandsRes.data?.genericQuery ?? []);
            setChargeOptions(chargeOptRes.data?.genericQuery ?? []);
            const rawMarkup = markupRes.data?.genericQuery?.[0]?.setting_value;
            const pct = rawMarkup != null ? Number(rawMarkup) : 0;
            setMarkupPct(isNaN(pct) ? 0 : pct);
        }).catch(() => {
            toast.error("Failed to load job data.");
        }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Part handlers ────────────────────────────────────────────────────────

    function isPartEdited(row: PartItem): boolean {
        if (row.id == null) return false;
        const orig = originalPartsRef.current.find(r => r.id === row.id);
        if (!orig) return false;
        return orig.qty !== row.qty || orig.cost_price !== row.cost_price
            || orig.selling_price !== row.selling_price || orig.remarks !== row.remarks;
    }

    function resetParts() {
        reset({ parts: [...originalPartsRef.current], charges: getValues("charges") });
        deletedPartIdsRef.current = [];
    }

    function resetCharges() {
        reset({ parts: getValues("parts"), charges: [...originalChargesRef.current] });
        deletedChargeIdsRef.current = [];
    }

    function handleDeletePart(index: number, id: number | null) {
        if (id != null) deletedPartIdsRef.current = [...deletedPartIdsRef.current, id];
        removePart(index);
    }

    function handlePartSelect(index: number, part: PartRow) {
        const cost = part.cost_price ?? null;
        const masterSelling = (part.selling_price != null && part.selling_price > 0) ? part.selling_price : null;
        const selling = masterSelling ?? applyMarkup(cost, markupPct);
        const gstRate = (part.gst_rate ?? 0) > 0 ? (part.gst_rate ?? 0) : defaultGstRate;
        const hsnCode = part.hsn_code?.trim() || defaultHsnForSparePart || null;
        setValue(`parts.${index}.part_id`,       part.id);
        setValue(`parts.${index}.part_code`,     part.part_code);
        setValue(`parts.${index}.part_name`,     part.part_name);
        setValue(`parts.${index}.uom`,           part.uom);
        setValue(`parts.${index}.cost_price`,    cost);
        setValue(`parts.${index}.selling_price`, selling);
        setValue(`parts.${index}.gst_rate`,      gstRate);
        setValue(`parts.${index}.hsn_code`,      hsnCode);
    }

    function handlePartClear(index: number) {
        setValue(`parts.${index}.part_id`,       null);
        setValue(`parts.${index}.part_code`,     "");
        setValue(`parts.${index}.part_name`,     "");
        setValue(`parts.${index}.uom`,           "");
        setValue(`parts.${index}.cost_price`,    null);
        setValue(`parts.${index}.selling_price`, null);
        setValue(`parts.${index}.gst_rate`,      null);
        setValue(`parts.${index}.hsn_code`,      null);
    }

    function handleCostPriceChange(index: number, cost: number | null) {
        setValue(`parts.${index}.cost_price`,    cost);
        setValue(`parts.${index}.selling_price`, applyMarkup(cost, markupPct));
    }

    // ── Charge handlers ──────────────────────────────────────────────────────

    function handleDeleteCharge(index: number, id: number | null) {
        if (id != null) deletedChargeIdsRef.current = [...deletedChargeIdsRef.current, id];
        removeCharge(index);
    }

    function isChargeEdited(row: ChargeItem): boolean {
        if (row.id == null) return false;
        const orig = originalChargesRef.current.find(r => r.id === row.id);
        if (!orig) return false;
        return orig.charge_name   !== row.charge_name
            || orig.ref_no        !== row.ref_no
            || orig.description   !== row.description
            || orig.cost_price    !== row.cost_price
            || orig.selling_price !== row.selling_price;
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    async function handleSave() {
        const { parts, charges } = getValues();

        const invalidPart = parts.find(p => p.id == null && p.part_id != null && p.qty <= 0);
        if (invalidPart) {
            toast.error("Part qty must be greater than zero.");
            return;
        }

        const invalidCharge = charges.find(c => c.id == null && !c.charge_name.trim() && (c.cost_price > 0 || c.selling_price > 0));
        if (invalidCharge) {
            toast.error("Charge name is required.");
            return;
        }

        const invalidExistingCharge = charges.find(c => c.id != null && !c.charge_name.trim());
        if (invalidExistingCharge) {
            toast.error("Charge name cannot be empty.");
            return;
        }

        const zeroSellingPrice = charges.find(c => c.charge_name.trim() && c.selling_price <= 0);
        if (zeroSellingPrice) {
            toast.error("Selling price must be greater than zero for all charges.");
            return;
        }

        const existingParts   = parts.filter(p => p.id != null);
        const editedParts     = existingParts.filter(isPartEdited);
        const validNewParts   = parts.filter(p => p.id == null && p.part_id != null && p.qty > 0);
        const editedCharges   = charges.filter(c => c.id != null && isChargeEdited(c));
        const validNewCharges = charges.filter(c => c.id == null && c.charge_name.trim());

        const deletedPartIds   = deletedPartIdsRef.current;
        const deletedChargeIds = deletedChargeIdsRef.current;

        const hasParts   = editedParts.length > 0 || validNewParts.length > 0 || deletedPartIds.length > 0;
        const hasCharges = editedCharges.length > 0 || validNewCharges.length > 0 || deletedChargeIds.length > 0;

        if (!hasParts && !hasCharges) {
            toast.info("Nothing to save.");
            return;
        }

        setSaving(true);
        try {
            const mutations: Promise<unknown>[] = [];

            if (hasParts) {
                const xData = [
                    ...editedParts.map(p => ({
                        id:            p.id!,
                        qty:           p.qty,
                        cost_price:    p.cost_price,
                        selling_price: p.selling_price,
                        remarks:       p.remarks || null,
                    })),
                    ...validNewParts.map(p => ({
                        job_id:        job.id,
                        part_id:       p.part_id,
                        qty:           p.qty,
                        cost_price:    p.cost_price,
                        selling_price: p.selling_price,
                        remarks:       p.remarks || null,
                        gst_rate:      p.gst_rate ?? defaultGstRate,
                        hsn_code:      p.hsn_code || defaultHsnForSparePart || null,
                    })),
                ];
                mutations.push(apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericUpdateValue({
                            tableName:  "job_part_used",
                            deletedIds: deletedPartIds.length > 0 ? deletedPartIds : undefined,
                            xData,
                        }),
                    },
                }));
            }

            if (hasCharges) {
                const xData = [
                    ...editedCharges.map(c => ({
                        id:            c.id!,
                        charge_name:   c.charge_name.trim(),
                        ref_no:        c.ref_no || null,
                        description:   c.description || null,
                        cost_price:    c.cost_price,
                        selling_price: c.selling_price,
                    })),
                    ...validNewCharges.map(c => ({
                        job_id:        job.id,
                        charge_name:   c.charge_name.trim(),
                        ref_no:        c.ref_no || null,
                        description:   c.description || null,
                        cost_price:    c.cost_price,
                        selling_price: c.selling_price,
                        gst_rate:      c.gst_rate || defaultGstRate,
                        hsn_code:      c.hsn_code || defaultHsnForServiceCharge || null,
                    })),
                ];
                mutations.push(apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName, schema,
                        value: graphQlUtils.buildGenericUpdateValue({
                            tableName:  "job_additional_charge",
                            deletedIds: deletedChargeIds.length > 0 ? deletedChargeIds : undefined,
                            xData,
                        }),
                    },
                }));
            }

            await Promise.all(mutations);
            toast.success(`Parts & charges saved for job #${job.job_no}.`);
            onSaved();
        } catch {
            toast.error("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    // ── Styles ───────────────────────────────────────────────────────────────

    const thCls = "text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2 py-1.5 text-left border-b border-border bg-muted/50";
    const tdCls = "px-2 py-1 border-b border-border";

    const statusBg = STATUS_COLORS[job.job_status_code]?.trim().split(/\s+/)[0] ?? "bg-slate-400";

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent
                className="sm:max-w-4xl max-h-[92vh] overflow-y-auto"
                onInteractOutside={e => e.preventDefault()}
                onPointerDownOutside={e => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex flex-wrap items-center gap-4 pr-8">
                        <DialogTitle className="text-base font-semibold shrink-0">Parts &amp; Charges</DialogTitle>
                        <span className="font-mono font-semibold text-primary text-md">#{job.job_no}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{job.customer_name}</span>
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold text-white ${statusBg}`}>
                            {job.job_status_name}
                        </span>
                        {markupPct > 0 && (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                                Markup: {markupPct}%
                            </span>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                ) : (
                    <div className="space-y-5">

                        {/* ── Parts Used ─────────────────────────────────────── */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50/60 border-b border-violet-200/60">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-violet-600" />
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-violet-700">Parts Used</h4>
                                    <Select
                                        value={selectedBrandId ? String(selectedBrandId) : ""}
                                        onValueChange={v => setSelectedBrandId(v ? Number(v) : null)}
                                    >
                                        <SelectTrigger className="h-6 text-xs w-36">
                                            <SelectValue placeholder="Brand filter…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brands.map(b => (
                                                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button className="h-7 px-2 text-sm" size="sm" type="button" variant="outline" onClick={resetParts}>
                                    <Undo2 className="h-3.5 w-3.5 mr-1" />Reset
                                </Button>
                            </div>

                            {partFields.length === 0 ? (
                                <div className="flex items-center justify-center py-6">
                                    <Button
                                        className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={() => insertPart(0, newPartRow())}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Part
                                    </Button>
                                </div>
                            ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            <th className={`${thCls} w-8 text-center`}>#</th>
                                            <th className={thCls}>Part Code</th>
                                            <th className={`${thCls} text-right`}>Cost Price</th>
                                            <th className={`${thCls} text-right`}>Qty</th>
                                            <th className={`${thCls} text-right`}>Selling Price</th>
                                            <th className={thCls}>Remarks</th>
                                            <th className={`${thCls} w-16`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>

                                        {partFields.map((field, index) => {
                                            const row     = watchedParts[index];
                                            const isNew   = row?.id == null;
                                            const edited  = !isNew && isPartEdited(row);
                                            return (
                                                <tr key={field.id} className={`hover:bg-muted/30 ${edited ? "border-l-2 border-l-amber-500 bg-amber-500/[0.03]" : ""} ${isNew ? "bg-violet-50/20" : ""}`}>
                                                    <td className={`${tdCls} text-center text-muted-foreground`}>{index + 1}</td>
                                                    <td className={`${tdCls} ${isNew ? "p-0 min-w-[160px]" : ""}`}>
                                                        {isNew ? (
                                                            <PartCodeInput
                                                                partCode={row?.part_code ?? ""}
                                                                partId={row?.part_id ?? null}
                                                                partName={row?.part_name ?? ""}
                                                                brandId={selectedBrandId}
                                                                selectedBrandId={selectedBrandId}
                                                                brandName={brands.find(b => b.id === selectedBrandId)?.name}
                                                                onChange={code => setValue(`parts.${index}.part_code`, code)}
                                                                onClear={() => handlePartClear(index)}
                                                                onSelect={part => handlePartSelect(index, part)}
                                                            />
                                                        ) : (
                                                            <>
                                                                <div className="font-mono font-medium">{row?.part_code} <span className="text-[10px] text-muted-foreground">{row?.uom}</span></div>
                                                                <div className="text-[10px] text-muted-foreground">{row?.part_name}</div>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className={`${tdCls} text-right`}>
                                                        <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                            value={row?.cost_price ?? ""}
                                                            placeholder="0.00"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => handleCostPriceChange(index, e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={`${tdCls} text-right`}>
                                                        <Input className={`h-6 w-16 rounded-sm text-xs text-right px-1 ${isNew && row?.part_id != null && (row?.qty ?? 0) <= 0 ? "border-red-400" : ""}`}
                                                            min={0.01} step="0.01" type="number"
                                                            value={row?.qty ?? 1}
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => setValue(`parts.${index}.qty`, e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={`${tdCls} text-right`}>
                                                        <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                            value={row?.selling_price ?? ""}
                                                            placeholder="0.00"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => setValue(`parts.${index}.selling_price`, e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 rounded-sm text-xs px-1" placeholder="Remarks…"
                                                            value={row?.remarks ?? ""}
                                                            onChange={e => setValue(`parts.${index}.remarks`, e.target.value)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <div className="flex items-center gap-0.5">
                                                            <Button className="text-emerald-600 hover:text-emerald-700" size="icon-sm" type="button" variant="ghost"
                                                                onClick={() => insertPart(index + 1, newPartRow())}>
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                            <Button className="text-red-500 hover:text-red-600" size="icon-sm" type="button" variant="ghost"
                                                                onClick={() => handleDeletePart(index, row?.id ?? null)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>

                        {/* ── Additional Charges ──────────────────────────────── */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/60 border-b border-amber-200/60">
                                <div className="flex items-center gap-2">
                                    <ReceiptText className="h-4 w-4 text-amber-600" />
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700">Additional Charges</h4>
                                </div>
                                <Button className="h-7 px-2 text-sm" size="sm" type="button" variant="outline" onClick={resetCharges}>
                                    <Undo2 className="h-3.5 w-3.5 mr-1" />Reset
                                </Button>
                            </div>

                            {chargeFields.length === 0 ? (
                                <div className="flex items-center justify-center py-6">
                                    <Button
                                        className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={() => insertCharge(0, newChargeRow())}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Charge
                                    </Button>
                                </div>
                            ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            <th className={`${thCls} w-8 text-center`}>#</th>
                                            <th className={thCls}>Charge Name</th>
                                            <th className={thCls}>Ref No</th>
                                            <th className={thCls}>Description</th>
                                            <th className={`${thCls} text-right`}>Cost Price</th>
                                            <th className={`${thCls} text-right`}>Selling Price</th>
                                            <th className={`${thCls} w-8`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>

                                        {chargeFields.map((field, index) => {
                                            const row    = watchedCharges[index];
                                            const isNew  = row?.id == null;
                                            const edited = !isNew && isChargeEdited(row);
                                            return (
                                                <tr key={field.id} className={`hover:bg-muted/30 ${edited ? "border-l-2 border-l-amber-500 bg-amber-500/[0.03]" : ""} ${isNew ? "bg-amber-50/20" : ""}`}>
                                                    <td className={`${tdCls} text-center text-muted-foreground`}>{index + 1}</td>
                                                    <td className={tdCls}>
                                                        <ChargeNameCombobox
                                                            value={row?.charge_name ?? ""}
                                                            options={chargeOptions}
                                                            invalid={!(row?.charge_name ?? "").trim()}
                                                            onChange={name => setValue(`charges.${index}.charge_name`, name)}
                                                            onSelect={(name, hsnCode) => {
                                                                setValue(`charges.${index}.charge_name`, name);
                                                                setValue(`charges.${index}.hsn_code`, hsnCode || defaultHsnForServiceCharge || null);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 w-24 rounded-sm text-xs px-1" placeholder="Ref…"
                                                            value={row?.ref_no ?? ""}
                                                            onChange={e => setValue(`charges.${index}.ref_no`, e.target.value)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 rounded-sm text-xs px-1" placeholder="Description…"
                                                            value={row?.description ?? ""}
                                                            onChange={e => setValue(`charges.${index}.description`, e.target.value)} />
                                                    </td>
                                                    <td className={`${tdCls} text-right`}>
                                                        <Input className="h-6 w-24 rounded-sm text-xs text-right px-1" type="number" min={0} step="0.01" placeholder="0.00"
                                                            value={(row?.cost_price ?? 0) === 0 ? "" : (row?.cost_price ?? "")}
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => setValue(`charges.${index}.cost_price`, e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={`${tdCls} text-right`}>
                                                        <Input
                                                            className={`h-6 w-24 rounded-sm text-xs text-right px-1 ${(row?.charge_name ?? "").trim() && (row?.selling_price ?? 0) <= 0 ? "border-red-400 focus:border-red-500" : ""}`}
                                                            type="number" min={0.01} step="0.01" placeholder="0.00"
                                                            value={(row?.selling_price ?? 0) === 0 ? "" : (row?.selling_price ?? "")}
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => setValue(`charges.${index}.selling_price`, e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <div className="flex items-center gap-0.5">
                                                            <Button className="text-emerald-600 hover:text-emerald-700" size="icon-sm" type="button" variant="ghost"
                                                                onClick={() => insertCharge(index + 1, newChargeRow())}>
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                            <Button className="text-red-500 hover:text-red-600" size="icon-sm" type="button" variant="ghost"
                                                                onClick={() => handleDeleteCharge(index, row?.id ?? null)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>

                    </div>
                )}

                <DialogFooter>
                    <Button disabled={saving} type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                        disabled={saving || loading}
                        type="button"
                        onClick={() => void handleSave()}
                    >
                        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
