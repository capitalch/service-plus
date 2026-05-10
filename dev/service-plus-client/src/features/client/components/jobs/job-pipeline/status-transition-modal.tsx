import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import type { TechnicianRow } from "@/features/client/types/job";
import type { Transition } from "./status-transitions";

type JobSummary = {
    id:              number;
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    technician_id:   number | null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

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
        newLines:   { part_id: number; quantity: number; remarks: string }[];
        deletedIds: number[];
    };
};

type ExistingPartRow = {
    id:         number;
    part_id:    number;
    part_code:  string;
    part_name:  string;
    uom:        string;
    quantity:   number;
    remarks:    string;
};

type NewPartRow = {
    _key:      string;
    part_id:   number | null;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string;
};

type PartLookupRow = {
    id:        number;
    part_code: string;
    part_name: string;
    uom:       string;
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
    const needsParts = fields === "P" || fields === "RAP";

    const [existingParts, setExistingParts] = useState<ExistingPartRow[]>([]);
    const [newParts,      setNewParts]      = useState<NewPartRow[]>([]);
    const [deletedIds,    setDeletedIds]    = useState<number[]>([]);
    const [lookingUp,     setLookingUp]     = useState<Record<string, boolean>>({});

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
        }).then(r => setExistingParts(r.data?.genericQuery ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function lookupPartByCode(key: string, code: string) {
        if (!code.trim()) return;
        setLookingUp(prev => ({ ...prev, [key]: true }));
        try {
            const res = await apolloClient.query<{ genericQuery: PartLookupRow[] | null }>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_PART_BY_CODE,
                        sqlArgs: { code: code.trim(), brand_id: null },
                    }),
                },
            });
            const results = res.data?.genericQuery ?? [];
            if (results.length === 1) {
                const p = results[0];
                setNewParts(prev => prev.map(r =>
                    r._key === key
                        ? { ...r, part_id: p.id, part_code: p.part_code, part_name: p.part_name, uom: p.uom }
                        : r
                ));
            }
        } finally {
            setLookingUp(prev => ({ ...prev, [key]: false }));
        }
    }

    function addNewPartRow() {
        setNewParts(prev => [...prev, {
            _key:      crypto.randomUUID(),
            part_id:   null,
            part_code: "",
            part_name: "",
            uom:       "",
            quantity:  1,
            remarks:   "",
        }]);
    }

    function removeNewPartRow(key: string) {
        setNewParts(prev => prev.filter(r => r._key !== key));
    }

    function deleteExistingPart(id: number) {
        setDeletedIds(prev => [...prev, id]);
        setExistingParts(prev => prev.filter(r => r.id !== id));
    }

    function updateExistingPart(id: number, field: "quantity" | "remarks", value: string | number) {
        setExistingParts(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }

    function updateNewPart(key: string, field: keyof NewPartRow, value: string | number | null) {
        setNewParts(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
    }

    async function handleSubmit(values: FormValues) {
        if (fields === "RT" && !values.technician_id) {
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
                    part_id:  p.part_id!,
                    quantity: p.quantity,
                    remarks:  p.remarks,
                })),
                deletedIds,
            } : undefined,
        });
    }

    const isSubmitting = form.formState.isSubmitting;
    const thCls = "text-[10px] font-bold uppercase tracking-wide text-[var(--cl-text-muted)] px-2 py-1.5 text-left border-b border-[var(--cl-border)] bg-[var(--cl-surface-2)]";
    const tdCls = "px-2 py-1 border-b border-[var(--cl-border)]";

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className={`${needsParts ? "max-w-2xl" : "max-w-md"} bg-white dark:bg-zinc-950 border-[var(--cl-border)]`}>
                <DialogHeader>
                    <DialogTitle className="text-[var(--cl-text)] text-base">
                        Update Status
                    </DialogTitle>
                </DialogHeader>

                {/* Job summary */}
                <div className="rounded-md border border-[var(--cl-border)] bg-[var(--cl-surface-2)] px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[var(--cl-accent)]">#{job.job_no}</span>
                        <span className="text-[var(--cl-text-muted)]">·</span>
                        <span className="text-[var(--cl-text)]">{job.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[var(--cl-text-muted)]">
                        <span>{job.job_status_name}</span>
                        <span>→</span>
                        <span className="font-semibold text-[var(--cl-text)]">{transition.targetName}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Technician — RT */}
                    {fields === "RT" && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">
                                Technician <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={form.watch("technician_id")}
                                onValueChange={v => form.setValue("technician_id", v)}
                            >
                                <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                                    <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.map(t => (
                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.technician_id && (
                                <p className="text-xs text-red-500 mt-1">{form.formState.errors.technician_id.message}</p>
                            )}
                        </div>
                    )}

                    {/* Estimated Price — RE */}
                    {fields === "RE" && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="stm-estimate-amount">
                                Estimated Price
                            </Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                id="stm-estimate-amount"
                                min="0"
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                {...form.register("estimate_amount")}
                            />
                        </div>
                    )}

                    {/* Amount — RA or RAP */}
                    {(fields === "RA" || fields === "RAP") && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="stm-amount">
                                Amount
                            </Label>
                            <Input
                                className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                                id="stm-amount"
                                min="0"
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                {...form.register("amount")}
                            />
                        </div>
                    )}

                    {/* Date — always */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="stm-date">
                            Date
                        </Label>
                        <Input
                            className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="stm-date"
                            type="date"
                            {...form.register("transaction_date")}
                        />
                        {form.formState.errors.transaction_date && (
                            <p className="text-xs text-red-500 mt-1">{form.formState.errors.transaction_date.message}</p>
                        )}
                    </div>

                    {/* Remarks — always */}
                    <div>
                        <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="stm-remarks">
                            Remarks
                        </Label>
                        <Textarea
                            className="min-h-[72px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                            id="stm-remarks"
                            placeholder="Optional remarks…"
                            {...form.register("remarks")}
                        />
                    </div>

                    {/* Parts grid — P or RAP */}
                    {needsParts && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wide text-[var(--cl-text-muted)]">Parts Used</span>
                                <Button
                                    className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    size="sm"
                                    type="button"
                                    onClick={addNewPartRow}
                                >
                                    + Add Part
                                </Button>
                            </div>
                            <div className="overflow-x-auto rounded border border-[var(--cl-border)]">
                                <table className="min-w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            <th className={thCls}>Part Code</th>
                                            <th className={thCls}>Part Name</th>
                                            <th className={thCls}>UOM</th>
                                            <th className={`${thCls} text-right`}>Qty</th>
                                            <th className={thCls}>Remarks</th>
                                            <th className={thCls}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingParts.length === 0 && newParts.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-2 py-3 text-center text-xs text-[var(--cl-text-muted)] italic">
                                                    No parts added yet. Click "+ Add Part" to add.
                                                </td>
                                            </tr>
                                        )}
                                        {existingParts.map(row => (
                                            <tr key={row.id} className="hover:bg-[var(--cl-surface-2)]/40">
                                                <td className={`${tdCls} font-mono font-medium`}>{row.part_code}</td>
                                                <td className={tdCls}>{row.part_name}</td>
                                                <td className={tdCls}>{row.uom}</td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 w-16 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs text-right px-1"
                                                        min={0.01}
                                                        step="0.01"
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={e => updateExistingPart(row.id, "quantity", e.target.valueAsNumber)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs px-1"
                                                        placeholder="Remarks…"
                                                        value={row.remarks}
                                                        onChange={e => updateExistingPart(row.id, "remarks", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <button
                                                        className="rounded p-0.5 text-red-500 hover:bg-red-500/10"
                                                        type="button"
                                                        onClick={() => deleteExistingPart(row.id)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {newParts.map(row => (
                                            <tr key={row._key} className="hover:bg-[var(--cl-surface-2)]/40">
                                                <td className={tdCls}>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                className={`h-6 w-24 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs font-mono px-1 ${row.part_id ? "border-emerald-500" : ""}`}
                                                                placeholder="Code…"
                                                                value={row.part_code}
                                                                onChange={e => updateNewPart(row._key, "part_code", e.target.value)}
                                                                onBlur={() => void lookupPartByCode(row._key, row.part_code)}
                                                            />
                                                            {lookingUp[row._key] && <Loader2 className="h-3 w-3 animate-spin text-[var(--cl-text-muted)]" />}
                                                        </div>
                                                        {row.part_name && (
                                                            <span className="text-[10px] text-[var(--cl-accent)] truncate max-w-[6rem]">{row.part_name}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`${tdCls} text-[var(--cl-text-muted)]`}>{row.part_name || "—"}</td>
                                                <td className={tdCls}>{row.uom || "—"}</td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 w-16 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs text-right px-1"
                                                        min={0.01}
                                                        step="0.01"
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={e => updateNewPart(row._key, "quantity", e.target.valueAsNumber)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <Input
                                                        className="h-6 border-[var(--cl-border)] bg-[var(--cl-surface)] text-xs px-1"
                                                        placeholder="Remarks…"
                                                        value={row.remarks}
                                                        onChange={e => updateNewPart(row._key, "remarks", e.target.value)}
                                                    />
                                                </td>
                                                <td className={tdCls}>
                                                    <button
                                                        className="rounded p-0.5 text-red-500 hover:bg-red-500/10"
                                                        type="button"
                                                        onClick={() => removeNewPartRow(row._key)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--cl-border)]">
                    <Button
                        className="h-8 px-4 text-xs border border-[var(--cl-border)] bg-white hover:bg-gray-50 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-200"
                        disabled={isSubmitting}
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        disabled={isSubmitting}
                        type="button"
                        onClick={() => void form.handleSubmit(handleSubmit)()}
                    >
                        {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Confirm
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
