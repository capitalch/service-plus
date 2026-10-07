import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MESSAGES } from "@/constants/messages";

import { InternalNotesPanel } from "./internal-notes-panel";

type Props = {
	branchId: number;
	jobId: number;
	jobNo: string;
	onChanged?: () => void;
	onClose: () => void;
};

/** The Internal Notes panel on its own — opened from the note chip and row menu in Job Control and Job Pipeline. */
export const InternalNotesDialog = ({ branchId, jobId, jobNo, onChanged, onClose }: Props) => (
	<Dialog onOpenChange={(open) => !open && onClose()} open>
		<DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto bg-slate-50 sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Internal Notes — Job #{jobNo}</DialogTitle>
				<DialogDescription className="sr-only">{MESSAGES.INFO_INTERNAL_NOTES_HINT}</DialogDescription>
			</DialogHeader>
			<InternalNotesPanel branchId={branchId} jobId={jobId} onChanged={onChanged} />
		</DialogContent>
	</Dialog>
);
