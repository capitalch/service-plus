import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TechnicianRow } from "@/features/client/types/job";
import type { Transition } from "./status-transitions";

type JobSummary = {
    job_no:          string;
    customer_name:   string;
    job_status_name: string;
    technician_id:   number | null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransitionPayload = {
    targetStatusId:  number;
    technician_id:   number | null;
    amount:          number | null;
    estimate_amount: number | null;
    remarks:         string;
    is_final:        boolean;
    is_closed:       boolean;
};

type Props = {
    job:         JobSummary;
    transition:  Transition;
    technicians: TechnicianRow[];
    onClose:     () => void;
    onSubmit:    (payload: TransitionPayload) => Promise<void>;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
    technician_id:   z.string().optional(),
    amount:          z.string().optional(),
    estimate_amount: z.string().optional(),
    remarks:         z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export const StatusTransitionModal = ({ job, transition, technicians, onClose, onSubmit }: Props) => {
    const { fields } = transition;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            technician_id:   job.technician_id ? String(job.technician_id) : "",
            amount:          "",
            estimate_amount: "",
            remarks:         "",
        },
    });

    async function handleSubmit(values: FormValues) {
        await onSubmit({
            targetStatusId:  transition.targetId,
            technician_id:   values.technician_id ? Number(values.technician_id) : null,
            amount:          values.amount          ? Number(values.amount)          : null,
            estimate_amount: values.estimate_amount ? Number(values.estimate_amount) : null,
            remarks:         values.remarks ?? "",
            is_final:        false,
            is_closed:       false,
        });
    }

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border-[var(--cl-border)]">
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
                    {/* Technician — only for RT */}
                    {fields === "RT" && (
                        <div>
                            <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">
                                Technician
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
                        </div>
                    )}

                    {/* Estimated Price — only for RE */}
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

                    {/* Amount — only for RA */}
                    {fields === "RA" && (
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

                    {/* Remarks — for R, RT, RA, RE */}
                    {fields !== "none" && (
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
