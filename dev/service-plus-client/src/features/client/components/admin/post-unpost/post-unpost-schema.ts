export type PostUnpostStats = {
    posted:   number;
    unposted: number;
    total:    number;
};

export type MoneyReceiptPostUnpostRow = {
    id:            number;
    job_id:        number;
    job_no:        string;
    customer_name: string | null;
    mobile:        string | null;
    receipt_no:    string | null;
    payment_date:  string;
    payment_mode:  string;
    amount:        number;
    reference_no:  string | null;
    division_name: string;
    gst_type:      'GST' | 'NON-GST';
    is_posted:     boolean;
};

export type PurchaseInvoicePostUnpostRow = {
    id:            number;
    branch_id:     number;
    invoice_no:    string;
    invoice_date:  string;
    supplier_name: string;
    supplier_gstin: string | null;
    total_amount:  number;
    division_name: string;
    gst_type:      'GST' | 'NON-GST';
    is_posted:     boolean;
};

export type SalesInvoicePostUnpostRow = {
    id:            number;
    division_id:   number;
    invoice_no:    string;
    invoice_date:  string;
    customer_name: string;
    customer_gstin: string | null;
    total_amount:  number;
    is_return:     boolean;
    division_name: string;
    gst_type:      'GST' | 'NON-GST';
    is_posted:     boolean;
};

export type JobInvoicePostUnpostRow = {
    id:            number;
    job_id:        number;
    job_no:        string;
    job_date:      string;
    customer_name: string | null;
    customer_gstin: string | null;
    mobile:        string | null;
    invoice_no:    string;
    invoice_date:  string;
    amount:        number;
    division_name: string;
    gst_type:      'GST' | 'NON-GST';
    is_posted:     boolean;
};
