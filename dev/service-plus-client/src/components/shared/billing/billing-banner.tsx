import { AlertTriangleIcon, LockIcon } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { selectBilling } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

function formatDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(`${iso}T00:00:00`);
	return Number.isNaN(d.getTime())
		? iso
		: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Under the top nav: amber in the last days before the paid period ends, error style once view-only. */
export const BillingBanner = () => {
	const billing = useAppSelector(selectBilling);
	if (!billing || (billing.status !== "due_soon" && billing.status !== "read_only")) return null;

	if (billing.status === "due_soon")
		return (
			<div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
				<AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
				{MESSAGES.BILLING_DUE_SOON.replace("{date}", formatDate(billing.paidThrough))}
			</div>
		);

	return (
		<div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-1.5 text-xs text-red-700">
			<LockIcon className="h-3.5 w-3.5 shrink-0" />
			{billing.paidThrough ? MESSAGES.BILLING_READ_ONLY : MESSAGES.BILLING_READ_ONLY_FIRST}
		</div>
	);
};
