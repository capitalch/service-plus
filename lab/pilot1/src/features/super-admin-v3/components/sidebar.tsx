import { AnimatePresence, motion } from "framer-motion";
import {
    ActivityIcon,
    ChevronLeftIcon,
    ClipboardListIcon,
    LayoutDashboardIcon,
    SettingsIcon,
    ShieldCheckIcon,
    UsersIcon,
    XIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

type NavItemType = { href: string; icon: React.ElementType; label: string };

const navItems: NavItemType[] = [
    { href: "/super-admin-v3", icon: LayoutDashboardIcon, label: "Dashboard" },
    { href: "/super-admin-v3/clients", icon: UsersIcon, label: "Clients" },
    { href: "/super-admin-v3/admins", icon: ShieldCheckIcon, label: "Admins" },
    { href: "/super-admin-v3/usage", icon: ActivityIcon, label: "Usage & Health" },
    { href: "/super-admin-v3/audit", icon: ClipboardListIcon, label: "Audit Logs" },
    { href: "/super-admin-v3/settings", icon: SettingsIcon, label: "System Settings" },
];

const NavContent = ({
    collapsed,
    isMobile,
    onNav,
    onToggle,
}: {
    collapsed: boolean;
    isMobile: boolean;
    onNav: (href: string) => void;
    onToggle?: () => void;
}) => {
    const location = useLocation();
    const show = !collapsed || isMobile;

    return (
        <div className="flex h-full flex-col">
            {/* Brand */}
            <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500 shadow-lg shadow-violet-900/40">
                    <ShieldCheckIcon className="h-5 w-5 text-white" />
                </div>
                {show && (
                    <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        <p className="text-sm font-bold tracking-wide text-white">ServicePlus</p>
                        <p className="text-[10px] text-slate-400">Super Admin v3</p>
                    </motion.div>
                )}
            </div>

            {show && (
                <div className="px-5 pt-6 pb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Navigation</span>
                </div>
            )}

            <nav className="flex flex-1 flex-col gap-0.5 p-3">
                {navItems.map((item) => {
                    const active = location.pathname === item.href ||
                        (item.href !== "/super-admin-v3" && location.pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                        <button
                            className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                                active
                                    ? "bg-violet-500 text-white shadow-md shadow-violet-900/30"
                                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                            )}
                            key={item.href}
                            onClick={() => onNav(item.href)}
                            title={collapsed && !isMobile ? item.label : undefined}
                            type="button"
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {show && <span className="truncate">{item.label}</span>}
                            {active && show && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-200" />}
                        </button>
                    );
                })}
            </nav>

            <div className="border-t border-white/10 p-3">
                {!isMobile && onToggle && (
                    <button
                        className="flex w-full items-center justify-center rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
                        onClick={onToggle}
                        type="button"
                    >
                        <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
                            <ChevronLeftIcon className="h-4 w-4" />
                        </motion.div>
                    </button>
                )}
            </div>
        </div>
    );
};

export const SidebarV3 = ({
    isMobileOpen,
    onMobileClose,
}: {
    isMobileOpen: boolean;
    onMobileClose: () => void;
}) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const handleNav = (href: string) => { navigate(href); onMobileClose(); };

    return (
        <>
            <motion.aside
                animate={{ width: collapsed ? 64 : 224 }}
                className="relative hidden h-full flex-shrink-0 flex-col bg-[#180a2e] md:flex"
                initial={{ width: 224 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
            >
                <NavContent collapsed={collapsed} isMobile={false} onNav={handleNav} onToggle={() => setCollapsed((p) => !p)} />
            </motion.aside>

            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-black/60 md:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onMobileClose} transition={{ duration: 0.2 }} />
                        <motion.aside animate={{ x: 0 }} className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#180a2e] shadow-2xl md:hidden" exit={{ x: "-100%" }} initial={{ x: "-100%" }} transition={{ duration: 0.25, ease: "easeInOut" }}>
                            <button className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-100" onClick={onMobileClose} type="button">
                                <XIcon className="h-4 w-4" />
                            </button>
                            <NavContent collapsed={false} isMobile={true} onNav={handleNav} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
