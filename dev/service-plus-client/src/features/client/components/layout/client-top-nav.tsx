import { useNavigate, NavLink } from "react-router-dom";
import { LogOut, Menu, Moon, PackageX, PanelLeft, Sun, Timer, UploadCloud } from "lucide-react";

import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import type { NotificationItem } from "@/components/shared/notifications/notification-bell";
import { BuBranchSwitcher } from "@/features/admin/components/bu-branch-switcher";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ACCESS_RIGHTS, getRoleDisplayName, hasAccessRight, type AccessRightCode } from "@/features/auth/utils/access-rights";
import { ROUTES } from "@/router/routes";
import { useLayout, useTheme } from "./client-layout";
import type { Section } from "./client-layout";
import { useNotificationsSummary } from "./use-notifications-summary";

type NavItem = { label: string; requiredRight?: AccessRightCode; section: Section; to: string; end?: boolean };

const NAV_ITEMS: NavItem[] = [
    { label: 'Jobs',           section: 'jobs',           to: ROUTES.client.jobs },
    { label: 'Inventory',      section: 'inventory',      to: ROUTES.client.inventory },
    { label: 'Reports',        section: 'reports',        to: ROUTES.client.reports },
    { label: 'Masters',        section: 'masters',        to: ROUTES.client.masters,        requiredRight: ACCESS_RIGHTS.MASTERS_MENU },
    { label: 'Configurations', section: 'configurations', to: ROUTES.client.configurations, requiredRight: ACCESS_RIGHTS.CONFIG_MENU },
    { label: 'Admin',          section: 'admin',          to: ROUTES.client.admin,          requiredRight: ACCESS_RIGHTS.ADMIN_MENU },
];

type Props = { activeSection: Section };

export const ClientTopNav = ({ activeSection }: Props) => {
    const dispatch                 = useAppDispatch();
    const navigate                 = useNavigate();
    const user                     = useAppSelector(selectCurrentUser);
    const { isDark, toggleTheme }  = useTheme();
    const { toggleExplorer }       = useLayout();
    const { jobsOverdue, lowStockParts, unpostedDocs } = useNotificationsSummary();

    function handleLogout() {
        dispatch(logout());
        navigate(ROUTES.login);
    }

    const notificationItems: NotificationItem[] = [
        {
            count:    jobsOverdue,
            icon:     Timer,
            id:       "jobs-overdue",
            label:    "Overdue jobs",
            onSelect: () => navigate(ROUTES.client.reports, { state: { subItem: "Dashboard" } }),
        },
        {
            count:    unpostedDocs,
            icon:     UploadCloud,
            id:       "unposted-docs",
            label:    "Unposted documents",
            onSelect: () => navigate(ROUTES.client.admin, { state: { subItem: "Post / Unpost" } }),
        },
        {
            count:    lowStockParts,
            icon:     PackageX,
            id:       "low-stock-parts",
            label:    "Low-stock parts",
            onSelect: () => navigate(ROUTES.client.inventory, { state: { subItem: "Part Finder" } }),
        },
    ];

    return (
        <header className="fixed left-0 right-0 top-0 z-50 flex h-12 items-center border-b border-(--cl-border) bg-(--cl-bg) px-3 sm:px-4">
            {/* Left Section - grows to fill available space */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4 overflow-hidden">
                {/* Mobile Menu Toggle — opens the Explorer Panel which has section nav + sub-items */}
                <button
                    onClick={toggleExplorer}
                    className="rounded p-1.5 text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) md:hidden focus:outline-none cursor-pointer"
                    title="Open menu"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Explorer Toggle on md+ */}
                <button
                    onClick={toggleExplorer}
                    className="hidden shrink-0 rounded p-1.5 text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) md:block focus:outline-none cursor-pointer"
                    title="Toggle explorer"
                >
                    <PanelLeft className="h-4 w-4" />
                </button>

                <span className="shrink-0 text-lg font-black tracking-tighter text-(--cl-accent-text) hidden xs:block">Service+</span>

                <nav className="hidden items-center gap-1 md:flex overflow-hidden">
                    {NAV_ITEMS.map(({ label, requiredRight, section, to, end }) => {
                        const disabled = !!requiredRight && !hasAccessRight(user, requiredRight);
                        if (disabled) {
                            return (
                                <span
                                    key={to}
                                    title={`Your role does not have access to ${label}`}
                                    aria-disabled="true"
                                    className="flex items-center rounded-md px-3 py-1.5 lg:px-3.5 cursor-not-allowed text-[13px] lg:text-sm font-medium tracking-tight whitespace-nowrap text-(--cl-text-muted) opacity-40"
                                >
                                    {label}
                                </span>
                            );
                        }
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={`flex items-center rounded-md px-3 py-1.5 lg:px-3.5 cursor-pointer text-[13px] lg:text-sm font-medium tracking-tight transition-all active:scale-95 whitespace-nowrap ${
                                    activeSection === section
                                        ? 'bg-(--cl-accent) text-white font-semibold shadow-sm'
                                        : 'text-(--cl-text-muted) hover:bg-(--cl-accent)/10 hover:text-(--cl-accent-text)'
                                }`}
                            >
                                {label}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            {/* Right Section */}
            <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3">
                <div className="border-r border-(--cl-border) pr-2 lg:pr-2">
                    <BuBranchSwitcher variant="client" />
                </div>

                <button
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="rounded p-1.5 text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-(--cl-text) cursor-pointer hidden sm:flex"
                >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <NotificationBell
                    className="hidden hover:bg-(--cl-hover) sm:flex"
                    iconClassName="text-(--cl-text-muted)"
                    items={notificationItems}
                />

                <div className="flex items-center gap-1.5 border-l border-(--cl-border) pl-1.5 sm:gap-2 sm:pl-2">
                    <div className="hidden text-right xl:block">
                        <p className="text-[11px] font-bold leading-tight text-(--cl-text)">
                            {user?.fullName ?? user?.username}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-(--cl-accent)">
                            {getRoleDisplayName(user, false) ?? (user?.userType === 'A' ? 'Admin' : 'User')}
                        </p>
                    </div>
                    <button
                        className="rounded p-1.5 text-(--cl-text-muted) transition-colors hover:bg-(--cl-hover) hover:text-red-500 cursor-pointer"
                        title="Logout"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </header>
    );
};
