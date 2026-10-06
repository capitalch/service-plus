import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { useIsReadOnly } from "@/components/shared/billing/use-is-read-only";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";

import { INTERNAL_NOTE_MAX, internalNoteSchema } from "./internal-note-schema";
import type { InternalNoteFormType } from "./internal-note-schema";

type Props = {
	defaultValue?: string;
	onCancel?: () => void;
	onSubmit: (note: string) => Promise<boolean>;
	submitLabel: string;
};

/** Add Note (no Cancel) and inline edit (with Cancel). Resets after a successful add. */
export const InternalNoteForm = ({ defaultValue = "", onCancel, onSubmit, submitLabel }: Props) => {
	const isReadOnly = useIsReadOnly();
	const {
		control,
		formState: { errors, isSubmitting, isValid },
		handleSubmit,
		register,
		reset,
	} = useForm<InternalNoteFormType>({
		defaultValues: { note: defaultValue },
		mode: "onChange",
		resolver: zodResolver(internalNoteSchema),
	});
	const note = useWatch({ control, name: "note" }) ?? "";

	async function submit(values: InternalNoteFormType) {
		const saved = await onSubmit(values.note);
		if (saved && !onCancel) reset({ note: "" });
	}

	return (
		<form className="flex flex-col gap-1.5" onSubmit={handleSubmit(submit)}>
			<Textarea
				{...register("note")}
				aria-invalid={!!errors.note}
				autoFocus={!!onCancel}
				className="max-h-60 min-h-[4.5rem] resize-none text-sm"
				placeholder="Write an internal note…"
				rows={3}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-xs text-red-600">{errors.note?.message}</span>
				<div className="ml-auto flex items-center gap-2">
					<span
						className={`text-[11px] tabular-nums ${note.length > INTERNAL_NOTE_MAX ? "text-red-600" : "text-slate-400"}`}
					>
						{note.length} / {INTERNAL_NOTE_MAX}
					</span>
					{onCancel && (
						<Button
							className="h-7 px-2.5 text-xs"
							onClick={onCancel}
							size="sm"
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
					)}
					<Button
						className="h-7 px-3 text-xs"
						disabled={!isValid || isSubmitting || isReadOnly}
						size="sm"
						title={isReadOnly ? MESSAGES.READ_ONLY_TOOLTIP : undefined}
						type="submit"
					>
						{isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
						{submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
};
