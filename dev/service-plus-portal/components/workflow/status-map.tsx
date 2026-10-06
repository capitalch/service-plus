"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, Pause, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { playStepSound, readMuted, unlockSound, writeMuted } from "@/components/workflow/play-sound";
import { STATUS_TONES } from "@/components/workflow/status-tones";
import { MESSAGES } from "@/constants/messages";
import { START_STATUS, STATUS_MAP_SIZE, statusBands, workflowPaths, workflowStatuses } from "@/content/workflow";
import type { StatusMoveType, WorkflowPathType, WorkflowStatusType } from "@/content/workflow";
import { cn } from "@/lib/utils";

type EdgeType = StatusMoveType & { from: string; key: string };

type PointType = [number, number];

const NODE_H = 76;
const NODE_W = 236;
// Long enough to read the label that appears on each connector before the next move lands.
const PLAY_STEP_MS = 4500;
// Labels sit past the midpoint, toward the target. Moves fanning out of one status share a start
// but not an end, so this spreads their labels apart instead of stacking them near the source.
const LABEL_T = 0.6;

const statusByCode = new Map(workflowStatuses.map((status) => [status.code, status]));

const edges: EdgeType[] = workflowStatuses.flatMap((status) =>
	status.moves.map((m) => ({ ...m, from: status.code, key: `${status.code}>${m.to}>${m.label}` })),
);

// Where a line aimed from the node centre at `toward` leaves the node's box, with a small gap so
// arrowheads stop short of the border instead of overlapping it.
function boundaryPoint(center: PointType, toward: PointType): PointType {
	const dx = toward[0] - center[0];
	const dy = toward[1] - center[1];
	const sx = dx === 0 ? Infinity : (NODE_W / 2 + 5) / Math.abs(dx);
	const sy = dy === 0 ? Infinity : (NODE_H / 2 + 5) / Math.abs(dy);
	const s = Math.min(sx, sy);
	return [center[0] + dx * s, center[1] + dy * s];
}

// A gentle quadratic curve. A move and its reverse bend to opposite sides automatically, because
// the perpendicular flips with the direction, so the two never sit on top of each other.
function edgeGeometry(edge: EdgeType): { d: string; label: PointType } {
	const from = statusByCode.get(edge.from)!;
	const to = statusByCode.get(edge.to)!;

	if (from.code === to.code) {
		const top = from.y - NODE_H / 2;
		return {
			d: `M ${from.x - 24} ${top - 2} C ${from.x - 56} ${top - 62}, ${from.x + 56} ${top - 62}, ${from.x + 24} ${top - 2}`,
			label: [from.x, top - 50],
		};
	}

	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const len = Math.hypot(dx, dy);
	const bend = edge.bend ?? (edge.kind === "undo" ? 0.32 : 0.14);
	const control: PointType = [
		(from.x + to.x) / 2 - (dy / len) * bend * len,
		(from.y + to.y) / 2 + (dx / len) * bend * len,
	];
	const start = boundaryPoint([from.x, from.y], control);
	const end = boundaryPoint([to.x, to.y], control);

	return {
		d: `M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`,
		label: pointOnCurve(start, control, end, edge.labelT ?? LABEL_T),
	};
}

// Names longer than this would run past the block's right edge at 26px, so they break onto two
// lines at the space nearest the middle: "Estimate / Approved", "Delivered / Not OK".
const NAME_MAX_CHARS = 13;
const NAME_LINE_HEIGHT = 28;

function splitName(name: string): string[] {
	if (name.length <= NAME_MAX_CHARS) return [name];
	const spaces = [...name.matchAll(/ /g)].map((match) => match.index);
	if (spaces.length === 0) return [name];
	const middle = name.length / 2;
	const at = spaces.reduce((best, index) => (Math.abs(index - middle) < Math.abs(best - middle) ? index : best));
	return [name.slice(0, at), name.slice(at + 1)];
}

// A point on the quadratic curve at parameter t.
function pointOnCurve(start: PointType, control: PointType, end: PointType, t: number): PointType {
	const a = (1 - t) * (1 - t);
	const b = 2 * t * (1 - t);
	const c = t * t;
	return [a * start[0] + b * control[0] + c * end[0], a * start[1] + b * control[1] + c * end[1]];
}

const geometry = new Map(edges.map((edge) => [edge.key, edgeGeometry(edge)]));

export const StatusMap = () => {
	const markerId = useId().replace(/:/g, "");
	const reduceMotion = useReducedMotion();
	// Selection drives the panel below the diagram; hovering only previews inside the diagram.
	// Driving both from one value made the panel re-mount on every pointer move across the graph.
	const [hovered, setHovered] = useState<string | null>(null);
	const [selected, setSelected] = useState(START_STATUS);
	// The path being played, or null when nothing is animating. `step` survives a pause so the
	// same button can pick the path back up where it stopped.
	const [playing, setPlaying] = useState<WorkflowPathType | null>(null);
	const [step, setStep] = useState(0);
	// A paused path keeps its place — step, badges and selection — until it is resumed or stopped.
	const [paused, setPaused] = useState(false);
	const [muted, setMuted] = useState(false);

	// Read after mount rather than in the initial state, so the server render and the first
	// client render agree.
	useEffect(() => setMuted(readMuted()), []);

	// Advances one status at a time. A timeout rather than an interval so pausing is immediate
	// and a slow frame does not queue up moves.
	useEffect(() => {
		if (!playing || paused) return;

		const timer = window.setTimeout(() => {
			const next = step + 1;
			const last = next === playing.codes.length - 1;

			setStep(next);
			setSelected(playing.codes[next]);
			if (!muted) playStepSound(last);
			// The path stays on its final status, badges and all, so the reader can see where it
			// ended. It holds there like a pause until it is replayed or stopped.
			if (last) setPaused(true);
		}, PLAY_STEP_MS);

		return () => window.clearTimeout(timer);
	}, [muted, paused, playing, step]);

	// Step numbers for the path being played: each status it has reached so far, with every
	// position it was reached at ("3, 5" when the path loops back through it).
	const stepNumbers = useMemo(() => {
		const numbers = new Map<string, number[]>();
		playing?.codes.slice(0, step + 1).forEach((code, index) => {
			numbers.set(code, [...(numbers.get(code) ?? []), index + 1]);
		});
		return numbers;
	}, [playing, step]);

	// What stays lit: the selected status and the statuses one move away. Picking a status shows
	// both where it came from and where it can go; while a path plays only the way forward is lit,
	// so the eye follows the path instead of looking back along it.
	const finished = playing !== null && step === playing.codes.length - 1;

	// Once a path has finished, the whole of it is shown: every move between its consecutive
	// statuses. Null while nothing has finished, so the usual one-step highlight applies.
	const pathEdges = useMemo(() => {
		if (!finished || !playing) return null;
		const keys = new Set<string>();
		playing.codes.slice(1).forEach((to, index) => {
			const edge = edges.find((candidate) => candidate.from === playing.codes[index] && candidate.to === to);
			if (edge) keys.add(edge.key);
		});
		return keys;
	}, [finished, playing]);

	const connected = useMemo(() => {
		if (pathEdges && playing) return new Set(playing.codes);
		const set = new Set<string>([selected]);
		for (const edge of edges) {
			if (edge.from === selected) set.add(edge.to);
			if (edge.to === selected && !playing) set.add(edge.from);
		}
		return set;
	}, [pathEdges, playing, selected]);

	// Highlighted edges are drawn last so they sit above the faint ones.
	const orderedEdges = [...edges].sort((a, b) => rank(a) - rank(b));

	function rank(edge: EdgeType): number {
		if (pathEdges) return pathEdges.has(edge.key) ? 2 : 0;
		if (edge.from === selected) return 2;
		if (edge.to === selected) return 1;
		return 0;
	}

	function select(code: string) {
		stop();
		setSelected(code);
	}

	function stop() {
		setPlaying(null);
		setStep(0);
		setPaused(false);
	}

	// Reset puts the diagram back on Received and clears the step badges, ready to play again.
	function reset() {
		stop();
		setSelected(START_STATUS);
	}

	// A path row always starts its path from step 1 — including the one already playing, which
	// is how a finished path is replayed. Pausing, resuming and resetting live on the one control
	// button in the header.
	function startPath(path: WorkflowPathType) {
		setHovered(null);
		setPlaying(path);
		setPaused(false);
		setStep(0);
		setSelected(path.codes[0]);
		// This click is the user gesture browsers require before any sound can play.
		unlockSound();
		if (!muted) playStepSound(false);
	}

	// The single playback control: Pause while a path runs, Resume while it is paused part-way,
	// Reset once it has finished.
	function control() {
		if (!playing) return;
		if (finished) {
			reset();
			return;
		}
		if (paused) unlockSound();
		setPaused(!paused);
	}

	function toggleMuted() {
		setMuted((value) => {
			writeMuted(!value);
			return !value;
		});
	}

	return (
		<div className="space-y-4">
			{/* Path list and diagram share one row, so a path can be started and watched without
			    scrolling between the two. On a phone the list wraps above the diagram instead. */}
			<div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
				<aside className="flex flex-col rounded-xl border border-border bg-card p-3">
					<div className="flex items-center justify-between px-1">
						<h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
							{MESSAGES.workflowMapPaths}
						</h3>
						<button
							aria-label={muted ? MESSAGES.workflowSoundOn : MESSAGES.workflowSoundOff}
							aria-pressed={!muted}
							className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/60 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
							onClick={toggleMuted}
							title={muted ? MESSAGES.workflowSoundOn : MESSAGES.workflowSoundOff}
							type="button"
						>
							{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
						</button>
					</div>
					<ul className="mt-1.5 flex flex-wrap gap-0.5 lg:flex-col">
						{workflowPaths.map((path) => {
							// isPlaying: this is the active path (running or paused). isRunning: it is moving.
							const isPlaying = playing?.id === path.id;
							const isRunning = isPlaying && !paused;
							const isFinished = isPlaying && step === path.codes.length - 1;

							return (
								<li key={path.id}>
									<button
										aria-label={`${isPlaying ? MESSAGES.workflowMapReplay : MESSAGES.workflowMapPlay}: ${path.label}`}
										aria-pressed={isPlaying}
										className={cn(
											"flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-[3px] text-left text-[13px] leading-snug whitespace-nowrap transition-colors",
											"focus-visible:ring-primary/60 focus-visible:ring-2 focus-visible:outline-none",
											isRunning && "bg-primary text-primary-foreground font-semibold",
											// Paused: still the active path, but outlined rather than filled,
											// so it is plain that nothing is moving.
											isPlaying &&
												!isRunning &&
												"bg-primary/10 text-primary ring-primary/40 font-semibold ring-1",
											!isPlaying && "text-foreground hover:bg-muted",
										)}
										onClick={() => startPath(path)}
										type="button"
									>
										{isRunning ? (
											<Pause aria-hidden className="size-3.5 shrink-0" />
										) : isFinished ? (
											<RotateCcw aria-hidden className="size-3.5 shrink-0" />
										) : (
											<Play
												aria-hidden
												className={cn(
													"size-3.5 shrink-0",
													!isPlaying && "text-muted-foreground",
												)}
											/>
										)}
										<span className="min-w-0 flex-1">{path.label}</span>
										{isPlaying ? (
											<span aria-hidden className="text-xs tabular-nums opacity-80">
												{isRunning
													? ""
													: `${isFinished ? MESSAGES.workflowMapDoneShort : MESSAGES.workflowMapPausedShort} · `}
												{step + 1}/{path.codes.length}
											</span>
										) : (
											// Where the route ends, as a dot in that outcome's colour.
											<span
												aria-hidden
												className={cn(
													"size-2 shrink-0 rounded-full",
													STATUS_TONES[path.outcome].dot,
												)}
											/>
										)}
									</button>
								</li>
							);
						})}
					</ul>
					{/* Every status as a chip, under the paths in the same card: the keyboard- and
					    phone-friendly way to drive the diagram. */}
					<div className="mt-3 border-t border-border pt-3">
						<h3 className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase">
							{MESSAGES.workflowMapPick}
						</h3>
						<div className="mt-1.5 grid grid-cols-2 gap-x-1 gap-y-px">
							{workflowStatuses.map((status) => (
								<button
									aria-pressed={status.code === selected}
									className={cn(
										"flex items-center gap-1.5 rounded-md px-2 py-[3px] text-left text-xs whitespace-nowrap transition-colors",
										"focus-visible:ring-primary/60 focus-visible:ring-2 focus-visible:outline-none",
										status.code === selected
											? cn(STATUS_TONES[status.tone].chip, "font-semibold ring-1")
											: "text-foreground hover:bg-muted",
									)}
									key={status.code}
									onClick={() => select(status.code)}
									onMouseEnter={() => setHovered(status.code)}
									onMouseLeave={() => setHovered(null)}
									type="button"
								>
									<span
										className={cn("size-1.5 shrink-0 rounded-full", STATUS_TONES[status.tone].dot)}
									/>
									{status.name}
								</button>
							))}
						</div>
					</div>
				</aside>

				{/* On a phone the diagram scrolls sideways inside its own frame. */}
				<div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-2">
					{/* Playback control, top-left of the diagram where the eye lands while watching
					    a path, with what is playing beside it. */}
					<div className="flex items-center gap-3 px-1 pt-1 pb-2.5">
						<button
							className={cn(
								"inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors",
								"focus-visible:ring-primary/60 focus-visible:ring-2 focus-visible:outline-none",
								"disabled:text-muted-foreground disabled:cursor-not-allowed disabled:border-border disabled:opacity-60",
								playing && !paused
									? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-primary/40 text-primary hover:bg-primary/10",
							)}
							disabled={!playing}
							onClick={control}
							type="button"
						>
							{finished ? (
								<RotateCcw aria-hidden className="size-4" />
							) : playing && paused ? (
								<Play aria-hidden className="size-4" />
							) : (
								<Pause aria-hidden className="size-4" />
							)}
							{finished ? "Reset" : playing && paused ? "Resume" : "Pause"}
						</button>
						<p aria-live="polite" className="text-muted-foreground min-w-0 truncate text-base">
							{playing ? (
								<>
									<span className="text-foreground font-semibold">{playing.label}</span>
									{` · ${finished ? MESSAGES.workflowMapDoneShort : `${step + 1} / ${playing.codes.length}`}`}
								</>
							) : (
								MESSAGES.workflowMapIdle
							)}
						</p>
					</div>
					<div className="relative flex w-full flex-1 items-center overflow-x-auto">
						<svg
							aria-label={MESSAGES.workflowMapAria}
							// The map draws at its natural size — full width, aspect ratio untouched. No
							// height cap: capping it to the window shrank every block on a laptop screen.
							className="block h-auto w-full min-w-[900px] select-none"
							preserveAspectRatio="xMidYMid meet"
							role="group"
							viewBox={`0 0 ${STATUS_MAP_SIZE.width} ${STATUS_MAP_SIZE.height}`}
						>
							<defs>
								<marker
									id={`${markerId}-out`}
									markerHeight="7"
									markerWidth="7"
									orient="auto-start-reverse"
									refX="8"
									refY="5"
									viewBox="0 0 10 10"
								>
									<path className="fill-primary" d="M0,0 L10,5 L0,10 z" />
								</marker>
								<marker
									id={`${markerId}-in`}
									markerHeight="7"
									markerWidth="7"
									orient="auto-start-reverse"
									refX="8"
									refY="5"
									viewBox="0 0 10 10"
								>
									<path className="fill-primary/80" d="M0,0 L10,5 L0,10 z" />
								</marker>
								<marker
									id={`${markerId}-undo`}
									markerHeight="7"
									markerWidth="7"
									orient="auto-start-reverse"
									refX="8"
									refY="5"
									viewBox="0 0 10 10"
								>
									<path className="fill-slate-500" d="M0,0 L10,5 L0,10 z" />
								</marker>
								<marker
									id={`${markerId}-dim`}
									markerHeight="5"
									markerWidth="5"
									orient="auto-start-reverse"
									refX="8"
									refY="5"
									viewBox="0 0 10 10"
								>
									<path className="fill-muted-foreground/15" d="M0,0 L10,5 L0,10 z" />
								</marker>
							</defs>

							{/* One light ground under the whole diagram; the stages are separated by hairline
							    rules and their headings, not by alternating tints. */}
							<rect
								className="fill-slate-50 dark:fill-slate-900/50"
								height={STATUS_MAP_SIZE.height}
								width={STATUS_MAP_SIZE.width}
							/>
							{statusBands.map((band, index) => {
								return (
									<g key={band.label}>
										<line
											className="stroke-border"
											strokeWidth={1}
											x1={band.x0}
											x2={band.x0}
											y1={0}
											y2={STATUS_MAP_SIZE.height}
										/>
										<circle className="fill-primary" cx={band.x0 + 30} cy={45} r={7} />
										<text
											className="fill-foreground/75 text-[17px] font-bold tracking-[0.08em] uppercase"
											x={band.x0 + 46}
											y={52}
										>
											{`${index + 1} · ${band.label}`}
										</text>
									</g>
								);
							})}

							{orderedEdges.map((edge) => {
								const { d } = geometry.get(edge.key)!;
								// A finished path replaces the one-step highlight with the whole path.
								const onPath = pathEdges?.has(edge.key) ?? false;
								const out = !pathEdges && edge.from === selected;
								const into = !pathEdges && !out && !playing && edge.to === selected;
								const preview = edge.from === hovered;
								const undoEdge = edge.kind === "undo";
								const marker = onPath ? "out" : out ? (undoEdge ? "undo" : "out") : into ? "in" : "dim";

								return (
									<path
										className={cn(
											"fill-none transition-[stroke,stroke-width,opacity] duration-300",
											onPath && "stroke-primary",
											out && !undoEdge && "stroke-primary flow-dash",
											out && undoEdge && "stroke-slate-500 [stroke-dasharray:6_6]",
											// Moves in from the previous statuses: solid, so the next moves (dashed,
											// labelled) still read as "where it goes from here".
											into && "stroke-primary/80",
											!onPath && !out && !into && preview && "stroke-primary/50",
											!onPath && !out && !into && !preview && "stroke-muted-foreground/10",
										)}
										d={d}
										key={edge.key}
										markerEnd={`url(#${markerId}-${marker})`}
										strokeWidth={onPath || out ? 3.4 : into ? 2.8 : 1.5}
									/>
								);
							})}

							{workflowStatuses.map((status) => (
								<StatusNode
									dimmed={!connected.has(status.code)}
									key={status.code}
									onHover={setHovered}
									onSelect={select}
									selected={status.code === selected}
									status={status}
								/>
							))}

							{/* Labels for the selected status's next moves — or every move of a finished path — drawn above everything else. */}
							{edges
								.filter((edge) => (pathEdges ? pathEdges.has(edge.key) : edge.from === selected))
								.map((edge) => {
									const { label } = geometry.get(edge.key)!;
									const width = edge.label.length * 11.5 + 36;
									const undoEdge = edge.kind === "undo";
									return (
										<motion.g
											animate={{ opacity: 1, scale: 1 }}
											initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
											key={`label-${edge.key}`}
											style={{ transformBox: "fill-box", transformOrigin: "center" }}
											transition={{ duration: 0.25 }}
										>
											<rect
												className={cn(
													"fill-card",
													undoEdge ? "stroke-slate-400" : "stroke-primary/60",
												)}
												height={38}
												rx={19}
												strokeWidth={1}
												width={width}
												x={label[0] - width / 2}
												y={label[1] - 19}
											/>
											<text
												className={cn(
													"text-[20px] font-bold",
													undoEdge ? "fill-slate-700 dark:fill-slate-300" : "fill-primary",
												)}
												dominantBaseline="central"
												textAnchor="middle"
												x={label[0]}
												y={label[1] + 0.5}
											>
												{edge.label}
											</text>
										</motion.g>
									);
								})}
							{/* Step numbers while a path plays, on top of everything so a move label can never hide one. */}
							{workflowStatuses.map((status) => {
								const numbers = stepNumbers.get(status.code);
								if (!numbers) return null;
								return (
									<g
										key={`step-${status.code}`}
										transform={`translate(${status.x - NODE_W / 2} ${status.y - NODE_H / 2})`}
									>
										<StepBadge current={playing?.codes[step] === status.code} numbers={numbers} />
									</g>
								);
							})}
						</svg>
					</div>
					<p className="text-muted-foreground mt-2 w-full border-t border-border px-1 pt-2.5 text-xs sm:hidden">
						{MESSAGES.workflowMapSwipe}
					</p>
				</div>
			</div>
		</div>
	);
};

type StatusNodePropsType = {
	dimmed: boolean;
	onHover: (code: string | null) => void;
	onSelect: (code: string) => void;
	selected: boolean;
	status: WorkflowStatusType;
};

/** A node in the diagram. Deliberately not a tab stop: seventeen focusable nodes would make
 *  tabbing through the page unusable, and the chip list above offers the same selection with
 *  real buttons. The node is the pointer shortcut to it. */
const StatusNode = ({ dimmed, onHover, onSelect, selected, status }: StatusNodePropsType) => {
	const clipId = useId().replace(/:/g, "");
	const nameLines = splitName(status.name);
	const tone = STATUS_TONES[status.tone];

	return (
		<g
			aria-label={`${status.name}: ${status.description}`}
			aria-pressed={selected}
			className={cn(
				"cursor-pointer transition-opacity duration-300 focus:outline-none",
				dimmed ? "opacity-25 grayscale" : "opacity-100",
			)}
			onClick={() => onSelect(status.code)}
			onMouseEnter={() => onHover(status.code)}
			onMouseLeave={() => onHover(null)}
			role="button"
			transform={`translate(${status.x - NODE_W / 2} ${status.y - NODE_H / 2})`}
		>
			{/* Selection ring in the status's own colour, so picking a node tells you which
			    family it belongs to before you read its name. */}
			<rect
				className={cn(
					"fill-none transition-[stroke-opacity] duration-300",
					selected ? tone.nodeRing : "stroke-transparent",
				)}
				height={NODE_H + 14}
				rx={15}
				strokeWidth={4}
				width={NODE_W + 14}
				x={-7}
				y={-7}
			/>
			{/* A soft drop shadow under the block lifts it off the tinted column behind it. */}
			<rect className="fill-foreground/8" height={NODE_H} rx={10} width={NODE_W} x={0} y={3} />
			<rect className={tone.node} height={NODE_H} rx={10} strokeWidth={2} width={NODE_W} />
			{/* A solid stripe of the status colour down the left edge, clipped to the block's rounded
			    corners: the family reads before the name. */}
			<clipPath id={clipId}>
				<rect height={NODE_H} rx={10} width={NODE_W} />
			</clipPath>
			<rect className={tone.accent} clipPath={`url(#${clipId})`} height={NODE_H} width={7} />
			<text
				className={cn(
					"fill-foreground text-[26px] tracking-[-0.01em]",
					selected ? "font-extrabold" : "font-bold",
				)}
				dominantBaseline="central"
			>
				{nameLines.map((line, index) => (
					<tspan
						key={line}
						x={24}
						y={NODE_H / 2 + 1 + (index - (nameLines.length - 1) / 2) * NAME_LINE_HEIGHT}
					>
						{line}
					</tspan>
				))}
			</text>
			{status.closed && (
				<g transform={`translate(${NODE_W - 6} 6)`}>
					<circle className="fill-card stroke-foreground/25" r={16} strokeWidth={2} />
					<g transform="translate(-9 -9)">
						<Lock aria-hidden className="text-foreground/70" height={18} width={18} />
					</g>
				</g>
			)}
		</g>
	);
};

/** The step number(s) on a status while a path plays, pinned to the block's top-left corner. The
 *  current step is solid; earlier ones are outlined so the trail reads in order. */
const StepBadge = ({ current, numbers }: { current: boolean; numbers: number[] }) => {
	const text = numbers.join(", ");
	const width = Math.max(34, text.length * 13 + 20);

	return (
		<g transform="translate(-10 -16)">
			<rect
				className={current ? "fill-primary stroke-primary" : "fill-card stroke-primary"}
				height={34}
				rx={17}
				strokeWidth={2.5}
				width={width}
			/>
			<text
				className={cn(
					"text-[20px] font-bold tabular-nums",
					current ? "fill-primary-foreground" : "fill-primary",
				)}
				dominantBaseline="central"
				textAnchor="middle"
				x={width / 2}
				y={18}
			>
				{text}
			</text>
		</g>
	);
};
