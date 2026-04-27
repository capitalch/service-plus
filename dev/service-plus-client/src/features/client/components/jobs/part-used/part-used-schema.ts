import { z } from "zod";

export const partUsedFormSchema = z.object({
  job_id: z.number().int().positive(),
});

export type PartUsedFormValues = z.infer<typeof partUsedFormSchema>;

export const getPartUsedDefaultValues = (): PartUsedFormValues => ({
  job_id: 0,
});

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

export type NewLine = {
    _key:      string;
    brand_id:  number | null;
    part_id:   number | null;
    part_code: string;
    part_name: string;
    uom:       string;
    quantity:  number;
    remarks:   string;
};

export function getEmptyPartUsedLine(): NewLine {
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
