import { z } from "zod";

const newPartUsedLineSchema = z.object({
    _key:          z.string(),
    brand_id:      z.number().nullable(),
    part_id:       z.number().nullable(),
    part_code:     z.string().default(""),
    part_name:     z.string().default(""),
    uom:           z.string().default(""),
    qty:           z.number().min(0).default(1),
    cost_price:    z.number().min(0).default(0),
    selling_price: z.number().min(0).default(0),
    gst_rate:      z.number().min(0).default(0),
    hsn_code:      z.string().default(""),
    remarks:       z.string().default(""),
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
        _key:          crypto.randomUUID(),
        brand_id:      null,
        part_id:       null,
        part_code:     "",
        part_name:     "",
        uom:           "",
        qty:           1,
        cost_price:    0,
        selling_price: 0,
        gst_rate:      0,
        hsn_code:      "",
        remarks:       "",
    };
}

export type ConsumptionRow = {
    id:                   number;
    created_at:           string;
    job_id:               number;
    job_no:               string;
    job_date:             string;
    is_closed:            boolean;
    is_final:             boolean;
    job_status_name:      string;
    job_status_code:      string;
    job_type_name:        string;
    job_type_code:        string;
    part_id:              number;
    brand_id:             number;
    part_code:            string;
    part_name:            string;
    uom:                  string;
    qty:                  number;
    cost_price:           number;
    selling_price:        number;
    gst_rate:             number;
    hsn_code:             string | null;
    remarks:              string | null;
    branch_name:          string;
    stock_transaction_id: number | null;
};

export type ExistingLine = {
    id:            number;
    part_id:       number;
    part_code:     string;
    part_name:     string;
    uom:           string;
    qty:           number;
    cost_price:    number;
    selling_price: number;
    gst_rate:      number;
    hsn_code:      string | null;
    remarks:       string | null;
};
