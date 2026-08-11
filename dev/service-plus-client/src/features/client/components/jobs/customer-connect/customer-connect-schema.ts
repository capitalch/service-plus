export type WhatsappCompletionState = {
    success_count: number;
    fail_count:    number;
    last_sent_at:  string | null;
    last_status:   "SENT" | "FAILED" | null;
    last_error:    string | null;
};

export type CustomerConnectJobRow = {
    id:                     number;
    job_no:                 string;
    alternate_job_no:       string | null;
    job_date:               string;
    amount:                 number | null;
    whatsapp_notifications: Record<string, WhatsappCompletionState> | null;
    customer_contact_id:    number;
    customer_name:          string;
    mobile:                 string;
    job_type_name:          string;
    job_type_code:          string;
    job_status_name:        string;
    job_status_code:        string;
    device_details:         string | null;
};

// One group per customer_contact_id — the "one message per customer" rule
// this screen exists to enforce (plan-whatsapp.md §1/§4d).
export type CustomerGroup = {
    customer_contact_id: number;
    customer_name:        string;
    mobile:                string;
    job_ids:               number[];
    job_nos:                string[];
    amount:                 number;
};
