import type { WarrantyBatchJobRow } from "@/features/client/types/job";
import { getTransitions } from "../job-pipeline/status-transitions";

export type TransactionKind =
    | "COMPLETED_OK"
    | "SEND_TO_COMPANY"
    | "RECEIVE_FROM_COMPANY"
    | "FINAL"
    | "DELIVER";

export type TransactionGroup = "vendor-cycle" | "completion";

export const TRANSACTION_GROUP: Record<TransactionKind, TransactionGroup> = {
    COMPLETED_OK:          "completion",
    FINAL:                 "completion",
    DELIVER:               "completion",
    SEND_TO_COMPANY:       "vendor-cycle",
    RECEIVE_FROM_COMPANY:  "vendor-cycle",
};

export const TRANSACTION_LABEL: Record<TransactionKind, string> = {
    COMPLETED_OK:          "Completed OK",
    SEND_TO_COMPANY:       "Send to Company",
    RECEIVE_FROM_COMPANY:  "Received from Company",
    FINAL:                 "Final a Job",
    DELIVER:               "Deliver a Job",
};

// Fixed pipeline order within each mutually-exclusive group (see getEligibleKinds).
export const COMPLETION_ORDER: TransactionKind[] = ["COMPLETED_OK", "FINAL", "DELIVER"];
export const VENDOR_ORDER:     TransactionKind[] = ["SEND_TO_COMPANY", "RECEIVE_FROM_COMPANY"];

/**
 * Legal next kinds for a single job, given its current in-memory status.
 * COMPLETED_OK / SEND_TO_COMPANY / RECEIVE_FROM_COMPANY reuse getTransitions()
 * — the same state machine Job Control uses for single-job transitions — so
 * this never drifts from the single-job rules. FINAL/DELIVER aren't entries
 * in that table (they're separate flag flips), so they're derived directly
 * from is_final/is_closed, matching job-control-section.tsx's own gating.
 */
export function getLegalKinds(job: WarrantyBatchJobRow): Set<TransactionKind> {
    const legal = new Set<TransactionKind>();
    const transitions = getTransitions(job.job_status_id, job.job_type_code);

    if (transitions.some(t => t.targetCode === "COMPLETED_OK"))               legal.add("COMPLETED_OK");
    if (transitions.some(t => t.targetCode === "SENT_TO_COMPANY"))            legal.add("SEND_TO_COMPANY");
    if (transitions.some(t => t.targetCode === "RECEIVED_BACK_FROM_COMPANY")) legal.add("RECEIVE_FROM_COMPANY");
    if (job.job_status_code === "COMPLETED_OK" && !job.is_final)             legal.add("FINAL");
    if (job.is_final && !job.is_closed)                                     legal.add("DELIVER");

    return legal;
}

/**
 * A checkbox is enabled in the UI only if legal for every currently-selected
 * job (intersection, not union) — selecting jobs at different pipeline
 * positions naturally narrows what's checkable.
 *
 * The completion chain (COMPLETED_OK → FINAL → DELIVER) additionally
 * cascades on `checkedKinds`: FINAL becomes checkable once COMPLETED_OK is
 * checked (even if the jobs aren't COMPLETED_OK yet — they will be, by the
 * time FINAL runs in the same batch pass), and DELIVER likewise becomes
 * checkable once FINAL is checked. This lets a user select "Completed OK",
 * "Completed OK + Final a Job", or "Completed OK + Final a Job + Deliver a
 * Job" as one forward-progressing run for jobs that haven't reached those
 * stages yet — batch-execute.ts already re-derives legality live per job as
 * it advances, so this UI gating is the only piece that needed to catch up.
 * Vendor-cycle kinds aren't chained this way: sending an item out and
 * receiving it back can't sensibly happen in the same instant.
 */
export function getEligibleKinds(
    jobs: WarrantyBatchJobRow[],
    checkedKinds: Set<TransactionKind> = new Set(),
): Set<TransactionKind> {
    if (jobs.length === 0) return new Set();

    const perJobLegal = jobs.map(getLegalKinds);
    const allLegalFor = (kind: TransactionKind) => perJobLegal.every(s => s.has(kind));

    const eligible = new Set<TransactionKind>();

    if (allLegalFor("SEND_TO_COMPANY"))      eligible.add("SEND_TO_COMPANY");
    if (allLegalFor("RECEIVE_FROM_COMPANY")) eligible.add("RECEIVE_FROM_COMPANY");

    const completedOkEligible = allLegalFor("COMPLETED_OK");
    if (completedOkEligible) eligible.add("COMPLETED_OK");

    const finalEligible = allLegalFor("FINAL") || (completedOkEligible && checkedKinds.has("COMPLETED_OK"));
    if (finalEligible) eligible.add("FINAL");

    const deliverEligible = allLegalFor("DELIVER") || (finalEligible && checkedKinds.has("FINAL"));
    if (deliverEligible) eligible.add("DELIVER");

    return eligible;
}

/**
 * SEND_TO_COMPANY/RECEIVE_FROM_COMPANY and COMPLETED_OK/FINAL/DELIVER are
 * mutually exclusive in the UI (a job mid-vendor-cycle must pass back through
 * IN_PROGRESS — not one of these 5 kinds — before it can reach COMPLETED_OK,
 * so the two groups can never legally chain for the same job in one pass).
 * The checked set is therefore always a subset of exactly one group; this
 * picks which fixed pipeline order applies.
 */
export function pipelineOrderFor(checkedKinds: Set<TransactionKind>): TransactionKind[] {
    return checkedKinds.has("SEND_TO_COMPANY") || checkedKinds.has("RECEIVE_FROM_COMPANY")
        ? VENDOR_ORDER
        : COMPLETION_ORDER;
}
