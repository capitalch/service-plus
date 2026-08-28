import { z } from "zod";

export const stockAdjFormSchema = z.object({
    adjustment_date:   z.string().min(1, "Date is required"),
    adjustment_reason: z.string().min(1, "Reason is required"),
    ref_no:            z.string().optional(),
    remarks:           z.string().optional(),
    lines:             z.array(z.object({
        _key:        z.string(),
        part_id:     z.number().nullable(),
        brand_id:    z.number().nullable(),
        part_code:   z.string().default(""),
        part_name:   z.string().default(""),
        uom:         z.string().default(""),
        dr_cr:       z.enum(["D", "C"]).default("D"),
        qty:         z.number().min(0).default(1),
        remarks:     z.string().default(""),
    })).min(1, "At least one item required"),
});

export type StockAdjFormValues = z.infer<typeof stockAdjFormSchema>;

export function getInitialLine(brandId: number | null = null): StockAdjFormValues["lines"][number] {
    return {
        _key:        crypto.randomUUID(),
        part_id:     null,
        brand_id:    brandId,
        part_code:   "",
        part_name:   "",
        uom:         "",
        dr_cr:       "D",
        qty:         1,
        remarks:     "",
    };
}

export function getStockAdjDefaultValues(): StockAdjFormValues {
    return {
        adjustment_date:   new Date().toISOString().slice(0, 10),
        adjustment_reason: "",
        ref_no:            "",
        remarks:           "",
        lines:             [getInitialLine()],
    };
}
