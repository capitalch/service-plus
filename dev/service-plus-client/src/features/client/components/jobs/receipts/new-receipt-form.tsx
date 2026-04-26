import { useFormContext } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { JobLookupForReceiptType, JobReceiptDetailType } from "@/features/client/types/receipt";
import { JobLookupCombobox } from "./job-lookup-combobox";
import { type ReceiptFormValues, PAYMENT_MODES } from "./receipt-form-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type NewReceiptFormPropsType = {
    initial: JobReceiptDetailType | null;
};

// ─── FieldError ───────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="mt-1 text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewReceiptForm({ initial }: NewReceiptFormPropsType) {
    const isEdit = initial !== null && initial.id !== null;

    const form = useFormContext<ReceiptFormValues>();
    const { formState: { errors, isSubmitting }, setValue, watch } = form;

    return (
        <div className="space-y-4 p-1">
            {/* Job */}
            <div>
                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">
                    Job <span className="text-red-500">*</span>
                </Label>
                <JobLookupCombobox
                    disabled={isEdit}
                    value={watch("job_id") ?? null}
                    onChange={(id, _job: JobLookupForReceiptType | null) => {
                        setValue("job_id", id ?? (undefined as unknown as number), { shouldValidate: true });
                    }}
                />
                <FieldError message={errors.job_id?.message} />
            </div>

            {/* Payment Date + Payment Mode */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="receipt-payment-date">
                        Payment Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                        id="receipt-payment-date"
                        type="date"
                        {...form.register("payment_date")}
                    />
                    <FieldError message={errors.payment_date?.message} />
                </div>

                <div>
                    <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]">
                        Payment Mode <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        value={watch("payment_mode")}
                        onValueChange={v => setValue("payment_mode", v, { shouldValidate: true })}
                    >
                        <SelectTrigger className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm">
                            <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                            {PAYMENT_MODES.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError message={errors.payment_mode?.message} />
                </div>
            </div>

            {/* Amount + Reference No */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="receipt-amount">
                        Amount <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                        id="receipt-amount"
                        min="0.01"
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        {...form.register("amount")}
                    />
                    <FieldError message={errors.amount?.message} />
                </div>

                <div>
                    <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="receipt-ref-no">
                        Reference No
                    </Label>
                    <Input
                        className="h-9 border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                        id="receipt-ref-no"
                        placeholder="Cheque / UPI ref…"
                        type="text"
                        {...form.register("reference_no")}
                    />
                </div>
            </div>

            {/* Remarks */}
            <div>
                <Label className="mb-1.5 block text-sm font-medium text-[var(--cl-text)]" htmlFor="receipt-remarks">
                    Remarks
                </Label>
                <Textarea
                    className="min-h-[72px] border-[var(--cl-border)] bg-[var(--cl-surface)] text-sm"
                    id="receipt-remarks"
                    placeholder="Optional remarks…"
                    {...form.register("remarks")}
                />
            </div>

            {isSubmitting && (
                <div className="flex items-center gap-2 text-xs text-[var(--cl-text-muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </div>
            )}
        </div>
    );
}
