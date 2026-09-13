import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { EwStateType } from "@/features/client/types/extended-warranty";
import { cn } from "@/lib/utils";

import { EW_STATE_META, EW_STATES, EW_TRANSITIONS } from "./ew-state-machine";
import type { EwColorType } from "./ew-state-machine";

type EdgeKindType = "close" | "fan" | "main" | "reopen" | "return" | "skip";

type EdgeType = { from: EwStateType; kind: EdgeKindType; to: EwStateType };

const BUS_X = 800;
const BUS_Y = 275;
const NODE_H = 70;
const NODE_W = 140;

const CLOSED = new Set<EwStateType>(["CANCELLED", "LOST", "WON"]);

const DASHED: Record<EdgeKindType, boolean> = {
	close: true,
	fan: false,
	main: false,
	reopen: true,
	return: false,
	skip: true,
};

// Literal classes, so Tailwind's scanner sees every one of them.
const EDGE_CLASSES: Record<EdgeKindType, { fill: string; stroke: string }> = {
	close: { fill: "fill-slate-400", stroke: "stroke-slate-400" },
	fan: { fill: "fill-violet-500", stroke: "stroke-violet-500" },
	main: { fill: "fill-slate-500 dark:fill-slate-400", stroke: "stroke-slate-500 dark:stroke-slate-400" },
	reopen: { fill: "fill-amber-500", stroke: "stroke-amber-500" },
	return: { fill: "fill-green-500", stroke: "stroke-green-500" },
	skip: { fill: "fill-slate-400", stroke: "stroke-slate-400" },
};

const MAIN_LABELS: Partial<Record<EwStateType, [string, string]>> = {
	INTERESTED: ["follow", "up"],
	MESSAGE_SENT: ["customer", "taps"],
	NEW_LEAD: ["send", "WhatsApp"],
};

const NODE_CAPTION: Record<EwStateType, string> = {
	CANCELLED: "Can reopen",
	IN_PROGRESS: "Stage 1 → 2 → 3",
	INTERESTED: "Customer tapped the button",
	LOST: "Can reopen or win",
	MESSAGE_SENT: "Delivered · Read · Fail",
	NEW_LEAD: "31–60 · 8–30 · 0–7 · Overdue",
	WON: "Final",
};

const NODE_CLASSES: Record<EwColorType, string> = {
	blue: "fill-blue-50 stroke-blue-500 dark:fill-blue-950/40",
	green: "fill-green-50 stroke-green-500 dark:fill-green-950/40",
	grey: "fill-slate-50 stroke-slate-400 dark:fill-slate-900/40",
	indigo: "fill-indigo-50 stroke-indigo-500 dark:fill-indigo-950/40",
	orange: "fill-orange-50 stroke-orange-500 dark:fill-orange-950/40",
	red: "fill-red-50 stroke-red-500 dark:fill-red-950/40",
	rose: "fill-rose-50 stroke-rose-500 dark:fill-rose-950/40",
	teal: "fill-teal-50 stroke-teal-500 dark:fill-teal-950/40",
	violet: "fill-violet-50 stroke-violet-500 dark:fill-violet-950/40",
};

// Top-left corner of each node in the 1000 × 380 viewBox.
const NODE_POS: Record<EwStateType, { x: number; y: number }> = {
	CANCELLED: { x: 840, y: 290 },
	IN_PROGRESS: { x: 620, y: 165 },
	INTERESTED: { x: 420, y: 165 },
	LOST: { x: 840, y: 165 },
	MESSAGE_SENT: { x: 220, y: 165 },
	NEW_LEAD: { x: 20, y: 165 },
	WON: { x: 840, y: 40 },
};

/** Every allowed move, classified. Generated from EW_TRANSITIONS so the picture cannot drift. */
const EDGES: EdgeType[] = EW_STATES.flatMap((from) =>
	EW_TRANSITIONS[from].map((to) => ({ from, kind: edgeKind(from, to), to })),
);

const CLOSE_EDGES = EDGES.filter((e) => e.kind === "close");

/** Which drawing an allowed move gets; every EW_TRANSITIONS pair maps to exactly one. */
function edgeKind(from: EwStateType, to: EwStateType): EdgeKindType {
	if (CLOSED.has(from)) return to === "WON" ? "return" : "reopen";
	if (from === "IN_PROGRESS") return "fan";
	if (CLOSED.has(to)) return "close";
	if (to === "IN_PROGRESS" && from !== "INTERESTED") return "skip";
	return "main";
}

/** SVG path for one edge; "close" edges are drawn together as one bus instead. */
function edgePath({ from, kind, to }: EdgeType): string {
	const a = NODE_POS[from];
	const b = NODE_POS[to];
	switch (kind) {
		case "fan":
			return `M ${a.x + NODE_W} ${a.y + NODE_H / 2} C ${a.x + NODE_W + 40} ${a.y + NODE_H / 2}, ${b.x - 40} ${b.y + 24}, ${b.x - 4} ${b.y + 24}`;
		case "main":
			return `M ${a.x + NODE_W} ${a.y + NODE_H / 2} L ${b.x - 4} ${b.y + NODE_H / 2}`;
		case "reopen": {
			const x2 = b.x + NODE_W - (from === "LOST" ? 25 : 70);
			const y1 = a.y + NODE_H - 15;
			return `M ${a.x} ${y1} C ${a.x - 40} ${y1 + 35}, ${x2} ${b.y + NODE_H + 45}, ${x2} ${b.y + NODE_H + 4}`;
		}
		case "return":
			return `M ${a.x + NODE_W / 2} ${a.y} L ${b.x + NODE_W / 2} ${b.y + NODE_H + 4}`;
		case "skip": {
			const x1 = a.x + NODE_W / 2;
			const x2 = b.x + NODE_W / 2 - (from === "NEW_LEAD" ? 20 : 0);
			const lift = from === "NEW_LEAD" ? 70 : 110;
			return `M ${x1} ${a.y} C ${x1} ${lift}, ${x2} ${lift}, ${x2} ${b.y - 4}`;
		}
		default:
			return "";
	}
}

/**
 * The lead state machine as a static picture (§C7.6): active states on the left, closed on
 * the right, every arrow generated from EW_TRANSITIONS. Not clickable; honours reduced motion.
 */
export const EwStateFlowDiagram = () => {
	const reduceMotion = useReducedMotion();
	const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

	function marker(kind: EdgeKindType): string {
		return `url(#${uid}-${kind})`;
	}

	const busSources = [...new Set(CLOSE_EDGES.map((e) => e.from))];
	const busTargets = [...new Set(CLOSE_EDGES.map((e) => e.to))];
	const busTopY = Math.min(...busTargets.map((t) => NODE_POS[t].y + NODE_H - 14));
	const busBottomY = Math.max(...busTargets.map((t) => NODE_POS[t].y + NODE_H - 14));

	return (
		<div className="flex flex-col gap-2">
			<div className="overflow-x-auto">
				<svg
					aria-label="Lead state flow"
					className="pointer-events-none w-full min-w-[720px]"
					role="img"
					viewBox="0 0 1000 380"
				>
					<defs>
						{(Object.keys(EDGE_CLASSES) as EdgeKindType[]).map((kind) => (
							<marker
								key={kind}
								id={`${uid}-${kind}`}
								markerHeight="7"
								markerWidth="7"
								orient="auto-start-reverse"
								refX="9"
								refY="5"
								viewBox="0 0 10 10"
							>
								<path className={EDGE_CLASSES[kind].fill} d="M 0 0 L 10 5 L 0 10 z" />
							</marker>
						))}
					</defs>

					{/* Bands */}
					<rect
						className="fill-slate-100/60 stroke-slate-300 dark:fill-slate-800/30 dark:stroke-slate-700"
						height="94"
						rx="18"
						strokeDasharray="4 4"
						width="765"
						x="10"
						y="153"
					/>
					<rect
						className="fill-slate-100/60 stroke-slate-300 dark:fill-slate-800/30 dark:stroke-slate-700"
						height="342"
						rx="18"
						strokeDasharray="4 4"
						width="164"
						x="828"
						y="30"
					/>
					<text className="fill-slate-500 text-[11px] font-semibold dark:fill-slate-400" x="16" y="20">
						Active (is_closed = false)
					</text>
					<text
						className="fill-slate-500 text-[11px] font-semibold dark:fill-slate-400"
						textAnchor="middle"
						x="910"
						y="20"
					>
						Closed (is_closed = true)
					</text>

					{/* Early close: one dashed bus instead of nine crossing arrows */}
					<g className={EDGE_CLASSES.close.stroke} fill="none" strokeDasharray="5 4" strokeWidth="1.5">
						{busSources.map((s) => (
							<line
								key={s}
								x1={NODE_POS[s].x + NODE_W / 2}
								x2={NODE_POS[s].x + NODE_W / 2}
								y1={NODE_POS[s].y + NODE_H}
								y2={BUS_Y}
							/>
						))}
						<line
							x1={Math.min(...busSources.map((s) => NODE_POS[s].x + NODE_W / 2))}
							x2={BUS_X}
							y1={BUS_Y}
							y2={BUS_Y}
						/>
						<line x1={BUS_X} x2={BUS_X} y1={busTopY} y2={busBottomY} />
						{busTargets.map((t) => (
							<line
								key={t}
								markerEnd={marker("close")}
								x1={BUS_X}
								x2={NODE_POS[t].x - 4}
								y1={NODE_POS[t].y + NODE_H - 14}
								y2={NODE_POS[t].y + NODE_H - 14}
							/>
						))}
					</g>
					<text
						className="fill-slate-500 text-[11px] dark:fill-slate-400"
						textAnchor="middle"
						x="445"
						y="295"
					>
						Any active lead can close as Won, Lost or Cancelled
					</text>

					{/* Every other edge */}
					{EDGES.filter((e) => e.kind !== "close").map((edge, i) => (
						<motion.path
							key={`${edge.from}-${edge.to}`}
							animate={reduceMotion ? undefined : DASHED[edge.kind] ? { opacity: 1 } : { pathLength: 1 }}
							className={EDGE_CLASSES[edge.kind].stroke}
							d={edgePath(edge)}
							fill="none"
							initial={reduceMotion ? false : DASHED[edge.kind] ? { opacity: 0 } : { pathLength: 0 }}
							markerEnd={marker(edge.kind)}
							strokeDasharray={DASHED[edge.kind] ? "5 4" : undefined}
							strokeWidth="1.8"
							transition={{ delay: 0.25 + i * 0.03, duration: 0.45 }}
						/>
					))}

					{/* Edge labels */}
					{EDGES.filter((e) => e.kind === "main").map((edge) => {
						const words = MAIN_LABELS[edge.from];
						if (!words) return null;
						const x = (NODE_POS[edge.from].x + NODE_W + NODE_POS[edge.to].x) / 2;
						return (
							<text
								key={`label-${edge.from}`}
								className="fill-slate-500 text-[9px] dark:fill-slate-400"
								textAnchor="middle"
								x={x}
								y="187"
							>
								<tspan x={x}>{words[0]}</tspan>
								<tspan dy="10" x={x}>
									{words[1]}
								</tspan>
							</text>
						);
					})}
					<text className="fill-slate-500 text-[10px] dark:fill-slate-400" textAnchor="middle" x="370" y="80">
						skip ahead
					</text>
					<text className="fill-amber-600 text-[10px] dark:fill-amber-400" x="770" y="258">
						reopen
					</text>
					<text className="fill-green-600 text-[10px] dark:fill-green-400" x="916" y="140">
						came back
					</text>

					{/* Nodes */}
					{EW_STATES.map((state, i) => {
						const { x, y } = NODE_POS[state];
						return (
							<motion.g
								key={state}
								animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
								initial={reduceMotion ? false : { opacity: 0, y: 8 }}
								transition={{ delay: i * 0.04, duration: 0.3 }}
							>
								<rect
									className={NODE_CLASSES[EW_STATE_META[state].color]}
									height={NODE_H}
									rx="14"
									strokeWidth="2"
									width={NODE_W}
									x={x}
									y={y}
								/>
								<text
									className="fill-slate-800 text-[14px] font-bold dark:fill-slate-100"
									textAnchor="middle"
									x={x + NODE_W / 2}
									y={y + 30}
								>
									{EW_STATE_META[state].label}
								</text>
								<text
									className="fill-slate-500 text-[10px] dark:fill-slate-400"
									textAnchor="middle"
									x={x + NODE_W / 2}
									y={y + 50}
								>
									{NODE_CAPTION[state]}
								</text>
							</motion.g>
						);
					})}
				</svg>
			</div>

			<div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-(--cl-text-muted)">
				<LegendLine className="border-slate-500" label="normal flow" />
				<LegendLine className="border-dashed border-slate-400" label="skip ahead / close early" />
				<LegendLine className="border-dashed border-amber-500" label="reopen" />
			</div>
		</div>
	);
};

const LegendLine = ({ className, label }: { className: string; label: string }) => (
	<span className="inline-flex items-center gap-1.5">
		<span className={cn("w-6 border-t-2", className)} />
		{label}
	</span>
);
