import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnquiryFieldError } from "@/components/shared/enquiries/enquiry-field-error";
import { PAYMENT_MODES } from "@/components/shared/enquiries/enquiry-types";
import { MESSAGES } from "@/constants/messages";
import { beyondPrepaidCap, displayDate, inr, periodText, previewPaidThrough, todayIso } from "./billing-dates";

/** What the dialog sends; the server receives months only (years are converted here). */
export type SubscriptionPaymentInputType = {
	amount: number;
	mode: string;
	months: number;
	note: string;
	received_on: string;
	reference: string;
};

type RecordSubscriptionPaymentDialogPropsType = {
	/** Monthly fee in paise: one BU's, or an Enterprise client's total. */
	feePaise: number;
	onOpenChange: (open: boolean) => void;
	onSave: (payment: SubscriptionPaymentInputType) => Promise<boolean>;
	open: boolean;
	/** Current paid-through (the earliest, for a client); null before the first payment. */
	paidThrough: string | null;
	title: string;
};

type FormType = {
	amount: number;
	count: number;
	mode: string;
	note: string;
	received_on: string;
	reference: string;
	unit: "months" | "years";
};

function monthsOf(unit: FormType["unit"], count: number): number {
	return unit === "years" ? count * 12 : count;
}

function buildSchema(feePaise: number, paidThrough: string | null) {
	return z
		.object({
			amount: z.number({ error: MESSAGES.BILLING_AMOUNT_BELOW_DUE }),
			count: z.number().int(),
			mode: z.string().min(1),
			note: z.string(),
			received_on: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.ENQUIRY_PAYMENT_DATE_FUTURE)
				.refine((v) => v <= todayIso(), MESSAGES.ENQUIRY_PAYMENT_DATE_FUTURE),
			reference: z.string().trim().min(1, MESSAGES.ENQUIRY_PAYMENT_REFERENCE_REQUIRED),
			unit: z.enum(["months", "years"]),
		})
		.superRefine((v, ctx) => {
			const max = v.unit === "years" ? 5 : 60;
			if (v.count < 1 || v.count > max) {
				ctx.addIssue({ code: "custom", message: `1 to ${max} ${v.unit}`, path: ["count"] });
				return;
			}
			const months = monthsOf(v.unit, v.count);
			if (beyondPrepaidCap(previewPaidThrough(paidThrough, months)))
				ctx.addIssue({ code: "custom", message: MESSAGES.BILLING_CAP_EXCEEDED, path: ["count"] });
			const due = (feePaise * months) / 100;
			if (v.amount < due)
				ctx.addIssue({ code: "custom", message: MESSAGES.BILLING_AMOUNT_BELOW_DUE, path: ["amount"] });
			if (v.amount > due && !v.note.trim())
				ctx.addIssue({ code: "custom", message: MESSAGES.BILLING_EXTRA_NOTE_REQUIRED, path: ["note"] });
		});
}

/**
 * Record a monthly payment for any number of months or whole years (up to 5 years), at the
 * plain monthly rate — no discount. The amount is prefilled with fee × months and cannot be
 * saved lower; a higher amount needs a note. The new paid-through shown is a preview only.
 */
export const RecordSubscriptionPaymentDialog = ({
	feePaise,
	onOpenChange,
	onSave,
	open,
	paidThrough,
	title,
}: RecordSubscriptionPaymentDialogPropsType) => {
	const defaults: FormType = {
		amount: feePaise / 100,
		count: 1,
		mode: "bank_transfer",
		note: "",
		received_on: todayIso(),
		reference: "",
		unit: "months",
	};
	const form = useForm<FormType>({
		defaultValues: defaults,
		mode: "onChange",
		resolver: zodResolver(buildSchema(feePaise, paidThrough)),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;
	const unit = useWatch({ control: form.control, name: "unit" });
	const count = useWatch({ control: form.control, name: "count" });
	const months = monthsOf(unit, Number.isFinite(count) ? count : 0);
	const duePaise = feePaise * months;
	const newDate = months > 0 ? previewPaidThrough(paidThrough, months) : null;

	useEffect(() => {
		if (open) form.reset(defaults);
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	// Keep the amount on fee × months as the period changes.
	useEffect(() => {
		if (months > 0) form.setValue("amount", duePaise / 100, { shouldValidate: true });
	}, [unit, count]); // eslint-disable-line react-hooks/exhaustive-deps

	async function submit(values: FormType) {
		const saved = await onSave({
			amount: values.amount,
			mode: values.mode,
			months: monthsOf(values.unit, values.count),
			note: values.note.trim(),
			received_on: values.received_on,
			reference: values.reference.trim(),
		});
		if (saved) onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Record payment — {title}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{inr(feePaise)} a month · paid through {displayDate(paidThrough)}
				</p>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
					<div className="flex flex-col gap-1.5">
						<Label>
							Payment period <span className="text-red-500">*</span>
						</Label>
						<div className="flex gap-2">
							<Controller
								control={form.control}
								name="unit"
								render={({ field }) => (
									<div className="inline-flex rounded-md border border-slate-200 p-0.5">
										{(["months", "years"] as const).map((u) => (
											<button
												className={`rounded px-3 py-1 text-sm ${
													field.value === u
														? "bg-teal-600 text-white"
														: "text-slate-600 hover:bg-slate-100"
												}`}
												key={u}
												type="button"
												onClick={() => field.onChange(u)}
											>
												{u === "months" ? "Months" : "Years"}
											</button>
										))}
									</div>
								)}
							/>
							<Input
								className="w-24"
								inputMode="numeric"
								type="number"
								{...form.register("count", { valueAsNumber: true })}
							/>
						</div>
						<EnquiryFieldError message={errors.count?.message} />
						{months > 0 && !errors.count && (
							<p className="text-xs text-slate-600">
								{inr(feePaise)} × {months} months = {inr(duePaise)} · paid through{" "}
								{displayDate(newDate)}
								{unit === "years" ? ` (${periodText(months)})` : ""}
							</p>
						)}
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="sub_amount">
								Amount (₹) <span className="text-red-500">*</span>
							</Label>
							<Input
								id="sub_amount"
								type="number"
								{...form.register("amount", { valueAsNumber: true })}
							/>
							<EnquiryFieldError message={errors.amount?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="sub_mode">
								Mode <span className="text-red-500">*</span>
							</Label>
							<Controller
								control={form.control}
								name="mode"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full" id="sub_mode">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PAYMENT_MODES.map((m) => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="sub_reference">
								Reference <span className="text-red-500">*</span>
							</Label>
							<Input id="sub_reference" placeholder="UTR / UPI ref" {...form.register("reference")} />
							<EnquiryFieldError message={errors.reference?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label>
								Received on <span className="text-red-500">*</span>
							</Label>
							<Controller
								control={form.control}
								name="received_on"
								render={({ field }) => (
									<LocaleDateInput value={field.value} onChange={field.onChange} />
								)}
							/>
							<EnquiryFieldError message={errors.received_on?.message} />
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="sub_note">Note</Label>
						<Input id="sub_note" {...form.register("note")} />
						<EnquiryFieldError message={errors.note?.message} />
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={isSubmitting || !isValid}
							type="submit"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
							Record payment
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
