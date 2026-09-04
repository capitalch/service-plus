// Types for the cost-correction editor (plans/plan.md Steps 8-11). Shapes match
// the GET_JOB_COST_LINES result, which UNIONs job_part_used and
// job_additional_charge into one row shape.

export type CostLineTable = "part" | "charge";

export type CostLine = {
    line_table:    CostLineTable;
    id:            number;
    qty:           number;
    cost_price:    number;
    selling_price: number;
    code:          string | null;
    name:          string;
    note:          string | null;
};

// cost_price is kept as the raw input string while editing so a half-typed
// value ("1.", "") survives keystrokes; it is parsed only on save.
export type EditableCostLine = CostLine & { cost_input: string };
