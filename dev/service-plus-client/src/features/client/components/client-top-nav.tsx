import { NavLink } from "react-router-dom";
import { Bell, Search } from "lucide-react";

import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
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
    const user = useAppSelector(selectCurrentUser);

    return (
        <header className="fixed left-0 right-0 top-0 z-50 flex h-12 items-center justify-between border-b border-white/5 bg-[#131313] px-4">
            <div className="flex items-center gap-8">
                <span className="text-lg font-black tracking-tighter text-[#9fcaff]">ServicePlus</span>
                <nav className="hidden h-full items-center gap-6 md:flex">
                    {NAV_ITEMS.map(({ label, section, to, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={`cursor-pointer pb-1 text-sm font-medium tracking-tight transition-all active:scale-95 ${
                                activeSection === section
                                    ? 'border-b-2 border-[#007acc] text-[#e5e2e1]'
                                    : 'text-[#a1a1aa] hover:text-[#e5e2e1]'
                            }`}
                        >
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <input
                        className="w-64 rounded-lg bg-[#353535] px-3 py-1.5 pr-8 text-xs text-[#c0c7d3] outline-none placeholder:text-[#a1a1aa] focus:ring-1 focus:ring-[#007acc]"
                        placeholder="Search Console..."
                        type="text"
                    />
                    <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a1a1aa]" />
                </div>

                <div className="relative cursor-pointer rounded p-1.5 transition-colors hover:bg-[#2a2a2a]">
                    <Bell className="h-5 w-5 text-[#a1a1aa]" />
                    <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#007acc] text-[8px] font-bold text-white">
                        3
                    </span>
                </div>

                <div className="flex items-center gap-3 border-l border-white/5 pl-2">
                    <div className="hidden text-right sm:block">
                        <p className="text-[11px] font-bold leading-tight text-[#e5e2e1]">
                            {user?.fullName ?? user?.username}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#007acc]">
                            {user?.roleName ?? (user?.userType === 'A' ? 'Admin' : 'User')}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
};
