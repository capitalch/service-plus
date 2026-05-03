import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const batchJobRowSchema = z.object({
    id:                       z.number().nullable(),
    localId:                  z.string(),
    job_type_id:              z.number({ error: MESSAGES.ERROR_JOB_TYPE_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_TYPE_REQUIRED),
    product_brand_model_id:   z.number().nullable(),
    serial_no:                z.string().default(""),
    problem_reported:         z.string().default(""),
    warranty_card_no:         z.string().default(""),
    job_receive_condition_id: z.number().nullable(),
    remarks:                  z.string().default(""),
    quantity:                 z.number().min(1).default(1),
    isDeletable:              z.boolean().default(true),
});

export type BatchJobRowFormValues = z.infer<typeof batchJobRowSchema>;

export const batchJobFormSchema = z.object({
    batch_date:        z.string().min(1),
    customer_id:       z.number({ error: MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED),
    customer_name:     z.string().optional().default(""),
    receive_manner_id: z.number({ error: MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED),
    rows: z.array(batchJobRowSchema).min(2, "Minimum 2 jobs are required for a batch"),
});

export type BatchJobFormValues = z.infer<typeof batchJobFormSchema>;

export function getInitialBatchJobRow(): BatchJobRowFormValues {
    return {
        id:                       null,
        localId:                  crypto.randomUUID(),
        job_type_id:              undefined as unknown as number,
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

export function getBatchJobDefaultValues(): BatchJobFormValues {
    return {
        batch_date:        new Date().toISOString().slice(0, 10),
        customer_id:       undefined as unknown as number,
        customer_name:     "",
        receive_manner_id: undefined as unknown as number,
        rows:              [getInitialBatchJobRow(), getInitialBatchJobRow()],
    };
}
