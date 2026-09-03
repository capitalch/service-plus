import { AlertTriangle } from "lucide-react";
import type { WhatsappCompletionState } from "./customer-connect/customer-connect-schema";

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
export function WhatsappStatusCell({ state, isDeliveryConfirmation = false }: {
    state: WhatsappCompletionState | null;
    isDeliveryConfirmation?: boolean;
}) {
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
    if (!state || (successCount === 0 && failCount === 0 && !state.otp_pending)) {
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
