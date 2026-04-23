export type JobLookupForReceiptType = {
    amount:        number;
    customer_name: string;
    id:            number;
    is_closed:     boolean;
    job_date:      string;
    job_no:        number;
    mobile:        string;
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
    amount:        number;
    created_at:    string;
    customer_name: string;
    id:            number;
    job_id:        number;
    job_no:        number;
    mobile:        string;
    payment_date:  string;
    payment_mode:  string;
    reference_no:  string | null;
    remarks:       string | null;
    updated_at:    string;
}

export type ReceiptFormValuesType = {
    amount:       number | string;
    job_id:       number | null;
    payment_date: string;
    payment_mode: string;
    reference_no: string;
    remarks:      string;
}
