import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { ChevronRight, Plus } from "lucide-react";

type NodeType = {
	count: number;
	hint?: string;
	key: string;
	label: string;
	onClick?: () => void;
	tone: "emerald" | "neutral" | "slate" | "violet";
};

type Props = {
	conversionRate: number;
	failed: number;
	followedUp: number;
	interested: number;
	leads: number;
	lost: number;
	onAddCustomer: () => void;
	onSelect: (key: string) => void;
	sent: number;
	won: number;
};

const TONE: Record<NodeType["tone"], string> = {
	emerald:
		"border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
	neutral: "border-(--cl-border) bg-(--cl-surface-2) text-(--cl-text)",
	// Lost is SLATE, never red — losing a deal is an ordinary outcome, and red is
	// reserved project-wide for errors.
	slate: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
	violet: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
};

/**
 * The funnel as a picture rather than a table: Leads → Message sent → Interested →
 * Followed up → Won | Lost. Every node is clickable into its own drill-down, so the
 * graphic is navigation, not decoration.
 *
 * Arrows are box-drawn with a chevron glyph — no image assets, so it themes and scales
 * with the rest of the app. The row wraps on narrow widths instead of scrolling.
 */
export const EwFunnelFlow = ({
	conversionRate,
	failed,
	followedUp,
	interested,
	leads,
	lost,
	onAddCustomer,
	onSelect,
	sent,
	won,
}: Props) => {
	const nodes: NodeType[] = [
		{ count: leads, hint: "everything recorded", key: "leads", label: "All Leads", tone: "neutral" },
		{
			count: sent,
			hint: failed > 0 ? `${failed} failed` : undefined,
			key: "sent",
			label: "Message sent",
			tone: "neutral",
		},
		{ count: interested, key: "interested", label: "Interested", tone: "violet" },
		{ count: followedUp, key: "followed_up", label: "Followed up", tone: "neutral" },
	];

	return (
		<div className="flex flex-wrap items-stretch gap-2">
			{nodes.map((node, i) => (
				<div key={node.key} className="flex items-stretch gap-2">
					<motion.button
						animate={{ opacity: 1, y: 0 }}
						className={`cursor-pointer min-w-28 rounded-lg border px-3 py-2 text-left transition-shadow hover:shadow-sm ${TONE[node.tone]}`}
						initial={{ opacity: 0, y: 6 }}
						onClick={() => onSelect(node.key)}
						transition={{ delay: i * 0.05, duration: 0.2 }}
						type="button"
					>
						<span className="block text-lg font-bold leading-tight">{node.count}</span>
						<span className="block text-xs font-medium">{node.label}</span>
						{node.hint && <span className="block text-[11px] opacity-70">{node.hint}</span>}
					</motion.button>
					<ChevronRight className="size-4 self-center shrink-0 text-(--cl-text-muted)" aria-hidden />
				</div>
			))}

			{/* Won and Lost are the terminal split — side by side, not sequential. */}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col gap-1"
				initial={{ opacity: 0, y: 6 }}
				transition={{ delay: nodes.length * 0.05, duration: 0.2 }}
			>
				<button
					className={`cursor-pointer min-w-28 rounded-lg border px-3 py-1.5 text-left transition-shadow hover:shadow-sm ${TONE.emerald}`}
					onClick={() => onSelect("won")}
					type="button"
				>
					<span className="text-base font-bold">{won}</span>
					<span className="ml-1.5 text-xs font-medium">Won</span>
					{won > 0 && <span className="ml-1.5 text-[11px] opacity-70">{conversionRate}% of interested</span>}
				</button>
				<button
					className={`cursor-pointer min-w-28 rounded-lg border px-3 py-1.5 text-left transition-shadow hover:shadow-sm ${TONE.slate}`}
					onClick={() => onSelect("lost")}
					type="button"
				>
					<span className="text-base font-bold">{lost}</span>
					<span className="ml-1.5 text-xs font-medium">Lost</span>
				</button>
			</motion.div>

			<Button
				className="ml-auto h-auto cursor-pointer self-center bg-teal-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-teal-700"
				onClick={onAddCustomer}
			>
				<Plus className="mr-2 size-5" />
				Add Customer
			</Button>
		</div>
	);
};
