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
import { selectStats } from "@/features/super-admin/super-admin-slice";

type StatCardItemType = {
    accent: string;
    icon: React.ElementType;
    iconBg: string;
    label: string;
    value: number;
};

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" }, y: 0 },
};

export const StatsCards = () => {
    const stats = useSelector(selectStats);

    const statItems: StatCardItemType[] = [
        {
            accent: "text-emerald-600",
            icon: BuildingIcon,
            iconBg: "bg-emerald-100",
            label: "Total Business Units",
            value: stats.totalBu,
        },
        {
            accent: "text-teal-600",
            icon: CheckCircle2Icon,
            iconBg: "bg-teal-100",
            label: "Active BUs",
            value: stats.activeBu,
        },
        {
            accent: "text-slate-500",
            icon: MinusCircleIcon,
            iconBg: "bg-slate-100",
            label: "Inactive BUs",
            value: stats.inactiveBu,
        },
        {
            accent: "text-cyan-600",
            icon: UsersIcon,
            iconBg: "bg-cyan-100",
            label: "Total Admin Users",
            value: stats.totalAdminUsers,
        },
        {
            accent: "text-teal-600",
            icon: CheckCircle2Icon,
            iconBg: "bg-teal-100",
            label: "Active Admin Users",
            value: stats.activeAdminUsers,
        },
        {
            accent: "text-slate-500",
            icon: MinusCircleIcon,
            iconBg: "bg-slate-100",
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
                        <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                            <CardContent className="p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <p className="text-xs font-medium leading-tight text-slate-500">
                                        {item.label}
                                    </p>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                                        <Icon className={`h-4 w-4 ${item.accent}`} />
                                    </div>
                                </div>
                                <p className={`text-2xl font-bold ${item.accent}`}>
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
