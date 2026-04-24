export type SalesLineType = {
    id:               number;
    sales_invoice_id: number;
    part_id:          number;
    part_code:        string;
    part_name:        string;
    item_description: string;
    hsn_code:         string;
    quantity:         number;
    unit_price:       number;
    aggregate_amount: number;
    gst_rate:         number;
    cgst_amount:      number;
    sgst_amount:      number;
    igst_amount:      number;
    total_amount:     number;
    remarks:          string | null;
};

export type SalesInvoiceType = {
    id:                   number;
    branch_id:            number;
    customer_contact_id:  number | null;
    customer_name:        string;
    customer_gstin:       string | null;
    customer_state_code:  string;
    invoice_no:           string;
    invoice_date:         string;
    aggregate_amount:     number;
    cgst_amount:          number;
    sgst_amount:          number;
    igst_amount:          number;
    total_tax:            number;
    total_amount:         number;
    remarks:              string | null;
    is_return:            boolean;
    lines?:               SalesLineType[];
};

export type SalesLineFormItem = {
    _key:             string;
    part_id:          number | null;
    brand_id:         number | null;
    part_code:        string;
    part_name:        string;
    uom:              string;
    hsn_code:         string;
    quantity:         number;
    unit_price:       number;
    gst_rate:         number;
    aggregate_amount: number;
    cgst_amount:      number;
    sgst_amount:      number;
    igst_amount:      number;
    total_amount:     number;
    remarks:          string;
};

export type DocumentSequenceRow = {
    id:                 number;
    document_type_id:   number;
    document_type_code: string;
    prefix:             string;
    next_number:        number;
    padding:            number;
    separator:          string;
    branch_id:          number | null;
};

export type CustomerSearchRow = {
    id:         number;
    full_name:  string | null;
    mobile:     string;
    gstin:      string | null;
    state_id:   number | null;
    state_code: string | null;
    state_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    postal_code: string | null;
    customer_type_name: string;
};
