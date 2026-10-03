import { useState } from "react";
import { motion } from "framer-motion";
import {
	BuildingIcon,
	IndianRupeeIcon,
	MoreHorizontalIcon,
	PhoneCallIcon,
	RefreshCwIcon,
	WalletIcon,
	XCircleIcon,
} from "lucide-react";
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
import type { EntEnquiryType, EnquiryPaymentInputType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import { ProvisionEnquiryDialog } from "../components/provision-enquiry-dialog";
import { SetEnquiryFeeDialog } from "../components/set-enquiry-fee-dialog";
import { SuperAdminLayout } from "../components/super-admin-layout";

const ALL = "all";
const OPEN_STATUSES = ["contacted", "new"];

const STATUS_OPTIONS = [
	{ label: "All statuses", value: ALL },
	{ label: "Contacted", value: "contacted" },
	{ label: "Converted", value: "converted" },
	{ label: "New", value: "new" },
	{ label: "Rejected", value: "rejected" },
];

const PAYMENT_OPTIONS = [
	{ label: "All payments", value: ALL },
	{ label: "Failed", value: "failed" },
	{ label: "Pending", value: "pending" },
	{ label: "Received", value: "received" },
];

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

/** Super Admin → Enquiries: Enterprise enquiries from the portal (control plane). */
export const EnterpriseEnquiriesPage = () => {
	const [failRow, setFailRow] = useState<EntEnquiryType | null>(null);
	const [feeRow, setFeeRow] = useState<EntEnquiryType | null>(null);
	const [payRow, setPayRow] = useState<EntEnquiryType | null>(null);
	const [paymentFilter, setPaymentFilter] = useState(ALL);
	const [provisionRow, setProvisionRow] = useState<EntEnquiryType | null>(null);
	const [rejectRow, setRejectRow] = useState<EntEnquiryType | null>(null);
	const [statusFilter, setStatusFilter] = useState("new");

	const query = useGenericQuery<EntEnquiryType>({
		dbName: "",
		schema: "public",
		sqlArgs: {
			payment_status: paymentFilter === ALL ? null : paymentFilter,
			status: statusFilter === ALL ? null : statusFilter,
		},
		sqlId: SQL_MAP.GET_ENTERPRISE_ENQUIRIES,
	});

	async function act(field: string, payload: Record<string, unknown>, success: string): Promise<boolean> {
		try {
			await runEnquiryMutation(GRAPHQL_MAP[field as keyof typeof GRAPHQL_MAP], field, "", payload);
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
			(await act(
				"recordEnterpriseEnquiryPayment",
				{ ...payment, id: payRow.id },
				MESSAGES.ENQUIRY_PAYMENT_RECORDED,
			))
		)
			setPayRow(null);
	}

	async function handlePaymentFailed(note: string) {
		if (
			failRow &&
			(await act(
				"markEnterpriseEnquiryPaymentFailed",
				{ id: failRow.id, note },
				MESSAGES.ENQUIRY_PAYMENT_FAILED_SAVED,
			))
		)
			setFailRow(null);
	}

	async function handleSetFee(setupFee: number) {
		if (
			feeRow &&
			(await act("setEnterpriseEnquiryFee", { id: feeRow.id, setup_fee: setupFee }, MESSAGES.ENQUIRY_FEE_SAVED))
		)
			setFeeRow(null);
	}

	async function handleReject(reason: string) {
		if (
			rejectRow &&
			(await act("rejectEnterpriseEnquiry", { id: rejectRow.id, reason }, MESSAGES.ENQUIRY_REJECTED))
		)
			setRejectRow(null);
	}

	function renderActions(row: EntEnquiryType) {
		if (!OPEN_STATUSES.includes(row.status)) return <span className="text-xs text-slate-400">—</span>;
		const paid = row.payment_status === "received";
		return (
			<div className="flex items-center gap-1.5">
				<Button
					className="h-7 bg-teal-600 px-2.5 text-xs text-white hover:bg-teal-700"
					disabled={!paid}
					size="sm"
					title={paid ? undefined : MESSAGES.ENQUIRY_SETUP_NOT_RECEIVED}
					onClick={() => setProvisionRow(row)}
				>
					<BuildingIcon className="mr-1 h-3.5 w-3.5" />
					{row.client_id ? "Resume" : "Create customer"}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="h-7 w-7 text-slate-500" size="icon" variant="ghost">
							<MoreHorizontalIcon className="h-4 w-4" />
							<span className="sr-only">More actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						{row.status === "new" && (
							<DropdownMenuItem
								className="cursor-pointer"
								onClick={() =>
									act("markEnterpriseEnquiryContacted", { id: row.id }, MESSAGES.ENQUIRY_CONTACTED)
								}
							>
								<PhoneCallIcon className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
								Mark contacted
							</DropdownMenuItem>
						)}
						{!paid && (
							<>
								<DropdownMenuItem className="cursor-pointer" onClick={() => setFeeRow(row)}>
									<IndianRupeeIcon className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
									Set setup fee
								</DropdownMenuItem>
								<DropdownMenuItem className="cursor-pointer" onClick={() => setPayRow(row)}>
									<WalletIcon className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
									Record payment
								</DropdownMenuItem>
								<DropdownMenuItem className="cursor-pointer" onClick={() => setFailRow(row)}>
									<WalletIcon className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
									Mark payment failed
								</DropdownMenuItem>
							</>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="cursor-pointer"
							disabled={!!row.client_id}
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
		<SuperAdminLayout>
			<motion.div
				animate={{ opacity: 1 }}
				className="flex flex-col gap-5"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-slate-900">Enquiries</h1>
						<p className="mt-1 text-sm text-slate-500">Enterprise enquiries from the portal.</p>
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
					<FilterSelect options={PAYMENT_OPTIONS} value={paymentFilter} onChange={setPaymentFilter} />
				</div>

				{query.error ? (
					<p className="text-sm text-red-500">{MESSAGES.ENQUIRY_LOAD_FAILED}</p>
				) : (
					<EnquiriesGrid
						loading={query.loading}
						renderActions={renderActions}
						renderBusinessExtra={(row) =>
							row.client_code ? (
								<p className="mt-1 font-mono text-[11px] text-slate-400">
									{row.client_code} · {row.db_name ?? "—"}
								</p>
							) : null
						}
						rows={query.data}
					/>
				)}
			</motion.div>

			<ProvisionEnquiryDialog
				enquiry={provisionRow}
				onOpenChange={(open) => !open && setProvisionRow(null)}
				onSuccess={query.refetch}
			/>
			<SetEnquiryFeeDialog
				enquiry={feeRow}
				onOpenChange={(open) => !open && setFeeRow(null)}
				onSave={handleSetFee}
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
				title="Reject enquiry"
				warning={rejectRow?.payment_status === "received" ? MESSAGES.ENQUIRY_REJECT_PAID_WARNING : null}
				onOpenChange={(open) => !open && setRejectRow(null)}
				onSave={handleReject}
			/>
		</SuperAdminLayout>
	);
};
