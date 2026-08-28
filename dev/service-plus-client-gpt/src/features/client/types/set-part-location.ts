export type StockBalanceWithLocationType = {
    category:         string | null;
    location_id:      number | null;
    location_name:    string | null;
    model:            string | null;
    part_code:        string;
    part_description: string | null;
    part_id:          number;
    part_name:        string;
    qty:              number;
    uom:              string | null;
};

export type LocationOptionType = {
    id:       number;
    location: string;
};

export type PartLocationHistoryType = {
    id:               number;
    transaction_date: string;
    location_name:    string;
    ref_no:           string | null;
    remarks:          string | null;
};

export type SetLocationLineType = {
    _key:        string;
    part_code:   string;
    part_id:     number | null;
    part_name:   string;
    location_id: number | null;
    validating:  boolean;
    error:       string | null;
};

export function emptyLine(): SetLocationLineType {
    return {
        _key:        crypto.randomUUID(),
        part_code:   "",
        part_id:     null,
        part_name:   "",
        location_id: null,
        validating:  false,
        error:       null,
    };
}
