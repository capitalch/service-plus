export type StockLoanType = {
    branch_id: number;
    created_at: string;
    created_by?: number | null;
    id: number;
    loan_date: string;
    ref_no?: string | null;
    remarks?: string | null;
    updated_at: string;
};

type StockLoanLineType = {
    created_at: string;
    dr_cr: "D" | "C";
    id: number;
    loan_to: string;
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
