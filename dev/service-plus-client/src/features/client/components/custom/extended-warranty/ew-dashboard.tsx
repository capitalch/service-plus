import { useMemo, useState } from "react";
import { CheckCircle2, Clock, HeartHandshake, MailX, MessageSquare, Send, ShieldOff, UserPlus } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type {
	EwDashboardKpisType,
	EwFunnelRowType,
	EwStageStatusType,
} from "@/features/client/types/extended-warranty";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../../reports/common/chart-card";
import { KpiCard } from "../../reports/common/kpi-card";
import { KpiGrid } from "../../reports/common/kpi-grid";
import { ReportError } from "../../reports/common/report-error";
import { ReportSection } from "../../reports/common/report-section";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EW_STAGE_STATUS_CLASS, EW_STAGE_STATUS_LABEL, stageLabel } from "./extended-warranty-helpers";
import { EwDrilldownDialog } from "./ew-drilldown-dialog";
import type { EwDrilldownFilterType } from "./ew-drilldown-dialog";

type TrendRowType = { converted: number; interested: number; month: string; sent: number };

// How far ahead "due" reaches for the KPI, and how far past expiry a record still
// counts — the same grace the send path uses.
const WINDOW_DAYS = 30;
const GRACE_DAYS = -7;
const TREND_MONTHS = 6;

const FUNNEL_ORDER: EwStageStatusType[] = [
	"MESSAGE_SENT",
	"INTERESTED",
	"FOLLOWED_UP",
	"CONVERTED",
	"NOT_INTERESTED",
	"UNREACHABLE",
];

type DrilldownStateType = { description?: string; filter: EwDrilldownFilterType; title: string };

type Props = { stages: number[] };

/**
 * Assembled entirely from `reports/common/` — KpiGrid/KpiCard/ChartCard and the same
 * `{ description, filter, title }` drill-down state object `dashboard-section.tsx`
 * already uses. Every KPI and every funnel segment sets that state, so the whole
 * surface drills through one dialog and one sql id.
 */
export const EwDashboard = ({ stages }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const [drilldown, setDrilldown] = useState<DrilldownStateType | null>(null);

	const commonArgs = useMemo(() => ({ branch_id: branch?.id ?? null, date_from: null, date_to: null }), [branch?.id]);

	const kpis = useGenericQuery<EwDashboardKpisType>({
		enabled: !!branch?.id,
		sqlArgs: { ...commonArgs, grace_days: GRACE_DAYS, window_days: WINDOW_DAYS },
		sqlId: SQL_MAP.GET_EW_DASHBOARD_KPIS,
	});
	const funnel = useGenericQuery<EwFunnelRowType>({
		enabled: !!branch?.id,
		sqlArgs: commonArgs,
		sqlId: SQL_MAP.GET_EW_FUNNEL_BY_STAGE,
	});
	const trend = useGenericQuery<TrendRowType>({
		enabled: !!branch?.id,
		sqlArgs: { branch_id: branch?.id ?? null, months: TREND_MONTHS },
		sqlId: SQL_MAP.GET_EW_MONTHLY_TREND,
	});

	const k = kpis.data[0];
	const conversionRate = k && k.interested > 0 ? Math.round((k.converted / k.interested) * 100) : 0;

	function openDrilldown(title: string, filter: EwDrilldownFilterType, description?: string) {
		setDrilldown({ description, filter, title });
	}

	if (kpis.error) {
		return <ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={kpis.refetch} />;
	}

	const funnelMax = Math.max(1, ...funnel.data.map((r) => r.cnt));

	return (
		<ReportSection>
			<KpiGrid columns={4}>
				<KpiCard
					icon={Clock}
					label="Due in next 30 days"
					loading={kpis.loading}
					onClick={() => openDrilldown("Due in the next 30 days", { stage: null })}
					value={String(k?.due_in_window ?? 0)}
				/>
				<KpiCard
					icon={UserPlus}
					label="Never contacted"
					loading={kpis.loading}
					subValue="no reminder sent yet"
					value={String(k?.not_contacted ?? 0)}
				/>
				<KpiCard
					icon={Send}
					label="Messages sent"
					loading={kpis.loading}
					onClick={() => openDrilldown("Messages sent", {})}
					value={String(k?.messages_sent ?? 0)}
				/>
				<KpiCard
					icon={MessageSquare}
					label="Delivered"
					loading={kpis.loading}
					onClick={() => openDrilldown("Delivered messages", { delivery_status: "DELIVERED" })}
					value={String(k?.delivered ?? 0)}
				/>
				<KpiCard
					accentClassName="text-violet-600"
					icon={HeartHandshake}
					label="Interested"
					loading={kpis.loading}
					onClick={() => openDrilldown("Customers who showed interest", { only_interested: true })}
					value={String(k?.interested ?? 0)}
				/>
				<KpiCard
					accentClassName="text-emerald-600"
					icon={CheckCircle2}
					label="Converted"
					loading={kpis.loading}
					onClick={() => openDrilldown("Converted leads", { stage_status: "CONVERTED" })}
					subValue={`${conversionRate}% of interested`}
					value={String(k?.converted ?? 0)}
				/>
				<KpiCard
					icon={MailX}
					label="Failed to send"
					loading={kpis.loading}
					onClick={() => openDrilldown("Failed sends", { delivery_status: "FAILED" })}
					value={String(k?.failed ?? 0)}
				/>
				<KpiCard icon={ShieldOff} label="Opted out" loading={kpis.loading} value={String(k?.opted_out ?? 0)} />
			</KpiGrid>

			<ChartCard description="Click any bar to see the customers behind it." title="Funnel by reminder stage">
				<div className="space-y-4 p-4">
					{stages.map((stage) => {
						const rows = funnel.data.filter((r) => r.stage === stage);
						const total = rows.reduce((sum, r) => sum + r.cnt, 0);
						return (
							<div key={stage}>
								<div className="mb-1.5 flex items-baseline justify-between">
									<span className="text-xs font-bold tracking-tight text-(--cl-text)">
										{stageLabel(stage)}
									</span>
									<span className="text-xs text-(--cl-text-muted)">{total} sent</span>
								</div>
								<div className="flex gap-1">
									{FUNNEL_ORDER.map((statusKey) => {
										const cnt = rows.find((r) => r.stage_status === statusKey)?.cnt ?? 0;
										if (cnt === 0) return null;
										return (
											<button
												key={statusKey}
												className={`rounded px-2 py-1 text-[11px] font-semibold ${EW_STAGE_STATUS_CLASS[statusKey]}`}
												onClick={() =>
													openDrilldown(
														`${stageLabel(stage)} · ${EW_STAGE_STATUS_LABEL[statusKey]}`,
														{ stage, stage_status: statusKey },
													)
												}
												style={{ flexGrow: Math.max(cnt / funnelMax, 0.08) }}
												title={`${EW_STAGE_STATUS_LABEL[statusKey]}: ${cnt}`}
												type="button"
											>
												{EW_STAGE_STATUS_LABEL[statusKey]} · {cnt}
											</button>
										);
									})}
									{total === 0 && (
										<span className="text-xs text-(--cl-text-muted)">
											Nothing sent at this stage yet.
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</ChartCard>

			<ChartCard description={`Last ${TREND_MONTHS} months`} title="Monthly trend">
				<div className="overflow-x-auto p-4">
					<table className="w-full min-w-[320px] text-sm">
						<thead>
							<tr className="text-left text-xs font-bold tracking-tight text-(--cl-text)">
								<th className="pb-2">Month</th>
								<th className="pb-2 text-right">Sent</th>
								<th className="pb-2 text-right">Interested</th>
								<th className="pb-2 text-right">Converted</th>
							</tr>
						</thead>
						<tbody>
							{trend.data.map((row) => (
								<tr key={row.month} className="border-t border-(--cl-border)">
									<td className="py-1.5 text-(--cl-text)">{row.month}</td>
									<td className="py-1.5 text-right text-(--cl-text-muted)">{row.sent}</td>
									<td className="py-1.5 text-right text-(--cl-text-muted)">{row.interested}</td>
									<td className="py-1.5 text-right text-(--cl-text-muted)">{row.converted}</td>
								</tr>
							))}
							{trend.data.length === 0 && (
								<tr>
									<td className="py-3 text-xs text-(--cl-text-muted)" colSpan={4}>
										Nothing sent yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</ChartCard>

			<EwDrilldownDialog
				description={drilldown?.description}
				filter={drilldown?.filter ?? null}
				onClose={() => setDrilldown(null)}
				title={drilldown?.title ?? ""}
			/>
		</ReportSection>
	);
};
