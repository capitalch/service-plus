import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type { EwLeadType, EwTimelineItemType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwDeliveryChip } from "./ew-delivery-chip";
import { EwLeadActionsMenu } from "./ew-lead-actions-menu";
import { EwStateBadge } from "./ew-state-badge";
import {
	EW_BANDS,
	EW_FOLLOW_UP_ACTIONS,
	EW_STAGES,
	EW_STATE_META,
	daysLeftLabel,
	formatDate,
	formatDateTime,
} from "./ew-state-machine";
import type { EwActionType } from "./ew-state-machine";

type Props = {
	ewLeadId: number;
	onAction: (row: EwLeadType, action: EwActionType) => void;
	onClose: () => void;
	refreshKey: number;
};

const PREFERENCE = { CALL: "Prefers a call", WHATSAPP: "Prefers WhatsApp" } as const;

function timelineText(item: EwTimelineItemType): string {
	if (item.source === "MESSAGE") {
		return item.kind === "LEAD_ALERT"
			? "Staff alert"
			: `Reminder${item.band ? ` · ${EW_BANDS[item.band].label}` : ""}`;
	}
	switch (item.item_type) {
		case "FOLLOW_UP":
			return `Follow-up · ${item.action ? EW_FOLLOW_UP_ACTIONS[item.action].label : ""}`;
		case "INTEREST":
			return "Customer tapped “interested”";
		case "OPT_OUT":
			return "Customer opted out";
		case "STAGE_CHANGE":
			return item.progress_stage ? `Moved to ${EW_STAGES[item.progress_stage].label}` : "Stage changed";
		default:
			return item.from_state && item.to_state
				? `${EW_STATE_META[item.from_state].label} → ${EW_STATE_META[item.to_state].label}`
				: "State changed";
	}
}

const Fact = ({ children, label }: { children: ReactNode; label: string }) => (
	<div>
		<p className="text-[10px] font-bold uppercase tracking-widest text-(--cl-text-muted)">{label}</p>
		<div className="mt-0.5 text-sm text-(--cl-text)">{children}</div>
	</div>
);

/** One lead: facts, the actions menu and the merged timeline (§C7.8). Loads by id. */
export const EwLeadDetailDialog = ({ ewLeadId, onAction, onClose, refreshKey }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const detail = useGenericQuery<EwLeadType>({
		enabled: !!branch?.id,
		sqlArgs: { branch_id: branch?.id ?? null, ew_lead_id: ewLeadId },
		sqlId: SQL_MAP.GET_EW_LEAD_DETAIL,
	});
	const timeline = useGenericQuery<EwTimelineItemType>({
		sqlArgs: { ew_lead_id: ewLeadId },
		sqlId: SQL_MAP.GET_EW_LEAD_TIMELINE,
	});

	// Re-read after any change made elsewhere (a transition picked from this dialog's menu).
	const firstRef = useRef(true);
	useEffect(() => {
		if (firstRef.current) {
			firstRef.current = false;
			return;
		}
		detail.refetch();
		timeline.refetch();
	}, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

	const row = detail.data[0];

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{row?.full_name ?? "Lead"}</DialogTitle>
					<DialogDescription>
						{row ? `${row.mobile} · ${daysLeftLabel(row.days_left)}` : " "}
					</DialogDescription>
				</DialogHeader>

				{detail.error ? (
					<ReportError message={MESSAGES.ERROR_EW_LEADS_LOAD_FAILED} onRetry={detail.refetch} />
				) : detail.loading && !row ? (
					<ReportLoading lines={3} />
				) : !row ? (
					<p className="text-sm text-(--cl-text-muted)">{MESSAGES.INFO_EW_LEAD_NOT_FOUND}</p>
				) : (
					<div className="flex flex-col gap-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<EwStateBadge row={row} />
							<EwLeadActionsMenu
								hideDetails
								row={row}
								trigger={
									<Button size="sm" variant="outline">
										Actions <ChevronDown className="h-3.5 w-3.5" />
									</Button>
								}
								onAction={onAction}
							/>
						</div>

						{row.interest_at && row.alert_status === "FAILED" && (
							<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
								<span title={row.alert_error ?? undefined}>{MESSAGES.INFO_EW_ALERT_NOT_SENT}</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										onAction(row, {
											disabledReason: null,
											key: "RESEND_ALERT",
											label: "Resend staff alert",
										})
									}
								>
									Resend staff alert
								</Button>
							</div>
						)}

						<div className="grid grid-cols-1 gap-3 rounded-lg border border-(--cl-border) bg-(--cl-surface-2) p-3 sm:grid-cols-2">
							<Fact label="Device">
								{[row.brand_name, row.product_label].filter(Boolean).join(" · ") || "—"}
								{row.serial_no && (
									<span className="block text-xs text-(--cl-text-muted)">SN {row.serial_no}</span>
								)}
							</Fact>
							<Fact label="Warranty ends">
								{formatDate(row.warranty_end_date)}
								<span className="block text-xs text-(--cl-text-muted)">
									{daysLeftLabel(row.days_left)} · {EW_BANDS[row.band].label}
								</span>
							</Fact>
							<Fact label="Purchased">{formatDate(row.purchase_date) || "—"}</Fact>
							<Fact label="Contact">
								{[row.email, row.address, row.city].filter(Boolean).join(" · ") || "—"}
								{row.is_opted_out && (
									<span className="block text-xs text-(--cl-text-muted)">
										Opted out {formatDateTime(row.opted_out_at)}
									</span>
								)}
							</Fact>
							<Fact label="Interest">
								{row.interest_at ? formatDateTime(row.interest_at) : "—"}
								{row.preferred_contact && (
									<span className="block text-xs text-(--cl-text-muted)">
										{PREFERENCE[row.preferred_contact]}
									</span>
								)}
								{row.customer_remarks && (
									<span className="block text-xs text-(--cl-text-muted)">
										“{row.customer_remarks}”
									</span>
								)}
							</Fact>
							<Fact label="Follow-ups">
								{row.follow_up_count}
								{row.last_follow_up_at && (
									<span className="block text-xs text-(--cl-text-muted)">
										Last {formatDateTime(row.last_follow_up_at)}
									</span>
								)}
								{row.next_follow_up_at && (
									<span className="block text-xs text-(--cl-text-muted)">
										Next {formatDateTime(row.next_follow_up_at)}
									</span>
								)}
							</Fact>
							<Fact label="Entered">
								{formatDateTime(row.created_at)}
								{row.created_by_name && (
									<span className="block text-xs text-(--cl-text-muted)">
										by {row.created_by_name}
									</span>
								)}
							</Fact>
							<Fact label="Remarks">{row.remarks || "—"}</Fact>
						</div>

						<div>
							<p className="mb-2 text-xs font-bold tracking-tight text-(--cl-text)">Timeline</p>
							{timeline.error ? (
								<ReportError
									message={MESSAGES.ERROR_EW_TIMELINE_LOAD_FAILED}
									onRetry={timeline.refetch}
								/>
							) : (
								<ul className="space-y-2">
									{timeline.data.map((item) => (
										<li
											key={`${item.source}-${item.id}`}
											className="rounded-md border border-(--cl-border) px-3 py-2 text-xs text-(--cl-text-muted)"
										>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-semibold text-(--cl-text)">
													{timelineText(item)}
												</span>
												{item.source === "MESSAGE" && (
													<EwDeliveryChip error={item.error} status={item.delivery_status} />
												)}
												<span>{formatDateTime(item.occurred_at)}</span>
												{item.by_name && <span>· {item.by_name}</span>}
											</div>
											{item.notes && (
												<div className="mt-1 whitespace-pre-wrap text-(--cl-text)">
													{item.notes}
												</div>
											)}
											{item.next_follow_up_at && (
												<div className="mt-0.5">
													Next follow-up {formatDateTime(item.next_follow_up_at)}
												</div>
											)}
											{item.error && <div className="mt-0.5 text-red-600">{item.error}</div>}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};
