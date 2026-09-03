export type WhatsappCompletionState = {
    attempt_count: number;
    success_count: number;
    fail_count:    number;
    last_wamid:    string | null;
    last_sent_at:  string | null;
    last_status:   "ACCEPTED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
    last_error:    string | null;
    // JOB_DELIVERY only (plans/plan.md, Step 3/4) — set by verifyJobDeliveryOtp
    // or setJobDeliveryManualConfirmation, never by the send itself.
    confirmed_at?:          string | null;
    confirmation_method?:   "otp_verified" | "manual_override" | null;
    confirmed_by_staff_id?: number | null;
    // Whether a still-valid, unconfirmed OTP is waiting — feeds the "Verify
    // Code" affordance (getJobDeliveryOtpPending), not stored in this jsonb
    // itself, so callers that populate this type from a live query must
    // compute/attach it separately.
    otp_pending?: boolean;
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

// One row per receipt *send*, not per job (plans/plan.md, Step 5) —
// GET_JOB_MONEY_RECEIPT_WHATSAPP_LOG_PAGED's lateral join over
// JOB_MONEY_RECEIPT's array already picks out the one array element this
// row needs, so `whatsapp_state` is a plain WhatsappCompletionState, not a
// per-event-key record the way CustomerConnectJobRow's is.
export type MoneyReceiptLogRow = {
    payment_id:          number;
    job_id:               number;
    job_no:               string;
    alternate_job_no:     string | null;
    receipt_no:           string | null;
    payment_date:         string;
    payment_mode:         string;
    amount:               number;
    customer_contact_id:  number;
    customer_name:        string;
    mobile:               string;
    whatsapp_state:       WhatsappCompletionState;
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
