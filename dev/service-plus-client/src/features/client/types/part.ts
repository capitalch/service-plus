export type PartType = {
    id:               number;
    brand_id:         number;
    brand_name:       string | null;
    part_code:        string;
    part_name:        string;
    part_description: string | null;
    category:         string | null;
    model:            string | null;
    uom:              string;
    cost_price:       number | null;
    mrp:              number | null;
    hsn_code:         string | null;
    gst_rate:         number | null;
    is_active:        boolean;
};
