import { useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCwIcon } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { useQuery } from "@apollo/client/react";
import { toast } from "sonner";

import { StatsCards } from "../components/stats-cards";
import { SuperAdminLayout } from "../components/super-admin-layout";
import { setStats } from "../store/super-admin-slice";
import type { StatsType } from "../types/index";

import { Button } from "@/components/ui/button";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";

type DashboardStatsDataType = {
	superAdminDashboardStats: StatsType;
};

export const SuperAdminDashboard = () => {
	const dispatch = useAppDispatch();

	const { data, error, loading, refetch } = useQuery<DashboardStatsDataType>(GRAPHQL_MAP.superAdminDashboardStats, {
		notifyOnNetworkStatusChange: true,
	});

	useEffect(() => {
		if (data?.superAdminDashboardStats) {
			dispatch(setStats(data.superAdminDashboardStats));
		}
	}, [data, dispatch]);

	useEffect(() => {
		if (error) {
			toast.error(MESSAGES.ERROR_DASHBOARD_LOAD);
		}
	}, [error]);

	return (
		<SuperAdminLayout>
			<motion.div
				animate={{ opacity: 1 }}
				className="flex flex-col gap-6"
				initial={{ opacity: 0 }}
				transition={{ duration: 0.25 }}
			>
				{/* Page header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
						<p className="mt-1 text-sm text-slate-500">Welcome Super Admin</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
							disabled={loading}
							size="sm"
							variant="outline"
							onClick={() => refetch()}
						>
							<motion.span
								animate={loading ? { rotate: 360 } : { rotate: 0 }}
								transition={
									loading ? { duration: 0.8, ease: "linear", repeat: Infinity } : { duration: 0 }
								}
							>
								<RefreshCwIcon className="h-3.5 w-3.5" />
							</motion.span>
							{loading ? "Refreshing..." : "Refresh"}
						</Button>
					</div>
				</div>

				{loading ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
						))}
					</div>
				) : (
					<StatsCards />
				)}
			</motion.div>
		</SuperAdminLayout>
	);
};
