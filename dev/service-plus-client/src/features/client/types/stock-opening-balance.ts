export type OpeningStockLineFormItemType = {
    _key:      string;
    brand_id:  number | null;
    part_code: string;
    part_id:   number | null;
    part_name: string;
    qty:       number;
    remarks:   string;
    unit_cost: number;
};

export type OpeningStockLineType = {
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

export function emptyOpeningStockLine(brandId?: number | null): OpeningStockLineFormItemType {
    return {
        _key:      crypto.randomUUID(),
        brand_id:  brandId ?? null,
        part_code: "",
        part_id:   null,
        part_name: "",
        qty:       0,
        remarks:   "",
        unit_cost: 0,
    };
}
