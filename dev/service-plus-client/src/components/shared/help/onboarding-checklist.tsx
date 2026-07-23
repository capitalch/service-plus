import { useCallback, useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHelp } from "@/features/client/components/layout/client-layout";

const DISMISSED_KEY = "help-onboarding-dismissed";
const PROGRESS_KEY = "help-onboarding-progress";

type Step = { label: string; articleId: string };

const STEPS: Step[] = [
    { label: "Create a Branch",             articleId: "vendors-branches" },
    { label: "Create a Division",           articleId: "divisions" },
    { label: "Configure Numbering",         articleId: "document-sequences" },
    { label: "Add Spare Parts",             articleId: "parts" },
    { label: "Add Customers & Technicians", articleId: "customers" },
    { label: "Create Your First Job",       articleId: "create-job" },
];

function loadProgress(): Set<number> {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

function saveProgress(completed: Set<number>) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completed]));
}

export function OnboardingChecklist() {
    const { openHelp } = useHelp();
    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
    });
    const [completed, setCompleted] = useState(loadProgress);

    const allDone = completed.size >= STEPS.length;

    const toggle = useCallback((idx: number) => {
        setCompleted(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            saveProgress(next);
            return next;
        });
    }, []);

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISSED_KEY, "1");
        setDismissed(true);
    }, []);

    if (dismissed || allDone) return null;

    return (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800/40 dark:bg-violet-950/20">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-violet-900 dark:text-violet-200">
                        Set up Service+ in {STEPS.length} steps
                    </p>
                    <p className="mt-0.5 text-xs text-violet-700/70 dark:text-violet-300/60">
                        {completed.size} of {STEPS.length} complete
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="shrink-0 rounded p-0.5 text-violet-400 transition-colors hover:text-violet-600 dark:hover:text-violet-300"
                    title="Dismiss checklist"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="mt-3 space-y-1.5">
                {STEPS.map((step, idx) => {
                    const done = completed.has(idx);
                    return (
                        <div key={idx} className="flex items-center gap-2">
                            <button
                                onClick={() => toggle(idx)}
                                className="shrink-0 cursor-pointer"
                                title={done ? "Mark incomplete" : "Mark complete"}
                            >
                                {done
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    : <Circle className="h-4 w-4 text-violet-300 dark:text-violet-600" />
                                }
                            </button>
                            <span className={cn(
                                "text-xs font-medium",
                                done
                                    ? "text-violet-400 line-through dark:text-violet-500"
                                    : "text-violet-800 dark:text-violet-200",
                            )}>
                                {step.label}
                            </span>
                            {!done && (
                                <button
                                    onClick={() => openHelp(step.articleId)}
                                    className="ml-auto text-[10px] font-semibold text-violet-500 underline-offset-2 hover:underline dark:text-violet-400"
                                >
                                    Learn more
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
