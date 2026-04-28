import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

export const loanLineSchema = z.object({
    _key:      z.string(),
    part_id:   z.number().nullable(),
    brand_id:  z.number().nullable(),
    part_code: z.string().default(""),
    part_name: z.string().default(""),
    loan_to:   z.string().default(""),
    dr_cr:     z.enum(["D", "C"]).default("D"),
    qty:       z.number().min(0).default(0),
    remarks:   z.string().default(""),
});

export const loanEntryFormSchema = z.object({
    loan_date: z.string().min(1, MESSAGES.ERROR_LOAN_DATE_REQUIRED),
    ref_no:    z.string().optional().default(""),
    remarks:   z.string().optional().default(""),
    lines:     z.array(loanLineSchema).min(1, "At least one item required"),
});

export type LoanEntryFormValues = z.infer<typeof loanEntryFormSchema>;

export function getLoanEntryDefaultValues(): LoanEntryFormValues {
    return {
        loan_date: new Date().toISOString().slice(0, 10),
        ref_no:    "",
        remarks:   "",
        lines:     [getInitialLoanLine()],
    };
}

export function getInitialLoanLine(brandId?: number | null): LoanEntryFormValues["lines"][number] {
    return {
        _key:      crypto.randomUUID(),
        part_id:   null,
        brand_id:  brandId ?? null,
        part_code: "",
        part_name: "",
        loan_to:   "",
        dr_cr:     "D",
        qty:       0,
        remarks:   "",
    };
}
