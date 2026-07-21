import { BarChart3, BookOpen, LogOut, Package, ShieldCheck, SlidersHorizontal, UserCircle, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCurrentBu } from "@/store/context-slice";
import { logout, selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";
import type { Section } from "./client-layout";

type ActivityItem = { icon: ComponentType<{ className?: string; strokeWidth?: number }>; section: Section; to: string; title: string };

const ACTIVITY_ITEMS: ActivityItem[] = [
    { icon: Wrench,            section: 'jobs',           to: ROUTES.client.jobs,           title: 'Jobs' },
    { icon: Package,           section: 'inventory',      to: ROUTES.client.inventory,      title: 'Inventory' },
    { icon: BarChart3,         section: 'reports',        to: ROUTES.client.reports,        title: 'Reports' },
    { icon: BookOpen,          section: 'masters',        to: ROUTES.client.masters,        title: 'Masters' },
    { icon: SlidersHorizontal, section: 'configurations', to: ROUTES.client.configurations, title: 'Configurations' },
];

type Props = { activeSection: Section };

export const ClientActivityBar = ({ activeSection }: Props) => {
    const dispatch  = useAppDispatch();
    const navigate  = useNavigate();
    const user      = useAppSelector(selectCurrentUser);
    const currentBu = useAppSelector(selectCurrentBu);
    const isAdmin   = user?.userType === 'A';

    function handleSwitchToAdmin() {
        dispatch(setSessionMode('admin'));
        navigate(ROUTES.admin.root);
    }

    function handleLogout() {
        dispatch(logout());
        navigate(ROUTES.login);
    }

    return (
        <aside className="fixed left-0 top-12 z-40 hidden h-[calc(100%-4.5rem)] w-16 flex-col items-center bg-(--cl-deep) py-4 md:flex">
            <div className="flex w-full flex-col items-center gap-6">
                {ACTIVITY_ITEMS.map(({ icon: Icon, section, to, title }) => {
                    const isActive = activeSection === section;
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={false}
                            title={title}
                            className={`flex w-full items-center justify-center py-3 transition-all duration-150 active:scale-90 ${
                                isActive
                                    ? 'border-l-2 border-(--cl-accent) bg-(--cl-bg) text-(--cl-accent-text)'
                                    : 'text-(--cl-text-muted) hover:bg-(--cl-hover) hover:text-(--cl-text)'
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
                        className="cursor-pointer text-(--cl-text-muted) transition-all hover:text-(--cl-accent-text)"
                    >
                        <ShieldCheck className="h-5 w-5" />
                    </button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="cursor-pointer text-(--cl-text-muted) transition-all hover:text-(--cl-text)" title="Account">
                            <UserCircle className="h-5 w-5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" className="w-60">
                        <DropdownMenuLabel className="font-medium text-slate-900">
                            {user?.fullName ?? user?.username}
                        </DropdownMenuLabel>
                        <DropdownMenuLabel className="-mt-2 text-xs font-normal text-slate-500">
                            {user?.email}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="space-y-1 px-1.5 py-1 text-xs text-slate-500">
                            {user?.username && (
                                <p>Username: <span className="text-slate-700">{user.username}</span></p>
                            )}
                            {user?.roleName && (
                                <p>Role: <span className="text-slate-700">{user.roleName}</span></p>
                            )}
                            {currentBu?.name && (
                                <p>BU: <span className="text-slate-700">{currentBu.name}</span></p>
                            )}
                            {user?.mobile && (
                                <p>Mobile: <span className="text-slate-700">{user.mobile}</span></p>
                            )}
                            {user?.clientCode && (
                                <p>Client: <span className="text-slate-700">{user.clientCode}</span></p>
                            )}
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="cursor-pointer text-red-600 focus:text-red-600"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
};
