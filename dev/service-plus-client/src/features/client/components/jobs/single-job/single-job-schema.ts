import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const singleJobFormSchema = z.object({
    customer_id:          z.number({ error: MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_CUSTOMER_REQUIRED),
    customer_name:        z.string().optional().default(""),
    address_snapshot:     z.string().optional().default(""),
    job_date:             z.string().min(1),
    job_type_id:          z.number({ error: MESSAGES.ERROR_JOB_TYPE_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_TYPE_REQUIRED),
    receive_manner_id:    z.number({ error: MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED }).int().positive(MESSAGES.ERROR_JOB_RECEIVE_MANNER_REQUIRED),
    receive_condition_id: z.number().nullable().optional(),
    job_status_id:        z.number().nullable().optional(),
    model_id:             z.number().nullable().optional(),
    serial_no:            z.string().optional().default(""),
    quantity:             z.coerce.number().int().min(1),
    problem_reported:     z.string().optional().default(""),
    warranty_card_no:     z.string().optional().default(""),
    remarks:              z.string().optional().default(""),

});

export type SingleJobFormValues = z.infer<typeof singleJobFormSchema>;

export function getSingleJobDefaultValues(): SingleJobFormValues {
    return {
        customer_id:          undefined as unknown as number,
        customer_name:        "",
        address_snapshot:     "",
        job_date:             new Date().toISOString().slice(0, 10),
        job_type_id:          undefined as unknown as number,
        receive_manner_id:    undefined as unknown as number,
        receive_condition_id: null,
        job_status_id:        null,
        model_id:             null,
        serial_no:            "",
        quantity:             1,
        problem_reported:     "",
        warranty_card_no:     "",
        remarks:              "",

    };
}


