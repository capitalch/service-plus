import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwFollowUpType } from "@/features/client/types/extended-warranty";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { useGenericQuery } from "../../reports/common/use-generic-query";
import {
	EW_FOLLOW_UP_ACTION_LABEL,
	daysLeftLabel,
	formatDate,
	formatDateTime,
	stageLabel,
} from "./extended-warranty-helpers";
import { addEwFollowUp } from "./send-ew-reminders";

const ACTIONS = ["CALL", "WHATSAPP", "SMS", "VISIT", "OTHER"] as const;

/**
 * Closing a deal should be one tap, so the outcomes are a segmented choice in plain deal
 * language rather than a select the user has to open and read. The stored values are
 * unchanged — only the wording and the affordance move.
 *
 * Lost renders slate, never red: not-interested and unreachable are ordinary business
 * outcomes, and red is reserved project-wide for errors.
 */
const OUTCOME_CHOICES = [
	{ hint: "keep chasing", label: "Still following up", tone: "", value: "IN_PROGRESS" },
	{ hint: "deal closed", label: "Won", tone: "emerald", value: "CONVERTED" },
	{ hint: "said no", label: "Lost — not interested", tone: "slate", value: "NOT_INTERESTED" },
	{ hint: "no response", label: "Lost — couldn't reach", tone: "slate", value: "UNREACHABLE" },
] as const;

function outcomeToneClass(tone: string, selected: boolean): string {
	if (!selected) return "border-(--cl-border) text-(--cl-text-muted) hover:border-(--cl-text-muted)";
	if (tone === "emerald")
		return "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
	if (tone === "slate")
		return "border-slate-500 bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
	return "border-(--cl-accent) bg-(--cl-surface-2) text-(--cl-text)";
}

type FollowUpsRowType = {
	follow_ups: EwFollowUpType[];
	full_name: string;
	mobile: string;
	outcome: string;
};

type Props = {
	customerName: string;
	/** Optional lead context, so the decision can be made without leaving the dialog. */
	daysLeft?: number | null;
	ewCustomerId: number;
	onClose: () => void;
	onSaved: () => void;
	open: boolean;
	stage: number | null;
	statusLabel?: string | null;
	warrantyEndDate?: string | null;
};

/**
 * The single close point for BOTH follow-up channels: reached from the Interest grid,
 * and deep-linked straight here from the staff WhatsApp alert's "Open in Service+"
 * button. Whichever way staff arrive, the outcome goes into the same `follow_ups`
 * array — there is one lead and one history, never two records to reconcile.
 */
export const EwFollowUpDialog = ({
	customerName,
	daysLeft,
	ewCustomerId,
	onClose,
	onSaved,
	open,
	stage,
	statusLabel,
	warrantyEndDate,
}: Props) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [action, setAction] = useState<string>("CALL");
	const [outcome, setOutcome] = useState<string>("IN_PROGRESS");
	const [remarks, setRemarks] = useState<string>("");
	const [saving, setSaving] = useState(false);

	const { data, refetch } = useGenericQuery<FollowUpsRowType>({
		enabled: open && ewCustomerId > 0,
		sqlArgs: { ew_customer_id: ewCustomerId },
		sqlId: SQL_MAP.GET_EW_FOLLOW_UPS,
	});

	const history = data[0]?.follow_ups ?? [];

	useEffect(() => {
		if (!open) return;
		setAction("CALL");
		setOutcome("IN_PROGRESS");
		setRemarks("");
	}, [open, ewCustomerId]);

	async function handleSave() {
		if (!dbName || !schema) return;
		setSaving(true);
		try {
			const ok = await addEwFollowUp(dbName, schema, {
				action,
				ewCustomerId,
				outcome,
				remarks: remarks.trim() || null,
				stage,
			});
			if (!ok) {
				toast.error(MESSAGES.ERROR_EW_FOLLOW_UP_FAILED);
				return;
			}
			toast.success(MESSAGES.SUCCESS_EW_FOLLOW_UP_RECORDED);
			refetch();
			onSaved();
			onClose();
		} catch {
			toast.error(MESSAGES.ERROR_EW_FOLLOW_UP_FAILED);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Follow up / close</DialogTitle>
					<DialogDescription>
						{customerName}
						{stage != null ? ` · ${stageLabel(stage)} reminder` : " · not messaged yet"}
					</DialogDescription>
				</DialogHeader>

				{/* Lead context, so staff can decide without going back to the grid. */}
				{(warrantyEndDate || daysLeft != null || statusLabel) && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) px-3 py-2 text-xs">
						{warrantyEndDate && (
							<span className="text-(--cl-text-muted)">
								Warranty ends <span className="text-(--cl-text)">{formatDate(warrantyEndDate)}</span>
							</span>
						)}
						{daysLeft != null && <span className="text-(--cl-text-muted)">{daysLeftLabel(daysLeft)}</span>}
						{statusLabel && (
							<span className="text-(--cl-text-muted)">
								Status <span className="text-(--cl-text)">{statusLabel}</span>
							</span>
						)}
					</div>
				)}

				<div className="space-y-3">
					<div>
						<Label htmlFor="ew-action">
							What did you do? <span className="text-red-600">*</span>
						</Label>
						<Select value={action} onValueChange={setAction}>
							<SelectTrigger id="ew-action" className="mt-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ACTIONS.map((a) => (
									<SelectItem key={a} value={a}>
										{EW_FOLLOW_UP_ACTION_LABEL[a]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<Label>
							Where does it stand? <span className="text-red-600">*</span>
						</Label>
						<div className="mt-1 grid grid-cols-2 gap-2">
							{OUTCOME_CHOICES.map((choice) => (
								<button
									key={choice.value}
									className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${outcomeToneClass(
										choice.tone,
										outcome === choice.value,
									)}`}
									onClick={() => setOutcome(choice.value)}
									type="button"
								>
									<span className="block text-sm font-semibold">{choice.label}</span>
									<span className="block text-[11px] opacity-70">{choice.hint}</span>
								</button>
							))}
						</div>
					</div>

					<div>
						<Label htmlFor="ew-remarks">Notes</Label>
						<Textarea
							id="ew-remarks"
							className="mt-1"
							maxLength={500}
							onChange={(e) => setRemarks(e.target.value)}
							placeholder="What was said, what to do next…"
							value={remarks}
						/>
					</div>

					{history.length > 0 && (
						<div className="rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3">
							<p className="mb-2 text-xs font-bold tracking-tight text-(--cl-text)">Earlier follow-ups</p>
							<ul className="max-h-48 space-y-2 overflow-y-auto">
								{[...history].reverse().map((entry, i) => (
									<li key={`${entry.at}-${i}`} className="text-xs text-(--cl-text-muted)">
										<span className="font-semibold text-(--cl-text)">
											{EW_FOLLOW_UP_ACTION_LABEL[entry.action] ?? entry.action}
										</span>
										{" · "}
										{formatDateTime(entry.at)}
										{entry.by_name ? ` · ${entry.by_name}` : ""}
										{entry.remarks ? <div className="mt-0.5">{entry.remarks}</div> : null}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={saving} onClick={handleSave}>
						{saving ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
