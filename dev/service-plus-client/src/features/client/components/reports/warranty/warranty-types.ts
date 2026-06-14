export type WarrantyDetailLineType = {
    brand_name: string | null;
    cost_price: number;
    created_at: string;
    line_id: number;
    line_value: number;
    part_code: string;
    part_name: string;
    qty: number;
    remarks: string | null;
};

export type WarrantyJobRowType = {
    brand_name: string | null;
    customer_name: string;
    delivery_date: string | null;
    id: number;
    job_date: string;
    job_no: string;
    model_name: string | null;
    parts_qty: number;
    parts_value: number;
    product_name: string | null;
    status_code: string;
    status_name: string;
    technician_name: string | null;
    warranty_card_no: string;
};

export type WarrantyPartLineType = {
    brand_name: string | null;
    consumed_date: string;
    cost_price: number;
    job_id: number;
    job_no: string;
    line_id: number;
    line_value: number;
    part_code: string;
    part_name: string;
    qty: number;
    technician_name: string | null;
    warranty_card_no: string;
};

export type WarrantyPartRollupType = {
    brand_name: string | null;
    jobs_count: number;
    part_code: string;
    part_id: number;
    part_name: string;
    total_qty: number;
    total_value: number;
};

export type WarrantySummaryRowType = {
    delivered_count: number;
    distinct_parts_count: number;
    parts_qty: number;
    parts_value: number;
    repaired_count: number;
    warranty_jobs_count: number;
};

export type WarrantyTrendRowType = {
    month: string;
    parts_qty: number;
    parts_value: number;
    warranty_jobs: number;
};
