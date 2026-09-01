import { AlertTriangle } from "lucide-react";
import type { WhatsappCompletionState } from "./customer-connect/customer-connect-schema";

// Generalized out of customer-connect-grid.tsx (plans/plan-whatsapp.md, Step 8) —
// the same pill (success/fail counts, "Last try" timestamp, delivery badge) reads
// job-intake status wherever it's needed, driven by which `eventKey` the caller
// passes rather than a hardcoded "JOB_COMPLETION". `WhatsappCompletionState`'s name
// is a holdover from when only one event existed — its shape (attempt/success/fail
// counts, last status) is already generic, so it's reused as-is for JOB_CREATION.

function fmtLastTry(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    let hours = d.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

const DELIVERY_BADGE_STYLES: Record<string, string> = {
    ACCEPTED:  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    SENT:      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    READ:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    FAILED:    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

type WhatsappStatusRow = {
    whatsapp_notifications: Record<string, WhatsappCompletionState> | null;
};

export function WhatsappStatusCell({ row, eventKey }: { row: WhatsappStatusRow; eventKey: "JOB_COMPLETION" | "JOB_CREATION" }) {
    const state = row.whatsapp_notifications?.[eventKey] ?? null;
    if (!state || (state.success_count === 0 && state.fail_count === 0)) {
        return <span className="text-sm text-(--cl-text-muted)">—</span>;
    }
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-xs font-bold text-[#128C7E] dark:text-[#25D366]"
                    title={`${state.success_count} successful attempt${state.success_count !== 1 ? "s" : ""}`}
                >
                    ✓ {state.success_count}
                </span>
                {state.fail_count > 0 && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-400"
                        title={`${state.fail_count} failed attempt${state.fail_count !== 1 ? "s" : ""}${state.last_error ? ` — ${state.last_error}` : ""}`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {state.fail_count}
                    </span>
                )}
            </div>
            {state.last_sent_at && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Last try: {fmtLastTry(state.last_sent_at)}
                </span>
            )}
            {state.last_status && (
                <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold ${DELIVERY_BADGE_STYLES[state.last_status] ?? ""}`}
                    title={state.last_error ?? undefined}
                >
                    {state.last_status}
                </span>
            )}
        </div>
    );
}
