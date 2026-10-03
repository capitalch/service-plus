import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlusIcon, HistoryIcon, IndianRupeeIcon, Loader2, PauseIcon, PlayIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMonths, displayDate, inr, todayIso } from "@/components/shared/billing/billing-dates";
import { BillingStatusChip } from "@/components/shared/billing/billing-status-chip";
import type { BuSubscriptionType } from "@/components/shared/billing/billing-types";
import { PaymentHistoryDialog } from "@/features/admin/components/payment-history-dialog";
import { RecordSubscriptionPaymentDialog } from "@/components/shared/billing/record-subscription-payment-dialog";
import type { SubscriptionPaymentInputType } from "@/components/shared/billing/record-subscription-payment-dialog";
import { EnquiryFieldError } from "@/components/shared/enquiries/enquiry-field-error";
import { EnquiryNoteDialog } from "@/components/shared/enquiries/enquiry-note-dialog";
import { enquiryErrorMessage, runEnquiryMutation } from "@/components/shared/enquiries/enquiry-mutation";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { useGenericQuery } from "@/features/client/components/reports/common/use-generic-query";
import type { ClientType } from "@/features/super-admin/types";

type ClientSubscriptionDialogPropsType = {
	client: ClientType;
	onOpenChange: (open: boolean) => void;
};

type PanelType = "extend" | "fee" | "history" | "hold" | "pay" | "start" | null;

type FeeResultType = {
	monthly_fee_paise: number;
	paid_through_after: string | null;
	paid_through_before: string | null;
};

const thClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

// ─── Small forms ──────────────────────────────────────────────────────────────

type AmountDateFormType = { date: string; fee: number; note: string };

type AmountDateDialogPropsType = {
	confirmLabel: string;
	needsDate: boolean;
	needsFee: boolean;
	needsNote: boolean;
	onClose: () => void;
	onPreview?: (fee: number) => Promise<FeeResultType | null>;
	onSave: (values: AmountDateFormType) => Promise<boolean>;
	title: string;
};

/** Start billing (fee + paid-through), set fee (fee, with a rebase preview) or extend (date + note). */
const AmountDateDialog = ({
	confirmLabel,
	needsDate,
	needsFee,
	needsNote,
	onClose,
	onPreview,
	onSave,
	title,
}: AmountDateDialogPropsType) => {
	const [preview, setPreview] = useState<FeeResultType | null>(null);
	const schema = z.object({
		date: needsDate
			? z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.BILLING_CAP_EXCEEDED)
					.refine((v) => v >= todayIso() && v <= addMonths(todayIso(), 60), MESSAGES.BILLING_CAP_EXCEEDED)
			: z.string(),
		fee: needsFee
			? z.number({ error: MESSAGES.ENQUIRY_FEE_INVALID }).positive(MESSAGES.ENQUIRY_FEE_INVALID)
			: z.number(),
		note: needsNote ? z.string().trim().min(1, MESSAGES.ENQUIRY_NOTE_REQUIRED) : z.string(),
	});
	const form = useForm<AmountDateFormType>({
		defaultValues: { date: todayIso(), fee: 0, note: "" },
		mode: "onChange",
		resolver: zodResolver(schema),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	async function submit(values: AmountDateFormType) {
		if (await onSave(values)) onClose();
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">{title}</DialogTitle>
				</DialogHeader>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
					{needsFee && (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="cs_fee">
								Monthly fee (₹) <span className="text-red-500">*</span>
							</Label>
							<Input
								id="cs_fee"
								type="number"
								{...form.register("fee", {
									onBlur: async () => {
										const fee = form.getValues("fee");
										if (onPreview && fee > 0) setPreview(await onPreview(fee));
									},
									valueAsNumber: true,
								})}
							/>
							<EnquiryFieldError message={errors.fee?.message} />
							{preview && preview.paid_through_after !== preview.paid_through_before && (
								<p className="text-xs font-medium text-amber-700">
									Client fee {inr(preview.monthly_fee_paise)}; prepaid period now ends{" "}
									{displayDate(preview.paid_through_after)} (was{" "}
									{displayDate(preview.paid_through_before)}).
								</p>
							)}
						</div>
					)}
					{needsDate && (
						<div className="flex flex-col gap-1.5">
							<Label>
								Paid through <span className="text-red-500">*</span>
							</Label>
							<Controller
								control={form.control}
								name="date"
								render={({ field }) => (
									<LocaleDateInput value={field.value} onChange={field.onChange} />
								)}
							/>
							<EnquiryFieldError message={errors.date?.message} />
						</div>
					)}
					{needsNote && (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="cs_note">
								Note <span className="text-red-500">*</span>
							</Label>
							<Input id="cs_note" {...form.register("note")} />
							<EnquiryFieldError message={errors.note?.message} />
						</div>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={isSubmitting || !isValid}
							type="submit"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
							{confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

// ─── Panel ────────────────────────────────────────────────────────────────────

/** Super Admin → Clients → Subscription: an Enterprise client's BUs and billing controls. */
export const ClientSubscriptionDialog = ({ client, onOpenChange }: ClientSubscriptionDialogPropsType) => {
	const dbName = client.db_name ?? "";
	const [panel, setPanel] = useState<PanelType>(null);
	const query = useGenericQuery<BuSubscriptionType>({
		dbName,
		enabled: !!client.db_name,
		schema: "security",
		sqlId: SQL_MAP.GET_BU_SUBSCRIPTIONS,
	});
	const billed = query.data.filter((b) => b.billing_required);
	const totalFee = billed.reduce((sum, b) => sum + (b.monthly_fee_paise ?? 0), 0);
	const dates = billed.map((b) => b.paid_through);
	const earliest = dates.some((d) => !d) ? null : (dates.filter(Boolean).sort()[0] ?? null);
	const onHold = billed.some((b) => b.billing_hold);

	async function run(field: string, payload: Record<string, unknown>, success: string): Promise<boolean> {
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

	async function previewFee(fee: number): Promise<FeeResultType | null> {
		try {
			return await runEnquiryMutation<FeeResultType>(
				GRAPHQL_MAP.setClientMonthlyFee,
				"setClientMonthlyFee",
				dbName,
				{
					monthly_fee: fee,
					preview: true,
				},
			);
		} catch {
			return null;
		}
	}

	const close = () => setPanel(null);

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Subscription — {client.name}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{client.db_name} ·{" "}
					{billed.length
						? `${inr(totalFee)} a month · paid through ${displayDate(earliest)}`
						: MESSAGES.BILLING_NOT_STARTED}
				</p>

				<div className="flex flex-wrap gap-1.5">
					{billed.length === 0 ? (
						<Button
							className="h-8 bg-teal-600 text-white hover:bg-teal-700"
							size="sm"
							onClick={() => setPanel("start")}
						>
							<PlayIcon className="mr-1 h-3.5 w-3.5" />
							Start billing
						</Button>
					) : (
						<>
							<Button
								className="h-8 bg-teal-600 text-white hover:bg-teal-700"
								size="sm"
								onClick={() => setPanel("pay")}
							>
								<WalletIcon className="mr-1 h-3.5 w-3.5" />
								Record payment
							</Button>
							<Button className="h-8" size="sm" variant="outline" onClick={() => setPanel("fee")}>
								<IndianRupeeIcon className="mr-1 h-3.5 w-3.5 text-teal-600" />
								Set fee
							</Button>
							<Button className="h-8" size="sm" variant="outline" onClick={() => setPanel("extend")}>
								<CalendarPlusIcon className="mr-1 h-3.5 w-3.5 text-indigo-600" />
								Extend
							</Button>
							<Button className="h-8" size="sm" variant="outline" onClick={() => setPanel("hold")}>
								<PauseIcon className="mr-1 h-3.5 w-3.5 text-amber-600" />
								{onHold ? "Release hold" : "Hold"}
							</Button>
						</>
					)}
					<Button className="h-8" size="sm" variant="outline" onClick={() => setPanel("history")}>
						<HistoryIcon className="mr-1 h-3.5 w-3.5 text-slate-500" />
						History
					</Button>
				</div>

				<div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
					<Table>
						<TableHeader>
							<TableRow className="bg-slate-50 hover:bg-slate-50">
								<TableHead className={thClass}>Business unit</TableHead>
								<TableHead className={`${thClass} text-right`}>Monthly fee</TableHead>
								<TableHead className={thClass}>Paid through</TableHead>
								<TableHead className={thClass}>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.map((bu) => (
								<TableRow key={bu.id}>
									<TableCell>
										<p className="font-medium text-slate-800">{bu.name}</p>
										<p className="font-mono text-[11px] text-slate-400">{bu.code}</p>
									</TableCell>
									<TableCell className="text-right text-sm">
										{bu.billing_required ? inr(bu.monthly_fee_paise) : "—"}
									</TableCell>
									<TableCell className="text-sm">{displayDate(bu.paid_through)}</TableCell>
									<TableCell>
										<BillingStatusChip row={bu} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>

				{panel === "pay" && (
					<RecordSubscriptionPaymentDialog
						feePaise={totalFee}
						open
						paidThrough={earliest}
						title={client.name}
						onOpenChange={(open) => !open && close()}
						onSave={(payment: SubscriptionPaymentInputType) =>
							run("recordClientSubscriptionPayment", payment, MESSAGES.BILLING_PAYMENT_RECORDED)
						}
					/>
				)}
				{panel === "start" && (
					<AmountDateDialog
						confirmLabel="Start billing"
						needsDate
						needsFee
						needsNote={false}
						title="Start billing"
						onClose={close}
						onSave={(v) =>
							run(
								"startClientBilling",
								{ client_id: client.id, monthly_fee: v.fee, paid_through: v.date },
								MESSAGES.BILLING_STARTED,
							)
						}
					/>
				)}
				{panel === "fee" && (
					<AmountDateDialog
						confirmLabel="Save fee"
						needsDate={false}
						needsFee
						needsNote={false}
						title="Set monthly fee"
						onClose={close}
						onPreview={previewFee}
						onSave={(v) => run("setClientMonthlyFee", { monthly_fee: v.fee }, MESSAGES.BILLING_FEE_SAVED)}
					/>
				)}
				{panel === "extend" && (
					<AmountDateDialog
						confirmLabel="Extend"
						needsDate
						needsFee={false}
						needsNote
						title="Extend paid-through"
						onClose={close}
						onSave={(v) =>
							run(
								"extendClientPaidThrough",
								{ note: v.note, paid_through: v.date },
								MESSAGES.BILLING_PAID_THROUGH_SAVED,
							)
						}
					/>
				)}
				<EnquiryNoteDialog
					confirmLabel={onHold ? "Release hold" : "Put on hold"}
					intro={client.name}
					label="Note"
					open={panel === "hold"}
					requiredMessage={MESSAGES.ENQUIRY_NOTE_REQUIRED}
					title={onHold ? "Release billing hold" : "Put billing on hold"}
					onOpenChange={(open) => !open && close()}
					onSave={async (note) => {
						if (await run("setClientBillingHold", { hold: !onHold, note }, MESSAGES.BILLING_HOLD_SAVED))
							close();
					}}
				/>
				{panel === "history" && (
					<PaymentHistoryDialog
						buId={null}
						dbName={dbName}
						title={client.name}
						onOpenChange={(open) => !open && close()}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
};
