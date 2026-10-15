import { useCallback, useEffect, useState } from "react";
import { Loader2, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { DEMO_STATUS_POLL_MS } from "@/constants/timing";
import { apolloClient } from "@/lib/apollo-client";

type DemoRunResultType = {
	customers?: number;
	deliveries?: number;
	error?: string;
	fromDate?: string;
	jobs?: number;
	message?: string;
	purchases?: number;
	sales?: number;
	toDate?: string;
};

type DemoStatusType = {
	buCode: string;
	configured: boolean;
	customers?: number;
	dbName: string;
	jobs?: number;
	lastResult: DemoRunResultType | null;
	newestJobDate?: string | null;
	running: boolean;
};

function describeResult(r: DemoRunResultType): string {
	if (r.error) return MESSAGES.DEMO_DATA_FAILED.replace("{error}", r.error);
	if (r.message) return r.message;
	return MESSAGES.DEMO_DATA_ADDED.replace("{jobs}", String(r.jobs ?? 0))
		.replace("{customers}", String(r.customers ?? 0))
		.replace("{purchases}", String(r.purchases ?? 0))
		.replace("{sales}", String(r.sales ?? 0))
		.replace("{deliveries}", String(r.deliveries ?? 0))
		.replace("{from}", r.fromDate ?? "")
		.replace("{to}", r.toDate ?? "");
}

/**
 * Super Admin → System settings: the live demo's size and the monthly "Add demo data" button
 * (plans/plan.md Step 7). The run happens on the server in the background; this card polls
 * demoStatus until it finishes and then shows its summary.
 */
export const DemoDataCard = () => {
	const [starting, setStarting] = useState(false);
	const [status, setStatus] = useState<DemoStatusType | null>(null);
	const [waitingForRun, setWaitingForRun] = useState(false);

	const loadStatus = useCallback(async (): Promise<DemoStatusType | null> => {
		try {
			const result = await apolloClient.query<{ demoStatus: DemoStatusType }>({
				fetchPolicy: "network-only",
				query: GRAPHQL_MAP.demoStatus,
			});
			const next = result.data?.demoStatus ?? null;
			setStatus(next);
			return next;
		} catch {
			return null;
		}
	}, []);

	useEffect(() => {
		void loadStatus();
	}, [loadStatus]);

	const running = !!status?.running;

	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => {
			void loadStatus().then((next) => {
				if (next && !next.running && waitingForRun && next.lastResult) {
					setWaitingForRun(false);
					const text = describeResult(next.lastResult);
					if (next.lastResult.error) toast.error(text);
					else toast.success(text);
				}
			});
		}, DEMO_STATUS_POLL_MS);
		return () => clearInterval(timer);
	}, [loadStatus, running, waitingForRun]);

	async function handleAddDemoData() {
		setStarting(true);
		try {
			await apolloClient.mutate({ mutation: GRAPHQL_MAP.demoTopUp });
			setWaitingForRun(true);
			await loadStatus();
		} catch {
			toast.error(MESSAGES.DEMO_NOT_AVAILABLE);
		} finally {
			setStarting(false);
		}
	}

	const rows = status?.configured
		? [
				{ label: "Database", value: status.dbName },
				{ label: "Business unit", value: status.buCode },
				{ label: "Jobs", value: String(status.jobs ?? 0) },
				{ label: "Customers", value: String(status.customers ?? 0) },
				{ label: "Newest job date", value: status.newestJobDate ?? "—" },
			]
		: [];

	return (
		<Card className="border border-slate-200/80 bg-white shadow-sm">
			<CardHeader className="px-6 pb-2">
				<CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
					<SparklesIcon className="h-4 w-4 text-indigo-600" />
					Live demo
				</CardTitle>
			</CardHeader>
			<Separator />
			<CardContent className="flex flex-col gap-4 px-6 pb-6 pt-4">
				{!status?.configured ? (
					<p className="text-sm text-slate-500">{MESSAGES.DEMO_DATA_NOT_CONFIGURED}</p>
				) : (
					<>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{rows.map((row) => (
								<div className="flex justify-between gap-4 text-xs" key={row.label}>
									<span className="text-slate-500">{row.label}</span>
									<span className="font-medium text-slate-700">{row.value}</span>
								</div>
							))}
						</div>
						<p className="text-xs text-slate-500">{MESSAGES.DEMO_DATA_CARD_HELP}</p>
						{status.lastResult && !running && (
							<p className={`text-xs ${status.lastResult.error ? "text-red-600" : "text-slate-700"}`}>
								{describeResult(status.lastResult)}
							</p>
						)}
						{running && <p className="text-xs text-indigo-700">{MESSAGES.DEMO_DATA_RUNNING}</p>}
						<div>
							<Button disabled={running || starting} onClick={() => void handleAddDemoData()} size="sm">
								{(running || starting) && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
								Add demo data
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};
