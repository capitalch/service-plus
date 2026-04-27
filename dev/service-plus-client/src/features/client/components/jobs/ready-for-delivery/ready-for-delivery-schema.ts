import { z } from "zod";

export const readyForDeliverySchema = z.object({
    invoice_date:      z.string().min(1, "Invoice date is required"),
    supply_state_code: z.string().min(1, "Supply state is required"),
});

export type ReadyForDeliveryFormValues = z.infer<typeof readyForDeliverySchema>;

export function getReadyForDeliveryDefaultValues(stateCode = ""): ReadyForDeliveryFormValues {
    return {
        invoice_date:      new Date().toISOString().slice(0, 10),
        supply_state_code: stateCode,
    };
}
