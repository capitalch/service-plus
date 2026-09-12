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

/**
 * One reminder actually sent, for one stage. A customer has one entry per stage they have
 * been messaged at — there is no attempts array in this feature, so a stage is a send.
 */
export type EwLeadSendType = {
	delivery_status: EwDeliveryStatusType | null;
	error: string | null;
	sent_at: string | null;
	stage: number;
	stage_status: EwStageStatusType | null;
};

/**
 * One row of the Leads screen — CUSTOMER-level, not customer x stage. `stage` and the
 * fields beside it describe the "current" stage the server picked (the interest-bearing
 * one if any, else the most recently sent); they are all null for a lead that has never
 * been messaged. `due_stage` is the bucket a reminder is owed for right now, or null.
 */
export type EwLeadRowType = {
	address: string | null;
	alert_error: string | null;
	alert_status: string | null;
	brand_id: number;
	brand_name: string | null;
	city: string | null;
	customer_remarks: string | null;
	days_left: number;
	delivery_error: string | null;
	delivery_status: string | null;
	due_stage: number | null;
	email: string | null;
	ew_customer_id: number;
	follow_up_count: number;
	full_name: string;
	interest_at: string | null;
	interest_count: number;
	is_opted_out: boolean;
	mobile: string;
	outcome: EwOutcomeType;
	outcome_at: string | null;
	preferred_contact: string | null;
	product_id: number | null;
	product_label: string | null;
	purchase_date: string | null;
	remarks: string | null;
	sends: EwLeadSendType[];
	sent_at: string | null;
	serial_no: string | null;
	stage: number | null;
	stage_status: EwStageStatusType | null;
	total_count: number;
	warranty_end_date: string;
};

/**
 * The rebuilt dashboard's single row. `lead_buckets` is keyed by stage as a string, built
 * from `reminder_days_before` server-side, so a tenant that configures a 60-day stage gets
 * a "60" key with no code change here.
 *
 * Mind the two counting semantics: `followed_up` counts DISTINCT CUSTOMERS (follow-ups are
 * recorded per customer), while `interested` / `won` / `lost` count customer x STAGE rows,
 * matching the funnel. They are not addable to each other.
 */
export type EwDashboardOverviewType = {
	failed: number;
	followed_up: number;
	interested: number;
	lead_buckets: Record<string, number>;
	leads_overdue: number;
	leads_total: number;
	lost: number;
	sent_month: number;
	sent_older: number;
	sent_today: number;
	sent_total: number;
	sent_week: number;
	won: number;
};

export type EwLeadStatusType = "DUE" | "FOLLOWED_UP" | "INTERESTED" | "LOST" | "MESSAGED" | "WON";

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

export type EwDrilldownRowType = {
	/** Present only when the dialog reads the all-leads source. */
	sends?: EwLeadSendType[];
	brand_name: string;
	delivery_status: EwDeliveryStatusType | null;
	ew_customer_id: number;
	full_name: string;
	interest_at: string | null;
	mobile: string;
	product_label: string | null;
	serial_no: string | null;
	outcome: EwOutcomeType;
	preferred_contact: string | null;
	sent_at: string | null;
	stage: number;
	stage_status: EwStageStatusType;
	warranty_end_date: string;
};
