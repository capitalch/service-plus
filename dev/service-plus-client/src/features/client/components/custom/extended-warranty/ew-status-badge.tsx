import { cn } from "@/lib/utils";

import { formatDateTime, stageLabel } from "./extended-warranty-helpers";
import type {
	EwDeliveryStatusType,
	EwLeadSendType,
	EwStageStatusType,
} from "@/features/client/types/extended-warranty";

import { EW_DELIVERY_STATUS_LABEL, EW_STAGE_STATUS_CLASS, EW_STAGE_STATUS_LABEL } from "./extended-warranty-helpers";

// Red is reserved for genuine failure. FAILED earns it; every other delivery state is
// informational and reads neutral or positive.
const DELIVERY_CLASS: Record<EwDeliveryStatusType, string> = {
	ACCEPTED: "bg-amber-100 text-amber-700",
	DELIVERED: "bg-emerald-100 text-emerald-700",
	FAILED: "bg-red-100 text-red-700",
	PENDING: "bg-slate-100 text-slate-600",
	READ: "bg-emerald-100 text-emerald-700",
	SENT: "bg-blue-100 text-blue-700",
};

const BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap";

export const EwDeliveryBadge = ({
	status,
	title,
}: {
	status: EwDeliveryStatusType | null | undefined;
	title?: string;
}) => {
	if (!status) return <span className="text-xs text-(--cl-text-muted)">—</span>;
	return (
		<span className={cn(BASE, DELIVERY_CLASS[status])} title={title ?? undefined}>
			{EW_DELIVERY_STATUS_LABEL[status]}
		</span>
	);
};

export const EwStageStatusBadge = ({ status }: { status: EwStageStatusType | null | undefined }) => {
	const value = status ?? "START";
	return <span className={cn(BASE, EW_STAGE_STATUS_CLASS[value])}>{EW_STAGE_STATUS_LABEL[value]}</span>;
};

/**
 * Every send a customer has had, one chip per stage, newest stage first. Used by all three
 * grids so "Sent" means the same thing everywhere: the full history, not just the latest.
 * A failed send keeps its reason in the tooltip rather than spending a column on it.
 */
export const EwSendHistory = ({ sends }: { sends: EwLeadSendType[] | undefined }) => {
	if (!sends || sends.length === 0) return <span className="text-xs text-(--cl-text-muted)">Not sent</span>;
	return (
		<div className="flex flex-wrap gap-1">
			{sends.map((send) => (
				<span
					key={send.stage}
					className="inline-flex items-center gap-1 rounded border border-(--cl-border) px-1.5 py-0.5 text-[11px]"
					title={[stageLabel(send.stage), send.sent_at ? formatDateTime(send.sent_at) : null, send.error]
						.filter(Boolean)
						.join(" · ")}
				>
					<span className="font-medium text-(--cl-text)">{stageLabel(send.stage)}</span>
					<EwDeliveryBadge status={send.delivery_status} />
				</span>
			))}
		</div>
	);
};
