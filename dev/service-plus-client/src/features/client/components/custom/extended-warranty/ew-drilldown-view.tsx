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

/**
 * A Lead Pipeline card opened as a full-pane page: prominent Back, title, the lead grid.
 * Back is filled indigo rather than an outline — it is the only way out of the drill-down, and
 * indigo keeps it clear of the teal New Lead button sitting in the tab row just above it.
 */
export const EwDrilldownView = ({ actions, filter, onBack, refreshKey, title }: Props) => (
	<div className="flex min-h-0 flex-1 flex-col gap-3">
		<div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-(--cl-bg) pb-1">
			<Button
				className="group h-10 gap-2 bg-indigo-600 px-5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
				onClick={onBack}
			>
				<ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
				Back to dashboard
			</Button>
			<h2 className="text-base font-bold tracking-tight text-(--cl-text)">{title}</h2>
		</div>
		<EwLeadGrid actions={actions} filter={filter} refreshKey={refreshKey} />
	</div>
);
