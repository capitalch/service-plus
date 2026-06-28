// Shared, uniform colour treatment for Job Type and Job Status across every job
// grid. Status colours come from the single source of truth in status-transitions;
// job-type colours live here. Both render as the same pill so all grids match.

import { STATUS_COLORS } from "./job-pipeline/status-transitions";

const BADGE_BASE = "inline-block rounded-sm px-2 py-0.5 text-xs font-medium";

// ── Job Type ──────────────────────────────────────────────────────────────────

// Colourful pill per job type. Known codes get a fixed colour; any custom/unknown
// job type falls back to a deterministic palette pick so the column stays colourful.
const JOB_TYPE_PALETTE = [
    "text-violet-700  dark:text-violet-300  bg-violet-50  dark:bg-violet-950/40",
    "text-sky-700     dark:text-sky-300     bg-sky-50     dark:bg-sky-950/40",
    "text-amber-700   dark:text-amber-300   bg-amber-50   dark:bg-amber-950/40",
    "text-teal-700    dark:text-teal-300    bg-teal-50    dark:bg-teal-950/40",
    "text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/40",
    "text-cyan-700    dark:text-cyan-300    bg-cyan-50    dark:bg-cyan-950/40",
];

export const JOB_TYPE_COLORS: Record<string, string> = {
    MAKE_READY:     "text-lime-700    dark:text-lime-300    bg-lime-50    dark:bg-lime-950/40",
    ESTIMATE:       "text-blue-700    dark:text-blue-300    bg-blue-50    dark:bg-blue-950/40",
    UNDER_WARRANTY: "text-orange-700  dark:text-orange-300  bg-orange-50  dark:bg-orange-950/40",
    INSTALLATION:   "text-amber-700   dark:text-amber-300   bg-amber-50   dark:bg-amber-950/40",
    DEMO:           "text-yellow-700  dark:text-yellow-300  bg-yellow-50  dark:bg-yellow-950/40",
    MAINTENANCE:    "text-indigo-700  dark:text-indigo-300  bg-indigo-50  dark:bg-indigo-950/40",
    INSPECTION:     "text-slate-600   dark:text-slate-300   bg-slate-100  dark:bg-slate-800/60",
    AMC_SERVICE:    "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40",
    UPGRADE:        "text-purple-700  dark:text-purple-300  bg-purple-50  dark:bg-purple-950/40",
    REFURBISH:      "text-cyan-700    dark:text-cyan-300    bg-cyan-50    dark:bg-cyan-950/40",
};

export function jobTypeColor(code: string | null | undefined): string {
    if (code && JOB_TYPE_COLORS[code]) return JOB_TYPE_COLORS[code];
    const key = code ?? "";
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return JOB_TYPE_PALETTE[Math.abs(hash) % JOB_TYPE_PALETTE.length];
}

export function JobTypeBadge({ code, name, className = "" }: {
    code:       string | null | undefined;
    name:       string | null | undefined;
    className?: string;
}) {
    if (!name) return <>—</>;
    return <span className={`${BADGE_BASE} ${jobTypeColor(code)} ${className}`}>{name}</span>;
}

// ── Job Status ────────────────────────────────────────────────────────────────

// Status colours double as button colours elsewhere (they carry hover: classes).
// A badge is not interactive, so strip the hover: variants here.
export function statusBadgeClass(code: string | null | undefined): string {
    const raw = STATUS_COLORS[code ?? ""] ?? "bg-slate-400 text-white";
    return raw.trim().split(/\s+/).filter(c => c && !c.startsWith("hover:")).join(" ");
}

export function StatusBadge({ code, name, className = "" }: {
    code:       string | null | undefined;
    name:       string | null | undefined;
    className?: string;
}) {
    if (!name) return <>—</>;
    return <span className={`${BADGE_BASE} ${statusBadgeClass(code)} ${className}`}>{name}</span>;
}
