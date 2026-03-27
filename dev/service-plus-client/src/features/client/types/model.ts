export type ModelType = {
    id:           number;
    product_id:   number;
    product_name: string | null;
    brand_id:     number;
    brand_name:   string | null;
    model_name:   string;
    launch_year:  number | null;
    remarks:      string | null;
    is_active:    boolean;
};

export type ProductOption = { id: number; name: string; };
export type BrandOption   = { id: number; code: string; name: string; };
