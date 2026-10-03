// Sign-up enquiry rows (plans/plan.md Steps 9, 10). Hand-declared: security.sales_enquiry lives
// only in the default customer database, which the generated types are not built from.

export type EnquiryPaymentStatusType = "failed" | "not_required" | "pending" | "received";

export type EnquiryPlanCodeType = "basic" | "enterprise" | "lite" | "standard";

/** The columns both enquiry tables share. Money is in paise. */
export type EnquiryRowType = {
	branches: number;
	business_name: string;
	city: string;
	created_at: string;
	email: string;
	gstin: string | null;
	id: number;
	message: string | null;
	mobile: string;
	name: string;
	payment_amount_paise: number | null;
	payment_mode: string | null;
	payment_note: string | null;
	payment_received_on: string | null;
	payment_recorded_by: string | null;
	payment_reference: string | null;
	payment_status: EnquiryPaymentStatusType;
	plan_code: EnquiryPlanCodeType;
	processing_started_at: string | null;
	reference: string | null;
	rejection_reason: string | null;
	reviewed_at: string | null;
	reviewed_by: string | null;
	setup_fee_paise: number;
	status: string;
};

/** Lite / Basic / Standard (security.sales_enquiry); status pending | approved | rejected. */
export type LtEnquiryType = EnquiryRowType & {
	bu_code: string;
	bu_id: number | null;
	bu_name: string;
	login_email_sent: boolean;
	user_id: number | null;
	username: string | null;
};

/** Enterprise (public.sales_enquiry); status new | contacted | converted | rejected. */
export type EntEnquiryType = EnquiryRowType & {
	bu_id: number | null;
	client_code: string | null;
	client_id: number | null;
	db_name: string | null;
	user_id: number | null;
};

/** What the record-payment dialog sends; amount in rupees. */
export type EnquiryPaymentInputType = {
	amount: number;
	mode: string;
	note: string;
	received_on: string;
	reference: string;
};

export const PLAN_NAMES: Record<EnquiryPlanCodeType, string> = {
	basic: "Basic",
	enterprise: "Enterprise",
	lite: "Lite",
	standard: "Standard",
};

export const PAYMENT_MODES = [
	{ label: "Bank transfer", value: "bank_transfer" },
	{ label: "Cash", value: "cash" },
	{ label: "Other", value: "other" },
	{ label: "UPI", value: "upi" },
];

export function rupees(paise: number | null | undefined): string {
	return `₹${((paise ?? 0) / 100).toLocaleString("en-IN")}`;
}
