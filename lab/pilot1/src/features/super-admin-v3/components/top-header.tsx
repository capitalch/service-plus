import { ArrowLeftIcon, BellIcon, MenuIcon, SearchIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type TopHeaderV3PropsType = { onMenuToggle: () => void };

export const TopHeaderV3 = ({ onMenuToggle }: TopHeaderV3PropsType) => {
    const navigate = useNavigate();
    return (
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
            <Button className="md:hidden" onClick={onMenuToggle} size="icon" variant="ghost">
                <MenuIcon className="h-5 w-5" />
            </Button>

            <Button
                className="hidden items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 md:flex"
                onClick={() => navigate("/")}
                size="sm"
                variant="ghost"
            >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Home
            </Button>
            <div className="hidden h-4 w-px bg-slate-200 md:block" />

            <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="Search..."
                    type="text"
                />
            </div>

            <div className="ml-auto flex items-center gap-2">
                <Button className="relative" size="icon" variant="ghost">
                    <BellIcon className="h-5 w-5 text-slate-600" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white" />
                </Button>
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#180a2e] text-xs font-bold text-violet-300 shadow-sm">
                        SA
                    </div>
                    <span className="hidden text-sm font-medium text-slate-700 sm:block">Super Admin</span>
                </div>
            </div>
        </header>
    );
};
