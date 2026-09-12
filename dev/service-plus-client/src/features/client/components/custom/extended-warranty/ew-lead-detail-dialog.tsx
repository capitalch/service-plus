import { useState } from "react";
import { PhoneCall, RefreshCw } from "lucide-react";
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
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwDeliveryStatusType, EwFollowUpType, EwLeadRowType } from "@/features/client/types/extended-warranty";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { useGenericQuery } from "../../reports/common/use-generic-query";
import {
	EW_FOLLOW_UP_ACTION_LABEL,
	daysLeftLabel,
	formatDate,
	formatDateTime,
	leadStatusLabel,
	stageLabel,
} from "./extended-warranty-helpers";
import { EwDeliveryBadge } from "./ew-status-badge";
import { resendEwLeadAlert } from "./send-ew-reminders";

type FollowUpsRowType = { follow_ups: EwFollowUpType[] };

type StageRowType = { delivery_status: string; error: string | null; sent_at: string | null; stage: number };

type Props = {
	lead: EwLeadRowType | null;
	onChanged: () => void;
	onClose: () => void;
	onFollowUp: (lead: EwLeadRowType) => void;
	stages: number[];
};

/** One label/value line — the dialog is mostly these. */
const Field = ({ label, value }: { label: string; value: string | null | undefined }) =>
	value ? (
		<div>
			<dt className="text-xs text-(--cl-text-muted)">{label}</dt>
			<dd className="text-sm text-(--cl-text)">{value}</dd>
		</div>
	) : null;

/**
 * Everything known about one lead, in one place: contact, device, the delivery state of
 * each reminder stage, the interest block with its staff-alert status, and the full
 * follow-up history. Opened by clicking a row on the Leads screen.
 */
export const EwLeadDetailDialog = ({ lead, onChanged, onClose, onFollowUp, stages }: Props) => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const [resending, setResending] = useState(false);

	const { data } = useGenericQuery<FollowUpsRowType>({
		enabled: !!lead,
		sqlArgs: { ew_customer_id: lead?.ew_customer_id ?? 0 },
		sqlId: SQL_MAP.GET_EW_FOLLOW_UPS,
	});
	const history = data[0]?.follow_ups ?? [];

	// Every configured stage, filled in from the customer's ACTUAL sends. Reading only the
	// row's "current" stage (as this did until 2026-09-12) made every other stage look as
	// though it had never been messaged.
	const byStage = new Map((lead?.sends ?? []).map((send) => [send.stage, send]));
	const stageRows: StageRowType[] = [...new Set([...stages, ...byStage.keys()])]
		.sort((a, b) => b - a)
		.map((stage) => {
			const send = byStage.get(stage);
			return {
				delivery_status: send?.delivery_status ?? "NONE",
				error: send?.error ?? null,
				sent_at: send?.sent_at ?? null,
				stage,
			};
		});

	async function handleResend() {
		if (!lead || !dbName || !schema || lead.stage == null) return;
		setResending(true);
		try {
			const ok = await resendEwLeadAlert(dbName, schema, lead.ew_customer_id, lead.stage);
			if (ok) {
				toast.success(MESSAGES.SUCCESS_EW_ALERT_RESENT);
				onChanged();
			} else {
				toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
			}
		} catch {
			toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
		} finally {
			setResending(false);
		}
	}

	return (
		<Dialog open={!!lead} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{lead?.full_name}</DialogTitle>
					<DialogDescription>
						{lead ? `${leadStatusLabel(lead)} · ${daysLeftLabel(lead.days_left)}` : ""}
					</DialogDescription>
				</DialogHeader>

				{lead && (
					<div className="space-y-4">
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							<Field label="Mobile" value={lead.mobile} />
							<Field label="Email" value={lead.email} />
							<Field label="City" value={lead.city} />
							<Field label="Address" value={lead.address} />
							<Field label="Brand" value={lead.brand_name} />
							<Field label="Device" value={lead.product_label} />
							<Field label="Serial no" value={lead.serial_no} />
							<Field label="Bought" value={lead.purchase_date ? formatDate(lead.purchase_date) : null} />
							<Field label="Warranty ends" value={formatDate(lead.warranty_end_date)} />
						</dl>

						{lead.remarks && (
							<div>
								<p className="text-xs text-(--cl-text-muted)">Staff remarks</p>
								<p className="text-sm text-(--cl-text)">{lead.remarks}</p>
							</div>
						)}

						<div>
							<p className="mb-1.5 text-xs font-bold tracking-tight text-(--cl-text)">Reminders</p>
							<div className="flex flex-wrap gap-2">
								{stageRows.map((row) => (
									<div
										key={row.stage}
										className="rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-2.5 py-1.5"
									>
										<div className="text-xs font-medium text-(--cl-text)">
											{stageLabel(row.stage)}
										</div>
										{row.delivery_status === "NONE" ? (
											<div className="text-[11px] text-(--cl-text-muted)">not sent</div>
										) : (
											<>
												<EwDeliveryBadge status={row.delivery_status as EwDeliveryStatusType} />
												{row.sent_at && (
													<div className="mt-0.5 text-[11px] text-(--cl-text-muted)">
														{formatDateTime(row.sent_at)}
													</div>
												)}
												{row.error && (
													<div className="mt-0.5 max-w-48 text-[11px] text-red-600">
														{row.error}
													</div>
												)}
											</>
										)}
									</div>
								))}
							</div>
						</div>

						{lead.interest_at && (
							<div className="rounded-lg border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
								<p className="text-xs font-bold tracking-tight text-(--cl-text)">
									Customer asked to be contacted
								</p>
								<p className="mt-1 text-xs text-(--cl-text-muted)">
									{formatDateTime(lead.interest_at)}
									{lead.preferred_contact ? ` · prefers ${lead.preferred_contact.toLowerCase()}` : ""}
								</p>
								{lead.customer_remarks && (
									<p className="mt-1 text-sm text-(--cl-text)">“{lead.customer_remarks}”</p>
								)}
								<div className="mt-2 flex items-center gap-2">
									<span className="text-xs text-(--cl-text-muted)">Staff alert:</span>
									{lead.alert_status ? (
										<EwDeliveryBadge status={lead.alert_status as EwDeliveryStatusType} />
									) : (
										"-"
									)}
									{lead.alert_status === "FAILED" && (
										<Button
											disabled={resending}
											onClick={() => void handleResend()}
											size="sm"
											title="Resend the staff alert"
											variant="outline"
										>
											<RefreshCw className="size-3.5" />
										</Button>
									)}
								</div>
								{lead.alert_error && <p className="mt-1 text-xs text-red-600">{lead.alert_error}</p>}
							</div>
						)}

						<div>
							<p className="mb-1.5 text-xs font-bold tracking-tight text-(--cl-text)">
								Follow-up history
							</p>
							{history.length === 0 ? (
								<p className="text-xs text-(--cl-text-muted)">Nothing recorded yet.</p>
							) : (
								<ul className="space-y-2">
									{[...history].reverse().map((entry, i) => (
										<li
											key={`${entry.at}-${i}`}
											className="border-l-2 border-(--cl-border) pl-3 text-xs text-(--cl-text-muted)"
										>
											<span className="font-semibold text-(--cl-text)">
												{EW_FOLLOW_UP_ACTION_LABEL[entry.action] ?? entry.action}
											</span>
											{" · "}
											{formatDateTime(entry.at)}
											{entry.by_name ? ` · ${entry.by_name}` : ""}
											{entry.remarks ? (
												<div className="mt-0.5 text-(--cl-text)">{entry.remarks}</div>
											) : null}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				)}

				<DialogFooter>
					<Button onClick={onClose} variant="outline">
						Close
					</Button>
					{lead && (
						<Button onClick={() => onFollowUp(lead)}>
							<PhoneCall className="mr-1.5 size-3.5" />
							Follow up / close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
