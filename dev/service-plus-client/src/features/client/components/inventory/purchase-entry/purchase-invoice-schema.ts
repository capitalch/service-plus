import { z } from "zod";

const purchaseLineSchema = z.object({
    _key:             z.string(),
    part_id:          z.number().nullable(),
    brand_id:         z.number().nullable(),
    part_code:        z.string().default(""),
    part_name:        z.string().default(""),
    uom:              z.string().default(""),
    hsn_code:         z.string().default(""),
    qty:         z.number().min(0).default(1),
    unit_price:       z.number().min(0).default(0),
    gst_rate:         z.number().min(0).default(0),
    cgst_rate:        z.number().min(0).default(0),
    sgst_rate:        z.number().min(0).default(0),
    igst_rate:        z.number().min(0).default(0),
    under_warranty:   z.boolean().default(false),
    remarks:          z.string().default(""),
    _orig_hsn_code:   z.string().nullable(),
    _orig_cost_price: z.number().nullable(),
    _orig_gst_rate:   z.number().nullable(),
});

export const purchaseInvoiceSchema = z.object({
    vendor_id:        z.number().int().min(1, "Supplier is required"),
    division_id:      z.number().int().min(1, "Division is required"),
    invoice_no:       z.string().min(1, "Invoice number is required"),
    invoice_date:     z.string().min(1, "Invoice date is required"),
    remarks:         z.string().optional(),
    lines:           z.array(purchaseLineSchema).min(1, "At least one line item required"),
});

type PurchaseLineFormItem = z.infer<typeof purchaseLineSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;

export function getPurchaseInvoiceDefaultValues(divisionId = 0): PurchaseInvoiceFormValues {
    return {
        vendor_id:        0,
        division_id:      divisionId,
        invoice_no:       "",
        invoice_date:     new Date().toISOString().slice(0, 10),
        remarks:         "",
        lines:           [getInitialPurchaseLine()],
    };
}

function getInitialPurchaseLine(brandId: number | null = null): PurchaseLineFormItem {
    return {
        _key:             crypto.randomUUID(),
        part_id:          null,
        brand_id:         brandId,
        part_code:        "",
        part_name:        "",
        uom:              "",
        hsn_code:         "",
        qty:         1,
        unit_price:       0,
        gst_rate:         0,
        cgst_rate:        0,
        sgst_rate:        0,
        igst_rate:        0,
        under_warranty:   false,
        remarks:          "",
        _orig_hsn_code:   null,
        _orig_cost_price: null,
        _orig_gst_rate:   null,
    };
}
