import { HelpCircle, Sparkles } from "lucide-react";
import { useHelp } from "@/features/client/components/layout/client-layout";

export function HelpFab() {
	const { aiHelpEnabled, openAiHelp, openHelp } = useHelp();

	return (
		<>
			{aiHelpEnabled && (
				<button
					className="fixed bottom-19 right-1 z-40 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 sm:right-2"
					onClick={() => openAiHelp()}
					title="Ask AI"
				>
					<Sparkles className="h-4 w-4" />
				</button>
			)}
			<button
				onClick={() => openHelp()}
				className="fixed bottom-7 right-0 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 sm:bottom-7 sm:right-1"
				title="Open Help Center"
			>
				<HelpCircle className="h-5 w-5" />
			</button>
		</>
	);
}
