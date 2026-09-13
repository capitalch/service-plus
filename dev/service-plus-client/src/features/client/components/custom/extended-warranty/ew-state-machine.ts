/**
 * Extended Warranty state machine — the client mirror (plans/plan-ew-final.md §C2, §C7.3).
 *
 * EW_TRANSITIONS MUST match EW_TRANSITIONS in the server's
 * app/graphql/resolvers/custom/extended_warranty.py, which is authoritative. This copy also
 * carries NEW_LEAD → MESSAGE_SENT because the flow diagram draws it; the row menu shows
 * "Send WhatsApp reminder" for that edge instead of a bare state change.
 *
 * The band rule, can_send and message groups are computed on the server (ew_lead_view);
 * this file holds labels, colours and the row menu only.
 */
import { MESSAGES } from "@/constants/messages";
import type {
	EwBandType,
	EwDashboardType,
	EwDeliveryStatusType,
	EwFollowUpActionType,
	EwLeadType,
	EwLeadsFilterType,
	EwMessageGroupType,
	EwPeriodType,
	EwProgressStageType,
	EwStateType,
} from "@/features/client/types/extended-warranty";
import { MOBILE_REGEX, normalizeMobile } from "@/lib/mobile";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EwActionKeyType =
	"DELETE" | "DETAILS" | "EDIT" | "FOLLOW_UP" | "RESEND_ALERT" | "SEND" | "STAGE_ADVANCE" | "TRANSITION";

/** One row-menu item. Disabled items stay visible; `disabledReason` explains why. */
export type EwActionType = {
	disabledReason: string | null;
	key: EwActionKeyType;
	label: string;
	progressStage?: EwProgressStageType;
	separatorBefore?: boolean;
	toState?: EwStateType;
};

export type EwColorType =
	"amber" | "blue" | "green" | "grey" | "indigo" | "orange" | "red" | "rose" | "teal" | "violet";

type EwMetaType = { color: EwColorType; label: string; order: number };

export type EwPipelineCardType = {
	color: EwColorType;
	countKey: keyof EwDashboardType;
	filter: EwLeadsFilterType;
	label: string;
};

export type EwPipelineGroupType = {
	cards: EwPipelineCardType[];
	key: string;
	label: string;
	totalKey: keyof EwDashboardType | null;
};

type TransitionTargetType = Exclude<EwStateType, "MESSAGE_SENT" | "NEW_LEAD">;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Server limits mirrored for the forms (resolvers/custom/extended_warranty.py). */
export const EW_NOTES_MAX = 1000;
export const EW_SEND_GRACE_DAYS = 7;

/** How far a new lead's warranty end date may be backdated — overdue cases are entered too. */
export const EW_WARRANTY_END_BACKDATE_MONTHS = 3;

export const EW_BANDS: Record<EwBandType, EwMetaType> = {
	D0_7: { color: "orange", label: "0–7 days", order: 3 },
	D31_60: { color: "green", label: "31–60 days", order: 1 },
	D61_PLUS: { color: "grey", label: "61+ days", order: 0 },
	D8_30: { color: "blue", label: "8–30 days", order: 2 },
	OVERDUE: { color: "amber", label: "Overdue", order: 4 },
};

/** Literal class strings, so Tailwind's scanner sees every one of them. */
export const EW_COLOR_CLASSES: Record<EwColorType, { border: string; text: string; tint: string }> = {
	amber: {
		border: "border-amber-500",
		text: "text-amber-700 dark:text-amber-400",
		tint: "bg-amber-50 dark:bg-amber-950/30",
	},
	blue: {
		border: "border-blue-500",
		text: "text-blue-700 dark:text-blue-400",
		tint: "bg-blue-50 dark:bg-blue-950/30",
	},
	green: {
		border: "border-green-500",
		text: "text-green-700 dark:text-green-400",
		tint: "bg-green-50 dark:bg-green-950/30",
	},
	grey: {
		border: "border-slate-400",
		text: "text-slate-700 dark:text-slate-300",
		tint: "bg-slate-50 dark:bg-slate-900/40",
	},
	indigo: {
		border: "border-indigo-500",
		text: "text-indigo-700 dark:text-indigo-400",
		tint: "bg-indigo-50 dark:bg-indigo-950/30",
	},
	orange: {
		border: "border-orange-500",
		text: "text-orange-700 dark:text-orange-400",
		tint: "bg-orange-50 dark:bg-orange-950/30",
	},
	red: { border: "border-red-500", text: "text-red-700 dark:text-red-400", tint: "bg-red-50 dark:bg-red-950/30" },
	rose: {
		border: "border-rose-500",
		text: "text-rose-700 dark:text-rose-400",
		tint: "bg-rose-50 dark:bg-rose-950/30",
	},
	teal: {
		border: "border-teal-500",
		text: "text-teal-700 dark:text-teal-400",
		tint: "bg-teal-50 dark:bg-teal-950/30",
	},
	violet: {
		border: "border-violet-500",
		text: "text-violet-700 dark:text-violet-400",
		tint: "bg-violet-50 dark:bg-violet-950/30",
	},
};

export const EW_DELIVERY_STATUS_META: Record<EwDeliveryStatusType, { color: EwColorType; label: string }> = {
	ACCEPTED: { color: "grey", label: "Accepted" },
	DELIVERED: { color: "green", label: "Delivered" },
	FAILED: { color: "red", label: "Failed" },
	PENDING: { color: "grey", label: "Sending" },
	READ: { color: "blue", label: "Read" },
	SENT: { color: "grey", label: "Sent" },
};

export const EW_FOLLOW_UP_ACTIONS: Record<EwFollowUpActionType, { label: string; order: number }> = {
	CALL: { label: "Call", order: 1 },
	OTHER: { label: "Other", order: 5 },
	SMS: { label: "SMS", order: 3 },
	VISIT: { label: "Visit", order: 4 },
	WHATSAPP: { label: "WhatsApp", order: 2 },
};

/** Message Sent substates — mutually exclusive, they sum to the Message Sent total (D2, D12). */
export const EW_MESSAGE_GROUPS: Record<EwMessageGroupType, EwMetaType> = {
	AWAITING: { color: "grey", label: "Awaiting", order: 4 },
	DELIVERED: { color: "green", label: "Delivered", order: 1 },
	FAILED: { color: "red", label: "Fail", order: 3 },
	READ: { color: "blue", label: "Read", order: 2 },
};

export const EW_PERIODS: Record<EwPeriodType, { label: string; order: number }> = {
	month: { label: "This month", order: 3 },
	older: { label: "Over a month old", order: 4 },
	today: { label: "Today", order: 1 },
	week: { label: "This week", order: 2 },
};

/**
 * Lead Pipeline cards, in display order (the brief's card colours, §C7.3). Every card opens
 * a drill-down with its `filter`; `countKey` is its GET_EW_DASHBOARD column.
 */
export const EW_PIPELINE_GROUPS: EwPipelineGroupType[] = [
	{
		cards: [
			{ color: "grey", countKey: "new_61_plus", filter: { band: "D61_PLUS", state: "NEW_LEAD" }, label: "61+ D" },
			{ color: "green", countKey: "new_31_60", filter: { band: "D31_60", state: "NEW_LEAD" }, label: "31–60 D" },
			{ color: "blue", countKey: "new_8_30", filter: { band: "D8_30", state: "NEW_LEAD" }, label: "8–30 D" },
			{ color: "orange", countKey: "new_0_7", filter: { band: "D0_7", state: "NEW_LEAD" }, label: "0–7 D" },
			{
				color: "amber",
				countKey: "new_overdue",
				filter: { band: "OVERDUE", state: "NEW_LEAD" },
				label: "Overdue",
			},
			{ color: "green", countKey: "new_all", filter: { state: "NEW_LEAD" }, label: "All" },
		],
		key: "NEW_LEAD",
		label: "New Lead",
		totalKey: "new_all",
	},
	{
		cards: [
			{
				color: "green",
				countKey: "sent_delivered",
				filter: { messageGroup: "DELIVERED", state: "MESSAGE_SENT" },
				label: "Delivered",
			},
			{
				color: "blue",
				countKey: "sent_read",
				filter: { messageGroup: "READ", state: "MESSAGE_SENT" },
				label: "Read",
			},
			{
				color: "red",
				countKey: "sent_failed",
				filter: { messageGroup: "FAILED", state: "MESSAGE_SENT" },
				label: "Fail",
			},
			{
				color: "grey",
				countKey: "sent_awaiting",
				filter: { messageGroup: "AWAITING", state: "MESSAGE_SENT" },
				label: "Awaiting",
			},
		],
		key: "MESSAGE_SENT",
		label: "Message Sent",
		totalKey: "sent_all",
	},
	{
		cards: [{ color: "orange", countKey: "interested", filter: { state: "INTERESTED" }, label: "Interested" }],
		key: "INTERESTED",
		label: "Interested",
		totalKey: null,
	},
	{
		cards: [
			{
				color: "green",
				countKey: "in_progress_1",
				filter: { progressStage: 1, state: "IN_PROGRESS" },
				label: "Stage 1",
			},
			{
				color: "blue",
				countKey: "in_progress_2",
				filter: { progressStage: 2, state: "IN_PROGRESS" },
				label: "Stage 2",
			},
			{
				color: "orange",
				countKey: "in_progress_3",
				filter: { progressStage: 3, state: "IN_PROGRESS" },
				label: "Stage 3",
			},
		],
		key: "IN_PROGRESS",
		label: "In Progress",
		totalKey: "in_progress_all",
	},
	{
		cards: [
			{ color: "green", countKey: "won", filter: { state: "WON" }, label: "Won" },
			{ color: "amber", countKey: "lost", filter: { state: "LOST" }, label: "Lost" },
			{ color: "amber", countKey: "cancelled", filter: { state: "CANCELLED" }, label: "Cancelled" },
		],
		key: "CLOSED",
		label: "Closed",
		totalKey: null,
	},
];

export const EW_STAGES: Record<EwProgressStageType, EwMetaType> = {
	1: { color: "green", label: "Stage 1", order: 1 },
	2: { color: "blue", label: "Stage 2", order: 2 },
	3: { color: "orange", label: "Stage 3", order: 3 },
};

export const EW_STATE_META: Record<EwStateType, EwMetaType & { closed: boolean }> = {
	CANCELLED: { closed: true, color: "rose", label: "Cancelled", order: 7 },
	IN_PROGRESS: { closed: false, color: "violet", label: "In Progress", order: 4 },
	INTERESTED: { closed: false, color: "orange", label: "Interested", order: 3 },
	LOST: { closed: true, color: "amber", label: "Lost", order: 6 },
	MESSAGE_SENT: { closed: false, color: "indigo", label: "Message Sent", order: 2 },
	NEW_LEAD: { closed: false, color: "blue", label: "New Lead", order: 1 },
	WON: { closed: true, color: "green", label: "Won", order: 5 },
};

/** The seven states in flow order. */
export const EW_STATES: EwStateType[] = byOrder(EW_STATE_META);

/** §C2.3 — see the file header for how this relates to the server's copy. */
export const EW_TRANSITIONS: Record<EwStateType, EwStateType[]> = {
	CANCELLED: ["IN_PROGRESS"],
	IN_PROGRESS: ["CANCELLED", "LOST", "WON"],
	INTERESTED: ["CANCELLED", "IN_PROGRESS", "LOST", "WON"],
	LOST: ["IN_PROGRESS", "WON"],
	MESSAGE_SENT: ["CANCELLED", "IN_PROGRESS", "INTERESTED", "LOST", "WON"],
	NEW_LEAD: ["CANCELLED", "IN_PROGRESS", "LOST", "MESSAGE_SENT", "WON"],
	WON: [],
};

/** Row-menu wording and order for a move to each state. */
const TRANSITION_ITEMS: Record<TransitionTargetType, { label: string; order: number }> = {
	CANCELLED: { label: "Cancel lead", order: 5 },
	IN_PROGRESS: { label: "Move to In Progress", order: 2 },
	INTERESTED: { label: "Mark interested", order: 1 },
	LOST: { label: "Mark Lost", order: 4 },
	WON: { label: "Mark Won", order: 3 },
};

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * The row menu for a lead (§C7.7): send first, then state moves in a fixed order, then Edit,
 * Delete (New Lead only) and View details. Transition items come from EW_TRANSITIONS, never
 * a hand-kept list.
 */
export function availableActions(row: EwLeadType): EwActionType[] {
	const actions: EwActionType[] = [];

	if (row.state === "NEW_LEAD" || row.state === "MESSAGE_SENT") {
		actions.push({ disabledReason: sendBlockReason(row), key: "SEND", label: "Send WhatsApp reminder" });
	}

	if (row.state === "IN_PROGRESS") {
		actions.push({ disabledReason: null, key: "FOLLOW_UP", label: "Record follow-up…" });
		const stage = row.progress_stage ?? 1;
		if (stage < 3) {
			const next = (stage + 1) as EwProgressStageType;
			actions.push({
				disabledReason: null,
				key: "STAGE_ADVANCE",
				label: `Advance to ${EW_STAGES[next].label}`,
				progressStage: next,
				toState: "IN_PROGRESS",
			});
		}
	}

	EW_TRANSITIONS[row.state]
		.filter((toState): toState is TransitionTargetType => toState !== "MESSAGE_SENT" && toState !== "NEW_LEAD")
		.sort((a, b) => TRANSITION_ITEMS[a].order - TRANSITION_ITEMS[b].order)
		.forEach((toState) =>
			actions.push({
				disabledReason: null,
				key: "TRANSITION",
				label: transitionLabel(row.state, toState),
				toState,
			}),
		);

	const tail: EwActionType[] = [];
	if (row.state === "INTERESTED" && (row.alert_status === null || row.alert_status === "FAILED")) {
		tail.push({ disabledReason: null, key: "RESEND_ALERT", label: "Resend staff alert" });
	}
	tail.push({ disabledReason: null, key: "EDIT", label: "Edit" });
	if (row.state === "NEW_LEAD") {
		tail.push({
			disabledReason: row.message_count > 0 ? MESSAGES.INFO_EW_DELETE_MESSAGED : null,
			key: "DELETE",
			label: "Delete",
		});
	}
	tail.push({ disabledReason: null, key: "DETAILS", label: "View details" });
	tail[0].separatorBefore = actions.length > 0;

	return [...actions, ...tail];
}

/** Keys of a meta record, sorted by its `order`. */
function byOrder<K extends string | number>(meta: Record<K, { order: number }>): K[] {
	return (Object.keys(meta) as K[]).sort((a, b) => meta[a].order - meta[b].order);
}

export function daysLeftLabel(daysLeft: number): string {
	if (daysLeft === 0) return "Expires today";
	if (daysLeft === 1) return "1 day left";
	if (daysLeft > 1) return `${daysLeft} days left`;
	if (daysLeft === -1) return "Expired yesterday";
	return `Expired ${-daysLeft} days ago`;
}

/** '13 Sep 2026'; '' for null. */
export function formatDate(value: string | null): string {
	const date = toDate(value);
	return date ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

/** '13 Sep 2026, 6:30 pm'; '' for null. */
export function formatDateTime(value: string | null): string {
	const date = toDate(value);
	return date
		? date.toLocaleString("en-IN", {
				day: "2-digit",
				hour: "numeric",
				minute: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "";
}

/**
 * A usable 10-digit mobile. Stricter than lib/mobile's isValidMobile, which accepts "" for
 * forms where the mobile is optional — here a lead's mobile is what the reminder goes to.
 */
export function isCompleteMobile(mobile: string | null | undefined): boolean {
	return MOBILE_REGEX.test(normalizeMobile(mobile));
}

export function isFollowUpDue(row: EwLeadType): boolean {
	return row.state === "IN_PROGRESS" && !!row.next_follow_up_at && new Date(row.next_follow_up_at) <= new Date();
}

/**
 * Why a reminder cannot go to this lead, or null when it can. Mirrors can_send (§C2.5) plus
 * the mobile check, in the order a user would want to hear them; the server re-checks.
 */
export function sendBlockReason(row: EwLeadType): string | null {
	if (row.is_closed) return MESSAGES.INFO_EW_NOT_SENDABLE_CLOSED;
	if (row.state !== "NEW_LEAD" && row.state !== "MESSAGE_SENT") return MESSAGES.INFO_EW_NOT_SENDABLE_STATE;
	if (row.is_opted_out) return MESSAGES.INFO_EW_NOT_SENDABLE_OPTED_OUT;
	if (!isCompleteMobile(row.mobile)) return MESSAGES.INFO_EW_NOT_SENDABLE_MOBILE;
	if (row.days_left < -EW_SEND_GRACE_DAYS) return MESSAGES.INFO_EW_NOT_SENDABLE_EXPIRED;
	if (!row.can_send) return MESSAGES.INFO_EW_NOT_SENDABLE_ALREADY_SENT;
	return null;
}

/** 'New Lead · 0–7 days', 'Message Sent · Read', 'In Progress · Stage 2', or the state alone. */
export function stateBadgeLabel(row: EwLeadType): string {
	const label = EW_STATE_META[row.state].label;
	if (row.state === "NEW_LEAD") return `${label} · ${EW_BANDS[row.band].label}`;
	if (row.state === "MESSAGE_SENT" && row.message_group) {
		return `${label} · ${EW_MESSAGE_GROUPS[row.message_group].label}`;
	}
	if (row.state === "IN_PROGRESS" && row.progress_stage) return `${label} · ${EW_STAGES[row.progress_stage].label}`;
	return label;
}

/** Date-only ISO strings are read as local dates, so '2026-09-13' never shifts a day. */
function toDate(value: string | null): Date | null {
	if (!value) return null;
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	const date = dateOnly ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]) : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Menu / dialog wording for a move; a move out of Lost or Cancelled reads as a reopen. */
export function transitionLabel(fromState: EwStateType, toState: EwStateType): string {
	if (toState === "IN_PROGRESS" && EW_STATE_META[fromState].closed) return "Reopen → In Progress";
	return toState in TRANSITION_ITEMS
		? TRANSITION_ITEMS[toState as TransitionTargetType].label
		: EW_STATE_META[toState].label;
}
