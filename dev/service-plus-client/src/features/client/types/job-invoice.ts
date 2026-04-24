export type JobInvoiceType = {
    id:                number;
    job_id:            number;
    company_id:        number;
    invoice_no:        string;
    invoice_date:      string;
    supply_state_code: string;
    taxable_amount:    number;
    cgst_amount:       number;
    sgst_amount:       number;
    igst_amount:       number;
    total_tax:         number;
    total_amount:      number;
    lines:             JobInvoiceLineType[];
};

export type JobInvoiceLineType = {
    id:               number;
    job_invoice_id:   number;
    description:      string;
    part_code:        string | null;
    hsn_code:         string;
    quantity:         number;
    unit_price:       number;
    taxable_amount:   number;
    cgst_rate:        number;
    sgst_rate:        number;
    igst_rate:        number;
    cgst_amount:      number;
    sgst_amount:      number;
    igst_amount:      number;
    total_amount:     number;
};

export type JobInvoiceFormLine = {
    _key:        string;
    description: string;
    part_code:   string;
    hsn_code:    string;
    quantity:    string;
    unit_price:  string;
    gst_rate:    string;
};
