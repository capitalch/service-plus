export type JobSearchRow = {
    id:                number;
    job_no:            string;
    alternate_job_no?: string | null;
    job_date:          string;
    customer_name:     string | null;
    file_count:        number;
    mobile:            string;
    job_type_name:     string;
    job_status_id?:    number;
    job_status_code?:  string;
    job_status_name:   string;
    receive_condition_name: string | null;
    technician_name:   string | null;
    amount:            number | null;
    is_closed:         boolean;
    device_details:    string | null;
    batch_no?:         number | null;
    division_id?:      number | null;
};

export type JobDetailType = {
    id:                          number;
    job_no:                      string;
    alternate_job_no:            string | null;
    job_date:                    string;
    customer_contact_id:         number;
    branch_id:                   number;
    technician_id:               number | null;
    job_status_id:               number;
    job_type_id:                 number;
    job_receive_manner_id:       number;
    job_receive_condition_id:    number | null;
    product_brand_model_id:      number | null;
    serial_no:                   string | null;
    problem_reported:            string;
    diagnosis:                   string | null;
    work_done:                   string | null;
    remarks:                     string | null;
    amount:                      number | null;
    estimate_amount:             number | null;
    delivery_date:               string | null;
    is_closed:                   boolean;
    is_final:                    boolean;
    is_igst:                     boolean;
    to_show_parts_in_job_invoice: boolean;
    last_transaction_id:         number | null;
    warranty_card_no:            string | null;
    qty:                         number;
    // Joined fields
    customer_name:               string | null;
    mobile:                      string;
    customer_address_line1:      string | null;
    customer_address_line2:      string | null;
    customer_landmark:           string | null;
    customer_city:               string | null;
    customer_postal_code:        string | null;
    customer_state:              string | null;
    job_type_name:               string;
    job_status_name:             string;
    job_receive_manner_name:     string;
    job_receive_condition_name:  string | null;
    technician_name:             string | null;
    model_name:                  string | null;
    brand_name:                  string | null;
    product_name:                string | null;
    address_snapshot:            string | null;
    branch_code:                 string | null;
    division_id:                 number | null;
    file_count?:                 number;
};

export type JobLookupRow = {
    id:           number;
    code:         string;
    name:         string;
    display_order: number | null;
    is_active:    boolean;
    is_system:    boolean;
    is_initial?:  boolean;
};

export type TechnicianRow = {
    id:          number;
    branch_id:   number;
    code:        string;
    name:        string;
    is_active:   boolean;
    branch_name: string;
};

export type ModelRow = {
    id:           number;
    product_id:   number;
    brand_id:     number;
    model_name:   string;
    is_active:    boolean;
    product_name: string;
    brand_name:   string;
};

export type JobFileRow = {
    id:         number;
    url:        string;
    about:      string;
    created_at: string;
};

export type BatchJobRow = {
    localId:                  string;         // uuid — React key, not sent to server
    id?:                      number;         // present when editing an existing job
    product_brand_model_id:   number | null;
    serial_no:                string;
    problem_reported:         string;
    warranty_card_no:         string;
    job_receive_condition_id: number | null;
    remarks:                  string;
    qty:                 number;
    isDeletable:              boolean;        // false when transaction_count > 1
};

export type BatchJobQuickInfoRow = {
    batch_no:      number;
    batch_date:    string;
    customer_name: string | null;
    division_id:   number | null;
    mobile:        string;
    job_type_name: string;
    job_id:        number;
    job_no:        string;
    device_details: string | null;
    serial_no:     string | null;
    file_count:    number;
};

export type JobBatchListRow = {
    batch_no:      number;
    batch_date:    string;
    customer_name: string;
    mobile:        string;
    job_type_name: string;
    job_count:     number;
};

export type JobInBatchRow = JobSearchRow & {
    batch_no: number;
};

export type JobBatchDetailRow = JobDetailType & {
    transaction_count: number;
    receive_manner_name: string;
};

export type OpenJobRow = {
    id:                  number;
    job_no:              string;
    alternate_job_no:    string | null;
    job_date:            string;
    job_status_id:       number;
    job_status_code:     string;
    job_status_name:     string;
    is_closed:           boolean;
    is_final:            boolean;
    amount:              number | null;
    estimate_amount:     number | null;
    diagnosis:           string | null;
    last_transaction_id: number | null;
    batch_no:            number | null;
    customer_name:       string;
    mobile:              string;
    job_type_name:       string;
    job_type_code:       string;
    technician_name:     string | null;
    technician_id:       number | null;
    device_details:      string | null;
    file_count:          number;
    transaction_count:   number;
    job_receive_manner_name:     string | null;
    job_receive_condition_name:  string | null;
    division_id:                 number | null;
};

export type JobBoardStatusCount = {
    status_id:   number;
    status_name: string;
    status_code: string;
    count:       number;
};

export type JobTransactionRow = {
    id:                      number;
    job_id:                  number;
    status_id:               number | null;
    status_name:             string | null;
    technician_id:           number | null;
    technician_name:         string | null;
    amount:                  number | null;
    remarks:                 string | null;
    performed_by_user_id:    number;
    performed_by_name:       string | null;
    performed_at:            string;
    previous_transaction_id: number | null;
    transaction_date:        string | null;
};
