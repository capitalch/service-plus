import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type {
	EwFollowUpActionType,
	EwLeadType,
	EwProgressStageType,
	EwTimelineItemType,
} from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { useGenericQuery } from "../../reports/common/use-generic-query";
import { addEwFollowUp } from "./ew-mutations";
import { EwStateBadge } from "./ew-state-badge";
import {
	EW_FOLLOW_UP_ACTIONS,
	EW_NOTES_MAX,
	EW_STAGES,
	EW_STATE_META,
	daysLeftLabel,
	formatDate,
	formatDateTime,
} from "./ew-state-machine";
import { combineDateTime, ewFollowUpSchema } from "./extended-warranty-schema";
import type { EwFollowUpFormType } from "./extended-warranty-schema";

type Props = {
	onClose: () => void;
	onSaved: () => void;
	row: EwLeadType;
};

const ACTIONS = (Object.keys(EW_FOLLOW_UP_ACTIONS) as EwFollowUpActionType[]).sort(
	(a, b) => EW_FOLLOW_UP_ACTIONS[a].order - EW_FOLLOW_UP_ACTIONS[b].order,
);
const HISTORY_TYPES = new Set(["FOLLOW_UP", "STAGE_CHANGE", "STATE_CHANGE"]);

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/** Keeps an upcoming next follow-up pre-filled; a past (due) one starts blank. */
function toDefaults(row: EwLeadType): EwFollowUpFormType {
	const next = row.next_follow_up_at ? new Date(row.next_follow_up_at) : null;
	const keep = next !== null && next.getTime() > Date.now();
	return {
		action: "CALL",
		next_date: keep ? `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}` : "",
		next_time: keep ? `${pad2(next.getHours())}:${pad2(next.getMinutes())}` : "10:00",
		notes: "",
		progress_stage: row.progress_stage ?? 1,
	};
}

function historyLine(item: EwTimelineItemType): string {
	if (item.item_type === "FOLLOW_UP") {
		return `Follow-up · ${item.action ? EW_FOLLOW_UP_ACTIONS[item.action].label : ""}`;
	}
	if (item.item_type === "STAGE_CHANGE" && item.progress_stage)
		return `Moved to ${EW_STAGES[item.progress_stage].label}`;
	if (item.from_state && item.to_state) {
		return `${EW_STATE_META[item.from_state].label} → ${EW_STATE_META[item.to_state].label}`;
	}
	return item.item_type;
}

/**
 * Record a follow-up on an In Progress lead (§C7.8). Outside clicks and Esc never close it
 * (the brief); Cancel / X ask before discarding typed work.
 */
export const EwFollowUpDialog = ({ onClose, onSaved, row }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const [confirmDiscard, setConfirmDiscard] = useState(false);
	const [saving, setSaving] = useState(false);

	const form = useForm<EwFollowUpFormType>({
		defaultValues: toDefaults(row),
		mode: "onChange",
		resolver: zodResolver(ewFollowUpSchema),
	});
	const {
		formState: { errors, isDirty, isValid },
	} = form;
	const action = useWatch({ control: form.control, name: "action" });
	const nextDate = useWatch({ control: form.control, name: "next_date" });
	const nextTime = useWatch({ control: form.control, name: "next_time" });
	const notes = useWatch({ control: form.control, name: "notes" });
	const stage = useWatch({ control: form.control, name: "progress_stage" });

	const timeline = useGenericQuery<EwTimelineItemType>({
		sqlArgs: { ew_lead_id: row.ew_lead_id },
		sqlId: SQL_MAP.GET_EW_LEAD_TIMELINE,
	});
	const history = timeline.data.filter((item) => item.source === "EVENT" && HISTORY_TYPES.has(item.item_type));

	function requestClose() {
		if (saving) return;
		if (isDirty) setConfirmDiscard(true);
		else onClose();
	}

	async function onSubmit(values: EwFollowUpFormType) {
		if (!dbName || !schema || !branch?.id) return;
		setSaving(true);
		try {
			const at = values.next_date ? combineDateTime(values.next_date, values.next_time) : null;
			const result = await addEwFollowUp(
				{ dbName, schema },
				{
					action: values.action,
					branchId: branch.id,
					ewLeadId: row.ew_lead_id,
					nextFollowUpAt: at ? at.toISOString() : null,
					notes: values.notes.trim(),
					progressStage: values.progress_stage as EwProgressStageType,
				},
			);
			if (result.ok) toast.success(MESSAGES.SUCCESS_EW_FOLLOW_UP_RECORDED);
			else toast.info(MESSAGES.INFO_EW_LEAD_CHANGED);
			onSaved();
			onClose();
		} catch {
			toast.error(MESSAGES.ERROR_EW_FOLLOW_UP_FAILED);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Dialog open onOpenChange={(open) => !open && requestClose()}>
				<DialogContent
					className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
					onEscapeKeyDown={(e) => e.preventDefault()}
					onInteractOutside={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>Record follow-up</DialogTitle>
						<DialogDescription>
							{row.full_name} · {row.mobile}
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2 text-xs">
						<EwStateBadge row={row} />
						<span className="text-(--cl-text-muted)">
							Warranty ends <span className="text-(--cl-text)">{formatDate(row.warranty_end_date)}</span>{" "}
							· {daysLeftLabel(row.days_left)}
						</span>
					</div>

					<form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
						<div>
							<Label>
								Action <span className="text-red-600">*</span>
							</Label>
							<div className="mt-1 flex flex-wrap gap-1.5">
								{ACTIONS.map((key) => (
									<button
										key={key}
										className={cn(
											"cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors",
											action === key
												? "border-teal-600 bg-teal-50 font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
												: "border-(--cl-border) text-(--cl-text-muted) hover:border-(--cl-text-muted)",
										)}
										type="button"
										onClick={() =>
											form.setValue("action", key, { shouldDirty: true, shouldValidate: true })
										}
									>
										{EW_FOLLOW_UP_ACTIONS[key].label}
									</button>
								))}
							</div>
						</div>

						<div>
							<Label htmlFor="ew-follow-up-notes">
								Notes <span className="text-red-600">*</span>
							</Label>
							<Textarea
								className="mt-1"
								id="ew-follow-up-notes"
								maxLength={EW_NOTES_MAX}
								placeholder="What was said, what happens next"
								{...form.register("notes")}
							/>
							<div className="mt-1 flex justify-between text-xs">
								<span className="text-red-600">{errors.notes?.message}</span>
								<span className="text-(--cl-text-muted)">
									{notes.length}/{EW_NOTES_MAX}
								</span>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<Label>Next follow-up</Label>
								<div className="mt-1 flex items-center gap-2">
									<LocaleDateInput
										value={nextDate}
										onChange={(iso) =>
											form.setValue("next_date", iso, { shouldDirty: true, shouldValidate: true })
										}
									/>
									<Input
										aria-label="Next follow-up time"
										className="w-28"
										type="time"
										value={nextTime}
										onChange={(e) =>
											form.setValue("next_time", e.target.value, {
												shouldDirty: true,
												shouldValidate: true,
											})
										}
									/>
									{nextDate && (
										<Button
											size="sm"
											type="button"
											variant="ghost"
											onClick={() =>
												form.setValue("next_date", "", {
													shouldDirty: true,
													shouldValidate: true,
												})
											}
										>
											Clear
										</Button>
									)}
								</div>
								{(errors.next_date || errors.next_time) && (
									<p className="mt-1 text-xs text-red-600">
										{errors.next_date?.message ?? errors.next_time?.message}
									</p>
								)}
							</div>

							<div>
								<Label htmlFor="ew-follow-up-stage">Stage</Label>
								<Select
									value={String(stage)}
									onValueChange={(v) =>
										form.setValue("progress_stage", Number(v), {
											shouldDirty: true,
											shouldValidate: true,
										})
									}
								>
									<SelectTrigger className="mt-1" id="ew-follow-up-stage">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{([1, 2, 3] as EwProgressStageType[]).map((s) => (
											<SelectItem
												key={s}
												disabled={s < (row.progress_stage ?? 1)}
												value={String(s)}
											>
												{EW_STAGES[s].label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{history.length > 0 && (
							<div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
								<p className="mb-2 text-xs font-bold tracking-tight text-(--cl-text)">History</p>
								<ul className="max-h-48 space-y-2 overflow-y-auto">
									{history.map((item) => (
										<li key={item.id} className="text-xs text-(--cl-text-muted)">
											<span className="font-semibold text-(--cl-text)">{historyLine(item)}</span>
											{" · "}
											{formatDateTime(item.occurred_at)}
											{item.by_name ? ` · ${item.by_name}` : ""}
											{item.notes && (
												<div className="mt-0.5 whitespace-pre-wrap">{item.notes}</div>
											)}
										</li>
									))}
								</ul>
							</div>
						)}

						<DialogFooter>
							<Button disabled={saving} type="button" variant="outline" onClick={requestClose}>
								Cancel
							</Button>
							<Button
								className="bg-teal-600 text-white hover:bg-teal-700"
								disabled={!isValid || saving}
								type="submit"
							>
								{saving && <Loader2 className="h-4 w-4 animate-spin" />}
								Save
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard follow-up</AlertDialogTitle>
						<AlertDialogDescription>{MESSAGES.CONFIRM_EW_DISCARD_FOLLOW_UP}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<Button
							variant="outline"
							onClick={() => {
								setConfirmDiscard(false);
								onClose();
							}}
						>
							Discard
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};
