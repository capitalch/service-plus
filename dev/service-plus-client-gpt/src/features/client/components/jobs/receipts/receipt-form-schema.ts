import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const PAYMENT_MODES = ["Bank Transfer", "Card", "Cash", "Cheque", "Others", "UPI"] as const;

export const receiptFormSchema = z.object({
    amount:       z.coerce.number({ error: MESSAGES.ERROR_RECEIPT_AMOUNT_REQUIRED })
                    .positive(MESSAGES.ERROR_RECEIPT_AMOUNT_REQUIRED),
    job_id:       z.number({ error: MESSAGES.ERROR_RECEIPT_JOB_REQUIRED })
                    .int()
                    .positive(MESSAGES.ERROR_RECEIPT_JOB_REQUIRED),
    payment_date: z.string().min(1, MESSAGES.ERROR_RECEIPT_PAYMENT_DATE_REQUIRED),
    payment_mode: z.string().min(1, MESSAGES.ERROR_RECEIPT_PAYMENT_MODE_REQUIRED),
    reference_no: z.string().optional().default(""),
    remarks:      z.string().optional().default(""),
    // Carried from the selected job so overpayment can be blocked for final
    // jobs. `max_due` is null when the cap does not apply (non-final jobs).
    is_final_job: z.boolean().optional().default(false),
    max_due:      z.number().nullable().optional().default(null),
}).superRefine((val, ctx) => {
    if (val.is_final_job && val.max_due != null && Number(val.amount) - val.max_due > 0.005) {
        ctx.addIssue({
            code:    z.ZodIssueCode.custom,
            path:    ["amount"],
            message: `${MESSAGES.ERROR_RECEIPT_OVERPAYMENT_FINAL} Maximum allowed: ₹${val.max_due.toFixed(2)}.`,
        });
    }
});

export type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

export function getReceiptDefaultValues(): ReceiptFormValues {
    return {
        amount:       "" as unknown as number,
        job_id:       undefined as unknown as number,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: "",
        reference_no: "",
        remarks:      "",
        is_final_job: false,
        max_due:      null,
    };
}
