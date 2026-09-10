import { cn } from "@/lib/utils";
import type { EwDeliveryStatusType, EwStageStatusType } from "@/features/client/types/extended-warranty";

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
