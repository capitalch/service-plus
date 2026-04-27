import { z } from "zod";

export const salesInvoiceSchema = z.object({
    invoice_date: z.string().min(1, "Invoice date is required"),
    remarks:      z.string().optional(),
});

export type SalesInvoiceFormValues = z.infer<typeof salesInvoiceSchema>;

export function getSalesInvoiceDefaultValues(): SalesInvoiceFormValues {
    return {
        invoice_date: new Date().toISOString().slice(0, 10),
        remarks:      "",
    };
}
