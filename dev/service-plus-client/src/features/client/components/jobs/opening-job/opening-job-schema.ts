import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const openingJobFormSchema = z.object({
    job_no:               z.string().min(1, MESSAGES.ERROR_OPENING_JOB_NO_REQUIRED),
    customer_id:          z.number({ error: MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED),
    customer_name:        z.string().optional().default(""),
    mobile:               z.string().optional().default(""),
    job_date:             z.string().min(1),
    job_type_id:          z.number({ error: MESSAGES.ERROR_JOB_TYPE_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_TYPE_REQUIRED),
    receive_manner_id:    z.number({ error: MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED),
    receive_condition_id: z.number().nullable().optional(),
    model_id:             z.number().nullable().optional(),
    serial_no:            z.string().optional().default(""),
    quantity:             z.coerce.number().int().min(1),
    problem_reported:     z.string().min(1, MESSAGES.ERROR_JOB_PROBLEM_REQUIRED),
    warranty_card_no:     z.string().optional().default(""),
    job_status_id:        z.number({ error: "Please select a job status." }).int().positive("Please select a job status."),
    technician_id:        z.number().nullable().optional(),
    diagnosis:            z.string().optional().default(""),
    work_done:            z.string().optional().default(""),
    amount:               z.string().optional().default(""),
    delivery_date:        z.string().optional().default(""),
    is_closed:            z.boolean().optional().default(false),
    is_final:             z.boolean().optional().default(false),
    remarks:              z.string().optional().default(""),
});

export type OpeningJobFormValues = z.infer<typeof openingJobFormSchema>;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function getOpeningJobDefaultValues(): OpeningJobFormValues {
    return {
        job_no:               "",
        customer_id:          undefined as unknown as number,
        customer_name:        "",
        mobile:               "",
        job_date:             today(),
        job_type_id:          undefined as unknown as number,
        receive_manner_id:    undefined as unknown as number,
        receive_condition_id: null,
        model_id:             null,
        serial_no:            "",
        quantity:             1,
        problem_reported:     "",
        warranty_card_no:     "",
        job_status_id:        undefined as unknown as number,
        technician_id:        null,
        diagnosis:            "",
        work_done:            "",
        amount:               "",
        delivery_date:        "",
        is_closed:            false,
        is_final:             false,
        remarks:              "",
    };
}

export function normalizeJobNo(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (trimmed.toLowerCase().startsWith("z-")) return `Z-${trimmed.slice(2)}`;
    return `Z-${trimmed}`;
}
