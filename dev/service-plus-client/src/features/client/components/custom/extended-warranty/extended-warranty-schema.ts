/**
 * Extended Warranty form schemas (react-hook-form + zod). Server rules are mirrored here so
 * a form is invalid — and Save disabled — before a request is ever made; the server still
 * re-checks everything.
 */
import { z } from "zod";

import { MESSAGES } from "@/constants/messages";
import { isValidMobile } from "@/lib/mobile";

import { EW_NOTES_MAX, isCompleteMobile } from "./ew-state-machine";

const EMAIL = z.union([z.literal(""), z.email(MESSAGES.ERROR_EMAIL_INVALID_FORMAT)]);

/** Local date + 'HH:MM' → a Date, or null when either part is unreadable. */
export function combineDateTime(date: string, time: string): Date | null {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const t = /^(\d{2}):(\d{2})$/.exec(time);
	if (!d || !t) return null;
	return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
}

function localDate(iso: string): Date | null {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	return d ? new Date(+d[1], +d[2] - 1, +d[3]) : null;
}

function startOfToday(): Date {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
}

/**
 * New / Edit Lead. On create the warranty end date cannot be in the past — such a lead could
 * never enter a reminder window. Purchase must not be after the warranty end.
 */
export function buildEwLeadSchema(isEdit: boolean) {
	return z
		.object({
			address: z.string(),
			brand_id: z.number().int().positive(MESSAGES.ERROR_EW_BRAND_REQUIRED),
			city: z.string(),
			email: EMAIL,
			full_name: z.string().trim().min(2, MESSAGES.ERROR_EW_NAME_REQUIRED),
			mobile: z.string().refine((v) => isCompleteMobile(v), MESSAGES.ERROR_MOBILE_INVALID),
			model_name: z.string(),
			product_id: z.number().int().nonnegative(),
			purchase_date: z.string(),
			remarks: z.string(),
			serial_no: z.string(),
			warranty_end_date: z.string().min(1, MESSAGES.ERROR_EW_WARRANTY_END_REQUIRED),
		})
		.superRefine((v, ctx) => {
			const end = localDate(v.warranty_end_date);
			if (!end) return;
			if (!isEdit && end < startOfToday()) {
				ctx.addIssue({
					code: "custom",
					message: MESSAGES.ERROR_EW_WARRANTY_END_PAST,
					path: ["warranty_end_date"],
				});
			}
			const start = localDate(v.purchase_date);
			if (start && start > end) {
				ctx.addIssue({
					code: "custom",
					message: MESSAGES.ERROR_EW_PURCHASE_AFTER_END,
					path: ["purchase_date"],
				});
			}
		});
}

export type EwLeadFormType = z.infer<ReturnType<typeof buildEwLeadSchema>>;

/** Follow-up. A next date needs a time, and together they must be in the future. */
export const ewFollowUpSchema = z
	.object({
		action: z.enum(["CALL", "OTHER", "SMS", "VISIT", "WHATSAPP"]),
		next_date: z.string(),
		next_time: z.string(),
		notes: z
			.string()
			.trim()
			.min(1, MESSAGES.ERROR_EW_NOTES_REQUIRED)
			.max(EW_NOTES_MAX, MESSAGES.ERROR_EW_NOTES_TOO_LONG),
		progress_stage: z.number().int().min(1).max(3),
	})
	.superRefine((v, ctx) => {
		if (!v.next_date) return;
		if (!/^\d{2}:\d{2}$/.test(v.next_time)) {
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_EW_NEXT_FOLLOW_UP_TIME, path: ["next_time"] });
			return;
		}
		const at = combineDateTime(v.next_date, v.next_time);
		if (!at || at.getTime() <= Date.now()) {
			ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_EW_NEXT_FOLLOW_UP_PAST, path: ["next_date"] });
		}
	});

export type EwFollowUpFormType = z.infer<typeof ewFollowUpSchema>;

/**
 * App Settings → extended_warranty. Contact phone and WhatsApp number are printed in the
 * customer's message, so they are required while the module is enabled.
 */
export const ewSettingsSchema = z
	.object({
		contact_phone: z.string(),
		daily_send_cap: z.string().regex(/^\d+$/, MESSAGES.ERROR_EW_DAILY_CAP_INVALID),
		enabled: z.boolean(),
		notify_email: EMAIL,
		staff_whatsapp_number: z.string().refine((v) => v === "" || isValidMobile(v), MESSAGES.ERROR_MOBILE_INVALID),
		whatsapp_number: z.string(),
	})
	.superRefine((v, ctx) => {
		for (const key of ["contact_phone", "whatsapp_number"] as const) {
			const value = v[key].trim();
			if (value === "") {
				if (v.enabled)
					ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_EW_CONTACT_NUMBER_REQUIRED, path: [key] });
			} else if (!isValidMobile(value)) {
				ctx.addIssue({ code: "custom", message: MESSAGES.ERROR_MOBILE_INVALID, path: [key] });
			}
		}
	});

export type EwSettingsFormType = z.infer<typeof ewSettingsSchema>;

/** Transition confirm — optional notes, and whether to chain into the first follow-up. */
export const ewTransitionSchema = z.object({
	first_follow_up: z.boolean(),
	notes: z.string().max(EW_NOTES_MAX, MESSAGES.ERROR_EW_NOTES_TOO_LONG),
});

export type EwTransitionFormType = z.infer<typeof ewTransitionSchema>;
