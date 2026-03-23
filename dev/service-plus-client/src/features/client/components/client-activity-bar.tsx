import { LayoutDashboard, Wrench, Users, Package, BarChart3, Settings, UserCircle, HelpCircle, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
import type { Section } from "./client-layout";

type ActivityItem = { icon: ComponentType<{ className?: string; strokeWidth?: number }>; section: Section; to: string; title: string };

const ACTIVITY_ITEMS: ActivityItem[] = [
    { icon: LayoutDashboard, section: 'dashboard', to: ROUTES.client.root,      title: 'Dashboard' },
    { icon: Wrench,          section: 'jobs',      to: ROUTES.client.jobs,      title: 'Jobs' },
    { icon: Users,           section: 'customers', to: ROUTES.client.customers, title: 'Customers' },
    { icon: Package,         section: 'inventory', to: ROUTES.client.inventory, title: 'Inventory' },
    { icon: BarChart3,       section: 'reports',   to: ROUTES.client.reports,   title: 'Reports' },
    { icon: Settings,        section: 'settings',  to: ROUTES.client.settings,  title: 'Settings' },
];

type Props = { activeSection: Section };

export const ClientActivityBar = ({ activeSection }: Props) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user     = useAppSelector(selectCurrentUser);
    const isAdmin  = user?.userType === 'A';

    function handleSwitchToAdmin() {
        dispatch(setSessionMode('admin'));
        navigate(ROUTES.admin.root);
    }

    return (
        <aside className="fixed left-0 top-12 z-40 flex h-[calc(100%-4.5rem)] w-16 flex-col items-center bg-[#0e0e0e] py-4">
            <div className="flex w-full flex-col items-center gap-6">
                {ACTIVITY_ITEMS.map(({ icon: Icon, section, to, title }) => {
                    const isActive = activeSection === section;
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={section === 'dashboard'}
                            title={title}
                            className={`flex w-full items-center justify-center py-3 transition-all duration-150 active:scale-90 ${
                                isActive
                                    ? 'border-l-2 border-[#007acc] bg-[#131313] text-[#9fcaff]'
                                    : 'text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-[#e5e2e1]'
                            }`}
                        >
                            <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                        </NavLink>
                    );
                })}
            </div>

            <div className="mt-auto flex w-full flex-col items-center gap-4 pb-4">
                {isAdmin && (
                    <button
                        onClick={handleSwitchToAdmin}
                        title="Switch to Admin Mode"
                        className="text-[#a1a1aa] transition-all hover:text-[#9fcaff]"
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </button>
                )}
                <button className="text-[#a1a1aa] transition-all hover:text-[#e5e2e1]" title="Account">
                    <UserCircle className="h-5 w-5" />
                </button>
                <button className="text-[#a1a1aa] transition-all hover:text-[#e5e2e1]" title="Help">
                    <HelpCircle className="h-5 w-5" />
                </button>
            </div>
        </aside>
    );
};
