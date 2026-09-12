import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import type { EwSettingsType } from "@/features/client/types/extended-warranty";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { EwDashboard } from "./ew-dashboard";
import { EwActionsScreen } from "./ew-actions-screen";

// Fallback only — the real list is `reminder_days_before` in App Settings, and this
// must stay in step with _EW_DEFAULT_SETTINGS on the server.
const DEFAULT_STAGES = [60, 30, 7, 0];

/**
 * A `whatsappDeliveryStatus` event. `kind` is a deploy-window hazard: processes that
 * predate it publish without one, so a MISSING kind must default to "JOB" rather than
 * the event being dropped.
 */
type WhatsappDeliveryStatusEventType = {
	error: string | null;
	ew_customer_id?: number;
	kind?: "EW" | "JOB";
	stage?: number;
	status: string;
	target?: "CUSTOMER" | "STAFF";
};

type NavStateType = { ewCustomerId?: number; ewStage?: number };

export const ExtendedWarrantySection = () => {
	const dbName = useAppSelector(selectDbName);
	const schema = useAppSelector(selectSchema);
	const location = useLocation();

	// Set by the staff alert's deep link (/client/custom/ew/<id>-<stage>).
	const navState = (location.state ?? {}) as NavStateType;

	// The staff alert's deep link names one lead, so it opens the Actions tab, which then
	// pops that lead's follow-up dialog itself.
	const [tab, setTab] = useState(navState.ewCustomerId ? "actions" : "dashboard");
	// Set by a Dashboard lead-bucket tile, consumed by the Leads screen as its opening
	// filter. Lives here because the two are sibling tabs.
	const [actionsBucket, setActionsBucket] = useState<number | null>(null);
	const [settings, setSettings] = useState<EwSettingsType | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const bump = useRef(() => setRefreshKey((k) => k + 1)).current;

	// The stage set is DATA, never a hardcoded list — reading it from the setting is
	// what keeps adding a 60-day stage a settings edit rather than a code change.
	const stages = useMemo(() => {
		const configured = settings?.reminder_days_before;
		const list = Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_STAGES;
		return [...list].sort((a, b) => b - a);
	}, [settings]);

	useEffect(() => {
		if (!dbName || !schema) return;
		void apolloClient
			.query<{ genericQuery: { setting_key: string; setting_value: unknown }[] | null }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.genericQuery,
				variables: {
					db_name: dbName,
					schema,
					value: graphQlUtils.buildGenericQueryValue({ sqlId: SQL_MAP.GET_APP_SETTINGS }),
				},
			})
			.then((res) => {
				const row = (res.data?.genericQuery ?? []).find((s) => s.setting_key === "extended_warranty");
				let parsed: unknown = row?.setting_value;
				if (typeof parsed === "string") {
					try {
						parsed = JSON.parse(parsed);
					} catch {
						/* keep raw */
					}
				}
				setSettings((parsed ?? null) as EwSettingsType | null);
			})
			.catch(() => setSettings(null));
	}, [dbName, schema]);

	// Live delivery status. Both the customer reminder and the staff lead alert arrive
	// here; `target` tells them apart so the Message Log and the Interest grid's alert
	// chip refresh independently of one another.
	useEffect(() => {
		if (!dbName) return;
		const sub = apolloClient
			.subscribe<{ whatsappDeliveryStatus: WhatsappDeliveryStatusEventType | null }>({
				query: GRAPHQL_MAP.whatsappDeliveryStatus,
				variables: { db_name: dbName },
			})
			.subscribe({
				next: ({ data }) => {
					const ev = data?.whatsappDeliveryStatus;
					if (!ev) return;
					if ((ev.kind ?? "JOB") !== "EW") return;
					bump();
				},
			});
		return () => sub.unsubscribe();
	}, [dbName, bump]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={setTab} value={tab}>
				<TabsList className="w-full justify-start overflow-x-auto">
					<TabsTrigger value="dashboard">Dashboard</TabsTrigger>
					<TabsTrigger value="actions">Actions</TabsTrigger>
				</TabsList>

				<TabsContent value="dashboard">
					<div className="mt-3 flex min-h-0 flex-1 flex-col">
						<EwDashboard
							key={`dash-${refreshKey}`}
							onChanged={bump}
							onOpenActions={(bucket) => {
								setActionsBucket(bucket);
								setTab("actions");
							}}
							refreshKey={refreshKey}
							stages={stages}
						/>
					</div>
				</TabsContent>

				{/* One working surface. Due / Interested / Customers were three views of the
				    same lead; they are filters here, not screens. */}
				<TabsContent value="actions">
					<div className="mt-3 flex min-h-0 flex-1 flex-col">
						<EwActionsScreen
							key={`actions-${refreshKey}-${actionsBucket ?? "all"}`}
							initialBucket={actionsBucket}
							focusCustomerId={navState.ewCustomerId}
							focusStage={navState.ewStage}
							onChanged={bump}
							stages={stages}
						/>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
};
