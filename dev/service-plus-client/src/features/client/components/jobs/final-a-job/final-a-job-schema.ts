export type FinalizedJobRow = {
    id:                  number;
    job_no:              string;
    alternate_job_no:    string | null;
    job_date:            string;
    customer_name:       string;
    mobile:              string;
    job_status_name:     string;
    technician_name:     string | null;
    invoice_id:          number | null;
    invoice_no:          string | null;
    invoice_total:       number | null;
    invoice_is_posted:   boolean | null;
    last_transaction_id: number | null;
    amount:              number | null;
    division_id:         number | null;
    file_count:          number;
    batch_no:            number | null;
    device_details:      string | null;
    serial_no:           string | null;
    is_posted:           boolean;
    job_type_code:       string;
    job_type_name:       string;
};

export type FinalJobRow = {
    id:               number;
    job_no:           string;
    alternate_job_no: string | null;
    job_date:         string;
    job_type_name:    string;
    job_type_code:    string;
    customer_name:    string;
    mobile:           string;
    device_details:   string | null;
    serial_no:        string | null;
    batch_no:         number | null;
    amount:           number | null;
    is_closed:        boolean;
    is_final:         boolean;
    technician_name:  string | null;
    division_id:      number | null;
    file_count:       number;
};

export type AdditionalChargeMasterRow = { id: number; name: string; hsn_code: string | null };

export type EditablePartLine = {
    _key:          string;
    id?:           number;
    brand_id:      number | null;
    part_id:       number | null;
    part_code:     string;
    part_name:     string;
    cost_price:    string;
    selling_price: string;
    sale_pr_gst:   string;
    gst_rate:      string;
    qty:      number;
    remarks:       string;
    hsn_code:      string;
};

export type EditableChargeLine = {
    _key:          string;
    id?:           number;
    charge_name:   string;
    ref_no:        string;
    description:   string;
    hsn_code:      string;
    gst_rate:      string;
    qty:           string;
    cost_price:    string;
    selling_price: string;
    sale_pr_gst:   string;
};

export function emptyChargeLine(gstRate = 0, hsn = ""): EditableChargeLine {
    return {
        _key:          crypto.randomUUID(),
        charge_name:   "",
        ref_no:        "",
        description:   "",
        hsn_code:      hsn,
        gst_rate:      String(gstRate),
        qty:           "1",
        cost_price:    "0",
        selling_price: "0",
        sale_pr_gst:   "0",
    };
}
