import { z } from "zod";

export const finalForDeliverySchema = z.object({
    invoice_date:      z.string().min(1, "Invoice date is required"),
    supply_state_code: z.string().min(1, "Supply state is required"),
});

export type FinalForDeliveryFormValues = z.infer<typeof finalForDeliverySchema>;

export function getFinalForDeliveryDefaultValues(stateCode = ""): FinalForDeliveryFormValues {
    return {
        invoice_date:      new Date().toISOString().slice(0, 10),
        supply_state_code: stateCode,
    };
}
