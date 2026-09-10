import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwInterestRowType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwDeliveryBadge, EwStageStatusBadge } from "./ew-status-badge";
import { EwFollowUpDialog } from "./ew-follow-up-dialog";
import { formatDateTime, stageLabel } from "./extended-warranty-helpers";
import { resendEwLeadAlert } from "./send-ew-reminders";

const PAGE_SIZE = 50;

type Props = {
	/** Set by the staff alert's deep link — opens this lead's follow-up dialog on arrival. */
	focusCustomerId?: number;
	focusStage?: number;
	onChanged: () => void;
};

/**
 * Channel 2 of the two follow-up channels. Every lead here also went out over WhatsApp
 * to the staff number; the alert's own delivery state is shown per row so a failure is
 * visible and re-sendable rather than silently swallowed — otherwise staff would never
 * learn a customer raised a hand.
 */
export const EwInterestGrid = ({ focusCustomerId, focusStage, onChanged }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);

	const [page, setPage] = useState(0);
	const [followUp, setFollowUp] = useState<{ name: string; id: number; stage: number } | null>(null);
	const [resendingKey, setResendingKey] = useState<string | null>(null);

	const { data, error, loading, refetch } = useGenericQuery<EwInterestRowType>({
		enabled: !!branch?.id,
		sqlArgs: {
			branch_id: branch?.id ?? null,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
			outcome: null,
		},
		sqlId: SQL_MAP.GET_EW_INTEREST_PAGED,
	});

	// The staff alert's deep link lands here with a customer in mind. Open its
	// follow-up dialog as soon as the row is on screen, so tapping the WhatsApp button
	// goes straight to recording the result.
	useEffect(() => {
		if (!focusCustomerId || data.length === 0) return;
		const row = data.find(
			(r) => r.ew_customer_id === focusCustomerId && (focusStage == null || r.stage === focusStage),
		);
		if (row) setFollowUp({ id: row.ew_customer_id, name: row.full_name, stage: row.stage });
	}, [data, focusCustomerId, focusStage]);

	async function handleResend(row: EwInterestRowType) {
		if (!dbName || !schema) return;
		const key = `${row.ew_customer_id}-${row.stage}`;
		setResendingKey(key);
		try {
			const ok = await resendEwLeadAlert(dbName, schema, row.ew_customer_id, row.stage);
			if (ok) {
				toast.success(MESSAGES.SUCCESS_EW_ALERT_RESENT);
				refetch();
			} else {
				toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
			}
		} catch {
			toast.error(MESSAGES.ERROR_EW_RESEND_ALERT_FAILED);
		} finally {
			setResendingKey(null);
		}
	}

	if (loading) return <ReportLoading />;
	if (error) return <ReportError message={MESSAGES.ERROR_EW_INTEREST_LOAD_FAILED} onRetry={refetch} />;
	if (data.length === 0) return <ReportEmpty message={MESSAGES.INFO_EW_NO_INTEREST} />;

	const total = data[0]?.total_count ?? data.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
				<table className="w-full min-w-[940px] text-sm">
					<thead className="sticky top-0 bg-(--cl-surface-2)">
						<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
							<th className="px-3 py-2">Customer</th>
							<th className="px-3 py-2">Mobile</th>
							<th className="px-3 py-2">Stage</th>
							<th className="px-3 py-2">Interested at</th>
							<th className="px-3 py-2">Prefers</th>
							<th className="px-3 py-2">Their note</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2">Staff alert</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{data.map((row) => {
							const key = `${row.ew_customer_id}-${row.stage}`;
							const alertFailed = row.alert_status === "FAILED" || row.alert_status == null;
							return (
								<tr key={key} className="border-t border-(--cl-border) hover:bg-(--cl-hover)">
									<td className="px-3 py-2 font-medium text-(--cl-text)">{row.full_name}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">{row.mobile}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">{stageLabel(row.stage)}</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">
										{formatDateTime(row.interest_at)}
									</td>
									<td className="px-3 py-2 text-(--cl-text-muted)">
										{row.preferred_contact === "WHATSAPP" ? "WhatsApp" : "Call"}
									</td>
									<td className="max-w-[220px] truncate px-3 py-2 text-(--cl-text-muted)">
										{row.customer_remarks || "—"}
									</td>
									<td className="px-3 py-2">
										<EwStageStatusBadge status={row.stage_status} />
									</td>
									<td className="px-3 py-2">
										<div className="flex items-center gap-1.5">
											<EwDeliveryBadge
												status={row.alert_status}
												title={row.alert_error ?? undefined}
											/>
											{alertFailed && (
												<Button
													disabled={resendingKey === key}
													onClick={() => handleResend(row)}
													size="sm"
													title={MESSAGES.INFO_EW_ALERT_NOT_SENT}
													variant="ghost"
												>
													<RefreshCw className="size-3.5" />
												</Button>
											)}
										</div>
									</td>
									<td className="px-3 py-2 text-right">
										<Button
											onClick={() =>
												setFollowUp({
													id: row.ew_customer_id,
													name: row.full_name,
													stage: row.stage,
												})
											}
											size="sm"
											variant="outline"
										>
											Follow up
											{row.follow_up_count > 0 ? ` (${row.follow_up_count})` : ""}
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-end gap-2 text-xs text-(--cl-text-muted)">
					<span>
						{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
					</span>
					<Button disabled={page === 0} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">
						Previous
					</Button>
					<Button
						disabled={(page + 1) * PAGE_SIZE >= total}
						onClick={() => setPage((p) => p + 1)}
						size="sm"
						variant="outline"
					>
						Next
					</Button>
				</div>
			)}

			<EwFollowUpDialog
				customerName={followUp?.name ?? ""}
				ewCustomerId={followUp?.id ?? 0}
				onClose={() => setFollowUp(null)}
				onSaved={() => {
					refetch();
					onChanged();
				}}
				open={!!followUp}
				stage={followUp?.stage ?? null}
			/>
		</div>
	);
};
