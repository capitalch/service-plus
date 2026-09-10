import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type { EwReminderLogRowType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwDeliveryBadge, EwStageStatusBadge } from "./ew-status-badge";
import { formatDateTime, stageLabel } from "./extended-warranty-helpers";

const PAGE_SIZE = 50;

/** `refreshKey` bumps when a live delivery-status event arrives for an EW message. */
type Props = { refreshKey: number };

export const EwReminderLogGrid = ({ refreshKey }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const [page, setPage] = useState(0);

	const { data, error, loading, refetch } = useGenericQuery<EwReminderLogRowType>({
		enabled: !!branch?.id,
		sqlArgs: {
			branch_id: branch?.id ?? null,
			delivery_status: null,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
			// Part of the args key, so a live status push re-runs the query.
			refresh: refreshKey,
			stage: null,
		},
		sqlId: SQL_MAP.GET_EW_REMINDER_LOG_PAGED,
	});

	if (loading) return <ReportLoading />;
	if (error) return <ReportError message={MESSAGES.ERROR_EW_LOG_LOAD_FAILED} onRetry={refetch} />;
	if (data.length === 0) return <ReportEmpty message={MESSAGES.INFO_EW_NO_LOG} />;

	const total = data[0]?.total_count ?? data.length;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-(--cl-border)">
				<table className="w-full min-w-[880px] text-sm">
					<thead className="sticky top-0 bg-(--cl-surface-2)">
						<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
							<th className="px-3 py-2">Customer</th>
							<th className="px-3 py-2">Mobile</th>
							<th className="px-3 py-2">Stage</th>
							<th className="px-3 py-2">Sent</th>
							<th className="px-3 py-2">By</th>
							<th className="px-3 py-2">Delivery</th>
							<th className="px-3 py-2">Lead status</th>
						</tr>
					</thead>
					<tbody>
						{data.map((row) => (
							<tr
								key={`${row.ew_customer_id}-${row.stage}`}
								className="border-t border-(--cl-border) hover:bg-(--cl-hover)"
							>
								<td className="px-3 py-2 font-medium text-(--cl-text)">{row.full_name}</td>
								<td className="px-3 py-2 text-(--cl-text-muted)">{row.mobile}</td>
								<td className="px-3 py-2 text-(--cl-text-muted)">{stageLabel(row.stage)}</td>
								<td className="px-3 py-2 text-(--cl-text-muted)">{formatDateTime(row.sent_at)}</td>
								<td className="px-3 py-2 text-(--cl-text-muted)">{row.sent_by_name ?? "Automatic"}</td>
								<td className="px-3 py-2">
									<EwDeliveryBadge status={row.delivery_status} title={row.error ?? undefined} />
								</td>
								<td className="px-3 py-2">
									<EwStageStatusBadge status={row.stage_status} />
								</td>
							</tr>
						))}
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
		</div>
	);
};
