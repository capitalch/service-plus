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
    };
}
