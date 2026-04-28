import { z } from "zod";

export const salesLineSchema = z.object({
    _key:             z.string(),
    part_id:          z.number().nullable(),
    brand_id:         z.number().nullable(),
    part_code:        z.string().default(""),
    part_name:        z.string().default(""),
    uom:              z.string().default(""),
    hsn_code:         z.string().default(""),
    quantity:         z.number().min(0).default(1),
    unit_price:       z.number().min(0).default(0),
    gst_rate:         z.number().min(0).default(0),
    aggregate_amount: z.number().min(0).default(0),
    cgst_amount:      z.number().min(0).default(0),
    sgst_amount:     z.number().min(0).default(0),
    igst_amount:     z.number().min(0).default(0),
    total_amount:     z.number().min(0).default(0),
    remarks:         z.string().default(""),
});

export const salesInvoiceSchema = z.object({
    invoice_date: z.string().min(1, "Invoice date is required"),
    remarks:      z.string().optional(),
    lines:        z.array(salesLineSchema).min(1, "At least one line item required"),
    originalLineIds: z.array(z.number()),
});

export type SalesLineFormItem = z.infer<typeof salesLineSchema>;
export type SalesInvoiceFormValues = z.infer<typeof salesInvoiceSchema>;

export function getSalesInvoiceDefaultValues(): SalesInvoiceFormValues {
    return {
        invoice_date: new Date().toISOString().slice(0, 10),
        remarks:      "",
        lines:       [getInitialSalesLine()],
        originalLineIds: [],
    };
}

export function getInitialSalesLine(brandId: number | null = null): z.infer<typeof salesLineSchema> {
    return {
        _key:             crypto.randomUUID(),
        part_id:          null,
        brand_id:         brandId,
        part_code:        "",
        part_name:        "",
        uom:              "",
        hsn_code:         "",
        quantity:         1,
        unit_price:       0,
        gst_rate:         0,
        aggregate_amount: 0,
        cgst_amount:      0,
        sgst_amount:     0,
        igst_amount:     0,
        total_amount:     0,
        remarks:          "",
    };
}
