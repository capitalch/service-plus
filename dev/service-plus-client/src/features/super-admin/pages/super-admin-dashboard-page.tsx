import { motion } from "framer-motion";

import { ClientOverviewTable } from "../components/client-overview-table";
import { StatsCards } from "../components/stats-cards";
import { SuperAdminLayout } from "../components/super-admin-layout";
import { Button } from "@/components/ui/button";
import { useLazyQuery } from "@apollo/client/react";
import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { MESSAGES } from "@/constants/messages";
import { graphQlUtils } from "@/lib/graphql-utils";
import { SQL_MAP } from "@/constants/sql-map";

export const SuperAdminDashboard = () => {
    const [executeGenericQuery, { loading }] = useLazyQuery(GRAPHQL_MAP.genericQuery);

    return (
        <SuperAdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                {/* Page header */}
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                    <div className="flex items-center gap-2">
                        <p className="mt-1 text-sm text-slate-500">
                            Welcome back, Super Admin
                        </p>
                        <Button disabled={loading} variant="ghost" onClick={handleTestGraphQl}>
                            {loading ? "Testing..." : "Test graphql"}
                        </Button>
                    </div>
                </div>

                <StatsCards />
                <ClientOverviewTable />
            </motion.div>
        </SuperAdminLayout>
    );

    async function handleTestGraphQl() {
        try {
            const res = await executeGenericQuery({
                variables: {
                    db_name: "abcdef",
                    value: graphQlUtils.buildGenericQueryValue({
                        buCode: "abcdef",
                        sqlId: SQL_MAP.GET_ALL_CLIENTS,
                    }),
                },
            });

            if (res.error) {
                console.error("GraphQL test error:", res.error);
                toast.error(MESSAGES.ERROR_SERVER);
                return;
            }

            console.log(res.data);
            toast.success("GraphQL test query executed successfully.");
        } catch (error) {
            console.error("GraphQL test error:", error);
            toast.error(MESSAGES.ERROR_SERVER);
        }
    }
};
