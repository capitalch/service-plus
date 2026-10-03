import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2Icon, MoreHorizontalIcon, RefreshCwIcon, WalletIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnquiriesGrid } from "@/components/shared/enquiries/enquiries-grid";
import { EnquiryNoteDialog } from "@/components/shared/enquiries/enquiry-note-dialog";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { RecordPaymentDialog } from "@/components/shared/enquiries/record-payment-dialog";
import type { EnquiryPaymentInputType, LtEnquiryType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ApproveEnquiryDialog } from "@/features/admin/components/approve-enquiry-dialog";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import { useAppSelector } from "@/store/hooks";

const ALL = "all";

const STATUS_OPTIONS = [
	{ label: "All statuses", value: ALL },
	{ label: "Approved", value: "approved" },
	{ label: "Pending", value: "pending" },
	{ label: "Rejected", value: "rejected" },
];

const PLAN_OPTIONS = [
	{ label: "All plans", value: ALL },
	{ label: "Basic", value: "basic" },
	{ label: "Lite", value: "lite" },
	{ label: "Standard", value: "standard" },
];

const PAYMENT_OPTIONS = [
	{ label: "All payments", value: ALL },
	{ label: "Failed", value: "failed" },
	{ label: "Not required", value: "not_required" },
	{ label: "Pending", value: "pending" },
	{ label: "Received", value: "received" },
];

function isPaid(row: LtEnquiryType): boolean {
	return row.payment_status === "received" || row.payment_status === "not_required";
}

type FilterSelectPropsType = {
	onChange: (value: string) => void;
	options: { label: string; value: string }[];
	value: string;
};

const FilterSelect = ({ onChange, options, value }: FilterSelectPropsType) => (
	<Select value={value} onValueChange={onChange}>
		<SelectTrigger className="h-8 w-full bg-white text-sm sm:w-40">
			<SelectValue />
		</SelectTrigger>
		<SelectContent>
			{options.map((o) => (
				<SelectItem key={o.value} value={o.value}>
					{o.label}
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);

/** Admin → Enquiries: Lite / Basic / Standard sign-ups of the default customer database. */
export const EnquiriesPage = () => {
	const dbName = useAppSelector(selectDbName);
	const [approveRow, setApproveRow] = useState<LtEnquiryType | null>(null);
	const [failRow, setFailRow] = useState<LtEnquiryType | null>(null);
	const [payRow, setPayRow] = useState<LtEnquiryType | null>(null);
	const [paymentFilter, setPaymentFilter] = useState(ALL);
	const [planFilter, setPlanFilter] = useState(ALL);
	const [rejectRow, setRejectRow] = useState<LtEnquiryType | null>(null);
	const [statusFilter, setStatusFilter] = useState("pending");

	const query = useGenericQuery<LtEnquiryType>({
		schema: "security",
		sqlArgs: {
			payment_status: paymentFilter === ALL ? null : paymentFilter,
			plan_code: planFilter === ALL ? null : planFilter,
			status: statusFilter === ALL ? null : statusFilter,
		},
		sqlId: SQL_MAP.GET_SALES_ENQUIRIES,
	});

	async function act(field: string, payload: Record<string, unknown>, success: string): Promise<boolean> {
		if (!dbName) return false;
		try {
			await runEnquiryMutation(GRAPHQL_MAP[field as keyof typeof GRAPHQL_MAP], field, dbName, payload);
			toast.success(success);
			query.refetch();
			return true;
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ENQUIRY_SAVE_FAILED));
			return false;
		}
	}

	async function handleRecordPayment(payment: EnquiryPaymentInputType) {
		if (
			payRow &&
			(await act("recordSalesEnquiryPayment", { ...payment, id: payRow.id }, MESSAGES.ENQUIRY_PAYMENT_RECORDED))
		)
			setPayRow(null);
	}

	async function handlePaymentFailed(note: string) {
		if (
			failRow &&
			(await act(
				"markSalesEnquiryPaymentFailed",
				{ id: failRow.id, note },
				MESSAGES.ENQUIRY_PAYMENT_FAILED_SAVED,
			))
		)
			setFailRow(null);
	}

	async function handleReject(reason: string) {
		if (rejectRow && (await act("rejectSalesEnquiry", { id: rejectRow.id, reason }, MESSAGES.ENQUIRY_REJECTED)))
			setRejectRow(null);
	}

	function renderActions(row: LtEnquiryType) {
		if (row.status === "approved")
			return row.login_email_sent ? (
				<span className="text-xs text-slate-400">—</span>
			) : (
				<span className="text-xs font-medium text-amber-700" title="Resend it from Business Users">
					{MESSAGES.ENQUIRY_LOGIN_EMAIL_NOT_SENT}
				</span>
			);
		if (row.status !== "pending") return <span className="text-xs text-slate-400">—</span>;

		const paid = isPaid(row);
		const needsPayment = row.plan_code !== "lite" && !paid;
		return (
			<div className="flex items-center gap-1.5">
				<Button
					className="h-7 bg-teal-600 px-2.5 text-xs text-white hover:bg-teal-700"
					disabled={!paid}
					size="sm"
					title={paid ? undefined : MESSAGES.ENQUIRY_SETUP_NOT_RECEIVED}
					onClick={() => setApproveRow(row)}
				>
					<CheckCircle2Icon className="mr-1 h-3.5 w-3.5" />
					{row.bu_id ? "Resume" : "Create BU & Manager"}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="h-7 w-7 text-slate-500" size="icon" variant="ghost">
							<MoreHorizontalIcon className="h-4 w-4" />
							<span className="sr-only">More actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						{needsPayment && (
							<>
								<DropdownMenuItem className="cursor-pointer" onClick={() => setPayRow(row)}>
									<WalletIcon className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
									Record payment
								</DropdownMenuItem>
								<DropdownMenuItem className="cursor-pointer" onClick={() => setFailRow(row)}>
									<WalletIcon className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
									Mark payment failed
								</DropdownMenuItem>
								<DropdownMenuSeparator />
							</>
						)}
						<DropdownMenuItem
							className="cursor-pointer"
							disabled={!!row.bu_id}
							onClick={() => setRejectRow(row)}
						>
							<XCircleIcon className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
							Reject
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		);
	}

	return (
		<AdminLayout>
			<motion.div
				animate={{ opacity: 1 }}
				className="flex flex-col gap-5"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-slate-900">Enquiries</h1>
						<p className="mt-1 text-sm text-slate-500">
							Lite, Basic and Standard sign-ups from the portal.
						</p>
					</div>
					<Button
						className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
						disabled={query.loading}
						size="sm"
						variant="outline"
						onClick={query.refetch}
					>
						<RefreshCwIcon className="h-3.5 w-3.5 text-blue-600" />
						Refresh
					</Button>
				</div>

				<div className="flex flex-col gap-2 sm:flex-row">
					<FilterSelect options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
					<FilterSelect options={PLAN_OPTIONS} value={planFilter} onChange={setPlanFilter} />
					<FilterSelect options={PAYMENT_OPTIONS} value={paymentFilter} onChange={setPaymentFilter} />
				</div>

				{query.error ? (
					<p className="text-sm text-red-500">{MESSAGES.ENQUIRY_LOAD_FAILED}</p>
				) : (
					<EnquiriesGrid
						loading={query.loading}
						renderActions={renderActions}
						renderBusinessExtra={(row) => (
							<p className="mt-1 font-mono text-[11px] text-slate-400">
								{row.bu_name} · {row.bu_code}
								{row.username ? ` · ${row.username}` : ""}
							</p>
						)}
						rows={query.data}
					/>
				)}
			</motion.div>

			<ApproveEnquiryDialog
				enquiry={approveRow}
				onOpenChange={(open) => !open && setApproveRow(null)}
				onSuccess={query.refetch}
			/>
			<RecordPaymentDialog
				businessName={payRow?.business_name ?? ""}
				open={!!payRow}
				reference={payRow?.reference ?? null}
				setupFeePaise={payRow?.setup_fee_paise ?? 0}
				onOpenChange={(open) => !open && setPayRow(null)}
				onSave={handleRecordPayment}
			/>
			<EnquiryNoteDialog
				confirmLabel="Mark failed"
				intro={MESSAGES.ENQUIRY_PAYMENT_FAILED_INTRO}
				label="Note"
				open={!!failRow}
				requiredMessage={MESSAGES.ENQUIRY_NOTE_REQUIRED}
				title="Mark setup payment failed"
				onOpenChange={(open) => !open && setFailRow(null)}
				onSave={handlePaymentFailed}
			/>
			<EnquiryNoteDialog
				confirmLabel="Reject"
				intro={`${rejectRow?.business_name ?? ""} · ${rejectRow?.reference ?? ""}`}
				label="Reason"
				open={!!rejectRow}
				requiredMessage={MESSAGES.ENQUIRY_REASON_REQUIRED}
				title="Reject request"
				warning={rejectRow?.payment_status === "received" ? MESSAGES.ENQUIRY_REJECT_PAID_WARNING : null}
				onOpenChange={(open) => !open && setRejectRow(null)}
				onSave={handleReject}
			/>
		</AdminLayout>
	);
};
