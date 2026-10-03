import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGES } from "@/constants/messages";
import { EnquiryFieldError } from "./enquiry-field-error";
import { PAYMENT_MODES, rupees } from "./enquiry-types";
import type { EnquiryPaymentInputType } from "./enquiry-types";

type RecordPaymentDialogPropsType = {
	businessName: string;
	onOpenChange: (open: boolean) => void;
	onSave: (payment: EnquiryPaymentInputType) => Promise<void>;
	open: boolean;
	reference: string | null;
	setupFeePaise: number;
};

function todayIso(): string {
	const now = new Date();
	const offset = now.getTimezoneOffset() * 60000;
	return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function buildSchema(setupFeeRupees: number) {
	return z.object({
		amount: z
			.number({ error: MESSAGES.ENQUIRY_PAYMENT_AMOUNT_LOW })
			.min(setupFeeRupees, MESSAGES.ENQUIRY_PAYMENT_AMOUNT_LOW),
		mode: z.string().min(1),
		note: z.string(),
		received_on: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.ENQUIRY_PAYMENT_DATE_FUTURE)
			.refine((v) => v <= todayIso(), MESSAGES.ENQUIRY_PAYMENT_DATE_FUTURE),
		reference: z.string().trim().min(1, MESSAGES.ENQUIRY_PAYMENT_REFERENCE_REQUIRED),
	});
}

/** Record a one-time setup payment: amount (prefilled with the fee), mode, reference, date. */
export const RecordPaymentDialog = ({
	businessName,
	onOpenChange,
	onSave,
	open,
	reference,
	setupFeePaise,
}: RecordPaymentDialogPropsType) => {
	const setupFeeRupees = setupFeePaise / 100;
	const defaults: EnquiryPaymentInputType = {
		amount: setupFeeRupees,
		mode: "bank_transfer",
		note: "",
		received_on: todayIso(),
		reference: "",
	};
	const form = useForm<EnquiryPaymentInputType>({
		defaultValues: defaults,
		mode: "onChange",
		resolver: zodResolver(buildSchema(setupFeeRupees)),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	useEffect(() => {
		if (open) form.reset(defaults);
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Record setup payment</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{businessName} · {reference} · setup fee {rupees(setupFeePaise)}
				</p>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSave)}>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="pay_amount">
								Amount (₹) <span className="text-red-500">*</span>
							</Label>
							<Input
								id="pay_amount"
								inputMode="decimal"
								type="number"
								{...form.register("amount", { valueAsNumber: true })}
							/>
							<EnquiryFieldError message={errors.amount?.message} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="pay_mode">
								Mode <span className="text-red-500">*</span>
							</Label>
							<Controller
								control={form.control}
								name="mode"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full" id="pay_mode">
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
							<Label htmlFor="pay_reference">
								Reference <span className="text-red-500">*</span>
							</Label>
							<Input id="pay_reference" placeholder="UTR / UPI ref" {...form.register("reference")} />
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
						<Label htmlFor="pay_note">Note</Label>
						<Input id="pay_note" {...form.register("note")} />
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
