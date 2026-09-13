import { Fragment } from "react";
import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EwLeadType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { availableActions } from "./ew-state-machine";
import type { EwActionType } from "./ew-state-machine";

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
			<DropdownMenuContent align="end" className="min-w-52">
				{actions.map((action) => (
					<Fragment key={`${action.key}-${action.toState ?? ""}-${action.progressStage ?? ""}`}>
						{action.separatorBefore && <DropdownMenuSeparator />}
						<DropdownMenuItem
							aria-disabled={!!action.disabledReason}
							className={cn(action.disabledReason && "opacity-50")}
							title={action.disabledReason ?? undefined}
							onSelect={() => {
								if (action.disabledReason) {
									toast.info(action.disabledReason);
									return;
								}
								onAction(row, action);
							}}
						>
							{action.label}
						</DropdownMenuItem>
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
