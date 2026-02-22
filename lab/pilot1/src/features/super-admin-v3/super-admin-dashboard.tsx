import { motion } from "framer-motion";
import { BuildingIcon, CheckCircle2Icon, MinusCircleIcon, UsersIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { selectStats } from "@/features/super-admin/super-admin-slice";
import { SuperAdminLayoutV3 } from "./components/super-admin-layout";
import { ClientOverviewTableV3 } from "./components/client-overview-table";

const statItems = [
    { accent: "text-violet-600", icon: BuildingIcon, iconBg: "bg-violet-50", key: "totalBu" as const, label: "Total Business Units" },
    { accent: "text-emerald-600", icon: CheckCircle2Icon, iconBg: "bg-emerald-50", key: "activeBu" as const, label: "Active BUs" },
    { accent: "text-cyan-600", icon: UsersIcon, iconBg: "bg-cyan-50", key: "totalAdminUsers" as const, label: "Total Admins" },
    { accent: "text-slate-500", icon: MinusCircleIcon, iconBg: "bg-slate-50", key: "inactiveAdminUsers" as const, label: "Inactive Admins" },
];

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" as const }, y: 0 } };

export const SuperAdminDashboardV3 = () => {
    const stats = useSelector(selectStats);
    const navigate = useNavigate();

    return (
        <SuperAdminLayoutV3>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.2 }}>

                {/* Quick Actions */}
                <motion.div animate="visible" className="grid grid-cols-1 gap-4 sm:grid-cols-2" initial="hidden" variants={container}>
                    {/* Add Client card */}
                    <motion.button
                        className="group relative flex cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border border-violet-200 bg-white p-6 text-left shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
                        onClick={() => navigate("/super-admin-v3/clients/add")}
                        type="button"
                        variants={item}
                        whileHover={{ scale: 1.01 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-transparent opacity-60" />
                        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 shadow-inner group-hover:bg-violet-200 transition-colors">
                            <BuildingIcon className="h-7 w-7 text-violet-600" />
                        </div>
                        <div className="relative">
                            <p className="text-sm font-semibold text-slate-500">Quick Action</p>
                            <h3 className="text-xl font-bold text-slate-900">Add Client</h3>
                            <p className="mt-0.5 text-xs text-slate-400">Register a new business unit in 3 steps</p>
                        </div>
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-light text-violet-200 group-hover:text-violet-300 transition-colors">→</span>
                    </motion.button>

                    {/* Add Admin card */}
                    <motion.button
                        className="group relative flex cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
                        onClick={() => navigate("/super-admin-v3/admins/add")}
                        type="button"
                        variants={item}
                        whileHover={{ scale: 1.01 }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-60" />
                        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 shadow-inner group-hover:bg-slate-200 transition-colors">
                            <UsersIcon className="h-7 w-7 text-slate-700" />
                        </div>
                        <div className="relative">
                            <p className="text-sm font-semibold text-slate-500">Quick Action</p>
                            <h3 className="text-xl font-bold text-slate-900">Add Admin</h3>
                            <p className="mt-0.5 text-xs text-slate-400">Create a new administrator in 3 steps</p>
                        </div>
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-light text-slate-300 group-hover:text-slate-500 transition-colors">→</span>
                    </motion.button>
                </motion.div>

                {/* Stats */}
                <motion.div animate="visible" className="grid grid-cols-2 gap-4 lg:grid-cols-4" initial="hidden" variants={container}>
                    {statItems.map((s) => {
                        const Icon = s.icon;
                        return (
                            <motion.div key={s.key} variants={item}>
                                <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                                    <CardContent className="p-5">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-xs font-medium text-slate-500">{s.label}</p>
                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg}`}>
                                                <Icon className={`h-4 w-4 ${s.accent}`} />
                                            </div>
                                        </div>
                                        <p className={`text-3xl font-bold ${s.accent}`}>{stats[s.key]}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Client list */}
                <ClientOverviewTableV3 />
            </motion.div>
        </SuperAdminLayoutV3>
    );
};
