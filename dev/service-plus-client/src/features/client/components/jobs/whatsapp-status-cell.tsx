import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { resolveAttemptHistory } from "./customer-connect/customer-connect-helpers";
import type { WhatsappAttempt, WhatsappCompletionState } from "./customer-connect/customer-connect-schema";

// Generalized out of customer-connect-grid.tsx (plans/plan-whatsapp.md, Step 8) —
// the same pill (success/fail counts, "Last try" timestamp, delivery badge) reads
// WhatsApp status wherever it's needed, driven by the already-resolved `state`
// object the caller passes in, not a hardcoded "JOB_COMPLETION".
// `WhatsappCompletionState`'s name is a holdover from when only one event
// existed — its shape (attempt/success/fail counts, last status) is already
// generic, so it's reused as-is for every event, including JOB_MONEY_RECEIPT's
// per-array-element state (plans/plan.md, Step 5).

function fmtLastTry(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    let hours = d.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

// Tooltip for one history row: when the outcome landed, and why it failed if it
// did. `status_at` is null while an attempt is still unsettled (ACCEPTED with no
// callback yet), which is itself the useful thing to convey.
function fmtAttemptOutcome(a: WhatsappAttempt): string {
    const when = a.status_at ? `${a.status} ${fmtLastTry(a.status_at)}` : `${a.status} — not settled yet`;
    return a.error ? `${when} — ${a.error}` : when;
}

const DELIVERY_BADGE_STYLES: Record<string, string> = {
    ACCEPTED:  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    SENT:      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    READ:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    FAILED:    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const CONFIRMATION_LABEL: Record<"otp_verified" | "manual_override", string> = {
    otp_verified:    "Confirmed",
    manual_override: "Confirmed in person",
};

// `state` is resolved by the caller, not derived here from `row`/`eventKey` —
// the Money Receipt log tab's row shape has no per-event key to index into
// (JOB_MONEY_RECEIPT's value is an array, one element per payment_id; the
// server-side lateral join already picks out the one element this row
// needs, see money-receipt-log-section.tsx), so this component only ever
// needs the already-resolved state object, whichever tab it came from.
// `isDeliveryConfirmation` replaces the old `eventKey === "JOB_DELIVERY"`
// check for the same reason — the one place `eventKey` drove behavior
// beyond the lookup itself.
//
// A customer can be messaged about the same job several times, and the flat
// `last_*` fields only ever describe the most recent one. Whenever there was
// more than one send, this lists every one of them — time and outcome —
// rather than just the last. Expanded by default: a job that was messaged
// repeatedly is precisely the row someone opens this screen to look at, and
// hiding that behind a click is what the flat display already did wrong.
// `resolveAttemptHistory` reconciles the recorded array against
// `attempt_count`, so a job messaged before per-attempt history existed still
// shows its known last send and an honest count of what wasn't recorded.
// Rendered here rather than in one grid so every tab that already uses this
// cell gets it, instead of forking a second status cell.
export function WhatsappStatusCell({ state, isDeliveryConfirmation = false }: {
    state: WhatsappCompletionState | null;
    isDeliveryConfirmation?: boolean;
}) {
    const [historyCollapsed, setHistoryCollapsed] = useState(false);
    const hasConfirmation = isDeliveryConfirmation && !!state?.confirmed_at && !!state.confirmation_method;
    // `success_count` is written by exactly one thing — Meta's status webhook
    // (SET_JOB_WHATSAPP_OUTCOME), on the transition into DELIVERED — so it measures
    // *transport* delivery to the handset. For JOB_DELIVERY that is not what
    // "delivered" means here: the job is delivered once the customer confirms the
    // code (or staff record a manual override), which lands in `confirmed_at` and
    // never touches `success_count`. The Customer Connect Job Delivery log only
    // lists rows that already have `confirmed_at` (GET_WHATSAPP_EVENT_LOG_*), so
    // leading every one of them with a raw "✓ 0" reported a success as a failure.
    // Count the confirmation itself for that event; leave the other two events on
    // the webhook count, which is the only success signal they have.
    // `?? 0` because neither the send nor the confirmation path writes the key at
    // all — absent, not zero, until a webhook callback lands.
    const successCount = hasConfirmation ? 1 : (state?.success_count ?? 0);
    const failCount    = state?.fail_count ?? 0;
    // Newest first (resolveAttemptHistory reverses), reconciled against
    // attempt_count so pre-history jobs still account for their sends.
    const { attempts, unrecorded, totalSends } = resolveAttemptHistory(state);
    // Shown whenever there is any attempt record at all — not only when there are
    // several. Gating this on "more than one send" was wrong: a job messaged once
    // has a complete, correctly recorded attempt, and hiding it behind that gate
    // rendered the old flat "Last try" line instead, so a freshly sent job looked
    // exactly as it did before per-attempt history existed. When the list shows it
    // replaces that line and the lone status badge, which only repeat its newest row.
    const showHistory = attempts.length > 0;
    // The collapse toggle only earns its line when there is more than one row to
    // collapse; a single attempt just renders as itself.
    const showToggle  = totalSends > 1;
    // A send that Meta hasn't settled yet has neither a success nor a failure
    // to count, but it is still a message that went out — before the per-attempt
    // history existed there was nothing to say so, and the cell fell through to
    // "—". With an attempt on record there is.
    if (!state || (successCount === 0 && failCount === 0 && !state.otp_pending && attempts.length === 0)) {
        return <span className="text-sm text-(--cl-text-muted)">—</span>;
    }
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-xs font-bold text-[#128C7E] dark:text-[#25D366]"
                    title={hasConfirmation
                        ? `Delivery confirmed${state.confirmed_at ? ` ${fmtLastTry(state.confirmed_at)}` : ""}`
                        : `${successCount} successful attempt${successCount !== 1 ? "s" : ""}`}
                >
                    ✓ {successCount}
                </span>
                {failCount > 0 && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-400"
                        title={`${failCount} failed attempt${failCount !== 1 ? "s" : ""}${state.last_error ? ` — ${state.last_error}` : ""}`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {failCount}
                    </span>
                )}
            </div>
            {!showHistory && state.last_sent_at && (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Last try: {fmtLastTry(state.last_sent_at)}
                </span>
            )}
            {!showHistory && state.last_status && (
                <span
                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold ${DELIVERY_BADGE_STYLES[state.last_status] ?? ""}`}
                    title={state.last_error ?? undefined}
                >
                    {state.last_status}
                </span>
            )}
            {showHistory && (
                <>
                    {showToggle && (
                    <button
                        aria-expanded={!historyCollapsed}
                        className="inline-flex w-fit items-center gap-0.5 rounded text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-(--cl-accent) cursor-pointer"
                        title={historyCollapsed ? "Show all sends" : "Hide all sends"}
                        type="button"
                        onClick={e => { e.stopPropagation(); setHistoryCollapsed(c => !c); }}
                    >
                        {historyCollapsed
                            ? <ChevronRight className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />}
                        {totalSends} sends
                    </button>
                    )}
                    {(!historyCollapsed || !showToggle) && (
                        <div className="flex w-fit flex-col gap-1 rounded-md border border-(--cl-border) bg-(--cl-surface-2) px-2 py-1.5">
                            {attempts.map(a => (
                                <div key={`${a.attempt_no}-${a.sent_at}`} className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="min-w-4 shrink-0 text-right text-[10px] font-semibold text-(--cl-text-muted)">{a.attempt_no}.</span>
                                    <span className="text-[11px] tabular-nums text-(--cl-text)">{a.sent_at ? fmtLastTry(a.sent_at) : "\u2014"}</span>
                                    <span
                                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${DELIVERY_BADGE_STYLES[a.status] ?? ""}`}
                                        title={fmtAttemptOutcome(a)}
                                    >
                                        {a.status}
                                    </span>
                                </div>
                            ))}
                            {/* Sends made before per-attempt history existed. Counted,
                                never invented — their times and outcomes are gone. */}
                            {unrecorded > 0 && (
                                <span className="text-[10px] italic text-(--cl-text-muted)">
                                    + {unrecorded} earlier send{unrecorded !== 1 ? "s" : ""} — not recorded
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
            {hasConfirmation && (
                <span
                    className="inline-flex w-fit items-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                    title={state.confirmed_at ? `Confirmed ${fmtLastTry(state.confirmed_at)}` : undefined}
                >
                    {CONFIRMATION_LABEL[state.confirmation_method!]}
                </span>
            )}
            {!hasConfirmation && state.otp_pending && (
                <span className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    Verify Code
                </span>
            )}
        </div>
    );
}
