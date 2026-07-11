import {
    BellIcon,
    HelpCircleIcon,
    LogOutIcon,
    MenuIcon,
    SettingsIcon,
    UserIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/router/routes";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser } from "@/features/auth/store/auth-slice";

import { SuperAdminProfileDialog } from "./super-admin-profile-dialog";

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
    const [hasNotification] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

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
                <Button className="relative" size="icon" variant="ghost">
                    <BellIcon className="h-5 w-5 text-slate-600" />
                    {hasNotification && (
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>

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
