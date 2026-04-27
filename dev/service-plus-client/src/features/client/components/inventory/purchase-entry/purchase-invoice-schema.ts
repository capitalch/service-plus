import { z } from "zod";

export const purchaseInvoiceSchema = z.object({
    vendor_id:    z.number().int().min(1, "Supplier is required"),
    invoice_no:   z.string().min(1, "Invoice number is required"),
    invoice_date: z.string().min(1, "Invoice date is required"),
    remarks:      z.string().optional(),
});

export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

export function getPurchaseInvoiceDefaultValues(): PurchaseInvoiceFormValues {
    return {
        vendor_id:    0,
        invoice_no:   "",
        invoice_date: new Date().toISOString().slice(0, 10),
        remarks:      "",
    };
}
