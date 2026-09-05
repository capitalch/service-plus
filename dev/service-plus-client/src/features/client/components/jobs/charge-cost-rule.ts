// The single client-side definition of "this charge line needs a cost".
//
// Must stay identical to the `charge_name ~* '(spare|parts)'` test in sql_jobs.py's
// missing_cost_lines expression (GET_DELIVERABLE_JOBS_PAGED / GET_DELIVERED_JOBS_PAGED).
// A drift between the two shows up as a grid badge count that disagrees with what the
// finalize form and the Correct Costs modal flag.
//
// Every part line carries a cost. A charge line only does when it is really a spare/parts
// charge — labour, service and visit charges legitimately have none.
export const SPARE_CHARGE_PATTERN = /(spare|parts)/i;

export function chargeNeedsCost(chargeName: string): boolean {
    return SPARE_CHARGE_PATTERN.test(chargeName);
}
