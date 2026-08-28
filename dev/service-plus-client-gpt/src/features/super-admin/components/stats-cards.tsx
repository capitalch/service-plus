import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import {
    Building2Icon,
    BuildingIcon,
    UserCogIcon,
    UsersIcon,
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";

import { Card, CardContent } from "@/components/ui/card";
import { selectStats } from "@/features/super-admin/store/super-admin-slice";

type StatGroupType = {
    accent: string;
    active: number;
    barColor: string;
    icon: React.ElementType;
    iconBg: string;
    inactive: number;
    label: string;
    total: number;
};

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" }, y: 0 },
};

export const StatsCards = () => {
    const stats = useAppSelector(selectStats);

    const statGroups: StatGroupType[] = [
        {
            accent: "text-blue-600",
            active: stats.activeClients,
            barColor: "bg-blue-500",
            icon: Building2Icon,
            iconBg: "bg-blue-100",
            inactive: stats.inactiveClients,
            label: "Clients",
            total: stats.totalClients,
        },
        {
            accent: "text-teal-600",
            active: stats.activeBu,
            barColor: "bg-teal-500",
            icon: BuildingIcon,
            iconBg: "bg-teal-100",
            inactive: stats.inactiveBu,
            label: "Business Units",
            total: stats.totalBu,
        },
        {
            accent: "text-cyan-600",
            active: stats.activeAdminUsers,
            barColor: "bg-cyan-500",
            icon: UserCogIcon,
            iconBg: "bg-cyan-100",
            inactive: stats.inactiveAdminUsers,
            label: "Admin Users",
            total: stats.totalAdminUsers,
        },
        {
            accent: "text-violet-600",
            active: stats.activeUsers,
            barColor: "bg-violet-500",
            icon: UsersIcon,
            iconBg: "bg-violet-100",
            inactive: stats.inactiveUsers,
            label: "All Users",
            total: stats.totalUsers,
        },
    ];

    return (
        <motion.div
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            variants={containerVariants}
        >
            {statGroups.map((group) => {
                const Icon = group.icon;
                const activeRatio = group.total > 0 ? (group.active / group.total) * 100 : 0;

                return (
                    <motion.div key={group.label} variants={cardVariants}>
                        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <CardContent className="p-5">
                                {/* Header */}
                                <div className="mb-4 flex items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${group.iconBg}`}>
                                        <Icon className={`h-5 w-5 ${group.accent}`} />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700">{group.label}</p>
                                </div>

                                {/* Total */}
                                <p className={`text-4xl font-bold ${group.accent}`}>{group.total}</p>
                                <p className="mb-3 mt-0.5 text-xs text-slate-400">Total</p>

                                {/* Progress bar */}
                                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${group.barColor}`}
                                        style={{ width: `${activeRatio}%` }}
                                    />
                                </div>

                                {/* Active / Inactive rows */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-emerald-600">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            Active
                                        </span>
                                        <span className="font-semibold text-emerald-600">{group.active}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-slate-400">
                                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                                            Inactive
                                        </span>
                                        <span className="font-semibold text-slate-400">{group.inactive}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};
