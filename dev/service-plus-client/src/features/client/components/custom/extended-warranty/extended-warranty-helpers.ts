import type {
	EwDeliveryStatusType,
	EwFollowUpActionType,
	EwOutcomeType,
	EwStageStatusType,
} from "@/features/client/types/extended-warranty";

/**
 * The business ladder, per customer per stage. Ranks exist so a follow-up can never
 * walk a lead backwards; they mirror EW_STAGE_STATUS_RANK on the server
 * (app/graphql/resolvers/jobs/extended_warranty.py) and must stay in step with it.
 */
export const EW_STAGE_STATUS_RANK: Record<EwStageStatusType, number> = {
	CONVERTED: 9,
	FOLLOWED_UP: 3,
	INTERESTED: 2,
	MESSAGE_SENT: 1,
	NOT_INTERESTED: 9,
	START: 0,
	UNREACHABLE: 9,
};

export const EW_STAGE_STATUS_LABEL: Record<EwStageStatusType, string> = {
	CONVERTED: "Converted",
	FOLLOWED_UP: "Followed up",
	INTERESTED: "Interested",
	MESSAGE_SENT: "Message sent",
	NOT_INTERESTED: "Not interested",
	START: "Not contacted",
	UNREACHABLE: "Unreachable",
};

/**
 * Red is reserved for genuine failure — NOT_INTERESTED is a normal business outcome,
 * not an error, so it reads as neutral slate rather than red.
 */
export const EW_STAGE_STATUS_CLASS: Record<EwStageStatusType, string> = {
	CONVERTED: "bg-emerald-100 text-emerald-700",
	FOLLOWED_UP: "bg-blue-100 text-blue-700",
	INTERESTED: "bg-violet-100 text-violet-700",
	MESSAGE_SENT: "bg-amber-100 text-amber-700",
	NOT_INTERESTED: "bg-slate-100 text-slate-600",
	START: "bg-slate-100 text-slate-600",
	UNREACHABLE: "bg-slate-100 text-slate-600",
};

export const EW_OUTCOME_LABEL: Record<EwOutcomeType, string> = {
	CONVERTED: "Converted",
	NOT_INTERESTED: "Not interested",
	OPEN: "Open",
	UNREACHABLE: "Unreachable",
};

export const EW_FOLLOW_UP_ACTION_LABEL: Record<EwFollowUpActionType, string> = {
	CALL: "Called",
	OTHER: "Other",
	SMS: "SMS",
	VISIT: "Visited",
	WHATSAPP: "WhatsApp",
};

export const EW_DELIVERY_STATUS_LABEL: Record<EwDeliveryStatusType, string> = {
	ACCEPTED: "Accepted",
	DELIVERED: "Delivered",
	FAILED: "Failed",
	PENDING: "Sending",
	READ: "Read",
	SENT: "Sent",
};

/** Stage labels come from the setting, never a hardcoded list — see `stageLabel`. */
export function stageLabel(stage: number): string {
	return stage === 0 ? "On expiry" : `${stage}-day`;
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return "-";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "-";
	return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return "-";
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "-";
	return d.toLocaleString(undefined, {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function daysLeftLabel(daysLeft: number): string {
	if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)}d ago`;
	if (daysLeft === 0) return "Expires today";
	return `${daysLeft}d left`;
}
