import { useNavigate, NavLink } from "react-router-dom";
import { Bell, LogOut, Menu, Moon, PanelLeft, Search, Sun } from "lucide-react";

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
    const dispatch                      = useAppDispatch();
    const navigate                      = useNavigate();
    const user                         = useAppSelector(selectCurrentUser);
    const { isDark, toggleTheme }      = useTheme();
    const { toggleExplorer }           = useLayout();

    function handleLogout() {
        dispatch(logout());
        navigate(ROUTES.login);
    }

    return (
        <header className="fixed left-0 right-0 top-0 z-50 flex h-12 items-center justify-between border-b border-[var(--cl-border)] bg-[var(--cl-bg)] px-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 overflow-hidden">
                {/* Hamburger on mobile — toggles explorer (which shows section nav on mobile) */}
                <button
                    onClick={toggleExplorer}
                    className="rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] md:hidden"
                    title="Toggle menu"
                >
                    <Menu className="h-4 w-4" />
                </button>

                {/* Panel toggle on md+ */}
                <button
                    onClick={toggleExplorer}
                    className="hidden shrink-0 rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] md:block"
                    title="Toggle explorer"
                >
                    <PanelLeft className="h-4 w-4" />
                </button>

                <span className="shrink-0 text-lg font-black tracking-tighter text-[var(--cl-accent-text)]">Service+</span>

                <nav className="hidden h-full items-center gap-4 md:flex lg:gap-6 mt-1">
                    {NAV_ITEMS.map(({ label, section, to, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={`cursor-pointer pb-1 text-sm font-medium tracking-tight transition-all active:scale-95 ${
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

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {/* BU + Branch switcher — always visible, stable slot */}
                <BuBranchSwitcher variant="client" />

                <div className="mx-1 h-5 w-px bg-[var(--cl-border)]" />

                <button
                    onClick={toggleTheme}
                    title={isDark ? 'Switch to White Mode' : 'Switch to Black Mode'}
                    className="rounded p-1.5 text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)] cursor-pointer"
                >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <div className="mx-1 h-5 w-px bg-[var(--cl-border)]" />

                <div className="relative hidden sm:block">
                    <input
                        className="w-40 rounded-lg bg-[var(--cl-input-bg)] px-3 py-1.5 pr-8 text-xs text-[var(--cl-text-input)] outline-none placeholder:text-[var(--cl-text-muted)] focus:ring-1 focus:ring-[var(--cl-accent)] lg:w-64"
                        placeholder="Search Console..."
                        type="text"
                    />
                    <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cl-text-muted)]" />
                </div>

                <div className="relative cursor-pointer rounded p-1.5 transition-colors hover:bg-[var(--cl-hover)]">
                    <Bell className="h-5 w-5 text-[var(--cl-text-muted)]" />
                    <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--cl-accent)] text-[8px] font-bold text-white">
                        3
                    </span>
                </div>

                <div className="flex items-center gap-2 border-l border-[var(--cl-border)] pl-2">
                    <div className="hidden text-right sm:block">
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
