import { motion } from "framer-motion";

import { ClientOverviewTable } from "../components/client-overview-table";
import { StatsCards } from "../components/stats-cards";
import { SuperAdminLayout } from "../components/super-admin-layout";
import { Button } from "@/components/ui/button";
import { apolloClient } from "@/lib/apollo-client";
import { gql } from "@apollo/client";
import { GRAPHQL_MAP } from "@/constants/graphql-map";

export const SuperAdminDashboard = () => {
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
                        <Button variant="ghost" onClick={handleTestGraphQl}>Test graphql</Button>
                    </div>
                </div>

                <StatsCards />
                <ClientOverviewTable />
            </motion.div>
        </SuperAdminLayout>
    );

    async function handleTestGraphQl() {
        const res = await apolloClient.query({
            query: GRAPHQL_MAP.genericQuery,
            variables: {
                db_name: "abcdef",
                value: ""
            }
        })
        console.log(res)
    }
};
