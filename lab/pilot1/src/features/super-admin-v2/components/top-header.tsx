import {
    ArrowLeftIcon,
    BellIcon,
    LogOutIcon,
    MenuIcon,
    SearchIcon,
    SettingsIcon,
    UserIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopHeaderPropsType = {
    onMenuToggle: () => void;
};

export const TopHeader = ({ onMenuToggle }: TopHeaderPropsType) => {
    const navigate = useNavigate();
    const [hasNotification] = useState(true);

    const handleLogout = () => {
        toast.info("Logging out...");
        navigate("/");
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

            {/* Back to landing page */}
            <Button
                className="hidden items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 md:flex"
                onClick={() => navigate("/super-admin-v2")}
                size="sm"
                variant="ghost"
            >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Back
            </Button>
            <div className="hidden h-4 w-px bg-slate-200 md:block" />

            {/* Search bar */}
            <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="Search..."
                    type="text"
                />
            </div>

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
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-50"
                            type="button"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                                SA
                            </div>
                            <span className="hidden text-sm font-medium text-slate-700 sm:block">
                                Super Admin
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs text-slate-500">
                            super.admin@serviceplus.io
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <UserIcon className="mr-2 h-4 w-4" />
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={handleLogout}
                        >
                            <LogOutIcon className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};
