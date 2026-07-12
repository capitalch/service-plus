import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { TechnicianRow } from "@/features/client/types/job";
import type { DivisionContextType } from "@/features/client/types/division";
import { STATUS_COLORS } from "./status-transitions";
import type { Transition } from "./status-transitions";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobSummary = {
    id:              number;
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    division_id:     number | null;
    technician_id:   number | null;
    job_receive_manner_name:    string | null;
    device_details:             string | null;
    job_receive_condition_name: string | null;
};

export type TransitionPayload = {
    targetStatusId:   number;
    division_id:      number | null;
    technician_id:    number | null;
    estimate_amount:  number | null;
    remarks:          string;
    transaction_date: string;
    is_final:         boolean;
    is_closed:        boolean;
};

type Props = {
    divisions:   DivisionContextType[];
    job:         JobSummary;
    transition:  Transition;
    technicians: TechnicianRow[];
    onClose:     () => void;
    onSubmit:    (payload: TransitionPayload) => Promise<void>;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
    division_id:      z.string().optional(),
    technician_id:    z.string().optional(),
    estimate_amount:  z.string().optional(),
    remarks:          z.string().optional(),
    transaction_date: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof formSchema>;

const today = new Date().toISOString().slice(0, 10);

// ─── Component ────────────────────────────────────────────────────────────────

export const StatusTransitionModal = ({ divisions, job, transition, technicians, onClose, onSubmit }: Props) => {
    const { fields } = transition;
    const showEstimate = fields.includes("E");
    const canPickDivision = divisions.length > 1;

    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    // A money receipt locks the job to its current division: moving it elsewhere
    // would strand the already-issued receipt under the old division. Only check
    // when a division change is actually offered.
    const [hasReceipts, setHasReceipts] = useState(false);

    useEffect(() => {
        if (!canPickDivision || !dbName || !schema) return;
        let cancelled = false;
        apolloClient
            .query<{ genericQuery: { id: number }[] | null }>({
                fetchPolicy: "network-only",
                query:       GRAPHQL_MAP.genericQuery,
                variables:   {
                    db_name: dbName,
                    schema,
                    value: graphQlUtils.buildGenericQueryValue({
                        sqlId:   SQL_MAP.GET_JOB_PAYMENTS_BY_JOB,
                        sqlArgs: { job_id: job.id },
                    }),
                },
            })
            .then(res => { if (!cancelled) setHasReceipts((res.data?.genericQuery ?? []).length > 0); })
            .catch(() => { /* on failure, leave division editable; server has no guard */ });
        return () => { cancelled = true; };
    }, [canPickDivision, dbName, schema, job.id]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            division_id:      job.division_id ? String(job.division_id) : "",
            technician_id:    job.technician_id ? String(job.technician_id) : "",
            estimate_amount:  "",
            remarks:          "",
            transaction_date: today,
        },
    });

    async function handleSubmit(values: FormValues) {
        // Guard: block a division change once a receipt exists for the job.
        const nextDivisionId = values.division_id ? Number(values.division_id) : null;
        if (hasReceipts && nextDivisionId !== (job.division_id ?? null)) {
            form.setValue("division_id", job.division_id ? String(job.division_id) : "");
            return;
        }
        if (fields.includes("T") && !values.technician_id) {
            form.setError("technician_id", { message: "Technician is required" });
            return;
        }
        if (showEstimate && (!values.estimate_amount || Number(values.estimate_amount) < 0)) {
            form.setError("estimate_amount", { message: "Estimated price is required" });
            return;
        }
        await onSubmit({
            targetStatusId:   transition.targetId,
            division_id:      values.division_id ? Number(values.division_id) : null,
            technician_id:    values.technician_id ? Number(values.technician_id) : null,
            estimate_amount:  values.estimate_amount ? Number(values.estimate_amount) : 0,
            remarks:          values.remarks ?? "",
            transaction_date: values.transaction_date,
            is_final:         false,
            is_closed:        false,
        });
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                    {/* ── Division ───────────────────────────────────────────── */}
                    {canPickDivision && (
                        <div className="space-y-1.5">
                            <Label htmlFor="stm-division">Division</Label>
                            <Select
                                disabled={hasReceipts}
                                value={form.watch("division_id")}
                                onValueChange={v => form.setValue("division_id", v)}
                            >
                                <SelectTrigger id="stm-division" className="h-9">
                                    <SelectValue placeholder="Select division" />
                                </SelectTrigger>
                                <SelectContent>
                                    {divisions.map(d => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {hasReceipts && (
                                <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{MESSAGES.ERROR_DIVISION_CHANGE_HAS_RECEIPTS}</span>
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── Estimate ───────────────────────────────────────────── */}
                    {showEstimate && (
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pricing</h4>
                            <div className="space-y-1.5">
                                <Label htmlFor="stm-estimate-amount">
                                    Estimated Price <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    className={`h-9 ${form.formState.errors.estimate_amount ? "border-red-400" : ""}`}
                                    id="stm-estimate-amount"
                                    min="0"
                                    placeholder="0.00"
                                    step="0.01"
                                    type="number"
                                    {...form.register("estimate_amount")}
                                />
                                {form.formState.errors.estimate_amount && (
                                    <p className="text-xs text-red-500">{form.formState.errors.estimate_amount.message}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Date + Technician + Remarks ────────────────────────── */}
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
