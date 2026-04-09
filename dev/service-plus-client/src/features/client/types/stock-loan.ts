import type { SparePartMaster } from "@/types/db-schema-service";

export type StockLoanType = {
    id: number;
    loan_date: string;
    branch_id: number;
    loan_to: string;
    ref_no?: string | null;
    remarks?: string | null;
    created_by?: number | null;
    created_at: string;
    updated_at: string;
    lines?: StockLoanLineType[];
};

export type StockLoanLineType = {
    id: number;
    stock_loan_id: number;
    part_id: number;
    dr_cr: "D" | "C";
    qty: number;
    remarks?: string | null;
    created_at: string;
    updated_at: string;
    part_code?: string;
    part_name?: string;
};

export type LoanLineFormItem = {
    part_id: number;
    qty: number;
    dr_cr: "D" | "C";
    remarks?: string;
    part?: SparePartMaster; // For display
};
