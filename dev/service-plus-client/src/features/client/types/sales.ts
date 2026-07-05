export type SalesLineType = {
    id:               number;
    sales_invoice_id: number;
    part_id:          number;
    part_code:        string;
    part_name:        string;
    part_description: string | null;
    item_description: string;
    hsn_code:         string;
    qty:              number;
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
    division_id:          number | null;
    division_name?:       string | null;
    brand_id:             number | null;
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
    is_posted:            boolean;
    lines?:               SalesLineType[];
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
    id:                 number;
    full_name:          string | null;
    mobile:             string;
    alternate_mobile:   string | null;
    email:              string | null;
    gstin:              string | null;
    state_id:           number | null;
    state_code:         string | null;
    state_name:         string | null;
    address_line1:      string | null;
    address_line2:      string | null;
    landmark:           string | null;
    city:               string | null;
    postal_code:        string | null;
    customer_type_name: string;
    remarks:            string | null;
};
