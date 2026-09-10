import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type { EwDrilldownRowType } from "@/features/client/types/extended-warranty";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentBranch } from "@/store/context-slice";

import { ReportEmpty } from "../../reports/common/report-empty";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwDeliveryBadge, EwStageStatusBadge } from "./ew-status-badge";
import { formatDate, formatDateTime, stageLabel } from "./extended-warranty-helpers";

const DRILLDOWN_LIMIT = 500;

export type EwDrilldownFilterType = {
	brand_id?: number | null;
	date_from?: string | null;
	date_to?: string | null;
	delivery_status?: string | null;
	only_interested?: boolean | null;
	stage?: number | null;
	stage_status?: string | null;
};

type Props = {
	description?: string;
	filter: EwDrilldownFilterType | null;
	onClose: () => void;
	title: string;
};

/**
 * ONE dialog and ONE sql id behind every KPI card and every chart segment. Each caller
 * supplies only the filters its card represents and leaves the rest null — which is why
 * GET_EW_DRILLDOWN makes every predicate optional.
 */
export const EwDrilldownDialog = ({ description, filter, onClose, title }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);

	const { data, error, loading, refetch } = useGenericQuery<EwDrilldownRowType>({
		enabled: !!filter,
		sqlArgs: {
			brand_id: filter?.brand_id ?? null,
			branch_id: branch?.id ?? null,
			date_from: filter?.date_from ?? null,
			date_to: filter?.date_to ?? null,
			delivery_status: filter?.delivery_status ?? null,
			limit: DRILLDOWN_LIMIT,
			only_interested: filter?.only_interested ?? null,
			stage: filter?.stage ?? null,
			stage_status: filter?.stage_status ?? null,
		},
		sqlId: SQL_MAP.GET_EW_DRILLDOWN,
	});

	return (
		<Dialog open={!!filter} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>

				{loading && <ReportLoading />}
				{error && <ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={refetch} />}
				{!loading && !error && data.length === 0 && <ReportEmpty />}

				{!loading && !error && data.length > 0 && (
					<div className="max-h-[60vh] overflow-auto rounded-lg border border-(--cl-border)">
						<table className="w-full min-w-[760px] text-sm">
							<thead className="sticky top-0 bg-(--cl-surface-2)">
								<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
									<th className="px-3 py-2">Customer</th>
									<th className="px-3 py-2">Mobile</th>
									<th className="px-3 py-2">Brand</th>
									<th className="px-3 py-2">Stage</th>
									<th className="px-3 py-2">Warranty ends</th>
									<th className="px-3 py-2">Sent</th>
									<th className="px-3 py-2">Delivery</th>
									<th className="px-3 py-2">Lead status</th>
								</tr>
							</thead>
							<tbody>
								{data.map((row) => (
									<tr
										key={`${row.ew_customer_id}-${row.stage}`}
										className="border-t border-(--cl-border)"
									>
										<td className="px-3 py-2 font-medium text-(--cl-text)">{row.full_name}</td>
										<td className="px-3 py-2 text-(--cl-text-muted)">{row.mobile}</td>
										<td className="px-3 py-2 text-(--cl-text-muted)">{row.brand_name || "-"}</td>
										<td className="px-3 py-2 text-(--cl-text-muted)">{stageLabel(row.stage)}</td>
										<td className="px-3 py-2 text-(--cl-text-muted)">
											{formatDate(row.warranty_end_date)}
										</td>
										<td className="px-3 py-2 text-(--cl-text-muted)">
											{formatDateTime(row.sent_at)}
										</td>
										<td className="px-3 py-2">
											<EwDeliveryBadge status={row.delivery_status} />
										</td>
										<td className="px-3 py-2">
											<EwStageStatusBadge status={row.stage_status} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};
