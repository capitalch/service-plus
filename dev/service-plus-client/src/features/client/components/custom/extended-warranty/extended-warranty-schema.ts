import { z } from "zod";

import { MESSAGES } from "@/constants/messages";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/mobile";

/**
 * Manual entry is the ONLY way records enter the system, so this schema carries the
 * whole validation burden — there is no import wizard's validation step behind it.
 */
export const ewCustomerSchema = z
	.object({
		address: z.string().optional(),
		brand_id: z.coerce.number().positive("Brand is required"),
		city: z.string().optional(),
		email: z.string().email("Invalid email").or(z.literal("")).optional(),
		full_name: z.string().min(2, "Name must be at least 2 characters"),
		mobile: z
			.string()
			.transform((v) => normalizeMobile(v))
			.refine((v) => v !== "" && MOBILE_REGEX.test(v), { message: MESSAGES.ERROR_MOBILE_INVALID }),
		model_name: z.string().optional(),
		product_id: z.coerce.number().optional(),
		purchase_date: z.string().optional(),
		remarks: z.string().optional(),
		serial_no: z.string().optional(),
		warranty_end_date: z.string().min(1, "Warranty end date is required"),
	})
	// A warranty that has already lapsed can never enter a reminder window, so the
	// record would sit in the list forever doing nothing. Catch it at entry.
	.refine(
		(v) => {
			const end = new Date(v.warranty_end_date);
			if (Number.isNaN(end.getTime())) return false;
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			return end >= today;
		},
		{ message: "Warranty end date must be today or later", path: ["warranty_end_date"] },
	)
	// Purchase before expiry, when both are given — a transposed pair is the commonest
	// copy-paste slip from the dealer's system.
	.refine(
		(v) => {
			if (!v.purchase_date) return true;
			const start = new Date(v.purchase_date);
			const end = new Date(v.warranty_end_date);
			if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
			return start <= end;
		},
		{ message: "Purchase date must be before the warranty end date", path: ["purchase_date"] },
	);

export type EwCustomerFormType = z.infer<typeof ewCustomerSchema>;
