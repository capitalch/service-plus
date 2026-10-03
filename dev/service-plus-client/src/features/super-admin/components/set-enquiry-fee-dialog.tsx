import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnquiryFieldError } from "@/components/shared/enquiries/enquiry-field-error";
import type { EntEnquiryType } from "@/components/shared/enquiries/enquiry-types";
import { MESSAGES } from "@/constants/messages";

type SetEnquiryFeeDialogPropsType = {
	enquiry: EntEnquiryType | null;
	onOpenChange: (open: boolean) => void;
	onSave: (setupFee: number) => Promise<void>;
};

type FeeFormType = { setup_fee: number };

const feeSchema = z.object({
	setup_fee: z.number({ error: MESSAGES.ENQUIRY_FEE_INVALID }).min(0, MESSAGES.ENQUIRY_FEE_INVALID),
});

/** The negotiated one-time setup fee of an Enterprise enquiry, in rupees. */
export const SetEnquiryFeeDialog = ({ enquiry, onOpenChange, onSave }: SetEnquiryFeeDialogPropsType) => {
	const form = useForm<FeeFormType>({
		defaultValues: { setup_fee: 0 },
		mode: "onChange",
		resolver: zodResolver(feeSchema),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	useEffect(() => {
		if (enquiry) form.reset({ setup_fee: enquiry.setup_fee_paise / 100 });
	}, [enquiry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Dialog open={!!enquiry} onOpenChange={onOpenChange}>
			<DialogContent aria-describedby={undefined} className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">Set setup fee</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">
					{enquiry?.business_name} · {enquiry?.reference}
				</p>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => onSave(v.setup_fee))}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="ent_fee">
							Setup fee (₹) <span className="text-red-500">*</span>
						</Label>
						<Input id="ent_fee" type="number" {...form.register("setup_fee", { valueAsNumber: true })} />
						<EnquiryFieldError message={errors.setup_fee?.message} />
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
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
