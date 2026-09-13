import { Fragment } from "react";
import type { ComponentType, ReactNode } from "react";
import {
	Ban,
	BellRing,
	Eye,
	MoreVertical,
	Pencil,
	PhoneCall,
	PlayCircle,
	StepForward,
	ThumbsDown,
	ThumbsUp,
	Trash2,
	Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EwLeadType, EwStateType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { availableActions } from "./ew-state-machine";
import type { EwActionKeyType, EwActionType } from "./ew-state-machine";

type VisualType = {
	/** A brand mark paints itself — it gets no tinted chip and ignores `color`. */
	brand?: boolean;
	color: string;
	icon: ComponentType<{ className?: string }>;
};

/**
 * One icon and one colour per action. Colours follow constants/icon-colors.ts, so an icon
 * means the same thing here as anywhere else in the app: indigo for reaching the customer or
 * staff, blue for editing, and the state's own colour for a move into that state.
 */
const ACTION_VISUALS: Record<EwActionKeyType, VisualType> = {
	DELETE: { color: "text-red-600", icon: Trash2 },
	DETAILS: { color: "text-muted-foreground", icon: Eye },
	EDIT: { color: "text-blue-600", icon: Pencil },
	FOLLOW_UP: { color: "text-indigo-600", icon: PhoneCall },
	RESEND_ALERT: { color: "text-indigo-600", icon: BellRing },
	SEND: { brand: true, color: "text-green-600", icon: WhatsAppIcon },
	STAGE_ADVANCE: { color: "text-blue-600", icon: StepForward },
	// Never used directly — a TRANSITION is drawn from TRANSITION_VISUALS below.
	TRANSITION: { color: "text-muted-foreground", icon: PlayCircle },
};

/** A move is coloured by the state it lands in, matching EW_STATE_META's palette. */
const TRANSITION_VISUALS: Partial<Record<EwStateType, VisualType>> = {
	CANCELLED: { color: "text-rose-600", icon: Ban },
	IN_PROGRESS: { color: "text-violet-600", icon: PlayCircle },
	INTERESTED: { color: "text-orange-600", icon: ThumbsUp },
	LOST: { color: "text-amber-600", icon: ThumbsDown },
	WON: { color: "text-emerald-600", icon: Trophy },
};

function visualFor(action: EwActionType): VisualType {
	if (action.key === "TRANSITION" && action.toState) {
		return TRANSITION_VISUALS[action.toState] ?? ACTION_VISUALS.TRANSITION;
	}
	return ACTION_VISUALS[action.key];
}

type Props = {
	hideDetails?: boolean;
	onAction: (row: EwLeadType, action: EwActionType) => void;
	row: EwLeadType;
	trigger?: ReactNode;
};

/**
 * A lead's actions menu, built from availableActions (§C7.7) — never a hand-kept list. A
 * disabled item stays visible and, when picked, says why in a toast: Radix swallows hover
 * titles on truly disabled items, so the reason would otherwise be undiscoverable.
 */
export const EwLeadActionsMenu = ({ hideDetails = false, onAction, row, trigger }: Props) => {
	const actions = availableActions(row).filter((action) => !(hideDetails && action.key === "DETAILS"));

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{trigger ?? (
					<Button aria-label="Lead actions" size="icon-sm" variant="ghost">
						<MoreVertical className="h-4 w-4" />
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				{actions.map((action) => {
					const { brand, color, icon: Icon } = visualFor(action);
					return (
						<Fragment key={`${action.key}-${action.toState ?? ""}-${action.progressStage ?? ""}`}>
							{action.separatorBefore && <DropdownMenuSeparator />}
							<DropdownMenuItem
								aria-disabled={!!action.disabledReason}
								className={cn(
									"gap-2.5 px-2 py-1.5",
									action.disabledReason && "opacity-50",
									action.key === "DELETE" && "text-red-600 focus:bg-red-500/10 focus:text-red-600",
								)}
								title={action.disabledReason ?? undefined}
								onSelect={() => {
									if (action.disabledReason) {
										toast.info(action.disabledReason);
										return;
									}
									onAction(row, action);
								}}
							>
								<span
									className={cn(
										"flex size-6 shrink-0 items-center justify-center rounded-md",
										!brand && "bg-current/10",
										color,
									)}
								>
									<Icon className={cn(brand ? "size-5" : "size-3.5", color)} />
								</span>
								{action.label}
							</DropdownMenuItem>
						</Fragment>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
