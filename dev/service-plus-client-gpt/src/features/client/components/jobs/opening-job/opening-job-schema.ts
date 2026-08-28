import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const openingJobFormSchema = z.object({
    alternate_job_no:     z.string().min(1, MESSAGES.ERROR_OPENING_JOB_NO_REQUIRED),
    customer_id:          z.number({ error: MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED),
    customer_name:        z.string().optional().default(""),
    mobile:               z.string().optional().default(""),
    job_date:             z.string().min(1),
    purchase_date:        z.string().optional().default(""),
    job_type_id:          z.number({ error: MESSAGES.ERROR_JOB_TYPE_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_TYPE_REQUIRED),
    receive_manner_id:    z.number({ error: MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED),
    receive_condition_id: z.number().nullable().optional(),
    model_id:             z.number({ error: MESSAGES.ERROR_JOB_MODEL_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_MODEL_REQUIRED),
    serial_no:            z.string().optional().default(""),
    qty:             z.coerce.number().int().min(1),
    problem_reported:     z.string().optional().default(""),
    warranty_card_no:     z.string().optional().default(""),
    job_status_id:        z.number({ error: "Please select a job status." }).int().positive("Please select a job status."),
    technician_id:        z.number().nullable().optional(),
    diagnosis:            z.string().optional().default(""),
    work_done:            z.string().optional().default(""),
    amount:               z.string().optional().default(""),
    remarks:              z.string().optional().default(""),
    division_id:          z.number().int().min(1).optional(),
});

export type OpeningJobFormValues = z.infer<typeof openingJobFormSchema>;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function getOpeningJobDefaultValues(defaultDivisionId = 1): OpeningJobFormValues {
    return {
        alternate_job_no:     "",
        customer_id:          undefined as unknown as number,
        customer_name:        "",
        mobile:               "",
        job_date:             today(),
        purchase_date:        "",
        job_type_id:          undefined as unknown as number,
        receive_manner_id:    undefined as unknown as number,
        receive_condition_id: null,
        model_id:             undefined as unknown as number,
        serial_no:            "",
        qty:             1,
        problem_reported:     "",
        warranty_card_no:     "",
        job_status_id:        undefined as unknown as number,
        technician_id:        null,
        diagnosis:            "",
        work_done:            "",
        amount:               "",
        remarks:              "",
        division_id:          defaultDivisionId,
    };
}
