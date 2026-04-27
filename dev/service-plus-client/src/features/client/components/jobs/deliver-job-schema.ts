import { z } from "zod";

export const deliverJobSchema = z.object({
    delivery_date:     z.string().min(1, "Delivery date is required"),
    delivery_manner:   z.string().min(1, "Delivery manner is required"),
    transaction_notes: z.string().optional(),
    payment_date:      z.string().min(1, "Payment date is required"),
    payment_mode:      z.string().min(1, "Payment mode is required"),
    payment_amount:    z.coerce.number().min(0),
    payment_reference: z.string().optional(),
    payment_remarks:   z.string().optional(),
});

export type DeliverJobFormValues = z.infer<typeof deliverJobSchema>;

export function getDeliverJobDefaultValues(paymentAmount = 0): DeliverJobFormValues {
    return {
        delivery_date:     new Date().toISOString().slice(0, 10),
        delivery_manner:   "",
        transaction_notes: "",
        payment_date:      new Date().toISOString().slice(0, 10),
        payment_mode:      "Cash",
        payment_amount:    paymentAmount,
        payment_reference: "",
        payment_remarks:   "",
    };
}
