export type PurchaseInvoicePostingRow = {
    id:               number;
    branch_id:        number;
    invoice_no:       string;
    invoice_date:     string;
    supplier_name:    string;
    aggregate_amount: number;
    cgst_amount:      number;
    sgst_amount:      number;
    igst_amount:      number;
    total_amount:     number;
    is_posted:        boolean;
};

export type SalesInvoicePostingRow = {
    id:            number;
    division_id:   number;
    division_name: string;
    invoice_no:    string;
    invoice_date:  string;
    customer_name: string;
    total_amount:  number;
    is_return:     boolean;
    is_posted:     boolean;
};

export type JobInvoicePostingRow = {
    id:           number;
    job_id:       number;
    job_no:       string;
    job_date:     string;
    customer_name: string;
    mobile:       string | null;
    invoice_no:   string;
    invoice_date: string;
    aggregate:    number;
    cgst_amount:  number;
    sgst_amount:  number;
    igst_amount:  number;
    amount:       number;
    is_posted:    boolean;
};

export type JobPaymentPostingRow = {
    id:           number;
    job_id:       number;
    job_no:       string;
    customer_name: string | null;
    mobile:       string | null;
    receipt_no:   string | null;
    payment_date: string;
    payment_mode: string;
    amount:       number;
    reference_no: string | null;
    is_posted:    boolean;
};
