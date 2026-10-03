import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MESSAGES } from "@/constants/messages";
import { PaymentStatusChip } from "./payment-status-chip";
import { PLAN_NAMES, rupees } from "./enquiry-types";
import type { EnquiryRowType } from "./enquiry-types";

type EnquiriesGridPropsType<T extends EnquiryRowType> = {
	loading: boolean;
	/** Extra lines under the business name (the BU code, a client, a warning). */
	renderBusinessExtra?: (row: T) => ReactNode;
	renderActions: (row: T) => ReactNode;
	rows: T[];
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

const STATUS_STYLES: Record<string, string> = {
	approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
	contacted: "border-indigo-200 bg-indigo-50 text-indigo-700",
	converted: "border-emerald-200 bg-emerald-50 text-emerald-700",
	new: "border-sky-200 bg-sky-50 text-sky-700",
	pending: "border-sky-200 bg-sky-50 text-sky-700",
	rejected: "border-slate-200 bg-slate-100 text-slate-500",
};

function formatDate(value: string): string {
	const d = new Date(value);
	return Number.isNaN(d.getTime())
		? value
		: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** The enquiries table shared by Admin → Enquiries (lt) and Super Admin → Enquiries (Enterprise). */
export const EnquiriesGrid = <T extends EnquiryRowType>({
	loading,
	renderActions,
	renderBusinessExtra,
	rows,
}: EnquiriesGridPropsType<T>) => {
	if (loading && rows.length === 0)
		return (
			<div className="flex flex-col gap-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<div className="h-12 animate-pulse rounded-lg bg-slate-100" key={i} />
				))}
			</div>
		);

	if (rows.length === 0)
		return (
			<div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
				{MESSAGES.ENQUIRY_NONE}
			</div>
		);

	return (
		<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="bg-slate-50 hover:bg-slate-50">
							<TableHead className={thClass}>Date</TableHead>
							<TableHead className={thClass}>Reference</TableHead>
							<TableHead className={thClass}>Business</TableHead>
							<TableHead className={thClass}>Contact</TableHead>
							<TableHead className={thClass}>Plan</TableHead>
							<TableHead className={`${thClass} text-right`}>Setup fee</TableHead>
							<TableHead className={thClass}>Payment</TableHead>
							<TableHead className={thClass}>Status</TableHead>
							<TableHead className={thClass}>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow className="align-top" key={row.id}>
								<TableCell className="whitespace-nowrap text-xs text-slate-500">
									{formatDate(row.created_at)}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
									{row.reference ?? "—"}
								</TableCell>
								<TableCell className="min-w-44">
									<p className="font-medium text-slate-800">{row.business_name}</p>
									<p className="text-xs text-slate-500">{row.city}</p>
									{renderBusinessExtra?.(row)}
								</TableCell>
								<TableCell className="min-w-44 text-xs text-slate-600">
									<p className="font-medium text-slate-700">{row.name}</p>
									<p>{row.mobile}</p>
									<p className="break-all">{row.email}</p>
								</TableCell>
								<TableCell className="text-sm text-slate-700">{PLAN_NAMES[row.plan_code]}</TableCell>
								<TableCell className="whitespace-nowrap text-right text-sm text-slate-700">
									{row.setup_fee_paise ? rupees(row.setup_fee_paise) : "—"}
								</TableCell>
								<TableCell>
									<PaymentStatusChip status={row.payment_status} />
									{row.payment_status === "failed" && row.payment_note && (
										<p className="mt-1 max-w-40 text-xs text-slate-500">{row.payment_note}</p>
									)}
								</TableCell>
								<TableCell>
									<Badge
										className={STATUS_STYLES[row.status] ?? STATUS_STYLES.pending}
										variant="outline"
									>
										{row.status}
									</Badge>
									{row.status === "rejected" && row.rejection_reason && (
										<p className="mt-1 max-w-40 text-xs text-slate-500">{row.rejection_reason}</p>
									)}
								</TableCell>
								<TableCell>{renderActions(row)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};
