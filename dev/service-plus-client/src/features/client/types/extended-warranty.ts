/**
 * Extended Warranty types (plans/plan-ew-final.md §C7.2).
 *
 * Table columns derive from the generated `EwLead` (types/db-schema-service.ts). genericQuery
 * returns dates as ISO strings, so `IsoDatesType` turns every Date column into a string.
 * Columns computed by `ew_lead_view`, and the joined names, are declared here by hand — the
 * generated view type marks every column nullable, which would hide real guarantees.
 */
import type { EwLead } from "@/types/db-schema-service";

/** Generated Date columns as they arrive over genericQuery: ISO strings. */
type IsoDatesType<T> = {
	[K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

type EwPeriodMetricType =
	| "cancelled"
	| "interested"
	| "leads"
	| "lost"
	| "msg_awaiting"
	| "msg_delivered"
	| "msg_failed"
	| "msg_read"
	| "msg_total"
	| "won";

type EwPipelineCountType =
	| "cancelled"
	| "follow_ups_due"
	| "in_progress_1"
	| "in_progress_2"
	| "in_progress_3"
	| "in_progress_all"
	| "interested"
	| "leads_total"
	| "lost"
	| "new_0_7"
	| "new_31_60"
	| "new_61_plus"
	| "new_8_30"
	| "new_all"
	| "new_overdue"
	| "sent_all"
	| "sent_awaiting"
	| "sent_delivered"
	| "sent_failed"
	| "sent_read"
	| "won";

/** What send_ew_lead_alert reports back through resendEwLeadAlert. */
export type EwAlertSendStatusType =
	"ERROR" | "FAILED" | "INVALID_STAFF_NUMBER" | "NO_STAFF_NUMBER" | "NOT_FOUND" | "SENT";

export type EwBandType = "D0_7" | "D31_60" | "D61_PLUS" | "D8_30" | "OVERDUE";

/** GET_EW_DASHBOARD — one row. Period columns are `<metric>_<period>`. */
export type EwDashboardType = Record<`${EwPeriodMetricType}_${EwPeriodType}`, number> &
	Record<EwPipelineCountType, number>;

/** A `whatsappDeliveryStatus` subscription event published by the Extended Warranty webhook path. */
export type EwDeliveryEventType = {
	error: string | null;
	ew_lead_id: number;
	ew_message_id: number;
	kind: "EW";
	status: EwDeliveryStatusType;
	target: "CUSTOMER" | "STAFF";
};

export type EwDeliveryStatusType = "ACCEPTED" | "DELIVERED" | "FAILED" | "PENDING" | "READ" | "SENT";

export type EwEventType = "FOLLOW_UP" | "INTEREST" | "OPT_OUT" | "STAGE_CHANGE" | "STATE_CHANGE";

export type EwFollowUpActionType = "CALL" | "OTHER" | "SMS" | "VISIT" | "WHATSAPP";

/** addEwFollowUp */
export type EwFollowUpResultType = {
	ew_lead_id?: number;
	ok: boolean;
	progress_stage?: EwProgressStageType;
	reason?: "NOT_IN_PROGRESS";
};

/** GET_EW_LEAD_BY_MOBILE — earlier leads carry device fields, Jobs customers only person fields. */
export type EwLeadByMobileType = {
	address: string | null;
	brand_id: number | null;
	city: string | null;
	created_at: string;
	email: string | null;
	full_name: string;
	mobile: string;
	model_name: string | null;
	product_id: number | null;
	purchase_date: string | null;
	serial_no: string | null;
	source: "CUSTOMER" | "EW";
	warranty_end_date: string | null;
};

/** GET_EW_LEADS_PAGED row. */
export type EwLeadRowType = EwLeadType & { total_count: number };

/** Drill-down / Details filters; each maps to one GET_EW_LEADS_PAGED argument. */
export type EwLeadsFilterType = {
	band?: EwBandType;
	followUpDue?: boolean;
	isClosed?: boolean;
	messageGroup?: EwMessageGroupType;
	progressStage?: EwProgressStageType;
	state?: EwStateType;
};

/** GET_EW_LEAD_DETAIL row — the projection shared with GET_EW_LEADS_PAGED. */
export type EwLeadType = Omit<
	IsoDatesType<EwLead>,
	"id" | "is_closed" | "preferred_contact" | "progress_stage" | "state"
> & {
	alert_error: string | null;
	alert_status: EwDeliveryStatusType | null;
	band: EwBandType;
	brand_name: string | null;
	can_send: boolean;
	created_by_name: string | null;
	days_left: number;
	ew_lead_id: number;
	is_closed: boolean;
	last_delivery_status: EwDeliveryStatusType | null;
	last_error: string | null;
	/** The most recent FOLLOW_UP event's fields — null before any follow-up is ever recorded. */
	last_follow_up_action: EwFollowUpActionType | null;
	last_follow_up_by_name: string | null;
	last_follow_up_notes: string | null;
	last_message_id: number | null;
	last_sent_at: string | null;
	message_count: number;
	message_group: EwMessageGroupType | null;
	preferred_contact: EwPreferredContactType | null;
	product_label: string;
	progress_stage: EwProgressStageType | null;
	state: EwStateType;
};

/** Message Sent substate, from the latest reminder's delivery status. */
export type EwMessageGroupType = "AWAITING" | "DELIVERED" | "FAILED" | "READ";

export type EwMessageKindType = "LEAD_ALERT" | "REMINDER";

/**
 * Summary periods. Four are cumulative (D11): today ⊂ week ⊂ month ⊂ this_year. Two are
 * discrete calendar windows that do not nest with the others: prev_month (the whole of last
 * calendar month) and last_year (the whole of last calendar year, labelled "Prev year").
 */
export type EwPeriodType = "last_year" | "month" | "prev_month" | "this_year" | "today" | "week";

export type EwPreferredContactType = "CALL" | "WHATSAPP";

export type EwProgressStageType = 1 | 2 | 3;

/** resendEwLeadAlert */
export type EwResendAlertResultType = {
	ok: boolean;
	reason?: "NO_INTEREST" | "NOT_FOUND";
	status?: EwAlertSendStatusType;
};

/** sendEwReminders */
export type EwSendResponseType = {
	disabled?: boolean;
	results: EwSendResultType[];
};

export type EwSendResultType = {
	band: EwBandType | null;
	customer_name: string | null;
	error: string | null;
	ew_lead_id: number;
	status: "CAPPED" | "FAILED" | "SENT" | "SKIPPED";
};

/** The `extended_warranty` app_setting value. */
export type EwSettingsType = {
	contact_phone: string;
	daily_send_cap: number;
	enabled: boolean;
	notify_email: string;
	staff_whatsapp_number: string;
	whatsapp_number: string;
};

export type EwStateType = "CANCELLED" | "IN_PROGRESS" | "INTERESTED" | "LOST" | "MESSAGE_SENT" | "NEW_LEAD" | "WON";

/** GET_EW_LEAD_TIMELINE row — events and messages merged; ids are unique only within `source`. */
export type EwTimelineItemType = {
	action: EwFollowUpActionType | null;
	band: EwBandType | null;
	by_name: string | null;
	delivery_status: EwDeliveryStatusType | null;
	error: string | null;
	ew_message_id: number | null;
	from_state: EwStateType | null;
	id: number;
	item_type: EwEventType | "MESSAGE";
	kind: EwMessageKindType | null;
	next_follow_up_at: string | null;
	notes: string | null;
	occurred_at: string;
	progress_stage: EwProgressStageType | null;
	source: "EVENT" | "MESSAGE";
	to_state: EwStateType | null;
};

/** transitionEwLead */
export type EwTransitionResultType = {
	from_state?: EwStateType;
	ok: boolean;
	progress_stage?: EwProgressStageType | null;
	reason?: "STALE";
	to_state?: EwStateType;
};
