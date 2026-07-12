type OpeningStockLineType = {
    id:                       number;
    part_code:                string;
    part_id:                  number;
    part_name:                string;
    qty:                      number;
    remarks:                  string | null;
    stock_opening_balance_id: number;
    unit_cost:                number | null;
};

export type OpeningStockType = {
    branch_id:  number;
    created_at: string;
    entry_date: string;
    id:         number;
    lines:      OpeningStockLineType[];
    ref_no:     string | null;
    remarks:    string | null;
    updated_at: string;
};

export type OpeningStockListItem = {
    id:         number;
    entry_date: string;
    ref_no:     string | null;
    remarks:    string | null;
    branch_id:  number;
    line_count: number;
    total_qty:  number;
    total_value: number;
};
