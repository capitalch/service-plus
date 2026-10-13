import { HelpCircle, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

// The round violet Help buttons fixed at the bottom right. Client Help (help-fab.tsx) and
// Super Admin's Developer Help (super-admin-layout.tsx) both use them, so they look the same.

/** The smaller Ask AI button that sits just above the Help button. */
export const AskAiRoundButton = ({ className, onClick }: { className?: string; onClick: () => void }) => {
	return (
		<button
			className={cn(
				"fixed bottom-19 right-1 z-40 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 sm:right-2",
				className,
			)}
			onClick={onClick}
			title="Ask AI"
			type="button"
		>
			<Sparkles className="h-4 w-4" />
		</button>
	);
};

export const HelpRoundButton = ({
	className,
	onClick,
	title,
}: {
	className?: string;
	onClick: () => void;
	title: string;
}) => {
	return (
		<button
			className={cn(
				"fixed bottom-7 right-0 z-40 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 sm:right-1",
				className,
			)}
			onClick={onClick}
			title={title}
			type="button"
		>
			<HelpCircle className="h-5 w-5" />
		</button>
	);
};
