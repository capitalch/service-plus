import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Undo2, Trash2, ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { PartCodeInput, type PartRow } from "@/features/client/components/inventory/part-code-input";
import type { BrandOption } from "@/features/client/types/model";
import type { TechnicianRow } from "@/features/client/types/job";
import { STATUS_COLORS } from "./status-transitions";
import type { Transition } from "./status-transitions";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobSummary = {
    id:              number;
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    technician_id:   number | null;
    job_receive_manner_name:    string | null;
    device_details:             string | null;
    job_receive_condition_name: string | null;
};

type AdditionalChargeRow = {
    _key:          string;
    charge_name:   string;
    ref_no:        string;
    description:   string;
    cost_price:    number;
    selling_price: number;
};

export type TransitionPayload = {
    targetStatusId:   number;
    technician_id:    number | null;
    amount:           number | null;
    estimate_amount:  number | null;
    remarks:          string;
    transaction_date: string;
    is_final:         boolean;
    is_closed:        boolean;
    partsData?: {
        newLines:   { part_id: number; quantity: number; cost_price: number | null; sale_price: number | null; remarks: string }[];
        deletedIds: number[];
    };
    chargesData?: {
        lines: { charge_name: string; ref_no: string; description: string; cost_price: number; selling_price: number }[];
    };
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

type Props = {
    job:         JobSummary;
    transition:  Transition;
    technicians: TechnicianRow[];
    dbName:      string;
    schema:      string;
    onClose:     () => void;
    onSubmit:    (payload: TransitionPayload) => Promise<void>;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
    technician_id:    z.string().optional(),
    amount:           z.string().optional(),
    estimate_amount:  z.string().optional(),
    remarks:          z.string().optional(),
    transaction_date: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof formSchema>;

const today = new Date().toISOString().slice(0, 10);

// ─── Component ────────────────────────────────────────────────────────────────

export const StatusTransitionModal = ({ job, transition, technicians, dbName, schema, onClose, onSubmit }: Props) => {
    const { fields } = transition;
    const needsParts   = fields.includes("P");
    const needsCharges = fields.includes("C");

    const [existingParts,   setExistingParts]   = useState<ExistingPartRow[]>([]);
    const [newParts,        setNewParts]        = useState<NewPartRow[]>([]);
    const [deletedIds,      setDeletedIds]      = useState<number[]>([]);
    const [brands,          setBrands]          = useState<BrandOption[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
    const [newCharges,      setNewCharges]      = useState<AdditionalChargeRow[]>([]);
    const originalExistingPartsRef              = useRef<ExistingPartRow[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            technician_id:    job.technician_id ? String(job.technician_id) : "",
            amount:           "",
            estimate_amount:  "",
            remarks:          "",
            transaction_date: today,
        },
    });

    // Load existing parts when modal opens for P/RAP transitions
    useEffect(() => {
        if (!needsParts) return;
        void apolloClient.query<{ genericQuery: ExistingPartRow[] | null }>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_JOB_PART_USED_BY_JOB,
                    sqlArgs: { job_id: job.id },
                }),
            },
        }).then(r => {
            const rows = r.data?.genericQuery ?? [];
            originalExistingPartsRef.current = rows;
            setExistingParts(rows);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!needsParts) return;
        void apolloClient.query<{ genericQuery: BrandOption[] | null }>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   { db_name: dbName, schema, value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_ALL_BRANDS }) },
        }).then(r => setBrands(r.data?.genericQuery ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function isRowEdited(row: ExistingPartRow): boolean {
        const orig = originalExistingPartsRef.current.find(r => r.id === row.id);
        if (!orig) return false;
        return orig.quantity !== row.quantity
            || orig.cost_price !== row.cost_price
            || orig.sale_price !== row.sale_price
            || orig.remarks !== row.remarks;
    }

    function handleNewPartSelect(key: string, part: PartRow) {
        setNewParts(prev => prev.map(r =>
            r._key === key
                ? { ...r, part_id: part.id, part_code: part.part_code, part_name: part.part_name, uom: part.uom, cost_price: part.cost_price ?? null, sale_price: part.mrp ?? null }
                : r
        ));
    }

    function handleNewPartClear(key: string) {
        setNewParts(prev => prev.map(r =>
            r._key === key
                ? { ...r, part_id: null, part_code: "", part_name: "", uom: "", cost_price: null, sale_price: null }
                : r
        ));
    }

    function resetParts() {
        setExistingParts(originalExistingPartsRef.current);
        setNewParts([]);
        setDeletedIds([]);
    }

    function addNewPartRow() {
        setNewParts(prev => [...prev, {
            _key:       crypto.randomUUID(),
            part_id:    null,
            part_code:  "",
            part_name:  "",
            uom:        "",
            quantity:   1,
            cost_price: null,
            sale_price: null,
            remarks:    "",
        }]);
    }

    function removeNewPartRow(key: string) {
        setNewParts(prev => prev.filter(r => r._key !== key));
    }

    function deleteExistingPart(id: number) {
        setDeletedIds(prev => [...prev, id]);
        setExistingParts(prev => prev.filter(r => r.id !== id));
    }

    function updateExistingPart(id: number, field: "quantity" | "cost_price" | "sale_price" | "remarks", value: string | number | null) {
        setExistingParts(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }

    function updateNewPart(key: string, field: keyof NewPartRow, value: string | number | null) {
        setNewParts(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    }

    function addChargeRow() {
        setNewCharges(prev => [...prev, { _key: crypto.randomUUID(), charge_name: "", ref_no: "", description: "", cost_price: 0, selling_price: 0 }]);
    }

    function removeChargeRow(key: string) {
        setNewCharges(prev => prev.filter(r => r._key !== key));
    }

    function updateCharge(key: string, field: keyof AdditionalChargeRow, value: string | number) {
        setNewCharges(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    }

    async function handleSubmit(values: FormValues) {
        if (fields.includes("T") && !values.technician_id) {
            form.setError("technician_id", { message: "Technician is required" });
            return;
        }
        await onSubmit({
            targetStatusId:   transition.targetId,
            technician_id:    values.technician_id ? Number(values.technician_id) : null,
            amount:           values.amount          ? Number(values.amount)          : null,
            estimate_amount:  values.estimate_amount ? Number(values.estimate_amount) : null,
            remarks:          values.remarks ?? "",
            transaction_date: values.transaction_date,
            is_final:         false,
            is_closed:        false,
            partsData: needsParts ? {
                newLines: newParts.filter(p => p.part_id).map(p => ({
                    part_id:    p.part_id!,
                    quantity:   p.quantity,
                    cost_price: p.cost_price,
                    sale_price: p.sale_price,
                    remarks:    p.remarks,
                })),
                deletedIds,
            } : undefined,
            chargesData: needsCharges
                ? { lines: newCharges.filter(r => r.charge_name.trim()).map(r => ({
                      charge_name:   r.charge_name.trim(),
                      ref_no:        r.ref_no,
                      description:   r.description,
                      cost_price:    r.cost_price,
                      selling_price: r.selling_price,
                  })) }
                : undefined,
        });
    }

    const isSubmitting = form.formState.isSubmitting;
    const thCls = "text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2 py-1.5 text-left border-b border-border bg-muted/50";
    const tdCls = "px-2 py-1 border-b border-border";

    const showPricing = fields.includes("A") || fields.includes("E");
    const isWide      = needsParts || needsCharges;

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className={`${isWide ? "sm:max-w-4xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto`}>
                <DialogHeader>
                    <div className="flex items-center gap-2 pr-8 flex-wrap">
                        <DialogTitle className="text-base font-semibold shrink-0">Update Status</DialogTitle>
                        <span className="inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                            {job.job_status_name}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium shrink-0 ${STATUS_COLORS[transition.targetCode] ?? "bg-gray-500 text-white"}`}>
                            {transition.targetName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            <span className="font-mono font-semibold text-primary">#{job.job_no}</span>
                            <span className="mx-1">·</span>
                            <span>{job.customer_name}</span>
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                        {job.job_receive_manner_name && (
                            <span>Receive: <span className="font-medium text-foreground">{job.job_receive_manner_name}</span></span>
                        )}
                        {job.device_details && (
                            <span>Device: <span className="font-medium text-foreground">{job.device_details}</span></span>
                        )}
                        {job.job_receive_condition_name && (
                            <span>Condition: <span className="font-medium text-foreground">{job.job_receive_condition_name}</span></span>
                        )}
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* ── Pricing ────────────────────────────────────────────── */}
                    {showPricing && (
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pricing</h4>
                            {fields.includes("E") && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="stm-estimate-amount">Estimated Price</Label>
                                    <Input
                                        className="h-9"
                                        id="stm-estimate-amount"
                                        min="0"
                                        placeholder="0.00"
                                        step="0.01"
                                        type="number"
                                        {...form.register("estimate_amount")}
                                    />
                                </div>
                            )}
                            {fields.includes("A") && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="stm-amount">Amount</Label>
                                    <Input
                                        className="h-9"
                                        id="stm-amount"
                                        min="0"
                                        placeholder="0.00"
                                        step="0.01"
                                        type="number"
                                        {...form.register("amount")}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Details (date + technician + remarks) ──────────────── */}
                    <div className="space-y-3 rounded-lg border border-border p-4">
                        {fields.includes("T") ? (
                            <div className="grid grid-cols-[1fr_2fr] gap-4">
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="stm-date">
                                            Date <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            className="h-9"
                                            id="stm-date"
                                            type="date"
                                            {...form.register("transaction_date")}
                                        />
                                        {form.formState.errors.transaction_date && (
                                            <p className="text-xs text-red-500">{form.formState.errors.transaction_date.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="stm-technician">
                                            Technician <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={form.watch("technician_id")}
                                            onValueChange={v => form.setValue("technician_id", v)}
                                        >
                                            <SelectTrigger id="stm-technician" className="h-9">
                                                <SelectValue placeholder="Select technician" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {technicians.map(t => (
                                                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {form.formState.errors.technician_id && (
                                            <p className="text-xs text-red-500">{form.formState.errors.technician_id.message}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="stm-remarks">Remarks</Label>
                                    <Textarea
                                        className="min-h-[80px]"
                                        id="stm-remarks"
                                        placeholder="Optional remarks…"
                                        {...form.register("remarks")}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-[1fr_2fr] gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="stm-date">
                                        Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        className="h-9"
                                        id="stm-date"
                                        type="date"
                                        {...form.register("transaction_date")}
                                    />
                                    {form.formState.errors.transaction_date && (
                                        <p className="text-xs text-red-500">{form.formState.errors.transaction_date.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="stm-remarks">Remarks</Label>
                                    <Textarea
                                        className="min-h-[80px]"
                                        id="stm-remarks"
                                        placeholder="Optional remarks…"
                                        {...form.register("remarks")}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Parts Used ─────────────────────────────────────────── */}
                    {needsParts && (
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Parts Used</h4>
                                    <Select
                                        value={selectedBrandId ? String(selectedBrandId) : ""}
                                        onValueChange={v => setSelectedBrandId(v ? Number(v) : null)}
                                    >
                                        <SelectTrigger className="h-6 text-xs w-36">
                                            <SelectValue placeholder="Brand…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brands.map(b => (
                                                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        className="h-6 px-2 text-xs"
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                        onClick={resetParts}
                                    >
                                        <Undo2 className="h-3 w-3 mr-1" />Reset
                                    </Button>
                                    <Button
                                        className="h-6 px-2 text-xs"
                                        size="sm"
                                        type="button"
                                        onClick={addNewPartRow}
                                    >
                                        + Add Part
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto rounded border border-border">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="sticky top-0 z-10">
                                            <th className={`${thCls} w-8 text-center`}>#</th>
                                            <th className={thCls}>Part Code</th>
                                            <th className={`${thCls} text-right`}>Cost Price</th>
                                            <th className={`${thCls} text-right`}>Qty</th>
                                            <th className={`${thCls} text-right`}>Sale Price</th>
                                            <th className={thCls}>Remarks</th>
                                            <th className={`${thCls} w-14`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingParts.length === 0 && newParts.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-2 py-3 text-center text-xs text-muted-foreground italic">
                                                    No parts added yet. Click &quot;+ Add Part&quot; to add.
                                                </td>
                                            </tr>
                                        )}
                                        {existingParts.map((row, idx) => {
                                            const edited = isRowEdited(row);
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className={`${edited ? "border-l-2 border-l-amber-500 bg-amber-500/[0.03]" : ""} hover:bg-muted/30`}
                                                >
                                                    <td className={`${tdCls} text-center text-muted-foreground`}>{idx + 1}</td>
                                                    <td className={`${tdCls} font-mono font-medium`}>{row.part_code}</td>
                                                    <td className={tdCls}>
                                                        <Input
                                                            className="h-6 w-20 rounded-sm text-xs text-right px-1"
                                                            min={0}
                                                            step="0.01"
                                                            type="number"
                                                            value={row.cost_price ?? ""}
                                                            placeholder="0.00"
                                                            onChange={e => updateExistingPart(row.id, "cost_price", e.target.value === "" ? null : e.target.valueAsNumber)}
                                                        />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input
                                                            className="h-6 w-16 rounded-sm text-xs text-right px-1"
                                                            min={0.01}
                                                            step="0.01"
                                                            type="number"
                                                            value={row.quantity}
                                                            onChange={e => updateExistingPart(row.id, "quantity", e.target.valueAsNumber)}
                                                        />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input
                                                            className="h-6 w-20 rounded-sm text-xs text-right px-1"
                                                            min={0}
                                                            step="0.01"
                                                            type="number"
                                                            value={row.sale_price ?? ""}
                                                            placeholder="0.00"
                                                            onChange={e => updateExistingPart(row.id, "sale_price", e.target.value === "" ? null : e.target.valueAsNumber)}
                                                        />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <Input
                                                            className="h-6 rounded-sm text-xs px-1"
                                                            placeholder="Remarks…"
                                                            value={row.remarks}
                                                            onChange={e => updateExistingPart(row.id, "remarks", e.target.value)}
                                                        />
                                                    </td>
                                                    <td className={tdCls}>
                                                        <div className="flex items-center gap-0.5">
                                                            <Button
                                                                className="text-muted-foreground hover:text-foreground"
                                                                size="icon-xs"
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={addNewPartRow}
                                                                title="Add part row"
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                className="text-red-500 hover:text-red-600"
                                                                size="icon-xs"
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={() => deleteExistingPart(row.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {newParts.map((row, idx) => (
                                            <tr key={row._key} className="hover:bg-muted/30">
                                                <td className={`${tdCls} text-center text-muted-foreground`}>{existingParts.length + idx + 1}</td>
                                                <td className={`${tdCls} p-0`}>
                                                    <PartCodeInput
                                                        partCode={row.part_code}
                                                        partId={row.part_id}
                                                        partName={row.part_name}
                                                        brandId={selectedBrandId}
                                                        selectedBrandId={selectedBrandId}
                                                        brandName={brands.find(b => b.id === selectedBrandId)?.name}
                                                        onChange={code => updateNewPart(row._key, "part_code", code)}
                                                        onClear={() => handleNewPartClear(row._key)}
                                                        onSelect={part => handleNewPartSelect(row._key, part)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 w-20 rounded-sm text-xs text-right px-1"
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={row.cost_price ?? ""}
                                                        placeholder="0.00"
                                                        onChange={e => updateNewPart(row._key, "cost_price", e.target.value === "" ? null : e.target.valueAsNumber)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 w-16 rounded-sm text-xs text-right px-1"
                                                        min={0.01}
                                                        step="0.01"
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={e => updateNewPart(row._key, "quantity", e.target.valueAsNumber)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 w-20 rounded-sm text-xs text-right px-1"
                                                        min={0}
                                                        step="0.01"
                                                        type="number"
                                                        value={row.sale_price ?? ""}
                                                        placeholder="0.00"
                                                        onChange={e => updateNewPart(row._key, "sale_price", e.target.value === "" ? null : e.target.valueAsNumber)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 rounded-sm text-xs px-1"
                                                        placeholder="Remarks…"
                                                        value={row.remarks}
                                                        onChange={e => updateNewPart(row._key, "remarks", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <div className="flex items-center gap-0.5">
                                                        <Button
                                                            className="text-muted-foreground hover:text-foreground"
                                                            size="icon-xs"
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={addNewPartRow}
                                                            title="Add part row"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            className="text-red-500 hover:text-red-600"
                                                            size="icon-xs"
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => removeNewPartRow(row._key)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ── Additional Charges ─────────────────────────────────── */}
                    {needsCharges && (
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    Additional Charges
                                </h4>
                                <Button className="h-6 px-2 text-xs" size="sm" type="button" onClick={addChargeRow}>
                                    + Add Charge
                                </Button>
                            </div>
                            <div className="overflow-x-auto rounded border border-border">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="sticky top-0 z-10">
                                            <th className={`${thCls} w-8 text-center`}>#</th>
                                            <th className={thCls}>Charge Name</th>
                                            <th className={thCls}>Ref No</th>
                                            <th className={thCls}>Description</th>
                                            <th className={`${thCls} text-right`}>Cost Price</th>
                                            <th className={`${thCls} text-right`}>Selling Price</th>
                                            <th className={`${thCls} w-10`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {newCharges.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-2 py-3 text-center text-xs text-muted-foreground italic">
                                                    No charges added. Click &quot;+ Add Charge&quot; to add.
                                                </td>
                                            </tr>
                                        )}
                                        {newCharges.map((row, idx) => (
                                            <tr key={row._key} className="hover:bg-muted/30">
                                                <td className={`${tdCls} text-center text-muted-foreground`}>{idx + 1}</td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 rounded-sm text-xs px-1" placeholder="e.g. Labour charge"
                                                        value={row.charge_name}
                                                        onChange={e => updateCharge(row._key, "charge_name", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs px-1" placeholder="Ref…"
                                                        value={row.ref_no}
                                                        onChange={e => updateCharge(row._key, "ref_no", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 rounded-sm text-xs px-1" placeholder="Description…"
                                                        value={row.description}
                                                        onChange={e => updateCharge(row._key, "description", e.target.value)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs text-right px-1"
                                                        type="number" min={0} step="0.01" placeholder="0.00"
                                                        value={row.cost_price === 0 ? "" : row.cost_price}
                                                        onChange={e => updateCharge(row._key, "cost_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input className="h-6 w-24 rounded-sm text-xs text-right px-1"
                                                        type="number" min={0} step="0.01" placeholder="0.00"
                                                        value={row.selling_price === 0 ? "" : row.selling_price}
                                                        onChange={e => updateCharge(row._key, "selling_price", e.target.value === "" ? 0 : e.target.valueAsNumber)} />
                                                </td>
                                                <td className={tdCls}>
                                                    <Button className="text-red-500 hover:text-red-600" size="icon-xs" type="button" variant="ghost"
                                                        onClick={() => removeChargeRow(row._key)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        disabled={isSubmitting}
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                        disabled={isSubmitting}
                        type="button"
                        onClick={() => void form.handleSubmit(handleSubmit)()}
                    >
                        {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
