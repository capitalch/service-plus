import type { ReactNode } from "react";
import { BriefcaseIcon, BuildingIcon, ListChecksIcon, LogOutIcon, ScrollTextIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, selectCurrentUser, setSessionMode } from "@/features/auth/store/auth-slice";
import { ROUTES } from "@/router/routes";

type AdminLayoutPropsType = {
    children: ReactNode;
};

const NAV_ITEMS = [
    { icon: ShieldCheckIcon,  label: "Dashboard",      to: ROUTES.admin.root },
    { icon: UsersIcon,        label: "Business Users", to: ROUTES.admin.users },
    { icon: BuildingIcon,     label: "Business Units", to: ROUTES.admin.businessUnits },
    { icon: ListChecksIcon,   label: "Roles",          to: ROUTES.admin.roles },
    { icon: ScrollTextIcon,   label: "Audit Logs",     to: ROUTES.admin.audit },
];

export const AdminLayout = ({ children }: AdminLayoutPropsType) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user     = useAppSelector(selectCurrentUser);

    function handleLogout() {
        dispatch(logout());
        navigate(ROUTES.login);
    }

    function handleSwitchToClient() {
        dispatch(setSessionMode('client'));
        navigate(ROUTES.home);
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
                {/* Logo */}
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
                        <span className="text-xs font-bold text-white">S+</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Admin Panel</span>
                </div>

                {/* Nav */}
                <nav className="flex flex-1 flex-col gap-1 p-3">
                    {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
                        <NavLink
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                                    isActive
                                        ? "bg-teal-50 font-medium text-teal-700"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }`
                            }
                            end
                            key={to}
                            to={to}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer actions */}
                <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
                    <Button
                        className="w-full justify-start gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={handleSwitchToClient}
                        size="sm"
                        variant="outline"
                    >
                        <BriefcaseIcon className="h-3.5 w-3.5" />
                        Switch to Client Mode
                    </Button>
                    <Button
                        className="w-full justify-start gap-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        onClick={handleLogout}
                        size="sm"
                        variant="ghost"
                    >
                        <LogOutIcon className="h-3.5 w-3.5" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
                    <div className="flex items-center gap-2 lg:hidden">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
                            <span className="text-xs font-bold text-white">S+</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-800">Admin Panel</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                            {user?.fullName ?? user?.username}
                        </span>
                        <Button
                            className="h-7 gap-1.5 border-indigo-200 px-2.5 text-xs text-indigo-700 hover:bg-indigo-50 lg:hidden"
                            onClick={handleSwitchToClient}
                            size="sm"
                            variant="outline"
                        >
                            <BriefcaseIcon className="h-3 w-3" />
                            Client Mode
                        </Button>
                        <Button
                            className="h-7 px-2.5 text-xs text-slate-500 hover:bg-slate-100 lg:hidden"
                            onClick={handleLogout}
                            size="sm"
                            variant="ghost"
                        >
                            <LogOutIcon className="h-3 w-3" />
                        </Button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
            </div>
        </div>
    );
};
