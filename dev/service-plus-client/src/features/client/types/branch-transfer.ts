export type StockBranchTransferType = {
    id: number;
    transfer_date: string;
    from_branch_id: number;
    to_branch_id: number;
    ref_no: string | null;
    remarks: string | null;
    created_by: number | null;
    created_at: string;
    updated_at: string;
    from_branch_name?: string;
    to_branch_name?: string;
    lines?: StockBranchTransferLineType[];
};

export type StockBranchTransferLineType = {
    id: number;
    stock_branch_transfer_id: number;
    part_id: number;
    part_code: string;
    part_name: string;
    qty: number;
    remarks: string | null;
};

export type BranchTransferLineFormItem = {
    _key: string;
    part_id: number | null;
    brand_id: number | null;
    part_code: string;
    part_name: string;
    qty: number;
    remarks: string;
};

export const emptyTransferLine = (brandId: number | null = null): BranchTransferLineFormItem => ({
    _key: crypto.randomUUID(),
    part_id: null,
    brand_id: brandId,
    part_code: "",
    part_name: "",
    qty: 0,
    remarks: "",
});
