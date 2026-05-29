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

// ── Multi-job delivery types ──────────────────────────────────────────────────

export type JobPartLine = {
    id:            number;
    part_code:     string;
    part_name:     string;
    qty:           number;
    cost_price:    number | null;
    selling_price: number;
    gst_rate:      number;
    hsn_code:      string | null;
    remarks:       string | null;
};

export type JobChargeLine = {
    id:            number;
    charge_name:   string;
    qty:           number;
    selling_price: number;
    gst_rate:      number;
    hsn_code:      string | null;
    description:   string | null;
};

export type JobPayment = {
    id:           number;
    payment_date: string;
    payment_mode: string;
    amount:       number;
    reference_no: string | null;
    remarks:      string | null;
};

export type JobDeliveryFullDetail = {
    id:                     number;
    job_no:                 string;
    alternate_job_no:       string | null;
    job_date:               string;
    division_id:            number | null;
    amount:                 number | null;
    estimate_amount:        number | null;
    qty:                    number | null;
    last_transaction_id:    number | null;
    device_details:         string | null;
    customer_name:          string;
    mobile:                 string;
    job_status_name:        string;
    job_status_code:        string;
    job_type_name:          string;
    job_type_code:          string;
    receive_manner_name:    string;
    receive_condition_name: string;
    technician_name:        string | null;
    is_igst:                boolean | null;
    invoice_id:             number | null;
    invoice_no:             string | null;
    invoice_date:           string | null;
    invoice_total:          number | null;
    payments:               JobPayment[];
    parts:                  JobPartLine[];
    charges:                JobChargeLine[];
};

// ── Delivery modal form ───────────────────────────────────────────────────────

export const deliveryModalSchema = z.object({
    delivery_date:   z.string().min(1, "Delivery date is required"),
    delivery_manner: z.string().min(1, "Delivery manner is required"),
    remarks:         z.string().optional(),
});

export type DeliveryModalFormValues = z.infer<typeof deliveryModalSchema>;

export function getDeliveryModalDefaults(): DeliveryModalFormValues {
    return {
        delivery_date:   new Date().toISOString().slice(0, 10),
        delivery_manner: "",
        remarks:         "",
    };
}
