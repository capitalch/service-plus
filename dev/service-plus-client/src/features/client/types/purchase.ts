export type StockTransactionTypeRow = {
    id:    number;
    code:  string;
    name:  string;
    dr_cr: string;
};

export type PurchaseLineType = {
    id:                  number;
    purchase_invoice_id: number;
    part_id:             number;
    part_code:           string;
    part_name:           string;
    hsn_code:            string;
    quantity:            number;
    unit_price:          number;
    aggregate_amount:    number;
    gst_rate:            number;
    cgst_amount:         number;
    sgst_amount:         number;
    igst_amount:         number;
    total_amount:        number;
    under_warranty:      boolean;
    remarks:             string | null;
};

export type PurchaseInvoiceType = {
    id:                  number;
    branch_id:           number;
    supplier_id:         number;
    supplier_name:       string;
    invoice_no:       string;
    invoice_date:     string;
    aggregate_amount: number;
    cgst_amount:         number;
    sgst_amount:         number;
    igst_amount:         number;
    total_tax:           number;
    total_amount:        number;
    remarks:             string | null;
    is_return:           boolean;
    lines?:              PurchaseLineType[];
};

export type PurchaseLineFormItem = {
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
    cgst_rate:        number;
    sgst_rate:        number;
    igst_rate:        number;
    under_warranty:   boolean;
    remarks:          string;
    _orig_hsn_code:   string | null;
    _orig_cost_price: number | null;
    _orig_gst_rate:   number | null;
};
