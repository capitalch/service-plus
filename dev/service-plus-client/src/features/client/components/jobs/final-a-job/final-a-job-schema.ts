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
    cost_price:    string;
    selling_price: string;
};

export function emptyChargeLine(): EditableChargeLine {
    return {
        _key:          crypto.randomUUID(),
        charge_name:   "",
        ref_no:        "",
        description:   "",
        cost_price:    "0",
        selling_price: "0",
    };
}
