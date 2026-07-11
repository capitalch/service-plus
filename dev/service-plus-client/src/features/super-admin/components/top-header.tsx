import {
    DatabaseIcon,
    HelpCircleIcon,
    LogOutIcon,
    MenuIcon,
    SettingsIcon,
    ShieldAlertIcon,
    UserIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client/react";

import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import type { NotificationItem } from "@/components/shared/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import type { AuditStatsType } from "@/features/super-admin/types";
import { ROUTES } from "@/router/routes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser } from "@/features/auth/store/auth-slice";

import { SuperAdminProfileDialog } from "./super-admin-profile-dialog";

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

type TopHeaderPropsType = {
    onMenuToggle: () => void;
    onOpenHelp:   () => void;
};

function getInitials(fullName?: string): string {
    if (!fullName) return "SA";
    const parts = fullName.trim().split(/\s+/);
    const initials = parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`
        : parts[0].slice(0, 2);
    return initials.toUpperCase();
}

export const TopHeader = ({ onMenuToggle, onOpenHelp }: TopHeaderPropsType) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector(selectCurrentUser);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const [today] = useState(todayIso);

    const { data: auditData } = useQuery<{ auditLogStats: AuditStatsType }>(
        GRAPHQL_MAP.auditLogStats,
        { variables: { from_date: today, to_date: today } },
    );
    const { data: clientsData } = useQuery<{ superAdminClientsData: { orphanDatabaseCount: number } }>(
        GRAPHQL_MAP.superAdminClientsData,
    );

    const failedLogins = auditData?.auditLogStats?.outcomeCounts?.failure ?? 0;
    const orphanDbs    = clientsData?.superAdminClientsData?.orphanDatabaseCount ?? 0;

    const notificationItems: NotificationItem[] = [
        {
            count:    failedLogins,
            icon:     ShieldAlertIcon,
            id:       "failed-logins",
            label:    "Failed logins today",
            onSelect: () => navigate(ROUTES.superAdmin.audit),
        },
        {
            count:    orphanDbs,
            icon:     DatabaseIcon,
            id:       "orphan-databases",
            label:    "Orphan databases",
            onSelect: () => navigate(ROUTES.superAdmin.clients, { state: { openOrphanDbs: true } }),
        },
    ];

    const handleLogout = () => {
        dispatch(logout());
        navigate(ROUTES.login);
    };

    return (
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
            {/* Mobile menu toggle */}
            <Button
                className="md:hidden"
                onClick={onMenuToggle}
                size="icon"
                variant="ghost"
            >
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
            </Button>

            {/* Developer help */}
            <Button
                className="gap-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800"
                onClick={onOpenHelp}
                title="Developer Help"
                variant="ghost"
            >
                <HelpCircleIcon className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">Developer Help</span>
            </Button>

            <div className="ml-auto flex items-center gap-2">
                {/* Notifications */}
                <NotificationBell
                    className="hover:bg-slate-50"
                    iconClassName="text-slate-600"
                    items={notificationItems}
                />

                {/* User avatar dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-50 cursor-pointer"
                            type="button"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                                {getInitials(user?.fullName)}
                            </div>
                            <span className="hidden text-sm font-medium text-slate-700 sm:block">
                                {user?.fullName ?? user?.username ?? "Super Admin"}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs text-slate-500">
                            {user?.email}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                            <UserIcon className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(ROUTES.superAdmin.settings)}>
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                            onClick={handleLogout}
                        >
                            <LogOutIcon className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <SuperAdminProfileDialog onOpenChange={setIsProfileOpen} open={isProfileOpen} />
        </header>
    );
};
