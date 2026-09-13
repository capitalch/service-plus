import { useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwLeadType, EwProgressStageType, EwStateType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { EwFollowUpDialog } from "./ew-follow-up-dialog";
import { EwLeadDetailDialog } from "./ew-lead-detail-dialog";
import { EwLeadDialog } from "./ew-lead-dialog";
import { deleteEwLead, fillMessage, resendEwLeadAlert, sendEwReminders, toastSendResults } from "./ew-mutations";
import type { EwActionType } from "./ew-state-machine";
import { EwTransitionDialog } from "./ew-transition-dialog";

export type EwLeadActionsType = {
	dialogs: ReactNode;
	handleAction: (row: EwLeadType, action: EwActionType) => void;
	openDetail: (ewLeadId: number) => void;
	openFollowUp: (row: EwLeadType) => void;
	openNewLead: () => void;
	sendMany: (rows: EwLeadType[]) => void;
};

type TransitionStateType = { progressStage?: EwProgressStageType; row: EwLeadType; toState: EwStateType };

/**
 * Every Extended Warranty lead action and dialog in one place, owned by the section and
 * shared by the dashboard, the grids, the detail dialog and the staff deep link — so a
 * menu item behaves the same wherever it is picked. `onChanged` refreshes everything.
 */
export const useEwLeadActions = ({
	onChanged,
	refreshKey,
}: {
	onChanged: () => void;
	refreshKey: number;
}): EwLeadActionsType => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [busy, setBusy] = useState(false);
	const [deleting, setDeleting] = useState<EwLeadType | null>(null);
	const [detailId, setDetailId] = useState<number | null>(null);
	const [followUp, setFollowUp] = useState<EwLeadType | null>(null);
	const [leadDialog, setLeadDialog] = useState<{ editing: EwLeadType | null } | null>(null);
	const [sendRows, setSendRows] = useState<EwLeadType[] | null>(null);
	const [transition, setTransition] = useState<TransitionStateType | null>(null);

	function handleAction(row: EwLeadType, action: EwActionType) {
		switch (action.key) {
			case "DELETE":
				setDeleting(row);
				break;
			case "DETAILS":
				setDetailId(row.ew_lead_id);
				break;
			case "EDIT":
				setLeadDialog({ editing: row });
				break;
			case "FOLLOW_UP":
				setFollowUp(row);
				break;
			case "RESEND_ALERT":
				void handleResend(row);
				break;
			case "SEND":
				setSendRows([row]);
				break;
			case "STAGE_ADVANCE":
			case "TRANSITION":
				if (action.toState)
					setTransition({ progressStage: action.progressStage, row, toState: action.toState });
				break;
		}
	}

	async function handleConfirmDelete() {
		if (!deleting || !dbName || !schema) return;
		setBusy(true);
		try {
			await deleteEwLead({ dbName, schema }, deleting.ew_lead_id);
			toast.success(MESSAGES.SUCCESS_EW_LEAD_DELETED);
			if (detailId === deleting.ew_lead_id) setDetailId(null);
			setDeleting(null);
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_LEAD_DELETE_FAILED);
		} finally {
			setBusy(false);
		}
	}

	async function handleConfirmSend() {
		if (!sendRows || !dbName || !schema || !branch?.id) return;
		setBusy(true);
		try {
			toastSendResults(
				await sendEwReminders(
					{ dbName, schema },
					branch.id,
					sendRows.map((r) => r.ew_lead_id),
				),
			);
			setSendRows(null);
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_SEND_FAILED);
		} finally {
			setBusy(false);
		}
	}

	async function handleResend(row: EwLeadType) {
		if (!dbName || !schema || !branch?.id) return;
		try {
			const result = await resendEwLeadAlert({ dbName, schema }, branch.id, row.ew_lead_id);
			if (result.ok) toast.success(MESSAGES.SUCCESS_EW_ALERT_RESENT);
			else if (result.status === "NO_STAFF_NUMBER") toast.info(MESSAGES.INFO_EW_NO_STAFF_NUMBER);
			else if (result.status === "INVALID_STAFF_NUMBER") toast.info(MESSAGES.INFO_EW_INVALID_STAFF_NUMBER);
			else toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
			onChanged();
		} catch {
			toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
		}
	}

	const sendCount = sendRows?.length ?? 0;

	const dialogs = (
		<>
			{detailId !== null && (
				<EwLeadDetailDialog
					ewLeadId={detailId}
					refreshKey={refreshKey}
					onAction={handleAction}
					onClose={() => setDetailId(null)}
				/>
			)}
			{transition && (
				<EwTransitionDialog
					progressStage={transition.progressStage}
					row={transition.row}
					toState={transition.toState}
					onClose={() => setTransition(null)}
					onDone={(chainFollowUp, updated) => {
						setTransition(null);
						onChanged();
						if (chainFollowUp) setFollowUp(updated);
					}}
				/>
			)}
			{followUp && <EwFollowUpDialog row={followUp} onClose={() => setFollowUp(null)} onSaved={onChanged} />}
			{leadDialog && (
				<EwLeadDialog editing={leadDialog.editing} onClose={() => setLeadDialog(null)} onSaved={onChanged} />
			)}

			<AlertDialog open={sendRows !== null} onOpenChange={(open) => !open && !busy && setSendRows(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{fillMessage(MESSAGES.CONFIRM_EW_SEND_TITLE, { count: sendCount })}
						</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_EW_SEND_BODY}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={busy}
							onClick={() => void handleConfirmSend()}
						>
							{busy && <Loader2 className="h-4 w-4 animate-spin" />}
							Send
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{MESSAGES.CONFIRM_EW_DELETE_LEAD_TITLE}</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_EW_DELETE_LEAD_BODY}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
						<Button disabled={busy} variant="outline" onClick={() => void handleConfirmDelete()}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" />}
							Delete
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);

	return {
		dialogs,
		handleAction,
		openDetail: setDetailId,
		openFollowUp: setFollowUp,
		openNewLead: () => setLeadDialog({ editing: null }),
		sendMany: setSendRows,
	};
};
