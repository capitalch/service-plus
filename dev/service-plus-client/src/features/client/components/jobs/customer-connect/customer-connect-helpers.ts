import { isValidMobile } from "@/lib/mobile";
import type { CustomerConnectJobRow, CustomerGroup, WhatsappAttempt, WhatsappCompletionState } from "./customer-connect-schema";

export const PAGE_SIZE = 50;

export function isRowSelectable(row: CustomerConnectJobRow): boolean {
    return isValidMobile(row.mobile);
}

export function getCompletionState(row: CustomerConnectJobRow): WhatsappCompletionState | null {
    return row.whatsapp_notifications?.JOB_COMPLETION ?? null;
}

// Any prior attempt unselects the row, including one still pending an outcome —
// attempt_count is set synchronously at send time (before success/fail is known),
// so a row just sent but not yet settled still counts as "attempted" and won't
// revert to checked on a refresh. A resend must be a deliberate click, not just
// "never succeeded".
export function hasAnyPriorAttempt(row: CustomerConnectJobRow): boolean {
    const state = getCompletionState(row);
    return (state?.attempt_count ?? 0) > 0;
}

export type GroupableJobRow = Pick<CustomerConnectJobRow, "id" | "job_no" | "amount" | "customer_contact_id" | "customer_name" | "mobile">;

// Groups by customer_contact_id — one WhatsApp message per customer, never one
// per job. Mirrors the grouping the sendWhatsappCompletion resolver itself does
// server-side, so "N jobs · M customers" in the toolbar/modal is trustworthy
// before the click, not just after the server re-groups it.
export function groupRowsByCustomer(rows: GroupableJobRow[]): CustomerGroup[] {
    const groups = new Map<number, CustomerGroup>();
    for (const row of rows) {
        let group = groups.get(row.customer_contact_id);
        if (!group) {
            group = {
                customer_contact_id: row.customer_contact_id,
                customer_name: row.customer_name,
                mobile: row.mobile,
                job_ids: [],
                job_nos: [],
                amount: 0,
            };
            groups.set(row.customer_contact_id, group);
        }
        group.job_ids.push(row.id);
        group.job_nos.push(row.job_no);
        group.amount += row.amount ?? 0;
    }
    return [...groups.values()];
}

// Client-side mirror of SET_JOB_WHATSAPP_OUTCOME's `attempts` update, for the live
// whatsappDeliveryStatus patch: settle the one element whose wamid matches, leave
// the rest alone. The subscription payload carries no wamid, but it doesn't need to
// — the server only ever applies an outcome whose wamid equals the event's current
// last_wamid (that query's own WHERE clause), so that is the element being settled.
// `status_at` is stamped from the browser clock here rather than the server's; it's
// an optimistic patch that the next Refresh replaces with the authoritative value,
// and the alternative is leaving the row visibly unsettled until then.
export function applyOutcomeToAttempts(
    attempts: WhatsappAttempt[] | null | undefined,
    lastWamid: string | null,
    status: WhatsappAttempt["status"],
    error: string | null,
): WhatsappAttempt[] | null {
    if (!attempts?.length) return attempts ?? null;
    return attempts.map(a =>
        a.wamid !== null && a.wamid === lastWamid
            ? { ...a, status, error, status_at: new Date().toISOString() }
            : a,
    );
}

// The history to display for one event, reconciled against `attempt_count`.
//
// `attempts` only starts filling from the release that added it, so nearly every
// job in an existing database has counters proving several sends and no array to
// show for them. Two things follow, and both matter more than they look:
//
//  - The most recent send is always known even with no array at all — that is
//    exactly what the flat `last_*` fields are. Synthesize it rather than
//    rendering an empty history next to "attempt_count: 3". `status_at` is left
//    null because the flat fields genuinely don't record when the outcome landed,
//    only what it was.
//  - Sends before that are unrecoverable — they were never written down. Report
//    the count as missing instead of quietly showing 1 of 3 and letting the row
//    read as complete.
export function resolveAttemptHistory(state: WhatsappCompletionState | null): {
    attempts: WhatsappAttempt[];
    unrecorded: number;
    totalSends: number;
} {
    if (!state) return { attempts: [], unrecorded: 0, totalSends: 0 };
    const recorded = [...(state.attempts ?? [])];
    // attempt_count is the authoritative send counter; fall back to the array
    // length in case a write ever lands one without the other.
    const totalSends = Math.max(state.attempt_count ?? 0, recorded.length);

    if (recorded.length === 0 && state.last_sent_at) {
        recorded.push({
            attempt_no: totalSends || 1,
            wamid:      state.last_wamid,
            sent_at:    state.last_sent_at,
            status:     state.last_status ?? "ACCEPTED",
            status_at:  null,
            error:      state.last_error,
        });
    }
    return {
        attempts:   recorded.slice().reverse(),  // newest first
        unrecorded: Math.max(0, totalSends - recorded.length),
        totalSends,
    };
}
