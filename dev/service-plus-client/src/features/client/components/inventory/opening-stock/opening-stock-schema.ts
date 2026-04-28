import { z } from "zod";

export const openingStockLineSchema = z.object({
    _key:      z.string(),
    brand_id:  z.number().nullable(),
    part_code: z.string().default(""),
    part_id:   z.number().nullable(),
    part_name: z.string().default(""),
    qty:       z.number().min(0).default(0),
    remarks:   z.string().default(""),
    unit_cost: z.number().min(0).default(0),
});

export type OpeningStockLineFormValues = z.infer<typeof openingStockLineSchema>;

export const openingStockSchema = z.object({
    entry_date: z.string().min(1, "Entry date is required"),
    ref_no:     z.string().optional(),
    remarks:    z.string().optional(),
    lines: z.array(openingStockLineSchema).min(1, "At least one item required"),
});

export type OpeningStockFormValues = z.infer<typeof openingStockSchema>;

export function getOpeningStockDefaultValues(): OpeningStockFormValues {
    return {
        entry_date: new Date().toISOString().slice(0, 10),
        ref_no:     "",
        remarks:    "",
        lines:     [getInitialOpeningStockLine()],
    };
}

export function getInitialOpeningStockLine(brandId?: number | null): OpeningStockLineFormValues {
    return {
        _key:      crypto.randomUUID(),
        brand_id:  brandId ?? null,
        part_code: "",
        part_id:   null,
        part_name: "",
        qty:       0,
        remarks:   "",
        unit_cost: 0,
    };
}
