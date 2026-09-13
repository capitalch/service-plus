import type { EwLeadType, EwProgressStageType, EwStateType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { EW_COLOR_CLASSES, EW_STAGES, EW_STATE_META, stateBadgeLabel } from "./ew-state-machine";

const PILL = "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold";

/** A lead's state with its substate — "New Lead · 0–7 days", "In Progress · Stage 2". */
export const EwStateBadge = ({ row }: { row: EwLeadType }) => {
	const colors = EW_COLOR_CLASSES[EW_STATE_META[row.state].color];
	return <span className={cn(PILL, colors.border, colors.text, colors.tint)}>{stateBadgeLabel(row)}</span>;
};

/** A bare state pill, e.g. the from → to pair in the transition dialog. */
export const EwStatePill = ({
	progressStage,
	state,
}: {
	progressStage?: EwProgressStageType | null;
	state: EwStateType;
}) => {
	const colors = EW_COLOR_CLASSES[EW_STATE_META[state].color];
	const label =
		state === "IN_PROGRESS" && progressStage
			? `${EW_STATE_META[state].label} · ${EW_STAGES[progressStage].label}`
			: EW_STATE_META[state].label;
	return <span className={cn(PILL, colors.border, colors.text, colors.tint)}>{label}</span>;
};
