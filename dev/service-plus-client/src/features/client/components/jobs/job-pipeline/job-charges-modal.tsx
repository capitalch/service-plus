import { useEffect, useRef, useState } from "react";
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
import { STATUS_COLORS } from "./status-transitions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChargesJobSummary = {
    id:              number;
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    job_status_code: string;
};

type ExistingPartRow = {
    id:         number;
    part_id:    number;
    part_code:  string;
    part_name:  string;
    uom:        string;
    quantity:   number;
    cost_price: number | null;
    sale_price: number | null;
    remarks:    string;
};

type NewPartRow = {
    _key:       string;
    part_id:    number | null;
    part_code:  string;
    part_name:  string;
    uom:        string;
    quantity:   number;
    cost_price: number | null;
    sale_price: number | null;
    remarks:    string;
};

type ExistingChargeRow = {
    id:            number;
    charge_name:   string;
    ref_no:        string | null;
    description:   string | null;
    cost_price:    number;
    selling_price: number;
};

type NewChargeRow = {
    _key:          string;
    charge_name:   string;
    ref_no:        string;
    description:   string;
    cost_price:    number;
    selling_price: number;
};

type Props = {
    job:     ChargesJobSummary;
    dbName:  string;
    schema:  string;
    onClose: () => void;
    onSaved: () => void;
};

type GenericQueryData<T> = { genericQuery: T[] | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newPartRow(): NewPartRow {
    return { _key: crypto.randomUUID(), part_id: null, part_code: "", part_name: "", uom: "", quantity: 1, cost_price: null, sale_price: null, remarks: "" };
}

function newChargeRow(): NewChargeRow {
    return { _key: crypto.randomUUID(), charge_name: "", ref_no: "", description: "", cost_price: 0, selling_price: 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const JobChargesModal = ({ job, dbName, schema, onClose, onSaved }: Props) => {
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);

    // Parts state
    const [existingParts,   setExistingParts]   = useState<ExistingPartRow[]>([]);
    const [newParts,        setNewParts]        = useState<NewPartRow[]>([]);
    const [deletedPartIds,  setDeletedPartIds]  = useState<number[]>([]);
    const [brands,          setBrands]          = useState<BrandOption[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
    const originalPartsRef = useRef<ExistingPartRow[]>([]);

    // Charges state
    const [existingCharges,    setExistingCharges]    = useState<ExistingChargeRow[]>([]);
    const [newCharges,         setNewCharges]         = useState<NewChargeRow[]>([]);
    const [deletedChargeIds,   setDeletedChargeIds]   = useState<number[]>([]);
    const originalChargesRef = useRef<ExistingChargeRow[]>([]);

    // Load existing data
    useEffect(() => {
        const gq = <T,>(sqlId: string, sqlArgs: Record<string, unknown>) =>
            apolloClient.query<GenericQueryData<T>>({
                fetchPolicy: "network-only",
                query: GRAPHQL_MAP.genericQuery,
                variables: { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId, sqlArgs }) },
            });
        void Promise.all([
            gq<ExistingPartRow>(SQL_MAP.GET_JOB_PART_USED_BY_JOB, { job_id: job.id }),
            gq<ExistingChargeRow>(SQL_MAP.GET_JOB_ADDITIONAL_CHARGES_BY_JOB, { job_id: job.id }),
            gq<BrandOption>(SQL_MAP.GET_ALL_BRANDS, {}),
        ]).then(([partsRes, chargesRes, brandsRes]) => {
            const parts = partsRes.data?.genericQuery ?? [];
            originalPartsRef.current = parts;
            setExistingParts(parts);
            const charges = chargesRes.data?.genericQuery ?? [];
            originalChargesRef.current = charges;
            setExistingCharges(charges);
            setBrands(brandsRes.data?.genericQuery ?? []);
        }).catch(() => {
            toast.error("Failed to load job data.");
        }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Part handlers ────────────────────────────────────────────────────────

    function isPartEdited(row: ExistingPartRow) {
        const orig = originalPartsRef.current.find(r => r.id === row.id);
        if (!orig) return false;
        return orig.quantity !== row.quantity || orig.cost_price !== row.cost_price
            || orig.sale_price !== row.sale_price || orig.remarks !== row.remarks;
    }

    function resetParts() {
        setExistingParts(originalPartsRef.current);
        setNewParts([]);
        setDeletedPartIds([]);
    }

    function updateExistingPart(id: number, field: keyof ExistingPartRow, value: string | number | null) {
        setExistingParts(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }

    function deleteExistingPart(id: number) {
        setDeletedPartIds(prev => [...prev, id]);
        setExistingParts(prev => prev.filter(r => r.id !== id));
    }

    function updateNewPart(key: string, field: keyof NewPartRow, value: string | number | null) {
        setNewParts(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    }

    function handlePartSelect(key: string, part: PartRow) {
        setNewParts(prev => prev.map(r => r._key === key
            ? { ...r, part_id: part.id, part_code: part.part_code, part_name: part.part_name, uom: part.uom, cost_price: part.cost_price ?? null, sale_price: part.mrp ?? null }
            : r));
    }

    function handlePartClear(key: string) {
        setNewParts(prev => prev.map(r => r._key === key
            ? { ...r, part_id: null, part_code: "", part_name: "", uom: "", cost_price: null, sale_price: null }
            : r));
    }

    // ── Charge handlers ──────────────────────────────────────────────────────

    function deleteExistingCharge(id: number) {
        setDeletedChargeIds(prev => [...prev, id]);
        setExistingCharges(prev => prev.filter(r => r.id !== id));
    }

    function updateNewCharge(key: string, field: keyof NewChargeRow, value: string | number) {
        setNewCharges(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    async function handleSave() {
        // Validate new parts
        const invalidPart = newParts.find(p => p.part_id && p.quantity <= 0);
        if (invalidPart) {
            toast.error("Part quantity must be greater than zero.");
            return;
        }

        // Validate new charges
        const invalidCharge = newCharges.find(c => !c.charge_name.trim() && (c.cost_price > 0 || c.selling_price > 0));
        if (invalidCharge) {
            toast.error("Charge name is required.");
            return;
        }

        const editedParts    = existingParts.filter(isPartEdited);
        const validNewParts  = newParts.filter(p => p.part_id && p.quantity > 0);
        const validNewCharges = newCharges.filter(c => c.charge_name.trim());

        const hasParts   = editedParts.length > 0 || validNewParts.length > 0 || deletedPartIds.length > 0;
        const hasCharges = validNewCharges.length > 0 || deletedChargeIds.length > 0;

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
                        id:         p.id,
                        quantity:   p.quantity,
                        cost_price: p.cost_price,
                        sale_price: p.sale_price,
                        remarks:    p.remarks || null,
                    })),
                    ...validNewParts.map(p => ({
                        job_id:     job.id,
                        part_id:    p.part_id,
                        quantity:   p.quantity,
                        cost_price: p.cost_price,
                        sale_price: p.sale_price,
                        remarks:    p.remarks || null,
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
                const xData = validNewCharges.map(c => ({
                    job_id:        job.id,
                    charge_name:   c.charge_name.trim(),
                    ref_no:        c.ref_no || null,
                    description:   c.description || null,
                    cost_price:    c.cost_price,
                    selling_price: c.selling_price,
                }));
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
            <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                        <DialogTitle className="text-base font-semibold shrink-0">Parts &amp; Charges</DialogTitle>
                        <span className="font-mono font-semibold text-primary text-sm">#{job.job_no}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{job.customer_name}</span>
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold text-white ${statusBg}`}>
                            {job.job_status_name}
                        </span>
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
                                <div className="flex items-center gap-1.5">
                                    <Button className="h-6 px-2 text-xs" size="sm" type="button" variant="outline" onClick={resetParts}>
                                        <Undo2 className="h-3 w-3 mr-1" />Reset
                                    </Button>
                                    <Button className="h-6 px-2 text-xs" size="sm" type="button"
                                        onClick={() => setNewParts(prev => [...prev, newPartRow()])}>
                                        <Plus className="h-3 w-3 mr-1" />Add Part
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            <th className={`${thCls} w-8 text-center`}>#</th>
                                            <th className={thCls}>Part Code</th>
                                            <th className={`${thCls} text-right`}>Cost Price</th>
                                            <th className={`${thCls} text-right`}>Qty</th>
                                            <th className={`${thCls} text-right`}>Sale Price</th>
                                            <th className={thCls}>Remarks</th>
                                            <th className={`${thCls} w-8`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingParts.length === 0 && newParts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                                                    No parts added yet. Click &quot;+ Add Part&quot; to add.
                                                </td>
                                            </tr>
                                        ) : null}

                                        {existingParts.map((row, idx) => {
                                            const edited = isPartEdited(row);
                                            return (
                                                <tr key={row.id} className={`hover:bg-muted/30 ${edited ? "border-l-2 border-l-amber-500 bg-amber-500/[0.03]" : ""}`}>
                                                    <td className={`${tdCls} text-center text-muted-foreground`}>{idx + 1}</td>
                                                    <td className={`${tdCls} font-mono font-medium`}>
                                                        <span title={row.part_name}>{row.part_code}</span>
                                                        <span className="ml-1.5 text-[10px] text-muted-foreground">{row.uom}</span>
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                            value={row.cost_price ?? ""}
                                                            placeholder="0.00"
                                                            onChange={e => updateExistingPart(row.id, "cost_price", e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 w-16 rounded-sm text-xs text-right px-1" min={0.01} step="0.01" type="number"
                                                            value={row.quantity}
                                                            onChange={e => updateExistingPart(row.id, "quantity", e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                            value={row.sale_price ?? ""}
                                                            placeholder="0.00"
                                                            onChange={e => updateExistingPart(row.id, "sale_price", e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input className="h-6 rounded-sm text-xs px-1" placeholder="Remarks…"
                                                            value={row.remarks}
                                                            onChange={e => updateExistingPart(row.id, "remarks", e.target.value)} />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                                            onClick={() => deleteExistingPart(row.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {newParts.map((row, idx) => (
                                            <tr key={row._key} className="hover:bg-muted/30 bg-violet-50/20">
                                                <td className={`${tdCls} text-center text-muted-foreground`}>{existingParts.length + idx + 1}</td>
                                                <td className={`${tdCls} p-0 min-w-[160px]`}>
                                                    <PartCodeInput
                                                        partCode={row.part_code}
                                                        partId={row.part_id}
                                                        partName={row.part_name}
                                                        brandId={selectedBrandId}
                                                        selectedBrandId={selectedBrandId}
                                                        brandName={brands.find(b => b.id === selectedBrandId)?.name}
                                                        onChange={code => updateNewPart(row._key, "part_code", code)}
                                                        onClear={() => handlePartClear(row._key)}
                                                        onSelect={part => handlePartSelect(row._key, part)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                        value={row.cost_price ?? ""}
                                                        placeholder="0.00"
                                                        onChange={e => updateNewPart(row._key, "cost_price", e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className={`h-6 w-16 rounded-sm text-xs text-right px-1 ${row.part_id && row.quantity <= 0 ? "border-red-400" : ""}`}
                                                        min={0.01} step="0.01" type="number"
                                                        value={row.quantity}
                                                        onChange={e => updateNewPart(row._key, "quantity", e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-20 rounded-sm text-xs text-right px-1" min={0} step="0.01" type="number"
                                                        value={row.sale_price ?? ""}
                                                        placeholder="0.00"
                                                        onChange={e => updateNewPart(row._key, "sale_price", e.target.value === "" ? null : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 rounded-sm text-xs px-1" placeholder="Remarks…"
                                                        value={row.remarks}
                                                        onChange={e => updateNewPart(row._key, "remarks", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                                        onClick={() => setNewParts(prev => prev.filter(r => r._key !== row._key))}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Additional Charges ──────────────────────────────── */}
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/60 border-b border-amber-200/60">
                                <div className="flex items-center gap-2">
                                    <ReceiptText className="h-4 w-4 text-amber-600" />
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700">Additional Charges</h4>
                                </div>
                                <Button className="h-6 px-2 text-xs" size="sm" type="button"
                                    onClick={() => setNewCharges(prev => [...prev, newChargeRow()])}>
                                    <Plus className="h-3 w-3 mr-1" />Add Charge
                                </Button>
                            </div>

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
                                        {existingCharges.length === 0 && newCharges.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                                                    No charges added yet. Click &quot;+ Add Charge&quot; to add.
                                                </td>
                                            </tr>
                                        ) : null}

                                        {existingCharges.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-muted/30">
                                                <td className={`${tdCls} text-center text-muted-foreground`}>{idx + 1}</td>
                                                <td className={`${tdCls} font-medium`}>{row.charge_name}</td>
                                                <td className={`${tdCls} text-muted-foreground`}>{row.ref_no || "—"}</td>
                                                <td className={`${tdCls} text-muted-foreground max-w-[180px] truncate`} title={row.description ?? undefined}>{row.description || "—"}</td>
                                                <td className={`${tdCls} text-right tabular-nums`}>
                                                    {row.cost_price > 0 ? `₹${Number(row.cost_price).toFixed(2)}` : "—"}
                                                </td>
                                                <td className={`${tdCls} text-right tabular-nums font-semibold text-emerald-700`}>
                                                    {row.selling_price > 0 ? `₹${Number(row.selling_price).toFixed(2)}` : "—"}
                                                </td>
                                                <td className={tdCls}>
                                                    <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                                        onClick={() => deleteExistingCharge(row.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}

                                        {newCharges.map((row, idx) => (
                                            <tr key={row._key} className="hover:bg-muted/30 bg-amber-50/20">
                                                <td className={`${tdCls} text-center text-muted-foreground`}>{existingCharges.length + idx + 1}</td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className={`h-6 rounded-sm text-xs px-1 ${!row.charge_name.trim() ? "border-red-300 focus:border-red-400" : ""}`}
                                                        placeholder="e.g. Labour charge *"
                                                        value={row.charge_name}
                                                        onChange={e => updateNewCharge(row._key, "charge_name", e.target.value)}
                                                    />
                                                    {!row.charge_name.trim() && (
                                                        <p className="text-[10px] text-red-500 mt-0.5 px-1">Required</p>
                                                    )}
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs px-1" placeholder="Ref…"
                                                        value={row.ref_no}
                                                        onChange={e => updateNewCharge(row._key, "ref_no", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 rounded-sm text-xs px-1" placeholder="Description…"
                                                        value={row.description}
                                                        onChange={e => updateNewCharge(row._key, "description", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs text-right px-1" type="number" min={0} step="0.01" placeholder="0.00"
                                                        value={row.cost_price === 0 ? "" : row.cost_price}
                                                        onChange={e => updateNewCharge(row._key, "cost_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs text-right px-1" type="number" min={0} step="0.01" placeholder="0.00"
                                                        value={row.selling_price === 0 ? "" : row.selling_price}
                                                        onChange={e => updateNewCharge(row._key, "selling_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                                        onClick={() => setNewCharges(prev => prev.filter(r => r._key !== row._key))}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
