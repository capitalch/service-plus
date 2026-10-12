import { LockIcon } from "lucide-react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearBillingNotice, selectBillingNotice } from "@/store/context-slice";
import type { BillingNoticeType } from "@/store/context-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const NOTICE_TITLES: Record<BillingNoticeType["code"], string> = {
	BRANCH_LIMIT_REACHED: "Branch limit reached",
	JOB_LIMIT_REACHED: "Monthly job limit reached",
	SUBSCRIPTION_READ_ONLY: "View-only",
};

/** Shown when the server refused a write for billing (view-only, branch or job limit) — not a toast. */
export const ReadOnlyDialog = () => {
	const dispatch = useAppDispatch();
	const notice = useAppSelector(selectBillingNotice);

	return (
		<AlertDialog open={!!notice} onOpenChange={(open) => !open && dispatch(clearBillingNotice())}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<LockIcon className="h-4 w-4 text-amber-600" />
						{notice ? NOTICE_TITLES[notice.code] : null}
					</AlertDialogTitle>
					<AlertDialogDescription>{notice?.message}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogAction onClick={() => dispatch(clearBillingNotice())}>OK</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
