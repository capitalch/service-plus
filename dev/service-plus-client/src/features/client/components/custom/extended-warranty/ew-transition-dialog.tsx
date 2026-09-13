import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwLeadType, EwProgressStageType, EwStateType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { fillMessage, transitionEwLead } from "./ew-mutations";
import { EwStatePill } from "./ew-state-badge";
import { EW_NOTES_MAX, EW_STAGES, EW_STATE_META, transitionLabel } from "./ew-state-machine";
import { ewTransitionSchema } from "./extended-warranty-schema";
import type { EwTransitionFormType } from "./extended-warranty-schema";

type Props = {
	onClose: () => void;
	/** `chainFollowUp` — the user asked to record the first follow-up right away. */
	onDone: (chainFollowUp: boolean, updated: EwLeadType) => void;
	progressStage?: EwProgressStageType;
	row: EwLeadType;
	toState: EwStateType;
};

/** Confirms one state move or stage advance (§C7.8), with optional notes. */
export const EwTransitionDialog = ({ onClose, onDone, progressStage, row, toState }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const [saving, setSaving] = useState(false);

	const isStageAdvance = row.state === "IN_PROGRESS" && toState === "IN_PROGRESS";
	const entersInProgress = toState === "IN_PROGRESS" && row.state !== "IN_PROGRESS";
	const closes = toState === "LOST" || toState === "CANCELLED";

	const form = useForm<EwTransitionFormType>({
		defaultValues: { first_follow_up: true, notes: "" },
		mode: "onChange",
		resolver: zodResolver(ewTransitionSchema),
	});
	const {
		formState: { errors, isValid },
	} = form;
	const notes = useWatch({ control: form.control, name: "notes" });
	const firstFollowUp = useWatch({ control: form.control, name: "first_follow_up" });

	const title =
		isStageAdvance && progressStage
			? `Advance to ${EW_STAGES[progressStage].label}`
			: transitionLabel(row.state, toState);

	async function onSubmit(values: EwTransitionFormType) {
		if (!dbName || !schema || !branch?.id) return;
		setSaving(true);
		try {
			const result = await transitionEwLead(
				{ dbName, schema },
				{
					branchId: branch.id,
					ewLeadId: row.ew_lead_id,
					notes: values.notes.trim() || null,
					progressStage: isStageAdvance ? progressStage : undefined,
					toState,
				},
			);
			if (!result.ok) {
				toast.info(MESSAGES.INFO_EW_LEAD_CHANGED);
				onDone(false, row);
				return;
			}
			const stage = result.progress_stage ?? null;
			const stateText =
				toState === "IN_PROGRESS" && stage
					? `${EW_STATE_META.IN_PROGRESS.label} · ${EW_STAGES[stage].label}`
					: EW_STATE_META[toState].label;
			toast.success(fillMessage(MESSAGES.SUCCESS_EW_STATE_CHANGED, { state: stateText }));
			onDone(entersInProgress && values.first_follow_up, { ...row, progress_stage: stage, state: toState });
		} catch {
			toast.error(MESSAGES.ERROR_EW_TRANSITION_FAILED);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{row.full_name} · {row.mobile}
					</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
					<div className="flex flex-wrap items-center gap-2">
						<EwStatePill progressStage={row.progress_stage} state={row.state} />
						<ArrowRight className="h-4 w-4 text-(--cl-text-muted)" />
						<EwStatePill
							progressStage={isStageAdvance ? progressStage : toState === "IN_PROGRESS" ? 1 : null}
							state={toState}
						/>
					</div>

					<div>
						<Label htmlFor="ew-transition-notes">Notes</Label>
						<Textarea
							className="mt-1"
							id="ew-transition-notes"
							maxLength={EW_NOTES_MAX}
							placeholder={closes ? "Reason (optional)" : "Optional"}
							{...form.register("notes")}
						/>
						<div className="mt-1 flex justify-between text-xs">
							<span className="text-red-600">{errors.notes?.message}</span>
							<span className="text-(--cl-text-muted)">
								{notes.length}/{EW_NOTES_MAX}
							</span>
						</div>
					</div>

					{entersInProgress && (
						<Label className="flex items-center gap-2 font-normal" htmlFor="ew-first-follow-up">
							<Checkbox
								checked={firstFollowUp}
								id="ew-first-follow-up"
								onCheckedChange={(checked) => form.setValue("first_follow_up", checked === true)}
							/>
							Record the first follow-up now
						</Label>
					)}

					<DialogFooter>
						<Button disabled={saving} type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button
							className="bg-teal-600 text-white hover:bg-teal-700"
							disabled={!isValid || saving}
							type="submit"
						>
							{saving && <Loader2 className="h-4 w-4 animate-spin" />}
							Confirm
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
