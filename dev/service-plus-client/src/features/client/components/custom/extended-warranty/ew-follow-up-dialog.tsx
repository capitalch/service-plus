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
import { EW_FOLLOW_UP_ACTION_LABEL, EW_OUTCOME_LABEL, formatDateTime, stageLabel } from "./extended-warranty-helpers";
import { addEwFollowUp } from "./send-ew-reminders";

const ACTIONS = ["CALL", "WHATSAPP", "SMS", "VISIT", "OTHER"] as const;
const OUTCOMES = ["IN_PROGRESS", "CONVERTED", "NOT_INTERESTED", "UNREACHABLE"] as const;

const OUTCOME_LABEL: Record<(typeof OUTCOMES)[number], string> = {
	CONVERTED: EW_OUTCOME_LABEL.CONVERTED,
	IN_PROGRESS: "Still following up",
	NOT_INTERESTED: EW_OUTCOME_LABEL.NOT_INTERESTED,
	UNREACHABLE: EW_OUTCOME_LABEL.UNREACHABLE,
};

type FollowUpsRowType = {
	follow_ups: EwFollowUpType[];
	full_name: string;
	mobile: string;
	outcome: string;
};

type Props = {
	customerName: string;
	ewCustomerId: number;
	onClose: () => void;
	onSaved: () => void;
	open: boolean;
	stage: number | null;
};

/**
 * The single close point for BOTH follow-up channels: reached from the Interest grid,
 * and deep-linked straight here from the staff WhatsApp alert's "Open in Service+"
 * button. Whichever way staff arrive, the outcome goes into the same `follow_ups`
 * array — there is one lead and one history, never two records to reconcile.
 */
export const EwFollowUpDialog = ({ customerName, ewCustomerId, onClose, onSaved, open, stage }: Props) => {
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
					<DialogTitle>Record a follow-up</DialogTitle>
					<DialogDescription>
						{customerName}
						{stage != null ? ` · ${stageLabel(stage)} reminder` : ""}
					</DialogDescription>
				</DialogHeader>

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
						<Label htmlFor="ew-outcome">
							Where does it stand? <span className="text-red-600">*</span>
						</Label>
						<Select value={outcome} onValueChange={setOutcome}>
							<SelectTrigger id="ew-outcome" className="mt-1">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{OUTCOMES.map((o) => (
									<SelectItem key={o} value={o}>
										{OUTCOME_LABEL[o]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
						{saving ? "Saving…" : "Save follow-up"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
