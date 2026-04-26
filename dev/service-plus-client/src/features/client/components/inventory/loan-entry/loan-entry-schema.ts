import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const loanEntryFormSchema = z.object({
    loan_date: z.string().min(1, MESSAGES.ERROR_LOAN_DATE_REQUIRED),
    ref_no:    z.string().optional().default(""),
    remarks:   z.string().optional().default(""),
});

export type LoanEntryFormValues = z.infer<typeof loanEntryFormSchema>;

export function getLoanEntryDefaultValues(): LoanEntryFormValues {
    return {
        loan_date: new Date().toISOString().slice(0, 10),
        ref_no:    "",
        remarks:   "",
    };
}
