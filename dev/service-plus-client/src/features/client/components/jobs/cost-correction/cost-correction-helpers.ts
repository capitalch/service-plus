import type { CostLineTable, EditableCostLine } from "./cost-correction-schema";

// Must stay identical to the `charge_name ~* '(spare|parts)'` test in
// sql_jobs.py's missing_cost_lines expression, and to the finalize-time
// validation in finalize-job-save.ts. Change one, change all three.
export const SPARE_CHARGE_PATTERN = /(spare|parts)/i;

// Every part line carries a cost; a charge line only does when it is really a
// spare/parts charge (labour and the like legitimately have no cost).
export function needsCost(line: { line_table: CostLineTable; name: string }): boolean {
    return line.line_table === "part" || SPARE_CHARGE_PATTERN.test(line.name);
}

export function isMissingCost(line: EditableCostLine): boolean {
    return needsCost(line) && !((parseFloat(line.cost_input) || 0) > 0);
}
