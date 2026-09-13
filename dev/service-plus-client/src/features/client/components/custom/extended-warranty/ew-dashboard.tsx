import { useMemo, useState } from "react";
import { ListChecks, MailX } from "lucide-react";

import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type { EwDashboardOverviewType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../../reports/common/chart-card";
import { KpiCard } from "../../reports/common/kpi-card";
import { KpiGrid } from "../../reports/common/kpi-grid";
import { ReportError } from "../../reports/common/report-error";
import { ReportSection } from "../../reports/common/report-section";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { bucketsFromStages } from "./extended-warranty-helpers";
import { EwCustomerDialog } from "./ew-customer-dialog";
import { EwDrilldownDialog } from "./ew-drilldown-dialog";
import { EwFunnelFlow } from "./ew-funnel-flow";
import { EwReminderLogGrid } from "./ew-reminder-log-grid";
import type { EwDrilldownFilterType } from "./ew-drilldown-dialog";

// How far past expiry a record still counts — the same grace the send path uses.
const GRACE_DAYS = -7;

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function weekStartIso(): string {
	const d = new Date();
	// Postgres date_trunc('week') is Monday-based; match it so the tile and the count agree.
	const offset = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - offset);
	return d.toISOString().slice(0, 10);
}

function monthStartIso(): string {
	const d = new Date();
	return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

type DrilldownStateType = { description?: string; filter: EwDrilldownFilterType; title: string };

type Props = {
	/** Bump the section's refresh key after a customer is added here. */
	onChanged: () => void;
	/** Expiry tiles hand off to the Actions tab rather than opening a dialog. */
	onOpenActions: (bucket: number | null) => void;
	refreshKey: number;
	stages: number[];
};

/**
 * Assembled entirely from `reports/common/` plus the flow graphic. Two drill surfaces,
 * deliberately: stage-based numbers open `EwDrilldownDialog` (they are customer x stage
 * rows), while LEAD-bucket tiles navigate to the Leads screen — a never-messaged lead has
 * no `ew_stage_v` row, so there is nothing for the drill-down to show.
 */
export const EwDashboard = ({ onChanged, onOpenActions, refreshKey, stages }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const [leadDialogOpen, setLeadDialogOpen] = useState(false);
	const [drilldown, setDrilldown] = useState<DrilldownStateType | null>(null);

	const buckets = useMemo(() => bucketsFromStages(stages, GRACE_DAYS), [stages]);

	const overview = useGenericQuery<EwDashboardOverviewType>({
		enabled: !!branch?.id,
		sqlArgs: { branch_id: branch?.id ?? null, grace_days: GRACE_DAYS, stages },
		sqlId: SQL_MAP.GET_EW_DASHBOARD_OVERVIEW,
	});

	const o = overview.data[0];
	const conversionRate = o && o.interested > 0 ? Math.round((o.won / o.interested) * 100) : 0;
	const loading = overview.loading;

	function openDrilldown(title: string, filter: EwDrilldownFilterType, description?: string) {
		setDrilldown({ description, filter, title });
	}

	if (overview.error) {
		return <ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={overview.refetch} />;
	}

	// The flow graphic's node -> what it drills into.
	function openFlowNode(key: string) {
		if (key === "leads")
			return openDrilldown(
				"All leads",
				{ all_leads: true },
				"Every lead recorded in the system, messaged or not.",
			);
		if (key === "sent") return openDrilldown("Messages sent", {});
		if (key === "interested") return openDrilldown("Customers who showed interest", { only_interested: true });
		if (key === "followed_up") return openDrilldown("Leads followed up", { has_follow_up: true });
		if (key === "won") return openDrilldown("Won", { stage_status: "CONVERTED" });
		if (key === "lost") return openDrilldown("Lost", { lost: true });
	}

	return (
		<ReportSection>
			<ChartCard
				description="Where every lead stands. Click any stage to see the customers behind it."
				title="Lead Flow"
			>
				<EwFunnelFlow
					conversionRate={conversionRate}
					onNewLead={() => setLeadDialogOpen(true)}
					failed={o?.failed ?? 0}
					followedUp={o?.followed_up ?? 0}
					interested={o?.interested ?? 0}
					leads={o?.leads_total ?? 0}
					lost={o?.lost ?? 0}
					onSelect={openFlowNode}
					sent={o?.sent_total ?? 0}
					won={o?.won ?? 0}
				/>
			</ChartCard>

			{/* LEADS — the whole pool per expiry window, messaged or not. These tiles hand
			    off to the Leads screen with the bucket pre-selected rather than opening a
			    dialog, because a never-messaged lead has no row for a drill-down to find. */}
			<ChartCard
				description="Everyone whose warranty falls in each window. Opens the Actions tab, filtered."
				title="Leads"
			>
				{/* Not KpiGrid: the number of tiles is the number of configured stages plus
				    Overdue, so a fixed column count would strand the last one on its own
				    row. Flexing each tile keeps them on one line for any stage set, and
				    the min-width is what makes them wrap rather than crush on mobile. */}
				<div className="flex flex-wrap gap-3 p-4 [&>*]:min-w-36 [&>*]:flex-1">
					{buckets.map((bucket) => (
						<KpiCard
							key={bucket.label}
							icon={ListChecks}
							label={bucket.label}
							loading={loading}
							onClick={() => onOpenActions(bucket.value)}
							value={String(
								bucket.value === -1
									? (o?.leads_overdue ?? 0)
									: (o?.lead_buckets?.[String(bucket.value)] ?? 0),
							)}
						/>
					))}
				</div>
			</ChartCard>

			{/* MESSAGE SENT — cumulative, not exclusive: this week includes today. The
			    labels read that way, so the numbers should not be expected to sum. */}
			<ChartCard description="Reminders sent. Periods overlap — this week includes today." title="Messages sent">
				<div className="p-4">
					<KpiGrid columns={4}>
						<KpiCard
							label="Today"
							loading={loading}
							onClick={() => openDrilldown("Sent today", { date_from: todayIso() })}
							value={String(o?.sent_today ?? 0)}
						/>
						<KpiCard
							label="This week"
							loading={loading}
							onClick={() => openDrilldown("Sent this week", { date_from: weekStartIso() })}
							value={String(o?.sent_week ?? 0)}
						/>
						<KpiCard
							label="This month"
							loading={loading}
							onClick={() => openDrilldown("Sent this month", { date_from: monthStartIso() })}
							value={String(o?.sent_month ?? 0)}
						/>
						<KpiCard
							label="Over a month ago"
							loading={loading}
							onClick={() => openDrilldown("Sent over a month ago", { date_to: monthStartIso() })}
							value={String(o?.sent_older ?? 0)}
						/>
					</KpiGrid>
					{(o?.failed ?? 0) > 0 && (
						<button
							className="cursor-pointer mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
							onClick={() => openDrilldown("Failed sends", { delivery_status: "FAILED" })}
							type="button"
						>
							<MailX className="size-3.5" />
							{o?.failed} failed to send
						</button>
					)}
				</div>
			</ChartCard>

			{/* The Message Log used to be its own top-level tab. It is a record you consult
			    after looking at the numbers, not a place you work, so it lives here. */}
			<ChartCard description="Every reminder sent, newest first." title="Message log">
				<EwReminderLogGrid refreshKey={refreshKey} />
			</ChartCard>

			<EwCustomerDialog
				editing={null}
				onOpenChange={setLeadDialogOpen}
				onSuccess={() => {
					setLeadDialogOpen(false);
					overview.refetch();
					onChanged();
				}}
				open={leadDialogOpen}
			/>

			<EwDrilldownDialog
				description={drilldown?.description}
				filter={drilldown?.filter ?? null}
				onClose={() => setDrilldown(null)}
				stages={stages}
				title={drilldown?.title ?? ""}
			/>
		</ReportSection>
	);
};
