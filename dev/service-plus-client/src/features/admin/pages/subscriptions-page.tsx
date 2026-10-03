import { useState } from "react";
import { motion } from "framer-motion";
import { HistoryIcon, RefreshCwIcon, RepeatIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayDate, inr } from "@/components/shared/billing/billing-dates";
import { BillingStatusChip } from "@/components/shared/billing/billing-status-chip";
import type { BuSubscriptionType } from "@/components/shared/billing/billing-types";
import { PaymentHistoryDialog } from "@/features/admin/components/payment-history-dialog";
import { RecordSubscriptionPaymentDialog } from "@/components/shared/billing/record-subscription-payment-dialog";
import type { SubscriptionPaymentInputType } from "@/components/shared/billing/record-subscription-payment-dialog";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { PLAN_NAMES } from "@/components/shared/enquiries/enquiry-types";
import type { EnquiryPlanCodeType } from "@/components/shared/enquiries/enquiry-types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { AdminLayout } from "@/features/admin/components/admin-layout";
import { ChangePlanDialog } from "@/features/admin/components/change-plan-dialog";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import { useAppSelector } from "@/store/hooks";

const thClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const LT_PLANS = ["basic", "lite", "standard"];

/** Admin → Subscriptions (default customer database): every BU's plan, fee and paid period. */
export const SubscriptionsPage = () => {
	const dbName = useAppSelector(selectDbName);
	const [historyBu, setHistoryBu] = useState<BuSubscriptionType | null>(null);
	const [payBu, setPayBu] = useState<BuSubscriptionType | null>(null);
	const [planBu, setPlanBu] = useState<BuSubscriptionType | null>(null);

	const query = useGenericQuery<BuSubscriptionType>({ schema: "security", sqlId: SQL_MAP.GET_BU_SUBSCRIPTIONS });

	async function recordPayment(payment: SubscriptionPaymentInputType): Promise<boolean> {
		if (!dbName || !payBu) return false;
		try {
			await runEnquiryMutation(GRAPHQL_MAP.recordBuSubscriptionPayment, "recordBuSubscriptionPayment", dbName, {
				...payment,
				bu_id: payBu.id,
			});
			toast.success(MESSAGES.BILLING_PAYMENT_RECORDED);
			query.refetch();
			return true;
		} catch (error) {
			toast.error(enquiryErrorMessage(error, MESSAGES.ENQUIRY_SAVE_FAILED));
			return false;
		}
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
						<h1 className="text-xl font-bold text-slate-900">Subscriptions</h1>
						<p className="mt-1 text-sm text-slate-500">
							Plans, monthly fees and paid periods of every customer.
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

				{query.error ? (
					<p className="text-sm text-red-500">{MESSAGES.BILLING_LOAD_FAILED}</p>
				) : (
					<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-slate-50 hover:bg-slate-50">
										<TableHead className={thClass}>Business unit</TableHead>
										<TableHead className={thClass}>Plan</TableHead>
										<TableHead className={`${thClass} text-right`}>Monthly fee</TableHead>
										<TableHead className={thClass}>Paid through</TableHead>
										<TableHead className={thClass}>Status</TableHead>
										<TableHead className={thClass}>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{query.data.map((bu) => (
										<TableRow key={bu.id}>
											<TableCell>
												<p className="font-medium text-slate-800">{bu.name}</p>
												<p className="font-mono text-[11px] text-slate-400">{bu.code}</p>
											</TableCell>
											<TableCell className="text-sm">
												{bu.plan_code
													? (PLAN_NAMES[bu.plan_code as EnquiryPlanCodeType] ?? bu.plan_code)
													: "—"}
											</TableCell>
											<TableCell className="text-right text-sm">
												{bu.billing_required ? inr(bu.monthly_fee_paise) : "—"}
											</TableCell>
											<TableCell className="text-sm">{displayDate(bu.paid_through)}</TableCell>
											<TableCell>
												<BillingStatusChip row={bu} />
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1.5">
													<Button
														className="h-7 bg-teal-600 px-2.5 text-xs text-white hover:bg-teal-700"
														disabled={!bu.billing_required}
														size="sm"
														onClick={() => setPayBu(bu)}
													>
														<WalletIcon className="mr-1 h-3.5 w-3.5" />
														Record payment
													</Button>
													<Button
														className="h-7 px-2.5 text-xs"
														size="sm"
														variant="outline"
														onClick={() => setHistoryBu(bu)}
													>
														<HistoryIcon className="mr-1 h-3.5 w-3.5 text-slate-500" />
														History
													</Button>
													<Button
														className="h-7 px-2.5 text-xs"
														disabled={!bu.plan_code || !LT_PLANS.includes(bu.plan_code)}
														size="sm"
														variant="outline"
														onClick={() => setPlanBu(bu)}
													>
														<RepeatIcon className="mr-1 h-3.5 w-3.5 text-indigo-600" />
														Change plan
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</motion.div>

			{payBu && (
				<RecordSubscriptionPaymentDialog
					feePaise={payBu.monthly_fee_paise ?? 0}
					key={payBu.id}
					open
					paidThrough={payBu.paid_through}
					title={payBu.name}
					onOpenChange={(open) => !open && setPayBu(null)}
					onSave={recordPayment}
				/>
			)}
			{historyBu && dbName && (
				<PaymentHistoryDialog
					buId={historyBu.id}
					dbName={dbName}
					title={historyBu.name}
					onOpenChange={(open) => !open && setHistoryBu(null)}
				/>
			)}
			{planBu && dbName && (
				<ChangePlanDialog
					bu={planBu}
					dbName={dbName}
					onOpenChange={(open) => !open && setPlanBu(null)}
					onSuccess={query.refetch}
				/>
			)}
		</AdminLayout>
	);
};
