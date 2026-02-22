import { motion } from "framer-motion";
import {
    ActivityIcon,
    CheckCircleIcon,
    KeyRoundIcon,
    LogInIcon,
    MinusCircleIcon,
    SettingsIcon,
    UserPlusIcon,
    UserXIcon,
} from "lucide-react";
import { useState } from "react";
import { useSelector } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SuperAdminLayout } from "../components/super-admin-layout";
import { selectActivityLog } from "@/features/super-admin/super-admin-slice";
import type { ActivityActionType, ActivityLogItemType } from "@/features/super-admin/types";

type FilterType = ActivityActionType | "All";

const actionIcon: Record<ActivityActionType, React.ElementType> = {
    "Admin Added": UserPlusIcon,
    "Admin Deactivated": UserXIcon,
    "Client Created": CheckCircleIcon,
    "Client Disabled": MinusCircleIcon,
    "Login": LogInIcon,
    "Password Reset": KeyRoundIcon,
    "Settings Changed": SettingsIcon,
};

const actionBadge: Record<ActivityActionType, string> = {
    "Admin Added": "border-blue-200 bg-blue-50 text-blue-700",
    "Admin Deactivated": "border-slate-200 bg-slate-100 text-slate-600",
    "Client Created": "border-emerald-200 bg-emerald-100 text-emerald-700",
    "Client Disabled": "border-amber-200 bg-amber-50 text-amber-700",
    "Login": "border-violet-200 bg-violet-50 text-violet-700",
    "Password Reset": "border-sky-200 bg-sky-50 text-sky-700",
    "Settings Changed": "border-orange-200 bg-orange-50 text-orange-700",
};

const filters: FilterType[] = [
    "All", "Client Created", "Client Disabled", "Admin Added",
    "Admin Deactivated", "Login", "Settings Changed", "Password Reset",
];

function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    return date.toLocaleString("en-GB", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string): string {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" as const }, x: 0 },
};

const LogItem = ({ item }: { item: ActivityLogItemType }) => {
    const Icon = actionIcon[item.action];
    return (
        <motion.div className="flex gap-4 border-b border-slate-100 py-4 last:border-b-0" variants={itemVariants}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                {getInitials(item.actorName)}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.actorName}</span>
                    <Badge className={`${actionBadge[item.action]} border`} variant="outline">
                        <Icon className="mr-1 h-3 w-3" />
                        {item.action}
                    </Badge>
                    {item.targetName !== item.actorName && (
                        <span className="text-sm text-slate-600">→ {item.targetName}</span>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                        <ActivityIcon className="h-3 w-3" />
                        {formatTimestamp(item.timestamp)}
                    </span>
                    <span>{item.ipAddress}</span>
                    <span>{item.actorEmail}</span>
                </div>
            </div>
        </motion.div>
    );
};

export const AuditLogsPage = () => {
    const activityLog = useSelector(selectActivityLog);
    const [activeFilter, setActiveFilter] = useState<FilterType>("All");

    const filtered =
        activeFilter === "All" ? activityLog : activityLog.filter((item) => item.action === activeFilter);

    return (
        <SuperAdminLayout>
            <motion.div animate={{ opacity: 1 }} className="flex flex-col gap-6" initial={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
                    <p className="mt-1 text-sm text-slate-500">Track all system actions, user activity, and configuration changes.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {filters.map((f) => (
                        <Button
                            className={`h-7 rounded-full px-3 text-xs ${activeFilter === f ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}`}
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            size="sm"
                            variant={activeFilter === f ? "default" : "outline"}
                        >
                            {f}
                        </Button>
                    ))}
                </div>

                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200 bg-white px-6 shadow-sm"
                    initial={{ opacity: 0, y: 12 }}
                    transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
                >
                    {filtered.length === 0 ? (
                        <p className="py-12 text-center text-sm text-slate-400">No log entries for this filter.</p>
                    ) : (
                        <motion.div animate="visible" initial="hidden" variants={listVariants}>
                            {filtered.map((item) => <LogItem item={item} key={item.id} />)}
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>
        </SuperAdminLayout>
    );
};
