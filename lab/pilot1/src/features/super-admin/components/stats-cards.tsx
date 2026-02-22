import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import {
  BuildingIcon,
  CheckCircle2Icon,
  MinusCircleIcon,
  UsersIcon,
} from "lucide-react";
import { useSelector } from "react-redux";

import { Card, CardContent } from "@/components/ui/card";

import { selectStats } from "../super-admin-slice";

type StatCardItemType = {
  icon: React.ElementType;
  iconClass: string;
  label: string;
  value: number;
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" }, y: 0 },
};

export const StatsCards = () => {
  const stats = useSelector(selectStats);

  const statItems: StatCardItemType[] = [
    {
      icon: BuildingIcon,
      iconClass: "text-slate-500",
      label: "Total Business Units",
      value: stats.totalBu,
    },
    {
      icon: CheckCircle2Icon,
      iconClass: "text-emerald-500",
      label: "Active BUs",
      value: stats.activeBu,
    },
    {
      icon: MinusCircleIcon,
      iconClass: "text-slate-400",
      label: "Inactive BUs",
      value: stats.inactiveBu,
    },
    {
      icon: UsersIcon,
      iconClass: "text-slate-500",
      label: "Total Admin Users",
      value: stats.totalAdminUsers,
    },
    {
      icon: CheckCircle2Icon,
      iconClass: "text-emerald-500",
      label: "Active Admin Users",
      value: stats.activeAdminUsers,
    },
    {
      icon: MinusCircleIcon,
      iconClass: "text-slate-400",
      label: "Inactive Admin Users",
      value: stats.inactiveAdminUsers,
    },
  ];

  return (
    <motion.div
      animate="visible"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
      initial="hidden"
      variants={containerVariants}
    >
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <motion.div key={item.label} variants={cardVariants}>
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">
                    {item.label}
                  </p>
                  <Icon className={`h-4 w-4 ${item.iconClass}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {item.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
