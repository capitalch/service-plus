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
import { EwDeliveryBadge, EwSendHistory, EwStageStatusBadge } from "./ew-status-badge";
import { formatDate, formatDateTime, stageLabel } from "./extended-warranty-helpers";

const DRILLDOWN_LIMIT = 500;

export type EwDrilldownFilterType = {
	/**
	 * Read every LEAD from ew_customer instead of the stage view. The two populations are
	 * not the same: a customer who has never been messaged has no ew_stage_v row, so the
	 * default source cannot see them and would under-count against the Lead Flow node.
	 * Set only by the "All Leads" node.
	 */
	all_leads?: boolean;
	brand_id?: number | null;
	date_from?: string | null;
	date_to?: string | null;
	delivery_status?: string | null;
	has_follow_up?: boolean | null;
	lost?: boolean | null;
	only_interested?: boolean | null;
	stage?: number | null;
	stage_status?: string | null;
};

type Props = {
	description?: string;
	filter: EwDrilldownFilterType | null;
	onClose: () => void;
	/** Needed only by the all-leads source, whose query derives buckets from the stages. */
	stages: number[];
	title: string;
};

/**
 * ONE dialog and ONE sql id behind every KPI card and every chart segment. Each caller
 * supplies only the filters its card represents and leaves the rest null — which is why
 * GET_EW_DRILLDOWN makes every predicate optional.
 */
export const EwDrilldownDialog = ({ description, filter, onClose, stages, title }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);

	const allLeads = filter?.all_leads === true;

	// Both queries return the same columns this table renders — the lead source simply has
	// nulls where a customer has never been messaged — so one table serves both.
	const { data, error, loading, refetch } = useGenericQuery<EwDrilldownRowType>({
		enabled: !!filter,
		sqlArgs: allLeads
			? {
					branch_id: branch?.id ?? null,
					days_left_max: null,
					days_left_min: null,
					grace_days: -7,
					limit: DRILLDOWN_LIMIT,
					offset: 0,
					outcome: null,
					search: null,
					stages,
					status: null,
				}
			: {
					brand_id: filter?.brand_id ?? null,
					branch_id: branch?.id ?? null,
					date_from: filter?.date_from ?? null,
					date_to: filter?.date_to ?? null,
					delivery_status: filter?.delivery_status ?? null,
					has_follow_up: filter?.has_follow_up ?? null,
					limit: DRILLDOWN_LIMIT,
					lost: filter?.lost ?? null,
					only_interested: filter?.only_interested ?? null,
					stage: filter?.stage ?? null,
					stage_status: filter?.stage_status ?? null,
				},
		sqlId: allLeads ? SQL_MAP.GET_EW_LEADS_PAGED : SQL_MAP.GET_EW_DRILLDOWN,
	});

	return (
		<Dialog open={!!filter} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="w-[95vw] max-w-6xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{(description || data.length > 0) && (
						<DialogDescription>
							{description}
							{data.length > 0 && (
								<span className={description ? "ml-1" : ""}>
									{data.length === DRILLDOWN_LIMIT
										? `Showing the first ${DRILLDOWN_LIMIT}.`
										: `${data.length} row${data.length === 1 ? "" : "s"}.`}
								</span>
							)}
						</DialogDescription>
					)}
				</DialogHeader>

				{loading && <ReportLoading />}
				{error && <ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={refetch} />}
				{!loading && !error && data.length === 0 && <ReportEmpty />}

				{!loading && !error && data.length > 0 && (
					<div className="max-h-[65vh] overflow-auto rounded-lg border border-(--cl-border)">
						<table className="w-full min-w-[820px] text-sm">
							<thead className="sticky top-0 z-10 bg-(--cl-surface-2) shadow-[0_1px_0_var(--cl-border)]">
								<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
									<th className="px-3 py-2.5">Customer</th>
									<th className="px-3 py-2.5">Device</th>
									<th className="px-3 py-2.5">Warranty ends</th>
									<th className="px-3 py-2.5">Reminder</th>
									<th className="px-3 py-2.5">Sent</th>
									<th className="px-3 py-2.5">Delivery</th>
									<th className="px-3 py-2.5">Lead status</th>
								</tr>
							</thead>
							<tbody>
								{data.map((row) => (
									<tr
										key={`${row.ew_customer_id}-${row.stage}`}
										className="border-t border-(--cl-border) transition-colors hover:bg-(--cl-hover)"
									>
										{/* Name over mobile, matching the Actions grid — one column instead
										    of two, which is where the extra width for Device comes from. */}
										<td className="px-3 py-2.5">
											<div className="font-medium text-(--cl-text)">{row.full_name}</div>
											<div className="text-xs text-(--cl-text-muted)">{row.mobile}</div>
										</td>
										<td className="px-3 py-2.5">
											<div className="text-(--cl-text-muted)">
												{[row.brand_name, row.product_label].filter(Boolean).join(" · ") || "-"}
											</div>
											{row.serial_no && (
												<div className="text-xs text-(--cl-text-muted)">SN {row.serial_no}</div>
											)}
										</td>
										<td className="px-3 py-2.5 whitespace-nowrap text-(--cl-text-muted)">
											{formatDate(row.warranty_end_date)}
										</td>
										<td className="px-3 py-2.5 whitespace-nowrap text-(--cl-text-muted)">
											{row.stage == null ? "Not messaged" : stageLabel(row.stage)}
										</td>
										{/* The all-leads source carries every send; the stage source is
										    already one row per send, so it shows just that one. */}
										<td className="px-3 py-2.5 whitespace-nowrap text-(--cl-text-muted)">
											{allLeads ? (
												<EwSendHistory sends={row.sends} />
											) : (
												formatDateTime(row.sent_at)
											)}
										</td>
										<td className="px-3 py-2.5">
											<EwDeliveryBadge status={row.delivery_status} />
										</td>
										<td className="px-3 py-2.5">
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
