import { BarChart3, BookOpen, HelpCircle, LayoutDashboard, Package, ShieldCheck, SlidersHorizontal, UserCircle, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
import type { Section } from "./client-layout";

type ActivityItem = { icon: ComponentType<{ className?: string; strokeWidth?: number }>; section: Section; to: string; title: string };

const ACTIVITY_ITEMS: ActivityItem[] = [
    { icon: Wrench,             section: 'jobs',           to: ROUTES.client.jobs,           title: 'Jobs' },
    { icon: LayoutDashboard,    section: 'dashboard',      to: ROUTES.client.root,           title: 'Dashboard' },
    { icon: Package,            section: 'inventory',      to: ROUTES.client.inventory,      title: 'Inventory' },
    { icon: BarChart3,          section: 'reports',        to: ROUTES.client.reports,        title: 'Reports' },
    { icon: BookOpen,           section: 'masters',        to: ROUTES.client.masters,        title: 'Masters' },
    { icon: SlidersHorizontal,  section: 'configurations', to: ROUTES.client.configurations, title: 'Configurations' },
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
        <aside className="fixed left-0 top-12 z-40 hidden h-[calc(100%-4.5rem)] w-16 flex-col items-center bg-[var(--cl-deep)] py-4 md:flex">
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
                                    ? 'border-l-2 border-[var(--cl-accent)] bg-[var(--cl-bg)] text-[var(--cl-accent-text)]'
                                    : 'text-[var(--cl-text-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]'
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
                        className="cursor-pointer text-[var(--cl-text-muted)] transition-all hover:text-[var(--cl-accent-text)]"
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </button>
                )}
                <button className="cursor-pointer text-[var(--cl-text-muted)] transition-all hover:text-[var(--cl-text)]" title="Account">
                    <UserCircle className="h-5 w-5" />
                </button>
                <button className="cursor-pointer text-[var(--cl-text-muted)] transition-all hover:text-[var(--cl-text)]" title="Help">
                    <HelpCircle className="h-5 w-5" />
                </button>
            </div>
        </aside>
    );
};
