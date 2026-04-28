import { z } from "zod";

export const transferLineSchema = z.object({
    _key:      z.string(),
    part_id:   z.number().nullable(),
    brand_id:  z.number().nullable(),
    part_code: z.string().default(""),
    part_name: z.string().default(""),
    qty:       z.number().min(0).default(0),
    remarks:   z.string().default(""),
});

export type TransferLineFormValues = z.infer<typeof transferLineSchema>;

export const branchTransferFormSchema = z.object({
    transfer_date: z.string().min(1, "Date is required"),
    to_branch_id:  z.string().min(1, "Destination branch is required"),
    ref_no:        z.string().optional(),
    remarks:       z.string().optional(),
    lines: z.array(transferLineSchema).min(1, "At least one item required"),
});

export type BranchTransferFormValues = z.infer<typeof branchTransferFormSchema>;

export function getBranchTransferDefaultValues(): BranchTransferFormValues {
    return {
        transfer_date: new Date().toISOString().slice(0, 10),
        to_branch_id:  "",
        ref_no:        "",
        remarks:       "",
        lines:         [getInitialTransferLine()],
    };
}

export function getInitialTransferLine(brandId?: number | null): TransferLineFormValues {
    return {
        _key:      crypto.randomUUID(),
        part_id:   null,
        brand_id:  brandId ?? null,
        part_code: "",
        part_name: "",
        qty:       0,
        remarks:   "",
    };
}
