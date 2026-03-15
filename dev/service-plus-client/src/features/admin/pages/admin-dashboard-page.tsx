import { useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCwIcon } from "lucide-react";
import { useQuery } from "@apollo/client/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectDbName } from "@/features/auth/store/auth-slice";
import { setStats } from "@/features/admin/store/admin-slice";
import { AdminStatsCards } from "@/features/admin/components/admin-stats-cards";
import type { AdminDashboardStatsType } from "@/features/admin/types";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { AdminLayout } from "../components/admin-layout";

type AdminDashboardDataType = {
    adminDashboardStats: AdminDashboardStatsType;
};

export const AdminDashboardPage = () => {
    const dispatch = useAppDispatch();
    const dbName   = useAppSelector(selectDbName);
    const user     = useAppSelector(selectCurrentUser);

    const { data, error, loading, refetch } = useQuery<AdminDashboardDataType>(
        GRAPHQL_MAP.adminDashboardStats,
        {
            notifyOnNetworkStatusChange: true,
            skip:      !dbName,
            variables: { db_name: dbName ?? '' },
        }
    );

    useEffect(() => {
        if (data?.adminDashboardStats) {
            dispatch(setStats(data.adminDashboardStats));
        }
    }, [data, dispatch]);

    useEffect(() => {
        if (error) {
            toast.error(MESSAGES.ERROR_DASHBOARD_LOAD);
        }
    }, [error]);

    return (
        <AdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Welcome back, {user?.fullName ?? user?.username}.
                        </p>
                    </div>
                    <Button
                        className="gap-1.5 border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                        disabled={loading}
                        size="sm"
                        variant="outline"
                        onClick={() => refetch()}
                    >
                        <motion.span
                            animate={loading ? { rotate: 360 } : { rotate: 0 }}
                            transition={loading ? { duration: 0.8, ease: "linear", repeat: Infinity } : { duration: 0 }}
                        >
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                        </motion.span>
                        {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
                        ))}
                    </div>
                ) : (
                    <AdminStatsCards />
                )}

                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-700">
                    <p className="font-medium">Admin mode is active.</p>
                    <p className="mt-0.5 text-teal-600">
                        Use the sidebar to manage users and view audit logs for your client.
                        Switch to Client Mode to access service management features.
                    </p>
                </div>
            </motion.div>
        </AdminLayout>
    );
};
