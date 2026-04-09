export interface StockAdjustmentType {
    id: number;
    adjustment_date: string; // Date string formats in React
    adjustment_reason: string;
    ref_no: string | null;
    branch_id: number;
    remarks: string | null;
    created_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface StockAdjustmentLineFormItem {
    _key: string;               // Local UI key
    part_id: number | null;
    brand_id: number | null;
    part_code: string;
    part_name: string;
    dr_cr: "D" | "C" | "";      // "D" = IN, "C" = OUT
    qty: number;
    remarks?: string;
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

export type StockAdjustmentWithLines = StockAdjustmentType & {
    lines: StockAdjustmentLineType[];
};

export const emptyAdjustmentLine = (brandId?: number | null): StockAdjustmentLineFormItem => ({
    _key: crypto.randomUUID(),
    part_id: null,
    brand_id: brandId ?? null,
    part_code: "",
    part_name: "",
    dr_cr: "D",                 // Default to IN
    qty: 0,
    remarks: ""
});
