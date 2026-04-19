export type PartFinderFiltersType = {
    search: string;
};

export type PartFinderResultType = {
    brand_name:          string | null;
    category:            string | null;
    cost_price:          number | null;
    gst_rate:            number | null;
    hsn_code:            string | null;
    id:                  number;
    location_count:      number;
    model:               string | null;
    mrp:                 number | null;
    part_code:           string;
    part_description:    string | null;
    part_name:           string;
    primary_location:    string | null;
    primary_location_id: number | null;
    qty:                 number;
    total:               number;
    uom:                 string | null;
};

export type PartFinderStockByLocationType = {
    location_id:   number;
    location_name: string;
    qty:           number;
};

export type PartFinderStockSummaryType = {
    adjust_in_since:    number;
    adjust_out_since:   number;
    current_stock:      number;
    last_snapshot_date: string | null;
    net_since_snapshot: number;
    purchase_in_since:  number;
    purchase_out_since: number;
    sales_in_since:     number;
    sales_out_since:    number;
    snapshot_closing:   number;
};

export type StockStatusType = "all" | "in_stock" | "low_stock" | "out_of_stock";

export const DEFAULT_FILTERS: PartFinderFiltersType = {
    search: "",
};

export function getStockStatus(qty: number): StockStatusType {
    if (qty <= 0) return "out_of_stock";
    if (qty <= 5)  return "low_stock";
    return "in_stock";
}

export function stockStatusLabel(status: StockStatusType): string {
    switch (status) {
        case "all":          return "All";
        case "in_stock":     return "In Stock";
        case "low_stock":    return "Low Stock";
        case "out_of_stock": return "Out of Stock";
    }
}
