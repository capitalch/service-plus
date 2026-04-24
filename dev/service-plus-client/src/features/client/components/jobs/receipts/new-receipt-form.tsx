import { forwardRef, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";
import type { JobLookupForReceiptType, JobReceiptDetailType } from "@/features/client/types/receipt";
import { JobLookupCombobox } from "./job-lookup-combobox";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewReceiptFormHandleType = {
    reset:  () => void;
    submit: () => void;
};

type NewReceiptFormPropsType = {
    initial:        JobReceiptDetailType | null;
    onSuccess:      () => void;
    onStatusChange: (s: { isSubmitting: boolean; isValid: boolean }) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Bank Transfer", "Card", "Cash", "Cheque", "Others", "UPI"] as const;

const today = () => new Date().toISOString().slice(0, 10);

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
    amount:       z.coerce.number({ error: MESSAGES.ERROR_RECEIPT_AMOUNT_REQUIRED })
                    .positive(MESSAGES.ERROR_RECEIPT_AMOUNT_REQUIRED),
    job_id:       z.number({ error: MESSAGES.ERROR_RECEIPT_JOB_REQUIRED })
                    .int()
                    .positive(MESSAGES.ERROR_RECEIPT_JOB_REQUIRED),
    payment_date: z.string().min(1, MESSAGES.ERROR_RECEIPT_PAYMENT_DATE_REQUIRED),
    payment_mode: z.string().min(1, MESSAGES.ERROR_RECEIPT_PAYMENT_MODE_REQUIRED),
    reference_no: z.string().optional().default(""),
    remarks:      z.string().optional().default(""),
});

type FormValuesType = z.infer<typeof formSchema>;

// ─── FieldError ───────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
    return message ? <p className="mt-1 text-xs text-red-500">{message}</p> : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NewReceiptForm = forwardRef<NewReceiptFormHandleType, NewReceiptFormPropsType>(
    ({ initial, onStatusChange, onSuccess }, ref) => {
        const dbName = useAppSelector(selectDbName);
        const schema = useAppSelector(selectSchema);

        const isEdit = initial !== null && initial.id !== null;

        const form = useForm<FormValuesType>({
            defaultValues: {
                amount:       initial?.amount       ?? ("" as unknown as number),
                job_id:       initial?.job_id       ?? undefined,
                payment_date: initial?.payment_date ?? today(),
                payment_mode: initial?.payment_mode ?? "",
                reference_no: initial?.reference_no ?? "",
                remarks:      initial?.remarks      ?? "",
            },
            mode:     "onChange",
            resolver: zodResolver(formSchema) as any,
        });

        const { formState: { errors, isSubmitting, isValid }, setValue, watch } = form;

        // Notify parent of form state changes
        const jobId = watch("job_id");
        void jobId; // used implicitly via watch to trigger re-render

        async function handleSubmit() {
            const valid = await form.trigger();
            if (!valid) return;
            const values = form.getValues();
            onStatusChange({ isSubmitting: true, isValid: true });
            try {
                const xData: Record<string, unknown> = {
                    amount:       Number(values.amount),
                    job_id:       values.job_id,
                    payment_date: values.payment_date,
                    payment_mode: values.payment_mode,
                    reference_no: values.reference_no || null,
                    remarks:      values.remarks || null,
                };
                if (isEdit && initial?.id) xData.id = initial.id;

                await apolloClient.mutate({
                    mutation:  GRAPHQL_MAP.genericUpdate,
                    variables: {
                        db_name: dbName,
                        schema,
                        value: graphQlUtils.buildGenericUpdateValue({
                            tableName: "job_payment",
                            xData,
                        }),
                    },
                });
                toast.success(isEdit ? MESSAGES.SUCCESS_RECEIPT_UPDATED : MESSAGES.SUCCESS_RECEIPT_CREATED);
                onSuccess();
            } catch {
                toast.error(isEdit ? MESSAGES.ERROR_RECEIPT_UPDATE_FAILED : MESSAGES.ERROR_RECEIPT_CREATE_FAILED);
            } finally {
                onStatusChange({ isSubmitting: false, isValid: true });
            }
        }

        function handleReset() {
            form.reset({
                amount:       "" as unknown as number,
                job_id:       undefined,
                payment_date: today(),
                payment_mode: "",
                reference_no: "",
                remarks:      "",
            });
        }

        useImperativeHandle(ref, () => ({
            reset:  handleReset,
            submit: () => { void handleSubmit(); },
        }));

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

                {/* Expose isValid to parent via effect */}
                <IsValidReporter isValid={isValid} isSubmitting={isSubmitting} onStatusChange={onStatusChange} />
            </div>
        );
    }
);
NewReceiptForm.displayName = "NewReceiptForm";

// ─── Helper: report validity to parent ───────────────────────────────────────

import { useEffect } from "react";

function IsValidReporter({
    isSubmitting,
    isValid,
    onStatusChange,
}: {
    isSubmitting: boolean;
    isValid: boolean;
    onStatusChange: (s: { isSubmitting: boolean; isValid: boolean }) => void;
}) {
    useEffect(() => {
        onStatusChange({ isSubmitting, isValid });
    }, [isValid, isSubmitting, onStatusChange]);
    return null;
}
