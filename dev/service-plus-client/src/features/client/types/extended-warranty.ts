/**
 * Extended Warranty types. Column shapes are derived from `types/db-schema-service.ts`
 * where a column maps 1:1; the jsonb-backed shapes below have no generated counterpart
 * because they come out of `ew_stage_v`, which flattens `ew_customer.stages`.
 */

/** Meta's delivery ladder for one message. FAILED is terminal. */
export type EwDeliveryStatusType = "ACCEPTED" | "DELIVERED" | "FAILED" | "PENDING" | "READ" | "SENT";

/**
 * The business ladder, per customer per stage. START is never stored — it is the
 * absence of the stage key, i.e. "due but nothing sent yet".
 */
export type EwStageStatusType =
	"CONVERTED" | "FOLLOWED_UP" | "INTERESTED" | "MESSAGE_SENT" | "NOT_INTERESTED" | "START" | "UNREACHABLE";

/** Customer-level outcome. Anything not terminal keeps the lead in the working list. */
export type EwOutcomeType = "CONVERTED" | "NOT_INTERESTED" | "OPEN" | "UNREACHABLE";

export type EwFollowUpActionType = "CALL" | "OTHER" | "SMS" | "VISIT" | "WHATSAPP";

export type EwCustomerType = {
	address: string | null;
	brand_id: number;
	brand_name: string | null;
	city: string | null;
	days_left: number;
	email: string | null;
	follow_up_count: number;
	full_name: string;
	id: number;
	interest_count: number;
	is_active: boolean;
	is_opted_out: boolean;
	last_sent_at: string | null;
	last_stage_sent: number | null;
	mobile: string;
	model_name: string | null;
	outcome: EwOutcomeType;
	outcome_at: string | null;
	product_id: number | null;
	product_name: string | null;
	purchase_date: string | null;
	remarks: string | null;
	serial_no: string | null;
	warranty_end_date: string;
};

export type EwDueRowType = {
	address: string | null;
	brand_id: number;
	brand_name: string | null;
	city: string | null;
	days_left: number;
	delivery_status: EwDeliveryStatusType | "NONE";
	ew_customer_id: number;
	full_name: string;
	mobile: string;
	model_name: string | null;
	product_id: number | null;
	product_name: string | null;
	purchase_date: string | null;
	serial_no: string | null;
	stage: number;
	warranty_end_date: string;
};

export type EwInterestRowType = {
	alert_error: string | null;
	alert_status: EwDeliveryStatusType | null;
	customer_remarks: string | null;
	ew_customer_id: number;
	follow_up_count: number;
	full_name: string;
	interest_at: string;
	mobile: string;
	outcome: EwOutcomeType;
	preferred_contact: string | null;
	stage: number;
	stage_status: EwStageStatusType;
	total_count: number;
	warranty_end_date: string;
};

export type EwReminderLogRowType = {
	delivery_status: EwDeliveryStatusType;
	error: string | null;
	ew_customer_id: number;
	full_name: string;
	mobile: string;
	sent_at: string;
	sent_by: number | null;
	sent_by_name: string | null;
	stage: number;
	stage_status: EwStageStatusType;
	total_count: number;
	wamid: string | null;
};

export type EwFollowUpType = {
	action: EwFollowUpActionType;
	at: string;
	by: number | null;
	by_name: string | null;
	outcome: EwOutcomeType | "IN_PROGRESS";
	remarks: string | null;
	stage: number | null;
};

/** One row per attempted send, as `sendEwReminders` reports it back. */
export type EwSendResultType = {
	customer_name: string | null;
	error: string | null;
	ew_customer_id: number;
	stage: number;
	status: "CAPPED" | "FAILED" | "SENT" | "SKIPPED";
};

export type EwSettingsType = {
	auto_send_enabled: boolean;
	contact_phone: string;
	daily_send_cap: number;
	notify_email: string;
	reminder_days_before: number[];
	staff_whatsapp_number: string;
	whatsapp_number: string;
};

export type EwDashboardKpisType = {
	converted: number;
	delivered: number;
	due_in_window: number;
	failed: number;
	followed_up: number;
	interested: number;
	messages_sent: number;
	not_contacted: number;
	not_interested: number;
	opted_out: number;
	unreachable: number;
};

export type EwFunnelRowType = { cnt: number; stage: number; stage_status: EwStageStatusType };

export type EwDrilldownRowType = {
	brand_name: string;
	delivery_status: EwDeliveryStatusType | null;
	ew_customer_id: number;
	full_name: string;
	interest_at: string | null;
	mobile: string;
	outcome: EwOutcomeType;
	preferred_contact: string | null;
	sent_at: string | null;
	stage: number;
	stage_status: EwStageStatusType;
	warranty_end_date: string;
};
