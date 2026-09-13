import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import type { EwDashboardType, EwLeadsFilterType } from "@/features/client/types/extended-warranty";
import { selectCurrentBranch } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../../reports/common/chart-card";
import { ReportError } from "../../reports/common/report-error";
import { ReportLoading } from "../../reports/common/report-loading";
import { ReportSection } from "../../reports/common/report-section";
import { useGenericQuery } from "../../reports/common/use-generic-query";
import { EwPeriodMatrix } from "./ew-period-matrix";
import type { EwMatrixRowType } from "./ew-period-matrix";
import { EwPipelineSection } from "./ew-pipeline-section";
import { EwStateFlowDiagram } from "./ew-state-flow-diagram";

// Rows in display order.
const MESSAGE_ROWS: EwMatrixRowType[] = [
	{ color: "blue", key: "msg_read", label: "Read" },
	{ color: "green", key: "msg_delivered", label: "Delivered" },
	{ color: "red", key: "msg_failed", label: "Fail" },
];

const OVERALL_ROWS: EwMatrixRowType[] = [
	{ color: "teal", key: "leads", label: "Leads entered" },
	{ color: "indigo", key: "msg_total", label: "Messages sent" },
	{ color: "blue", indent: true, key: "msg_read", label: "Read" },
	{ color: "green", indent: true, key: "msg_delivered", label: "Delivered" },
	{ color: "red", indent: true, key: "msg_failed", label: "Fail" },
	{ color: "orange", key: "interested", label: "Interested" },
	{ color: "green", key: "won", label: "Won" },
	{ color: "red", key: "lost", label: "Lost" },
	{ color: "red", key: "cancelled", label: "Cancelled" },
];

type Props = {
	onNewLead: () => void;
	onOpen: (title: string, filter: EwLeadsFilterType) => void;
	refreshKey: number;
};

/** Dashboard tab (§C7.4): flow picture, Lead Pipeline, message and overall summaries. */
export const EwDashboard = ({ onNewLead, onOpen, refreshKey }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const { data, error, refetch } = useGenericQuery<EwDashboardType>({
		enabled: !!branch?.id,
		sqlArgs: { branch_id: branch?.id ?? null },
		sqlId: SQL_MAP.GET_EW_DASHBOARD,
	});
	const row = data[0];

	// Refetch in place on every change — a live WhatsApp status bumps refreshKey often, and
	// keeping the old numbers on screen avoids a skeleton flash each time.
	const firstRef = useRef(true);
	useEffect(() => {
		if (firstRef.current) {
			firstRef.current = false;
			return;
		}
		refetch();
	}, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<ReportSection>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-bold tracking-tight text-(--cl-text)">Extended Warranty</h2>
				<Button className="bg-teal-600 text-white hover:bg-teal-700" size="sm" onClick={onNewLead}>
					<Plus className="h-4 w-4" />
					New Lead
				</Button>
			</div>

			<ChartCard description="How a lead moves from entry to closing" title="State flow">
				<EwStateFlowDiagram />
			</ChartCard>

			{error ? (
				<ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={refetch} />
			) : !row ? (
				<ReportLoading lines={4} />
			) : (
				<>
					<ChartCard description="Click a card to see its leads" title="Lead Pipeline">
						<EwPipelineSection data={row} onOpen={onOpen} />
					</ChartCard>
					<ChartCard title="Message summary">
						<EwPeriodMatrix
							caption={MESSAGES.INFO_EW_PERIODS_OVERLAP}
							data={row}
							footnote={{ key: "msg_awaiting", label: "In transit" }}
							rows={MESSAGE_ROWS}
						/>
					</ChartCard>
					<ChartCard title="Overall summary">
						<EwPeriodMatrix caption={MESSAGES.INFO_EW_PERIODS_OVERLAP} data={row} rows={OVERALL_ROWS} />
					</ChartCard>
				</>
			)}
		</ReportSection>
	);
};
