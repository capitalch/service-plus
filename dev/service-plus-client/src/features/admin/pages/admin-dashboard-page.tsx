import { motion } from "framer-motion";
import { ShieldCheckIcon, UsersIcon, BuildingIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectSelectedClientId } from "@/features/auth/store/auth-slice";
import { AdminLayout } from "../components/admin-layout";

const cardVariants = {
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.08, duration: 0.3, ease: "easeOut" as const },
        y: 0,
    }),
};

type StatCardPropsType = {
    icon:  React.ElementType;
    label: string;
    sub:   string;
    value: string;
};

function StatCard({ icon: Icon, label, sub, value }: StatCardPropsType) {
    return (
        <Card className="border border-slate-200/80 bg-white shadow-sm">
            <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-teal-500" />
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                </div>
                <p className="text-2xl font-bold text-teal-600">{value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
            </CardContent>
        </Card>
    );
}

export const AdminDashboardPage = () => {
    const user     = useAppSelector(selectCurrentUser);
    const clientId = useAppSelector(selectSelectedClientId);

    return (
        <AdminLayout>
            <motion.div
                animate={{ opacity: 1 }}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
            >
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Welcome back, {user?.fullName ?? user?.username}.
                        {clientId && <span className="ml-1 text-slate-400">Client ID: {clientId}</span>}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { icon: UsersIcon,       label: "Admin Users",    sub: "In this client database", value: "—" },
                        { icon: BuildingIcon,    label: "Business Units", sub: "Active BUs",              value: "—" },
                        { icon: ShieldCheckIcon, label: "Audit Events",   sub: "Last 7 days",             value: "—" },
                    ].map((card, i) => (
                        <motion.div animate="visible" custom={i} initial="hidden" key={card.label} variants={cardVariants}>
                            <StatCard icon={card.icon} label={card.label} sub={card.sub} value={card.value} />
                        </motion.div>
                    ))}
                </div>

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
