import { z } from "zod";
import { MESSAGES } from "@/constants/messages";
import type { DocumentSequenceRow } from "@/features/client/types/sales";
import type { BatchJobRow } from "@/features/client/types/job";

export const batchJobFormSchema = z.object({
    batch_date:        z.string().min(1),
    customer_id:       z.number({ error: MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED),
    customer_name:     z.string().optional().default(""),
    job_type_id:       z.number({ error: MESSAGES.ERROR_JOB_TYPE_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_TYPE_REQUIRED),
    receive_manner_id: z.number({ error: MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED),
});

export type BatchJobFormValues = z.infer<typeof batchJobFormSchema>;

export function getBatchJobDefaultValues(): BatchJobFormValues {
    return {
        batch_date:        new Date().toISOString().slice(0, 10),
        customer_id:       undefined as unknown as number,
        customer_name:     "",
        job_type_id:       undefined as unknown as number,
        receive_manner_id: undefined as unknown as number,
    };
}

export function buildJobNo(prefix: string, separator: string, nextNumber: number, padding: number): string {
    return `${prefix}${separator}${String(nextNumber).padStart(padding, "0")}`;
}

export function blankBatchRow(seq: DocumentSequenceRow | null, offset: number): BatchJobRow {
    return {
        localId:                  crypto.randomUUID(),
        job_no:                   seq ? buildJobNo(seq.prefix, seq.separator, seq.next_number + offset, seq.padding) : "",
        product_brand_model_id:   null,
        serial_no:                "",
        problem_reported:         "",
        warranty_card_no:         "",
        job_receive_condition_id: null,
        remarks:                  "",
        quantity:                 1,
        isDeletable:              true,
    };
}
