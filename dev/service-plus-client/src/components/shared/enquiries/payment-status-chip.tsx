import { Badge } from "@/components/ui/badge";
import type { EnquiryPaymentStatusType } from "./enquiry-types";

const STYLES: Record<EnquiryPaymentStatusType, { className: string; label: string }> = {
	failed: { className: "border-amber-200 bg-amber-50 text-amber-700", label: "Failed" },
	not_required: { className: "border-slate-200 bg-slate-50 text-slate-500", label: "Not required" },
	pending: { className: "border-sky-200 bg-sky-50 text-sky-700", label: "Pending" },
	received: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: "Received" },
};

/** The setup-payment state of a sign-up enquiry. */
export const PaymentStatusChip = ({ status }: { status: EnquiryPaymentStatusType }) => {
	const style = STYLES[status] ?? STYLES.pending;
	return (
		<Badge className={style.className} variant="outline">
			{style.label}
		</Badge>
	);
};
