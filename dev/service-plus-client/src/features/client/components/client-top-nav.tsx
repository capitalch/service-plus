import { useNavigate, NavLink } from "react-router-dom";
import { Bell, LogOut, Menu, Moon, PanelLeft, Sun } from "lucide-react";

import { BuBranchSwitcher } from "@/features/admin/components/bu-branch-switcher";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
import { useLayout, useTheme } from "./client-layout";
import type { Section } from "./client-layout";

type NavItem = { label: string; section: Section; to: string; end?: boolean };

const NAV_ITEMS: NavItem[] = [
    { label: 'Jobs',           section: 'jobs',           to: ROUTES.client.jobs },
    { label: 'Dashboard',      section: 'dashboard',      to: ROUTES.client.root,           end: true },
    { label: 'Inventory',      section: 'inventory',      to: ROUTES.client.inventory },
    { label: 'Reports',        section: 'reports',        to: ROUTES.client.reports },
    { label: 'Masters',        section: 'masters',        to: ROUTES.client.masters },
    { label: 'Configurations', section: 'configurations', to: ROUTES.client.configurations },
];

type Props = { activeSection: Section };

export const ClientTopNav = ({ activeSection }: Props) => {
    const dispatch                 = useAppDispatch();
    const navigate                 = useNavigate();
    const user                     = useAppSelector(selectCurrentUser);
    const { isDark, toggleTheme }  = useTheme();
    const { toggleExplorer }       = useLayout();

    function handleLogout() {
        dispatch(logout());
        navigate(ROUTES.login);
    }

    return (
        <header className="fixed left-0 right-0 top-0 z-50 flex h-12 items-center border-b border-[var(--cl-border)] bg-[var(--cl-bg)] px-3 sm:px-4">
            {/* Left Section - grows to fill available space */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4 overflow-hidden">
                {/* Mobile Menu Toggle — opens the Explorer Panel which has section nav + sub-items */}
                <button
                    onClick={toggleExplorer}
                    className="rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] md:hidden focus:outline-none cursor-pointer"
                    title="Open menu"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Explorer Toggle on md+ */}
                <button
                    onClick={toggleExplorer}
                    className="hidden shrink-0 rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] md:block focus:outline-none cursor-pointer"
                    title="Toggle explorer"
                >
                    <PanelLeft className="h-4 w-4" />
                </button>

                <span className="shrink-0 text-lg font-black tracking-tighter text-[var(--cl-accent-text)] hidden xs:block">Service+</span>

                <nav className="hidden h-full items-center gap-3 md:flex lg:gap-6 mt-1 overflow-hidden">
                    {NAV_ITEMS.map(({ label, section, to, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={`flex h-full cursor-pointer items-center pb-1 text-[13px] lg:text-sm font-medium tracking-tight transition-all active:scale-95 whitespace-nowrap ${
                                activeSection === section
                                    ? 'border-b-2 border-[var(--cl-accent)] text-[var(--cl-text)]'
                                    : 'text-[var(--cl-text-muted)] hover:text-[var(--cl-text)]'
                            }`}
                        >
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Right Section */}
            <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3">
                <div className="border-r border-[var(--cl-border)] pr-2 lg:pr-2">
                    <BuBranchSwitcher variant="client" />
                </div>

                <button
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] cursor-pointer hidden sm:flex"
                >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <div className="relative cursor-pointer rounded p-1.5 transition-colors hover:bg-[var(--cl-hover)] hidden sm:flex">
                    <Bell className="h-5 w-5 text-[var(--cl-text-muted)]" />
                    <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--cl-accent)] text-[8px] font-bold text-white">
                        3
                    </span>
                </div>

                <div className="flex items-center gap-1.5 border-l border-[var(--cl-border)] pl-1.5 sm:gap-2 sm:pl-2">
                    <div className="hidden text-right xl:block">
                        <p className="text-[11px] font-bold leading-tight text-[var(--cl-text)]">
                            {user?.fullName ?? user?.username}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--cl-accent)]">
                            {user?.roleName ?? (user?.userType === 'A' ? 'Admin' : 'User')}
                        </p>
                    </div>
                    <button
                        className="rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-red-500 cursor-pointer"
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
