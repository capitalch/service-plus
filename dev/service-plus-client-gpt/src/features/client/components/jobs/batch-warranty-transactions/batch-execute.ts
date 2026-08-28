import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";
import { saveCustomerGstin } from "@/lib/gstin";
import type { WarrantyBatchJobRow } from "@/features/client/types/job";
import { getTransitions, STATUS_FLAGS } from "../job-pipeline/status-transitions";
import { getLegalKinds, pipelineOrderFor, type TransactionKind } from "./transaction-eligibility";

export type ExecStatus = "success" | "skipped" | "failed";

export type ExecResult = {
    jobId:   number;
    jobNo:   string;
    kind:    TransactionKind;
    status:  ExecStatus;
    message?: string;
};

export type ExecuteBatchArgs = {
    dbName:             string;
    schema:             string;
    jobs:               WarrantyBatchJobRow[];
    checkedKinds:       Set<TransactionKind>;
    technicianId:       number | null;
    remarks:            string;
    transactionDate:    string;
    performedByUserId:  string | null;
    deliveredOkStatusId: number | null;
    deliveryMannerName: string | null;
};

type Outcome = { ok: true } | { ok: false; message: string };

// COMPLETED_OK / SEND_TO_COMPANY / RECEIVE_FROM_COMPANY all resolve to the
// same generic mutation Job Control uses for single-job transitions
// (job-control-section.tsx `handleSubmitTransition`), just looped per job.
async function applyStatusTransition(
    args: ExecuteBatchArgs, job: WarrantyBatchJobRow, targetCode: string,
): Promise<Outcome & { targetId?: number; targetCode?: string }> {
    const transition = getTransitions(job.job_status_id, job.job_type_code).find(t => t.targetCode === targetCode);
    if (!transition) return { ok: false, message: "Not a legal transition from the job's current status." };

    const flags = STATUS_FLAGS[transition.targetId];
    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.updateJob,
            variables: {
                db_name: args.dbName,
                schema:  args.schema,
                value: encodeObj({
                    job_id:               job.id,
                    last_transaction_id:  job.last_transaction_id,
                    performed_by_user_id: args.performedByUserId,
                    remarks:              args.remarks || "",
                    transaction_date:     args.transactionDate || null,
                    xData: {
                        id:              job.id,
                        job_status_id:   transition.targetId,
                        division_id:     job.division_id,
                        // Technician is only required/relevant for COMPLETED_OK
                        // (the only one of the 5 kinds whose transition needs "T");
                        // otherwise keep the job's existing technician untouched.
                        technician_id:   targetCode === "COMPLETED_OK" ? args.technicianId : job.technician_id,
                        amount:          job.amount,
                        estimate_amount: job.estimate_amount,
                        is_final:        flags?.is_final  ?? false,
                        is_closed:       flags?.is_closed ?? false,
                    },
                }),
            },
        });
        return { ok: true, targetId: transition.targetId, targetCode: transition.targetCode };
    } catch {
        return { ok: false, message: "Status update failed." };
    }
}

// Warranty jobs with zero parts collapse Finalize to a no-input mutation:
// amount forced to 0, no parts/charges to submit (mirrors the warranty path
// in final-a-job-section.tsx).
async function applyFinal(args: ExecuteBatchArgs, job: WarrantyBatchJobRow): Promise<Outcome> {
    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.genericUpdate,
            variables: {
                db_name: args.dbName,
                schema:  args.schema,
                value: encodeObj({
                    tableName: "job",
                    xData: {
                        id:                            job.id,
                        is_final:                      true,
                        is_igst:                       false,
                        division_id:                   job.division_id,
                        amount:                         0,
                        to_show_parts_in_job_invoice:   true,
                        to_set_updated_at:              true,
                        xDetails: [{ tableName: "job_additional_charge", fkeyName: "job_id", xData: [] }],
                    },
                }),
            },
        });
        return { ok: true };
    } catch {
        return { ok: false, message: "Finalize failed." };
    }
}

// Mirrors delivery-modal.tsx's doDelivery(): zero-amount payment, no receipt
// step (warranty jobs are amount:0 from Final), so delivery is also a
// no-input mutation here.
async function applyDeliver(args: ExecuteBatchArgs, job: WarrantyBatchJobRow): Promise<Outcome> {
    if (!args.deliveredOkStatusId) return { ok: false, message: "Delivered-OK status not found." };
    if (!args.deliveryMannerName) return { ok: false, message: "No delivery manner available." };
    try {
        await apolloClient.mutate({
            mutation: GRAPHQL_MAP.deliverJob,
            variables: {
                db_name: args.dbName,
                schema:  args.schema,
                value: encodeObj({
                    job_id:               job.id,
                    last_transaction_id:  job.last_transaction_id,
                    performed_by_user_id: args.performedByUserId,
                    delivered_status_id:  args.deliveredOkStatusId,
                    delivery_date:        args.transactionDate,
                    delivery_manner_name: args.deliveryMannerName,
                    remarks:              args.remarks || "",
                    payment: {
                        payment_date: args.transactionDate,
                        payment_mode: "Cash",
                        amount:       0,
                    },
                }),
            },
        });
        // No-op unless the customer's GSTIN is actually blank/changed — this
        // batch UI has no GSTIN input, so passing the current value through
        // both slots means saveCustomerGstin never overwrites anything.
        await saveCustomerGstin({
            customerId:   job.customer_contact_id,
            gstin:        job.customer_gstin,
            currentGstin: job.customer_gstin,
            dbName:       args.dbName,
            schema:       args.schema,
        });
        return { ok: true };
    } catch {
        return { ok: false, message: "Delivery failed." };
    }
}

/**
 * Sequential per-job loop (matches this repo's established non-atomic
 * per-job-mutation convention — see delivery-modal.tsx's doDelivery). Per
 * job, walks the fixed pipeline order, applying only the checked kinds that
 * are still legal for that job's *current* in-memory status — recomputed
 * live after each successful step, so a job that reaches COMPLETED_OK
 * mid-run can still pick up FINAL/DELIVER in the same pass. On a failed
 * step, remaining checked kinds for that job are marked skipped, but the
 * next job is still attempted.
 */
export async function executeBatch(args: ExecuteBatchArgs): Promise<ExecResult[]> {
    const results: ExecResult[] = [];
    const order = pipelineOrderFor(args.checkedKinds);

    for (const initialJob of args.jobs) {
        let job = initialJob;
        let stoppedForJob = false;

        for (const kind of order) {
            if (!args.checkedKinds.has(kind)) continue;

            if (stoppedForJob) {
                results.push({ jobId: job.id, jobNo: job.job_no, kind, status: "skipped", message: "Skipped after an earlier failure for this job" });
                continue;
            }

            if (!getLegalKinds(job).has(kind)) {
                results.push({ jobId: job.id, jobNo: job.job_no, kind, status: "skipped", message: "Already at or past this stage" });
                continue;
            }

            let outcome: Outcome;
            switch (kind) {
                case "COMPLETED_OK": {
                    const r = await applyStatusTransition(args, job, "COMPLETED_OK");
                    if (r.ok && r.targetId !== undefined && r.targetCode !== undefined) {
                        const flags = STATUS_FLAGS[r.targetId];
                        job = { ...job, job_status_id: r.targetId, job_status_code: r.targetCode, is_final: flags?.is_final ?? false, is_closed: flags?.is_closed ?? false };
                    }
                    outcome = r;
                    break;
                }
                case "SEND_TO_COMPANY": {
                    const r = await applyStatusTransition(args, job, "SENT_TO_COMPANY");
                    if (r.ok && r.targetId !== undefined && r.targetCode !== undefined) {
                        job = { ...job, job_status_id: r.targetId, job_status_code: r.targetCode };
                    }
                    outcome = r;
                    break;
                }
                case "RECEIVE_FROM_COMPANY": {
                    const r = await applyStatusTransition(args, job, "RECEIVED_BACK_FROM_COMPANY");
                    if (r.ok && r.targetId !== undefined && r.targetCode !== undefined) {
                        job = { ...job, job_status_id: r.targetId, job_status_code: r.targetCode };
                    }
                    outcome = r;
                    break;
                }
                case "FINAL": {
                    const r = await applyFinal(args, job);
                    if (r.ok) job = { ...job, is_final: true };
                    outcome = r;
                    break;
                }
                case "DELIVER": {
                    const r = await applyDeliver(args, job);
                    if (r.ok) job = { ...job, is_closed: true };
                    outcome = r;
                    break;
                }
            }

            if (outcome.ok) {
                results.push({ jobId: job.id, jobNo: job.job_no, kind, status: "success" });
            } else {
                results.push({ jobId: job.id, jobNo: job.job_no, kind, status: "failed", message: outcome.message });
                stoppedForJob = true;
            }
        }
    }

    return results;
}
