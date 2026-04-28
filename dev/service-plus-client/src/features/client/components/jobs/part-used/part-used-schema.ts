import { z } from "zod";

export const newPartUsedLineSchema = z.object({
    _key:      z.string(),
    brand_id:  z.number().nullable(),
    part_id:   z.number().nullable(),
    part_code: z.string().default(""),
    part_name: z.string().default(""),
    uom:       z.string().default(""),
    quantity:  z.number().min(0).default(1),
    remarks:   z.string().default(""),
});

export type NewPartUsedLineFormValues = z.infer<typeof newPartUsedLineSchema>;

export const partUsedFormSchema = z.object({
    job_id:      z.number().int().positive(),
    newLines:    z.array(newPartUsedLineSchema),
    deletedIds:  z.array(z.number()),
});

export type PartUsedFormValues = z.infer<typeof partUsedFormSchema>;

export const getPartUsedDefaultValues = (): PartUsedFormValues => ({
    job_id:     0,
    newLines:   [getInitialPartUsedLine()],
    deletedIds: [],
});

export function getInitialPartUsedLine(): NewPartUsedLineFormValues {
    return {
        _key:      crypto.randomUUID(),
        brand_id:  null,
        part_id:   null,
        part_code: "",
        part_name: "",
        uom:       "",
        quantity:  1,
        remarks:   "",
    };
}

export type JobSearchRow = {
    id:              number;
    job_no:          string;
    job_date:        string;
    branch_id:       number;
    is_closed:       boolean;
    customer_name:   string;
    mobile:          string;
    job_status_name: string;
};

export type ExistingLine = {
    id:        number;
    part_id:   number;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string | null;
};
