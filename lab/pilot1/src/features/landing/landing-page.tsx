import { motion } from "framer-motion";
import {
    ArrowRightIcon,
    BarChart3Icon,
    BlocksIcon,
    HelpCircleIcon,
    LayoutDashboardIcon,
    Layers3Icon,
    SettingsIcon,
    ShieldIcon,
    UserCircleIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { authenticate } from "./landing-page-slice";

const modules = [
    {
        badge: "v1",
        badgeColor: "bg-indigo-100 text-indigo-600 border-indigo-200",
        description: "Manage system-level settings and users",
        gradient: "from-blue-500 to-indigo-600",
        hover: "hover:border-indigo-200 hover:shadow-indigo-100",
        icon: ShieldIcon,
        label: "Super Admin",
        to: "/super-admin",
    },
    {
        badge: "v2",
        badgeColor: "bg-emerald-100 text-emerald-600 border-emerald-200",
        description: "Enhanced admin panel with Stitch-inspired UI",
        gradient: "from-emerald-500 to-teal-600",
        hover: "hover:border-emerald-200 hover:shadow-emerald-100",
        icon: LayoutDashboardIcon,
        label: "Super Admin V2",
        to: "/super-admin-v2",
    },
    {
        badge: "v3",
        badgeColor: "bg-violet-100 text-violet-600 border-violet-200",
        description: "Action dashboard with advanced controls",
        gradient: "from-violet-500 to-purple-600",
        hover: "hover:border-violet-200 hover:shadow-violet-100",
        icon: Layers3Icon,
        label: "Super Admin V3",
        to: "/super-admin-v3",
    },
    {
        badge: "ui",
        badgeColor: "bg-amber-100 text-amber-600 border-amber-200",
        description: "Browse reusable UI component examples",
        gradient: "from-amber-500 to-orange-500",
        hover: "hover:border-amber-200 hover:shadow-amber-100",
        icon: BlocksIcon,
        label: "Example Controls",
        to: "/example1",
    },
];

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
        y: 0,
    }),
};

export function LandingPage() {
    const dispatch = useDispatch();

    const handleClick = () => {
        dispatch(authenticate());
    };

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/30">

            {/* ── Top Navigation Bar ── */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-3.5 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
                        <ShieldIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Service Plus</span>
                </div>
                <div className="flex items-center gap-6">
                    <nav className="hidden items-center gap-5 sm:flex">
                        <span className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer transition-colors">Dashboard</span>
                        <span className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer transition-colors flex items-center gap-1">
                            <SettingsIcon className="h-3.5 w-3.5" />
                            Settings
                        </span>
                        <span className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer transition-colors flex items-center gap-1">
                            <HelpCircleIcon className="h-3.5 w-3.5" />
                            Support
                        </span>
                    </nav>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                        <UserCircleIcon className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">Admin User</span>
                    </div>
                </div>
            </header>

            {/* ── Hero + Cards ── */}
            <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 overflow-hidden">

                {/* Soft background blobs */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-indigo-200/30 blur-[80px]" />
                    <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-violet-200/30 blur-[70px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-emerald-100/30 blur-[60px]" />
                </div>

                {/* Hero */}
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="z-10 mb-12 text-center"
                    initial={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="mb-5 inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-200 ring-4 ring-indigo-100">
                        <ShieldIcon className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-indigo-700 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
                        Service Plus
                    </h1>
                    <p className="mt-3 text-sm text-slate-500 max-w-xs mx-auto">
                        Choose a module to get started
                    </p>
                </motion.div>

                {/* Module cards */}
                <div className="z-10 w-full max-w-xl flex flex-col gap-3">
                    {modules.map(({ badge, badgeColor, description, gradient, hover, icon: Icon, label, to }, i) => (
                        <motion.div
                            animate="visible"
                            custom={i}
                            initial="hidden"
                            key={to}
                            variants={cardVariants}
                        >
                            <Link
                                className={`group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${hover}`}
                                onClick={handleClick}
                                to={to}
                            >
                                {/* Icon */}
                                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-semibold text-slate-800">{label}</span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeColor}`}>
                                            {badge}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-500 truncate">{description}</p>
                                </div>

                                {/* Arrow */}
                                <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Hint */}
                <motion.div
                    animate={{ opacity: 1 }}
                    className="z-10 mt-8 flex items-center gap-2 text-xs text-slate-400"
                    initial={{ opacity: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <BarChart3Icon className="h-3.5 w-3.5" />
                    <span>4 modules · Platform v0.1.0</span>
                </motion.div>
            </main>

            {/* ── Footer ── */}
            <footer className="flex items-center justify-between border-t border-slate-200 bg-white/60 px-8 py-3">
                <span className="text-xs text-slate-400">Service Plus — Pilot 1</span>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">Privacy</span>
                    <span className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">Terms</span>
                    <span className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">Help</span>
                </div>
            </footer>
        </div>
    );
}
