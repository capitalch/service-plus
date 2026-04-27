import { z } from "zod";

export const stockAdjFormSchema = z.object({
    adjustment_date:   z.string().min(1, "Date is required"),
    adjustment_reason: z.string().min(1, "Reason is required"),
    ref_no:            z.string().optional(),
    remarks:           z.string().optional(),
});

export type StockAdjFormValues = z.infer<typeof stockAdjFormSchema>;

export function getStockAdjDefaultValues(): StockAdjFormValues {
    return {
        adjustment_date:   new Date().toISOString().slice(0, 10),
        adjustment_reason: "",
        ref_no:            "",
        remarks:           "",
    };
}
