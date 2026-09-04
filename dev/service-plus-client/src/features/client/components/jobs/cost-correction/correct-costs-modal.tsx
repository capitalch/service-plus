import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GRAPHQL_MAP } from "@/constants/graphql-map";
import { SQL_MAP } from "@/constants/sql-map";
import { selectDbName } from "@/features/auth/store/auth-slice";
import { apolloClient } from "@/lib/apollo-client";
import { graphQlUtils, type GenericQueryData } from "@/lib/graphql-utils";
import { selectSchema } from "@/store/context-slice";
import { useAppSelector } from "@/store/hooks";

import { correctJobCosts } from "./correct-job-costs";
import { isMissingCost } from "./cost-correction-helpers";
import type { CostLine, EditableCostLine } from "./cost-correction-schema";

type Props = {
    open:     boolean;
    jobId:    number;
    jobNo:    string;
    branchId: number | null;
    onClose:  () => void;
    onSaved:  () => void;
};

const th = "sticky top-0 z-10 bg-(--cl-surface-2) px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--cl-text-muted) border-b border-(--cl-border)/30 whitespace-nowrap";
const td = "px-2 py-1.5 text-sm text-(--cl-text) border-b border-(--cl-border)/30 align-top";

function fmt(n: number): string {
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Cost-only editor for a job's existing part/charge lines, usable at any job
// status including delivered and posted (plans/plan.md Step 10). Deliberately
// has no add-row or delete-row action, and never touches selling price — the
// finalize screen's cost handler recomputes selling price from the markup, which
// would move the price on an already-invoiced job.
export function CorrectCostsModal({ open, jobId, jobNo, branchId, onClose, onSaved }: Props) {
    const dbName = useAppSelector(selectDbName);
    const schema = useAppSelector(selectSchema);

    const [lines,   setLines]   = useState<EditableCostLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(false);
    const [saving,  setSaving]  = useState(false);

    useEffect(() => {
        if (!open || !dbName || !schema || !branchId) return;
        let cancelled = false;
        setLoading(true);
        setError(false);

        apolloClient.query<GenericQueryData<CostLine>>({
            fetchPolicy: "network-only",
            query:       GRAPHQL_MAP.genericQuery,
            variables:   {
                db_name: dbName,
                schema,
                value: graphQlUtils.buildGenericQueryValue({
                    sqlId:   SQL_MAP.GET_JOB_COST_LINES,
                    sqlArgs: { job_id: jobId, branch_id: branchId },
                }),
            },
        }).then(res => {
            if (cancelled) return;
            const rows = res.data?.genericQuery ?? [];
            setLines(
                rows
                    // Both prices are nullable in the DB. Normalise to 0 here so an
                    // untouched null row doesn't read as "changed" against its input.
                    .map(r => ({
                        ...r,
                        cost_price:    r.cost_price ?? 0,
                        selling_price: r.selling_price ?? 0,
                        cost_input:    String(r.cost_price ?? 0),
                    }))
                    // The query orders by line_table, which puts charges first;
                    // the editor reads better parts-first.
                    .sort((a, b) =>
                        a.line_table === b.line_table ? a.id - b.id : (a.line_table === "part" ? -1 : 1)),
            );
        }).catch(() => {
            if (cancelled) return;
            setError(true);
        }).finally(() => {
            if (cancelled) return;
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [open, dbName, schema, branchId, jobId]);

    function handleCostInput(lineTable: string, id: number, value: string) {
        setLines(prev => prev.map(l =>
            l.line_table === lineTable && l.id === id ? { ...l, cost_input: value } : l));
    }

    const hasChanges  = lines.some(l => (parseFloat(l.cost_input) || 0) !== l.cost_price);
    const anyMissing  = lines.some(isMissingCost);
    const missingCount = lines.filter(isMissingCost).length;
    const canSave     = hasChanges && !anyMissing && !saving;

    async function handleSave() {
        if (!dbName || !schema || !branchId) return;
        setSaving(true);
        const ok = await correctJobCosts({ dbName, schema, branchId, jobId, lines });
        setSaving(false);
        if (ok) { onSaved(); onClose(); }
    }

    return (
        <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
            <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">Correct Costs — #{jobNo}</DialogTitle>
                    <DialogDescription className="text-xs text-amber-700 dark:text-amber-400">
                        Cost correction only — invoice, receipts, payments and stock are not affected.
                    </DialogDescription>
                </DialogHeader>

                {loading || error ? (
                    <div className="flex h-32 items-center justify-center gap-2 text-sm text-(--cl-text-muted)">
                        {error ? <span>Failed to load cost lines.</span> : <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>}
                    </div>
                ) : lines.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-(--cl-text-muted)">
                        This job has no parts or charges to correct.
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-auto rounded border border-(--cl-border)/30">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={th}>#</th>
                                    <th className={th}>Type</th>
                                    <th className={th}>Code</th>
                                    <th className={th}>Name / Description</th>
                                    <th className={`${th} text-right`}>Qty</th>
                                    <th className={`${th} text-right`}>Sale</th>
                                    <th className={`${th} text-right`}>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((l, idx) => {
                                    const missing = isMissingCost(l);
                                    return (
                                        <tr key={`${l.line_table}-${l.id}`}>
                                            <td className={`${td} text-(--cl-text-muted)`}>{idx + 1}</td>
                                            <td className={td}>
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                                    l.line_table === "part"
                                                        ? "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/40"
                                                        : "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40"
                                                }`}>
                                                    {l.line_table === "part" ? "Part" : "Charge"}
                                                </span>
                                            </td>
                                            <td className={`${td} font-mono text-xs`}>{l.code || "—"}</td>
                                            <td className={td}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{l.name}</span>
                                                    {l.note && <span className="text-[10px] text-(--cl-text-muted)">{l.note}</span>}
                                                </div>
                                            </td>
                                            <td className={`${td} text-right tabular-nums`}>{l.qty}</td>
                                            <td className={`${td} text-right tabular-nums`}>{fmt(l.selling_price)}</td>
                                            <td className={`${td} text-right`}>
                                                <Input
                                                    className={`h-8 w-28 text-right tabular-nums ${missing ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                                                    min="0.01"
                                                    step="0.01"
                                                    type="number"
                                                    value={l.cost_input}
                                                    onChange={e => handleCostInput(l.line_table, l.id, e.target.value)}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
                    <span className="text-xs text-(--cl-text-muted)">
                        {missingCount > 0
                            ? <span className="text-rose-600 dark:text-rose-400">{missingCount} line{missingCount !== 1 ? "s" : ""} still need a cost greater than zero.</span>
                            : hasChanges ? "Unsaved changes." : "No changes."}
                    </span>
                    <span className="flex gap-2">
                        <Button disabled={saving} variant="outline" onClick={onClose}>Cancel</Button>
                        <Button disabled={!canSave} onClick={() => void handleSave()}>
                            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                            Save Costs
                        </Button>
                    </span>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
