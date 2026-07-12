export type JobLookupForReceiptType = {
    address_line1:    string | null;
    amount:           number;
    customer_name:    string;
    id:               number;
    is_closed:        boolean;
    is_final:         boolean;
    job_date:         string;
    job_no:           number;
    job_status_code:  string;
    job_status_name:  string;
    job_type_code:    string;
    alternate_job_no?: string | null;
    mobile:           string;
    total_paid:       number;
}

export type JobReceiptDetailType = {
    amount:       number;
    id:           number | null;
    job_id:       number | null;
    payment_date: string;
    payment_mode: string;
    reference_no: string;
    remarks:      string;
}

export type JobReceiptListRowType = {
    amount:           number;
    created_at:       string;
    customer_name:    string;
    id:               number;
    is_closed:        boolean;
    is_final:         boolean;
    is_posted:        boolean;
    job_date:         string;
    job_id:           number;
    job_no:           number;
    job_status_code:  string;
    job_status_name:  string;
    mobile:           string;
    payment_date:     string;
    payment_mode:     string;
    receipt_no:       string | null;
    reference_no:     string | null;
    remarks:          string | null;
    updated_at:       string;
}
