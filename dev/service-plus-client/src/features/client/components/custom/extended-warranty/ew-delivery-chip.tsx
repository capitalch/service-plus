import type { EwDeliveryStatusType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { EW_COLOR_CLASSES, EW_DELIVERY_STATUS_META } from "./ew-state-machine";

type Props = {
	error?: string | null;
	status: EwDeliveryStatusType | null;
};

/** One WhatsApp message's delivery status; Meta's error, when there is one, is the tooltip. */
export const EwDeliveryChip = ({ error, status }: Props) => {
	if (!status) return <span className="text-xs text-(--cl-text-muted)">—</span>;
	const meta = EW_DELIVERY_STATUS_META[status];
	const colors = EW_COLOR_CLASSES[meta.color];
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
				colors.border,
				colors.text,
				colors.tint,
			)}
			title={error ?? undefined}
		>
			{meta.label}
		</span>
	);
};
