import { Badge } from "@/components/ui/badge";
import type { BuSubscriptionType } from "./billing-types";

const STYLES: Record<BuSubscriptionType["status"], { className: string; label: string }> = {
	active: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Active" },
	due_soon: { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Due soon" },
	not_billed: { className: "border-slate-200 bg-slate-50 text-slate-500", label: "Not billed" },
	read_only: { className: "border-red-200 bg-red-50 text-red-700", label: "View-only" },
};

/** A BU's billing status; "Awaiting first payment" when a billed BU was never paid. */
export const BillingStatusChip = ({ row }: { row: BuSubscriptionType }) => {
	const style = STYLES[row.status] ?? STYLES.not_billed;
	return (
		<Badge className={style.className} variant="outline">
			{row.awaiting_first_payment ? "Awaiting first payment" : row.billing_hold ? "On hold" : style.label}
		</Badge>
	);
};
