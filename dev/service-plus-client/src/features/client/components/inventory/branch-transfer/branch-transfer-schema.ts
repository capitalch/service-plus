import { z } from "zod";

export const branchTransferFormSchema = z.object({
    transfer_date: z.string().min(1, "Date is required"),
    to_branch_id:  z.string().min(1, "Destination branch is required"),
    ref_no:        z.string().optional(),
    remarks:       z.string().optional(),
});

export type BranchTransferFormValues = z.infer<typeof branchTransferFormSchema>;

export function getBranchTransferDefaultValues(): BranchTransferFormValues {
    return {
        transfer_date: new Date().toISOString().slice(0, 10),
        to_branch_id:  "",
        ref_no:        "",
        remarks:       "",
    };
}
