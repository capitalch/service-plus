import { HelpCircle } from "lucide-react";
import { useHelp } from "@/features/client/components/layout/client-layout";

export function HelpFab() {
    const { openHelp } = useHelp();

    return (
        <button
            onClick={() => openHelp()}
            className="fixed bottom-8 right-4 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 sm:bottom-8 sm:right-6"
            title="Open Help Center"
        >
            <HelpCircle className="h-5 w-5" />
        </button>
    );
}
