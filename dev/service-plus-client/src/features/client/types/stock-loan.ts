export type StockLoanType = {
    branch_id: number;
    created_at: string;
    created_by?: number | null;
    id: number;
    loan_date: string;
    loan_to: string;
    ref_no?: string | null;
    remarks?: string | null;
    updated_at: string;
};

export type StockLoanLineType = {
    created_at: string;
    dr_cr: "D" | "C";
    id: number;
    part_code: string;
    part_id: number;
    part_name: string;
    qty: number;
    remarks?: string | null;
    stock_loan_id: number;
    updated_at: string;
};

export type StockLoanWithLines = StockLoanType & {
    lines: StockLoanLineType[];
};

export type LoanLineFormItem = {
    _key: string;
    brand_id: number | null;
    dr_cr: "D" | "C" | "";
    part_code: string;
    part_id: number | null;
    part_name: string;
    qty: number;
    remarks?: string;
};

export const emptyLoanLine = (brandId?: number | null): LoanLineFormItem => ({
    _key: crypto.randomUUID(),
    brand_id: brandId ?? null,
    dr_cr: "D",
    part_code: "",
    part_id: null,
    part_name: "",
    qty: 0,
    remarks: "",
});
