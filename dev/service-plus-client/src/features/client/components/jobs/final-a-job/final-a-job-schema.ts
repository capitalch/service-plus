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

export type EditableChargeLine = {
    _key:          string;
    id?:           number;
    charge_name:   string;
    ref_no:        string;
    description:   string;
    hsn_code:      string;
    gst_rate:      string;
    quantity:           string;
    cost_price:    string;
    selling_price: string;
    sale_pr_gst:   string;
};

export function emptyChargeLine(gstRate = 0): EditableChargeLine {
    return {
        _key:          crypto.randomUUID(),
        charge_name:   "",
        ref_no:        "",
        description:   "",
        hsn_code:      "",
        gst_rate:      String(gstRate),
        quantity:           "1",
        cost_price:    "0",
        selling_price: "0",
        sale_pr_gst:   "0",
    };
}
