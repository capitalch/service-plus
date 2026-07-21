import { CheckCircle2, FileText, MinusCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExecResult } from "./batch-execute";
import { TRANSACTION_LABEL } from "./transaction-eligibility";

const thClass = "text-xs font-semibold uppercase tracking-wide text-(--cl-text-muted) px-3 py-2 text-left border-b border-(--cl-border) bg-(--cl-surface-2)";
const tdClass = "px-3 py-2 text-sm text-(--cl-text) border-b border-(--cl-border)";

const STATUS_STYLE: Record<ExecResult["status"], { icon: typeof CheckCircle2; className: string }> = {
    success: { icon: CheckCircle2, className: "text-emerald-600" },
    skipped: { icon: MinusCircle,  className: "text-(--cl-text-muted)" },
    failed:  { icon: XCircle,      className: "text-red-600" },
};

type Props = {
    results:               ExecResult[];
    canPrintDeliveryNote:  boolean;
    onPrintDeliveryNote:   () => void;
    onClose:               () => void;
};

// Always shown — even on 100% success — so a partial failure across N jobs
// x M transactions is never silent.
export function BatchResultsModal({ results, canPrintDeliveryNote, onPrintDeliveryNote, onClose }: Props) {
    const succeeded = results.filter(r => r.status === "success").length;
    const skipped   = results.filter(r => r.status === "skipped").length;
    const failed    = results.filter(r => r.status === "failed").length;

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Batch Result</DialogTitle>
                </DialogHeader>

                <div className="overflow-x-auto rounded-lg border border-(--cl-border)">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={thClass}>Job No</th>
                                <th className={thClass}>Transaction</th>
                                <th className={thClass}>Result</th>
                                <th className={thClass}>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => {
                                const { icon: Icon, className } = STATUS_STYLE[r.status];
                                return (
                                    <tr key={`${r.jobId}-${r.kind}-${i}`}>
                                        <td className={`${tdClass} font-mono font-semibold text-(--cl-accent)`}>#{r.jobNo}</td>
                                        <td className={tdClass}>{TRANSACTION_LABEL[r.kind]}</td>
                                        <td className={tdClass}>
                                            <span className={`flex items-center gap-1.5 font-semibold ${className}`}>
                                                <Icon className="h-3.5 w-3.5" />
                                                {r.status === "success" ? "Success" : r.status === "skipped" ? "Skipped" : "Failed"}
                                            </span>
                                        </td>
                                        <td className={`${tdClass} text-(--cl-text-muted)`}>{r.message ?? "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <p className="text-sm text-(--cl-text-muted)">
                    {succeeded} succeeded, {skipped} skipped, {failed} failed.
                </p>

                <DialogFooter>
                    <Button
                        disabled={!canPrintDeliveryNote}
                        title={!canPrintDeliveryNote ? "No jobs were delivered in this run" : undefined}
                        variant="outline"
                        onClick={onPrintDeliveryNote}
                    >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Job Delivery Note
                    </Button>
                    <Button onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
