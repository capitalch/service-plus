export type SparePartWebType = {
    id:               number;
    branch_id:        number;
    part_id:          number | null;
    part_name:        string;
    part_description: string | null;
    price:            number;
    model:            string | null;
    hsn_code:         string | null;
    is_active:        boolean;
    thumbnail_url:    string | null;
    part_code:        string | null;
    brand_name:       string | null;
};
