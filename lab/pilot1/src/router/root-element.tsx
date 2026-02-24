import type { RootStateType } from "@/store";
import { HomeIcon, LayoutDashboardIcon, ShieldIcon, Layers3Icon, BlocksIcon } from "lucide-react";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
    { icon: HomeIcon, label: "Home", to: "/landing" },
    { icon: ShieldIcon, label: "Super Admin", to: "/super-admin" },
    { icon: LayoutDashboardIcon, label: "Super Admin V2", to: "/super-admin-v2" },
    { icon: Layers3Icon, label: "Super Admin V3", to: "/super-admin-v3" },
    { icon: BlocksIcon, label: "Example Controls", to: "/example1" },
];

export function RootElement() {
    const navigate = useNavigate();
    const location = useLocation();
    const isAuthenticated = useSelector((state: RootStateType) => state.landingPage.isAuthenticated);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/landing");
        }
    }, []);

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-slate-200 bg-white">
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-200">
                        <ShieldIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 tracking-wide">Service Plus</span>
                </div>

                {/* Nav */}
                <nav className="flex flex-col gap-1 p-3 flex-1">
                    {navItems.map(({ icon: Icon, label, to }) => {
                        const active = location.pathname.startsWith(to) && to !== "/landing";
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150
                                    ${active
                                        ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                    }`}
                            >
                                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200">
                    <p className="text-xs text-slate-400">Pilot 1 — v0.1.0</p>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
