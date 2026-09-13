import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EwLeadsFilterType } from "@/features/client/types/extended-warranty";

import { EwLeadGrid } from "./ew-lead-grid";
import type { EwLeadActionsType } from "./use-ew-lead-actions";

type Props = {
	actions: EwLeadActionsType;
	filter: EwLeadsFilterType;
	onBack: () => void;
	refreshKey: number;
	title: string;
};

/** A Lead Pipeline card opened as a full-pane page: prominent Back, title, the lead grid. */
export const EwDrilldownView = ({ actions, filter, onBack, refreshKey, title }: Props) => (
	<div className="flex min-h-0 flex-1 flex-col gap-3">
		<div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-(--cl-bg) pb-1">
			<Button size="lg" variant="outline" onClick={onBack}>
				<ArrowLeft className="h-4 w-4" />
				Back to dashboard
			</Button>
			<h2 className="text-sm font-bold tracking-tight text-(--cl-text)">{title}</h2>
		</div>
		<EwLeadGrid actions={actions} filter={filter} refreshKey={refreshKey} />
	</div>
);
