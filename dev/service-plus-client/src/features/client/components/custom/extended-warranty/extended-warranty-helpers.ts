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

/**
 * The Due tab's selection checkboxes, which drive the only destructive-ish action in this
 * screen — sending a marketing message to a real customer. The shared shadcn primitive
 * fills a checked box with `--primary`, which is near-black (oklch 0.205), and draws an
 * emerald tick on top of it: dark-on-dark, and easy to misread at a glance when you are
 * about to send. These overrides make the checked state unmistakable — a filled emerald
 * box with a white tick, one step larger, with a heavier unchecked border so an empty box
 * is equally obvious. Set here rather than in components/ui/checkbox.tsx, which is
 * generated and shared with every other screen.
 */
export const EW_CHECKBOX_CLASS =
	"size-5 border-2 border-(--cl-text-muted)/40 transition-colors hover:border-emerald-500 " +
	"data-checked:border-emerald-600 data-checked:bg-emerald-600 [&_svg]:text-white";

export type EwBucketType = { label: string; max: number | null; min: number | null; value: number | null };

/**
 * Turn the configured `reminder_days_before` into the Leads screen's expiry chips, as
 * days-left ranges. Derived from the setting and never a literal, so a tenant that adds a
 * 60-day stage gets a 60 chip with no code change.
 *
 * Each chip covers "inside this window but outside the tighter one" — with [30, 7, 0] a
 * lead 20 days out lands in the 30 chip, one 3 days out in the 7 chip. Overdue is bounded
 * below by the send grace, so it holds only leads still worth pursuing.
 */
export function bucketsFromStages(stages: number[], graceDays: number): EwBucketType[] {
	const sorted = [...new Set(stages)].sort((a, b) => b - a);
	const chips: EwBucketType[] = sorted.map((stage, i) => {
		const tighter = sorted[i + 1];
		return {
			label: stage === 0 ? "Expiring today" : `${stage} days`,
			max: stage,
			min: tighter == null ? 0 : tighter + 1,
			value: stage,
		};
	});
	chips.push({ label: "Overdue", max: -1, min: graceDays, value: -1 });
	return chips;
}

/** The one-line status of a lead, in the order staff care about it. */
export function leadStatusLabel(row: {
	due_stage: number | null;
	follow_up_count: number;
	interest_at: string | null;
	outcome: string;
	sent_at: string | null;
}): string {
	if (row.outcome === "CONVERTED") return "Won";
	if (row.outcome === "NOT_INTERESTED" || row.outcome === "UNREACHABLE") return "Lost";
	if (row.interest_at) return "Interested";
	if (row.follow_up_count > 0) return "Followed up";
	if (row.due_stage != null) return "Due to message";
	if (row.sent_at) return "Message sent";
	return "Not messaged";
}
