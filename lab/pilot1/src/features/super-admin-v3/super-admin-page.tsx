import { motion } from "framer-motion";
import { ArrowLeftIcon, ArrowRightIcon, BarChart3Icon, BuildingIcon, ClipboardListIcon, Layers3Icon, SettingsIcon, ShieldIcon } from "lucide-react";
import { Link } from "react-router-dom";

const modules = [
    {
        description: "Manage system administrators and permissions",
        gradient: "from-violet-500 to-purple-700",
        icon: ShieldIcon,
        label: "Admins",
        to: "/super-admin-v3/admins",
    },
    {
        description: "View and manage all business units",
        gradient: "from-cyan-500 to-blue-600",
        icon: BuildingIcon,
        label: "Clients",
        to: "/super-admin-v3/clients",
    },
    {
        description: "Review system activity and event logs",
        gradient: "from-amber-500 to-orange-600",
        icon: ClipboardListIcon,
        label: "Audit Logs",
        to: "/super-admin-v3/audit",
    },
    {
        description: "Monitor system health and usage metrics",
        gradient: "from-emerald-500 to-teal-600",
        icon: BarChart3Icon,
        label: "Usage Health",
        to: "/super-admin-v3/usage",
    },
    {
        description: "Configure platform-wide settings",
        gradient: "from-rose-500 to-pink-600",
        icon: SettingsIcon,
        label: "System Settings",
        to: "/super-admin-v3/settings",
    },
];

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
        y: 0,
    }),
};

export const SuperAdminV3Page = () => {
    return (
        <div className="min-h-full p-8">
            {/* Back link */}
            <Link
                className="mb-8 flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                to="/landing"
            >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Home
            </Link>

            {/* Header */}
            <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
                initial={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
            >
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1">
                    <Layers3Icon className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-xs font-medium text-violet-700 uppercase tracking-wider">Super Admin · v3</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-br from-violet-600 via-purple-500 to-violet-500 bg-clip-text text-transparent">
                    Administration Panel
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Action dashboard with advanced controls and management tools.
                </p>
            </motion.div>

            {/* Module cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map(({ description, gradient, icon: Icon, label, to }, i) => (
                    <motion.div
                        animate="visible"
                        custom={i}
                        initial="hidden"
                        key={to}
                        variants={cardVariants}
                    >
                        <Link
                            className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg"
                            to={to}
                        >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
                                <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-semibold text-slate-800">{label}</span>
                                    <ArrowRightIcon className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                                </div>
                                <p className="mt-1 text-sm text-slate-500">{description}</p>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
