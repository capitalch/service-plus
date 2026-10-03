import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangleIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnquiryFieldError } from "./enquiry-field-error";

type EnquiryNoteDialogPropsType = {
	confirmLabel: string;
	intro: string;
	label: string;
	onOpenChange: (open: boolean) => void;
	onSave: (text: string) => Promise<void>;
	open: boolean;
	requiredMessage: string;
	title: string;
	/** An amber notice above the field, e.g. "Payment was received — refund outside the system". */
	warning?: string | null;
};

type NoteFormType = { text: string };

/** One required text (a rejection reason, a failed-payment note) for an enquiry action. */
export const EnquiryNoteDialog = ({
	confirmLabel,
	intro,
	label,
	onOpenChange,
	onSave,
	open,
	requiredMessage,
	title,
	warning,
}: EnquiryNoteDialogPropsType) => {
	const form = useForm<NoteFormType>({
		defaultValues: { text: "" },
		mode: "onChange",
		resolver: zodResolver(z.object({ text: z.string().trim().min(1, requiredMessage) })),
	});
	const {
		formState: { errors, isSubmitting, isValid },
	} = form;

	useEffect(() => {
		if (open) form.reset({ text: "" });
	}, [open]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				className="sm:max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-base font-semibold">{title}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-slate-500">{intro}</p>
				{warning && (
					<p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
						<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
						{warning}
					</p>
				)}
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => onSave(v.text.trim()))}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="enquiry_note">
							{label} <span className="text-red-500">*</span>
						</Label>
						<Textarea id="enquiry_note" rows={3} {...form.register("text")} />
						<EnquiryFieldError message={errors.text?.message} />
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-slate-700 text-white hover:bg-slate-800"
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
