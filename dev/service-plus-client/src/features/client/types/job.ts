export type JobListRow = {
    id:                number;
    job_no:            string;
    job_date:          string;
    customer_name:     string | null;
    mobile:            string;
    job_type_name:     string;
    job_status_name:   string;
    technician_name:   string | null;
    amount:            number | null;
    is_closed:         boolean;
};

export type JobDetailType = {
    id:                          number;
    job_no:                      string;
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
    delivery_date:                string | null;
    is_closed:                   boolean;
    is_final:                    boolean;
    last_transaction_id:         number | null;
    warranty_card_no:            string | null;
    quantity:                    number;
    // Joined fields
    customer_name:               string | null;
    mobile:                      string;
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
    job_no:                   string;
    product_brand_model_id:   number | null;
    serial_no:                string;
    problem_reported:         string;
    warranty_card_no:         string;
    job_receive_condition_id: number | null;
    remarks:                  string;
    quantity:                 number;
    isDeletable:              boolean;        // false when transaction_count > 1
};

export type JobBatchListRow = {
    batch_no:      number;
    batch_date:    string;
    customer_name: string;
    mobile:        string;
    job_type_name: string;
    job_count:     number;
};

export type JobBatchDetailRow = JobDetailType & {
    transaction_count: number;
    receive_manner_name: string;
};
