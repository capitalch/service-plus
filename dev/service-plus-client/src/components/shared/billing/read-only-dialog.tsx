import { LockIcon } from "lucide-react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MESSAGES } from "@/constants/messages";
import { selectDemoPortalUrl } from "@/features/auth/store/auth-slice";
import { clearBillingNotice, selectBillingNotice } from "@/store/context-slice";
import type { BillingNoticeType } from "@/store/context-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const NOTICE_TITLES: Record<BillingNoticeType["code"], string> = {
	BRANCH_LIMIT_REACHED: "Branch limit reached",
	DEMO_READ_ONLY: MESSAGES.DEMO_READ_ONLY_DIALOG_TITLE,
	JOB_LIMIT_REACHED: "Monthly job limit reached",
	SUBSCRIPTION_READ_ONLY: "View-only",
};

/**
 * Shown when the server refused a write for billing (view-only, branch or job limit) or
 * because the BU is the live demo — not a toast. The demo version offers "Start free".
 */
export const ReadOnlyDialog = () => {
	const dispatch = useAppDispatch();
	const notice = useAppSelector(selectBillingNotice);
	const portalUrl = useAppSelector(selectDemoPortalUrl);
	const isDemoNotice = notice?.code === "DEMO_READ_ONLY";

	function handleStartFree() {
		dispatch(clearBillingNotice());
		if (portalUrl) window.open(`${portalUrl}/pricing?plan=lite`, "_blank", "noopener");
	}

	return (
		<AlertDialog open={!!notice} onOpenChange={(open) => !open && dispatch(clearBillingNotice())}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<LockIcon className="h-4 w-4 text-amber-600" />
						{notice ? NOTICE_TITLES[notice.code] : null}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{isDemoNotice ? MESSAGES.DEMO_READ_ONLY_DIALOG_BODY : notice?.message}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					{isDemoNotice && portalUrl ? (
						<>
							<AlertDialogCancel onClick={() => dispatch(clearBillingNotice())}>Close</AlertDialogCancel>
							<AlertDialogAction onClick={handleStartFree}>Start free</AlertDialogAction>
						</>
					) : (
						<AlertDialogAction onClick={() => dispatch(clearBillingNotice())}>OK</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
