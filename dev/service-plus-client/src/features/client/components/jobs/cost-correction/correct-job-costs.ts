import { toast } from "sonner";

import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { apolloClient } from "@/lib/apollo-client";
import { encodeObj } from "@/lib/graphql-utils";

import type { EditableCostLine } from "./cost-correction-schema";

type ScriptResult = { submitted: number; updated: number };
type ScriptData = { genericUpdateScript: ScriptResult[] | number | null };

// Writes cost_price on existing job_part_used / job_additional_charge rows via
// the SET_JOB_COST_CORRECTION script (plans/plan.md Step 11). Nothing else is
// written — no selling price, no job.amount, no invoice, no stock. Every guard
// (cost > 0, row belongs to this job and branch, cost_price the only writable
// column) also lives in the SQL, so this function's checks are convenience, not
// the safety boundary.
export async function correctJobCosts(args: {
    dbName:   string;
    schema:   string;
    branchId: number;
    jobId:    number;
    lines:    EditableCostLine[];
}): Promise<boolean> {
    const { dbName, schema, branchId, jobId, lines } = args;

    const changed = lines
        .filter(l => (parseFloat(l.cost_input) || 0) !== l.cost_price)
        .map(l => ({ line_table: l.line_table, id: l.id, cost_price: parseFloat(l.cost_input) || 0 }));

    if (changed.length === 0) return false;

    if (changed.some(l => !(l.cost_price > 0))) {
        toast.error("Cost must be greater than zero on every corrected line.");
        return false;
    }

    try {
        const res = await apolloClient.mutate<ScriptData>({
            mutation:  GRAPHQL_MAP.genericUpdateScript,
            variables: {
                db_name: dbName,
                schema,
                value: encodeObj({
                    sql_id:   "SET_JOB_COST_CORRECTION",
                    sql_args: { job_id: jobId, branch_id: branchId, lines: JSON.stringify(changed) },
                }),
            },
        });

        // The script ends in a SELECT, so it comes back as [{ submitted, updated }].
        const out = res.data?.genericUpdateScript;
        const row = Array.isArray(out) ? out[0] : undefined;

        // A shortfall means the server's `valid` CTE rejected rows — stale ids, a
        // job/branch mismatch, or a non-positive cost. Never report that as success.
        if (!row || row.updated !== row.submitted) {
            toast.error("Some rows were rejected. Refresh and try again.");
            return false;
        }

        const n = row.updated;
        toast.success(`Cost updated on ${n} row${n !== 1 ? "s" : ""}.`);
        return true;
    } catch {
        toast.error("Failed to update cost. Please try again.");
        return false;
    }
}
