import { Network } from "lucide-react";
import { version } from "../../../../package.json";

export const ClientStatusBar = () => {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-6 items-center justify-between bg-[#007acc] px-3">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">Connected</span>
                </div>
                <div className="hidden items-center gap-1 sm:flex">
                    <Network className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Service+</span>
                </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2">
                <span className="hidden text-[10px] font-bold uppercase tracking-widest text-white sm:inline">Service+ v{version}</span>
            </div>

            <div className="flex items-center gap-3">
                <span className="hidden text-[10px] font-bold uppercase tracking-widest text-white/80 sm:inline">UTF-8</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">{dateStr}</span>
            </div>
        </footer>
    );
};
