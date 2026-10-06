import type { StatusToneType } from "@/content/workflow";

type ToneClassesType = {
	/** Left accent bar inside the SVG node. */
	accent: string;
	/** Pill used in the side panel and the status chip list. */
	chip: string;
	/** Small round marker beside a status name. */
	dot: string;
	/** Node body inside the SVG. */
	node: string;
	/** Outline drawn around the selected node. */
	nodeRing: string;
};

/** Four groups, four hues, each carrying one meaning: still moving (blue), waiting on something
 *  (amber), done (green), closed without a repair (slate). The nine status tones used to have a
 *  hue each, which read as decoration rather than information.
 *
 *  Contrast comes from the edges, not the fill: a pale body, a saturated 500 border and a 600
 *  stripe, with the name in the foreground colour. Red stays reserved for errors. */
const ACTIVE: ToneClassesType = {
	accent: "fill-blue-600 dark:fill-blue-400",
	chip: "bg-blue-50 text-blue-800 ring-blue-500/50 dark:bg-blue-950/60 dark:text-blue-200",
	dot: "bg-blue-600 dark:bg-blue-400",
	node: "fill-blue-50 stroke-blue-500 dark:fill-blue-950 dark:stroke-blue-400",
	nodeRing: "stroke-blue-600 dark:stroke-blue-400",
};

const WAITING: ToneClassesType = {
	accent: "fill-amber-500",
	chip: "bg-amber-50 text-amber-900 ring-amber-500/50 dark:bg-amber-950/60 dark:text-amber-200",
	dot: "bg-amber-500",
	node: "fill-amber-50 stroke-amber-500 dark:fill-amber-950 dark:stroke-amber-400",
	nodeRing: "stroke-amber-500",
};

const DONE: ToneClassesType = {
	accent: "fill-emerald-600 dark:fill-emerald-400",
	chip: "bg-emerald-50 text-emerald-800 ring-emerald-500/50 dark:bg-emerald-950/60 dark:text-emerald-200",
	dot: "bg-emerald-600 dark:bg-emerald-400",
	node: "fill-emerald-50 stroke-emerald-500 dark:fill-emerald-950 dark:stroke-emerald-400",
	nodeRing: "stroke-emerald-600 dark:stroke-emerald-400",
};

const CLOSED: ToneClassesType = {
	accent: "fill-slate-500 dark:fill-slate-400",
	chip: "bg-slate-100 text-slate-800 ring-slate-500/50 dark:bg-slate-800 dark:text-slate-200",
	dot: "bg-slate-500 dark:bg-slate-400",
	node: "fill-slate-100 stroke-slate-500 dark:fill-slate-800 dark:stroke-slate-400",
	nodeRing: "stroke-slate-600 dark:stroke-slate-400",
};

export const STATUS_TONES: Record<StatusToneType, ToneClassesType> = {
	ended: CLOSED,
	estimate: ACTIVE,
	external: WAITING,
	final: DONE,
	intake: ACTIVE,
	notFixed: CLOSED,
	paused: WAITING,
	success: DONE,
	work: ACTIVE,
};
