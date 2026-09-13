import { useEffect, useRef } from "react";

import { RefreshButton } from "@/components/shared/refresh-button";
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

// Rows in display order. The four indented ones are the breakdown of Messages sent — every
// message is in exactly one of them, so they add up to their parent. There is no separate
// Message summary card: it showed the same three columns of the same data.
const OVERALL_ROWS: EwMatrixRowType[] = [
	{ color: "teal", key: "leads", label: "Leads entered" },
	{ color: "indigo", key: "msg_total", label: "Messages sent" },
	{ color: "blue", indent: true, key: "msg_read", label: "Read" },
	{ color: "green", indent: true, key: "msg_delivered", label: "Delivered" },
	{ color: "red", indent: true, key: "msg_failed", label: "Fail" },
	{ color: "grey", indent: true, key: "msg_awaiting", label: "In transit" },
	{ color: "orange", divider: true, key: "interested", label: "Interested" },
	{ color: "green", key: "won", label: "Won" },
	{ color: "amber", key: "lost", label: "Lost" },
	{ color: "amber", key: "cancelled", label: "Cancelled" },
];

type Props = {
	onOpen: (title: string, filter: EwLeadsFilterType) => void;
	refreshKey: number;
};

/** Dashboard tab (§C7.4): Lead Pipeline, message and overall summaries. The state flow
 * picture lives on its own Flow tab, and New Lead sits in the tab row beside it. */
export const EwDashboard = ({ onOpen, refreshKey }: Props) => {
	const branch = useAppSelector(selectCurrentBranch);
	const { data, error, loading, refetch } = useGenericQuery<EwDashboardType>({
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
			{error ? (
				<ReportError message={MESSAGES.ERROR_EW_DASHBOARD_LOAD_FAILED} onRetry={refetch} />
			) : !row ? (
				<ReportLoading lines={4} />
			) : (
				<>
					{/* One query feeds both cards, so this button re-reads the whole tab. */}
					<ChartCard
						actions={<RefreshButton loading={loading} onClick={refetch} />}
						description="Click a card to see its leads"
						title="Lead Pipeline"
					>
						<EwPipelineSection data={row} onOpen={onOpen} />
					</ChartCard>
					{/* A reference figure, not the point of the screen — no shadow, so it sits
					    behind the Lead Pipeline rather than beside it. */}
					<ChartCard className="shadow-none" title="Overall summary">
						<EwPeriodMatrix caption={MESSAGES.INFO_EW_PERIODS_OVERLAP} data={row} rows={OVERALL_ROWS} />
					</ChartCard>
				</>
			)}
		</ReportSection>
	);
};
