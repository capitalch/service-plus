import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwLeadType, EwLeadsFilterType } from "@/features/client/types/extended-warranty";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectCurrentBranch, selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { ChartCard } from "../../reports/common/chart-card";
import { ReportSection } from "../../reports/common/report-section";
import { useEwLiveRefresh } from "../../shared/use-ew-live-refresh";
import { EwDashboard } from "./ew-dashboard";
import { EwDrilldownView } from "./ew-drilldown-view";
import { EwLeadGrid } from "./ew-lead-grid";
import { EwStateFlowDiagram } from "./ew-state-flow-diagram";
import { useEwLeadActions } from "./use-ew-lead-actions";

type DrillType = { filter: EwLeadsFilterType; title: string };

/** Set by the bell (ewDrill) and by the staff alert's deep link page (ewLeadId). */
type NavStateType = { ewDrill?: "INTERESTED"; ewLeadId?: number };

/**
 * Custom → Extended Warranty (§C7.9): Dashboard / Details / Flow tabs with one New Lead
 * button shared by all three, the drill-down page, one shared set of lead actions and
 * dialogs, and live refresh from the WhatsApp webhook.
 */
export const ExtendedWarrantySection = () => {
	const branch = useAppSelector(selectCurrentBranch);
	const dbName = useAppSelector(selectDbName);
	const location = useLocation();
	const schema = useAppSelector(selectSchema);

	const [drill, setDrill] = useState<DrillType | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [tab, setTab] = useState("dashboard");
	const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
	const actions = useEwLeadActions({ onChanged: bump, refreshKey });
	const handledKeyRef = useRef<string | null>(null);

	// Any change to any lead, by anyone — so a colleague's work appears without a Refresh.
	useEwLiveRefresh(bump);

	// Arrivals from the bell (open the Interested drill-down) or the staff alert's deep link
	// (open that lead: the follow-up dialog when In Progress, its details otherwise).
	useEffect(() => {
		if (handledKeyRef.current === location.key) return;
		const nav = (location.state ?? {}) as NavStateType;
		if (nav.ewDrill === "INTERESTED") {
			handledKeyRef.current = location.key;
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTab("dashboard");
			setDrill({ filter: { state: "INTERESTED" }, title: "Interested" });
			return;
		}
		if (!nav.ewLeadId || !dbName || !schema || !branch?.id) return;
		handledKeyRef.current = location.key;
		void apolloClient
			.query<{ genericQuery: EwLeadType[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({
						sqlArgs: { branch_id: branch.id, ew_lead_id: nav.ewLeadId },
						sqlId: SQL_MAP.GET_EW_LEAD_DETAIL,
					}),
				},
			})
			.then((res) => {
				const row = res.data?.genericQuery?.[0];
				if (!row) toast.info(MESSAGES.INFO_EW_LEAD_NOT_FOUND);
				else if (row.state === "IN_PROGRESS") actions.openFollowUp(row);
				else actions.openDetail(row.ew_lead_id);
			})
			.catch(() => toast.error(MESSAGES.ERROR_EW_LEADS_LOAD_FAILED));
	}, [location.key, dbName, schema, branch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Tabs
				className="flex min-h-0 flex-1 flex-col"
				value={tab}
				onValueChange={(v) => {
					setTab(v);
					setDrill(null);
				}}
			>
				{/* The tab row is also the screen's header: no separate title, and one New Lead
				    button for Dashboard, Details and Flow alike. */}
				<div className="mb-4 flex flex-wrap items-center gap-3">
					<TabsList className="mb-0 min-w-0 flex-1 justify-start overflow-x-auto">
						<TabsTrigger value="dashboard">Dashboard</TabsTrigger>
						<TabsTrigger value="details">Details</TabsTrigger>
						<TabsTrigger value="flow">Flow</TabsTrigger>
					</TabsList>
					<Button
						className="h-10 gap-2 bg-teal-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-teal-700"
						onClick={actions.openNewLead}
					>
						<Plus className="size-5" />
						New Lead
					</Button>
				</div>

				<TabsContent value="dashboard">
					<AnimatePresence mode="wait">
						{drill ? (
							<motion.div
								key="drill"
								animate={{ opacity: 1, x: 0 }}
								className="flex min-h-0 flex-1 flex-col"
								exit={{ opacity: 0, x: 12 }}
								initial={{ opacity: 0, x: 12 }}
								transition={{ duration: 0.18 }}
							>
								<EwDrilldownView
									actions={actions}
									filter={drill.filter}
									refreshKey={refreshKey}
									title={drill.title}
									onBack={() => setDrill(null)}
								/>
							</motion.div>
						) : (
							<motion.div
								key="dashboard"
								animate={{ opacity: 1, x: 0 }}
								className="flex min-h-0 flex-1 flex-col"
								exit={{ opacity: 0, x: -12 }}
								initial={{ opacity: 0, x: -12 }}
								transition={{ duration: 0.18 }}
							>
								<EwDashboard
									refreshKey={refreshKey}
									onOpen={(title, filter) => setDrill({ filter, title })}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</TabsContent>

				<TabsContent value="details">
					<EwLeadGrid actions={actions} filter={{}} refreshKey={refreshKey} showStateFilter />
				</TabsContent>

				<TabsContent value="flow">
					<ReportSection>
						<ChartCard description="How a lead moves from entry to closing" title="State flow">
							<EwStateFlowDiagram />
						</ChartCard>
					</ReportSection>
				</TabsContent>
			</Tabs>

			{actions.dialogs}
		</div>
	);
};
