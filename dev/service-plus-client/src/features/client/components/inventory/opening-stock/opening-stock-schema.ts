import { z } from "zod";

export const openingStockSchema = z.object({
    entry_date: z.string().min(1, "Entry date is required"),
    ref_no:     z.string().optional(),
    remarks:    z.string().optional(),
});

export type OpeningStockFormValues = z.infer<typeof openingStockSchema>;

export function getOpeningStockDefaultValues(): OpeningStockFormValues {
    return {
        entry_date: new Date().toISOString().slice(0, 10),
        ref_no:     "",
        remarks:    "",
    };
}
