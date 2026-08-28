export type CustomerType = {
    id:                 number;
    customer_type_id:   number;
    customer_type_name: string | null;
    full_name:          string | null;
    gstin:              string | null;
    mobile:             string;
    alternate_mobile:   string | null;
    email:              string | null;
    address_line1:      string;
    address_line2:      string | null;
    landmark:           string | null;
    state_id:           number;
    state_name:         string | null;
    city:               string | null;
    postal_code:        string | null;
    remarks:            string | null;
    is_active:          boolean;
};

export type CustomerTypeOption = {
    id:   number;
    code: string;
    name: string;
};

export type StateOption = {
    id:   number;
    code: string;
    name: string;
};
