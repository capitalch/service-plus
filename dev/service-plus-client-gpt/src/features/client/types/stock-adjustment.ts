export interface StockAdjustmentType {
    id: number;
    adjustment_date: string; // Date string formats in React
    adjustment_reason: string;
    ref_no: string | null;
    branch_id: number;
    brand_id: number;
    remarks: string | null;
    created_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface StockAdjustmentLineType {
    id: number;
    stock_adjustment_id: number;
    part_id: number;
    part_code: string;
    part_name: string;
    dr_cr: "D" | "C";
    qty: number;
    remarks: string | null;
}
