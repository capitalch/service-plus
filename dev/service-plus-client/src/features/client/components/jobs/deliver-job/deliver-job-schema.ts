import { z } from "zod";

// ── Delivery form (existing) ──────────────────────────────────────────────────

export const deliverJobSchema = z.object({
    delivery_date:     z.string().min(1, "Delivery date is required"),
    delivery_manner:   z.string().min(1, "Delivery manner is required"),
    remarks:           z.string().optional(),
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
        remarks:           "",
        payment_date:      new Date().toISOString().slice(0, 10),
        payment_mode:      "Cash",
        payment_amount:    paymentAmount,
        payment_reference: "",
        payment_remarks:   "",
    };
}

// ── Invoice line (matches GET_JOB_INVOICE_BY_JOB JSON output keys) ───────────

export type JobInvoiceLineRow = {
    id:          number;
    description: string;
    part_code:   string | null;
    hsn_code:    string | null;
    qty:         number;
    price:       number;      // unit price
    aggregate:   number;      // taxable amount for this line
    gst_rate:    number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    amount:      number;      // line total (taxable + tax)
};

// ── Invoice header + lines ────────────────────────────────────────────────────

export type JobInvoiceFullRow = {
    id:                number;
    job_id:            number;
    invoice_no:        string;
    invoice_date:      string;
    supply_state_code: string;
    aggregate:         number;  // total taxable
    cgst_amount:       number;
    sgst_amount:       number;
    igst_amount:       number;
    amount:            number;  // grand total
    lines:             JobInvoiceLineRow[];
};

// ── Add-receipt modal form ────────────────────────────────────────────────────

export const addReceiptSchema = z.object({
    payment_date: z.string().min(1, "Date is required"),
    payment_mode: z.string().min(1, "Mode is required"),
    amount:       z.coerce.number().min(0.01, "Amount must be > 0"),
    reference_no: z.string().optional(),
    remarks:      z.string().optional(),
});

export type AddReceiptFormValues = z.infer<typeof addReceiptSchema>;

export function getAddReceiptDefaults(suggestedAmount = 0): AddReceiptFormValues {
    return {
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: "Cash",
        amount:       suggestedAmount,
        reference_no: "",
        remarks:      "",
    };
}
