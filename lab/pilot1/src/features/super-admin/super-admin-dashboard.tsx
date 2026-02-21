import { motion } from "framer-motion";

import { ClientOverviewTable } from "./components/client-overview-table";
import { StatsCards } from "./components/stats-cards";
import { SuperAdminLayout } from "./components/super-admin-layout";

export const SuperAdminDashboard = () => {
  return (
    <SuperAdminLayout>
      <motion.div
        animate={{ opacity: 1 }}
        className="flex flex-col gap-6"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <StatsCards />
        <ClientOverviewTable />
      </motion.div>
    </SuperAdminLayout>
  );
};
