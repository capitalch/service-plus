import type { CostLineTable, EditableCostLine } from "./cost-correction-schema";
import { chargeNeedsCost } from "../charge-cost-rule";

export { SPARE_CHARGE_PATTERN } from "../charge-cost-rule";

// Every part line carries a cost; a charge line only does when it is really a
// spare/parts charge (labour and the like legitimately have no cost).
export function needsCost(line: { line_table: CostLineTable; name: string }): boolean {
    return line.line_table === "part" || chargeNeedsCost(line.name);
}

export function isMissingCost(line: EditableCostLine): boolean {
    return needsCost(line) && !((parseFloat(line.cost_input) || 0) > 0);
}
