import { AnimatePresence, motion } from "framer-motion";
import {
    ActivityIcon,
    ChevronLeftIcon,
    ClipboardListIcon,
    LayoutDashboardIcon,
    SettingsIcon,
    ShieldIcon,
    UsersIcon,
    XIcon,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

type NavItemType = {
    href: string;
    icon: React.ElementType;
    label: string;
};

type SidebarPropsType = {
    isMobileOpen: boolean;
    onMobileClose: () => void;
};

const navItems: NavItemType[] = [
    { href: "/super-admin-v2", icon: LayoutDashboardIcon, label: "Dashboard" },
    { href: "/super-admin-v2/clients", icon: UsersIcon, label: "Clients" },
    { href: "/super-admin-v2/admins", icon: ShieldIcon, label: "Admins" },
    { href: "/super-admin-v2/usage", icon: ActivityIcon, label: "Usage & Health" },
    { href: "/super-admin-v2/audit", icon: ClipboardListIcon, label: "Audit Logs" },
    { href: "/super-admin-v2/settings", icon: SettingsIcon, label: "System Settings" },
];

const SidebarContent = ({
    collapsed,
    isMobile,
    onNavClick,
    onToggleCollapse,
}: {
    collapsed: boolean;
    isMobile: boolean;
    onNavClick: (href: string) => void;
    onToggleCollapse?: () => void;
}) => {
    const location = useLocation();

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-14 items-center gap-3 border-b border-slate-700/50 px-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500 shadow-lg shadow-emerald-900/40">
                    <ShieldIcon className="h-4 w-4 text-white" />
                </div>
                {(!collapsed || isMobile) && (
                    <motion.span
                        animate={{ opacity: 1 }}
                        className="truncate text-sm font-bold tracking-wide text-white"
                        initial={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        ServicePlus
                    </motion.span>
                )}
            </div>

            {/* Nav label */}
            {(!collapsed || isMobile) && (
                <div className="px-4 pt-5 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        Navigation
                    </span>
                </div>
            )}

            {/* Nav Items */}
            <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <button
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                                isActive
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-900/30"
                                    : "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
                            )}
                            key={item.href}
                            onClick={() => onNavClick(item.href)}
                            title={collapsed && !isMobile ? item.label : undefined}
                            type="button"
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {(!collapsed || isMobile) && (
                                <motion.span
                                    animate={{ opacity: 1 }}
                                    className="truncate"
                                    initial={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {item.label}
                                </motion.span>
                            )}
                            {isActive && (!collapsed || isMobile) && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-200" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="border-t border-slate-700/50 p-2">
                {!isMobile && onToggleCollapse && (
                    <button
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
                        onClick={onToggleCollapse}
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

export const SuperAdminSidebar = ({ isMobileOpen, onMobileClose }: SidebarPropsType) => {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const handleNavClick = (href: string) => {
        navigate(href);
        onMobileClose();
    };

    const handleToggleCollapse = () => {
        setCollapsed((prev) => !prev);
    };

    return (
        <>
            {/* Desktop sidebar */}
            <motion.aside
                animate={{ width: collapsed ? 64 : 220 }}
                className="relative hidden h-full flex-shrink-0 flex-col bg-[#0f172a] md:flex"
                initial={{ width: 220 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
            >
                <SidebarContent
                    collapsed={collapsed}
                    isMobile={false}
                    onNavClick={handleNavClick}
                    onToggleCollapse={handleToggleCollapse}
                />
            </motion.aside>

            {/* Mobile drawer */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            animate={{ opacity: 1 }}
                            className="fixed inset-0 z-40 bg-black/60 md:hidden"
                            exit={{ opacity: 0 }}
                            initial={{ opacity: 0 }}
                            onClick={onMobileClose}
                            transition={{ duration: 0.2 }}
                        />
                        <motion.aside
                            animate={{ x: 0 }}
                            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0f172a] shadow-2xl md:hidden"
                            exit={{ x: "-100%" }}
                            initial={{ x: "-100%" }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                        >
                            <button
                                className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-100"
                                onClick={onMobileClose}
                                type="button"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                            <SidebarContent
                                collapsed={false}
                                isMobile={true}
                                onNavClick={handleNavClick}
                            />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
